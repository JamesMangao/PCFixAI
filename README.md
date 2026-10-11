# PCFixAI

**Intelligent PC repair and diagnostics — offline-first.**

[**v1.5.1**] Fixed auto-fix wiping all startup entries, added HTTP ACL scope for Ollama, real browser cache paths, working hibernation toggle, and 20+ stability patches. All features now work as intended.

Most features work offline; optional AI-powered chat via Ollama.

---

- **Ollama HTTP scope** — Added `plugins.http.scope` to `tauri.conf.json`; AI chat now works (was 100% dead from missing ACL).
- **Auto-fix startup script** — Fixed `$_` shadowing that deleted every HKLM/HKCU startup entry; now creates a backup before removing non-essential items.
- **Browser cache paths** — Fixed 5 cleanup locations using guessed `%LOCALAPPDATA%\<browser>\Cache` that matched no installed browser; now uses real vendor dirs (Chrome, Edge, Brave, Firefox, Vivaldi, Opera).
- **Hibernation toggle** — Fixed `powercfg "/hibernate on"` single-arg failure; now uses two args `/hibernate` + `on/off`.
- **Scan deadlock fix** — `run_command_streaming` now drains both pipes independently and waits after draining; no more busy-loop or permanent spinner.
- **Scan phase terminal event** — Agent loop now emits final `scan-status "complete"`; no longer permanently pinned to `"fixing"`.
- **PowerShell injection** — Added `ps_quote()` helper that doubles `'` in service names/profile names; prevents command injection in `manage_service` and `set_network_profile`.
- **`toggle_hibernation` auto-fixable** — Set to `false`; no longer falsely claims it can fix memory.
- **`fix_high_memory` honest** — `fix_available: false, auto_fixable: false`; no longer claims it can fix memory.
- **Virus-scan branch ordering** — Moved `includes('scan for virus')` etc. after the `includes('scan')` greedy branch; clicking "Virus scan" actually runs `Start-MpScan`.
- **`updateLastChatMessage` ID-based** — Now takes `(id, content)` instead of positional `len-1`; results go to the correct bubble; no more destroying the Welcome message.
- **Fallback response ordering** — `'thanks'` before `'thank'`; `'goodbye'` before `'bye'`; now reachable.
- **Disk space `FreeGB === 0`** warning now correctly fires when disk is completely full.
- **`isGenerating` guard** now covers all 11 tool branches; typing indicator works during operations.
- **`logJob` status** no longer has identical ternary arms; entries are accurate.
- **Build** — `npm run build` succeeds (TSC 0 errors, Vite production bundle).

### Other noteworthy changes (full detail in audit)

- `spawn_detached` — removed `std::mem::forget(child)` — no handle leak per call
- `manage_service` / `set_network_profile` — `ps_quote()` on name/category parameters
- `fix_high_memory` — honest about capability
- `check_disk_space` — guard against missing/zero `Size` divisor
- `OllamaBanner` — pull result now honored; no longer forced to `"ready"` after failed download
- `GlobalProgressBar` — `isScanning` no longer permanently true (was hiding `activeTask`)
- `SettingsView` — dropdown `value`/`option` matching fixed (was corrupting own state)
- `SfcManager` — result interpretation now reads `sfc.exe` stdout, not exit code
- `WingetManager` — `exitCode` now checked; per-package/Update All mutually exclusive
- `SpeedTest` — failed ping no longer rated "Excellent" with 0 ms; progress bar no longer stuck
- `DriverBackup/Restore` — `"` characters no longer passed as literal argv to `dism`/`pnputil`; wildcard `*.inf` handled
- `ToolkitView` — search no longer hides entire System Managers category; dead `dangerous` badge removed
- `ConsoleLog` — index-based keys fixed for shifting 2000-line window
- `AutomationTree` — `try/finally` with no `catch` fixed; unhandled rejections silenced
- `ServiceManager` — `stoped` → `stopped` typo fixed; `killProcess`/`manageService` now shows feedback on failure
- `UninstallManager` — size now labeled MB (was KB, was 100× too large)
- `TitleBar` — `isMaximized` now synced to window state; `minimize`/`close`/`maximize` rejections handled
- `UpdateBanner` — `error` status now rendered; "Update" button has `disabled` state
- `OllamaBanner` — `installOllama` now has try/catch; no more stuck `"installing"` state
- `Dashboard` — metrics poll no longer floods `consoleLogs` with 8 lines × 2 pollers
- `FindingsList` — `relaunchElevated()` now has try/catch; no unhandled rejection
- `AdminPrompt` — `privilegeChecked` now respected; no longer flashes before check resolves
- `SfcManager` — elevation warning no longer erased by first scan
- `GlobalProgressBar` — animation `duration: 0` with `x: '300%'` fixed; bar no longer empty on completion
- `LiveMetrics` — duplicate metrics poller removed; no longer doubles backend load + terminal spam
- `ConsoleLog` — `try/finally` with no `catch` around `executeFix` fixed; no unhandled rejection
- `SystemPanel` — import chain fixed; panel now actually renders in-app (was imported nowhere)

