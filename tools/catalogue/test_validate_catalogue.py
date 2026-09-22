import copy
import json
import unittest
from pathlib import Path

from validate_catalogue import validate_manifest


CATALOGUE = Path("data/content/openfootball-pl-2023-24-named-squads-v2.json")


class ValidateCatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(CATALOGUE.read_text(encoding="utf-8"))

    def test_generated_catalogue_passes_frozen_contract(self) -> None:
        self.assertEqual(validate_manifest(copy.deepcopy(self.manifest)), [])

    def test_duplicate_identity_is_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["playerSeasons"][1]["playerIdentityId"] = changed["playerSeasons"][0]["playerIdentityId"]
        self.assertTrue(any("duplicates playerIdentityId" in error for error in validate_manifest(changed)))

    def test_tampered_player_hash_is_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["playerSeasons"][0]["leadership"] += 1
        errors = validate_manifest(changed)
        self.assertIn("summary.playersSha256 does not match player records", errors)

    def test_invalid_modeled_age_is_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["playerSeasons"][0]["modeledAge"] = 99
        self.assertTrue(any("modeledAge" in error for error in validate_manifest(changed)))


if __name__ == "__main__":
    unittest.main()
