const express = require('express');
const cors = require('cors');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlockPlugin = require('mineflayer-collectblock').plugin;
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Render (and most free hosts) only expose ONE public port, so the viewer
// runs on an internal-only port and gets proxied through the main app at /viewer.
const PANEL_PORT = process.env.PORT || 3000;
const VIEWER_PORT = process.env.VIEWER_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const viewerProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${VIEWER_PORT}`,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/viewer': '' }
});
app.use('/viewer', viewerProxy);

let bot = null;
let viewerActive = false;
let logBuffer = [];
const MAX_LOG = 300;

const LOG_NAMES = [
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log',
  'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem'
];

function log(msg) {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG) logBuffer.shift();
  console.log(entry);
}

function requireBot(res) {
  if (!bot || !bot.entity) {
    res.status(400).json({ error: 'Bot is not connected' });
    return false;
  }
  return true;
}

// ---- Connection ----

app.post('/api/connect', (req, res) => {
  if (bot) return res.status(400).json({ error: 'Already connected. Disconnect first.' });

  const { host, port, username, version, auth } = req.body || {};
  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }

  try {
    bot = mineflayer.createBot({
      host,
      port: port ? Number(port) : 25565,
      username,
      version: version || undefined,
      auth: auth === 'microsoft' ? 'microsoft' : 'offline'
    });

    bot.loadPlugin(pathfinder);
    bot.loadPlugin(collectBlockPlugin);

    bot.once('spawn', () => {
      log(`Spawned as "${bot.username}" on ${host}:${port || 25565}`);

      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      if (!viewerActive) {
        mineflayerViewer(bot, { port: Number(VIEWER_PORT), firstPerson: true });
        viewerActive = true;
        log(`Live first-person view started on port ${VIEWER_PORT}`);
      }
    });

    bot.on('chat', (sender, message) => {
      if (sender === bot.username) return;
      log(`<${sender}> ${message}`);
    });

    bot.on('kicked', (reason) => {
      log(`Kicked from server: ${JSON.stringify(reason)}`);
      bot = null;
      viewerActive = false;
    });

    bot.on('error', (err) => {
      log(`Bot error: ${err.message}`);
    });

    bot.on('end', () => {
      log('Disconnected from server');
      bot = null;
      viewerActive = false;
    });

    res.json({ ok: true });
  } catch (err) {
    bot = null;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  if (!bot) return res.status(400).json({ error: 'Not connected' });
  bot.quit();
  bot = null;
  viewerActive = false;
  res.json({ ok: true });
});

// ---- Status / log polling ----

app.get('/api/status', (req, res) => {
  if (!bot || !bot.entity) {
    return res.json({ connected: false });
  }
  const pos = bot.entity.position;
  res.json({
    connected: true,
    username: bot.username,
    health: bot.health,
    food: bot.food,
    position: { x: pos.x.toFixed(1), y: pos.y.toFixed(1), z: pos.z.toFixed(1) },
    players: Object.keys(bot.players).filter((p) => p !== bot.username),
    inventory: bot.inventory ? bot.inventory.items().map((i) => `${i.name} x${i.count}`) : [],
    viewerPort: Number(VIEWER_PORT)
  });
});

app.get('/api/log', (req, res) => {
  res.json({ log: logBuffer });
});

// ---- Chat ----

app.post('/api/chat', (req, res) => {
  if (!requireBot(res)) return;
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });
  bot.chat(message);
  log(`Bot said: ${message}`);
  res.json({ ok: true });
});

// ---- High-level tasks ----

app.post('/api/goto', (req, res) => {
  if (!requireBot(res)) return;
  const { x, y, z } = req.body || {};
  if ([x, y, z].some((v) => typeof v !== 'number')) {
    return res.status(400).json({ error: 'x, y, z must be numbers' });
  }
  bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));
  log(`Task started: go to (${x}, ${y}, ${z})`);
  res.json({ ok: true });
});

app.post('/api/follow', (req, res) => {
  if (!requireBot(res)) return;
  const { username } = req.body || {};
  const playerEntry = bot.players[username];
  if (!playerEntry || !playerEntry.entity) {
    return res.status(400).json({ error: `Player "${username}" is not visible to the bot` });
  }
  bot.pathfinder.setGoal(new goals.GoalFollow(playerEntry.entity, 2), true);
  log(`Task started: follow ${username}`);
  res.json({ ok: true });
});

app.post('/api/collect-wood', async (req, res) => {
  if (!requireBot(res)) return;
  const amount = Math.max(1, Number(req.body?.amount) || 5);

  res.json({ ok: true, started: true });
  log(`Task started: collect ${amount} logs`);

  try {
    const positions = bot.findBlocks({
      matching: (block) => LOG_NAMES.includes(block.name),
      maxDistance: 64,
      count: amount
    });

    if (!positions.length) {
      log('No log blocks found within range');
      return;
    }

    const blocks = positions.map((p) => bot.blockAt(p)).filter(Boolean);
    await bot.collectBlock.collect(blocks, {
      ignoreNoPath: true
    });
    log('Finished collecting wood');
  } catch (err) {
    log(`Collect wood task failed: ${err.message}`);
  }
});

app.post('/api/stop', (req, res) => {
  if (!requireBot(res)) return;
  bot.pathfinder.setGoal(null);
  try {
    bot.collectBlock.cancelTask();
  } catch (_) {
    // no task running, ignore
  }
  log('Current task stopped');
  res.json({ ok: true });
});

const server = app.listen(PANEL_PORT, () => {
  console.log(`Control panel running at http://localhost:${PANEL_PORT}`);
  console.log(`(Live view will be available at /viewer once the bot connects)`);
});

// Required for the viewer's websocket connection to proxy correctly
server.on('upgrade', viewerProxy.upgrade);
