from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse
from deep_translator import GoogleTranslator
import google.generativeai as genai
import uvicorn
import os

app = FastAPI(title="Med-AI Chatbot Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import json

# Keep the API endpoint

@app.post("/api/chat")
async def chat_interaction(
    symptoms: str = Form(..., description="The spoken or typed symptoms"),
    duration: str = Form("", description="The illness duration"),
    language: str = Form("en", description="Target language code (e.g. 'en', 'mr', 'hi')"),
    history: str = Form("[]", description="JSON array of previous conversation turns")
):
    """
    Advanced chatbot endpoint that provides dynamic, contextual health guidance.
    Uses Gemini natively for multilingual, multi-turn conversations.
    """
    
    advice = None
    
    try:
        # Parse history
        try:
            conversation_history = json.loads(history)
        except json.JSONDecodeError:
            conversation_history = []

        # Load the medical knowledge base if it exists
        knowledge_base_text = ""
        kb_path = os.path.join(os.path.dirname(__file__), "medical_knowledge_base.txt")
        try:
            with open(kb_path, "r", encoding="utf-8") as f:
                knowledge_base_text = f.read()
            print(f"DEBUG: Loaded Medical Knowledge Base ({len(knowledge_base_text)} chars)")
        except Exception as e:
            print(f"DEBUG: Could not load knowledge base: {e}")

        # Map the language code to a full name to enforce heavy context weighting on Gemini's translation
        lang_map = {
            "en": "English",
            "mr": "Marathi (मराठी) - Use Devanagari script natively",
            "hi": "Hindi (हिंदी) - Use Devanagari script natively"
        }
        full_language = lang_map.get(language, language)

        # Initialize Gemini API
        genai.configure(api_key="REDACTED_KEY")
        
        # We use a sophisticated system prompt via the instructions parameter for the Gemini model
        system_instruction = f"""You are a highly empathetic and professional medical assistant AI named Med-AI.
Your goal is to politely understand the patient's symptoms and organically offer guidance.
CRITICAL: You MUST respond natively and fluently ONLY in this exact language: '{full_language}'. Your entire response must be in this language. Do NOT use English unless English is requested.

MED-AI CLINICAL KNOWLEDGE BASE:
{knowledge_base_text}

Guidelines:
- Start your response very politely (e.g., using emojis like 👋, 🙏).
- If the user just says hello without symptoms, kindly ask them what symptoms they are experiencing.
- BE HUMAN AND CONVERSATIONAL. Ask only ONE clarifying question at a time if you need more info to make a diagnosis from the knowledge base. Wait for their reply.
- KEEP ANSWERS VERY SHORT AND CONCISE (1-3 sentences maximum).
- STRICTLY use the provided MED-AI CLINICAL KNOWLEDGE BASE to match their symptoms to a disease.
- If their symptoms closely match a disease in the database, tell them the suspected disease, provide its exact description, and list out the exact recommended precautions/treatments from the database.
- IMPORTANT HIGHLIGHTING: If you list Precautions or Treatments, you MUST wrap that section in HTML bold tags `<b>` so it stands out visually. (e.g., <b>Precautions:</b> ...)
- Use em-dashes (—) for natural pacing and pauses.
- Always recommend professional medical evaluation if needed.
- Do NOT provide generic advice if a match is found in the knowledge base."""

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash", 
            system_instruction=system_instruction
        )
        
        # Reconstruct chat session memory
        chat = model.start_chat()
        
        # Inject previous history turns into the Gemini chat session
        for turn in conversation_history:
            role = "user" if turn.get('role') == 'user' else "model"
            content = turn.get('content', '')
            if content:
                 chat.history.append({"role": role, "parts": [content]})
                 
        user_context = symptoms
        if duration:
            user_context += f" (Condition duration: {duration})"
            
        print(f"DEBUG: Calling Gemini API for: {user_context}")
        
        # Generate the response with automatic retries for Rate Limits
        import time
        max_retries = 3
        retry_delay = 22 # Wait 22 seconds between retries to clear the 15 RPM limit bucket
        
        for attempt in range(max_retries):
            try:
                response = chat.send_message(
                    user_context,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                    )
                )
                advice = response.text.strip()
                print(f"DEBUG: Successfully retrieved response from Gemini (Attempt {attempt + 1}).")
                break # Break out of loop on success
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "Quota" in error_msg:
                    if attempt < max_retries - 1:
                        print(f"WARNING: Gemini rate limit hit. Waiting {retry_delay}s to retry... (Attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        continue # Loop again
                # If we exhausted retries or it was a different error, raise it to the outer try/except
                raise e
            
    except Exception as e:
        print(f"ERROR: Gemini inference failed with unexpected error: {str(e)}")
        
        # Fallback if the API fails entirely
        advice = "I apologize, but I am having trouble connecting to my medical database right now. 🙏 Please consult a real doctor for an accurate diagnosis."
    
    # We now trust Gemini to do the native translation! No deep_translator needed.
    final_advice = advice
    
    return {
        "reply": advice,
        "reply_translated": final_advice
    }


# Mount the root directory to serve static files (like styles.css and script.js)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def serve_index():
    return FileResponse("index.html")

@app.get("/{filename}")
async def serve_file(filename: str):
    return FileResponse(filename)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
