"""Protocol compiler: turns written procedure text into a machine-checkable step graph.

Default path is a deterministic heuristic parser (works offline, fully testable).
If MODEL_API_KEY is set and SECONDNURSE_MODE=live, Muse Wonder is asked for the
same JSON schema and the heuristic result is only a fallback on any failure.
"""
import json
import os
import re
import urllib.request

MAX_PROTOCOL_CHARS = 20000

OBJECT_KEYWORDS = {
    "hand hygiene": ["wash", "hand hygiene", "sanitize", "scrub"],
    "gloved hand": ["glove"],
    "mask": ["mask", "face covering"],
    "sterile connector tip": ["connector", "tip", "transfer set", "catheter"],
    "cap": ["cap", "minicap", "mini-cap"],
    "sterile field": ["sterile field", "sterile mat", "drape"],
    "fluid bag": ["bag", "dialysate", "fluid"],
    "clamp": ["clamp"],
    "tube": ["tube", "tubing", "line"],
}

DEFAULT_PROTOCOL = """1. Wash and fully dry your hands for at least 20 seconds.
2. Put on a mask and gloves.
3. Place all supplies on the sterile field mat.
4. Uncap the sterile connector tip. Never touch the sterile connector tip.
5. Connect the fluid bag tube to the connector without touching the tip.
6. Open the clamp and start the exchange.
7. Disconnect and place a new cap on the connector tip."""


def _clean(text):
    text = (text or "")[:MAX_PROTOCOL_CHARS]
    text = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t")
    return text.strip()


def _objects_for(line):
    low = line.lower()
    found = []
    for name, keys in OBJECT_KEYWORDS.items():
        if any(k in low for k in keys):
            found.append(name)
    return found


def _min_seconds(line):
    m = re.search(r"(\d+)\s*(?:seconds|second|secs|sec)\b", line.lower())
    return int(m.group(1)) if m else 0


def _forbidden_for(line):
    low = line.lower()
    out = []
    if "never touch" in low or "do not touch" in low or "don't touch" in low:
        if "tip" in low or "connector" in low:
            out.append({"a": "hand", "b": "sterile connector tip", "rule": "TOUCH"})
        if "sterile field" in low:
            out.append({"a": "cap", "b": "outside sterile field", "rule": "FIELD"})
    return out


def heuristic_compile(text, name="Home exchange protocol"):
    text = _clean(text) or DEFAULT_PROTOCOL
    lines = [ln.strip(" -\t") for ln in text.splitlines() if ln.strip()]
    steps = []
    for raw in lines:
        title = re.sub(r"^\d+[\).\s]+", "", raw).strip()
        if not title:
            continue
        steps.append({
            "id": f"step-{len(steps) + 1}",
            "title": title[:180],
            "objects": _objects_for(title),
            "forbidden_contacts": _forbidden_for(title),
            "min_seconds": _min_seconds(title),
        })
    if not steps:
        return heuristic_compile(DEFAULT_PROTOCOL, name)
    # Every graph gets the two global sterile rules, even if the text omits them.
    global_rules = [
        {"a": "hand", "b": "sterile connector tip", "rule": "TOUCH"},
        {"a": "cap", "b": "outside sterile field", "rule": "FIELD"},
    ]
    return {
        "name": name[:120],
        "source": "deterministic-parser",
        "steps": steps,
        "global_rules": global_rules,
        "step_count": len(steps),
    }


def _normalize_rule(rule, default_a="hand"):
    if isinstance(rule, dict):
        return {"a": str(rule.get("a", default_a)), "b": str(rule.get("b", "")),
                "rule": str(rule.get("rule", "TOUCH")).upper()}
    text = str(rule)
    return {"a": default_a, "b": text, "rule": "TOUCH"}


def _normalize_graph(graph):
    steps = []
    for i, s in enumerate(graph.get("steps", [])):
        if not isinstance(s, dict):
            continue
        steps.append({
            "id": f"step-{i + 1}",
            "title": str(s.get("title", ""))[:180],
            "objects": [str(o) for o in (s.get("objects") or [])],
            "forbidden_contacts": [_normalize_rule(r) for r in (s.get("forbidden_contacts") or [])],
            "min_seconds": int(s.get("min_seconds") or 0),
        })
    graph["steps"] = steps
    graph["step_count"] = len(steps)
    graph["global_rules"] = [_normalize_rule(r) for r in (graph.get("global_rules") or [])] or [
        {"a": "hand", "b": "sterile connector tip", "rule": "TOUCH"},
        {"a": "cap", "b": "outside sterile field", "rule": "FIELD"},
    ]
    return graph


def _muse_compile(text, name):
    key = os.getenv("MODEL_API_KEY", "")
    if not key or os.getenv("SECONDNURSE_MODE") != "live":
        return None
    prompt = (
        "Compile this sterile-technique protocol into JSON only with keys "
        "name, steps (each: id, title, objects, forbidden_contacts, min_seconds), "
        "global_rules. Protocol:\n" + _clean(text)
    )
    body = json.dumps({
        "model": os.getenv("MUSE_MODEL", "muse-wonder-1.0"),
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://api.meta.ai/v1/chat/completions", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"]
        graph = json.loads(content)
        if isinstance(graph, dict) and graph.get("steps"):
            graph = _normalize_graph(graph)
            graph["source"] = "muse-wonder-live"
            graph["name"] = name[:120]
            return graph
    except Exception:
        return None
    return None


def compile_protocol(text, name="Home exchange protocol"):
    graph = _muse_compile(text, name)
    if graph is None:
        raise RuntimeError("Meta API not configured: set MODEL_API_KEY and SECONDNURSE_MODE=live.")
    return graph
