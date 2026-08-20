import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { useStore } from '../../store'
import { startScan, getRealMetrics, runRawCommand, exportSystemReport, saveHealthSnapshot } from '../../hooks/useTauriEvents'
import { FindingsList } from './FindingsList'
import { AgentFeed } from './AgentFeed'
import { Activity, Shield, HardDrive, Wifi, Zap, ChevronRight, FileText } from 'lucide-react'
import { JobEntry } from '../../store'

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
  if (total === 0) return { score: 100, label: 'Healthy', color: '#34d399', description: 'No issues detected. Your system is in good shape.' }
  const score = Math.max(0, 100 - critical * 25 - total * 5)
  if (score >= 80) return { score, label: 'Good', color: '#34d399', description: `${critical} critical issues found. Some attention needed.` }
  if (score >= 50) return { score, label: 'Fair', color: '#fbbf24', description: `${critical} critical issues need attention.` }
  return { score, label: 'Poor', color: '#f87171', description: `${critical} critical issues require immediate action.` }
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

export function Dashboard() {
  const {
    scanPhase, findings, restorePointCreated, agentSteps,
    metrics, setMetrics, jobs
  } = useStore()

  const [isScanning, setIsScanning] = useState(false)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({})
  const isRunning = scanPhase.phase === 'scanning' || scanPhase.phase === 'starting'

  async function handleQuickAction(label: string, command: string, args: string[]) {
    setRunningAction(label)
    setActionStatus(prev => ({ ...prev, [label]: 'Running...' }))
    try {
      const code = await runRawCommand(command, args)
      const status = code === 0 ? 'success' : 'failed'
      const statusMsg = code === 0 ? '✅ Done' : `⚠️ Exit code ${code}`
      setActionStatus(prev => ({ ...prev, [label]: statusMsg }))
      const job: JobEntry = {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        category: 'Dashboard', action: label, status, output: [statusMsg], exitCode: code,
      }
      useStore.getState().updateJob(job)
    } catch {
      setActionStatus(prev => ({ ...prev, [label]: '❌ Failed' }))
      const job: JobEntry = {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        category: 'Dashboard', action: label, status: 'failed',
        output: ['❌ Command failed to execute'], exitCode: 1,
      }
      useStore.getState().updateJob(job)
    } finally {
      setRunningAction(null)
    }
  }

  useEffect(() => {
    let mounted = true
    const fetchMetrics = async () => {
      try {
        const m = await getRealMetrics()
        if (mounted) {
          setMetrics({
            cpu: Math.round(m.cpu), ram: Math.round(m.ram),
            disk: Math.round(m.disk), network: Math.round(m.network),
          })
        }
      } catch {}
    }
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => { mounted = false; clearInterval(interval) }
  }, [setMetrics])

  async function handleScan() {
    setIsScanning(true)
    try {
      const result = await startScan()
      const total = result.findings.length
      const critical = result.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length
      const fixable = result.findings.filter(f => f.fixAvailable).length
      const summary = total === 0
        ? '✅ Scan complete — No issues found'
        : `Scan complete — ${total} issue${total > 1 ? 's' : ''} found (${critical} critical, ${fixable} auto-fixable)`
      const job: JobEntry = {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        category: 'Scan', action: 'Dashboard System Scan', status: 'success',
        output: [summary], exitCode: 0,
      }
      useStore.getState().updateJob(job)

      // Save health snapshot for trend tracking
      const score = getHealthScore().score
      const m = useStore.getState().metrics
      try {
        await saveHealthSnapshot(score, total, JSON.stringify(m))
      } catch {}
    } catch {
      const job: JobEntry = {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        category: 'Scan', action: 'Dashboard System Scan', status: 'failed',
        output: ['❌ Scan failed'], exitCode: 1,
      }
      useStore.getState().updateJob(job)
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
    <motion.div
      variants={stagger} initial="hidden" animate="show"
      style={{
        height: '100%', padding: '24px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}
    >
      {/* Health Header */}
      <motion.div variants={fadeUp} style={{
        display: 'flex', alignItems: 'center', gap: 24,
        background: `linear-gradient(135deg, var(--bg-surface) 0%, ${health.color}06 100%)`,
        border: `1px solid ${health.color}20`,
        borderRadius: 'var(--r4)',
        padding: '20px 28px',
        boxShadow: `0 4px 24px ${health.color}08, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          border: `2px solid ${health.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: `linear-gradient(135deg, ${health.color}12, ${health.color}04)`,
          boxShadow: `0 0 24px ${health.color}15`,
          position: 'relative',
        }}>
          <Shield size={26} color={health.color} strokeWidth={1.8} />
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: `1px solid ${health.color}10`,
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontSize: 22, fontWeight: 700, color: health.color,
              letterSpacing: '-0.01em',
            }}>
              {health.label}
            </span>
            <span style={{
              fontSize: 13, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontWeight: 500,
            }}>
              {health.score}/100
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
            {health.description}
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: '#f87171', fontWeight: 600 }}>{findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}</span> critical
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>{findings.filter(f => f.severity === 'medium').length}</span> medium
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{findings.filter(f => f.fixAvailable).length}</span> fixable
            </div>
            {lastScan && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Last: {lastScan}
              </div>
            )}
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleScan}
          disabled={isScanning || isRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 24px',
            background: isScanning || isRunning
              ? 'rgba(0,212,255,0.08)'
              : 'linear-gradient(135deg, #00d4ff, #0088cc)',
            border: 'none', borderRadius: 'var(--r2)',
            color: isScanning || isRunning ? 'var(--accent)' : 'white',
            fontSize: 13, fontWeight: 600,
            cursor: isScanning || isRunning ? 'default' : 'pointer',
            flexShrink: 0,
            boxShadow: isScanning || isRunning
              ? 'none'
              : '0 2px 12px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all var(--transition-fast)',
            letterSpacing: '0.02em',
          }}
        >
          <Activity size={15} />
          {isScanning || isRunning ? 'Scanning…' : 'Scan System'}
        </motion.button>
      </motion.div>

      {/* Metrics Row */}
      <motion.div variants={fadeUp} style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
      }}>
        <MetricCardSmall label="CPU Usage" metricKey="cpu" color="#00d4ff" unit="%" />
        <MetricCardSmall label="RAM Usage" metricKey="ram" color="#34d399" unit="%" />
        <MetricCardSmall label="Disk I/O" metricKey="disk" color="#fbbf24" unit="%" />
        <MetricCardSmall label="Network" metricKey="network" color="#a78bfa" unit="%" />
      </motion.div>

      {agentSteps.length > 0 && <AgentFeed steps={agentSteps} />}

      {findings.length > 0 && !isRunning && (
        <motion.div variants={fadeUp} style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--r4)',
          padding: 16,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Scan Findings
          </h3>
          <FindingsList findings={findings} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  const path = await exportSystemReport(JSON.stringify(findings))
                  const job: JobEntry = {
                    id: Date.now().toString(), timestamp: new Date().toISOString(),
                    category: 'Report', action: 'Export System Report', status: 'success',
                    output: [`Report saved to: ${path}`], exitCode: 0,
                  }
                  useStore.getState().updateJob(job)
                } catch {}
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: 'transparent',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: 'var(--r2)',
                color: 'var(--accent)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
            >
              <FileText size={13} /> Export Report
            </motion.button>
          </div>
        </motion.div>
      )}

      {restorePointCreated && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          background: 'rgba(52,211,153,0.06)',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 'var(--r2)',
          fontSize: 12, color: '#34d399',
        }}>
          <span>✓</span>
          <span>Restore point created — all changes are reversible.</span>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={fadeUp} style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r4)',
        padding: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Temp File Cleanup', desc: 'Remove temporary and system cache files', icon: HardDrive, color: '#fbbf24',
              command: 'powershell', args: ['-NonInteractive', '-NoProfile', '-Command', 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Done"'] },
            { label: 'DNS Flush', desc: 'Flush DNS resolver cache to fix connectivity', icon: Wifi, color: '#00d4ff',
              command: 'ipconfig', args: ['/flushdns'] },
            { label: 'Browser Cache Sweep', desc: 'Clear Chrome, Firefox, Edge browser caches', icon: Zap, color: '#a78bfa',
              command: 'powershell', args: ['-NonInteractive', '-NoProfile', '-Command', "@('Chrome','Firefox','Edge','Brave') | ForEach-Object { `$p = \"$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache\"; if (Test-Path `$p) { Remove-Item \"$`p\\*\" -Recurse -Force -EA SilentlyContinue } }; Write-Output 'Done'"] },
          ].map((action) => {
            const Icon = action.icon
            const isActive = runningAction === action.label
            const status = actionStatus[action.label]
            return (
              <div key={action.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                border: `1px solid ${status?.startsWith('✅') ? 'rgba(52,211,153,0.2)' : status?.startsWith('❌') ? 'rgba(248,113,113,0.2)' : 'var(--border-dim)'}`,
                borderRadius: 'var(--r2)',
                background: isActive ? 'rgba(0,212,255,0.03)' : 'transparent',
                transition: 'all var(--transition-fast)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${action.color}0D`,
                  border: `1px solid ${action.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={action.color} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {action.label}
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {status || action.desc}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleQuickAction(action.label, action.command, action.args)}
                  disabled={isActive}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 14px',
                    background: isActive ? 'rgba(0,212,255,0.08)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-mid)'}`,
                    borderRadius: 'var(--r1)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600,
                    cursor: isActive ? 'default' : 'pointer',
                    opacity: isActive ? 0.7 : 1,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {isActive ? 'Running...' : 'Run'} <ChevronRight size={12} />
                </motion.button>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* AI Predictions */}
      <motion.div variants={fadeUp} style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r4)',
        padding: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          AI Predictions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
      </motion.div>
    </motion.div>
  )
}

