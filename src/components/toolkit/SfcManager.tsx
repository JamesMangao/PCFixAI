import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, AlertTriangle, Loader2, Info } from 'lucide-react'
import { runRawCommand, runRawCommandOutput } from '../../hooks/useTauriEvents'
import { useStore, JobEntry } from '../../store'

type ScanType = 'sfc' | 'dism' | 'both'
type ScanState = 'idle' | 'running' | 'complete' | 'error'

export function SfcManager() {
  const [scanType, setScanType] = useState<ScanType>('sfc')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [needsRestart, setNeedsRestart] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const scanInterval = useRef<number | null>(null)

  useEffect(() => {
    checkAdminStatus()
    return () => { if (scanInterval.current) clearInterval(scanInterval.current) }
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [results])

  async function checkAdminStatus() {
    try {
      const output = await runRawCommandOutput('powershell', [
        '-NoProfile', '-Command',
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
      ])
      if (!output.trim().includes('True')) {
        setResults(prev => [...prev, '⚠️ Run as Administrator for best results. SFC/DISM require elevated privileges.'])
      }
    } catch { /* ok */ }
  }

  async function startScan() {
    setScanState('running')
    setProgress(0)
    setResults([])
    setNeedsRestart(false)

    if (scanType === 'sfc') {
      await runSfc()
    } else if (scanType === 'dism') {
      await runDism()
    } else {
      await runSfc()
      setProgress(50)
      await runDism()
    }

    setScanState('complete')
    setProgress(100)
    logJob('SFC/DISM', `Scan: ${scanType.toUpperCase()}`, 'success')
  }

  async function runSfc() {
    setCurrentStep('Running System File Checker...')
    setResults(prev => [...prev, '🔍 Starting SFC scan...', '   This may take 10-15 minutes.'])

    try {
      const code = await runRawCommand('sfc', ['/scannow'])
      setProgress(50)

      if (code === 0) {
        setResults(prev => [...prev, '✅ SFC scan completed successfully', '   No integrity violations found.'])
      } else if (code === 1) {
        setResults(prev => [...prev, '✅ SFC scan completed', '   Some files were repaired.'])
        setNeedsRestart(true)
      } else if (code === 2) {
        setResults(prev => [...prev, '⚠️ SFC scan completed', '   Repair action required. Restart recommended.'])
        setNeedsRestart(true)
      } else {
        setResults(prev => [...prev, `⚠️ SFC completed with code ${code}`, '   Check CBS.log for details.'])
      }
    } catch (e) {
      setResults(prev => [...prev, `❌ SFC error: ${e instanceof Error ? e.message : String(e)}`])
      setScanState('error')
    }
  }

  async function runDism() {
    setCurrentStep('Running DISM restore health...')
    setResults(prev => [...prev, '🔍 Starting DISM /RestoreHealth...', '   This may take several minutes.'])

    try {
      const code = await runRawCommand('dism', ['/Online', '/Cleanup-Image', '/RestoreHealth'])
      setProgress(scanType === 'both' ? 100 : 100)

      if (code === 0) {
        setResults(prev => [...prev, '✅ DISM restore health completed successfully', '   Component store is healthy.'])
      } else {
        setResults(prev => [...prev, `⚠️ DISM completed with code ${code}`, '   Check DISM.log for details.'])
      }
    } catch (e) {
      setResults(prev => [...prev, `❌ DISM error: ${e instanceof Error ? e.message : String(e)}`])
      setScanState('error')
    }
  }

  const scanOptions: { value: ScanType; label: string; desc: string }[] = [
    { value: 'sfc', label: 'SFC Scan', desc: 'Check system file integrity' },
    { value: 'dism', label: 'DISM Restore', desc: 'Repair component store' },
    { value: 'both', label: 'Full Repair', desc: 'Run both SFC + DISM' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--s2)',
        padding: 'var(--s3)',
        background: 'rgba(0,170,255,0.05)',
        borderRadius: 'var(--r2)',
        border: '1px solid rgba(0,170,255,0.15)',
      }}>
        <Info size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          SFC checks Windows system files for corruption and repairs them. DISM fixes the Windows component store that SFC uses. Run both for a thorough repair.
        </p>
      </div>

      {/* Scan type selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {scanOptions.map(opt => (
          <motion.button
            key={opt.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setScanType(opt.value)}
            disabled={scanState === 'running'}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: scanType === opt.value ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${scanType === opt.value ? 'var(--accent)' : 'var(--border-dim)'}`,
              borderRadius: 'var(--r2)',
              color: scanType === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 500, textAlign: 'center',
              cursor: scanState === 'running' ? 'default' : 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{opt.desc}</div>
          </motion.button>
        ))}
      </div>

      {/* Run button */}
      <motion.button
        whileHover={scanState !== 'running' ? { scale: 1.02 } : {}}
        whileTap={scanState !== 'running' ? { scale: 0.98 } : {}}
        onClick={startScan}
        disabled={scanState === 'running'}
        style={{
          padding: '10px 16px',
          background: scanState === 'running' ? 'rgba(0,170,255,0.1)' : 'linear-gradient(135deg, #00aaff, #0077cc)',
          border: 'none', borderRadius: 'var(--r2)',
          color: 'white', fontSize: 13, fontWeight: 600,
          cursor: scanState === 'running' ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: scanState !== 'running' ? 'var(--shadow-sm), 0 0 16px rgba(0,170,255,0.3)' : 'none',
        }}
      >
        {scanState === 'running' ? (
          <>
            <Loader2 size={16} className="spin" />
            Scanning... {progress > 0 && `${progress}%`}
          </>
        ) : (
          <>
            <Play size={16} />
            Start {scanOptions.find(o => o.value === scanType)?.label}
          </>
        )}
      </motion.button>

      {/* Progress bar */}
      {scanState === 'running' && (
        <div style={{
          height: 4, borderRadius: 2,
          background: 'var(--bg-surface)', overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, var(--accent), #00d4ff)',
            }}
          />
        </div>
      )}

      {/* Current step */}
      {currentStep && scanState === 'running' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: 'rgba(0,170,255,0.05)',
          borderRadius: 'var(--r1)',
        }}>
          <Loader2 size={12} className="spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{currentStep}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div ref={logRef} style={{
          padding: 'var(--s3)',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--r2)',
          border: '1px solid var(--border-dim)',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {results.map((line, i) => (
            <div key={i} style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: line.startsWith('✅') ? 'var(--success)' : line.startsWith('❌') ? 'var(--error)' : line.startsWith('⚠️') ? 'var(--warning)' : 'var(--text-secondary)',
              lineHeight: 1.8, whiteSpace: 'pre-wrap',
            }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Restart notice */}
      {needsRestart && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'rgba(255,171,64,0.08)',
          borderRadius: 'var(--r2)',
          border: '1px solid rgba(255,171,64,0.2)',
        }}>
          <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 500 }}>
            A restart is recommended to complete repairs.
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
