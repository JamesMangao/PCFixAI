import { useState, useEffect, useRef } from 'react'
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
  const [startFailed, setStartFailed] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function init() {
      await detectOllama()
    }
    if (!dismissed) init()

    intervalRef.current = setInterval(async () => {
      const status = useStore.getState().ollamaStatus
      if (status === 'not_installed' || status === 'installed_not_running') {
        await detectOllama()
      }
    }, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [dismissed])

  async function detectOllama() {
    try {
      setStartFailed(false)
      setOllamaStatus('checking')

      const running = await checkOllamaAvailable()
      if (running) {
        setOllamaStatus('ready')
        return
      }

      const installed = await checkOllamaInstalled()
      if (installed) {
        setOllamaStatus('installed_not_running')
        return
      }

      setOllamaStatus('not_installed')
    } catch {
      setOllamaStatus('not_installed')
    }
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
    setStartFailed(false)
    setOllamaStatus('starting')
    const started = await startOllama()
    if (started) {
      setOllamaStatus('ready')
    } else {
      setStartFailed(true)
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
        display: 'flex', flexDirection: 'column',
        padding: '6px 16px 0',
        background: 'rgba(0,170,255,0.06)',
        borderBottom: '1px solid rgba(0,170,255,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>
              {ollamaStatus === 'installing' && 'Installing Ollama via winget...'}
              {ollamaStatus === 'starting' && 'Starting Ollama service...'}
              {ollamaStatus === 'pulling_model' && `Downloading ${settings.ollamaModel} (~2 GB)... ${pullProgress}`}
            </span>
          </div>
        </div>
        <div className="progress-bar-track" style={{ marginTop: 6, marginBottom: 4 }}>
          <div className="progress-bar-fill" />
        </div>
      </div>
    )
  }

  if (ollamaStatus === 'installed_not_running') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: startFailed ? '8px 16px 10px' : '8px 16px',
        background: startFailed ? 'rgba(255,64,64,0.06)' : 'rgba(255,171,64,0.08)',
        borderBottom: startFailed ? '1px solid rgba(255,64,64,0.2)' : '1px solid rgba(255,171,64,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: startFailed ? 4 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={14} style={{ color: startFailed ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: startFailed ? 'var(--danger)' : 'var(--warning)' }}>
              {startFailed
                ? 'Could not start Ollama. Try launching it manually.'
                : 'Ollama is installed but not running. Start it to enable AI responses.'}
            </span>
          </div>
          {startFailed && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 22, lineHeight: 1.4 }}>
              Open Ollama from the Start Menu, or run <strong>ollama serve</strong> in a terminal.
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!startFailed && (
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
          )}
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
