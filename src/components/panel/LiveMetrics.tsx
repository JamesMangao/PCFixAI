import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../../store'

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

export function LiveMetrics() {
  const { setMetrics } = useStore()

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.round(20 + Math.random() * 60),
        ram: Math.round(40 + Math.random() * 40),
        disk: Math.round(10 + Math.random() * 30),
        network: Math.round(Math.random() * 80),
      })
    }, 1200)
    return () => clearInterval(interval)
  }, [setMetrics])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--s4)',
      height: '100%',
      overflowY: 'auto',
    }}>
      <MetricCard label="CPU Usage" metricKey="cpu" color="#00d4ff" unit="%" />
      <MetricCard label="RAM Usage" metricKey="ram" color="#00e676" unit="%" />
      <MetricCard label="Disk I/O" metricKey="disk" color="#ffab40" unit="%" />
      <MetricCard label="Network" metricKey="network" color="#7986cb" unit="%" />
    </div>
  )
}

function MetricCard({ label, metricKey, color, unit }: {
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
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 600, color, fontFamily: 'var(--font-mono)',
          textShadow: `0 0 12px ${color}` }}>
          {current}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="t" hide />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${color}44`,
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
              formatter={(v: number) => [`${v}${unit}`, label]}
              labelFormatter={() => ''}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${metricKey})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
