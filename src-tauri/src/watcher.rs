//! Filesystem watching for the open workspace.
//!
//! Built on `notify`, the crate behind the fs plugin's `watch` feature, used
//! directly: the plugin's watcher forwards every debounced event to the
//! frontend as its own message, and the spec requires a bulk change — a git
//! checkout touching hundreds of files — to arrive as one batch. Events are
//! collected here until the workspace goes quiet, coalesced per path, and
//! emitted together. See design decision D1 and the "Bulk change is
//! coalesced" scenario.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use notify::event::{ModifyKind, RenameMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

use crate::workspace::{
    self, describe_entry, is_ignored, relative_path, EntryKind, WorkspaceEntry, WorkspaceState,
};

/// How long the workspace must stay quiet before pending events are emitted.
///
/// Measured against real `git checkout`s on Windows 10 (see
/// `measure_git_checkout_event_spread` below): switching 2,000 Markdown files
/// between two branches produced about 8,000 raw events spread over 2.0–2.4 s,
/// and across five runs the largest gap between consecutive events was 113 ms.
/// Windows of 50 and 100 ms split two of those five checkouts at such a gap;
/// 250 ms split none, while a single external save still shows up in a
/// quarter of a second.
pub const DEBOUNCE_WINDOW: Duration = Duration::from_millis(250);

/// Upper bound on how long events are held while changes keep arriving, so a
/// long-running bulk operation still updates the tree every couple of seconds
/// instead of only once it finishes. The measured 2,000-file checkout runs
/// slightly longer than this, so it arrives as two batches rather than one —
/// still two messages instead of thousands.
pub const MAX_BATCH_LATENCY: Duration = Duration::from_secs(2);

/// One change to the workspace, as the frontend receives it. Paths are
/// relative to the root with `/` separators, like the scan's.
///
/// `created` and `modified` carry the entry as it is on disk at emission
/// time. A rename is reported as `renamed` only when the platform reports
/// both names together; otherwise it arrives as `removed` plus `created`.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum WatchChange {
    Created { entry: WorkspaceEntry },
    Modified { entry: WorkspaceEntry },
    Removed { path: String },
    Renamed { from: String, entry: WorkspaceEntry },
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct WatchBatch {
    pub changes: Vec<WatchChange>,
}

/// A running watcher. Dropping it stops the OS watcher, which closes the
/// event channel and ends the debounce thread.
pub struct WorkspaceWatcher {
    _watcher: RecommendedWatcher,
}

impl WorkspaceWatcher {
    /// Watches `root` recursively, handing each coalesced batch to `sink`.
    pub fn start(
        root: PathBuf,
        window: Duration,
        max_latency: Duration,
        sink: impl Fn(WatchBatch) + Send + 'static,
    ) -> notify::Result<Self> {
        let (sender, receiver) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(sender)?;
        watcher.watch(&root, RecursiveMode::Recursive)?;

        thread::spawn(move || {
            run_debounce_loop(receiver, window, max_latency, |events| {
                let changes = coalesce(&root, &events);
                if !changes.is_empty() {
                    sink(WatchBatch { changes });
                }
            });
        });

        Ok(WorkspaceWatcher { _watcher: watcher })
    }
}

/// Collects events until none has arrived for `window`, or until the first
/// pending one is `max_latency` old, then flushes them all at once. Returns
/// when the sending side — the OS watcher — is dropped.
pub fn run_debounce_loop(
    receiver: Receiver<notify::Result<Event>>,
    window: Duration,
    max_latency: Duration,
    mut flush: impl FnMut(Vec<Event>),
) {
    loop {
        let Ok(first) = receiver.recv() else {
            return;
        };

        let mut pending = Vec::new();
        push_event(&mut pending, first);
        let batch_started = Instant::now();

        loop {
            let until_cap = max_latency.saturating_sub(batch_started.elapsed());
            let wait = window.min(until_cap);
            if wait.is_zero() {
                break;
            }

            match receiver.recv_timeout(wait) {
                Ok(event) => push_event(&mut pending, event),
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    flush(pending);
                    return;
                }
            }
        }

        flush(pending);
    }
}

fn push_event(pending: &mut Vec<Event>, event: notify::Result<Event>) {
    match event {
        Ok(event) => pending.push(event),
        // A watcher error (e.g. an overflowed OS buffer) is not a change to
        // any particular path; there is nothing to coalesce it into.
        Err(error) => eprintln!("workspace watcher error: {error}"),
    }
}

