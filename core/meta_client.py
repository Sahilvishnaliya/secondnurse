"""Meta Model API adapter. Live only; refuses when unconfigured."""
import os

LIVE = bool(os.getenv("MODEL_API_KEY")) and os.getenv("SECONDNURSE_MODE") == "live"



def segment(prompt):
    """Return boxes for a text prompt via live SAM 3.1."""
    if not LIVE:
        raise RuntimeError("Meta API not configured: set MODEL_API_KEY and SECONDNURSE_MODE=live.")
    from core.sam_live import call_sam  # local import avoids a cycle
    raise RuntimeError("Use /api/segment-live with a camera frame for live segmentation.")
