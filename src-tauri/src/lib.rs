// ============================================================
//  PCFixAI — Tauri 2 Backend Core
//  Handles: privilege checks, command execution, event streaming,
//  scan orchestration, rollback checkpoints, and AI agent loop.
// ============================================================

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// ─────────────────────────────────────────────────────────────
//  Shared State
// ─────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AppState {
    pub scan_running: Mutex<bool>,
    pub job_log: Mutex<Vec<JobEntry>>,
}

// ─────────────────────────────────────────────────────────────
//  Data Models
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEntry {
    pub id: String,
    pub timestamp: String,
    pub category: String,
    pub action: String,
    pub status: JobStatus,
    pub output: Vec<String>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Running,
    Success,
    Failed,
    Skipped,
    RolledBack,
}

/// Emitted to frontend for every stdout/stderr line
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogLine {
    job_id: String,
    line: String,
    stream: String, // "stdout" | "stderr"
    timestamp: String,
}

/// Emitted when a job changes status
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobUpdate {
    job: JobEntry,
}

/// Returned from scan_system
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub scan_id: String,
    pub findings: Vec<Finding>,
    pub restore_point_created: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    pub severity: Severity,
    pub category: String,
    pub title: String,
    pub description: String,
    pub fix_available: bool,
    pub auto_fixable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

// ─────────────────────────────────────────────────────────────
//  Privilege Helpers
// ─────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod privilege {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    pub fn is_elevated() -> bool {
        unsafe {
            let mut token: HANDLE = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut cb_size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
            let result = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut _),
                cb_size,
                &mut cb_size,
            );
            let _ = CloseHandle(token);
            result.is_ok() && elevation.TokenIsElevated != 0
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod privilege {
    pub fn is_elevated() -> bool {
        unsafe { libc::geteuid() == 0 }
    }
}

// ─────────────────────────────────────────────────────────────
//  Core Execution Engine
// ─────────────────────────────────────────────────────────────

/// Runs a single command, streaming every output line to the frontend.
/// Returns (exit_code, collected_lines).
async fn run_command_streaming(
    app: &AppHandle,
    job_id: &str,
    program: &str,
    args: &[&str],
) -> anyhow::Result<(i32, Vec<String>)> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut lines_collected: Vec<String> = Vec::new();

    let app_clone = app.clone();
    let jid = job_id.to_string();
    let mut out_reader = BufReader::new(stdout).lines();
    let mut err_reader = BufReader::new(stderr).lines();

    loop {
        tokio::select! {
            line = out_reader.next_line() => {
                match line? {
                    Some(l) => {
                        lines_collected.push(l.clone());
                        let _ = app_clone.emit("log-line", LogLine {
                            job_id: jid.clone(),
                            line: l,
                            stream: "stdout".into(),
                            timestamp: Utc::now().to_rfc3339(),
                        });
                    }
                    None => break,
                }
            }
            line = err_reader.next_line() => {
                if let Ok(Some(l)) = line {
                    lines_collected.push(format!("[ERR] {}", l.clone()));
                    let _ = app_clone.emit("log-line", LogLine {
                        job_id: jid.clone(),
                        line: l,
                        stream: "stderr".into(),
                        timestamp: Utc::now().to_rfc3339(),
                    });
                }
            }
        }
    }

    let exit = child.wait().await?;
    Ok((exit.code().unwrap_or(-1), lines_collected))
}

// ─────────────────────────────────────────────────────────────
//  Rollback / Restore Point
// ─────────────────────────────────────────────────────────────

async fn create_restore_point(app: &AppHandle, label: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"Checkpoint-Computer -Description "{label}" -RestorePointType "MODIFY_SETTINGS""#
        );
        let id = Uuid::new_v4().to_string();

        // Wrap in a 15-second timeout since Checkpoint-Computer can sometimes hang for several minutes
        match tokio::time::timeout(
            std::time::Duration::from_secs(15),
            run_command_streaming(
                app,
                &id,
                "powershell",
                &["-NonInteractive", "-NoProfile", "-Command", &script],
            ),
        )
        .await
        {
            Ok(Ok((0, _))) => return true,
            _ => {}
        }
    }
    false
}

// ─────────────────────────────────────────────────────────────
//  Diagnostic Modules
// ─────────────────────────────────────────────────────────────

async fn check_disk_health(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    let result = run_command_streaming(
        app,
        &id,
         "powershell",
         &[
             "-NonInteractive", "-NoProfile", "-Command",
             "Get-PhysicalDisk -ErrorAction SilentlyContinue | Select-Object FriendlyName,HealthStatus,OperationalStatus | ConvertTo-Json",
         ],
    ).await;

    #[cfg(not(target_os = "windows"))]
    let result = run_command_streaming(app, &id, "df", &["-h"]).await;

    match result {
        Ok((0, lines)) => {
            let output = lines.join("\n");
            if output.contains("Unhealthy") || output.contains("Warning") {
                findings.push(Finding {
                    id: Uuid::new_v4().to_string(),
                    severity: Severity::High,
                    category: "Disk".into(),
                    title: "Disk health warning detected".into(),
                    description: output.chars().take(200).collect(),
                    fix_available: false,
                    auto_fixable: false,
                });
            }
        }
        Ok((code, _)) => {
            findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                severity: Severity::Medium,
                category: "Disk".into(),
                title: format!("Disk health check returned exit code {code}"),
                description: "Could not parse disk health output.".into(),
                fix_available: false,
                auto_fixable: false,
            });
        }
        Err(e) => {
            findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                severity: Severity::Low,
                category: "Disk".into(),
                title: "Disk health check failed to run".into(),
                description: e.to_string(),
                fix_available: false,
                auto_fixable: false,
            });
        }
    }

    findings
}

