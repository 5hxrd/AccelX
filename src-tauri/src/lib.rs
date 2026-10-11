//! AccelX native shell.
//!
//! Engine: AccelX bundles the official, signed Raw Accel 1.7.1 driver and its `writer.exe`
//! (MIT licensed, see engine/LICENSE-RawAccel.txt). The files are embedded in this exe,
//! unpacked to %LOCALAPPDATA%, the driver is installed once (admin prompt), and curves are
//! sent to it by editing a settings.json (lookup-table mode) and running `writer.exe`.
//! The driver forgets settings at shutdown, so AccelX re-applies the saved curve at launch.

mod license;
mod licensefmt;

use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const RAW_ACCEL_VERSION: &str = "1.7.1";

/// Files embedded into the exe: (relative path, bytes, expected SHA-256 or "" to skip).
/// The checksums catch corrupted uploads (e.g. binaries mangled by a text-based sync).
const ENGINE_FILES: &[(&str, &[u8], &str)] = &[
    ("writer.exe", include_bytes!("../engine/writer.exe"), "b53e29c7689b9d72838ffbfd1502b8d0407160d3f77b54eb15a7c632f689aa04"),
    ("wrapper.dll", include_bytes!("../engine/wrapper.dll"), "e17d540fb0bb5e47ba7c8e01aff39f1570bfb7ef673a1ddc0bccd2a26f9efb78"),
    ("Newtonsoft.Json.dll", include_bytes!("../engine/Newtonsoft.Json.dll"), "b624949df8b0e3a6153fdfb730a7c6f4990b6592ee0d922e1788433d276610f3"),
    ("installer.exe", include_bytes!("../engine/installer.exe"), "b3b4948de9470a5727390ed016507b59d2c628463e42aaf1b75e906ee04f58a9"),
    ("uninstaller.exe", include_bytes!("../engine/uninstaller.exe"), "62090da1ecd73aa18c2119650a4384d80691fcbabb90716cf5f731ed084a51ca"),
    ("driver/rawaccel.sys", include_bytes!("../engine/driver/rawaccel.sys"), "8a62c4deef2774b43a7363b352eda79897533a1080c9c26ffeff0559e43358d7"),
    ("LICENSE-RawAccel.txt", include_bytes!("../engine/LICENSE-RawAccel.txt"), ""),
];

// ---------------------------------------------------------------- state

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
struct Saved {
    lut: Vec<[f64; 2]>,
    base_sens: f64,
    y_ratio: f64,
    enabled: bool,
    run_in_background: bool,
    start_minimized: bool,
    tray_icon: bool,
}

impl Default for Saved {
    fn default() -> Self {
        Saved {
            lut: Vec::new(),
            base_sens: 1.0,
            y_ratio: 1.0,
            enabled: true,
            run_in_background: true,
            start_minimized: false,
            tray_icon: true,
        }
    }
}

struct AppState {
    saved: Mutex<Saved>,
    last_error: Mutex<Option<String>>,
    last_applied: Mutex<Option<u64>>,
    needs_restart: Mutex<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    driver_installed: bool,
    driver_active: bool,
    needs_restart: bool,
    last_error: Option<String>,
    last_applied_at: Option<u64>,
    version: &'static str,
}

fn config_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("engine.json"))
}

fn load_saved(app: &AppHandle) -> Saved {
    config_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn persist(app: &AppHandle) {
    let saved = app.state::<AppState>().saved.lock().unwrap().clone();
    if let Some(path) = config_file(app) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(&saved) {
            let _ = fs::write(path, text);
        }
    }
}

fn driver_installed() -> bool {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".to_string());
    Path::new(&root).join("System32").join("drivers").join("rawaccel.sys").is_file()
}

/// True when the Raw Accel driver is loaded (its control device `\\.\rawaccel` exists).
fn driver_active() -> bool {
    match fs::OpenOptions::new().read(true).open(r"\\.\rawaccel") {
        Ok(_) => true,
        // 2 / 3 = file or path not found -> device doesn't exist -> driver not loaded
        Err(e) => !matches!(e.raw_os_error(), Some(2) | Some(3)),
    }
}

fn build_status(app: &AppHandle) -> Status {
    let st = app.state::<AppState>();
    let last_error = st.last_error.lock().unwrap().clone();
    let last_applied_at = *st.last_applied.lock().unwrap();
    let needs_restart = *st.needs_restart.lock().unwrap();
    Status {
        driver_installed: driver_installed(),
        driver_active: driver_active(),
        needs_restart,
        last_error,
        last_applied_at,
        version: RAW_ACCEL_VERSION,
    }
}

// ---------------------------------------------------------------- engine files

fn engine_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|d| d.join("engine"))
        .map_err(|e| format!("Can't find app data folder: {e}"))
}

