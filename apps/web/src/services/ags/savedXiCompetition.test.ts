import { describe, expect, it, vi } from 'vitest';

import {
  CompetitionClientError,
  findNearbySavedXiOpponent,
  loadSavedXiCompetition,
  resolveSavedXiMatch,
} from './savedXiCompetition';

describe('Saved-XI competition browser client', () => {
  it('loads a strictly validated empty competition status', async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        ok: true,
        data: { savedXi: null, challengeScore: 0, activeChallenge: null, history: [] },
      }),
    );
    await expect(loadSavedXiCompetition('player-token', request)).resolves.toEqual({
      savedXi: null,
      challengeScore: 0,
      activeChallenge: null,
      history: [],
    });
    const [, init] = request.mock.calls[0] ?? [];
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer player-token');
  });

  it('rejects a match response that leaks private evidence', async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        data: {
          duplicate: false,
          match: {
            matchId: 'match-1',
            challengerXiId: 'xi-1',
            opponentXiId: 'xi-2',
            opponentLabel: 'Player 1234',
            opponentRank: 2,
            result: {
              outcome: 'win',
              challengeScoreDelta: 3,
              probabilities: { winProbability: 0.5, drawProbability: 0.2, lossProbability: 0.3 },
              evidence: { matchSeed: 'must-not-leak' },
            },
            scoreBefore: 0,
            scoreAfter: 3,
            settlementStatus: 'settled',
            createdAt: '2026-09-04T00:00:00.000Z',
            settledAt: '2026-09-04T00:00:00.000Z',
          },
        },
      }),
    );
    await expect(resolveSavedXiMatch('challenge-token', 'player-token', request)).rejects.toThrow(
      'unreadable response',
    );
  });

  it('preserves stable service error codes for state-specific UI', async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: false,
        error: { code: 'NO_COMPATIBLE_OPPONENT', message: 'No nearby XI.', details: {} },
      }),
    );
    await expect(findNearbySavedXiOpponent('player-token', request)).rejects.toEqual(
      new CompetitionClientError('NO_COMPATIBLE_OPPONENT', 'No nearby XI.'),
    );
  });
});
