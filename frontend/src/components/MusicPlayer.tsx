import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Playlist } from "@/types";
import { useMusicPlaylists } from "@/hooks/useApi";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getMusicUrl(relativePath: string): string {
  return `/music/${relativePath.replace(/\\/g, "/")}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const PLAYBACK_MODES = ["normal", "repeat", "repeat-one", "shuffle"] as const;
type PlaybackMode = (typeof PLAYBACK_MODES)[number];

const MODE_ICONS: Record<PlaybackMode, string> = {
  normal: "🔁",
  repeat: "🔁",
  "repeat-one": "🔂",
  shuffle: "🔀",
};

const MODE_LABELS: Record<PlaybackMode, string> = {
  normal: "列表循环",
  repeat: "列表循环",
  "repeat-one": "单曲循环",
  shuffle: "随机播放",
};

/* ------------------------------------------------------------------ */
/*  Spectrum Visualization                                            */
/* ------------------------------------------------------------------ */

function SpectrumBars({ isPlaying }: { isPlaying: boolean }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 16 }, () => ({
        baseHeight: 3 + Math.random() * 8,
        speed: 0.4 + Math.random() * 1.2,
        offset: Math.random() * Math.PI * 2,
      })),
    [],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 2,
        height: 48,
        padding: "0 4px",
      }}
    >
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          style={{
            width: 6,
            borderRadius: 3,
            background: isPlaying
              ? `linear-gradient(180deg, var(--accent-cyan), var(--accent-purple))`
              : "var(--card-border)",
            boxShadow: isPlaying
              ? `0 0 8px ${i % 2 === 0 ? "var(--accent-cyan-dim)" : "var(--accent-purple-dim)"}`
              : "none",
            transition: "box-shadow 0.3s",
          }}
          animate={
            isPlaying
              ? {
                  height: [
                    bar.baseHeight,
                    bar.baseHeight * 4,
                    bar.baseHeight * 2,
                    bar.baseHeight * 5,
                    bar.baseHeight,
                  ],
                  opacity: [0.5, 1, 0.7, 1, 0.5],
                }
              : { height: bar.baseHeight, opacity: 0.3 }
          }
          transition={
            isPlaying
              ? {
                  duration: bar.speed,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: bar.offset * 0.1,
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface WindowState {
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

const INITIAL_WINDOW: WindowState = {
  visible: false,
  minimized: false,
  maximized: false,
  x: 100,
  y: 100,
  width: 380,
  height: 560,
};

export default function MusicPlayer() {
  const { playlists: apiPlaylists, loading } = useMusicPlaylists();

  /* ---- Window state ---- */
  const [win, setWin] = useState<WindowState>(INITIAL_WINDOW);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    winX: number;
    winY: number;
  }>({ startX: 0, startY: 0, winX: 0, winY: 0 });

  /* ---- Audio state ---- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlaylistIdx, setCurrentPlaylistIdx] = useState(0);
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  /* ---- Derived ---- */
  const playlists: Playlist[] = useMemo(() => apiPlaylists, [apiPlaylists]);
  const currentPlaylist = playlists[currentPlaylistIdx] || null;
  const currentSong = currentPlaylist?.songs[currentSongIdx] || null;

  /* ---- Audio element ---- */
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      audio.volume = volume;
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Load song ---- */
  // Only set audio.src and load when the user is actively playing.
  // This prevents the browser from eagerly downloading large files
  // (e.g. 46MB FLAC) on mount, which blocks the page through tunnels like cpolar.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // Reset UI state for the new song
    setCurrentTime(0);
    setDuration(currentSong.duration || 0);

    // Only actually load the audio file if we're supposed to be playing
    if (isPlaying) {
      const url = getMusicUrl(currentSong.relative_path);
      if (audio.src !== url && !audio.src.endsWith(currentSong.relative_path)) {
        audio.src = url;
        audio.load();
      }
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentSong, currentPlaylistIdx, currentSongIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Audio event listeners ---- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => handleNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      // Skip to next after a short delay
      setTimeout(() => handleNext(), 1000);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlaylistIdx, currentSongIdx, playbackMode]);

  /* ---- Volume sync ---- */
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  /* ---- Playback controls ---- */
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (audio.paused) {
      // If no src is set yet (first play), load the song now
      const url = getMusicUrl(currentSong.relative_path);
      if (
        !audio.src ||
        (!audio.src.endsWith(currentSong.relative_path) && audio.src !== url)
      ) {
        audio.src = url;
        audio.load();
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentSong]);

  const handlePrev = useCallback(() => {
    if (!currentPlaylist || currentPlaylist.songs.length === 0) return;
    const total = currentPlaylist.songs.length;
    let nextIdx: number;
    if (playbackMode === "shuffle") {
      nextIdx = Math.floor(Math.random() * total);
    } else if (currentSongIdx <= 0) {
      nextIdx = total - 1;
    } else {
      nextIdx = currentSongIdx - 1;
    }
    setCurrentSongIdx(nextIdx);
    // Load and play the new song immediately
    if (isPlaying) {
      setTimeout(() => {
        const audio = audioRef.current;
        const pl = currentPlaylist;
        if (audio && pl && pl.songs[nextIdx]) {
          const url = getMusicUrl(pl.songs[nextIdx].relative_path);
          audio.src = url;
          audio.load();
          audio.play().catch(() => {});
        }
      }, 100);
    }
  }, [currentPlaylist, currentSongIdx, playbackMode, isPlaying]);

  const handleNext = useCallback(() => {
    if (!currentPlaylist || currentPlaylist.songs.length === 0) return;
    const total = currentPlaylist.songs.length;

    if (playbackMode === "repeat-one") {
      // Replay current
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }

    let nextIdx: number;
    if (playbackMode === "shuffle") {
      nextIdx = Math.floor(Math.random() * total);
    } else if (currentSongIdx >= total - 1) {
      nextIdx = playbackMode === "repeat" ? 0 : currentSongIdx;
      if (playbackMode === "normal") {
        setIsPlaying(false);
        return;
      }
    } else {
      nextIdx = currentSongIdx + 1;
    }
    setCurrentSongIdx(nextIdx);
    if (isPlaying) {
      setTimeout(() => {
        const audio = audioRef.current;
        const pl = currentPlaylist;
        if (audio && pl && pl.songs[nextIdx]) {
          const url = getMusicUrl(pl.songs[nextIdx].relative_path);
          audio.src = url;
          audio.load();
          audio.play().catch(() => {});
        }
      }, 100);
    }
  }, [currentPlaylist, currentSongIdx, playbackMode, isPlaying]);

  const cyclePlaybackMode = useCallback(() => {
    setPlaybackMode((prev) => {
      const idx = PLAYBACK_MODES.indexOf(prev);
      return PLAYBACK_MODES[(idx + 1) % PLAYBACK_MODES.length];
    });
  }, []);

  const seekFromClick = useCallback(
    (e: React.MouseEvent) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const fraction = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      audio.currentTime = fraction * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration],
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setVolume(val);
      setIsMuted(val === 0);
    },
    [],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!currentSong) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      const key = currentSong.relative_path;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [currentSong]);

  const isFavorited = currentSong
    ? favorites.has(currentSong.relative_path)
    : false;

  /* ---- Song selection ---- */
  const selectSong = useCallback(
    (idx: number) => {
      setCurrentSongIdx(idx);
      setIsPlaying(true);
      // Immediately load and play the selected song
      setTimeout(() => {
        const audio = audioRef.current;
        const pl = playlists[currentPlaylistIdx];
        if (audio && pl && pl.songs[idx]) {
          const url = getMusicUrl(pl.songs[idx].relative_path);
          audio.src = url;
          audio.load();
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }, 100);
    },
    [playlists, currentPlaylistIdx],
  );

  const selectPlaylist = useCallback((idx: number) => {
    setCurrentPlaylistIdx(idx);
    setCurrentSongIdx(0);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  /* ---- Dragging ---- */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        winX: win.x,
        winY: win.y,
      };
    },
    [win.x, win.y],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setWin((prev) => ({
        ...prev,
        x: Math.max(0, dragRef.current.winX + dx),
        y: Math.max(0, dragRef.current.winY + dy),
      }));
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  /* ---- Resize ---- */
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: win.width,
        startH: win.height,
      };
    },
    [win.width, win.height],
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      setWin((prev) => ({
        ...prev,
        width: Math.max(320, resizeRef.current.startW + dx),
        height: Math.max(400, resizeRef.current.startH + dy),
      }));
    };

    const handleMouseUp = () => setResizing(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    if (!win.visible || win.minimized) return;

    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(
              0,
              audioRef.current.currentTime - 5,
            );
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (audioRef.current && duration) {
            audioRef.current.currentTime = Math.min(
              duration,
              audioRef.current.currentTime + 5,
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((prev) => clamp(prev + 0.05, 0, 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((prev) => clamp(prev - 0.05, 0, 1));
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [win.visible, win.minimized, togglePlay, duration]);

  /* ---- Toggle visibility ---- */
  const toggleVisible = useCallback(() => {
    setWin((prev) => ({
      ...prev,
      visible: !prev.visible,
      minimized: false,
    }));
  }, []);

  const toggleMinimize = useCallback(() => {
    setWin((prev) => ({
      ...prev,
      minimized: !prev.minimized,
      maximized: false,
    }));
  }, []);

  const toggleMaximize = useCallback(() => {
    setWin((prev) => ({
      ...prev,
      maximized: !prev.maximized,
      minimized: false,
    }));
  }, []);

  const close = useCallback(() => {
    setWin((prev) => ({ ...prev, visible: false }));
  }, []);

  /* ---- Progress percentage ---- */
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* ---- If never opened, show only the toggle button ---- */
  return (
    <>
      {/* Floating toggle button */}
      <AnimatePresence>
        {!win.visible && (
          <motion.button
            className="btn btn-primary"
            onClick={toggleVisible}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              zIndex: 200,
              width: 50,
              height: 50,
              borderRadius: "50%",
              padding: 0,
              fontSize: "1.4rem",
              boxShadow: "var(--glow-cyan-strong)",
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            🎵
          </motion.button>
        )}
      </AnimatePresence>

      {/* Minimized bar */}
      <AnimatePresence>
        {win.visible && win.minimized && (
          <motion.div
            className="glass"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: "fixed",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              padding: "8px 16px",
              borderRadius: "var(--radius-full)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <motion.button
              onClick={togglePlay}
              className="btn btn-ghost btn-icon"
              style={{ width: 32, height: 32 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </motion.button>
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--text-primary)",
                maxWidth: 200,
              }}
              className="truncate"
            >
              {currentSong?.title || "未选择歌曲"}
            </span>
            <motion.button
              onClick={toggleMinimize}
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28, fontSize: "0.7rem" }}
              whileHover={{ scale: 1.1 }}
            >
              ▲
            </motion.button>
            <motion.button
              onClick={close}
              className="btn btn-ghost btn-icon"
              style={{ width: 28, height: 28, fontSize: "0.8rem" }}
              whileHover={{ scale: 1.1, color: "var(--accent-red)" }}
            >
              ×
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main player window */}
      <AnimatePresence>
        {win.visible && !win.minimized && (
          <motion.div
            className="draggable-window"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "fixed",
              left: win.maximized ? 0 : win.x,
              top: win.maximized ? 0 : win.y,
              width: win.maximized ? "100vw" : win.width,
              height: win.maximized ? "100vh" : win.height,
              zIndex: 150,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              className="draggable-window-header"
              onMouseDown={handleDragStart}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              <div className="window-dots">
                <motion.div
                  className="window-dot window-dot-red"
                  onClick={close}
                  whileHover={{ scale: 1.2 }}
                  title="关闭"
                />
                <motion.div
                  className="window-dot window-dot-yellow"
                  onClick={toggleMinimize}
                  whileHover={{ scale: 1.2 }}
                  title="最小化"
                />
                <motion.div
                  className="window-dot window-dot-green"
                  onClick={toggleMaximize}
                  whileHover={{ scale: 1.2 }}
                  title="最大化"
                />
              </div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.03em",
                }}
              >
                🎵 音乐播放器
              </span>
              <div style={{ width: 42 }} />
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {loading ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ width: 200, height: 20 }}
                  />
                </div>
              ) : playlists.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "3rem",
                        marginBottom: 12,
                        opacity: 0.5,
                      }}
                    >
                      🎵
                    </div>
                    <p
                      style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}
                    >
                      未找到任何播放列表
                    </p>
                    <p
                      style={{
                        color: "var(--text-dim)",
                        fontSize: "0.7rem",
                        marginTop: 4,
                      }}
                    >
                      请在 music 目录下添加音乐文件
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Upper section: album art + spectrum */}
                  <div
                    style={{
                      padding: "16px 20px 12px",
                      borderBottom: "1px solid var(--card-border)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 16 }}
                    >
                      {/* Album art */}
                      <motion.div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: "50%",
                          background: "var(--gradient-cyan-purple)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2.2rem",
                          flexShrink: 0,
                          boxShadow: isPlaying ? "var(--glow-cyan)" : "none",
                          position: "relative",
                        }}
                        animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                        transition={
                          isPlaying
                            ? { duration: 8, repeat: Infinity, ease: "linear" }
                            : { duration: 0.5 }
                        }
                      >
                        {/* Inner circle */}
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "var(--bg-dark)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.9rem",
                          }}
                        >
                          🎵
                        </div>
                      </motion.div>

                      {/* Song info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4
                          className="truncate"
                          style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: 4,
                          }}
                        >
                          {currentSong?.title || "--"}
                        </h4>
                        <p
                          className="truncate"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                            marginBottom: 4,
                          }}
                        >
                          {currentSong?.filename || "未知文件"}
                        </p>
                        {currentSong?.duration ? (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-dim)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {formatTime(currentSong.duration)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Spectrum */}
                    <div style={{ marginTop: 12 }}>
                      <SpectrumBars isPlaying={isPlaying} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ padding: "0 20px" }}>
                    <div
                      style={{
                        position: "relative",
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                      onClick={seekFromClick}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.08)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <motion.div
                          style={{
                            height: "100%",
                            borderRadius: 2,
                            background: "var(--gradient-cyan-purple)",
                            width: `${progressPercent}%`,
                            boxShadow: "0 0 8px var(--accent-cyan-glow)",
                          }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                      <motion.div
                        style={{
                          position: "absolute",
                          left: `${progressPercent}%`,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "#fff",
                          boxShadow: "0 0 10px var(--accent-cyan-glow)",
                          transform: "translate(-50%, 0)",
                          pointerEvents: "none",
                        }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.65rem",
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        marginTop: -2,
                      }}
                    >
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                      padding: "12px 20px",
                    }}
                  >
                    {/* Playback mode */}
                    <motion.button
                      className="btn btn-ghost btn-icon"
                      onClick={cyclePlaybackMode}
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: "0.9rem",
                        position: "relative",
                      }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      title={MODE_LABELS[playbackMode]}
                    >
                      <span>{MODE_ICONS[playbackMode]}</span>
                      {playbackMode !== "normal" && (
                        <span
                          style={{
                            position: "absolute",
                            top: -2,
                            right: -2,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--accent-cyan)",
                            boxShadow: "0 0 6px var(--accent-cyan-glow)",
                          }}
                        />
                      )}
                    </motion.button>

                    {/* Previous */}
                    <motion.button
                      className="btn btn-ghost btn-icon"
                      onClick={handlePrev}
                      style={{ width: 36, height: 36, fontSize: "1.1rem" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={
                        !currentPlaylist || currentPlaylist.songs.length === 0
                      }
                    >
                      ⏮
                    </motion.button>

                    {/* Play/Pause */}
                    <motion.button
                      className="btn btn-primary btn-icon"
                      onClick={togglePlay}
                      style={{
                        width: 48,
                        height: 48,
                        fontSize: "1.3rem",
                        borderRadius: "50%",
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={!currentSong}
                    >
                      {isPlaying ? "⏸" : "▶"}
                    </motion.button>

                    {/* Next */}
                    <motion.button
                      className="btn btn-ghost btn-icon"
                      onClick={handleNext}
                      style={{ width: 36, height: 36, fontSize: "1.1rem" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={
                        !currentPlaylist || currentPlaylist.songs.length === 0
                      }
                    >
                      ⏭
                    </motion.button>

                    {/* Favorite */}
                    <motion.button
                      className="btn btn-ghost btn-icon"
                      onClick={toggleFavorite}
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: "1rem",
                      }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      disabled={!currentSong}
                    >
                      {isFavorited ? "❤️" : "🤍"}
                    </motion.button>
                  </div>

                  {/* Volume */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 20px 8px",
                    }}
                  >
                    <motion.button
                      className="btn btn-ghost btn-icon"
                      onClick={toggleMute}
                      style={{ width: 28, height: 28, fontSize: "0.85rem" }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {isMuted || volume === 0
                        ? "🔇"
                        : volume < 0.5
                          ? "🔉"
                          : "🔊"}
                    </motion.button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      style={{ flex: 1 }}
                    />
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        width: 32,
                        textAlign: "right",
                      }}
                    >
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>

                  {/* Playlist & Songs */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      borderTop: "1px solid var(--card-border)",
                    }}
                  >
                    {/* Playlist selector */}
                    {playlists.length > 1 && (
                      <div
                        style={{
                          padding: "6px 14px",
                          borderBottom: "1px solid var(--card-border)",
                          overflowX: "auto",
                          display: "flex",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {playlists.map((pl, idx) => (
                          <motion.button
                            key={pl.path || idx}
                            onClick={() => selectPlaylist(idx)}
                            className="btn btn-sm"
                            style={{
                              padding: "4px 12px",
                              fontSize: "0.7rem",
                              borderRadius: "var(--radius-full)",
                              background:
                                idx === currentPlaylistIdx
                                  ? "var(--accent-cyan-dim)"
                                  : undefined,
                              borderColor:
                                idx === currentPlaylistIdx
                                  ? "var(--accent-cyan)"
                                  : undefined,
                              color:
                                idx === currentPlaylistIdx
                                  ? "var(--accent-cyan)"
                                  : "var(--text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {pl.name} ({pl.songs.length})
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {/* Songs list */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "4px 0",
                      }}
                    >
                      {currentPlaylist?.songs.map((song, idx) => (
                        <motion.div
                          key={song.relative_path || idx}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => selectSong(idx)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 14px",
                            cursor: "pointer",
                            borderLeft:
                              idx === currentSongIdx
                                ? "2px solid var(--accent-cyan)"
                                : "2px solid transparent",
                            background:
                              idx === currentSongIdx
                                ? "rgba(0,242,255,0.06)"
                                : "transparent",
                            transition: "all var(--transition-fast)",
                          }}
                          whileHover={{
                            background:
                              idx === currentSongIdx
                                ? "rgba(0,242,255,0.1)"
                                : "var(--card-glass)",
                          }}
                        >
                          {/* Playing indicator */}
                          <span
                            style={{
                              width: 20,
                              textAlign: "center",
                              flexShrink: 0,
                              fontSize: "0.85rem",
                            }}
                          >
                            {idx === currentSongIdx && isPlaying ? (
                              <span
                                style={{
                                  animation: "breathe 1s ease-in-out infinite",
                                  display: "inline-block",
                                }}
                              >
                                🎵
                              </span>
                            ) : idx === currentSongIdx ? (
                              "▶️"
                            ) : (
                              <span
                                style={{
                                  color: "var(--text-dim)",
                                  fontSize: "0.7rem",
                                }}
                              >
                                {idx + 1}
                              </span>
                            )}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              className="truncate"
                              style={{
                                fontSize: "0.8rem",
                                color:
                                  idx === currentSongIdx
                                    ? "var(--accent-cyan)"
                                    : "var(--text-primary)",
                                fontWeight: idx === currentSongIdx ? 600 : 400,
                                textShadow:
                                  idx === currentSongIdx
                                    ? "0 0 8px rgba(0,242,255,0.3)"
                                    : "none",
                              }}
                            >
                              {song.title}
                            </div>
                            <div
                              className="truncate"
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-dim)",
                                marginTop: 1,
                              }}
                            >
                              {song.filename}
                              {song.duration
                                ? ` · ${formatTime(song.duration)}`
                                : ""}
                            </div>
                          </div>

                          {/* Favorite heart for song */}
                          {favorites.has(song.relative_path) && (
                            <span
                              style={{ fontSize: "0.65rem", flexShrink: 0 }}
                            >
                              ❤️
                            </span>
                          )}
                        </motion.div>
                      ))}

                      {(!currentPlaylist ||
                        currentPlaylist.songs.length === 0) && (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "30px 20px",
                            color: "var(--text-dim)",
                            fontSize: "0.8rem",
                          }}
                        >
                          播放列表为空
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Resize handle */}
            {!win.maximized && (
              <div className="resize-handle" onMouseDown={handleResizeStart} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
