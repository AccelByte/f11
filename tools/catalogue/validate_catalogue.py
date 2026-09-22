#!/usr/bin/env python3
"""Validate the provider-neutral Football 11 player catalogue v1 contract."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

CANONICAL_POSITIONS = ("GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "CF", "RW")
REQUIRED_ATTRIBUTES = {
    "aerialPresence",
    "ballWinning",
    "chanceCreation",
    "defensiveCover",
    "goalkeeping",
    "leadership",
    "pace",
}
REQUIRED_TRAITS = {"aerial", "ballWinning", "creation", "defensiveCover", "pace"}


def canonical_players_hash(players: list[dict[str, Any]]) -> str:
    payload = json.dumps(players, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required_top = {
        "schemaVersion", "contentVersion", "source", "syntheticData",
        "summary", "teams", "playerSeasons",
    }
    missing_top = sorted(required_top - set(manifest))
    if missing_top:
        return [f"missing top-level field: {field}" for field in missing_top]
    if manifest["schemaVersion"] != "football11-player-catalogue-v1":
        errors.append("schemaVersion must be football11-player-catalogue-v1")

    content_version = manifest["contentVersion"]
    players = manifest["playerSeasons"]
    teams = manifest["teams"]
    if not isinstance(players, list) or len(players) < 11:
        errors.append("playerSeasons must contain at least eleven records")
        return errors
    if not isinstance(teams, list) or not teams:
        errors.append("teams must contain at least one record")
        return errors

    club_codes = [team.get("clubCode") for team in teams]
    if len(set(club_codes)) != len(club_codes):
        errors.append("team clubCode values must be unique")
    known_clubs = set(club_codes)
    source_team_ids = [team.get("sourceTeamId") for team in teams]
    if len(set(source_team_ids)) != len(source_team_ids):
        errors.append("team sourceTeamId values must be unique")
    seen_ids: set[str] = set()
    seen_identities: set[str] = set()
    seen_source_ids: set[int] = set()
    coverage = {position: 0 for position in CANONICAL_POSITIONS}

    for index, player in enumerate(players):
        label = f"playerSeasons[{index}]"
        for field in (
            "id", "playerIdentityId", "sourcePlayerId", "displayName", "clubCode",
            "seasonCode", "eraCode", "ratingsByPosition", "attributes",
            "observedStatsBombPositions", "tacticalTraits", "leadership", "squadSheetCount",
            "observedAppearanceCount", "observedStartCount", "dataVersion",
            "ratingProvenance",
        ):
            if field not in player:
                errors.append(f"{label} missing {field}")
        if any(field not in player for field in ("id", "playerIdentityId", "sourcePlayerId")):
            continue
        if player["id"] in seen_ids:
            errors.append(f"{label} duplicates id {player['id']}")
        if player["playerIdentityId"] in seen_identities:
            errors.append(f"{label} duplicates playerIdentityId {player['playerIdentityId']}")
        if player["sourcePlayerId"] in seen_source_ids:
            errors.append(f"{label} duplicates sourcePlayerId {player['sourcePlayerId']}")
        seen_ids.add(player["id"])
        seen_identities.add(player["playerIdentityId"])
        seen_source_ids.add(player["sourcePlayerId"])

        if player.get("clubCode") not in known_clubs:
            errors.append(f"{label} references unknown clubCode {player.get('clubCode')}")
        clubs_observed = player.get("clubsObserved", [])
        if not isinstance(clubs_observed, list) or not clubs_observed:
            errors.append(f"{label} clubsObserved must be a non-empty list")
        elif any(club not in known_clubs for club in clubs_observed):
            errors.append(f"{label} clubsObserved references an unknown club")
        if player.get("dataVersion") != content_version:
            errors.append(f"{label} dataVersion does not match contentVersion")

        ratings = player.get("ratingsByPosition", {})
        if not ratings:
            errors.append(f"{label} has no legal positions")
        for position, value in ratings.items():
            if position not in CANONICAL_POSITIONS:
                errors.append(f"{label} uses unknown position {position}")
                continue
            coverage[position] += 1
            if not isinstance(value, int) or not 0 <= value <= 100:
                errors.append(f"{label} rating {position} must be an integer in 0..100")

        observed_positions = player.get("observedStatsBombPositions", {})
        if not isinstance(observed_positions, dict) or not observed_positions:
            errors.append(f"{label} observed source positions must be a non-empty object")
        elif any(not isinstance(value, int) or value < 1 for value in observed_positions.values()):
            errors.append(f"{label} observed source position counts must be positive integers")

        attributes = player.get("attributes", {})
        if set(attributes) != REQUIRED_ATTRIBUTES:
            errors.append(f"{label} attributes must exactly match the v1 contract")
        for name, value in attributes.items():
            if not isinstance(value, int) or not 0 <= value <= 100:
                errors.append(f"{label} attribute {name} must be an integer in 0..100")
        traits = player.get("tacticalTraits", {})
        if set(traits) != REQUIRED_TRAITS:
            errors.append(f"{label} tacticalTraits must exactly match the v1 contract")
        if player.get("leadership") != attributes.get("leadership"):
            errors.append(f"{label} leadership must match attributes.leadership")
        for count_field in ("squadSheetCount", "observedAppearanceCount", "observedStartCount"):
            value = player.get(count_field)
            if not isinstance(value, int) or value < 0:
                errors.append(f"{label} {count_field} must be a non-negative integer")
        squad_count = player.get("squadSheetCount", -1)
        appearance_count = player.get("observedAppearanceCount", -1)
        start_count = player.get("observedStartCount", -1)
        if isinstance(squad_count, int) and isinstance(appearance_count, int) and appearance_count > squad_count:
            errors.append(f"{label} observedAppearanceCount cannot exceed squadSheetCount")
        if isinstance(appearance_count, int) and isinstance(start_count, int) and start_count > appearance_count:
            errors.append(f"{label} observedStartCount cannot exceed observedAppearanceCount")

        provenance = player.get("ratingProvenance", {})
        if provenance.get("kind") != "synthetic" or provenance.get("officialRating") is not False:
            errors.append(f"{label} must identify ratings as synthetic and non-official")
        if provenance.get("generatorVersion") != manifest["syntheticData"].get("generatorVersion"):
            errors.append(f"{label} generatorVersion does not match manifest")
        if provenance.get("seed") != manifest["syntheticData"].get("seed"):
            errors.append(f"{label} rating seed does not match manifest")

        if manifest.get("source", {}).get("provider") == "OpenFootball":
            age = player.get("modeledAge")
            height = player.get("modeledHeightCm")
            evidence = player.get("modelEvidence", {})
            if not isinstance(age, int) or not 16 <= age <= 45:
                errors.append(f"{label} modeledAge must be an integer in 16..45")
            if not isinstance(height, int) or not 140 <= height <= 220:
                errors.append(f"{label} modeledHeightCm must be an integer in 140..220")
            if not isinstance(player.get("roleLabel"), str) or not player.get("roleLabel"):
                errors.append(f"{label} roleLabel is required for OpenFootball cards")
            squad_number = player.get("sourceSquadNumber")
            if not isinstance(squad_number, int) or squad_number < 0:
                errors.append(f"{label} sourceSquadNumber must be a non-negative integer")
            birth_year = player.get("sourceBirthYear")
            if birth_year is not None and (
                not isinstance(birth_year, int) or not 1900 <= birth_year <= 2100
            ):
                errors.append(f"{label} sourceBirthYear must be null or an integer in 1900..2100")
            if player.get("sourceBroadPosition") not in {"GK", "DF", "MF", "FW"}:
                errors.append(f"{label} sourceBroadPosition must be GK, DF, MF, or FW")
            if player.get("physicalProfileProvenance") not in {
                "observed-player-record",
                "modeled-position-population",
            }:
                errors.append(f"{label} has invalid physicalProfileProvenance")
            if evidence.get("kind") != "club-season-results" or evidence.get("matches") != 38:
                errors.append(f"{label} requires 38-match club-season model evidence")

    summary = manifest["summary"]
    if summary.get("playerCount") != len(players):
        errors.append("summary.playerCount does not match playerSeasons length")
    if summary.get("teamCount") != len(teams):
        errors.append("summary.teamCount does not match teams length")
    if summary.get("positionCoverage") != coverage:
        errors.append("summary.positionCoverage does not match player records")
    actual_hash = canonical_players_hash(players)
    if summary.get("playersSha256") != actual_hash:
        errors.append("summary.playersSha256 does not match player records")
    if any(count == 0 for count in coverage.values()):
        errors.append("every canonical formation position requires catalogue coverage")
    if manifest.get("source", {}).get("provider") == "OpenFootball":
        source = manifest["source"]
        seasons = source.get("seasons", [])
        if len(seasons) != 1 or seasons[0].get("seasonCode") != "2023-24" or seasons[0].get("matchCount") != 380:
            errors.append("OpenFootball source must contain the validated 2023/24 season")
        if source.get("matchCount") != 380:
            errors.append("OpenFootball source.matchCount must be 380")
        if summary.get("seasonCount") != 1 or summary.get("matchCount") != 380:
            errors.append("OpenFootball summary season/match counts are inconsistent")
        observed_height_count = summary.get("observedHeightCount")
        modeled_height_count = summary.get("modeledHeightCount")
        if (
            not isinstance(observed_height_count, int)
            or not isinstance(modeled_height_count, int)
            or observed_height_count + modeled_height_count != len(players)
        ):
            errors.append("OpenFootball height provenance counts must cover every player")
        unknown_birth_year_count = summary.get("unknownBirthYearCount")
        if unknown_birth_year_count != sum(
            player.get("sourceBirthYear") is None for player in players
        ):
            errors.append("OpenFootball unknownBirthYearCount does not match player records")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "catalogue",
        nargs="?",
        type=Path,
        default=Path("data/content/openfootball-pl-2023-24-named-squads-v2.json"),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.catalogue.read_text(encoding="utf-8"))
    errors = validate_manifest(manifest)
    if errors:
        print("Catalogue validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    summary = manifest["summary"]
    print(
        f"Catalogue valid: {summary['playerCount']} players, "
        f"{summary['teamCount']} clubs, hash {summary['playersSha256']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
