# SecondNurse

**The nurse who watches your hands when the nurse isn't there.**

SecondNurse watches a home sterile-technique procedure (simulated dialysis exchange)
with a phone camera, tracks hands and sterile parts as pixel masks with SAM 3.1, and
stops the procedure the second sterile technique breaks — a hand touching the sterile
connector tip, a cap set down outside the sterile field, a skipped step.

Built for the **Meta Global AI Developer Hackathon** (Indie track · Push the Frontier)
with **Muse Wonder** (protocol → executable step graph) and **SAM 3.1** (mask tracking).

> Educational training simulator on a simulated kit. Not a medical device.
> It does not diagnose, treat, or make clinical decisions; a qualified person
> reviews every flagged event.

## Run locally

```bash
pip install -r requirements.txt
python app.py            # http://127.0.0.1:5000
python -m unittest discover -s tests -v
```

No keys needed: the app runs in labelled demo mode (deterministic protocol parser +
demo geometry). To use the live Meta path, copy `.env.example` to `.env` and set
`MODEL_API_KEY` and `SECONDNURSE_MODE=live` — no code changes.

## How it works

1. **Protocol compiler** (`core/protocol.py`) — protocol text → StepGraph JSON
   (steps, objects, forbidden contacts, minimum times). Muse Wonder live, or a
   deterministic parser with the identical schema offline.
2. **Perception** (`core/meta_client.py`) — SAM 3.1 text-prompted masks for hand,
   cap, sterile connector tip and field. Demo geometry when no key is configured.
3. **Rule engine** (`core/rules.py`) — pure, tested geometry: mask overlap sustained
   ≥0.3s = TOUCH; cap centroid outside the field = FIELD; step jumps = ORDER.
   Produces events + a compliance score.
4. **Front end** — Torch-inspired editorial design, animated bench simulator with the
   rule engine running per frame, protocol compiler UI, camera tab, and a 24-trial
   simulated bench-eval harness (SecondNurse vs a VLM-asked-directly baseline).

## Security

- No secrets in the repo or the client. Meta key is server-side env only.
- 128 KB request cap, JSON schema validation on every API route, per-IP rate limit
  on `/api/compile`, CSP + `nosniff`/`DENY` framing/permissions headers.
- All user-supplied text is rendered with `textContent` (no HTML injection path).
- Camera frames stay on-device in demo mode.

## API

| Route | Body | Returns |
|---|---|---|
| `GET /api/health` | — | status, live/demo mode, model names |
| `POST /api/compile` | `{protocol_text, name}` | StepGraph JSON |
| `POST /api/evaluate` | `{frames: [...]}` | breach events + compliance score |
| `POST /api/segment` | `{prompt}` | boxes for the prompt (demo or live SAM) |

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
The bench eval in the UI is a deterministic *simulated* harness, clearly labelled —
real-camera precision/recall needs a recorded trial set on the live SAM path.
