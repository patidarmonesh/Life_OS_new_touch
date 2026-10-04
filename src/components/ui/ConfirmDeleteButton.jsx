import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function ConfirmDeleteButton({ onConfirm, size = 14, label = 'Delete entry' }) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  function startConfirm(e) {
    e?.stopPropagation?.()
    setConfirming(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setConfirming(false), 3000)
  }

  function cancelConfirm(e) {
    e?.stopPropagation?.()
    setConfirming(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function confirmDelete(e) {
    e?.stopPropagation?.()
    onConfirm()
    setConfirming(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  if (confirming) {
    return (
      <div
        style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={cancelConfirm}
          style={{
            padding: '4px 8px',
            minHeight: 44,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirmDelete}
          style={{
            padding: '4px 8px',
            minHeight: 44,
            borderRadius: 8,
            border: '1px solid rgba(244,63,94,0.4)',
            background: 'rgba(244,63,94,0.15)',
            color: '#F43F5E',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Delete
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={startConfirm}
      aria-label={label}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        padding: 8,
        minHeight: 44,
        minWidth: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={evt => { evt.currentTarget.style.color = '#F43F5E' }}
      onMouseLeave={evt => { evt.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <Trash2 size={size} />
    </button>
  )
}
