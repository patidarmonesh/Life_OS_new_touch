export default function ChartFrame({ title, description, children, rows = [], columns = [] }) {
  return <section className="area-card"><h2>{title}</h2><p className="muted">{description}</p>
    {children && <div className="chart-frame">{children}</div>}
    <details><summary>View chart data</summary><div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.date || i}>{columns.map(c => <td key={c.key}>{row[c.key] ?? 'Not recorded'}</td>)}</tr>)}</tbody></table></div></details>
  </section>
}
