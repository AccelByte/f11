/** Empty origin preserves the all-in-one Sites deployment. */
export function apiUrl(path: string, origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? ''): string {
  if (!path.startsWith('/api/')) throw new Error('Expected a game API path.');
  if (!origin) return path;
  const url = new URL(origin);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('The game API origin must be an HTTPS origin.');
  }
  return `${url.origin}${path}`;
}
