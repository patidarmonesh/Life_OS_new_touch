export default function Card({ children, className = '', onClick, style = {} }) {
  const isClickable = Boolean(onClick)
  return (
    <div
      onClick={onClick}
      className={`${isClickable ? 'metric-card-hover' : ''} ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        padding: '20px',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: isClickable ? 'pointer' : 'default',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onMouseEnter={e => {
        if (isClickable) {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(0,0,0,0.35), 0 4px 10px -2px rgba(99,102,241,0.12)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = style.background || 'var(--bg-card)'
        e.currentTarget.style.borderColor = style.borderColor || style.border?.split(' ').pop() || 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = style.boxShadow || '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)'
      }}
    >
      {children}
    </div>
  )
}
