/**
 * ReconnectBanner.jsx
 *
 * A slim, non-intrusive banner shown at the top of the app when the Google
 * Drive session token has expired. One click reconnects silently — no full
 * login flow, no page refresh.
 *
 * Only shown when:
 *  - The user has a stored session (they ARE logged in)
 *  - The access token is expired (Drive calls would fail)
 */

import { useEffect, useState } from 'react'
import { useTokenStatus } from '../../hooks/useTokenStatus'
import { signInWithGoogle } from '../../services/authService'

export default function ReconnectBanner() {
  const { needsReconnect, isReconnecting, reconnect } = useTokenStatus()
  const [showFull, setShowFull] = useState(false) // show full re-login option
  const [dismissed, setDismissed] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)

  // Auto-reset dismissed state when token expires again
  useEffect(() => {
    if (needsReconnect) setDismissed(false)
  }, [needsReconnect])

  if (!needsReconnect || dismissed) return null

  // --- Handlers ---

  async function handleReconnect() {
    const ok = await reconnect()
    if (ok) {
      setJustReconnected(true)
      setTimeout(() => setJustReconnected(false), 3000)
    } else {
      // Silent refresh failed → show full re-login option
      setShowFull(true)
    }
  }

  async function handleFullLogin() {
    try {
      await signInWithGoogle()
      setDismissed(true)
      setShowFull(false)
    } catch {
      // sign-in cancelled or failed — stay visible
    }
  }

  // --- Styles ---
  const bannerStyle = {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 18px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(239,68,68,0.10) 100%)',
    borderBottom: '1px solid rgba(245,158,11,0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    animation: 'slideDown 0.3s cubic-bezier(0.32,0.72,0,1)',
    flexWrap: 'wrap',
  }

  const msgStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FCD34D',
    flex: 1,
    minWidth: 0,
  }

  const btnStyle = (primary) => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: primary ? 'none' : '1px solid rgba(245,158,11,0.4)',
    background: primary
      ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
      : 'rgba(255,255,255,0.06)',
    color: primary ? 'white' : '#FCD34D',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease',
    opacity: isReconnecting ? 0.6 : 1,
  })

  const dimissStyle = {
    background: 'none',
    border: 'none',
    color: 'rgba(245,158,11,0.6)',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '2px 4px',
    flexShrink: 0,
  }

  if (justReconnected) {
    return (
      <div style={{ ...bannerStyle, background: 'rgba(16,185,129,0.12)', borderBottomColor: 'rgba(16,185,129,0.35)' }}>
        <div style={{ ...msgStyle, color: '#34D399' }}>
          <span>✅</span>
          <span>Drive reconnected successfully!</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div style={bannerStyle}>
        <div style={msgStyle}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>
            {showFull
              ? 'Silent reconnect failed. Sign in again to sync Drive.'
              : 'Google Drive session expired — your data is safe locally.'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {showFull ? (
            <>
              <button style={btnStyle(true)} onClick={handleFullLogin} disabled={isReconnecting}>
                🔑 Sign In Again
              </button>
              <button style={btnStyle(false)} onClick={() => setShowFull(false)} disabled={isReconnecting}>
                Cancel
              </button>
            </>
          ) : (
            <button style={btnStyle(true)} onClick={handleReconnect} disabled={isReconnecting}>
              {isReconnecting ? '🔄 Reconnecting…' : '🔗 Reconnect Drive'}
            </button>
          )}
          <button style={dimissStyle} onClick={() => setDismissed(true)} title="Dismiss">
            ×
          </button>
        </div>
      </div>
    </>
  )
}
