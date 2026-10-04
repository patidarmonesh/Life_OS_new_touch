import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Command, Keyboard } from 'lucide-react'

const PAGE_MAP = {
  '1': '/',
  '2': '/finance',
  '3': '/timeflow',
  '4': '/study',
  '5': '/habits',
  '6': '/health',
  '7': '/journal',
  '8': '/ai',
  '9': '/analytics',
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '1'], description: 'Home' },
      { keys: ['Ctrl', '2'], description: 'Finance' },
      { keys: ['Ctrl', '3'], description: 'TimeFlow' },
      { keys: ['Ctrl', '4'], description: 'Study' },
      { keys: ['Ctrl', '5'], description: 'Habits' },
      { keys: ['Ctrl', '6'], description: 'Health' },
      { keys: ['Ctrl', '7'], description: 'Journal' },
      { keys: ['Ctrl', '8'], description: 'AI Chat' },
      { keys: ['Ctrl', '9'], description: 'Analytics' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['Ctrl', 'N'], description: 'Quick add' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
]

function ShortcutKey({ children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        height: '28px',
        padding: '0 8px',
        borderRadius: '8px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}

function ShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const modLabel = isMac ? '⌘' : 'Ctrl'

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
        animation: 'modalBackdropFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'modalFadeIn 0.25s ease',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <Keyboard size={18} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'Syne, sans-serif', margin: 0 }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.background = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '10px',
                }}
              >
                {group.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}
              >
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom:
                        i < group.shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {shortcut.description}
                    </span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {shortcut.keys.map((key, j) => (
                        <ShortcutKey key={j}>{key === 'Ctrl' ? modLabel : key}</ShortcutKey>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '18px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Press <ShortcutKey>Esc</ShortcutKey> to close
        </div>
      </div>
    </div>
  )
}

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)

  const handleKeyDown = useCallback(
    (e) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const tag = e.target.tagName
      const isEditable = e.target.isContentEditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) {
        return
      }

      const isMod = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + K → command palette
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-command-palette'))
        return
      }

      // Ctrl/Cmd + N → quick add
      if (isMod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-quick-add'))
        return
      }

      // Ctrl/Cmd + 1-9 → page navigation
      if (isMod && PAGE_MAP[e.key]) {
        e.preventDefault()
        navigate(PAGE_MAP[e.key])
        return
      }

      // ? → show shortcuts help
      if (e.key === '?' && !isMod && !e.shiftKey === false) {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Handle ? (which is Shift+/ on most keyboards)
      if (e.key === '?') {
        e.preventDefault()
        setShowHelp(true)
        return
      }
    },
    [navigate]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return <ShortcutsModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
}
