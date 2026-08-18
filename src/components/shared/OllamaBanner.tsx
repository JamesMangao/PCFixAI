import { useState, useEffect, useRef } from 'react'
import { X, Download, Play, Loader2, Bot, CheckCircle } from 'lucide-react'
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
  const [connectionInfo, setConnectionInfo] = useState<{ latency: number; modelReady: boolean } | null>(null)
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
      } else if (status === 'ready') {
        // Check connection quality periodically
        await checkConnectionQuality()
      }
    }, 30000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [dismissed])

  async function checkConnectionQuality() {
    try {
      const start = Date.now()
      const available = await checkOllamaAvailable()
      if (!available) {
        setConnectionInfo(null)
        setOllamaStatus('installed_not_running')
        return
      }
      const latency = Date.now() - start

      // Check if model is loaded
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
          const data = await response.json()
          const models = data.models || []
          const modelReady = models.some((m: any) =>
            m.name?.includes(settings.ollamaModel) ||
            m.model?.includes(settings.ollamaModel)
          )
          setConnectionInfo({ latency, modelReady })
        }
      } catch {}
    } catch {}
  }

  async function detectOllama() {
    try {
      setStartFailed(false)
      setOllamaStatus('checking')

      const running = await checkOllamaAvailable()
      if (running) {
        setOllamaStatus('ready')
        await checkConnectionQuality()
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
    setOllamaStatus('starting')
    const started = await startOllama()
    if (!started) {
      setOllamaStatus('installed_not_running')
      return
    }
    setOllamaStatus('pulling_model')
    setPullProgress('Downloading model...')
    await pullOllamaModel(settings.ollamaModel)
    setOllamaStatus('ready')
    setPullProgress('')
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
      setTimeout(() => setDismissed(true), 6000)
    }
    if (ollamaStatus === 'ready') {
      // Show a brief connected indicator before auto-dismissing
      if (!dismissed && connectionInfo) {
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 16px',
            background: 'rgba(52,211,153,0.05)',
            borderBottom: '1px solid rgba(52,211,153,0.15)',
            flexShrink: 0,
            transition: 'opacity 0.5s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={13} style={{ color: '#34d399' }} strokeWidth={2} />
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 500 }}>
                Ollama connected · {connectionInfo.latency}ms latency
                {connectionInfo.modelReady ? ` · ${settings.ollamaModel} ready` : ' · model not loaded'}
              </span>
            </div>
            <button onClick={() => setDismissed(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
            }}>
              <X size={13} />
            </button>
          </div>
        )
      }
      return null
    }
  }

  if (ollamaStatus === 'checking') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 16px',
        background: 'rgba(0,212,255,0.04)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={13} className="spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Checking Ollama...</span>
        </div>
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
        }}>
          <X size={13} />
        </button>
      </div>
    )
  }

  if (ollamaStatus === 'not_installed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(167,139,250,0.06)',
        borderBottom: '1px solid rgba(167,139,250,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={13} style={{ color: '#a78bfa', flexShrink: 0 }} strokeWidth={1.8} />
          <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>
            Install Ollama for AI-powered chat responses
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={handleInstall} style={{
            padding: '4px 12px', background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.25)', borderRadius: 'var(--r1)',
            color: '#a78bfa', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Download size={11} /> Install
          </button>
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
          }}>
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  if (ollamaStatus === 'installing' || ollamaStatus === 'starting' || ollamaStatus === 'pulling_model') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '7px 16px 0',
        background: 'rgba(0,212,255,0.04)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={13} className="spin" style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
              {ollamaStatus === 'installing' && 'Installing Ollama via winget...'}
              {ollamaStatus === 'starting' && 'Starting Ollama service...'}
              {ollamaStatus === 'pulling_model' && `Downloading ${settings.ollamaModel}... ${pullProgress}`}
            </span>
          </div>
        </div>
        <div className="progress-bar-track" style={{ marginTop: 6, marginBottom: 4 }} />
      </div>
    )
  }

  if (ollamaStatus === 'installed_not_running') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: startFailed ? '8px 16px 10px' : '8px 16px',
        background: startFailed ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.06)',
        borderBottom: startFailed ? '1px solid rgba(248,113,113,0.15)' : '1px solid rgba(251,191,36,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: startFailed ? 4 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={13} style={{ color: startFailed ? '#f87171' : '#fbbf24', flexShrink: 0 }} strokeWidth={1.8} />
            <span style={{ fontSize: 11, color: startFailed ? '#f87171' : '#fbbf24', fontWeight: 500 }}>
              {startFailed
                ? 'Could not start Ollama — try launching it manually'
                : 'Ollama installed but not running'}
            </span>
          </div>
          {startFailed && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 21, lineHeight: 1.4 }}>
              Open from Start Menu, or run <strong>ollama serve</strong> in a terminal
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!startFailed && (
            <button onClick={handleStart} style={{
              padding: '4px 12px', background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)', borderRadius: 'var(--r1)',
              color: '#fbbf24', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Play size={10} /> Start
            </button>
          )}
          <button onClick={() => setDismissed(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
          }}>
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return null
}
