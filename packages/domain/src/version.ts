import type { MechanicsVersion } from './types.js';

export const DEFAULT_MECHANICS_VERSION = {
  contentVersion: 'openfootball-premier-league-2023-24-named-squads-v2',
  rulesVersion: 'rules-v2',
  rngVersion: 'rng-v1',
  offerVersion: 'offer-v1',
  assessmentVersion: 'assessment-v1',
  seasonVersion: 'season-v1',
  explanationVersion: 'explanation-v1',
} as const satisfies MechanicsVersion;
