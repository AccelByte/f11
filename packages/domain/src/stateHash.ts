import { xmur3 } from './random/xmur3.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stateHash(value: unknown): string {
  const factory = xmur3(JSON.stringify(canonicalize(value)));
  return Array.from({ length: 4 }, () => factory().toString(16).padStart(8, '0')).join('');
}
