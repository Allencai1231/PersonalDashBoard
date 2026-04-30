import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
  hideCancel?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = "确定",
  cancelText = "取消",
  confirmDanger = false,
  hideCancel = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && onConfirm) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, onConfirm]);

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="image-preview-overlay"
          style={{ zIndex: 15000 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="glass-strong"
            style={{
              width: "90vw",
              maxWidth: 500,
              padding: 0,
              overflow: "hidden",
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--card-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "var(--accent-cyan)",
                  textShadow: "0 0 10px rgba(0,242,255,0.3)",
                }}
              >
                {title}
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={onClose}
                style={{ fontSize: "1.2rem", color: "var(--text-dim)" }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: "20px 24px",
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              {children}
            </div>
            {onConfirm && (
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                {!hideCancel && (
                  <button className="btn" onClick={onClose}>
                    {cancelText}
                  </button>
                )}
                <button
                  className={
                    confirmDanger ? "btn btn-danger" : "btn btn-primary"
                  }
                  onClick={onConfirm}
                >
                  {confirmText}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
