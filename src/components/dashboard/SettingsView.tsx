import { Settings, Shield, Cpu, Paintbrush, Bell, Bot } from 'lucide-react'
import { useStore } from '../../store'

export function SettingsView() {
  const { settings, updateSettings, ollamaStatus } = useStore()

  function toggle(key: 'compactMode' | 'localModelExecution' | 'autoRestorePoints' | 'backgroundScans' | 'notifications') {
    updateSettings({ [key]: !settings[key] })
  }

  const settingsSections = [
    {
      title: 'Appearance', icon: Paintbrush,
      items: [
        { name: 'Theme', type: 'select', value: settings.theme, onChange: (v: string) => updateSettings({ theme: v }),
          options: [
            { value: 'dark', label: 'Dark (Default)' },
            { value: 'midnight', label: 'Midnight Blue' },
            { value: 'light', label: 'Light' },
          ]
        },
        { name: 'Compact Mode', type: 'toggle', value: settings.compactMode, onChange: () => toggle('compactMode'),
          desc: 'Reduce padding and spacing for a denser UI' },
      ]
    },
    {
      title: 'AI Diagnostics', icon: Cpu,
      items: [
        { name: 'Local Model Execution', type: 'toggle', value: settings.localModelExecution,
          desc: 'Keep diagnostic logic locally on device', onChange: () => toggle('localModelExecution') },
        { name: 'Auto-Fix Severity Threshold', type: 'select', value: settings.autoFixThreshold === 'high' ? 'High & Critical' : 'All Issues',
          onChange: (v: string) => updateSettings({ autoFixThreshold: v }),
          options: [
            { value: 'High & Critical', label: 'High & Critical' },
            { value: 'All Issues', label: 'All Issues' },
          ]
        },
      ]
    },
    {
      title: 'Ollama AI', icon: Bot,
      items: [
        { name: 'Status', type: 'info', value: ollamaStatus === 'ready' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Not connected',
          desc: ollamaStatus === 'ready' ? `Using ${settings.ollamaModel}` : 'Install Ollama for AI-powered chat' },
        { name: 'Model Name', type: 'input', value: settings.ollamaModel,
          desc: 'Ollama model (e.g., llama3.2:3b, phi3:mini)',
          onChange: (v: string) => updateSettings({ ollamaModel: v }) },
      ]
    },
    {
      title: 'System Integration', icon: Shield,
      items: [
        { name: 'Auto Restore Points', type: 'toggle', value: settings.autoRestorePoints, onChange: () => toggle('autoRestorePoints'),
          desc: 'Create a restore point before system changes' },
        { name: 'Background Scans', type: 'toggle', value: settings.backgroundScans, onChange: () => toggle('backgroundScans'),
          desc: 'Periodically scan for issues in the background' },
      ]
    },
    {
      title: 'Notifications & Logging', icon: Bell,
      items: [
        { name: 'Show Notifications', type: 'toggle', value: settings.notifications, onChange: () => toggle('notifications'),
          desc: 'Desktop notifications for scan results' },
        { name: 'Log Retention', type: 'select', value: settings.logRetention + ' days',
          onChange: (v: string) => updateSettings({ logRetention: parseInt(v) }),
          options: [
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: '365', label: '1 year' },
          ]
        },
      ]
    },
  ]

  return (
    <div style={{
      width: '100%', maxWidth: 800, margin: '0 auto', padding: 32,
      display: 'flex', flexDirection: 'column', gap: 24, height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.04))',
          border: '1px solid rgba(0,212,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={22} color="#00d4ff" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{
            fontSize: 22, margin: 0, fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff, #c0d0e4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Settings
          </h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Manage your application preferences
          </span>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {settingsSections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--r3)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xs)',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-dim)',
                background: 'rgba(255,255,255,0.015)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Icon size={16} color="#00d4ff" strokeWidth={1.8} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {section.title}
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {section.items.map((item: any, idx: number) => (
                  <div key={item.name} style={{
                    padding: '14px 18px',
                    borderBottom: idx < section.items.length - 1 ? '1px solid var(--border-dim)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</div>
                      {item.desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.desc}</div>}
                    </div>
                    {item.type === 'toggle' ? (
                      <div onClick={item.onChange} style={{
                        width: 42, height: 22, borderRadius: 11,
                        background: item.value ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        border: item.value ? 'none' : '1px solid var(--border-mid)',
                        position: 'relative', cursor: 'pointer', transition: 'all 200ms',
                        boxShadow: item.value ? '0 0 12px rgba(0,212,255,0.2)' : 'none',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%',
                          background: 'white',
                          position: 'absolute', top: item.value ? 3 : 2.5,
                          left: item.value ? 23 : 3,
                          transition: 'all 200ms var(--ease-spring)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                        }} />
                      </div>
                    ) : item.type === 'input' ? (
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => item.onChange?.(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--border-mid)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px', borderRadius: 'var(--r1)',
                          fontSize: 12, outline: 'none', width: 180,
                          transition: 'border-color 150ms',
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
                      />
                    ) : item.type === 'info' ? (
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: item.value === 'Connected' ? '#34d399' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: item.value === 'Connected' ? '#34d399' : 'var(--text-muted)',
                          boxShadow: item.value === 'Connected' ? '0 0 6px rgba(52,211,153,0.4)' : 'none',
                        }} />
                        {item.value}
                      </span>
                    ) : (
                      <select
                        value={item.value}
                        onChange={(e) => item.onChange?.(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--border-mid)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px', borderRadius: 'var(--r1)',
                          fontSize: 12, outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {item.options?.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reset */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-mid)',
        borderRadius: 'var(--r3)',
        padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Reset All Settings</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Restore all settings to defaults</div>
        </div>
        <button
          onClick={() => { if (window.confirm('Reset all settings to defaults?')) updateSettings({ compactMode: false, localModelExecution: true, autoFixThreshold: 'high', autoRestorePoints: true, backgroundScans: false, theme: 'dark', notifications: true, logRetention: 30, ollamaModel: 'llama3.2:3b' }) }}
          style={{
            padding: '6px 16px', background: 'transparent',
            border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--r2)',
            color: '#f87171', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Reset Defaults
        </button>
      </div>
    </div>
  )
}
