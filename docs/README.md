# SecondNurse Documentation

Full product documentation, styled after the Cat Wallet docs (GitBook-style:
sticky header, left navigation, content column, right “On this page” rail,
monochrome and flat). Open `index.html` in a browser, or visit `/docs/` on the
deployed app.

| Page | Contents |
|---|---|
| `index.html` | Introduction — what SecondNurse is, core philosophy, pipeline at a glance |
| `getting-started.html` | API-key setup (Vercel/local), bench setup, first live watch |
| `live-watch.html` | Frame pipeline, SAM prompts, TOUCH/FIELD/ORDER rules, console guide, latency |
| `protocol-compiler.html` | Muse Wonder protocol → StepGraph compilation, writing compilable protocols |
| `iot-devices.html` | Cameras, mounts, bench sensors (NFC caps, smart clamp, scale), alert devices (speaker, stack light, haptics), connectivity, reference build, device privacy |
| `architecture.html` | System map, modules, SAM wire format, per-prompt requests, security, deployment |
| `api-reference.html` | `/api/health`, `/api/compile`, `/api/segment-live`, `/api/evaluate`, `/api/segment` |
| `safety.html` | Scope: training system, not a medical device; human-in-charge; limitations |
| `troubleshooting.html` | FAQ: configuration, camera, detection, performance |

Shared shell: `docs.css`, `docs.js` (TOC generation + scrollspy, nav collapse,
sidebar search filter, dark-mode toggle persisted in localStorage, mobile nav).
