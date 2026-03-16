import React from 'react';
import './LandingPage.css';

const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      <nav className="landing-navbar">
        <div className="landing-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Cypherium
        </div>
        <div className="nav-actions">
          <button className="nav-btn-link" onClick={onGetStarted}>Sign In</button>
          <button className="nav-btn-pill" onClick={onGetStarted}>Get Started</button>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="hero-content animation-fade-in">
          <div className="hero-badge">AI-POWERED PROTECTION</div>
          <h1>Security that feels <br/><span className="gradient-text">Weightless.</span></h1>
          <p className="hero-subtitle">
            Experience the next generation of personal cybersecurity. Cypherium uses advanced AI to protect your digital life across all devices, silently and effectively.
          </p>
          <div className="hero-cta">
            <button className="btn-pill-primary btn-large" onClick={onGetStarted}>
              Deploy Protection — It's Free
            </button>
            <div className="hero-stats">
              <div className="stat"><strong>10k+</strong> Users</div>
              <div className="stat"><strong>1M+</strong> Threats Blocked</div>
            </div>
          </div>
        </div>
        
        <div className="hero-visual animation-float">
          <div className="visual-card-wrapper">
            <div className="glass-card visual-card">
              <div className="card-header">
                <div className="indicator green"></div>
                <span>Scanning System...</span>
              </div>
              <div className="threat-item">
                <div className="icon warning">⚠️</div>
                <div className="text">
                  <strong>Phishing Attempt Blocked</strong>
                  <p>Suspicious link in WhatsApp message neutralized.</p>
                </div>
              </div>
              <div className="threat-item">
                <div className="icon success">🛡️</div>
                <div className="text">
                  <strong>Encrypted Connection</strong>
                  <p>Active protection enabled for Gmail.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="features-grid">
        <div className="feature-card glass-card">
          <div className="feature-icon indigo">🤖</div>
          <h3>AI Threat Intelligence</h3>
          <p>Real-time analysis of messages and URLs using state-of-the-art neural networks.</p>
        </div>
        <div className="feature-card glass-card">
          <div className="feature-icon pink">🔍</div>
          <h3>Unified Scanner</h3>
          <p>One dashboard to rule them all. Scan emails, messages, and files from a single source.</p>
        </div>
        <div className="feature-card glass-card">
          <div className="feature-icon cyan">🧠</div>
          <h3>Behavior Analysis</h3>
          <p>Establish a baseline for your security hygiene and get personalized advice.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>&copy; 2026 Cypherium. Built for the future of privacy.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