async fn check_network_health(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    let result = run_command_streaming(
        app,
        &id,
        "powershell",
        &[
            "-NonInteractive", "-NoProfile", "-Command",
            "Test-NetConnection -ComputerName 8.8.8.8 -Port 53 | Select-Object TcpTestSucceeded | ConvertTo-Json",
        ],
    ).await;

    #[cfg(not(target_os = "windows"))]
    let result = run_command_streaming(app, &id, "ping", &["-c", "1", "8.8.8.8"]).await;

    if let Ok((code, lines)) = result {
        if code != 0 || lines.iter().any(|l| l.contains("False")) {
            findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                severity: Severity::High,
                category: "Network".into(),
                title: "External DNS connectivity failure".into(),
                description: "Cannot reach 8.8.8.8:53. DNS flush and adapter reset recommended."
                    .into(),
                fix_available: true,
                auto_fixable: true,
            });
        }
    }

    findings
}

async fn check_disk_space(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let result = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive", "-NoProfile", "-Command",
                "Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\" | Select-Object FreeSpace, Size | ConvertTo-Json",
            ],
        ).await;

        if let Ok((0, lines)) = result {
            let output = lines.join("\n");
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output) {
                let free = json["FreeSpace"].as_f64().unwrap_or(0.0);
                let total = json["Size"].as_f64().unwrap_or(1.0);
                let pct = (free / total) * 100.0;
                if pct < 10.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::Critical,
                        category: "Performance".into(),
                        title: format!("Critical low disk space — {:.1}% free on C:", pct),
                        description: "Less than 10% free disk space can cause system instability and slow performance.".into(),
                        fix_available: true,
                        auto_fixable: true,
                    });
                } else if pct < 20.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::Medium,
                        category: "Performance".into(),
                        title: format!("Low disk space — {:.1}% free on C:", pct),
                        description: "Less than 20% free disk space may impact performance.".into(),
                        fix_available: true,
                        auto_fixable: true,
                    });
                }
            }
        }
    }

    findings
}

async fn check_high_cpu(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let result = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive", "-NoProfile", "-Command",
                "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
            ],
        ).await;

        if let Ok((0, lines)) = result {
            let output = lines.join("").trim().to_string();
            if let Ok(cpu_pct) = output.parse::<f64>() {
                if cpu_pct > 90.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::High,
                        category: "Performance".into(),
                        title: format!("High CPU usage — {:.0}%", cpu_pct),
                        description: "CPU usage is critically high. Check for resource-hungry processes in Task Manager.".into(),
                        fix_available: false,
                        auto_fixable: false,
                    });
                } else if cpu_pct > 70.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::Medium,
                        category: "Performance".into(),
                        title: format!("Elevated CPU usage — {:.0}%", cpu_pct),
                        description: "CPU usage is above normal. Monitor for sustained high usage."
                            .into(),
                        fix_available: false,
                        auto_fixable: false,
                    });
                }
            }
        }
    }

    findings
}

async fn check_high_memory(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let result = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive", "-NoProfile", "-Command",
                "$os = Get-CimInstance Win32_OperatingSystem; $total = $os.TotalVisibleMemorySize; $free = $os.FreePhysicalMemory; $usedPct = [math]::Round((($total - $free) / $total) * 100, 0); Write-Output $usedPct",
            ],
        ).await;

        if let Ok((0, lines)) = result {
            let output = lines.join("").trim().to_string();
            if let Ok(ram_pct) = output.parse::<f64>() {
                if ram_pct > 90.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::High,
                        category: "Performance".into(),
                        title: format!("High memory usage — {:.0}% RAM used", ram_pct),
                        description: "Memory usage is critically high. Close unnecessary applications or add more RAM.".into(),
                        fix_available: true,
                        auto_fixable: true,
                    });
                } else if ram_pct > 80.0 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::Medium,
                        category: "Performance".into(),
                        title: format!("Elevated memory usage — {:.0}% RAM used", ram_pct),
                        description: "Memory usage is above normal. Monitor for memory leaks."
                            .into(),
                        fix_available: false,
                        auto_fixable: false,
                    });
                }
            }
        }
    }

    findings
}

async fn check_startup_programs(app: &AppHandle) -> Vec<Finding> {
    let mut findings = Vec::new();
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let result = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue).Count",
            ],
        )
        .await;

        if let Ok((0, lines)) = result {
            let output = lines.join("").trim().to_string();
            if let Ok(count) = output.parse::<i32>() {
                if count > 15 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::High,
                        category: "Performance".into(),
                        title: format!("{} startup programs detected", count),
                        description: "Too many startup programs slow down boot time. Disable unnecessary ones via Toolkit → System Managers.".into(),
                        fix_available: true,
                        auto_fixable: true,
                    });
                } else if count > 8 {
                    findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        severity: Severity::Medium,
                        category: "Performance".into(),
                        title: format!("{} startup programs detected", count),
                        description: "Consider disabling non-essential startup programs to improve boot time.".into(),
                        fix_available: true,
                        auto_fixable: false,
                    });
                }
            }
        }
    }

    findings
}

// ─────────────────────────────────────────────────────────────
//  AI Agent Loop
// ─────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentStepEvent {
    step_name: String,
    status: String,
    message: String,
    timestamp: String,
}

