import './crypto-polyfill';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabasePublishableKey, supabaseUrl } from '@/config/supabase';
import type { Database } from '@/types/database';

const authStorage =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? window.localStorage
      : undefined
    : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
