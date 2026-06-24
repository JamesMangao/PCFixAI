# PCFixAI — System Architecture

## 1. Tech Stack Decision: Tauri over Electron

### Why Tauri wins for this use case

| Dimension | Tauri (chosen) | Electron |
|---|---|---|
| **Binary size** | ~8 MB | ~120–180 MB |
| **RAM baseline** | ~30–60 MB | ~150–250 MB |
| **System API access** | Rust native crates + unsafe FFI direct to Win32 | Node child_process → PowerShell round-trip |
| **Admin escalation** | Native UAC manifest + Windows API TOKEN_ELEVATION query | ShellExecuteEx hack via Node.js |
| **Startup time** | <400 ms | 1.5–3 s |
| **Windows crate ecosystem** | `windows-rs` — first-class Win32/COM/WMI bindings | None direct; always subprocess |
| **Security model** | Rust memory safety + allowlisted capability permissions | V8 sandbox has escape vectors |

Tauri's **Rust backend** allows direct calls to `Win32_System_Registry`, WMI for hardware diagnostics,
and `GetTokenInformation` for privilege queries — without spawning subprocesses. Electron would require
a PowerShell child for every native operation, introducing latency and a larger attack surface.

---

## 2. Directory Layout

```
PCFixAI/
├── src-tauri/                        ← PRIVILEGED RUST BACKEND
│   ├── Cargo.toml                    ← Rust dependencies (tokio, windows-rs, serde, etc.)
│   ├── tauri.conf.json               ← Tauri config: window, bundle, capabilities
│   └── src/
│       ├── main.rs                   ← Binary entry (thin shell)
│       └── lib.rs                    ← Core: commands, scan orchestration, agent loop,
│                                        privilege checks, streaming execution, rollback
│
├── src/                              ← FRONTEND (React/TypeScript — no direct OS access)
│   ├── main.tsx                      ← Vite entry point
│   ├── App.tsx                       ← Mode router (dashboard/assistant/history/settings)
│   ├── store/
│   │   └── index.ts                  ← Zustand store (persisted: jobs, chat, settings)
│   ├── hooks/
│   │   ├── useTauriEvents.ts         ← Tauri invoke + event subscriptions bridge
│   │   └── useLocalAI.ts             ← Chat logic: rule-based + backend execution
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx         ← System health, live metrics, AI predictions, scan
│   │   │   ├── FindingsList.tsx      ← Severity-grouped scan findings with fix buttons
│   │   │   ├── AgentFeed.tsx         ← Live AI agent step ticker
│   │   │   ├── HistoryView.tsx       ← Job log + stats summary cards
│   │   │   ├── SettingsView.tsx      ← App preferences (persisted to store)
│   │   │   └── ScanReview.tsx        ← Pre-fix confirmation dialog
│   │   ├── chat/
│   │   │   └── ChatInterface.tsx     ← Chat feed, quick actions, input bar
│   │   ├── panel/
│   │   │   ├── SystemPanel.tsx       ← Tab shell (Metrics/Terminal/Automations/Jobs)
│   │   │   ├── LiveMetrics.tsx       ← CPU/RAM/Disk/Network area charts (Recharts)
│   │   │   ├── ConsoleLog.tsx        ← Streaming terminal with input bar
│   │   │   ├── AutomationTree.tsx    ← Toggleable fix scripts with risk badges
│   │   │   └── StateLog.tsx          ← Job history table
│   │   ├── shared/
│   │   │   ├── TitleBar.tsx          ← Custom draggable chrome
│   │   │   ├── Sidebar.tsx           ← Navigation: Dashboard, Assistant, History, Settings
│   │   │   ├── PrivilegeBanner.tsx   ← Non-elevated warning strip with Relaunch button
│   │   │   └── GlobalProgressBar.tsx ← Scan progress indicator
│   │   └── ui/
│   │       ├── card.tsx              ← Radix-based card component
│   │       └── button.tsx            ← Radix-based button component
│   └── styles/
│       └── globals.css               ← Design tokens, typography, animations, utilities
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── ARCHITECTURE.md
```

---

## 3. Privilege Architecture

### UAC Elevation Flow

```
User launches PCSmartFix.exe
        │
        ▼
Tauri reads app.manifest (requestedExecutionLevel = requireAdministrator)
        │
        ▼
Windows UAC prompt (consent.exe) ─── User clicks "Yes" ──► Process token = elevated
                                  └── User clicks "No"  ──► Process runs restricted
                                                               PrivilegeBanner shown
                                                               Deep fixes disabled
```

### Privilege Check (Rust)
```rust
// Queries TOKEN_ELEVATION from the process token
// Returns true only when TokenIsElevated != 0
privilege::is_elevated()  →  bool
```