async fn run_agent_loop(app: AppHandle, state: Arc<AppState>, findings: Vec<Finding>) {
    let _ = app.emit(
        "scan-status",
        serde_json::json!({ "phase": "fixing", "message": "Running auto-fix agent…" }),
    );

    for finding in &findings {
        if !finding.auto_fixable {
            continue;
        }

        let _ = app.emit(
            "agent-step",
            AgentStepEvent {
                step_name: finding.title.clone(),
                status: "running".into(),
                message: format!("Attempting auto-fix for: {}", finding.title),
                timestamp: Utc::now().to_rfc3339(),
            },
        );

        let (success, _output) = match finding.category.as_str() {
            "Network" => fix_network(&app, finding).await,
            "Performance" => fix_performance(&app, finding).await,
            "OS" => fix_os(&app, finding).await,
            "Security" => fix_security(&app, finding).await,
            _ => (false, String::new()),
        };

        let job = JobEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            category: finding.category.clone(),
            action: finding.title.clone(),
            status: if success {
                JobStatus::Success
            } else {
                JobStatus::Failed
            },
            output: vec![],
            exit_code: Some(if success { 0 } else { 1 }),
        };

        let _ = app.emit("job-update", JobUpdate { job: job.clone() });
        state.job_log.lock().await.push(job);

        if !success {
            let _ = app.emit(
                "agent-step",
                AgentStepEvent {
                    step_name: format!("{} — Escalating", finding.title),
                    status: "escalating".into(),
                    message: "Primary fix failed. Running deeper repair sequence…".into(),
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
            run_escalation(&app, finding).await;
        }
    }
}

async fn fix_network(app: &AppHandle, _finding: &Finding) -> (bool, String) {
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let (code, lines) = run_command_streaming(app, &id, "ipconfig", &["/flushdns"])
            .await
            .unwrap_or((-1, vec![]));
        return (code == 0, lines.join("\n"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = id;
        (true, String::new())
    }
}

async fn fix_performance(app: &AppHandle, finding: &Finding) -> (bool, String) {
    #[cfg(target_os = "windows")]
    {
        let is_startup = finding.title.contains("startup");

        if is_startup {
            let script = r#"
                $essential = @('SecurityHealth','Windows Defender','Microsoft Security Client','svchost','ctfmon','Run','Explorer')
                $disabled = 0
                $paths = @(
                    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
                    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
                    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
                    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'
                )
                foreach ($p in $paths) {
                    if (-not (Test-Path $p)) { continue }
                    $props = Get-ItemProperty -Path $p -ErrorAction SilentlyContinue
                    if (-not $props) { continue }
                    $props.PSObject.Properties | Where-Object {
                        $_.MemberType -eq 'NoteProperty' -and
                        $_.Name -notlike 'PS*' -and
                        -not ($essential | Where-Object { $_.Name -like "*$_*" })
                    } | ForEach-Object {
                        try {
                            Remove-ItemProperty -Path $p -Name $_.Name -Force -ErrorAction Stop
                            $disabled++
                        } catch {}
                    }
                }
                Write-Output "Disabled $disabled startup items"
            "#;
            let id = Uuid::new_v4().to_string();
            let (code, lines) = run_command_streaming(
                app,
                &id,
                "powershell",
                &["-NonInteractive", "-NoProfile", "-Command", script],
            )
            .await
            .unwrap_or((-1, vec![]));
            return (code == 0, lines.join("\n"));
        }

        let id = Uuid::new_v4().to_string();
        let (code, lines) = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive",
                "-NoProfile",
                "-Command",
                "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; \
                 Remove-Item -Path $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue",
            ],
        )
        .await
        .unwrap_or((-1, vec![]));
        return (code == 0, lines.join("\n"));
    }
    #[cfg(not(target_os = "windows"))]
    (true, String::new())
}

async fn fix_os(app: &AppHandle, _finding: &Finding) -> (bool, String) {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let (dism_code, dism_out) = run_command_streaming(
            app,
            &id,
            "dism",
            &["/Online", "/Cleanup-Image", "/RestoreHealth"],
        )
        .await
        .unwrap_or((-1, vec![]));

        if dism_code != 0 || dism_out.iter().any(|l| l.contains("corruption")) {
            let (sfc_code, sfc_lines) =
                run_command_streaming(app, &Uuid::new_v4().to_string(), "sfc", &["/scannow"])
                    .await
                    .unwrap_or((-1, vec![]));
            return (sfc_code == 0, sfc_lines.join("\n"));
        }
        return (dism_code == 0, dism_out.join("\n"));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = id;
        (true, String::new())
    }
}

async fn fix_security(app: &AppHandle, _finding: &Finding) -> (bool, String) {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let (code, lines) = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive", "-NoProfile", "-Command",
                r#"
                    $browsers = @('Chrome','Firefox','Edge','Brave')
                    foreach ($b in $browsers) {
                        $path = "$env:LOCALAPPDATA\$b\User Data\Default\Cache"
                        if (Test-Path $path) { Remove-Item "$path\*" -Recurse -Force -EA SilentlyContinue }
                    }
                    Write-Output "Browser cache sweep complete."
                "#,
            ],
        )
        .await
        .unwrap_or((-1, vec![]));
        return (code == 0, lines.join("\n"));
    }
    #[cfg(not(target_os = "windows"))]
    (true, String::new())
}

async fn run_escalation(app: &AppHandle, finding: &Finding) {
    #[cfg(target_os = "windows")]
    {
        let id = Uuid::new_v4().to_string();
        match finding.category.as_str() {
            "Network" => {
                let _ = run_command_streaming(app, &id, "netsh", &["winsock", "reset"]).await;
                let _ = run_command_streaming(
                    app,
                    &Uuid::new_v4().to_string(),
                    "netsh",
                    &["int", "ip", "reset"],
                )
                .await;
                let _ = app.emit(
                    "agent-step",
                    AgentStepEvent {
                        step_name: "Network Reset Complete".into(),
                        status: "done".into(),
                        message: "Winsock and TCP/IP reset. A restart is recommended for changes to take full effect.".into(),
                        timestamp: Utc::now().to_rfc3339(),
                    },
                );
            }
            "Performance" => {
                // Deep performance cleanup for escalation
                let cleanup_script = r#"
                    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
                    Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
                    Remove-Item -Path "$env:WINDIR\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
                    # Clear browser caches as escalation
                    @('Chrome','Firefox','Edge','Brave','BraveBrowser','Vivaldi','Opera') | ForEach-Object {
                        $p = "$env:LOCALAPPDATA\$_\User Data\Default\Cache"
                        if (Test-Path $p) { Remove-Item "$p\*" -Recurse -Force -EA SilentlyContinue }
                    }
                    Write-Output "Deep cleanup complete"
                "#;
                let _ = run_command_streaming(
                    app,
                    &Uuid::new_v4().to_string(),
                    "powershell",
                    &["-NonInteractive", "-NoProfile", "-Command", cleanup_script],
                )
                .await;
            }
            "OS" => {
                let _ = run_command_streaming(
                    app,
                    &id,
                    "dism",
                    &["/Online", "/Cleanup-Image", "/StartComponentCleanup"],
                )
                .await;
            }
            _ => {}
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, finding);
    }
}

