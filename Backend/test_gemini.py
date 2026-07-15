import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_gemini():
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        print("NO API KEY")
        return

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={gemini_api_key}"
    gemini_payload = {
        "contents": [{"role": "user", "parts": [{"text": "Hello, generate a tiny test report."}]}]
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(gemini_url, json=gemini_payload)
        print("Status:", res.status_code)
        print("Response:", res.text)

asyncio.run(test_gemini())
