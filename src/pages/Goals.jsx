import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { getGeminiApiKey, decomposeGoalWithAI } from '../services/geminiService'
import { Target, Plus, Trash2, CheckCircle2, Circle, Sparkles, AlertTriangle } from 'lucide-react'

export default function Goals() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const entries = state.goals?.entries || []

  const [form, setForm] = useState({
    title: '',
    description: '',
    timeframe: 'Quarter',
    category: 'Career',
    targetDate: '',
    milestones: [],
    linkedHabits: [],
    linkedSubjects: [],
  })

  const [newMilestoneText, setNewMilestoneText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Auto-calculated stats
  const activeCount = entries.filter(g => {
    const total = g.milestones?.length || 0
    const done = g.milestones?.filter(m => m.isCompleted)?.length || 0
    return total === 0 || done < total
  }).length

  const completedCount = entries.length - activeCount

  // Form handlers
  function addMilestone() {
    if (!newMilestoneText.trim()) return
    setForm(f => ({
      ...f,
      milestones: [...f.milestones, { id: uuid(), text: newMilestoneText.trim(), isCompleted: false }],
    }))
    setNewMilestoneText('')
    playSubtleClick()
    hapticLight()
  }

  function removeMilestoneFromForm(id) {
    setForm(f => ({
      ...f,
      milestones: f.milestones.filter(m => m.id !== id),
    }))
    playSubtleClick()
  }

  // AI Planner Decomposer
  async function handleAIDecompose() {
    if (!form.title.trim()) {
      showToast('Please enter a goal title first!', 'warning')
      return
    }

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      showToast('AI is unavailable for this session. Configure the server integration to use suggestions.', 'error')
      return
    }

    setAiLoading(true)
    try {
      showToast('AI Coach is planning your milestones... 🧘', 'info')
      const result = await decomposeGoalWithAI({
        apiKey,
        title: form.title,
        description: form.description,
      })

      if (result?.milestones) {
        const parsed = result.milestones.map(m => ({
          id: uuid(),
          text: m.text,
          isCompleted: false,
        }))
        setForm(f => ({
          ...f,
          milestones: [...f.milestones, ...parsed],
        }))
        showToast('AI Milestones generated! ✨', 'success')
        playSuccessSound()
        hapticSuccess()
      } else {
        showToast('Could not parse milestones. Try again.', 'error')
      }
    } catch (e) {
      showToast(e.message || 'AI planning failed', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  // Save goal entry
  function handleSave() {
    if (!form.title.trim()) return

    const newGoal = {
      id: uuid(),
      title: form.title.trim(),
      description: form.description.trim(),
      timeframe: form.timeframe,
      category: form.category,
      targetDate: form.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      milestones: form.milestones,
      linkedHabits: form.linkedHabits,
      linkedSubjects: form.linkedSubjects,
      createdAt: new Date().toISOString(),
    }

    setModule('goals', {
      ...state.goals,
      entries: [newGoal, ...entries],
    })

    // Reset form
    setForm({
      title: '',
      description: '',
      timeframe: 'Quarter',
      category: 'Career',
      targetDate: '',
      milestones: [],
      linkedHabits: [],
      linkedSubjects: [],
    })
    showToast('SMART Goal set! 🎯', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  // Toggle milestone completion
  function toggleMilestone(goalId, milestoneId) {
    const updated = entries.map(g => {
      if (g.id !== goalId) return g
      const updatedMilestones = g.milestones.map(m => {
        if (m.id !== milestoneId) return m
        const nextState = !m.isCompleted
        if (nextState) {
          playSuccessSound()
          hapticSuccess()
        } else {
          playSubtleClick()
          hapticLight()
        }
        return { ...m, isCompleted: nextState }
      })

      // Check if all milestones just got completed
      const allDone = updatedMilestones.every(m => m.isCompleted)
      if (allDone && g.milestones.some(m => !m.isCompleted)) {
        showToast('🎯 Goal Complete! Excellent work!', 'success')
      }

      return { ...g, milestones: updatedMilestones }
    })

    setModule('goals', { ...state.goals, entries: updated })
  }

  // Delete goal
  function handleDelete(id) {
    const prev = entries
    setModule('goals', {
      ...state.goals,
      entries: entries.filter(g => g.id !== id),
    })
    showToast('Goal deleted', 'warning', {
      undo: () => setModule('goals', { ...state.goals, entries: prev }),
    })
    playWarningBeep()
    hapticLight()
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

  return (
    <div className="legacy-area" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🎯 Goals & OKRs</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Establish SMART objectives, break them into milestones, and use the AI decomposer to plan.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Goals Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px' }}>
          <Card style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>📈</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-indigo)', marginTop: '4px' }}>{activeCount} Active</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Objectives currently tracking</div>
          </Card>
          <Card style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>🏆</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{completedCount} Completed</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Objectives accomplished</div>
          </Card>
        </div>

        {/* Set goal form */}
        <Card style={{ padding: '18px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} color="var(--accent-indigo)" /> Define New SMART Objective
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Objective Title</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Crack GATE 2027 with Top Rank"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Timeframe</label>
                  <select
                    style={inputStyle}
                    value={form.timeframe}
                    onChange={e => setForm(f => ({ ...f, timeframe: e.target.value }))}
                  >
                    <option value="Quarter">Quarterly</option>
                    <option value="Annual">Annual</option>
                    <option value="Long Term">Long Term</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={inputStyle}
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="Career">Career</option>
                    <option value="Health">Health</option>
                    <option value="Finance">Finance</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description / Why is this important?</label>
              <textarea
                style={{ ...inputStyle, minHeight: '52px', resize: 'vertical' }}
                placeholder="Detail what success looks like and your primary focus area..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Target Deadline</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
                <Button
                  onClick={handleAIDecompose}
                  disabled={aiLoading || !form.title.trim()}
                  variant="secondary"
                  style={{ flex: 1, height: '40px', borderColor: 'rgba(99,102,241,0.4)', color: '#C7D2FE' }}
                >
                  <Sparkles size={14} className={aiLoading ? 'animate-pulse' : ''} />
                  {aiLoading ? 'AI Planning...' : 'Decompose with AI'}
                </Button>
                <Button onClick={handleSave} disabled={!form.title.trim()} style={{ flex: 1, height: '40px' }}>
                  Set Objective
                </Button>
              </div>
            </div>

            {/* Milestones checklist list inside form */}
            {form.milestones.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <label style={labelStyle}>Milestones Checklist</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '10px' }}>
                  {form.milestones.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>• {m.text}</span>
                      <button
                        onClick={() => removeMilestoneFromForm(m.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 2 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add custom milestone manually inside form */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
              <input
                style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }}
                placeholder="Add milestone manually..."
                value={newMilestoneText}
                onChange={e => setNewMilestoneText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addMilestone() }}
              />
              <Button variant="secondary" onClick={addMilestone} disabled={!newMilestoneText.trim()} style={{ padding: '8px 14px' }}>
                Add
              </Button>
            </div>
          </div>
        </Card>

        {/* Goals List Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {entries.map(g => {
            const totalMilestones = g.milestones?.length || 0
            const completedMilestones = g.milestones?.filter(m => m.isCompleted)?.length || 0
            const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : null
            const isFinished = totalMilestones > 0 && completedMilestones === totalMilestones

            return (
              <Card
                key={g.id}
                style={{
                  padding: '18px',
                  border: isFinished ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                  background: isFinished ? 'linear-gradient(135deg, rgba(16,185,129,0.02) 0%, rgba(15,23,42,0.4) 100%)' : 'rgba(15,23,42,0.4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(99,102,241,0.12)',
                        color: '#B9C2FF',
                        textTransform: 'uppercase',
                      }}>{g.timeframe}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(234,179,8,0.12)',
                        color: '#FCD34D',
                        textTransform: 'uppercase',
                      }}>{g.category}</span>
                      {isFinished && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16,185,129,0.12)',
                          color: '#34D399',
                        }}>COMPLETED 🏆</span>
                      )}
                    </div>
                    <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '15px', marginTop: '8px', marginBottom: '4px' }}>
                      {g.title}
                    </h3>
                    {g.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                        {g.description}
                      </p>
                    )}
                  </div>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(g.id)} size={14} label="Delete goal" />
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Milestones progress</span>
                    <span>{totalMilestones ? String(completedMilestones) + ' / ' + totalMilestones + ' (' + progress + '%)' : 'No milestones defined'}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: isFinished ? 'linear-gradient(90deg, #10B981, #34D399)' : 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* Milestones Checklist list inside card */}
                {totalMilestones > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', background: 'rgba(30,41,59,0.2)', padding: '12px', borderRadius: '12px' }}>
                    {g.milestones.map(m => (
                      <div
                        key={m.id}
                        role="checkbox" tabIndex={0} aria-checked={m.isCompleted} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleMilestone(g.id, m.id) } }} onClick={() => toggleMilestone(g.id, m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: m.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}
                      >
                        {m.isCompleted ? (
                          <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0 }} />
                        ) : (
                          <Circle size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ textDecoration: m.isCompleted ? 'line-through' : 'none' }}>
                          {m.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Target Deadline */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px', borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: '10px' }}>
                  <span>Target Date: {g.targetDate}</span>
                  <span>Created: {new Date(g.createdAt).toLocaleDateString()}</span>
                </div>
              </Card>
            )
          })}

          {entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>No active objectives</div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>Establish your OKRs/SMART goals above to begin tracking milestones.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


