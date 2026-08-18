import { useState } from 'react'
import { Shield, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { relaunchElevated } from '../../hooks/useTauriEvents'

export function AdminPrompt() {
  const { isElevated } = useStore()
  const [launching, setLaunching] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  async function handleLaunch() {
    setLaunching(true)
    try {
      await relaunchElevated()
    } catch {
      setLaunching(false)
    }
  }

  const show = !isElevated && !dismissed
  if (!show) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4, 8, 14, 0.92)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{
        width: 440, maxWidth: '90vw',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--r5)',
        border: '1px solid var(--border-mid)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '24px 28px 20px',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(0,212,255,0.02))',
          borderBottom: '1px solid var(--border-dim)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}>
            <Shield size={24} color="white" strokeWidth={1.8} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Administrator Privileges Required
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Elevated access needed for system repairs
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px' }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            PCFixAI needs to run with <strong style={{ color: 'var(--text-primary)' }}>administrator privileges</strong> to perform system repairs, diagnostics, and modifications.
          </p>

          <ul style={{
            margin: '14px 0', paddingLeft: 0, listStyle: 'none',
            fontSize: 12, lineHeight: 1.9, color: 'var(--text-secondary)',
          }}>
            {[
              'System file repairs (SFC, DISM) — restores corrupted OS files',
              'Network stack resets (Winsock, TCP/IP) — fixes internet connectivity',
              'Registry modifications — repairs system configuration',
              'Startup program management — optimizes boot time',
              'Driver operations — backup, restore, and diagnostics',
              'Disk health checks and system restore points',
            ].map((item, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0' }}>
                <span style={{ color: 'var(--accent)', fontSize: 10, marginTop: 4 }}>●</span>
                {item}
              </li>
            ))}
          </ul>

          <div style={{
            padding: '10px 14px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.18)',
            borderRadius: 'var(--r2)',
            fontSize: 11, color: '#fbbf24', lineHeight: 1.5,
          }}>
            Windows will display a UAC prompt. Accept it for PCFixAI to function fully.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 28px',
          borderTop: '1px solid var(--border-dim)',
        }}>
          <button
            onClick={handleLaunch}
            disabled={launching}
            style={{
              padding: '10px 28px',
              background: launching
                ? 'rgba(0,212,255,0.2)'
                : 'linear-gradient(135deg, #00d4ff, #0088cc)',
              border: 'none', borderRadius: 'var(--r2)',
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: launching ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: launching
                ? 'none'
                : '0 2px 12px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
              transition: 'all 150ms ease',
              letterSpacing: '0.02em',
            }}
          >
            {launching && <Loader2 size={14} className="spin" />}
            {launching ? 'Launching...' : 'Launch as Administrator'}
          </button>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{
          marginTop: 20, background: 'none', border: 'none',
          color: 'var(--text-muted)', fontSize: 12,
          cursor: 'pointer', textDecoration: 'underline',
          padding: '8px 16px', transition: 'color 150ms',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        Continue without admin access (limited features)
      </button>
    </div>
  )
}
