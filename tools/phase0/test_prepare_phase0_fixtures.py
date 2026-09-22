import json
import unittest
from pathlib import Path

from prepare_phase0_fixtures import ROOT, build_fixture_manifest, validate_roster


class Phase0FixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalogue = json.loads((ROOT / "data/content/openfootball-pl-2023-24-named-squads-v2.json").read_text(encoding="utf-8"))
        cls.config = json.loads((ROOT / "data/config/assessment-v1.json").read_text(encoding="utf-8"))
        cls.generated = build_fixture_manifest(cls.catalogue, cls.config)

    def test_generation_matches_checked_in_fixture(self) -> None:
        stored = json.loads((ROOT / "data/fixtures/phase-00-golden-rosters-v1.json").read_text(encoding="utf-8"))
        self.assertEqual(self.generated, stored)

    def test_valid_rosters_fill_the_formation_once(self) -> None:
        players_by_id = {player["id"]: player for player in self.catalogue["playerSeasons"]}
        slots = self.config["formation"]["slots"]
        for fixture in self.generated["validRosters"]:
            self.assertEqual(validate_roster(fixture["assignments"], players_by_id, slots), [])

    def test_reference_scores_are_bounded(self) -> None:
        for fixture in self.generated["validRosters"]:
            assessment = fixture["expectedAssessment"]
            self.assertTrue(0 <= assessment["composite"] <= 100)
            self.assertTrue(all(0 <= value <= 100 for value in assessment["categories"].values()))
            self.assertTrue(all(0 <= axis["score"] <= 100 for axis in assessment["tacticalAxes"].values()))

    def test_duplicate_fixture_has_expected_error(self) -> None:
        fixture = self.generated["invalidRosters"][0]
        self.assertEqual(fixture["expectedValidationErrors"], ["duplicate_player_identity"])


if __name__ == "__main__":
    unittest.main()
