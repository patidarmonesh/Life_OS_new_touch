import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { BookOpen, Plus, Search, Tag, FileText, Filter, Calendar } from 'lucide-react'

export default function SecondBrain() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const notes = state.secondBrain?.notes || []

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [activeNoteId, setActiveNoteId] = useState(null)

  const [form, setForm] = useState({
    title: '',
    content: '',
    tags: '',
    category: 'Ideas', // Ideas, Study, Life, Resources, Work
  })

  // All unique tags for filtering
  const allTags = Array.from(
    new Set(notes.flatMap(n => n.tags || []))
  )

  const filteredNotes = notes.filter(n => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTag = !selectedTag || n.tags?.includes(selectedTag)
    return matchesSearch && matchesTag
  })

  const activeNote = notes.find(n => n.id === activeNoteId)

  function handleSave() {
    if (!form.title.trim()) return

    const newNote = {
      id: uuid(),
      title: form.title.trim(),
      content: form.content.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      category: form.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setModule('secondBrain', {
      ...state.secondBrain,
      notes: [newNote, ...notes],
    })

    setForm({
      title: '',
      content: '',
      tags: '',
      category: 'Ideas',
    })

    showToast('Note added to Second Brain! 🧠', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleUpdateNote(id, updatedContent) {
    const updated = notes.map(n => {
      if (n.id !== id) return n
      return {
        ...n,
        content: updatedContent,
        updatedAt: new Date().toISOString(),
      }
    })
    setModule('secondBrain', { ...state.secondBrain, notes: updated })
    showToast('Note saved! 📝', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleDelete(id) {
    const prev = notes
    setModule('secondBrain', {
      ...state.secondBrain,
      notes: notes.filter(n => n.id !== id),
    })
    if (activeNoteId === id) setActiveNoteId(null)
    showToast('Note deleted', 'warning', {
      undo: () => setModule('secondBrain', { ...state.secondBrain, notes: prev }),
    })
    playWarningBeep()
    hapticLight()
  }

  const _labelStyle = {
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
    <div className="legacy-area" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🧠 Second Brain</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            A Personal Knowledge Base. Organize course material, general guides, web highlights, and quick ideas.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '20px' }}>
        {/* Left column: Create and List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Create Note */}
          <Card style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} color="var(--accent-indigo)" /> Quick Add Note
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }}
                placeholder="Title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}
                placeholder="Content..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '8px' }}>
                <input
                  style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px' }}
                  placeholder="Tags (tag1, tag2)"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
                <select
                  style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px' }}
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="Ideas">💡 Ideas</option>
                  <option value="Study">📚 Study</option>
                  <option value="Resources">📂 Resources</option>
                  <option value="Life">🌱 Life</option>
                  <option value="Work">💼 Work</option>
                </select>
              </div>
              <Button style={{ padding: '8px' }} onClick={handleSave} disabled={!form.title.trim()}>
                Save to Brain
              </Button>
            </div>
          </Card>

          {/* Search and Tag filter */}
          <Card style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: '28px', padding: '8px 10px 8px 28px', fontSize: '13px' }}
                placeholder="Search notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {allTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                <span
                  onClick={() => { playSubtleClick(); setSelectedTag(''); }}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: !selectedTag ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.04)',
                    color: !selectedTag ? 'white' : 'var(--text-muted)',
                  }}
                >
                  All tags
                </span>
                {allTags.map(t => (
                  <span
                    key={t}
                    onClick={() => { playSubtleClick(); setSelectedTag(t); }}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: selectedTag === t ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.04)',
                      color: selectedTag === t ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Notes Sidebar List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {filteredNotes.map(n => (
              <div
                key={n.id}
                onClick={() => { playSubtleClick(); setActiveNoteId(n.id); }}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: activeNoteId === n.id ? 'rgba(99,102,241,0.1)' : 'rgba(15,23,42,0.3)',
                  border: activeNoteId === n.id ? '1px solid var(--accent-indigo)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: 'var(--accent-indigo)',
                    textTransform: 'uppercase',
                  }}>
                    {n.category}
                  </span>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(n.id)} size={11} label="Delete" />
                </div>
                <h4 style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {n.title}
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {n.content}
                </p>
              </div>
            ))}

            {filteredNotes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No notes found
              </div>
            )}
          </div>
        </div>

        {/* Right column: Note Details Editor */}
        <div>
          {activeNote ? (
            <NoteEditor note={activeNote} onSave={handleUpdateNote} />
          ) : (
            <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
              <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontWeight: '700' }}>Select a note</div>
              <div style={{ fontSize: '11px', marginTop: '2px', textAlign: 'center' }}>
                Click on any note in the left panel to open, view details, or edit contents.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave }) {
  const [draft, setDraft] = useState(note.content)

  // Sync draft when note changes
  if (note.id !== note._prevId) {
    note._prevId = note.id
    if (draft !== note.content) {
      setDraft(note.content)
    }
  }

  const isDirty = draft !== note.content

  return (
    <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.12)', color: 'var(--accent-indigo)' }}>
            {note.category}
          </span>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '18px', margin: '6px 0 2px' }}>
            {note.title}
          </h2>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={10} /> Last updated: {new Date(note.updatedAt).toLocaleString()}
          </div>
        </div>
        <Button onClick={() => onSave(note.id, draft)} disabled={!isDirty}>
          Save changes
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {note.tags?.map(t => (
          <span key={t} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '6px' }}>
            #{t}
          </span>
        ))}
      </div>

      <textarea
        style={{
          width: '100%',
          flex: 1,
          minHeight: '280px',
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: '1.6',
          resize: 'vertical',
        }}
        placeholder="Write note details or markdown content here..."
        value={draft}
        onChange={e => setDraft(e.target.value)}
      />
    </Card>
  )
}
