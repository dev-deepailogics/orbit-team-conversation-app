import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'API_KEY_ORBIT';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'orbit_livekit_secret_key_change_in_production';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'http://localhost:7880';

export class LiveKitService {
  private static roomService: RoomServiceClient | null = null;

  public static getRoomService(): RoomServiceClient {
    if (!this.roomService) {
      this.roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    }
    return this.roomService;
  }

  static async createToken(
    roomName: string,
    participantIdentity: string,
    participantName: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '4h',
      metadata: metadata ? JSON.stringify(metadata) : undefined,
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

  static async listParticipants(roomName: string) {
    try {
      const roomClient = this.getRoomService();
      return await roomClient.listParticipants(roomName);
    } catch (err) {
      console.error(`Failed to list LiveKit participants for ${roomName}:`, err);
      return [];
    }
  }

  static async mutePublishedTrack(roomName: string, identity: string, trackSid: string, muted: boolean) {
    const roomClient = this.getRoomService();
    return await roomClient.mutePublishedTrack(roomName, identity, trackSid, muted);
  }

  static async removeParticipant(roomName: string, identity: string) {
    const roomClient = this.getRoomService();
    return await roomClient.removeParticipant(roomName, identity);
  }

  static async deleteRoom(roomName: string) {
    try {
      const roomClient = this.getRoomService();
      await roomClient.deleteRoom(roomName);
      return true;
    } catch (err) {
      console.warn(`LiveKit deleteRoom warning for ${roomName}:`, err);
      return false;
    }
  }

  static getServerUrl(): string {
    return LIVEKIT_URL;
  }
}

