const colors = {
  green: { background: 'rgba(16,185,129,0.15)', color: '#10B981' },
  red: { background: 'rgba(244,63,94,0.15)', color: '#F43F5E' },
  amber: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  blue: { background: 'rgba(59,130,246,0.15)', color: '#3B82F6' },
  purple: { background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' },
  gray: { background: 'rgba(107,114,128,0.15)', color: '#9CA3AF' },
}

export default function Badge({ children, color = 'gray' }) {
  return (
    <span style={{
      ...colors[color],
      padding: '2px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
    }}>
      {children}
    </span>
  )
}