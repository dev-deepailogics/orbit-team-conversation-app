import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'API_KEY_ORBIT';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'orbit_livekit_secret_key_change_in_production';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'http://localhost:7880';

export class LiveKitService {
  static async createToken(roomName: string, participantIdentity: string, participantName: string): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  static getServerUrl(): string {
    return LIVEKIT_URL;
  }
}