/// Unpacks the embedded Raw Accel files (only rewrites files whose size differs).
fn extract_engine(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = engine_dir(app)?;
    for (name, bytes, expected) in ENGINE_FILES {
        if !expected.is_empty() {
            let actual = licensefmt::hex_encode(&Sha256::digest(bytes));
            if actual != *expected {
                return Err(format!(
                    "{name} inside AccelX is corrupted (checksum mismatch). Re-upload the original src-tauri/engine folder and rebuild."
                ));
            }
        }
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Can't create {}: {e}", parent.display()))?;
        }
        let stale = fs::metadata(&path)
            .map(|m| m.len() != bytes.len() as u64)
            .unwrap_or(true);
        if stale {
            fs::write(&path, bytes).map_err(|e| format!("Can't write {}: {e}", path.display()))?;
        }
    }
    Ok(dir)
}

fn run_hidden(cmd: &mut Command) -> std::io::Result<std::process::Output> {
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output()
}

/// Runs an exe that needs administrator rights (shows the Windows UAC prompt).
fn run_elevated(exe: &Path, workdir: &Path) -> Result<(), String> {
    let esc = |p: &Path| p.to_string_lossy().replace('\'', "''");
    let script = format!(
        "try {{ $p = Start-Process -FilePath '{}' -WorkingDirectory '{}' -Verb RunAs -Wait -PassThru; exit $p.ExitCode }} catch {{ exit 1223 }}",
        esc(exe),
        esc(workdir)
    );
    let out = run_hidden(Command::new("powershell").args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-Command",
        script.as_str(),
    ]))
    .map_err(|e| format!("Couldn't start PowerShell: {e}"))?;
    if out.status.code() == Some(1223) {
        return Err("Administrator permission was declined.".into());
    }
    Ok(())
}

// ---------------------------------------------------------------- settings.json patching

fn patch_settings(v: &mut Value, s: &Saved) -> Result<(), String> {
    let profile = v
        .get_mut("profiles")
        .and_then(|p| p.as_array_mut())
        .and_then(|a| a.first_mut())
        .and_then(|p| p.as_object_mut())
        .ok_or("Unexpected Raw Accel settings layout (no profile).")?;

    let on = s.enabled && !s.lut.is_empty();
    let ratio = if on { s.y_ratio } else { 1.0 };

    for (k, val) in profile.iter_mut() {
        if k.starts_with("Whole/combined") {
            *val = Value::Bool(true);
        } else if k.starts_with("Y/X output DPI ratio") || k.starts_with("Y/X sensitivity ratio") {
            *val = json!(ratio);
        }
    }

    let accel = profile
        .get_mut("Whole or horizontal accel parameters")
        .and_then(|a| a.as_object_mut())
        .ok_or("Unexpected Raw Accel settings layout (no accel parameters).")?;

    if on {
        accel.insert("mode".to_string(), json!("lut"));
        // false = the table holds sensitivity multipliers (not output velocities)
        if accel.contains_key("Gain / Velocity") {
            accel.insert("Gain / Velocity".to_string(), json!(false));
        }
        // Overall sensitivity is baked into the table, so the driver's own
        // "Output DPI" setting is left exactly as Raw Accel generated it.
        let flat: Vec<f64> = s
            .lut
            .iter()
            .flat_map(|p| [p[0], (p[1] * s.base_sens).clamp(0.01, 40.0)])
            .collect();
        accel.insert("data".to_string(), json!(flat));
    } else {
        accel.insert("mode".to_string(), json!("noaccel"));
    }
    Ok(())
}

enum WriterEnd {
    Exited(Option<i32>),
    Stopped,
}

