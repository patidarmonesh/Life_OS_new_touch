import { useMemo, useState } from 'react'
import { useAppState } from '../../context/appHooks'
import { BADGES, getUnlockedBadges, calculateXP } from '../../utils/gamification'
import { calcLifeScore } from '../../utils/scoreCalculator'

export default function BadgeGrid() {
  const state = useAppState()
  const [hoveredId, setHoveredId] = useState(null)

  const scores = useMemo(() => calcLifeScore(state), [state])
  const xp = useMemo(() => calculateXP(state), [state])

  const unlockedBadges = useMemo(
    () => getUnlockedBadges(state, { lifeScore: scores.total, xp }),
    [state, scores.total, xp]
  )

  const unlockedIds = useMemo(
    () => new Set(unlockedBadges.map(b => b.id)),
    [unlockedBadges]
  )

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              margin: 0,
            }}
          >
            🏅 Badges
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            Unlock achievements by using Life OS
          </p>
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: unlockedBadges.length === BADGES.length ? '#10B981' : '#A5B4FC',
            padding: '6px 12px',
            borderRadius: '999px',
            background:
              unlockedBadges.length === BADGES.length
                ? 'rgba(16,185,129,0.12)'
                : 'rgba(99,102,241,0.12)',
            border:
              unlockedBadges.length === BADGES.length
                ? '1px solid rgba(16,185,129,0.22)'
                : '1px solid rgba(129,140,248,0.18)',
          }}
        >
          {unlockedBadges.length} / {BADGES.length}
        </div>
      </div>

      {/* Badge grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: '12px',
        }}
      >
        {BADGES.map(badge => {
          const unlocked = unlockedIds.has(badge.id)
          const isHovered = hoveredId === badge.id

          return (
            <div
              key={badge.id}
              onMouseEnter={() => setHoveredId(badge.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '14px 8px',
                borderRadius: '16px',
                background: unlocked
                  ? 'rgba(99,102,241,0.08)'
                  : 'rgba(255,255,255,0.02)',
                border: unlocked
                  ? '1px solid rgba(129,140,248,0.22)'
                  : '1px solid rgba(148,163,184,0.08)',
                cursor: 'default',
                transition: 'all 0.2s ease',
                boxShadow: unlocked
                  ? '0 0 16px rgba(99,102,241,0.12)'
                  : 'none',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Emoji / locked overlay */}
              <div
                style={{
                  fontSize: '28px',
                  lineHeight: 1,
                  filter: unlocked ? 'none' : 'grayscale(1) opacity(0.35)',
                  position: 'relative',
                }}
              >
                {unlocked ? badge.emoji : '❓'}
              </div>

              {/* Badge name */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  minHeight: '28px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {unlocked ? badge.name : '???'}
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(15,23,42,0.95)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    boxShadow: '0 8px 24px rgba(2,6,23,0.5)',
                    zIndex: 50,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                    }}
                  >
                    {badge.emoji} {badge.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {badge.desc}
                  </div>
                  {unlocked && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#10B981',
                        fontWeight: 700,
                        marginTop: '3px',
                      }}
                    >
                      ✓ Unlocked
                    </div>
                  )}

                  {/* Tooltip arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: '8px',
                      height: '8px',
                      background: 'rgba(15,23,42,0.95)',
                      borderRight: '1px solid rgba(148,163,184,0.18)',
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
