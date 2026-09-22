export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const POSITION_CODES = ['GK', 'LB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'CF', 'RW'] as const;
export type PositionCode = (typeof POSITION_CODES)[number];

export const SLOT_CODES = [
  'GK',
  'LB',
  'LCB',
  'RCB',
  'RB',
  'DM',
  'CM',
  'AM',
  'LW',
  'CF',
  'RW',
] as const;
export type SlotCode = (typeof SLOT_CODES)[number];

export type FormationId = '4-3-3-v1';
export type RngVersion = 'rng-v1';
export type OfferVersion = 'offer-v1';
export type AssessmentVersion = 'assessment-v1';
export type SeasonVersion = 'season-v1';
export type ExplanationVersion = 'explanation-v1';

export interface MechanicsVersion {
  contentVersion: string;
  rulesVersion: string;
  rngVersion: RngVersion;
  offerVersion: OfferVersion;
  assessmentVersion: AssessmentVersion;
  seasonVersion: SeasonVersion;
  explanationVersion: ExplanationVersion;
}

export interface FormationSlot {
  id: SlotCode;
  position: PositionCode;
}

export interface Formation {
  id: FormationId;
  slots: FormationSlot[];
}

export interface PlayerAttributes {
  aerialPresence: number;
  ballWinning: number;
  chanceCreation: number;
  defensiveCover: number;
  goalkeeping: number;
  leadership: number;
  pace: number;
}

export interface RatingProvenance {
  kind: 'synthetic';
  generatorVersion: string;
  seed: string;
  officialRating: false;
}

export interface PlayerSeason {
  id: string;
  playerIdentityId: string;
  sourcePlayerId: number;
  displayName: string;
  nickname: string | null;
  country: string | null;
  clubCode: string;
  clubsObserved: string[];
  seasonCode: string;
  eraCode: string;
  ratingsByPosition: Partial<Record<PositionCode, number>>;
  /** Legacy v1 name; values are provider-specific observed positions or roles. */
  observedStatsBombPositions: Record<string, number>;
  attributes: PlayerAttributes;
  tacticalTraits: Record<string, number>;
  leadership: number;
  squadSheetCount: number;
  observedAppearanceCount: number;
  observedStartCount: number;
  /** Gameplay age, observed from birth year when available or otherwise modeled. */
  modeledAge?: number;
  /** Gameplay height, matched from player data when available or otherwise modeled. */
  modeledHeightCm?: number;
  roleLabel?: string;
  sourceSquadNumber?: number;
  sourceBirthYear?: number | null;
  sourceBroadPosition?: 'GK' | 'DF' | 'MF' | 'FW';
  physicalProfileProvenance?: 'observed-player-record' | 'modeled-position-population';
  modelEvidence?: {
    kind: 'club-season-results';
    matches: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    cleanSheets: number;
    secondHalfGoalDifference: number;
  };
  dataVersion: string;
  ratingProvenance: RatingProvenance;
}

export interface CatalogueTeam {
  sourceTeamId: number;
  clubCode: string;
  displayName: string;
  seasonCodes?: string[];
}

export interface CatalogueSource {
  provider: string;
  repository: string;
  revision: string;
  competitionId: number;
  competitionName: string;
  countryName: string;
  seasonId: number;
  seasonName: string;
  matchCount: number;
  attribution: string;
  usageNotice: string;
  secondaryRepository?: string;
  secondaryRevision?: string;
  seasons?: Array<{ seasonCode: string; teamCount: number; matchCount: number }>;
}

export interface SyntheticDataProvenance {
  generatorVersion: string;
  seed: string;
  disclaimer: string;
}

export interface CatalogueSummary {
  teamCount: number;
  playerCount: number;
  excludedPlayersWithoutObservedPosition: number;
  positionCoverage: Record<PositionCode, number>;
  playersSha256: string;
  seasonCount?: number;
  matchCount?: number;
  cardsPerClubSeason?: number;
  observedHeightCount?: number;
  modeledHeightCount?: number;
  unknownBirthYearCount?: number;
}

export interface PlayerCatalogue {
  schemaVersion: 'football11-player-catalogue-v1';
  contentVersion: string;
  source: CatalogueSource;
  syntheticData: SyntheticDataProvenance;
  summary: CatalogueSummary;
  teams: CatalogueTeam[];
  playerSeasons: PlayerSeason[];
}

export interface ConstraintRef {
  key: string;
  clubCode: string;
  eraCode: string;
}

export interface RosterAssignment {
  slotId: SlotCode;
  position: PositionCode;
  playerSeasonId: string;
}

export type DraftAction =
  | { type: 'select'; round: number; playerSeasonId: string; slotCode: SlotCode }
  | { type: 'reroll'; round: number };

export interface DraftOfferCard {
  playerSeasonId: string;
  playerIdentityId: string;
  safeSlotCodes: SlotCode[];
  ratingsBySlot: Partial<Record<SlotCode, number>>;
}

export interface DraftOffer {
  round: number;
  rerollOrdinal: number;
  constraint: ConstraintRef;
  cards: DraftOfferCard[];
  rerollAvailable: boolean;
  rerollUnavailableReason: string | null;
  diagnostics: string[];
}

export interface DraftState {
  challengeId: string;
  seed: string;
  formationId: FormationId;
  round: number;
  roster: Partial<Record<SlotCode, string>>;
  selectedIdentityIds: string[];
  maxOfferedPlayers: number;
  rerollsRemaining: number;
  rerollOrdinal: number;
  currentConstraint: ConstraintRef | null;
  currentOfferIds: string[];
  rejectedOfferIdsByRound: Record<string, string[]>;
  cooldownUntilRoundByPlayerSeasonId: Record<string, number>;
  versions: MechanicsVersion;
  stateHash: string;
}

export interface CategoryScores {
  quality: number;
  positioning: number;
  chemistry: number;
  tacticalBalance: number;
  leadership: number;
}

export interface TacticalAxisResult {
  supply: number;
  score: number;
}

export interface TeamUnitRatings {
  attack: number;
  defence: number;
  control: number;
}

export interface RosterAssessment {
  categories: CategoryScores;
  tacticalAxes: Record<string, TacticalAxisResult>;
  composite: number;
  units: TeamUnitRatings;
}

export interface MatchResult {
  index: number;
  opponentId: string;
  venue: 'home' | 'away';
  outcome: 'win' | 'draw' | 'loss';
  points: 0 | 1 | 3;
}

export interface SeasonResult {
  wins: number;
  draws: number;
  losses: number;
  points: number;
  label: 'Perfect' | 'Invincible' | null;
  matches: MatchResult[];
}

export interface ExplanationFact {
  key: string;
  value: JsonValue;
  polarity: 'strength' | 'weakness' | 'context';
}

export interface StructuredExplanation {
  summary: string;
  facts: ExplanationFact[];
}

export interface RunResult {
  resultId: string;
  challengeId: string;
  versions: MechanicsVersion;
  roster: RosterAssignment[];
  actions: DraftAction[];
  assessment: RosterAssessment;
  season: SeasonResult;
  explanation: StructuredExplanation;
  finalStateHash: string;
}
