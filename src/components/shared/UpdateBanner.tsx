import { useState } from 'react'
import { X, Sparkles, Loader2, Download } from 'lucide-react'
import { useStore } from '../../store'
import { installUpdate, skipUpdate, dismissUpdaterBanner } from '../../hooks/useUpdater'

export function UpdateBanner() {
  const { updater } = useStore()
  const [expanded, setExpanded] = useState(false)

  if (updater.status === 'available') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', padding: '8px 16px',
        background: 'rgba(52,211,153,0.05)',
        borderBottom: '1px solid rgba(52,211,153,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Sparkles size={13} style={{ color: '#34d399', flexShrink: 0 }} strokeWidth={1.8} />
            <span style={{ fontSize: 11, color: '#34d399', fontWeight: 500 }}>
              PCFixAI {updater.version} available (you have {updater.currentVersion})
            </span>
            {updater.body && (
              <button onClick={() => setExpanded(v => !v)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10,
                textDecoration: 'underline', cursor: 'pointer', flexShrink: 0,
              }}>
                {expanded ? 'Hide' : "What's new"}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={installUpdate} style={{
              padding: '4px 12px', background: 'rgba(52,211,153,0.1)',
              border: '1px solid rgba(52,211,153,0.25)', borderRadius: 'var(--r1)',
              color: '#34d399', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Download size={11} /> Update
            </button>
            <button onClick={() => skipUpdate(updater.version ?? '')} style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--border-mid)', borderRadius: 'var(--r1)',
              color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>
              Later
            </button>
            <button onClick={dismissUpdaterBanner} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 2,
            }}>
              <X size={13} />
            </button>
          </div>
        </div>
        {expanded && (
          <div style={{
            marginTop: 8, padding: '8px 12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-dim)', borderRadius: 'var(--r2)',
            fontSize: 11, color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap', maxHeight: 140, overflowY: 'auto',
          }}>
            {updater.body}
          </div>
        )}
      </div>
    )
  }

  if (updater.status === 'downloading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '7px 16px 0',
        background: 'rgba(0,212,255,0.04)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={13} className="spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
            Downloading PCFixAI {updater.version}... {updater.progress}%
          </span>
        </div>
        <div className="progress-bar-track" style={{ marginTop: 6, marginBottom: 4 }}>
          <div style={{
            height: '100%', width: `${updater.progress}%`,
            background: 'linear-gradient(90deg, var(--accent), #34d399)',
            borderRadius: 2, transition: 'width 0.2s ease',
          }} />
        </div>
      </div>
    )
  }

  if (updater.status === 'ready_to_restart') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 16px',
        background: 'rgba(0,212,255,0.04)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        flexShrink: 0,
      }}>
        <Loader2 size={13} className="spin" style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Update installed. Restarting...</span>
      </div>
    )
  }

  return null
}
