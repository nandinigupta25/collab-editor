/**
 * useCollaboration.js
 *
 * Custom hook that manages:
 *  - Socket connection lifecycle
 *  - Joining / leaving documents
 *  - Sending local operations and receiving remote ones
 *  - Merging remote ops into local content without losing cursor position
 *  - Presence (active users + their cursors)
 *  - Connection status
 *
 * Returns everything the Editor page needs to render and interact.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../utils/socketService';
import {
  diffToOps,
  adjustCursorForRemoteOp,
  applyOpToString,
  getOrCreateUserId,
  getOrCreateUserName,
} from '../utils/otUtils';

export function useCollaboration(docId) {
  const [content, setContent]             = useState('');
  const [title, setTitle]                 = useState('Untitled Document');
  const [activeUsers, setActiveUsers]     = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [serverVersion, setServerVersion] = useState(0);
  const [myInfo, setMyInfo]               = useState(null);

  // Ref mirrors so event callbacks always read current values without stale closure
  const contentRef      = useRef('');
  const versionRef      = useRef(0);
  const cursorPosRef    = useRef(0);   // textarea selectionStart
  const textareaRef     = useRef(null); // forwarded from Editor
  const isApplyingRemote = useRef(false);

  const userId   = useRef(getOrCreateUserId()).current;
  const userName = useRef(getOrCreateUserName()).current;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const restoreCursor = useCallback((newPos) => {
    const el = textareaRef.current;
    if (!el) return;
    // RAF so we restore after React's DOM update
    requestAnimationFrame(() => {
      el.selectionStart = newPos;
      el.selectionEnd   = newPos;
    });
  }, []);

  // ── Connect & join document ───────────────────────────────────────────────

  useEffect(() => {
    if (!docId) return;

    socketService.connect();

    const off = [
      // ── Connection status
      socketService.on('_connection_status', (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          // Re-join document after reconnect
          socketService.joinDocument({ docId, userId, userName });
        }
      }),

      // ── Initial document state
      socketService.on('document_init', (data) => {
        contentRef.current = data.content;
        versionRef.current = data.version;
        setContent(data.content);
        setTitle(data.title || 'Untitled Document');
        setServerVersion(data.version);
        setMyInfo(data.you);
        setActiveUsers(data.users || []);
      }),

      // ── Incoming remote operation (char-level OT)
      socketService.on('remote_operation', (op) => {
        isApplyingRemote.current = true;

        const oldContent    = contentRef.current;
        const newContent    = applyOpToString(oldContent, op);
        contentRef.current  = newContent;
        versionRef.current  = op.serverVersion;

        // Adjust cursor so it doesn't jump
        const adjustedCursor = adjustCursorForRemoteOp(cursorPosRef.current, op);
        cursorPosRef.current = adjustedCursor;

        setContent(newContent);
        setServerVersion(op.serverVersion);

        restoreCursor(adjustedCursor);

        // Update remote user's cursor indicator if present
        if (op.senderSocketId) {
          setActiveUsers((prev) =>
            prev.map((u) =>
              u.socketId === op.senderSocketId
                ? { ...u, cursor: { pos: op.type === 'insert' ? op.pos + 1 : op.pos } }
                : u
            )
          );
        }

        isApplyingRemote.current = false;
      }),

      // ── Full content replace (paste / bulk change from remote)
      socketService.on('remote_replace', ({ content: newContent, serverVersion: sv }) => {
        isApplyingRemote.current = true;
        contentRef.current  = newContent;
        versionRef.current  = sv;
        setContent(newContent);
        setServerVersion(sv);
        isApplyingRemote.current = false;
      }),

      // ── Full sync (server-authoritative recovery)
      socketService.on('full_sync', ({ content: newContent, version: sv }) => {
        contentRef.current  = newContent;
        versionRef.current  = sv;
        setContent(newContent);
        setServerVersion(sv);
      }),

      // ── Remote title change
      socketService.on('remote_title', ({ title: newTitle }) => {
        setTitle(newTitle);
        document.title = `${newTitle} — Collab`;
      }),

      // ── Remote cursor position
      socketService.on('remote_cursor', ({ socketId, pos, selection, color, userName: uName }) => {
        setActiveUsers((prev) =>
          prev.map((u) =>
            u.socketId === socketId ? { ...u, cursor: { pos, selection } } : u
          )
        );
      }),

      // ── User joined
      socketService.on('user_joined', (user) => {
        setActiveUsers((prev) => {
          if (prev.some((u) => u.socketId === user.socketId)) return prev;
          return [...prev, user];
        });
      }),

      // ── User left
      socketService.on('user_left', ({ socketId }) => {
        setActiveUsers((prev) => prev.filter((u) => u.socketId !== socketId));
      }),

      // ── Server error
      socketService.on('error', ({ message }) => {
        console.error('[server error]', message);
      }),
    ];

    // Join document (may also be triggered by 'connected' event above if already connected)
    if (socketService.connected) {
      socketService.joinDocument({ docId, userId, userName });
    }

    return () => {
      off.forEach((unsubscribe) => unsubscribe());
    };
  }, [docId, userId, userName, restoreCursor]);

  // ── Local edit handler ────────────────────────────────────────────────────

  const handleLocalChange = useCallback(
    (newText, cursorPos) => {
      if (isApplyingRemote.current) return;

      const oldText = contentRef.current;
      cursorPosRef.current = cursorPos;

      // Detect large paste: if delta > 50 chars, send a bulk replace instead
      // of flooding the server with individual char ops.
      const delta = Math.abs(newText.length - oldText.length);

      if (delta > 80) {
        contentRef.current = newText;
        setContent(newText);
        socketService.sendReplace(newText);
        return;
      }

      // Generate char-level ops from the diff
      const ops = diffToOps(oldText, newText, userId, versionRef.current);

      // Update local state immediately (optimistic)
      contentRef.current = newText;
      setContent(newText);

      // Send each op to server
      ops.forEach((op) => socketService.sendOperation(op));
    },
    [userId]
  );

  // ── Cursor tracking ───────────────────────────────────────────────────────

  const handleCursorChange = useCallback((pos, selection) => {
    cursorPosRef.current = pos;
    socketService.sendCursorUpdate(pos, selection);
  }, []);

  // ── Title change ──────────────────────────────────────────────────────────

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      document.title = `${newTitle} — Collab`;
      socketService.sendTitleChange(newTitle);
    },
    []
  );

  return {
    content,
    title,
    activeUsers,
    connectionStatus,
    serverVersion,
    myInfo,
    textareaRef,
    handleLocalChange,
    handleCursorChange,
    handleTitleChange,
  };
}
