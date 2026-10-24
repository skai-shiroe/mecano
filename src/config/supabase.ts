export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://nhdwiuukewfofaexbxmi.supabase.co';
export const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
