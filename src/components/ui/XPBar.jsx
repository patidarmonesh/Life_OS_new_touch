import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../context/appHooks'
import { calculateXP, getLevel, getLevelProgress, getXPForNextLevel } from '../../utils/gamification'

const LEVEL_TITLES = {
  1: 'Beginner',
  2: 'Novice',
  3: 'Apprentice',
  4: 'Explorer',
  5: 'Achiever',
  6: 'Challenger',
  7: 'Specialist',
  8: 'Veteran',
  9: 'Expert',
  10: 'Master',
  11: 'Champion',
  12: 'Legend',
  13: 'Elite',
  14: 'Titan',
  15: 'Virtuoso',
  16: 'Sage',
  17: 'Overlord',
  18: 'Paragon',
  19: 'Ascendant',
  20: 'Mythic',
  21: 'Immortal',
  22: 'Transcendent',
  23: 'Celestial',
  24: 'Divine',
  25: 'Absolute',
  26: 'MAX',
}

export default function XPBar() {
  const state = useAppState()
  const [animated, setAnimated] = useState(false)

  const xp = useMemo(() => calculateXP(state), [state])
  const level = useMemo(() => getLevel(xp), [xp])
  const progress = useMemo(() => getLevelProgress(xp), [xp])
  const nextLevelXP = useMemo(() => getXPForNextLevel(xp), [xp])
  const pct = Math.round(progress * 100)
  const title = LEVEL_TITLES[level] || 'Absolute'

  useEffect(() => {
    setAnimated(false)
    const timer = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(timer)
  }, [xp])

  const levelColor = level >= 20
    ? '#F59E0B'
    : level >= 15
      ? '#A78BFA'
      : level >= 10
        ? '#10B981'
        : level >= 5
          ? '#60A5FA'
          : '#94A3B8'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '16px',
        background: 'rgba(15,23,42,0.48)',
        border: '1px solid rgba(148,163,184,0.10)',
      }}
    >
      {/* Level badge */}
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: `${levelColor}18`,
          border: `2px solid ${levelColor}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '16px',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: levelColor,
          }}
        >
          {level}
        </span>
      </div>

      {/* Progress section */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Level {level}{' '}
            <span style={{ color: levelColor, fontWeight: 600 }}>
              {title}
            </span>
          </div>

          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {xp.toLocaleString()} XP
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '8px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: animated ? `${pct}%` : '0%',
              height: '100%',
              borderRadius: '999px',
              background: `linear-gradient(90deg, ${levelColor}, ${levelColor}CC)`,
              boxShadow: `0 0 8px ${levelColor}40`,
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        {/* Sub text */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            {pct}% to next level
          </span>
          {nextLevelXP !== null && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-muted)',
              }}
            >
              {nextLevelXP.toLocaleString()} XP
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
