mod ai;
mod document_scope;
mod index;
mod opencode;
mod watcher;
mod workspace;

use std::{
    collections::VecDeque,
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Instant,
};

use tauri::{AppHandle, Emitter, Manager};
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
#[derive(Clone, Debug, serde::Serialize)]
struct StartupFile {
    path: Option<String>,
    error: Option<String>,
}

fn resolve_startup_file() -> StartupFile {
    resolve_startup_file_from_args(std::env::args(), None)
}

fn resolve_startup_file_from_args(
    args: impl IntoIterator<Item = String>,
    cwd: Option<&Path>,
) -> StartupFile {
    // The first argument is the executable path; a leading `-` marks a flag
    // (e.g. Tauri's own dev-mode arguments), not a file to open.
    let argument = args.into_iter().skip(1).find(|arg| !arg.starts_with('-'));

    match argument {
        None => StartupFile {
            path: None,
            error: None,
        },
        Some(path) => {
            let requested = Path::new(&path);
            let requested = if requested.is_absolute() {
                requested.to_path_buf()
            } else if let Some(cwd) = cwd {
                cwd.join(requested)
            } else {
                requested.to_path_buf()
            };
            if !requested.is_file() {
                return StartupFile {
                    path: None,
                    error: Some(format!("File not found: {}", requested.display())),
                };
            }
            if !requested
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
            {
                return StartupFile {
                    path: None,
                    error: Some("Markflow can only open Markdown (.md) files.".into()),
                };
            }
            match requested.canonicalize() {
                Ok(path) => StartupFile {
                    path: Some(path.to_string_lossy().into_owned()),
                    error: None,
                },
                Err(_) => StartupFile {
                    path: None,
                    error: Some(format!("File not found: {}", requested.display())),
                },
            }
        }
    }
}

#[derive(Default)]
struct ActivationInner {
    frontend_ready: bool,
    pending: VecDeque<StartupFile>,
}

#[derive(Default)]
struct ActivationState(Mutex<ActivationInner>);

struct StartupTiming {
    started: Instant,
    backend_ready_ms: AtomicU64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupTimingPayload {
    backend_ready_ms: u64,
}

#[tauri::command]
fn startup_timing(state: tauri::State<'_, StartupTiming>) -> StartupTimingPayload {
    let payload = StartupTimingPayload {
        backend_ready_ms: state.backend_ready_ms.load(Ordering::Relaxed),
    };
    write_startup_mark("process-start", 0.0);
    write_startup_mark("backend-ready", payload.backend_ready_ms as f64);
    payload
}

fn write_startup_mark(name: &str, milliseconds: f64) {
    let Some(path) = std::env::var_os("MARKFLOW_STARTUP_METRICS_FILE") else {
        return;
    };
    let line = serde_json::json!({ "name": name, "milliseconds": milliseconds }).to_string();
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        use std::io::Write;
        let _ = writeln!(file, "{line}");
    }
}

#[tauri::command]
fn record_startup_mark(name: String, milliseconds: f64) {
    const ALLOWED: &[&str] = &[
        "webview-module",
        "react-render-dispatched",
        "first-paint",
        "startup-file-authorized",
        "startup-document-parsed",
        "startup-document-visible",
    ];
    if ALLOWED.contains(&name.as_str()) && milliseconds.is_finite() && milliseconds >= 0.0 {
        write_startup_mark(&name, milliseconds);
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownAssociationStatus {
    supported: bool,
    is_markflow: bool,
    selected: Option<String>,
}

#[tauri::command]
fn markdown_association_status() -> MarkdownAssociationStatus {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg.exe")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice",
                "/v",
                "ProgId",
            ])
            .output();
        let selected = output.ok().and_then(|output| {
            String::from_utf8(output.stdout).ok().and_then(|text| {
                text.lines().find_map(|line| {
                    let fields = line.split_whitespace().collect::<Vec<_>>();
                    fields
                        .iter()
                        .position(|field| field.eq_ignore_ascii_case("REG_SZ"))
                        .and_then(|position| fields.get(position + 1))
                        .map(|value| (*value).to_string())
                })
            })
        });
        let is_markflow = selected
            .as_deref()
            .is_some_and(|value| value.to_ascii_lowercase().contains("markflow"));
        MarkdownAssociationStatus {
            supported: true,
            is_markflow,
            selected,
        }
    }
    #[cfg(not(target_os = "windows"))]
    MarkdownAssociationStatus {
        supported: false,
        is_markflow: false,
        selected: None,
    }
}

impl ActivationState {
    fn with_initial(initial: StartupFile) -> Self {
        let mut pending = VecDeque::new();
        if initial.path.is_some() || initial.error.is_some() {
            pending.push_back(initial);
        }
        Self(Mutex::new(ActivationInner {
            frontend_ready: false,
            pending,
        }))
    }
}

