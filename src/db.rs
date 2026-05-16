// SQLite-backed storage for dashboard data.
//
// Replaces the previous `data.json` whole-file read/write pattern.
// The file `data.db` lives in the project root (next to where `data.json`
// used to live). On first run, any existing `data.json` is imported into the
// database and renamed to `data.json.migrated-<timestamp>.bak`.

use std::path::Path;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Row, SqlitePool};

use crate::models::{DashboardData, NavItem, Note, NoteCategory, User};

const DB_FILE: &str = "data.db";
const DB_URL: &str = "sqlite://data.db";
const LEGACY_JSON: &str = "data.json";

// ─── Pool / schema bootstrap ────────────────────────────────────────────────

pub async fn init_pool() -> Result<SqlitePool, sqlx::Error> {
    let opts = SqliteConnectOptions::from_str(DB_URL)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    init_schema(&pool).await?;
    Ok(pool)
}

async fn init_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            username   TEXT PRIMARY KEY,
            password   TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS note_categories (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS notes (
            id          TEXT PRIMARY KEY,
            category_id TEXT,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            updated     TEXT NOT NULL,
            sort        INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(category_id) REFERENCES note_categories(id) ON DELETE CASCADE
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS nav_items (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            kind  TEXT NOT NULL,
            title TEXT NOT NULL,
            url   TEXT NOT NULL,
            icon  TEXT,
            sort  INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_nav_kind ON nav_items(kind);")
        .execute(pool)
        .await?;

    Ok(())
}

// ─── One-shot migration from data.json ──────────────────────────────────────

/// If `data.json` exists AND the database is empty, import all rows in one
/// transaction, then rename `data.json` to a timestamped backup so we never
/// migrate twice.
pub async fn migrate_from_json_if_needed(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    if !Path::new(LEGACY_JSON).exists() {
        return Ok(());
    }

    if !is_db_empty(pool).await? {
        eprintln!("[db] {LEGACY_JSON} exists but database is not empty. Skipping migration.");
        return Ok(());
    }

    let raw = match std::fs::read_to_string(LEGACY_JSON) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[db] cannot read {LEGACY_JSON}: {e}. Skipping migration.");
            return Ok(());
        }
    };

    let data: DashboardData = match serde_json::from_str(&raw) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[db] cannot parse {LEGACY_JSON}: {e}. Skipping migration.");
            return Ok(());
        }
    };

    eprintln!(
        "[db] migrating data.json → SQLite ({} users, {} top-notes, {} categories, {} software, {} websites)",
        data.users.len(),
        data.notes.len(),
        data.note_categories.len(),
        data.software.len(),
        data.websites.len(),
    );

    let mut tx = pool.begin().await?;

    // users
    for u in &data.users {
        sqlx::query("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)")
            .bind(&u.username)
            .bind(&u.password)
            .bind(&u.role)
            .bind(&u.created_at)
            .execute(&mut *tx)
            .await?;
    }

    // top-level notes (category_id = NULL)
    for (idx, n) in data.notes.iter().enumerate() {
        sqlx::query(
            "INSERT INTO notes (id, category_id, title, content, updated, sort) VALUES (?, NULL, ?, ?, ?, ?)",
        )
        .bind(&n.id)
        .bind(&n.title)
        .bind(&n.content)
        .bind(&n.updated)
        .bind(idx as i64)
        .execute(&mut *tx)
        .await?;
    }

    // categories + their nested notes
    for (cat_idx, cat) in data.note_categories.iter().enumerate() {
        sqlx::query("INSERT INTO note_categories (id, name, sort) VALUES (?, ?, ?)")
            .bind(&cat.id)
            .bind(&cat.name)
            .bind(cat_idx as i64)
            .execute(&mut *tx)
            .await?;

        for (n_idx, n) in cat.notes.iter().enumerate() {
            sqlx::query(
                "INSERT INTO notes (id, category_id, title, content, updated, sort) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&n.id)
            .bind(&cat.id)
            .bind(&n.title)
            .bind(&n.content)
            .bind(&n.updated)
            .bind(n_idx as i64)
            .execute(&mut *tx)
            .await?;
        }
    }

    // nav_items: software + websites
    for (idx, s) in data.software.iter().enumerate() {
        sqlx::query(
            "INSERT INTO nav_items (kind, title, url, icon, sort) VALUES ('software', ?, ?, ?, ?)",
        )
        .bind(&s.title)
        .bind(&s.url)
        .bind(&s.icon)
        .bind(idx as i64)
        .execute(&mut *tx)
        .await?;
    }
    for (idx, w) in data.websites.iter().enumerate() {
        sqlx::query(
            "INSERT INTO nav_items (kind, title, url, icon, sort) VALUES ('website', ?, ?, ?, ?)",
        )
        .bind(&w.title)
        .bind(&w.url)
        .bind(&w.icon)
        .bind(idx as i64)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Rename data.json so we never migrate it twice (and keep a backup).
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = format!("{LEGACY_JSON}.migrated-{ts}.bak");
    match std::fs::rename(LEGACY_JSON, &backup) {
        Ok(()) => eprintln!("[db] migration done. Backed up legacy file → {backup}"),
        Err(e) => eprintln!(
            "[db] migration done but could not rename {LEGACY_JSON}: {e}. Please move it manually."
        ),
    }

    Ok(())
}

async fn is_db_empty(pool: &SqlitePool) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM users)            AS u,
            (SELECT COUNT(*) FROM notes)            AS n,
            (SELECT COUNT(*) FROM note_categories)  AS c,
            (SELECT COUNT(*) FROM nav_items)        AS v
        "#,
    )
    .fetch_one(pool)
    .await?;

    let u: i64 = row.try_get("u")?;
    let n: i64 = row.try_get("n")?;
    let c: i64 = row.try_get("c")?;
    let v: i64 = row.try_get("v")?;
    Ok(u + n + c + v == 0)
}

