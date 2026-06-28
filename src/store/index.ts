import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'rolled_back'
export type AppMode = 'dashboard' | 'diagnose' | 'toolkit' | 'history' | 'settings'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}
export interface Finding {
  id: string
  severity: Severity
  category: string
  title: string
  description: string
  fixAvailable: boolean
  autoFixable: boolean
}

export interface JobEntry {
  id: string
  timestamp: string
  category: string
  action: string
  status: JobStatus
  output: string[]
  exitCode: number | null
}

export interface LogLine {
  jobId: string
  line: string
  stream: 'stdout' | 'stderr'
  timestamp: string
}

export interface ScanPhase {
  phase: 'idle' | 'starting' | 'scanning' | 'review' | 'fixing' | 'complete'
  message: string
}

export interface Metrics {
  cpu: number
  ram: number
  disk: number
  network: number
}

export interface AgentStep {
  stepName: string
  status: string
  message: string
  timestamp: string
}

export interface AppSettings {
  compactMode: boolean
  localModelExecution: boolean
  autoFixThreshold: string
  autoRestorePoints: boolean
  backgroundScans: boolean
  theme: string
  notifications: boolean
  logRetention: number
}

interface PCFixAIStore {
  mode: AppMode
  setMode: (m: AppMode) => void

  isElevated: boolean
  setElevated: (v: boolean) => void

  scanPhase: ScanPhase
  setScanPhase: (p: ScanPhase) => void
  findings: Finding[]
  setFindings: (f: Finding[]) => void
  restorePointCreated: boolean
  setRestorePointCreated: (v: boolean) => void

  jobs: JobEntry[]
  updateJob: (job: JobEntry) => void
  clearJobs: () => void
  consoleLogs: LogLine[]
  appendLog: (line: LogLine) => void
  clearLogs: () => void

  agentSteps: AgentStep[]
  appendAgentStep: (step: AgentStep) => void
  clearAgentSteps: () => void

  chatMessages: ChatMessage[]
  appendChatMessage: (msg: ChatMessage) => void
  updateLastChatMessage: (content: string) => void
  clearChat: () => void

  metrics: Metrics
  setMetrics: (m: Partial<Metrics>) => void

  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  _hydrated: boolean
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey! Tell me what's going on with your PC.\n\nWhat I do well: • Diagnose with real system data (Event Log, services, drivers, BSOD history) • Show you the plan before any change • Snapshot before every fix, with one-click undo always available • Run entirely offline with local AI\n\nTry: 'blue screen yesterday', 'boot loop after April update', 'Clean my temp files', or just click a quick action below."
}

export const DEFAULT_SETTINGS: AppSettings = {
  compactMode: false,
  localModelExecution: true,
  autoFixThreshold: 'high',
  autoRestorePoints: true,
  backgroundScans: false,
  theme: 'dark',
  notifications: true,
  logRetention: 30,
}

export const useStore = create<PCFixAIStore>()(
  persist(
    (set) => ({
      mode: 'diagnose',
      setMode: (mode) => set({ mode }),

      isElevated: false,
      setElevated: (isElevated) => set({ isElevated }),

      scanPhase: { phase: 'idle', message: '' },
      setScanPhase: (scanPhase) => set({ scanPhase }),

      findings: [],
      setFindings: (findings) => set({ findings }),

      restorePointCreated: false,
      setRestorePointCreated: (restorePointCreated) => set({ restorePointCreated }),

      jobs: [],
      updateJob: (job) =>
        set((s) => {
          const idx = s.jobs.findIndex((j) => j.id === job.id)
          if (idx >= 0) {
            const next = [...s.jobs]
            next[idx] = job
            return { jobs: next }
          }
          return { jobs: [...s.jobs, job] }
        }),
      clearJobs: () => set({ jobs: [] }),

      consoleLogs: [],
      appendLog: (line) =>
        set((s) => ({ consoleLogs: [...s.consoleLogs.slice(-2000), line] })),
      clearLogs: () => set({ consoleLogs: [] }),

      agentSteps: [],
      appendAgentStep: (step) =>
        set((s) => ({ agentSteps: [...s.agentSteps.slice(-100), step] })),
      clearAgentSteps: () => set({ agentSteps: [] }),

      chatMessages: [WELCOME_MESSAGE],
      appendChatMessage: (msg) =>
        set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
      updateLastChatMessage: (content) =>
        set((s) => {
          const msgs = [...s.chatMessages]
          if (msgs.length > 0) msgs[msgs.length - 1].content = content
          return { chatMessages: msgs }
        }),
      clearChat: () => set({ chatMessages: [WELCOME_MESSAGE] }),

      metrics: { cpu: 0, ram: 0, disk: 0, network: 0 },
      setMetrics: (m) => set((s) => ({ metrics: { ...s.metrics, ...m } })),

      settings: { ...DEFAULT_SETTINGS },
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      _hydrated: false,
    }),
    {
      name: 'PCFixAI-storage',
      partialize: (state) => ({
        jobs: state.jobs,
        chatMessages: state.chatMessages,
        settings: state.settings,
        mode: state.mode,
      }),
      onRehydrateStorage: () => () => {
        useStore.setState({ _hydrated: true })
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<PCFixAIStore>),
        chatMessages: (persisted as Partial<PCFixAIStore>)?.chatMessages?.length
          ? (persisted as Partial<PCFixAIStore>).chatMessages!
          : current.chatMessages,
      }),
    }
  )
)