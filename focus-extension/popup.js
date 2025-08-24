// ...existing code...
// Blacklist logic
const addForm = document.getElementById('addForm');
const blacklistUl = document.getElementById('blacklist');
const statusDiv = document.getElementById('status');

function msToTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min > 0 ? min + 'm ' : ''}${sec}s`;
}

function createRing(percent, color, text) {
  // SVG ring UI with smooth animation, starts at 12 o'clock
  const radius = 30;
  const stroke = 6;
  const normalized = percent > 1 ? 1 : percent < 0 ? 0 : percent;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized);
  return `<svg width="80" height="80" style="vertical-align:middle;">
    <circle cx="40" cy="40" r="${radius}" stroke="#EEEEEE" stroke-width="${stroke}" fill="none"/>
    <circle cx="40" cy="40" r="${radius}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" style="transition: stroke-dashoffset 1s linear; transform: rotate(-90deg); transform-origin: 40px 40px;"/>
    <text x="40" y="45" text-anchor="middle" font-size="18" fill="#A2AF9B" font-family="Segoe UI, sans-serif">${text}</text>
  </svg>`;
}

function renderBlacklist() {
  chrome.storage.sync.get('blacklist', (data) => {
    const list = data.blacklist || [];
    const now = Date.now();
    const container = document.getElementById('blacklist');
    container.innerHTML = '';
    list.forEach((item, idx) => {
      const div = document.createElement('div');
      div.style.background = '#EEEEEE';
      div.style.margin = '12px 0';
      div.style.padding = '12px';
      div.style.borderRadius = '12px';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.boxShadow = '0 2px 8px #A2AF9B22';

      let status = item.blocked ? 'Blocked' : 'Active';
      let ringHtml = '';
      if (item.blocked && item.blockedAt) {
        const msLeft = Math.max(0, (item.unblockTime * 1000) - (now - item.blockedAt));
        const percent = msLeft / (item.unblockTime * 1000);
        ringHtml = createRing(percent, '#A2AF9B', msToTime(msLeft));
      } else {
        const msSpent = Math.max(0, item.timeSpent || 0);
        const percent = msSpent / (item.blockTime * 1000);
        ringHtml = createRing(percent, '#DCCFC0', msToTime(msSpent));
      }
      div.innerHTML = `
        <div style="margin-right:16px;">${ringHtml}</div>
        <div style="flex:1;">
          <div style="color:#A2AF9B;font-size:18px;font-family:'Segoe UI',sans-serif;">${item.site}</div>
          <div style="color:#A2AF9B;font-size:14px;">Block after: ${item.blockTime}s | Unblock after: ${item.unblockTime}s</div>
          <div style="color:#A2AF9B;font-size:14px;">Status: ${status}</div>
        </div>
        <button style="background:#A2AF9B;color:#FAF9EE;border:none;padding:6px 12px;border-radius:8px;margin-left:12px;" id="remove${idx}">Remove</button>
      `;
      container.appendChild(div);
      document.getElementById(`remove${idx}`).onclick = () => {
        list.splice(idx, 1);
        chrome.storage.sync.set({ blacklist: list }, renderBlacklist);
      };
    });
  });
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const site = document.getElementById('site').value.trim();
  let blockTime = parseInt(document.getElementById('blockTime').value, 10);
  let unblockTime = parseInt(document.getElementById('unblockTime').value, 10);
  const blockUnit = document.getElementById('blockUnit').value;
  const unblockUnit = document.getElementById('unblockUnit').value;
  if (blockUnit === 'minutes') blockTime *= 60;
  if (unblockUnit === 'minutes') unblockTime *= 60;
  if (site && blockTime > 0 && unblockTime > 0) {
    chrome.storage.sync.get('blacklist', (data) => {
      const list = data.blacklist || [];
      const exists = list.some(item => item.site === site);
      if (exists) {
        statusDiv.textContent = `This website is already blacklisted.`;
        return;
      }
      list.push({ site, blockTime, unblockTime, added: Date.now(), blocked: false });
      chrome.storage.sync.set({ blacklist: list }, () => {
        statusDiv.textContent = `Added: ${site}`;
        renderBlacklist();
        addForm.reset();
      });
    });
  } else {
    statusDiv.textContent = 'Please enter valid values.';
  }
});

renderBlacklist();

// Listen for changes in storage to update blacklist UI in real time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.blacklist) {
    renderBlacklist();
  }
});

// Poll every second to update timer in popup
setInterval(renderBlacklist, 1000);
// ...existing code...
