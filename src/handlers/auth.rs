use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Form, Json,
};
use serde::Deserialize;

use crate::db;
use crate::middleware::{self, SharedState};
use crate::models::*;

// ─── Form payloads ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LoginForm {
    pub username: String,
    pub password: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn json_response(status: StatusCode, body: ApiResponse) -> Response {
    (status, Json(body)).into_response()
}

// ─── POST /login ─────────────────────────────────────────────────────────────

pub async fn login(State(state): State<SharedState>, Form(form): Form<LoginForm>) -> Response {
    let username = form.username.trim();
    let password = form.password.trim();

    if username.is_empty() || password.is_empty() {
        return json_response(
            StatusCode::BAD_REQUEST,
            ApiResponse::error("用户名和密码不能为空"),
        );
    }

    let user = match db::get_user_by_username(&state.pool, username).await {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[ERROR] login: db lookup failed: {e}");
            return json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                ApiResponse::error(format!("服务器错误: {e}")),
            );
        }
    };

    match user {
        Some(u) if u.password == password => {
            let token = state.sessions.create(&u.username, &u.role);
            let set_cookie = middleware::make_set_cookie(&token);

            let mut resp = json_response(
                StatusCode::OK,
                ApiResponse::success_data(UserInfo {
                    username: u.username.clone(),
                    role: u.role.clone(),
                }),
            );
            resp.headers_mut()
                .insert(header::SET_COOKIE, set_cookie.parse().unwrap());
            resp
        }
        _ => json_response(
            StatusCode::UNAUTHORIZED,
            ApiResponse::error("账号或密码错误"),
        ),
    }
}

// ─── POST /register ──────────────────────────────────────────────────────────

pub async fn register(State(state): State<SharedState>, Form(form): Form<LoginForm>) -> Response {
    let username = form.username.trim();
    let password = form.password.trim();

    if username.is_empty() || password.is_empty() {
        return json_response(
            StatusCode::BAD_REQUEST,
            ApiResponse::error("用户名和密码不能为空"),
        );
    }

    if username.len() < 3 || password.len() < 6 {
        return json_response(
            StatusCode::BAD_REQUEST,
            ApiResponse::error("用户名至少3位，密码至少6位"),
        );
    }

    match db::add_user(&state.pool, username, password, "user").await {
        Ok(true) => json_response(StatusCode::OK, ApiResponse::success_msg("注册成功，请登录")),
        Ok(false) => json_response(StatusCode::CONFLICT, ApiResponse::error("用户名已存在")),
        Err(e) => {
            eprintln!("[ERROR] register: {e}");
            json_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                ApiResponse::error(format!("服务器错误: {e}")),
            )
        }
    }
}

// ─── GET /logout ─────────────────────────────────────────────────────────────

pub async fn logout(State(state): State<SharedState>, headers: HeaderMap) -> Response {
    if let Some(token) = middleware::extract_token(&headers) {
        state.sessions.remove(&token);
    }

    let mut resp = json_response(StatusCode::OK, ApiResponse::success());
    resp.headers_mut().insert(
        header::SET_COOKIE,
        middleware::make_clear_cookie().parse().unwrap(),
    );
    resp
}

// ─── GET /api/get_user_info ──────────────────────────────────────────────────

pub async fn get_user_info(State(state): State<SharedState>, headers: HeaderMap) -> Response {
    match middleware::get_user_info(&headers, &state) {
        Some(info) => json_response(StatusCode::OK, ApiResponse::success_data(info)),
        None => json_response(
            StatusCode::OK,
            ApiResponse {
                success: true,
                data: None,
                error: None,
            },
        ),
    }
}
