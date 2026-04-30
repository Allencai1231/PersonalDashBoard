use axum::http::HeaderMap;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::models::UserInfo;

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

// ─── Application state ───────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub sessions: SessionStore,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sessions: SessionStore::new(),
        }
    }
}

pub type SharedState = Arc<AppState>;

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
