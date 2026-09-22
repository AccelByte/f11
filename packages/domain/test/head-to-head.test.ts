import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  applyChallengeScore,
  calculateHeadToHeadProbabilities,
  simulateHeadToHead,
  type HeadToHeadParticipant,
  type HeadToHeadProfile,
} from '../src/index.js';

const configuredProfile: unknown = JSON.parse(
  readFileSync(new URL('../../../data/config/head-to-head-v1.json', import.meta.url), 'utf8'),
);
const profile = {
  schemaVersion: 'football11-head-to-head-profile-v1',
  version: 'head-to-head-v1',
  weights: { attackDefenceDuel: 0.425, control: 0.15 },
  outcomeModel: { deltaScale: 12, drawBase: -0.35, drawDeltaScale: 18 },
  challengeScore: { initial: 0, minimum: 0, win: 3, draw: 0, loss: -2 },
} as const satisfies HeadToHeadProfile & { schemaVersion: string };
const alpha: HeadToHeadParticipant = {
  savedXiId: 'saved-xi-alpha',
  units: { attack: 82, defence: 76, control: 80 },
};
const bravo: HeadToHeadParticipant = {
  savedXiId: 'saved-xi-bravo',
  units: { attack: 77, defence: 81, control: 75 },
};

describe('head-to-head-v1', () => {
  it('ships the approved versioned profile', () => {
    expect(configuredProfile).toEqual(profile);
  });

  it('keeps probability vectors symmetric when the XIs are reversed', () => {
    const forward = calculateHeadToHeadProbabilities(alpha.units, bravo.units, profile);
    const reverse = calculateHeadToHeadProbabilities(bravo.units, alpha.units, profile);

    expect(forward.delta).toBeCloseTo(-reverse.delta, 12);
    expect(forward.winProbability).toBeCloseTo(reverse.lossProbability, 12);
    expect(forward.drawProbability).toBeCloseTo(reverse.drawProbability, 12);
    expect(forward.lossProbability).toBeCloseTo(reverse.winProbability, 12);
    expect(forward.winProbability + forward.drawProbability + forward.lossProbability).toBeCloseTo(
      1,
      12,
    );
  });

  it('reproduces one golden match and preserves it when participant roles reverse', () => {
    const forward = simulateHeadToHead(alpha, bravo, profile, 'head-to-head-golden-v1');
    const replay = simulateHeadToHead(alpha, bravo, profile, 'head-to-head-golden-v1');
    const reverse = simulateHeadToHead(bravo, alpha, profile, 'head-to-head-golden-v1');

    expect(replay).toEqual(forward);
    expect(forward.evidence.canonicalSavedXiIds).toEqual(['saved-xi-alpha', 'saved-xi-bravo']);
    expect(forward.probabilities.delta).toBeCloseTo(0.75, 12);
    expect(forward.evidence.canonicalRoll).toBeCloseTo(0.1282684134785086, 12);
    expect(forward.outcome).toBe('win');
    expect(forward.challengeScoreDelta).toBe(3);
    expect(reverse.outcome).toBe('loss');
    expect(reverse.challengeScoreDelta).toBe(-2);
    expect(reverse.evidence).toEqual(forward.evidence);
  });

  it('applies the approved +3/0/-2 Challenge Score with a zero floor', () => {
    expect(applyChallengeScore(0, 'win', profile)).toBe(3);
    expect(applyChallengeScore(8, 'draw', profile)).toBe(8);
    expect(applyChallengeScore(8, 'loss', profile)).toBe(6);
    expect(applyChallengeScore(1, 'loss', profile)).toBe(0);
    expect(applyChallengeScore(0, 'loss', profile)).toBe(0);
  });

  it('rejects self-challenges and profiles that break symmetric weighting', () => {
    expect(() => simulateHeadToHead(alpha, alpha, profile, 'self-match')).toThrow(
      'A Saved XI cannot challenge itself.',
    );
    expect(() =>
      calculateHeadToHeadProbabilities(alpha.units, bravo.units, {
        ...profile,
        weights: { attackDefenceDuel: 0.4, control: 0.15 },
      }),
    ).toThrow('Head-to-head weights must be non-negative and total one symmetrically.');
  });

  it('tracks the configured probability distribution across deterministic seeds', () => {
    const equalLeft: HeadToHeadParticipant = {
      savedXiId: 'saved-xi-equal-left',
      units: { attack: 75, defence: 75, control: 75 },
    };
    const equalRight: HeadToHeadParticipant = {
      savedXiId: 'saved-xi-equal-right',
      units: { attack: 75, defence: 75, control: 75 },
    };
    const expected = calculateHeadToHeadProbabilities(equalLeft.units, equalRight.units, profile);
    const counts = { win: 0, draw: 0, loss: 0 };
    const samples = 10_000;

    for (let index = 0; index < samples; index += 1) {
      counts[simulateHeadToHead(equalLeft, equalRight, profile, `distribution-${index}`).outcome] +=
        1;
    }

    expect(counts.win / samples).toBeCloseTo(expected.winProbability, 1);
    expect(counts.draw / samples).toBeCloseTo(expected.drawProbability, 1);
    expect(counts.loss / samples).toBeCloseTo(expected.lossProbability, 1);
    expect(Math.abs(counts.win - counts.loss) / samples).toBeLessThan(0.02);
  });
});
