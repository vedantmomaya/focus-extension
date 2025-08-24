// This is the part that handles blocking sites for a set time
chrome.runtime.onInstalled.addListener(() => {
  console.log('Focus Extension installed');
});

let activeTabId = null;
let activeSite = null;
let lastActiveTime = null;

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function updateTimeSpent() {
  if (activeTabId && activeSite && lastActiveTime) {
    const now = Date.now();
    const delta = now - lastActiveTime;
    chrome.storage.sync.get('blacklist', (data) => {
      let list = data.blacklist || [];
      let changed = false;
      const activeDomain = getDomain(activeSite);
      list = list.map(item => {
        // Check if the domain matches (ignoring www)
        if (activeDomain === item.site.replace('www.', '')) {
          if (!item.timeSpent) item.timeSpent = 0;
          // Only add time if the site isn't blocked
          if (!item.blocked) {
            item.timeSpent += delta;
            // Block the site if time spent is over the limit
            if (item.timeSpent >= item.blockTime * 1000) {
              item.blocked = true;
              item.blockedAt = now;
              changed = true;
            }
          }
          // Unblock if enough time has passed
          if (item.blocked && item.blockedAt && now - item.blockedAt >= item.unblockTime * 1000) {
            item.blocked = false;
            item.timeSpent = 0;
            delete item.blockedAt;
            changed = true;
          }
        }
        return item;
      });
      if (changed) {
        chrome.storage.sync.set({ blacklist: list }, () => {
          refreshTabs(list);
        });
      } else {
        chrome.storage.sync.set({ blacklist: list });
      }
    });
    lastActiveTime = now;
  }
}

chrome.tabs.onActivated.addListener(activeInfo => {
  updateTimeSpent();
  chrome.tabs.get(activeInfo.tabId, tab => {
    activeTabId = activeInfo.tabId;
    activeSite = tab.url;
    lastActiveTime = Date.now();
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTimeSpent();
    if (activeTabId === tabId) {
      activeSite = tab.url;
      lastActiveTime = Date.now();
    }
    chrome.storage.sync.get('blacklist', (data) => {
      const list = data.blacklist || [];
      list.forEach(item => {
        if (item.blocked && getDomain(tab.url) === item.site.replace('www.', '')) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            args: [item.site, tabId],
            func: (siteName, tabId) => {
              document.body.innerHTML = `
                <div style=\"background:#FAF9EE;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;\">
                  <div style=\"background:#EEEEEE;padding:32px 40px;border-radius:24px;box-shadow:0 2px 16px #A2AF9B22;display:flex;flex-direction:column;align-items:center;\">
                    <h1 style=\"color:#A2AF9B;font-family:'Segoe UI',sans-serif;font-size:2em;margin-bottom:12px;\">This site is blocked</h1>
                    <p style=\"color:#DCCFC0;font-size:1.2em;font-family:'Segoe UI',sans-serif;margin-bottom:16px;\">Time to focus! You got this 💪</p>
                    <p style=\"color:#A2AF9B;font-size:1em;font-family:'Segoe UI',sans-serif;\">Close this tab and get back to work. Your productivity matters!</p>
                    <p style=\"color:#A2AF9B;font-size:1.1em;font-family:'Segoe UI',sans-serif;margin-top:18px;\">Back to work, Vedant — ${siteName} can wait! 😅</p>
                    <div style=\"margin-top:24px;\">
                      <button id=\"unblockRequestBtn\" style=\"background:#A2AF9B;color:#FAF9EE;border:none;padding:8px 16px;border-radius:8px;font-size:1em;\">Request Unblock</button>
                      <div id=\"unblockForm\" style=\"display:none;margin-top:16px;\">
                        <label style=\"color:#A2AF9B;font-size:1em;\">Gemini asks: Why?</label><br>
                        <input id=\"reasonInput\" type=\"text\" style=\"padding:8px;border-radius:8px;border:1px solid #A2AF9B;width:220px;\"><br>
                        <button id=\"submitReasonBtn\" style=\"background:#A2AF9B;color:#FAF9EE;border:none;padding:6px 12px;border-radius:8px;margin-top:8px;\">Submit</button>
                        <div id=\"geminiMsg\" style=\"margin-top:10px;color:#A2AF9B;font-size:1em;\"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              document.body.style.margin = '0';
              document.getElementById('unblockRequestBtn').onclick = () => {
                document.getElementById('unblockForm').style.display = 'block';
              };
              document.getElementById('submitReasonBtn').onclick = () => {
                const reason = document.getElementById('reasonInput').value.toLowerCase();
                const geminiMsg = document.getElementById('geminiMsg');
                const weakReasons = ["meme", "memes", "bored", "scroll", "just want", "fun", "wasting", "procrastinate", "procrastination", "chill", "random", "nothing", "entertainment", "pass time"];
                const validReasons = ["coding", "tutorial", "work", "research", "study", "project", "assignment", "learn", "education", "school", "college", "university", "job", "career", "important", "urgent", "reference"];
                if (weakReasons.some(w => reason.includes(w))) {
                  geminiMsg.textContent = "Scrolling memes is not a valid emergency.";
                  return;
                }
                if (validReasons.some(v => reason.includes(v))) {
                  geminiMsg.textContent = "Valid reason! Unblocking...";
                  setTimeout(() => {
                    window.postMessage({ type: 'unblockSite', site: siteName }, '*');
                  }, 800);
                  return;
                }
                geminiMsg.textContent = "Gemini is not convinced. Try again.";
              };
              window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'unblockSite' && event.data.site) {
                  chrome.runtime.sendMessage({ type: 'unblockSite', site: event.data.site });
                }
              });
            }
          });
// Listen for unblock requests from blocked page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'unblockSite' && message.site) {
    chrome.storage.sync.get('blacklist', (data) => {
      let list = data.blacklist || [];
      list = list.map(item => {
        if (item.site === message.site) {
          item.blocked = false;
          item.timeSpent = 0;
          delete item.blockedAt;
        }
        return item;
      });
      chrome.storage.sync.set({ blacklist: list }, () => {
        refreshTabs(list);
      });
    });
  }
});
        }
      });
    });
  }
});

setInterval(updateTimeSpent, 1000); // Update every second

function refreshTabs(list) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      list.forEach(item => {
        if (tab.url && getDomain(tab.url) === item.site.replace('www.', '')) {
          chrome.tabs.reload(tab.id);
        }
      });
    });
  });
}
