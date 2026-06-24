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
        background: 'var(--bg-elevated)',
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

      <div style={{ display: 'flex', gap: 6 }}>
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
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r1)',
        color: danger ? 'var(--danger)' : 'var(--text-muted)',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'rgba(255,82,82,0.15)' : 'var(--bg-surface)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {label}
    </button>
  )
}
