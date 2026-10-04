import { NavLink, useNavigate } from 'react-router-dom'
import { Sun, CalendarDays, ChartNoAxesCombined, UserRound, Plus } from 'lucide-react'
export default function BottomNav() {
  const navigate = useNavigate()
  const tab = (to, label, Icon) => <NavLink to={to} end={to === '/'} className={({ isActive }) => `bottom-tab ${isActive ? 'active' : ''}`}><Icon size={21}/><span>{label}</span></NavLink>
  return <nav className="life-bottom-nav" aria-label="Main navigation">{tab('/', 'Today', Sun)}{tab('/plan', 'Plan', CalendarDays)}<button className="bottom-capture" aria-label="Capture something" onClick={() => navigate('/capture')}><Plus size={25}/><span>Capture</span></button>{tab('/insights', 'Insights', ChartNoAxesCombined)}{tab('/me', 'Me', UserRound)}</nav>
}
