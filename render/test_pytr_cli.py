"""Tests for the Vorteile (saveback/round-up) parser in pytr_cli."""

import unittest

from pytr_cli import _extract_bonus_amounts


def _card(items):
    return {"details": {"sections": [{"title": "Vorteile", "data": items}]}}


class ExtractBonusAmountsTest(unittest.TestCase):
    def test_embedded_timeline_items(self):
        """TR's payload shape before mid-October 2026."""
        event = _card(
            [
                {
                    "detail": {
                        "type": "embeddedTimelineItem",
                        "subtitle": "Saveback · 1%",
                        "amount": "0,64 €",
                    }
                },
                {
                    "detail": {
                        "type": "embeddedTimelineItem",
                        "subtitle": "Round up · 2×",
                        "amount": "1,40 €",
                    }
                },
            ]
        )
        self.assertEqual(_extract_bonus_amounts(event), (0.64, 1.40))

    def test_list_items(self):
        """TR's payload shape from mid-October 2026 onward."""
        event = _card(
            [
                {
                    "detail": {
                        "type": "listItem",
                        "content": {"subtitle": "Saveback · 1%"},
                        "trailing": {"title": "0,63 €"},
                    }
                },
                {
                    "detail": {
                        "type": "listItem",
                        "content": {"subtitle": "Round up · 2×"},
                        "trailing": {"title": "2,00 €"},
                    }
                },
            ]
        )
        self.assertEqual(_extract_bonus_amounts(event), (0.63, 2.00))


if __name__ == "__main__":
    unittest.main()
