use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};

use crate::middleware::{self, SharedState};
use crate::models::{ApiResponse, OpenAppRequest};

// GET /api/get_data
pub async fn get_data(State(state): State<SharedState>) -> impl IntoResponse {
    eprintln!("[DEBUG] get_data handler called");

    // Try to get cached dashboard data
    if let Some(cached) = state.data_cache.get() {
        eprintln!("[DEBUG] get_data: cache HIT - returning cached data");
        let response = Json(ApiResponse::success_data(cached));
        return response.into_response();
    }

    eprintln!("[DEBUG] get_data: cache MISS - loading data.json from disk");
    let mut data = crate::models::load_data();
    eprintln!(
        "[DEBUG] get_data loaded: {} notes, {} software, {} websites",
        data.notes.len(),
        data.software.len(),
        data.websites.len()
    );

    // Clear sensitive user data before sending to client
    data.users.clear();

    // Store in cache
    state.data_cache.set(data.clone());

    let response = Json(ApiResponse::success_data(data));
    eprintln!("[DEBUG] get_data handler - returning response");
    response.into_response()
}

// POST /api/save_data
pub async fn save_data(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let user_info = middleware::get_user_info(&headers, &state);
    match user_info {
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResponse::error("请先登录")),
            )
                .into_response();
        }
        Some(ref u) if u.role != "admin" => {
            return (StatusCode::FORBIDDEN, Json(ApiResponse::error("权限不足"))).into_response();
        }
        _ => {}
    }

    let mut current = crate::models::load_data();
    let users = std::mem::take(&mut current.users);

    if let Some(obj) = body.as_object() {
        if let Some(val) = obj.get("notes") {
            if let Ok(v) = serde_json::from_value(val.clone()) {
                current.notes = v;
            }
        }
        if let Some(val) = obj.get("note_categories") {
            if let Ok(v) = serde_json::from_value(val.clone()) {
                current.note_categories = v;
            }
        }
        if let Some(val) = obj.get("software") {
            if let Ok(v) = serde_json::from_value(val.clone()) {
                current.software = v;
            }
        }
        if let Some(val) = obj.get("websites") {
            if let Ok(v) = serde_json::from_value(val.clone()) {
                current.websites = v;
            }
        }
    }

    current.users = users;

    match crate::models::save_data(&current) {
        Ok(()) => {
            eprintln!("[DEBUG] save_data: data saved successfully, invalidating cache");
            // Invalidate cache so next request reloads from disk
            state.data_cache.invalidate();
            (StatusCode::OK, Json(ApiResponse::success())).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(format!("保存失败: {e}"))),
        )
            .into_response(),
    }
}

// POST /api/open_app
pub async fn open_app(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(body): Json<OpenAppRequest>,
) -> impl IntoResponse {
    let user_info = middleware::get_user_info(&headers, &state);
    match user_info {
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResponse::error("请先登录")),
            )
                .into_response();
        }
        Some(ref u) if u.role != "admin" => {
            return (StatusCode::FORBIDDEN, Json(ApiResponse::error("权限不足"))).into_response();
        }
        _ => {}
    }

    if body.url.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("路径为空")),
        )
            .into_response();
    }

    let path = std::path::Path::new(body.url.trim());
    let absolute = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::error("路径不存在")),
            )
                .into_response();
        }
    };

    match launch_file(&absolute) {
        Ok(()) => (StatusCode::OK, Json(ApiResponse::success())).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(format!("启动失败: {e}"))),
        )
            .into_response(),
    }
}

#[cfg(target_os = "windows")]
fn launch_file(path: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/c", "start", "", &path.to_string_lossy()])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
fn launch_file(path: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path.to_string_lossy().as_ref())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
