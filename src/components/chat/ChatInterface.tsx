import { useStore } from '../../store'
import { Bot, User, Activity, Zap, Wifi, HardDrive, Cpu, ArrowUpCircle, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocalAI } from '../../hooks/useLocalAI'

export function ChatInterface() {
  const { chatMessages, appendChatMessage, clearChat, ollamaStatus } = useStore()
  const { sendMessage, isGenerating } = useLocalAI()
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSend = () => {
    if (!input.trim() || isGenerating) return
    const msg = input.trim()
    setInput('')
    appendChatMessage({ id: Date.now().toString(), role: 'user', content: msg })
    sendMessage(msg)
  }

  const sendQuickAction = (content: string, actionName?: string) => {
    appendChatMessage({ id: Date.now().toString(), role: 'user', content })
    sendMessage(actionName || content)
  }

  const quickActions = [
    { label: 'One Click Diagnose', icon: Activity, onClick: () => sendQuickAction('One Click Diagnose', 'diagnose') },
    { label: 'Show system specs', icon: Cpu, onClick: () => sendQuickAction('Show my system specs') },
    { label: 'Speed up startup', icon: Zap, onClick: () => sendQuickAction('Speed up my startup') },
    { label: 'Fix my internet', icon: Wifi, onClick: () => sendQuickAction('Fix my internet') },
    { label: 'Boost my PC', icon: ArrowUpCircle, onClick: () => sendQuickAction('Boost my PC') },
    { label: 'Clean up disk', icon: HardDrive, onClick: () => sendQuickAction('Clean up disk space') },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '28px 32px 24px',
      maxWidth: 960, margin: '0 auto', width: '100%',
      minHeight: 400,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>
            <Bot size={22} color="white" strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{
              fontSize: 20, margin: 0, fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff, #c0d0e4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              PCFixAI
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ollamaStatus === 'ready' ? 'AI-powered via Ollama' : 'Offline PC Repair'}
            </span>
          </div>
          <div style={{
            padding: '3px 10px', borderRadius: 'var(--r-full)',
            background: ollamaStatus === 'ready' ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${ollamaStatus === 'ready' ? 'rgba(52,211,153,0.25)' : 'var(--border-dim)'}`,
            fontSize: 10, fontWeight: 600,
            color: ollamaStatus === 'ready' ? '#34d399' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: ollamaStatus === 'ready' ? '#34d399' : 'var(--text-muted)',
              boxShadow: ollamaStatus === 'ready' ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
            }} />
            {ollamaStatus === 'ready' ? 'AI Connected' : 'Rule-based'}
          </div>
        </div>
        {chatMessages.length > 1 && (
          <button
            onClick={() => { if (window.confirm('Clear all chat messages?')) clearChat() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border-mid)', borderRadius: 'var(--r2)',
              color: 'var(--text-muted)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.35)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Chat Feed */}
      <div ref={feedRef} style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
        padding: 16,
        background: 'rgba(11, 17, 32, 0.5)',
        backdropFilter: 'blur(12px)',
        borderRadius: 'var(--r3)',
        border: '1px solid var(--border-dim)',
      }}>
        <AnimatePresence initial={false}>
          {chatMessages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex', gap: 10,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1px solid rgba(0,212,255,0.12)',
                }}>
                  <Bot size={16} color="var(--accent)" strokeWidth={1.8} />
                </div>
              )}

              <div style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #00d4ff, #0088cc)'
                  : 'var(--bg-elevated)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                padding: '10px 16px',
                borderRadius: msg.role === 'user'
                  ? '14px 14px 4px 14px'
                  : '14px 14px 14px 4px',
                fontSize: 13, lineHeight: 1.65,
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-dim)',
                whiteSpace: 'pre-wrap',
                boxShadow: msg.role === 'user'
                  ? '0 2px 12px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : 'var(--shadow-xs)',
              }}>
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <User size={16} color="var(--text-secondary)" strokeWidth={1.8} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', gap: 10, alignSelf: 'flex-start', maxWidth: '85%' }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: '1px solid rgba(0,212,255,0.12)',
              }}>
                <Bot size={16} color="var(--accent)" strokeWidth={1.8} />
              </div>
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)',
                borderRadius: '14px 14px 14px 4px',
                padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)', opacity: 0.6,
                    animation: `pulse 1.4s ease-in-out infinite ${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {quickActions.map(action => {
          const Icon = action.icon
          return (
            <motion.button
              key={action.label}
              onClick={action.onClick}
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 16px', background: 'transparent',
                border: '1px solid var(--border-mid)', borderRadius: 'var(--r-full)',
                color: 'var(--text-secondary)', fontSize: 12,
                cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
                e.currentTarget.style.color = '#00d4ff'
                e.currentTarget.style.background = 'rgba(0,212,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-mid)'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon size={14} strokeWidth={1.8} />
              {action.label}
            </motion.button>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
        background: inputFocused
          ? 'rgba(0, 212, 255, 0.04)'
          : 'rgba(255,255,255,0.02)',
        border: inputFocused ? '1px solid rgba(0,212,255,0.25)' : '1px solid var(--border-mid)',
        padding: '8px 10px 8px 16px', borderRadius: 'var(--r4)',
        boxShadow: inputFocused
          ? '0 0 0 3px rgba(0,212,255,0.06), 0 4px 24px rgba(0,0,0,0.2)'
          : 'var(--shadow-xs)',
        transition: 'all var(--transition-normal)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Ask about PC issues, or use a quick action above..."
          disabled={isGenerating}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
        <motion.button
          onClick={handleSend}
          disabled={isGenerating || !input.trim()}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: (isGenerating || !input.trim())
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(135deg, #00d4ff, #0088cc)',
            border: 'none',
            color: (isGenerating || !input.trim()) ? 'var(--text-muted)' : 'white',
            cursor: (isGenerating || !input.trim()) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (isGenerating || !input.trim()) ? 0.5 : 1,
            boxShadow: (isGenerating || !input.trim())
              ? 'none'
              : '0 2px 10px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <ArrowUpCircle size={20} strokeWidth={1.8} />
        </motion.button>
      </div>
    </div>
  )
}
