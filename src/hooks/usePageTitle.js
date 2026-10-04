import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
  '/': 'Home',
  '/finance': 'Finance',
  '/timeflow': 'Time Flow',
  '/study': 'Study',
  '/habits': 'Habits',
  '/health': 'Health',
  '/journal': 'Journal',
  '/ai': 'AI Chat',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/scoring': 'Scoring Studio',
  '/analysis-builder': 'Analysis Builder',
  '/calendar': 'Calendar',
  '/focus': 'Focus Mode',
}

/**
 * Sets the browser tab title based on the current route.
 * Shows "Page Name — Life OS" for better UX when multiple tabs are open.
 */
export function usePageTitle() {
  const location = useLocation()

  useEffect(() => {
    const pageName = PAGE_TITLES[location.pathname]
    document.title = pageName
      ? `${pageName} — Life OS`
      : 'Life OS — Personal Life Operating System'
  }, [location.pathname])
}
