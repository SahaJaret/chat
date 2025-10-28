// index.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;

// ⚠️ Захардкоженные значения (как ты просил)
const AUTH_SECRET = ""; // можешь оставить пустым
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1432791284015169537/BxjhjGU3JYNmXsn7gGikDb_mvIRMzlZIMe0-93KvEnDCb_yOeCHy0dykPBqt4XnCJPwq";
const DISCORD_BOT_TOKEN  = "MTQzMjc4Njk3NDYyMzc5NzMzMA.GV1eK5.SGFkQ3qQVKUJtMVNlAUtKDuk0GP_XaXmsapfkc";
const DISCORD_CHANNEL_ID = "1432784530653319290";

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (!AUTH_SECRET) return next();
  if (req.headers["x-auth-secret"] !== AUTH_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/", (_, res) => res.json({ ok: true, up: true }));

// отправка в канал через webhook
app.post("/send", async (req, res) => {
  try {
    const { from, message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Empty message" });
    }
    const content = (from ? `**${from}:** ` : "") + message.slice(0, 1800);
    const r = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Vezunt Relay", content })
    });
    if (!r.ok) return res.status(502).json({ error: "Discord webhook error", body: await r.text() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// чтение из канала через Bot API
app.get("/pull", async (req, res) => {
  try {
    const since = (req.query.since || "").trim();
    const url = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=50`;
    const r = await fetch(url, { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }});
    if (!r.ok) return res.status(502).json({ error: "Discord API error", body: await r.text() });
    const msgs = await r.json();
    const items = msgs
      .filter(m => !since || BigInt(m.id) > BigInt(since))
      .map(m => ({ id: m.id, author: m.author?.username || "unknown", text: m.content || "", time: m.timestamp }))
      .reverse();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Relay on :${PORT}`));

