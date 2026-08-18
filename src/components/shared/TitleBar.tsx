import { useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar() {
  const appWindow = getCurrentWindow()
  const [isMaximized, setIsMaximized] = useState(false)

  async function handleMaximize() {
    const maximized = await appWindow.isMaximized()
    if (maximized) {
      await appWindow.unmaximize()
      setIsMaximized(false)
    } else {
      await appWindow.maximize()
      setIsMaximized(true)
    }
  }

  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 42,
        background: 'linear-gradient(180deg, rgba(18, 28, 48, 0.98) 0%, rgba(11, 17, 32, 0.98) 100%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.06)',
        userSelect: 'none',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Subtle top edge highlight */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.12) 50%, transparent 100%)',
      }} />

      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, paddingLeft: 4 }}>
        {/* Logo mark */}
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1.5" fill="none" opacity="0.9" />
            <path d="M6.5 9h3.5M8 7.5l1.5 1.5-1.5 1.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #eaf0f9, #c0d0e4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '0.03em',
          }}>
            PCFixAI
          </span>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontWeight: 500, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            v1.4.0
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2 }}>
        <WindowButton icon="minimize" onClick={() => appWindow.minimize()} />
        <WindowButton icon={isMaximized ? 'restore' : 'maximize'} onClick={handleMaximize} />
        <WindowButton icon="close" onClick={() => appWindow.close()} danger />
      </div>
    </div>
  )
}

function WindowButton({ icon, onClick, danger }: { icon: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)

  const getIcon = () => {
    switch (icon) {
      case 'minimize':
        return <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" rx="0.5" /></svg>
      case 'maximize':
        return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" /></svg>
      case 'restore':
        return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="0.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1" /><rect x="0.5" y="2" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1" fill={hovered ? 'var(--bg-elevated)' : 'none'} /></svg>
      case 'close':
        return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
      default:
        return null
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger && hovered
          ? 'rgba(248, 113, 113, 0.9)'
          : hovered
            ? 'rgba(255,255,255,0.07)'
            : 'transparent',
        border: 'none', borderRadius: 'var(--r1)',
        color: danger && hovered
          ? 'white'
          : hovered
            ? 'var(--text-primary)'
            : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {getIcon()}
    </button>
  )
}
