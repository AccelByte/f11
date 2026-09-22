import type { RandomSource } from './RandomSource.js';

const UINT32_RANGE = 0x1_0000_0000;

export function sfc32(seedA: number, seedB: number, seedC: number, seedD: number): RandomSource {
  let a = seedA >>> 0;
  let b = seedB >>> 0;
  let c = seedC >>> 0;
  let d = seedD >>> 0;

  const nextUint32 = (): number => {
    const sum = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (sum + d) | 0;
    c = (c + result) | 0;
    return result >>> 0;
  };

  return {
    nextUint32,
    nextFloat(): number {
      return nextUint32() / UINT32_RANGE;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
        throw new RangeError('maxExclusive must be a positive safe integer no greater than 2^32');
      }

      const unbiasedLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
      let sample = nextUint32();
      while (sample >= unbiasedLimit) {
        sample = nextUint32();
      }
      return sample % maxExclusive;
    },
    shuffle<T>(values: readonly T[]): T[] {
      const shuffled = [...values];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = this.nextInt(index + 1);
        const currentValue = shuffled[index];
        const targetValue = shuffled[target];
        if (currentValue === undefined || targetValue === undefined) {
          throw new RangeError('shuffle index escaped the array bounds');
        }
        shuffled[index] = targetValue;
        shuffled[target] = currentValue;
      }
      return shuffled;
    },
  };
}
