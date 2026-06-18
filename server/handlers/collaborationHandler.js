/**
 * collaborationHandler
 *
 * Wires up all Socket.io events for real-time collaboration.
 * Called once per connected socket.
 */

const documentManager = require('../managers/documentManager');
const presenceManager = require('../managers/presenceManager');

module.exports = function collaborationHandler(io, socket) {
  console.log(`[socket] connected: ${socket.id}`);

  // ─── JOIN DOCUMENT ──────────────────────────────────────────────────────────
  socket.on('join_document', ({ docId, userId, userName }) => {
    if (!docId) {
      socket.emit('error', { message: 'docId is required' });
      return;
    }

    // Leave any previous room (handles re-join on reconnect)
    const existingUser = presenceManager.getUser(socket.id);
    if (existingUser && existingUser.docId !== docId) {
      socket.leave(existingUser.docId);
    }

    socket.join(docId);

    const userInfo = presenceManager.join(socket.id, { userId, userName, docId });
    const snapshot = documentManager.getSnapshot(docId);

    // Send the current document state to the joining client
    socket.emit('document_init', {
      docId,
      content: snapshot.content,
      version: snapshot.version,
      title: snapshot.title,
      users: presenceManager.getUsersInDoc(docId, socket.id),
      you: userInfo,
    });

    // Tell everyone else in the room about the new user
    socket.to(docId).emit('user_joined', {
      socketId: socket.id,
      userId: userInfo.userId,
      userName: userInfo.userName,
      color: userInfo.color,
      cursor: userInfo.cursor,
    });

    console.log(`[join] ${userInfo.userName} → doc:${docId} (v${snapshot.version})`);
  });

  // ─── OPERATION (CHARACTER-LEVEL OT) ─────────────────────────────────────────
  socket.on('operation', (op) => {
    const user = presenceManager.getUser(socket.id);
    if (!user) return;

    const { docId } = user;

    try {
      const transformedOp = documentManager.applyOperation(docId, {
        ...op,
        siteId: socket.id,
      });

      // Broadcast transformed op to everyone else in the room
      socket.to(docId).emit('remote_operation', {
        ...transformedOp,
        senderSocketId: socket.id,
        senderName: user.userName,
        senderColor: user.color,
      });
    } catch (err) {
      console.error(`[operation] error applying op from ${socket.id}:`, err.message);
      // Send a full sync to the offending client to recover state
      const snapshot = documentManager.getSnapshot(docId);
      socket.emit('full_sync', {
        content: snapshot.content,
        version: snapshot.version,
      });
    }
  });

  // ─── BULK REPLACE (paste / undo / large change) ───────────────────────────
  socket.on('replace_content', ({ content }) => {
    const user = presenceManager.getUser(socket.id);
    if (!user) return;

    const { docId } = user;
    const op = documentManager.applyReplace(docId, content, socket.id);

    socket.to(docId).emit('remote_replace', {
      content,
      serverVersion: op.serverVersion,
      senderSocketId: socket.id,
    });
  });

  // ─── CURSOR POSITION ────────────────────────────────────────────────────────
  socket.on('cursor_update', ({ pos, selection }) => {
    const user = presenceManager.getUser(socket.id);
    if (!user) return;

    presenceManager.updateCursor(socket.id, { pos, selection });

    socket.to(user.docId).emit('remote_cursor', {
      socketId: socket.id,
      pos,
      selection,
      color: user.color,
      userName: user.userName,
    });
  });

  // ─── TITLE CHANGE ────────────────────────────────────────────────────────────
  socket.on('title_change', ({ title }) => {
    const user = presenceManager.getUser(socket.id);
    if (!user) return;

    const newTitle = documentManager.updateTitle(user.docId, title);
    socket.to(user.docId).emit('remote_title', { title: newTitle });
  });

  // ─── REQUEST FULL SYNC (client asks to re-sync) ───────────────────────────
  socket.on('request_sync', () => {
    const user = presenceManager.getUser(socket.id);
    if (!user) return;

    const snapshot = documentManager.getSnapshot(user.docId);
    socket.emit('full_sync', {
      content: snapshot.content,
      version: snapshot.version,
    });
  });

  // ─── DISCONNECT ──────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const result = presenceManager.leave(socket.id);
    if (result) {
      const { user, docId } = result;
      io.to(docId).emit('user_left', { socketId: socket.id, userId: user.userId });
      console.log(`[disconnect] ${user.userName} left doc:${docId} (${reason})`);
    } else {
      console.log(`[disconnect] ${socket.id} (no doc) (${reason})`);
    }
  });
};
