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

  if (loading) return <div className="loading">Loading security profile...</div>;

  return (
    <div className="dashboard-layout">
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

      {/* Top Navbar */}
      <nav className="dash-nav glass-card">
        <div className="logo-clean">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Cypherium
        </div>
        
        <div className="user-profile">
          <div className="profile-icon">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <button className="logout-text" onClick={onLogout}>Sign Out</button>
        </div>
      </nav>

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

          <section className="glass-card dash-card">
            <h3>Personalized Strategy</h3>
            <ul className="recommendations-list">
              {recommendations.length > 0 ? recommendations.map((rec, index) => (
                <li key={index} className="recommendation-item">{rec}</li>
              )) : (
                <li className="recommendation-item">No urgent actions required.</li>
              )}
            </ul>
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
    </div>
  );
};

export default Dashboard;