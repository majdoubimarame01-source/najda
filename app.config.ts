/// <reference types="node" />
import fs from 'fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json. Adds Firebase (FCM) only when google-services.json is present,
// so the APK still builds before Firebase is set up (Realtime alerts keep working).
export default ({ config }: ConfigContext): ExpoConfig => {
  const hasFirebase = fs.existsSync('./google-services.json');
  const projectId = process.env.EAS_PROJECT_ID || (config.extra as any)?.eas?.projectId;

  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...((config.extra as any)?.eas ?? {}), projectId } } : {}),
    },
  };
};
