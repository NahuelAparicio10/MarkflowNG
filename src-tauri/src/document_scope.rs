//! File-system scope for a document opened on its own, outside any workspace.
//!
//! The file dialog grants the fs plugin access to the one file chosen. A
//! document's images, though, sit beside it — `diagram.png`, `assets/…` — and
//! pasted images are written into `assets/` next to it (design decisions D5
//! and D6 of the tables-and-images change). Without access to the document's
//! directory, every such image would show as missing and every paste would
//! fail. A workspace needs none of this: its folder dialog already grants the
//! whole tree.

use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

/// Extends the fs scope to the directory containing `path`, recursively.
///
/// Only for a document the user has already been granted: a path outside the
/// current scope is refused, so this can never be used to reach a directory
/// the user did not open something from.
#[tauri::command]
pub fn allow_document_directory(app: AppHandle, path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let scope = app.fs_scope();

    if !scope.is_allowed(&path) {
        return Err(format!("{} is not an opened document", path.display()));
    }

    let directory = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;

    scope
        .allow_directory(directory, true)
        .map_err(|error| error.to_string())
}
