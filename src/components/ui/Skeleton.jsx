/**
 * Skeleton loading placeholder with shimmer animation.
 * Use as a placeholder while data is loading.
 */
export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card-hover) 50%, var(--bg-secondary) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite ease-in-out',
      ...style,
    }} />
  )
}

/**
 * Skeleton card with multiple rows, mimics a data card while loading.
 */
export function SkeletonCard({ rows = 3 }) {
  return (
    <div style={{
      padding: '20px', borderRadius: '16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <Skeleton width="40%" height={14} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          width={`${70 + Math.random() * 30}%`}
          height={12}
          style={{ marginBottom: i < rows - 1 ? 10 : 0 }}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton metric card, mimics a number + label card.
 */
export function SkeletonMetric() {
  return (
    <div style={{
      padding: '16px', borderRadius: '14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <Skeleton width={32} height={32} borderRadius="50%" style={{ margin: '0 auto 10px' }} />
      <Skeleton width="60%" height={20} style={{ margin: '0 auto 8px' }} />
      <Skeleton width="80%" height={10} style={{ margin: '0 auto' }} />
    </div>
  )
}

/**
 * Skeleton specific to Home page layout
 */
export function HomeSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', animate: 'pulse 1.5s infinite' }}>
      {/* Hero card skeleton */}
      <div style={{ height: '220px', borderRadius: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Skeleton width="20%" height={20} style={{ marginBottom: '16px' }} />
        <Skeleton width="50%" height={40} style={{ marginBottom: '16px' }} />
        <Skeleton width="70%" height={16} />
      </div>
      {/* Quick logs skeleton */}
      <div style={{ height: '56px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <Skeleton width="80%" height={16} />
      </div>
      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
      </div>
      {/* Side-by-side habits and status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '18px' }}>
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  )
}

/**
 * Skeleton specific to Finance page layout
 */
export function FinanceSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header row skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="20%" height={28} />
        <Skeleton width="120px" height={36} borderRadius={10} />
      </div>
      {/* Budget progress card skeleton */}
      <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Skeleton width="30%" height={32} style={{ marginBottom: '12px' }} />
        <Skeleton width="100%" height={8} borderRadius={4} style={{ marginBottom: '12px' }} />
        <Skeleton width="40%" height={12} />
      </div>
      {/* Filter and stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
      </div>
      {/* Transaction list skeleton */}
      <SkeletonCard rows={5} />
    </div>
  )
}

/**
 * Skeleton specific to Analytics page layout
 */
export function AnalyticsSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="25%" height={28} />
        <Skeleton width="140px" height={36} borderRadius={10} />
      </div>
      {/* Grid of charts placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div style={{ height: '300px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
          <Skeleton width="30%" height={16} style={{ marginBottom: '24px' }} />
          <div style={{ height: '180px', width: '180px', borderRadius: '50%', border: '10px solid var(--bg-secondary)', margin: '0 auto', boxSizing: 'border-box' }} />
        </div>
        <div style={{ height: '300px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
          <Skeleton width="30%" height={16} style={{ marginBottom: '24px' }} />
          <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '12px', justifyContent: 'center' }}>
            <Skeleton width={20} height={120} />
            <Skeleton width={20} height={80} />
            <Skeleton width={20} height={150} />
            <Skeleton width={20} height={60} />
            <Skeleton width={20} height={100} />
          </div>
        </div>
      </div>
      <SkeletonCard rows={4} />
    </div>
  )
}

/**
 * General multi-purpose layout skeleton
 */
export function GeneralSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="30%" height={28} />
        <Skeleton width="100px" height={36} borderRadius={10} />
      </div>
      <SkeletonCard rows={4} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <SkeletonCard rows={3} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  )
}