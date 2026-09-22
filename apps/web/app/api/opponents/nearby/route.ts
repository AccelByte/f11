import { apiPreflight, withApiCors } from '@/src/server/apiCors';

import type { SavedXiChallengePreviewV1 } from '@football-11/contracts';

import { AgsServerGateway, readAgsServerConfig } from '@/src/server/agsServerGateway';
import { bearerToken, competitionResponse } from '@/src/server/competitionHttp';
import { issueSavedXiChallenge } from '@/src/server/savedXiCompetition';

async function handlePOST(request: Request): Promise<Response> {
  return competitionResponse(async (): Promise<SavedXiChallengePreviewV1> => {
    const config = readAgsServerConfig();
    return issueSavedXiChallenge(bearerToken(request), new AgsServerGateway(config), {
      namespace: config.namespace,
    });
  });
}

export const POST = withApiCors(handlePOST);

export function OPTIONS(request: Request): Response {
  return apiPreflight(request, ['POST']);
}
