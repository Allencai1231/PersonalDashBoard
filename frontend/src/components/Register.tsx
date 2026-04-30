import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppContext } from '@/App';

export default function Register() {
  const { register } = useAppContext();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    if (password.length < 4) {
      setError('密码长度至少4位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await register(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }, [username, password, confirmPassword, register, navigate]);

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
          background: 'radial-gradient(circle, rgba(189,0,255,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          top: '10%',
          right: '5%',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,242,255,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          bottom: '10%',
          left: '5%',
        }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
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
              创建新账户
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Join Allencai's Command Center
            </p>
          </motion.div>

          {/* Error */}
          {error && (
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
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <motion.div
              style={{ marginBottom: 16 }}
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
                用户名
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
              style={{ marginBottom: 16 }}
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
                密码
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少4位密码"
                autoComplete="new-password"
              />
            </motion.div>

            <motion.div
              style={{ marginBottom: 28 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
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
                确认密码
              </label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </motion.div>

            <motion.button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginBottom: 20 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? '注册中...' : '注册'}
            </motion.button>
          </form>

          <motion.div
            style={{ textAlign: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              已有账户？
            </span>{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--accent-purple)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              去登录
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
