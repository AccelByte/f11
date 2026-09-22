import { describe, expect, it } from 'vitest';
import { apiUrl } from './apiUrl';

describe('game API addressing', () => {
  it('keeps Sites requests relative and Pages requests on the backend', () => {
    expect(apiUrl('/api/draft-challenges', '')).toBe('/api/draft-challenges');
    expect(apiUrl('/api/saved-xi', 'https://backend.example/')).toBe(
      'https://backend.example/api/saved-xi',
    );
  });
  it('rejects origins that could leak bearer tokens through credentials or URL parameters', () => {
    for (const origin of [
      'http://backend.example',
      'https://user@backend.example',
      'https://backend.example/path',
      'https://backend.example?token=1',
    ]) {
      expect(() => apiUrl('/api/saved-xi', origin)).toThrow();
    }
  });
});
