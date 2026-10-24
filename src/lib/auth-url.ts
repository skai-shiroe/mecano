import { supabase } from '@/lib/supabase';
import { parseAuthUrl } from '@/lib/auth-url-parse';

export type AuthUrlResult =
  | { status: 'session' }
  | { status: 'already-handled' }
  | { status: 'error'; message: string }
  | { status: 'none' };

let handledCode: string | null = null;
let pendingCode: { code: string; promise: Promise<AuthUrlResult> } | null = null;

export async function completeAuthFromUrl(url: string | null): Promise<AuthUrlResult> {
  const parsed = parseAuthUrl(url);
  if (parsed.kind === 'error') return { status: 'error', message: parsed.message };

  if (parsed.kind === 'code') {
    if (parsed.code === handledCode) return { status: 'already-handled' };
    if (pendingCode?.code === parsed.code) return pendingCode.promise;

    const promise = (async (): Promise<AuthUrlResult> => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (error) return { status: 'error', message: error.message };
        handledCode = parsed.code;
        return { status: 'session' };
      } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : 'Échange OAuth impossible.' };
      }
    })();
    pendingCode = { code: parsed.code, promise };
    const result = await promise;
    if (pendingCode?.promise === promise) pendingCode = null;
    if (result.status !== 'session') handledCode = null;
    return result;
  }

  if (parsed.kind === 'tokens') {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      return error ? { status: 'error', message: error.message } : { status: 'session' };
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : 'Session OAuth impossible.' };
    }
  }

  return { status: 'none' };
}
