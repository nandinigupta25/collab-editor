/**
 * PresenceManager
 *
 * Tracks which users are connected to which documents,
 * along with their cursor positions and display metadata.
 */

const COLORS = [
  '#E85D75', // rose
  '#5B8AF5', // cobalt
  '#3DBFA0', // teal
  '#F5A623', // amber
  '#A855F7', // violet
  '#22C55E', // green
  '#F97316', // orange
  '#06B6D4', // cyan
];

class PresenceManager {
  constructor() {
    // socketId -> { userId, userName, color, docId, cursor: { pos, line } }
    this.users = new Map();
    // docId -> Set<socketId>
    this.docRooms = new Map();
    this._colorIndex = 0;
  }

  /**
   * Register a user connecting to a document.
   */
  join(socketId, { userId, userName, docId }) {
    const color = COLORS[this._colorIndex % COLORS.length];
    this._colorIndex++;

    const userInfo = {
      userId,
      userName: userName || `User ${socketId.slice(0, 4)}`,
      color,
      docId,
      socketId,
      cursor: { pos: 0 },
      joinedAt: Date.now(),
    };

    this.users.set(socketId, userInfo);

    if (!this.docRooms.has(docId)) {
      this.docRooms.set(docId, new Set());
    }
    this.docRooms.get(docId).add(socketId);

    return userInfo;
  }

  /**
   * Update cursor position for a user.
   */
  updateCursor(socketId, cursor) {
    const user = this.users.get(socketId);
    if (user) {
      user.cursor = cursor;
    }
    return user;
  }

  /**
   * Remove a user on disconnect.
   */
  leave(socketId) {
    const user = this.users.get(socketId);
    if (!user) return null;

    const { docId } = user;
    this.users.delete(socketId);

    const room = this.docRooms.get(docId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.docRooms.delete(docId);
      }
    }

    return { user, docId };
  }

  /**
   * Returns all users in a document except the requesting socket.
   */
  getUsersInDoc(docId, excludeSocketId = null) {
    const room = this.docRooms.get(docId);
    if (!room) return [];

    return Array.from(room)
      .filter((sid) => sid !== excludeSocketId)
      .map((sid) => this.users.get(sid))
      .filter(Boolean)
      .map(({ socketId, userId, userName, color, cursor }) => ({
        socketId,
        userId,
        userName,
        color,
        cursor,
      }));
  }

  /**
   * Returns full user info for a socket.
   */
  getUser(socketId) {
    return this.users.get(socketId) || null;
  }
}

module.exports = new PresenceManager();
