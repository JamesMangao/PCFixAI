import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getInstalledApps } from '../../hooks/useTauriEvents'
import { Package, RefreshCw } from 'lucide-react'

interface InstalledApp {
  Name: string
  Version: string
  Publisher: string
  Size: number
}

export function UninstallManager() {
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  async function loadApps() {
    setLoading(true)
    try {
      const raw = await getInstalledApps()
      const parsed = JSON.parse(raw)
      setApps(Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    } catch {
      setApps([])
    }
    setLoading(false)
  }

  useEffect(() => { loadApps() }, [])

  const filtered = apps.filter(a =>
    a.Name.toLowerCase().includes(filter.toLowerCase()) ||
    a.Publisher?.toLowerCase().includes(filter.toLowerCase())
  )

  const totalSize = filtered.reduce((sum, a) => sum + (a.Size || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', height: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search installed apps..."
          style={{
            flex: 1, padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--r2)',
            color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={loadApps} style={{
          padding: '8px 12px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 'var(--r2)',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {filtered.length} apps • {totalSize > 0 ? `~${totalSize} KB total` : ''}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading installed apps...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No apps found.
          </div>
        ) : (
          filtered.map((app, i) => (
            <motion.div
              key={`${app.Name}-${i}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1, delay: Math.min(i * 0.01, 0.5) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s2)',
                padding: '6px 12px',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                borderRadius: 'var(--r1)',
                fontSize: 12,
              }}
            >
              <Package size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {app.Name}
                </span>
                {app.Publisher && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {app.Publisher}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {app.Version || '—'}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
