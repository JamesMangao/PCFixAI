import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getServices, manageService } from '../../hooks/useTauriEvents'
import { useStore } from '../../store'
import { RefreshCw, Play, Square } from 'lucide-react'

interface Service {
  Name: string
  DisplayName: string
  Status: string
  StartType: string
}

const STATUS_COLOR: Record<string, string> = {
  Running: 'var(--success)',
  Stopped: 'var(--danger)',
  Paused: 'var(--warning)',
}

export function ServiceManager() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function loadServices() {
    setLoading(true)
    try {
      const raw = await getServices()
      const parsed = JSON.parse(raw)
      setServices(Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    } catch {
      setServices([])
    }
    setLoading(false)
  }

  useEffect(() => { loadServices() }, [])

  async function handleAction(svc: Service, action: string) {
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} service "${svc.DisplayName}"?`)) return
    try {
      const ok = await manageService(svc.Name, action)
      if (ok) {
        useStore.getState().updateJob({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          category: 'Toolkit',
          action: `${action.charAt(0).toUpperCase() + action.slice(1)}: ${svc.Name}`,
          status: 'success',
          output: [`Service ${svc.Name} ${action}ed`],
          exitCode: 0,
        })
        loadServices()
      }
    } catch {
      useStore.getState().updateJob({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: `Failed: ${svc.Name}`,
        status: 'failed',
        output: ['Access denied or service not found'],
        exitCode: 1,
      })
    }
  }

  const filtered = services.filter(s => {
    const matchName = s.Name.toLowerCase().includes(filter.toLowerCase()) ||
      s.DisplayName.toLowerCase().includes(filter.toLowerCase())
    if (statusFilter === 'all') return matchName
    return matchName && s.Status === statusFilter
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', height: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search services..."
          style={{
            flex: 1, padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--r2)',
            color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)', borderRadius: 'var(--r2)',
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
          }}
        >
          <option value="all">All</option>
          <option value="Running">Running</option>
          <option value="Stopped">Stopped</option>
        </select>
        <button onClick={loadServices} style={{
          padding: '8px 12px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 'var(--r2)',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading services...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No services found.
          </div>
        ) : (
          filtered.map((svc, i) => (
            <motion.div
              key={svc.Name}
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
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: STATUS_COLOR[svc.Status] || 'var(--text-muted)',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {svc.DisplayName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                  {svc.Name}
                </span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: STATUS_COLOR[svc.Status] || 'var(--text-muted)',
                padding: '1px 6px', border: `1px solid ${STATUS_COLOR[svc.Status] || 'var(--text-muted)'}33`,
                borderRadius: 3, textTransform: 'uppercase',
              }}>
                {svc.Status}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 60, textAlign: 'right' }}>
                {svc.StartType}
              </span>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {svc.Status === 'Stopped' ? (
                  <button onClick={() => handleAction(svc, 'start')} style={{
                    padding: '2px 6px', background: 'transparent',
                    border: '1px solid rgba(0,230,118,0.3)', borderRadius: 3,
                    color: 'var(--success)', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <Play size={9} />
                  </button>
                ) : (
                  <button onClick={() => handleAction(svc, 'stop')} style={{
                    padding: '2px 6px', background: 'transparent',
                    border: '1px solid rgba(255,171,64,0.3)', borderRadius: 3,
                    color: 'var(--warning)', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <Square size={9} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
