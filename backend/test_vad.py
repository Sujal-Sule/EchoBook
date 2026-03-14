import asyncio
import os
import wave
from dotenv import load_dotenv
load_dotenv()
from google import genai
from google.genai import types

async def test_live():
    client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
    model = 'gemini-2.5-flash-native-audio-latest'
    config = types.LiveConnectConfig(response_modalities=['AUDIO'])
    
    async with client.aio.live.connect(model=model, config=config) as session:
        print("Connected.")
        # We need a PCM file to send. Let's send silence.
        # 16kHz, 16-bit, mono.
        silence = b'\x00' * (16000 * 2) # 1 sec of silence
        
        await session.send(input={"realtime_input": {"media_chunks": [{"data": silence, "mime_type": "audio/pcm;rate=16000"}]}})
        print("Sent silence.")
        
        try:
            async for response in session.receive():
                if response.data:
                    print("Got audio response!")
                    break
        except asyncio.TimeoutError:
            print("No response.")

asyncio.run(test_live())
