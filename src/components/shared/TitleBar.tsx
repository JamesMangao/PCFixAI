import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar() {
  const appWindow = getCurrentWindow()

  return (
    <div
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(180deg, rgba(25,35,50,0.98) 0%, var(--bg-elevated) 100%)',
        borderBottom: '1px solid var(--border-dim)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
          <path d="M6 9h4M8 7l2 2-2 2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.04em',
        }}>
          PCFixAI
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          System Repair
        </span>
      </div>

      <div style={{ display: 'flex', gap: 2 }}>
        <WindowButton label="—" onClick={() => appWindow.minimize()} />
        <WindowButton label="✕" onClick={() => appWindow.close()} danger />
      </div>
    </div>
  )
}

function WindowButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r1)',
        color: danger ? 'var(--text-muted)' : 'var(--text-muted)',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        if (danger) {
          e.currentTarget.style.background = 'var(--danger)'
          e.currentTarget.style.color = 'white'
        } else {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? 'var(--text-muted)' : 'var(--text-muted)'
      }}
    >
      {label}
    </button>
  )
}