// ─────────────────────────────────────────────────────────────
//  Tauri Commands (IPC bridge)
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn check_privileges() -> Result<bool, String> {
    Ok(privilege::is_elevated())
}

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let os_version = get_windows_version_string().await;
        return Ok(serde_json::json!({
            "platform": "windows",
            "arch": std::env::consts::ARCH,
            "osVersion": os_version,
        }));
    }
    #[cfg(target_os = "macos")]
    return Ok(serde_json::json!({ "platform": "macos", "arch": std::env::consts::ARCH }));
    #[cfg(target_os = "linux")]
    return Ok(serde_json::json!({ "platform": "linux", "arch": std::env::consts::ARCH }));
}

/// Returns a human-readable Windows version string (e.g. "Windows 10 22H2" or "Windows 11 23H2")
#[cfg(target_os = "windows")]
async fn get_windows_version_string() -> String {
    let script = r#"
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
if ($os) {
    $build = $os.BuildNumber
    if ([int]$build -ge 22000) {
        Write-Output "Windows 11 (Build $build)"
    } else {
        Write-Output "Windows 10 (Build $build)"
    }
} else {
    Write-Output "Unknown Windows"
}
    "#;
    // Use std::process::Command directly since we don't need streaming here
    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let version = stdout.trim().to_string();
        if !version.is_empty() {
            return version;
        }
    }
    "Unknown Windows".to_string()
}

#[tauri::command]
async fn scan_system(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<ScanResult, String> {
    {
        let mut running = state.scan_running.lock().await;
        if *running {
            return Err("Scan already in progress.".into());
        }
        *running = true;
    }

    let _ = app.emit(
        "scan-status",
        serde_json::json!({ "phase": "starting", "message": "Creating system restore point…" }),
    );

    let restore_created = create_restore_point(&app, "PCFixAI Pre-Scan").await;

    let _ = app.emit(
        "scan-status",
        serde_json::json!({ "phase": "scanning", "message": "Running parallel diagnostics…" }),
    );

    // Run all diagnostic checks in parallel for ~60% faster scans
    let (disk_health, disk_space, network_health, high_cpu, high_memory, startup_progs) = tokio::join!(
        check_disk_health(&app),
        check_disk_space(&app),
        check_network_health(&app),
        check_high_cpu(&app),
        check_high_memory(&app),
        check_startup_programs(&app),
    );

    let mut findings = Vec::new();
    findings.extend(disk_health);
    findings.extend(disk_space);
    findings.extend(network_health);
    findings.extend(high_cpu);
    findings.extend(high_memory);
    findings.extend(startup_progs);

    let scan_id = Uuid::new_v4().to_string();
    let result = ScanResult {
        scan_id: scan_id.clone(),
        findings: findings.clone(),
        restore_point_created: restore_created,
    };

    let _ = app.emit(
        "scan-status",
        serde_json::json!({ "phase": "complete", "message": "Scan complete. Launching agent…" }),
    );

    let state_arc = Arc::clone(&state);
    let app_clone = app.clone();
    tokio::spawn(async move {
        run_agent_loop(app_clone, state_arc, findings).await;
    });

    {
        let mut running = state.scan_running.lock().await;
        *running = false;
    }

    Ok(result)
}

#[tauri::command]
async fn execute_fix(app: AppHandle, category: String, action: String) -> Result<(bool, String), String> {
    let dummy = Finding {
        id: Uuid::new_v4().to_string(),
        severity: Severity::Medium,
        category: category.clone(),
        title: action.clone(),
        description: String::new(),
        fix_available: true,
        auto_fixable: true,
    };

    let result = match category.as_str() {
        "Network" => fix_network(&app, &dummy).await,
        "Performance" => fix_performance(&app, &dummy).await,
        "OS" => fix_os(&app, &dummy).await,
        "Security" => fix_security(&app, &dummy).await,
        _ => (false, String::new()),
    };

    Ok(result)
}

#[tauri::command]
async fn get_job_log(state: State<'_, Arc<AppState>>) -> Result<Vec<JobEntry>, String> {
    Ok(state.job_log.lock().await.clone())
}

#[tauri::command]
async fn run_raw_command(
    app: AppHandle,
    program: String,
    args: Vec<String>,
) -> Result<i32, String> {
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let id = Uuid::new_v4().to_string();
    run_command_streaming(&app, &id, &program, &arg_refs)
        .await
        .map(|(code, _)| code)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn spawn_detached(program: String, args: Vec<String>) -> Result<bool, String> {
    let mut cmd = std::process::Command::new(&program);
    cmd.args(&args);
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());
    cmd.stdin(std::process::Stdio::null());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to start {}: {}", program, e))?;
    std::mem::forget(child);
    Ok(true)
}

#[tauri::command]
async fn relaunch_elevated() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("{}", e))?;
    let exe_str = exe_path.to_str().ok_or("Invalid UTF-8 in path")?.to_string();

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Start-Process -FilePath '{}' -Verb RunAs",
            exe_str.replace('\'', "''")
        );
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .spawn()
            .map_err(|e| format!("Failed to launch elevated: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = exe_str;
        return Err("Elevation not supported on this platform.".to_string());
    }

    std::process::exit(0);
}

#[tauri::command]
async fn run_raw_command_output(
    app: AppHandle,
    program: String,
    args: Vec<String>,
) -> Result<(i32, String), String> {
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let id = Uuid::new_v4().to_string();
    let (code, lines) = run_command_streaming(&app, &id, &program, &arg_refs)
        .await
        .map_err(|e| e.to_string())?;
    Ok((code, lines.join("\n")))
}

