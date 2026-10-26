import { Platform } from 'react-native';

// Android emulator reaches the host machine via 10.0.2.2, iOS simulator via localhost.
// ponytail: physical devices need your machine's LAN IP here; move to react-native-config when you add staging builds.
const DEV_SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

// Same domain as NEXT_PUBLIC_SERVER_URL in docker-compose.prod.yml.
const PROD_SERVER_URL = 'https://orbit.yourdomain.com';

export const SERVER_URL = __DEV__ ? DEV_SERVER_URL : PROD_SERVER_URL;
