// Origins have no path: GitHub Pages serves this game beneath /f11/.
const pagesOrigins = new Set(['https://damarindraab.github.io', 'https://accelbyte.github.io']);
type Handler = (request: Request) => Promise<Response>;

function isAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin || pagesOrigins.has(origin);
}

function headers(request: Request): Headers {
  const result = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' });
  const origin = request.headers.get('Origin');
  if (origin && pagesOrigins.has(origin)) {
    result.set('Access-Control-Allow-Origin', origin);
  }
  return result;
}

export function apiPreflight(request: Request, methods: string[]): Response {
  const requestedMethod = request.headers.get('Access-Control-Request-Method');
  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (
    !isAllowed(request) ||
    (requestedMethod && !methods.includes(requestedMethod)) ||
    requestedHeaders.some((value) => !['authorization', 'content-type'].includes(value))
  ) {
    return new Response(null, {
      status: 403,
      headers: { Vary: 'Origin', 'Cache-Control': 'no-store' },
    });
  }
  const result = headers(request);
  result.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  result.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  result.set('Access-Control-Max-Age', '600');
  return new Response(null, { status: 204, headers: result });
}

/** Keep bearer-token authorization inside each handler; CORS is not authentication. */
export function withApiCors(handler: Handler): Handler {
  return async (request) => {
    if (!isAllowed(request)) {
      return Response.json(
        {
          ok: false,
          error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed.', details: {} },
        },
        { status: 403, headers: { Vary: 'Origin', 'Cache-Control': 'no-store' } },
      );
    }
    const response = await handler(request);
    const result = new Response(response.body, response);
    for (const [name, value] of headers(request)) {
      if (name === 'vary' && result.headers.has(name)) result.headers.append(name, value);
      else result.headers.set(name, value);
    }
    return result;
  };
}
