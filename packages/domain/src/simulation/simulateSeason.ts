import { createDerivedRandomSource } from '../random/seed.js';
import type { MatchResult, SeasonResult, TeamUnitRatings } from '../types.js';

export interface OpponentProfile extends TeamUnitRatings {
  id: string;
}

export interface LeagueProfile {
  version: 'league-profile-v1';
  opponents: OpponentProfile[];
  schedule: { matchesPerOpponent: 2; homeVenueBias: number; awayVenueBias: number };
  outcomeModel: { deltaScale: number; drawBase: number; drawDeltaScale: number };
}

export interface OutcomeProbabilities {
  delta: number;
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
}

export function calculateOutcomeProbabilities(
  team: TeamUnitRatings,
  opponent: TeamUnitRatings,
  venueBias: number,
  model: LeagueProfile['outcomeModel'],
): OutcomeProbabilities {
  const delta =
    0.45 * (team.attack - opponent.defence) +
    0.4 * (team.defence - opponent.attack) +
    0.15 * (team.control - opponent.control) +
    venueBias;
  const winWeight = Math.exp(delta / model.deltaScale);
  const lossWeight = Math.exp(-delta / model.deltaScale);
  const drawWeight = Math.exp(model.drawBase - Math.abs(delta) / model.drawDeltaScale);
  const total = winWeight + drawWeight + lossWeight;
  return {
    delta,
    winProbability: winWeight / total,
    drawProbability: drawWeight / total,
    lossProbability: lossWeight / total,
  };
}

export function seasonLabel(wins: number, losses: number): SeasonResult['label'] {
  return wins === 38 ? 'Perfect' : losses === 0 ? 'Invincible' : null;
}

export function simulateSeason(
  team: TeamUnitRatings,
  league: LeagueProfile,
  seed: string,
  rosterChecksum: string,
): SeasonResult {
  const matches: MatchResult[] = [];
  for (const opponent of league.opponents) {
    for (const venue of ['home', 'away'] as const) {
      const index = matches.length;
      const venueBias =
        venue === 'home' ? league.schedule.homeVenueBias : league.schedule.awayVenueBias;
      const probabilities = calculateOutcomeProbabilities(
        team,
        opponent,
        venueBias,
        league.outcomeModel,
      );
      const roll = createDerivedRandomSource(
        seed,
        rosterChecksum,
        'season',
        index,
        'match',
      ).nextFloat();
      const outcome =
        roll < probabilities.winProbability
          ? 'win'
          : roll < probabilities.winProbability + probabilities.drawProbability
            ? 'draw'
            : 'loss';
      matches.push({
        index,
        opponentId: opponent.id,
        venue,
        outcome,
        points: outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0,
      });
    }
  }
  const wins = matches.filter((match) => match.outcome === 'win').length;
  const draws = matches.filter((match) => match.outcome === 'draw').length;
  const losses = matches.filter((match) => match.outcome === 'loss').length;
  return {
    wins,
    draws,
    losses,
    points: wins * 3 + draws,
    label: seasonLabel(wins, losses),
    matches,
  };
}
