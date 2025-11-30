import { Client, Session, Socket } from '@heroiclabs/nakama-js';

export class NakamaService {
  private client: Client;
  private session: Session | null = null;
  private socket: Socket | null = null;
  
  constructor() {
    // For local development: localhost:7350
    // For production: YOUR_SERVER_IP:7350
    this.client = new Client('defaultkey', 'localhost', '7350', false);
  }

  async authenticate(deviceId?: string): Promise<Session> {
    try {
      // Get or generate a persistent device ID
      let id = deviceId || this.getStoredDeviceId();
      if (!id) {
        id = this.generateDeviceId();
        this.storeDeviceId(id);
      }

      // Generate a username based on device ID
      const username = `Player_${id.substring(7, 12)}`;

      console.log('Authenticating with device ID:', id);
      
      // Authenticate with Nakama
      this.session = await this.client.authenticateDevice(id, true, username);
      
      console.log('Authenticated successfully:', {
        userId: this.session.user_id,
        username: this.session.username
      });
      
      return this.session;
    } catch (error: any) {
      console.error('Authentication failed:', error);
      
      // If it's a username conflict (rare but possible), try without username
      if (error?.status === 409 || error?.code === 409) {
        console.log('Username conflict, retrying without username...');
        try {
          const id = this.getStoredDeviceId() || this.generateDeviceId();
          this.session = await this.client.authenticateDevice(id, true);
          return this.session;
        } catch (retryError) {
          console.error('Retry authentication failed:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  async connectSocket(): Promise<Socket> {
    if (!this.session) {
      throw new Error('Must authenticate before connecting socket');
    }

    try {
      this.socket = this.client.createSocket(false, true);
      await this.socket.connect(this.session, true);
      console.log('Socket connected successfully');
      
      return this.socket;
    } catch (error) {
      console.error('Failed to connect socket:', error);
      throw error;
    }
  }

  async findMatch(): Promise<string> {
    if (!this.socket || !this.session) {
      throw new Error('Socket not connected or not authenticated');
    }

    try {
      console.log('Calling find_match RPC...');
      const rpcResponse = await this.client.rpc(this.session, 'find_match', '{}');
      
      // Parse the response payload
      let result;
      if (typeof rpcResponse.payload === 'string') {
        result = JSON.parse(rpcResponse.payload);
      } else {
        result = rpcResponse.payload;
      }
      
      console.log('RPC response:', result);
      
      if (!result || !result.matchId) {
        throw new Error('Invalid RPC response: missing matchId');
      }
      
      return result.matchId;
    } catch (error) {
      console.error('Failed to find match:', error);
      throw error;
    }
  }

  async joinMatch(matchId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    try {
      console.log('Joining match:', matchId);
      const match = await this.socket.joinMatch(matchId);
      console.log('Successfully joined match:', match);
      return match;
    } catch (error) {
      console.error('Failed to join match:', error);
      throw error;
    }
  }

  async sendMove(matchId: string, position: number) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    try {
      console.log('Sending move:', { matchId, position });
      await this.socket.sendMatchState(matchId, 3, JSON.stringify({ position }));
    } catch (error) {
      console.error('Failed to send move:', error);
      throw error;
    }
  }

  async getLeaderboard(): Promise<any> {
    if (!this.session) {
      throw new Error('Must authenticate first');
    }

    try {
      const response = await this.client.rpc(this.session, 'get_leaderboard', '{}');
      
      // Parse the response payload
      let data;
      if (typeof response.payload === 'string') {
        data = JSON.parse(response.payload);
      } else {
        data = response.payload;
      }
      
      return data || { records: [] };
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return { records: [] };
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getSession(): Session | null {
    return this.session;
  }

  private generateDeviceId(): string {
    // Generate a random device ID
    const randomPart = Math.random().toString(36).substring(2, 15);
    const timestampPart = Date.now().toString(36);
    return `device_${timestampPart}_${randomPart}`;
  }

  private getStoredDeviceId(): string | null {
    try {
      return localStorage.getItem('nakama_device_id');
    } catch (error) {
      console.warn('localStorage not available:', error);
      return null;
    }
  }

  private storeDeviceId(id: string): void {
    try {
      localStorage.setItem('nakama_device_id', id);
      console.log('Stored device ID:', id);
    } catch (error) {
      console.warn('Failed to store device ID:', error);
      // Continue without storage - device will get new ID on refresh
    }
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.disconnect(true);
        console.log('Socket disconnected');
      } catch (error) {
        console.error('Error disconnecting socket:', error);
      }
    }
  }
}

// Export a singleton instance
export const nakamaService = new NakamaService();