# PCFixAI

**Intelligent PC repair and diagnostics — offline-first.**

PCFixAI is a desktop application that diagnoses and fixes common Windows issues in one click. It scans your system, creates a restore point, and auto-repairs detected problems. Most features work offline; optional AI-powered chat via Ollama.

---

## Latest Update — v1.4.0 (August 2026)

### New Security & Power Features

- **Virus Scanner** — Full Windows Defender integration with quick scan, full scan, threat history, and threat removal
- **Power Plan Manager** — Switch between High Performance, Balanced, Power Saver, and Ultimate Performance plans
- **Hibernation Controls** — Enable/disable hibernation and manage sleep settings
- **Network Profile Switcher** — Change network profiles between Public, Private, and Domain
- **BitLocker Status** — Check encryption status on all drives
- **Windows Update Manager** — View pending updates with KB numbers and severity

### Event Log & Diagnostics

- **Event Log Analyzer** — Parse recent BSOD crashes, system errors, and warnings with smart filtering
- **BSOD Detection** — Dedicated BugCheck event parsing with crash timestamps and stop codes
- **Exportable System Report** — Generate a beautiful HTML report with all findings, saved to Desktop

### Performance Improvements

- **Parallel Scan** — All 6 diagnostic checks now run simultaneously via `tokio::join!` (~60% faster scans)
- **Health History** — Health scores saved over time for trend tracking
- **Contextual Fix Suggestions** — Scan results now include actionable recommendations

### UI/UX Enhancements

- **Search Across Toolkit** — Real-time search across all 40+ tools by name or description
- **Light Theme** — Full light theme with proper contrast and reduced shadows
- **Keyboard Shortcuts** — `Ctrl+1-5` to switch views, `Ctrl+K` for quick dashboard
- **Expanded Chat Commands** — Natural language for virus scans, event logs, power plans, disk space, and network diagnostics
- **New Chat Quick Actions** — Virus scan, event logs, and power plans in the chat quick actions bar

### New Toolkit Categories

- **Security & Virus Scanner** (8 tools) — Defender status, quick/full scans, threat history, threat removal, signature updates, protection controls, MRT scanner
- **Power & Sleep Management** (8 tools) — View/switch power plans, enable/disable hibernation, sleep settings, power report

---

## Previous Update — v1.4.0 (August 2026)

### Built-in Auto-Updater

- **Background Update Checks** — Periodic checks for new releases via Tauri updater plugin (every 4 hours + 4s on startup)
- **In-App Update Banner** — Download, install, or skip updates without leaving the app; expandable release notes
- **Download Progress** — Real-time progress bar during download with percentage display
- **Auto-Restart** — Seamless restart after update installation
- **Skip per Version** — Skip a specific version without dismissing the updater entirely

### Premium UI Refresh

- **Glassmorphism Design System** — Complete redesign with deep-space backgrounds, glass-effect panels, refined gradients, and multi-layered shadows
- **Premium Title Bar** — Custom SVG window buttons (minimize/maximize/restore/close) with hover glow effects, gradient brand text, and top-edge accent line
- **Refined Sidebar** — Gradient brand header, glow-active navigation indicators, right-edge accent glow, cleaner spacing
- **Premium Chat Interface** — Glass-effect chat container, asymmetric gradient bubbles, animated typing dots, gradient send button with inset highlights
- **Premium Dashboard** — Metric cards with hover-responsive borders, status-colored glow dots, layered health header decorations
- **Polished Settings** — Spring-animated toggles with glow, focus-highlighted inputs, status indicator dots
- **Premium Modals** — AdminPrompt and UpdateNotes with top gradient accent lines, frosted glass backdrops, refined button shadows
- **New Animations** — `float`, `borderGlow`, `subtlePulse` keyframes, smoother scrollbars, premium selection highlight

### Windows 10 & 11 Compatibility

