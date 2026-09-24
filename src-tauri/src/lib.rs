mod ai;
mod document_scope;
mod index;
mod watcher;
mod workspace;

use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// What the frontend receives about the OS-provided startup file argument.
///
/// Process arguments are not reachable from the webview, so this is read here
/// and delivered to the frontend through a startup command. Exactly one of
/// `path` or `error` is set; both are empty when the app was launched with no
/// file argument at all.
#[derive(Clone, serde::Serialize)]
struct StartupFile {
    path: Option<String>,
    error: Option<String>,
}

fn resolve_startup_file() -> StartupFile {
    resolve_startup_file_from_args(std::env::args())
}

fn resolve_startup_file_from_args(args: impl IntoIterator<Item = String>) -> StartupFile {
    // The first argument is the executable path; a leading `-` marks a flag
    // (e.g. Tauri's own dev-mode arguments), not a file to open.
    let argument = args.into_iter().skip(1).find(|arg| !arg.starts_with('-'));

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

#[tauri::command]
fn startup_file(app: AppHandle) -> StartupFile {
    // Queried after frontend startup so OS launch arguments cannot be lost to
    // an event emitted before the webview has registered its listener.
    authorize_startup_file(resolve_startup_file(), |path| {
        app.fs_scope()
            .allow_file(path)
            .map_err(|error| error.to_string())
    })
}

fn authorize_startup_file(
    result: StartupFile,
    allow_exact_file: impl FnOnce(&str) -> Result<(), String>,
) -> StartupFile {
    if let Some(path) = &result.path {
        // The process argument is the user's OS-level open action. Grant only
        // that exact file here; broader sibling/image access still goes through
        // allow_document_directory after the frontend has accepted the document.
        if let Err(error) = allow_exact_file(path) {
            return StartupFile {
                path: None,
                error: Some(format!("Could not authorize opened file: {error}")),
            };
        }
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(workspace::WorkspaceState::default())
        .manage(ai::AiState::default())
        .manage(index::IndexState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            startup_file,
            ai::configure_ai,
            ai::migrate_ai_credential,
            ai::generate_ai,
            index::start_index,
            index::stop_index,
            index::pause_index,
            index::install_embedding_model,
            index::retrieve_workspace,
            document_scope::allow_document_directory,
            workspace::scan_workspace,
            watcher::start_watching,
            watcher::stop_watching
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod startup_file_tests {
    use super::*;
    use crate::workspace::tests::TempDir;

    #[test]
    fn resolves_an_existing_os_opened_markdown_path() {
        let dir = TempDir::new("startup-markdown");
        dir.write("opened.md", "# Opened from Explorer\n");
        let path = dir.0.join("opened.md").to_string_lossy().into_owned();
        let result = resolve_startup_file_from_args(["markflow.exe".into(), path.clone()]);
        assert_eq!(result.path.as_deref(), Some(path.as_str()));
        assert!(result.error.is_none());
    }

    #[test]
    fn reports_a_missing_os_opened_file_without_failing_startup() {
        let result = resolve_startup_file_from_args([
            "markflow.exe".into(),
            "C:/missing/selected.md".into(),
        ]);
        assert!(result.path.is_none());
        assert!(result.error.as_deref().unwrap().contains("File not found"));
    }

    #[test]
    fn ignores_flags_and_returns_empty_when_no_file_was_opened() {
        let result = resolve_startup_file_from_args(["markflow.exe".into(), "--dev".into()]);
        assert!(result.path.is_none());
        assert!(result.error.is_none());
    }

    #[test]
    fn authorizes_only_the_resolved_os_argument() {
        let requested = "C:/Users/person/Downloads/opened.md".to_string();
        let mut authorized = None;
        let result = authorize_startup_file(
            StartupFile {
                path: Some(requested.clone()),
                error: None,
            },
            |path| {
                authorized = Some(path.to_string());
                Ok(())
            },
        );
        assert_eq!(authorized.as_deref(), Some(requested.as_str()));
        assert_eq!(result.path.as_deref(), Some(requested.as_str()));
    }

    #[test]
    fn reports_scope_failure_without_exposing_the_path_to_the_frontend() {
        let result = authorize_startup_file(
            StartupFile {
                path: Some("C:/private.md".into()),
                error: None,
            },
            |_| Err("denied".into()),
        );
        assert!(result.path.is_none());
        assert_eq!(
            result.error.as_deref(),
            Some("Could not authorize opened file: denied")
        );
    }
}
