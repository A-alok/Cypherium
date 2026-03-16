import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin, onShowRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'username': username,
          'password': password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onLogin({
          username: username,
          token: data.access_token
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Login failed');
      }
    } catch (err) {
      // Fallback for demo if backend is not reachable
      console.log('Backend unreachable, using local mock');
      setTimeout(() => {
        onLogin({
          username: username,
          token: 'sample-jwt-token'
        });
      }, 500);
    }
  };

  return (
    <div className="auth-container">
      <nav className="navbar-clean" style={{ position: 'absolute', top: 0, width: '100%' }}>
        <div className="logo-clean">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Cypherium
        </div>
      </nav>

      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your cybersecurity assistant</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="jane_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <div className="auth-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>

          <button type="submit" className="btn-pill btn-pill-primary w-100">
            Sign In
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <span className="text-link" onClick={onShowRegister}>Sign Up</span>
        </div>
      </div>
    </div>
  );
};

export default Login;