const connectForm = document.getElementById('connect-form');
const disconnectBtn = document.getElementById('disconnect-btn');
const connectBtn = document.getElementById('connect-btn');
const statusPill = document.getElementById('connection-status');
const viewerFrame = document.getElementById('viewer-frame');
const viewerPlaceholder = document.getElementById('viewer-placeholder');

const gotoForm = document.getElementById('goto-form');
const followForm = document.getElementById('follow-form');
const followSelect = document.getElementById('follow-username');
const collectForm = document.getElementById('collect-form');
const stopBtn = document.getElementById('stop-btn');
const chatForm = document.getElementById('chat-form');
const logOutput = document.getElementById('log-output');

let isConnected = false;
let viewerLoaded = false;

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${path} failed`);
  return data;
}

function setConnected(connected) {
  isConnected = connected;
  statusPill.textContent = connected ? 'Connected' : 'Disconnected';
  statusPill.className = `status-pill ${connected ? 'connected' : 'disconnected'}`;
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
}

connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  connectBtn.disabled = true;
  try {
    await api('connect', {
      method: 'POST',
      body: {
        host: document.getElementById('host').value,
        port: Number(document.getElementById('port').value) || 25565,
        username: document.getElementById('username').value,
        version: document.getElementById('version').value || undefined,
        auth: document.getElementById('auth').value
      }
    });
  } catch (err) {
    alert(err.message);
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', async () => {
  try {
    await api('disconnect', { method: 'POST' });
    setConnected(false);
    viewerLoaded = false;
    viewerFrame.src = '';
    viewerPlaceholder.style.display = 'flex';
  } catch (err) {
    alert(err.message);
  }
});

gotoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('goto', {
      method: 'POST',
      body: {
        x: Number(document.getElementById('goto-x').value),
        y: Number(document.getElementById('goto-y').value),
        z: Number(document.getElementById('goto-z').value)
      }
    });
  } catch (err) {
    alert(err.message);
  }
});

followForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = followSelect.value;
  if (!username) return alert('No players available to follow');
  try {
    await api('follow', { method: 'POST', body: { username } });
  } catch (err) {
    alert(err.message);
  }
});

collectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('collect-wood', {
      method: 'POST',
      body: { amount: Number(document.getElementById('collect-amount').value) || 5 }
    });
  } catch (err) {
    alert(err.message);
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    await api('stop', { method: 'POST' });
  } catch (err) {
    alert(err.message);
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-message');
  const message = input.value.trim();
  if (!message) return;
  try {
    await api('chat', { method: 'POST', body: { message } });
    input.value = '';
  } catch (err) {
    alert(err.message);
  }
});

async function pollStatus() {
  try {
    const data = await api('status');
    setConnected(data.connected);

    if (data.connected) {
      document.getElementById('stat-health').textContent = data.health ?? '-';
      document.getElementById('stat-food').textContent = data.food ?? '-';
      document.getElementById('stat-position').textContent = data.position
        ? `${data.position.x}, ${data.position.y}, ${data.position.z}`
        : '-';

      const playersList = document.getElementById('players-list');
      playersList.innerHTML = '';
      followSelect.innerHTML = '';
      (data.players || []).forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p;
        playersList.appendChild(li);

        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        followSelect.appendChild(opt);
      });

      const invList = document.getElementById('inventory-list');
      invList.innerHTML = '';
      (data.inventory || []).forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        invList.appendChild(li);
      });

      if (!viewerLoaded) {
        viewerFrame.src = '/viewer';
        viewerPlaceholder.style.display = 'none';
        viewerLoaded = true;
      }
    } else {
      viewerLoaded = false;
      viewerFrame.src = '';
      viewerPlaceholder.style.display = 'flex';
    }
  } catch (err) {
    // panel server itself unreachable; ignore transient errors
  }
}

async function pollLog() {
  try {
    const data = await api('log');
    logOutput.textContent = (data.log || []).join('\n');
    logOutput.scrollTop = logOutput.scrollHeight;
  } catch (err) {
    // ignore
  }
}

setInterval(pollStatus, 1000);
setInterval(pollLog, 1500);
setConnected(false);
