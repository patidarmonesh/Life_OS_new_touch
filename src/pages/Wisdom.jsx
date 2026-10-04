import { useState, useMemo } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { Plus, Pin, PinOff, BookOpen, Quote, Sparkles } from 'lucide-react'

export default function Wisdom() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const [form, setForm] = useState({ text: '', source: 'Bhagavad Gita' })
  const [search, setSearch] = useState('')

  const entries = useMemo(() => state.wisdom?.entries || [], [state.wisdom?.entries])

  // Derived filtered wisdom entries
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entries
    return entries.filter(e =>
      e.text.toLowerCase().includes(q) || e.source.toLowerCase().includes(q)
    )
  }, [entries, search])

  // Save new teaching
  function handleSave() {
    if (!form.text.trim()) return

    const newEntry = {
      id: uuid(),
      text: form.text.trim(),
      source: form.source.trim() || 'Bhagavad Gita',
      isFloating: entries.length === 0, // auto-float the first one
      createdAt: new Date().toISOString()
    }

    setModule('wisdom', {
      ...state.wisdom,
      entries: [newEntry, ...entries]
    })

    setForm({ text: '', source: 'Bhagavad Gita' })
    showToast('Learning saved ✓', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  // Pin a quote to the global floating banner
  function pinEntry(id) {
    const updated = entries.map(e => ({
      ...e,
      isFloating: e.id === id
    }))
    
    setModule('wisdom', {
      ...state.wisdom,
      entries: updated
    })

    showToast('Pinned wisdom to float globally 📌', 'success')
    playSubtleClick()
    hapticLight()
  }

  // Unpin the quote
  function unpinEntry(id) {
    const updated = entries.map(e => ({
      ...e,
      isFloating: e.id === id ? false : e.isFloating
    }))

    setModule('wisdom', {
      ...state.wisdom,
      entries: updated
    })

    showToast('Unpinned wisdom banner', 'info')
    playSubtleClick()
    hapticLight()
  }

  // Delete a teaching
  function handleDelete(id) {
    const prev = entries
    setModule('wisdom', {
      ...state.wisdom,
      entries: entries.filter(e => e.id !== id)
    })
    showToast('Learning deleted', 'warning', {
      undo: () => setModule('wisdom', { ...state.wisdom, entries: prev })
    })
  }

  const activeFloating = entries.find(e => e.isFloating)

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
    <div className="legacy-area" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '32px' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🧘 Wisdom Log</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Record spiritual insights, Gita slokas, and life principles. Pin one to float at the top of the app.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Active focus reminder banner inside the page */}
        {activeFloating && (
          <Card style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(236,72,153,0.08) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(236,72,153,0.12)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={18} color="#EC4899" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#EC4899', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Floating Focus
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', fontStyle: 'italic' }}>
                "{activeFloating.text}"
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                — {activeFloating.source}
              </div>
            </div>
            <Button variant="secondary" onClick={() => unpinEntry(activeFloating.id)} style={{ padding: '6px 12px' }}>
              <PinOff size={13} /> Unpin
            </Button>
          </Card>
        )}

        {/* Log wisdom form */}
        <Card style={{ padding: '16px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Quote size={15} color="var(--accent-indigo)" /> Log New Insight
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>What did you learn?</label>
              <textarea
                style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }}
                placeholder="e.g. Vichar vritti se aate h isle hamesha socha karo (Our thoughts stem from active behavioral patterns)..."
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Source / Book</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Bhagavad Gita, Chapter 2..."
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                />
              </div>
              <Button onClick={handleSave} disabled={!form.text.trim()}>
                <Plus size={16} /> Save Learning
              </Button>
            </div>
          </div>
        </Card>

        {/* Search filter bar */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            style={inputStyle}
            placeholder="Search teachings or sources..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Quests/List grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEntries.map(e => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                border: e.isFloating ? '1px solid rgba(236,72,153,0.35)' : '1px solid var(--border)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: e.isFloating ? 'rgba(236,72,153,0.1)' : 'var(--bg-secondary)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}>
                <BookOpen size={15} color={e.isFloating ? '#EC4899' : 'var(--text-muted)'} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                  "{e.text}"
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Source: {e.source}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {!e.isFloating ? (
                  <button
                    onClick={() => pinEntry(e.id)}
                    title="Float this learning"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 6,
                    }}
                  >
                    <Pin size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => unpinEntry(e.id)}
                    title="Unpin learning"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EC4899',
                      cursor: 'pointer',
                      padding: 6,
                    }}
                  >
                    <PinOff size={13} />
                  </button>
                )}
                <ConfirmDeleteButton onConfirm={() => handleDelete(e.id)} size={13} label="Delete wisdom" />
              </div>
            </div>
          ))}

          {filteredEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📖</div>
              <div style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>No teachings found</div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>Start logging your spiritual or mindset study lessons above.</div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

