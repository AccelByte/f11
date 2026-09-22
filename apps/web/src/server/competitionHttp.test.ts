import { describe, expect, it } from 'vitest';

import {
  COMPETITION_REQUEST_MAX_BYTES,
  bearerToken,
  competitionResponse,
  readJsonBody,
} from './competitionHttp';
import { TrustedReplayError } from './trustedReplay';

describe('competition HTTP boundary', () => {
  it('accepts only a strict bearer token', () => {
    expect(
      bearerToken(new Request('https://game.test', { headers: { authorization: 'Bearer abc' } })),
    ).toBe('abc');
    expect(
      bearerToken(new Request('https://game.test', { headers: { authorization: 'Basic abc' } })),
    ).toBe('');
  });

  it('rejects non-JSON, malformed, and oversized bodies', async () => {
    await expect(
      readJsonBody(new Request('https://game.test', { method: 'POST', body: 'x' })),
    ).rejects.toMatchObject({ status: 415, code: 'JSON_REQUIRED' });
    await expect(
      readJsonBody(
        new Request('https://game.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_JSON' });
    await expect(
      readJsonBody(
        new Request('https://game.test', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(COMPETITION_REQUEST_MAX_BYTES + 1),
          },
          body: '{}',
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: 'REQUEST_TOO_LARGE' });
  });

  it('returns stable success and error envelopes with defensive headers', async () => {
    const success = await competitionResponse(async () => ({ value: 7 }));
    expect(await success.json()).toEqual({ ok: true, data: { value: 7 } });
    expect(success.headers.get('cache-control')).toBe('no-store');
    expect(success.headers.get('x-content-type-options')).toBe('nosniff');

    const failure = await competitionResponse(async () => {
      throw new TrustedReplayError(409, 'NO_SAVED_XI', 'Publish first.');
    });
    expect(failure.status).toBe(409);
    expect(await failure.json()).toEqual({
      ok: false,
      error: { code: 'NO_SAVED_XI', message: 'Publish first.', details: {} },
    });
  });
});
