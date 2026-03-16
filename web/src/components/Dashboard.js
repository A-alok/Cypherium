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
import ChatWidget from './ChatWidget';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement, Filler
);

const API = 'http://localhost:8000';

// ── helper: severity color ──────────────────────────────────────────────────
const severityColor = (s) =>
  s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#3b82f6';

// ── Anomaly Alert Banner ───────────────────────────────────────────────────
const AnomalyBanner = ({ anomalies, onDismiss }) => {
  if (!anomalies || anomalies.length === 0) return null;
  return (
    <div className="anomaly-banner">
      <div className="anomaly-banner-icon">⚠️</div>
      <div className="anomaly-banner-text">
        <strong>{anomalies.length} suspicious login{anomalies.length > 1 ? 's' : ''} detected</strong>
        <span>{anomalies[0].description}</span>
      </div>
      <button className="anomaly-banner-dismiss" onClick={onDismiss}>×</button>
    </div>
  );
};

// ── Stat Card ──────────────────────────────────────────────────────────────
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

// ── Anomaly Events List ────────────────────────────────────────────────────
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
    return (
      <div className="empty-state">
        <span className="empty-icon">✅</span>
        <p>No active anomalies detected. Your account looks safe!</p>
      </div>
    );
  }

  return (
    <ul className="anomaly-list">
      {anomalies.map((a) => (
        <li key={a._id || a.id} className="anomaly-item">
          <div className="anomaly-severity" style={{ background: severityColor(a.severity) }}>
            {a.severity?.toUpperCase()}
          </div>
          <div className="anomaly-details">
            <strong>{a.anomaly_type?.replace(/_/g, ' ') || 'Unknown anomaly'}</strong>
            <p>{a.description}</p>
            <time>{new Date(a.detected_at || Date.now()).toLocaleString()}</time>
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

// ── Session Timeline ───────────────────────────────────────────────────────
const SessionTimeline = ({ sessions }) => {
  if (!sessions || sessions.length === 0) {
    return <div className="empty-state"><span className="empty-icon">📋</span><p>No sessions recorded yet.</p></div>;
  }

  return (
    <div className="session-timeline">
      {sessions.slice(0, 8).map((s, i) => (
        <div key={i} className={`session-entry ${s.is_anomaly ? 'anomalous' : ''}`}>
          <div className="session-dot" style={{ background: s.is_anomaly ? '#ef4444' : '#22c55e' }} />
          <div className="session-info">
            <span className="session-time">{new Date(s.login_time || Date.now()).toLocaleString()}</span>
            <span className="session-loc">
              {s.location_country || 'Unknown country'} · {s.ip_address || 'Unknown IP'}
            </span>
            {s.is_anomaly && (
              <span className="session-flag">⚠ {(s.anomaly_reasons || []).join(', ')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Behavior Baseline Panel ────────────────────────────────────────────────
const BaselinePanel = ({ baseline }) => {
  if (!baseline || baseline.status === 'insufficient_data') {
    const current = baseline?.current_sessions || 0;
    const needed = 3;
    return (
      <div className="baseline-learning">
        <div className="learning-icon">🧠</div>
        <h4>Building your security baseline…</h4>
        <p>Cypherium is learning your normal patterns. {needed - current} more login{needed - current !== 1 ? 's' : ''} needed.</p>
        <div className="learning-bar">
          <div className="learning-fill" style={{ width: `${Math.min((current / needed) * 100, 100)}%` }} />
        </div>
      </div>
    );
  }

  const patterns = baseline.patterns || {};
  return (
    <div className="baseline-established">
      <div className="baseline-grid">
        {patterns.login_time && (
          <div className="baseline-card">
            <span className="baseline-icon">🕐</span>
            <strong>Typical login hour</strong>
            <span>{Math.round(patterns.login_time.mean_hour)}:00 UTC ± {Math.round(patterns.login_time.std_hour)}h</span>
            <div className="confidence-bar">
              <div className="confidence-fill" style={{ width: `${(patterns.login_time.confidence || 0) * 100}%` }} />
            </div>
          </div>
        )}
        {patterns.location && (
          <div className="baseline-card">
            <span className="baseline-icon">🌍</span>
            <strong>Usual locations</strong>
            <span>{(patterns.location.common_countries || []).map(c => c.country).join(', ') || 'Not enough data'}</span>
          </div>
        )}
        {patterns.device && (
          <div className="baseline-card">
            <span className="baseline-icon">💻</span>
            <strong>Known devices</strong>
            <span>{patterns.device.known_devices || 0} device{patterns.device.known_devices !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────
const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
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
  const [loadingBehavior, setLoadingBehavior] = useState(true);

  // Incident Response state
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  const token = localStorage.getItem('token');

  const fetchRiskData = useCallback(async () => {
    try {
      const [scoreRes, historyRes] = await Promise.all([
        fetch(`${API}/risk/score?token=${token}`),
        fetch(`${API}/scan/history?token=${token}`)
      ]);

      if (scoreRes.ok) {
        const d = await scoreRes.json();
        setRiskScore(d.score || 0);
        setPlatformInsights({
          web: d.platform_insights?.web || { scans: 0, risks: 0 },
          browserExtension: d.platform_insights?.browser_extension || { scans: 0, risks: 0 }
        });
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

      if (historyRes.ok) {
        const hist = await historyRes.json();
        setScanHistory(hist.map(scan => ({
          id: scan.id,
          type: scan.scan_type?.toUpperCase(),
          content: scan.content,
          result: scan.result?.prediction || scan.result?.safety_status || 'Unknown',
          date: new Date(scan.timestamp).toLocaleDateString()
        })));
      }
    } catch (e) {
      console.error('Risk data fetch error:', e);
    }
  }, [token]);

  const fetchBehaviorData = useCallback(async () => {
    setLoadingBehavior(true);
    try {
      const [summaryRes, anomalyRes, sessionRes, baselineRes] = await Promise.all([
        fetch(`${API}/behavior/summary?token=${token}`),
        fetch(`${API}/behavior/anomalies?token=${token}`),
        fetch(`${API}/behavior/sessions?limit=10&token=${token}`),
        fetch(`${API}/behavior/baseline?token=${token}`)
      ]);

      if (summaryRes.ok) setBehaviorSummary(await summaryRes.json());
      if (anomalyRes.ok) setAnomalies(await anomalyRes.json());
      if (sessionRes.ok) setSessions(await sessionRes.json());
      if (baselineRes.ok) setBaseline(await baselineRes.json());
    } catch (e) {
      console.error('Behavior data fetch error:', e);
    } finally {
      setLoadingBehavior(false);
    }
  }, [token]);

  const fetchIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const res = await fetch(`${API}/incident/active?token=${token}`);
      if (res.ok) setIncidents(await res.json());
    } catch (e) {
      console.error('Fetch incidents error:', e);
    } finally {
      setLoadingIncidents(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRiskData();
    fetchBehaviorData();
    fetchIncidents();
  }, [fetchRiskData, fetchBehaviorData, fetchIncidents]);

  // Report an incident (Panic button)
  const handleReportIncident = async (type, desc) => {
    try {
      await fetch(`${API}/incident/report?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_type: type, description: desc })
      });
      fetchIncidents();
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
      fetchIncidents(); // Refresh state
    } catch (e) {
      console.error('Failed to toggle step:', e);
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      await fetch(`${API}/incident/${incidentId}/resolve?token=${token}`, { method: 'POST' });
      fetchIncidents();
    } catch (e) {
      console.error('Failed to resolve incident:', e);
    }
  };

  // Score color
  const scoreLevel = riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low';
  const scoreColor = scoreLevel === 'high' ? '#ef4444' : scoreLevel === 'medium' ? '#f59e0b' : '#22c55e';

  // Charts
  const riskData = {
    labels: ['Breach Risk', 'Malicious URLs', 'Suspicious Msgs', 'Password Risk'],
    datasets: [{
      label: 'Risk %',
      data: [riskFactors.breachRisk, riskFactors.maliciousUrls, riskFactors.suspiciousMessages, riskFactors.passwordRisk],
      backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(59,130,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
      borderColor: ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'],
      borderWidth: 2,
    }]
  };

  const platformData = {
    labels: ['Web Dashboard', 'Browser Extension'],
    datasets: [{
      data: [platformInsights.web.risks * 100 || 50, platformInsights.browserExtension.risks * 100 || 50],
      backgroundColor: ['rgba(99,102,241,0.8)', 'rgba(236,72,153,0.8)'],
      borderColor: ['#6366f1', '#ec4899'],
      borderWidth: 2,
    }]
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'behavior', label: '🧠 Behavior' },
    { id: 'scans', label: '🔍 Scan History' },
    { id: 'incidents', label: '🚨 Incident Response' },
  ];

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="brand-icon">🛡️</span>
          <div>
            <h1>Cypherium</h1>
            <span className="brand-tagline">AI Cybersecurity Coach</span>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="panic-btn" 
            onClick={() => {
              if (window.confirm("Are you sure you want to declare a security incident?")) {
                handleReportIncident("general_hack", "User manually declared an emergency.");
              }
            }}
          >
            I've Been Hacked!
          </button>
          <div className="user-pill">
            <span className="user-avatar">{(user?.username || 'U')[0].toUpperCase()}</span>
            <span>{user?.username || user?.name}</span>
          </div>
          <button onClick={onLogout} className="logout-button">Sign Out</button>
        </div>
      </header>

      {/* ── Anomaly Banner ── */}
      {bannerVisible && anomalies.length > 0 && (
        <AnomalyBanner anomalies={anomalies} onDismiss={() => setBannerVisible(false)} />
      )}

      {/* ── Score Hero ── */}
      <section className="score-hero">
        <div className="score-circle" style={{ '--score-color': scoreColor }}>
          <svg viewBox="0 0 120 120" className="score-ring">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={scoreColor} strokeWidth="10"
              strokeDasharray={`${(riskScore / 100) * 326.7} 326.7`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className="score-inner">
            <span className="score-number">{Math.round(riskScore)}</span>
            <span className="score-label">Risk Score</span>
          </div>
        </div>
        <div className="score-meta">
          <h2 style={{ color: scoreColor }}>
            {scoreLevel === 'high' ? '🔴 High Risk' : scoreLevel === 'medium' ? '🟡 Moderate Risk' : '🟢 Low Risk'}
          </h2>
          <p className="score-description">
            {scoreLevel === 'high'
              ? 'Immediate action required. Multiple threats detected.'
              : scoreLevel === 'medium'
              ? 'Some risks detected. Review the recommendations below.'
              : 'Your digital security looks good. Keep it up!'}
          </p>
          <div className="score-stats">
            <StatCard label="Anomalies" value={anomalies.length} icon="⚠️" color="#ef4444" sub="active alerts" />
            <StatCard label="Sessions" value={behaviorSummary?.total_sessions || 0} icon="🔑" color="#6366f1" sub="total logins" />
            <StatCard label="Devices" value={behaviorSummary?.unique_devices || 0} icon="💻" color="#06b6d4" sub="known devices" />
            <StatCard label="Countries" value={behaviorSummary?.unique_countries || 0} icon="🌍" color="#f59e0b" sub="login origins" />
          </div>
        </div>
      </section>

      {/* ── Tab Nav ── */}
      <nav className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <div className="tab-content">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="tab-panel">
            <div className="charts-grid">
              <div className="chart-card">
                <h3>Risk Factor Breakdown</h3>
                <div className="chart-wrap"><Doughnut data={riskData} options={{ plugins: { legend: { position: 'right' } }, cutout: '65%' }} /></div>
              </div>
              <div className="chart-card">
                <h3>Platform Distribution</h3>
                <div className="chart-wrap"><Doughnut data={platformData} options={{ plugins: { legend: { position: 'right' } }, cutout: '65%' }} /></div>
              </div>
            </div>

            <div className="recommendations-card">
              <h3>🎯 Personalized Recommendations</h3>
              <ul className="rec-list">
                {recommendations.length > 0
                  ? recommendations.map((r, i) => (
                      <li key={i} className="rec-item">
                        <span className="rec-bullet">→</span>
                        <span>{r}</span>
                      </li>
                    ))
                  : <li className="rec-item"><span className="rec-bullet">✓</span><span>No critical recommendations right now. Stay vigilant!</span></li>
                }
              </ul>
            </div>
          </div>
        )}

        {/* Behavior Tab */}
        {activeTab === 'behavior' && (
          <div className="tab-panel">
            {loadingBehavior ? (
              <div className="loading-spinner">
                <div className="spinner" />
                <p>Analyzing your behavior patterns…</p>
              </div>
            ) : (
              <>
                {/* Baseline */}
                <div className="behavior-card">
                  <h3>🧠 Security Baseline</h3>
                  <BaselinePanel baseline={baseline} />
                </div>

                {/* Active Anomalies */}
                <div className="behavior-card">
                  <div className="card-header-row">
                    <h3>⚠️ Active Anomalies</h3>
                    <button className="refresh-btn" onClick={fetchBehaviorData}>↻ Refresh</button>
                  </div>
                  <AnomalyList anomalies={anomalies} token={token} onRefresh={fetchBehaviorData} />
                </div>

                {/* Session Timeline */}
                <div className="behavior-card">
                  <h3>🕐 Login Timeline</h3>
                  <SessionTimeline sessions={sessions} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Scan History Tab */}
        {activeTab === 'scans' && (
          <div className="tab-panel">
            <div className="table-card">
              <h3>🔍 Recent Scans</h3>
              {scanHistory.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🔍</span>
                  <p>No scans yet. Use the browser extension or API to start scanning URLs and messages.</p>
                </div>
              ) : (
                <table className="scan-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Content</th>
                      <th>Result</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((scan) => (
                      <tr key={scan.id}>
                        <td><span className="scan-type-badge">{scan.type}</span></td>
                        <td className="scan-content">{scan.content}</td>
                        <td>
                          <span className={`result-pill ${scan.result?.toLowerCase()}`}>{scan.result}</span>
                        </td>
                        <td>{scan.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {activeTab === 'incidents' && (
          <div className="tab-panel">
            <div className="table-card">
              <div className="card-header-row">
                <h3>🚨 Active Incidents & Playbooks</h3>
                <div style={{display:'flex', gap: '10px'}}>
                  <button className="btn-flag" onClick={() => handleReportIncident("phishing_clicked", "Clicked suspicious link")}>Report Phishing</button>
                  <button className="btn-flag" onClick={() => handleReportIncident("compromised_password", "Password leaked")}>Report Password Leak</button>
                </div>
              </div>
              
              {loadingIncidents ? (
                <div className="loading-spinner"><div className="spinner" /><p>Loading playbooks...</p></div>
              ) : incidents.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🛡️</span>
                  <p>No active incidents. You're secure!</p>
                </div>
              ) : (
                <div className="incident-list">
                  {incidents.map(inc => (
                    <div key={inc.id} className="incident-card">
                      <div className="incident-header">
                        <div>
                          <h4>{inc.playbook?.title || 'Unknown Incident'}</h4>
                          <span className="incident-meta">{new Date(inc.created_at).toLocaleString()} • Status: <span style={{color: inc.status==='active'?'#ef4444':'#22c55e'}}>{inc.status.toUpperCase()}</span></span>
                        </div>
                        {inc.status === 'active' && (
                          <button className="btn-safe" onClick={() => handleResolveIncident(inc.id)}>Force Resolve</button>
                        )}
                      </div>
                      <p className="incident-desc">{inc.playbook?.description}</p>
                      
                      <div className="playbook-steps">
                        {inc.playbook?.steps.map(step => {
                          const progress = inc.steps_progress?.find(s => s.step_id === step.step_id) || { completed: false };
                          return (
                            <div key={step.step_id} className={`playbook-step ${progress.completed ? 'completed' : ''}`}>
                              <input 
                                type="checkbox" 
                                checked={progress.completed} 
                                onChange={(e) => inc.status === 'active' && handleStepToggle(inc.id, step.step_id, e.target.checked)}
                                disabled={inc.status !== 'active'}
                              />
                              <div className="step-info">
                                <strong>{step.title}</strong>
                                <p>{step.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Chatbot Assistant */}
      <ChatWidget token={token} />
    </div>
  );
};

export default Dashboard;