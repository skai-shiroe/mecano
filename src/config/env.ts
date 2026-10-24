export type AppEnvironment = 'development' | 'preview' | 'production';

const value = process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production');

if (value !== 'development' && value !== 'preview' && value !== 'production') {
  throw new Error('EXPO_PUBLIC_APP_ENV must be development, preview or production.');
}

export const appEnvironment: AppEnvironment = value;
