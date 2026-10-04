import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { HelpCircle, Plus, Sparkles, CheckSquare, Clock, AlertCircle } from 'lucide-react'

export default function DecisionJournal() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const entries = state.decisions?.entries || []

  const [form, setForm] = useState({
    title: '',
    context: '',
    expectedOutcome: '',
    actualOutcome: '',
    confidence: 70, // 0 - 100
    reviewDate: '',
    tags: '',
  })

  const [activeFilter, setActiveFilter] = useState('all') // all, pending, evaluated

  const filteredEntries = entries.filter(e => {
    if (activeFilter === 'pending') return !e.evaluatedAt
    if (activeFilter === 'evaluated') return !!e.evaluatedAt
    return true
  })

  // Review status counters
  const pendingCount = entries.filter(e => !e.evaluatedAt).length
  const evaluatedCount = entries.filter(e => e.evaluatedAt).length

  function handleSave() {
    if (!form.title.trim()) return

    const newDecision = {
      id: uuid(),
      title: form.title.trim(),
      context: form.context.trim(),
      expectedOutcome: form.expectedOutcome.trim(),
      confidence: Number(form.confidence),
      reviewDate: form.reviewDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      evaluatedAt: null,
      actualOutcome: '',
      learning: '',
    }

    setModule('decisions', {
      ...state.decisions,
      entries: [newDecision, ...entries],
    })

    setForm({
      title: '',
      context: '',
      expectedOutcome: '',
      actualOutcome: '',
      confidence: 70,
      reviewDate: '',
      tags: '',
    })

    showToast('Decision logged! 🧠 Keep track of your choices.', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleEvaluate(id, actual, learn) {
    if (!actual.trim()) return

    const updated = entries.map(e => {
      if (e.id !== id) return e
      return {
        ...e,
        actualOutcome: actual.trim(),
        learning: learn.trim(),
        evaluatedAt: new Date().toISOString(),
      }
    })

    setModule('decisions', { ...state.decisions, entries: updated })
    showToast('Decision outcome evaluated & locked! 🎯', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleDelete(id) {
    const prev = entries
    setModule('decisions', {
      ...state.decisions,
      entries: entries.filter(e => e.id !== id),
    })
    showToast('Decision removed', 'warning', {
      undo: () => setModule('decisions', { ...state.decisions, entries: prev }),
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
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🧠 Decision Journal</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Record key choices, state your context/reasons, set review dates, and learn from outcome feedback loops.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>📁</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-indigo)', marginTop: '4px' }}>{entries.length} Total</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Decisions logged</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>⏳</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-amber)', marginTop: '4px' }}>{pendingCount} Pending</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Awaiting review</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>🏆</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{evaluatedCount} Evaluated</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Feedback loops locked</div>
          </Card>
        </div>

        {/* Log Decision Form */}
        <Card style={{ padding: '18px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} color="var(--accent-indigo)" /> Record a New Decision
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Decision / Action Title</label>
              <input
                style={inputStyle}
                placeholder="e.g., Invest in Tech ETF vs crypto, Hires freelancer for design, etc."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Context / Why are you doing this?</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }}
                  placeholder="What variables are you considering? Emotions? Pressures?"
                  value={form.context}
                  onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Expected Outcome / hypothesis</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }}
                  placeholder="What do you think will happen? How will you measure it?"
                  value={form.expectedOutcome}
                  onChange={e => setForm(f => ({ ...f, expectedOutcome: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Confidence Level: {form.confidence}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  style={{ width: '100%', accentColor: 'var(--accent-indigo)' }}
                  value={form.confidence}
                  onChange={e => setForm(f => ({ ...f, confidence: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Review Date</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.reviewDate}
                  onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Tags (comma-separated)</label>
                <input
                  style={inputStyle}
                  placeholder="finance, work, health"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button onClick={handleSave} disabled={!form.title.trim()}>
                Log Decision
              </Button>
            </div>
          </div>
        </Card>

        {/* Filter Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          {['all', 'pending', 'evaluated'].map(f => (
            <button
              key={f}
              onClick={() => { playSubtleClick(); setActiveFilter(f); }}
              style={{
                background: activeFilter === f ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                color: activeFilter === f ? 'var(--accent-indigo)' : 'var(--text-muted)',
                fontWeight: activeFilter === f ? '700' : '400',
                cursor: 'pointer',
                fontSize: '13px',
                textTransform: 'capitalize',
              }}
            >
              {f} ({f === 'all' ? entries.length : f === 'pending' ? pendingCount : evaluatedCount})
            </button>
          ))}
        </div>

        {/* Decisions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEntries.map(e => (
            <DecisionCard key={e.id} decision={e} onEvaluate={handleEvaluate} onDelete={handleDelete} />
          ))}

          {filteredEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💭</div>
              <div style={{ fontWeight: '700' }}>No decisions found</div>
              <div style={{ fontSize: '12px' }}>Choose a different filter or record a new choice.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DecisionCard({ decision, onEvaluate, onDelete }) {
  const [showEvaluateForm, setShowEvaluateForm] = useState(false)
  const [actual, setActual] = useState('')
  const [learn, setLearn] = useState('')

  const isOverdue = !decision.evaluatedAt && new Date(decision.reviewDate) < new Date()

  return (
    <Card style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '9px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '4px',
              background: decision.evaluatedAt ? 'rgba(16,185,129,0.12)' : 'rgba(234,179,8,0.12)',
              color: decision.evaluatedAt ? '#34D399' : '#FCD34D',
            }}>
              {decision.evaluatedAt ? 'EVALUATED' : 'PENDING REVIEW'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Confidence: {decision.confidence}%
            </span>
            {isOverdue && (
              <span style={{
                fontSize: '9px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(239,68,68,0.12)',
                color: '#FCA5A5',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}>
                <Clock size={10} /> OVERDUE FOR REVIEW
              </span>
            )}
          </div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '15px', marginTop: '6px', marginBottom: '4px' }}>
            {decision.title}
          </h3>
        </div>
        <ConfirmDeleteButton onConfirm={() => onDelete(decision.id)} size={13} label="Delete decision" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
        <div>
          <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '2px' }}>Context/Why:</div>
          <div style={{ color: 'var(--text-muted)' }}>{decision.context || 'None listed'}</div>
        </div>
        <div>
          <div style={{ fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '2px' }}>Expected Outcome:</div>
          <div style={{ color: 'var(--text-muted)' }}>{decision.expectedOutcome || 'None listed'}</div>
        </div>
      </div>

      {decision.evaluatedAt ? (
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px', fontSize: '12px' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#10B981', marginBottom: '2px' }}>Actual Outcome:</div>
            <div style={{ color: 'var(--text-primary)' }}>{decision.actualOutcome}</div>
          </div>
          <div>
            <div style={{ fontWeight: '700', color: 'var(--accent-indigo)', marginBottom: '2px' }}>Lesson / Reflection:</div>
            <div style={{ color: 'var(--text-primary)' }}>{decision.learning || 'No learnings logged'}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!showEvaluateForm ? (
            <Button
              variant="secondary"
              style={{ width: '100%', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              onClick={() => { playSubtleClick(); setShowEvaluateForm(true); }}
            >
              <CheckSquare size={13} /> Evaluate Outcome
            </Button>
          ) : (
            <div style={{ background: 'rgba(99,102,241,0.03)', padding: '12px', borderRadius: '10px', border: '1px dashed rgba(99,102,241,0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>What actually happened?</label>
                <input
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                  placeholder="e.g. Returned 15% in 3 weeks, Freelancer delivered late but solid quality"
                  value={actual}
                  onChange={e => setActual(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Key lessons/reflection</label>
                <input
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                  placeholder="e.g. Overestimated speed, tech sector was bullish, etc."
                  value={learn}
                  onChange={e => setLearn(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setShowEvaluateForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  disabled={!actual.trim()}
                  onClick={() => onEvaluate(decision.id, actual, learn)}
                >
                  Confirm Outcome
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date metadata footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.04)', paddingTop: '8px' }}>
        <span>Logged: {new Date(decision.createdAt).toLocaleDateString()}</span>
        <span>Review Date: {decision.reviewDate}</span>
      </div>
    </Card>
  )
}
