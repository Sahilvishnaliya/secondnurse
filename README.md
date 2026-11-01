# SecondNurse

**The nurse who watches your hands when the nurse isn't there.**

SecondNurse watches a home sterile-technique procedure (dialysis exchange training kit)
with a phone camera, tracks hands and sterile parts as pixel masks with SAM 3.1, and
stops the procedure the second sterile technique breaks — a hand touching the sterile
connector tip, a cap set down outside the sterile field, a skipped step.

Built for the **Meta Global AI Developer Hackathon** (Indie track · Push the Frontier)
with **Muse Wonder** (protocol → executable step graph) and **SAM 3.1** (mask tracking).

> Educational training system. Not a medical device.
> It does not diagnose, treat, or make clinical decisions; a qualified person
> reviews every flagged event.

## Run locally

```bash
pip install -r requirements.txt
python app.py            # http://127.0.0.1:5000
python -m unittest discover -s tests -v
```

A Meta Model API key is required: the app is live-only and AI endpoints return
`503 configuration required` without one. Copy `.env.example` to `.env` and set
`MODEL_API_KEY` and `SECONDNURSE_MODE=live`. Full docs: [`docs/`](docs/README.md)
or `/docs/` on the deployed app.

## How it works

1. **Protocol compiler** (`core/protocol.py`) — protocol text → StepGraph JSON
   (steps, objects, forbidden contacts, minimum times). Muse Wonder live, or a
   deterministic parser with the identical schema offline.
2. **Perception** (`core/meta_client.py`, `core/sam_live.py`) — SAM 3.1 text-prompted
   masks for hand, cap, sterile connector tip and field. The live path calls the
   Responses API (`sam-3.1`, one request per concept), parses Meta's documented
   wire grammar, decodes masks with the official `meta_sam_parser`, and measures
   true mask overlap. Without a key the endpoint refuses (503). In the UI: camera
   tab → *Analyze one frame* or *Start live watch* (a frame every 3s, breach after
   2 consecutive overlapping frames).
3. **Rule engine** (`core/rules.py`) — pure, tested geometry: mask overlap sustained
   ≥0.3s = TOUCH; cap centroid outside the field = FIELD; step jumps = ORDER.
   Produces events + a compliance score.
4. **Front end** — Torch-inspired editorial design, live camera console (SAM overlays,
   rule readouts, event log), protocol compiler UI, and live-results table.

## Security

- No secrets in the repo or the client. Meta key is server-side env only.
- 128 KB request cap, JSON schema validation on every API route, per-IP rate limit
  on `/api/compile`, CSP + `nosniff`/`DENY` framing/permissions headers.
- All user-supplied text is rendered with `textContent` (no HTML injection path).
- Camera frames are forwarded only to the configured Meta API; nothing is stored.

## API

| Route | Body | Returns |
|---|---|---|
| `GET /api/health` | — | status, live/configuration mode, model names |
| `POST /api/compile` | `{protocol_text, name}` | StepGraph JSON |
| `POST /api/evaluate` | `{frames: [...]}` | breach events + compliance score |
| `POST /api/segment` | `{prompt}` | live SAM only; 503 without a frame/key |
| `POST /api/segment-live` | `{image: dataURL, prompts: [...]}` | per-prompt SAM 3.1 boxes/masks for one camera frame, true mask-overlap measurement when hand + tip are found; 503 without a key |

## Layout

```
app.py            Flask routes + security headers (also the Vercel WSGI app)
api/index.py      Vercel serverless entrypoint
core/             pure logic: protocol.py, rules.py, meta_client.py
index.html  styles.css  app.js   front end (served by Flask and by Vercel static)
tests/            unittest suite for core logic
```

## Honest limits

Near-real-time, not 60 fps: frames are sampled and alerts fire within seconds.
Real-camera precision/recall needs a recorded trial set on the live SAM path.