/// Net effect on one path across a batch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Net {
    Created,
    Modified,
    Removed,
}

fn merge(previous: Option<Net>, next: Net) -> Net {
    match (previous, next) {
        (None, next) => next,
        (Some(Net::Created), Net::Modified) => Net::Created,
        // Removed and then created again within one batch is how many tools
        // replace a file; for anyone watching, its content changed.
        (Some(Net::Removed), Net::Created | Net::Modified) => Net::Modified,
        (Some(Net::Modified), Net::Created) => Net::Modified,
        (Some(_), next) => next,
    }
}

/// Reduces raw OS events to at most one change per path, in first-seen order.
///
/// Created and modified paths are re-read from disk here, so a batch reflects
/// what is there now even if the raw events arrived out of order. Paths in
/// ignored folders and the editor's own save temp files are dropped, and a
/// newly appeared folder is expanded into its contents, since platforms do not
/// always report the files inside a folder that was moved in whole.
pub fn coalesce(root: &Path, events: &[Event]) -> Vec<WatchChange> {
    let mut order: Vec<PathBuf> = Vec::new();
    let mut net: HashMap<PathBuf, Net> = HashMap::new();
    let mut rename_pairs: Vec<(PathBuf, PathBuf)> = Vec::new();

    let mut record = |path: &Path, change: Net| {
        if is_ignored(root, path) {
            return;
        }
        let previous = net.get(path).copied();
        if previous.is_none() {
            order.push(path.to_path_buf());
        }
        net.insert(path.to_path_buf(), merge(previous, change));
    };

    for event in events {
        match event.kind {
            EventKind::Create(_) => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Created)),
            EventKind::Remove(_) => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Removed)),
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)) if event.paths.len() == 2 => {
                record(&event.paths[0], Net::Removed);
                record(&event.paths[1], Net::Created);
                rename_pairs.push((event.paths[0].clone(), event.paths[1].clone()));
            }
            EventKind::Modify(ModifyKind::Name(RenameMode::From)) => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Removed)),
            EventKind::Modify(ModifyKind::Name(RenameMode::To)) => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Created)),
            // Only the platform knows which half of a rename this was; what is
            // on disk now settles it below.
            EventKind::Modify(ModifyKind::Name(_)) => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Created)),
            // Permissions and timestamps do not change content.
            EventKind::Modify(ModifyKind::Metadata(_)) | EventKind::Access(_) => {}
            EventKind::Modify(_) | EventKind::Any | EventKind::Other => event
                .paths
                .iter()
                .for_each(|path| record(path, Net::Modified)),
        }
    }

    // Settle each path against the disk, which is the only authority on
    // whether it exists now, whatever order the events came in.
    let mut settled: HashMap<PathBuf, Option<WorkspaceEntry>> = HashMap::new();
    for path in &order {
        settled.insert(path.clone(), describe_entry(root, path));
    }

    let mut renamed_targets: HashMap<PathBuf, PathBuf> = HashMap::new();
    for (from, to) in rename_pairs {
        let from_gone = matches!(settled.get(&from), Some(None));
        let to_present = matches!(settled.get(&to), Some(Some(_)));
        if from_gone && to_present {
            renamed_targets.insert(to, from);
        }
    }
    let renamed_sources: HashSet<PathBuf> = renamed_targets.values().cloned().collect();

    let mut changes = Vec::new();
    let mut emitted: HashSet<String> = HashSet::new();
    let mut new_directories: Vec<PathBuf> = Vec::new();

    for path in &order {
        if renamed_sources.contains(path) {
            continue;
        }

        let Some(relative) = relative_path(root, path) else {
            continue;
        };

        let change = match (settled[path].clone(), net[path]) {
            (None, _) => WatchChange::Removed { path: relative },
            (Some(entry), Net::Modified) => {
                // A folder "changes" whenever something inside it does; the
                // entries inside carry that news themselves.
                if entry.kind == EntryKind::Directory {
                    continue;
                }
                WatchChange::Modified { entry }
            }
            (Some(entry), Net::Removed) => WatchChange::Modified { entry },
            (Some(entry), Net::Created) => {
                if entry.kind == EntryKind::Directory {
                    new_directories.push(path.clone());
                }
                match renamed_targets
                    .get(path)
                    .and_then(|from| relative_path(root, from))
                {
                    Some(from) => WatchChange::Renamed { from, entry },
                    None => WatchChange::Created { entry },
                }
            }
        };

        emitted.insert(changed_path(&change).to_string());
        changes.push(change);
    }

    for directory in new_directories {
        let _ = workspace::walk(
            root,
            &directory,
            || false,
            |entries| {
                for entry in entries {
                    if emitted.insert(entry.path.clone()) {
                        changes.push(WatchChange::Created { entry });
                    }
                }
            },
        );
    }

    changes
}

