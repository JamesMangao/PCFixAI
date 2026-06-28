import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { useStore } from '../../store'
import { startScan, getRealMetrics, runRawCommand } from '../../hooks/useTauriEvents'
import { FindingsList } from './FindingsList'
import { AgentFeed } from './AgentFeed'
import { Activity, Shield, HardDrive, Wifi, Zap, ChevronRight } from 'lucide-react'
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
  if (total === 0) return { score: 100, label: 'Healthy', color: 'var(--success)', description: 'No issues detected. Your system is in good shape.' }
  const score = Math.max(0, 100 - critical * 25 - total * 5)
  if (score >= 80) return { score, label: 'Good', color: 'var(--success)', description: `${critical} critical issues found. Some attention needed.` }
  if (score >= 50) return { score, label: 'Fair', color: 'var(--warning)', description: `${critical} critical issues need attention.` }
  return { score, label: 'Poor', color: 'var(--danger)', description: `${critical} critical issues require immediate action.` }
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
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
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Dashboard',
        action: label,
        status,
        output: [statusMsg],
        exitCode: code,
      }
      useStore.getState().updateJob(job)
    } catch {
      setActionStatus(prev => ({ ...prev, [label]: '❌ Failed' }))
      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Dashboard',
        action: label,
        status: 'failed',
        output: ['❌ Command failed to execute'],
        exitCode: 1,
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
            cpu: Math.round(m.cpu),
            ram: Math.round(m.ram),
            disk: Math.round(m.disk),
            network: Math.round(m.network),
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
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Scan',
        action: 'Dashboard System Scan',
        status: 'success',
        output: [summary],
        exitCode: 0,
      }
      useStore.getState().updateJob(job)
    } catch {
      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Scan',
        action: 'Dashboard System Scan',
        status: 'failed',
        output: ['❌ Scan failed'],
        exitCode: 1,
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
      variants={stagger}
      initial="hidden"
      animate="show"
      style={{
        height: '100%',
        padding: 'var(--s5) var(--s8)',
        display: 'flex', flexDirection: 'column', gap: 'var(--s5)',
      }}
    >
      {/* Health Header */}
      <motion.div variants={fadeUp} style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s5)',
        background: `linear-gradient(135deg, var(--bg-surface) 0%, ${health.color}08 100%)`,
        border: `1px solid ${health.color}33`,
        borderRadius: 'var(--r4)',
        padding: 'var(--s5) var(--s6)',
        boxShadow: `0 4px 24px ${health.color}10`,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `2px solid ${health.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          background: `linear-gradient(135deg, ${health.color}15, ${health.color}05)`,
          boxShadow: `0 0 20px ${health.color}20`,
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
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleScan}
          disabled={isScanning || isRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: isScanning || isRunning ? 'var(--accent-dim)' : 'linear-gradient(135deg, #00d4ff, #0099cc)',
            border: 'none',
            borderRadius: 'var(--r2)',
            color: isScanning || isRunning ? 'var(--accent)' : 'white',
            fontSize: 13, fontWeight: 600,
            cursor: isScanning || isRunning ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'all var(--transition-fast)',
            boxShadow: isScanning || isRunning ? 'none' : '0 2px 12px rgba(0,212,255,0.3)',
          }}
        >
          <Activity size={16} />
          {isScanning || isRunning ? 'Scanning…' : 'Scan System'}
        </motion.button>
      </motion.div>

      {/* Metrics Row */}
      <motion.div variants={fadeUp} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--s4)',
      }}>
        <MetricCardSmall label="CPU Usage" metricKey="cpu" color="#00d4ff" unit="%" />
        <MetricCardSmall label="RAM Usage" metricKey="ram" color="#00e676" unit="%" />
        <MetricCardSmall label="Disk I/O" metricKey="disk" color="#ffab40" unit="%" />
        <MetricCardSmall label="Network" metricKey="network" color="#7986cb" unit="%" />
      </motion.div>

      {/* Scan Results / Findings */}
      {agentSteps.length > 0 && <AgentFeed steps={agentSteps} />}

      {findings.length > 0 && !isRunning && (
        <motion.div variants={fadeUp} style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--r4)',
          padding: 'var(--s4)',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s3)' }}>
            Scan Findings
          </h3>
          <FindingsList findings={findings} />
        </motion.div>
      )}

      {restorePointCreated && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
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
      <motion.div variants={fadeUp} style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r4)',
        padding: 'var(--s4)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s3)' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Temp File Cleanup', desc: 'Remove temporary and system cache files', icon: HardDrive, color: '#ffab40',
              command: 'powershell', args: ['-NonInteractive', '-NoProfile', '-Command', 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Done"'] },
            { label: 'DNS Flush', desc: 'Flush DNS resolver cache to fix connectivity', icon: Wifi, color: '#00d4ff',
              command: 'ipconfig', args: ['/flushdns'] },
            { label: 'Browser Cache Sweep', desc: 'Clear Chrome, Firefox, Edge browser caches', icon: Zap, color: '#7986cb',
              command: 'powershell', args: ['-NonInteractive', '-NoProfile', '-Command', "@('Chrome','Firefox','Edge','Brave') | ForEach-Object { $p = \"$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache\"; if (Test-Path $p) { Remove-Item \"$p\\*\" -Recurse -Force -EA SilentlyContinue } }; Write-Output 'Done'"] },
          ].map((action) => {
            const Icon = action.icon
            const isActive = runningAction === action.label
            const status = actionStatus[action.label]
            return (
              <div key={action.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                border: `1px solid ${status?.startsWith('✅') ? 'rgba(0,230,118,0.3)' : status?.startsWith('❌') ? 'rgba(255,82,82,0.3)' : 'var(--border-dim)'}`,
                borderRadius: 'var(--r2)',
                transition: 'all var(--transition-fast)',
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
                    {status || action.desc}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleQuickAction(action.label, action.command, action.args)}
                  disabled={isActive}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px',
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
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
      </motion.div>
    </motion.div>
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
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ y: hovered ? -3 : 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r3)',
        padding: 'var(--s4)',
        cursor: 'default',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
          {current}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 64 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`dash-grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="t" hide />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#dash-grad-${metricKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

function PredictionCard({ label, detail, status }: {
  label: string
  detail: string
  status: 'good' | 'warning' | 'danger'
}) {
  const [hovered, setHovered] = useState(false)
  const statusColor = status === 'good' ? 'var(--success)' : status === 'warning' ? 'var(--warning)' : 'var(--danger)'
  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ y: hovered ? -2 : 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${statusColor}22`,
        borderRadius: 'var(--r2)',
        padding: 'var(--s3) var(--s4)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        transition: 'box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`,
          animation: status === 'danger' ? 'glow-pulse 2s ease-in-out infinite' : status === 'warning' ? 'pulse 3s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{detail}</p>
    </motion.div>
  )
}
