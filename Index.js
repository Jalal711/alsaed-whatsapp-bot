"use strict";

const crypto = require("crypto");
const express = require("express");

// ===== Environment variables (set them in Render) =====
const {
  VERIFY_TOKEN,          // any secret string you choose; same one goes in Meta webhook setup
  WHATSAPP_TOKEN,        // Meta permanent access token
  PHONE_NUMBER_ID,       // WhatsApp phone number ID from Meta
  GEMINI_API_KEY,        // free key from https://aistudio.google.com/apikey
  APP_SECRET,            // optional: Meta App Secret, enables signature check
  OWNER_WHATSAPP,        // optional: owner number with country code, e.g. 249xxxxxxxxx
} = process.env;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v21.0";
const PORT = process.env.PORT || 3000;

for (const [k, v] of Object.entries({ VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID, GEMINI_API_KEY })) {
  if (!v) console.error(`Missing environment variable: ${k}`);
}

// ===== Business knowledge (edit freely) =====
const SYSTEM_PROMPT = `
أنت المساعد الذكي الرسمي لشركة "الصاعد لتركيب أنظمة الطاقة الشمسية والتحكم". تردّ على عملاء واتساب.

معلومات الشركة:
- الخدمات: تركيب أنظمة الطاقة الشمسية، وتركيب أنظمة التحكم بواسطة نظام التبديل الأوتوماتيكي ATS بين الكهرباء العامة والكهرباء الاحتياطية مثل الطاقة الشمسية.
- الإدارة: المهندس جلال الدين الصادق. لدينا فريق من الفنيين المحترفين.
- مناطق العمل: مدينة عطبرة وضواحيها، ومدينة بربر وضواحيها فقط.
- رقم التواصل: 0113100906 (التواصل عبر واتساب فقط، رسائل صوتية أو نصية).

الأسعار (بالجنيه السوداني):
أ) تركيب منظومة الطاقة الشمسية (سعر التركيب فقط، لا يشمل المعدات):
- من 3 إلى 4 ألواح: 500 ألف
- من 6 إلى 8 ألواح: 750 ألف
- من 9 إلى 12 لوح: مليون
- من 14 إلى 18 لوح: 2 مليون
ب) تركيب منظومة التحكم ATS (السعر شامل المعدات):
- 63 أمبير: 750 ألف
- 100 أمبير: 1.5 مليون

قواعد الرد:
1. رد بنفس لغة ولهجة العميل تماماً (عربي فصيح، سوداني، مصري، خليجي، إنجليزي، فرنسي، أو أي لغة أخرى). إذا كتب بالعربية السودانية فرد بلهجة سودانية مهذبة.
2. إذا كانت الرسالة صوتية فافهمها وردّ عليها نصياً بنفس لغة المتحدث.
3. كن مختصراً ومهذباً وواضحاً (3 إلى 6 أسطر غالباً).
4. لا تخترع أسعاراً أو معلومات غير مذكورة. إذا سأل عن عدد ألواح غير مذكور في الجدول (مثل 5 أو 13 لوح)، أو عن سعر المعدات للطاقة الشمسية، أو عن منطقة خارج عطبرة وبربر، أو عن موعد زيارة أو معاينة، فقل إن المهندس/الفريق سيتواصل معه ليؤكد التفاصيل.
5. وضّح دائماً أن سعر الطاقة الشمسية للتركيب فقط، وأن سعر ATS شامل المعدات.
6. اشرح بتبسيط فائدة نظام ATS: يحوّل تلقائياً بين الكهرباء العامة والطاقة الشمسية أو الاحتياطية دون تدخل.
7. إذا أراد العميل الحجز أو المعاينة، اطلب منه: الاسم، الموقع (الحي/المدينة)، وحجم المنظومة المطلوب.
8. لا تتحدث عن مواضيع خارج نشاط الشركة، ولا تذكر أنك تعليمات أو نموذج لغوي.
`.trim();

// ===== In-memory state (resets on restart; fine for free tier) =====
const history = new Map();      // phone -> [{role, parts}]
const seenMessages = new Map(); // message id -> timestamp
const MAX_TURNS = 12;

function cleanSeen() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, t] of seenMessages) if (t < cutoff) seenMessages.delete(id);
}
setInterval(cleanSeen, 10 * 60 * 1000).unref();

