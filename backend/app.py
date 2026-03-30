import os
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from news_fetcher import get_news
from sentiment import analyze_sentiment, analyze_portfolio

# 1. SETUP PATHS
current_dir = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.normpath(os.path.join(current_dir, '../frontend/templates')) 
static_dir = os.path.normpath(os.path.join(current_dir, '../frontend/static'))     

# 2. INITIALIZE APP
app = Flask(__name__, 
            template_folder=template_dir, 
            static_folder=static_dir,
            static_url_path='/static')

CORS(app)
app.json.sort_keys = False 

# 3. SERVE HTML PAGES
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/results")
def results():
    return render_template("results.html")

@app.route("/portfolio")
def portfolio_page():
    return render_template("portfolio.html")

@app.route("/compare")
def compare_page():
    return render_template("compare.html")

# 4. API ROUTES
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    company = data.get("company")
    print(f"--- 🔍 Analyzing: {company} ---")
    
    try:
        headlines = get_news(company)
        if not headlines:
            return jsonify({"error": "No news found for this company"}), 404
        
        result = analyze_sentiment(company, headlines)
        if isinstance(result, str):
            result = json.loads(result.replace('```json', '').replace('```', '').strip())
            
        result["headlines"] = headlines
        return jsonify(result)
    except Exception as e:
        print(f"🔥 Backend Error: {str(e)}")
        return jsonify({"error": f"AI Processing Failed: {str(e)}"}), 500

@app.route("/portfolio_api", methods=["POST"])
def portfolio_api():
    data = request.json
    stocks = data.get("stocks")
    if not stocks:
        return jsonify({"error": "No stocks provided"}), 400
    
    try:
        result = analyze_portfolio(stocks)
        return jsonify(result)
    except Exception as e:
        print(f"🔥 Portfolio Error: {str(e)}")
        return jsonify({"error": "Portfolio Analysis Failed"}), 500

@app.route("/compare_api", methods=["POST"])
def compare_api():
    data = request.json
    try:
        c1 = data.get("company1")
        c2 = data.get("company2")
        if not c1 or not c2:
            return jsonify({"error": "Missing companies"}), 400
            
        h1, h2 = get_news(c1), get_news(c2)
        r1, r2 = analyze_sentiment(c1, h1), analyze_sentiment(c2, h2)
        
        r1["name"] = c1.upper()
        r2["name"] = c2.upper()
        
        # Determine winner
        score1 = r1.get("confidence_score", 0)
        score2 = r2.get("confidence_score", 0)
        winner = "company1" if score1 >= score2 else "company2"

        return jsonify({
            "company1": r1, 
            "company2": r2,
            "winner": winner
        })
    except Exception as e:
        print(f"🔥 Compare Error: {str(e)}")
        return jsonify({"error": "Comparison Failed"}), 500

# 5. RUN ENGINE
if __name__ == "__main__":
    app.run(debug=True, port=8080, host='0.0.0.0')