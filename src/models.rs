use serde::{Deserialize, Serialize};

// ─── Top-level data container ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    #[serde(default)]
    pub users: Vec<User>,
    #[serde(default)]
    pub notes: Vec<Note>,
    #[serde(default)]
    pub note_categories: Vec<NoteCategory>,
    #[serde(default)]
    pub software: Vec<NavItem>,
    #[serde(default)]
    pub websites: Vec<NavItem>,
}

// ─── User ────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub password: String,
    #[serde(default = "default_role")]
    pub role: String,
    #[serde(default)]
    pub created_at: String,
}

fn default_role() -> String {
    "user".into()
}

// ─── Note ────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub updated: String,
}

// ─── Note category (groups notes) ────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteCategory {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub notes: Vec<Note>,
}

// ─── Navigation item (software / website shortcut) ───────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavItem {
    pub title: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

// ─── Song ────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub title: String,
    pub filename: String,
    pub relative_path: String,
    #[serde(skip_serializing)]
    pub path: String,
    #[serde(default)]
    pub duration: u64,
}

// ─── Playlist (directory of songs) ───────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub name: String,
    #[serde(skip_serializing)]
    pub path: String,
    pub songs: Vec<Song>,
}

// ─── Client-safe user info (no password) ─────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub username: String,
    pub role: String,
}

// ─── Request bodies ──────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAppRequest {
    #[serde(default)]
    pub title: String,
    pub url: String,
}

// ─── Response helpers ────────────────────────────────────────────────────────
#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ApiResponse {
    pub fn success() -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }

    pub fn success_data(data: impl Serialize) -> Self {
        Self {
            success: true,
            data: Some(serde_json::to_value(data).unwrap_or_default()),
            error: None,
        }
    }

    pub fn success_msg(_msg: impl Into<String>) -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}

// Storage I/O lives in `crate::db` (SQLite-backed).
