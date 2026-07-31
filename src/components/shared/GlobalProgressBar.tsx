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
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            bottom: 'var(--s6)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--s2)',
            background: 'rgba(20, 20, 25, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--r3)',
            padding: 'var(--s3) var(--s4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            minWidth: 320,
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--s4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
              {isDone ? (
                <CheckCircle size={16} color="var(--success)" />
              ) : isError ? (
                <XCircle size={16} color="var(--danger)" />
              ) : scanPhase.phase === 'fixing' ? (
                <ShieldAlert size={16} color="var(--warning)" />
              ) : (
                <Loader2 size={16} color="var(--accent)" className="spin" />
              )}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {isScanning ? (
                  <>
                    {scanPhase.phase === 'starting' && 'Initializing System Check...'}
                    {scanPhase.phase === 'scanning' && 'Scanning Diagnostics...'}
                    {scanPhase.phase === 'fixing' && 'Applying AI Fixes...'}
                  </>
                ) : activeTask ? (
                  <>
                    {activeTask.status === 'running' && activeTask.name}
                    {isDone && <span style={{ color: 'var(--success)' }}>✓ Done</span>}
                    {isError && <span style={{ color: 'var(--danger)' }}>✗ Failed</span>}
                  </>
                ) : null}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {isScanning ? scanPhase.message : ''}
            </span>
          </div>

          {/* Indeterminate Progress Bar */}
          <div style={{ 
            height: 4, 
            background: 'var(--bg-surface)', 
            borderRadius: 2, 
            overflow: 'hidden',
            position: 'relative'
          }}>
            <motion.div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '30%',
                background: isDone ? 'var(--success)' : isError ? 'var(--danger)' : scanPhase.phase === 'fixing' ? 'var(--warning)' : 'var(--accent)',
                borderRadius: 2,
              }}
              animate={{
                x: ['-100%', '300%'],
              }}
              transition={{
                duration: isDone || isError ? 0 : 1.5,
                repeat: isDone || isError ? 0 : Infinity,
                ease: 'linear'
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}