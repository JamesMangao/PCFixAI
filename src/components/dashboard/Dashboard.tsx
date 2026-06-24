import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { useStore } from '../../store'
import { startScan, getRealMetrics } from '../../hooks/useTauriEvents'
import { FindingsList } from './FindingsList'
import { AgentFeed } from './AgentFeed'
import { Activity, Shield, HardDrive, Wifi, Zap, ChevronRight } from 'lucide-react'

function useMetricHistory(key: 'cpu' | 'ram' | 'disk' | 'network') {
  const [history, setHistory] = useState<Array<{ t: number; v: number }>>([])
  const { metrics } = useStore()
  useEffect(() => {
    setHistory((h) => {
      const next = [...h, { t: Date.now(), v: metrics[key] }]
      return next.slice(-60)
    })
  }, [metrics[key], key])
  return history
}

function getHealthScore(): { score: number; label: string; color: string; description: string } {
  const { findings } = useStore.getState()
  const critical = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length
  const total = findings.length
  if (total === 0) return { score: 100, label: 'Healthy', color: 'var(--success)', description: 'No issues detected. Your system is in good shape.' }
  const score = Math.max(0, 100 - critical * 25 - total * 5)
  if (score >= 80) return { score, label: 'Good', color: 'var(--success)', description: `${critical} critical issues found. Some attention needed.` }
  if (score >= 50) return { score, label: 'Fair', color: 'var(--warning)', description: `${critical} critical issues need attention.` }
  return { score, label: 'Poor', color: 'var(--danger)', description: `${critical} critical issues require immediate action.` }
}

