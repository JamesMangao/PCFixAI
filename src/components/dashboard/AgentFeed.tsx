import { motion } from 'framer-motion'
import { AgentStep } from '../../store'

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--accent)',
  escalating: 'var(--warning)',
  done: 'var(--success)',
  failed: 'var(--danger)',
}

interface AgentFeedProps {
  steps: AgentStep[]
}

export function AgentFeed({ steps }: AgentFeedProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 560,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r3)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-dim)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Agent Feed
      </div>

      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '8px 0' }}>
        {steps.map((step, i) => (
          <motion.div
            key={`${step.timestamp}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              gap: 12,
              padding: '8px 16px',
              borderBottom: i < steps.length - 1 ? '1px solid var(--border-dim)' : 'none',
            }}
          >
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: STATUS_COLOR[step.status] ?? 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              flexShrink: 0,
              minWidth: 72,
              paddingTop: 2,
            }}>
              {step.status}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {step.stepName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {step.message}
              </div>
            </div>
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}>
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
