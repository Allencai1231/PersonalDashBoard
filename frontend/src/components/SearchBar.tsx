import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

const STORAGE_KEY = 'dashboard_search_history';
const MAX_HISTORY = 20;

function loadHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_HISTORY);
    }
    return [];
  } catch {
    return [];
  }
}

function saveHistory(items: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage full or unavailable
  }
}

function isUrlLike(query: string): boolean {
  const trimmed = query.trim();
  return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(trimmed) ||
         /^[\w.-]+\.[a-z]{2,}$/i.test(trimmed);
}

function normalizeUrl(query: string): string {
  const trimmed = query.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter history based on current query
  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((item) =>
      item.query.toLowerCase().includes(q),
    );
  }, [query, history]);

  const addToHistory = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => item.query.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(
          0,
          MAX_HISTORY,
        );
        saveHistory(next);
        return next;
      });
    },
    [],
  );

  const removeFromHistory = useCallback(
    (q: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setHistory((prev) => {
        const next = prev.filter((item) => item.query !== q);
        saveHistory(next);
        return next;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const executeSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      addToHistory(trimmed);
      setFocused(false);

      if (isUrlLike(trimmed)) {
        window.open(normalizeUrl(trimmed), '_blank', 'noopener,noreferrer');
      } else {
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`,
          '_blank',
          'noopener,noreferrer',
        );
      }
    },
    [addToHistory],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch(query);
      } else if (e.key === 'Escape') {
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [query, executeSearch],
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setFocused(false);
    }, 200);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  return (
    <div style={{ position: 'relative', padding: '0 20px', marginBottom: 8 }}>
      <motion.div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          borderColor: focused
            ? 'var(--accent-cyan)'
            : 'var(--card-border)',
          boxShadow: focused ? 'var(--glow-cyan)' : undefined,
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        {/* Search icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={focused ? 'var(--accent-cyan)' : 'var(--text-dim)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'stroke var(--transition-fast)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="搜索或输入网址... (Ctrl+K)"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
          }}
        />

        {/* Search button */}
        <motion.button
          onClick={() => executeSearch(query)}
          className="btn btn-icon btn-ghost"
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            fontSize: '0.8rem',
            color: focused ? 'var(--accent-cyan)' : 'var(--text-dim)',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="搜索"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </motion.button>

        {/* Shortcut hint */}
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--card-border)',
            flexShrink: 0,
            opacity: focused ? 0 : 1,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          Ctrl+K
        </span>
      </motion.div>

      {/* History dropdown */}
      <AnimatePresence>
        {focused && (
          <motion.div
            ref={dropdownRef}
            className="glass"
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              top: 'calc(100% + 6px)',
              zIndex: 500,
              padding: 6,
              borderRadius: 'var(--radius-md)',
              maxHeight: 300,
              overflowY: 'auto',
              boxShadow: 'var(--shadow-modal)',
              borderColor: 'var(--accent-cyan-dim)',
            }}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredHistory.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px 4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-dim)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    搜索历史
                  </span>
                  <motion.button
                    onClick={clearHistory}
                    className="btn-ghost"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-red)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    whileHover={{ background: 'rgba(255,51,85,0.1)' }}
                  >
                    清空
                  </motion.button>
                </div>

                {filteredHistory.map((item, index) => (
                  <motion.div
                    key={`${item.query}-${item.timestamp}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                    className="context-menu-item"
                    onClick={() => {
                      setQuery(item.query);
                      executeSearch(item.query);
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-dim)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.85rem',
                        }}
                      >
                        {item.query}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-dim)',
                          flexShrink: 0,
                        }}
                      >
                        {formatTimestamp(item.timestamp)}
                      </span>
                      <motion.button
                        onClick={(e) => removeFromHistory(item.query, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          padding: 2,
                          lineHeight: 1,
                          opacity: 0,
                          transition: 'opacity var(--transition-fast), color var(--transition-fast)',
                        }}
                        className="history-delete-btn"
                        whileHover={{ color: 'var(--accent-red)' }}
                      >
                        ×
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </>
            ) : (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontSize: '0.85rem',
                }}
              >
                {query.trim() ? '无匹配的历史记录' : '暂无搜索历史'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline style for history delete button hover */}
      <style>{`
        .context-menu-item:hover .history-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
