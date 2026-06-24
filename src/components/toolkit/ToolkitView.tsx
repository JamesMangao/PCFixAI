import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { runRawCommand } from '../../hooks/useTauriEvents'
import { useStore, JobEntry } from '../../store'
import {
  Cpu, HardDrive, Wifi, Wrench, Shield, Settings,
  Battery, Trash2, RefreshCw, Download, FileText,
  Printer, AlertTriangle, Zap, Power,
  Network, Database, Eye, Globe, Activity
} from 'lucide-react'
import { StartupManager } from './StartupManager'
import { ProcessManager } from './ProcessManager'
import { ServiceManager } from './ServiceManager'
import { UninstallManager } from './UninstallManager'

interface ToolkitAction {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  command: string
  args: string[]
  confirm?: string
  dangerous?: boolean
  adminRequired?: boolean
  internetRequired?: boolean
}

interface ToolkitCategory {
  id: string
  label: string
  color: string
  actions: ToolkitAction[]
}

const CATEGORIES: ToolkitCategory[] = [
  {
    id: 'performance',
    label: 'Core Performance & RAM',
    color: '#00d4ff',
    actions: [
      {
        id: 'ram-info',
        label: 'View RAM Status',
        description: 'Full system memory info and current usage snapshot',
        icon: Cpu,
        color: '#00d4ff',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory | Format-List; Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, Capacity, Speed, Manufacturer, PartNumber | Format-Table -AutoSize; tasklist /FI "MEMUSAGE gt 10000"'],
      },
      {
        id: 'kill-tasks',
        label: 'Close Frozen Apps',
        description: 'Kill non-responsive apps and heavy background tasks',
        icon: AlertTriangle,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Get-Process | Where-Object {$_.Responding -eq $false} | Stop-Process -Force -ErrorAction SilentlyContinue; taskkill /f /im msedge.exe 2>$null; taskkill /f /im chrome.exe 2>$null; Write-Output "Done"'],
      },
      {
        id: 'ram-opt',
        label: 'Full RAM Optimization',
        description: 'Clear standby list and optimize memory usage',
        icon: Zap,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', '[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; public class MM { [DllImport(\"kernel32.dll\")] public static extern bool SetSystemFileCacheSize(IntPtr min, IntPtr max, uint flags); }"; [MM]::SetSystemFileCacheSize([IntPtr](-1), [IntPtr](-1), 0); Write-Output "RAM optimized"'],
      },
      {
        id: 'sys-panels',
        label: 'Performance Options',
        description: 'Open Performance Options and Advanced System Settings',
        icon: Settings,
        color: '#7986cb',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process sysdm.cpl; Start-Process systempropertiesperformance.exe; Write-Output "Panels opened"'],
      },
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware & Diagnostics',
    color: '#ffab40',
    actions: [
      {
        id: 'mem-diag',
        label: 'Windows Memory Diagnostic',
        description: 'Schedule RAM hardware scan on next reboot',
        icon: Cpu,
        color: '#ffab40',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'mdsched.exe'],
        confirm: 'This will schedule a memory diagnostic scan on next reboot. Your PC will restart in 10 seconds.',
        adminRequired: true,
      },
      {
        id: 'battery-report',
        label: 'Battery Health Report',
        description: 'Generate laptop battery health report',
        icon: Battery,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'powercfg /batteryreport /output "$env:USERPROFILE\\Desktop\\battery_report.html"; Start-Process "$env:USERPROFILE\\Desktop\\battery_report.html"'],
      },
      {
        id: 'smart-status',
        label: 'Drive SMART Status',
        description: 'Check drive failure prediction (SMART) status',
        icon: HardDrive,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Get-WmiObject -Namespace root\\wmi -Class MSStorageDriver_FailurePredictStatus | Select-Object InstanceName, PredictFailure, Reason | Format-Table -AutoSize'],
      },
      {
        id: 'god-mode',
        label: 'Windows God Mode',
        description: 'Open the all-settings God Mode folder',
        icon: Eye,
        color: '#7986cb',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process "shell:::{ED7BA470-8E54-465E-825C-99712043E01C}"'],
      },
    ],
  },
  {
    id: 'cleanup',
    label: 'System Cleanup & Maintenance',
    color: '#00e676',
    actions: [
      {
        id: 'repair',
        label: 'System Repair (SFC + DISM)',
        description: 'Run DISM restore health and SFC scan',
        icon: Wrench,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'dism.exe /Online /Cleanup-image /Restorehealth; sfc /scannow'],
        adminRequired: true,
      },
      {
        id: 'deep-clean',
        label: 'Deep Disk Cleanup',
        description: 'WinSxS component reduction and old update cleanup',
        icon: Trash2,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase'],
        adminRequired: true,
      },
      {
        id: 'clean-temp',
        label: 'Clean Temp Files',
        description: 'Remove user and system temporary files',
        icon: Trash2,
        color: '#ffab40',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Temp files cleaned"'],
      },
      {
        id: 'fix-icons',
        label: 'Fix Folder Icons & Thumbnails',
        description: 'Clear thumbnail and icon cache to fix broken icons',
        icon: Database,
        color: '#7986cb',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Remove-Item -Path "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer\\thumbcache_*.db" -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:LOCALAPPDATA\\IconCache.db" -Force -ErrorAction SilentlyContinue; Start-Process explorer.exe; Write-Output "Icon cache cleared"'],
      },
      {
        id: 'wupdate-cache',
        label: 'Clear Windows Update Cache',
        description: 'Fix stuck updates by clearing the update cache',
        icon: RefreshCw,
        color: '#00d4ff',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Stop-Service -Name wuauserv -Force; Stop-Service -Name bits -Force; Remove-Item -Path "$env:WINDIR\\SoftwareDistribution" -Recurse -Force -ErrorAction SilentlyContinue; New-Item -Path "$env:WINDIR\\SoftwareDistribution" -ItemType Directory -Force | Out-Null; Start-Service -Name wuauserv; Start-Service -Name bits; Write-Output "Update cache cleared"'],
        adminRequired: true,
      },
      {
        id: 'mrt',
        label: 'Malicious Software Removal',
        description: 'Run Microsoft MRT malware scanner',
        icon: Shield,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'if (Test-Path "$env:WINDIR\\System32\\MRT.exe") { & "$env:WINDIR\\System32\\MRT.exe" } else { Write-Output "MRT.exe not found" }'],
      },
      {
        id: 'volume-opt',
        label: 'SSD/HDD Optimization',
        description: 'Run TRIM on SSDs or defrag on HDDs',
        icon: HardDrive,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Get-PhysicalDisk | Select-Object DeviceID, MediaType, FriendlyName | Format-Table -AutoSize; Optimize-Volume -DriveLetter C -ReTrim -Verbose'],
        adminRequired: true,
      },
      {
        id: 'driver-backup',
        label: 'Backup Device Drivers',
        description: 'Export all installed drivers to a folder',
        icon: Download,
        color: '#ffab40',
        command: 'powershell',
        args: ['-NoProfile', '-Command', '$dest = "$env:USERPROFILE\\Desktop\\DriverBackup"; if (!(Test-Path $dest)) { New-Item -Path $dest -ItemType Directory | Out-Null }; dism /online /export-driver /destination:"$dest"; Write-Output "Drivers exported to $dest"'],
        adminRequired: true,
      },
    ],
  },
  {
    id: 'network',
    label: 'Troubleshooting Wizards',
    color: '#7986cb',
    actions: [
      {
        id: 'net-fix',
        label: 'Internet & Wi-Fi Fixer',
        description: 'Flush DNS, reset Winsock, and renew IP',
        icon: Wifi,
        color: '#00d4ff',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'ipconfig /flushdns; netsh winsock reset; netsh int ip reset; ipconfig /release; ipconfig /renew; Write-Output "Network reset complete"'],
        adminRequired: true,
      },
      {
        id: 'net-deep-reset',
        label: 'Full Network Stack Reset',
        description: 'Deep reset all network components (requires reboot)',
        icon: Network,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'netcfg -d'],
        confirm: 'This is a deep network reset that requires a reboot. All network bindings will be restored to factory state.',
        adminRequired: true,
      },
      {
        id: 'hw-trouble',
        label: 'Network & Bluetooth Troubleshooter',
        description: 'Launch Windows hardware diagnostic wizards',
        icon: Wrench,
        color: '#7986cb',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process msdt.exe -ArgumentList "/id NetworkDiagnosticsWeb"; Start-Process msdt.exe -ArgumentList "/id DeviceDiagnostic"; Start-Process msdt.exe -ArgumentList "/id BluetoothDiagnostic"'],
      },
      {
        id: 'update-trouble',
        label: 'Windows Update Troubleshooter',
        description: 'Launch Windows Update and BITS diagnostic wizards',
        icon: RefreshCw,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process msdt.exe -ArgumentList "/id WindowsUpdateDiagnostic"; Start-Process msdt.exe -ArgumentList "/id BitsDiagnostic"'],
      },
      {
        id: 'compat-trouble',
        label: 'Program Compatibility Wizard',
        description: 'Launch program compatibility diagnostic',
        icon: Settings,
        color: '#ffab40',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process msdt.exe -ArgumentList "/id PCWDiagnostic"'],
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced Utilities',
    color: '#ff5252',
    actions: [
      {
        id: 'safe-mode',
        label: 'Safe Mode (Networking)',
        description: 'Boot into Safe Mode with Networking next restart',
        icon: Power,
        color: '#ff5252',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'bcdedit /set {current} safeboot network'],
        confirm: 'This will set your PC to boot into Safe Mode on next restart.',
        adminRequired: true,
      },
      {
        id: 'normal-boot',
        label: 'Reset to Normal Boot',
        description: 'Restore normal boot behavior',
        icon: Power,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'bcdedit /deletevalue {current} safeboot'],
        adminRequired: true,
      },
    ],
  },
  {
    id: 'drivers',
    label: 'Driver & Printer Tools',
    color: '#9c27b0',
    actions: [
      {
        id: 'driver-query',
        label: 'View Installed Drivers',
        description: 'List all installed drivers with verbose details',
        icon: FileText,
        color: '#9c27b0',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'driverquery /v /fo table'],
      },
      {
        id: 'driver-update',
        label: 'Auto Update Drivers',
        description: 'Scan and install all driver updates via Windows Update',
        icon: Download,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'if (-not (Get-Module -ListAvailable -Name PSWindowsUpdate)) { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null; Install-Module PSWindowsUpdate -Force -Scope CurrentUser -AllowClobber | Out-Null }; Import-Module PSWindowsUpdate; Get-WindowsUpdate -UpdateType Driver -Verbose; Install-WindowsUpdate -UpdateType Driver -AcceptAll -IgnoreReboot -Verbose'],
        adminRequired: true,
      },
      {
        id: 'printer-fix',
        label: 'Printer Auto-Troubleshooter',
        description: 'Fix stuck/offline printers, clear queue, restart spooler',
        icon: Printer,
        color: '#e91e63',
        command: 'powershell',
        args: ['-NoProfile', '-Command', 'net stop spooler; Remove-Item -Path "$env:WINDIR\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue; net start spooler; Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, WorkOffline | Format-Table -AutoSize; Start-Process msdt.exe -ArgumentList "/id PrinterDiagnostic"'],
        adminRequired: true,
      },
    ],
  },
  {
    id: 'external',
    label: 'External Power Tools',
    color: '#e91e63',
    actions: [
      {
        id: 'mas',
        label: 'MAS — Microsoft Activation Scripts',
        description: 'Windows & Office activator (open-source, runs locally after download)',
        icon: Shield,
        color: '#00e676',
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://get.activated.win | iex'],
        confirm: 'This will download and run the Microsoft Activation Scripts from GitHub. Requires internet connection.',
        internetRequired: true,
      },
      {
        id: 'winutil',
        label: 'Chris Titus WinUtil',
        description: 'Multi-purpose Windows tweak & app installer suite',
        icon: Wrench,
        color: '#00d4ff',
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://christitus.com/win | iex'],
        confirm: 'This will download and run Chris Titus Tech\'s Windows Utility from the internet. Requires internet connection.',
        internetRequired: true,
      },
      {
        id: 'winscript',
        label: 'WinScript Optimizer',
        description: 'Advanced Windows configuration and optimization dashboard',
        icon: Settings,
        color: '#ffab40',
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://winscript.cc/irm | iex'],
        confirm: 'This will download and run WinScript from the internet. Requires internet connection.',
        internetRequired: true,
      },
      {
        id: 'winhance',
        label: 'Winhance Debloater',
        description: 'System customizer and advanced Windows debloater',
        icon: Zap,
        color: '#9c27b0',
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://get.winhance.net | iex'],
        confirm: 'This will download and run Winhance from the internet. Requires internet connection.',
        internetRequired: true,
      },
    ],
  },
  {
    id: 'managers',
    label: 'System Managers',
    color: '#00d4ff',
    actions: [],
  },
]

