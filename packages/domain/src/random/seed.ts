import type { RandomSource } from './RandomSource.js';
import { sfc32 } from './sfc32.js';
import { xmur3 } from './xmur3.js';

export type SeedPart = boolean | number | string;

export function canonicalSeed(parts: readonly SeedPart[]): string {
  return JSON.stringify(['rng-v1', ...parts]);
}

export function createRandomSource(seed: string): RandomSource {
  const seedFactory = xmur3(seed);
  return sfc32(seedFactory(), seedFactory(), seedFactory(), seedFactory());
}

export function deriveSeed(baseSeed: string, ...parts: readonly SeedPart[]): string {
  return canonicalSeed([baseSeed, ...parts]);
}

export function createDerivedRandomSource(
  baseSeed: string,
  ...parts: readonly SeedPart[]
): RandomSource {
  return createRandomSource(deriveSeed(baseSeed, ...parts));
}
