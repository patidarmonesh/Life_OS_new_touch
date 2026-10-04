import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../context/appHooks'
import {
  Search, ArrowRight, Clock, DollarSign, BookOpen,
  Timer, FileText, CheckSquare, Heart, Command, Plus,
  X, CornerDownLeft,
} from 'lucide-react'

const RECENT_SEARCHES_KEY = 'lifeos-recent-searches'
const MAX_RECENT = 5
const MAX_PER_MODULE = 5
const MAX_TOTAL = 20

const MODULE_CONFIG = {
  finance: {
    label: 'Finance',
    icon: DollarSign,
    color: 'var(--finance-color)',
    badgeColor: '#10B981',
    route: '/finance',
  },
  study: {
    label: 'Study',
    icon: BookOpen,
    color: 'var(--study-color)',
    badgeColor: '#3B82F6',
    route: '/study',
  },
  timeflow: {
    label: 'Time Flow',
    icon: Timer,
    color: 'var(--time-color)',
    badgeColor: '#F59E0B',
    route: '/timeflow',
  },
  journal: {
    label: 'Journal',
    icon: FileText,
    color: 'var(--journal-color)',
    badgeColor: '#8B5CF6',
    route: '/journal',
  },
  habits: {
    label: 'Habits',
    icon: CheckSquare,
    color: 'var(--habit-color)',
    badgeColor: '#6366F1',
    route: '/habits',
  },
  health: {
    label: 'Health',
    icon: Heart,
    color: 'var(--health-color)',
    badgeColor: '#EC4899',
    route: '/health',
  },
  wisdom: {
    label: 'Wisdom Log',
    icon: BookOpen,
    color: 'var(--accent-indigo)',
    badgeColor: '#EC4899',
    route: '/wisdom',
  },
}

const QUICK_ACTIONS = [
  { id: 'add-expense', label: 'Add Expense', icon: DollarSign, route: '/finance', color: 'var(--finance-color)' },
  { id: 'log-study', label: 'Log Study Session', icon: BookOpen, route: '/study', color: 'var(--study-color)' },
  { id: 'new-journal', label: 'New Journal Entry', icon: FileText, route: '/journal', color: 'var(--journal-color)' },
  { id: 'log-time', label: 'Log Time Entry', icon: Timer, route: '/timeflow', color: 'var(--time-color)' },
  { id: 'log-health', label: 'Log Health Data', icon: Heart, route: '/health', color: 'var(--health-color)' },
  { id: 'view-habits', label: 'View Habits', icon: CheckSquare, route: '/habits', color: 'var(--habit-color)' },
]

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentSearches(searches) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)))
  } catch {
    // localStorage might be full
  }
}

