mod watcher;
mod workspace;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// What the frontend receives about the OS-provided startup file argument.
///
/// Process arguments are not reachable from the webview, so this is read here
/// and delivered to the frontend as a `startup-file` event. Exactly one of
/// `path` or `error` is set; both are empty when the app was launched with no
/// file argument at all.
#[derive(Clone, serde::Serialize)]
struct StartupFile {
    path: Option<String>,
    error: Option<String>,
}

fn resolve_startup_file() -> StartupFile {
    // The first argument is the executable path; a leading `-` marks a flag
    // (e.g. Tauri's own dev-mode arguments), not a file to open.
    let argument = std::env::args().skip(1).find(|arg| !arg.starts_with('-'));

    match argument {
        None => StartupFile {
            path: None,
            error: None,
        },
        Some(path) => {
            if std::path::Path::new(&path).is_file() {
                StartupFile {
                    path: Some(path),
                    error: None,
                }
            } else {
                StartupFile {
                    path: None,
                    error: Some(format!("File not found: {path}")),
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(workspace::WorkspaceState::default())
        .setup(|app| {
            use tauri::Emitter;
            app.emit("startup-file", resolve_startup_file())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            workspace::scan_workspace,
            watcher::start_watching,
            watcher::stop_watching
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
