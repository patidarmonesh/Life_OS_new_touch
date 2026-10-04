import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { subDays, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from 'date-fns'
import { v4 as uuid } from 'uuid'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid
} from 'recharts'
import { Plus, Search, Pencil, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import TagInput from '../components/ui/TagInput'
import EmptyState from '../components/ui/EmptyState'
import { useToast } from '../context/toastContextCore'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'
import { playSuccessSound, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { getGeminiApiKey, analyzeJournalSentimentWithAI } from '../services/geminiService'
import { Sparkles, Brain } from 'lucide-react'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Very Low', color: '#EF4444' },
  { value: 2, emoji: '😕', label: 'Low', color: '#F97316' },
  { value: 3, emoji: '😐', label: 'Neutral', color: '#F59E0B' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#10B981' },
  { value: 5, emoji: '😄', label: 'Great', color: '#3B82F6' },
]

const PROMPTS = [
  'What made today meaningful?',
  'What drained your energy today?',
  'What are you avoiding right now?',
  'What am I proud of today?',
  'What small win happened today?',
  'What should I do differently tomorrow?',
]

export default function Journal() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const [activeTab, setActiveTab] = useState('entries')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null)
  const [expandedEntryId, setExpandedEntryId] = useState(null)
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPTS[0])
  const [form, setForm] = useState({
    date: today,
    title: '',
    content: '',
    mood: 4,
    energy: 3,
    gratitude: '',
    tags: [],
    aiSentiment: '',
    aiRecommendation: '',
  })

  const entries = useMemo(() => state.journal?.entries || [], [state.journal?.entries])

  const allTags = useMemo(() => [...new Set(entries.flatMap(e => e.tags || []))], [entries])

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))

  const filteredEntries = sortedEntries.filter(entry => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      entry.title?.toLowerCase().includes(q) ||
      entry.content?.toLowerCase().includes(q) ||
      entry.gratitude?.toLowerCase().includes(q) ||
      (entry.tags || []).some(tag => tag.toLowerCase().includes(q))
    )
  })

  const last14Mood = Array.from({ length: 14 }, (_, i) => {
    const d = toDateKey(subDays(new Date(), 13 - i), timezone)
    const dayEntries = entries.filter(e => e.date === d)
    const avgMood = dayEntries.length
      ? +(dayEntries.reduce((a, e) => a + (e.mood || 0), 0) / dayEntries.length).toFixed(1)
      : null
    return {
      day: formatDateKey(d, timezone, { month: 'short', day: 'numeric' }),
      mood: avgMood,
    }
  })

  const tagCounts = {}
  entries.forEach(entry => {
    ;(entry.tags || []).forEach(tag => {
      const clean = tag.trim()
      if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const moodBreakdown = MOODS.map(m => ({
    name: m.label,
    emoji: m.emoji,
    value: entries.filter(e => e.mood === m.value).length,
    color: m.color,
  }))

  const averageMood = entries.length
    ? +(entries.reduce((a, e) => a + (e.mood || 0), 0) / entries.length).toFixed(1)
    : 0

  function resetForm() {
    setForm({
      date: today,
      title: '',
      content: '',
      mood: 4,
      energy: 3,
      gratitude: '',
      tags: [],
      aiSentiment: '',
      aiRecommendation: '',
    })
  }

  function closeModal() {
    setShowNewModal(false)
    setEditingEntry(null)
    resetForm()
  }

  function startEdit(entry) {
    setEditingEntry(entry)
    setForm({
      date: entry.date,
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood ?? 4,
      energy: entry.energy ?? 3,
      gratitude: entry.gratitude || '',
      tags: entry.tags || [],
      aiSentiment: entry.aiSentiment || '',
      aiRecommendation: entry.aiRecommendation || '',
    })
    setShowNewModal(true)
  }

  function saveEntry() {
    if (!form.content.trim()) return

    const payload = {
      date: form.date,
      title: form.title.trim() || 'Untitled Entry',
      content: form.content.trim(),
      mood: Number(form.mood),
      energy: Number(form.energy),
      gratitude: form.gratitude.trim(),
      tags: form.tags,
      aiSentiment: form.aiSentiment,
      aiRecommendation: form.aiRecommendation,
      updatedAt: new Date().toISOString(),
    }

    if (editingEntry) {
      setModule('journal', {
        ...state.journal,
        entries: entries.map(e => (e.id === editingEntry.id ? { ...e, ...payload } : e)),
      })
      showToast('Entry updated ✓', 'success')
      playSuccessSound()
      hapticSuccess()
    } else {
      const newEntry = {
        id: uuid(),
        ...payload,
        createdAt: new Date().toISOString(),
      }
      setModule('journal', {
        ...state.journal,
        entries: [newEntry, ...entries],
      })
      showToast('Entry saved ✓', 'success')
      playSuccessSound()
      hapticSuccess()
    }

    closeModal()
  }

  function deleteEntry(id) {
    const prev = entries
    setModule('journal', {
      ...state.journal,
      entries: entries.filter(e => e.id !== id),
    })
    showToast('Entry deleted', 'warning', {
      undo: () => setModule('journal', { ...state.journal, entries: prev }),
    })
    playWarningBeep()
    hapticLight()
  }

  async function runAISentimentAnalysis() {
    if (!form.content.trim()) {
      showToast('Please write some content first!', 'warning')
      return
    }

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      showToast('AI is unavailable for this session. Configure the server integration to reflect on this selected entry.', 'error')
      return
    }

    setAiLoading(true)
    try {
      showToast('Analyzing journal sentiment & emotion... 🧘', 'info')
      const result = await analyzeJournalSentimentWithAI({
        apiKey,
        content: form.content,
      })

      if (result) {
        setForm(f => ({
          ...f,
          aiSentiment: result.sentiment || 'Neutral',
          aiRecommendation: result.healthCheckRecommendation || '',
          tags: Array.from(new Set([...f.tags, ...(result.recurringThemes || [])])),
        }))
        showToast('Sentiment analyzed successfully! ✨', 'success')
        playSuccessSound()
        hapticSuccess()
      } else {
        showToast('Could not parse response. Try again.', 'error')
      }
    } catch (e) {
      showToast(e.message || 'AI analysis failed', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const tabStyle = (active) => ({
    padding: '8px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--accent-indigo)' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid var(--accent-indigo)' : '2px solid transparent',
  })

  return (
    <div className="legacy-area" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem' }}>📓 Journal</h1>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus size={16} /> New Entry
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {['entries', 'calendar', 'insights'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab === 'entries' ? 'Entries' : tab === 'calendar' ? '📅 Calendar' : 'Insights'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'entries' && (
          <>
            <Card>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search entries, gratitude, tags..."
                    style={{ ...inputStyle, paddingLeft: '34px' }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {filteredEntries.length} entries
                </div>
              </div>
            </Card>

            {filteredEntries.length === 0 ? (
              <Card>
                <EmptyState
                  icon="✍️"
                  title="No journal entries yet"
                  subtitle="Start writing daily reflections, wins, and thoughts."
                  action={{ label: '✍️ Write First Entry', onClick: () => setShowNewModal(true) }}
                />
              </Card>
            ) : (
              filteredEntries.map(entry => {
                const moodObj = MOODS.find(m => m.value === entry.mood) || MOODS[2]
                return (
                  <Card key={entry.id} style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(99,102,241,0.10)', padding: 0, transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                    {/* ── Entry Header ─────────────────────────────── */}
                    <div style={{
                      padding: '16px 18px 12px',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.04) 100%)',
                      borderBottom: '1px solid rgba(99,102,241,0.08)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{entry.title}</h3>
                            <span style={{
                              fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                              background: `${moodObj.color}18`, color: moodObj.color,
                              fontWeight: '700', border: `1px solid ${moodObj.color}30`,
                            }}>
                              {moodObj.emoji} {moodObj.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: '600', color: '#818CF8',
                              background: 'rgba(99,102,241,0.08)', padding: '2px 8px',
                              borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace',
                            }}>
                              📅 {entry.date}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Energy</span>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                {[1,2,3,4,5].map(n => (
                                  <div key={n} style={{
                                    width: '14px', height: '6px', borderRadius: '3px',
                                    background: n <= entry.energy ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                                    transition: 'background 0.2s',
                                  }} />
                                ))}
                              </div>
                              <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>{entry.energy}/5</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            aria-label="Edit entry"
                            style={{
                              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: 'var(--text-muted)',
                              padding: 6, minHeight: 32, minWidth: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s',
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <ConfirmDeleteButton onConfirm={() => deleteEntry(entry.id)} label="Delete journal entry" />
                        </div>
                      </div>
                    </div>

                    {/* ── Entry Content with smart rendering ──────── */}
                    <div style={{ padding: '14px 18px 16px' }}>
                      {(() => {
                        const lines = entry.content.split('\n')
                        const isLong = lines.length > 12
                        const isExpanded = expandedEntryId === entry.id
                        const visibleLines = isLong && !isExpanded ? lines.slice(0, 10) : lines

                        // Group lines into sections based on ## headings
                        const sections = []
                        let currentSection = { heading: null, lines: [] }

                        visibleLines.forEach((line) => {
                          const trimmed = line.trim()
                          if (trimmed.startsWith('## ')) {
                            if (currentSection.heading || currentSection.lines.length > 0) {
                              sections.push({ ...currentSection })
                            }
                            currentSection = { heading: trimmed.replace('## ', ''), lines: [] }
                          } else {
                            currentSection.lines.push(trimmed)
                          }
                        })
                        if (currentSection.heading || currentSection.lines.length > 0) {
                          sections.push(currentSection)
                        }

                        // Assign colors to sections based on content
                        const getSectionStyle = (heading) => {
                          if (!heading) return { accent: '#6366F1', bg: 'rgba(99,102,241,0.04)', icon: '📝' }
                          const h = heading.toLowerCase()
                          if (h.includes('flag') || h.includes('waste') || h.includes('problem')) return { accent: '#EF4444', bg: 'rgba(239,68,68,0.05)', icon: '🚩' }
                          if (h.includes('improve') || h.includes('tip') || h.includes('suggestion') || h.includes('save')) return { accent: '#10B981', bg: 'rgba(16,185,129,0.05)', icon: '💡' }
                          if (h.includes('time') || h.includes('schedule') || h.includes('routine')) return { accent: '#F59E0B', bg: 'rgba(245,158,11,0.05)', icon: '⏰' }
                          if (h.includes('study') || h.includes('focus') || h.includes('learn')) return { accent: '#3B82F6', bg: 'rgba(59,130,246,0.05)', icon: '📚' }
                          if (h.includes('habit') || h.includes('non-negotiable')) return { accent: '#8B5CF6', bg: 'rgba(139,92,246,0.05)', icon: '🔒' }
                          if (h.includes('goal') || h.includes('target') || h.includes('tomorrow')) return { accent: '#EC4899', bg: 'rgba(236,72,153,0.05)', icon: '🎯' }
                          if (h.includes('summary') || h.includes('overview') || h.includes('analysis')) return { accent: '#06B6D4', bg: 'rgba(6,182,212,0.05)', icon: '📊' }
                          return { accent: '#6366F1', bg: 'rgba(99,102,241,0.04)', icon: '✨' }
                        }

                        // Render inline bold/emoji text
                        const renderInline = (text) => {
                          const parts = text.split(/(\*\*[^*]+\*\*)/g)
                          return parts.map((part, pi) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={pi} style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{part.slice(2, -2)}</strong>
                            }
                            return <span key={pi}>{part}</span>
                          })
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sections.map((section, sIdx) => {
                              const sStyle = getSectionStyle(section.heading)
                              const nonEmptyLines = section.lines.filter(l => l.length > 0)

                              if (section.heading) {
                                return (
                                  <div key={sIdx} style={{
                                    borderRadius: '12px',
                                    border: `1px solid ${sStyle.accent}18`,
                                    background: sStyle.bg,
                                    overflow: 'hidden',
                                  }}>
                                    {/* Section heading */}
                                    <div style={{
                                      padding: '8px 12px',
                                      borderBottom: `1px solid ${sStyle.accent}12`,
                                      display: 'flex', alignItems: 'center', gap: '6px',
                                    }}>
                                      <span style={{ fontSize: '14px' }}>{sStyle.icon}</span>
                                      <span style={{
                                        fontSize: '12px', fontWeight: '800', color: sStyle.accent,
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                        fontFamily: 'Syne, sans-serif',
                                      }}>
                                        {section.heading}
                                      </span>
                                    </div>

                                    {/* Section body */}
                                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {nonEmptyLines.map((line, li) => {
                                        // Numbered item → mini card with left accent
                                        if (/^\d+\.\s/.test(line)) {
                                          const num = line.match(/^(\d+)\./)[1]
                                          const text = line.replace(/^\d+\.\s*/, '')
                                          return (
                                            <div key={li} style={{
                                              display: 'flex', alignItems: 'flex-start', gap: '8px',
                                              padding: '6px 8px', borderRadius: '8px',
                                              background: `${sStyle.accent}06`,
                                              borderLeft: `3px solid ${sStyle.accent}40`,
                                            }}>
                                              <span style={{
                                                fontSize: '11px', fontWeight: '800', color: sStyle.accent,
                                                fontFamily: 'JetBrains Mono, monospace',
                                                minWidth: '18px', flexShrink: 0,
                                                background: `${sStyle.accent}15`, padding: '1px 4px',
                                                borderRadius: '4px', textAlign: 'center',
                                              }}>{num}</span>
                                              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{renderInline(text)}</span>
                                            </div>
                                          )
                                        }
                                        // Bullet or emoji line
                                        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('✅') || line.startsWith('🚩') || line.startsWith('⏰') || line.startsWith('💡') || line.startsWith('→') || line.startsWith('🎯') || line.startsWith('📌')) {
                                          const cleanLine = line.replace(/^[•\-✅🚩⏰💡→🎯📌]\s*/u, '')
                                          const emoji = line.match(/^[•\-✅🚩⏰💡→🎯📌]/u)?.[0] || '•'
                                          return (
                                            <div key={li} style={{
                                              display: 'flex', alignItems: 'flex-start', gap: '6px',
                                              padding: '4px 6px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5',
                                            }}>
                                              <span style={{ flexShrink: 0, fontSize: '12px' }}>{emoji}</span>
                                              <span>{renderInline(cleanLine)}</span>
                                            </div>
                                          )
                                        }
                                        // Regular text
                                        return (
                                          <div key={li} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6', padding: '1px 6px' }}>
                                            {renderInline(line)}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              }

                              // Lines without a heading — render as plain styled text
                              return (
                                <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {nonEmptyLines.map((line, li) => {
                                    if (/^\d+\.\s/.test(line)) {
                                      const num = line.match(/^(\d+)\./)[1]
                                      const text = line.replace(/^\d+\.\s*/, '')
                                      return (
                                        <div key={li} style={{
                                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                                          padding: '5px 8px', borderRadius: '8px',
                                          borderLeft: '3px solid rgba(99,102,241,0.25)',
                                          background: 'rgba(99,102,241,0.03)',
                                        }}>
                                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', fontFamily: 'JetBrains Mono, monospace', minWidth: '16px' }}>{num}.</span>
                                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{renderInline(text)}</span>
                                        </div>
                                      )
                                    }
                                    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('✅') || line.startsWith('🚩') || line.startsWith('💡') || line.startsWith('→')) {
                                      return (
                                        <div key={li} style={{ display: 'flex', gap: '6px', padding: '3px 6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                          <span style={{ flexShrink: 0 }}>•</span>
                                          <span>{renderInline(line.replace(/^[•\-✅🚩💡→]\s*/u, ''))}</span>
                                        </div>
                                      )
                                    }
                                    return <div key={li} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', padding: '1px 0' }}>{renderInline(line)}</div>
                                  })}
                                </div>
                              )
                            })}

                            {isLong && (
                              <button
                                onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                style={{
                                  marginTop: '4px', padding: '6px 14px', borderRadius: '8px',
                                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
                                  border: '1px solid rgba(99,102,241,0.15)',
                                  color: '#818CF8', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                                  fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center',
                                  gap: '4px', width: 'fit-content',
                                }}
                              >
                                {isExpanded ? '▲ Show Less' : `▼ Show More (${lines.length - 10} more lines)`}
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── AI Sentiment Badge ──────────────────────── */}
                      {entry.aiSentiment && (
                        <div style={{
                          marginTop: '12px', fontSize: '12px', padding: '10px 12px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))',
                          border: '1px solid rgba(99,102,241,0.12)',
                        }}>
                          <div style={{
                            color: '#818CF8', fontWeight: '800', textTransform: 'uppercase', fontSize: '10px',
                            letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px',
                            fontFamily: 'Syne, sans-serif',
                          }}>
                            <Brain size={12} /> AI Sentiment: {entry.aiSentiment}
                          </div>
                          {entry.aiRecommendation && <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>{entry.aiRecommendation}</p>}
                        </div>
                      )}

                      {/* ── Gratitude Section ──────────────────────── */}
                      {entry.gratitude && (
                        <div style={{
                          marginTop: '12px', padding: '10px 12px', borderRadius: '10px',
                          background: 'rgba(16,185,129,0.06)',
                          border: '1px solid rgba(16,185,129,0.15)',
                          borderLeft: '3px solid #10B981',
                        }}>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>
                            🙏 Gratitude
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontStyle: 'italic' }}>
                            "{entry.gratitude}"
                          </div>
                        </div>
                      )}

                      {/* ── Tags ─────────────────────────────────── */}
                      {entry.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '12px' }}>
                          {entry.tags.map(tag => (
                            <span
                              key={tag}
                              style={{
                                padding: '3px 10px',
                                borderRadius: '999px',
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.12)',
                                fontSize: '11px',
                                color: '#818CF8',
                                fontWeight: '600',
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </>
        )}

        {activeTab === 'calendar' && (() => {
          const monthStart = startOfMonth(calendarMonth)
          const monthEnd = endOfMonth(calendarMonth)
          const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
          const startDayOfWeek = getDay(monthStart)
          const entriesByDate = {}
          entries.forEach(e => {
            if (!entriesByDate[e.date]) entriesByDate[e.date] = []
            entriesByDate[e.date].push(e)
          })
          const calEntries = calendarSelectedDate ? (entriesByDate[format(calendarSelectedDate, 'yyyy-MM-dd')] || []) : []

          return (
            <>
              <Card style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <button onClick={() => setCalendarMonth(m => subMonths(m, 1))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                    {format(calendarMonth, 'MMMM yyyy')}
                  </div>
                  <button onClick={() => setCalendarMonth(m => addMonths(m, 1))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '4px', marginBottom: '8px' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '4px' }}>
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {daysInMonth.map(day => {
                    const dk = format(day, 'yyyy-MM-dd')
                    const dayEntries = entriesByDate[dk] || []
                    const hasEntries = dayEntries.length > 0
                    const isSelected = calendarSelectedDate && isSameDay(day, calendarSelectedDate)
                    const isToday = dk === today
                    const avgMood = hasEntries ? Math.round(dayEntries.reduce((a, e) => a + (e.mood || 3), 0) / dayEntries.length) : 0
                    const moodObj = MOODS.find(m => m.value === avgMood)

                    return (
                      <div
                        key={dk}
                        onClick={() => setCalendarSelectedDate(isSelected ? null : day)}
                        style={{
                          position: 'relative', textAlign: 'center', padding: '10px 4px',
                          borderRadius: '10px', cursor: 'pointer',
                          background: isSelected ? 'rgba(99,102,241,0.15)' : hasEntries ? `${(moodObj?.color || '#6366F1')}08` : 'transparent',
                          border: isSelected ? '2px solid var(--accent-indigo)' : isToday ? '2px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: isToday ? '800' : '500', color: isSelected ? 'var(--accent-indigo)' : isToday ? '#818CF8' : hasEntries ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {format(day, 'd')}
                        </div>
                        {hasEntries && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '3px' }}>
                            {dayEntries.length <= 3 ? dayEntries.map((e, idx) => (
                              <div key={idx} style={{ width: '5px', height: '5px', borderRadius: '50%', background: (MOODS.find(m => m.value === e.mood) || MOODS[2]).color }} />
                            )) : (
                              <div style={{ fontSize: '9px', fontWeight: '700', color: moodObj?.color || '#6366F1' }}>{dayEntries.length}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>

              {calendarSelectedDate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="var(--accent-indigo)" />
                    {format(calendarSelectedDate, 'EEEE, MMMM d, yyyy')}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400' }}>({calEntries.length} {calEntries.length === 1 ? 'entry' : 'entries'})</span>
                  </div>
                  {calEntries.length === 0 ? (
                    <Card style={{ padding: '24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '30px', marginBottom: '6px' }}>📭</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No entries on this day</div>
                      <Button onClick={() => { setForm(f => ({ ...f, date: format(calendarSelectedDate, 'yyyy-MM-dd') })); setShowNewModal(true); }} style={{ marginTop: '10px' }}>
                        <Plus size={14} /> Write Entry
                      </Button>
                    </Card>
                  ) : calEntries.map(entry => {
                    const moodObj = MOODS.find(m => m.value === entry.mood) || MOODS[2]
                    return (
                      <Card key={entry.id} style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>{entry.title}</h3>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: `${moodObj.color}20`, color: moodObj.color, fontWeight: '600' }}>
                                {moodObj.emoji} {moodObj.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Energy {entry.energy}/5</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => startEdit(entry)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Pencil size={14} />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                          {entry.content}
                        </div>
                        {entry.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {entry.tags.map(tag => (
                              <span key={tag} style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '11px', color: '#818CF8' }}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

        {activeTab === 'insights' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
              {[
                { label: 'Total Entries', value: entries.length, color: 'var(--accent-indigo)', icon: '📘' },
                { label: 'Average Mood', value: averageMood || '—', color: '#10B981', icon: '🙂' },
                { label: 'Entries This Week', value: entries.filter(e => {
                    const d = new Date(e.date + 'T00:00:00')
                    return d >= subDays(new Date(), 6)
                  }).length, color: '#F59E0B', icon: '🗓️' },
              ].map(card => (
                <Card key={card.label} style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px' }}>{card.icon}</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: card.color, marginTop: '4px' }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.label}</div>
                </Card>
              ))}
            </div>

            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>Mood Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={last14Mood} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[1, 5]} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="mood" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: '#6366F1', r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px' }}>
                Mood Distribution
            </h3>

            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={moodBreakdown} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                <XAxis dataKey="emoji" tick={{ fontSize: 18 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px'
                    }}
                />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            </Card>              

            <Card>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>Top Tags</h3>
              {topTags.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tags yet.</div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {topTags.map(([tag, count]) => (
                    <div
                      key={tag}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '999px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      #{tag} <span style={{ color: 'var(--text-muted)' }}>({count})</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Modal isOpen={showNewModal} onClose={closeModal} title={editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Solid workday, weird mental fog"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Prompt</label>
            <select
              value={selectedPrompt}
              onChange={e => setSelectedPrompt(e.target.value)}
              style={inputStyle}
            >
              {PROMPTS.map(prompt => (
                <option key={prompt} value={prompt}>{prompt}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Entry</label>
            <textarea
              rows={7}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={selectedPrompt}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Mood</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: form.mood === m.value ? m.color : 'var(--border)',
                      background: form.mood === m.value ? `${m.color}20` : 'transparent',
                      cursor: 'pointer',
                      fontSize: '18px',
                    }}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Energy</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setForm(f => ({ ...f, energy: n }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: form.energy >= n ? '#F59E0B' : 'var(--border)',
                      background: form.energy >= n ? 'rgba(245,158,11,0.15)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: form.energy >= n ? '#F59E0B' : 'var(--text-muted)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Gratitude</label>
            <input
              value={form.gratitude}
              onChange={e => setForm(f => ({ ...f, gratitude: e.target.value }))}
              placeholder="One thing you're grateful for today"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Tags</label>
            <TagInput
              tags={form.tags || []}
              onChange={tags => setForm(f => ({ ...f, tags }))}
              allTags={allTags}
              placeholder="Add tags..."
            />
          </div>

          {form.aiSentiment && (
            <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '12px' }}>
              <strong>🎭 AI Analyzed Sentiment:</strong> {form.aiSentiment}
              {form.aiRecommendation && <p style={{ margin: '2px 0 0', color: 'var(--text-muted)' }}>{form.aiRecommendation}</p>}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={runAISentimentAnalysis}
              disabled={aiLoading || !form.content.trim()}
              style={{ flex: 1, borderColor: 'rgba(99,102,241,0.3)', color: '#C7D2FE' }}
            >
              <Sparkles size={14} className={aiLoading ? 'animate-pulse' : ''} />
              {aiLoading ? 'Analyzing...' : 'Analyze Sentiment with AI'}
            </Button>
            <Button onClick={saveEntry} disabled={!form.content.trim()} style={{ flex: 1 }}>
              {editingEntry ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


