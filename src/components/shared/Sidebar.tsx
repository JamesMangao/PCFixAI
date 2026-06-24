import { useStore } from '../../store'
import { LayoutDashboard, MessageSquare, History, Settings, BrainCircuit, MessageCircleQuestion, Wrench } from 'lucide-react'

export function Sidebar() {
  const { mode, setMode } = useStore()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'toolkit', label: 'Toolkit', icon: Wrench },
    { id: 'diagnose', label: 'Assistant', icon: MessageSquare },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const

  return (
    <div style={{
      width: 260,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 'var(--s6) var(--s4)'
    }}>
      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s3)',
        marginBottom: 'var(--s8)',
        paddingLeft: 'var(--s2)'
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <BrainCircuit size={20} color="var(--bg-void)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>PCFixAI</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI-Powered PC Repair</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)', flex: 1 }}>
        {navItems.map(item => {
          const active = mode === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                width: '100%',
                padding: 'var(--s3) var(--s4)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: active ? '1px solid var(--border-hot)' : '1px solid transparent',
                borderRadius: 'var(--r2)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)', marginTop: 'auto' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s2)',
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: 12,
          cursor: 'pointer', paddingLeft: 'var(--s2)',
          transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <MessageCircleQuestion size={14} />
          Give Feedback
        </button>
        
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s2)',
          paddingLeft: 'var(--s2)', fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
          AI Active v1.7.5
        </div>
      </div>
    </div>
  )
}
