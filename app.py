from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# إعدادات التوثيق والاتصال
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "alsaid_solar_token_2026")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "ضع_رمز_الوصول_المؤقت_هنا")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID", "1346890848518184")

@app.route('/webhook', methods=['GET'])
def verify_webhook():
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    if mode and token:
        if mode == 'subscribe' and token == VERIFY_TOKEN:
            return challenge, 200
        else:
            return 'Verification failed', 403
    return 'Al-Saed Solar Bot Server is Active', 200

@app.route('/webhook', methods=['POST'])
def receive_message():
    data = request.json
    print("Received webhook data:", data)
    
    try:
        entry = data['entry'][0]
        change = entry['changes'][0]
        value = change['value']
        
        if 'messages' in value:
            message = value['messages'][0]
            from_number = message['from']
            msg_body = message['text']['body'].strip().lower()
            
            print(f"Message from {from_number}: {msg_body}")
            
            # منطق الرد الآلي لأنظمة الطاقة الشمسية والتحكم ATS
            if "سعر" in msg_body or "اسعار" in msg_body or "تكلفة" in msg_body:
                reply_text = (
                    "مرحباً بك في *الصاعد لتركيب أنظمة الطاقة الشمسية والتحكم* ☀️\n\n"
                    "أسعار المنظومات لدينا تبدأ من التركيب وحتى التسليم المفتاح بحسب عدد الألواح:\n"
                    "• منظومات 3 إلى 6 ألواح\n"
                    "• منظومات 8 إلى 12 لوح\n"
                    "• منظومات 14 إلى 18 لوح\n\n"
                    "للحصول على عرض سعر دقيق يناسب أحمالك، يرجى تزويدنا بتفاصيل الأجهزة المراد تشغيلها."
                )
            elif "ats" in msg_body or "تحكم" in msg_body or "كهرباء" in msg_body:
                reply_text = (
                    "نحن متخصصون في تركيب أنظمة التحكم الآلي ولوحات التحويل التلقائي (ATS):\n"
                    "• وحدة ATS بقدرة 63 أمبير\n"
                    "• وحدة ATS بقدرة 100 أمبير\n"
                    "هل تود حجز معاينة أو تركيب نظام ATS لمنزلك أو شركتك؟"
                )
            elif "مرحباً" in msg_body or "السلام" in msg_body or "hi" in msg_body:
                reply_text = (
                    "أهلاً بك معنا في شركة *الصاعد*! ⚡\n"
                    "نحن نقدم خدمات متكاملة في هندسة الطاقة الشمسية، التصميم الكهربائي المنزلي، وأنظمة الـ ATS.\n"
                    "كيف يمكننا مساعدتك اليوم؟ يمكنك كتابة (أسعار) أو (ATS) للاستفسار الفوري."
                )
            else:
                reply_text = (
                    "شكراً لتواصلك مع *الصاعد لأنظمة الطاقة الشمسية والتحكم*. "
                    "تم استلام رسالتك وسيقوم المهندس المختص بالرد عليك قريباً، أو يمكنك كتابة كلمة (أسعار) لمعرفة تفاصيل المنظومات."
                )
            
            # إرسال الرد الآلي الفوري عبر WhatsApp Cloud API
            send_whatsapp_message(from_number, reply_text)
            
    except Exception as e:
        print("Error processing webhook payload:", e)
        
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
    print("Send response status:", response.status_code)
    print("Send response body:", response.json())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
