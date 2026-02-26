import google.generativeai as genai
import traceback

genai.configure(api_key="REDACTED_KEY")
model = genai.GenerativeModel(model_name="gemini-2.5-flash")
chat = model.start_chat()
try:
    response = chat.send_message("I feel sick")
    print('SUCCESS:', response.text)
except Exception as e:
    traceback.print_exc()
