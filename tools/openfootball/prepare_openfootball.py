#!/usr/bin/env python3
"""Build the Football 11 2023/24 named-squad catalogue from OpenFootball data."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import statistics
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
SEASON = "2023-24"
CONTENT_VERSION = "openfootball-premier-league-2023-24-named-squads-v2"
GENERATOR_VERSION = "openfootball-named-squad-club-results-model-v2"
DEFAULT_SEED = "football-11-openfootball-premier-league-2023-24-named-squads-v1"
ENGLAND_REPOSITORY = "https://github.com/openfootball/england"
PLAYERS_REPOSITORY = "https://github.com/openfootball/players"
ENGLAND_REVISION = "0690446f794fde748ea4b994244def699c6a65b2"
PLAYERS_REVISION = "125d20f7cc06cac7e758b40df535a7695632680a"
MATCH_PATTERN_V = re.compile(
    r"^\s*(?:\d{1,2}:\d{2}\s+)?(?P<home>.*?)\s+v\s+(?P<away>.*?)\s{2,}"
    r"(?P<home_goals>\d+)-(?P<away_goals>\d+)"
    r"(?:\s+\((?P<home_half>\d+)-(?P<away_half>\d+)\))?\s*$"
)
MATCH_PATTERN_SCORE = re.compile(
    r"^\s*(?:\d{1,2}:\d{2}\s+)?(?P<home>.*?)\s{2,}"
    r"(?P<home_goals>\d+)-(?P<away_goals>\d+)"
    r"(?:\s+\((?P<home_half>\d+)-(?P<away_half>\d+)\))?\s{2,}(?P<away>.+?)\s*$"
)
PLAYER_PATTERN = re.compile(
    r"^(?P<name>.+?),\s*(?P<positions>[GDMF](?:\|[GDMF])*)\s*,\s*"
    r"(?P<height>\d+(?:\.\d+)?\s*m|-)\s*,\s*b\.\s*(?P<birth>[^@]+)"
)
SQUAD_PATTERN = re.compile(
    r"^\s*(?P<number>\d+),\s*(?P<name>.+?),\s*(?P<position>GK|DF|MF|FW),\s*"
    r"b\.\s*(?P<birth_year>\d{4}|\?{4}),\s*(?P<previous_club>.*)$"
)
SQUAD_HEADER_PATTERN = re.compile(
    r"^=\s*(?P<club>.+?)\s+-\s+English Premier League 2023/24\s*$"
)
COUNTRY_SUFFIX_PATTERN = re.compile(r"\s+\((?P<country>[A-Z]{3})\)$")
BROAD_POSITION_CONFIG = {
    "GK": ("Goalkeeper", "G", ("GK",)),
    "DF": ("Defender", "D", ("LB", "CB", "CB", "RB")),
    "MF": ("Midfielder", "M", ("DM", "CM", "AM")),
    "FW": ("Forward", "F", ("LW", "CF", "RW")),
}
CANONICAL_POSITIONS = ("GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "CF", "RW")
RATING_CALIBRATION_ANCHORS = (
    (55.0, 55.0),
    (62.0, 62.0),
    (66.0, 67.0),
    (71.0, 72.0),
    (76.0, 78.0),
    (80.0, 83.0),
    (82.0, 86.0),
    (84.0, 90.0),
    (85.0, 91.0),
    (88.0, 94.0),
)


@dataclass(frozen=True)
class Match:
    home: str
    away: str
    home_goals: int
    away_goals: int
    home_half: int | None
    away_half: int | None


@dataclass(frozen=True)
class SquadPlayer:
    squad_number: int
    display_name: str
    country: str | None
    broad_position: str
    birth_year: int | None


@dataclass(frozen=True)
class PlayerProfile:
    name: str
    positions: tuple[str, ...]
    birth_year: int
    height_cm: int


def stable_int(seed: str, *parts: object) -> int:
    payload = "|".join([seed, *(str(part) for part in parts)]).encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def stable_range(seed: str, low: int, high: int, *parts: object) -> int:
    return low + stable_int(seed, *parts) % (high - low + 1)


def bounded(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, round(value)))


def calibrated_rating(raw_rating: float) -> int:
    """Map modeled ratings onto the intended 55–94 gameplay distribution."""
    if raw_rating <= RATING_CALIBRATION_ANCHORS[0][0]:
        return int(RATING_CALIBRATION_ANCHORS[0][1])
    for (raw_low, output_low), (raw_high, output_high) in zip(
        RATING_CALIBRATION_ANCHORS,
        RATING_CALIBRATION_ANCHORS[1:],
    ):
        if raw_rating <= raw_high:
            progress = (raw_rating - raw_low) / (raw_high - raw_low)
            return bounded(output_low + progress * (output_high - output_low), 55, 94)
    return 94


def slug(value: str) -> str:
    normalized = re.sub(r"\s+FC$", "", value, flags=re.IGNORECASE)
    normalized = normalized.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


def normalized_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_name = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", "", ascii_name.lower())


def parse_squads(path: Path) -> dict[str, list[SquadPlayer]]:
    squads: dict[str, list[SquadPlayer]] = {}
    for squad_path in sorted(path.glob("*.txt")):
        lines = squad_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            raise RuntimeError(f"{squad_path} is empty")
        header = SQUAD_HEADER_PATTERN.match(lines[0])
        if not header:
            raise RuntimeError(f"{squad_path} has an unsupported squad header")
        club_name = header.group("club").strip()
        players: list[SquadPlayer] = []
        for line in lines[1:]:
            if not re.match(r"^\s*\d+,", line):
                continue
            match = SQUAD_PATTERN.match(line)
            if not match:
                raise RuntimeError(f"Unable to parse squad row in {squad_path}: {line}")
            raw_name = match.group("name").strip()
            country_match = COUNTRY_SUFFIX_PATTERN.search(raw_name)
            country = country_match.group("country") if country_match else None
            display_name = COUNTRY_SUFFIX_PATTERN.sub("", raw_name).strip()
            raw_birth_year = match.group("birth_year")
            players.append(
                SquadPlayer(
                    squad_number=int(match.group("number")),
                    display_name=display_name,
                    country=country,
                    broad_position=match.group("position"),
                    birth_year=int(raw_birth_year) if raw_birth_year != "????" else None,
                )
            )
        if not players:
            raise RuntimeError(f"{squad_path} did not contain any players")
        squads[club_name] = players
    if len(squads) != 20:
        raise RuntimeError(f"{path} produced {len(squads)} squads; expected 20")
    return squads


def parse_matches(path: Path) -> list[Match]:
    matches: list[Match] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = MATCH_PATTERN_V.match(line) or MATCH_PATTERN_SCORE.match(line)
        if not match:
            continue
        matches.append(
            Match(
                home=match.group("home").strip(),
                away=match.group("away").strip(),
                home_goals=int(match.group("home_goals")),
                away_goals=int(match.group("away_goals")),
                home_half=int(match.group("home_half")) if match.group("home_half") else None,
                away_half=int(match.group("away_half")) if match.group("away_half") else None,
            )
        )
    if len(matches) != 380:
        raise RuntimeError(f"{path} produced {len(matches)} matches; expected 380")
    return matches


def percentile_ranks(values: dict[str, float]) -> dict[str, float]:
    ordered = sorted(values.items(), key=lambda item: (item[1], item[0]))
    divisor = max(1, len(ordered) - 1)
    return {team: index / divisor for index, (team, _value) in enumerate(ordered)}


def season_table(matches: Iterable[Match]) -> dict[str, dict[str, float]]:
    table: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "matches": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points": 0,
            "goalsFor": 0,
            "goalsAgainst": 0,
            "cleanSheets": 0,
            "secondHalfGoalsFor": 0,
            "secondHalfGoalsAgainst": 0,
            "awayPoints": 0,
            "homePoints": 0,
            "goalDifferenceSamples": [],
        }
    )
    for match in matches:
        for team, goals_for, goals_against, venue in (
            (match.home, match.home_goals, match.away_goals, "home"),
            (match.away, match.away_goals, match.home_goals, "away"),
        ):
            row = table[team]
            row["matches"] += 1
            row["goalsFor"] += goals_for
            row["goalsAgainst"] += goals_against
            row["cleanSheets"] += int(goals_against == 0)
            row["goalDifferenceSamples"].append(goals_for - goals_against)
            points = 3 if goals_for > goals_against else 1 if goals_for == goals_against else 0
            row["points"] += points
            row[f"{venue}Points"] += points
            row["wins" if points == 3 else "draws" if points == 1 else "losses"] += 1

        if match.home_half is not None and match.away_half is not None:
            table[match.home]["secondHalfGoalsFor"] += match.home_goals - match.home_half
            table[match.home]["secondHalfGoalsAgainst"] += match.away_goals - match.away_half
            table[match.away]["secondHalfGoalsFor"] += match.away_goals - match.away_half
            table[match.away]["secondHalfGoalsAgainst"] += match.home_goals - match.home_half

    if len(table) != 20:
        raise RuntimeError(f"season produced {len(table)} teams; expected 20")
    for team, row in table.items():
        if row["matches"] != 38:
            raise RuntimeError(f"{team} produced {row['matches']} matches; expected 38")
        row["goalDifference"] = row["goalsFor"] - row["goalsAgainst"]
        row["secondHalfGoalDifference"] = row["secondHalfGoalsFor"] - row["secondHalfGoalsAgainst"]
        row["consistency"] = -statistics.pstdev(row.pop("goalDifferenceSamples"))

    inputs = {
        "result": {team: row["points"] for team, row in table.items()},
        "attack": {team: row["goalsFor"] for team, row in table.items()},
        "defence": {team: -row["goalsAgainst"] for team, row in table.items()},
        "cleanSheets": {team: row["cleanSheets"] for team, row in table.items()},
        "control": {team: row["goalDifference"] for team, row in table.items()},
        "resilience": {team: row["secondHalfGoalDifference"] for team, row in table.items()},
        "consistency": {team: row["consistency"] for team, row in table.items()},
        "away": {team: row["awayPoints"] for team, row in table.items()},
    }
    ranks = {name: percentile_ranks(values) for name, values in inputs.items()}
    for team, row in table.items():
        for name in inputs:
            row[f"{name}Index"] = round(55 + 35 * ranks[name][team], 2)
    return dict(table)


def player_data(
    players_dir: Path,
) -> tuple[dict[str, list[tuple[int, int]]], dict[tuple[str, int], list[PlayerProfile]]]:
    population: dict[str, list[tuple[int, int]]] = {position: [] for position in "GDMF"}
    profiles: dict[tuple[str, int], list[PlayerProfile]] = defaultdict(list)
    for path in sorted(players_dir.rglob("*.players.txt")):
        for line in path.read_text(encoding="utf-8").splitlines():
            match = PLAYER_PATTERN.match(line.strip())
            if not match:
                continue
            years = re.findall(r"(?:18|19|20)\d{2}", match.group("birth"))
            if not years:
                continue
            birth_year = int(years[-1])
            height_value = match.group("height")
            height_cm = round(float(height_value.split()[0]) * 100) if height_value != "-" else 0
            positions = tuple(match.group("positions").split("|"))
            profile = PlayerProfile(
                name=match.group("name").strip(),
                positions=positions,
                birth_year=birth_year,
                height_cm=height_cm,
            )
            profiles[(normalized_name(profile.name), birth_year)].append(profile)
            for position in positions:
                population[position].append((birth_year, height_cm))
    if any(len(values) < 100 for values in population.values()):
        raise RuntimeError("OpenFootball player population is unexpectedly sparse")
    return population, dict(profiles)


def observed_height(
    profiles: dict[tuple[str, int], list[PlayerProfile]],
    player: SquadPlayer,
    population_position: str,
) -> int | None:
    if player.birth_year is None:
        return None
    matches = [
        profile.height_cm
        for profile in profiles.get((normalized_name(player.display_name), player.birth_year), [])
        if population_position in profile.positions and profile.height_cm > 0
    ]
    unique_heights = set(matches)
    return next(iter(unique_heights)) if len(unique_heights) == 1 else None


def inferred_positions(
    broad_position: str,
    seed: str,
    player_key: str,
) -> tuple[str, tuple[str, ...]]:
    _label, _population_position, weighted_positions = BROAD_POSITION_CONFIG[broad_position]
    primary = weighted_positions[stable_int(seed, player_key, "primary-position") % len(weighted_positions)]
    remaining = tuple(
        position
        for position in CANONICAL_POSITIONS
        if position in weighted_positions and position != primary
    )
    return primary, (primary, *remaining)


def modeled_physical_profile(
    population: dict[str, list[tuple[int, int]]],
    broad_position: str,
    season_start: int,
    seed: str,
    *parts: object,
) -> tuple[int, int]:
    contemporary = [
        (season_start - birth_year, height_cm)
        for birth_year, height_cm in population[broad_position]
        if 17 <= season_start - birth_year <= 39 and height_cm > 0
    ]
    if not contemporary:
        fallback = {"G": (28, 190), "D": (26, 185), "M": (25, 179), "F": (24, 182)}
        return fallback[broad_position]
    return contemporary[stable_int(seed, *parts, "physical-profile") % len(contemporary)]


def club_role_quality(primary: str, row: dict[str, float]) -> float:
    attack = row["attackIndex"]
    defence = row["defenceIndex"]
    result = row["resultIndex"]
    control = row["controlIndex"]
    clean = row["cleanSheetsIndex"]
    if primary == "GK":
        return 0.45 * defence + 0.25 * clean + 0.2 * result + 0.1 * row["consistencyIndex"]
    if primary in {"LB", "CB", "RB"}:
        return 0.5 * defence + 0.15 * clean + 0.2 * result + 0.15 * control
    if primary == "DM":
        return 0.35 * defence + 0.3 * control + 0.2 * result + 0.15 * attack
    if primary == "CM":
        return 0.2 * defence + 0.35 * control + 0.25 * attack + 0.2 * result
    if primary == "AM":
        return 0.5 * attack + 0.25 * control + 0.2 * result + 0.05 * row["resilienceIndex"]
    if primary in {"LW", "RW"}:
        return 0.55 * attack + 0.2 * control + 0.2 * result + 0.05 * row["awayIndex"]
    return 0.65 * attack + 0.2 * result + 0.1 * control + 0.05 * row["resilienceIndex"]


def synthetic_attributes(
    primary: str,
    row: dict[str, float],
    age: int,
    height_cm: int,
    seed: str,
    *parts: object,
) -> dict[str, int]:
    profiles = {
        "GK": (70, 48, 48, 72, 80, 68, 45),
        "LB": (58, 69, 64, 71, 7, 60, 74),
        "CB": (76, 74, 50, 76, 7, 66, 58),
        "RB": (58, 69, 64, 71, 7, 60, 74),
        "DM": (66, 73, 65, 73, 6, 65, 62),
        "CM": (58, 64, 72, 65, 5, 63, 66),
        "AM": (52, 49, 78, 51, 5, 59, 72),
        "LW": (52, 46, 74, 48, 5, 55, 79),
        "CF": (70, 45, 70, 45, 5, 62, 73),
        "RW": (52, 46, 74, 48, 5, 55, 79),
    }
    keys = (
        "aerialPresence",
        "ballWinning",
        "chanceCreation",
        "defensiveCover",
        "goalkeeping",
        "leadership",
        "pace",
    )
    result = dict(zip(keys, profiles[primary], strict=True))
    team_attack = row["attackIndex"] - 72.5
    team_defence = row["defenceIndex"] - 72.5
    team_control = row["controlIndex"] - 72.5
    result["chanceCreation"] += 0.28 * team_attack + 0.12 * team_control
    result["ballWinning"] += 0.28 * team_defence
    result["defensiveCover"] += 0.25 * team_defence + 0.08 * team_control
    result["goalkeeping"] += 0.35 * team_defence if primary == "GK" else 0
    result["leadership"] += 0.2 * (row["resultIndex"] - 72.5) + max(-4, min(8, age - 24))
    result["pace"] += max(-8, min(7, (27 - age) * 0.75))
    result["aerialPresence"] += max(-7, min(8, (height_cm - 180) * 0.45))
    for key in result:
        result[key] += stable_range(seed, -3, 3, *parts, key)
    return {key: bounded(value, 35 if key != "goalkeeping" or primary == "GK" else 2, 95) for key, value in result.items()}


def position_ratings(
    primary: str,
    positions: tuple[str, ...],
    attributes: dict[str, int],
    row: dict[str, float],
    age: int,
    seed: str,
    *parts: object,
) -> dict[str, int]:
    axes = {
        "GK": ("goalkeeping", "defensiveCover", "aerialPresence"),
        "LB": ("defensiveCover", "pace", "chanceCreation"),
        "CB": ("ballWinning", "aerialPresence", "defensiveCover"),
        "RB": ("defensiveCover", "pace", "chanceCreation"),
        "DM": ("ballWinning", "defensiveCover", "chanceCreation"),
        "CM": ("chanceCreation", "ballWinning", "leadership"),
        "AM": ("chanceCreation", "pace", "leadership"),
        "LW": ("pace", "chanceCreation", "leadership"),
        "CF": ("chanceCreation", "aerialPresence", "pace"),
        "RW": ("pace", "chanceCreation", "leadership"),
    }
    peak_age = {"GK": 29, "LB": 26, "CB": 28, "RB": 26, "DM": 27, "CM": 27, "AM": 26, "LW": 25, "CF": 26, "RW": 25}
    age_penalty = min(5, abs(age - peak_age[primary]) * 0.35)
    club_quality = club_role_quality(primary, row)
    ratings: dict[str, int] = {}
    for index, position in enumerate(positions):
        attribute_quality = statistics.mean(attributes[key] for key in axes[position])
        jitter = stable_range(seed, -3, 3, *parts, position, "rating")
        rating = 0.55 * club_quality + 0.45 * attribute_quality - age_penalty - index * 4 + jitter
        ratings[position] = calibrated_rating(rating)
    return {position: ratings[position] for position in CANONICAL_POSITIONS if position in ratings}


def prepare_manifest(england_dir: Path, players_dir: Path, seed: str) -> dict[str, Any]:
    population, profiles = player_data(players_dir)
    matches = parse_matches(england_dir / SEASON / "1-premierleague.txt")
    table = season_table(matches)
    squads = parse_squads(england_dir / SEASON / "squads")
    if set(table) != set(squads):
        missing_squads = sorted(set(table) - set(squads))
        extra_squads = sorted(set(squads) - set(table))
        raise RuntimeError(
            f"Squad/table mismatch; missing squads={missing_squads}, extra squads={extra_squads}"
        )

    all_teams: dict[str, dict[str, Any]] = {}
    players: list[dict[str, Any]] = []
    seen_identities: set[str] = set()
    next_card_number = 1

    season_end_year = 2024
    observed_height_count = 0
    unknown_birth_year_count = 0
    for club_name in sorted(table):
        club_code = slug(club_name)
        all_teams[club_code] = {
            "clubCode": club_code,
            "displayName": club_name,
            "seasonCodes": [SEASON],
        }
        row = table[club_name]
        for squad_player in squads[club_name]:
            role_label, population_position, _weighted_positions = BROAD_POSITION_CONFIG[
                squad_player.broad_position
            ]
            identity_suffix = (
                str(squad_player.birth_year) if squad_player.birth_year is not None else "unknown"
            )
            identity_key = f"{normalized_name(squad_player.display_name)}-{identity_suffix}"
            player_identity_id = f"openfootball-player:{identity_key}"
            if player_identity_id in seen_identities:
                raise RuntimeError(f"Duplicate squad identity: {player_identity_id}")
            seen_identities.add(player_identity_id)
            card_key = f"{club_code}-{SEASON}-{slug(squad_player.display_name)}-{identity_suffix}"
            primary, positions = inferred_positions(squad_player.broad_position, seed, card_key)

            sampled_age, sampled_height = modeled_physical_profile(
                population,
                population_position,
                int(SEASON[:4]),
                seed,
                card_key,
            )
            if squad_player.birth_year is None:
                age = sampled_age
                unknown_birth_year_count += 1
            else:
                age = bounded(season_end_year - squad_player.birth_year, 16, 45)
            height_cm = observed_height(profiles, squad_player, population_position)
            height_provenance = "observed-player-record"
            if height_cm is None:
                height_cm = sampled_height
                height_provenance = "modeled-position-population"
            else:
                observed_height_count += 1

            attributes = synthetic_attributes(primary, row, age, height_cm, seed, card_key)
            ratings = position_ratings(primary, positions, attributes, row, age, seed, card_key)
            players.append(
                {
                    "id": f"openfootball-{card_key}",
                    "playerIdentityId": player_identity_id,
                    "sourcePlayerId": next_card_number,
                    "displayName": squad_player.display_name,
                    "nickname": None,
                    "country": squad_player.country,
                    "clubCode": club_code,
                    "clubsObserved": [club_code],
                    "seasonCode": SEASON,
                    "eraCode": "2020s",
                    "ratingsByPosition": ratings,
                    "observedStatsBombPositions": {
                        f"OpenFootball squad {squad_player.broad_position}": 1
                    },
                    "attributes": attributes,
                    "tacticalTraits": {
                        "aerial": attributes["aerialPresence"],
                        "ballWinning": attributes["ballWinning"],
                        "creation": attributes["chanceCreation"],
                        "defensiveCover": attributes["defensiveCover"],
                        "pace": attributes["pace"],
                    },
                    "leadership": attributes["leadership"],
                    "squadSheetCount": 1,
                    "observedAppearanceCount": 0,
                    "observedStartCount": 0,
                    "modeledAge": age,
                    "modeledHeightCm": height_cm,
                    "roleLabel": role_label,
                    "sourceSquadNumber": squad_player.squad_number,
                    "sourceBirthYear": squad_player.birth_year,
                    "sourceBroadPosition": squad_player.broad_position,
                    "physicalProfileProvenance": height_provenance,
                    "modelEvidence": {
                        "kind": "club-season-results",
                        "matches": int(row["matches"]),
                        "points": int(row["points"]),
                        "goalsFor": int(row["goalsFor"]),
                        "goalsAgainst": int(row["goalsAgainst"]),
                        "cleanSheets": int(row["cleanSheets"]),
                        "secondHalfGoalDifference": int(row["secondHalfGoalDifference"]),
                    },
                    "dataVersion": CONTENT_VERSION,
                    "ratingProvenance": {
                        "kind": "synthetic",
                        "generatorVersion": GENERATOR_VERSION,
                        "seed": seed,
                        "officialRating": False,
                    },
                }
            )
            next_card_number += 1

    players.sort(key=lambda player: player["id"])
    teams = sorted(all_teams.values(), key=lambda team: team["clubCode"])
    for source_team_id, team in enumerate(teams, start=1):
        team["sourceTeamId"] = source_team_id
    coverage = {
        position: sum(position in player["ratingsByPosition"] for player in players)
        for position in CANONICAL_POSITIONS
    }
    content_hash = hashlib.sha256(
        json.dumps(players, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schemaVersion": "football11-player-catalogue-v1",
        "contentVersion": CONTENT_VERSION,
        "source": {
            "provider": "OpenFootball",
            "repository": ENGLAND_REPOSITORY,
            "revision": ENGLAND_REVISION,
            "competitionId": 1,
            "competitionName": "English Premier League",
            "countryName": "England",
            "seasonId": 20232024,
            "seasonName": "2023/24",
            "matchCount": 380,
            "attribution": (
                "Source: OpenFootball England 2023/24 match and squad data plus OpenFootball Players profiles, "
                "dedicated to the public domain under CC0/public-domain terms."
            ),
            "usageNotice": (
                "Player names, club squads, shirt numbers, broad positions, and available birth years come from "
                "OpenFootball. Fine-grained formation positions, missing physical facts, ratings, and attributes "
                "are deterministic gameplay models, not official player assessments."
            ),
            "secondaryRepository": PLAYERS_REPOSITORY,
            "secondaryRevision": PLAYERS_REVISION,
            "seasons": [{"seasonCode": SEASON, "teamCount": 20, "matchCount": 380}],
        },
        "syntheticData": {
            "generatorVersion": GENERATOR_VERSION,
            "seed": seed,
            "disclaimer": (
                "Cards use observed 2023/24 squad identities and broad positions. Exact formation eligibility, "
                "ratings, attributes, and missing physical details are deterministic gameplay models. Appearance "
                "and start counts are unavailable and remain zero; no rating is official."
            ),
        },
        "summary": {
            "teamCount": len(teams),
            "playerCount": len(players),
            "excludedPlayersWithoutObservedPosition": 0,
            "positionCoverage": coverage,
            "playersSha256": content_hash,
            "seasonCount": 1,
            "matchCount": 380,
            "observedHeightCount": observed_height_count,
            "modeledHeightCount": len(players) - observed_height_count,
            "unknownBirthYearCount": unknown_birth_year_count,
        },
        "teams": teams,
        "playerSeasons": players,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--england-dir", type=Path, default=ROOT / ".cache/openfootball-england"
    )
    parser.add_argument(
        "--players-dir", type=Path, default=ROOT / ".cache/openfootball-players"
    )
    parser.add_argument("--seed", default=DEFAULT_SEED)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "data/content/openfootball-pl-2023-24-named-squads-v2.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = prepare_manifest(args.england_dir, args.players_dir, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = manifest["summary"]
    print(f"Wrote {args.output}")
    print(f"Seasons: {summary['seasonCount']}")
    print(f"Matches: {summary['matchCount']}")
    print(f"Clubs: {summary['teamCount']}")
    print(f"Named squad cards: {summary['playerCount']}")
    print(f"Observed heights: {summary['observedHeightCount']}")
    print(f"Modeled heights: {summary['modeledHeightCount']}")
    print(f"Unknown birth years: {summary['unknownBirthYearCount']}")
    print(f"Position coverage: {json.dumps(summary['positionCoverage'], sort_keys=True)}")
    print(f"Players SHA-256: {summary['playersSha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
