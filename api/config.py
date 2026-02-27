"""
Med-AI Configuration Module
Loads environment variables from the env/ folder.
"""

import os
from dotenv import load_dotenv

# Path to the env folder's .env file
ENV_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "env")
ENV_FILE = os.path.join(ENV_DIR, ".env")

# Load the .env file from the env/ folder
load_dotenv(ENV_FILE)


def get_api_key() -> str:
    """Get the Gemini API key from environment variables."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key or key == "PASTE_YOUR_NEW_API_KEY_HERE":
        raise ValueError(
            "GEMINI_API_KEY not found or not set!\n"
            "Please set your API key in: env/.env\n"
            "Get a key from: https://aistudio.google.com/apikey"
        )
    return key
