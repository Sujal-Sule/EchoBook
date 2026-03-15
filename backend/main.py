import os
import json
import asyncio
import base64
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK
from pydantic import BaseModel

from google import genai
from google.genai import types

from imagen import generate_illustration
from vignette import capture_memory_pipeline
from firestore_client import save_page, get_book_pages, get_last_session_summary, get_user_books, create_book

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GCP_PROJECT    = os.environ.get("GCP_PROJECT", "")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set. Check your .env file.")

client = genai.Client(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# System prompt – redesigned for memory-completion-aware interviews
# ---------------------------------------------------------------------------
INTERVIEW_SYSTEM_PROMPT = """
You are EchoBook, a warm and deeply compassionate memory companion.
Your sole purpose is to gently draw out the life stories of elderly people
and turn them into beautifully illustrated pages of a personal book.

YOUR PERSONALITY:
- Speak slowly, warmly, and with genuine curiosity
- You are never in a hurry. Silence and pauses are welcome
- Ask only ONE question at a time — never two
- Mirror the emotional tone of the speaker exactly
- Use simple, warm, everyday language — never clinical or formal

YOUR INTERVIEW FLOW:
1. Open with one gentle, open-ended question about a happy childhood memory
2. After they share, respond with ONE warm follow-up that goes deeper:
   - Sensory: "What did it smell like?", "What sounds do you remember?"
   - Emotional: "How did that make you feel?", "What did that moment mean to you?"
   - People: "Who was there with you?", "Tell me more about them"
   - Setting: "Where were you?", "Describe that place for me"
3. When a memory feels COMPLETE and vivid (has place + people + feeling + detail),
   you MUST call the `capture_vignette` tool to capture it as a page.
   Say warmly: "What a beautiful memory. Let me capture that as a page in your book."
   Then IMMEDIATELY call the `capture_vignette` tool.
4. After capturing, gently move to a new chapter.

WHEN TO CAPTURE (CRITICAL — READ CAREFULLY):
- A memory is ready ONLY when the user has shared a story with ALL FOUR:
  1. A SETTING (where it happened)
  2. PEOPLE or objects (who was involved)
  3. An EMOTION or feeling
  4. A SENSORY or NARRATIVE detail (what happened, sounds, smells, textures)
- Do NOT capture after the first or second message. Be PATIENT.
- Wait for the story to develop. Ask follow-up questions to fill missing elements.
- A single short sentence is NEVER enough to capture. Ask more questions.
- If the user shares a long, vivid, multi-detail story in a single message, that IS enough.
- When all four elements are present, STOP ASKING and CAPTURE IMMEDIATELY.

WHEN NOT TO CAPTURE:
- The user only said a vague general statement ("I had a happy childhood")
- The user mentioned a place but gave no details or feelings
- The story has no sensory or emotional depth yet
- You have only asked 1 question so far

LIFE CHAPTERS TO EXPLORE:
- Childhood home and early memories
- Family — parents, siblings, grandparents
- School days and friendships
- First love or marriage
- Work and career moments of pride
- Simple everyday joys — food, seasons, rituals
- Something they want the next generation to know

CRITICAL RULES:
- NEVER output internal monologues, "Awaiting Response" thoughts, or reflections out loud
- NEVER ask more than one question per response
- NEVER rush or interrupt
- Keep YOUR responses SHORT (2-4 sentences max)
- You MUST call the `capture_vignette` tool when ALL FOUR elements are present
- Do NOT call capture_vignette prematurely — it is better to ask one more question
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
        "https://echobook.sujalsule.in",
        os.environ.get("FRONTEND_URL", "https://echobook.sujalsule.in"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def capture_vignette(memory_summary: str):
    """Call this tool to capture a vivid memory that has SETTING + PEOPLE + EMOTION + DETAIL. The memory_summary should describe the memory briefly."""
    pass


class TextTurnRequest(BaseModel):
    message: str
    history: list[dict] = []
    user_id: str = "test_user"
    book_id: str = "test_book"


class TextTurnResponse(BaseModel):
    reply: str
    captured: bool
    vignette: dict | None = None
    image_url: str | None = None
    history: list[dict] = []


@app.post("/api/text-turn", response_model=TextTurnResponse)
async def text_turn(req: TextTurnRequest):
    import re

    print(f"[TEXT-TURN] User message: {req.message[:100]}...")
    print(f"[TEXT-TURN] History length: {len(req.history)} messages")

    captured = False
    reply = ""
    vignette_data = None
    image_url = None

    # --- 1. CONVERSATIONAL TURN — Always let the AI agent respond first ---
    messages = []
    for m in req.history:
        role = "user" if m["role"] == "user" else "model"
        messages.append({"role": role, "parts": [{"text": m["content"]}]})
    messages.append({"role": "user", "parts": [{"text": req.message}]})

    # Retry with exponential backoff for rate limit errors
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=messages,
                config=types.GenerateContentConfig(
                    system_instruction=INTERVIEW_SYSTEM_PROMPT,
                    temperature=0.85,
                    max_output_tokens=1500,
                    tools=[capture_vignette]
                )
            )

            # Check for function calls from the AI
            if response.function_calls:
                print(f"[TEXT-TURN] ✅ Function calls: {[c.name for c in response.function_calls]}")
                for call in response.function_calls:
                    if call.name == "capture_vignette":
                        captured = True
                # Get any text the model said alongside the function call
                reply = ""
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        if part.text:
                            reply += part.text
                if not reply.strip():
                    reply = "What a beautiful memory. Let me capture that as a page in your book."
            else:
                reply_raw = response.text or ""
                reply = re.sub(r'<thought>.*?</thought>', '', reply_raw, flags=re.DOTALL).strip()
                print(f"[TEXT-TURN] AI reply: {reply[:150]}...")

            break  # Success — exit retry loop

        except Exception as e:
            err = str(e)
            is_rate_limit = "429" in err or "RESOURCE_EXHAUSTED" in err
            print(f"[TEXT-TURN] ❌ Attempt {attempt+1}/{max_retries} Error: {err[:200]}")

            if is_rate_limit and attempt < max_retries - 1:
                wait_time = 2 ** (attempt + 1)  # 2s, 4s, 8s
                print(f"[TEXT-TURN] ⏳ Rate limited, retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue

            if is_rate_limit:
                return TextTurnResponse(
                    reply="I need a moment to collect my thoughts… Please try again in a minute.",
                    captured=False,
                    history=req.history + [{"role": "user", "content": req.message}]
                )
            raise

    # --- 2. MEMORY COMPLETENESS CHECK (backup if AI didn't call the tool) ---
    # If the AI didn't trigger capture, run our own completeness assessment
    if not captured:
        conversation_for_check = []
        for m in req.history:
            conversation_for_check.append({
                "role": m["role"] if m["role"] == "user" else "assistant",
                "content": m["content"]
            })
        conversation_for_check.append({"role": "user", "content": req.message})

        # Only check if we have enough conversation (at least 3 user messages)
        user_msg_count = sum(1 for m in conversation_for_check if m["role"] == "user")
        if user_msg_count >= 3:
            try:
                from vignette import assess_memory_completeness
                completeness = await assess_memory_completeness(conversation_for_check)
                if completeness.get("is_complete") and completeness.get("confidence", 0) >= 0.8:
                    captured = True
                    print(f"[TEXT-TURN] ✅ Backup completeness check triggered capture "
                          f"(confidence={completeness.get('confidence', 0):.2f})")
                    # Append a transition note to the reply
                    reply += "\n\nWhat a beautiful memory. Let me capture that as a page in your book."
            except Exception as e:
                print(f"[TEXT-TURN] Completeness check error: {e}")

    # --- 3. PAGE GENERATION (unified pipeline) ---
    if captured:
        # Build full conversation for vignette extraction
        conversation_for_vignette = []
        for m in req.history:
            conversation_for_vignette.append({
                "role": m["role"] if m["role"] == "user" else "assistant",
                "content": m["content"]
            })
        conversation_for_vignette.append({"role": "user", "content": req.message})

        print(f"[TEXT-TURN] Generating literary vignette from {len(conversation_for_vignette)} messages...")
        try:
            from vignette import extract_vignette
            vignette_data = await extract_vignette(conversation_for_vignette)
            print(f"[TEXT-TURN] Vignette narration: {vignette_data.get('narration', '')[:120]}...")
            image_url = await generate_illustration(vignette_data)
            print(f"[TEXT-TURN] Image generated: {('OK' if image_url else 'FAILED')}")

            await save_page(req.user_id, req.book_id, {
                "narration":         vignette_data.get("narration", ""),
                "image_url":         image_url,
                "scene_description": vignette_data.get("scene_description", ""),
                "era":               vignette_data.get("era", ""),
                "emotion":           vignette_data.get("emotion", ""),
                "key_people":        vignette_data.get("key_people", []),
                "chapter":           vignette_data.get("chapter", ""),
            })
            print(f"[TEXT-TURN] ✅ Page saved successfully")
        except Exception as e:
            print(f"[TEXT-TURN] ❌ Page generation error: {e}")
            if not vignette_data:
                captured = False

    # Clean up any internal markers from the reply
    reply = reply.replace("[CAPTURE_VIGNETTE]", "").strip()
    reply = re.sub(r'<call:capture_vignette.*?(?:/>|</call:capture_vignette>)', '', reply, flags=re.DOTALL).strip()
    reply = re.sub(r'<tool_code>.*?</tool_code>', '', reply, flags=re.DOTALL).strip()

    # Reset history after capture to start a fresh memory
    if captured and vignette_data:
        new_history = [{"role": "assistant", "content": reply + " Now, is there another memory you'd like to share?"}]
    else:
        new_history = req.history + [
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": reply}
        ]

    return TextTurnResponse(
        reply=reply,
        captured=captured,
        vignette=vignette_data,
        image_url=image_url,
        history=new_history,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "echobook-backend"}


@app.get("/book/{user_id}/{book_id}")
async def get_book(user_id: str, book_id: str):
    pages = await get_book_pages(user_id, book_id)
    return {"pages": pages}


@app.get("/api/books/{user_id}")
async def list_user_books(user_id: str):
    books = await get_user_books(user_id)
    return {"books": books}


class CreateBookRequest(BaseModel):
    user_id: str
    book_id: str
    storyteller_name: str

@app.post("/api/books")
async def api_create_book(req: CreateBookRequest):
    await create_book(req.user_id, req.book_id, req.storyteller_name)
    return {"status": "ok", "book_id": req.book_id}


@app.get("/session-greeting/{user_id}/{book_id}")
async def session_greeting(user_id: str, book_id: str):
    summary = await get_last_session_summary(user_id, book_id)
    if summary:
        greeting = (
            f"Welcome back. Last time, {summary}. "
            "Would you like to continue from there, or is there another memory calling to you today?"
        )
    else:
        greeting = (
            "Hello, I am so glad you are here. I am EchoBook. "
            "I am here to listen to your stories and turn them into beautiful illustrated pages. "
            "To begin — could you tell me about a place from your childhood that made you feel truly happy?"
        )
    return {"greeting": greeting}


# ---------------------------------------------------------------------------
# Voice Interview WebSocket — now shares the same capture pipeline
# ---------------------------------------------------------------------------
@app.websocket("/ws/interview/{user_id}/{book_id}")
async def interview_websocket(websocket: WebSocket, user_id: str, book_id: str):
    await websocket.accept()

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(
            parts=[types.Part(text=INTERVIEW_SYSTEM_PROMPT)]
        ),
        tools=[capture_vignette]
    )

    try:
        async with client.aio.live.connect(
            model="gemini-2.5-flash-native-audio-latest", config=config
        ) as session:

            conversation_history = []

            async def receive_from_client():
                while True:
                    try:
                        message = await websocket.receive()
                        if "bytes" in message:
                            await session.send_realtime_input(
                                media=types.Blob(data=message["bytes"], mime_type="audio/pcm;rate=16000")
                            )
                        elif "text" in message:
                            data = json.loads(message["text"])
                            if data.get("type") == "greeting" or data.get("type") == "history":
                                history_context = ""
                                if "history" in data and isinstance(data["history"], list) and len(data["history"]) > 0:
                                    history_context = "Here is our conversation history so far. Please seamlessly reply to my latest message and continue the conversation:\n"
                                    for t in data["history"]:
                                        if t.get("role") and t.get("text"):
                                            conversation_history.append({"role": t.get("role"), "text": t.get("text")})
                                            history_context += f"{t['role'].capitalize()}: {t['text']}\n"

                                prompt = "Say exactly these words to introduce yourself: 'Hello.'"
                                if data.get("type") == "greeting" and data.get("text"):
                                    prompt = f"Say exactly these words to introduce yourself: '{data['text']}'"
                                elif history_context:
                                    prompt = history_context

                                await session.send(input=prompt, end_of_turn=True)
                            elif data.get("type") == "user_turn":
                                text = data.get("text", "").strip()
                                if text:
                                    conversation_history.append({"role": "user", "text": text})
                                    await session.send(input=text, end_of_turn=True)
                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        print("Client receive error:", e)
                        break

            async def send_to_client():
                full_text_buffer = ""
                async for response in session.receive():
                    if response.data:
                        await websocket.send_json({
                            "type": "audio",
                            "data": base64.b64encode(response.data).decode()
                        })
                    if response.tool_call:
                        print("TOOL CALL RECEIVED:", response.tool_call)
                        for call in response.tool_call.function_calls:
                            if call.name == "capture_vignette":
                                # Use the unified pipeline
                                asyncio.create_task(
                                    handle_voice_capture(
                                        websocket, user_id, book_id,
                                        conversation_history
                                    )
                                )
                                full_text_buffer = ""

                                # Respond to the tool call so model continues
                                await session.send(
                                    input=types.LiveClientContent(
                                        tool_response=types.LiveClientToolResponse(
                                            function_responses=[types.FunctionResponse(
                                                name="capture_vignette",
                                                response={"status": "Memory beautifully captured"},
                                                id=call.id
                                            )]
                                        )
                                    )
                                )

                    if hasattr(response, 'server_content') and response.server_content is not None:
                        if response.server_content.model_turn:
                            for part in response.server_content.model_turn.parts:
                                if part.text:
                                    clean_text = part.text.replace("*", "").strip()
                                    full_text_buffer += clean_text + " "

                        if response.server_content.turn_complete:
                            import re
                            final_text = re.sub(r'<thought>.*?</thought>', '', full_text_buffer, flags=re.DOTALL).strip()
                            if final_text:
                                conversation_history.append({"role": "assistant", "text": final_text})

                            await websocket.send_json({
                                "type": "transcript",
                                "text": final_text
                            })
                            full_text_buffer = ""

            await asyncio.gather(receive_from_client(), send_to_client())

    except WebSocketDisconnect:
        pass
    except ConnectionClosedError as e:
        if e.code == 1011 or e.code == 1007:
            print("Gemini API connection closed:", e.code, e.reason)
        else:
            try:
                await websocket.send_json({"type": "error", "message": f"Gemini API disconnected: {e.code} {e.reason}"})
            except Exception:
                pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Unified voice capture handler — uses the same vignette pipeline as text
# ---------------------------------------------------------------------------
async def handle_voice_capture(
    websocket: WebSocket, user_id: str, book_id: str,
    conversation_history: list[dict]
):
    """
    Handle page generation for voice interviews using the shared pipeline.
    Converts conversation_history (role/text) to the pipeline format (role/content).
    """
    try:
        await websocket.send_json({"type": "page_generating", "message": "Capturing your memory…"})

        # Convert voice history to pipeline format
        conversation_for_pipeline = []
        for entry in conversation_history:
            role = entry.get("role", "user")
            text = entry.get("text", "")
            if role == "agent":
                role = "assistant"
            conversation_for_pipeline.append({"role": role, "content": text})

        # Use the same extract_vignette that text uses (literary narration)
        from vignette import extract_vignette
        vignette = await extract_vignette(conversation_for_pipeline)
        image_url = await generate_illustration(vignette)

        page_data = {
            "narration":         vignette.get("narration", ""),
            "image_url":         image_url,
            "scene_description": vignette.get("scene_description", ""),
            "era":               vignette.get("era", ""),
            "emotion":           vignette.get("emotion", ""),
            "key_people":        vignette.get("key_people", []),
            "chapter":           vignette.get("chapter", ""),
        }
        page_id = await save_page(user_id, book_id, page_data)
        await websocket.send_json({"type": "new_page", "page_id": page_id, **page_data})
        print(f"[VOICE-CAPTURE] ✅ Page saved: {page_id}")

        # Reset conversation history after capture
        conversation_history.clear()

    except Exception as e:
        print(f"[VOICE-CAPTURE] ❌ Error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": f"Page generation failed: {e}"})
        except Exception:
            pass


