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

export type OllamaStatus = 'checking' | 'not_installed' | 'installing' | 'installed_not_running' | 'starting' | 'pulling_model' | 'ready'

export interface AppSettings {
  compactMode: boolean
  localModelExecution: boolean
  autoFixThreshold: string
  autoRestorePoints: boolean
  backgroundScans: boolean
  theme: string
  notifications: boolean
  logRetention: number
  ollamaModel: string
}

interface PCFixAIStore {
  mode: AppMode
  setMode: (m: AppMode) => void

  isElevated: boolean
  setElevated: (v: boolean) => void
  privilegeChecked: boolean
  setPrivilegeChecked: (v: boolean) => void

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

  ollamaStatus: OllamaStatus
  setOllamaStatus: (s: OllamaStatus) => void

  activeTask: { name: string; status: 'running' | 'done' | 'error' } | null
  setActiveTask: (task: { name: string; status: 'running' | 'done' | 'error' } | null) => void

  _hydrated: boolean
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Welcome to PCFixAI.\n\nI diagnose and repair common Windows issues. Here is what I can do:\n\n- Diagnose with real system data (Event Log, services, drivers, BSOD history)\n- Show a plan before making any changes\n- Snapshot before every fix, with one-click undo available\n- Optional: AI-powered chat with Ollama (connect via localhost:11434)\n\nTry: 'blue screen yesterday', 'boot loop after April update', 'Clean my temp files', or select a quick action below."
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
  ollamaModel: 'llama3.2:3b',
}

export const useStore = create<PCFixAIStore>()(
  persist(
    (set) => ({
      mode: 'diagnose',
      setMode: (mode) => set({ mode }),

      isElevated: false,
      setElevated: (isElevated) => set({ isElevated }),
      privilegeChecked: false,
      setPrivilegeChecked: (privilegeChecked) => set({ privilegeChecked }),

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

      ollamaStatus: 'checking',
      setOllamaStatus: (ollamaStatus) => set({ ollamaStatus }),

      activeTask: null,
      setActiveTask: (activeTask) => set({ activeTask }),

      _hydrated: false,
    }),
    {
      name: 'PCFixAI-storage',
      partialize: (state) => ({
        jobs: state.jobs,
        chatMessages: state.chatMessages,
        settings: state.settings,
        mode: state.mode,
        findings: state.findings,
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