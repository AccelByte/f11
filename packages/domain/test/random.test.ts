import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalSeed,
  createDerivedRandomSource,
  createRandomSource,
  sfc32,
  xmur3,
} from '../src/index.js';

function collectUint32(next: () => number, count: number): number[] {
  return Array.from({ length: count }, next);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('rng-v1 golden vectors', () => {
  it.each([
    ['', [167010153, 2610615433, 1495386444, 1351578270]],
    ['football-11', [3111784052, 377845995, 840451745, 3012928116]],
    ['hello', [3588693721, 2540863134, 1947501763, 816861027]],
  ] as const)('pins xmur3(%j)', (seed, expected) => {
    const hash = xmur3(seed);
    expect(collectUint32(hash, 4)).toEqual(expected);
  });

  it('pins the raw sfc32 state transition', () => {
    const random = sfc32(1, 2, 3, 4);
    expect(collectUint32(() => random.nextUint32(), 10)).toEqual([
      8, 35, 56623210, 207756683, 3469086937, 2920252771, 1846779140, 1194183609, 2103805335,
      3546956693,
    ]);
  });

  it('pins the complete string-seeded generator', () => {
    const random = createRandomSource('football-11-golden-v1');
    expect(collectUint32(() => random.nextUint32(), 10)).toEqual([
      660369888, 1123371665, 4150392181, 2042692745, 2340861369, 102804249, 2062379310, 1706624546,
      2603382273, 2275351696,
    ]);
  });

  it('pins canonical derived stream separation', () => {
    expect(canonicalSeed(['base', 'offer', 3, 1])).toBe('["rng-v1","base","offer",3,1]');
    const first = createDerivedRandomSource('base', 'offer', 3, 1);
    const replay = createDerivedRandomSource('base', 'offer', 3, 1);
    const otherPurpose = createDerivedRandomSource('base', 'constraint', 3, 1);
    const expected = [
      2222479828, 1767087290, 3285053919, 4259678185, 1324912774, 441324032, 988738930, 1671843548,
    ];

    expect(collectUint32(() => first.nextUint32(), 8)).toEqual(expected);
    expect(collectUint32(() => replay.nextUint32(), 8)).toEqual(expected);
    expect(collectUint32(() => otherPurpose.nextUint32(), 8)).not.toEqual(expected);
  });
});

describe('RandomSource operations', () => {
  it('returns floats and bounded integers inside their contracts', () => {
    const floats = createRandomSource('float-bounds-v1');
    const integers = createRandomSource('bounded-v1');

    expect(
      Array.from({ length: 1_000 }, () => floats.nextFloat()).every((x) => x >= 0 && x < 1),
    ).toBe(true);
    expect(
      Array.from({ length: 1_000 }, () => integers.nextInt(7)).every((x) => x >= 0 && x < 7),
    ).toBe(true);
    expect(() => integers.nextInt(0)).toThrow(RangeError);
    expect(() => integers.nextInt(1.5)).toThrow(RangeError);
  });

  it('shuffles a copy deterministically without changing the input', () => {
    const original = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(createRandomSource('shuffle-v1').shuffle(original)).toEqual([
      'c',
      'a',
      'e',
      'b',
      'f',
      'd',
    ]);
    expect(original).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('contains no direct nondeterministic random call in domain source', () => {
    const forbiddenCall = ['Math', 'random'].join('.') + '(';
    const violations = sourceFiles(join(import.meta.dirname, '..', 'src')).filter((path) =>
      readFileSync(path, 'utf8').includes(forbiddenCall),
    );
    expect(violations).toEqual([]);
  });
});
