import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import { Loader2, ShieldAlert, CheckCircle, XCircle } from 'lucide-react'

export function GlobalProgressBar() {
  const { scanPhase, activeTask } = useStore()

  const isScanning = scanPhase.phase === 'starting' || scanPhase.phase === 'scanning' || scanPhase.phase === 'fixing'
  const isVisible = isScanning || activeTask !== null

  const isDone = activeTask?.status === 'done'
  const isError = activeTask?.status === 'error'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex', flexDirection: 'column', gap: 8,
            background: 'rgba(11, 17, 32, 0.88)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--r4)',
            padding: '12px 20px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            minWidth: 300,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isDone ? (
                <CheckCircle size={15} color="#34d399" strokeWidth={2} />
              ) : isError ? (
                <XCircle size={15} color="#f87171" strokeWidth={2} />
              ) : scanPhase.phase === 'fixing' ? (
                <ShieldAlert size={15} color="#fbbf24" strokeWidth={1.8} />
              ) : (
                <Loader2 size={15} color="var(--accent)" className="spin" />
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {isScanning ? (
                  <>
                    {scanPhase.phase === 'starting' && 'Initializing System Check...'}
                    {scanPhase.phase === 'scanning' && 'Scanning Diagnostics...'}
                    {scanPhase.phase === 'fixing' && 'Applying AI Fixes...'}
                  </>
                ) : activeTask ? (
                  <>
                    {activeTask.status === 'running' && activeTask.name}
                    {isDone && <span style={{ color: '#34d399' }}> ✓ Done</span>}
                    {isError && <span style={{ color: '#f87171' }}> ✗ Failed</span>}
                  </>
                ) : null}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {isScanning ? scanPhase.message : ''}
            </span>
          </div>

          <div style={{
            height: 3, background: 'rgba(255,255,255,0.04)',
            borderRadius: 2, overflow: 'hidden', position: 'relative',
          }}>
            <motion.div
              style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%',
                background: isDone ? '#34d399' : isError ? '#f87171' : scanPhase.phase === 'fixing' ? '#fbbf24' : 'var(--accent)',
                borderRadius: 2,
              }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{
                duration: isDone || isError ? 0 : 1.8,
                repeat: isDone || isError ? 0 : Infinity,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
