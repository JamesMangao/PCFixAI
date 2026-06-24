import { useEffect, useRef, useState } from 'react'
import { useStore, LogLine } from '../../store'
import { runRawCommand } from '../../hooks/useTauriEvents'

export function ConsoleLog() {
  const { consoleLogs, clearLogs } = useStore()
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleRun()
    } else if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setInput(history[history.length - 1 - idx] ?? '')
    } else if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : (history[history.length - 1 - idx] ?? ''))
    }
  }

  async function handleRun() {
    const cmd = input.trim()
    if (!cmd) return
    setHistory((h) => [...h, cmd])
    setHistIdx(-1)
    setInput('')

    const parts = cmd.split(/\s+/)
    const [prog, ...args] = parts
    await runRawCommand(prog, args)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-void)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--r3)',
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-dim)',
      }}>
        <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', fontSize: 11 }}>
          TERMINAL — stdout/stderr
        </span>
        <button
          onClick={clearLogs}
          style={{
            fontSize: 11, color: 'var(--text-muted)',
            background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}>
          clear
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', lineHeight: 1.6 }}>
        {consoleLogs.length === 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            No output yet. Run a scan or type a command below.
          </span>
        )}
        {consoleLogs.map((l, i) => (
          <LogRow key={i} line={l} />
        ))}
        <div ref={endRef} />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-surface)',
      }}>
        <span style={{ color: 'var(--accent)', userSelect: 'none' }}>$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="powershell -Command '...'"
          spellCheck={false}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        />
        <button
          onClick={handleRun}
          style={{
            padding: '3px 12px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--border-hot)',
            borderRadius: 'var(--r1)',
            color: 'var(--accent)',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}>
          Run
        </button>
      </div>
    </div>
  )
}

function LogRow({ line }: { line: LogLine }) {
  const isErr = line.stream === 'stderr'
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      color: isErr ? 'var(--danger)' : 'var(--text-code)',
      wordBreak: 'break-all',
      paddingBottom: 1,
    }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 10 }}>
        {new Date(line.timestamp).toLocaleTimeString()}
      </span>
      <span>{line.line}</span>
    </div>
  )
}