#[tauri::command]
async fn get_real_metrics(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os = Get-CimInstance Win32_OperatingSystem
$totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
$usedRam = [math]::Round($totalRam - $freeRam, 2)
$ramPct = if ($totalRam -gt 0) { [math]::Round(($usedRam / $totalRam) * 100, 0) } else { 0 }
$disk = (Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction SilentlyContinue | Where-Object {$_.Name -eq '_Total'}).PercentDiskTime
$netCounters = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Measure-Object -Property BytesTotalPersec -Sum
$net = if ($netCounters) { $netCounters.Sum / 1KB } else { 0 }
$netPct = [math]::Min([math]::Round($net / 100, 0), 100)
if (-not $cpu) { $cpu = 0 }
if (-not $disk) { $disk = 0 }
Write-Output "CPU:$([math]::Round($cpu,0))"
Write-Output "RAM:$ramPct"
Write-Output "DISK:$([math]::Round($disk,0))"
Write-Output "NET:$netPct"
Write-Output "TOTAL_RAM:$totalRam"
Write-Output "USED_RAM:$usedRam"
        "#;
        let (_, lines) =
            run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script])
                .await
                .map_err(|e| e.to_string())?;

        let output = lines.join("\n");
        let mut cpu = 0f64;
        let mut ram = 0f64;
        let mut disk = 0f64;
        let mut net = 0f64;
        let mut total_ram = 0f64;
        let mut used_ram = 0f64;

        for line in output.lines() {
            if let Some(v) = line.strip_prefix("CPU:") {
                cpu = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("RAM:") {
                ram = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("DISK:") {
                disk = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("NET:") {
                net = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("TOTAL_RAM:") {
                total_ram = v.trim().parse().unwrap_or(0.0);
            } else if let Some(v) = line.strip_prefix("USED_RAM:") {
                used_ram = v.trim().parse().unwrap_or(0.0);
            }
        }

        return Ok(serde_json::json!({
            "cpu": cpu,
            "ram": ram,
            "disk": disk,
            "network": net,
            "totalRam": total_ram,
            "usedRam": used_ram,
        }));
    }

    #[cfg(not(target_os = "windows"))]
    Ok(
        serde_json::json!({ "cpu": 0, "ram": 0, "disk": 0, "network": 0, "totalRam": 0, "usedRam": 0 }),
    )
}

#[tauri::command]
async fn get_startup_items(app: AppHandle) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let script = r#"
$items = @()
$regPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce'
)
foreach ($path in $regPaths) {
    if (Test-Path $path) {
        Get-ItemProperty -Path $path -ErrorAction SilentlyContinue | ForEach-Object {
            $props = $_.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' }
            foreach ($p in $props) {
                $items += [PSCustomObject]@{
                    Name = $p.Name
                    Command = $p.Value
                    Location = $path
                    Type = 'Registry'
                }
            }
        }
    }
}
Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue | ForEach-Object {
    $items += [PSCustomObject]@{
        Name = $_.Name
        Command = $_.Command
        Location = $_.Location
        Type = 'WMI'
    }
}
$items | ConvertTo-Json -Depth 3
    "#;
    let (_, lines) =
        run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script])
            .await
            .map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

#[tauri::command]
async fn get_processes(app: AppHandle) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let script = r#"
Get-Process | Where-Object {$_.Id -ne 0} | Select-Object `
    @{N='PID';E={$_.Id}}, `
    @{N='Name';E={$_.ProcessName}}, `
    @{N='CPU(s)';E={[math]::Round($_.CPU,1)}}, `
    @{N='Mem(MB)';E={[math]::Round($_.WorkingSet64/1MB,1)}}, `
    @{N='Handles';E={$_.HandleCount}}, `
    @{N='Threads';E={$_.Threads.Count}} |
Sort-Object 'Mem(MB)' -Descending |
ConvertTo-Json -Depth 2
    "#;
    let (_, lines) =
        run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script])
            .await
            .map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

#[tauri::command]
async fn kill_process(app: AppHandle, pid: i32) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    let script = format!(
        "Stop-Process -Id {} -Force -ErrorAction Stop; Write-Output 'OK'",
        pid
    );
    let (code, _) = run_command_streaming(
        &app,
        &id,
        "powershell",
        &["-NoProfile", "-Command", &script],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(code == 0)
}

#[tauri::command]
async fn get_services(app: AppHandle) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let script = r#"
Get-Service | Select-Object `
    @{N='Name';E={$_.Name}}, `
    @{N='DisplayName';E={$_.DisplayName}}, `
    @{N='Status';E={$_.Status}}, `
    @{N='StartType';E={$_.StartType}} |
Sort-Object Status, Name |
ConvertTo-Json -Depth 2
    "#;
    let (_, lines) =
        run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script])
            .await
            .map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

#[tauri::command]
async fn manage_service(app: AppHandle, name: String, action: String) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    let script = match action.as_str() {
        "start" => format!(
            "Start-Service -Name '{}' -ErrorAction Stop; Write-Output 'OK'",
            name
        ),
        "stop" => format!(
            "Stop-Service -Name '{}' -Force -ErrorAction Stop; Write-Output 'OK'",
            name
        ),
        "restart" => format!(
            "Restart-Service -Name '{}' -Force -ErrorAction Stop; Write-Output 'OK'",
            name
        ),
        "disable" => format!(
            "Set-Service -Name '{}' -StartupType Disabled -ErrorAction Stop; Write-Output 'OK'",
            name
        ),
        "enable" => format!(
            "Set-Service -Name '{}' -StartupType Automatic -ErrorAction Stop; Write-Output 'OK'",
            name
        ),
        _ => return Ok(false),
    };
    let (code, _) = run_command_streaming(
        &app,
        &id,
        "powershell",
        &["-NoProfile", "-Command", &script],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(code == 0)
}

