import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { useTauriEvents } from './hooks/useTauriEvents'
import { TitleBar } from './components/shared/TitleBar'
import { PrivilegeBanner } from './components/shared/PrivilegeBanner'
import { OllamaBanner } from './components/shared/OllamaBanner'
import { AdminPrompt } from './components/shared/AdminPrompt'
import { UpdateNotes } from './components/shared/UpdateNotes'
import { Sidebar } from './components/shared/Sidebar'
import { Dashboard } from './components/dashboard/Dashboard'
import { ToolkitView } from './components/toolkit/ToolkitView'
import { ChatInterface } from './components/chat/ChatInterface'
import { HistoryView } from './components/dashboard/HistoryView'
import { SettingsView } from './components/dashboard/SettingsView'
import { GlobalProgressBar } from './components/shared/GlobalProgressBar'
import { UpdateBanner } from './components/shared/UpdateBanner'
import { useUpdaterAutoCheck } from './hooks/useUpdater'
import './styles/globals.css'

export default function App() {
  useTauriEvents()
  useUpdaterAutoCheck()
  const { mode, isElevated, settings } = useStore()

  const themeClass = settings.theme === 'light' ? 'theme-light' : settings.theme === 'midnight' ? 'theme-midnight' : ''

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Quick scan
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        useStore.getState().setMode('dashboard')
      }
      // Ctrl+1-5: Switch views
      if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        const modes = ['dashboard', 'toolkit', 'diagnose', 'history', 'settings'] as const
        const idx = parseInt(e.key) - 1
        if (modes[idx]) useStore.getState().setMode(modes[idx])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={themeClass} style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-void)',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(0, 212, 255, 0.06)',
      boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
      position: 'relative',
    }}>
      {/* Top edge highlight */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.12), transparent)',
        zIndex: 10,
      }} />

      <AdminPrompt />
      <UpdateNotes />
      <TitleBar />
      {!isElevated && <PrivilegeBanner />}
      {!isElevated && <OllamaBanner />}
      <UpdateBanner />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(180deg, var(--bg-void) 0%, rgba(6,10,16,1) 100%)',
        }}>
          {/* Subtle corner glow */}
          <div style={{
            position: 'absolute', top: -100, right: -100,
            width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <AnimatePresence mode="wait">
            {mode === 'dashboard' && (
              <motion.div key="dashboard" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <Dashboard />
              </motion.div>
            )}

            {mode === 'toolkit' && (
              <motion.div key="toolkit" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <ToolkitView />
              </motion.div>
            )}

            {mode === 'diagnose' && (
              <motion.div key="diagnose" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <ChatInterface />
              </motion.div>
            )}

            {mode === 'history' && (
              <motion.div key="history" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <HistoryView />
              </motion.div>
            )}

            {mode === 'settings' && (
              <motion.div key="settings" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <SettingsView />
              </motion.div>
            )}
          </AnimatePresence>
          <GlobalProgressBar />
        </div>
      </div>
    </div>
  )
}
