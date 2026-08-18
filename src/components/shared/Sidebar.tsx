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
      width: 250,
      background: 'linear-gradient(180deg, rgba(11, 17, 32, 0.98) 0%, rgba(6, 10, 16, 1) 100%)',
      borderRight: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px 12px',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Subtle right edge glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
        background: 'linear-gradient(180deg, rgba(0,212,255,0.08) 0%, rgba(0,212,255,0.02) 50%, transparent 100%)',
      }} />

      {/* Brand Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 28, paddingLeft: 8,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
          position: 'relative',
        }}>
          <BrainCircuit size={21} color="white" strokeWidth={2} />
          <div style={{
            position: 'absolute', inset: -1, borderRadius: 12,
            border: '1px solid rgba(0,212,255,0.15)',
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff, #c0d0e4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
          }}>
            PCFixAI
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            AI-Powered PC Repair
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {navItems.map(item => {
          const active = mode === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '10px 14px',
                paddingLeft: active ? 13 : 14,
                background: active
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))'
                  : 'transparent',
                border: 'none',
                borderRadius: 'var(--r2)',
                color: active ? '#00d4ff' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
                position: 'relative',
                ...(active ? {
                  boxShadow: '0 0 20px rgba(0,212,255,0.06)',
                } : {}),
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {/* Active indicator */}
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 18, borderRadius: '0 3px 3px 0',
                  background: 'linear-gradient(180deg, #00d4ff, #0099cc)',
                  boxShadow: '0 0 12px rgba(0,212,255,0.4)',
                }} />
              )}
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
        <button
          onClick={() => window.open('https://github.com/JamesMangao/PCFixAI/issues', '_blank')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', fontSize: 11,
            cursor: 'pointer', paddingLeft: 8,
            borderRadius: 'var(--r1)', padding: '5px 8px',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <MessageCircleQuestion size={13} />
          Give Feedback
        </button>

        {/* Status indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingLeft: 8, fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 8px rgba(52,211,153,0.5)',
            animation: 'glow-pulse 3s ease-in-out infinite',
          }} />
          <span style={{ letterSpacing: '0.04em' }}>System Active v1.4.0</span>
        </div>
      </div>
    </div>
  )
}
