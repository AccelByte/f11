import { defineCatalogue } from '@football-11/content';
import {
  buildConstraintProfiles,
  type AssessmentConfig,
  type HeadToHeadProfile,
  type LeagueProfile,
  type PlayerCatalogue,
} from '@football-11/domain';

import assessmentJson from '../../../../data/config/assessment-v1.json';
import headToHeadJson from '../../../../data/config/head-to-head-v1.json';
import leagueJson from '../../../../data/config/league-profile-v1.json';
import catalogueJson from '../../../../data/content/openfootball-pl-2023-24-named-squads-v2.json';

export const catalogue = defineCatalogue(catalogueJson as unknown as PlayerCatalogue);
export const players = catalogue.playerSeasons;
export const playerById = new Map(players.map((player) => [player.id, player]));
export const teamByCode = new Map(catalogue.teams.map((team) => [team.clubCode, team.displayName]));
export const constraintProfiles = buildConstraintProfiles(players);
export const assessmentConfig = assessmentJson as unknown as AssessmentConfig;
export const leagueProfile = leagueJson as unknown as LeagueProfile;
export const headToHeadProfile = headToHeadJson as unknown as HeadToHeadProfile;
