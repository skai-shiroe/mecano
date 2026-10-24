export type ParsedAuthUrl =
  | { kind: 'error'; message: string }
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'unknown' };

function safeParams(url: string, separator: '?' | '#'): URLSearchParams {
  const index = url.indexOf(separator);
  if (index < 0) return new URLSearchParams('');
  const raw = url.slice(index + 1);
  return new URLSearchParams(separator === '?' ? raw.split('#')[0] : raw.split('?')[0]);
}

export function parseAuthUrl(url: string | null | undefined): ParsedAuthUrl {
  if (!url) return { kind: 'unknown' };
  const query = safeParams(url, '?');
  const fragment = safeParams(url, '#');
  const error = query.get('error_description') ?? fragment.get('error_description') ?? query.get('error') ?? fragment.get('error');
  if (error) return { kind: 'error', message: error };

  const code = query.get('code');
  if (code) return { kind: 'code', code };

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  return { kind: 'unknown' };
}
