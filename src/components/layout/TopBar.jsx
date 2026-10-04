import { Link } from 'react-router-dom'
import { Cloud, CloudOff, MessageCircle, ArrowUpRight } from 'lucide-react'
import { useAppState } from '../../context/appHooks'
export default function TopBar() {
  const state = useAppState()
  const status = { synced: 'Synced', syncing: 'Syncing…', offline: 'Saved on this device', local: 'Saved on this device', auth_required: 'Reconnect in Me', error: 'Sync needs attention', conflict: 'Sync conflict — review in Me' }[state.syncStatus] || 'Local workspace'
  const connected = state.syncStatus === 'synced'
  return <header className="life-topbar"><Link className="mobile-brand" to="/">LifeOS</Link><div className="topbar-context">YOUR PERSONAL EXECUTION SYSTEM</div><Link to="/me" className="sync-indicator">{connected ? <Cloud size={16}/> : <CloudOff size={16}/>}<span>{status}</span></Link><Link to="/ai" className="ask-link" aria-label="Ask LifeOS"><MessageCircle size={18}/><span>Ask LifeOS</span><ArrowUpRight size={14}/></Link></header>
}
