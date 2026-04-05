from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

LEADERBOARD_FILE = "leaderboard.json"

LEVEL_CONFIG = {
    1:  {"speed": 120, "label": "Novice",     "color": "#00ff88"},
    2:  {"speed": 105, "label": "Apprentice",  "color": "#44ffaa"},
    3:  {"speed": 90,  "label": "Adept",       "color": "#88ffcc"},
    4:  {"speed": 78,  "label": "Skilled",     "color": "#ffdd00"},
    5:  {"speed": 68,  "label": "Expert",      "color": "#ffaa00"},
    6:  {"speed": 58,  "label": "Master",      "color": "#ff7700"},
    7:  {"speed": 48,  "label": "Grandmaster", "color": "#ff4400"},
    8:  {"speed": 38,  "label": "Legend",      "color": "#ff2200"},
    9:  {"speed": 28,  "label": "Mythic",      "color": "#ff0088"},
    10: {"speed": 18,  "label": "GOD MODE",    "color": "#ff00ff"},
}

def load_leaderboard():
    if os.path.exists(LEADERBOARD_FILE):
        with open(LEADERBOARD_FILE, "r") as f:
            return json.load(f)
    return []

def save_leaderboard(data):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(data, f)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/level-config")
def level_config():
    return jsonify(LEVEL_CONFIG)

@app.route("/api/score-threshold")
def score_threshold():
    """Return score needed per level-up"""
    thresholds = {str(lvl): (lvl - 1) * 5 for lvl in range(1, 11)}
    return jsonify(thresholds)

@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    board = load_leaderboard()
    board_sorted = sorted(board, key=lambda x: x["score"], reverse=True)[:10]
    return jsonify(board_sorted)

@app.route("/api/leaderboard", methods=["POST"])
def post_score():
    data = request.get_json()
    name = data.get("name", "Anonymous")[:16]
    score = int(data.get("score", 0))
    level = int(data.get("level", 1))

    board = load_leaderboard()
    board.append({"name": name, "score": score, "level": level})
    board = sorted(board, key=lambda x: x["score"], reverse=True)[:50]
    save_leaderboard(board)

    rank = next((i + 1 for i, e in enumerate(board) if e["name"] == name and e["score"] == score), None)
    return jsonify({"status": "ok", "rank": rank})

if __name__ == "__main__":
    app.run(debug=True, port=5000)