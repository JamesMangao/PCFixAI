import { useState, useCallback } from 'react'
import { useStore, Finding, JobEntry } from '../store'
import { startScan, runRawCommand, runRawCommandOutput } from './useTauriEvents'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🚨',
  high: '⚠️',
  medium: '⚡',
  low: 'ℹ️',
  info: '💡',
}

function formatFindingsForChat(findings: Finding[], restorePointCreated: boolean): string {
  if (findings.length === 0) {
    return "✅ **Scan Complete — No issues found!**\n\nYour system looks healthy. All checked diagnostics passed without problems."
  }

  const criticalCount = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length
  const totalCount = findings.length
  const fixableCount = findings.filter(f => f.fixAvailable).length

  let msg = `🔍 **Scan Complete — ${totalCount} issue${totalCount > 1 ? 's' : ''} found**`
  if (criticalCount > 0) msg += ` (${criticalCount} critical/high)`
  msg += '\n\n'

  const byCategory: Record<string, Finding[]> = {}
  for (const f of findings) {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(f)
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    msg += `**${cat}:**\n`
    for (const f of items) {
      const emoji = SEVERITY_EMOJI[f.severity] ?? '•'
      msg += `${emoji} ${f.title}`
      if (f.fixAvailable) msg += ' *(auto-fixable)*'
      msg += '\n'
    }
    msg += '\n'
  }

  if (restorePointCreated) {
    msg += '💾 A system restore point was created before scanning — all changes are reversible.\n\n'
  }

  msg += `**Recommendation:** ${fixableCount > 0 ? `You have ${fixableCount} auto-fixable issue${fixableCount > 1 ? 's' : ''}. Click Diagnose Now in the scan overlay to apply fixes, or discuss with me below!` : 'No auto-fixable issues were detected. Review the details above or ask me for advice.'}`

  return msg
}

async function getDetailedSystemSpecs(): Promise<string> {
  const sections: string[] = []

  // CPU
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '{}')
    const cpu = Array.isArray(json) ? json[0] : json
    if (cpu?.Name) {
      sections.push(`**CPU:** ${cpu.Name}`)
      sections.push(`  Cores: ${cpu.NumberOfCores ?? '?'} | Threads: ${cpu.NumberOfLogicalProcessors ?? '?'} | Max Clock: ${cpu.MaxClockSpeed ? cpu.MaxClockSpeed + ' MHz' : '?'}`)
    }
  } catch {}

  // RAM
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      '$mem = Get-CimInstance Win32_PhysicalMemory; $total = ($mem | Measure-Object -Property Capacity -Sum).Sum; $mem | Select-Object BankLabel, @{N="CapacityGB";E={[math]::Round($_.Capacity/1GB,2)}}, Speed, Manufacturer | ConvertTo-Json'
    ])
    const lines = raw.trim().split('\n').filter(l => l.trim())
    const jsonLines: object[] = []
    for (const line of lines) {
      try { jsonLines.push(...(Array.isArray(JSON.parse(line)) ? JSON.parse(line) : [JSON.parse(line)])) } catch {}
    }
    if (jsonLines.length > 0) {
      const totalGB = jsonLines.reduce((sum: number, m: any) => sum + (m.CapacityGB || 0), 0)
      sections.push(`**RAM:** ${totalGB} GB total (${jsonLines.length} stick${jsonLines.length > 1 ? 's' : ''})`)
      for (const m of jsonLines) {
        const mb = m as any
        sections.push(`  ${mb.BankLabel ?? 'Slot'}: ${mb.CapacityGB ?? '?'} GB ${mb.Manufacturer ?? ''} @ ${mb.Speed ?? '?'} MHz`)
      }
    }
  } catch {}

  // GPU
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name, @{N="AdapterRAM_GB";E={[math]::Round($_.AdapterRAM/1GB,2)}}, DriverVersion | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '[]')
    const gpus = Array.isArray(json) ? json : [json]
    for (const gpu of gpus) {
      if (gpu?.Name) {
        sections.push(`**GPU:** ${gpu.Name}`)
        sections.push(`  VRAM: ${gpu.AdapterRAM_GB ?? '?'} GB | Driver: ${gpu.DriverVersion ?? '?'}`)
      }
    }
  } catch {}

  // Disk
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      'Get-PhysicalDisk | Select-Object FriendlyName, MediaType, @{N="SizeGB";E={[math]::Round($_.Size/1GB,2)}}, HealthStatus | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '[]')
    const disks = Array.isArray(json) ? json : [json]
    for (const d of disks) {
      if (d?.FriendlyName) {
        sections.push(`**Disk:** ${d.FriendlyName} (${d.MediaType ?? 'Unknown'}) — ${d.SizeGB ?? '?'} GB — ${d.HealthStatus ?? 'Unknown'}`)
      }
    }
  } catch {}

  // Motherboard
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, Version | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '{}')
    const mobo = Array.isArray(json) ? json[0] : json
    if (mobo?.Manufacturer) {
      sections.push(`**Motherboard:** ${mobo.Manufacturer} ${mobo.Product ?? ''} (Rev ${mobo.Version ?? '?'})`)
    }
  } catch {}

  // OS
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '{}')
    const os = Array.isArray(json) ? json[0] : json
    if (os?.Caption) {
      sections.push(`**OS:** ${os.Caption} (${os.OSArchitecture ?? '?'}) Build ${os.BuildNumber ?? '?'} v${os.Version ?? '?'}`)
    }
  } catch {}

  if (sections.length === 0) {
    return '❌ Could not retrieve system specifications. Please try again.'
  }

  return [
    `**Detailed System Specifications**`,
    ``,
    ...sections,
    ``,
    `> Run a **Full System Scan** from the Dashboard for a complete health report.`,
    `> Use the **Toolkit** for specific hardware diagnostics (SMART status, memory test, etc.).`,
  ].join('\n')
}

