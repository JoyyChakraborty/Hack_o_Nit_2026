import requests
import os
from dotenv import load_dotenv

# Load API keys from .env file
load_dotenv()
NEWS_API_KEY = os.getenv("news_api_key")

def get_news(company_name):
    url = "https://newsapi.org/v2/everything"
    
    params = {
        "q": company_name,
        "apiKey": NEWS_API_KEY,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 10
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    # Extract just the headlines
    headlines = []
    if data["status"] == "ok":
        for article in data["articles"]:
            headlines.append(article["title"])
    
    return headlines