import { useState, useMemo } from 'react'
import { getTodayDateKey } from '../../utils/dateTime'
import { X } from 'lucide-react'

function getReminderChips(state) {
  const now = new Date()
  const hour = now.getHours()
  const timezone = state?.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)
  const preferences = state?.settings?.preferences || {}
  const chips = []

  // Morning greeting
  if (hour < 10) {
    chips.push({
      id: 'morning',
      icon: '🌅',
      text: 'Good morning! Plan your day',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.22)',
    })
  }

  // Study check — after 3 PM
  const todaySessions = (state?.study?.sessions || []).filter(s => s.date === today)
  const studyMins = todaySessions.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)
  if (hour >= 15 && studyMins === 0) {
    chips.push({
      id: 'no-study',
      icon: '📚',
      text: 'No study logged yet today',
      color: '#60A5FA',
      bg: 'rgba(96,165,250,0.10)',
      border: 'rgba(96,165,250,0.22)',
    })
  }

  // Budget alert — >80%
  const monthlyBudget = preferences.monthlyBudget || 8000
  const dailyBudget = Math.round(monthlyBudget / 30)
  const todayExpenses = (state?.finance?.expenses || []).filter(e => e.date === today)
  const todaySpend = todayExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const budgetPct = dailyBudget > 0 ? Math.round((todaySpend / dailyBudget) * 100) : 0
  if (budgetPct > 80) {
    chips.push({
      id: 'budget',
      icon: '⚠️',
      text: `Budget alert: ${budgetPct}% used today`,
      color: '#FB7185',
      bg: 'rgba(251,113,133,0.10)',
      border: 'rgba(251,113,133,0.22)',
    })
  }

  // Habits check
  const checkpoints = (state?.habits?.checkpoints || []).filter(c => c.isActive)
  const todayLogs = (state?.habits?.dailyLogs || []).filter(l => l.date === today)
  const completedCount = todayLogs.filter(l => l.status === 'done').length

  if (checkpoints.length > 0 && completedCount === checkpoints.length) {
    chips.push({
      id: 'all-habits',
      icon: '🎉',
      text: 'All habits done! Great job!',
      color: '#34D399',
      bg: 'rgba(52,211,153,0.10)',
      border: 'rgba(52,211,153,0.22)',
    })
  } else if (hour >= 18 && checkpoints.length > 0 && completedCount === 0) {
    chips.push({
      id: 'no-habits',
      icon: '✅',
      text: 'No habits checked off yet',
      color: '#818CF8',
      bg: 'rgba(129,140,248,0.10)',
      border: 'rgba(129,140,248,0.22)',
    })
  }

  // Evening journal reminder
  if (hour >= 20) {
    const todayJournals = (state?.journal?.entries || []).filter(e => e.date === today)
    if (todayJournals.length === 0) {
      chips.push({
        id: 'journal',
        icon: '✍️',
        text: "Don't forget your journal entry tonight",
        color: '#A78BFA',
        bg: 'rgba(167,139,250,0.10)',
        border: 'rgba(167,139,250,0.22)',
      })
    }
  }

  return chips
}

export default function SmartReminders({ state }) {
  const [dismissed, setDismissed] = useState({})

  const chips = useMemo(() => getReminderChips(state), [state])

  const visibleChips = chips.filter(c => !dismissed[c.id])

  if (visibleChips.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {visibleChips.map(chip => (
        <div
          key={chip.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '999px',
            background: chip.bg,
            border: `1px solid ${chip.border}`,
            color: chip.color,
            fontSize: '12px',
            fontWeight: 700,
            animation: 'fadeSlideIn 0.35s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '14px' }}>{chip.icon}</span>
          <span>{chip.text}</span>
          <button
            onClick={() => setDismissed(prev => ({ ...prev, [chip.id]: true }))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border: 'none',
              background: 'rgba(255,255,255,0.08)',
              color: chip.color,
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              marginLeft: '2px',
            }}
            aria-label={`Dismiss ${chip.text}`}
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}
