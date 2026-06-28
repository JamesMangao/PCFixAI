import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, Download, Upload, CheckCircle, Loader2, HardDrive, ChevronRight } from 'lucide-react'
import { runRawCommand, runRawCommandOutput } from '../../hooks/useTauriEvents'
import { useStore, JobEntry } from '../../store'

interface DriverInfo {
  className: string
  manufacturer: string
  deviceName: string
  version: string
  infName: string
}

type View = 'list' | 'backup' | 'restore'

export function DriverBackup() {
  const [view, setView] = useState<View>('list')
  const [drivers, setDrivers] = useState<DriverInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [backupPath, setBackupPath] = useState('')
  const [backing, setBacking] = useState(false)
  const [restorePath, setRestorePath] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    loadDrivers()
  }, [])

  async function loadDrivers() {
    setLoading(true)
    try {
      const output = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        'Get-CimInstance Win32_PnSignedDriver | Where-Object { $_.InfName -and $_.InfName -ne "NULL" } | ' +
        'Select-Object ClassName, Manufacturer, DeviceName, DriverVersion, InfName | ' +
        'ConvertTo-Json -Compress'
      ])
      const parsed = JSON.parse(output || '[]')
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      setDrivers(arr.map((d: any) => ({
        className: d.ClassName || '',
        manufacturer: d.Manufacturer || '',
        deviceName: d.DeviceName || '',
        version: d.DriverVersion || '',
        infName: d.InfName || '',
      })))
    } catch {
      setDrivers([])
    } finally {
      setLoading(false)
    }
  }

  async function selectBackupFolder() {
    try {
      const output = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; ' +
        '$f = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
        '$f.Description = "Select folder to backup drivers"; ' +
        'if ($f.ShowDialog() -eq "OK") { Write-Output $f.SelectedPath }'
      ])
      if (output.trim()) setBackupPath(output.trim())
    } catch { /* cancelled */ }
  }

  async function backupDrivers() {
    if (!backupPath) return
    setBacking(true)
    setLog([`Backing up drivers to ${backupPath}...`])
    try {
      const code = await runRawCommand('dism', [
        '/Online', '/Export-Driver', `/Destination:"${backupPath}"`
      ])
      if (code === 0) {
        setLog(prev => [...prev, '✅ Drivers exported successfully', `   Location: ${backupPath}`])
        setBackupDone(true)
        logJob('Driver Backup', `Backup to ${backupPath}`, 'success')
      } else {
        setLog(prev => [...prev, `⚠️ Export completed with code ${code}`])
        logJob('Driver Backup', `Backup to ${backupPath}`, 'failed')
      }
    } catch (e) {
      setLog(prev => [...prev, `❌ Error: ${e instanceof Error ? e.message : String(e)}`])
      logJob('Driver Backup', 'Backup failed', 'failed')
    } finally {
      setBacking(false)
    }
  }

  async function selectRestoreFolder() {
    try {
      const output = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; ' +
        '$f = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
        '$f.Description = "Select driver backup folder"; ' +
        'if ($f.ShowDialog() -eq "OK") { Write-Output $f.SelectedPath }'
      ])
      if (output.trim()) setRestorePath(output.trim())
    } catch { /* cancelled */ }
  }

  async function restoreDrivers() {
    if (!restorePath) return
    setRestoring(true)
    setLog([`Restoring drivers from ${restorePath}...`])
    try {
      const code = await runRawCommand('pnputil', [
        '/add-driver', `"${restorePath}\\*.inf"`, '/subdirs', '/install'
      ])
      if (code === 0) {
        setLog(prev => [...prev, '✅ Drivers restored successfully', '   A restart may be needed.'])
        logJob('Driver Restore', `Restore from ${restorePath}`, 'success')
      } else {
        setLog(prev => [...prev, `⚠️ Restore completed with code ${code}`])
        logJob('Driver Restore', `Restore from ${restorePath}`, 'failed')
      }
    } catch (e) {
      setLog(prev => [...prev, `❌ Error: ${e instanceof Error ? e.message : String(e)}`])
      logJob('Driver Restore', 'Restore failed', 'failed')
    } finally {
      setRestoring(false)
    }
  }

  // Group drivers by class
  const grouped = drivers.reduce<Record<string, DriverInfo[]>>((acc, d) => {
    const key = d.className || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})
  const classCount = Object.keys(grouped).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([
          { key: 'list', label: 'Installed', icon: HardDrive },
          { key: 'backup', label: 'Backup', icon: Download },
          { key: 'restore', label: 'Restore', icon: Upload },
        ] as const).map(tab => (
          <motion.button
            key={tab.key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setView(tab.key); setLog([]); setBackupDone(false) }}
            style={{
              flex: 1, padding: '6px 8px',
              background: view === tab.key ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${view === tab.key ? 'var(--accent)' : 'var(--border-dim)'}`,
              borderRadius: 'var(--r1)',
              color: view === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600, textAlign: 'center',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <tab.icon size={12} />
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* List view */}
      {view === 'list' && (
        loading ? (
          <div style={{ padding: 'var(--s4)', textAlign: 'center' }}>
            <Loader2 size={20} className="spin" style={{ color: 'var(--accent)', margin: '0 auto var(--s2)' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scanning drivers...</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {drivers.length} drivers found across {classCount} categories
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cls, items]) => (
                <div key={cls} style={{ marginBottom: 'var(--s2)' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', padding: '4px 0',
                    borderBottom: '1px solid var(--border-dim)', marginBottom: 4,
                  }}>
                    {cls} ({items.length})
                  </div>
                  {items.map(d => (
                    <div key={d.infName} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--s2)',
                      padding: '4px 8px', fontSize: 10,
                    }}>
                      <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.deviceName}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                          {d.manufacturer} • v{d.version}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* Backup view */}
      {view === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Export all third-party drivers from your system to a folder. This uses DISM to safely extract drivers.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={selectBackupFolder}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--r2)',
              color: backupPath ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              textAlign: 'left',
            }}
          >
            <FolderOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            {backupPath || 'Choose backup destination...'}
          </motion.button>

          <motion.button
            whileHover={backupPath ? { scale: 1.02 } : {}}
            whileTap={backupPath ? { scale: 0.98 } : {}}
            onClick={backupDrivers}
            disabled={!backupPath || backing}
            style={{
              padding: '10px 16px',
              background: !backupPath ? 'var(--bg-surface)' : backing ? 'rgba(0,170,255,0.1)' : 'linear-gradient(135deg, #00aaff, #0077cc)',
              border: 'none', borderRadius: 'var(--r2)',
              color: !backupPath ? 'var(--text-muted)' : 'white',
              fontSize: 13, fontWeight: 600,
              cursor: !backupPath || backing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: backupPath && !backing ? 'var(--shadow-sm), 0 0 16px rgba(0,170,255,0.3)' : 'none',
            }}
          >
            {backing ? <><Loader2 size={16} className="spin" /> Backing up...</> : <><Download size={16} /> Backup Drivers</>}
          </motion.button>

          {backupDone && (
            <div style={{
              padding: 'var(--s3)', background: 'rgba(0,230,118,0.08)',
              borderRadius: 'var(--r2)', border: '1px solid rgba(0,230,118,0.2)',
              fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CheckCircle size={14} /> Backup complete! Drivers exported to the selected folder.
            </div>
          )}
        </div>
      )}

      {/* Restore view */}
      {view === 'restore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Install drivers from a previously exported backup folder. Uses pnputil to add all .inf files.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={selectRestoreFolder}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--r2)',
              color: restorePath ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              textAlign: 'left',
            }}
          >
            <FolderOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            {restorePath || 'Choose backup folder to restore from...'}
          </motion.button>

          <motion.button
            whileHover={restorePath ? { scale: 1.02 } : {}}
            whileTap={restorePath ? { scale: 0.98 } : {}}
            onClick={restoreDrivers}
            disabled={!restorePath || restoring}
            style={{
              padding: '10px 16px',
              background: !restorePath ? 'var(--bg-surface)' : restoring ? 'rgba(0,230,118,0.1)' : 'linear-gradient(135deg, #00e676, #00c853)',
              border: 'none', borderRadius: 'var(--r2)',
              color: !restorePath ? 'var(--text-muted)' : 'white',
              fontSize: 13, fontWeight: 600,
              cursor: !restorePath || restoring ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: restorePath && !restoring ? 'var(--shadow-sm), 0 0 16px rgba(0,230,118,0.3)' : 'none',
            }}
          >
            {restoring ? <><Loader2 size={16} className="spin" /> Restoring...</> : <><Upload size={16} /> Restore Drivers</>}
          </motion.button>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{
          padding: 'var(--s3)',
          background: 'var(--bg-surface)', borderRadius: 'var(--r2)',
          maxHeight: 100, overflowY: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          border: '1px solid var(--border-dim)',
        }}>
          {log.map((line, i) => <div key={i} style={{ lineHeight: 1.6 }}>{line}</div>)}
        </div>
      )}
    </div>
  )
}

function logJob(category: string, action: string, status: 'success' | 'failed') {
  const job: JobEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    category,
    action,
    status,
    output: [`${action} - ${status}`],
    exitCode: status === 'success' ? 0 : 1,
  }
  useStore.getState().updateJob(job)
}
