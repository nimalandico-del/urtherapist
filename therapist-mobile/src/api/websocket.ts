import { getApiBase, getAccessToken } from '../config/apiBase';

export interface WebSocketMessage {
  type: 'new_request' | 'request_updated';
  data: any;
}

export class TherapistWebSocket {
  private ws: WebSocket | null = null;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
  private url: string = '';
  private onMessageCallback: ((message: WebSocketMessage) => void) | null = null;
  private isConnecting: boolean = false;

  async connect(onMessage: (message: WebSocketMessage) => void) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.onMessageCallback = onMessage;
    this.isConnecting = true;

    try {
      const base = await getApiBase();
      const token = await getAccessToken();
      
      // Convert http/https to ws/wss
      let wsUrl = base.replace(/^https/, 'wss').replace(/^http/, 'ws');
      // Remove trailing slash
      wsUrl = wsUrl.replace(/\/$/, '');
      wsUrl = `${wsUrl}/ws/therapist/requests/?token=${encodeURIComponent(token || '')}`;
      
      this.url = wsUrl;
      console.log('Therapist WebSocket connecting to:', wsUrl);
      
      // Use React Native's WebSocket
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };

      this.ws.onmessage = (event: any) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onerror = (error: any) => {
        // Log WebSocket errors for debugging
        const errorMessage = error?.message || '';
        const errorCode = error?.code || '';
        console.error('Therapist WebSocket error:', {
          message: errorMessage,
          code: errorCode,
          url: this.url,
        });
        this.isConnecting = false;
      };

      this.ws.onclose = (event: any) => {
        // Log close events for debugging
        console.log('Therapist WebSocket disconnected', {
          code: event.code,
          reason: event.reason || '',
          wasClean: event.wasClean,
          url: this.url,
        });
        this.isConnecting = false;
        // Only reconnect if it wasn't a manual disconnect and not a 404 error
        if (this.onMessageCallback && event.code !== 1006) {
          // 1006 is abnormal closure (like 404), don't reconnect immediately
          if (event.code === 1006) {
            setTimeout(() => {
              if (this.onMessageCallback) {
                this.reconnect();
              }
            }, 30000); // Wait 30 seconds before retrying after 404
          } else {
            this.reconnect();
          }
        }
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectInterval) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      if (this.onMessageCallback && !this.isConnecting) {
        this.connect(this.onMessageCallback);
      }
    }, 5000);
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Clear callback before closing to prevent reconnect
    this.onMessageCallback = null;
    
    if (this.ws) {
      // Close with normal closure code to indicate intentional disconnect
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'Normal closure');
        }
      } catch (e) {
        // Ignore errors during close
      }
      this.ws = null;
    }
    
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export interface ChatWebSocketMessage {
  type: 'chat_message' | 'session_started' | 'session_ended';
  data: any;
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
  private url: string = '';
  private onMessageCallback: ((message: ChatWebSocketMessage) => void) | null = null;
  private isConnecting: boolean = false;
  private sessionId: number | null = null;

  async connect(sessionId: number, onMessage: (message: ChatWebSocketMessage) => void) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId === sessionId)) {
      return;
    }

    // Disconnect previous connection if session changed
    if (this.sessionId !== null && this.sessionId !== sessionId) {
      this.disconnect();
    }

    this.sessionId = sessionId;
    this.onMessageCallback = onMessage;
    this.isConnecting = true;

    try {
      const base = await getApiBase();
      const token = await getAccessToken();
      
      // Convert http/https to ws/wss
      let wsUrl = base.replace(/^https/, 'wss').replace(/^http/, 'ws');
      // Remove trailing slash
      wsUrl = wsUrl.replace(/\/$/, '');
      wsUrl = `${wsUrl}/ws/chat/${sessionId}/?token=${encodeURIComponent(token || '')}&session_id=${sessionId}`;
      
      this.url = wsUrl;
      
      // Use React Native's WebSocket
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Chat WebSocket connected for session', sessionId);
        this.isConnecting = false;
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };

      this.ws.onmessage = (event: any) => {
        try {
          const message: ChatWebSocketMessage = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } catch (e) {
          console.error('Error parsing Chat WebSocket message:', e);
        }
      };

      this.ws.onerror = (error: any) => {
        // Filter out common/expected errors
        const errorMessage = error?.message || '';
        const isCommonError = 
          errorMessage.includes('Software caused connection abort') ||
          errorMessage.includes('Connection reset') ||
          errorMessage.includes('Network is unreachable') ||
          errorMessage === '';
        
        if (!isCommonError && error && error.message) {
          console.error('Chat WebSocket error:', error.message);
        } else if (!isCommonError && error && typeof error === 'object' && Object.keys(error).length > 0) {
          const errorInfo = error.message || error.code || 'Unknown error';
          if (errorInfo !== null && errorInfo !== '') {
            console.error('Chat WebSocket error:', errorInfo);
          }
        }
        this.isConnecting = false;
      };

      this.ws.onclose = (event: any) => {
        // Only log if it wasn't a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          console.log('Chat WebSocket disconnected for session', sessionId, event.code, event.reason || '');
        }
        this.isConnecting = false;
        // Only reconnect if session matches and callback exists
        if (this.sessionId === sessionId && this.onMessageCallback) {
          this.reconnect();
        }
      };
    } catch (error) {
      console.error('Error connecting Chat WebSocket:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectInterval || !this.sessionId) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      if (this.onMessageCallback && !this.isConnecting && this.sessionId) {
        this.connect(this.sessionId, this.onMessageCallback);
      }
    }, 5000);
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Clear callback before closing to prevent reconnect
    this.onMessageCallback = null;
    
    if (this.ws) {
      // Close with normal closure code to indicate intentional disconnect
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'Normal closure');
        }
      } catch (e) {
        // Ignore errors during close
      }
      this.ws = null;
    }
    
    this.isConnecting = false;
    this.sessionId = null;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