fn changed_path(change: &WatchChange) -> &str {
    match change {
        WatchChange::Created { entry }
        | WatchChange::Modified { entry }
        | WatchChange::Renamed { entry, .. } => &entry.path,
        WatchChange::Removed { path } => path,
    }
}

/// Starts watching the workspace at `root`, replacing any previous watcher,
/// and streams batches through `on_batch`.
///
/// There is deliberately no command to pause or suspend it around the
/// editor's own saves: those are recognised by content on the frontend (see
/// `src/explorer/selfWrites.ts`), because suspending would race with genuine
/// external changes — design decision D5.
#[tauri::command]
pub fn start_watching(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
    root: String,
    on_batch: Channel<WatchBatch>,
) -> Result<(), String> {
    let root = PathBuf::from(root);
    workspace::ensure_root_allowed(&app, &root)?;

    let index_root = root.to_string_lossy().into_owned();
    let watcher = WorkspaceWatcher::start(root, DEBOUNCE_WINDOW, MAX_BATCH_LATENCY, move |batch| {
        app.state::<crate::index::IndexState>()
            .changed(&index_root, batch.changes.clone());
        let _ = on_batch.send(batch);
    })
    .map_err(|error| error.to_string())?;

    // Replacing the previous watcher drops it, which stops it.
    *state.watcher.lock().map_err(|error| error.to_string())? = Some(watcher);
    Ok(())
}