export function ToolkitView() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('performance')
  const [activeManager, setActiveManager] = useState<string>('startup')
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [actionResults, setActionResult] = useState<Record<string, { status: 'success' | 'error' | 'info', message: string }>>({})

  const MANAGER_TABS = [
    { id: 'startup', label: 'Startup Programs', icon: Zap, color: '#ffab40', component: StartupManager },
    { id: 'processes', label: 'Running Processes', icon: Activity, color: '#ff5252', component: ProcessManager },
    { id: 'services', label: 'System Services', icon: Settings, color: '#e040fb', component: ServiceManager },
    { id: 'uninstall', label: 'Installed Apps', icon: Trash2, color: '#ff8a80', component: UninstallManager },
  ]

  async function runAction(action: ToolkitAction) {
    if (action.confirm) {
      const confirmed = window.confirm(action.confirm)
      if (!confirmed) return
    }

    setRunningAction(action.id)
    setActionResult(prev => ({ ...prev, [action.id]: { status: 'info', message: 'Running...' } }))

    try {
      const exitCode = await runRawCommand(action.command, action.args)
      const status = exitCode === 0 ? 'success' : 'error'
      const message = exitCode === 0
        ? `${action.label} completed successfully`
        : `${action.label} finished with exit code ${exitCode}`
      setActionResult(prev => ({ ...prev, [action.id]: { status, message } }))

      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: action.label,
        status: exitCode === 0 ? 'success' : 'failed',
        output: [message],
        exitCode,
      }
      useStore.getState().updateJob(job)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setActionResult(prev => ({
        ...prev,
        [action.id]: { status: 'error', message: msg }
      }))

      const job: JobEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: 'Toolkit',
        action: action.label,
        status: 'failed',
        output: [msg],
        exitCode: 1,
      }
      useStore.getState().updateJob(job)
    } finally {
      setRunningAction(null)
    }
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: 'var(--s5) var(--s8)',
      display: 'flex', flexDirection: 'column', gap: 'var(--s4)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s3)',
          marginBottom: 'var(--s2)',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Wrench size={22} color="var(--bg-void)" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>PC Maintenance Toolkit</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            30+ system tools organized by category. Click to run.
          </p>
        </div>
      </motion.div>

      {CATEGORIES.map((cat, catIndex) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: catIndex * 0.05 }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--r3)',
            overflow: 'hidden',
          }}
        >
          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
            whileTap={{ scale: 0.995 }}
            onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 'var(--s3)', padding: 'var(--s4) var(--s5)',
              background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <motion.div
              animate={{ scale: expandedCategory === cat.id ? 1.2 : 1 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: cat.color, flexShrink: 0,
              }}
            />
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: 'var(--text-primary)', flex: 1,
            }}>
              {cat.label}
            </span>
            <span style={{
              fontSize: 12, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {cat.actions.length} tools
            </span>
            <motion.span
              animate={{ rotate: expandedCategory === cat.id ? 90 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ fontSize: 14, color: 'var(--text-muted)', display: 'inline-block' }}
            >
              ›
            </motion.span>
          </motion.button>

          <AnimatePresence initial={false}>
            {expandedCategory === cat.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  borderTop: '1px solid var(--border-dim)',
                  padding: 'var(--s3)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--s2)',
                }}>
                  {cat.id === 'managers' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {MANAGER_TABS.map((tab) => {
                          const TabIcon = tab.icon
                          const isActive = activeManager === tab.id
                          return (
                            <motion.button
                              key={tab.id}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setActiveManager(tab.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px',
                                background: isActive ? `${tab.color}18` : 'transparent',
                                border: `1px solid ${isActive ? tab.color + '55' : 'var(--border-dim)'}`,
                                borderRadius: 'var(--r2)',
                                color: isActive ? tab.color : 'var(--text-secondary)',
                                fontSize: 12, fontWeight: isActive ? 600 : 400,
                                cursor: 'pointer', transition: 'all 0.2s',
                              }}
                            >
                              <TabIcon size={14} />
                              {tab.label}
                            </motion.button>
                          )
                        })}
                      </div>
                      <div style={{
                        border: '1px solid var(--border-dim)',
                        borderRadius: 'var(--r2)',
                        padding: 'var(--s3)',
                        background: 'var(--bg-surface)',
                        height: 360, overflowY: 'auto',
                      }}>
                        {MANAGER_TABS.map((tab) => {
                          if (activeManager !== tab.id) return null
                          const ManagerComponent = tab.component
                          return (
                            <motion.div
                              key={tab.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <ManagerComponent />
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    cat.actions.map((action, actionIndex) => {
                      const Icon = action.icon
                      const result = actionResults[action.id]
                      const isRunning = runningAction === action.id

                      return (
                        <motion.div
                          key={action.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: actionIndex * 0.03 }}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: action.color + '55' }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                            padding: '10px 14px',
                            border: `1px solid ${result?.status === 'error' ? 'var(--danger)' : result?.status === 'success' ? 'var(--success)' : 'var(--border-dim)'}`,
                            borderRadius: 'var(--r2)',
                            background: isRunning ? `${action.color}08` : 'transparent',
                            transition: 'border-color 0.3s, background 0.3s',
                            cursor: 'default',
                          }}
                        >
                          <motion.div
                            animate={isRunning ? { rotate: 360 } : { rotate: 0 }}
                            transition={isRunning ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                            style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: `${action.color}11`,
                              border: `1px solid ${action.color}33`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={16} color={action.color} />
                          </motion.div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {action.label}
                              </span>
                              {action.adminRequired && (
                                <span style={{
                                  fontSize: 9, fontWeight: 600,
                                  color: 'var(--warning)',
                                  padding: '1px 6px',
                                  border: '1px solid rgba(255,171,64,0.3)',
                                  borderRadius: 4,
                                  textTransform: 'uppercase',
                                }}>
                                  Admin
                                </span>
                              )}
                              {action.internetRequired && (
                                <span style={{
                                  fontSize: 9, fontWeight: 600,
                                  color: 'var(--accent)',
                                  padding: '1px 6px',
                                  border: '1px solid rgba(0,212,255,0.3)',
                                  borderRadius: 4,
                                  textTransform: 'uppercase',
                                  display: 'flex', alignItems: 'center', gap: 3,
                                }}>
                                  <Globe size={8} /> Online
                                </span>
                              )}
                              {action.dangerous && (
                                <span style={{
                                  fontSize: 9, fontWeight: 600,
                                  color: 'var(--danger)',
                                  padding: '1px 6px',
                                  border: '1px solid rgba(255,82,82,0.3)',
                                  borderRadius: 4,
                                  textTransform: 'uppercase',
                                }}>
                                  Dangerous
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                              {action.description}
                            </p>
                            <AnimatePresence>
                              {result && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  style={{
                                    fontSize: 11, margin: '4px 0 0',
                                    color: result.status === 'success' ? 'var(--success)' : result.status === 'error' ? 'var(--danger)' : 'var(--accent)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {result.message}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.05, backgroundColor: `${action.color}22` }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => runAction(action)}
                            disabled={isRunning}
                            style={{
                              padding: '5px 14px',
                              background: isRunning ? `${action.color}22` : 'transparent',
                              border: `1px solid ${action.color}55`,
                              borderRadius: 'var(--r1)',
                              color: action.color,
                              fontSize: 11, fontWeight: 600,
                              cursor: isRunning ? 'default' : 'pointer',
                              opacity: isRunning ? 0.7 : 1,
                              flexShrink: 0,
                            }}
                          >
                            {isRunning ? 'Running...' : 'Run'}
                          </motion.button>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}
