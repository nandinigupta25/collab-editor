/**
 * socketService.js
 *
 * Singleton wrapper around Socket.io client.
 * Encapsulates connection management, reconnection logic,
 * and the outbound operation queue so components stay clean.
 */

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map(); // eventName -> Set<callback>
    this._pendingOps = [];      // ops buffered while disconnected
    this._connected = false;
    this._docId = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.4,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this._connected = true;
      this._emit('_connection_status', 'connected');
      // Flush any ops that queued while offline
      if (this._pendingOps.length > 0) {
        this.socket.emit('request_sync'); // re-sync first, then flush
      }
    });

    this.socket.on('disconnect', (reason) => {
      this._connected = false;
      this._emit('_connection_status', 'disconnected');
      console.warn('[socket] disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      this._connected = false;
      this._emit('_connection_status', 'connecting');
      console.warn('[socket] connect_error:', err.message);
    });

    // Proxy all server events to registered listeners
    const SERVER_EVENTS = [
      'document_init',
      'remote_operation',
      'remote_replace',
      'remote_cursor',
      'remote_title',
      'user_joined',
      'user_left',
      'full_sync',
      'error',
    ];
    SERVER_EVENTS.forEach((evt) => {
      this.socket.on(evt, (data) => this._emit(evt, data));
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this._connected = false;
    this._docId = null;
  }

  // ── Document ───────────────────────────────────────────────────────────────

  joinDocument({ docId, userId, userName }) {
    this._docId = docId;
    this.socket?.emit('join_document', { docId, userId, userName });
  }

  // ── Operations ─────────────────────────────────────────────────────────────

  sendOperation(op) {
    if (!this._connected || !this.socket) {
      // Buffer while offline — will be resolved with full_sync on reconnect
      this._pendingOps.push(op);
      return;
    }
    this.socket.emit('operation', op);
  }

  sendReplace(content) {
    if (!this._connected || !this.socket) return;
    this.socket.emit('replace_content', { content });
  }

  sendCursorUpdate(pos, selection) {
    this.socket?.volatile.emit('cursor_update', { pos, selection });
  }

  sendTitleChange(title) {
    this.socket?.emit('title_change', { title });
  }

  requestSync() {
    this.socket?.emit('request_sync');
  }

  // ── Event bus ──────────────────────────────────────────────────────────────

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  get connected() {
    return this._connected;
  }

  get socketId() {
    return this.socket?.id ?? null;
  }
}

// Export singleton
export const socketService = new SocketService();
