document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scanButton');
  const statusDiv = document.getElementById('status');
  const feedbackSection = document.getElementById('feedbackSection');
  const feedbackForm = document.getElementById('feedbackForm');
  const falsePositiveBtn = document.getElementById('falsePositiveBtn');
  const falseNegativeBtn = document.getElementById('falseNegativeBtn');
  
  // New UI elements
  const checkEmailBtn = document.getElementById('checkEmailBtn');
  const identityEmail = document.getElementById('identityEmail');
  const identityStatus = document.getElementById('identityStatus');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  let currentScanId = null;

  // Defensive check for core elements
  if (!scanButton || !statusDiv) {
    console.error('Safety Assistant: Essential UI elements not found. Check popup.html.');
    return;
  }

  // Tab switching logic
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (!target) return;
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetContent = document.getElementById(target);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Identity Check Logic
  if (checkEmailBtn && identityEmail && identityStatus) {
    checkEmailBtn.addEventListener('click', async () => {
      const email = identityEmail.value.trim();
      if (!email) {
        identityStatus.textContent = 'Please enter an email';
        identityStatus.className = 'status status-error';
        return;
      }

      identityStatus.textContent = 'Checking breaches...';
      identityStatus.className = 'status status-loading';

      try {
        const token = await new Promise(resolve => {
          chrome.storage.local.get(['token'], result => resolve(result.token));
        });

        const response = await fetch('http://localhost:8000/scan/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: email,
            scan_type: 'email',
            token: token || null
          })
        });

        if (!response.ok) throw new Error('Backend error');
        
        const data = await response.json();
        const breachCount = data.details?.breach_count || 0;

        if (breachCount === 0) {
          identityStatus.innerHTML = '<span style="color: #4caf50">✓ No breaches found in HIBP database!</span>';
          identityStatus.className = 'status';
        } else {
          identityStatus.innerHTML = `
            <div style="color: #f44336; margin-bottom: 5px;">⚠ Found in ${breachCount} data breaches!</div>
            <div style="font-size: 10px; color: #888; margin-bottom: 10px;">Source: Have I Been Pwned (Real-time)</div>
            <div class="breach-list" style="max-height: 150px; overflow-y: auto;">
              ${(data.details?.breaches || []).map(b => `
                <div class="breach-item">
                  <div class="breach-name" style="color: #f44336; font-weight: bold;">${b.Name || 'Unknown Breach'}</div>
                  <div class="breach-date" style="font-size: 10px; color: #666;">Date: ${b.BreachDate || 'N/A'}</div>
                  <div class="breach-desc" style="font-size: 10px; color: #444; margin-top: 2px;">${b.Description ? b.Description.substring(0, 60) + '...' : ''}</div>
                </div>
              `).join('')}
            </div>
          `;
          identityStatus.className = 'status';
        }
        
        // Update the main safety score after check
        fetchSafetyScore();

      } catch (err) {
        identityStatus.textContent = 'Error: ' + err.message;
        identityStatus.className = 'status status-error';
      }
    });
  }

  // Get current safety score from backend
  function fetchSafetyScore() {
    chrome.storage.local.get(['token'], function(result) {
      if (result.token) {
        fetch('http://localhost:8000/risk/score?token=' + result.token)
          .then(response => response.json())
          .then(data => {
            if (data.score !== undefined) {
              const safetyScore = Math.round(100 - data.score);
              updateScoreDisplay(safetyScore);
              chrome.storage.local.set({safetyScore: safetyScore});
              
              // Update recommendations
              const recList = document.getElementById('recommendations-list');
              if (recList && data.recommendations) {
                recList.innerHTML = '';
                data.recommendations.forEach(rec => {
                  const li = document.createElement('li');
                  li.textContent = rec;
                  recList.appendChild(li);
                });
              }

              // Update risk factors summary
              const riskSummary = document.getElementById('risk-factors-summary');
              if (riskSummary && data.factors) {
                riskSummary.innerHTML = Object.entries(data.factors).map(([key, factor]) => `
                  <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                      <span>${key.replace('_', ' ').toUpperCase()}</span>
                      <span>${Math.round((factor.score || 0) * 100)}%</span>
                    </div>
                    <div style="height: 4px; background: #eee; border-radius: 2px; overflow: hidden;">
                      <div style="width: ${(factor.score || 0) * 100}%; height: 100%; background: #f44336;"></div>
                    </div>
                  </div>
                `).join('');
              }
            }
          })
          .catch(err => console.error('Failed to fetch risk score:', err));
      }
    });
  }

  fetchSafetyScore();
  
  scanButton.addEventListener('click', function() {
    statusDiv.textContent = 'Scanning...';
    statusDiv.className = 'status status-loading';
    
    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      if (!currentTab) return;
      
      // Send message to content script to get page info
      chrome.tabs.sendMessage(currentTab.id, {action: 'getPageInfo'}, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('Communication error:', chrome.runtime.lastError.message);
          // Potential fallback: use URL from tab object if content script is missing or internal page
          if (currentTab.url && !currentTab.url.startsWith('chrome://')) {
            analyzeUrl(currentTab.url);
          } else {
            statusDiv.textContent = 'Cannot scan internal browser pages';
            statusDiv.className = 'status status-error';
          }
          return;
        }
        
        if (response && response.url) {
          analyzeUrl(response.url);
        }
      });
    });
  });
  
  async function analyzeUrl(url) {
    try {
      const token = await new Promise(resolve => {
        chrome.storage.local.get(['token'], result => resolve(result.token));
      });

      const response = await fetch('http://localhost:8000/scan/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: url,
          scan_type: 'url',
          token: token || null
        })
      });

      if (!response.ok) throw new Error('Backend error');
      
      const data = await response.json();
      const isSafe = data.prediction !== 'malicious' && data.prediction !== 'scam';
      
      // Update Main Score
      fetchSafetyScore();
      
      if (isSafe) {
        statusDiv.innerHTML = `<span style="color: #4caf50">Page is safe!</span><br><small>Risk: ${data.risk_score || 0}</small>`;
        statusDiv.className = 'status status-success'; // Using generic safe status style
        if (feedbackSection) feedbackSection.style.display = 'none';
      } else {
        const repo = data.details?.reputation;
        let extDetail = "";
        if (repo && repo.is_malicious) {
          extDetail = `<br><small style="color: #f44336">Flagged by VirusTotal (${repo.malicious_count || 0} hits)</small>`;
        }
        
        statusDiv.innerHTML = `<span style="color: #f44336">Warning: ${(data.prediction || 'Unknown').toUpperCase()}!</span>${extDetail}`;
        statusDiv.className = 'status status-error';
        
        // Show warning banner on page
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'showWarning',
              message: `This page has been flagged as ${(data.prediction || 'threat').toUpperCase()}.`
            });
          }
        });
        
        // Show feedback section
        if (feedbackSection) {
          feedbackSection.style.display = 'block';
          currentScanId = data.scan_id || Math.floor(Math.random() * 10000);
        }
      }
    } catch (err) {
      statusDiv.textContent = 'Error: ' + err.message;
      statusDiv.className = 'status status-error';
      console.error(err);
    }
  }
  
  function updateScoreDisplay(score) {
    const scoreContainer = document.querySelector('.score-container');
    const scoreValue = document.querySelector('.score-value');
    
    if (scoreValue) {
      scoreValue.innerHTML = score + '<span style="font-size: 1.25rem; font-weight: 600; color: var(--text-secondary)">/100</span>';
    }
    if (scoreContainer) {
      scoreContainer.className = 'glass-card score-container ' + 
        (score > 70 ? 'score-low' : score > 40 ? 'score-medium' : 'score-high');
    }
  }
  
  // Feedback functionality
  if (falsePositiveBtn) {
    falsePositiveBtn.addEventListener('click', () => submitFeedback(false, "This site was flagged incorrectly"));
  }
  
  if (falseNegativeBtn) {
    falseNegativeBtn.addEventListener('click', () => submitFeedback(true, "This site should have been flagged"));
  }
  
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const comment = document.getElementById('feedbackComment')?.value || "";
      submitFeedback(null, comment);
    });
  }
  
  function submitFeedback(isCorrect, comment) {
    fetch('http://localhost:8000/scan/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scan_id: currentScanId ? currentScanId.toString() : "",
        is_correct: isCorrect,
        comment: comment
      })
    })
    .then(response => {
      // Show confirmation
      if (statusDiv) {
        statusDiv.textContent = 'Thank you for your feedback!';
        statusDiv.className = 'status status-success';
      }
      
      // Hide feedback section
      if (feedbackSection) feedbackSection.style.display = 'none';
      
      // Clear form
      const commentEl = document.getElementById('feedbackComment');
      if (commentEl) commentEl.value = '';
    })
    .catch(error => {
      console.error('Error submitting feedback:', error);
      if (statusDiv) {
        statusDiv.textContent = 'Error: Failed to submit feedback.';
        statusDiv.className = 'status status-error';
      }
    });
  }
});