// ─── Read paths ─────────────────────────────────────────────────────────────

pub async fn load_dashboard(pool: &SqlitePool) -> Result<DashboardData, sqlx::Error> {
    // users
    let users: Vec<User> = sqlx::query(
        "SELECT username, password, role, created_at FROM users ORDER BY created_at ASC, username ASC",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| User {
        username:   r.get::<String, _>("username"),
        password:   r.get::<String, _>("password"),
        role:       r.get::<String, _>("role"),
        created_at: r.get::<String, _>("created_at"),
    })
    .collect();

    // top-level notes
    let top_notes: Vec<Note> = sqlx::query(
        "SELECT id, title, content, updated FROM notes WHERE category_id IS NULL ORDER BY sort ASC, id ASC",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| Note {
        id:      r.get::<String, _>("id"),
        title:   r.get::<String, _>("title"),
        content: r.get::<String, _>("content"),
        updated: r.get::<String, _>("updated"),
    })
    .collect();

    // categories
    let cat_rows = sqlx::query("SELECT id, name FROM note_categories ORDER BY sort ASC, id ASC")
        .fetch_all(pool)
        .await?;

    let mut categories: Vec<NoteCategory> = Vec::with_capacity(cat_rows.len());
    for r in cat_rows {
        let cid: String = r.get("id");
        let name: String = r.get("name");

        let notes: Vec<Note> = sqlx::query(
            "SELECT id, title, content, updated FROM notes WHERE category_id = ? ORDER BY sort ASC, id ASC",
        )
        .bind(&cid)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|r| Note {
            id:      r.get::<String, _>("id"),
            title:   r.get::<String, _>("title"),
            content: r.get::<String, _>("content"),
            updated: r.get::<String, _>("updated"),
        })
        .collect();

        categories.push(NoteCategory {
            id: cid,
            name,
            notes,
        });
    }

    // nav items
    let software: Vec<NavItem> = sqlx::query(
        "SELECT title, url, icon FROM nav_items WHERE kind = 'software' ORDER BY sort ASC, id ASC",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| NavItem {
        title: r.get::<String, _>("title"),
        url: r.get::<String, _>("url"),
        icon: r.get::<Option<String>, _>("icon"),
    })
    .collect();

    let websites: Vec<NavItem> = sqlx::query(
        "SELECT title, url, icon FROM nav_items WHERE kind = 'website' ORDER BY sort ASC, id ASC",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| NavItem {
        title: r.get::<String, _>("title"),
        url: r.get::<String, _>("url"),
        icon: r.get::<Option<String>, _>("icon"),
    })
    .collect();

    Ok(DashboardData {
        users,
        notes: top_notes,
        note_categories: categories,
        software,
        websites,
    })
}

