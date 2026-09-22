#!/usr/bin/env python3
"""Create deterministic Phase 0 roster fixtures and reference assessments."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
CATALOGUE_TOOLS = ROOT / "tools" / "catalogue"
sys.path.insert(0, str(CATALOGUE_TOOLS))

from validate_catalogue import validate_manifest  # noqa: E402


Player = dict[str, Any]
ScoreKey = Callable[[Player, str], tuple[Any, ...]]


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


def round_half_up(value: float, digits: int = 2) -> float:
    """Match JavaScript Math.round for the positive assessment values."""
    scale = 10**digits
    return math.floor(value * scale + 0.5) / scale


def choose_roster(players: list[Player], slots: list[dict[str, str]], score_key: ScoreKey) -> list[dict[str, str]]:
    available_by_position = {
        slot["id"]: [player for player in players if slot["position"] in player["ratingsByPosition"]]
        for slot in slots
    }
    ordered_slots = sorted(slots, key=lambda slot: (len(available_by_position[slot["id"]]), slot["id"]))
    selected: dict[str, Player] = {}
    used: set[str] = set()
    for slot in ordered_slots:
        candidates = [player for player in available_by_position[slot["id"]] if player["playerIdentityId"] not in used]
        if not candidates:
            raise RuntimeError(f"No unique candidate can fill {slot['id']}")
        chosen = max(candidates, key=lambda player: (*score_key(player, slot["position"]), player["id"]))
        selected[slot["id"]] = chosen
        used.add(chosen["playerIdentityId"])
    return [
        {"slotId": slot["id"], "position": slot["position"], "playerSeasonId": selected[slot["id"]]["id"]}
        for slot in slots
    ]


def validate_roster(
    assignments: list[dict[str, str]],
    players_by_id: dict[str, Player],
    slots: list[dict[str, str]],
) -> list[str]:
    errors: list[str] = []
    expected_slots = {slot["id"]: slot["position"] for slot in slots}
    actual_slots = [assignment["slotId"] for assignment in assignments]
    if len(assignments) != len(slots) or set(actual_slots) != set(expected_slots):
        errors.append("formation_slots_mismatch")
    if len(actual_slots) != len(set(actual_slots)):
        errors.append("duplicate_slot")
    identities: list[str] = []
    for assignment in assignments:
        player = players_by_id.get(assignment["playerSeasonId"])
        if player is None:
            errors.append("unknown_player_season")
            continue
        identities.append(player["playerIdentityId"])
        expected_position = expected_slots.get(assignment["slotId"])
        if expected_position is None or assignment["position"] != expected_position:
            errors.append("slot_position_mismatch")
        elif expected_position not in player["ratingsByPosition"]:
            errors.append("illegal_position")
    if len(identities) != len(set(identities)):
        errors.append("duplicate_player_identity")
    return sorted(set(errors))


def assess_roster(
    assignments: list[dict[str, str]],
    players_by_id: dict[str, Player],
    config: dict[str, Any],
) -> dict[str, Any]:
    by_slot = {assignment["slotId"]: players_by_id[assignment["playerSeasonId"]] for assignment in assignments}
    effective = {
        assignment["slotId"]: players_by_id[assignment["playerSeasonId"]]["ratingsByPosition"][assignment["position"]]
        for assignment in assignments
    }
    best = {slot: max(player["ratingsByPosition"].values()) for slot, player in by_slot.items()}
    quality = mean(list(best.values()))
    positioning = mean([100 * effective[slot] / best[slot] for slot in by_slot])

    chemistry_config = config["chemistry"]
    weighted_affinity = 0.0
    edge_weight = 0.0
    for left, right, weight in chemistry_config["edges"]:
        left_player = by_slot[left]
        right_player = by_slot[right]
        if (
            left_player["clubCode"] == right_player["clubCode"]
            and left_player["seasonCode"] == right_player["seasonCode"]
        ):
            affinity = chemistry_config["sameClubSeasonAffinity"]
        elif left_player["seasonCode"] == right_player["seasonCode"]:
            affinity = chemistry_config["sameCompetitionSeasonAffinity"]
        else:
            affinity = chemistry_config["neutralAffinity"]
        weighted_affinity += weight * affinity
        edge_weight += weight
    chemistry = weighted_affinity / edge_weight

    axis_details: dict[str, dict[str, float]] = {}
    tactical_config = config["tacticalAxes"]
    for axis, axis_config in tactical_config.items():
        supply_total = 0.0
        slot_weight_total = 0.0
        for slot_id, slot_weight in axis_config["slots"].items():
            player = by_slot[slot_id]
            attribute_value = sum(
                player["attributes"][attribute] * attribute_weight
                for attribute, attribute_weight in axis_config["attributes"].items()
            )
            supply_total += attribute_value * slot_weight
            slot_weight_total += slot_weight
        supply = supply_total / slot_weight_total
        minimum = axis_config["minimum"]
        maximum = axis_config["maximum"]
        if supply < minimum:
            score = 100 * supply / minimum
        elif maximum is None or supply <= maximum:
            score = 100.0
        else:
            score = max(60.0, 100 - 40 * (supply - maximum) / (100 - maximum))
        axis_details[axis] = {"supply": round_half_up(supply), "score": round_half_up(score)}
    tactical_balance = sum(
        axis_details[axis]["score"] * axis_config["weight"]
        for axis, axis_config in tactical_config.items()
    )

    leadership_values = sorted((player["leadership"] for player in by_slot.values()), reverse=True)
    leadership_config = config["leadership"]
    leadership = (
        leadership_config["highestWeight"] * leadership_values[0]
        + leadership_config["topThreeMeanWeight"] * mean(leadership_values[:3])
    )
    categories = {
        "quality": quality,
        "positioning": positioning,
        "chemistry": chemistry,
        "tacticalBalance": tactical_balance,
        "leadership": leadership,
    }
    composite = sum(categories[name] * weight for name, weight in config["compositeWeights"].items())
    return {
        "categories": {name: round_half_up(value) for name, value in categories.items()},
        "tacticalAxes": axis_details,
        "composite": round_half_up(composite),
    }


def build_fixture_manifest(catalogue: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    catalogue_errors = validate_manifest(catalogue)
    if catalogue_errors:
        raise RuntimeError("Catalogue failed validation: " + "; ".join(catalogue_errors))
    players = catalogue["playerSeasons"]
    players_by_id = {player["id"]: player for player in players}
    slots = config["formation"]["slots"]

    strongest = choose_roster(
        players,
        slots,
        lambda player, position: (
            player["ratingsByPosition"][position],
            max(player["ratingsByPosition"].values()),
            player["modelEvidence"]["matches"],
        ),
    )
    mispositioned = choose_roster(
        players,
        slots,
        lambda player, position: (
            max(player["ratingsByPosition"].values()) - player["ratingsByPosition"][position],
            max(player["ratingsByPosition"].values()),
            player["modelEvidence"]["matches"],
        ),
    )
    coherent_club = "arsenal"
    coherent_season = "2023-24"
    coherent_players = [
        player
        for player in players
        if player["clubCode"] == coherent_club and player["seasonCode"] == coherent_season
    ]
    coherent = choose_roster(
        coherent_players,
        slots,
        lambda player, position: (
            sum(player["tacticalTraits"].values()) + player["leadership"],
            player["ratingsByPosition"][position],
            player["modelEvidence"]["matches"],
        ),
    )

    valid_specs = [
        ("elite-balanced", "High effective position ratings across all eleven slots.", strongest),
        ("star-heavy-mispositioned", "Legal placements chosen to expose positioning penalties.", mispositioned),
        ("single-club-coherent", "One-club XI used to exercise the strongest documented chemistry affinity.", coherent),
    ]
    valid_rosters = []
    for fixture_id, purpose, assignments in valid_specs:
        errors = validate_roster(assignments, players_by_id, slots)
        if errors:
            raise RuntimeError(f"Generated valid fixture {fixture_id} failed: {errors}")
        valid_rosters.append(
            {
                "id": fixture_id,
                "purpose": purpose,
                "assignments": assignments,
                "expectedValidationErrors": [],
                "expectedAssessment": assess_roster(assignments, players_by_id, config),
            }
        )

    invalid_duplicate = [dict(assignment) for assignment in strongest]
    lcb = next(assignment for assignment in invalid_duplicate if assignment["slotId"] == "LCB")
    rcb = next(assignment for assignment in invalid_duplicate if assignment["slotId"] == "RCB")
    rcb["playerSeasonId"] = lcb["playerSeasonId"]
    invalid_errors = validate_roster(invalid_duplicate, players_by_id, slots)
    if invalid_errors != ["duplicate_player_identity"]:
        raise RuntimeError(f"Invalid duplicate fixture produced unexpected errors: {invalid_errors}")

    return {
        "schemaVersion": "football11-phase0-fixtures-v1",
        "fixtureVersion": "phase0-rosters-v1",
        "contentVersion": catalogue["contentVersion"],
        "assessmentVersion": config["version"],
        "notes": "Reference scores freeze Phase 0 inputs; the Phase 1A TypeScript engine must reproduce them before they become final golden vectors.",
        "validRosters": valid_rosters,
        "invalidRosters": [
            {
                "id": "duplicate-identity",
                "purpose": "Reject the same real player identity assigned to both centre-back slots.",
                "assignments": invalid_duplicate,
                "expectedValidationErrors": invalid_errors,
            }
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=ROOT / "data/content/openfootball-pl-2023-24-named-squads-v2.json")
    parser.add_argument("--config", type=Path, default=ROOT / "data/config/assessment-v1.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data/fixtures/phase-00-golden-rosters-v1.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalogue = json.loads(args.catalogue.read_text(encoding="utf-8"))
    config = json.loads(args.config.read_text(encoding="utf-8"))
    fixture_manifest = build_fixture_manifest(catalogue, config)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")
    for fixture in fixture_manifest["validRosters"]:
        expected = fixture["expectedAssessment"]
        print(f"{fixture['id']}: composite={expected['composite']} categories={expected['categories']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
