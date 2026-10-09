"""Optional static server (used by Replit / local testing). GitHub Pages does not need it."""
import os
from flask import Flask, abort, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:sub>")
def assets(sub):
    if sub.split("/")[0] in ("css", "js", "docs"):
        return send_from_directory(BASE_DIR, sub)
    abort(404)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