/// Stops watching when the workspace is closed.
#[tauri::command]
pub fn stop_watching(state: State<'_, WorkspaceState>) -> Result<(), String> {
    *state.watcher.lock().map_err(|error| error.to_string())? = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::tests::TempDir;
    use notify::event::{CreateKind, DataChange, RemoveKind};
    use std::sync::{Arc, Mutex};

    fn event(kind: EventKind, paths: &[&Path]) -> Event {
        paths.iter().fold(Event::new(kind), |event, path| {
            event.add_path(path.to_path_buf())
        })
    }

    fn created(path: &Path) -> Event {
        event(EventKind::Create(CreateKind::File), &[path])
    }

    fn modified(path: &Path) -> Event {
        event(
            EventKind::Modify(ModifyKind::Data(DataChange::Content)),
            &[path],
        )
    }

    fn removed(path: &Path) -> Event {
        event(EventKind::Remove(RemoveKind::File), &[path])
    }

    #[test]
    fn a_burst_of_events_is_flushed_as_one_batch() {
        let (sender, receiver) = mpsc::channel();
        for index in 0..500 {
            sender
                .send(Ok(created(Path::new(&format!("/w/file-{index}.md")))))
                .unwrap();
        }
        drop(sender);

        let mut batches: Vec<usize> = Vec::new();
        run_debounce_loop(
            receiver,
            Duration::from_millis(50),
            Duration::from_secs(5),
            |events| batches.push(events.len()),
        );

        assert_eq!(batches, vec![500]);
    }

    #[test]
    fn a_sustained_stream_is_flushed_at_the_latency_cap() {
        let (sender, receiver) = mpsc::channel();
        let producer = thread::spawn(move || {
            for index in 0..30 {
                sender
                    .send(Ok(created(Path::new(&format!("/w/{index}.md")))))
                    .unwrap();
                thread::sleep(Duration::from_millis(10));
            }
        });

        let mut batches = 0;
        run_debounce_loop(
            receiver,
            Duration::from_millis(100),
            Duration::from_millis(120),
            |_| batches += 1,
        );
        producer.join().unwrap();

        assert!(
            batches >= 2,
            "expected the cap to split a 300 ms stream, got {batches} batch(es)"
        );
    }

    #[test]
    fn a_real_bulk_change_reaches_the_sink_as_a_batch_not_one_message_per_file() {
        let dir = TempDir::new("watch-bulk");
        let batches: Arc<Mutex<Vec<WatchBatch>>> = Arc::default();
        let sink = Arc::clone(&batches);

        let _watcher = WorkspaceWatcher::start(
            dir.0.clone(),
            DEBOUNCE_WINDOW,
            MAX_BATCH_LATENCY,
            move |batch| sink.lock().unwrap().push(batch),
        )
        .unwrap();

        const FILE_COUNT: usize = 300;
        for index in 0..FILE_COUNT {
            dir.write(&format!("docs/file-{index}.md"), "# Title");
        }
        thread::sleep(DEBOUNCE_WINDOW * 6);

        let batches = batches.lock().unwrap();
        let file_changes: HashSet<String> = batches
            .iter()
            .flat_map(|batch| batch.changes.iter())
            .map(|change| changed_path(change).to_string())
            .filter(|path| path.ends_with(".md"))
            .collect();

        assert_eq!(
            file_changes.len(),
            FILE_COUNT,
            "every created file is reported"
        );
        assert!(
            batches.len() <= FILE_COUNT / 10,
            "{FILE_COUNT} files arrived in {} batches; expected substantial coalescing",
            batches.len()
        );
    }

    #[test]
    fn repeated_events_on_one_path_coalesce_to_one_change() {
        let dir = TempDir::new("coalesce-repeat");
        dir.write("a.md", "x");
        let path = dir.0.join("a.md");

        let changes = coalesce(&dir.0, &[modified(&path), modified(&path), modified(&path)]);

        assert_eq!(changes.len(), 1);
        assert!(matches!(&changes[0], WatchChange::Modified { entry } if entry.path == "a.md"));
    }

    #[test]
    fn created_then_modified_is_created() {
        let dir = TempDir::new("coalesce-create");
        dir.write("new.md", "x");
        let path = dir.0.join("new.md");

        let changes = coalesce(&dir.0, &[created(&path), modified(&path)]);

        assert!(
            matches!(&changes[..], [WatchChange::Created { entry }] if entry.path == "new.md" && entry.markdown)
        );
    }

    #[test]
    fn removed_then_recreated_is_a_modification() {
        let dir = TempDir::new("coalesce-replace");
        dir.write("doc.md", "new content");
        let path = dir.0.join("doc.md");

        let changes = coalesce(&dir.0, &[removed(&path), created(&path)]);

        assert!(
            matches!(&changes[..], [WatchChange::Modified { entry }] if entry.path == "doc.md")
        );
    }

    #[test]
    fn a_path_that_no_longer_exists_is_reported_removed_whatever_came_before() {
        let dir = TempDir::new("coalesce-gone");
        let path = dir.0.join("gone.md");

        let changes = coalesce(&dir.0, &[created(&path), modified(&path)]);

        assert_eq!(
            changes,
            vec![WatchChange::Removed {
                path: "gone.md".into()
            }]
        );
    }

    #[test]
    fn a_rename_reported_in_two_halves_becomes_removed_plus_created() {
        let dir = TempDir::new("coalesce-rename-halves");
        dir.write("new.md", "x");
        let from = dir.0.join("old.md");
        let to = dir.0.join("new.md");

        let changes = coalesce(
            &dir.0,
            &[
                event(
                    EventKind::Modify(ModifyKind::Name(RenameMode::From)),
                    &[&from],
                ),
                event(EventKind::Modify(ModifyKind::Name(RenameMode::To)), &[&to]),
            ],
        );

        assert_eq!(changes.len(), 2);
        assert_eq!(
            changes[0],
            WatchChange::Removed {
                path: "old.md".into()
            }
        );
        assert!(matches!(&changes[1], WatchChange::Created { entry } if entry.path == "new.md"));
    }

    #[test]
    fn a_rename_reported_atomically_becomes_renamed() {
        let dir = TempDir::new("coalesce-rename-both");
        dir.write("new.md", "x");
        let from = dir.0.join("old.md");
        let to = dir.0.join("new.md");

        let changes = coalesce(
            &dir.0,
            &[event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                &[&from, &to],
            )],
        );

        assert!(
            matches!(&changes[..], [WatchChange::Renamed { from, entry }] if from == "old.md" && entry.path == "new.md")
        );
    }

    #[test]
    fn the_editors_save_temp_file_and_ignored_folders_never_appear() {
        let dir = TempDir::new("coalesce-ignored");
        dir.write("doc.md", "x");
        let temp = dir.0.join("doc.md.markflow-tmp");
        let git = dir.0.join(".git").join("index");

        let changes = coalesce(
            &dir.0,
            &[
                created(&temp),
                modified(&git),
                event(
                    EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                    &[&temp, &dir.0.join("doc.md")],
                ),
            ],
        );

        assert!(matches!(&changes[..], [WatchChange::Created { entry }] if entry.path == "doc.md"));
    }

    #[test]
    fn a_folder_moved_in_whole_is_expanded_into_its_contents() {
        let dir = TempDir::new("coalesce-folder");
        dir.write("moved/inner/a.md", "x");
        dir.write("moved/b.md", "x");

        let changes = coalesce(&dir.0, &[created(&dir.0.join("moved"))]);
        let mut paths: Vec<&str> = changes.iter().map(changed_path).collect();
        paths.sort();

        assert_eq!(
            paths,
            vec!["moved", "moved/b.md", "moved/inner", "moved/inner/a.md"]
        );
    }

    #[test]
    fn modifications_to_folders_are_not_reported() {
        let dir = TempDir::new("coalesce-folder-modify");
        dir.write("folder/a.md", "x");

        let changes = coalesce(&dir.0, &[modified(&dir.0.join("folder"))]);

        assert!(changes.is_empty());
    }

    /// Measurement behind `DEBOUNCE_WINDOW`, not a pass/fail check: builds a
    /// git repository with two branches that differ in every one of 2,000
    /// Markdown files, watches it raw, runs `git checkout` between them and
    /// prints how the events were spread in time. Needs `git` on the PATH.
    ///
    /// `cargo test --manifest-path src-tauri/Cargo.toml measure_git_checkout -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn measure_git_checkout_event_spread() {
        use std::process::Command;

        const FILE_COUNT: usize = 2000;
        let dir = TempDir::new("measure-checkout");
        let git = |args: &[&str]| {
            let status = Command::new("git")
                .args(args)
                .current_dir(&dir.0)
                .output()
                .unwrap();
            assert!(
                status.status.success(),
                "git {args:?} failed: {}",
                String::from_utf8_lossy(&status.stderr)
            );
        };

        git(&["init", "-q", "-b", "one"]);
        git(&["config", "user.email", "measure@example.com"]);
        git(&["config", "user.name", "measure"]);
        for index in 0..FILE_COUNT {
            dir.write(
                &format!("docs/section-{}/file-{index}.md", index % 20),
                &format!("# One {index}\n"),
            );
        }
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "one"]);
        git(&["checkout", "-q", "-b", "two"]);
        for index in 0..FILE_COUNT {
            dir.write(
                &format!("docs/section-{}/file-{index}.md", index % 20),
                &format!("# Two {index}\n\nMore.\n"),
            );
        }
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "two"]);

        for round in 0..5 {
            // Stamped on the watcher's own thread as each event arrives, not
            // when drained, so the spread reflects delivery during checkout.
            let arrivals: Arc<Mutex<Vec<Instant>>> = Arc::default();
            let sink = Arc::clone(&arrivals);
            let root = dir.0.clone();
            let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
                if let Ok(event) = event {
                    if !event.paths.iter().any(|path| is_ignored(&root, path)) {
                        sink.lock().unwrap().push(Instant::now());
                    }
                }
            })
            .unwrap();
            watcher.watch(&dir.0, RecursiveMode::Recursive).unwrap();
            thread::sleep(Duration::from_millis(200));

            let target = if round % 2 == 0 { "one" } else { "two" };
            let started = Instant::now();
            git(&["checkout", "-q", target]);
            let checkout_took = started.elapsed();
            thread::sleep(Duration::from_secs(2));
            drop(watcher);

            let stamps: Vec<Duration> = arrivals
                .lock()
                .unwrap()
                .iter()
                .map(|at| at.saturating_duration_since(started))
                .collect();
            let gaps: Vec<Duration> = stamps.windows(2).map(|pair| pair[1] - pair[0]).collect();
            let max_gap = gaps.iter().max().copied().unwrap_or_default();
            let first = stamps.first().copied().unwrap_or_default();
            let last = stamps.last().copied().unwrap_or_default();
            let batches_for = |window_ms: u64| {
                1 + gaps
                    .iter()
                    .filter(|gap| **gap >= Duration::from_millis(window_ms))
                    .count()
            };
            println!(
                "round {round}: checkout {checkout_took:?}; {} events from {first:?} to {last:?}; largest gap {max_gap:?}; batches at 50/100/250/500 ms windows: {}/{}/{}/{}",
                stamps.len(),
                batches_for(50),
                batches_for(100),
                batches_for(250),
                batches_for(500),
            );
        }
    }
}