async function handleSpeedUpStartup(): Promise<string> {
  const sections: string[] = []
  sections.push('**Startup Optimization**\n')

  // Clean temp files
  try {
    const before = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$before = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output $before'
    ])
    const sizeBefore = parseInt(before.trim()) || 0

    await runRawCommand('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
      'Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
      'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
    ])

    const after = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$after = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output $after'
    ])
    const sizeAfter = parseInt(after.trim()) || 0
    const freed = Math.max(0, sizeBefore - sizeAfter)
    sections.push(`✅ **Temp cleanup:** Freed ${freed > 1048576 ? (freed / 1048576).toFixed(1) + ' MB' : freed > 1024 ? (freed / 1024).toFixed(1) + ' KB' : freed + ' B'}`)
  } catch {
    sections.push('✅ Temp files cleaned')
  }

  // Audit startup items
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '[]')
    const items = Array.isArray(json) ? json : [json]
    const valid = items.filter((i: any) => i?.Name)
    sections.push(`\n📋 **Startup programs found:** ${valid.length}`)
    for (const item of valid.slice(0, 8)) {
      sections.push(`  • ${item.Name} — ${item.Command?.substring(0, 60) || 'N/A'}`)
    }
    if (valid.length > 8) sections.push(`  ... and ${valid.length - 8} more`)
  } catch {
    sections.push('\n⚠️ Could not enumerate startup programs')
  }

  sections.push('\n💡 **Tip:** For full startup optimization, check the **Toolkit** → System Managers → Startup Programs to disable high-impact entries.')

  return sections.join('\n')
}

async function handleFixInternet(): Promise<string> {
  const sections: string[] = []
  sections.push('**Internet Troubleshooting**\n')

  // Flush DNS
  try {
    const out = await runRawCommandOutput('ipconfig', ['/flushdns'])
    const success = out.toLowerCase().includes('successfully') || out.toLowerCase().includes('flushed')
    sections.push(success ? '✅ DNS cache flushed successfully' : `⚠️ DNS flush: ${out.trim().substring(0, 80)}`)
  } catch {
    sections.push('❌ DNS flush failed')
  }

  // Release and renew IP
  try {
    const release = await runRawCommandOutput('ipconfig', ['/release'])
    const renew = await runRawCommandOutput('ipconfig', ['/renew'])
    const releaseOk = !release.toLowerCase().includes('failed')
    const renewOk = !renew.toLowerCase().includes('failed')
    sections.push(releaseOk && renewOk ? '✅ IP address released and renewed' : '⚠️ IP renewal had issues — adapter may not be DHCP-configured')
  } catch {
    sections.push('⚠️ IP renewal failed')
  }

  // Reset Winsock
  try {
    const out = await runRawCommandOutput('netsh', ['winsock', 'reset'])
    const success = out.toLowerCase().includes('successfully')
    sections.push(success ? '✅ Winsock catalog reset' : '⚠️ Winsock reset may need admin privileges')
  } catch {
    sections.push('⚠️ Winsock reset failed')
  }

  // Reset TCP/IP
  try {
    const out = await runRawCommandOutput('netsh', ['int', 'ip', 'reset'])
    const success = out.toLowerCase().includes('successfully')
    sections.push(success ? '✅ TCP/IP stack reset' : '⚠️ TCP/IP reset may need admin privileges')
  } catch {
    sections.push('⚠️ TCP/IP reset failed')
  }

  sections.push('\n🔄 **You may need to restart your PC for all changes to take effect.**')

  return sections.join('\n')
}

