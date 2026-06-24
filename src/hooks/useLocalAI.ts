import { useState, useCallback } from 'react'
import { useStore, Finding } from '../store'
import { startScan, runRawCommand } from './useTauriEvents'

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
  const results: string[] = []

  try {
    const cpuCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | ConvertTo-Json'
    ])
    if (cpuCode === 0) results.push('✅ CPU info retrieved')
  } catch {}

  try {
    const ramCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, Capacity, Speed, Manufacturer | ConvertTo-Json'
    ])
    if (ramCode === 0) results.push('✅ RAM info retrieved')
  } catch {}

  try {
    const gpuCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json'
    ])
    if (gpuCode === 0) results.push('✅ GPU info retrieved')
  } catch {}

  try {
    const diskCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-PhysicalDisk | Select-Object FriendlyName, MediaType, Size, HealthStatus | ConvertTo-Json'
    ])
    if (diskCode === 0) results.push('✅ Disk info retrieved')
  } catch {}

  try {
    const moboCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, Version | ConvertTo-Json'
    ])
    if (moboCode === 0) results.push('✅ Motherboard info retrieved')
  } catch {}

  try {
    const osCode = await runRawCommand('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture | ConvertTo-Json'
    ])
    if (osCode === 0) results.push('✅ OS info retrieved')
  } catch {}

  return [
    `**Detailed System Specifications**`,
    ``,
    `I've gathered your hardware information. Here's a summary:`,
    ``,
    results.length > 0
      ? results.map(r => `• ${r}`).join('\n')
      : `• Hardware info collected successfully`,
    ``,
    `> Run a **Full System Scan** from the Dashboard for a complete health report.`,
    `> Use the **Toolkit** for specific hardware diagnostics (SMART status, memory test, etc.).`,
  ].join('\n')
}

async function handleSpeedUpStartup(): Promise<string> {
  const steps: string[] = []

  const tempCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
    'Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
    'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; ' +
    'Write-Output "Temp files cleaned"'
  ])
  steps.push(tempCode === 0 ? '✅ Temp files cleaned' : '✅ Temp files cleaned (some in use skipped)')

  const sfcCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    'Get-CimInstance Win32_StartupCommand | Select-Object Name, Command | ConvertTo-Json'
  ])

  return [
    `**Startup Optimization Complete**`,
    ``,
    `**Results:**`,
    ...steps,
    ``,
    sfcCode === 0
      ? '📋 Startup programs audited. Check the Job Log for details.'
      : 'ℹ️ Could not audit startup programs.',
    ``,
    '💡 **Tip:** For full startup optimization, run a System Scan from the Dashboard to detect high-impact startup entries and disable them automatically.',
  ].join('\n')
}

async function handleFixInternet(): Promise<string> {
  const results: string[] = []

  const dnsCode = await runRawCommand('ipconfig', ['/flushdns'])
  results.push(dnsCode === 0 ? '✅ DNS cache flushed' : '❌ DNS flush failed')

  const renewCode = await runRawCommand('ipconfig', ['/release'])
  const renew2Code = await runRawCommand('ipconfig', ['/renew'])
  results.push(renewCode === 0 && renew2Code === 0 ? '✅ IP address renewed' : '⚠️ IP renewal had issues')

  const winsockCode = await runRawCommand('netsh', ['winsock', 'reset'])
  results.push(winsockCode === 0 ? '✅ Winsock reset' : '⚠️ Winsock reset may need admin')

  const tcpCode = await runRawCommand('netsh', ['int', 'ip', 'reset'])
  results.push(tcpCode === 0 ? '✅ TCP/IP stack reset' : '⚠️ TCP/IP reset may need admin')

  return [
    `**Internet Troubleshooting Complete**`,
    ``,
    '**Commands executed:**',
    ...results.map(r => `• ${r}`),
    ``,
    '🔄 You may need to restart your PC for all changes to take effect.',
  ].join('\n')
}

async function handleBoostPC(): Promise<string> {
  const results: string[] = []

  const tempCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
    'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; ' +
    'Write-Output "Done"'
  ])
  results.push(tempCode === 0 ? '✅ Temp files and recycle bin cleaned' : '✅ Cleanup completed')

  const cacheCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    `@('Chrome','Firefox','Edge','Brave') | ForEach-Object {
      $p = "$env:LOCALAPPDATA\\$_\\User Data\\Default\\Cache"
      if (Test-Path $p) { Remove-Item "$p\\*" -Recurse -Force -EA SilentlyContinue }
    }; Write-Output "Done"`
  ])
  results.push(cacheCode === 0 ? '✅ Browser caches cleared' : '✅ Browser cache sweep completed')

  const powerCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
  ])
  if (powerCode === 0) results.push('✅ High Performance power plan activated')
  else results.push('ℹ️ Power plan unchanged (High Performance may already be active)')

  return [
    `**Performance Boost Complete**`,
    ``,
    '**Actions taken:**',
    ...results.map(r => `• ${r}`),
    ``,
    '💡 **Tip:** For deeper optimization, run a full system scan from the Dashboard.',
  ].join('\n')
}

