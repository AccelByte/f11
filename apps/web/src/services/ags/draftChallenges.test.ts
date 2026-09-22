import { describe, expect, it, vi } from 'vitest';

import { requestDraftChallenge } from './draftChallenges';

describe('draft challenge client', () => {
  it('sends a numeric-schema authenticated request and returns the frozen configuration', async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        data: {
          schemaVersion: 1,
          challenge: {
            schemaVersion: 1,
            kind: 'solo',
            challengeId: 'challenge-1',
            seed: 'seed-1',
            versions: {},
            draftConfig: {
              schemaVersion: 1,
              revision: '1',
              maxOfferedPlayers: 15,
              maxRerolls: 5,
            },
            issuedAt: '2026-09-04T00:00:00.000Z',
          },
        },
      }),
    );

    await expect(
      requestDraftChallenge('player-token', { idempotencyKey: 'solo-key-0001' }, request),
    ).resolves.toMatchObject({ draftConfig: { schemaVersion: 1, maxRerolls: 5 } });
    expect(request).toHaveBeenCalledWith('/api/draft-challenges', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer player-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, idempotencyKey: 'solo-key-0001' }),
    });
  });

  it('surfaces a safe retryable service error', async () => {
    await expect(
      requestDraftChallenge('player-token', {}, async () =>
        Response.json(
          {
            ok: false,
            error: {
              code: 'DRAFT_CONFIG_UNAVAILABLE',
              message: 'Draft settings are temporarily unavailable. Try again.',
              details: {},
            },
          },
          { status: 503 },
        ),
      ),
    ).rejects.toThrow('temporarily unavailable');
  });
});
