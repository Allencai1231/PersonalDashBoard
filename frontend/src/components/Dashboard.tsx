import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/App";
import { useDashboardData } from "@/hooks/useApi";
import type { NavItem } from "@/types";

import Header from "./Header";
import SearchBar from "./SearchBar";
import NavGrid from "./NavGrid";
import Notebook from "./Notebook";
import MusicPlayer from "./MusicPlayer";

export default function Dashboard() {
  const { setDashboardData, dashboardData } = useAppContext();
  const { data, loading, error, refetch } = useDashboardData();
  const [leftWidth, setLeftWidth] = useState(25);
  const [isResizing, setIsResizing] = useState(false);

  // Sync fetched data to context
  useEffect(() => {
    if (data) {
      setDashboardData(data);
    }
  }, [data, setDashboardData]);

  // Resize handler for draggable divider
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = leftWidth;
      const containerWidth = window.innerWidth;
      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newPct = Math.min(
          50,
          Math.max(15, startWidth + (delta / containerWidth) * 100),
        );
        setLeftWidth(newPct);
      };
      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftWidth],
  );

  // Handle nav item updates from NavGrid
  const handleNavUpdate = useCallback(
    (type: "software" | "websites", items: NavItem[]) => {
      setDashboardData((prev) => {
        if (!prev) return prev;
        return { ...prev, [type]: items };
      });
    },
    [setDashboardData],
  );

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-dark)",
          gap: 20,
        }}
      >
        <motion.div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "3px solid rgba(0,242,255,0.15)",
            borderTopColor: "var(--accent-cyan)",
            boxShadow: "var(--glow-cyan)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.p
          style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          加载控制中心...
        </motion.p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-dark)",
          gap: 16,
        }}
      >
        <motion.div
          style={{
            fontSize: "3rem",
            opacity: 0.5,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          ⚠️
        </motion.div>
        <motion.p
          style={{
            color: "var(--accent-red)",
            fontSize: "0.95rem",
            textAlign: "center",
            maxWidth: 400,
            padding: "0 20px",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {error}
        </motion.p>
        <motion.button
          className="btn btn-primary"
          onClick={refetch}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          重新加载
        </motion.button>
      </div>
    );
  }

  const softwareItems = dashboardData?.software || [];
  const websiteItems = dashboardData?.websites || [];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "var(--bg-dark)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ---- Left Panel ---- */}
      <motion.div
        style={{
          width: `${leftWidth}%`,
          minWidth: 200,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          borderRight: "1px solid var(--card-border)",
          background: "var(--bg-panel)",
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
        }}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <Header />

        {/* SearchBar */}
        <SearchBar />

        {/* Navigation sections */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
          {/* Software */}
          {softwareItems.length > 0 && (
            <NavGrid
              items={softwareItems}
              type="software"
              onUpdate={(items) => handleNavUpdate("software", items)}
            />
          )}

          {/* Websites */}
          {websiteItems.length > 0 && (
            <NavGrid
              items={websiteItems}
              type="websites"
              onUpdate={(items) => handleNavUpdate("websites", items)}
            />
          )}

          {/* If both are empty */}
          {softwareItems.length === 0 && websiteItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-dim)",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 12, opacity: 0.4 }}>
                📋
              </div>
              <p>暂无导航项目</p>
              <p style={{ fontSize: "0.7rem", marginTop: 4 }}>
                (管理员可在配置文件中添加)
              </p>
            </motion.div>
          )}
        </div>

        {/* Bottom width slider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            padding: "8px 20px",
            borderTop: "1px solid var(--card-border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              whiteSpace: "nowrap",
            }}
          >
            宽度
          </span>
          <input
            type="range"
            min={15}
            max={50}
            value={leftWidth}
            onChange={(e) => setLeftWidth(Number(e.target.value))}
            style={{
              flex: 1,
              height: 3,
              appearance: "none",
              background: "var(--card-border)",
              borderRadius: 2,
              outline: "none",
              cursor: "pointer",
              accentColor: "var(--accent-cyan)",
            }}
          />
        </motion.div>
      </motion.div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        style={{
          width: 6,
          cursor: "col-resize",
          background: isResizing ? "rgba(0,242,255,0.3)" : "transparent",
          transition: "background 0.2s",
          flexShrink: 0,
          zIndex: 10,
          position: "relative",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(0,242,255,0.15)";
        }}
        onMouseLeave={(e) => {
          if (!isResizing)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />

      {/* ---- Right Panel ---- */}
      <motion.div
        style={{
          flex: 1,
          height: "100%",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Notebook />
      </motion.div>

      {/* ---- Music Player (always rendered, self-manages visibility) ---- */}
      <MusicPlayer />
    </div>
  );
}
