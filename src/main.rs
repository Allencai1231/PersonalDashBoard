mod db;
mod handlers;
mod middleware;
mod models;

use axum::{
    extract::{DefaultBodyLimit, Request},
    middleware::Next,
    response::Response,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use std::time::Instant;
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};

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

    // ─── Initialize SQLite pool & migrate legacy data.json (one-shot) ─
    let pool = match db::init_pool().await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[FATAL] could not open database: {e}");
            std::process::exit(1);
        }
    };
    if let Err(e) = db::migrate_from_json_if_needed(&pool).await {
        eprintln!("[FATAL] migration from data.json failed: {e}");
        std::process::exit(1);
    }

    let state = Arc::new(AppState::new(pool));

    let app = Router::new()
        // ─── Auth routes ─────────────────────────────────────────────────
        .route("/api/login", post(handlers::auth::login))
        .route("/api/register", post(handlers::auth::register))
        .route("/api/logout", get(handlers::auth::logout))
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
        // ─── Static files — React build output ───────────────────────
        .nest_service("/assets", ServeDir::new("static/dist/assets"))
        .nest_service("/static", ServeDir::new("static"))
        // ─── SPA fallback — unmatched GET serves the SPA's index.html so
        //     React Router can handle the path on the client (e.g. /login).
        .fallback_service(
            ServeDir::new("static/dist")
                .not_found_service(ServeFile::new("static/dist/index.html")),
        )
        // ─── Middleware ──────────────────────────────────────────────────
        // Axum's default JSON/body limit is 2 MiB. Notes are saved as a single
        // dashboard JSON payload, so larger notebooks can exceed that and get
        // rejected with `413 Payload Too Large` before the handler runs.
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
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
