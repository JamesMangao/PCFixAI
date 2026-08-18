import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
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
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '7px 16px',
      background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(248,113,113,0.04))',
      borderBottom: '1px solid rgba(251,191,36,0.15)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={14} style={{ color: '#fbbf24' }} strokeWidth={1.8} />
        <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 500 }}>
          Running without administrator privileges — deep repairs disabled
        </span>
      </div>
      <button
        onClick={handleRelaunch}
        disabled={loading}
        style={{
          padding: '4px 14px',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 'var(--r1)',
          color: '#fbbf24',
          fontSize: 11, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
          transition: 'all 150ms',
        }}
      >
        {loading && <Loader2 size={11} className="spin" />}
        {loading ? 'Launching...' : 'Relaunch as Admin'}
      </button>
    </div>
  )
}
