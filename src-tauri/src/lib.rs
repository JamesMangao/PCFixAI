// ============================================================
//  PCFixAI — Tauri 2 Backend Core
//  Handles: privilege checks, command execution, event streaming,
//  scan orchestration, rollback checkpoints, and AI agent loop.
// ============================================================

use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use chrono::Utc;
use uuid::Uuid;

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
    use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::Win32::Foundation::{CloseHandle, HANDLE};

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
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

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
            )
        ).await {
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
            "Get-PhysicalDisk | Select-Object FriendlyName,HealthStatus,OperationalStatus | ConvertTo-Json",
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
                description: "Cannot reach 8.8.8.8:53. DNS flush and adapter reset recommended.".into(),
                fix_available: true,
                auto_fixable: true,
            });
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

        let success = match finding.category.as_str() {
            "Network" => fix_network(&app, finding).await,
            "Performance" => fix_performance(&app, finding).await,
            "OS" => fix_os(&app, finding).await,
            "Security" => fix_security(&app, finding).await,
            _ => false,
        };

        let job = JobEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            category: finding.category.clone(),
            action: finding.title.clone(),
            status: if success { JobStatus::Success } else { JobStatus::Failed },
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

async fn fix_network(app: &AppHandle, _finding: &Finding) -> bool {
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    let (code, _) = run_command_streaming(
        app, &id, "ipconfig", &["/flushdns"],
    ).await.unwrap_or((-1, vec![]));

    #[cfg(not(target_os = "windows"))]
    let code = 0i32;

    code == 0
}

async fn fix_performance(app: &AppHandle, _finding: &Finding) -> bool {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let (code, _) = run_command_streaming(
            app,
            &id,
            "powershell",
            &[
                "-NonInteractive", "-NoProfile", "-Command",
                "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; \
                 Remove-Item -Path $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue",
            ],
        )
        .await
        .unwrap_or((-1, vec![]));
        return code == 0;
    }
    #[cfg(not(target_os = "windows"))]
    true
}

async fn fix_os(app: &AppHandle, _finding: &Finding) -> bool {
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
            let (sfc_code, _) = run_command_streaming(
                app,
                &Uuid::new_v4().to_string(),
                "sfc",
                &["/scannow"],
            )
            .await
            .unwrap_or((-1, vec![]));
            return sfc_code == 0;
        }
        return dism_code == 0;
    }
    #[cfg(not(target_os = "windows"))]
    true
}

