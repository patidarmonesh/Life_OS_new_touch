import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContextCore'

const MAX_TOASTS = 5

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const removeToast = useCallback(id => {
    // Start exit animation, then remove
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 200)
  }, [])

  const showToast = useCallback((message, type = 'success', options = {}) => {
    const id = ++idRef.current
    const duration = options.duration ?? (type === 'warning' && options.undo ? 5000 : 2500)

    setToasts(prev => {
      const next = [...prev, { id, message, type, undo: options.undo, exiting: false }]
      // Enforce max toast limit — remove oldest non-undo toasts first
      if (next.length > MAX_TOASTS) {
        const excess = next.length - MAX_TOASTS
        let removed = 0
        return next.filter(t => {
          if (removed >= excess) return true
          if (!t.undo) { removed++; return false }
          return true
        })
      }
      return next
    })

    if (!options.persistent) {
      setTimeout(() => removeToast(id), duration)
    }

    return id
  }, [removeToast])

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!toasts.length) return null

  const colors = {
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#10B981' },
    error: { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.4)', text: '#F43F5E' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#F59E0B' },
    info: { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', text: '#6366F1' },
  }

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...(isMobile
          ? { bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 'min(360px, calc(100vw - 32px))' }
          : { top: 72, right: 20, width: 320 }),
      }}
    >
      {toasts.map(toast => {
        const c = colors[toast.type] || colors.info
        return (
          <div
            key={toast.id}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              animation: toast.exiting ? 'toastSlideOut 0.2s ease forwards' : 'toastSlideIn 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <span>{toast.message}</span>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  toast.undo()
                  onDismiss(toast.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 12,
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
