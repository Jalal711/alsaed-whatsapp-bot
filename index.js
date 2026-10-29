const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// البيانات التي أخذناها من ميتا
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = "alsaed_secure_token_2026";

// 1. نقطة التحقق (Webhook Verification) لربط ميتا بالسيرفر
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. استقبال الرسائل من العملاء والرد عليها تلقائياً
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
                const from = body.entry[0].changes[0].value.messages[0].from; // رقم العميل
                const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // نص الرسالة

                console.log(`رسالة من ${from}: ${msg_body}`);

                // الرد التلقائي لخدمات الصاعد للطاقة الشمسية وأنظمة التحكم
                let replyText = "مرحباً بك في شركة الصاعد لأنظمة الطاقة الشمسية والتحكم (ATS). كيف يمكننا مساعدتك اليوم؟";
                
                if (msg_body.includes("طاقة") || msg_body.includes("شمسية")) {
                    replyText = "نحن نقدم أفضل أنظمة الطاقة الشمسية المتكاملة للمنازل والشركات. هل تود معرفة الأسعار؟";
                } else if (msg_body.includes("ATS") || msg_body.includes("تحويل")) {
                    replyText = "أجهزة التحكم الآلي (ATS) لدينا مصممة خصيصاً لضمان استقرار التيار الكهربائي وحماية الأجهزة.";
                }

                // إرسال الرد عبر واتساب API
                await axios({
                    method: 'POST',
                    url: `https://graph.facebook.com/v17.0/${phone_number_id}/messages`,
                    headers: {
                        'Authorization': `Bearer ${TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    data: {
                        messaging_product: 'whatsapp',
                        to: from,
                        text: { body: replyText },
                    },
                });
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Error handling webhook:", error);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
