import { useCallback, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Reusable tag input component with autocomplete.
 *
 * @param {{ tags: string[], onChange: (tags: string[]) => void, allTags?: string[], placeholder?: string, maxTags?: number }} props
 */
export default function TagInput({ tags = [], onChange, allTags = [], placeholder = 'Add tag...', maxTags = 10 }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  const suggestions = useMemo(() => {
    if (!input.trim()) return []
    const q = input.toLowerCase()
    return allTags
      .filter(t => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 6)
  }, [input, allTags, tags])

  const addTag = useCallback((tag) => {
    const cleaned = tag.trim().replace(/^#/, '')
    if (!cleaned || tags.includes(cleaned) || tags.length >= maxTags) return
    onChange([...tags, cleaned])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [tags, onChange, maxTags])

  const removeTag = useCallback((tag) => {
    onChange(tags.filter(t => t !== tag))
  }, [tags, onChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }, [input, tags, addTag, removeTag])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px',
        padding: '8px 10px', borderRadius: '10px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        minHeight: '40px', alignItems: 'center',
        transition: 'border-color 0.2s',
      }}>
        {tags.map(tag => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '999px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            fontSize: '12px', fontWeight: '600',
            color: 'var(--accent-indigo)',
            animation: 'fadeSlideIn 0.15s ease',
          }}>
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent-indigo)', padding: '0 1px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: '80px', background: 'none', border: 'none',
            outline: 'none', color: 'var(--text-primary)',
            fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
          }}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: '4px', zIndex: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'fadeSlideIn 0.15s ease',
        }}>
          {suggestions.map(tag => (
            <button
              key={tag}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                addTag(tag)
              }}
              style={{
                width: '100%', padding: '8px 12px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