#[tauri::command]
fn startup_files(app: AppHandle, state: tauri::State<'_, ActivationState>) -> Vec<StartupFile> {
    // The listener is installed before this command runs. Holding one lock while
    // marking it ready and draining the queue prevents a second-instance event
    // from falling between those two operations.
    let queued = match state.0.lock() {
        Ok(mut activation) => {
            activation.frontend_ready = true;
            activation.pending.drain(..).collect::<Vec<_>>()
        }
        Err(_) => vec![StartupFile {
            path: None,
            error: Some("Could not initialize operating-system file opening.".into()),
        }],
    };
    queued
        .into_iter()
        .map(|result| {
            authorize_startup_file(result, |path| {
                app.fs_scope()
                    .allow_file(path)
                    .map_err(|error| error.to_string())
            })
        })
        .collect()
}

fn accept_activation(app: &AppHandle, args: Vec<String>, cwd: String) {
    let resolved = resolve_startup_file_from_args(args, Some(Path::new(&cwd)));
    if resolved.path.is_none() && resolved.error.is_none() {
        return;
    }
    let result = authorize_startup_file(resolved, |path| {
        app.fs_scope()
            .allow_file(path)
            .map_err(|error| error.to_string())
    });
    let emit_now = app
        .state::<ActivationState>()
        .0
        .lock()
        .map(|mut activation| {
            if activation.frontend_ready {
                true
            } else {
                activation.pending.push_back(result.clone());
                false
            }
        })
        .unwrap_or(false);
    if emit_now {
        let _ = app.emit("open-markdown-file", result);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
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
    let timing = StartupTiming {
        started: Instant::now(),
        backend_ready_ms: AtomicU64::new(0),
    };
    tauri::Builder::default()
        .manage(timing)
        .manage(ActivationState::with_initial(resolve_startup_file()))
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            accept_activation(app, args, cwd);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(workspace::WorkspaceState::default())
        .manage(ai::AiState::default())
        .manage(index::IndexState::default())
        .manage(opencode::OpenCodeProcessState::default())
        .setup(|app| {
            let timing = app.state::<StartupTiming>();
            timing.backend_ready_ms.store(
                timing
                    .started
                    .elapsed()
                    .as_millis()
                    .try_into()
                    .unwrap_or(u64::MAX),
                Ordering::Relaxed,
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            startup_files,
            startup_timing,
            record_startup_mark,
            markdown_association_status,
            ai::configure_ai,
            ai::migrate_ai_credential,
            ai::generate_ai,
            opencode::opencode_status,
            opencode::generate_opencode,
            opencode::test_opencode,
            opencode::cancel_opencode,
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
        let result = resolve_startup_file_from_args(["markflow.exe".into(), path.clone()], None);
        assert_eq!(
            result.path.as_deref(),
            Some(
                dir.0
                    .join("opened.md")
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .as_ref()
            )
        );
        assert!(result.error.is_none());
    }

    #[test]
    fn reports_a_missing_os_opened_file_without_failing_startup() {
        let result = resolve_startup_file_from_args(
            ["markflow.exe".into(), "C:/missing/selected.md".into()],
            None,
        );
        assert!(result.path.is_none());
        assert!(result.error.as_deref().unwrap().contains("File not found"));
    }

    #[test]
    fn ignores_flags_and_returns_empty_when_no_file_was_opened() {
        let result = resolve_startup_file_from_args(["markflow.exe".into(), "--dev".into()], None);
        assert!(result.path.is_none());
        assert!(result.error.is_none());
    }

    #[test]
    fn rejects_existing_non_markdown_files() {
        let dir = TempDir::new("startup-text");
        dir.write("opened.txt", "not markdown");
        let path = dir.0.join("opened.txt").to_string_lossy().into_owned();
        let result = resolve_startup_file_from_args(["markflow.exe".into(), path], None);
        assert!(result.path.is_none());
        assert_eq!(
            result.error.as_deref(),
            Some("Markflow can only open Markdown (.md) files.")
        );
    }

    #[test]
    fn resolves_relative_second_instance_paths_against_its_cwd() {
        let dir = TempDir::new("startup-relative");
        dir.write("relative.md", "# Relative");
        let result = resolve_startup_file_from_args(
            ["markflow.exe".into(), "relative.md".into()],
            Some(&dir.0),
        );
        assert!(result
            .path
            .as_deref()
            .is_some_and(|path| path.ends_with("relative.md")));
    }

    #[test]
    fn preserves_unicode_spaces_and_shell_metacharacters_as_one_path() {
        let dir = TempDir::new("startup-special-path");
        dir.write("[draft] & notes ñ.md", "# Safe path");
        let path = dir
            .0
            .join("[draft] & notes ñ.md")
            .to_string_lossy()
            .into_owned();
        let result = resolve_startup_file_from_args(["markflow.exe".into(), path], None);
        assert!(result
            .path
            .as_deref()
            .is_some_and(|resolved| resolved.ends_with("[draft] & notes ñ.md")));
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