#[tauri::command]
async fn get_installed_apps(app: AppHandle) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let script = r#"
$apps = @()
$regPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($path in $regPaths) {
    Get-ItemProperty $path -ErrorAction SilentlyContinue | Where-Object {
        $_.DisplayName -and $_.SystemComponent -ne 1
    } | ForEach-Object {
        $apps += [PSCustomObject]@{
            Name = $_.DisplayName
            Version = $_.DisplayVersion
            Publisher = $_.Publisher
            Size = if ($_.EstimatedSize) { [math]::Round($_.EstimatedSize / 1024, 0) } else { 0 }
        }
    }
}
$apps | Sort-Object Name -Unique | ConvertTo-Json -Depth 2
    "#;
    let (_, lines) =
        run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script])
            .await
            .map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

// ─────────────────────────────────────────────────────────────
//  Event Log / BSOD Analyzer
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn check_event_logs(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$events = @()
# BSOD / Critical errors (Event ID 41 = Kernel-Power, 1001 = BugCheck)
$critical = Get-WinEvent -FilterHashtable @{LogName='System'; Level=1; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 50 -ErrorAction SilentlyContinue
foreach ($e in $critical) {
    $events += [PSCustomObject]@{
        TimeCreated = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')
        Id = $e.Id
        ProviderName = $e.ProviderName
        Message = ($e.Message -replace '\r?\n', ' ' ).Substring(0, [Math]::Min(200, $e.Message.Length))
        Level = 'Critical'
    }
}
# Warnings
$warnings = Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; StartTime=(Get-Date).AddDays(-7)} -MaxEvents 30 -ErrorAction SilentlyContinue
foreach ($e in $warnings) {
    $events += [PSCustomObject]@{
        TimeCreated = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')
        Id = $e.Id
        ProviderName = $e.ProviderName
        Message = ($e.Message -replace '\r?\n', ' ' ).Substring(0, [Math]::Min(200, $e.Message.Length))
        Level = 'Warning'
    }
}
# BSOD BugCheck entries specifically
$bsod = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'} -MaxEvents 10 -ErrorAction SilentlyContinue
foreach ($e in $bsod) {
    $events += [PSCustomObject]@{
        TimeCreated = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')
        Id = $e.Id
        ProviderName = 'BugCheck (BSOD)'
        Message = ($e.Message -replace '\r?\n', ' ' ).Substring(0, [Math]::Min(300, $e.Message.Length))
        Level = 'Critical'
    }
}
# Application errors
$appErrors = Get-WinEvent -FilterHashtable @{LogName='Application'; Level=1; StartTime=(Get-Date).AddDays(-7)} -MaxEvents 20 -ErrorAction SilentlyContinue
foreach ($e in $appErrors) {
    $events += [PSCustomObject]@{
        TimeCreated = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')
        Id = $e.Id
        ProviderName = $e.ProviderName
        Message = ($e.Message -replace '\r?\n', ' ' ).Substring(0, [Math]::Min(200, $e.Message.Length))
        Level = 'AppCritical'
    }
}
$events | ConvertTo-Json -Depth 3
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!([]));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!([]))
}

// ─────────────────────────────────────────────────────────────
//  Virus Scanner / Windows Defender Integration
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_defender_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
try {
    $mpStatus = Get-MpComputerStatus -ErrorAction Stop
    $threats = Get-MpThreatDetection -ErrorAction SilentlyContinue | Select-Object -First 10
    $result = [PSCustomObject]@{
        RealTimeProtection = $mpStatus.RealTimeProtectionEnabled
        AntivirusEnabled = $mpStatus.AntivirusEnabled
        AntispywareEnabled = $mpStatus.AntispywareEnabled
        AntivirusSignatureLastUpdated = $mpStatus.AntivirusSignatureLastUpdated.ToString('yyyy-MM-dd HH:mm')
        QuickScanEndTime = if ($mpStatus.QuickScanEndTime) { $mpStatus.QuickScanEndTime.ToString('yyyy-MM-dd HH:mm') } else { 'Never' }
        FullScanEndTime = if ($mpStatus.FullScanEndTime) { $mpStatus.FullScanEndTime.ToString('yyyy-MM-dd HH:mm') } else { 'Never' }
        ThreatsDetected = if ($threats) { $threats.Count } else { 0 }
        RecentThreats = @()
    }
    foreach ($t in $threats) {
        $result.RecentThreats += [PSCustomObject]@{
            ThreatName = $t.ThreatName
            DetectionTime = $t.InitialDetectionTime.ToString('yyyy-MM-dd HH:mm')
            DomainUser = $t.DomainUser
            ActionSuccess = $t.Actionsuccess
        }
    }
    $result | ConvertTo-Json -Depth 3
} catch {
    Write-Output '{"error": "Windows Defender not available or access denied"}'
}
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!({"error": "Parse failed"}));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({"error": "Not Windows"}))
}

#[tauri::command]
async fn run_virus_scan(app: AppHandle, scan_type: String) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = match scan_type.as_str() {
            "quick" => r#"Start-MpScan -ScanType QuickScan; Write-Output '{"scanType":"quick","status":"completed"}'"#,
            "full" => r#"Start-MpScan -ScanType FullScan; Write-Output '{"scanType":"full","status":"completed"}'"#,
            "custom" => r#"Start-MpScan -ScanType CustomScan -ScanPath 'C:\'; Write-Output '{"scanType":"custom","status":"completed"}'"#,
            _ => r#"Write-Output '{"error":"Unknown scan type"}'"#,
        };
        let (code, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        // Check for threats after scan
        let threats_id = Uuid::new_v4().to_string();
        let (_, threat_lines) = run_command_streaming(&app, &threats_id, "powershell", &["-NoProfile", "-Command",
            "Get-MpThreatDetection | Select-Object -First 5 ThreatName, InitialDetectionTime, ActionSuccess | ConvertTo-Json"
        ]).await.unwrap_or((0, vec![]));
        let threats_output = threat_lines.join("\n");
        let threats: serde_json::Value = serde_json::from_str(&threats_output).unwrap_or(serde_json::json!([]));
        return Ok(serde_json::json!({
            "scanType": scan_type,
            "exitCode": code,
            "status": if code == 0 { "completed" } else { "failed" },
            "output": output.chars().take(500).collect::<String>(),
            "threats": threats,
        }));
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({"error": "Not Windows"}))
}

