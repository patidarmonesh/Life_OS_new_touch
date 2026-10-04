import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppState } from '../../context/appHooks'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import UpdatePrompt from '../ui/UpdatePrompt'
export default function AppShell({ children }) {
  const state = useAppState(), location = useLocation()
  const theme = state.settings?.preferences?.theme || 'dark'
  const soundEnabled = state.settings?.preferences?.soundEnabled === true
  useEffect(() => { document.documentElement.dataset.sound = soundEnabled ? 'enabled' : 'disabled' }, [soundEnabled])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.setAttribute('data-theme', theme === 'system' ? (media.matches ? 'dark' : 'light') : theme)
    apply(); media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    const names = { '/': 'Today', '/plan': 'Plan', '/capture': 'Capture', '/insights': 'Insights', '/me': 'Me', '/finance': 'Money', '/habits': 'Routines', '/brain': 'Notes' }
    if (names[location.pathname]) document.title = `${names[location.pathname]} · LifeOS`
  }, [location.pathname])
  return <div className="life-shell"><a className="skip-link" href="#main-content">Skip to content</a><Sidebar/><div className="life-main"><TopBar/><main id="main-content" className="life-content" tabIndex={-1}><UpdatePrompt/>{children}</main></div><BottomNav/></div>
}
