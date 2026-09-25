pub mod chunks;
pub mod database;
pub mod embedding;

use crate::{watcher::WatchChange, workspace};
use database::Hit;
use fastembed::TextEmbedding;
use rusqlite::Connection;
use serde::Serialize;
use std::{
    collections::{HashSet, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::mpsc,
    thread,
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub root: String,
    pub completed: usize,
    pub total: usize,
    pub paused: bool,
    pub ready: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct Retrieval {
    pub hits: Vec<Hit>,
    pub incomplete: bool,
}

enum Command {
    Start {
        root: PathBuf,
        cache: PathBuf,
        model: PathBuf,
        progress: Channel<Progress>,
    },
    Changes(String, Vec<WatchChange>),
    Pause(String, bool),
    Stop(String),
    Query(String, String, mpsc::Sender<Result<Retrieval, String>>),
}

pub struct IndexState {
    sender: mpsc::Sender<Command>,
}

impl Default for IndexState {
    fn default() -> Self {
        let (sender, receiver) = mpsc::channel();
        thread::Builder::new()
            .name("markflow-index".into())
            .spawn(move || worker(receiver))
            .expect("could not start index worker");
        Self { sender }
    }
}

impl IndexState {
    pub fn changed(&self, root: &str, changes: Vec<WatchChange>) {
        let _ = self.sender.send(Command::Changes(root.into(), changes));
    }
    pub fn stop(&self, root: &str) {
        let _ = self.sender.send(Command::Stop(root.into()));
    }
}

struct Index {
    root: PathBuf,
    cache: PathBuf,
    db: Connection,
    model: TextEmbedding,
    queue: VecDeque<String>,
    queued: HashSet<String>,
    progress: Progress,
    sink: Channel<Progress>,
}

impl Index {
    fn enqueue(&mut self, file: String) {
        if self.queued.insert(file.clone()) {
            self.queue.push_back(file);
            self.progress.total += 1;
            self.progress.ready = false;
        }
    }

    fn scan(&mut self) -> Result<(), String> {
        let root = self.root.clone();
        let summary = workspace::walk(
            &root,
            &root,
            || false,
            |entries| {
                for entry in entries {
                    if entry.markdown {
                        self.enqueue(entry.path);
                    }
                }
            },
        )
        .map_err(|_| "Could not scan documents for indexing")?;
        if !summary.failures.is_empty() {
            self.progress.error = Some("Some workspace files could not be read.".into());
        }
        let files: Vec<String> = self
            .db
            .prepare("SELECT path FROM files")
            .map_err(|_| "Cannot read index")?
            .query_map([], |row| row.get(0))
            .map_err(|_| "Cannot read index")?
            .collect::<Result<_, _>>()
            .map_err(|_| "Cannot read index")?;
        for file in files {
            if !self.root.join(&file).is_file() {
                database::remove(&mut self.db, &file)?;
            }
        }
        self.progress.ready = self.queue.is_empty();
        Ok(())
    }

    fn emit(&self) {
        let _ = self.sink.send(self.progress.clone());
    }

    fn rebuild(&mut self) -> Result<(), String> {
        // Drop all index-only state; no document is ever written by this module.
        let replacement = Connection::open_in_memory().map_err(|_| "Cannot rebuild index")?;
        drop(std::mem::replace(&mut self.db, replacement));
        if self.cache.exists() {
            fs::remove_file(&self.cache).map_err(|_| "Cannot discard index")?;
        }
        self.db = database::open_cache(&self.cache)?;
        self.queue.clear();
        self.queued.clear();
        self.progress.completed = 0;
        self.progress.total = 0;
        self.scan()
    }

    fn step(&mut self) -> Result<(), String> {
        if !self.cache.exists() {
            self.rebuild()?;
        }
        let Some(file) = self.queue.pop_front() else {
            return Ok(());
        };
        self.queued.remove(&file);
        let path = self.root.join(&file);
        if path.is_file() {
            let canonical = path
                .canonicalize()
                .map_err(|_| "Cannot resolve indexed file")?;
            let root = self
                .root
                .canonicalize()
                .map_err(|_| "Cannot resolve workspace")?;
            if !canonical.starts_with(root) {
                return Err("File moved outside the workspace.".into());
            }
            let source = fs::read_to_string(path).map_err(|_| "Cannot read indexed document")?;
            let hash = database::digest(source.as_bytes());
            if !database::unchanged(&self.db, &file, &hash)? {
                let chunks = chunks::chunk_document(&file, &source, chunks::CHUNK_WORDS)?;
                let mut vectors = Vec::new();
                for chunk in chunks {
                    let vector = embedding::embed(
                        &mut self.model,
                        &format!("{}\n{}", chunk.headings.join(" / "), chunk.text),
                    )?;
                    vectors.push((chunk, vector));
                }
                database::save(&mut self.db, &file, &hash, &vectors)?;
            }
        } else {
            database::remove(&mut self.db, &file)?;
        }
        self.progress.completed += 1;
        self.progress.ready = self.queue.is_empty();
        self.emit();
        Ok(())
    }

    fn changes(&mut self, changes: Vec<WatchChange>) -> Result<(), String> {
        for change in changes {
            match change {
                WatchChange::Created { entry } | WatchChange::Modified { entry } => {
                    if entry.markdown {
                        self.enqueue(entry.path);
                    }
                }
                WatchChange::Removed { path } => database::remove(&mut self.db, &path)?,
                WatchChange::Renamed { from, entry } => {
                    database::remove(&mut self.db, &from)?;
                    if entry.markdown {
                        self.enqueue(entry.path);
                    }
                }
            }
        }
        self.emit();
        Ok(())
    }

    fn query(&mut self, text: &str) -> Result<Retrieval, String> {
        if !self.cache.exists() {
            self.rebuild()?;
        }
        let query = embedding::embed(&mut self.model, text)?;
        let hits = match database::retrieve(&self.db, &query) {
            Ok(hits) => hits,
            Err(_) => {
                self.rebuild()?;
                self.emit();
                Vec::new()
            }
        };
        Ok(Retrieval {
            hits,
            incomplete: !self.progress.ready || self.progress.error.is_some(),
        })
    }
}

fn worker(receiver: mpsc::Receiver<Command>) {
    let low_priority =
        thread_priority::set_current_thread_priority(thread_priority::ThreadPriority::Min).is_ok();
    let mut index: Option<Index> = None;
    loop {
        let working = index
            .as_ref()
            .is_some_and(|i| !i.progress.paused && !i.queue.is_empty());
        match receiver.recv_timeout(if working {
            Duration::from_millis(5)
        } else {
            Duration::from_secs(1)
        }) {
            Ok(Command::Start {
                root,
                cache,
                model,
                progress,
            }) => {
                let status = Progress {
                    root: root.to_string_lossy().into_owned(),
                    ..Default::default()
                };
                let _ = progress.send(status.clone());
                let opened = (|| {
                    if !low_priority {
                        return Err("Could not lower indexing thread priority.".to_string());
                    }
                    let mut current = Index {
                        root,
                        cache: cache.clone(),
                        db: database::open_cache(&cache)?,
                        model: embedding::load_model(&model)?,
                        queue: VecDeque::new(),
                        queued: HashSet::new(),
                        progress: status.clone(),
                        sink: progress.clone(),
                    };
                    current.scan()?;
                    current.emit();
                    Ok(current)
                })();
                match opened {
                    Ok(current) => index = Some(current),
                    Err(error) => {
                        index = None;
                        let _ = progress.send(Progress {
                            error: Some(error),
                            ..status
                        });
                    }
                }
            }
            Ok(Command::Stop(root)) => {
                if index.as_ref().is_some_and(|i| i.progress.root == root) {
                    index = None;
                }
            }
            Ok(Command::Pause(root, paused)) => {
                if let Some(index) = index.as_mut().filter(|i| i.progress.root == root) {
                    index.progress.paused = paused;
                    index.emit();
                }
            }
            Ok(Command::Changes(root, changes)) => {
                if let Some(index) = index.as_mut().filter(|i| i.progress.root == root) {
                    if let Err(error) = index.changes(changes) {
                        index.progress.error = Some(error);
                        index.emit();
                    }
                }
            }
            Ok(Command::Query(root, text, reply)) => {
                let result = index
                    .as_mut()
                    .filter(|i| i.progress.root == root)
                    .ok_or_else(|| "The workspace index is not available yet.".to_string())
                    .and_then(|i| i.query(&text));
                let _ = reply.send(result);
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if let Some(index) = index.as_mut().filter(|i| !i.progress.paused) {
                    if let Err(error) = index.step() {
                        index.progress.error = Some(error);
                        if index.rebuild().is_ok() {
                            index.progress.error = None;
                        }
                        index.emit();
                    }
                }
            }
        }
    }
}

fn paths(app: &AppHandle, root: &str) -> Result<(PathBuf, PathBuf), String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot locate application data")?;
    Ok((
        data.join("indexes")
            .join(format!("{}.sqlite", database::digest(root.as_bytes()))),
        data.join("models").join(embedding::MODEL_REVISION),
    ))
}

#[tauri::command]
pub fn start_index(
    app: AppHandle,
    state: State<'_, IndexState>,
    root: String,
    progress: Channel<Progress>,
) -> Result<(), String> {
    workspace::ensure_root_allowed(&app, Path::new(&root))?;
    let (cache, model) = paths(&app, &root)?;
    state
        .sender
        .send(Command::Start {
            root: PathBuf::from(root),
            cache,
            model,
            progress,
        })
        .map_err(|_| "Index worker unavailable".into())
}

#[tauri::command]
pub async fn install_embedding_model(app: AppHandle, root: String) -> Result<(), String> {
    workspace::ensure_root_allowed(&app, Path::new(&root))?;
    let (_, path) = paths(&app, &root)?;
    embedding::download_model(&path).await
}

#[tauri::command]
pub fn pause_index(state: State<'_, IndexState>, root: String, paused: bool) -> Result<(), String> {
    state
        .sender
        .send(Command::Pause(root, paused))
        .map_err(|_| "Index worker unavailable".into())
}

#[tauri::command]
pub fn stop_index(state: State<'_, IndexState>, root: String) {
    state.stop(&root);
}

#[tauri::command]
pub async fn retrieve_workspace(
    state: State<'_, IndexState>,
    root: String,
    question: String,
) -> Result<Retrieval, String> {
    let (reply, receiver) = mpsc::channel();
    state
        .sender
        .send(Command::Query(root, question, reply))
        .map_err(|_| "Index worker unavailable")?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv()
            .map_err(|_| "Index worker unavailable".to_string())
    })
    .await
    .map_err(|_| "Index worker unavailable")??
}
