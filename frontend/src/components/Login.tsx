import React, { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppContext } from '@/App';

export default function Login() {
  const { login, userError } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }, [username, password, login, navigate, from]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <motion.div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,242,255,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          top: '10%',
          left: '5%',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(189,0,255,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          bottom: '10%',
          right: '5%',
        }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="glow-border-animated"
        style={{
          width: '90vw',
          maxWidth: 420,
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          zIndex: 1,
        }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="glass"
          style={{
            padding: '40px 32px',
            borderRadius: 'calc(var(--radius-xl) - 2px)',
          }}
        >
          {/* Title */}
          <motion.div
            style={{ textAlign: 'center', marginBottom: 32 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                background: 'var(--gradient-cyan-purple)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 8,
              }}
            >
              Allencai&apos;s Command Center
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Welcome back
            </p>
          </motion.div>

          {/* Error */}
          {(error || userError) && (
            <motion.div
              style={{
                padding: '10px 16px',
                background: 'rgba(255,51,85,0.1)',
                border: '1px solid rgba(255,51,85,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-red)',
                fontSize: '0.85rem',
                marginBottom: 20,
              }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error || userError}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <motion.div
              style={{ marginBottom: 20 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                👤 用户名
              </label>
              <input
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
                autoFocus
              />
            </motion.div>

            <motion.div
              style={{ marginBottom: 28 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                🔑 密码
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </motion.div>

            <motion.button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginBottom: 20 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? '加载中...' : '登录'}
            </motion.button>
          </form>

          <motion.div
            style={{ textAlign: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              还没有账户？
            </span>{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--accent-cyan)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              注册新账户
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