export function Dashboard() {
  const {
    scanPhase, findings, restorePointCreated, agentSteps,
    metrics, setMetrics, jobs
  } = useStore()

  const [isScanning, setIsScanning] = useState(false)
  const isRunning = scanPhase.phase === 'scanning' || scanPhase.phase === 'starting'

  useEffect(() => {
    let mounted = true
    const fetchMetrics = async () => {
      try {
        const m = await getRealMetrics()
        if (mounted) {
          setMetrics({
            cpu: Math.round(m.cpu),
            ram: Math.round(m.ram),
            disk: Math.round(m.disk),
            network: Math.round(m.network),
          })
        }
      } catch {
        // Backend unavailable — keep current values
      }
    }
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => { mounted = false; clearInterval(interval) }
  }, [setMetrics])

  async function handleScan() {
    setIsScanning(true)
    try {
      await startScan()
    } finally {
      setIsScanning(false)
    }
  }

  const health = getHealthScore()
  const scanJobs = jobs.filter(j => j.category === 'scan' || j.action?.toLowerCase().includes('scan'))
  const lastScan = scanJobs.length > 0
    ? new Date(scanJobs[scanJobs.length - 1].timestamp).toLocaleTimeString()
    : null

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: 'var(--s5) var(--s8)',
      display: 'flex', flexDirection: 'column', gap: 'var(--s5)',
    }}>
      {/* Health Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s5)',
        background: 'var(--bg-surface)',
        border: `1px solid ${health.color}33`,
        borderRadius: 'var(--r3)',
        padding: 'var(--s5) var(--s6)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `2px solid ${health.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: `${health.color}11`,
        }}>
          <Shield size={28} color={health.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: health.color }}>
              {health.label}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Score: {health.score}/100
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {health.description}
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}</span> critical
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{findings.filter(f => f.severity === 'medium').length}</span> medium
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{findings.filter(f => f.fixAvailable).length}</span> auto-fixable
            </div>
            {lastScan && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Last scan: {lastScan}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning || isRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: isScanning || isRunning ? 'var(--accent-dim)' : 'transparent',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r2)',
            color: 'var(--accent)',
            fontSize: 13, fontWeight: 600,
            cursor: isScanning || isRunning ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          <Activity size={16} />
          {isScanning || isRunning ? 'Scanning…' : 'Scan System'}
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--s4)',
      }}>
        <MetricCardSmall label="CPU Usage" metricKey="cpu" color="#00d4ff" unit="%" />
        <MetricCardSmall label="RAM Usage" metricKey="ram" color="#00e676" unit="%" />
        <MetricCardSmall label="Disk I/O" metricKey="disk" color="#ffab40" unit="%" />
        <MetricCardSmall label="Network" metricKey="network" color="#7986cb" unit="%" />
      </div>

      {/* Scan Results / Findings */}
      {agentSteps.length > 0 && <AgentFeed steps={agentSteps} />}

      {findings.length > 0 && !isRunning && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--r3)',
          padding: 'var(--s4)',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s3)' }}>
            Scan Findings
          </h3>
          <FindingsList findings={findings} />
        </div>
      )}

      {restorePointCreated && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px',
            background: 'rgba(0,230,118,0.07)',
            border: '1px solid rgba(0,230,118,0.3)',
            borderRadius: 'var(--r2)',
            fontSize: 12,
            color: 'var(--success)',
          }}>
          <span>✓</span>
          <span>Restore point created — all changes are reversible.</span>
        </motion.div>
      )}

      {/* Quick Automations */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r3)',
        padding: 'var(--s4)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s3)' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Temp File Cleanup', desc: 'Remove temporary and system cache files', icon: HardDrive, color: '#ffab40' },
            { label: 'DNS Flush', desc: 'Flush DNS resolver cache to fix connectivity', icon: Wifi, color: '#00d4ff' },
            { label: 'Browser Cache Sweep', desc: 'Clear Chrome, Firefox, Edge browser caches', icon: Zap, color: '#7986cb' },
          ].map((action) => {
            const Icon = action.icon
            return (
              <div key={action.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: `${action.color}11`,
                  border: `1px solid ${action.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={action.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {action.label}
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {action.desc}
                  </p>
                </div>
                <button
                  onClick={() => {}}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: 'transparent',
                    border: '1px solid var(--border-mid)',
                    borderRadius: 'var(--r1)',
                    color: 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Run <ChevronRight size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Predictions */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r3)',
        padding: 'var(--s4)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s3)' }}>
          AI Predictions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s3)' }}>
          <PredictionCard
            label="CPU Trend"
            detail={`${metrics.cpu}% current — ${metrics.cpu > 70 ? 'High load detected' : 'Normal operation'}`}
            status={metrics.cpu > 70 ? 'warning' : 'good'}
          />
          <PredictionCard
            label="Disk Health"
            detail={`${metrics.disk}% active — ${metrics.disk > 50 ? 'High I/O may slow system' : 'Healthy throughput'}`}
            status={metrics.disk > 50 ? 'warning' : 'good'}
          />
          <PredictionCard
            label="System Stability"
            detail={findings.filter(f => f.severity === 'critical').length > 0
              ? `${findings.filter(f => f.severity === 'critical').length} critical issues detected`
              : 'No critical issues — system is stable'}
            status={findings.filter(f => f.severity === 'critical').length > 0 ? 'danger' : 'good'}
          />
        </div>
      </div>
    </div>
  )
}

function MetricCardSmall({ label, metricKey, color, unit }: {
  label: string
  metricKey: 'cpu' | 'ram' | 'disk' | 'network'
  color: string
  unit: string
}) {
  const history = useMetricHistory(metricKey)
  const { metrics } = useStore()
  const current = metrics[metricKey]

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r3)',
      padding: 'var(--s4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
          {current}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`dash-grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="t" hide />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#dash-grad-${metricKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function PredictionCard({ label, detail, status }: {
  label: string
  detail: string
  status: 'good' | 'warning' | 'danger'
}) {
  const statusColor = status === 'good' ? 'var(--success)' : status === 'warning' ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${statusColor}22`,
      borderRadius: 'var(--r2)',
      padding: 'var(--s3) var(--s4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{detail}</p>
    </div>
  )
}