---

## v1.5.0 — Feature Announcement (2026-08)

*Announced feature set that was partly wired up to UI. 16 of 31 Tauri commands unreachable from UI; many features missing or write-only. See `DEAD_COMMANDS.md` for full audit.*

---

## Internet-Required Features

Most features work offline. These require an internet connection:

| Feature | What it downloads | Why |
|---------|------------------|-----|
| Speed Test | Test files from speedtest.tele2.net | Measures real throughput |
| Winget Install | Winget installer from GitHub | Not bundled with Windows 10 |
| Winget Updates | Package updates from winget sources | Updates come from vendors |
| Auto Update Drivers | PSWindowsUpdate module from PowerShell Gallery | Module not bundled |
| External Power Tools | MAS, WinUtil, WinScript, Winhance scripts | Third-party tools (see warning below) |
| Ollama (optional) | LLM model from Ollama registry | ~2 GB download for llama3.2:3b |

### External Tools Security Notice

The "External Power Tools" category (MAS, WinUtil, WinScript, Winhance) downloads and executes remote scripts with full system access. These are third-party projects not affiliated with PCFixAI. Verify the source before running.

---

## Features (condensed)

- **One-Click System Scan** — Parallel disk health, network, CPU, memory, startup programs (~60% faster)
- **Auto-Fix Agent** — DNS, temp files, network stack, browser caches (now safe; no longer destroys startup)
- **Virus Scanner** — Windows Defender quick/full scan, threat history, removal
- **Event Log Analyzer** — BSOD crashes, system errors, smart filtering
- **Power Plan Manager** — Switch between High Performance, Balanced, Power Saver
- **Exportable System Report** — HTML report to Desktop
- **Health History** — Trend tracking over time
- **Live System Metrics** — Real-time CPU, RAM, Disk I/O, Network
- **Chat Assistant** — Quick-action buttons + natural language commands
- **Optional AI** — Ollama + llama3.2:3b (now actually works)
- **Restore Points** — Windows System Restore before every scan
- **Job History** — Full audit trail with exit codes
- **Privilege Detection** — Warns when deep fixes are restricted
- **Search Across Toolkit** — Real-time search 40+ tools
- **Light Theme** — Full light theme with proper contrast
- **Keyboard Shortcuts** — `Ctrl+1-5` views, `Ctrl+K` dashboard
- **Toolkit** — 40+ system tools across 10 manager tabs

---

## Project Structure

```
PCFixAI/
├── src-tauri/          # Rust backend (commands, scan, agent loop)
├── src/                # React frontend (components, store, hooks)
│   ├── components/chat/
│   ├── components/dashboard/
│   ├── components/toolkit/
│   ├── components/panel/
│   ├── components/shared/
│   ├── hooks/          # useLocalAI, useTauriEvents, useUpdater
│   ├── store/          # Zustand state management
│   └── styles/         # globals.css (dark + light themes)
├── package.json
└── vite.config.ts
```

---

## Installation

### Prerequisites

- **Rust** (via [rustup](https://rustup.rs/))
- **Node.js** (v18+ LTS, via [nodejs.org](https://nodejs.org/))
- **Windows 10 or Windows 11**

### Setup

```powershell
git clone https://github.com/JamesMangao/PCFixAI.git
cd PCFixAI
npm install
npm run tauri:dev
```

### Building for Production

```powershell
npx tsc --noEmit
npm run tauri:build
# Output: src-tauri/target/release/bundle/nsis/
```

---

## Usage

1. **Launch** the app — UAC prompts for admin privileges (recommended)
2. **Dashboard** — View health, metrics, run scan
3. **Assistant** — Chat AI or quick-action buttons:
   - `One Click Diagnose` — Full parallel scan
   - `Speed up my startup` — Clean temp, audit startup
   - `Fix my internet` — Flush DNS, reset Winsock/TCP/IP
   - `Boost my PC` — Clean caches, activate High Performance plan
   - `Clean up disk space` — Remove temp files + browser caches
   - `Show my system specs` — OS, CPU, RAM, GPU, arch info
   - `Scan for virus` — Defender quick scan
   - `Event log` — BSOD crashes + system errors
   - `Power plan` — View/switch power plans
4. **Toolkit** — 40+ tools across 10 manager tabs
5. **History** — All past jobs with stats
6. **Settings** — Preferences incl. Light Theme
7. **Keyboard Shortcuts** — `Ctrl+1-5` views, `Ctrl+K` dashboard

### Optional: AI-Powered Chat

```powershell
winget install Ollama.Ollama
ollama pull llama3.2:3b
```

PCFixAI auto-detects Ollama and shows connection quality (latency, model readiness).

---

## License

MIT. See [LICENSE](LICENSE).

---

## Acknowledgments

- Tauri — Secure, lightweight desktop framework
- Recharts — Composable charting
- Framer Motion — Production-ready animations
- Lucide — Beautiful, consistent icons