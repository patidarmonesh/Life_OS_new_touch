import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMetric } from '../domain/metrics/index.js'

function metricValue(metric, value = metric.value) {
  if (value === null || value === undefined) return 'Unknown'
  if (metric.unit === 'currency') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: metric.currency || 'INR' }).format(value)
  return formatMetric({ value, status: metric.status, unit: metric.unit === 'minor-units' ? `minor:${metric.currency || 'INR'}` : metric.unit })
}
export default function SharedReport({ payload }) {
  if (!payload) return null
  return <section aria-label="Report snapshot">
    <header><h2>{payload.title || 'Your report'}</h2><p>{payload.range?.start} – {payload.range?.end} · {payload.timezone}</p><p>Static snapshot · source revision {payload.sourceRevision} · metrics {payload.metricVersion}</p><p>Generated {payload.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-IN', { timeZone: payload.timezone }) : 'for preview'}. Later edits do not change this snapshot.</p></header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 16 }}>
      {(payload.metrics || []).map(metric => <article className="area-card" key={metric.id} style={{ padding: 20, minWidth: 0 }}>
        <h3>{metric.label}</h3><p style={{ fontSize: '1.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{metricValue(metric)}</p>
        <p>{metric.status?.replaceAll('-', ' ')}{metric.sampleCount != null ? ` · ${metric.sampleCount} observations` : ''}</p>
        {metric.goal != null && <p>Goal: {metricValue(metric, metric.goal)}</p>}
        {metric.coverage != null && <p>Coverage: {Number((metric.coverage * 100).toFixed(1))}%</p>}
        {metric.conflictingMinutes > 0 && <p>Unresolved overlap: {metric.conflictingMinutes}m</p>}
        {metric.series?.some(point => point.value != null) && <div style={{ height: 190, minWidth: 0 }} aria-label={`${metric.label} over ${payload.range.start} through ${payload.range.end}. Daily values follow.`}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height: 190 }}><LineChart data={metric.series} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
            <XAxis dataKey="date" minTickGap={24} tickFormatter={date => date.slice(5)} />
            <YAxis width={56} tickFormatter={value => metric.unit === 'minor-units' ? String(value / (['JPY','KRW'].includes(metric.currency) ? 1 : 100)) : String(value)} />
            <Tooltip formatter={(value, name) => [metricValue(metric, value), name]} contentStyle={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
            <Line type="linear" dataKey="value" name={metric.label} stroke="var(--accent-indigo)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            {metric.id === 'study' && <Line type="stepAfter" dataKey="goal" name="Daily goal" stroke="var(--accent-blue)" strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />}
          </LineChart></ResponsiveContainer>
        </div>}
        {!!metric.series?.length && <details><summary>Daily values and goals</summary><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Date</th><th>Value</th><th>Goal</th><th>Evidence</th></tr></thead><tbody>{metric.series.map((point, index) => <tr key={`${point.date}-${index}`}><td>{point.date}</td><td>{metricValue(metric, point.value)}</td><td>{metricValue(metric, point.goal)}</td><td>{point.status || 'incomplete'}</td></tr>)}</tbody></table></div></details>}
      </article>)}
    </div>
    {!payload.metrics?.length && <p>No metrics selected.</p>}
  </section>
}

