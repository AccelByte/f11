import json
import unittest

from prepare_phase0_fixtures import ROOT


class Phase0ConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.assessment = json.loads((ROOT / "data/config/assessment-v1.json").read_text(encoding="utf-8"))
        cls.league = json.loads((ROOT / "data/config/league-profile-v1.json").read_text(encoding="utf-8"))

    def test_all_weight_groups_sum_to_one(self) -> None:
        self.assertAlmostEqual(sum(self.assessment["compositeWeights"].values()), 1.0)
        self.assertAlmostEqual(sum(axis["weight"] for axis in self.assessment["tacticalAxes"].values()), 1.0)
        for axis in self.assessment["tacticalAxes"].values():
            self.assertAlmostEqual(sum(axis["attributes"].values()), 1.0)
        for unit in self.assessment["unitWeights"].values():
            self.assertAlmostEqual(sum(unit.values()), 1.0)

    def test_formation_has_eleven_unique_slots(self) -> None:
        slots = self.assessment["formation"]["slots"]
        self.assertEqual(len(slots), 11)
        self.assertEqual(len({slot["id"] for slot in slots}), 11)
        self.assertEqual([slot["position"] for slot in slots].count("CB"), 2)

    def test_league_profile_defines_exactly_38_matches(self) -> None:
        opponents = self.league["opponents"]
        self.assertEqual(len(opponents), 19)
        self.assertEqual(len({opponent["id"] for opponent in opponents}), 19)
        self.assertEqual(len(opponents) * self.league["schedule"]["matchesPerOpponent"], 38)
        for opponent in opponents:
            self.assertTrue(all(0 <= opponent[key] <= 100 for key in ("attack", "defence", "control")))


if __name__ == "__main__":
    unittest.main()

