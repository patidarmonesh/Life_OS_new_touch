import { useEffect, useRef, useState } from 'react'

export default function ScoreRing({ score = 0, size = 160, strokeWidth = 12, label = 'Score' }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E'
  const [animated, setAnimated] = useState(false)
  const ref = useRef(null)

  // Animate on mount / when score changes
  useEffect(() => {
    setAnimated(false)
    const timer = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div
      ref={ref}
      style={{
        position: 'relative', width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--border)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={animated ? circ - fill : circ}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{
          fontSize: size * 0.22, fontWeight: '800',
          fontFamily: 'Syne, sans-serif', color,
          transition: 'color 0.3s ease',
        }}>
          {score}
        </div>
        <div style={{
          fontSize: size * 0.1, color: 'var(--text-muted)', fontWeight: '500',
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}