import { useState, useEffect } from 'react'

const DISMISS_KEY = 'lifeos-pwa-dismissed'
const DISMISS_TIME_KEY = 'lifeos-pwa-dismissed-time'
const VISIT_COUNT_KEY = 'lifeos-pwa-visit-count'
const COOLDOWN_DAYS = 7
const MIN_VISITS_BEFORE_PROMPT = 2

/**
 * PWA install prompt banner. Shows contextually:
 * - Only after the user's 2nd visit (not on first impression)
 * - Re-shows after 7 days if dismissed
 * - Styled like a premium notification bar.
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    // Track visit count
    const visits = Number(localStorage.getItem(VISIT_COUNT_KEY) || 0) + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(visits))

    // Check dismiss cooldown
    const dismissedTime = localStorage.getItem(DISMISS_TIME_KEY)
    if (dismissedTime) {
      const daysSinceDismiss = (Date.now() - Number(dismissedTime)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < COOLDOWN_DAYS) {
        return // Still in cooldown
      }
      // Cooldown expired — clear dismiss so prompt can show again
      localStorage.removeItem(DISMISS_KEY)
      localStorage.removeItem(DISMISS_TIME_KEY)
    }

    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    if (dismissed) return

    // Only show after minimum visits
    if (visits < MIN_VISITS_BEFORE_PROMPT) return

    setShouldShow(true)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || !shouldShow) return null

  async function handleInstall() {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShouldShow(false)
    }
  }

  function handleDismiss() {
    setShouldShow(false)
    localStorage.setItem(DISMISS_KEY, 'true')
    localStorage.setItem(DISMISS_TIME_KEY, String(Date.now()))
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9000,
      maxWidth: '420px',
      width: 'calc(100% - 32px)',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(124,58,237,0.95))',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '18px',
      padding: '16px 20px',
      boxShadow: '0 20px 60px rgba(99,102,241,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      animation: 'fadeSlideIn 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
      border: '1px solid rgba(255,255,255,0.15)',
    }}>
      <div style={{ fontSize: '28px', flexShrink: 0 }}>📲</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff', marginBottom: '2px' }}>
          Install Life OS
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
          Add to home screen for instant access & offline support.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
          background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}>
          Later
        </button>
        <button onClick={handleInstall} style={{
          padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
          background: '#fff', border: 'none', color: '#6366F1', cursor: 'pointer',
          transition: 'transform 0.2s ease',
        }}>
          Install
        </button>
      </div>
    </div>
  )
}
