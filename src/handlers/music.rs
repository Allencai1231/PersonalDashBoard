use axum::{
    extract::Path,
    http::{Request, StatusCode},
    response::IntoResponse,
    Json,
};
use tower::ServiceExt;
use tower_http::services::ServeFile;

use crate::models::{ApiResponse, Playlist, Song};

const MUSIC_DIR: &str = "./Music";
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "flac", "m4a", "ogg", "aac", "wma"];

/// GET /api/get_music_playlists — scans ./Music for playlists (subdirs) and songs.
/// Uses tokio::fs for async I/O to avoid blocking the thread pool.
pub async fn get_music_playlists() -> Json<ApiResponse> {
    eprintln!("[DEBUG] get_music_playlists: starting scan...");
    let mut playlists: Vec<Playlist> = Vec::new();

    let music_dir = match tokio::task::block_in_place(|| std::fs::canonicalize(MUSIC_DIR)) {
        Ok(d) => d,
        Err(_) => {
            let _ = std::fs::create_dir_all(MUSIC_DIR);
            return Json(ApiResponse::success_data(playlists));
        }
    };

    let mut entries = match tokio::fs::read_dir(&music_dir).await {
        Ok(e) => e,
        Err(_) => return Json(ApiResponse::success_data(playlists)),
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let mut songs: Vec<Song> = Vec::new();

        if let Ok(mut dir_files) = tokio::fs::read_dir(&path).await {
            while let Ok(Some(f)) = dir_files.next_entry().await {
                let fp = f.path();
                if !fp.is_file() {
                    continue;
                }
                let filename = f.file_name().to_string_lossy().to_string();
                let ext = fp
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if !AUDIO_EXTS.contains(&ext.as_str()) {
                    continue;
                }
                let title = fp
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| filename.clone());

                songs.push(Song {
                    title,
                    filename: filename.clone(),
                    relative_path: format!("{}/{}", name, filename),
                    path: fp.to_string_lossy().to_string(),
                    duration: 0,
                });
            }
        }

        songs.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        playlists.push(Playlist {
            name,
            path: path.to_string_lossy().to_string(),
            songs,
        });
    }

    playlists.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    eprintln!(
        "[DEBUG] get_music_playlists: scanned {} playlists with {} total songs",
        playlists.len(),
        playlists.iter().map(|p| p.songs.len()).sum::<usize>()
    );
    Json(ApiResponse::success_data(playlists))
}

/// GET /music/*path — serve a music file with streaming + Range support.
pub async fn serve_music(
    Path(rel): Path<String>,
    req: Request<axum::body::Body>,
) -> Result<impl IntoResponse, StatusCode> {
    if rel.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    let music_dir =
        std::fs::canonicalize(MUSIC_DIR).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let requested = music_dir.join(&rel);
    let resolved = std::fs::canonicalize(&requested).map_err(|_| StatusCode::NOT_FOUND)?;

    if !resolved.starts_with(&music_dir) {
        return Err(StatusCode::FORBIDDEN);
    }
    if !resolved.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let file_service = ServeFile::new(resolved);

    // tower_http::services::ServeFile implements Service, we can call oneshot to get a response.
    file_service
        .oneshot(req)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
