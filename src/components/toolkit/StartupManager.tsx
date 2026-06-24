import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getStartupItems, runRawCommandOutput } from '../../hooks/useTauriEvents'
import { useStore } from '../../store'
import { Power, RefreshCw, Trash2 } from 'lucide-react'

interface StartupItem {
  Name: string
  Command: string
  Location: string
  Type: string
}

export function StartupManager() {
  const [items, setItems] = useState<StartupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  async function loadItems() {
    setLoading(true)
    try {
      const raw = await getStartupItems()
      const parsed = JSON.parse(raw)
      setItems(Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  async function removeItem(item: StartupItem) {
    if (!confirm(`Remove "${item.Name}" from startup?`)) return

    let script = ''
    if (item.Location.includes('HKLM') || item.Location.includes('HKCU')) {
      script = `Remove-ItemProperty -Path '${item.Location}' -Name '${item.Name}' -Force -ErrorAction Stop`
    } else {
      script = `Remove-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${item.Name}' -Force -ErrorAction SilentlyContinue`
    }

    try {
      await runRawCommandOutput('powershell', ['-NoProfile', '-Command', script])
      useStore.getState().updateJob({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: `Removed startup: ${item.Name}`,
        status: 'success',
        output: [`Removed ${item.Name} from startup`],
        exitCode: 0,
      })
      loadItems()
    } catch {
      useStore.getState().updateJob({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: `Failed to remove: ${item.Name}`,
        status: 'failed',
        output: ['Access denied or item not found'],
        exitCode: 1,
      })
    }
  }

  const filtered = items.filter(i =>
    i.Name.toLowerCase().includes(filter.toLowerCase()) ||
    i.Command.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', height: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search startup items..."
          style={{
            flex: 1, padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--r2)',
            color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={loadItems} style={{
          padding: '8px 12px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 'var(--r2)',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading startup items...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No startup items found.
          </div>
        ) : (
          filtered.map((item, i) => (
            <motion.div
              key={`${item.Name}-${i}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: i * 0.02 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                padding: '10px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r2)',
              }}
            >
              <Power size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.Name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.Command}
                </div>
              </div>
              <button
                onClick={() => removeItem(item)}
                style={{
                  padding: '4px 8px', background: 'transparent',
                  border: '1px solid var(--danger)', borderRadius: 'var(--r1)',
                  color: 'var(--danger)', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}
              >
                <Trash2 size={12} /> Remove
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