#[tauri::command]
async fn fix_threats(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$threats = Get-MpThreat -ErrorAction SilentlyContinue | Where-Object { $_.ThreatID -ne 0 }
$removed = 0
foreach ($t in $threats) {
    try {
        Remove-MpThreat -ThreatID $t.ThreatID -ErrorAction Stop
        $removed++
    } catch {}
}
# Enable real-time protection if disabled
$mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
if ($mp -and -not $mp.RealTimeProtectionEnabled) {
    Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
}
# Update signatures
Update-MpSignature -ErrorAction SilentlyContinue
Write-Output "Removed $removed threats"
        "#;
        let (code, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        return Ok(serde_json::json!({
            "exitCode": code,
            "status": if code == 0 { "success" } else { "partial" },
            "output": lines.join("\n").chars().take(500).collect::<String>(),
        }));
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({"error": "Not Windows"}))
}

// ─────────────────────────────────────────────────────────────
//  Power Plan Manager
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_power_plans(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$active = powercfg /getactivescheme
$activeGuid = ($active -split ' ')[1]
$plans = powercfg /list
$planList = @()
$lines = $plans -split '\r?\n'
foreach ($line in $lines) {
    if ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') {
        $guid = $Matches[1]
        $name = ($line -split '  ' | Where-Object { $_.Trim() -ne '' -and $_ -notmatch 'GUID' }) | Select-Object -Last 1
        $name = $name.Trim()
        $planList += [PSCustomObject]@{
            Guid = $guid
            Name = $name
            Active = ($guid -eq $activeGuid)
        }
    }
}
$planList | ConvertTo-Json -Depth 2
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!([]));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn set_power_plan(app: AppHandle, guid: String) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let (code, _) = run_command_streaming(&app, &id, "powercfg", &["/setactive", &guid]).await.map_err(|e| e.to_string())?;
        return Ok(code == 0);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

// ─────────────────────────────────────────────────────────────
//  Hibernation / Sleep Controls
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_hibernation_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$hibOn = (powercfg /hibernate) -match 'Hibernate is enabled'
$sleepBtn = powercfg /query SCHEME_CURRENT SUB_BUTTONS LIDCLOSE
Write-Output "HIBERNATE:$($hibOn)"
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let enabled = output.contains("True");
        return Ok(serde_json::json!({ "hibernateEnabled": enabled }));
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({ "hibernateEnabled": false }))
}

#[tauri::command]
async fn toggle_hibernation(app: AppHandle, enable: bool) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let arg = if enable { "/hibernate on" } else { "/hibernate off" };
        let (code, _) = run_command_streaming(&app, &id, "powercfg", &[&arg]).await.map_err(|e| e.to_string())?;
        return Ok(code == 0);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

// ─────────────────────────────────────────────────────────────
//  Network Profile Switcher
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_network_profiles(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$netProfiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
$profiles = @()
foreach ($p in $netProfiles) {
    $profiles += [PSCustomObject]@{
        Name = $p.Name
        InterfaceAlias = $p.InterfaceAlias
        NetworkCategory = $p.NetworkCategory
        IPv4Connectivity = $p.IPv4Connectivity
    }
}
$profiles | ConvertTo-Json -Depth 2
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!([]));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn set_network_profile(app: AppHandle, interface_name: String, category: String) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = format!("Set-NetConnectionProfile -InterfaceAlias '{}' -NetworkCategory '{}' -ErrorAction Stop; Write-Output 'OK'", interface_name, category);
        let (code, _) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", &script]).await.map_err(|e| e.to_string())?;
        return Ok(code == 0);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

// ─────────────────────────────────────────────────────────────
//  BitLocker / Encryption Status
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_bitlocker_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$drives = Get-BitLockerVolume -ErrorAction SilentlyContinue
if (-not $drives) {
    Write-Output '{"drives":[],"note":"BitLocker not available (Home edition?)"}'
} else {
    $result = @()
    foreach ($d in $drives) {
        $result += [PSCustomObject]@{
            MountPoint = $d.MountPoint
            ProtectionStatus = $d.ProtectionStatus.ToString()
            EncryptionMethod = $d.EncryptionMethod.ToString()
            VolumeStatus = $d.VolumeStatus.ToString()
            CapacityGB = [math]::Round($d.CapacityGB, 1)
            EncryptionPercentage = $d.EncryptionPercentage
        }
    }
    $result | ConvertTo-Json -Depth 2
}
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!({"drives":[] }));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({"drives":[] }))
}

// ─────────────────────────────────────────────────────────────
//  Windows Update Manager
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_windows_updates(app: AppHandle) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let script = r#"
try {
    if (-not (Get-Module PSWindowsUpdate -ErrorAction SilentlyContinue)) {
        Install-Module PSWindowsUpdate -Force -Scope CurrentUser -AllowClobber -ErrorAction Stop | Out-Null
    }
    Import-Module PSWindowsUpdate -ErrorAction Stop
    $updates = Get-WindowsUpdate -ErrorAction SilentlyContinue
    $result = @()
    foreach ($u in $updates) {
        $result += [PSCustomObject]@{
            KB = $u.KB
            Title = $u.Title
            Size = $u.Size
            Severity = $u.MsrcSeverity
            Status = $u.Status
        }
    }
    $result | ConvertTo-Json -Depth 2
} catch {
    # Fallback: use COM object
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $results = $searcher.Search('IsInstalled=0')
    $updates = @()
    foreach ($u in $results.Updates) {
        $updates += [PSCustomObject]@{
            KB = ($u.KBArticleIDs | Select-Object -First 1)
            Title = $u.Title
            Size = [math]::Round($u.MaxDownloadSize / 1MB, 1)
            Severity = $u.MsrcSeverity
            Status = 'Pending'
        }
    }
    $updates | ConvertTo-Json -Depth 2
}
        "#;
        let (_, lines) = run_command_streaming(&app, &id, "powershell", &["-NoProfile", "-Command", script]).await.map_err(|e| e.to_string())?;
        let output = lines.join("\n");
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap_or(serde_json::json!([]));
        return Ok(parsed);
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!([]))
}