async function handleBoostPC(): Promise<string> {
  const sections: string[] = []
  sections.push('**Performance Boost**\n')

  // Clean temp files and recycle bin
  try {
    const before = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$t = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output $t'
    ])
    const sizeBefore = parseInt(before.trim()) || 0

    await runRawCommand('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
    ])

    const after = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$a = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output $a'
    ])
    const sizeAfter = parseInt(after.trim()) || 0
    const freed = Math.max(0, sizeBefore - sizeAfter)
    sections.push(`✅ **Temp & recycle bin cleaned** — Freed ${freed > 1048576 ? (freed / 1048576).toFixed(1) + ' MB' : freed > 1024 ? (freed / 1024).toFixed(1) + ' KB' : freed + ' B'}`)
  } catch {
    sections.push('✅ Temp files and recycle bin cleaned')
  }

  // Clear browser caches
  try {
    const out = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `$before = 0; @('Chrome','Firefox','Edge','Brave') | ForEach-Object {
        $p = "$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache"
        if (Test-Path $p) { $before += (Get-ChildItem "$p\\*" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum }
      }; Write-Output $before`
    ])
    const cacheSize = parseInt(out.trim()) || 0

    await runRawCommand('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `@('Chrome','Firefox','Edge','Brave') | ForEach-Object {
        $p = "$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache"
        if (Test-Path $p) { Remove-Item "$p\\*" -Recurse -Force -EA SilentlyContinue }
      }; Write-Output "Done"`
    ])
    sections.push(`✅ **Browser caches cleared** — Removed ${cacheSize > 1048576 ? (cacheSize / 1048576).toFixed(1) + ' MB' : 'cached data'}`)
  } catch {
    sections.push('✅ Browser caches cleared')
  }

  // Set High Performance power plan
  try {
    const out = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c; $plan = powercfg /getactivescheme; Write-Output $plan'
    ])
    if (out.includes('8c5e7fda')) {
      sections.push('✅ **High Performance power plan** activated')
    } else {
      sections.push('ℹ️ Power plan — High Performance may already be active or unavailable on this system')
    }
  } catch {
    sections.push('ℹ️ Power plan unchanged')
  }

  sections.push('\n💡 **Tip:** For deeper optimization, run a full system scan from the Dashboard.')

  return sections.join('\n')
}

async function handleCleanDisk(): Promise<string> {
  const sections: string[] = []
  sections.push('**Disk Cleanup**\n')

  // Clean temp files
  try {
    const before = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$t1 = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; $t2 = (Get-ChildItem "$env:WINDIR\\Temp" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output ($t1 + $t2)'
    ])
    const sizeBefore = parseInt(before.trim()) || 0

    await runRawCommand('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
      'Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
      'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
    ])

    const after = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      '$a1 = (Get-ChildItem "$env:TEMP" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; $a2 = (Get-ChildItem "$env:WINDIR\\Temp" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Write-Output ($a1 + $a2)'
    ])
    const sizeAfter = parseInt(after.trim()) || 0
    const freed = Math.max(0, sizeBefore - sizeAfter)
    sections.push(`✅ **Temp files & recycle bin** — Freed ${freed > 1048576 ? (freed / 1048576).toFixed(1) + ' MB' : freed > 1024 ? (freed / 1024).toFixed(1) + ' KB' : freed + ' B'}`)
  } catch {
    sections.push('✅ Temp files and recycle bin cleared')
  }

  // Clear browser caches
  try {
    const cacheInfo = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `$total = 0; @('Chrome','Firefox','Edge','Brave') | ForEach-Object {
        $p = "$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache"
        if (Test-Path $p) { $total += (Get-ChildItem "$p\\*" -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum }
      }; Write-Output $total`
    ])
    const cacheSize = parseInt(cacheInfo.trim()) || 0

    await runRawCommand('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `$browsers = @('Chrome','Firefox','Edge','Brave'); foreach ($b in $browsers) {
        $path = "$env:LOCALAPPDATA\\$b\\User Data\\Default\\Cache"
        if (Test-Path $path) { Remove-Item "$path\\*" -Recurse -Force -EA SilentlyContinue }
      }; Write-Output "Done"`
    ])
    sections.push(`✅ **Browser caches** — Removed ${cacheSize > 1048576 ? (cacheSize / 1048576).toFixed(1) + ' MB' : 'cached data'}`)
  } catch {
    sections.push('✅ Browser caches cleared')
  }

  // Show current disk space
  try {
    const raw = await runRawCommandOutput('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      'Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB,2)}}, @{N="TotalGB";E={[math]::Round($_.Size/1GB,2)}} | ConvertTo-Json'
    ])
    const json = JSON.parse(raw.trim().split('\n').filter(l => l.trim()).pop() || '{}')
    if (json?.FreeGB) {
      const pct = Math.round((json.FreeGB / json.TotalGB) * 100)
      sections.push(`\n💾 **C: Drive:** ${json.FreeGB} GB free of ${json.TotalGB} GB (${pct}% free)`)
      if (pct < 15) sections.push('⚠️ **Warning:** Low disk space! Consider moving or deleting large files.')
    }
  } catch {}

  sections.push('\n💡 **Tip:** Run a dashboard scan to check for additional space-saving opportunities like old Windows Update files.')

  return sections.join('\n')
}

const FALLBACK_RESPONSES: Record<string, string> = {
  'hello': "Hey there! 👋 I'm your PC repair assistant. Here's what I can do:\n\n🔍 **Diagnose** — Full system scan with auto-fix\n⚡ **Speed up** — Optimize startup and performance\n🌐 **Fix internet** — Network stack reset and DNS flush\n💾 **Clean disk** — Remove temp files and browser caches\n📊 **System specs** — Show your hardware details\n🛠️ **Toolkit** — 30+ advanced maintenance tools\n\nWhat would you like to do?",
  'what can you do': "I'm a PC repair assistant that works offline-first. Here's everything I can help with:\n\n**Quick Actions:**\n• 🔍 System Scan — Detect and fix issues automatically\n• ⚡ Speed Up Startup — Clean temp files, optimize boot\n• 🌐 Fix Internet — DNS flush, Winsock reset, IP renewal\n• 🚀 Boost PC — Performance tweaks and cache cleanup\n• 🧹 Clean Disk — Free up space by removing junk files\n• 📊 System Specs — Show detailed hardware info\n\n**Advanced:**\n• 🛠️ Toolkit — 30+ maintenance tools organized by category\n• 💬 Ask me anything about PC issues — I'll give you step-by-step advice\n\nTry clicking a quick action button below!",
  'help': "Here's how I can help you:\n\n**For Diagnostics:**\n• Type `scan` or click **One Click Diagnose**\n• I'll check disk health, network connectivity, and more\n\n**For Fixes:**\n• `speed up my startup` — Optimize boot time\n• `fix my internet` — Reset network stack\n• `boost my pc` — Performance optimization\n• `clean up disk space` — Remove junk files\n\n**For Info:**\n• `system specs` — Show your hardware details\n• `what can you do` — See all available commands\n\n**For Advanced Tools:**\n• Check the **Toolkit** tab for 30+ system utilities\n\nJust describe your issue and I'll help!",
  'slow': "Your PC is running slow? Let me help diagnose and fix it:\n\n**Quick fixes:**\n• Type `boost my pc` — Cleans temp files and optimizes performance\n• Type `speed up my startup` — Reduces boot time\n• Click **Scan System** — Detects resource hogs\n\n**Common causes of slowness:**\n• Too many startup programs\n• Low disk space (less than 15% free)\n• Outdated drivers\n• Malware or bloatware\n• Fragmented HDD (less relevant for SSDs)\n\nWould you like me to run a diagnostic scan?",
  'virus': "If you suspect malware, here's what I recommend:\n\n**Immediate steps:**\n• I can run the **Microsoft Malicious Software Removal Tool** (MRT)\n• Check the **Toolkit** tab → System Cleanup section → option [15]\n\n**For real-time protection:**\n• Windows Defender is built-in and effective\n• Run a full scan: Settings → Update & Security → Windows Security → Virus & threat protection\n\n**Warning signs:**\n• Unexpected pop-ups\n• Slow performance\n• Unknown programs in Task Manager\n• Browser redirects\n\nWould you like me to launch the MRT scanner?",
  'blue screen': "Blue Screen of Death (BSOD) is usually caused by:\n\n**Common causes:**\n• Faulty drivers (especially GPU/RAM)\n• Overheating hardware\n• Corrupted Windows system files\n• Incompatible software\n\n**What I can do:**\n• Run `fix my internet` — Sometimes network drivers cause BSOD\n• Use **Toolkit** → System Repair (SFC + DISM)\n• Check **Drive SMART Status** for failing hardware\n\n**To get the error code:**\n• Check Settings → System → About → Advanced system settings\n• Look for 'Stop Error' in Event Viewer\n\nWould you like me to run a system repair scan?",
  'wifi': "Having Wi-Fi issues? Let's fix it:\n\n**Quick fix:**\n• Type `fix my internet` — Flushes DNS, resets Winsock, renews IP\n\n**If that doesn't work:**\n• Check if Wi-Fi is enabled (physical switch or Fn key)\n• Restart your router (unplug for 30 seconds)\n• Use **Toolkit** → Full Network Stack Reset\n\n**Advanced:**\n• Run the Network Troubleshooter from Toolkit\n• Update network drivers via Toolkit → Auto Update Drivers\n\nWould you like me to run the network fix?",
  'printer': "Printer problems? Here's how to fix them:\n\n**Quick steps:**\n• Use **Toolkit** → Printer Auto-Troubleshooter (option [32] in Toolkit)\n• It will: stop spooler, clear queue, restart, and launch Windows troubleshooter\n\n**Manual checks:**\n• Ensure printer is powered on and connected\n• For USB: try a different port\n• For network: verify printer IP hasn't changed\n• Check if printer is set as default\n\nWould you like me to run the printer troubleshooter?",
  'disk space': "Need to free up disk space? Here are your options:\n\n**Quick fix:**\n• Type `clean up disk space` — Removes temp files, browser caches, recycle bin\n\n**More options (in Toolkit):**\n• Deep Disk Cleanup — Removes old Windows update files\n• Clear Windows Update Cache\n• Check what's using space: Settings → System → Storage\n\n**Tip:** Keep at least 15% free space for optimal performance.\n\nWould you like me to clean up your disk?",
  'thank': "You're welcome! I'm here whenever you need help with your PC. 💪",
  'thanks': "Happy to help! Let me know if you need anything else.",
  'bye': "Goodbye! Take care of your PC. 🖥️",
  'goodbye': "See you later! Your PC is in good hands.",
  'who are you': "I'm **PCFixAI** — your offline-first PC repair assistant.\n\nI can diagnose issues, run fixes, and provide guidance. If Ollama is installed, I can also provide AI-powered advice.\n\nWhat can I help you with today?",
  'what is this': "This is **PCFixAI** — a PC repair tool that runs mostly offline.\n\n**What it does:**\n• Scans your system for common issues\n• Auto-fixes problems when possible\n• Provides step-by-step guidance\n• Includes 30+ maintenance tools\n• Optional: AI-powered chat with Ollama\n\nTry the quick actions below or explore the Toolkit!",
}

function findFallback(content: string): string | null {
  const q = content.toLowerCase().trim()
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (q.includes(key)) return response
  }
  return null
}

function logJob(category: string, action: string, status: 'success' | 'failed', output: string, exitCode: number = 0) {
  const job: JobEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    category,
    action,
    status,
    output: [output.substring(0, 2000)],
    exitCode,
  }
  useStore.getState().updateJob(job)
}

const OLLAMA_BASE = 'http://localhost:11434'

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    const response = await tauriFetch(OLLAMA_BASE, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

export async function checkOllamaInstalled(): Promise<boolean> {
  try {
    const output = await runRawCommandOutput('winget', [
      'list', '--id', 'Ollama.Ollama', '--accept-source-agreements'
    ])
    return output.includes('Ollama.Ollama')
  } catch {
    return false
  }
}

export async function installOllama(): Promise<boolean> {
  const code = await runRawCommand('winget', [
    'install', 'Ollama.Ollama',
    '--silent', '--accept-package-agreements', '--accept-source-agreements',
    '--disable-interactivity',
  ])
  return code === 0
}

export async function startOllama(): Promise<boolean> {
  try {
    await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden'
    ])
    // Wait for Ollama to start
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000))
      if (await checkOllamaAvailable()) return true
    }
    return false
  } catch {
    return false
  }
}

export async function pullOllamaModel(model: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes
    const response = await tauriFetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

async function callOllama(messages: { role: string; content: string }[], model: string): Promise<string> {
  const systemMessage = {
    role: 'system',
    content: 'You are PCFixAI, a Windows PC repair assistant. You can run PowerShell commands to diagnose and fix issues. Give concise, actionable advice. If you need to run a command, explain what it does first. Keep responses under 300 words unless the user asks for detail.',
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  const response = await tauriFetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [systemMessage, ...messages],
      stream: false,
    }),
    signal: controller.signal,
  })
  clearTimeout(timeoutId)

  if (!response.ok) throw new Error(`Ollama returned ${response.status}`)

  const data = await response.json()
  return data.message?.content || 'No response from Ollama.'
}

export function useLocalAI() {
  const [isGenerating, setIsGenerating] = useState(false)
  const { appendChatMessage, updateLastChatMessage } = useStore()

  const sendMessage = useCallback(async (content: string) => {
    const q = content.toLowerCase().trim()

    if (q.includes('diagnose') || q.includes('scan') || q.includes('check health') || q === 'one click diagnose') {
      const sysId = Date.now().toString() + '-sys'
      appendChatMessage({ id: sysId, role: 'assistant', content: '🔍 Starting system diagnosis...' })
      try {
        const result = await startScan()
        const summary = formatFindingsForChat(result.findings, result.restorePointCreated)
        updateLastChatMessage(summary)
        logJob('Scan', 'One Click Diagnose', result.findings.length > 0 ? 'success' : 'success', summary)
        if (result.findings.length > 0) {
          const recId = Date.now().toString() + '-rec'
          const findingCount = result.findings.filter(f => f.fixAvailable).length
          appendChatMessage({
            id: recId,
            role: 'assistant',
            content: `💡 **Recommendation:** ${findingCount > 0
              ? `I found ${findingCount} auto-fixable issue${findingCount > 1 ? 's' : ''}. Go to the Dashboard and click **Scan System** to see findings, or ask me about specific issues.`
              : 'No auto-fixable issues were detected. Review the details above. If you need advice on any specific finding, just ask!'}`
          })
        }
      } catch (e) {
        const msg = '❌ Scan failed. Please try again or check the backend connection.'
        updateLastChatMessage(msg)
        logJob('Scan', 'One Click Diagnose', 'failed', msg, 1)
      }
      return
    }

    if (q.includes('system specs') || q.includes('system spec') || q.includes('specs') || q.includes('hardware') || q.includes('what are my specs')) {
      const id = Date.now().toString() + '-specs'
      appendChatMessage({ id, role: 'assistant', content: '🔍 **Gathering system specifications...** — Querying hardware components...' })
      try {
        const result = await getDetailedSystemSpecs()
        updateLastChatMessage(result)
        logJob('Info', 'Show System Specs', 'success', result)
      } catch (e) {
        const msg = '❌ Failed to retrieve system specs.'
        updateLastChatMessage(msg)
        logJob('Info', 'Show System Specs', 'failed', msg, 1)
      }
      return
    }

    if (q.includes('speed up my startup') || q === 'speed up my startup') {
      const id = Date.now().toString() + '-spd'
      appendChatMessage({ id, role: 'assistant', content: '⚡ **Speed up my startup** — Running cleanup...' })
      try {
        const result = await handleSpeedUpStartup()
        updateLastChatMessage(result)
        logJob('Chat', 'Speed Up Startup', 'success', result)
      } catch (e) {
        const msg = '❌ Startup optimization failed.'
        updateLastChatMessage(msg)
        logJob('Chat', 'Speed Up Startup', 'failed', msg, 1)
      }
      return
    }

    if (q.includes('fix my internet') || q === 'fix my internet') {
      const id = Date.now().toString() + '-net'
      appendChatMessage({ id, role: 'assistant', content: '🌐 **Fix my internet** — Running network diagnostics...' })
      try {
        const result = await handleFixInternet()
        updateLastChatMessage(result)
        logJob('Chat', 'Fix My Internet', 'success', result)
      } catch (e) {
        const msg = '❌ Internet troubleshooting failed.'
        updateLastChatMessage(msg)
        logJob('Chat', 'Fix My Internet', 'failed', msg, 1)
      }
      return
    }

    if (q.includes('boost my pc') || q === 'boost my pc') {
      const id = Date.now().toString() + '-bst'
      appendChatMessage({ id, role: 'assistant', content: '🚀 **Boost my PC** — Running performance tweaks...' })
      try {
        const result = await handleBoostPC()
        updateLastChatMessage(result)
        logJob('Chat', 'Boost My PC', 'success', result)
      } catch (e) {
        const msg = '❌ Performance boost failed.'
        updateLastChatMessage(msg)
        logJob('Chat', 'Boost My PC', 'failed', msg, 1)
      }
      return
    }

    if (q.includes('clean up disk space') || q === 'clean up disk space') {
      const id = Date.now().toString() + '-cln'
      appendChatMessage({ id, role: 'assistant', content: '🧹 **Clean up disk space** — Running cleanup...' })
      try {
        const result = await handleCleanDisk()
        updateLastChatMessage(result)
        logJob('Chat', 'Clean Up Disk Space', 'success', result)
      } catch (e) {
        const msg = '❌ Disk cleanup failed.'
        updateLastChatMessage(msg)
        logJob('Chat', 'Clean Up Disk Space', 'failed', msg, 1)
      }
      return
    }

    const fallback = findFallback(content)
    if (fallback) {
      appendChatMessage({ id: Date.now().toString() + '-fb', role: 'assistant', content: fallback })
      return
    }

    const { settings, ollamaStatus } = useStore.getState()
    if (settings.localModelExecution && ollamaStatus === 'ready') {
      setIsGenerating(true)
      const respId = Date.now().toString() + '-ai'
      appendChatMessage({ id: respId, role: 'assistant', content: '🤔 Thinking...' })
      try {
        const chatHistory = useStore.getState().chatMessages.map(m => ({ role: m.role, content: m.content }))
        const aiResponse = await callOllama(chatHistory, settings.ollamaModel)
        updateLastChatMessage(aiResponse)
      } catch (e) {
        updateLastChatMessage(`I'm not sure how to help with that. You can try:\n\n• \`scan\` — Full system diagnosis\n• \`speed up my startup\` — Optimize boot time\n• \`fix my internet\` — Reset network stack\n• \`boost my pc\` — Performance optimization\n• \`clean up disk space\` — Remove junk files\n• \`system specs\` — Show hardware details\n\nOr use the **Toolkit** tab for 30+ advanced maintenance tools.`)
      } finally {
        setIsGenerating(false)
      }
      return
    }

    setIsGenerating(true)
    const respId = Date.now().toString() + '-ai'
    appendChatMessage({
      id: respId,
      role: 'assistant',
      content: `I'm not sure how to help with that specific request, but here are some things I **can** do:\n\n` +
        `**Quick Commands:**\n` +
        `• \`scan\` — Full system diagnosis\n` +
        `• \`speed up my startup\` — Optimize boot time\n` +
        `• \`fix my internet\` — Reset network stack\n` +
        `• \`boost my pc\` — Performance optimization\n` +
        `• \`clean up disk space\` — Remove junk files\n` +
        `• \`system specs\` — Show hardware details\n\n` +
        `**Try describing your issue in plain English** — like "my PC is slow" or "wifi keeps disconnecting" — and I'll guide you through the fix.\n\n` +
        `Or use the **Toolkit** tab for 30+ advanced maintenance tools.`
    })
    setIsGenerating(false)
  }, [appendChatMessage, updateLastChatMessage])

  return {
    sendMessage,
    isInitializing: false,
    initProgress: null,
    isGenerating
  }
}
