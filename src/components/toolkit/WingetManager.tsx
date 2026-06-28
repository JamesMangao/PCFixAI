import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Download, CheckCircle, Loader2 } from 'lucide-react'
import { runRawCommand, runRawCommandOutput } from '../../hooks/useTauriEvents'
import { useStore, JobEntry } from '../../store'

interface WingetPackage {
  id: string
  name: string
  currentVersion: string
  availableVersion: string
}

export function WingetManager() {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState(false)
  const [packages, setPackages] = useState<WingetPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkWinget()
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  async function checkWinget() {
    setLoading(true)
    try {
      const output = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        'try { $v = winget --version; Write-Output "OK:$v" } catch { Write-Output "NOT_FOUND" }'
      ])
      if (output.includes('OK:')) {
        setInstalled(true)
        await listUpgrades()
      } else {
        setInstalled(false)
        setLoading(false)
      }
    } catch {
      setInstalled(false)
      setLoading(false)
    }
  }

  async function installWinget() {
    setInstalling(true)
    setLog(prev => [...prev, 'Downloading winget installer...'])
    try {
      const code = await runRawCommand('powershell', [
        '-NoProfile', '-Command',
        'Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/latest/download/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile "$env:TEMP\\winget.msixbundle"; Add-AppxPackage -Path "$env:TEMP\\winget.msixbundle" -ForceApplicationShutdown'
      ])
      if (code === 0) {
        setLog(prev => [...prev, '✅ Winget installed successfully'])
        setInstalled(true)
        await listUpgrades()
      } else {
        setLog(prev => [...prev, '❌ Installation failed. Try installing from Microsoft Store manually.'])
      }
    } catch (e) {
      setLog(prev => [...prev, `❌ Error: ${e instanceof Error ? e.message : String(e)}`])
    } finally {
      setInstalling(false)
    }
  }

  async function listUpgrades() {
    setLoading(true)
    try {
      const output = await runRawCommandOutput('winget', [
        'upgrade', '--accept-source-agreements'
      ])
      const lines = output.split('\n')
      const parsed: WingetPackage[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('Name') || trimmed.startsWith('---') || trimmed.startsWith('ID') || trimmed.startsWith('Upgrade') || trimmed.startsWith('Windows')) continue

        const parts = trimmed.split(/\s{2,}/)
        if (parts.length >= 3) {
          const name = parts[0]
          const id = parts[1]
          const currentVersion = parts.length >= 4 ? parts[2] : ''
          const availableVersion = parts.length >= 4 ? parts[3] : parts[2]

          if (id && currentVersion && availableVersion && !id.includes('upgrades available')) {
            parsed.push({ id, name, currentVersion, availableVersion })
          }
        }
      }

      setPackages(parsed)
      if (parsed.length === 0 && output.includes('upgrades available')) {
        setLog(prev => [...prev, 'All packages are up to date'])
      }
    } catch (e) {
      setLog(prev => [...prev, `Error listing packages: ${e instanceof Error ? e.message : String(e)}`])
    } finally {
      setLoading(false)
    }
  }

  async function updatePackage(pkg: WingetPackage) {
    setUpdating(pkg.id)
    setLog(prev => [...prev, `Updating ${pkg.name}...`])
    try {
      const code = await runRawCommand('winget', [
        'upgrade', '--id', pkg.id,
        '--silent', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'
      ])
      if (code === 0) {
        setLog(prev => [...prev, `✅ ${pkg.name} updated successfully`])
        logJob('Winget', `Update: ${pkg.name}`, 'success')
      } else {
        setLog(prev => [...prev, `⚠️ ${pkg.name} update completed with code ${code}`])
        logJob('Winget', `Update: ${pkg.name}`, 'failed')
      }
      await listUpgrades()
    } catch (e) {
      setLog(prev => [...prev, `❌ Failed to update ${pkg.name}: ${e instanceof Error ? e.message : String(e)}`])
      logJob('Winget', `Update: ${pkg.name}`, 'failed')
    } finally {
      setUpdating(null)
    }
  }

  async function updateAll() {
    setUpdatingAll(true)
    setLog(prev => [...prev, 'Updating all packages...'])
    try {
      const code = await runRawCommand('winget', [
        'upgrade', '--all',
        '--silent', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'
      ])
      if (code === 0) {
        setLog(prev => [...prev, '✅ All packages updated successfully'])
        logJob('Winget', 'Update All Packages', 'success')
      } else {
        setLog(prev => [...prev, `⚠️ Update completed with exit code ${code}`])
        logJob('Winget', 'Update All Packages', 'failed')
      }
      await listUpgrades()
    } catch (e) {
      setLog(prev => [...prev, `❌ Error: ${e instanceof Error ? e.message : String(e)}`])
      logJob('Winget', 'Update All Packages', 'failed')
    } finally {
      setUpdatingAll(false)
    }
  }

  // Not installed state
  if (installed === false) {
    return (
      <div style={{ padding: 'var(--s4)', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(255,171,64,0.1)', border: '1px solid rgba(255,171,64,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--s4)',
        }}>
          <Download size={24} color="var(--warning)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--s2)' }}>
          Winget is not installed
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--s4)' }}>
          Winget is required for automatic app updates. It will be installed silently from GitHub.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={installWinget}
          disabled={installing}
          style={{
            padding: '8px 20px',
            background: installing ? 'var(--accent-dim)' : 'linear-gradient(135deg, #00d4ff, #0099cc)',
            border: 'none', borderRadius: 'var(--r2)',
            color: installing ? 'var(--accent)' : 'white',
            fontSize: 13, fontWeight: 600,
            cursor: installing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            margin: '0 auto',
          }}
        >
          {installing ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          {installing ? 'Installing...' : 'Install Winget'}
        </motion.button>

        {log.length > 0 && (
          <div ref={logRef} style={{
            marginTop: 'var(--s4)', padding: 'var(--s3)',
            background: 'var(--bg-surface)', borderRadius: 'var(--r2)',
            maxHeight: 120, overflowY: 'auto', textAlign: 'left',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
            border: '1px solid var(--border-dim)',
          }}>
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Package Updates
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {loading ? 'Scanning...' : packages.length > 0 ? `${packages.length} update${packages.length > 1 ? 's' : ''} available` : 'All packages up to date'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={listUpgrades}
            disabled={loading}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--border-mid)', borderRadius: 'var(--r1)',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            Refresh
          </motion.button>
          {packages.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={updateAll}
              disabled={updatingAll}
              style={{
                padding: '4px 10px',
                background: updatingAll ? 'rgba(0,230,118,0.1)' : 'transparent',
                border: `1px solid ${updatingAll ? 'var(--success)' : 'var(--success)'}`,
                borderRadius: 'var(--r1)',
                color: 'var(--success)', fontSize: 11, fontWeight: 600,
                cursor: updatingAll ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {updatingAll ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
              {updatingAll ? 'Updating...' : 'Update All'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Package list */}
      {loading ? (
        <div style={{ padding: 'var(--s4)', textAlign: 'center' }}>
          <Loader2 size={20} className="spin" style={{ color: 'var(--accent)', margin: '0 auto var(--s2)' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scanning for updates...</p>
        </div>
      ) : packages.length === 0 ? (
        <div style={{
          padding: 'var(--s4)', textAlign: 'center',
          background: 'rgba(0,230,118,0.05)', borderRadius: 'var(--r2)',
          border: '1px solid rgba(0,230,118,0.2)',
        }}>
          <CheckCircle size={20} style={{ color: 'var(--success)', margin: '0 auto var(--s2)' }} />
          <p style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>All packages are up to date</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {packages.map(pkg => (
            <div key={pkg.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s3)',
              padding: '8px 12px',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r2)',
              background: updating === pkg.id ? 'rgba(0,230,118,0.05)' : 'transparent',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pkg.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {pkg.currentVersion} → {pkg.availableVersion}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => updatePackage(pkg)}
                disabled={updating !== null || updatingAll}
                style={{
                  padding: '3px 10px',
                  background: 'transparent',
                  border: '1px solid var(--accent)',
                  borderRadius: 'var(--r1)',
                  color: 'var(--accent)',
                  fontSize: 10, fontWeight: 600,
                  cursor: updating !== null ? 'default' : 'pointer',
                  opacity: updating !== null ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {updating === pkg.id ? '...' : 'Update'}
              </motion.button>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div ref={logRef} style={{
          padding: 'var(--s3)',
          background: 'var(--bg-surface)', borderRadius: 'var(--r2)',
          maxHeight: 100, overflowY: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          border: '1px solid var(--border-dim)',
        }}>
          {log.slice(-10).map((line, i) => <div key={i} style={{ lineHeight: 1.6 }}>{line}</div>)}
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
