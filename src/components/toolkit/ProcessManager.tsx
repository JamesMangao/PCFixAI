import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getProcesses, killProcess } from '../../hooks/useTauriEvents'
import { useStore } from '../../store'
import { RefreshCw, XCircle } from 'lucide-react'

interface Process {
  PID: number
  Name: string
  'CPU(s)': number
  'Mem(MB)': number
  Handles: number
  Threads: number
}

export function ProcessManager() {
  const [processes, setProcesses] = useState<Process[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'Mem(MB)' | 'CPU(s)' | 'Name'>('Mem(MB)')

  async function loadProcesses() {
    setLoading(true)
    try {
      const raw = await getProcesses()
      const parsed = JSON.parse(raw)
      setProcesses(Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
    } catch {
      setProcesses([])
    }
    setLoading(false)
  }

  useEffect(() => { loadProcesses() }, [])

  async function handleKill(p: Process) {
    if (!confirm(`Kill process "${p.Name}" (PID: ${p.PID})?`)) return
    try {
      const ok = await killProcess(p.PID)
      if (ok) {
        useStore.getState().updateJob({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          category: 'Toolkit',
          action: `Killed: ${p.Name}`,
          status: 'success',
          output: [`Process ${p.Name} (PID ${p.PID}) terminated`],
          exitCode: 0,
        })
        loadProcesses()
      }
    } catch {
      useStore.getState().updateJob({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: `Failed to kill: ${p.Name}`,
        status: 'failed',
        output: ['Access denied or process not found'],
        exitCode: 1,
      })
    }
  }

  const filtered = processes
    .filter(p => p.Name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'Name') return a.Name.localeCompare(b.Name)
      return (b[sortBy] || 0) - (a[sortBy] || 0)
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', height: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search processes..."
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
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{
            padding: '8px 12px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)', borderRadius: 'var(--r2)',
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
          }}
        >
          <option value="Mem(MB)">Sort: Memory</option>
          <option value="CPU(s)">Sort: CPU</option>
          <option value="Name">Sort: Name</option>
        </select>
        <button onClick={loadProcesses} style={{
          padding: '8px 12px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 'var(--r2)',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {filtered.length} processes • Top by memory usage
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading processes...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No processes found.
          </div>
        ) : (
          filtered.map((p, i) => (
            <motion.div
              key={`${p.PID}-${i}`}
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
              <span style={{ width: 60, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {p.PID}
              </span>
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.Name}
              </span>
              <span style={{ width: 70, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {p['Mem(MB)']} MB
              </span>
              <span style={{ width: 60, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {p['CPU(s)']}s
              </span>
              <button
                onClick={() => handleKill(p)}
                style={{
                  padding: '2px 6px', background: 'transparent',
                  border: '1px solid rgba(255,82,82,0.3)', borderRadius: 3,
                  color: 'var(--danger)', cursor: 'pointer', fontSize: 10,
                  display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                }}
              >
                <XCircle size={10} /> Kill
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