### App Manifest (embed in src-tauri/build.rs or res file)
```xml
<requestedPrivileges>
  <requestedExecutionLevel
    level="requireAdministrator"
    uiAccess="false"/>
</requestedPrivileges>
```

---

## 4. Event / IPC Architecture

```
RUST BACKEND                              FRONTEND (React)
────────────────                          ────────────────

scan_system()  ─────invoke──────────────► startScan()
                                              │
app.emit("scan-status", phase)  ◄────────────┤ useTauriEvents (listen)
app.emit("log-line", line)      ◄────────────┤     │
app.emit("job-update", job)     ◄────────────┤     ▼
app.emit("agent-step", step)    ◄────────────┘  Zustand store updates
                                                      │
                                                      ▼
                                               React components re-render
```

All communication is one-way from backend to frontend via typed events.
The frontend never has shell access — it only calls `invoke()` and listens to events.

### Tauri Commands (IPC Bridge)

| Command | Description | Returns |
|---|---|---|
| `check_privileges` | Queries process elevation status | `bool` |
| `get_system_info` | Returns platform + arch | `Value` |
| `scan_system` | Full diagnostic scan (disk, network, restore point) | `ScanResult` |
| `execute_fix` | Run a fix by category + action name | `bool` |
| `get_job_log` | Retrieve all logged jobs | `Vec<JobEntry>` |
| `run_raw_command` | Execute arbitrary program with args (streaming) | `i32` |

---

## 5. Scan & Agent Loop — Decision Tree

```
scan_system() invoked (via Chat "One Click Diagnose" or Dashboard "Scan System")
       │
       ├── create_restore_point()       ← Always first. Emits "Creating restore point…"
       │
       ├── check_disk_health()          ← Runs: Get-PhysicalDisk | ConvertTo-Json
       │       └── Finding? → push to findings[]
       │
       ├── check_network_health()       ← Runs: Test-NetConnection 8.8.8.8:53
       │       └── Finding? → push to findings[]
       │
       └── [extensible: add check_registry, check_startup, check_sfc, ...]
              │
              ▼
       run_agent_loop(findings)
              │
              ▼
       FOR each finding WHERE auto_fixable == true:
              │
              ├── Emit agent-step { status: "running" }
              │
              ├── dispatch fix by category:
              │       "Network"     → fix_network()     → ipconfig /flushdns
              │       "Performance" → fix_performance() → Clear-RecycleBin + temp cleanup
              │       "OS"          → fix_os()          → DISM /RestoreHealth + sfc /scannow
              │       "Security"    → fix_security()    → Browser cache sweep
              │
              ├── IF success → emit job-update { status: Success } → NEXT finding
              │
              └── IF failure → emit agent-step { status: "escalating" }
                      │
                      └── run_escalation(finding)     ← Deeper repair attempt
                              │
                              ├── "Network"  → netsh winsock reset + netsh int ip reset
                              ├── "OS"       → DISM /StartComponentCleanup
                              └── ...
```

### Chat Quick Actions (Backend Execution)

The Assistant chat provides instant actions that execute real commands via `runRawCommand`:

| Action | Commands Executed |
|---|---|
| **Speed up my startup** | Clean `%TEMP%`, `Windows\Temp`, Recycle Bin; audit startup programs |
| **Fix my internet** | `ipconfig /flushdns`, `ipconfig /release` + `/renew`, `netsh winsock reset`, `netsh int ip reset` |
| **Boost my PC** | Temp cleanup, recycle bin, browser cache sweep, High Performance power plan |
| **Clean up disk space** | Temp cleanup, recycle bin, browser cache sweep |
| **Show system specs** | Browser API (navigator.hardwareConcurrency, deviceMemory, user agent parsing) |
| **One Click Diagnose** | Full `scan_system()` → disk + network health checks |

---

## 6. Rollback Architecture

Before any deep system mutation, PCSmartFix:

1. Calls `Checkpoint-Computer` (Windows System Restore) — creates a named restore point.
2. On fix failure: exposes a "Revert" button in the UI that can invoke rollback.

```
Restore point created: "PCSmartFix Pre-Scan"
         │
         ▼ (if deep fix fails or user requests revert)
rstrui.exe /runonce    ← or programmatic: SystemRestore API via windows-rs
```

---

## 7. Adding New Fix Modules (Extension Points)

To add a new diagnostic/fix module (e.g., "Driver Conflict Scanner"):

