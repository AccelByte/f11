import { describe, expect, it, vi } from 'vitest';
import { apiPreflight, withApiCors } from './apiCors';

const legacyOrigin = 'https://damarindraab.github.io';
const url = 'https://backend.example/api/saved-xi';

describe('Pages API CORS', () => {
  it.each(['https://damarindraab.github.io', 'https://accelbyte.github.io'])(
    'allows bearer-token preflight from %s without cookies',
    (origin) => {
      const response = apiPreflight(
        new Request(url, {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'authorization,content-type',
          },
        }),
        ['GET', 'PUT'],
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    },
  );
  it('rejects unapproved origins, methods, and headers', async () => {
    const cases: Record<string, string>[] = [
      { Origin: 'https://evil.example' },
      { Origin: legacyOrigin, 'Access-Control-Request-Method': 'DELETE' },
      { Origin: legacyOrigin, 'Access-Control-Request-Headers': 'x-secret' },
    ];
    for (const headers of cases)
      expect(apiPreflight(new Request(url, { headers }), ['GET', 'PUT']).status).toBe(403);
    const handler = vi.fn();
    expect(
      (
        await withApiCors(handler)(
          new Request(url, { headers: { Origin: 'https://evil.example' } }),
        )
      ).status,
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it.each(['https://damarindraab.github.io', 'https://accelbyte.github.io'])(
    'preserves auth errors for %s and keeps same-origin clients working',
    async (origin) => {
      const handler = withApiCors(async () => Response.json({ ok: false }, { status: 401 }));
      const response = await handler(new Request(url, { headers: { Origin: origin } }));
      expect(response.status).toBe(401);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(await response.json()).toEqual({ ok: false });
      expect((await handler(new Request(url))).status).toBe(401);
      expect(
        (await handler(new Request(url, { headers: { Origin: 'https://backend.example' } })))
          .status,
      ).toBe(401);
    },
  );
});
