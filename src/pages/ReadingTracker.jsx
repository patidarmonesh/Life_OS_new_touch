import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { Book, Plus, Eye, BookOpen, Quote, Clock, Award } from 'lucide-react'

export default function ReadingTracker() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const books = state.readings?.books || []

  const [form, setForm] = useState({
    title: '',
    author: '',
    category: 'Non-Fiction', // Fiction, Non-Fiction, Biography, Spiritual
    totalPages: 250,
    currentPage: 0,
    coverEmoji: '📚',
  })

  const [sessionForm, setSessionForm] = useState({
    bookId: '',
    pagesRead: 10,
    minutesSpent: 20,
  })

  const [highlightForm, setHighlightForm] = useState({
    bookId: '',
    quote: '',
    chapter: '',
  })

  // Calculations
  const activeBooks = books.filter(b => !b.totalPages || b.currentPage < b.totalPages)
  const completedBooks = books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages)

  function handleSaveBook() {
    if (!form.title.trim()) return
    const totalPages = form.totalPages === '' ? null : Number(form.totalPages)
    const currentPage = Number(form.currentPage)
    if ((totalPages !== null && (!Number.isInteger(totalPages) || totalPages <= 0)) || !Number.isInteger(currentPage) || currentPage < 0 || (totalPages !== null && currentPage > totalPages)) {
      showToast('Enter valid page counts. Leave the total empty if unknown; current page cannot exceed a known total.', 'error')
      return
    }

    const newBook = {
      id: uuid(),
      title: form.title.trim(),
      author: form.author.trim() || 'Unknown Author',
      category: form.category,
      totalPages,
      currentPage,
      coverEmoji: form.coverEmoji || '📚',
      createdAt: new Date().toISOString(),
      highlights: [],
      sessions: [],
    }

    setModule('readings', {
      ...state.readings,
      books: [newBook, ...books],
    })

    setForm({
      title: '',
      author: '',
      category: 'Non-Fiction',
      totalPages: 250,
      currentPage: 0,
      coverEmoji: '📚',
    })

    showToast('Book registered! 📖 Happy reading!', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleAddSession() {
    const { bookId, pagesRead, minutesSpent } = sessionForm
    if (!bookId || pagesRead <= 0 || minutesSpent <= 0) return
    const book = books.find(b => b.id === bookId)
    if (!book || !Number.isInteger(Number(pagesRead)) || !Number.isFinite(Number(minutesSpent)) || (book.totalPages > 0 && Number(book.currentPage) + Number(pagesRead) > book.totalPages)) {
      showToast('Check the pages read. This session would exceed the known total; correct the count before saving.', 'error')
      return
    }

    const time = new Date().toISOString()
    const updated = books.map(b => {
      if (b.id !== bookId) return b

      const updatedPage = Number(b.currentPage) + Number(pagesRead)
      const session = {
        id: uuid(),
        pagesRead: Number(pagesRead),
        minutesSpent: Number(minutesSpent),
        date: time,
      }

      if (updatedPage === b.totalPages && b.currentPage < b.totalPages) {
        showToast(`🏆 Congratulations on finishing "${b.title}"!`, 'success')
      }

      return {
        ...b,
        currentPage: updatedPage,
        sessions: [session, ...(b.sessions || [])],
      }
    })

    setModule('readings', { ...state.readings, books: updated })
    setSessionForm(sf => ({ ...sf, pagesRead: 10, minutesSpent: 20 }))
    showToast('Reading session logged! ⚡', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleAddHighlight() {
    const { bookId, quote, chapter } = highlightForm
    if (!bookId || !quote.trim()) return

    const updated = books.map(b => {
      if (b.id !== bookId) return b
      const hl = {
        id: uuid(),
        quote: quote.trim(),
        chapter: chapter.trim(),
        date: new Date().toISOString(),
      }
      return {
        ...b,
        highlights: [hl, ...(b.highlights || [])],
      }
    })

    setModule('readings', { ...state.readings, books: updated })
    setHighlightForm(hf => ({ ...hf, quote: '', chapter: '' }))
    showToast('Quote added to highlights shelf! ✍️', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleDelete(id) {
    const prev = books
    setModule('readings', {
      ...state.readings,
      books: books.filter(b => b.id !== id),
    })
    showToast('Book deleted', 'warning', {
      undo: () => setModule('readings', { ...state.readings, books: prev }),
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
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>📚 Reading Tracker</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Log books, record highlights/lessons, track pages read, and track your personal reading speeds.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>📖</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-indigo)', marginTop: '4px' }}>{activeBooks.length} Active</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Books on progress</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>🏆</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{completedBooks.length} Finished</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Completed books</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>✍️</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-purple)', marginTop: '4px' }}>
              {books.reduce((acc, b) => acc + (b.highlights?.length || 0), 0)} Saved
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Highlights logged</div>
          </Card>
        </div>

        {/* Add Book and Log Session side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '14px' }}>
          {/* Add Book */}
          <Card style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} color="var(--accent-indigo)" /> Register New Book
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Emoji</label>
                  <input
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '16px', padding: '8px 4px' }}
                    value={form.coverEmoji}
                    onChange={e => setForm(f => ({ ...f, coverEmoji: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Book Title</label>
                  <input
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    placeholder="e.g. Atomic Habits"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Author</label>
                  <input
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    placeholder="e.g. James Clear"
                    value={form.author}
                    onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="Non-Fiction">🧠 Non-Fiction</option>
                    <option value="Fiction">🔮 Fiction</option>
                    <option value="Biography">👤 Biography</option>
                    <option value="Spiritual">🧘 Spiritual</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Total Pages</label>
                  <input
                    type="number"
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    value={form.totalPages}
                    onChange={e => setForm(f => ({ ...f, totalPages: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Start Page</label>
                  <input
                    type="number"
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    value={form.currentPage}
                    onChange={e => setForm(f => ({ ...f, currentPage: e.target.value }))}
                  />
                </div>
              </div>
              <Button style={{ padding: '8px', marginTop: '4px' }} onClick={handleSaveBook} disabled={!form.title.trim()}>
                Add Book
              </Button>
            </div>
          </Card>

          {/* Log Session */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Card style={{ padding: '16px', flex: 1 }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="var(--accent-indigo)" /> Log Reading Session
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Choose Book</label>
                  <select
                    style={{ ...inputStyle, padding: '8px 10px' }}
                    value={sessionForm.bookId}
                    onChange={e => setSessionForm(s => ({ ...s, bookId: e.target.value }))}
                  >
                    <option value="">Select book...</option>
                    {activeBooks.map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Pages Read</label>
                    <input
                      type="number"
                      style={{ ...inputStyle, padding: '8px 10px' }}
                      value={sessionForm.pagesRead}
                      onChange={e => setSessionForm(s => ({ ...s, pagesRead: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Minutes Spent</label>
                    <input
                      type="number"
                      style={{ ...inputStyle, padding: '8px 10px' }}
                      value={sessionForm.minutesSpent}
                      onChange={e => setSessionForm(s => ({ ...s, minutesSpent: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  style={{ padding: '8px', marginTop: '4px' }}
                  onClick={handleAddSession}
                  disabled={!sessionForm.bookId || sessionForm.pagesRead <= 0}
                >
                  Log Pages & Speed
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '12px' }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Quote size={13} color="var(--accent-purple)" /> Add Book Highlight
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select
                  style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                  value={highlightForm.bookId}
                  onChange={e => setHighlightForm(s => ({ ...s, bookId: e.target.value }))}
                >
                  <option value="">Select book...</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
                <input
                  style={{ ...inputStyle, padding: '6px 8px', fontSize: '12px' }}
                  placeholder="Passage/Quote text..."
                  value={highlightForm.quote}
                  onChange={e => setHighlightForm(s => ({ ...s, quote: e.target.value }))}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '4px', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, padding: '6px 8px', fontSize: '11px' }}
                    placeholder="Chapter / Page ref..."
                    value={highlightForm.chapter}
                    onChange={e => setHighlightForm(s => ({ ...s, chapter: e.target.value }))}
                  />
                  <Button
                    style={{ padding: '6px' }}
                    disabled={!highlightForm.bookId || !highlightForm.quote.trim()}
                    onClick={handleAddHighlight}
                  >
                    Save Passage
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Books List Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {books.map(b => {
            const progress = b.totalPages > 0 && b.currentPage <= b.totalPages ? Math.round((b.currentPage / b.totalPages) * 100) : null
            const isCompleted = b.totalPages > 0 && b.currentPage === b.totalPages

            // Calculate average speed from sessions
            const totalMins = b.sessions?.reduce((acc, s) => acc + (s.minutesSpent || 0), 0) || 0
            const totalPagesLogged = b.sessions?.reduce((acc, s) => acc + (s.pagesRead || 0), 0) || 0
            const avgSpeed = totalMins > 0 ? (totalPagesLogged / totalMins).toFixed(1) : '0.0'

            return (
              <Card
                key={b.id}
                style={{
                  padding: '16px',
                  border: isCompleted ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                  background: isCompleted ? 'linear-gradient(135deg, rgba(16,185,129,0.02) 0%, rgba(15,23,42,0.4) 100%)' : 'rgba(15,23,42,0.4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ fontSize: '32px' }}>{b.coverEmoji}</div>
                    <div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(99,102,241,0.12)',
                          color: '#B9C2FF',
                          textTransform: 'uppercase',
                        }}>{b.category}</span>
                        {isCompleted && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16,185,129,0.12)',
                            color: '#34D399',
                          }}>COMPLETED 🏆</span>
                        )}
                      </div>
                      <h3 style={{ margin: '4px 0 2px', fontWeight: '800', fontSize: '15px' }}>{b.title}</h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By {b.author}</span>
                    </div>
                  </div>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(b.id)} size={13} label="Delete book" />
                </div>

                {/* Progress bar info */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Progress: {b.currentPage} / {b.totalPages || 'unknown'} pages</span>
                    <span>{progress == null ? 'Not measured / review pages' : String(progress) + '%'}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: isCompleted ? 'linear-gradient(90deg, #10B981, #34D399)' : 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* Avg speed and counts block */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px', marginTop: '12px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} color="var(--accent-indigo)" />
                    <span>Speed: <strong style={{ color: 'var(--text-secondary)' }}>{avgSpeed} pgs/min</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Quote size={12} color="var(--accent-purple)" />
                    <span>Highlights count: <strong style={{ color: 'var(--text-secondary)' }}>{b.highlights?.length || 0}</strong></span>
                  </div>
                </div>

                {/* Highlights List inside card */}
                {b.highlights?.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(148,163,184,0.06)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Passages Shelf</span>
                    {b.highlights.slice(0, 3).map(hl => (
                      <div key={hl.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', fontSize: '12px', borderLeft: '2px solid var(--accent-purple)' }}>
                        <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-primary)' }}>"{hl.quote}"</p>
                        {hl.chapter && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                            — {hl.chapter}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}

          {books.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>📚</div>
              <div style={{ fontWeight: '700' }}>Your library is empty</div>
              <div style={{ fontSize: '12px' }}>Enter a book title above and start recording page milestones.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

