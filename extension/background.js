// Background script for the Safety Assistant extension

// Create context menu item for scanning links
chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: 'scanLink',
    title: 'Scan link with Safety Assistant',
    contexts: ['link']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === 'scanLink') {
    // Send link to analysis
    analyzeLink(info.linkUrl);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'analyzeUrl') {
    analyzeLink(request.url);
    sendResponse({status: 'analysis started'});
  } else if (request.action === 'analyzeContent') {
    analyzeTextContent(request.content, request.type);
    sendResponse({status: 'content analysis started'});
  } else if (request.action === 'saveAuth') {
    chrome.storage.local.set({
      token: request.token,
      user: request.user
    }, () => {
      console.log('Auth data saved in extension');
    });
    sendResponse({status: 'auth saved'});
  } else if (request.action === 'syncToken') {
    chrome.storage.local.set({
      token: request.token
    }, () => {
      console.log('Token synced from dashboard');
    });
    sendResponse({status: 'token synced'});
  } else if (request.action === 'trackActivity') {
    trackActivity(request.type, request.metadata);
    sendResponse({status: 'activity tracking started'});
  }
  
  return true; // Keep message channel open for async response
});

async function trackActivity(type, metadata) {
  try {
    const token = await new Promise(resolve => {
      chrome.storage.local.get(['token'], result => resolve(result.token));
    });

    if (!token) return;

    const response = await fetch('http://localhost:8000/behavior/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: type,
        metadata: metadata,
        token: token
      })
    });

    if (!response.ok) return;
    
    const result = await response.json();
    if (result.is_anomaly) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Security Alert - Unusual Behavior',
        message: result.reason,
        priority: 2
      });

      // Also show banner on the page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showWarning',
            message: `Unusual Activity: ${result.reason}`
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('Content script not ready for behavioral warning');
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Activity tracking failed:', err);
  }
}

async function analyzeTextContent(content, type) {
  try {
    const token = await new Promise(resolve => {
      chrome.storage.local.get(['token'], result => resolve(result.token));
    });

    const response = await fetch('http://localhost:8000/scan/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content,
        scan_type: type || 'message',
        token: token || null
      })
    });

    if (!response.ok) return;
    
    const result = await response.json();
    if (result.prediction === 'scam' || result.prediction === 'suspicious') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Safety Assistant - Alert',
        message: `Caution: Detected a potential ${result.prediction} in your chat/email!`,
        priority: 2
      });
    }
  } catch (err) {
    console.error('Content analysis failed:', err);
  }
}

async function analyzeLink(url) {
  console.log('Analyzing URL:', url);
  
  try {
    const token = await new Promise(resolve => {
      chrome.storage.local.get(['token'], result => resolve(result.token));
    });

    const response = await fetch('http://localhost:8000/scan/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: url,
        scan_type: 'url',
        token: token || null
      })
    });

    if (!response.ok) throw new Error('Backend error');
    
    const result = await response.json();
    const isSafe = result.prediction !== 'malicious' && result.prediction !== 'scam';
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Safety Assistant',
      message: isSafe 
        ? `This link appears to be safe (Score: ${Math.round(100 - result.risk_score)})` 
        : `Warning: This link is flagged as ${result.prediction.toUpperCase()}!`,
      priority: 2
    });
    
    // If unsafe, notify currently active tab
    if (!isSafe) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showWarning',
            message: `Warning: A detected link is flagged as ${result.prediction.toUpperCase()}.`
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('Content script not ready for link warning');
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Analysis failed:', err);
  }
}

// Auto-scan URLs as they are visited
chrome.webNavigation.onCompleted.addListener(function(details) {
  // Only scan main frame (not iframes)
  if (details.frameId === 0) {
    // In a real implementation, you might check user settings
    // to see if auto-scan is enabled
    
    // For demo purposes, we'll skip auto-scanning to avoid too many notifications
    console.log('Visited URL:', details.url);
  }
});