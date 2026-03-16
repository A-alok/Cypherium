import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Check if user is already logged in (from localStorage or session)
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      // In a real app, you would verify the token with the backend
      setIsLoggedIn(true);
      // Set user data from token or API call
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    // Store token and user in localStorage
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    // Remove items from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const toggleAuthMode = () => {
    setShowRegister(!showRegister);
  };

  return (
    <div className="App">
      {/* Global Background Orbs & Particles */}
      <div className="bg-particles">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
        <div className="orb orb-5"></div>
        <div className="orb orb-6"></div>
        <div className="orb orb-7"></div>
        <div className="dots-container">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 1, height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {isLoggedIn ? (
          <Dashboard user={user} onLogout={handleLogout} />
        ) : showRegister ? (
          <Register onRegister={handleLogin} onBackToLogin={toggleAuthMode} />
        ) : (
          <Login onLogin={handleLogin} onShowRegister={toggleAuthMode} />
        )}
      </div>
    </div>
  );
}

export default App;