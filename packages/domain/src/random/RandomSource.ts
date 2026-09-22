export interface RandomSource {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  shuffle<T>(values: readonly T[]): T[];
}