**Backend** (`src-tauri/src/lib.rs`):
```rust
async fn check_driver_conflicts(app: &AppHandle) -> Vec<Finding> {
    run_command_streaming(app, &id,
        "powershell",
        &["-NonInteractive", "-NoProfile", "-Command",
          "Get-CimInstance Win32_PnPEntity | Where-Object {$_.ConfigManagerErrorCode -ne 0} | ConvertTo-Json"]
    ).await
    // parse output → return Vec<Finding>
}

async fn fix_driver(app: &AppHandle, finding: &Finding) -> bool {
    // pnputil /scan-devices or targeted driver reinstall
}
```

**Then** add to `scan_system()`:
```rust
findings.extend(check_driver_conflicts(&app).await);
```

**And** add the dispatch arm in `run_agent_loop()`:
```rust
"Driver" => fix_driver(&app, finding).await,
```

**Frontend** (`AutomationTree.tsx`) — add a new entry to `DEFAULT_AUTOMATIONS`:
```typescript
{ id: 'driver-scan', category: 'Driver', label: 'Driver Conflict Scan', ... }
```

---

## 8. State Management (Zustand)

The frontend uses a single Zustand store with `persist` middleware for offline resilience:

| Slice | Persisted | Description |
|---|---|---|
| `mode` | Yes | Active view: `dashboard` / `diagnose` / `history` / `settings` |
| `scanPhase` | No | Current scan phase + message |
| `findings` | No | Latest scan findings |
| `jobs` | Yes | Job history (persisted across restarts) |
| `chatMessages` | Yes | Conversation history (persisted across restarts) |
| `agentSteps` | No | Live agent step feed |
| `metrics` | No | Live CPU/RAM/Disk/Network values |
| `settings` | Yes | User preferences |
| `isElevated` | No | Admin privilege status |

---

## 9. LLM Integration (Optional AI Layer)

The agent loop can be enhanced with an LLM reasoning step:

```rust
// After collecting findings, before running fixes:
async fn llm_triage(findings: &[Finding], api_key: &str) -> Vec<String> {
    // POST to local Ollama or remote OpenAI-compatible endpoint
    // Prompt: "Given these system findings, in what order should fixes be applied?
    //          Return a JSON array of finding IDs sorted by recommended execution order."
    // Parse response → reorder findings before agent loop
}
```

Local-first recommendation: **Ollama + llama3.2:3b** — runs on-device, no API key required,
~2 GB RAM. Feed it the Finding descriptions and ask for fix prioritisation or root-cause reasoning.

> Note: The previous `@mlc-ai/web-llm` integration was removed to keep the app fully offline
> with no 8 GB model download. The chat now uses rule-based responses + backend execution.

---

## 10. Build & Run

```powershell
# Prerequisites
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS

# Install
git clone <repo> && cd PCFixAI
npm install

# Dev (hot-reload)
npm run tauri:dev

# Type-check only
npx tsc --noEmit

# Release build (.exe + NSIS installer)
npm run tauri:build
# Output: src-tauri/target/release/bundle/
```

**First run**: Windows will prompt UAC. After elevation, the Privilege Banner disappears
and all deep-system fixes become available.

---

## 11. Toolkit Managers

The **Toolkit** page includes interactive system managers with live data, accessible via sub-tabs:

| Manager | Component | Backend Command | Purpose |
|---|---|---|---|
| **Startup Programs** | `StartupManager.tsx` | `get_startup_items` | List/remove startup entries from registry + Startup folder |
| **Running Processes** | `ProcessManager.tsx` | `get_processes`, `kill_process` | List processes sorted by memory, kill by PID |
| **System Services** | `ServiceManager.tsx` | `get_services`, `manage_service` | List/start/stop services, filter by status |
| **Installed Apps** | `UninstallManager.tsx` | `get_installed_apps` | List installed programs with version/publisher |

Each manager component fetches live data on mount, provides search/filter controls, and logs
significant actions (kill process, manage service) to the History page via `useStore.getState().updateJob()`.

### Manager Data Flow

```
Manager Component → useTauriEvents wrapper → Tauri invoke → Rust command → PowerShell / WMI
                                                            ↓
                                              useStore.getState().updateJob(...)
```

### Toolkit Categories (7 total)

1. **Performance** — CPU, memory, disk, network diagnostics
2. **Hardware** — Device info, temperature, drivers
3. **Cleanup** — Temp files, browsers, recycle bin, Windows Update cache
4. **Troubleshooting** — Network, printer, audio, Windows Update
5. **Advanced** — Registry, system file checker, DISM, event logs
6. **Drivers** — Driver audit, export
7. **External Power Tools** — MAS, WinUtil, WinScript, Winhance (internet required)
8. **System Managers** — Startup, Processes, Services, Installed Apps (interactive sub-tabs)
