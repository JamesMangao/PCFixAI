import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { relaunchElevated } from '../../hooks/useTauriEvents'

export function PrivilegeBanner() {
  const [loading, setLoading] = useState(false)

  async function handleRelaunch() {
    setLoading(true)
    try {
      await relaunchElevated()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '8px 16px',
      background: 'rgba(255, 171, 64, 0.08)',
      borderBottom: '1px solid rgba(255, 171, 64, 0.3)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--warning)', fontSize: 14 }}>⚠</span>
        <span style={{ fontSize: 12, color: 'var(--warning)' }}>
          Running without administrator privileges — deep repairs disabled.
        </span>
      </div>
      <button
        onClick={handleRelaunch}
        disabled={loading}
        style={{
          padding: '4px 12px',
          background: 'transparent',
          border: '1px solid rgba(255, 171, 64, 0.5)',
          borderRadius: 'var(--r1)',
          color: 'var(--warning)',
          fontSize: 11,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {loading && <Loader2 size={11} className="spin" />}
        {loading ? 'Launching...' : 'Relaunch as Admin'}
      </button>
    </div>
  )
}
