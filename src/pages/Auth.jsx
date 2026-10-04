import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/appContextCore'

export default function Auth() {
  const { user, login, continueLocally, capabilities, isLoading, authError } = useAuth()
  const [params] = useSearchParams()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (user) return <Navigate to="/" replace />
  const signIn = async () => { setPending(true); try { await login() } catch (failure) { setError(failure.message); setPending(false) } }
  return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px', background: 'var(--bg-primary)' }}>
    <section className="card" style={{ width: '100%', maxWidth: 460, padding: 32 }}>
      <p style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>LifeOS</p>
      <h1>Make room for what matters.</h1>
      <p>Plan your day, record what happened and learn from your own evidence.</p>
      {(error || authError || params.get('error')) && <p role="alert">{error || authError || params.get('error')}</p>}
      {isLoading ? <p role="status">Checking your app session…</p> : <>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={continueLocally}>Continue on this device</button>
        <p style={{ color: 'var(--text-secondary)' }}>Local mode stores records on this browser. Export a backup from Me. Cloud features require a configured server.</p>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={signIn} disabled={!capabilities.auth || pending}>{pending ? 'Opening sign-in…' : 'Sign in with Google'}</button>
        {!capabilities.auth && <p role="status">Cloud sign-in is not configured. Local planning, capture and insights are available.</p>}
      </>}
    </section>
  </main>
}
