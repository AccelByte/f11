import { describe, expect, it, vi } from 'vitest';

import { createGameSession, selectPlayer } from '../../game/session';
import { soloDraftChallenge } from '../../test/draftChallenge';
import { createLocalRunRecord } from '../local/runStore';
import { submitTrustedRun, type TrustedRankingRequest } from './trustedRanking';

function completedRecord() {
  let session = createGameSession(soloDraftChallenge('trusted-ranking-client-test'));
  while (!session.resolved) {
    const card = session.snapshot.offer?.cards[0];
    const slot = card?.safeSlotCodes[0];
    if (!card || !slot) throw new Error('Expected a legal draft choice.');
    session = selectPlayer(session, card.playerSeasonId, slot);
  }
  return createLocalRunRecord('user-1', session, '2026-09-03T00:00:00.000Z');
}

describe('trusted ranking client', () => {
  it('submits only replay evidence with the player bearer token', async () => {
    const record = completedRecord();
    const request = vi.fn<TrustedRankingRequest>(async () =>
      Response.json({
        ok: true,
        data: {
          result: record.result,
          receipt: {
            schemaVersion: 'football11-trusted-receipt-v1',
            runId: record.runId,
            resultId: record.result.resultId,
            resultHash: 'result-hash',
            finalStateHash: record.result.finalStateHash,
            points: record.result.season.points,
            verifiedAt: '2026-09-03T00:00:01.000Z',
          },
          duplicate: false,
          leaderboard: {
            status: 'ranked',
            bestPoints: record.result.season.points,
            rank: 1,
            entries: [],
          },
        },
      }),
    );

    await expect(submitTrustedRun(record, 'player-token', request)).resolves.toMatchObject({
      duplicate: false,
    });
    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe('/api/runs/submit');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer player-token',
      'Content-Type': 'application/json',
    });
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(init.body);
    expect(Object.keys(body).toSorted()).toEqual(
      [
        'actions',
        'challengeId',
        'draftConfig',
        'runId',
        'schemaVersion',
        'seed',
        'versions',
      ].toSorted(),
    );
    expect(body).not.toHaveProperty('result');
    expect(body).not.toHaveProperty('localProfileId');
  });

  it('includes AGS session context for a friend-room replay', async () => {
    const record = {
      ...completedRecord(),
      roomSessionId: 'session-1',
    };
    const request = vi.fn<TrustedRankingRequest>(async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON replay evidence.');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.roomSessionId).toBe('session-1');
      return Response.json({
        ok: true,
        data: {
          result: record.result,
          receipt: {
            schemaVersion: 'football11-trusted-receipt-v1',
            runId: record.runId,
            resultId: record.runId,
            resultHash: 'hash',
            finalStateHash: record.result.finalStateHash,
            points: record.result.season.points,
            verifiedAt: '2026-09-04T00:00:00.000Z',
          },
          duplicate: false,
          leaderboard: { status: 'ranked', bestPoints: 1, rank: 1, entries: [] },
        },
      });
    });

    await submitTrustedRun(record, 'player-token', request);
    expect(request).toHaveBeenCalledOnce();
  });

  it('surfaces a sanitized trusted-service error', async () => {
    const record = completedRecord();
    const request = vi.fn<TrustedRankingRequest>(async () =>
      Response.json(
        { ok: false, error: { code: 'REPLAY_REJECTED', message: 'Replay rejected.', details: {} } },
        { status: 400 },
      ),
    );

    await expect(submitTrustedRun(record, 'player-token', request)).rejects.toThrow(
      'Replay rejected.',
    );
  });

  it('fails closed on an unreadable response or missing session', async () => {
    const record = completedRecord();
    await expect(submitTrustedRun(record, '')).rejects.toThrow('Sign in again');
    await expect(
      submitTrustedRun(record, 'player-token', async () => Response.json({ unexpected: true })),
    ).rejects.toThrow('unreadable response');
  });
});
