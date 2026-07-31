import { useState } from 'react'
import { Finding, useStore, JobEntry } from '../../store'
import { executeFix, relaunchElevated } from '../../hooks/useTauriEvents'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

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
  const [fixResult, setFixResult] = useState<Record<string, { ok: boolean; msg: string; output?: string }>>({})
  const grouped = groupBySeverity(findings)

  async function handleFix(finding: Finding) {
    const { isElevated } = useStore.getState()

    if (!isElevated) {
      const confirmed = window.confirm(
        `Disabling startup items requires administrator privileges.\n\n` +
        `Click OK to relaunch PCFixAI as administrator (findings will be preserved), ` +
        `or Cancel to skip this fix.`
      )
      if (confirmed) {
        await relaunchElevated()
      }
      return
    }

    setFixingId(finding.id)
    setFixResult((prev) => {
      const next = { ...prev }
      delete next[finding.id]
      return next
    })

    const store = useStore.getState()
    store.setActiveTask({ name: `Fixing: ${finding.title}`, status: 'running' })

    try {
      const { success, output } = await executeFix(finding.category, finding.title)
      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Fix',
        action: `Fix: ${finding.title}`,
        status: success ? 'success' : 'failed',
        output: [success ? `Fixed ${finding.category} issue: ${finding.title}` : `Failed to fix: ${finding.title}`],
        exitCode: success ? 0 : 1,
      }
      useStore.getState().updateJob(job)
      if (success) {
        setFixResult((prev) => ({
          ...prev,
          [finding.id]: {
            ok: true, msg: 'Fixed successfully', output: output || undefined,
          },
        }))
        store.setActiveTask({ name: `Fixing: ${finding.title}`, status: 'done' })
        setTimeout(() => store.setActiveTask(null), 2000)
        setTimeout(() => {
          const remaining = useStore.getState().findings.filter((f) => f.id !== finding.id)
          useStore.getState().setFindings(remaining)
        }, 1500)
      } else {
        setFixResult((prev) => ({
          ...prev,
          [finding.id]: {
            ok: false, msg: 'Fix returned failure — try running as administrator', output: output || undefined,
          },
        }))
        store.setActiveTask({ name: `Fixing: ${finding.title}`, status: 'error' })
        setTimeout(() => store.setActiveTask(null), 2000)
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Fix',
        action: `Fix: ${finding.title}`,
        status: 'failed',
        output: [`Error fixing: ${finding.title}`, detail],
        exitCode: 1,
      }
      useStore.getState().updateJob(job)
      setFixResult((prev) => ({ ...prev, [finding.id]: { ok: false, msg: detail || 'Fix failed — check History for details' } }))
      store.setActiveTask({ name: `Fixing: ${finding.title}`, status: 'error' })
      setTimeout(() => store.setActiveTask(null), 2000)
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
          {items.map((f) => {
            const result = fixResult[f.id]
            const isFixing = fixingId === f.id
            return (
              <div key={f.id} style={{
                padding: '12px 16px',
                background: 'var(--bg-surface)',
                border: result
                  ? `1px solid ${result.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,82,82,0.4)'}`
                  : '1px solid var(--border-dim)',
                borderLeft: `3px solid ${SEVERITY_COLOR[f.severity] ?? 'var(--border-mid)'}`,
                borderRadius: 'var(--r2)',
                transition: 'border-color 0.3s',
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
                    {result && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                        padding: '4px 10px',
                        background: result.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)',
                        borderRadius: 'var(--r1)',
                        fontSize: 11, fontWeight: 500,
                        color: result.ok ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {result.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        {result.msg}
                      </div>
                    )}
                    {result?.output && (
                      <pre style={{
                        marginTop: 8, padding: '8px 10px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--r1)',
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        maxHeight: 120, overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {result.output}
                      </pre>
                    )}
                  </div>

                  {f.fixAvailable && !result && (
                    <button
                      onClick={() => handleFix(f)}
                      disabled={isFixing}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px',
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--border-hot)',
                        borderRadius: 'var(--r1)',
                        color: 'var(--accent)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: isFixing ? 'default' : 'pointer',
                        flexShrink: 0,
                        opacity: isFixing ? 0.6 : 1,
                      }}
                    >
                      {isFixing && <Loader2 size={12} className="spin" />}
                      {isFixing ? 'Fixing…' : 'Fix'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}