// ─── Write paths ────────────────────────────────────────────────────────────
//
// The `save_data` HTTP handler historically does a "replace whole section"
// for whichever top-level keys are present in the request. We mirror that
// semantically inside one SQL transaction per call. Users are never touched
// here (auth handles them via add_user / update_user).

pub struct SavePayload<'a> {
    pub notes: Option<&'a [Note]>,
    pub note_categories: Option<&'a [NoteCategory]>,
    pub software: Option<&'a [NavItem]>,
    pub websites: Option<&'a [NavItem]>,
}

pub async fn save_dashboard(
    pool: &SqlitePool,
    payload: SavePayload<'_>,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    if let Some(cats) = payload.note_categories {
        // Replacing categories also replaces every note inside them.
        // Top-level notes (category_id IS NULL) are intentionally left alone here.
        sqlx::query("DELETE FROM notes WHERE category_id IS NOT NULL")
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM note_categories")
            .execute(&mut *tx)
            .await?;

        for (cat_idx, cat) in cats.iter().enumerate() {
            sqlx::query("INSERT INTO note_categories (id, name, sort) VALUES (?, ?, ?)")
                .bind(&cat.id)
                .bind(&cat.name)
                .bind(cat_idx as i64)
                .execute(&mut *tx)
                .await?;

            for (n_idx, n) in cat.notes.iter().enumerate() {
                sqlx::query(
                    "INSERT INTO notes (id, category_id, title, content, updated, sort) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(&n.id)
                .bind(&cat.id)
                .bind(&n.title)
                .bind(&n.content)
                .bind(&n.updated)
                .bind(n_idx as i64)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    if let Some(notes) = payload.notes {
        sqlx::query("DELETE FROM notes WHERE category_id IS NULL")
            .execute(&mut *tx)
            .await?;
        for (idx, n) in notes.iter().enumerate() {
            sqlx::query(
                "INSERT INTO notes (id, category_id, title, content, updated, sort) VALUES (?, NULL, ?, ?, ?, ?)",
            )
            .bind(&n.id)
            .bind(&n.title)
            .bind(&n.content)
            .bind(&n.updated)
            .bind(idx as i64)
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(items) = payload.software {
        sqlx::query("DELETE FROM nav_items WHERE kind = 'software'")
            .execute(&mut *tx)
            .await?;
        for (idx, it) in items.iter().enumerate() {
            sqlx::query(
                "INSERT INTO nav_items (kind, title, url, icon, sort) VALUES ('software', ?, ?, ?, ?)",
            )
            .bind(&it.title)
            .bind(&it.url)
            .bind(&it.icon)
            .bind(idx as i64)
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(items) = payload.websites {
        sqlx::query("DELETE FROM nav_items WHERE kind = 'website'")
            .execute(&mut *tx)
            .await?;
        for (idx, it) in items.iter().enumerate() {
            sqlx::query(
                "INSERT INTO nav_items (kind, title, url, icon, sort) VALUES ('website', ?, ?, ?, ?)",
            )
            .bind(&it.title)
            .bind(&it.url)
            .bind(&it.icon)
            .bind(idx as i64)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await
}

// ─── User helpers ───────────────────────────────────────────────────────────

pub async fn get_user_by_username(
    pool: &SqlitePool,
    username: &str,
) -> Result<Option<User>, sqlx::Error> {
    let row =
        sqlx::query("SELECT username, password, role, created_at FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(pool)
            .await?;

    Ok(row.map(|r| User {
        username: r.get::<String, _>("username"),
        password: r.get::<String, _>("password"),
        role: r.get::<String, _>("role"),
        created_at: r.get::<String, _>("created_at"),
    }))
}

/// Inserts a new user. Returns Ok(false) if the username already exists.
pub async fn add_user(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    role: &str,
) -> Result<bool, sqlx::Error> {
    if get_user_by_username(pool, username).await?.is_some() {
        return Ok(false);
    }
    let created_at = chrono::Local::now().format("%Y-%m-%d").to_string();
    sqlx::query("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)")
        .bind(username)
        .bind(password)
        .bind(role)
        .bind(&created_at)
        .execute(pool)
        .await?;
    Ok(true)
}

// Helper used during local dev / tests only.
#[allow(dead_code)]
pub fn db_path() -> &'static str {
    DB_FILE
}
