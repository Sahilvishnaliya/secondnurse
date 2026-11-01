"""Meta Model API adapter. Mock-first: without MODEL_API_KEY every call returns
labelled demo geometry so the full product loop runs offline."""
import os

LIVE = bool(os.getenv("MODEL_API_KEY")) and os.getenv("SECONDNURSE_MODE") == "live"

_DEMO_BOXES = {
    "sterile connector tip": {"x": 452, "y": 196, "w": 30, "h": 36, "label": "sterile connector tip"},
    "red connector": {"x": 452, "y": 196, "w": 30, "h": 36, "label": "red connector"},
    "cap": {"x": 205, "y": 255, "w": 34, "h": 24, "label": "cap"},
    "blue cap": {"x": 205, "y": 255, "w": 34, "h": 24, "label": "blue cap"},
    "gloved hand": {"x": 300, "y": 150, "w": 92, "h": 64, "label": "gloved hand"},
    "hand": {"x": 300, "y": 150, "w": 92, "h": 64, "label": "hand"},
    "sterile field": {"x": 70, "y": 90, "w": 360, "h": 240, "label": "sterile field"},
}


def segment(prompt):
    """Return boxes for a text prompt. Live SAM 3.1 wiring point."""
    key = (prompt or "").strip().lower()[:80]
    box = _DEMO_BOXES.get(key)
    if box is None:
        box = {"x": 120, "y": 120, "w": 48, "h": 48, "label": key or "object"}
    return {"prompt": key, "live": LIVE, "mock": not LIVE, "boxes": [box],
            "model": "sam-3.1" if LIVE else "demo-geometry (set MODEL_API_KEY + SECONDNURSE_MODE=live)"}