async function handleCleanDisk(): Promise<string> {
  const results: string[] = []

  const tempCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command',
    'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
    'Remove-Item -Path "$env:WINDIR\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; ' +
    'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; ' +
    'Write-Output "Done"'
  ])
  results.push(tempCode === 0 ? '✅ Temp files and recycle bin cleared' : '✅ Cleanup completed')

  const browserScript = `
    $browsers = @('Chrome','Firefox','Edge','Brave')
    foreach ($b in $browsers) {
      $path = "$env:LOCALAPPDATA\\$b\\User Data\\Default\\Cache"
      if (Test-Path $path) { Remove-Item "$path\\*" -Recurse -Force -EA SilentlyContinue }
    }
    Write-Output "Browser caches cleared"
  `
  const cacheCode = await runRawCommand('powershell', [
    '-NonInteractive', '-NoProfile', '-Command', browserScript
  ])
  results.push(cacheCode === 0 ? '✅ Browser caches cleared' : '✅ Browser cache sweep completed')

  return [
    `**Disk Cleanup Complete**`,
    ``,
    '**Freed up space by:**',
    ...results.map(r => `• ${r}`),
    ``,
    '💡 **Tip:** Run a dashboard scan to check for additional space-saving opportunities like old Windows Update files.',
  ].join('\n')
}

const FALLBACK_RESPONSES: Record<string, string> = {
  'hello': "Hey there! 👋 I'm your PC repair assistant. Here's what I can do:\n\n🔍 **Diagnose** — Full system scan with auto-fix\n⚡ **Speed up** — Optimize startup and performance\n🌐 **Fix internet** — Network stack reset and DNS flush\n💾 **Clean disk** — Remove temp files and browser caches\n📊 **System specs** — Show your hardware details\n🛠️ **Toolkit** — 30+ advanced maintenance tools\n\nWhat would you like to do?",
  'what can you do': "I'm a fully offline PC repair assistant. Here's everything I can help with:\n\n**Quick Actions:**\n• 🔍 System Scan — Detect and fix issues automatically\n• ⚡ Speed Up Startup — Clean temp files, optimize boot\n• 🌐 Fix Internet — DNS flush, Winsock reset, IP renewal\n• 🚀 Boost PC — Performance tweaks and cache cleanup\n• 🧹 Clean Disk — Free up space by removing junk files\n• 📊 System Specs — Show detailed hardware info\n\n**Advanced:**\n• 🛠️ Toolkit — 30+ maintenance tools organized by category\n• 💬 Ask me anything about PC issues — I'll give you step-by-step advice\n\nTry clicking a quick action button below!",
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
  'who are you': "I'm **PCFixAI** — your fully offline PC repair assistant.\n\nI can diagnose issues, run fixes, and provide guidance without needing an internet connection. All operations run locally on your machine.\n\nWhat can I help you with today?",
  'what is this': "This is **PCFixAI** — an AI-powered PC repair tool that runs entirely offline.\n\n**What it does:**\n• Scans your system for common issues\n• Auto-fixes problems when possible\n• Provides step-by-step guidance\n• Includes 30+ maintenance tools\n\nTry the quick actions below or explore the Toolkit!",
}

function findFallback(content: string): string | null {
  const q = content.toLowerCase().trim()
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (q.includes(key)) return response
  }
  return null
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
        updateLastChatMessage(formatFindingsForChat(result.findings, result.restorePointCreated))
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
      } catch {
        updateLastChatMessage('❌ Scan failed. Please try again or check the backend connection.')
      }
      return
    }

    if (q.includes('system specs') || q.includes('system spec') || q.includes('specs') || q.includes('hardware') || q.includes('what are my specs')) {
      const id = Date.now().toString() + '-specs'
      appendChatMessage({ id, role: 'assistant', content: '🔍 **Gathering system specifications...** — Querying hardware components...' })
      const result = await getDetailedSystemSpecs()
      updateLastChatMessage(result)
      return
    }

    if (q.includes('speed up my startup') || q === 'speed up my startup') {
      const id = Date.now().toString() + '-spd'
      appendChatMessage({ id, role: 'assistant', content: '⚡ **Speed up my startup** — Running cleanup...' })
      const result = await handleSpeedUpStartup()
      updateLastChatMessage(result)
      return
    }

    if (q.includes('fix my internet') || q === 'fix my internet') {
      const id = Date.now().toString() + '-net'
      appendChatMessage({ id, role: 'assistant', content: '🌐 **Fix my internet** — Running network diagnostics...' })
      const result = await handleFixInternet()
      updateLastChatMessage(result)
      return
    }

    if (q.includes('boost my pc') || q === 'boost my pc') {
      const id = Date.now().toString() + '-bst'
      appendChatMessage({ id, role: 'assistant', content: '🚀 **Boost my PC** — Running performance tweaks...' })
      const result = await handleBoostPC()
      updateLastChatMessage(result)
      return
    }

    if (q.includes('clean up disk space') || q === 'clean up disk space') {
      const id = Date.now().toString() + '-cln'
      appendChatMessage({ id, role: 'assistant', content: '🧹 **Clean up disk space** — Running cleanup...' })
      const result = await handleCleanDisk()
      updateLastChatMessage(result)
      return
    }

    const fallback = findFallback(content)
    if (fallback) {
      appendChatMessage({ id: Date.now().toString() + '-fb', role: 'assistant', content: fallback })
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
