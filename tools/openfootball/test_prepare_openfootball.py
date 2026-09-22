import json
import shutil
import tempfile
import unittest
from pathlib import Path

from prepare_openfootball import (
    CONTENT_VERSION,
    DEFAULT_SEED,
    ROOT,
    calibrated_rating,
    club_role_quality,
    parse_matches,
    parse_squads,
    position_ratings,
    prepare_manifest,
)


ENGLAND = ROOT / ".cache/openfootball-england"
PLAYERS = ROOT / ".cache/openfootball-players"
CHECKED_IN = ROOT / "data/content/openfootball-pl-2023-24-named-squads-v2.json"


class PrepareOpenFootballTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.generated = prepare_manifest(ENGLAND, PLAYERS, DEFAULT_SEED)

    def test_named_2023_24_squads_and_complete_season_are_loaded(self) -> None:
        self.assertEqual(self.generated["contentVersion"], CONTENT_VERSION)
        self.assertEqual(self.generated["summary"]["seasonCount"], 1)
        self.assertEqual(self.generated["summary"]["matchCount"], 380)
        self.assertEqual(self.generated["source"]["seasonName"], "2023/24")
        self.assertEqual(self.generated["source"]["seasons"], [
            {"seasonCode": "2023-24", "teamCount": 20, "matchCount": 380}
        ])

    def test_match_and_squad_tables_parse(self) -> None:
        self.assertEqual(len(parse_matches(ENGLAND / "2023-24/1-premierleague.txt")), 380)
        squads = parse_squads(ENGLAND / "2023-24/squads")
        self.assertEqual(len(squads), 20)
        self.assertEqual(sum(len(players) for players in squads.values()), 1041)

    def test_named_squad_cards_keep_observed_identity_and_synthetic_ratings_separate(self) -> None:
        players = self.generated["playerSeasons"]
        self.assertEqual(len(players), 1041)
        self.assertEqual({player["seasonCode"] for player in players}, {"2023-24"})
        self.assertEqual({player["eraCode"] for player in players}, {"2020s"})
        self.assertTrue(all(player["modelEvidence"]["matches"] == 38 for player in players))
        self.assertTrue(all(16 <= player["modeledAge"] <= 45 for player in players))
        self.assertTrue(all(140 <= player["modeledHeightCm"] <= 220 for player in players))
        self.assertTrue(all(player["ratingProvenance"]["officialRating"] is False for player in players))
        self.assertTrue(all(player["observedAppearanceCount"] == 0 for player in players))
        self.assertTrue(all(player["observedStartCount"] == 0 for player in players))
        self.assertEqual(
            {player["sourceBroadPosition"] for player in players},
            {"GK", "DF", "MF", "FW"},
        )
        saliba = next(player for player in players if player["displayName"] == "William Saliba")
        self.assertEqual(saliba["clubCode"], "arsenal")
        self.assertEqual(saliba["sourceBroadPosition"], "DF")
        self.assertEqual(saliba["sourceBirthYear"], 2001)
        ratings = [rating for player in players for rating in player["ratingsByPosition"].values()]
        self.assertGreaterEqual(min(ratings), 55)
        self.assertLessEqual(max(ratings), 94)

    def test_role_quality_uses_attack_and_defence_differently(self) -> None:
        neutral = {
            f"{name}Index": 70.0
            for name in ("attack", "defence", "result", "control", "cleanSheets", "consistency", "resilience", "away")
        }
        attacking = {**neutral, "attackIndex": 90.0}
        defending = {**neutral, "defenceIndex": 90.0}
        self.assertGreater(club_role_quality("CF", attacking), club_role_quality("CF", defending))
        self.assertGreater(club_role_quality("GK", defending), club_role_quality("GK", attacking))

    def test_rating_calibration_preserves_floor_middle_and_elite_anchors(self) -> None:
        self.assertEqual(calibrated_rating(55), 55)
        self.assertEqual(calibrated_rating(71), 72)
        self.assertEqual(calibrated_rating(82), 86)
        self.assertEqual(calibrated_rating(84), 90)
        self.assertEqual(calibrated_rating(85), 91)
        self.assertEqual(calibrated_rating(88), 94)

    def test_best_position_rating_distribution_has_a_real_elite_band(self) -> None:
        best_ratings = sorted(
            max(player["ratingsByPosition"].values())
            for player in self.generated["playerSeasons"]
        )
        median = best_ratings[len(best_ratings) // 2]
        percentile_95 = best_ratings[int((len(best_ratings) - 1) * 0.95)]
        elite_count = sum(rating >= 90 for rating in best_ratings)

        self.assertTrue(71 <= median <= 73)
        self.assertGreaterEqual(percentile_95, 86)
        self.assertTrue(10 <= elite_count <= 25)
        self.assertEqual(max(best_ratings), 94)

    def test_position_rating_applies_a_role_specific_age_curve(self) -> None:
        row = {
            f"{name}Index": 72.5
            for name in ("attack", "defence", "result", "control", "cleanSheets", "consistency", "resilience", "away")
        }
        attributes = {
            "aerialPresence": 70,
            "ballWinning": 70,
            "chanceCreation": 70,
            "defensiveCover": 70,
            "goalkeeping": 70,
            "leadership": 70,
            "pace": 70,
        }
        peak = position_ratings("CF", ("CF",), attributes, row, 26, DEFAULT_SEED, "age-test")
        veteran = position_ratings("CF", ("CF",), attributes, row, 39, DEFAULT_SEED, "age-test")
        self.assertGreater(peak["CF"], veteran["CF"])

    def test_every_named_squad_card_is_exposed_in_offer_analysis(self) -> None:
        report = json.loads(
            (ROOT / "data/reports/phase-1a-offer-analysis-v1.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(report["contentVersion"], CONTENT_VERSION)
        self.assertEqual(report["runs"], 10000)
        self.assertEqual(report["completedRuns"], 10000)
        self.assertEqual(report["failures"], 0)
        self.assertEqual(
            report["playerAppearance"]["distinctPlayers"],
            self.generated["summary"]["playerCount"],
        )

    def test_generation_matches_checked_in_catalogue(self) -> None:
        stored = json.loads(CHECKED_IN.read_text(encoding="utf-8"))
        self.assertEqual(self.generated, stored)

    def test_source_tampering_changes_the_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            england = root / "england"
            players = root / "players"
            shutil.copytree(ENGLAND / "2023-24", england / "2023-24")
            match_path = england / "2023-24/1-premierleague.txt"
            source_text = match_path.read_text(encoding="utf-8")
            match_path.write_text(
                source_text.replace("3-0 (1-0)", "4-0 (1-0)", 1),
                encoding="utf-8",
            )
            for source in PLAYERS.rglob("*.players.txt"):
                target = players / source.relative_to(PLAYERS)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            changed = prepare_manifest(england, players, DEFAULT_SEED)
        self.assertNotEqual(
            changed["summary"]["playersSha256"],
            self.generated["summary"]["playersSha256"],
        )


if __name__ == "__main__":
    unittest.main()
