// Content script that runs on web pages

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    // Send back page information
    sendResponse({
      url: window.location.href,
      title: document.title
    });
  } else if (request.action === 'showWarning') {
    // Show warning banner on page
    showWarningBanner(request.message);
    sendResponse({status: 'banner shown'});
  } else if (request.action === 'syncAuth') {
    syncAuth();
    sendResponse({status: 'sync started'});
  }
  
  return true; // Keep message channel open for async response
});

function syncAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    chrome.runtime.sendMessage({
      action: 'saveAuth',
      token: token,
      user: JSON.parse(user)
    });
  }
}

function showWarningBanner(message) {
  // Check if banner already exists
  if (document.getElementById('safety-assistant-banner')) {
    return;
  }
  
  // Create warning banner
  const banner = document.createElement('div');
  banner.id = 'safety-assistant-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #f44336;
    color: white;
    padding: 15px;
    text-align: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 16px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  banner.innerHTML = `
    <strong>SAFETY WARNING:</strong> ${message}
    <button id="close-banner" style="
      float: right;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      margin-left: 10px;
    ">&times;</button>
  `;
  
  // Add close functionality
  banner.addEventListener('click', function(e) {
    if (e.target.id === 'close-banner') {
      banner.remove();
    }
  });
  
  // Insert banner at top of page
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.remove();
    }
  }, 10000);
}

// Auto-scan page on load
window.addEventListener('load', function() {
  console.log('Safety Assistant: Page loaded - ready for scanning');
  
  // Track site visit for behavior analysis
  trackSiteVisit();

  // Sync auth if on the app domain
  if (window.location.href.includes('localhost:3000')) {
    syncAuth();
  }
  
  // Gmail Scanner
  if (window.location.hostname.includes('mail.google.com')) {
    observeGmail();
  }
  
  // WhatsApp Scanner
  if (window.location.hostname.includes('web.whatsapp.com')) {
    observeWhatsApp();
  }
});

function trackSiteVisit() {
  const sensitiveDomains = ["binance.com", "coinbase.com", "metamask.io", "paypal.com", "bankofamerica.com"];
  const domain = window.location.hostname;
  const isSensitive = sensitiveDomains.some(d => domain.includes(d));

  chrome.runtime.sendMessage({
    action: 'trackActivity',
    type: 'site_visit',
    metadata: {
      domain: domain,
      url: window.location.href,
      is_sensitive: isSensitive
    }
  });
}

function observeGmail() {
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Look for email body containers
        const emailBodies = document.querySelectorAll('.a3s.aiL:not([data-scanned])');
        emailBodies.forEach(body => {
          body.setAttribute('data-scanned', 'true');
          const text = body.innerText;
          if (text.length > 10) {
            chrome.runtime.sendMessage({
              action: 'analyzeContent',
              content: text,
              type: 'message'
            });
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function observeWhatsApp() {
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Look for message bubbles
        const messages = document.querySelectorAll('.copyable-text:not([data-scanned])');
        messages.forEach(msg => {
          msg.setAttribute('data-scanned', 'true');
          const text = msg.innerText;
          if (text.length > 5) {
            chrome.runtime.sendMessage({
              action: 'analyzeContent',
              content: text,
              type: 'message'
            });
          }
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}