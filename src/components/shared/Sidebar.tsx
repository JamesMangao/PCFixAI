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
      background: 'linear-gradient(180deg, var(--bg-surface) 0%, rgba(10,16,24,1) 100%)',
      borderRight: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 'var(--s6) var(--s4)',
      position: 'relative',
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
          width: 36, height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}>
          <BrainCircuit size={20} color="white" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>PCFixAI</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI-Powered PC Repair</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s1)', flex: 1 }}>
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
                padding: '10px var(--s4)',
                paddingLeft: active ? 'calc(var(--s4) - 3px)' : 'var(--s4)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--r2)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
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
              {/* Active indicator bar */}
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 20,
                  borderRadius: '0 3px 3px 0',
                  background: 'var(--accent)',
                  boxShadow: '0 0 8px var(--accent-glow)',
                }} />
              )}
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)', marginTop: 'auto' }}>
        <button
          onClick={() => window.open('https://github.com/JamesMangao/PCFixAI/issues', '_blank')}
          style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s2)',
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: 12,
          cursor: 'pointer', paddingLeft: 'var(--s2)',
          transition: 'color var(--transition-fast)',
          borderRadius: 'var(--r1)',
          padding: '4px var(--s2)',
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
          <MessageCircleQuestion size={14} />
          Give Feedback
        </button>
        
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s2)',
          paddingLeft: 'var(--s2)', fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 8px var(--success)',
            animation: 'glow-pulse 3s ease-in-out infinite',
          }} />
          AI Active v1.7.5
        </div>
      </div>
    </div>
  )
}
