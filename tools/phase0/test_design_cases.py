import json
import math
import unittest

from prepare_phase0_fixtures import ROOT


class Phase0DesignCaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.draft = json.loads((ROOT / "data/fixtures/phase-00-draft-cases-v1.json").read_text(encoding="utf-8"))
        cls.matches = json.loads((ROOT / "data/fixtures/phase-00-match-cases-v1.json").read_text(encoding="utf-8"))

    def test_cooldown_cases_use_two_round_exclusion(self) -> None:
        cases = {case["id"]: case for case in self.draft["cases"]}
        passed = cases["passed-card-two-round-cooldown"]
        self.assertEqual(passed["expected"]["ineligibleRounds"], [2, 3])
        self.assertEqual(passed["expected"]["eligibleAgainRound"], 4)
        rerolled = cases["rerolled-card-current-and-future-exclusion"]
        self.assertEqual(rerolled["expected"]["ineligibleRounds"], [6, 7])
        self.assertEqual(rerolled["expected"]["eligibleAgainRound"], 8)

    def test_failed_reroll_preserves_resource(self) -> None:
        case = next(case for case in self.draft["cases"] if case["id"] == "failed-reroll-does-not-consume")
        self.assertEqual(case["action"]["rerollsBefore"], case["expected"]["rerollsAfter"])
        self.assertFalse(case["expected"]["replacementGenerated"])

    def test_match_cases_reproduce_delta_and_probabilities(self) -> None:
        for case in self.matches["cases"]:
            team = case["team"]
            opponent = case["opponent"]
            delta = (
                0.45 * (team["attack"] - opponent["defence"])
                + 0.40 * (team["defence"] - opponent["attack"])
                + 0.15 * (team["control"] - opponent["control"])
                + case["venueBias"]
            )
            win_weight = math.exp(delta / 12)
            loss_weight = math.exp(-delta / 12)
            draw_weight = math.exp(-0.35 - abs(delta) / 18)
            total = win_weight + draw_weight + loss_weight
            expected = case["expected"]
            self.assertAlmostEqual(delta, expected["delta"], places=6)
            self.assertAlmostEqual(win_weight / total, expected["winProbability"], places=6)
            self.assertAlmostEqual(draw_weight / total, expected["drawProbability"], places=6)
            self.assertAlmostEqual(loss_weight / total, expected["lossProbability"], places=6)


if __name__ == "__main__":
    unittest.main()

