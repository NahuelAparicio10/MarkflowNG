use super::chunks::Chunk;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

pub const VERSION: i32 = 1;
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn open_cache(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot create index directory")?;
    }
    let attempt = || -> rusqlite::Result<Connection> {
        let db = Connection::open(path)?;
        let integrity: String = db.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        let version: i32 = db.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if integrity != "ok" || (version != 0 && version != VERSION) {
            return Err(rusqlite::Error::InvalidQuery);
        }
        db.execute_batch("CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS chunks(file TEXT NOT NULL, metadata TEXT NOT NULL, vector TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS chunk_file ON chunks(file);")?;
        db.pragma_update(None, "user_version", VERSION)?;
        Ok(db)
    };
    match attempt() {
        Ok(db) => Ok(db),
        Err(_) => {
            if path.exists() {
                fs::remove_file(path).map_err(|_| "Cannot replace invalid index")?;
            }
            attempt().map_err(|_| "Cannot rebuild index".into())
        }
    }
}

pub fn unchanged(db: &Connection, file: &str, hash: &str) -> Result<bool, String> {
    db.query_row("SELECT hash FROM files WHERE path=?1", [file], |row| {
        row.get::<_, String>(0)
    })
    .optional()
    .map(|old| old.as_deref() == Some(hash))
    .map_err(|_| "Cannot read index".into())
}

pub fn remove(db: &mut Connection, file: &str) -> Result<(), String> {
    let tx = db.transaction().map_err(|_| "Cannot update index")?;
    // Include descendants for directory removals/renames without LIKE wildcard ambiguity.
    tx.execute(
        "DELETE FROM chunks WHERE file=?1 OR substr(file,1,length(?1)+1)=?1||'/'",
        [file],
    )
    .map_err(|_| "Cannot update index")?;
    tx.execute(
        "DELETE FROM files WHERE path=?1 OR substr(path,1,length(?1)+1)=?1||'/'",
        [file],
    )
    .map_err(|_| "Cannot update index")?;
    tx.commit().map_err(|_| "Cannot update index".into())
}

pub fn save(
    db: &mut Connection,
    file: &str,
    hash: &str,
    chunks: &[(Chunk, Vec<f32>)],
) -> Result<(), String> {
    let tx = db.transaction().map_err(|_| "Cannot update index")?;
    tx.execute("DELETE FROM chunks WHERE file=?1", [file])
        .map_err(|_| "Cannot update index")?;
    for (chunk, vector) in chunks {
        let metadata = serde_json::to_string(chunk).map_err(|_| "Cannot encode chunk")?;
        let vector = serde_json::to_string(vector).map_err(|_| "Cannot encode embedding")?;
        tx.execute(
            "INSERT INTO chunks VALUES(?1,?2,?3)",
            params![file, metadata, vector],
        )
        .map_err(|_| "Cannot update index")?;
    }
    tx.execute(
        "INSERT OR REPLACE INTO files VALUES(?1,?2)",
        params![file, hash],
    )
    .map_err(|_| "Cannot update index")?;
    tx.commit().map_err(|_| "Cannot update index".into())
}

#[derive(Clone, serde::Serialize)]
pub struct Hit {
    #[serde(flatten)]
    pub chunk: Chunk,
    pub score: f32,
}

pub fn retrieve(db: &Connection, query: &[f32]) -> Result<Vec<Hit>, String> {
    let mut statement = db
        .prepare("SELECT metadata,vector FROM chunks")
        .map_err(|_| "Cannot read index")?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|_| "Cannot read index")?;
    let mut hits = Vec::new();
    for row in rows {
        let (metadata, vector) = row.map_err(|_| "Cannot read index")?;
        let chunk: Chunk = serde_json::from_str(&metadata).map_err(|_| "Invalid index metadata")?;
        let vector: Vec<f32> =
            serde_json::from_str(&vector).map_err(|_| "Invalid index embedding")?;
        if vector.len() != query.len() || vector.iter().any(|n| !n.is_finite()) {
            return Err("Outdated embedding index".into());
        }
        let dot: f32 = query.iter().zip(&vector).map(|(a, b)| a * b).sum();
        let norm = query.iter().map(|n| n * n).sum::<f32>().sqrt()
            * vector.iter().map(|n| n * n).sum::<f32>().sqrt();
        let score = if norm > 0.0 { dot / norm } else { 0.0 };
        if score >= 0.35 {
            hits.push(Hit { chunk, score });
        }
    }
    hits.sort_by(|a, b| b.score.total_cmp(&a.score));
    hits.truncate(5);
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::tests::TempDir;

    #[test]
    fn changed_files_are_replaced_and_cache_loss_is_recoverable() {
        let dir = TempDir::new("ai-cache");
        dir.write("user-document.md", "User-owned content stays on disk.");
        let path = dir.0.join("index.sqlite");
        let mut db = open_cache(&path).unwrap();
        let chunk = Chunk {
            file: "a.md".into(),
            headings: vec!["A".into()],
            line: 1,
            text: "Hello".into(),
        };
        save(&mut db, "a.md", "first", &[(chunk, vec![1.0, 0.0])]).unwrap();
        assert!(unchanged(&db, "a.md", "first").unwrap());
        assert!(!unchanged(&db, "a.md", "second").unwrap());
        assert_eq!(retrieve(&db, &[1.0, 0.0]).unwrap().len(), 1);
        assert!(retrieve(&db, &[0.0, 1.0]).unwrap().is_empty());
        let other = Chunk {
            file: "b.md".into(),
            headings: vec![],
            line: 1,
            text: "Other".into(),
        };
        save(&mut db, "b.md", "other", &[(other, vec![0.0, 1.0])]).unwrap();
        let replacement = Chunk {
            file: "a.md".into(),
            headings: vec!["Updated".into()],
            line: 2,
            text: "Replacement".into(),
        };
        save(&mut db, "a.md", "second", &[(replacement, vec![1.0, 0.0])]).unwrap();
        assert!(
            unchanged(&db, "b.md", "other").unwrap(),
            "unmodified files retain their hash"
        );
        assert!(unchanged(&db, "a.md", "second").unwrap());
        assert_eq!(
            retrieve(&db, &[1.0, 0.0]).unwrap()[0].chunk.text,
            "Replacement"
        );
        remove(&mut db, "a.md").unwrap();
        assert_eq!(retrieve(&db, &[1.0, 0.0]).unwrap().len(), 0);
        assert_eq!(retrieve(&db, &[0.0, 1.0]).unwrap().len(), 1);
        drop(db);
        fs::write(&path, "corrupt").unwrap();
        let db = open_cache(&path).unwrap();
        assert!(retrieve(&db, &[1.0, 0.0]).unwrap().is_empty());
        drop(db);
        fs::remove_file(&path).unwrap();
        assert!(open_cache(&path).is_ok());
        assert_eq!(
            fs::read_to_string(dir.0.join("user-document.md")).unwrap(),
            "User-owned content stays on disk."
        );
    }
}
