import { useStore } from '../../store'
import { History, CheckCircle, XCircle, Clock, RotateCcw, Activity, Zap, Trash2 } from 'lucide-react'

export function HistoryView() {
  const { jobs, clearJobs } = useStore()

  const totalJobs = jobs.length
  const successCount = jobs.filter(j => j.status === 'success').length
  const failedCount = jobs.filter(j => j.status === 'failed').length
  const successRate = totalJobs > 0 ? Math.round((successCount / totalJobs) * 100) : 0

  const summaryCards = [
    { label: 'Total Operations', value: totalJobs, icon: Activity, color: '#00d4ff' },
    { label: 'Successful', value: successCount, icon: CheckCircle, color: '#34d399' },
    { label: 'Failed', value: failedCount, icon: XCircle, color: '#f87171' },
    { label: 'Success Rate', value: totalJobs > 0 ? `${successRate}%` : '—', icon: Zap, color: successRate >= 80 ? '#34d399' : '#fbbf24' },
  ]

  return (
    <div style={{
      width: '100%', maxWidth: 1000, margin: '0 auto', padding: 32,
      display: 'flex', flexDirection: 'column', gap: 20, height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.04))',
            border: '1px solid rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <History size={22} color="#00d4ff" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{
              fontSize: 22, margin: 0, fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff, #c0d0e4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Operation History
            </h1>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Log of all diagnostic scans and system fixes
            </span>
          </div>
        </div>
        {totalJobs > 0 && (
          <button
            onClick={() => { if (window.confirm('Clear all operation history? This cannot be undone.')) clearJobs() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', background: 'transparent',
              border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--r2)',
              color: '#f87171', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} /> Clear History
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {totalJobs > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {summaryCards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r3)',
                padding: 16,
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: 'var(--shadow-xs)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  <Icon size={13} color={card.color} strokeWidth={1.8} />
                  {card.label}
                </div>
                <span style={{
                  fontSize: 28, fontWeight: 700, color: card.color,
                  fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em',
                }}>
                  {card.value}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-mid)',
        borderRadius: 'var(--r3)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xs)',
      }}>
        {totalJobs === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.3, marginBottom: 16 }} strokeWidth={1.5} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>No operations recorded yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Run a scan to see results here.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                {['Action', 'Category', 'Status', 'Timestamp'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', fontWeight: 600, color: 'var(--text-muted)',
                    fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)' }}>{job.action}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 'var(--r-full)',
                      background: 'rgba(255,255,255,0.04)', fontSize: 11,
                      color: 'var(--text-secondary)',
                    }}>
                      {job.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {job.status === 'success' && <CheckCircle size={14} color="#34d399" strokeWidth={2} />}
                      {job.status === 'failed' && <XCircle size={14} color="#f87171" strokeWidth={2} />}
                      {job.status === 'running' && <RotateCcw size={14} color="var(--accent)" className="spin" />}
                      {job.status === 'pending' && <Clock size={14} color="#fbbf24" strokeWidth={1.8} />}
                      <span style={{
                        textTransform: 'capitalize',
                        color: job.status === 'success' ? '#34d399'
                          : job.status === 'failed' ? '#f87171'
                          : 'var(--text-primary)',
                        fontWeight: 500,
                      }}>
                        {job.status}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
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
