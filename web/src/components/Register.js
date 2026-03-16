import React, { useState } from 'react';
import './Login.css'; // Reusing Login styles for consistency

const Register = ({ onRegister, onBackToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

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
    <div className="login-container">
      <div className="login-form">
        <h2>Safety Assistant Registration</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">Register</button>
        </form>
        <div className="login-footer">
          Already have an account? <button onClick={onBackToLogin} className="link-button">Login here</button>
        </div>
      </div>
    </div>
  );
};

export default Register;
