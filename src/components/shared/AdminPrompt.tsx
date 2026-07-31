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
      background: 'var(--bg-void)',
    }}>
      <div style={{
        width: 440, maxWidth: '90vw',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--r3)',
        border: '1px solid var(--border-mid)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(0,170,255,0.08), rgba(0,212,255,0.04))',
          borderBottom: '1px solid var(--border-dim)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,212,255,0.3)',
            flexShrink: 0,
          }}>
            <Shield size={24} color="white" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Administrator Privileges Required
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              PCFixAI needs elevated access for system repairs
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            This application needs to run with <strong>administrator privileges</strong> to perform system repairs, diagnostics, and modifications.
          </p>

          <ul style={{
            margin: '14px 0', paddingLeft: 20, fontSize: 13,
            lineHeight: 1.9, color: 'var(--text-secondary)',
          }}>
            <li>System file repairs (SFC, DISM) — restores corrupted OS files</li>
            <li>Network stack resets (Winsock, TCP/IP) — fixes internet connectivity</li>
            <li>Registry modifications — repairs system configuration</li>
            <li>Startup program management — optimizes boot time</li>
            <li>Driver operations — backup, restore, and diagnostics</li>
            <li>Disk health checks and system restore points</li>
          </ul>

          <div style={{
            padding: '10px 14px',
            background: 'rgba(255,171,64,0.08)',
            border: '1px solid rgba(255,171,64,0.25)',
            borderRadius: 'var(--r2)',
            fontSize: 12, color: 'var(--warning)',
            lineHeight: 1.5,
          }}>
            Windows will display a UAC prompt. You must accept it for PCFixAI to function fully.
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 24px',
          borderTop: '1px solid var(--border-dim)',
        }}>
          <button
            onClick={handleLaunch}
            disabled={launching}
            style={{
              padding: '9px 24px',
              background: launching
                ? 'rgba(0,170,255,0.3)'
                : 'linear-gradient(135deg, #00d4ff, #0099cc)',
              border: 'none', borderRadius: 'var(--r2)',
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: launching ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: launching ? 'none' : '0 2px 8px rgba(0,212,255,0.3)',
              transition: 'opacity 0.15s',
            }}
          >
            {launching && <Loader2 size={14} className="spin" />}
            {launching ? 'Launching...' : 'Launch with Administrator Privileges'}
          </button>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{
          marginTop: 20, background: 'none', border: 'none',
          color: 'var(--text-muted)', fontSize: 12,
          cursor: 'pointer', textDecoration: 'underline',
          padding: '8px 16px',
        }}
      >
        Continue without admin access (limited features)
      </button>
    </div>
  )
}
