"""SecondNurse web app. Thin Flask layer over core/ (mock-first Meta adapter)."""
import os
import time
from collections import defaultdict, deque

from flask import Flask, jsonify, request, send_from_directory

from core.meta_client import LIVE, segment
from core.protocol import compile_protocol
from core.rules import evaluate_trace

ROOT = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 128 * 1024  # 128 KB hard request cap

_hits = defaultdict(deque)


def _rate_limited(key, limit=30, window=60):
    now = time.time()
    q = _hits[key]
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


@app.after_request
def security_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Permissions-Policy"] = "camera=(self), microphone=()"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; "
        "style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
        "script-src 'self'; connect-src 'self'"
    )
    return resp


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/styles.css")
def styles():
    return send_from_directory(ROOT, "styles.css", mimetype="text/css")


@app.get("/app.js")
def script():
    return send_from_directory(ROOT, "app.js", mimetype="text/javascript")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "live_meta_api": LIVE,
                    "models": {"reasoning": "muse-wonder-1.0", "segmentation": "sam-3.1"},
                    "mode": "live" if LIVE else "demo (no MODEL_API_KEY)"})


def _json_body():
    if not request.is_json:
        return None
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


@app.post("/api/compile")
def compile_route():
    if _rate_limited(request.remote_addr or "local"):
        return jsonify({"error": "Rate limit reached. Try again shortly."}), 429
    body = _json_body()
    if body is None:
        return jsonify({"error": "JSON body required."}), 400
    text = body.get("protocol_text", "")
    name = body.get("name", "Home exchange protocol")
    if not isinstance(text, str) or not isinstance(name, str):
        return jsonify({"error": "protocol_text and name must be strings."}), 400
    return jsonify(compile_protocol(text, name))


@app.post("/api/evaluate")
def evaluate_route():
    body = _json_body()
    if body is None or not isinstance(body.get("frames"), list):
        return jsonify({"error": "Body must be {frames: [...]}."}), 400
    if len(body["frames"]) > 5000:
        return jsonify({"error": "Too many frames (max 5000)."}), 400
    return jsonify(evaluate_trace(body["frames"]))


@app.post("/api/segment")
def segment_route():
    body = _json_body()
    if body is None or not isinstance(body.get("prompt"), str):
        return jsonify({"error": "Body must be {prompt: string}."}), 400
    return jsonify(segment(body["prompt"]))


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Request too large."}), 413


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Not found."}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
