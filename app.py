from flask import Flask, request, jsonify

app = Flask(__name__)

VERIFY_TOKEN = "alsaid_solar_token_2026"

@app.route("/webhook", methods=["GET"])
def verify_webhook():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            return challenge, 200
        else:
            return "Verification failed", 403
    return "Hello World", 200

@app.route("/webhook", methods=["POST"])
def handle_whatsapp_message():
    data = request.get_json()
    try:
        message_entry = data["entry"][0]["changes"][0]["value"]
        if "messages" in message_entry:
            sender_phone = message_entry["messages"][0]["from"]
            message_body = message_entry["messages"][0]["text"]["body"].lower()
            response_text = generate_auto_response(message_body)
            send_whatsapp_message(sender_phone, response_text)
    except Exception as e:
        print(f"Error handling message: {e}")
    return jsonify({"status": "success"}), 200

def generate_auto_response(text):
    if any(word in text for word in ["طاقة", "الواح", "شمسية", "1", "اسعار الطاقة"]):
        return (
            "☀️ *أسعار تركيب منظومة الطاقة الشمسية (شاملة التركيب فقط):*\n\n"
            "• من 3 إلى 4 ألواح: 400,000 جنيه\n"
            "• من 6 إلى 8 ألواح: 600,000 جنيه\n"
            "• من 9 إلى 12 لوح: 1,000,000 جنيه\n"
            "• من 14 إلى 18 لوح: 1,500,000 جنيه\n\n"
            "📍 نطاق العمل: عطبرة وبربر وضواحيها.\n"
            "للتواصل المباشر مع م. جلال الدين الصادق: 0113100906"
        )
    elif any(word in text for word in ["تحكم", "ats", "امبير", "2", "كهرباء"]):
        return (
            "⚡ *أسعار منظومة التحكم والتبديل الأوتوماتيكي (ATS) (شاملة المعدات والتركيب):*\n\n"
            "• 63 أمبير: 750,000 جنيه\n"
            "• 100 أمبير: 1,250,000 جنيه\n\n"
            "📍 نطاق العمل: عطبرة وبربر وضواحيها.\n"
            "للتواصل المباشر مع م. جلال الدين الصادق: 0113100906"
        )
    else:
        return (
            "مرحباً بك في *مفوضية الصاعد لأنظمة الطاقة الشمسية والتحكم* ☀️⚡\n"
            "إدارة المهندس/ جلال الدين الصادق.\n\n"
            "الرجاء اختيار أحد الخيارات التالية:\n"
            "1️⃣ للاستفسار عن أسعار تركيب الطاقة الشمسية.\n"
            "2️⃣ للاستفسار عن أسعار ونظام التحكم (ATS).\n"
            "📍 نخدم مناطق: عطبرة وبربر وضواحيها.\n\n"
            "للتواصل الهاتفي / واتساب: 0113100906"
        )

def send_whatsapp_message(phone, text):
    print(f"Sending to {phone}: {text}")

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
