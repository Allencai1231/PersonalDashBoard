use axum::http::HeaderMap;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{DashboardData, Playlist, UserInfo};

// ─── Session data ────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct SessionData {
    pub username: String,
    pub role: String,
    pub logged_in: bool,
}

// ─── Session store ───────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct SessionStore {
    inner: Arc<RwLock<HashMap<String, SessionData>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn create(&self, username: &str, role: &str) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        self.inner.write().unwrap().insert(
            token.clone(),
            SessionData {
                username: username.to_string(),
                role: role.to_string(),
                logged_in: true,
            },
        );
        token
    }

    pub fn get(&self, token: &str) -> Option<SessionData> {
        self.inner.read().unwrap().get(token).cloned()
    }

    pub fn remove(&self, token: &str) {
        self.inner.write().unwrap().remove(token);
    }
}

// ─── Music cache ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct MusicCache {
    pub playlists: Vec<Playlist>,
    pub last_updated: u64,
}

// Cache expires after 5 minutes (300 seconds)
const CACHE_DURATION: u64 = 300;

#[derive(Clone)]
pub struct MusicCacheStore {
    inner: Arc<RwLock<Option<MusicCache>>>,
}

impl MusicCacheStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(None)),
        }
    }

    pub fn get(&self) -> Option<Vec<Playlist>> {
        let cache = self.inner.read().unwrap();
        match cache.as_ref() {
            Some(c) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                if now - c.last_updated < CACHE_DURATION {
                    Some(c.playlists.clone())
                } else {
                    None
                }
            }
            None => None,
        }
    }

    pub fn set(&self, playlists: Vec<Playlist>) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cache = MusicCache {
            playlists,
            last_updated: now,
        };
        *self.inner.write().unwrap() = Some(cache);
    }

    pub fn invalidate(&self) {
        *self.inner.write().unwrap() = None;
    }
}

// ─── Dashboard data cache ────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DataCache {
    pub data: DashboardData,
    pub last_updated: u64,
}

// Cache expires after 30 seconds to avoid too many file reads but not too stale
const DATA_CACHE_DURATION: u64 = 30;

#[derive(Clone)]
pub struct DataCacheStore {
    inner: Arc<RwLock<Option<DataCache>>>,
}

impl DataCacheStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(None)),
        }
    }

    pub fn get(&self) -> Option<DashboardData> {
        let cache = self.inner.read().unwrap();
        match cache.as_ref() {
            Some(c) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                if now - c.last_updated < DATA_CACHE_DURATION {
                    Some(c.data.clone())
                } else {
                    None
                }
            }
            None => None,
        }
    }

    pub fn set(&self, data: DashboardData) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cache = DataCache {
            data,
            last_updated: now,
        };
        *self.inner.write().unwrap() = Some(cache);
    }

    pub fn invalidate(&self) {
        *self.inner.write().unwrap() = None;
    }
}

// ─── Application state ───────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub sessions: SessionStore,
    pub music_cache: MusicCacheStore,
    pub data_cache: DataCacheStore,
    pub pool: SqlitePool,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            sessions: SessionStore::new(),
            music_cache: MusicCacheStore::new(),
            data_cache: DataCacheStore::new(),
            pool,
        }
    }
}

pub type SharedState = Arc<AppState>;

// ─── Session store ─────────────────────────────────────────────────────────────

// ─── Cookie helpers ──────────────────────────────────────────────────────────

pub const SESSION_COOKIE: &str = "session_id";

pub fn make_set_cookie(token: &str) -> String {
    format!("{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
}

pub fn make_clear_cookie() -> String {
    format!("{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
}

// ─── Session extraction helpers ──────────────────────────────────────────────

/// Extract the session token from the Cookie header.
pub fn extract_token(headers: &HeaderMap) -> Option<String> {
    let cookies = headers.get("cookie")?.to_str().ok()?;
    for part in cookies.split(';') {
        let trimmed = part.trim();
        if let Some((key, value)) = trimmed.split_once('=') {
            if key.trim() == SESSION_COOKIE {
                return Some(value.trim().to_string());
            }
        }
    }
    None
}

/// Get session data from the request headers, if authenticated.
pub fn get_session(headers: &HeaderMap, state: &SharedState) -> Option<SessionData> {
    let token = extract_token(headers)?;
    let data = state.sessions.get(&token)?;
    if data.logged_in {
        Some(data)
    } else {
        None
    }
}

/// Extract user info from headers. Returns Some if authenticated, None otherwise.
pub fn get_user_info(headers: &HeaderMap, state: &SharedState) -> Option<UserInfo> {
    get_session(headers, state).map(|s| UserInfo {
        username: s.username,
        role: s.role,
    })
}

/// Extract admin user info. Returns Some only if authenticated AND admin role.
pub fn get_admin_info(headers: &HeaderMap, state: &SharedState) -> Option<UserInfo> {
    get_user_info(headers, state).filter(|u| u.role == "admin")
}
