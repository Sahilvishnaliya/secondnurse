import unittest

from core.protocol import compile_protocol, heuristic_compile
from core.rules import bbox_overlap_area, evaluate_trace
from core.meta_client import segment


class ProtocolTests(unittest.TestCase):
    def test_numbered_steps_and_min_seconds(self):
        g = heuristic_compile("1. Wash hands for at least 20 seconds.\n2. Put on gloves.")
        self.assertEqual(g["step_count"], 2)
        self.assertEqual(g["steps"][0]["min_seconds"], 20)

    def test_forbidden_touch_extracted(self):
        g = heuristic_compile("1. Uncap it. Never touch the sterile connector tip.")
        rules = g["steps"][0]["forbidden_contacts"]
        self.assertTrue(any(r["rule"] == "TOUCH" for r in rules))

    def test_empty_input_falls_back_to_default(self):
        self.assertGreaterEqual(compile_protocol("")["step_count"], 5)


class RuleTests(unittest.TestCase):
    def test_overlap_area(self):
        a = {"x": 0, "y": 0, "w": 10, "h": 10}
        b = {"x": 5, "y": 5, "w": 10, "h": 10}
        self.assertEqual(bbox_overlap_area(a, b), 25)

    def test_touch_requires_sustained_overlap(self):
        tip = {"x": 100, "y": 100, "w": 20, "h": 20}
        hand = {"x": 105, "y": 105, "w": 30, "h": 30}
        brief = [{"t": 0.0, "objects": {"hand": hand, "sterile_tip": tip}}]
        self.assertEqual(evaluate_trace(brief)["event_count"], 0)
        held = [{"t": t / 10, "objects": {"hand": hand, "sterile_tip": tip}} for t in range(6)]
        result = evaluate_trace(held)
        self.assertEqual(result["event_count"], 1)
        self.assertEqual(result["events"][0]["type"], "TOUCH")
        self.assertEqual(result["compliance_score"], 75)

    def test_cap_outside_field(self):
        field = {"x": 0, "y": 0, "w": 200, "h": 200}
        cap = {"x": 300, "y": 300, "w": 20, "h": 20}
        frames = [{"t": t / 10, "objects": {"cap": cap}, "field": field} for t in range(6)]
        self.assertEqual(evaluate_trace(frames)["events"][0]["type"], "FIELD")

    def test_order_jump(self):
        frames = [{"t": 0, "step": 1}, {"t": 1, "step": 3}]
        self.assertEqual(evaluate_trace(frames)["events"][0]["type"], "ORDER")


class SegmentTests(unittest.TestCase):
    def test_mock_segment_is_labelled(self):
        out = segment("red connector")
        self.assertIn("boxes", out)
        self.assertTrue(out["mock"] or out["live"])


if __name__ == "__main__":
    unittest.main()
