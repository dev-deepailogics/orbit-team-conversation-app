// Android (emulator or device) reaches the host via `adb reverse tcp:4000 tcp:4000`, so localhost works everywhere.
// ponytail: move to react-native-config when you add staging builds.
const DEV_SERVER_URL = 'http://localhost:4000';

// Same domain as NEXT_PUBLIC_SERVER_URL in docker-compose.prod.yml.
const PROD_SERVER_URL = 'https://orbit.yourdomain.com';

export const SERVER_URL = __DEV__ ? DEV_SERVER_URL : PROD_SERVER_URL;