/// Runs writer.exe without ever hanging: it shows a Windows message box on errors, so we
/// poll the process, can stop it once `until` exists, and kill it after `timeout`.
fn run_writer(
    writer: &Path,
    dir: &Path,
    arg: Option<&Path>,
    until: Option<&Path>,
    timeout: Duration,
) -> Result<WriterEnd, String> {
    let mut cmd = Command::new(writer);
    if let Some(a) = arg {
        cmd.arg(a);
    }
    cmd.current_dir(dir);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Couldn't run writer.exe: {e}"))?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(WriterEnd::Exited(status.code())),
            Ok(None) => {}
            Err(e) => return Err(e.to_string()),
        }
        if let Some(p) = until {
            if p.is_file() {
                std::thread::sleep(Duration::from_millis(700));
                let _ = child.kill();
                let _ = child.wait();
                return Ok(WriterEnd::Stopped);
            }
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Raw Accel's writer didn't finish. It may have shown an error window - tell me what it said.".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// Used only if writer.exe can't create its own default settings file.
const FALLBACK_SETTINGS: &str = r#"{
  "version": "1.7.0",
  "defaultDeviceConfig": {
    "disable": false,
    "DPI (normalizes input speed unit: counts/ms -> in/s)": 0,
    "Polling rate Hz (keep at 0 for automatic adjustment)": 0,
    "Use constant time interval based on polling rate": false
  },
  "profiles": [
    {
      "name": "default",
      "Whole/combined accel (set false for 'by component' mode)": true,
      "lpNorm": 2.0,
      "Stretches domain for horizontal vs vertical inputs": { "x": 1.0, "y": 1.0 },
      "Stretches accel range for horizontal vs vertical inputs": { "x": 1.0, "y": 1.0 },
      "Whole or horizontal accel parameters": {
        "mode": "noaccel", "Gain / Velocity": false,
        "inputOffset": 0.0, "outputOffset": 0.0, "acceleration": 0.005, "decayRate": 0.1,
        "gamma": 1.0, "motivity": 1.5, "exponentClassic": 2.0, "exponentPower": 0.05,
        "limit": 1.5, "syncSpeed": 5.0, "smooth": 0.5,
        "Cap / Jump": { "x": 15.0, "y": 1.5 }, "Cap mode": "output", "data": []
      },
      "Vertical accel parameters": {
        "mode": "noaccel", "Gain / Velocity": false,
        "inputOffset": 0.0, "outputOffset": 0.0, "acceleration": 0.005, "decayRate": 0.1,
        "gamma": 1.0, "motivity": 1.5, "exponentClassic": 2.0, "exponentPower": 0.05,
        "limit": 1.5, "syncSpeed": 5.0, "smooth": 0.5,
        "Cap / Jump": { "x": 15.0, "y": 1.5 }, "Cap mode": "output", "data": []
      },
      "Input speed calculation parameters": {},
      "Output DPI": 1000.0,
      "Y/X output DPI ratio (vertical sens multiplier)": 1.0,
      "L/R output DPI ratio (left sens multiplier)": 1.0,
      "U/D output DPI ratio (up sens multiplier)": 1.0,
      "Degrees of rotation": 0.0,
      "Degrees of angle snapping": 0.0,
      "Input Speed Cap": 0.0
    }
  ],
  "devices": []
}
"#;

fn read_settings(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok()
}

fn apply_to_driver(app: &AppHandle, s: &Saved) -> Result<(), String> {
    if !driver_installed() {
        return Err("The mouse driver isn't installed yet. Go to Settings → Engine → Install driver.".into());
    }
    let dir = extract_engine(app)?;
    let writer = dir.join("writer.exe");
    let settings = dir.join("settings.json");

    // Make sure we have a valid base settings file. writer.exe creates its own default one
    // (next to itself) when it is started with NO arguments and the file is missing.
    if read_settings(&settings).is_none() {
        let _ = fs::remove_file(&settings);
        let _ = run_writer(&writer, &dir, None, Some(&settings), Duration::from_secs(20));
        if read_settings(&settings).is_none() {
            fs::write(&settings, FALLBACK_SETTINGS)
                .map_err(|e| format!("Can't write settings: {e}"))?;
        }
    }

    let mut v = read_settings(&settings).ok_or("Settings file is unreadable.")?;
    patch_settings(&mut v, s)?;
    let out = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    fs::write(&settings, out).map_err(|e| format!("Can't write settings: {e}"))?;

    let not_loaded = if driver_active() {
        ""
    } else {
        " The driver doesn't look loaded yet: restart Windows (Restart, not Shut down)."
    };
    match run_writer(&writer, &dir, Some(&settings), None, Duration::from_secs(120)) {
        Ok(WriterEnd::Exited(Some(0))) | Ok(WriterEnd::Exited(None)) | Ok(WriterEnd::Stopped) => Ok(()),
        Ok(WriterEnd::Exited(Some(code))) => Err(format!(
            "The driver rejected the curve (writer exit code {code}).{not_loaded}"
        )),
        Err(e) => Err(format!("{e}{not_loaded}")),
    }
}

fn do_apply(app: &AppHandle) -> Result<(), String> {
    if !license::is_valid(app) {
        return Err("AccelX isn't activated. Enter your license key first.".into());
    }
    let st = app.state::<AppState>();
    let saved = st.saved.lock().unwrap().clone();
    let res = apply_to_driver(app, &saved);
    match &res {
        Ok(()) => {
            *st.last_error.lock().unwrap() = None;
            *st.needs_restart.lock().unwrap() = false;
            *st.last_applied.lock().unwrap() = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs());
        }
        Err(e) => *st.last_error.lock().unwrap() = Some(e.clone()),
    }
    res
}

// ---------------------------------------------------------------- window helpers

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// ---------------------------------------------------------------- commands