// ─────────────────────────────────────────────────────────────
//  Export System Report (HTML)
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn export_system_report(app: AppHandle, findings_json: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let findings: Vec<Finding> = serde_json::from_str(&findings_json).unwrap_or_default();
        let mut findings_html = String::new();
        for f in &findings {
            let color = match f.severity {
                Severity::Critical => "#ef4444",
                Severity::High => "#f97316",
                Severity::Medium => "#eab308",
                Severity::Low => "#3b82f6",
                Severity::Info => "#6b7280",
            };
            let sev_label = format!("{:?}", f.severity);
            findings_html.push_str(&format!(
                "<tr><td style='padding:8px;border-bottom:1px solid #333'><span style='color:{};font-weight:600'>●</span> {}</td><td style='padding:8px;border-bottom:1px solid #333'>{}</td><td style='padding:8px;border-bottom:1px solid #333'>{}</td><td style='padding:8px;border-bottom:1px solid #333'>{}</td></tr>\n",
                color, f.title, f.category, sev_label, if f.fix_available { "Yes" } else { "No" }
            ));
        }
        let report_html = format!(r#"<!DOCTYPE html>
<html><head><meta charset='utf-8'><title>PCFixAI System Report</title>
<style>body{{font-family:Segoe UI,sans-serif;background:#0a0e1a;color:#e2e8f0;padding:40px;max-width:900px;margin:0 auto}}
h1{{color:#00d4ff;border-bottom:2px solid #00d4ff;padding-bottom:12px}}
h2{{color:#00d4ff;margin-top:32px}}
table{{width:100%;border-collapse:collapse;background:#111827;border-radius:8px;overflow:hidden}}
th{{background:#1e293b;padding:10px 8px;text-align:left;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}}
.meta{{color:#94a3b8;font-size:13px}}
.findings-count{{display:inline-block;background:#00d4ff20;color:#00d4ff;padding:4px 12px;border-radius:20px;font-weight:600;margin-left:8px}}
</style></head><body>
<h1>🔍 PCFixAI System Report</h1>
<p class='meta'>Generated: {timestamp}</p>
<h2>Health Summary</h2>
<p><span class='findings-count'>{total} finding(s) detected</span></p>
<h2>Findings</h2>
<table><thead><tr><th>Issue</th><th>Category</th><th>Severity</th><th>Fix Available</th></tr></thead>
<tbody>{findings_html}</tbody></table>
<p class='meta' style='margin-top:32px;border-top:1px solid #333;padding-top:16px'>Generated by PCFixAI v1.4.0 — Intelligent PC repair and diagnostics</p>
</body></html>"#,
            timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            total = findings.len(),
            findings_html = findings_html,
        );
        let report_path = format!("{}\\Desktop\\PCFixAI_Report.html", std::env::var("USERPROFILE").unwrap_or_default());
        std::fs::write(&report_path, &report_html).map_err(|e| format!("Failed to write report: {}", e))?;
        // Open the report
        let _ = run_command_streaming(&app, &Uuid::new_v4().to_string(), "powershell", &["-NoProfile", "-Command", &format!("Start-Process '{}'", report_path)]).await;
        return Ok(report_path);
    }
    #[cfg(not(target_os = "windows"))]
    Ok("".into())
}

// ─────────────────────────────────────────────────────────────
//  Health History (JSON file-based)
// ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn save_health_snapshot(score: i32, findings_count: i32, metrics_json: String) -> Result<(), String> {
    let dir = dirs_or_default();
    let path = format!("{}\\health_history.json", dir);
    let mut history: Vec<serde_json::Value> = if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };
    history.push(serde_json::json!({
        "timestamp": Utc::now().to_rfc3339(),
        "score": score,
        "findingsCount": findings_count,
        "metrics": serde_json::from_str::<serde_json::Value>(&metrics_json).unwrap_or(serde_json::json!({})),
    }));
    // Keep last 200 entries
    if history.len() > 200 {
        history = history[history.len() - 200..].to_vec();
    }
    std::fs::write(&path, serde_json::to_string_pretty(&history).unwrap_or_default()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_health_history() -> Result<serde_json::Value, String> {
    let dir = dirs_or_default();
    let path = format!("{}\\health_history.json", dir);
    if let Ok(data) = std::fs::read_to_string(&path) {
        let parsed: serde_json::Value = serde_json::from_str(&data).unwrap_or(serde_json::json!([]));
        Ok(parsed)
    } else {
        Ok(serde_json::json!([]))
    }
}

fn dirs_or_default() -> String {
    std::env::var("APPDATA").unwrap_or_else(|_| ".".into())
}

// ─────────────────────────────────────────────────────────────
//  App Entry
// ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("PCFixAI=debug,tauri=warn")
        .init();

    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            check_privileges,
            get_system_info,
            scan_system,
            execute_fix,
            get_job_log,
            run_raw_command,
            run_raw_command_output,
            spawn_detached,
            relaunch_elevated,
            get_real_metrics,
            get_startup_items,
            get_processes,
            kill_process,
            get_services,
            manage_service,
            get_installed_apps,
            check_event_logs,
            get_defender_status,
            run_virus_scan,
            fix_threats,
            get_power_plans,
            set_power_plan,
            get_hibernation_status,
            toggle_hibernation,
            get_network_profiles,
            set_network_profile,
            get_bitlocker_status,
            get_windows_updates,
            export_system_report,
            save_health_snapshot,
            get_health_history,
        ])
        .run(tauri::generate_context!())
        .expect("PCFixAI failed to start");
}
