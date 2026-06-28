import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Download, Upload, Activity, Loader2, RefreshCw } from 'lucide-react'
import { runRawCommandOutput } from '../../hooks/useTauriEvents'
import { useStore, JobEntry } from '../../store'

interface SpeedResult {
  downloadMbps: number
  uploadMbps: number
  pingMs: number
  server: string
}

export function SpeedTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<SpeedResult | null>(null)
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function runSpeedTest() {
    setTesting(true)
    setResult(null)
    setError(null)

    try {
      // Ping test
      setPhase('ping')
      const pingOutput = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        '(Test-Connection -ComputerName 8.8.8.8 -Count 3 -Quiet) | Out-Null; ' +
        '$ping = (Test-Connection -ComputerName 8.8.8.8 -Count 4 | Measure-Object -Property Latency -Average).Average; ' +
        'Write-Output $ping'
      ])
      const pingMs = Math.round(parseFloat(pingOutput.trim()) || 0)

      // Download test - download a 10MB file from a known CDN
      setPhase('download')
      const dlOutput = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        '$url = "http://speedtest.tele2.net/10MB.zip"; ' +
        '$tempFile = "$env:TEMP\\speedtest_dl.tmp"; ' +
        '$sw = [System.Diagnostics.Stopwatch]::StartNew(); ' +
        'try { ' +
        '  $wc = New-Object System.Net.WebClient; ' +
        '  $wc.DownloadFile($url, $tempFile); ' +
        '  $sw.Stop(); ' +
        '  $size = (Get-Item $tempFile).Length; ' +
        '  $mbps = [math]::Round(($size * 8) / ($sw.Elapsed.TotalSeconds * 1000000), 2); ' +
        '  Remove-Item $tempFile -Force -ErrorAction SilentlyContinue; ' +
        '  Write-Output $mbps ' +
        '} catch { ' +
        '  $sw.Stop(); ' +
        '  Write-Output "0" ' +
        '}'
      ])
      const downloadMbps = parseFloat(dlOutput.trim()) || 0

      // Upload test - upload a small payload
      setPhase('upload')
      const ulOutput = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        '$url = "http://speedtest.tele2.net/upload.php"; ' +
        '$data = New-Object byte[] 1048576; ' +
        '$sw = [System.Diagnostics.Stopwatch]::StartNew(); ' +
        'try { ' +
        '  $wc = New-Object System.Net.WebClient; ' +
        '  $wc.UploadData($url, "POST", $data); ' +
        '  $sw.Stop(); ' +
        '  $mbps = [math]::Round(($data.Length * 8) / ($sw.Elapsed.TotalSeconds * 1000000), 2); ' +
        '  Write-Output $mbps ' +
        '} catch { ' +
        '  $sw.Stop(); ' +
        '  Write-Output "0" ' +
        '}'
      ])
      const uploadMbps = parseFloat(ulOutput.trim()) || 0

      setPhase('done')
      const speedResult: SpeedResult = {
        downloadMbps,
        uploadMbps,
        pingMs,
        server: 'Tele2 (Stockholm)',
      }
      setResult(speedResult)

      logJob('Speed Test', `Download: ${downloadMbps} Mbps, Upload: ${uploadMbps} Mbps, Ping: ${pingMs}ms`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      logJob('Speed Test', 'Speed test failed', 'failed')
    } finally {
      setTesting(false)
    }
  }

  function getSpeedRating(mbps: number): { rating: string; color: string } {
    if (mbps >= 100) return { rating: 'Excellent', color: 'var(--success)' }
    if (mbps >= 50) return { rating: 'Good', color: 'var(--accent)' }
    if (mbps >= 20) return { rating: 'Fair', color: 'var(--warning)' }
    return { rating: 'Slow', color: 'var(--error)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
      {/* Center display */}
      <div style={{ textAlign: 'center' }}>
        <motion.div
          animate={testing ? { rotate: 360 } : {}}
          transition={testing ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: result
              ? 'linear-gradient(135deg, rgba(0,230,118,0.15), rgba(0,170,255,0.15))'
              : 'rgba(0,170,255,0.08)',
            border: `2px solid ${result ? 'var(--success)' : 'var(--accent)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--s3)',
            boxShadow: result ? '0 0 24px rgba(0,230,118,0.2)' : testing ? '0 0 24px rgba(0,170,255,0.3)' : 'none',
          }}
        >
          {testing ? (
            <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
          ) : (
            <Wifi size={32} style={{ color: result ? 'var(--success)' : 'var(--accent)' }} />
          )}
        </motion.div>

        {result ? (
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {result.downloadMbps}
            <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>Mbps</span>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {phase === 'idle' ? 'Click to test your connection' :
             phase === 'ping' ? 'Testing latency...' :
             phase === 'download' ? 'Testing download speed...' :
             phase === 'upload' ? 'Testing upload speed...' : ''}
          </div>
        )}
      </div>

      {/* Results cards */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s2)' }}>
          {[
            { icon: Download, label: 'Download', value: `${result.downloadMbps}`, unit: 'Mbps', ...getSpeedRating(result.downloadMbps) },
            { icon: Upload, label: 'Upload', value: `${result.uploadMbps}`, unit: 'Mbps', ...getSpeedRating(result.uploadMbps) },
            { icon: Activity, label: 'Ping', value: `${result.pingMs}`, unit: 'ms', rating: result.pingMs < 30 ? 'Excellent' : result.pingMs < 60 ? 'Good' : 'High', color: result.pingMs < 30 ? 'var(--success)' : result.pingMs < 60 ? 'var(--accent)' : 'var(--warning)' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                padding: 'var(--s3)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--r2)',
                border: '1px solid var(--border-dim)',
                textAlign: 'center',
              }}
            >
              <item.icon size={16} style={{ color: item.color, margin: '0 auto 4px' }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.unit}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: item.color, marginTop: 2 }}>{item.rating}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Progress bars during test */}
      {(phase === 'download' || phase === 'upload') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {phase === 'download' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Download</span>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>Testing...</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                <motion.div animate={{ width: '100%' }} transition={{ duration: 8 }}
                  style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, var(--accent), #00d4ff)' }} />
              </div>
            </div>
          )}
          {phase === 'upload' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Upload</span>
                <span style={{ fontSize: 10, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>Testing...</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                <motion.div animate={{ width: '100%' }} transition={{ duration: 8 }}
                  style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, var(--success), #00ff88)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--s3)',
          background: 'rgba(255,68,68,0.08)',
          borderRadius: 'var(--r2)',
          border: '1px solid rgba(255,68,68,0.2)',
          fontSize: 11, color: 'var(--error)',
        }}>
          Test failed: {error}
        </div>
      )}

      {/* Start button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={runSpeedTest}
        disabled={testing}
        style={{
          padding: '10px 16px',
          background: testing ? 'rgba(0,170,255,0.1)' : 'linear-gradient(135deg, #00aaff, #0077cc)',
          border: 'none', borderRadius: 'var(--r2)',
          color: 'white', fontSize: 13, fontWeight: 600,
          cursor: testing ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: !testing ? 'var(--shadow-sm), 0 0 16px rgba(0,170,255,0.3)' : 'none',
        }}
      >
        {testing ? (
          <><Loader2 size={16} className="spin" /> Testing...</>
        ) : result ? (
          <><RefreshCw size={16} /> Test Again</>
        ) : (
          <><Wifi size={16} /> Start Speed Test</>
        )}
      </motion.button>

      {result && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Server: {result.server} • Tested: {new Date().toLocaleTimeString()}
          </span>
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
