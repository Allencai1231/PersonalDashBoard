import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NavItem } from '@/types';
import { useAppContext } from '@/App';
import Modal from './Modal';

interface NavGridProps {
  items: NavItem[];
  type: 'software' | 'websites';
  onUpdate: (items: NavItem[]) => void;
}


function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export default function NavGrid({ items, type, onUpdate }: NavGridProps) {
  const { userInfo, openApp, saveData } = useAppContext();
  const isAdmin = userInfo?.role === 'admin';
  const isSoftware = type === 'software';

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NavItem | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [addError, setAddError] = useState('');

  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const title = isSoftware ? '软件' : '网站导航';
  const accentColor = isSoftware ? 'var(--accent-cyan)' : 'var(--accent-purple)';
  const emptyIcon = isSoftware ? '💻' : '🌐';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 400, damping: 28 },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      transition: { duration: 0.2 },
    },
  };

  // ---- Drag & Drop Handlers ----
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragItemRef.current = index;
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      // Make drag image semi-transparent
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 40, 40);
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverItemRef.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragOverItemRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const dragIdx = dragItemRef.current;
      if (dragIdx === null || dragIdx === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newItems = [...items];
      const [removed] = newItems.splice(dragIdx, 1);
      newItems.splice(dropIndex, 0, removed);

      onUpdate(newItems);
      saveData({ [type]: newItems });

      setDragIndex(null);
      setDragOverIndex(null);
      dragItemRef.current = null;
      dragOverItemRef.current = null;
    },
    [items, type, onUpdate, saveData],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  }, []);

  // ---- Add Item ----
  const openAddModal = useCallback(() => {
    setNewTitle('');
    setNewUrl('');
    setNewIcon('');
    setAddError('');
    setAddModalOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    const trimmedTitle = newTitle.trim();
    let trimmedUrl = newUrl.trim();

    if (!trimmedTitle) {
      setAddError('请输入名称');
      return;
    }
    if (!trimmedUrl) {
      setAddError('请输入URL');
      return;
    }

    // Auto-prepend https:// if missing
    if (isSoftware) {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        trimmedUrl = `https://${trimmedUrl}`;
      }
    } else {
      if (!/^https?:\/\//i.test(trimmedUrl) && !/^[\w.-]+\.[a-z]{2,}/i.test(trimmedUrl)) {
        setAddError('请输入有效的URL');
        return;
      }
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        trimmedUrl = `https://${trimmedUrl}`;
      }
    }

    const newItem: NavItem = {
      title: trimmedTitle,
      url: trimmedUrl,
      icon: newIcon.trim() || undefined,
    };

    const newItems = [...items, newItem];
    onUpdate(newItems);
    saveData({ [type]: newItems });
    setAddModalOpen(false);
  }, [newTitle, newUrl, newIcon, items, type, isSoftware, onUpdate, saveData]);

  // ---- Delete Item ----
  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const newItems = items.filter((item) => item !== deleteTarget);
    onUpdate(newItems);
    saveData({ [type]: newItems });
    setDeleteTarget(null);
  }, [deleteTarget, items, type, onUpdate, saveData]);

  // ---- Open Item ----
  const handleOpen = useCallback(
    async (item: NavItem) => {
      if (isSoftware) {
        await openApp(item.title, item.url);
      } else {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      }
    },
    [isSoftware, openApp],
  );


  return (
    <div style={{ padding: '0 20px', marginBottom: 16 }}>
      {/* Section header */}
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          position: 'relative',
        }}
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: accentColor,
              letterSpacing: '0.04em',
              textShadow: `0 0 10px ${accentColor}44`,
              display: 'inline-block',
              position: 'relative',
            }}
          >
            {title}
            <motion.span
              style={{
                position: 'absolute',
                bottom: -3,
                left: 0,
                width: '100%',
                height: 2,
                background: accentColor,
                borderRadius: 1,
                boxShadow: `0 0 8px ${accentColor}`,
              }}
              layoutId={`nav-underline-${type}`}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          </h3>
        </div>

        {/* Add button */}
        {isAdmin && (
          <motion.button
            className="btn btn-ghost btn-icon"
            onClick={openAddModal}
            style={{
              width: 30,
              height: 30,
              color: 'var(--text-dim)',
              fontSize: '1.2rem',
              fontWeight: 300,
            }}
            whileHover={{
              color: accentColor,
              scale: 1.1,
              textShadow: `0 0 10px ${accentColor}`,
            }}
            whileTap={{ scale: 0.9 }}
            title={`添加${title}`}
          >
            +
          </motion.button>
        )}
      </motion.div>

      {/* Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={`${item.title}-${item.url}-${index}`}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
              onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e as unknown as React.DragEvent, index)}
              onDragEnd={handleDragEnd}
              style={{
                position: 'relative',
                padding: '10px 8px',
                borderRadius: 'var(--radius-md)',
                background:
                  dragIndex === index
                    ? 'rgba(0,242,255,0.08)'
                    : dragOverIndex === index
                      ? 'rgba(189,0,255,0.08)'
                      : 'var(--card-glass)',
                border: `1px solid ${
                  dragOverIndex === index
                    ? accentColor
                    : dragIndex === index
                      ? 'var(--accent-cyan-dim)'
                      : 'var(--card-border)'
                }`,
                cursor: isAdmin ? 'grab' : 'pointer',
                opacity: dragIndex === index ? 0.6 : 1,
                transform: dragIndex === index ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.2s var(--ease-out-expo)',
                boxShadow:
                  dragOverIndex === index ? `0 0 15px ${accentColor}44` : undefined,
              }}
              whileHover={{
                y: -2,
                borderColor: accentColor,
                boxShadow: `0 4px 20px ${accentColor}22, 0 0 10px ${accentColor}11`,
                transition: { duration: 0.2 },
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (dragIndex !== null) return;
                handleOpen(item);
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--card-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  margin: '0 auto 6px',
                  border: `1px solid ${accentColor}22`,
                  transition: 'all var(--transition-fast)',
                }}
              >
                {item.icon || emptyIcon}
              </div>

              {/* Title */}
              <div
                className="truncate"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  marginBottom: 2,
                }}
              >
                {item.title}
              </div>

              {/* URL */}
              <div
                className="truncate"
                style={{
                  fontSize: '0.6rem',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                }}
              >
                {isSoftware ? item.url : getDomain(item.url)}
              </div>

              {/* Delete button (admin only, on hover) */}
              {isAdmin && (
                <motion.button
                  className="nav-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(item);
                  }}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'rgba(255,51,85,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transform: 'scale(0.7)',
                    transition: 'all 0.2s var(--ease-out-expo)',
                    zIndex: 2,
                    padding: 0,
                    lineHeight: 1,
                  }}
                  whileHover={{ scale: 1.1, background: 'var(--accent-red)' }}
                  title="删除"
                >
                  ×
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {items.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--text-dim)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>{emptyIcon}</div>
          {isAdmin ? `点击 + 添加${title}` : '暂无内容'}
        </motion.div>
      )}

      {/* Add Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={`添加${title}`}
        onConfirm={handleAdd}
        confirmText="添加"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {addError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,51,85,0.1)',
                border: '1px solid rgba(255,51,85,0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-red)',
                fontSize: '0.8rem',
              }}
            >
              {addError}
            </motion.div>
          )}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              名称
            </label>
            <input
              className="input"
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                setAddError('');
              }}
              placeholder="应用名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              URL
            </label>
            <input
              className="input"
              type="text"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                setAddError('');
              }}
              placeholder={isSoftware ? '应用启动路径' : 'https://example.com'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              图标 (emoji，可选)
            </label>
            <input
              className="input"
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="例如: 🎵"
              maxLength={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        onConfirm={confirmDelete}
        confirmText="删除"
        confirmDanger
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          确定要删除 <strong style={{ color: 'var(--accent-cyan)' }}>{deleteTarget?.title}</strong> 吗？此操作不可撤销。
        </p>
      </Modal>

      {/* Inline hover styles for delete button */}
      <style>{`
        .nav-delete-btn {
          opacity: 0 !important;
        }
        [style*="cursor: grab"]:hover .nav-delete-btn,
        [style*="cursor: pointer"]:hover .nav-delete-btn {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
      `}</style>
    </div>
  );
}
