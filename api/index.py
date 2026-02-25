from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from deep_translator import GoogleTranslator
import requests
import uvicorn

app = FastAPI(title="Med-AI Chatbot Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/chat")
async def chat_interaction(
    symptoms: str = Form(..., description="The spoken or typed symptoms"),
    duration: str = Form("", description="The illness duration"),
    language: str = Form("en", description="Target language code (e.g. 'en', 'mr', 'hi')")
):
    """
    Advanced chatbot endpoint that provides dynamic, contextual health guidance.
    Avoids scripted responses by using Groq Llama 3 for intelligent fallbacks.
    """
    
    # Start with None - we'll get intelligent advice from Groq or fallback
    advice = None
    import os
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    
    try:
        # Sophisticated system prompt that encourages natural, non-scripted responses
        system_prompt = """You are an empathetic medical assistant AI. Provide helpful health guidance based on reported symptoms.
Guidelines:
- Be conversational and natural, not robotic or scripted
- Provide specific, contextual advice (not generic templates)
- Consider symptom severity and duration when mentioned
- Always recommend professional medical evaluation
- Be honest about limitations of remote assessment
- Avoid repeating the same phrases or patterns
- Keep responses concise (2-3 sentences max)"""
        
        user_context = f"Patient reports: {symptoms}"
        if duration:
            user_context += f" (Duration: {duration})"
        
        print(f"DEBUG: Attempting to connect to Groq API for prompt: {user_context}")
        
        # Call Groq API for intelligent, dynamic response using Llama 3 8B
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama3-8b-8192",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_context}
                ],
                "temperature": 0.7  # Balance between consistency and creativity
            },
            timeout=30 # Increased timeout since LLMs can be slow
        )
        
        if response.status_code == 200:
            print("DEBUG: Successfully retrieved response from Groq")
            data = response.json()
            advice = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            # Verify we got meaningful content
            if not advice or len(advice) < 10:
                print("DEBUG: Groq response was too short or empty.")
                advice = None
        else:
            print(f"DEBUG: Groq returned non-200 status code: {response.status_code}. Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("ERROR: Groq request timed out after 30 seconds. Using fallback.")
    except requests.exceptions.ConnectionError:
        print("ERROR: Cannot connect to Groq. Using fallback.")
    except Exception as e:
        print(f"ERROR: Groq inference failed with unexpected error: {str(e)}")
    
    # Intelligent contextual fallback when Ollama is unavailable
    if not advice:
        symptoms_lower = symptoms.lower()
        
        # Context-aware responses that vary based on specific symptoms
        if any(word in symptoms_lower for word in ['fever', 'temperature', 'hot']):
            advice = "I see you have a fever. Monitor your temperature regularly and stay hydrated. If it persists beyond 3-4 days or exceeds 103°F (39.4°C), seek medical attention promptly."
        elif any(word in symptoms_lower for word in ['cough', 'throat', 'sore']):
            advice = "Coughing and sore throat can have various causes. Rest your voice, stay hydrated, and try throat lozenges. If it's accompanied by difficulty breathing or lasts over 2 weeks, see a doctor."
        elif any(word in symptoms_lower for word in ['headache', 'migraine', 'head pain']):
            advice = "Headaches can stem from dehydration, stress, or other causes. Try rest, hydration, and over-the-counter pain relief if appropriate. Recurring or severe headaches warrant a medical evaluation."
        elif any(word in symptoms_lower for word in ['fatigue', 'tired', 'exhausted']):
            advice = "Fatigue can indicate various conditions from lack of sleep to nutritional deficiencies. Ensure adequate rest, balanced nutrition, and hydration. Persistent fatigue warrants a medical evaluation."
        elif any(word in symptoms_lower for word in ['nausea', 'vomiting', 'stomach']):
            advice = "Nausea and digestive issues may be related to diet, stress, or infection. Rest your digestive system, stay hydrated with clear fluids, and eat bland foods. Contact a doctor if symptoms worsen."
        else:
            advice = f"I understand you're experiencing {symptoms}. This requires proper medical evaluation to determine the cause. Monitor your condition and consult a healthcare provider if symptoms persist or worsen."
    
    # Multilingual translation
    if language and language.lower() not in ["en", "english"]:
        try:
            translator = GoogleTranslator(source='auto', target=language)
            final_advice = translator.translate(advice)
        except Exception as e:
            print(f"Translation failed: {e}")
            final_advice = advice + " (Translation unavailable)"
    else:
        final_advice = advice
    
    return {
        "reply": advice,
        "reply_translated": final_advice
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
