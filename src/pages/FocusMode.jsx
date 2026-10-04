import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../context/appHooks'
import { latestApproved, ownerDate, uid, zonedInstant } from '../domain/planning/index'
import TaskTimer from '../components/daily/TaskTimer'
import CheckInDialog from '../components/daily/CheckInDialog'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
export default function FocusMode() {
  const state = useAppState(), timezone = state.settings?.profile?.timezone || 'Asia/Kolkata'
  const today = ownerDate(new Date(), timezone), planning = state.planning || {}
  const blocks = latestApproved(planning, today)?.blocks || []
  const activeBlock = planning.revisions?.flatMap(r => r.blocks).find(b => b.id === planning.timer?.blockId) || planning.timer?.block
  const [selected, setSelected] = useState(''), [title, setTitle] = useState(''), [custom, setCustom] = useState(null), [checkin, setCheckin] = useState(null)
  const block = activeBlock || blocks.find(b => b.id === selected) || custom
  function makeTask() {
    if (!title.trim()) return
    const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
    setCustom({ id: uid('block'), taskId: uid('task'), title, category: 'Deep Work', localDate: today, timezone, startTime: clock, endTime: clock, startAt: zonedInstant(today, clock, timezone), endAt: zonedInstant(today, clock, timezone), estimateMinutes: 0, unplanned: true })
  }
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">ONE THING AT A TIME</p><h1>Focus.</h1><p>Track your time, then confirm the outcome.</p></div><Link className="button button-secondary" to="/">Back to Today</Link></header><section className="section-card"><div className="page-stack"><div className="field"><label htmlFor="focus-block">Choose an approved task</label><select id="focus-block" value={selected} disabled={Boolean(activeBlock)} onChange={e => setSelected(e.target.value)}><option value="">Select a task</option>{blocks.map(b => <option key={b.id} value={b.id}>{b.startTime} · {b.title}</option>)}</select></div>{!activeBlock && <><Input label="Or name an unplanned focus task" value={title} onChange={e => setTitle(e.target.value)}/><Button variant="secondary" onClick={makeTask}>Use this task</Button></>}{block ? <TaskTimer block={block} onStopped={() => setCheckin(block)}/> : planning.timer ? <TaskTimer/> : <p className="notice">Choose or name a task to start. A running timer persists between reloads.</p>}<p className="caption">Signed-in cloud timers use a renewable device lease. Local workspaces should use one device at a time. Review any interrupted or unusually long run.</p></div></section>{checkin && <CheckInDialog key={checkin.id} block={checkin} onClose={() => setCheckin(null)}/>}</div>
}
