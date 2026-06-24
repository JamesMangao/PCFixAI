import { useStore } from '../../store'
import { History, CheckCircle, XCircle, Clock, RotateCcw, Activity, Zap, Trash2 } from 'lucide-react'

export function HistoryView() {
  const { jobs, clearJobs } = useStore()

  const totalJobs = jobs.length
  const successCount = jobs.filter(j => j.status === 'success').length
  const failedCount = jobs.filter(j => j.status === 'failed').length
  const successRate = totalJobs > 0 ? Math.round((successCount / totalJobs) * 100) : 0

  const summaryCards = [
    { label: 'Total Operations', value: totalJobs, icon: Activity, color: 'var(--accent)' },
    { label: 'Successful', value: successCount, icon: CheckCircle, color: 'var(--success)' },
    { label: 'Failed', value: failedCount, icon: XCircle, color: 'var(--danger)' },
    { label: 'Success Rate', value: totalJobs > 0 ? `${successRate}%` : '—', icon: Zap, color: successRate >= 80 ? 'var(--success)' : 'var(--warning)' },
  ]

  return (
    <div style={{
      width: '100%', maxWidth: 1000, margin: '0 auto', padding: 'var(--s8)',
      display: 'flex', flexDirection: 'column', gap: 'var(--s5)', height: '100%', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={24} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, margin: 0, fontWeight: 600 }}>Operation History</h1>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Log of all diagnostic scans and system fixes</span>
          </div>
        </div>
        {totalJobs > 0 && (
          <button
            onClick={() => { if (window.confirm('Clear all operation history? This cannot be undone.')) clearJobs() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s2)',
              padding: '8px 16px', background: 'transparent',
              border: '1px solid var(--danger)', borderRadius: 'var(--r2)',
              color: 'var(--danger)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,82,82,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={14} />
            Clear History
          </button>
        )}
      </div>

      {totalJobs > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s3)',
        }}>
          {summaryCards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r3)',
                padding: 'var(--s4)',
                display: 'flex', flexDirection: 'column', gap: 'var(--s2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Icon size={14} color={card.color} />
                  {card.label}
                </div>
                <span style={{ fontSize: 28, fontWeight: 700, color: card.color, fontFamily: 'var(--font-mono)' }}>
                  {card.value}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
        {totalJobs === 0 ? (
          <div style={{ padding: 'var(--s8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.5, marginBottom: 'var(--s4)' }} />
            <p>No operations recorded yet.</p>
            <p style={{ fontSize: 12, marginTop: 'var(--s2)' }}>Run a scan on the Diagnose page to see results here.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)', background: 'var(--bg-surface)' }}>
                <th style={{ padding: 'var(--s3) var(--s4)', fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>Action</th>
                <th style={{ padding: 'var(--s3) var(--s4)', fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>Category</th>
                <th style={{ padding: 'var(--s3) var(--s4)', fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>Status</th>
                <th style={{ padding: 'var(--s3) var(--s4)', fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td style={{ padding: 'var(--s3) var(--s4)', fontSize: 14 }}>{job.action}</td>
                  <td style={{ padding: 'var(--s3) var(--s4)', fontSize: 14 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-surface)', fontSize: 12 }}>{job.category}</span>
                  </td>
                  <td style={{ padding: 'var(--s3) var(--s4)', fontSize: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                      {job.status === 'success' && <CheckCircle size={16} color="var(--success)" />}
                      {job.status === 'failed' && <XCircle size={16} color="var(--danger)" />}
                      {job.status === 'running' && <RotateCcw size={16} color="var(--accent)" className="spin" />}
                      {job.status === 'pending' && <Clock size={16} color="var(--warning)" />}
                      <span style={{ textTransform: 'capitalize', color: 
                        job.status === 'success' ? 'var(--success)' : 
                        job.status === 'failed' ? 'var(--danger)' : 
                        'var(--text-primary)'
                      }}>{job.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--s3) var(--s4)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(job.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
