mod handlers;
mod middleware;
mod models;

use axum::{
    extract::Request, middleware::Next, response::Response, routing::get, routing::post, Router,
};
use std::sync::Arc;
use std::time::Instant;
use tower_http::{cors::CorsLayer, services::ServeDir};

use middleware::AppState;

/// Simple request logger middleware — prints every request to stderr
async fn request_logger(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let start = Instant::now();

    // Log the incoming request immediately (use eprintln for stderr, visible in terminals)
    eprintln!("[DEBUG] → INCOMING {} {}", method, uri);

    let response = next.run(req).await;

    let elapsed = start.elapsed();
    eprintln!(
        "[DEBUG] ← RESPONSE {} {} → {} ({:.2?})",
        method,
        uri,
        response.status(),
        elapsed
    );

    response
}

#[tokio::main]
async fn main() {
    // Initialize env_logger (can be controlled via RUST_LOG env var)
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug"))
        .try_init()
        .ok(); // ignore if already initialized

    let state = Arc::new(AppState::new());

    let app = Router::new()
        // ─── Auth routes ─────────────────────────────────────────────────
        .route("/login", post(handlers::auth::login))
        .route("/register", post(handlers::auth::register))
        .route("/logout", get(handlers::auth::logout))
        // ─── API routes ──────────────────────────────────────────────────
        .route("/api/get_data", get(handlers::data::get_data))
        .route("/api/save_data", post(handlers::data::save_data))
        .route("/api/open_app", post(handlers::data::open_app))
        .route(
            "/api/get_music_playlists",
            get(handlers::music::get_music_playlists),
        )
        .route("/api/get_user_info", get(handlers::auth::get_user_info))
        .route("/music/*path", get(handlers::music::serve_music))
        // ─── Static files — React build output ───────────────────────────
        .nest_service("/assets", ServeDir::new("static/dist/assets"))
        .nest_service("/static", ServeDir::new("static"))
        // ─── SPA fallback — unmatched GET → index.html ───────────────────
        .fallback_service(ServeDir::new("static/dist"))
        // ─── Middleware ──────────────────────────────────────────────────
        .layer(axum::middleware::from_fn(request_logger))
        .layer(CorsLayer::permissive())
        .with_state(state);

    println!(
        "\n╔══════════════════════════════════════════╗\n\
         ║  🚀 Rust Dashboard Server                  ║\n\
         ║  🌐 Local:  http://127.0.0.1:5001           ║\n\
         ║  📡 Network: http://0.0.0.0:5001            ║\n\
         ╚══════════════════════════════════════════╝\n"
    );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5001")
        .await
        .expect("Failed to bind to 0.0.0.0:5001");

    axum::serve(listener, app)
        .await
        .expect("Server encountered a fatal error");
}
