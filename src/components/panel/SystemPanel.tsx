import { useState } from 'react'
import { LiveMetrics } from './LiveMetrics'
import { ConsoleLog } from './ConsoleLog'
import { AutomationTree } from './AutomationTree'
import { StateLog } from './StateLog'

type PanelTab = 'metrics' | 'terminal' | 'automations' | 'jobs'

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'automations', label: 'Automations' },
  { id: 'jobs', label: 'Job Log' },
]

export function SystemPanel() {
  const [tab, setTab] = useState<PanelTab>('metrics')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 'var(--s4)',
      gap: 'var(--s3)',
    }}>
      <div style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r2)',
        border: '1px solid var(--border-dim)',
        flexShrink: 0,
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r1)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'metrics' && <LiveMetrics />}
        {tab === 'terminal' && <ConsoleLog />}
        {tab === 'automations' && <AutomationTree />}
        {tab === 'jobs' && <StateLog />}
      </div>
    </div>
  )
}
