import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { useStore, Finding, LogLine, JobEntry, ScanPhase, AgentStep } from '../store'

interface ScanResult {
  scanId: string
  findings: Finding[]
  restorePointCreated: boolean
}

interface ScanStatusPayload {
  phase: ScanPhase['phase']
  message: string
}

interface JobUpdatePayload {
  job: JobEntry
}

export function useTauriEvents() {
  useEffect(() => {
    const unlisteners: UnlistenFn[] = []

    async function setup() {
      try {
        const elevated = await invoke<boolean>('check_privileges')
        useStore.getState().setElevated(elevated)
      } catch {
        useStore.getState().setElevated(false)
      }

      unlisteners.push(
        await listen<ScanStatusPayload>('scan-status', (event) => {
          useStore.getState().setScanPhase({
            phase: event.payload.phase,
            message: event.payload.message,
          })
        }),
      )

      unlisteners.push(
        await listen<LogLine>('log-line', (event) => {
          useStore.getState().appendLog(event.payload)
        }),
      )

      unlisteners.push(
        await listen<JobUpdatePayload>('job-update', (event) => {
          useStore.getState().updateJob(event.payload.job)
        }),
      )

      unlisteners.push(
        await listen<AgentStep>('agent-step', (event) => {
          const store = useStore.getState()
          store.appendAgentStep(event.payload)
          if (store.scanPhase.phase !== 'fixing') {
            store.setScanPhase({
              phase: 'fixing',
              message: event.payload.message,
            })
          }
        }),
      )
    }

    setup()

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [])
}

export async function startScan(): Promise<ScanResult> {
  const store = useStore.getState()
  store.clearAgentSteps()
  store.setFindings([])
  store.setRestorePointCreated(false)
  store.setScanPhase({ phase: 'starting', message: 'Initializing scan...' })

  try {
    const result = await invoke<ScanResult>('scan_system')
    store.setFindings(result.findings)
    store.setRestorePointCreated(result.restorePointCreated)
    
    if (result.findings.length > 0) {
      store.setScanPhase({ phase: 'review', message: 'Scan complete. Please review the findings.' })
    } else {
      store.setScanPhase({ phase: 'complete', message: 'Scan complete. No issues found.' })
    }
    
    return result
  } catch (error) {
    console.error("Scan failed:", error)
    store.setScanPhase({ phase: 'idle', message: 'Scan failed. Please try again.' })
    throw error
  }
}

export async function executeFix(category: string, action: string): Promise<boolean> {
  return invoke<boolean>('execute_fix', { category, action })
}

export async function runRawCommand(program: string, args: string[]): Promise<number> {
  return invoke<number>('run_raw_command', { program, args })
}

export async function runRawCommandOutput(program: string, args: string[]): Promise<string> {
  return invoke<string>('run_raw_command_output', { program, args })
}

export async function getJobLog(): Promise<JobEntry[]> {
  return invoke<JobEntry[]>('get_job_log')
}

export async function getRealMetrics(): Promise<{
  cpu: number; ram: number; disk: number; network: number;
  totalRam: number; usedRam: number;
}> {
  return invoke('get_real_metrics')
}

export async function getStartupItems(): Promise<string> {
  return invoke<string>('get_startup_items')
}

export async function getProcesses(): Promise<string> {
  return invoke<string>('get_processes')
}

export async function killProcess(pid: number): Promise<boolean> {
  return invoke<boolean>('kill_process', { pid })
}

export async function getServices(): Promise<string> {
  return invoke<string>('get_services')
}

export async function manageService(name: string, action: string): Promise<boolean> {
  return invoke<boolean>('manage_service', { name, action })
}

export async function getInstalledApps(): Promise<string> {
  return invoke<string>('get_installed_apps')
}