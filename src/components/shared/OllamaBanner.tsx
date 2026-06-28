import { useState, useEffect } from 'react'
import { X, Download, Play, Loader2, Bot } from 'lucide-react'
import { useStore } from '../../store'
import {
  checkOllamaAvailable,
  checkOllamaInstalled,
  installOllama,
  startOllama,
  pullOllamaModel,
} from '../../hooks/useLocalAI'

export function OllamaBanner() {
  const { ollamaStatus, setOllamaStatus, settings } = useStore()
  const [dismissed, setDismissed] = useState(false)
  const [pullProgress, setPullProgress] = useState('')

  useEffect(() => {
    if (dismissed) return
    detectOllama()
  }, [dismissed])

  async function detectOllama() {
    setOllamaStatus('checking')

    // Check if Ollama is running
    const running = await checkOllamaAvailable()
    if (running) {
      setOllamaStatus('ready')
      return
    }

    // Check if installed but not running
    const installed = await checkOllamaInstalled()
    if (installed) {
      setOllamaStatus('installed_not_running')
      return
    }

    setOllamaStatus('not_installed')
  }

  async function handleInstall() {
    setOllamaStatus('installing')
    const success = await installOllama()
    if (!success) {
      setOllamaStatus('not_installed')
      return
    }

    // Try to start Ollama
    setOllamaStatus('starting')
    const started = await startOllama()
    if (!started) {
      setOllamaStatus('installed_not_running')
      return
    }

    // Pull the model
    setOllamaStatus('pulling_model')
    setPullProgress('Downloading model...')
    const pulled = await pullOllamaModel(settings.ollamaModel)
    if (pulled) {
      setOllamaStatus('ready')
    } else {
      setPullProgress('')
      setOllamaStatus('ready')
    }
  }

  async function handleStart() {
    setOllamaStatus('starting')
    const started = await startOllama()
    if (started) {
      setOllamaStatus('ready')
    } else {
      setOllamaStatus('installed_not_running')
    }
  }

  if (dismissed || ollamaStatus === 'ready') {
    if (ollamaStatus === 'ready' && !dismissed) {
      // Auto-dismiss after 5 seconds
      setTimeout(() => setDismissed(true), 5000)
    }
    if (ollamaStatus === 'ready') return null
  }

  if (ollamaStatus === 'checking') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'rgba(0,170,255,0.06)',
        borderBottom: '1px solid rgba(0,170,255,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>Checking for Ollama...</span>
        </div>
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
        }}>
          <X size={14} />
        </button>
      </div>
    )
  }

  if (ollamaStatus === 'not_installed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(255,171,64,0.08)',
        borderBottom: '1px solid rgba(255,171,64,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--warning)' }}>
            For AI-powered advice, install Ollama and pull a language model.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleInstall}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,171,64,0.5)',
              borderRadius: 'var(--r1)',
              color: 'var(--warning)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Download size={12} />
            Install Ollama
          </button>
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
          }}>
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  if (ollamaStatus === 'installing' || ollamaStatus === 'starting' || ollamaStatus === 'pulling_model') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'rgba(0,170,255,0.06)',
        borderBottom: '1px solid rgba(0,170,255,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>
            {ollamaStatus === 'installing' && 'Installing Ollama via winget...'}
            {ollamaStatus === 'starting' && 'Starting Ollama service...'}
            {ollamaStatus === 'pulling_model' && `Downloading ${settings.ollamaModel} (~2 GB)... ${pullProgress}`}
          </span>
        </div>
      </div>
    )
  }

  if (ollamaStatus === 'installed_not_running') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(255,171,64,0.08)',
        borderBottom: '1px solid rgba(255,171,64,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--warning)' }}>
            Ollama is installed but not running. Start it to enable AI responses.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleStart}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,171,64,0.5)',
              borderRadius: 'var(--r1)',
              color: 'var(--warning)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Play size={12} />
            Start Ollama
          </button>
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
          }}>
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return null
}
