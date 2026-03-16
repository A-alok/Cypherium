import React, { useState, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [emergencyMode, setEmergencyMode] = useState(null);
  const [emergencyStep, setEmergencyStep] = useState(0);
  const [currentRecIdx, setCurrentRecIdx] = useState(0);
  const [scanInput, setScanInput] = useState('');
  const [breachInput, setBreachInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Cypherium AI. How can I help you stay safe today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [riskScore, setRiskScore] = useState(0);
  const [riskStatus, setRiskStatus] = useState('low');
  const [scanHistory, setScanHistory] = useState([]);
  const [riskFactors, setRiskFactors] = useState([0, 0, 0, 0]);
  const [platformInsights, setPlatformInsights] = useState({
    web: { scans: 0, risks: 0 },
    browserExtension: { scans: 0, risks: 0 }
  });
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Fetch Risk Score and Factors
        const riskRes = await fetch(`http://localhost:8000/risk/score?token=${token}`);
        if (riskRes.ok) {
          const data = await riskRes.json();
          setRiskScore(data.score);
          setRiskStatus(data.status);
          setRecommendations(data.recommendations || []);
          
          if (data.factors) {
            setRiskFactors([
              data.factors.breach_risk.score * 100,
              data.factors.malicious_urls.score * 100,
              data.factors.suspicious_messages.score * 100,
              data.factors.password_risk.score * 100
            ]);
          }
          
          if (data.platform_insights) {
            setPlatformInsights(data.platform_insights);
          }
        }

        // Fetch Scan History
        const historyRes = await fetch(`http://localhost:8000/scan/history?token=${token}`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setScanHistory(historyData);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Sync token with extension
    if (window.chrome && window.chrome.runtime) {
      window.chrome.runtime.sendMessage('mpibfmkfngfclkhjgmjnhndgpkfomclg', { 
        action: 'syncToken', 
        token: localStorage.getItem('token') 
      }, response => {
        if (window.chrome.runtime.lastError) {
          console.log('Extension not installed or detected');
        } else {
          console.log('Token synced with extension');
        }
      });
    }
  }, []);

  const riskData = {
    labels: ['Breach Risk', 'Malicious URLs', 'Suspicious Messages', 'Password Risk'],
    datasets: [
      {
        label: 'Risk Factors',
        data: riskFactors,
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const platformData = {
    labels: ['Web', 'Browser Extension'],
    datasets: [
      {
        label: 'Risk Distribution',
        data: [
          platformInsights.web.risks * 100,
          platformInsights.browser_extension?.risks * 100 || 0
        ],
        backgroundColor: [
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(153, 102, 255, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const scoreData = {
    labels: ['Your Score'],
    datasets: [
      {
        label: 'Safety Score',
        data: [riskScore],
        backgroundColor: riskStatus === 'red' ? 'rgba(255, 99, 132, 0.6)' : 
                       riskStatus === 'yellow' ? 'rgba(255, 206, 86, 0.6)' : 
                       'rgba(75, 192, 192, 0.6)',
        borderColor: riskStatus === 'red' ? 'rgba(255, 99, 132, 1)' : 
                       riskStatus === 'yellow' ? 'rgba(255, 206, 86, 1)' : 
                       'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const scoreOptions = {
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const [selectedIncident, setSelectedIncident] = useState(null);

  const viewGuidance = (scan) => {
    setSelectedIncident(scan);
  };

  const nextRec = () => {
    setCurrentRecIdx((prev) => (prev + 1) % recommendations.length);
  };

  const prevRec = () => {
    setCurrentRecIdx((prev) => (prev - 1 + recommendations.length) % recommendations.length);
  };

  const runQuickScan = async (type, content) => {
    if (!content) return;
    setIsScanning(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('http://localhost:8000/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: type, content, token })
      });
      
      if (res.ok) {
        const result = await res.json();
        // Set as selected incident to show the guidance modal automatically
        setSelectedIncident({
          scan_type: type,
          content: content,
          result: result,
          timestamp: new Date().toISOString()
        });
        
        // Clear inputs
        if (type === 'url') setScanInput('');
        if (type === 'email') setBreachInput('');
        if (type === 'message') setMessageInput('');
        
        // Refresh history
        const historyRes = await fetch(`http://localhost:8000/scan/history?token=${token}`);
        if (historyRes.ok) setScanHistory(await historyRes.json());
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);
    
    try {
      const res = await fetch('http://localhost:8000/risk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: chatInput, 
          history: chatMessages 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (err) {
      console.error('Chat failed:', err);
    } finally {
      setIsChatting(false);
    }
  };

  if (loading) return <div className="loading">Loading security profile...</div>;

  return (
    <div className="dashboard-container">
      {/* Incident Guidance Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Incident Investigation: {selectedIncident.scan_type.toUpperCase()}</h2>
              <button className="close-modal" onClick={() => setSelectedIncident(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="incident-summary">
                <p><strong>Detected:</strong> {selectedIncident.result?.prediction.toUpperCase()}</p>
                <p><strong>Content:</strong> {selectedIncident.content}</p>
              </div>
              <h3 style={{color: 'var(--text-dark)'}}>Step-by-Step Guidance</h3>
              <ul className="guidance-list">
                {selectedIncident.result?.guidance?.length > 0 ? (
                  selectedIncident.result.guidance.map((step, i) => (
                    <li key={i} className="guidance-step">
                      <span className="step-number">{i + 1}</span> {step}
                    </li>
                  ))
                ) : (
                  <li className="guidance-step">No specific guidance available for this incident.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modern Glass Sidebar */}
      <aside className="sidebar glass-card">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="logo-text">Cypherium</span>
        </div>

        <nav className="side-nav">
          <button 
            className={`side-link ${activeTab === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overview')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Overview
          </button>
          <button 
            className={`side-link ${activeTab === 'assistant' ? 'active' : ''}`} 
            onClick={() => setActiveTab('assistant')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            AI Assistant
          </button>
          <button 
            className={`side-link ${activeTab === 'scans' ? 'active' : ''}`} 
            onClick={() => setActiveTab('scans')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Scans
          </button>
          <button 
            className={`side-link ${activeTab === 'settings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="profile-icon">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <span className="u-name">{user?.username || 'User'}</span>
              <span className="u-status">Pro Active</span>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </aside>

      <div className="dashboard-content">
        <header className="content-header">
          <div className="search-bar glass-card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Search threats, logs, or devices..." />
          </div>
          <div className="header-actions">
            <div className="notification-bell glass-card">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span className="bell-dot"></span>
            </div>
          </div>
        </header>

      {activeTab === 'overview' ? (
        <main className="dash-main">
          <div className="dash-header">
            <h2>Overview</h2>
            <p className="dash-subtitle">Your digital security snapshot.</p>
          </div>

          <div className="dash-grid">
          <section className="glass-card dash-card">
            <h3>Security Health</h3>
            <div className="chart-container" style={{ margin: '1rem 0' }}>
              <div style={{ height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Bar data={scoreData} options={{ ...scoreOptions, maintainAspectRatio: false }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <div className="result-tag" style={{
                  display: 'inline-block', 
                  fontSize: '1.25rem', padding: '0.5rem 1.5rem', marginBottom: '0.5rem',
                  backgroundColor: riskStatus === 'red' ? 'rgba(239, 68, 68, 0.1)' : riskStatus === 'yellow' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: riskStatus === 'red' ? 'var(--color-red)' : riskStatus === 'yellow' ? 'var(--color-amber)' : 'var(--color-emerald)'
                }}>
                {riskScore}/100 Risk
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                {riskStatus === 'red' 
                  ? 'High risk detected. Take immediate action to improve your security.' 
                  : riskStatus === 'yellow' 
                  ? 'Moderate risk. Review your security practices.' 
                  : 'Good security practices. Keep up the good work!'}
              </p>
            </div>
          </section>

          <section className="glass-card dash-card">
            <h3>Risk Factors Profile</h3>
            <div className="chart-container">
              <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={riskData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </section>
        </div>

        <div className="dash-grid">
          <section className="glass-card dash-card">
            <h3>Threat Distribution</h3>
            <div className="chart-container">
              <div style={{ height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Doughnut data={platformData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </section>

          <section className="glass-card dash-card rec-carousel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Security Strategy</h3>
              {recommendations.length > 1 && (
                <div className="carousel-controls">
                  <button onClick={prevRec} className="carousel-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button onClick={nextRec} className="carousel-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              )}
            </div>
            
            <div className="carousel-container">
              {recommendations.length > 0 ? (
                <div className={`carousel-slide animation-fade-in ${recommendations[currentRecIdx].type}`}>
                  <div className="slide-content">
                    <div className="rec-badge">{recommendations[currentRecIdx].type.toUpperCase()}</div>
                    <h4>{recommendations[currentRecIdx].title}</h4>
                    <p>{recommendations[currentRecIdx].description}</p>
                  </div>
                </div>
              ) : (
                <div className="recommendation-item">No urgent actions required.</div>
              )}
            </div>

            {recommendations.length > 1 && (
              <div className="carousel-dots">
                {recommendations.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`dot ${idx === currentRecIdx ? 'active' : ''}`}
                    onClick={() => setCurrentRecIdx(idx)}
                  ></div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="glass-card dash-card">
          <h3>Incident History</h3>
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Monitor</th>
                  <th>Content Detail</th>
                  <th>Risk Status</th>
                  <th>Detected At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.length > 0 ? scanHistory.map((scan) => (
                  <tr key={scan.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{scan.scan_type.toUpperCase()}</td>
                    <td className="content-cell">{scan.content}</td>
                    <td>
                      <span className={`result-tag ${scan.result?.prediction === 'safe' ? 'tag-safe' : 'tag-danger'}`}>
                        {scan.result?.prediction || 'Unknown'}
                      </span>
                    </td>
                    <td className="date-cell">{new Date(scan.timestamp).toLocaleString()}</td>
                    <td>
                      {scan.result?.prediction !== 'safe' && (
                        <button className="guidance-btn" onClick={() => viewGuidance(scan)}>View Guidance</button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{textAlign: 'center', color: 'var(--text-secondary)' }}>No scan history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      ) : activeTab === 'scans' ? (
      <main className="dash-main animation-fade-in">
        <div className="dash-header">
          <h2>Unified Threat Scanner</h2>
          <p className="dash-subtitle">Standalone analysis for URLs, Emails, and Messages.</p>
        </div>

        <div className="dash-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Extension Promo Card */}
          <section className="glass-card dash-card promo-card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, var(--color-indigo), var(--color-blue))', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5rem' }}>
            <div style={{ maxWidth: '60%' }}>
              <h2 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.8rem' }}>Real-time Protection is Missing</h2>
              <p style={{ opacity: 0.9, marginBottom: '1.5rem', lineHeight: 1.6 }}>While this dashboard lets you scan threats manually, only the Cypherium Browser Extension can block phishing sites <b>before</b> they load and scan your WhatsApp/Gmail messages as they arrive.</p>
              <button className="btn-pill" style={{ background: 'white', color: 'var(--color-indigo)', padding: '0.75rem 2rem', fontWeight: 800 }}>Download Extension</button>
            </div>
            <div className="promo-visual">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </section>

          {/* Quick Scanners */}
          <section className="glass-card dash-card">
            <h3>URL & File Reputation</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Deep-scan links or file hashes against our reputation database.</p>
            <div className="scanner-input-group">
              <input 
                type="text" 
                placeholder="Paste URL or hash here..." 
                className="scanner-input" 
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
              />
              <button 
                className="btn-pill btn-primary" 
                onClick={() => runQuickScan('url', scanInput)}
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Scan Link'}
              </button>
            </div>
          </section>

          <section className="glass-card dash-card">
            <h3>Identity Breach Check</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Check if your email or phone number has been leaked in any breaches.</p>
            <div className="scanner-input-group">
              <input 
                type="text" 
                placeholder="Enter email or phone..." 
                className="scanner-input" 
                value={breachInput}
                onChange={(e) => setBreachInput(e.target.value)}
              />
              <button 
                className="btn-pill btn-primary"
                onClick={() => runQuickScan('email', breachInput)}
                disabled={isScanning}
              >
                {isScanning ? 'Checking...' : 'Verify Identity'}
              </button>
            </div>
          </section>

          <section className="glass-card dash-card" style={{ gridColumn: 'span 2' }}>
            <h3>Message Intelligence</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Analyze suspicious messages from SMS, WhatsApp, or Telegram for social engineering patterns.</p>
            <textarea 
              placeholder="Paste the suspicious message content here..." 
              className="scanner-textarea" 
              rows="4"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            ></textarea>
            <button 
              className="btn-pill btn-primary" 
              style={{ marginTop: '1rem', width: '200px' }}
              onClick={() => runQuickScan('message', messageInput)}
              disabled={isScanning}
            >
              {isScanning ? 'Analyzing...' : 'Analyze Message'}
            </button>
          </section>
        </div>
      </main>
      ) : activeTab === 'settings' ? (
      <main className="dash-main animation-fade-in">
        <div className="dash-header">
          <h2>Account Settings</h2>
          <p className="dash-subtitle">Configure your privacy preferences and security alerts.</p>
        </div>

        <div className="settings-grid">
          <section className="glass-card dash-card">
            <h3>Notification Preferences</h3>
            <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.05)' }}>
              <div className="setting-info" style={{ maxWidth: '80%' }}>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>Critical Email Alerts</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Receive immediate alerts when your data is found in a new breach or if a high-risk login occurs.</p>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={emailNotifications} 
                  onChange={() => setEmailNotifications(!emailNotifications)} 
                />
                <span className="slider round"></span>
              </label>
            </div>
            
            <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="setting-info" style={{ maxWidth: '80%' }}>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>Weekly Safety Report</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>A summary of your security posture and improvement suggestions emailed every Monday.</p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
          </section>

          <section className="glass-card dash-card">
            <h3>Privacy Control</h3>
            <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="setting-info" style={{ maxWidth: '80%' }}>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>Anonymous Threat Sharing</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Share metadata of blocked threats to help the Cypherium community. No personal data is ever shared.</p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
          </section>
        </div>
      </main>
      ) : (
      <main className="dash-main animation-fade-in">
        <div className="dash-header">
          <h2>AI Security Assistant</h2>
          <p className="dash-subtitle">Personalized recommendations and 24/7 expert incident response.</p>
        </div>

        <div className="dash-grid">
          {/* Left Column: Personalized Actions */}
          <section className="glass-card dash-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3>Personalized Recommendations</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.5rem' }}>Based on your recent habits and hardware telemetry.</p>
            </div>

            {recommendations.length > 0 ? recommendations.map((rec, idx) => (
              <div key={idx} className={`action-item ${rec.type}`}>
                <div className="action-icon">
                  {rec.type === 'critical' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  ) : rec.type === 'warning' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  )}
                </div>
                <div className="action-text">
                  <h4>{rec.title}</h4>
                  <p>{rec.description}</p>
                </div>
                <button className="btn-pill" style={{ width: 'auto', padding: '0.5rem 1rem', background: rec.type === 'critical' ? 'var(--text-dark)' : 'rgba(15, 23, 42, 0.05)', color: rec.type === 'critical' ? 'white' : 'inherit' }}>
                  {rec.type === 'critical' ? 'Fix Now' : 'Details'}
                </button>
              </div>
            )) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Scanning for system insights...</p>
            )}
          </section>

          {/* Right Column: Incident Guidance & Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* AI Chatbot Section */}
            <section className="glass-card dash-card chat-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
              <h3>Cypherium AI Chat</h3>
              <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', padding: '0.5rem' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role}`}>
                    {msg.content}
                  </div>
                ))}
                {isChatting && <div className="chat-bubble assistant">Thinking...</div>}
              </div>
              <div className="chat-input-area" style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Ask about phishing, passwords, or threats..." 
                  className="scanner-input" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button className="btn-icon" onClick={sendMessage} disabled={isChatting}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </section>

            {/* Existing Incident Guidance below chat if needed, but the user asked for chatbot in AI assistant */}
            <section className="glass-card dash-card" style={{ background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.03), rgba(15, 23, 42, 0.01))', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--color-red)', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px var(--color-red)' }}></span>
                Instant Incident Guidance
              </h3>
              
              {!emergencyMode ? (
              <div className="emergency-start">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--color-red)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  </div>
                  <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>Under Attack? I'm here to help.</h4>
                  <p style={{ color: 'var(--text-secondary)' }}>Select your scenario below. I will walk you through exactly what to do, step-by-step, to secure your digital life.</p>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <button className="emergency-btn" onClick={() => { setEmergencyMode('hacked'); setEmergencyStep(0); }}>
                    My account was compromised/hacked <span style={{color: 'var(--color-red)'}}>➔</span>
                  </button>
                  <button className="emergency-btn" onClick={() => { setEmergencyMode('phishing'); setEmergencyStep(0); }}>
                    I clicked a suspicious phishing link <span style={{color: 'var(--color-red)'}}>➔</span>
                  </button>
                  <button className="emergency-btn" onClick={() => { setEmergencyMode('device'); setEmergencyStep(0); }}>
                    I lost my phone or laptop <span style={{color: 'var(--color-red)'}}>➔</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="emergency-wizard">
                <button onClick={() => setEmergencyMode(null)} className="back-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Abort Rescue Session
                </button>
                
                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <h4 style={{ color: 'var(--color-red)', fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>Incident Protocol: {emergencyMode.toUpperCase()}</h4>
                  <p style={{ fontWeight: 500, margin: 0, color: 'var(--text-dark)' }}>Stay calm. We will fix this together. Follow these steps exactly.</p>
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                  {[0, 1, 2].map(step => (
                    <div key={step} style={{ height: '6px', flex: 1, borderRadius: '3px', background: step <= emergencyStep ? 'var(--color-red)' : 'rgba(239, 68, 68, 0.15)', transition: 'all 0.3s' }}></div>
                  ))}
                </div>

                <div className="wizard-step">
                  {emergencyStep === 0 && (
                    <div className="animation-slide-up">
                      <h5 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem 0' }}>Step 1: Isolate the Threat</h5>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>Immediately disconnect your device from the internet (turn off WiFi and unplug ethernet). This stops remote attackers from maintaining a connection or exfiltrating more data while you secure accounts on a secondary safe device.</p>
                      <button className="btn-pill" style={{ width: '100%', background: 'var(--color-red)', color: 'white' }} onClick={() => setEmergencyStep(1)}>I have disabled the internet</button>
                    </div>
                  )}
                  {emergencyStep === 1 && (
                    <div className="animation-slide-up">
                      <h5 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem 0' }}>Step 2: Secure Master Account</h5>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>Using a different, safe device (like your phone on cellular data), immediately change the password to your primary Email Account. This is the master key to all your other accounts. Ensure 2FA is active.</p>
                      <button className="btn-pill" style={{ width: '100%', background: 'var(--color-red)', color: 'white' }} onClick={() => setEmergencyStep(2)}>Primary email is secured</button>
                    </div>
                  )}
                  {emergencyStep === 2 && (
                    <div className="animation-slide-up">
                      <h5 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem 0' }}>Step 3: Freeze Financials</h5>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>Contact your bank immediately to pause any linked credit/debit cards. Setup automated fraud alerts with Equifax, Experian, and TransUnion (We can automate this for you if you link your SSN securely).</p>
                      <button className="btn-pill" style={{ width: '100%', background: 'var(--color-emerald)', color: 'white' }} onClick={() => { setEmergencyStep(0); setEmergencyMode(null); setActiveTab('overview'); }}>Complete Rescue Protocol</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
    )}
      </div>
    </div>
  );
};

export default Dashboard;