import { apiPreflight, withApiCors } from '@/src/server/apiCors';

import type {
  ResolveSavedXiChallengeResponseV1,
  SavedXiCompetitionStatusV1,
} from '@football-11/contracts';

import { AgsServerGateway, readAgsServerConfig } from '@/src/server/agsServerGateway';
import { bearerToken, competitionResponse, readJsonBody } from '@/src/server/competitionHttp';
import {
  getSavedXiCompetitionStatus,
  resolveSavedXiChallenge,
} from '@/src/server/savedXiCompetition';

async function handleGET(request: Request): Promise<Response> {
  return competitionResponse(async (): Promise<SavedXiCompetitionStatusV1> => {
    const config = readAgsServerConfig();
    return getSavedXiCompetitionStatus(bearerToken(request), new AgsServerGateway(config), {
      namespace: config.namespace,
    });
  });
}

async function handlePOST(request: Request): Promise<Response> {
  return competitionResponse(async (): Promise<ResolveSavedXiChallengeResponseV1> => {
    const input = await readJsonBody(request);
    const config = readAgsServerConfig();
    return resolveSavedXiChallenge(input, bearerToken(request), new AgsServerGateway(config), {
      namespace: config.namespace,
    });
  });
}

export const GET = withApiCors(handleGET);
export const POST = withApiCors(handlePOST);

export function OPTIONS(request: Request): Response {
  return apiPreflight(request, ['GET', 'POST']);
}
