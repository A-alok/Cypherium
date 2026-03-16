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
  }
  
  return true; // Keep message channel open for async response
});

function analyzeLink(url) {
  console.log('Analyzing URL:', url);
  
  fetch('http://127.0.0.1:8000/scan/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scan_type: 'url',
      content: url
    })
  })
  .then(response => response.json())
  .then(data => {
    const isSafe = data.prediction === 'safe';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Safety Assistant',
      message: isSafe 
        ? `This link appears to be safe: ${url}` 
        : `Warning: This link may be ${data.prediction} (Confidence: ${(data.confidence*100).toFixed(0)}%): ${url}`,
      priority: 2
    });
    
    if (!isSafe && typeof sender !== 'undefined' && sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'showWarning',
        message: `A link on this page has been flagged as ${data.prediction}.`
      });
    }
  })
  .catch(error => {
    console.error('Error analyzing URL:', error);
  });
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