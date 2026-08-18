import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, X } from 'lucide-react'
import { useStore } from '../../store'

const STORAGE_KEY = 'pcfixai_update_notes_version'
const CURRENT_VERSION = '1.4.0'

interface UpdateNote {
  category: string
  icon: string
  color: string
  items: string[]
}

const UPDATE_NOTES: UpdateNote[] = [
  {
    category: 'Built-in Auto-Updater',
    icon: '🔄',
    color: '#34d399',
    items: [
      'Background update checks every 4 hours (plus on startup)',
      'In-app update banner with download, install, skip, and dismiss controls',
      'Real-time download progress bar',
      'Seamless auto-restart after update installation',
      'Skip specific versions without dismissing the updater',
    ],
  },
  {
    category: 'Premium UI Refresh',
    icon: '✨',
    color: '#a78bfa',
    items: [
      'Redesigned glassmorphism interface with refined gradients and shadows',
      'Added maximize/restore button to the window title bar',
      'Premium chat bubbles with refined visual hierarchy',
      'Polished dashboard cards with hover effects and glow accents',
      'New "What\'s New" update notes shown on first launch',
    ],
  },
  {
    category: 'Windows 10 & 11 Compatibility',
    icon: '🖥️',
    color: '#00d4ff',
    items: [
      'Improved Windows 10 support with automatic winget detection and installation guidance',
      'Windows 11 troubleshooter fallbacks — modern Settings pages open when msdt.exe is unavailable (Win11 24H2+)',
      'Windows version detection now distinguishes between Windows 10 and Windows 11 builds',
      'Enhanced WMI queries with better error handling for older Windows 10 builds',
      'Browser cache cleanup expanded to include Brave, Vivaldi, Opera, and Service Worker caches',
    ],
  },
  {
    category: 'Performance & Reliability',
    icon: '⚡',
    color: '#fbbf24',
    items: [
      'Live Metrics panel now displays real system metrics from your hardware',
      'Deep performance escalation now performs thorough cleanup including browser caches',
      'Fixed control flow in fix functions for more reliable error recovery',
      'Defensive WMI queries for disk health, RAM, disk I/O, and network counters',
      'Network escalation emits agent-step events for status visibility',
      'Ollama connection quality checks and model verification',
    ],
  },
]

export function UpdateNotes() {
  const [visible, setVisible] = useState(false)
  const { privilegeChecked } = useStore()

  useEffect(() => {
    if (!privilegeChecked) return
    const seenVersion = localStorage.getItem(STORAGE_KEY)
    if (seenVersion !== CURRENT_VERSION) {
      const timer = setTimeout(() => setVisible(true), 700)
      return () => clearTimeout(timer)
    }
  }, [privilegeChecked])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4, 8, 14, 0.88)',
            backdropFilter: 'blur(16px)',
          }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 500, maxWidth: '92vw', maxHeight: '80vh',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--r5)',
              border: '1px solid var(--border-mid)',
              boxShadow: '0 48px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Top accent line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, #00d4ff, #a78bfa, #34d399)',
            }} />

            {/* Header */}
            <div style={{
              padding: '24px 28px 20px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(168,85,247,0.04))',
              borderBottom: '1px solid var(--border-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}>
                  <Sparkles size={20} color="white" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    What's New
                  </h2>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    PCFixAI v{CURRENT_VERSION}
                  </span>
                </div>
              </div>
              <button onClick={dismiss} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 6, borderRadius: 'var(--r1)',
                transition: 'all 150ms',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px 28px',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              {UPDATE_NOTES.map((section) => (
                <div key={section.category}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 15 }}>{section.icon}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: section.color,
                      letterSpacing: '0.02em',
                    }}>
                      {section.category}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 7,
                    paddingLeft: 30,
                  }}>
                    {section.items.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontSize: 12, lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          background: `${section.color}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={10} style={{ color: section.color }} strokeWidth={2.5} />
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--border-dim)',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button onClick={dismiss} style={{
                padding: '10px 32px',
                background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
                border: 'none', borderRadius: 'var(--r2)',
                color: 'white', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 150ms',
                letterSpacing: '0.02em',
              }}>
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
