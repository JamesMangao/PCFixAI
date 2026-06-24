import { useState } from 'react'
import { Finding } from '../../store'
import { executeFix } from '../../hooks/useTauriEvents'

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--danger)',
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--accent)',
  info: 'var(--text-muted)',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const

interface FindingsListProps {
  findings: Finding[]
}

function groupBySeverity(findings: Finding[]): [string, Finding[]][] {
  const groups: Record<string, Finding[]> = {}
  for (const f of findings) {
    if (!groups[f.severity]) groups[f.severity] = []
    groups[f.severity].push(f)
  }
  const result: [string, Finding[]][] = []
  for (const s of SEVERITY_ORDER) {
    if (groups[s]?.length) result.push([s, groups[s]])
  }
  return result
}

export function FindingsList({ findings }: FindingsListProps) {
  const [fixingId, setFixingId] = useState<string | null>(null)
  const grouped = groupBySeverity(findings)

  async function handleFix(finding: Finding) {
    setFixingId(finding.id)
    try {
      await executeFix(finding.category, finding.title)
    } finally {
      setFixingId(null)
    }
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: 560,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        Findings ({findings.length})
      </p>

      {grouped.map(([severity, items]) => (
        <div key={severity} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px',
            marginBottom: 2,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: SEVERITY_COLOR[severity] ?? 'var(--text-muted)',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: SEVERITY_COLOR[severity] ?? 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {severity} ({items.length})
            </span>
          </div>
          {items.map((f) => (
            <div key={f.id} style={{
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderLeft: `3px solid ${SEVERITY_COLOR[f.severity] ?? 'var(--border-mid)'}`,
              borderRadius: 'var(--r2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.category}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {f.title}
                  </div>
                  {f.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                      {f.description}
                    </p>
                  )}
                </div>

                {f.fixAvailable && (
                  <button
                    onClick={() => handleFix(f)}
                    disabled={fixingId === f.id}
                    style={{
                      padding: '4px 12px',
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--border-hot)',
                      borderRadius: 'var(--r1)',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                      opacity: fixingId === f.id ? 0.6 : 1,
                    }}
                  >
                    {fixingId === f.id ? '…' : 'Fix'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
