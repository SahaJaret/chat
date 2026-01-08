import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const PORT = process.env.PORT || 3000;

// ⚠️ Захардкоженные ТЕСТОВЫЕ значения
const AUTH_SECRET = ""; 
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1432791284015169537/BxjhjGU3JYNmXsn7gGikDb_mvIRMzlZIMe0-93KvEnDCb_yOeCHy0dykPBqt4XnCJPwq";
const DISCORD_BOT_TOKEN = "MTQzMjc4Njk3NDYyMzc5NzMzMA.GqFBZn.lgjvfGijR0dx7wFkKmeAFBvZff6UHQ--cL9Vd0";
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

// POST /send - отправка через webhook
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

    if (!r.ok) {
      const errorText = await r.text();
      console.error("❌ Webhook error:", errorText);
      return res.status(502).json({ error: "Discord webhook error", body: errorText });
    }

    console.log("✅ Message sent via webhook");
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Send error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /pull - чтение сообщений через Bot API
app.get("/pull", async (req, res) => {
  try {
    const since = (req.query.since || "").trim();
    const url = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=50`;
    
    console.log("📥 Fetching messages from Discord...");
    console.log("🔑 Using token:", DISCORD_BOT_TOKEN.substring(0, 20) + "...");
    
    const r = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    console.log("📊 Discord API response status:", r.status);

    if (!r.ok) {
      const errorText = await r.text();
      console.error("❌ Discord API error:", r.status, errorText);
      
      let hint = "";
      if (r.status === 401) {
        hint = "🔧 FIX: Go to Discord Developer Portal → Your App → Bot → Enable 'MESSAGE CONTENT INTENT'";
      } else if (r.status === 403) {
        hint = "🔧 FIX: Bot needs 'View Channel' and 'Read Message History' permissions";
      } else if (r.status === 404) {
        hint = "🔧 FIX: Channel ID is wrong or bot is not in the server";
      }
      
      return res.status(502).json({ 
        error: "Discord API error",
        status: r.status,
        body: errorText,
        hint: hint
      });
    }

    const msgs = await r.json();
    console.log(`✅ Fetched ${msgs.length} messages`);
    
    const items = msgs
      .filter(m => !since || BigInt(m.id) > BigInt(since))
      .map(m => ({
        id: m.id,
        author: m.author?.username || "unknown",
        text: m.content || "",
        time: m.timestamp
      }))
      .reverse();

    console.log(`📤 Returning ${items.length} messages (after filter)`);
    res.json({ items, count: items.length });
  } catch (e) {
    console.error("❌ Pull error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// Тестовый эндпоинт для проверки бота
app.get("/test-bot", async (req, res) => {
  try {
    console.log("🧪 Testing bot token...");
    
    const r = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` }
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error("❌ Bot test failed:", r.status, errorText);
      return res.json({ 
        ok: false,
        error: "Bot token invalid or expired", 
        status: r.status,
        body: errorText,
        hint: "🔧 Regenerate bot token in Discord Developer Portal"
      });
    }
    
    const bot = await r.json();
    console.log("✅ Bot authenticated:", bot.username);
    
    res.json({ 
      ok: true, 
      bot: { 
        username: bot.username, 
        id: bot.id,
        discriminator: bot.discriminator
      },
      message: "Bot token is valid! Check if MESSAGE CONTENT INTENT is enabled."
    });
  } catch (e) {
    console.error("❌ Test error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Relay server running on port ${PORT}`);
  console.log(`🤖 Bot ID: ${DISCORD_BOT_TOKEN.split('.')[0]}`);
  console.log(`📺 Channel ID: ${DISCORD_CHANNEL_ID}`);
  console.log(`\n📝 Test endpoints:`);
  console.log(`   GET  / - Health check`);
  console.log(`   GET  /test-bot - Test bot token`);
  console.log(`   GET  /pull?since=0 - Fetch messages`);
  console.log(`   POST /send - Send message\n`);
});

