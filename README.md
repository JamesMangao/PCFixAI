# PCFixAI

**AI-powered PC repair and diagnostics — fully offline.**

PCFixAI is a desktop application that diagnoses and fixes common Windows issues in one click. It scans your system, creates a restore point, and auto-repairs detected problems — all without sending any data to the cloud.

---

## Features

- **One-Click System Scan** — Disk health, network connectivity, restore point creation
- **Auto-Fix Agent** — Automatically repairs DNS, cleans temp files, resets network stack, clears browser caches
- **Live System Metrics** — Real-time CPU, RAM, Disk I/O, and Network usage with sparkline charts
- **AI Predictions** — CPU trend analysis, disk health monitoring, system stability scoring
- **Chat Assistant** — Describe your issue or use quick-action buttons to execute real fixes
- **Restore Points** — Every scan creates a Windows System Restore point; all changes are reversible
- **Job History** — Full audit trail of every action with exit codes and status
- **Privilege Detection** — Automatically detects admin elevation and warns when deep fixes are restricted
- **Toolkit** — 8 categories of system tools: Performance, Hardware, Cleanup, Troubleshooting, Advanced, Drivers, External Tools, and System Managers (Startup, Processes, Services, Installed Apps)
- **Fully Offline** — No internet connection required, no data leaves your machine

---

## Screenshots

>**Main Dashboard**
![Main dashboard](assets/dashboard.png)
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
- **Windows 10/11**

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
2. **Dashboard** — View system health, live metrics, AI predictions, and run a scan
3. **Assistant** — Chat with the AI or use quick-action buttons:
   - `One Click Diagnose` — Full system scan
   - `Speed up my startup` — Clean temp files, audit startup programs
   - `Fix my internet` — Flush DNS, reset Winsock/TCP/IP
   - `Boost my PC` — Clean caches, activate High Performance power plan
   - `Clean up disk space` — Remove temp files and browser caches
   - `Show my system specs` — Display OS, CPU, RAM, architecture info
4. **Toolkit** — Browse 30+ system tools across 8 categories; interactive managers for startup programs, running processes, services, and installed apps
5. **History** — View all past jobs with stats (total ops, success rate, timestamps)
6. **Settings** — Adjust preferences (persisted across restarts)

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, including:

- Tauri vs Electron rationale
- Privilege architecture (UAC elevation flow)
- Event/IPC architecture
- Scan and agent loop decision tree
- Rollback and restore point system
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
  2. Checks disk health (Get-PhysicalDisk)
  3. Checks network health (Test-NetConnection 8.8.8.8:53)
  4. Returns findings to frontend
        │
        ▼
Agent loop auto-fixes each finding:
  - Network issues → ipconfig /flushdns
  - Temp files → Clear-RecycleBin + Remove-Item $env:TEMP\*
  - Browser caches → Chrome/Firefox/Edge/Brave cache sweep
  - OS corruption → DISM /RestoreHealth + sfc /scannow
        │
        ▼
Results streamed to UI via events (scan-status, log-line, job-update, agent-step)
```

---

## Project Structure

```
PCFixAI/
├── src-tauri/          # Rust backend (commands, scan, agent loop)
├── src/                # React frontend (components, store, hooks)
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
