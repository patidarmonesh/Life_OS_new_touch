import { useCallback, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { MessageSquare, Mic, MicOff } from 'lucide-react'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../../hooks/useHaptic'
import { getTodayDateKey } from '../../utils/dateTime'

const PATTERNS = [
  {
    type: 'expense',
    regex: /(?:spent|paid|bought|expense)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s+(?:on|for)?\s*(.+)/i,
    extract: (m) => ({ amount: parseFloat(m[1]), description: m[2].trim() }),
  },
  {
    type: 'expense',
    regex: /(\d+(?:\.\d+)?)\s+(?:₹|rs\.?|inr)?\s+(?:on|for)\s+(.+)/i,
    extract: (m) => ({ amount: parseFloat(m[1]), description: m[2].trim() }),
  },
  {
    type: 'study',
    regex: /(?:studied|study|read|learning|learnt|practiced)\s+(.+?)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/i,
    extract: (m) => ({ subject: m[1].trim(), durationMinutes: Math.round(parseFloat(m[2]) * 60) }),
  },
  {
    type: 'study',
    regex: /(?:studied|study|read|learning|learnt|practiced)\s+(.+?)\s+(?:for\s+)?(\d+)\s*(?:minutes?|mins?|m)/i,
    extract: (m) => ({ subject: m[1].trim(), durationMinutes: parseInt(m[2], 10) }),
  },
  {
    type: 'health_steps',
    regex: /(?:walked|steps?|walk)\s+(\d+)\s*(?:steps)?/i,
    extract: (m) => ({ steps: parseInt(m[1], 10) }),
  },
  {
    type: 'health_sleep',
    regex: /(?:slept|sleep)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/i,
    extract: (m) => ({ sleepHours: parseFloat(m[1]) }),
  },
  {
    type: 'timeflow_waste',
    regex: /(?:wasted|waste)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s+(?:on\s+)?(.+)/i,
    extract: (m) => ({ durationMinutes: Math.round(parseFloat(m[1]) * 60), activity: m[2].trim(), isWaste: true }),
  },
  {
    type: 'timeflow_waste',
    regex: /(?:wasted|waste)\s+(\d+)\s*(?:minutes?|mins?|m)\s+(?:on\s+)?(.+)/i,
    extract: (m) => ({ durationMinutes: parseInt(m[1], 10), activity: m[2].trim(), isWaste: true }),
  },
]

function parseInput(text) {
  for (const pattern of PATTERNS) {
    const match = text.match(pattern.regex)
    if (match) {
      return { type: pattern.type, data: pattern.extract(match) }
    }
  }
  return null
}

export default function NLInput({ state, setModule, patchModule, showToast }) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  function toggleListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('Speech recognition is not supported in this browser.', 'error')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      playSubtleClick()
      hapticLight()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      playSubtleClick()
      hapticLight()
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(prev => prev + (prev ? ' ' : '') + transcript)
      playSuccessSound()
      hapticSuccess()
    }

    recognition.onerror = (event) => {
      console.error(event.error)
      showToast('Speech recognition error: ' + event.error, 'error')
      setIsListening(false)
      playWarningBeep()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }
  const [lastAction, setLastAction] = useState(null)
  const inputRef = useRef(null)
  const timezone = state?.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text) return

    const parsed = parseInput(text)
    if (!parsed) {
      showToast("🤔 Couldn't understand. Try: 'Spent 500 on groceries' or 'Studied math for 2 hours'", 'error')
      return
    }

    const { type, data } = parsed

    if (type === 'expense') {
      const expense = {
        id: uuid(),
        date: today,
        amount: data.amount,
        description: data.description,
        category: 'Other',
        paymentMethod: '',
        isImpulse: false,
        note: '',
        tags: [],
        loggedAt: new Date().toISOString(),
      }
      const expenses = [...(state.finance?.expenses || []), expense]
      setModule('finance', { ...state.finance, expenses })
      showToast(`✅ Added ₹${data.amount} expense: ${data.description}`, 'success')
      setLastAction({ type: 'expense', text: `₹${data.amount} → ${data.description}` })
    }

    else if (type === 'study') {
      const session = {
        id: uuid(),
        date: today,
        subject: data.subject,
        durationMinutes: data.durationMinutes,
        note: '',
        tags: [],
        loggedAt: new Date().toISOString(),
      }
      const sessions = [...(state.study?.sessions || []), session]
      setModule('study', { ...state.study, sessions })
      const hours = (data.durationMinutes / 60).toFixed(1)
      showToast(`✅ Logged ${hours}h study: ${data.subject}`, 'success')
      setLastAction({ type: 'study', text: `${hours}h → ${data.subject}` })
    }

    else if (type === 'health_steps') {
      const bodyLogs = state.health?.bodyLogs || state.health?.manualLogs || []
      const existing = bodyLogs.find(l => l.date === today)
      if (existing) {
        const updated = bodyLogs.map(l =>
          l.date === today ? { ...l, steps: data.steps } : l
        )
        patchModule('health', { bodyLogs: updated })
      } else {
        patchModule('health', {
          bodyLogs: [...bodyLogs, { id: uuid(), date: today, steps: data.steps }],
        })
      }
      showToast(`✅ Logged ${data.steps.toLocaleString()} steps`, 'success')
      setLastAction({ type: 'health', text: `${data.steps.toLocaleString()} steps` })
    }

    else if (type === 'health_sleep') {
      const bodyLogs = state.health?.bodyLogs || state.health?.manualLogs || []
      const existing = bodyLogs.find(l => l.date === today)
      if (existing) {
        const updated = bodyLogs.map(l =>
          l.date === today ? { ...l, sleepHours: data.sleepHours } : l
        )
        patchModule('health', { bodyLogs: updated })
      } else {
        patchModule('health', {
          bodyLogs: [...bodyLogs, { id: uuid(), date: today, sleepHours: data.sleepHours }],
        })
      }
      showToast(`✅ Logged ${data.sleepHours}h sleep`, 'success')
      setLastAction({ type: 'health', text: `${data.sleepHours}h sleep` })
    }

    else if (type === 'timeflow_waste') {
      const entry = {
        id: uuid(),
        date: today,
        activity: data.activity,
        durationMinutes: data.durationMinutes,
        isWaste: true,
        category: '',
        note: '',
        tags: [],
        loggedAt: new Date().toISOString(),
      }
      const entries = [...(state.timeflow?.entries || []), entry]
      setModule('timeflow', { ...state.timeflow, entries })
      const hours = (data.durationMinutes / 60).toFixed(1)
      showToast(`✅ Logged ${hours}h waste: ${data.activity}`, 'success')
      setLastAction({ type: 'timeflow', text: `${hours}h waste → ${data.activity}` })
    }

    setInput('')
    inputRef.current?.focus()
  }, [input, state, today, setModule, patchModule, showToast])

  return (
    <div style={{
      borderRadius: '16px',
      background: 'rgba(15,23,42,0.52)',
      border: '1px solid rgba(148,163,184,0.10)',
      padding: '4px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px',
      }}>
        <MessageSquare size={18} color="var(--accent-indigo)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="Type what you did… e.g. 'Spent 200 on coffee' or 'Studied math for 2h'"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
          }}
        />
        <button
          type="button"
          onClick={toggleListening}
          style={{
            background: 'none',
            border: 'none',
            color: isListening ? '#EF4444' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            borderRadius: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          style={{
            padding: '8px 16px', borderRadius: '10px',
            background: input.trim() ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(129,140,248,0.2)',
            color: input.trim() ? '#B9C2FF' : 'var(--text-muted)',
            fontSize: '13px', fontWeight: 700, cursor: input.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          Log
        </button>
      </div>
      {lastAction && (
        <div style={{
          padding: '6px 14px 8px', fontSize: '11px',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          <span style={{
            padding: '2px 8px', borderRadius: '6px',
            background: 'rgba(16,185,129,0.12)', color: '#34D399',
            fontSize: '10px', fontWeight: 700,
          }}>
            {lastAction.type.toUpperCase()}
          </span>
          {lastAction.text}
        </div>
      )}
    </div>
  )
}
