/**
 * What to tell the user when a request fails.
 *
 * Business errors come back with a reason the backend has already put in the user's language
 * (a duplicate name, a plan limit, stock that is no longer there), so show that. When the server
 * crashed or could not be reached there is nothing useful to show, so use the translated fallback.
 */
export function httpErrorMessage(err: any, fallback: string): string {
  const status = Number(err?.status ?? 0);
  if (status === 0 || status >= 500) {
    return fallback;
  }
  const message = err?.error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