- **Windows Version Detection** — New Rust backend command detects Windows 10 vs Windows 11 (build 22000+) via WMI
- **Windows 11 24H2+ Fallbacks** — Troubleshooter actions gracefully open modern Settings pages when `msdt.exe` is unavailable
- **Windows 10 Winget Handling** — Improved detection and installation guidance for winget on Windows 10 (not pre-installed)
- **Enhanced WMI Queries** — Better error handling for older Windows 10 builds where some WMI classes may not be available
- **Expanded Browser Cleanup** — Cache sweep now covers Brave, Vivaldi, Opera, and Service Worker CacheStorage directories

### Ollama Connection Improvements

- **Connection Quality Monitoring** — Periodic latency checks with millisecond display
- **Model Verification** — Queries Ollama's `/api/tags` to verify the configured model is loaded and ready
- **Auto-Recovery Detection** — If Ollama stops running, the banner reappears automatically
- **Status Badge** — AI Connected / Rule-based indicator in the chat header

### Bug Fixes

- **Fixed `cfg` gate control flow** — Proper `#[cfg(not(target_os = "windows"))]` blocks in `fix_network`, `fix_os`, `fix_security`, and `run_escalation` prevent unreachable code warnings
- **Live Metrics Real Data** — LiveMetrics panel now uses actual backend metrics instead of random simulation
- **Window Maximize Button** — Title bar now includes a functional maximize/restore toggle
- **Defensive WMI Queries** — Disk health, RAM calculation, disk I/O, and network counters use `SilentlyContinue` to avoid crashes on older Windows 10 builds
- **Network Fix Escalation** — Winsock/TCP/IP reset now emits agent-step event for status visibility
- **Deep Performance Escalation** — Escalation now performs thorough browser cache cleanup across Chrome, Firefox, Edge, Brave, Vivaldi, and Opera

### What's New Modal

- **Update Notes on Launch** — First launch after updating shows a "What's New" modal with categorized release notes
- **Version-Persisted Dismissal** — Modal only shows once per version, tracked in localStorage

---

## Previous Update — v1.3.0

### New Features

- **Enhanced AI Integration** — Improved Ollama AI integration with better model handling and response streaming
- **UI Component Enhancements** — Additional animations, smoother transitions, and refined visual feedback
- **Updated Tauri Backend** — Latest Tauri version with improved stability and performance

### Improvements

- **Performance Optimizations** — Faster startup time and reduced memory usage
- **Stability Fixes** — Resolved various edge cases in scan and repair workflows
- **UI Refinements** — Enhanced component rendering and animation performance

---

## Previous Update — v1.2.0

### New Features

- **Ollama AI Integration** — Auto-detects Ollama, in-app install via winget, AI-powered chat for open-ended questions with graceful fallback to rule-based responses
- **Winget App Updater** — Automatically checks for outdated packages via winget, installs winget if missing, updates individual or all apps silently
- **SFC/DISM Manager** — Visual interface for System File Checker and DISM restore health scans with real-time progress, result display, and restart notifications
- **Network Speed Test** — Built-in download/upload/ping speed test using PowerShell (no browser required), with speed ratings (Excellent/Good/Fair/Slow)
- **Driver Backup & Restore** — Export all third-party drivers via DISM, restore from backup via pnputil; browse installed drivers grouped by category

### Improvements

- **Premium UI** — Animated message bubbles, spring-physics accordion, gradient health header, card hover effects, sidebar glow indicators, staggered entrance animations
- **Functional Settings** — Theme dropdown, notifications toggle, log retention, Ollama model config, reset all settings
- **History Logging** — All actions (chat quick actions, dashboard buttons, toolkit operations, scan results) now appear in History
- **Real System Specs** — "Show my system specs" returns live WMI data (CPU, RAM, GPU, Disk, Motherboard, OS)
- **Dashboard Quick Actions** — Temp File Cleanup, DNS Flush, Browser Cache Sweep buttons now execute real commands with status feedback
- **Enhanced Scan** — Rust backend now checks disk space, CPU usage, memory usage, and startup program count
- **Honest External Tools** — Security warnings on internet-dependent tools, clear "Remote Script" badges

