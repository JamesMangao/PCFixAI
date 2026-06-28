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
    { label: 'Show my system specs', icon: Cpu, onClick: () => sendQuickAction('Show my system specs') },
    { label: 'Speed up my startup', icon: Zap, onClick: () => sendQuickAction('Speed up my startup') },
    { label: 'Fix my internet', icon: Wifi, onClick: () => sendQuickAction('Fix my internet') },
    { label: 'Boost my PC', icon: ArrowUpCircle, onClick: () => sendQuickAction('Boost my PC') },
    { label: 'Clean up disk space', icon: HardDrive, onClick: () => sendQuickAction('Clean up disk space') },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: 'var(--s8) var(--s8) var(--s6)',
      maxWidth: 1000, margin: '0 auto', width: '100%',
      minHeight: 400,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,212,255,0.3)',
          }}>
            <Bot size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>PCFixAI <span style={{
              fontSize: 12,
              color: ollamaStatus === 'ready' ? 'var(--success)' : 'var(--text-muted)',
              fontWeight: 500
            }}>
              {ollamaStatus === 'ready' ? '• AI Connected' :
               ollamaStatus === 'checking' ? '• Checking...' :
               '• Rule-based'}
            </span></h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {ollamaStatus === 'ready' ? 'AI-powered via Ollama' : 'Offline PC Repair'}
            </span>
          </div>
        </div>
        {chatMessages.length > 1 && (
          <button
            onClick={() => { if (window.confirm('Clear all chat messages?')) clearChat() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s2)',
              padding: '6px 12px', background: 'transparent',
              border: '1px solid var(--border-mid)', borderRadius: 'var(--r2)',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(255,82,82,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat Feed */}
      <div ref={feedRef} style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--s4)',
        padding: 'var(--s4)', background: 'var(--bg-elevated)', borderRadius: 'var(--r3)',
        border: '1px solid var(--border-dim)'
      }}>
        <AnimatePresence initial={false}>
          {chatMessages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex', gap: 'var(--s3)',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1px solid rgba(0,212,255,0.15)',
                }}>
                  <Bot size={18} color="var(--accent)" />
                </div>
              )}
              
              <div style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #00d4ff, #00b8d9)'
                  : 'var(--bg-surface)',
                color: msg.role === 'user' ? 'var(--bg-void)' : 'var(--text-primary)',
                padding: 'var(--s3) var(--s4)',
                borderRadius: msg.role === 'user' ? 'var(--r3) var(--r3) var(--r1) var(--r3)' : 'var(--r3) var(--r3) var(--r3) var(--r1)',
                fontSize: 14, lineHeight: 1.6,
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-mid)',
                whiteSpace: 'pre-wrap',
                boxShadow: msg.role === 'user'
                  ? '0 2px 8px rgba(0,212,255,0.2)'
                  : 'var(--shadow-sm)',
              }}>
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <User size={18} color="var(--text-secondary)" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                display: 'flex', gap: 'var(--s3)', alignSelf: 'flex-start', maxWidth: '85%'
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: '1px solid rgba(0,212,255,0.15)',
              }}>
                <Bot size={18} color="var(--accent)" />
              </div>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-mid)',
                borderRadius: 'var(--r3) var(--r3) var(--r3) var(--r1)',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite 0.2s' }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s ease-in-out infinite 0.4s' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', marginTop: 'var(--s6)' }}>
        {quickActions.map(action => {
          const Icon = action.icon
          return (
            <motion.button
              key={action.label}
              onClick={action.onClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--s2)',
                padding: '8px 16px', background: 'transparent',
                border: '1px solid var(--border-mid)', borderRadius: 20,
                color: 'var(--text-primary)', fontSize: 13,
                cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.background = 'var(--accent-subtle)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-mid)'
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon size={16} />
              {action.label}
            </motion.button>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s3)', marginTop: 'var(--s4)',
        background: 'var(--bg-elevated)',
        border: inputFocused ? '1px solid var(--accent)' : '1px solid var(--border-mid)',
        padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r3)',
        boxShadow: inputFocused ? '0 0 0 3px var(--accent-dim), 0 0 20px rgba(0,212,255,0.1)' : 'none',
        transition: 'all var(--transition-fast)',
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
            color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit'
          }}
        />
        <motion.button
          onClick={handleSend}
          disabled={isGenerating || !input.trim()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: (isGenerating || !input.trim()) ? 'var(--accent-dim)' : 'linear-gradient(135deg, #00d4ff, #0099cc)',
            border: 'none',
            color: (isGenerating || !input.trim()) ? 'var(--accent)' : 'white',
            cursor: (isGenerating || !input.trim()) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (isGenerating || !input.trim()) ? 0.5 : 1,
            boxShadow: (isGenerating || !input.trim()) ? 'none' : '0 2px 8px rgba(0,212,255,0.3)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <ArrowUpCircle size={20} />
        </motion.button>
      </div>
    </div>
  )
}
