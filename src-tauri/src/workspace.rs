//! Workspace scanning: the recursive traversal of the folder the application
//! is opened against.
//!
//! Traversal happens here rather than through the fs plugin's JavaScript API
//! because a scan of thousands of entries done from the frontend would be
//! thousands of IPC crossings. Here it is one walk, delivered in a handful of
//! chunked payloads — see design decisions D1 and D8 of the workspace-explorer
//! change.

use std::collections::VecDeque;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_fs::FsExt;

use crate::watcher::WorkspaceWatcher;

/// Directories never listed or descended into. `.git` alone can hold more
/// entries than the documentation beside it, and neither is something a user
/// opens as a document.
const IGNORED_DIRECTORY_NAMES: [&str; 2] = [".git", "node_modules"];

/// Suffix of the temporary file the editor's atomic save writes next to its
/// target (`src/editor/saveDocument.ts`). It exists for milliseconds and is
/// never something to show.
pub const SAVE_TEMP_SUFFIX: &str = ".markflow-tmp";

/// How many entries travel in one chunk. Large enough that a folder of a few
/// thousand files crosses the bridge in a handful of payloads, small enough
/// that the first rows of the tree appear before the walk is over.
const SCAN_CHUNK_SIZE: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
}

/// One entry of the workspace listing. `path` is relative to the workspace
/// root and always uses `/`, so the frontend has one path format to handle
/// regardless of platform.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct WorkspaceEntry {
    pub path: String,
    pub kind: EntryKind,
    /// Only Markdown files are openable; everything else is listed, greyed
    /// out, so the tree reflects the real folder.
    pub markdown: bool,
}

#[derive(Clone, serde::Serialize)]
pub struct ScanChunk {
    pub entries: Vec<WorkspaceEntry>,
}

/// A folder inside the workspace that could not be read. The scan carries on
/// past it; the frontend reports it.
#[derive(Clone, Debug, serde::Serialize)]
pub struct ScanFailure {
    pub path: String,
    pub message: String,
}

#[derive(Clone, Debug, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub entry_count: usize,
    pub failures: Vec<ScanFailure>,
    /// Set when a newer scan superseded this one before it finished.
    pub cancelled: bool,
}

/// Managed state for the open workspace: which scan is current, and the
/// watcher, if one is running.
#[derive(Default)]
pub struct WorkspaceState {
    scan_generation: Arc<AtomicU64>,
    pub watcher: std::sync::Mutex<Option<WorkspaceWatcher>>,
}

pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown")
        })
}

/// Whether `path` lies in, or is, something the workspace never lists.
pub fn is_ignored(root: &Path, path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return true;
    };

    let inside_ignored_directory = relative.components().any(|component| match component {
        Component::Normal(name) => name
            .to_str()
            .is_some_and(|name| IGNORED_DIRECTORY_NAMES.contains(&name)),
        _ => false,
    });

    let is_save_temp = path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(SAVE_TEMP_SUFFIX));

    inside_ignored_directory || is_save_temp
}

