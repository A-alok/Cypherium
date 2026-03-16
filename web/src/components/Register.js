import React, { useState } from 'react';
import './Login.css'; // Reusing Login styles for consistency

const Register = ({ onRegister, onBackToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Simple password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const strengthScore = getPasswordStrength();
  const strengthColors = ['#e2e8f0', '#ef4444', '#f59e0b', '#10b981', '#10b981'];
  const strengthText = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          email, 
          password 
        }),
      });

      if (response.ok) {
        // After registration, we might want to log them in automatically
        const data = await response.json();
        onRegister({
          username: data.username,
          email: data.email,
          token: 'sample-jwt-token-after-reg'
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Registration failed');
      }
    } catch (err) {
      // Fallback for demo if backend is not reachable
      console.log('Backend unreachable, using local mock');
      setTimeout(() => {
        onRegister({
          username,
          email,
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
        <div className="auth-header" style={{ marginBottom: '1.5rem' }}>
          <div className="auth-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </div>
          <h2 className="auth-title">Create Your Account</h2>
          <p className="auth-subtitle">Join Cypherium to protect your digital life</p>
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
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
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
          
          {/* Password Strength Indicator */}
          {password && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', gap: '4px', height: '4px' }}>
                {[1, 2, 3, 4].map(level => (
                  <div key={level} style={{
                    flex: 1,
                    backgroundColor: strengthScore >= level ? strengthColors[strengthScore] : '#e2e8f0',
                    borderRadius: '2px',
                    transition: 'background-color 0.3s'
                  }}></div>
                ))}
              </div>
              <span style={{ fontSize: '0.75rem', color: strengthColors[strengthScore], fontWeight: 500, minWidth: '40px' }}>
                {strengthText[strengthScore]}
              </span>
            </div>
          )}
          {!password && <div style={{ marginBottom: '1.5rem' }}></div>}

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn-pill btn-pill-primary w-100" style={{ marginTop: '0.5rem' }}>
            Create Account
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
          Already have an account? <span className="text-link" onClick={onBackToLogin}>Sign In</span>
        </div>
      </div>
    </div>
  );
};

export default Register;
