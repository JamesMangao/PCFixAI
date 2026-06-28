import { Settings, Shield, Cpu, Paintbrush, Bell } from 'lucide-react'
import { useStore } from '../../store'

export function SettingsView() {
  const { settings, updateSettings } = useStore()

  function toggle(key: 'compactMode' | 'localModelExecution' | 'autoRestorePoints' | 'backgroundScans' | 'notifications') {
    updateSettings({ [key]: !settings[key] })
  }

  const settingsSections = [
    {
      title: 'Appearance',
      icon: Paintbrush,
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
      title: 'AI Diagnostics',
      icon: Cpu,
      items: [
        { name: 'Local Model Execution', type: 'toggle', value: settings.localModelExecution, desc: 'Keep all diagnostic logic locally on device', onChange: () => toggle('localModelExecution') },
        { name: 'Auto-Fix Severity Threshold', type: 'select', value: settings.autoFixThreshold === 'high' ? 'High & Critical' : 'All Issues', onChange: (v: string) => updateSettings({ autoFixThreshold: v }),
          options: [
            { value: 'High & Critical', label: 'High & Critical' },
            { value: 'All Issues', label: 'All Issues' },
          ]
        },
      ]
    },
    {
      title: 'System Integration',
      icon: Shield,
      items: [
        { name: 'Create Restore Points Automatically', type: 'toggle', value: settings.autoRestorePoints, onChange: () => toggle('autoRestorePoints'),
          desc: 'Create a restore point before any system changes' },
        { name: 'Run Background Scans', type: 'toggle', value: settings.backgroundScans, onChange: () => toggle('backgroundScans'),
          desc: 'Periodically scan for issues in the background' },
      ]
    },
    {
      title: 'Notifications & Logging',
      icon: Bell,
      items: [
        { name: 'Show Notifications', type: 'toggle', value: settings.notifications, onChange: () => toggle('notifications'),
          desc: 'Show desktop notifications for scan results and fixes' },
        { name: 'Log Retention', type: 'select', value: settings.logRetention + ' days', onChange: (v: string) => updateSettings({ logRetention: parseInt(v) }),
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
      width: '100%', maxWidth: 800, margin: '0 auto', padding: 'var(--s8)',
      display: 'flex', flexDirection: 'column', gap: 'var(--s6)', height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={24} color="var(--accent)" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 600 }}>Settings</h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Manage your application preferences</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
        {settingsSections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 'var(--r3)', overflow: 'hidden'
            }}>
              <div style={{ padding: 'var(--s4)', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                <Icon size={18} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{section.title}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {section.items.map((item: any, idx: number) => (
                  <div key={item.name} style={{
                    padding: 'var(--s4)', borderBottom: idx < section.items.length - 1 ? '1px solid var(--border-dim)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
                      {item.desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--s1)' }}>{item.desc}</div>}
                    </div>
                    {item.type === 'toggle' ? (
                      <div onClick={item.onChange} style={{
                        width: 44, height: 24, borderRadius: 12, background: item.value ? 'var(--accent)' : 'var(--bg-surface)',
                        border: item.value ? 'none' : '1px solid var(--border-mid)', position: 'relative', cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          position: 'absolute', top: 3, left: item.value ? 23 : 3, transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    ) : (
                      <select
                        value={item.value}
                        onChange={(e) => item.onChange?.(e.target.value)}
                        style={{
                          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)',
                          padding: '4px 8px', borderRadius: 6, fontSize: 13, outline: 'none'
                        }}>
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

      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 'var(--r3)',
        padding: 'var(--s4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Reset All Settings</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--s1)' }}>Restore all settings to their default values</div>
        </div>
        <button
          onClick={() => { if (window.confirm('Reset all settings to defaults?')) updateSettings({ compactMode: false, localModelExecution: true, autoFixThreshold: 'high', autoRestorePoints: true, backgroundScans: false, theme: 'dark', notifications: true, logRetention: 30 }) }}
          style={{
            padding: '6px 14px', background: 'transparent',
            border: '1px solid var(--danger)', borderRadius: 'var(--r2)',
            color: 'var(--danger)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--danger)' }}
        >
          Reset Defaults
        </button>
      </div>
    </div>
  )
}