---

## Features

- **One-Click System Scan** — Disk health, network connectivity, restore point creation (all checks run in parallel for ~60% faster scans)
- **Auto-Fix Agent** — Automatically repairs DNS, cleans temp files, resets network stack, clears browser caches
- **Virus Scanner** — Windows Defender integration with quick scan, full scan, threat history, threat removal, and signature updates
- **Event Log Analyzer** — Parse BSOD crashes, system errors, and warnings with smart filtering
- **Power Plan Manager** — Switch between High Performance, Balanced, Power Saver, and Ultimate Performance
- **Exportable System Report** — Generate a beautiful HTML report with all findings, saved to Desktop
- **Health History** — Track system health scores over time for trend analysis
- **Live System Metrics** — Real-time CPU, RAM, Disk I/O, and Network usage with sparkline charts
- **AI Predictions** — CPU trend analysis, disk health monitoring, system stability scoring
- **Chat Assistant** — Describe your issue or use quick-action buttons to execute real fixes
- **Natural Language Commands** — Ask about viruses, event logs, power plans, disk space, and more in plain English
- **Optional AI** — Install Ollama + llama3.2:3b for AI-powered chat responses (auto-detected, in-app install)
- **Restore Points** — Every scan creates a Windows System Restore point; all changes are reversible
- **Job History** — Full audit trail of every action with exit codes and status
- **Privilege Detection** — Automatically detects admin elevation and warns when deep fixes are restricted
- **Search Across Toolkit** — Real-time search across all 40+ tools by name or description
- **Light Theme** — Full light theme with proper contrast and reduced shadows
- **Keyboard Shortcuts** — `Ctrl+1-5` to switch views, `Ctrl+K` for quick dashboard
- **Toolkit** — 40+ system tools across 10 interactive manager tabs:
  - Startup Programs, Running Processes, System Services, Installed Apps
  - App Updates (Winget), SFC/DISM, Speed Test, Driver Backup
  - Performance, Hardware, Cleanup, Troubleshooting, Advanced, Drivers, External Tools
  - Security & Virus Scanner, Power & Sleep Management

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

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Framework** | [Tauri 2](https://v2.tauri.app/) (Rust backend) |
| **Frontend** | React 18 + TypeScript + Vite |
| **State Management** | Zustand with persist middleware |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Backend Language** | Rust (tokio async runtime) |
| **Windows API** | `windows-rs` crate (Win32 Security, Threading, Registry) |
| **Installer** | NSIS |

---

## Installation

### Prerequisites

- **Rust** (via [rustup](https://rustup.rs/))
- **Node.js** (v18+ LTS, via [nodejs.org](https://nodejs.org/))
- **Windows 10 or Windows 11**

### Setup

```powershell
# Clone the repository
git clone https://github.com/JamesMangao/PCFixAI.git
cd PCFixAI

# Install dependencies
npm install

# Run in dev mode (hot-reload)
npm run tauri:dev
```

### Building for Production

```powershell
# Type-check
npx tsc --noEmit

# Build release
npm run tauri:build

# Output: src-tauri/target/release/bundle/nsis/
```

---

## Usage

1. **Launch** the app — UAC will prompt for admin privileges (recommended for full functionality)
2. **What's New** — On first launch after an update, review the release notes
3. **Dashboard** — View system health, live metrics, AI predictions, and run a scan
4. **Assistant** — Chat with the AI or use quick-action buttons:
   - `One Click Diagnose` — Full system scan (all checks run in parallel)
   - `Speed up my startup` — Clean temp files, audit startup programs
   - `Fix my internet` — Flush DNS, reset Winsock/TCP/IP
   - `Boost my PC` — Clean caches, activate High Performance power plan
   - `Clean up disk space` — Remove temp files and browser caches
   - `Show my system specs` — Display OS, CPU, RAM, GPU, architecture info
   - `Scan for virus` — Run Windows Defender quick scan
   - `Event log` — Check for BSOD crashes and system errors
   - `Power plan` — View or switch power plans
5. **Toolkit** — Browse 40+ system tools across 10 interactive manager tabs (includes Security & Virus Scanner, Power & Sleep Management)
6. **History** — View all past jobs with stats (total ops, success rate, timestamps)
7. **Settings** — Adjust preferences including Light Theme (persisted across restarts)
8. **Keyboard Shortcuts** — `Ctrl+1-5` to switch views, `Ctrl+K` for dashboard

### Optional: AI-Powered Chat

For AI-powered responses to open-ended questions:

```powershell
# Install Ollama (or use the in-app button)
winget install Ollama.Ollama

# Pull a language model
ollama pull llama3.2:3b
```

PCFixAI auto-detects Ollama and shows connection quality (latency, model readiness).

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, including:

- Tauri vs Electron rationale
- Privilege architecture (UAC elevation flow)
- Event/IPC architecture
- Scan and agent loop decision tree
- Rollback and restore point system
- Ollama AI integration
- Extension points for new fix modules

---

## How It Works

```
User clicks "Scan System" or "One Click Diagnose"
        │
        ▼
Frontend calls invoke("scan_system")
        │
        ▼
Rust backend:
  1. Creates Windows System Restore point
  2. Runs ALL diagnostic checks IN PARALLEL (~60% faster):
     - Disk health (Get-PhysicalDisk)
     - Disk space (Win32_LogicalDisk)
     - Network health (Test-NetConnection 8.8.8.8:53)
     - CPU usage (Win32_Processor)
     - Memory usage (Win32_OperatingSystem)
     - Startup programs (Win32_StartupCommand)
  3. Returns findings to frontend
        │
        ▼
Agent loop auto-fixes each finding:
  - Network issues → ipconfig /flushdns
  - Temp files → Clear-RecycleBin + Remove-Item $env:TEMP\*
  - Browser caches → Chrome/Firefox/Edge/Brave/Vivaldi/Opera cache sweep
  - OS corruption → DISM /RestoreHealth + sfc /scannow
        │
        ▼
Results streamed to UI via events (scan-status, log-line, job-update, agent-step)
Health snapshot saved for trend tracking
```

---

## Project Structure

```
PCFixAI/
├── src-tauri/          # Rust backend (commands, scan, agent loop)
├── src/                # React frontend (components, store, hooks)
│   ├── components/
│   │   ├── chat/       # ChatInterface with animated messages
│   │   ├── dashboard/  # Dashboard, Settings, History, Findings
│   │   ├── toolkit/    # 10 tool categories + 8 interactive managers
│   │   ├── panel/      # LiveMetrics, ConsoleLog, AutomationTree, StateLog
│   │   └── shared/     # Sidebar, TitleBar, AdminPrompt, UpdateNotes, Banners
│   ├── hooks/          # useLocalAI, useTauriEvents, useUpdater
│   ├── store/          # Zustand state management
│   └── styles/         # globals.css design tokens (dark + light themes)
├── ARCHITECTURE.md     # Full system design document
├── package.json        # Node dependencies
└── vite.config.ts      # Vite build config
```

---

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Run `npx tsc --noEmit` before committing to catch type errors
- Run `npm run build` to verify the Vite build succeeds
- Follow existing code style (no comments unless asked, TypeScript strict mode)
- New fix modules should follow the pattern in [ARCHITECTURE.md §7](ARCHITECTURE.md#7-adding-new-fix-modules-extension-points)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Tauri](https://tauri.app/) — Secure, lightweight desktop framework
- [Recharts](https://recharts.org/) — Composable charting library
- [Framer Motion](https://www.framer.com/motion/) — Production-ready animations
- [Lucide](https://lucide.dev/) — Beautiful, consistent icons
