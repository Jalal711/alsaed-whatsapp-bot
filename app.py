from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# بيانات التوثيق الخاصة بك (يفضل وضعها في متغيرات البيئة Environment Variables)
VERIFY_TOKEN = "alsaid_solar_token_2026"
WHATSAPP_TOKEN = "ضع_رمز_الوصول_المؤقت_هنا"
PHONE_NUMBER_ID = "1346890848518184"

@app.route('/webhook', methods=['GET'])
def verify_webhook():
    # التحقق من الـ Webhook مع ميتا
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    if mode and token:
        if mode == 'subscribe' and token == VERIFY_TOKEN:
            return challenge, 200
        else:
            return 'Verification failed', 403
    return 'Hello from Al-Saed Solar Bot', 200

@app.route('/webhook', methods=['POST'])
def receive_message():
    data = request.json
    print("Received data:", data)
    
    try:
        # استخراج الرسالة الواردة من العميل
        entry = data['entry'][0]
        change = entry['changes'][0]
        value = change['value']
        
        if 'messages' in value:
            phone_number_id = value['metadata']['phone_number_id']
            message = value['messages'][0]
            from_number = message['from'] # رقم هاتفك أو العميل
            msg_body = message['text']['body'].strip()
            
            print(f"Message from {from_number}: {msg_body}")
            
            # منطق الرد الآلي المبسط
            reply_text = "مرحباً بك في شركة الصاعد للطاقة الشمسية وأنظمة التحكم. كيف يمكننا مساعدتك اليوم؟"
            if "سعر" in msg_body or "اسعار" in msg_body:
                reply_text = "أسعار منظومات الطاقة الشمسية تبدأ من التركيب وحتى التسليم المفتاح بحسب عدد الألواح. هل تود معرفة تفاصيل أسعار منظومات 3 إلى 18 لوح؟"
            
            # إرسال الرد عبر WhatsApp API
            send_whatsapp_message(from_number, reply_text)
            
    except Exception as e:
        print("Error processing webhook:", e)
        
    return jsonify({"status": "success"}), 200

def send_whatsapp_message(to_number, message_text):
    url = f"https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message_text}
    }
    response = requests.post(url, json=payload, headers=headers)
    print("Send response:", response.json())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
