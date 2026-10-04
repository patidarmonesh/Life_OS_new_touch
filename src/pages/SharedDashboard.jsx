import { useEffect, useState } from 'react'
import { readShare } from '../services/shareService'
import SharedReport from '../components/SharedReport'
export default function SharedDashboard() {
  const [result, setResult] = useState({ loading: true, payload: null, error: '' })
  useEffect(() => {
    let cancelled = false
    const token = window.location.hash.slice(1)
    if (!token) { queueMicrotask(() => { if (!cancelled) setResult({ loading: false, error: 'This legacy link is no longer supported. Ask the owner for a new snapshot link.' }) }); return () => { cancelled = true } }
    readShare(token).then(({ payload }) => { if (!cancelled) setResult({ loading: false, payload, error: '' }) }).catch(error => { if (!cancelled) setResult({ loading: false, payload: null, error: error.message }) })
    return () => { cancelled = true }
  }, [])
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
    <p>LifeOS · Shared report</p>
    {result.loading && <p role="status">Loading shared snapshot…</p>}
    {result.error && <section className="card"><h1>Report unavailable</h1><p role="alert">{result.error}</p></section>}
    {result.payload && <SharedReport payload={result.payload} />}
  </main>
}