function MetricCardSmall({ label, metricKey, color, unit }: {
  label: string; metricKey: 'cpu' | 'ram' | 'disk' | 'network'; color: string; unit: string
}) {
  const history = useMetricHistory(metricKey)
  const { metrics } = useStore()
  const current = metrics[metricKey]
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      animate={{ y: hovered ? -2 : 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${hovered ? `${color}25` : 'var(--border-dim)'}`,
        borderRadius: 'var(--r3)',
        padding: 16,
        cursor: 'default',
        boxShadow: hovered ? `0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px ${color}10` : 'var(--shadow-xs)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, boxShadow: `0 0 8px ${color}60`,
          opacity: 0.8,
        }} />
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color, fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em', marginBottom: 4,
      }}>
        {current}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
      </div>
      <div style={{ height: 56 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`dash-grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="t" hide />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#dash-grad-${metricKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

function PredictionCard({ label, detail, status }: {
  label: string; detail: string; status: 'good' | 'warning' | 'danger'
}) {
  const [hovered, setHovered] = useState(false)
  const statusColor = status === 'good' ? '#34d399' : status === 'warning' ? '#fbbf24' : '#f87171'
  return (
    <motion.div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      animate={{ y: hovered ? -2 : 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${statusColor}15`,
        borderRadius: 'var(--r2)',
        padding: '12px 16px',
        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
        transition: 'box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}50`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{detail}</p>
    </motion.div>
  )
}