function fuzzyMatch(text, query) {
  if (!text || !query) return false
  return String(text).toLowerCase().includes(query.toLowerCase())
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function searchModules(state, query) {
  const results = []
  const q = query.trim()
  if (!q) return results

  // Finance — expenses
  const expenses = state.finance?.expenses || []
  let financeCount = 0
  for (const exp of expenses) {
    if (financeCount >= MAX_PER_MODULE) break
    if (
      fuzzyMatch(exp.description, q) ||
      fuzzyMatch(exp.category, q) ||
      fuzzyMatch(String(exp.amount), q)
    ) {
      results.push({
        id: `finance-${exp.id}`,
        module: 'finance',
        title: exp.description || 'Expense',
        subtitle: `₹${exp.amount} · ${exp.category || 'Uncategorized'}`,
        date: exp.date,
        sortTime: exp.createdAt || exp.date,
      })
      financeCount++
    }
  }

  // Study — sessions
  const sessions = state.study?.sessions || []
  let studyCount = 0
  for (const sess of sessions) {
    if (studyCount >= MAX_PER_MODULE) break
    if (
      fuzzyMatch(sess.subject, q) ||
      fuzzyMatch(sess.topic, q)
    ) {
      results.push({
        id: `study-${sess.id}`,
        module: 'study',
        title: sess.subject || 'Study Session',
        subtitle: sess.topic || `${Math.round((sess.durationMinutes || 0) / 60 * 10) / 10}h session`,
        date: sess.date,
        sortTime: sess.createdAt || sess.date,
      })
      studyCount++
    }
  }

  // TimeFlow — entries
  const timeEntries = state.timeflow?.entries || []
  let timeCount = 0
  for (const entry of timeEntries) {
    if (timeCount >= MAX_PER_MODULE) break
    if (
      fuzzyMatch(entry.name, q) ||
      fuzzyMatch(entry.category, q)
    ) {
      results.push({
        id: `timeflow-${entry.id}`,
        module: 'timeflow',
        title: entry.name || 'Time Entry',
        subtitle: `${entry.category || 'General'} · ${entry.start || ''}–${entry.end || ''}`,
        date: entry.date,
        sortTime: entry.createdAt || entry.date,
      })
      timeCount++
    }
  }

  // Journal — entries
  const journalEntries = state.journal?.entries || []
  let journalCount = 0
  for (const entry of journalEntries) {
    if (journalCount >= MAX_PER_MODULE) break
    const contentPreview = (entry.content || '').slice(0, 100)
    if (
      fuzzyMatch(entry.content, q) ||
      fuzzyMatch(entry.title, q) ||
      fuzzyMatch(entry.mood, q)
    ) {
      results.push({
        id: `journal-${entry.id}`,
        module: 'journal',
        title: entry.title || `Journal — ${entry.mood || entry.date || 'Entry'}`,
        subtitle: contentPreview.length >= 100 ? contentPreview + '…' : contentPreview,
        date: entry.date,
        sortTime: entry.createdAt || entry.date,
      })
      journalCount++
    }
  }

  // Habits — checkpoints
  const checkpoints = state.habits?.checkpoints || []
  let habitCount = 0
  for (const cp of checkpoints) {
    if (habitCount >= MAX_PER_MODULE) break
    if (
      fuzzyMatch(cp.title, q) ||
      fuzzyMatch(cp.description, q) ||
      fuzzyMatch(cp.category, q)
    ) {
      results.push({
        id: `habits-${cp.id}`,
        module: 'habits',
        title: `${cp.icon || '✅'} ${cp.title || 'Habit'}`,
        subtitle: cp.description || cp.category || '',
        date: cp.startDate,
        sortTime: cp.createdAt || cp.startDate,
      })
      habitCount++
    }
  }

  // Health — manualLogs
  const healthLogs = state.health?.manualLogs || []
  let healthCount = 0
  for (const log of healthLogs) {
    if (healthCount >= MAX_PER_MODULE) break
    if (fuzzyMatch(log.date, q)) {
      results.push({
        id: `health-${log.id}`,
        module: 'health',
        title: `Health Log — ${formatDate(log.date)}`,
        subtitle: `${log.steps || 0} steps · ${Math.round((log.sleepHours || 0) * 10) / 10}h sleep · Mood ${log.mood || '—'}/5`,
        date: log.date,
        sortTime: log.createdAt || log.date,
      })
      healthCount++
    }
  }

  // Wisdom — entries
  const wisdomEntries = state.wisdom?.entries || []
  let wisdomCount = 0
  for (const entry of wisdomEntries) {
    if (wisdomCount >= MAX_PER_MODULE) break
    if (
      fuzzyMatch(entry.text, q) ||
      fuzzyMatch(entry.source, q)
    ) {
      results.push({
        id: `wisdom-${entry.id}`,
        module: 'wisdom',
        title: entry.text || 'Wisdom Insight',
        subtitle: entry.source ? `Source: ${entry.source}` : 'Wisdom Log',
        date: entry.createdAt ? entry.createdAt.slice(0, 10) : '',
        sortTime: entry.createdAt,
      })
      wisdomCount++
    }
  }

  // Sort by date descending and cap total
  results.sort((a, b) => {
    const ta = new Date(b.sortTime || 0).getTime()
    const tb = new Date(a.sortTime || 0).getTime()
    return ta - tb
  })

  return results.slice(0, MAX_TOTAL)
}

function groupByModule(results) {
  const groups = {}
  for (const r of results) {
    if (!groups[r.module]) groups[r.module] = []
    groups[r.module].push(r)
  }
  return groups
}

export default function CommandPalette() {
  const state = useAppState()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches)
  
  // Global Ctrl+K listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }
    const customHandler = () => setIsOpen(true)
    window.addEventListener('keydown', handler)
    window.addEventListener('open-command-palette', customHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('open-command-palette', customHandler)
    }
  }, [])

  const onClose = useCallback(() => setIsOpen(false), [])

  // Search results
  const results = useMemo(() => searchModules(state, query), [state, query])
  const grouped = useMemo(() => groupByModule(results), [results])

  // Build flat list of all selectable items for keyboard nav
  const flatItems = useMemo(() => {
    const items = []

    if (query.trim()) {
      // Search results
      const moduleOrder = ['finance', 'study', 'timeflow', 'journal', 'habits', 'health']
      for (const mod of moduleOrder) {
        if (!grouped[mod]) continue
        for (const result of grouped[mod]) {
          items.push({ type: 'result', data: result })
        }
      }
    } else {
      // Recent searches
      for (const recent of recentSearches) {
        items.push({ type: 'recent', data: recent })
      }
      // Quick actions
      for (const action of QUICK_ACTIONS) {
        items.push({ type: 'action', data: action })
      }
    }

    return items
  }, [query, grouped, recentSearches])

  // Auto-focus
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const addRecentSearch = useCallback((term) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== trimmed)
      const next = [trimmed, ...filtered].slice(0, MAX_RECENT)
      saveRecentSearches(next)
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    saveRecentSearches([])
  }, [])

  const handleSelect = useCallback((item) => {
    if (!item) return
    if (item.type === 'result') {
      const config = MODULE_CONFIG[item.data.module]
      if (config) {
        addRecentSearch(query)
        navigate(config.route)
        onClose()
      }
    } else if (item.type === 'action') {
      navigate(item.data.route)
      onClose()
    } else if (item.type === 'recent') {
      setQuery(item.data)
    }
  }, [navigate, onClose, query, addRecentSearch])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[selectedIndex]
      handleSelect(item)
    }
  }, [onClose, flatItems, selectedIndex, handleSelect])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  const hasQuery = query.trim().length > 0
  const hasResults = results.length > 0
  const moduleOrder = ['finance', 'study', 'timeflow', 'journal', 'habits', 'health']
  let globalIndex = -1

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 9999,
        padding: '12vh 16px 16px',
        animation: 'modalBackdropFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.25s ease',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all your data..."
            autoComplete="off"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-primary)',
              caretColor: 'var(--accent-indigo)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
              }}
            >
              <X size={16} />
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              flexShrink: 0,
            }}
          >
            ESC
          </div>
        </div>

        {/* Results Area */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {hasQuery && hasResults && (
            <>
              {moduleOrder.map((mod) => {
                const items = grouped[mod]
                if (!items || items.length === 0) return null
                const config = MODULE_CONFIG[mod]
                const ModIcon = config.icon

                return (
                  <div key={mod} style={{ marginBottom: 8 }}>
                    {/* Module Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px 4px',
                      }}
                    >
                      <ModIcon size={14} style={{ color: config.color }} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'Syne, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Module Results */}
                    {items.map((result) => {
                      globalIndex++
                      const idx = globalIndex
                      const isSelected = idx === selectedIndex

                      return (
                        <button
                          key={result.id}
                          data-index={idx}
                          onClick={() => handleSelect({ type: 'result', data: result })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: 'none',
                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s ease',
                          }}
                        >
                          {/* Module Badge */}
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: `${config.badgeColor}18`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <ModIcon size={16} style={{ color: config.badgeColor }} />
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {result.title}
                            </div>
                            {result.subtitle && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: 'var(--text-secondary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: 2,
                                }}
                              >
                                {result.subtitle}
                              </div>
                            )}
                          </div>

                          {/* Date */}
                          {result.date && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                fontFamily: 'JetBrains Mono, monospace',
                                flexShrink: 0,
                              }}
                            >
                              {formatDate(result.date)}
                            </span>
                          )}

                          {/* Arrow */}
                          {isSelected && (
                            <ArrowRight
                              size={14}
                              style={{ color: 'var(--accent-indigo)', flexShrink: 0 }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}

          {/* Empty state for query with no results */}
          {hasQuery && !hasResults && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                gap: 12,
              }}
            >
              <Search size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                No results found for "{query}"
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                Try a different search term
              </span>
            </div>
          )}

          {/* Default view: recent searches + quick actions */}
          {!hasQuery && (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'Syne, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Recent Searches
                      </span>
                    </div>
                    <button
                      onClick={clearRecentSearches}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 6,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                      Clear
                    </button>
                  </div>

                  {recentSearches.map((term, i) => {
                    globalIndex++
                    const idx = globalIndex
                    const isSelected = idx === selectedIndex

                    return (
                      <button
                        key={`recent-${i}`}
                        data-index={idx}
                        onClick={() => handleSelect({ type: 'recent', data: term })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: 'none',
                          background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {term}
                        </span>
                        {isSelected && (
                          <ArrowRight size={14} style={{ color: 'var(--accent-indigo)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px 4px',
                  }}
                >
                  <Plus size={13} style={{ color: 'var(--text-muted)' }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'Syne, sans-serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Quick Actions
                  </span>
                </div>

                {QUICK_ACTIONS.map((action) => {
                  globalIndex++
                  const idx = globalIndex
                  const isSelected = idx === selectedIndex
                  const ActionIcon = action.icon

                  return (
                    <button
                      key={action.id}
                      data-index={idx}
                      onClick={() => handleSelect({ type: 'action', data: action })}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: `${action.color}18`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ActionIcon size={16} style={{ color: action.color }} />
                      </div>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {action.label}
                      </span>
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CornerDownLeft size={12} style={{ color: 'var(--accent-indigo)' }} />
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            Go
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Empty state hint */}
              {recentSearches.length === 0 && (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Start typing to search across all your data...
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border)',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-muted)',
                }}
              >
                ↑↓
              </kbd>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Navigate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border)',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-muted)',
                }}
              >
                ↵
              </kbd>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border)',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-muted)',
                }}
              >
                esc
              </kbd>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Close</span>
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {hasQuery ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'Life OS'}
          </span>
        </div>
      </div>
    </div>
  )
}
