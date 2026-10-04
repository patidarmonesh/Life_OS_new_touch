import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus, ArrowRight, Check, Trash2, RefreshCw } from 'lucide-react'
import { useAppState, useAppActions } from '../context/appHooks'
import { EMPTY_PLANNING, approveRevision, latestApproved, nextDate, ownerDate, parseDiary, replanTasks, scheduleDraft, uid } from '../domain/planning/index'
import { exportApprovedPlan, schedulePlanReminders } from '../services/calendarService'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const defaults = { text: '', blocks: [], windowStart: '09:00', windowEnd: '18:00', bufferMinutes: 10 }
export default function Plan() {
  const state = useAppState(), { updateModule, synchronize } = useAppActions(), [params, setParams] = useSearchParams()
  const timezone = state.settings?.profile?.timezone || 'Asia/Kolkata'
  const date = params.get('date') || ownerDate(new Date(), timezone)
  const planning = state.planning || EMPTY_PLANNING, draft = { ...defaults, ...planning.drafts?.[date] }
  const approved = latestApproved(planning, date)
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [exporting, setExporting] = useState(false)
  const preview = scheduleDraft(draft.blocks, { ...draft, localDate: date, timezone })
  const exportStatus = planning.exportStatus?.[approved?.id]
  const plannedMinutes = preview.blocks.reduce((sum, b) => sum + b.estimateMinutes, 0)
  function change(patch) { setMessage(''); setError(''); updateModule('planning', p => ({ ...p, drafts: { ...p.drafts, [date]: { ...defaults, ...p.drafts?.[date], ...patch } } })) }
  function changeBlock(id, patch) { change({ blocks: draft.blocks.map(b => b.id === id ? { ...b, ...patch } : b) }) }
  function propose() {
    if (!draft.text.trim()) { setError('Write at least one task.'); return }
    const blocks = parseDiary(draft.text); change({ blocks }); setMessage('Draft prepared. Review each estimate, time and priority before approving.')
  }
  function addBlock() { change({ blocks: [...draft.blocks, { id: uid('block'), taskId: uid('task'), title: '', estimateMinutes: 30, priority: 'should', fixed: false, startTime: '', category: 'Deep Work', completionCriterion: '' }] }) }
  function replan() {
    if (!approved) return
    const today = ownerDate(new Date(), timezone), nowClock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
    change({ blocks: replanTasks(approved, planning.checkins || []), windowStart: date === today && nowClock > draft.windowStart ? nowClock : draft.windowStart })
    setMessage('Current commitments copied. Completed and fixed blocks are held in place. Review the changes before approving a new revision.')
  }
  function carryOver() {
    const ids = new Set(preview.unscheduled.map(b => b.id)), tomorrow = nextDate(date)
    updateModule('planning', p => ({ ...p, drafts: { ...p.drafts, [date]: { ...draft, blocks: draft.blocks.filter(b => !ids.has(b.id)) }, [tomorrow]: { ...defaults, ...p.drafts?.[tomorrow], blocks: [...(p.drafts?.[tomorrow]?.blocks || []), ...preview.unscheduled.map(b => ({ ...b, id: uid('block'), fixed: false, startTime: '', carriedFrom: date }))] } } }))
    setMessage(`Unscheduled tasks moved to the draft for ${tomorrow}. Original approved commitments are preserved.`)
  }
  async function approve(andExport = false) {
    try {
      setError('')
      const result = approveRevision(planning, { ...preview, localDate: date, timezone })
      updateModule('planning', () => result.planning)
      setMessage(`Approved ${date}, revision ${result.revision.revision}. Your actual activity is unchanged.`)
      if (andExport) await exportDay(result.revision)
    } catch (e) { setError(e.message) }
  }
  async function exportDay(revision) {
    setExporting(true); setError('')
    try {
      const sync = await synchronize()
      if (sync?.status !== 'synced') throw new Error(sync?.error || 'Sync this approved revision with your configured account before exporting. The local workspace cannot export to Google.')
      const result = await exportApprovedPlan(revision)
      updateModule('planning', p => ({ ...p, exportStatus: { ...p.exportStatus, [revision.id]: { ...result, updatedAt: new Date().toISOString() } } }))
      setMessage(result.status === 'partial' ? 'Some blocks need retry. Successful exports will not be duplicated.' : `Calendar export completed for ${revision.localDate}.`)
    } catch (e) {
      const status = { status: 'pending', error: e.message, updatedAt: new Date().toISOString() }
      updateModule('planning', p => ({ ...p, exportStatus: { ...p.exportStatus, [revision.id]: status } }))
      setError(`Your approval is saved locally. Calendar export is pending: ${e.message}`)
    } finally { setExporting(false) }
  }
  async function scheduleReminders() {
    if (!approved) return
    setExporting(true); setError('')
    try {
      const sync = await synchronize()
      if (sync?.status !== 'synced') throw new Error(sync?.error || 'Sync this approved revision with your configured account before scheduling reminders.')
      const result = await schedulePlanReminders(approved)
      updateModule('planning', p => ({ ...p, reminderStatus: { ...p.reminderStatus, [approved.id]: { ...result, updatedAt: new Date().toISOString() } } }))
      setMessage('Reminder scheduling request saved on the server. Delivery is best-effort; pending check-ins stay available in Today.')
    } catch (e) { setError(`Reminders were not scheduled: ${e.message} Your approved plan is retained.`) }
    finally { setExporting(false) }
  }
  const differences = approved ? preview.blocks.filter(b => { const old = approved.blocks.find(a => a.id === b.id); return !old || old.startAt !== b.startAt || old.endAt !== b.endAt || old.title !== b.title }) : []
  const removed = approved ? approved.blocks.filter(a => !preview.blocks.some(b => b.id === a.id)) : []
  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h1>Plan a realistic day.</h1><p>A draft you can change. A commitment you choose.</p></div><Link to="/goals" className="button button-secondary">Goals <ArrowRight size={16}/></Link></header>
    <section className="section-card"><div className="form-grid"><Input type="date" label="Planning date" value={date} onChange={e => { if (e.target.value) { setParams({ date: e.target.value }); setMessage(''); setError('') } }}/><div className="field"><span>Owner timezone</span><p>{timezone}</p><p className="caption">Approval and export apply only to this date.</p></div></div><div className="row-actions" style={{ marginTop: '1rem' }}>{Array.from({ length: 7 }, (_, i) => nextDate(date, i - 3)).map(d => <Button key={d} variant={d === date ? 'primary' : 'ghost'} onClick={() => setParams({ date: d })}>{new Date(`${d}T12:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}</Button>)}</div></section>
    <div className="today-grid"><section className="section-card"><div className="section-heading"><h2>Start with a rough plan</h2><span className="badge">Draft saved on this device</span></div><div className="field"><label htmlFor="diary-plan">One task per line · Hindi, English or Hinglish</label><textarea id="diary-plan" className="draft-textarea" value={draft.text} onChange={e => change({ text: e.target.value })} placeholder={'09:00 Study thermodynamics 60 min must\nWalk 30 min\n14:00 Appointment 45 min'}/><p className="caption">Use explicit 24-hour times or AM/PM. Missing estimates start at an editable 30 min. This deterministic parser keeps your wording.</p></div><div className="row-actions" style={{ marginTop: '1rem' }}><Button onClick={propose}>Prepare editable draft <ArrowRight size={16}/></Button><Link to="/capture" className="button button-ghost">Open capture inbox</Link></div></section>
    <section className="section-card"><h2>Your capacity</h2><p className="caption" style={{ margin: '.5rem 0 1rem' }}>Explicit defaults, not learned capacity. Add sleep, meals, travel or appointments as fixed blocks to protect them.</p><div className="form-grid"><Input type="time" label="Flexible work starts" value={draft.windowStart} onChange={e => change({ windowStart: e.target.value })}/><Input type="time" label="Flexible work ends" value={draft.windowEnd} onChange={e => change({ windowEnd: e.target.value })}/><Input type="number" min="0" max="120" label="Buffer between tasks (min)" value={draft.bufferMinutes} onChange={e => change({ bufferMinutes: Math.max(0, Number(e.target.value)) })}/></div><p className="caption" style={{ marginTop: '1rem' }}>External busy events are not loaded automatically. Add existing commitments before approving.</p></section></div>
    <section className="section-card"><div className="section-heading"><div><h2>Shape the day</h2><p className="caption">{preview.blocks.length} blocks fit · {plannedMinutes} planned minutes · {preview.unscheduled.length} need attention</p></div><div className="row-actions">{approved && <Button variant="secondary" onClick={replan}><RefreshCw size={16}/>Replan remaining day</Button>}<Button variant="secondary" onClick={addBlock}><Plus size={16}/>Add task</Button></div></div>
    {!draft.blocks.length && <div className="empty-state"><CalendarDays size={32}/><h3>A little structure goes a long way.</h3><p>Prepare a draft above or add your first task. Leave space between commitments.</p></div>}
    {draft.blocks.map((block, index) => <div className="plan-block" key={block.id}><span className="plan-index">{String(index + 1).padStart(2, '0')}</span><div className="plan-block-body"><Input label={`Task ${index + 1}`} value={block.title} onChange={e => changeBlock(block.id, { title: e.target.value })}/><div className="plan-block-fields"><Input type="number" min="1" max="1440" label="Estimate (min)" value={block.estimateMinutes} onChange={e => changeBlock(block.id, { estimateMinutes: Number(e.target.value), estimateAssumed: false })}/><div className="field"><label htmlFor={`priority-${block.id}`}>Priority</label><select id={`priority-${block.id}`} value={block.priority} onChange={e => changeBlock(block.id, { priority: e.target.value })}><option value="must">Must</option><option value="should">Should</option><option value="could">Could</option></select></div><div className="field"><label htmlFor={`category-${block.id}`}>Area</label><select id={`category-${block.id}`} value={block.category} onChange={e => changeBlock(block.id, { category: e.target.value })}>{['Deep Work', 'Study', 'Sleep', 'Meals', 'Exercise', 'Travel', 'Entertainment', 'Other'].map(c => <option key={c}>{c}</option>)}</select></div></div><div className="row-actions"><label className="row-actions"><input type="checkbox" checked={block.fixed} onChange={e => changeBlock(block.id, { fixed: e.target.checked })}/>Fixed time</label>{block.fixed && <Input type="time" aria-label={`Start time for ${block.title}`} value={block.startTime} onChange={e => changeBlock(block.id, { startTime: e.target.value, warning: '' })}/>}<label className="row-actions caption"><input type="checkbox" checked={Boolean(block.endsNextDay)} onChange={e => changeBlock(block.id, { endsNextDay: e.target.checked })}/>Allow an overnight end</label><span className="caption">{preview.blocks.find(b => b.id === block.id)?.startTime || 'Unscheduled'}{block.estimateAssumed ? ' · estimate assumed' : ''}</span></div>{block.warning && <p className="notice warning">{block.warning} Set a fixed time to clarify.</p>}<label className="row-actions caption"><input type="checkbox" checked={Boolean(block.pushReminder)} onChange={e => changeBlock(block.id, { pushReminder: e.target.checked, reminderMinutes: block.reminderMinutes ?? 5 })}/>Remind me before this block</label>{block.pushReminder && <Input type="number" min="0" max="120" label="Reminder minutes before start" value={block.reminderMinutes ?? 5} onChange={e => changeBlock(block.id, { reminderMinutes: Math.max(0, Number(e.target.value)) })}/>}<Input label="Done means (optional)" value={block.completionCriterion || ''} onChange={e => changeBlock(block.id, { completionCriterion: e.target.value })}/></div><button type="button" className="icon-button" aria-label={`Remove ${block.title || 'task'} from draft`} onClick={() => change({ blocks: draft.blocks.filter(b => b.id !== block.id) })}><Trash2 size={17}/></button></div>)}
    {preview.warnings.length > 0 && <div className="notice warning" style={{ marginTop: '1rem' }}>{preview.warnings.map((w, i) => <p key={i}>{w}</p>)}{preview.unscheduled.length > 0 && <Button variant="secondary" onClick={carryOver} style={{ marginTop: '.75rem' }}>Carry unscheduled tasks to {nextDate(date)}</Button>}</div>}
    {approved && (differences.length > 0 || removed.length > 0) && <div className="notice" style={{ marginTop: '1rem' }}><strong>Changes awaiting approval</strong>{differences.map(b => <p key={b.id}>{b.title}: {b.startTime}–{b.endTime}</p>)}{removed.map(b => <p key={b.id}>{b.title}: removed from current draft; original commitment retained</p>)}</div>}
    <div className="row-actions" style={{ marginTop: '1.5rem' }}><Button onClick={() => approve(false)} disabled={!preview.blocks.length || preview.warnings.length > 0}><Check size={16}/>Approve day</Button><Button variant="secondary" onClick={() => approve(true)} loading={exporting} disabled={!preview.blocks.length || preview.warnings.length > 0}>Approve & add to Google Calendar</Button></div><p className="caption" style={{ marginTop: '.75rem' }}>No recurrence. External edits require your approval. Missed commitments stay in the original revision.</p>
    </section>
    {message && <p className="notice" role="status">{message}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {approved && <section className="section-card"><div className="section-heading"><h2>Approval history</h2><Link to="/">Go to Today <ArrowRight size={16}/></Link></div><div className="page-stack">{planning.revisions.filter(r => r.localDate === date).slice().reverse().map(r => <div key={r.id}><p><strong>Revision {r.revision}</strong> · {r.blocks.length} blocks · {r.id === r.originalRevisionId ? 'Original commitments' : 'Approved adjustment'}</p><p className="caption">Approved {new Date(r.approvedAt).toLocaleString('en', { timeZone: timezone })}</p></div>)}<div className="notice"><div className="row-actions"><Button variant="secondary" loading={exporting} disabled={!approved.blocks.some(b => b.pushReminder)} onClick={scheduleReminders}>Schedule opted-in reminders</Button><Link className="button button-ghost" to="/settings">Enable this device in Settings</Link></div><p className="caption">Reminders require a configured server and device subscription. In-app check-ins remain available if delivery fails.</p><p>Calendar: {exportStatus?.status || 'not exported'}</p>{exportStatus?.error && <p>{exportStatus.error}</p>}{exportStatus?.operations?.filter(o => o.status === 'failed').map(o => <p key={o.blockId}>{o.error}</p>)}<Button variant="secondary" loading={exporting} onClick={() => exportDay(approved)} style={{ marginTop: '.75rem' }}>{exportStatus?.status === 'partial' || exportStatus?.status === 'pending' ? 'Retry pending export' : 'Export approved date'}</Button></div></div></section>}
  </div>
}
