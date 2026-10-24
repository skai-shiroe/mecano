import { Platform } from 'react-native';

/** Google authentication is enabled for the web pilot only. */
export const AUTH_ENABLED = Platform.OS === 'web';
