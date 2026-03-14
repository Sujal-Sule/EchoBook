import re

with open('main.py', 'r') as f:
    code = f.read()

# Replace system prompt instructions
code = code.replace(
    '''3. When a memory feels COMPLETE and vivid (has place + feeling + at least one detail),
   say warmly: "What a beautiful memory. I am going to capture that as a page in your book."
   Then immediately append [CAPTURE_VIGNETTE] on a new line.
4. After capturing, gently move to a new chapter.''',
    '''3. When a memory feels COMPLETE and vivid (has place + feeling + at least one detail),
   say warmly: "What a beautiful memory. I am going to capture that as a page in your book."
   Then IMMEDIATELY call the `capture_vignette` tool to capture it.
4. After capturing, gently move to a new chapter.'''
)

code = code.replace(
    '''- Only append [CAPTURE_VIGNETTE] when the memory has enough detail to illustrate
- [CAPTURE_VIGNETTE] must appear on its own line at the very end''',
    '''- Only call the `capture_vignette` tool when the memory has enough detail to illustrate'''
)

# Replace LiveConnectConfig
old_config = '''    config = types.LiveConnectConfig(
        response_modalities=["AUDIO", "TEXT"],
        system_instruction=types.Content(
            parts=[types.Part(text=INTERVIEW_SYSTEM_PROMPT)]
        ),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
    )'''

new_config = '''    def capture_vignette(memory_summary: str):
        \"\"\"Call this tool to capture a vivid memory that a user has just shared.\"\"\"
        pass

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=types.Content(
            parts=[types.Part(text=INTERVIEW_SYSTEM_PROMPT)]
        ),
        tools=[capture_vignette]
    )'''

code = code.replace(old_config, new_config)

# Update the websocket receiving logic for tool calls instead of [CAPTURE_VIGNETTE] text parsing
old_receive = '''                    if response.text:
                        full_text_buffer += response.text
                        clean_text = response.text.replace("[CAPTURE_VIGNETTE]", "").strip()
                        if clean_text:
                            await websocket.send_json({
                                "type": "transcript",
                                "text": clean_text
                            })
                        if "[CAPTURE_VIGNETTE]" in full_text_buffer:
                            story_so_far = full_text_buffer.replace("[CAPTURE_VIGNETTE]", "").strip()
                            full_text_buffer = ""
                            asyncio.create_task(
                                handle_vignette_capture(
                                    websocket, user_id, book_id, story_so_far
                                )
                            )'''

new_receive = '''                    if response.tool_call:
                        print("TOOL CALL RECEIVED:", response.tool_call)
                        for call in response.tool_call.function_calls:
                            if call.name == "capture_vignette":
                                summary = call.args.get("memory_summary", "A beautiful memory")
                                asyncio.create_task(
                                    handle_vignette_capture(
                                        websocket, user_id, book_id, full_text_buffer + " " + summary
                                    )
                                )
                                full_text_buffer = ""
                                
                    if hasattr(response, 'server_content') and response.server_content is not None and response.server_content.model_turn:
                        for part in response.server_content.model_turn.parts:
                            if part.text:
                                full_text_buffer += part.text + " "'''

code = code.replace(old_receive, new_receive)

with open('main.py', 'w') as f:
    f.write(code)

print("Patched main.py")
