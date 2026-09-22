export function responseStatus(caught: unknown): number | undefined {
  if (typeof caught !== 'object' || caught === null || !('response' in caught)) return undefined;
  const response = caught.response;
  if (typeof response !== 'object' || response === null || !('status' in response))
    return undefined;
  return typeof response.status === 'number' ? response.status : undefined;
}

export function authErrorMessage(caught: unknown): string {
  const status = responseStatus(caught);
  if (status === 401 || status === 403) {
    return 'Guest sign-in was rejected. Reload the page and try again.';
  }
  return 'Guest sign-in is unavailable. Check your connection and try again.';
}

export function cloudSaveErrorMessage(caught: unknown): string {
  const status = responseStatus(caught);
  if (status === 401 || status === 403) {
    return 'Saving rejected this session. Sign in again, then retry.';
  }
  if (status === 409 || status === 412) {
    return 'Your saved result changed during this update. Retry before reloading.';
  }
  return 'Saving is unavailable. Your result remains in this tab; retry before reloading.';
}

export class FriendRoomResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendRoomResponseError';
  }
}

export function roomErrorMessage(caught: unknown): string {
  if (caught instanceof FriendRoomResponseError) return caught.message;
  const status = responseStatus(caught);
  if (status === 401) return 'Your sign-in expired. Sign in again and retry.';
  if (status === 403) {
    return 'This room is closed to new players or is no longer available.';
  }
  if (status === 409) return 'The room changed while this request was running. Retry.';
  if (status === 404) return 'That room is no longer available.';
  if (status === 422) return 'That room is full or not open for joining.';
  return 'The room request failed. Check your connection and retry.';
}
