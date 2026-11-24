
from google import genai
from dotenv import load_dotenv
import os

# Load API key
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("API key not found. Check your .env file.")

else:
    try:
        client = genai.Client(api_key=api_key)

        print("Connecting to Gemini...")

        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents="Say hello to ZYRA AI in one short sentence."
        )

        print("\nGemini connection successful!")
        print("Gemini response:", response.text)

    except Exception as error:
        print("\nGemini connection failed:")
        print(error)