async fn fix_security(app: &AppHandle, _finding: &Finding) -> bool {
    let id = Uuid::new_v4().to_string();
    #[cfg(target_os = "windows")]
    {
        let (code, _) = run_command_streaming(
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
        return code == 0;
    }
    #[cfg(not(target_os = "windows"))]
    true
}

async fn run_escalation(app: &AppHandle, finding: &Finding) {
    let id = Uuid::new_v4().to_string();

    #[cfg(target_os = "windows")]
    match finding.category.as_str() {
        "Network" => {
            let _ = run_command_streaming(app, &id, "netsh", &["winsock", "reset"]).await;
            let _ = run_command_streaming(
                app,
                &Uuid::new_v4().to_string(),
                "netsh",
                &["int", "ip", "reset"],
            ).await;
        }
        "OS" => {
            let _ = run_command_streaming(
                app,
                &id,
                "dism",
                &["/Online", "/Cleanup-Image", "/StartComponentCleanup"],
            ).await;
        }
        _ => {}
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
    return Ok(serde_json::json!({ "platform": "windows", "arch": std::env::consts::ARCH }));
    #[cfg(target_os = "macos")]
    return Ok(serde_json::json!({ "platform": "macos", "arch": std::env::consts::ARCH }));
    #[cfg(target_os = "linux")]
    return Ok(serde_json::json!({ "platform": "linux", "arch": std::env::consts::ARCH }));
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
        serde_json::json!({ "phase": "scanning", "message": "Checking disk health…" }),
    );
    let mut findings = check_disk_health(&app).await;

    let _ = app.emit(
        "scan-status",
        serde_json::json!({ "phase": "scanning", "message": "Checking network health…" }),
    );
    findings.extend(check_network_health(&app).await);

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
async fn execute_fix(
    app: AppHandle,
    category: String,
    action: String,
) -> Result<bool, String> {
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
        _ => false,
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
async fn run_raw_command_output(
    app: AppHandle,
    program: String,
    args: Vec<String>,
) -> Result<String, String> {
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let id = Uuid::new_v4().to_string();
    let (_, lines) = run_command_streaming(&app, &id, &program, &arg_refs)
        .await
        .map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
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
$ramPct = [math]::Round(($usedRam / $totalRam) * 100, 0)
$disk = (Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object {$_.Name -eq '_Total'}).PercentDiskTime
$net = (Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | Measure-Object -Property BytesTotalPersec -Sum).Sum / 1KB
$netPct = [math]::Min([math]::Round($net / 100, 0), 100)
Write-Output "CPU:$([math]::Round($cpu,0))"
Write-Output "RAM:$ramPct"
Write-Output "DISK:$([math]::Round($disk,0))"
Write-Output "NET:$netPct"
Write-Output "TOTAL_RAM:$totalRam"
Write-Output "USED_RAM:$usedRam"
        "#;
        let (_, lines) = run_command_streaming(
            &app, &id, "powershell",
            &["-NoProfile", "-Command", script],
        ).await.map_err(|e| e.to_string())?;

        let output = lines.join("\n");
        let mut cpu = 0f64;
        let mut ram = 0f64;
        let mut disk = 0f64;
        let mut net = 0f64;
        let mut total_ram = 0f64;
        let mut used_ram = 0f64;

        for line in output.lines() {
            if let Some(v) = line.strip_prefix("CPU:") { cpu = v.trim().parse().unwrap_or(0.0); }
            else if let Some(v) = line.strip_prefix("RAM:") { ram = v.trim().parse().unwrap_or(0.0); }
            else if let Some(v) = line.strip_prefix("DISK:") { disk = v.trim().parse().unwrap_or(0.0); }
            else if let Some(v) = line.strip_prefix("NET:") { net = v.trim().parse().unwrap_or(0.0); }
            else if let Some(v) = line.strip_prefix("TOTAL_RAM:") { total_ram = v.trim().parse().unwrap_or(0.0); }
            else if let Some(v) = line.strip_prefix("USED_RAM:") { used_ram = v.trim().parse().unwrap_or(0.0); }
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
    Ok(serde_json::json!({ "cpu": 0, "ram": 0, "disk": 0, "network": 0, "totalRam": 0, "usedRam": 0 }))
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
    let (_, lines) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", script],
    ).await.map_err(|e| e.to_string())?;
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
    let (_, lines) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", script],
    ).await.map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

#[tauri::command]
async fn kill_process(app: AppHandle, pid: i32) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    let script = format!("Stop-Process -Id {} -Force -ErrorAction Stop; Write-Output 'OK'", pid);
    let (code, _) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", &script],
    ).await.map_err(|e| e.to_string())?;
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
    let (_, lines) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", script],
    ).await.map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
}

#[tauri::command]
async fn manage_service(app: AppHandle, name: String, action: String) -> Result<bool, String> {
    let id = Uuid::new_v4().to_string();
    let script = match action.as_str() {
        "start" => format!("Start-Service -Name '{}' -ErrorAction Stop; Write-Output 'OK'", name),
        "stop" => format!("Stop-Service -Name '{}' -Force -ErrorAction Stop; Write-Output 'OK'", name),
        "restart" => format!("Restart-Service -Name '{}' -Force -ErrorAction Stop; Write-Output 'OK'", name),
        "disable" => format!("Set-Service -Name '{}' -StartupType Disabled -ErrorAction Stop; Write-Output 'OK'", name),
        "enable" => format!("Set-Service -Name '{}' -StartupType Automatic -ErrorAction Stop; Write-Output 'OK'", name),
        _ => return Ok(false),
    };
    let (code, _) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", &script],
    ).await.map_err(|e| e.to_string())?;
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
    let (_, lines) = run_command_streaming(
        &app, &id, "powershell",
        &["-NoProfile", "-Command", script],
    ).await.map_err(|e| e.to_string())?;
    Ok(lines.join("\n"))
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
            get_real_metrics,
            get_startup_items,
            get_processes,
            kill_process,
            get_services,
            manage_service,
            get_installed_apps,
        ])
        .run(tauri::generate_context!())
        .expect("PCFixAI failed to start");
}