#[tauri::command]
async fn apply_curve(app: AppHandle, lut: Vec<[f64; 2]>, base_sens: f64, y_ratio: f64) -> Result<(), String> {
    if lut.len() < 2 || lut.len() > 128 {
        return Err("Curve must have between 2 and 128 table points.".into());
    }
    {
        let st = app.state::<AppState>();
        let mut s = st.saved.lock().unwrap();
        s.lut = lut;
        s.base_sens = base_sens.clamp(0.01, 10.0);
        s.y_ratio = y_ratio.clamp(0.1, 10.0);
    }
    persist(&app);
    do_apply(&app)
}

#[tauri::command]
async fn set_engine_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let changed = {
        let st = app.state::<AppState>();
        let mut s = st.saved.lock().unwrap();
        let changed = s.enabled != enabled;
        s.enabled = enabled;
        changed
    };
    persist(&app);
    if changed && driver_installed() {
        do_apply(&app)
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn install_driver(app: AppHandle) -> Result<Status, String> {
    let dir = extract_engine(&app)?;
    run_elevated(&dir.join("installer.exe"), &dir)?;
    let st = app.state::<AppState>();
    if driver_installed() {
        *st.needs_restart.lock().unwrap() = true;
        *st.last_error.lock().unwrap() = None;
    } else {
        *st.last_error.lock().unwrap() =
            Some("The installer didn't finish. Try again and accept the administrator prompt.".into());
    }
    Ok(build_status(&app))
}

#[tauri::command]
async fn uninstall_driver(app: AppHandle) -> Result<Status, String> {
    let dir = extract_engine(&app)?;
    run_elevated(&dir.join("uninstaller.exe"), &dir)?;
    let st = app.state::<AppState>();
    *st.needs_restart.lock().unwrap() = driver_installed();
    *st.last_applied.lock().unwrap() = None;
    *st.last_error.lock().unwrap() = None;
    Ok(build_status(&app))
}

#[tauri::command]
fn get_engine_status(app: AppHandle) -> Status {
    build_status(&app)
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    // Goes through the CloseRequested handler: hides to tray when "run in background" is on.
    let _ = window.close();
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    let res = if enabled { manager.enable() } else { manager.disable() };
    res.map_err(|e| e.to_string())
}

#[tauri::command]
fn set_flag(app: AppHandle, name: String, value: bool) {
    {
        let st = app.state::<AppState>();
        let mut s = st.saved.lock().unwrap();
        match name.as_str() {
            "run_in_background" => s.run_in_background = value,
            "start_minimized" => s.start_minimized = value,
            "tray_icon" => s.tray_icon = value,
            _ => {}
        }
    }
    if name == "tray_icon" {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_visible(value);
        }
        if !value {
            show_main(&app);
        }
    }
    persist(&app);
}

#[tauri::command]
fn get_pc_id() -> Result<String, String> {
    license::pc_id_string().ok_or_else(|| "Couldn't read this PC's ID.".to_string())
}

#[tauri::command]
fn get_license_status(app: AppHandle) -> license::LicenseStatus {
    license::status(&app)
}

#[tauri::command]
fn activate_license(app: AppHandle, key: String) -> license::ActivateResult {
    license::activate(&app, &key)
}

#[tauri::command]
fn remove_license(app: AppHandle) {
    license::remove(&app);
}

// ---------------------------------------------------------------- entry

pub fn run() {
    tauri::Builder::default()
        // Launching the exe a second time just brings the existing window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            apply_curve,
            set_engine_enabled,
            install_driver,
            uninstall_driver,
            get_engine_status,
            minimize_window,
            close_window,
            quit_app,
            set_autostart,
            set_flag,
            get_pc_id,
            get_license_status,
            activate_license,
            remove_license,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let saved = load_saved(&handle);
            app.manage(AppState {
                saved: Mutex::new(saved.clone()),
                last_error: Mutex::new(None),
                last_applied: Mutex::new(None),
                needs_restart: Mutex::new(false),
            });

            // Tray icon
            let open = MenuItem::with_id(app, "show", "Open AccelX", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit completely", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("AccelX")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            if !saved.tray_icon {
                let _ = tray.set_visible(false);
            }

            // Show the window unless we were launched by "Start with Windows" and the user
            // asked for a quiet start (only possible while the tray icon is available).
            let launched_hidden = std::env::args().any(|a| a == "--minimized");
            if !(launched_hidden && saved.start_minimized && saved.tray_icon) {
                show_main(&handle);
            }

            // Re-apply the saved curve (the driver forgets settings at every shutdown).
            if saved.enabled && !saved.lut.is_empty() {
                let h = handle.clone();
                std::thread::spawn(move || {
                    let _ = do_apply(&h);
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let saved = app.state::<AppState>().saved.lock().unwrap().clone();
                if saved.run_in_background {
                    api.prevent_close();
                    if saved.tray_icon {
                        let _ = window.hide();
                    } else {
                        let _ = window.minimize();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running AccelX");
}
