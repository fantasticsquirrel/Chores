/** Only derive the documented paired SPA route from a known /chore-api deployment. */
export function discoveryWebDestination(apiBaseUrl: string, explorationId: string): string | null {
  try {
    const url = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/\/chore-api\/?$/.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(/\/chore-api\/?$/, `/chore/discovery-lab/${encodeURIComponent(explorationId)}`);
    url.search = ''; url.hash = '';
    return url.toString();
  } catch { return null; }
}
