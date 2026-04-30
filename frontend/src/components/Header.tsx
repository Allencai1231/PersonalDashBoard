import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/App";

function getWeekday(day: number): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[day] || "?";
}

function getGreeting(hour: number): string {
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function Header() {
  const { userInfo, logout } = useAppContext();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Silently fail
    }
  }, [logout]);

  const timeStr = useMemo(() => {
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }, [now]);

  const dateStr = useMemo(() => {
    return `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 星期${getWeekday(now.getDay())}`;
  }, [now]);

  const greeting = useMemo(() => getGreeting(now.getHours()), [now]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Top row: greeting + user info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <span
            className="neon-cyan"
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              animation: "neonFlicker 6s infinite",
            }}
          >
            {greeting}
          </span>
          {userInfo && (
            <span
              style={{
                marginLeft: 12,
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              , {userInfo.username}
              {userInfo.role === "admin" && (
                <span
                  className="neon-purple"
                  style={{
                    marginLeft: 8,
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    border: "1px solid var(--accent-purple-dim)",
                    verticalAlign: "middle",
                  }}
                >
                  ADMIN
                </span>
              )}
            </span>
          )}
        </motion.div>

        {/* Logout button */}
        <motion.button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}
          whileHover={{ color: "var(--accent-red)" }}
        >
          退出登录
        </motion.button>
      </div>

      {/* Digital Clock */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: "linear-gradient(135deg, #00f2ff 0%, #bd00ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 20px rgba(0,242,255,0.3))",
          }}
        >
          {timeStr.split("").map((char, i) =>
            char === ":" ? (
              <span
                key={i}
                style={{
                  animation: "pulse 1s ease-in-out infinite",
                  display: "inline-block",
                }}
              >
                :
              </span>
            ) : (
              <span key={i}>{char}</span>
            ),
          )}
        </span>
      </motion.div>

      {/* Date */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.95rem",
          letterSpacing: "0.04em",
          fontFamily: "var(--font-sans)",
        }}
      >
        {dateStr}
      </motion.p>

      {/* Divider */}
      <div className="divider" style={{ marginTop: 4 }} />
    </motion.div>
  );
}
