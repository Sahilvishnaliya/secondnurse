"""Deterministic breach rules over tracked object boxes/masks.

A frame is: {"t": float_seconds, "objects": {"hand": box, "sterile_tip": box,
"cap": box}, "field": box, "step": int}
A box is {"x","y","w","h"}. Overlap sustained across frames becomes an event,
so a single noisy frame never fires an alert.
"""


def bbox_overlap_area(a, b):
    if not a or not b:
        return 0.0
    x = max(0.0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    y = max(0.0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    return x * y


def _centroid(box):
    return (box["x"] + box["w"] / 2.0, box["y"] + box["h"] / 2.0)


def _inside(point, box):
    return box["x"] <= point[0] <= box["x"] + box["w"] and box["y"] <= point[1] <= box["y"] + box["h"]


def evaluate_trace(frames, min_touch_area=40.0, sustain_seconds=0.3):
    """Return breach events found in a trace. Pure and testable."""
    events = []
    touch_start = None
    field_start = None
    touch_fired = False
    field_fired = False
    seen_steps = []

    for frame in frames or []:
        t = float(frame.get("t", 0))
        objs = frame.get("objects", {})
        hand, tip, cap = objs.get("hand"), objs.get("sterile_tip"), objs.get("cap")
        field = frame.get("field")

        step = frame.get("step")
        if isinstance(step, int):
            if seen_steps and step > max(seen_steps) + 1:
                events.append({"type": "ORDER", "t": t,
                               "detail": f"Jumped to step {step} before completing step {max(seen_steps) + 1}."})
            if step not in seen_steps:
                seen_steps.append(step)

        overlap = bbox_overlap_area(hand, tip)
        if overlap >= min_touch_area:
            touch_start = t if touch_start is None else touch_start
            if not touch_fired and t - touch_start >= sustain_seconds:
                events.append({"type": "TOUCH", "t": round(touch_start, 2),
                               "detail": "Hand overlapped the sterile connector tip.",
                               "overlap_px": round(overlap, 1)})
                touch_fired = True
        else:
            touch_start = None
            touch_fired = False

        if cap and field:
            outside = not _inside(_centroid(cap), field)
            if outside:
                field_start = t if field_start is None else field_start
                if not field_fired and t - field_start >= sustain_seconds:
                    events.append({"type": "FIELD", "t": round(field_start, 2),
                                   "detail": "Sterile cap was placed outside the sterile field."})
                    field_fired = True
            else:
                field_start = None
                field_fired = False

    score = max(0, 100 - 25 * len(events))
    return {"events": events, "event_count": len(events), "compliance_score": score}
