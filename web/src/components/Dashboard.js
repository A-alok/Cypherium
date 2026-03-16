import React, { useState, useEffect, useCallback } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import './Dashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement, Filler
);

const API = 'http://localhost:8000';

// ── helper: severity color ──────────────────────────────────────────────────
const severityColor = (s) =>
  s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#3b82f6';

// ── Components ──

const AnomalyBanner = ({ anomalies, onDismiss }) => {
  if (!anomalies || anomalies.length === 0) return null;
  return (
    <div className="anomaly-banner">
      <div className="anomaly-banner-icon">⚠️</div>
      <div className="anomaly-banner-text">
        <strong>{anomalies.length} suspicious activity detected</strong>
        <span>Check your behavior analysis tab for details.</span>
      </div>
      <button className="anomaly-banner-dismiss" onClick={onDismiss}>×</button>
    </div>
  );
};

const StatCard = ({ label, value, icon, color, sub }) => (
  <div className="stat-card" style={{ borderTopColor: color }}>
    <span className="stat-icon">{icon}</span>
    <div className="stat-body">
      <span className="stat-value" style={{ color }}>{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  </div>
);

const AnomalyList = ({ anomalies, token, onRefresh }) => {
  const acknowledge = async (id, isFP) => {
    try {
      await fetch(`${API}/behavior/anomalies/${id}/acknowledge?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_false_positive: isFP, feedback: isFP ? 'User marked as false positive' : 'User confirmed' })
      });
      onRefresh();
    } catch (e) {
      console.error('Acknowledge error:', e);
    }
  };

  if (!anomalies || anomalies.length === 0) {
    return <div className="empty-state"><p>No active anomalies detected.</p></div>;
  }

  return (
    <ul className="anomaly-list">
      {anomalies.map((a) => (
        <li key={a._id || a.id} className="anomaly-item">
          <div className="anomaly-severity" style={{ background: severityColor(a.severity) }}>{a.severity?.toUpperCase()}</div>
          <div className="anomaly-details">
            <strong>{a.anomaly_type?.replace(/_/g, ' ') || 'Unknown'}</strong>
            <p>{a.description}</p>
          </div>
          <div className="anomaly-actions">
            <button className="btn-safe" onClick={() => acknowledge(a._id || a.id, true)}>Safe</button>
            <button className="btn-flag" onClick={() => acknowledge(a._id || a.id, false)}>Confirm</button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const SessionTimeline = ({ sessions }) => {
  if (!sessions || sessions.length === 0) return <p>No sessions recorded.</p>;
  return (
    <div className="session-timeline">
      {sessions.slice(0, 5).map((s, i) => (
        <div key={i} className={`session-entry ${s.is_anomaly ? 'anomalous' : ''}`}>
          <span className="session-time">{new Date(s.login_time).toLocaleString()}</span>
          <span className="session-loc">{s.location_country || 'Unknown'} · {s.ip_address}</span>
        </div>
      ))}
    </div>
  );
};

const BaselinePanel = ({ baseline }) => {
  if (!baseline || baseline.status === 'insufficient_data') return <p>Learning your patterns...</p>;
  return <p>Security baseline established based on your typical login activity.</p>;
};

// ── Main Dashboard ──

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [scanHistory, setScanHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [riskFactors, setRiskFactors] = useState({ breachRisk: 0, maliciousUrls: 0, suspiciousMessages: 0, passwordRisk: 0 });
  const [platformInsights, setPlatformInsights] = useState({ web: { scans: 0, risks: 0 }, browserExtension: { scans: 0, risks: 0 } });

  // Behavior state
  const [behaviorSummary, setBehaviorSummary] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [loadingBehavior, setLoadingBehavior] = useState(false);

  // Incident state
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  // Assistant & Scanner State
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

  const token = localStorage.getItem('token');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, historyRes, summaryRes, anomalyRes, sessionRes, baselineRes, incidentsRes] = await Promise.all([
        fetch(`${API}/risk/score?token=${token}`),
        fetch(`${API}/scan/history?token=${token}`),
        fetch(`${API}/behavior/summary?token=${token}`),
        fetch(`${API}/behavior/anomalies?token=${token}`),
        fetch(`${API}/behavior/sessions?limit=10&token=${token}`),
        fetch(`${API}/behavior/baseline?token=${token}`),
        fetch(`${API}/incident/active?token=${token}`)
      ]);

      if (scoreRes.ok) {
        const d = await scoreRes.json();
        setRiskScore(d.score || 0);
        setRecommendations(d.recommendations || []);
        if (d.factors) {
          setRiskFactors({
            breachRisk: (d.factors.breach_risk?.score || 0) * 100,
            maliciousUrls: (d.factors.malicious_urls?.score || 0) * 100,
            suspiciousMessages: (d.factors.suspicious_messages?.score || 0) * 100,
            passwordRisk: (d.factors.password_risk?.score || 0) * 100
          });
        }
      }
      if (historyRes.ok) setScanHistory(await historyRes.json());
      if (summaryRes.ok) setBehaviorSummary(await summaryRes.json());
      if (anomalyRes.ok) setAnomalies(await anomalyRes.json());
      if (sessionRes.ok) setSessions(await sessionRes.json());
      if (baselineRes.ok) setBaseline(await baselineRes.json());
      if (incidentsRes.ok) setIncidents(await incidentsRes.json());

    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReportIncident = async (type, desc) => {
    try {
      await fetch(`${API}/incident/report?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_type: type, description: desc })
      });
      fetchData();
      setActiveTab('incidents');
    } catch (e) {
      console.error('Failed to report incident:', e);
    }
  };

  const handleStepToggle = async (incidentId, stepId, completed) => {
    try {
      await fetch(`${API}/incident/${incidentId}/step?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepId, completed: completed })
      });
      fetchData();
    } catch (e) {
      console.error('Failed to toggle step:', e);
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      await fetch(`${API}/incident/${incidentId}/resolve?token=${token}`, { method: 'POST' });
      fetchData();
    } catch (e) {
      console.error('Failed to resolve incident:', e);
    }
  };

  const runQuickScan = async (type, content) => {
    if (!content) return;
    setIsScanning(true);
    try {
      const res = await fetch(`${API}/scan/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: type, content, token })
      });
      if (res.ok) {
        fetchData();
        setScanInput(''); setBreachInput(''); setMessageInput('');
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
      const res = await fetch(`${API}/risk/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput, history: chatMessages })
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

  // Charts
  const riskData = {
    labels: ['Breach', 'URLs', 'Messages', 'Password'],
    datasets: [{
      data: [riskFactors.breachRisk, riskFactors.maliciousUrls, riskFactors.suspiciousMessages, riskFactors.passwordRisk],
      backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(59,130,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
      borderColor: ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'],
      borderWidth: 2,
    }]
  };

  const scoreLevel = riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low';
  const scoreColor = scoreLevel === 'high' ? '#ef4444' : scoreLevel === 'medium' ? '#f59e0b' : '#22c55e';

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">🛡️</div>
          <span className="logo-text">Cypherium</span>
        </div>
        <nav className="side-nav">
          <button className={`side-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            📊 Overview
          </button>
          <button className={`side-link ${activeTab === 'behavior' ? 'active' : ''}`} onClick={() => setActiveTab('behavior')}>
            🧠 Behavior
          </button>
          <button className={`side-link ${activeTab === 'assistant' ? 'active' : ''}`} onClick={() => setActiveTab('assistant')}>
            🤖 AI Assistant
          </button>
          <button className={`side-link ${activeTab === 'scans' ? 'active' : ''}`} onClick={() => setActiveTab('scans')}>
            🔍 Scanners
          </button>
          <button className={`side-link ${activeTab === 'incidents' ? 'active' : ''}`} onClick={() => setActiveTab('incidents')}>
            🚨 Incidents
          </button>
          <button className={`side-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="profile-icon">{(user?.username || 'U')[0].toUpperCase()}</span>
            <div className="user-details">
              <span className="u-name">{user?.username || 'User'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>🚪</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-content">
        {bannerVisible && anomalies.length > 0 && (
          <AnomalyBanner anomalies={anomalies} onDismiss={() => setBannerVisible(false)} />
        )}

        {activeTab === 'overview' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header">
              <h2>Overview</h2>
              <p>Your digital security snapshot.</p>
            </div>
            
            <section className="score-hero">
              <div className="score-circle">
                <div className="score-inner">
                  <span className="score-number">{Math.round(riskScore)}</span>
                  <span className="score-label">Risk Score</span>
                </div>
              </div>
              <div className="score-meta">
                <h2 style={{ color: scoreColor }}>{scoreLevel.toUpperCase()} RISK</h2>
                <div className="score-stats">
                  <StatCard label="Anomalies" value={anomalies.length} icon="⚠️" color="#ef4444" />
                  <StatCard label="Sessions" value={behaviorSummary?.total_sessions || 0} icon="🔑" color="#6366f1" />
                  <StatCard label="Devices" value={behaviorSummary?.unique_devices || 0} icon="💻" color="#06b6d4" />
                </div>
              </div>
            </section>

            <div className="dash-grid">
              <div className="dash-card">
                <h3>Risk Distribution</h3>
                <Doughnut data={riskData} />
              </div>
              <div className="dash-card">
                <h3>Personalized Recommendations</h3>
                <ul className="rec-list">
                  {recommendations.map((r, i) => (
                    <li key={i} className="rec-item">→ {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header"><h2>Behavior Analysis</h2></div>
            <div className="dash-grid">
              <div className="dash-card"><h3>Security Baseline</h3><BaselinePanel baseline={baseline} /></div>
              <div className="dash-card"><h3>Active Anomalies</h3><AnomalyList anomalies={anomalies} token={token} onRefresh={fetchData} /></div>
            </div>
            <div className="dash-card" style={{marginTop:'1.5rem'}}><h3>Login Timeline</h3><SessionTimeline sessions={sessions} /></div>
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header"><h2>AI Security Assistant</h2></div>
            <div className="dash-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div className="dash-card chat-card">
                <h3>Chat with AI</h3>
                <div className="chat-messages">
                  {chatMessages.map((m, i) => <div key={i} className={`chat-bubble ${m.role}`}>{m.content}</div>)}
                </div>
                <div className="chat-input-area" style={{display:'flex', gap:'0.5rem', marginTop:'1rem'}}>
                  <input type="text" className="scanner-input" style={{flex:1}} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendMessage()} />
                  <button className="btn-safe" onClick={sendMessage}>Send</button>
                </div>
              </div>
              <div className="dash-card">
                <h3>Incident Wizard</h3>
                {!emergencyMode ? (
                  <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                    <button className="side-link" onClick={()=>setEmergencyMode('hacked')}>Hacked Account ➔</button>
                    <button className="side-link" onClick={()=>setEmergencyMode('phishing')}>Clicked Phishing ➔</button>
                  </div>
                ) : (
                  <div>
                    <button className="btn-flag" onClick={()=>setEmergencyMode(null)}>Exit Wizard</button>
                    <p style={{marginTop:'1rem'}}>Step {emergencyStep + 1}: Follow AI instructions to secure account.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scans' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header"><h2>Threat Scanners</h2></div>
            <div className="dash-grid">
              <div className="dash-card">
                <h3>URL Scan</h3>
                <div className="scanner-input-group">
                  <input type="text" className="scanner-input" placeholder="Paste URL..." value={scanInput} onChange={e=>setScanInput(e.target.value)} />
                  <button className="btn-safe" onClick={()=>runQuickScan('url', scanInput)}>Analyze</button>
                </div>
              </div>
              <div className="dash-card">
                <h3>Identity Check</h3>
                <div className="scanner-input-group">
                  <input type="text" className="scanner-input" placeholder="Enter Email..." value={breachInput} onChange={e=>setBreachInput(e.target.value)} />
                  <button className="btn-safe" onClick={()=>runQuickScan('email', breachInput)}>Check</button>
                </div>
              </div>
            </div>
            <div className="dash-card" style={{marginTop:'1.5rem'}}>
              <h3>History</h3>
              <div className="table-responsive">
                <table className="history-table">
                  <thead><tr><th>Type</th><th>Content</th><th>Result</th><th>Date</th></tr></thead>
                  <tbody>
                    {scanHistory.map(s => (
                      <tr key={s.id}>
                        <td>{s.scan_type}</td>
                        <td>{s.content}</td>
                        <td>{s.result?.prediction || 'N/A'}</td>
                        <td>{new Date(s.timestamp).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header"><h2>Incident Tracking</h2></div>
            {incidents.map(inc => (
              <div key={inc.id} className="dash-card" style={{marginBottom:'1rem'}}>
                <h4>{inc.playbook?.title}</h4>
                <div style={{display:'flex', flexDirection:'column', gap:'0.5 rem'}}>
                  {inc.playbook?.steps.map(step => (
                    <div key={step.step_id} style={{display:'flex', gap:'0.5rem'}}>
                      <input type="checkbox" checked={inc.steps_progress?.find(s=>s.step_id===step.step_id)?.completed} onChange={e=>handleStepToggle(inc.id, step.step_id, e.target.checked)} />
                      <span>{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-panel animation-fade-in">
            <div className="dash-header"><h2>Settings</h2></div>
            <div className="dash-card">
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span>Critical Email Alerts</span>
                <label className="switch"><input type="checkbox" checked={emailNotifications} onChange={()=>setEmailNotifications(!emailNotifications)} /><span className="slider"></span></label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;