/// `path` relative to `root`, with `/` separators. `None` for the root itself
/// or anything outside it.
pub fn relative_path(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    let segments: Vec<String> = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(name) => Some(name.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();

    if segments.is_empty() {
        None
    } else {
        Some(segments.join("/"))
    }
}

/// Describes whatever is at `path` now, or `None` if nothing is, or it is
/// ignored. Symbolic links are listed as what they point to, but a linked
/// directory is never descended into, which rules out cycles.
pub fn describe_entry(root: &Path, path: &Path) -> Option<WorkspaceEntry> {
    if is_ignored(root, path) {
        return None;
    }

    let relative = relative_path(root, path)?;
    let metadata = fs::symlink_metadata(path).ok()?;
    let kind = if metadata.is_dir() {
        EntryKind::Directory
    } else if metadata.is_file() || fs::metadata(path).is_ok_and(|target| target.is_file()) {
        EntryKind::File
    } else {
        return None;
    };

    Some(WorkspaceEntry {
        path: relative,
        kind,
        markdown: kind == EntryKind::File && is_markdown(path),
    })
}

/// Walks `start` (the root, or a folder inside it) breadth first, so the top
/// of the tree fills in before deep folders, handing entries to `emit` in
/// chunks. `start` itself is not emitted.
///
/// An unreadable `start` is an error; an unreadable folder below it is
/// recorded in the summary and skipped. `is_cancelled` is polled once per
/// folder, so a superseded scan stops promptly.
pub fn walk(
    root: &Path,
    start: &Path,
    is_cancelled: impl Fn() -> bool,
    mut emit: impl FnMut(Vec<WorkspaceEntry>),
) -> Result<ScanSummary, String> {
    let first = fs::read_dir(start).map_err(|error| format!("{}: {error}", start.display()))?;

    let mut summary = ScanSummary::default();
    let mut chunk: Vec<WorkspaceEntry> = Vec::with_capacity(SCAN_CHUNK_SIZE);
    let mut pending: VecDeque<PathBuf> = VecDeque::new();
    let mut next_listing = Some(first);

    loop {
        if is_cancelled() {
            summary.cancelled = true;
            break;
        }

        let listing = match next_listing.take() {
            Some(listing) => listing,
            None => {
                let Some(directory) = pending.pop_front() else {
                    break;
                };

                match fs::read_dir(&directory) {
                    Ok(listing) => listing,
                    Err(error) => {
                        summary.failures.push(ScanFailure {
                            path: relative_path(root, &directory).unwrap_or_default(),
                            message: error.to_string(),
                        });
                        continue;
                    }
                }
            }
        };

        for item in listing.flatten() {
            let path = item.path();
            let Some(entry) = describe_entry(root, &path) else {
                continue;
            };

            // `DirEntry::file_type` does not follow links, so a linked
            // directory is listed but not queued.
            let is_real_directory = item.file_type().is_ok_and(|file_type| file_type.is_dir());
            if is_real_directory {
                pending.push_back(path);
            }

            chunk.push(entry);
            summary.entry_count += 1;
            if chunk.len() == SCAN_CHUNK_SIZE {
                emit(std::mem::replace(
                    &mut chunk,
                    Vec::with_capacity(SCAN_CHUNK_SIZE),
                ));
            }
        }
    }

    if !chunk.is_empty() {
        emit(chunk);
    }

    Ok(summary)
}

/// Refuses a root the user did not grant through the folder dialog, so these
/// commands never reach further than the fs plugin's own scope would.
pub fn ensure_root_allowed(app: &AppHandle, root: &Path) -> Result<(), String> {
    if app.fs_scope().is_allowed(root) {
        Ok(())
    } else {
        Err(format!(
            "{} is not an opened workspace folder",
            root.display()
        ))
    }
}

/// Scans the workspace at `root`, streaming the listing through `on_chunk`
/// as it is found and resolving with a summary once the walk is over. Runs on
/// a blocking thread, so the window stays responsive during a large scan.
#[tauri::command]
pub async fn scan_workspace(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
    root: String,
    on_chunk: Channel<ScanChunk>,
) -> Result<ScanSummary, String> {
    let root = PathBuf::from(root);
    ensure_root_allowed(&app, &root)?;

    let generation = Arc::clone(&state.scan_generation);
    let this_scan = generation.fetch_add(1, Ordering::SeqCst) + 1;

    tauri::async_runtime::spawn_blocking(move || {
        walk(
            &root,
            &root,
            || generation.load(Ordering::SeqCst) != this_scan,
            |entries| {
                // A send only fails once the frontend has gone away, at which
                // point there is nobody left to report to.
                let _ = on_chunk.send(ScanChunk { entries });
            },
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    /// A fresh, empty directory under the system temp folder, removed on drop.
    /// Hand-rolled rather than pulling in a crate for one test helper.
    pub struct TempDir(pub PathBuf);

    impl TempDir {
        pub fn new(label: &str) -> Self {
            static COUNTER: AtomicUsize = AtomicUsize::new(0);
            let unique = format!(
                "markflow-{label}-{}-{}",
                std::process::id(),
                COUNTER.fetch_add(1, Ordering::SeqCst)
            );
            let path = std::env::temp_dir().join(unique);
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            // Canonical, so paths reported by the OS watcher match it.
            TempDir(fs::canonicalize(&path).unwrap())
        }

        pub fn write(&self, relative: &str, content: &str) {
            let path = self.0.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn scan(root: &Path) -> (Vec<WorkspaceEntry>, ScanSummary, usize) {
        let mut entries = Vec::new();
        let mut chunks = 0;
        let summary = walk(
            root,
            root,
            || false,
            |chunk| {
                chunks += 1;
                entries.extend(chunk);
            },
        )
        .unwrap();
        (entries, summary, chunks)
    }

    #[test]
    fn lists_files_and_folders_recursively_with_relative_slash_paths() {
        let dir = TempDir::new("scan-recursive");
        dir.write("readme.md", "# Readme");
        dir.write("design/combat.md", "# Combat");
        dir.write("design/balance/table.csv", "a,b");

        let (entries, summary, _) = scan(&dir.0);
        let mut paths: Vec<&str> = entries.iter().map(|entry| entry.path.as_str()).collect();
        paths.sort();

        assert_eq!(
            paths,
            vec![
                "design",
                "design/balance",
                "design/balance/table.csv",
                "design/combat.md",
                "readme.md"
            ]
        );
        assert_eq!(summary.entry_count, 5);
        assert!(summary.failures.is_empty());
    }

    #[test]
    fn flags_only_markdown_files_as_markdown() {
        let dir = TempDir::new("scan-markdown");
        dir.write("a.md", "");
        dir.write("b.MARKDOWN", "");
        dir.write("c.txt", "");
        dir.write("folder.md/inner.txt", "");

        let (entries, _, _) = scan(&dir.0);
        let markdown = |path: &str| {
            entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap()
                .markdown
        };

        assert!(markdown("a.md"));
        assert!(markdown("b.MARKDOWN"));
        assert!(!markdown("c.txt"));
        assert!(
            !markdown("folder.md"),
            "a folder is never markdown, whatever its name"
        );
    }

    #[test]
    fn skips_ignored_folders_and_save_temp_files() {
        let dir = TempDir::new("scan-ignored");
        dir.write(".git/HEAD", "ref");
        dir.write("node_modules/pkg/readme.md", "");
        dir.write("doc.md.markflow-tmp", "");
        dir.write("doc.md", "");

        let (entries, _, _) = scan(&dir.0);
        let paths: Vec<&str> = entries.iter().map(|entry| entry.path.as_str()).collect();

        assert_eq!(paths, vec!["doc.md"]);
    }

    #[test]
    fn delivers_a_large_folder_in_chunks_rather_than_per_entry() {
        let dir = TempDir::new("scan-chunks");
        for index in 0..1200 {
            dir.write(&format!("docs/file-{index}.md"), "");
        }

        let (entries, _, chunks) = scan(&dir.0);

        assert_eq!(entries.len(), 1201);
        assert_eq!(chunks, 3);
    }

    #[test]
    fn an_unreadable_root_is_an_error() {
        let dir = TempDir::new("scan-missing");
        let missing = dir.0.join("does-not-exist");

        let result = walk(&missing, &missing, || false, |_| {});

        assert!(result.is_err());
    }

    #[test]
    fn a_cancelled_scan_stops_and_says_so() {
        let dir = TempDir::new("scan-cancelled");
        dir.write("a/b/c.md", "");

        let summary = walk(&dir.0, &dir.0, || true, |_| {}).unwrap();

        assert!(summary.cancelled);
        assert_eq!(summary.entry_count, 0);
    }
}
