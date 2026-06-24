import { useStore } from '../../store'

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--text-muted)',
  running: 'var(--accent)',
  success: 'var(--success)',
  failed: 'var(--danger)',
  skipped: 'var(--text-muted)',
  rolled_back: 'var(--warning)',
}

export function StateLog() {
  const { jobs } = useStore()

  if (jobs.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        No jobs yet. Run a scan or automation to populate the log.
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r3)',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
            {['Time', 'Category', 'Action', 'Status', 'Exit'].map((h) => (
              <th key={h} style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                position: 'sticky',
                top: 0,
                background: 'var(--bg-elevated)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <td style={{ padding: '8px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(job.timestamp).toLocaleTimeString()}
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                {job.category}
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>
                {job.action}
              </td>
              <td style={{
                padding: '8px 14px',
                color: STATUS_COLOR[job.status] ?? 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: 10,
              }}>
                {job.status}
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>
                {job.exitCode ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