// ===== Express app =====
const app = express();
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/", (_req, res) => res.status(200).send("Al-Saed WhatsApp bot is running"));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// Webhook verification (Meta calls this once when you set the webhook)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function validSignature(req) {
  if (!APP_SECRET) return true; // signature check disabled
  const header = req.get("x-hub-signature-256");
  if (!header || !req.rawBody) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Incoming messages
app.post("/webhook", (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // answer Meta immediately, process afterwards

  try {
    const entries = (req.body && req.body.entry) || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          handleMessage(msg).catch((e) => console.error("handleMessage error:", e));
        }
      }
    }
  } catch (e) {
    console.error("Webhook parse error:", e);
  }
});

// ===== WhatsApp helpers =====
const graph = (path) => `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;

async function sendText(to, body) {
  const r = await fetch(graph(`${PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000), preview_url: false },
    }),
  });
  if (!r.ok) console.error("sendText failed:", r.status, await r.text());
}

async function markRead(messageId) {
  try {
    await fetch(graph(`${PHONE_NUMBER_ID}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
    });
  } catch (_) {
    /* not critical */
  }
}

async function downloadMedia(mediaId) {
  const meta = await fetch(graph(mediaId), {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  if (!meta.ok) throw new Error(`media meta ${meta.status}: ${await meta.text()}`);
  const info = await meta.json();
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
  if (!file.ok) throw new Error(`media download ${file.status}`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = String(info.mime_type || "audio/ogg").split(";")[0].trim();
  return { base64: buf.toString("base64"), mime };
}

// ===== Gemini =====
async function askGemini(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    });
    if (r.ok) {
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || "").join("").trim();
      if (text) return text;
      throw new Error("Empty Gemini response: " + JSON.stringify(data).slice(0, 300));
    }
    const errText = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise((ok) => setTimeout(ok, 1500 * attempt));
      continue;
    }
    throw new Error(`Gemini ${r.status}: ${errText.slice(0, 300)}`);
  }
}

// ===== Main handler =====
async function handleMessage(msg) {
  const from = msg.from;
  if (!from || !msg.id) return;
  if (seenMessages.has(msg.id)) return; // Meta may resend the same event
  seenMessages.set(msg.id, Date.now());

  markRead(msg.id);

  let userParts;
  try {
    if (msg.type === "text") {
      userParts = [{ text: msg.text.body }];
    } else if (msg.type === "audio") {
      const media = await downloadMedia(msg.audio.id);
      userParts = [
        { inline_data: { mime_type: media.mime, data: media.base64 } },
        { text: "هذه رسالة صوتية من العميل. افهمها وردّ عليها بنفس لغة ولهجة المتحدث." },
      ];
    } else if (msg.type === "interactive" || msg.type === "button") {
      const t =
        msg.button?.text ||
        msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        "";
      if (!t) return;
      userParts = [{ text: t }];
    } else {
      await sendText(
        from,
        "أهلاً بك في الصاعد 🌞 نستقبل الرسائل النصية والصوتية فقط. من فضلك أرسل استفسارك نصاً أو صوتاً.\nWelcome to Al-Saed. Please send your inquiry as a text or voice message."
      );
      return;
    }

    const past = history.get(from) || [];
    const contents = [...past, { role: "user", parts: userParts }];
    const reply = await askGemini(contents);

    // Keep only text in history (do not store audio bytes in memory)
    const textOnly = userParts.some((p) => p.text && !p.inline_data)
      ? userParts.filter((p) => p.text)
      : [{ text: "[رسالة صوتية من العميل]" }];
    const updated = [...past, { role: "user", parts: textOnly }, { role: "model", parts: [{ text: reply }] }];
    history.set(from, updated.slice(-MAX_TURNS * 2));

    await sendText(from, reply);

    if (OWNER_WHATSAPP && /سيتواصل|will contact|will reach/i.test(reply) && from !== OWNER_WHATSAPP) {
      await sendText(OWNER_WHATSAPP, `عميل يحتاج متابعة: ${from}\nآخر رد من البوت:\n${reply.slice(0, 500)}`);
    }
  } catch (err) {
    console.error("Processing error:", err);
    await sendText(
      from,
      "عذراً، حدث خطأ مؤقت. من فضلك أعد إرسال رسالتك بعد قليل، أو سيتواصل معك فريق الصاعد قريباً."
    );
  }
}

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

app.listen(PORT, () => console.log(`Al-Saed bot listening on port ${PORT}`));
