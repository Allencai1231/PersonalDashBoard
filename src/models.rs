use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::Path;

const DATA_FILE: &str = "data.json";

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

// ─── Data loading / saving ───────────────────────────────────────────────────
pub fn load_data() -> DashboardData {
    if !Path::new(DATA_FILE).exists() {
        let default = DashboardData {
            users: vec![],
            notes: vec![],
            note_categories: vec![],
            software: vec![],
            websites: vec![],
        };
        if let Err(e) = save_data(&default) {
            eprintln!("Warning: could not create default data.json: {e}");
        }
        return default;
    }

    match fs::read_to_string(DATA_FILE) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(data) => data,
            Err(e) => {
                eprintln!("Warning: corrupt data.json ({e}), using defaults");
                DashboardData {
                    users: vec![],
                    notes: vec![],
                    note_categories: vec![],
                    software: vec![],
                    websites: vec![],
                }
            }
        },
        Err(e) => {
            eprintln!("Warning: cannot read data.json ({e}), using defaults");
            DashboardData {
                users: vec![],
                notes: vec![],
                note_categories: vec![],
                software: vec![],
                websites: vec![],
            }
        }
    }
}

pub fn save_data(data: &DashboardData) -> io::Result<()> {
    let json = serde_json::to_string_pretty(data)?;
    fs::write(DATA_FILE, json)?;
    Ok(())
}

// ─── User helpers ────────────────────────────────────────────────────────────
pub fn get_user_by_username(users: &[User], username: &str) -> Option<User> {
    users.iter().find(|u| u.username == username).cloned()
}

pub fn add_user(data: &mut DashboardData, username: &str, password: &str, role: &str) -> bool {
    if data.users.iter().any(|u| u.username == username) {
        return false;
    }
    data.users.push(User {
        username: username.into(),
        password: password.into(),
        role: role.into(),
        created_at: chrono::Local::now().format("%Y-%m-%d").to_string(),
    });
    true
}
