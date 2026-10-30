// Your machine's LAN IP, reachable from physical devices on the same Wi-Fi (and from emulators/simulators).
// ponytail: changes when the router reassigns it (`ipconfig getifaddr en0`); move to react-native-config when you add staging builds.
const DEV_SERVER_URL = 'http://192.168.19.168:4000';

// Same domain as NEXT_PUBLIC_SERVER_URL in docker-compose.prod.yml.
const PROD_SERVER_URL = 'https://orbit.yourdomain.com';

export const SERVER_URL = __DEV__ ? DEV_SERVER_URL : PROD_SERVER_URL;
