import { useStore } from '../../store'
import { Bot, User, Activity, Zap, Wifi, HardDrive, Cpu, ArrowUpCircle, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useLocalAI } from '../../hooks/useLocalAI'

export function ChatInterface() {
  const { chatMessages, appendChatMessage, clearChat } = useStore()
  const { sendMessage, isGenerating } = useLocalAI()
  const [input, setInput] = useState('')
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
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={24} color="var(--bg-void)" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>PCFixAI <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>• Online</span></h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Offline PC Repair</span>
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
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
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
        {chatMessages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 'var(--s3)',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%'
          }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={18} color="var(--accent)" />
              </div>
            )}
            
            <div style={{
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? 'var(--bg-void)' : 'var(--text-primary)',
              padding: 'var(--s3) var(--s4)',
              borderRadius: 'var(--r2)',
              fontSize: 14, lineHeight: 1.5,
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-mid)',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>

            {msg.role === 'user' && (
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} color="var(--text-secondary)" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', marginTop: 'var(--s6)' }}>
        {quickActions.map(action => {
          const Icon = action.icon
          return (
            <button key={action.label} onClick={action.onClick} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s2)',
              padding: '8px 16px', background: 'transparent',
              border: '1px solid var(--border-mid)', borderRadius: 20,
              color: 'var(--text-primary)', fontSize: 13,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-mid)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            >
              <Icon size={16} />
              {action.label}
            </button>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s3)', marginTop: 'var(--s4)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
        padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r3)'
      }}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about PC issues, or use a quick action above..."
          disabled={isGenerating}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit'
          }}
        />
        <button onClick={handleSend} disabled={isGenerating || !input.trim()} style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)',
          border: 'none', color: 'var(--accent)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: (isGenerating || !input.trim()) ? 0.5 : 1
        }}>
          <ArrowUpCircle size={20} />
        </button>
      </div>
    </div>
  )
}
