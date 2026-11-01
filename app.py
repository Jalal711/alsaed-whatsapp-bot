from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# مسار لفحص الصحة والتأكد من أن السيرفر يعمل
@app.route("/", methods=["GET"])
def home():
    return "Al-Saed Bot is active!", 200

VERIFY_TOKEN = "alsaid_solar_token_2026"

# مسار التحقق من الويب هوك (GET)
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
    return "Invalid verification request", 400

# مسار استقبال رسائل العملاء (POST)
@app.route("/webhook", methods=["POST"])
def receive_message():
    data = request.get_json()
    
    # التحقق من أن الطلب يحتوي على رسالة واردة من واتساب
    try:
        if data.get("object") == "whatsapp_business_account":
            for entry in data.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    messages = value.get("messages", [])
                    
                    if messages:
                        message = messages[0]
                        sender_phone = message.get("from") # رقم هاتف العميل
                        message_body = message.get("text", {}).get("body") # نص الرسالة
                        
                        print(f"تم استلام رسالة من {sender_phone}: {message_body}")
                        
                        # هنا يمكنك لاحقاً إضافة منطق الرد الآلي وإرسال الرسائل عبر Meta API
                        
            return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error processing webhook: {e}")
        return jsonify({"status": "error"}), 500

    return jsonify({"status": "ignored"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
