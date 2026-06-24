import { useState } from 'react'
import { executeFix } from '../../hooks/useTauriEvents'

interface AutomationDef {
  id: string
  category: string
  label: string
  description: string
  risk: 'low' | 'medium' | 'high'
  enabled: boolean
}

const DEFAULT_AUTOMATIONS: AutomationDef[] = [
  { id: 'dns-flush',       category: 'Network',     label: 'DNS Flush',               description: 'ipconfig /flushdns — clears DNS resolver cache.',                  risk: 'low',    enabled: true  },
  { id: 'tcp-reset',       category: 'Network',     label: 'TCP/IP Stack Reset',      description: 'netsh int ip reset — resets the TCP/IP stack.',                    risk: 'medium', enabled: false },
  { id: 'winsock-reset',   category: 'Network',     label: 'Winsock Reset',           description: 'netsh winsock reset — repairs Windows Socket failures.',           risk: 'medium', enabled: false },
  { id: 'temp-clean',      category: 'Performance', label: 'Temp File Cleanup',       description: 'Removes %TEMP% and system temp directories.',                      risk: 'low',    enabled: true  },
  { id: 'startup-audit',   category: 'Performance', label: 'Startup Program Audit',   description: 'Lists & optionally disables high-impact startup entries.',         risk: 'low',    enabled: true  },
  { id: 'browser-cache',   category: 'Security',    label: 'Browser Cache Sweep',     description: 'Clears Chrome, Firefox, Edge, Brave caches.',                     risk: 'low',    enabled: true  },
  { id: 'sfc-scan',        category: 'OS',          label: 'System File Check (SFC)', description: 'sfc /scannow — validates and repairs protected Windows files.',    risk: 'low',    enabled: true  },
  { id: 'dism-repair',     category: 'OS',          label: 'DISM Component Repair',   description: 'DISM /RestoreHealth — fixes Windows component store corruption.',  risk: 'medium', enabled: false },
  { id: 'registry-backup', category: 'OS',          label: 'Registry Backup',         description: 'Exports current registry state before deep modifications.',        risk: 'low',    enabled: true  },
]

const RISK_COLOR = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--danger)' }
const CATEGORY_ORDER = ['Network', 'Performance', 'OS', 'Security']

export function AutomationTree() {
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS)
  const [running, setRunning] = useState<string | null>(null)

  function toggle(id: string) {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  async function run(a: AutomationDef) {
    if (!a.enabled) return
    setRunning(a.id)
    try {
      await executeFix(a.category, a.label)
    } finally {
      setRunning(null)
    }
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: automations.filter((a) => a.category === cat),
  }))

  return (
    <div style={{ overflowY: 'auto', height: '100%', paddingRight: 4 }}>
      {grouped.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: 'var(--s5)' }}>
          <p style={{
            fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 'var(--s2)',
          }}>{cat}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((a) => (
              <div key={a.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 14px',
                background: 'var(--bg-surface)',
                border: `1px solid ${a.enabled ? 'var(--border-mid)' : 'var(--border-dim)'}`,
                borderRadius: 'var(--r2)',
                opacity: a.enabled ? 1 : 0.55,
                transition: 'border-color 0.15s, opacity 0.15s',
              }}>
                <Toggle active={a.enabled} onChange={() => toggle(a.id)} />

                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {a.label}
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {a.description}
                  </p>
                </div>

                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: RISK_COLOR[a.risk],
                  padding: '2px 8px',
                  border: `1px solid ${RISK_COLOR[a.risk]}55`,
                  borderRadius: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {a.risk}
                </span>

                <button
                  onClick={() => run(a)}
                  disabled={!a.enabled || running === a.id}
                  style={{
                    padding: '3px 12px',
                    background: running === a.id ? 'var(--accent-dim)' : 'transparent',
                    border: '1px solid var(--border-hot)',
                    borderRadius: 'var(--r1)',
                    color: 'var(--accent)',
                    fontSize: 11, fontWeight: 600,
                    cursor: a.enabled ? 'pointer' : 'not-allowed',
                    fontFamily: 'var(--font-ui)',
                    opacity: a.enabled ? 1 : 0.4,
                    flexShrink: 0,
                  }}>
                  {running === a.id ? '…' : 'Run'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 32, height: 18,
        borderRadius: 9,
        background: active ? 'var(--accent)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-mid)'}`,
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
      }}>
      <span style={{
        position: 'absolute',
        top: 2, left: active ? 15 : 2,
        width: 12, height: 12,
        borderRadius: '50%',
        background: active ? 'var(--bg-void)' : 'var(--text-muted)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}
