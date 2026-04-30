import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Note, NoteCategory } from '@/types';
import { useAppContext } from '@/App';
import Modal from './Modal';

function generateId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHr < 24) return `${diffHr}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function Notebook() {
  const { userInfo, dashboardData, saveData } = useAppContext();
  const isAdmin = userInfo?.role === 'admin';

  // ---- State ----
  const [categories, setCategories] = useState<NoteCategory[]>(
    dashboardData?.note_categories || [],
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Note editor state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteUpdated, setNoteUpdated] = useState('');
  const [charCount, setCharCount] = useState(0);

  // Modals
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<NoteCategory | null>(null);
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<Note | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ---- Sync from dashboardData ----
  useEffect(() => {
    if (dashboardData?.note_categories) {
      setCategories(dashboardData.note_categories);
    }
  }, [dashboardData]);

  // ---- Derived ----
  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) || null,
    [categories, activeCategoryId],
  );

  const activeNote = useMemo(
    () => activeCategory?.notes.find((n) => n.id === activeNoteId) || null,
    [activeCategory, activeNoteId],
  );

  // ---- Load note into editor ----
  useEffect(() => {
    if (activeNote) {
      setNoteTitle(activeNote.title);
      setNoteContent(activeNote.content);
      setNoteUpdated(activeNote.updated);
      setCharCount(
        activeNote.content.replace(/<[^>]*>/g, '').length,
      );
    } else {
      setNoteTitle('');
      setNoteContent('');
      setNoteUpdated('');
      setCharCount(0);
    }
  }, [activeNote]);

  // Sync editor DOM when content changes externally
  useEffect(() => {
    if (editorRef.current) {
      if (activeNote) {
        editorRef.current.innerHTML = activeNote.content;
      } else {
        editorRef.current.innerHTML = '';
      }
    }
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-save ----
  const debouncedSave = useCallback(
    (catId: string, noteId: string, title: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const updatedCategories = categories.map((cat) => {
          if (cat.id !== catId) return cat;
          return {
            ...cat,
            notes: cat.notes.map((n) => {
              if (n.id !== noteId) return n;
              return {
                ...n,
                title: title || '未命名笔记',
                content,
                updated: new Date().toISOString(),
              };
            }),
          };
        });
        setCategories(updatedCategories);
        saveData({ note_categories: updatedCategories });
      }, 800);
    },
    [categories, saveData],
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ---- Handlers ----
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setNoteTitle(val);
      if (activeCategoryId && activeNoteId) {
        debouncedSave(activeCategoryId, activeNoteId, val, noteContent);
      }
    },
    [activeCategoryId, activeNoteId, noteContent, debouncedSave],
  );

  const handleContentInput = useCallback(() => {
    if (!editorRef.current || !activeCategoryId || !activeNoteId) return;
    const html = editorRef.current.innerHTML;
    const text = html.replace(/<[^>]*>/g, '');
    setNoteContent(html);
    setCharCount(text.length);
    debouncedSave(activeCategoryId, activeNoteId, noteTitle, html);
  }, [activeCategoryId, activeNoteId, noteTitle, debouncedSave]);

  const handleContentPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      let imageHandled = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          imageHandled = true;
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64 = evt.target?.result as string;
            // Insert image at cursor position
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const img = document.createElement('img');
              img.src = base64;
              img.alt = 'Pasted image';
              img.style.maxWidth = '100%';
              img.style.borderRadius = 'var(--radius-md)';
              img.style.margin = '8px 0';
              img.style.cursor = 'pointer';
              img.onclick = () => setPreviewImage(base64);
              range.deleteContents();
              range.insertNode(img);
              range.collapse(false);
              // Trigger content update
              handleContentInput();
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }

      if (!imageHandled) {
        // Let the default paste happen, then update
        setTimeout(() => handleContentInput(), 0);
      }
    },
    [handleContentInput],
  );

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab to indent
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertHTML', false, '&emsp;&emsp;');
      }
    },
    [],
  );

  // ---- Image preview click on existing images ----
  const handleEditorClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        if (img.src) {
          setPreviewImage(img.src);
        }
      }
    },
    [],
  );

  // ---- Category management ----
  const addCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;

    const newCat: NoteCategory = {
      id: generateId(),
      name,
      notes: [],
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    setActiveCategoryId(newCat.id);
    setActiveNoteId(null);
    setNewCategoryName('');
    setAddCategoryModal(false);
    saveData({ note_categories: updated });
  }, [newCategoryName, categories, saveData]);

  const confirmDeleteCategory = useCallback(() => {
    if (!deleteCategoryTarget) return;
    const updated = categories.filter((c) => c.id !== deleteCategoryTarget.id);
    setCategories(updated);
    if (activeCategoryId === deleteCategoryTarget.id) {
      setActiveCategoryId(updated[0]?.id || null);
      setActiveNoteId(null);
    }
    setDeleteCategoryTarget(null);
    saveData({ note_categories: updated });
  }, [deleteCategoryTarget, categories, activeCategoryId, saveData]);

  // ---- Note management ----
  const addNote = useCallback(() => {
    if (!activeCategoryId) return;

    const newNote: Note = {
      id: generateId(),
      title: '新笔记',
      content: '',
      updated: new Date().toISOString(),
    };

    const updated = categories.map((cat) => {
      if (cat.id !== activeCategoryId) return cat;
      return { ...cat, notes: [newNote, ...cat.notes] };
    });

    setCategories(updated);
    setActiveNoteId(newNote.id);
    saveData({ note_categories: updated });
  }, [activeCategoryId, categories, saveData]);

  const selectNote = useCallback((noteId: string) => {
    setActiveNoteId(noteId);
  }, []);

  const confirmDeleteNote = useCallback(() => {
    if (!deleteNoteTarget || !activeCategoryId) return;

    const updated = categories.map((cat) => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        notes: cat.notes.filter((n) => n.id !== deleteNoteTarget.id),
      };
    });

    setCategories(updated);
    if (activeNoteId === deleteNoteTarget.id) {
      const cat = updated.find((c) => c.id === activeCategoryId);
      setActiveNoteId(cat?.notes[0]?.id || null);
    }
    setDeleteNoteTarget(null);
    saveData({ note_categories: updated });
  }, [deleteNoteTarget, activeCategoryId, activeNoteId, categories, saveData]);

  // ---- Resize sidebar ----
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.min(500, Math.max(200, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth],
  );

  // ---- Select first category if none selected ----
  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* ---- Sidebar ---- */}
      <motion.div
        className="glass"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          maxWidth: sidebarWidth,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          borderRight: '1px solid var(--card-border)',
        }}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              textShadow: '0 0 10px rgba(0,242,255,0.3)',
              letterSpacing: '0.04em',
            }}
          >
            📒 笔记本
          </h3>
          {isAdmin && (
            <motion.button
              className="btn btn-ghost btn-icon"
              onClick={() => setAddCategoryModal(true)}
              style={{
                width: 28,
                height: 28,
                color: 'var(--text-dim)',
                fontSize: '1.1rem',
              }}
              whileHover={{
                color: 'var(--accent-cyan)',
                textShadow: '0 0 10px var(--accent-cyan)',
                scale: 1.1,
              }}
              whileTap={{ scale: 0.9 }}
              title="添加分类"
            >
              +
            </motion.button>
          )}
        </div>

        {/* Category list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <AnimatePresence>
            {categories.map((cat) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                {/* Category header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 14px 4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (cat.id === activeCategoryId) {
                      setActiveCategoryId(null);
                      setActiveNoteId(null);
                    } else {
                      setActiveCategoryId(cat.id);
                      setActiveNoteId(cat.notes.length > 0 ? cat.notes[0].id : null);
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color:
                        cat.id === activeCategoryId
                          ? 'var(--accent-cyan)'
                          : 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    {cat.id === activeCategoryId ? '▾ ' : '▸ '}
                    {cat.name}
                    <span
                      style={{
                        marginLeft: 6,
                        color: 'var(--text-dim)',
                        fontSize: '0.7rem',
                        fontWeight: 400,
                      }}
                    >
                      ({cat.notes.length})
                    </span>
                  </span>
                  {isAdmin && (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCategoryTarget(cat);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        opacity: 0,
                        transition: 'opacity 0.15s, color 0.15s',
                      }}
                      className="cat-delete-btn"
                      whileHover={{ color: 'var(--accent-red)' }}
                    >
                      ×
                    </motion.button>
                  )}
                </div>

                {/* Notes under category */}
                <AnimatePresence>
                  {cat.id === activeCategoryId &&
                    cat.notes.map((note, idx) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{
                          delay: idx * 0.03,
                          duration: 0.2,
                        }}
                        onClick={() => selectNote(note.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 14px 7px 28px',
                          cursor: 'pointer',
                          borderLeft:
                            note.id === activeNoteId
                              ? '2px solid var(--accent-cyan)'
                              : '2px solid transparent',
                          background:
                            note.id === activeNoteId
                              ? 'rgba(0,242,255,0.06)'
                              : 'transparent',
                          transition: 'all var(--transition-fast)',
                        }}
                        className="note-list-item"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            className="truncate"
                            style={{
                              fontSize: '0.8rem',
                              color:
                                note.id === activeNoteId
                                  ? 'var(--accent-cyan)'
                                  : 'var(--text-primary)',
                              fontWeight:
                                note.id === activeNoteId ? 600 : 400,
                              textShadow:
                                note.id === activeNoteId
                                  ? '0 0 8px rgba(0,242,255,0.3)'
                                  : 'none',
                            }}
                          >
                            {note.title || '未命名笔记'}
                          </div>
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: 'var(--text-dim)',
                              marginTop: 2,
                            }}
                          >
                            {formatDate(note.updated)}
                          </div>
                        </div>
                        {isAdmin && (
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteNoteTarget(note);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-dim)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              opacity: 0,
                              transition: 'opacity 0.15s, color 0.15s',
                            }}
                            className="note-delete-btn"
                            whileHover={{ color: 'var(--accent-red)' }}
                          >
                            ×
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {categories.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 20px',
                color: 'var(--text-dim)',
                fontSize: '0.8rem',
              }}
            >
              {isAdmin ? '点击 + 创建第一个分类' : '暂无分类'}
            </div>
          )}
        </div>

      </motion.div>

      {/* ---- Resize handle ---- */}
      <div
        className={`split-pane-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleResizeMouseDown}
        style={{ cursor: 'col-resize' }}
      />

      {/* ---- Editor Area ---- */}
      <motion.div
        className="glass"
        style={{
          flex: 1,
          height: '100%',
          marginLeft: 8,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        {/* Editor toolbar */}
        {activeNote ? (
          <>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Category badge */}
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-cyan-dim)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600,
                  border: '1px solid rgba(0,242,255,0.2)',
                }}
              >
                {activeCategory?.name || '...'}
              </span>

              {/* Add note button */}
              {isAdmin && (
                <motion.button
                  className="btn btn-ghost btn-sm"
                  onClick={addNote}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ fontSize: '0.75rem' }}
                >
                  + 新建笔记
                </motion.button>
              )}
            </div>

            {/* Title input */}
            <input
              ref={titleInputRef}
              className="input"
              type="text"
              value={noteTitle}
              onChange={handleTitleChange}
              placeholder={isAdmin ? '笔记标题...' : '笔记标题（只读）'}
              readOnly={!isAdmin}
              style={{
                border: 'none',
                borderRadius: 0,
                fontSize: '1.3rem',
                fontWeight: 700,
                padding: '14px 20px 8px',
                background: 'transparent',
                color: 'var(--text-primary)',
              }}
            />

            {/* Last updated */}
            {noteUpdated && (
              <div
                style={{
                  padding: '2px 20px 6px',
                  fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                }}
              >
                最后更新: {formatDate(noteUpdated)}
              </div>
            )}

            {/* Content editable */}
            <div
              ref={editorRef}
              contentEditable={isAdmin}
              suppressContentEditableWarning
              data-placeholder="开始书写... (支持粘贴图片)"
              onInput={handleContentInput}
              onPaste={handleContentPaste}
              onKeyDown={handleContentKeyDown}
              onClick={handleEditorClick}
              style={{
                flex: 1,
                padding: '8px 20px 20px',
                overflowY: 'auto',
                outline: 'none',
                fontSize: '0.95rem',
                lineHeight: 1.8,
                color: 'var(--text-primary)',
                cursor: isAdmin ? 'text' : 'default',
                minHeight: 200,
              }}
            />

            {/* Character count */}
            <div
              style={{
                padding: '6px 20px',
                borderTop: '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {charCount} 字符
              </span>
              {!isAdmin && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--accent-amber)',
                    fontStyle: 'italic',
                  }}
                >
                  🔒 只读模式 (管理员可编辑)
                </span>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.4 }}>
              📝
            </div>
            <p
              style={{
                color: 'var(--text-dim)',
                fontSize: '0.95rem',
                textAlign: 'center',
              }}
            >
              {categories.length === 0
                ? '还未创建任何分类'
                : '选择一个笔记开始阅读'}
            </p>
            {isAdmin && categories.length > 0 && activeCategoryId && (
              <motion.button
                className="btn btn-primary"
                onClick={addNote}
                style={{ marginTop: 20 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                + 新建笔记
              </motion.button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* ---- Add Category Modal ---- */}
      <Modal
        open={addCategoryModal}
        onClose={() => {
          setAddCategoryModal(false);
          setNewCategoryName('');
        }}
        title="新建分类"
        onConfirm={addCategory}
        confirmText="创建"
      >
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            分类名称
          </label>
          <input
            className="input"
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="例如: 工作日志"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCategory();
            }}
          />
        </div>
      </Modal>

      {/* ---- Delete Category Modal ---- */}
      <Modal
        open={deleteCategoryTarget !== null}
        onClose={() => setDeleteCategoryTarget(null)}
        title="确认删除分类"
        onConfirm={confirmDeleteCategory}
        confirmText="删除"
        confirmDanger
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          确定要删除分类{' '}
          <strong style={{ color: 'var(--accent-cyan)' }}>
            {deleteCategoryTarget?.name}
          </strong>{' '}
          吗？分类下的所有笔记将被永久删除，此操作不可撤销。
        </p>
      </Modal>

      {/* ---- Delete Note Modal ---- */}
      <Modal
        open={deleteNoteTarget !== null}
        onClose={() => setDeleteNoteTarget(null)}
        title="确认删除笔记"
        onConfirm={confirmDeleteNote}
        confirmText="删除"
        confirmDanger
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          确定要删除{' '}
          <strong style={{ color: 'var(--accent-cyan)' }}>
            {deleteNoteTarget?.title || '未命名笔记'}
          </strong>{' '}
          吗？此操作不可撤销。
        </p>
      </Modal>

      {/* ---- Image Preview Overlay ---- */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            className="image-preview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPreviewImage(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPreviewImage(null);
            }}
            tabIndex={0}
          >
            <motion.img
              src={previewImage}
              alt="Preview"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            />
            <motion.button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--card-border)',
                color: '#fff',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
              whileHover={{ scale: 1.1, background: 'rgba(255,51,85,0.7)' }}
            >
              ×
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Inline hover styles ---- */}
      <style>{`
        .note-list-item:hover .note-delete-btn,
        [style*="cursor: pointer"]:hover > .note-delete-btn {
          opacity: 1 !important;
        }
        [style*="cursor: pointer"]:hover > .cat-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
