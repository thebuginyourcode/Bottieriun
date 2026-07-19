# Minecraft Bot Control Panel

A web dashboard for a [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot with:
- **Live first-person 3D view** via [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer) (renders the actual chunks/entities the bot has loaded, in the browser)
- **High-level task control**: go to coordinates, follow a player, collect wood
- Live health/food/position/inventory stats and an activity log

Use this only on servers you own or that explicitly allow bots. Automating gameplay (auto-farming, auto-combat, etc.) on public servers you don't control usually violates that server's own rules, even though it's not against Mojang's EULA itself.

## Option A: Deploy to Render (recommended if you're on mobile)

No local install needed — everything runs in the cloud and you just open a URL.

1. Create a free [GitHub](https://github.com) account if you don't have one, and a new repository.
2. Upload this entire `mc-bot-panel` folder's contents to that repo (GitHub's web UI lets you drag-and-drop files, no terminal required).
3. Create a free [Render](https://render.com) account.
4. Click **New > Web Service**, connect your GitHub repo.
5. Set:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Click **Create Web Service**. Render will build and deploy it, then give you a URL like `https://mc-bot-panel.onrender.com`.
7. Open that URL on your phone and use the panel exactly as described below. The live view is served at `/viewer` under the same URL, so no extra ports or config needed.

Notes for the free Render tier:
- The service spins down after 15 minutes of inactivity and takes ~30–60 seconds to wake back up on the next visit — reconnect the bot after it wakes.
- Outbound connections to your Minecraft server work fine from Render; just make sure the server's host/port are reachable from the public internet (a `localhost` server on your own PC won't be reachable from Render — it needs to be a server with a real public IP, or use something like ngrok/playit.gg to expose it).

## Option B: Run it yourself (local machine, Termux, etc.)

### 1. Requirements

- [Node.js](https://nodejs.org) 18 or newer
- A Minecraft Java Edition server to connect to (can be `localhost` if you run one yourself)

## 2. Install

```bash
cd mc-bot-panel
npm install
```

## 3. Run

```bash
npm start
```

Then open **http://localhost:3000** in your browser.

## 4. Connect the bot

In the top bar, fill in:
- **Server host** — e.g. `localhost` or your server's IP
- **Port** — default `25565`
- **Bot username** — the name the bot will join as
- **Version** — leave blank to auto-detect, or set explicitly (e.g. `1.20.4`) if auto-detect fails
- **Auth** — `Offline / Cracked` for offline-mode servers, `Microsoft Account` if the server requires a real premium account (this will prompt a device-code login in your terminal on first connect)

Click **Connect**. Once the bot spawns, the live view panel will load automatically (served from port `3001`).

## 5. Controls

- **Go To Coordinates** — pathfinds to the given X/Y/Z
- **Follow Player** — pick a currently-visible player and follow them
- **Collect Wood** — mines the nearest N log blocks (any wood type) it can path to
- **Stop Current Task** — cancels the current pathfinding/collection task
- **Chat** — sends a message as the bot

## Notes

- Only one bot connection is supported at a time in this version.
- The live view server runs on port `3001` by default; change it with the `VIEWER_PORT` environment variable if that port is in use.
- The control panel itself runs on port `3000`; change it with the `PORT` environment variable.
