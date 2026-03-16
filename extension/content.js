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
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 500px;
    background: rgba(239, 68, 68, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    color: white;
    padding: 16px 24px;
    text-align: left;
    z-index: 999999;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 15px;
    box-shadow: 0 12px 32px rgba(239, 68, 68, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    animation: slideDownBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  
  // Create animation style
  if (!document.getElementById('safety-banner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'safety-banner-keyframes';
    style.textContent = `
      @keyframes slideDownBanner {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  banner.innerHTML = `
    <div><strong style="font-weight: 700; letter-spacing: -0.02em;">SAFETY WARNING:</strong> <span style="opacity: 0.95">${message}</span></div>
    <button id="close-banner" style="
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style="pointer-events: none;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
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