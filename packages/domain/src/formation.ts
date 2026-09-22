import type { Formation, FormationSlot, PositionCode, SlotCode } from './types.js';

export const FORMATION_4_3_3_SLOTS = [
  { id: 'GK', position: 'GK' },
  { id: 'LB', position: 'LB' },
  { id: 'LCB', position: 'CB' },
  { id: 'RCB', position: 'CB' },
  { id: 'RB', position: 'RB' },
  { id: 'DM', position: 'DM' },
  { id: 'CM', position: 'CM' },
  { id: 'AM', position: 'AM' },
  { id: 'LW', position: 'LW' },
  { id: 'CF', position: 'CF' },
  { id: 'RW', position: 'RW' },
] as const satisfies readonly FormationSlot[];

export const FORMATION_4_3_3: Formation = {
  id: '4-3-3-v1',
  slots: [...FORMATION_4_3_3_SLOTS],
};

export const POSITION_BY_SLOT = {
  GK: 'GK',
  LB: 'LB',
  LCB: 'CB',
  RCB: 'CB',
  RB: 'RB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LW: 'LW',
  CF: 'CF',
  RW: 'RW',
} as const satisfies Readonly<Record<SlotCode, PositionCode>>;
