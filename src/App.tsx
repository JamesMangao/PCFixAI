import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { useTauriEvents } from './hooks/useTauriEvents'
import { TitleBar } from './components/shared/TitleBar'
import { PrivilegeBanner } from './components/shared/PrivilegeBanner'
import { Sidebar } from './components/shared/Sidebar'
import { Dashboard } from './components/dashboard/Dashboard'
import { ToolkitView } from './components/toolkit/ToolkitView'
import { ChatInterface } from './components/chat/ChatInterface'
import { HistoryView } from './components/dashboard/HistoryView'
import { SettingsView } from './components/dashboard/SettingsView'
import { GlobalProgressBar } from './components/shared/GlobalProgressBar'
import './styles/globals.css'
export default function App() {
  useTauriEvents()
  const { mode, isElevated } = useStore()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-void)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--border-mid)',
      boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    }}>
      <TitleBar />
      {!isElevated && <PrivilegeBanner />}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {mode === 'dashboard' && (
              <motion.div key="dashboard" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <Dashboard />
              </motion.div>
            )}

            {mode === 'toolkit' && (
              <motion.div key="toolkit" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <ToolkitView />
              </motion.div>
            )}

            {mode === 'diagnose' && (
              <motion.div key="diagnose" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <ChatInterface />
              </motion.div>
            )}

            {mode === 'history' && (
              <motion.div key="history" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <HistoryView />
              </motion.div>
            )}

            {mode === 'settings' && (
              <motion.div key="settings" style={{ height: '100%', overflowY: 'auto' }}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
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
