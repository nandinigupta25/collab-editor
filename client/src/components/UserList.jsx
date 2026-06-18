/**
 * UserList.jsx
 *
 * Sidebar panel showing all active collaborators on the current document,
 * with color-coded avatars, names, and a live "typing" indicator when their
 * cursor is detected as moving.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Users, Wifi, WifiOff, Loader } from 'lucide-react';

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ userName, color, isTyping }) {
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold select-none"
        style={{ backgroundColor: color }}
        title={userName}
      >
        {initials}
      </div>
      {isTyping && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

// ── Connection status badge ───────────────────────────────────────────────────

function ConnectionBadge({ status }) {
  const config = {
    connected: {
      icon: <Wifi size={12} />,
      label: 'Live',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotCls: 'connected',
    },
    connecting: {
      icon: <Loader size={12} className="animate-spin" />,
      label: 'Connecting',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dotCls: 'connecting',
    },
    disconnected: {
      icon: <WifiOff size={12} />,
      label: 'Offline',
      cls: 'bg-red-50 text-red-600 border-red-200',
      dotCls: 'disconnected',
    },
  }[status] || {};

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${config.cls}`}
    >
      <span className={`status-dot ${config.dotCls}`} />
      {config.label}
    </div>
  );
}

// ── Main UserList ─────────────────────────────────────────────────────────────

export default function UserList({ activeUsers, myInfo, connectionStatus, serverVersion }) {
  // Track which users have moved their cursor recently (within 2 s) → "typing"
  const [typingSet, setTypingSet] = useState(new Set());
  const prevCursors = useRef({});
  const timers = useRef({});

  useEffect(() => {
    activeUsers.forEach((user) => {
      const prev = prevCursors.current[user.socketId];
      const curr = user.cursor?.pos;
      if (prev !== undefined && prev !== curr) {
        // Cursor moved → mark as typing
        setTypingSet((s) => new Set([...s, user.socketId]));
        clearTimeout(timers.current[user.socketId]);
        timers.current[user.socketId] = setTimeout(() => {
          setTypingSet((s) => {
            const next = new Set(s);
            next.delete(user.socketId);
            return next;
          });
        }, 2000);
      }
      prevCursors.current[user.socketId] = curr;
    });
  }, [activeUsers]);

  const totalCount = (myInfo ? 1 : 0) + activeUsers.length;

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-l border-ink-100 flex flex-col h-full shadow-sidebar">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-ink-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-ink-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Collaborators
            </span>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </div>
        <p className="text-xs text-ink-400">
          {totalCount === 1 ? '1 person' : `${totalCount} people`} in this document
        </p>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {/* Me */}
        {myInfo && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-ink-50">
            <Avatar userName={myInfo.userName} color={myInfo.color} isTyping={false} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-800 truncate">
                {myInfo.userName}
              </p>
              <p className="text-xs text-ink-400">You</p>
            </div>
            <div
              className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: myInfo.color }}
            />
          </div>
        )}

        {/* Others */}
        {activeUsers.map((user) => (
          <div
            key={user.socketId}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ink-50 transition-colors animate-slide-in"
          >
            <Avatar
              userName={user.userName}
              color={user.color}
              isTyping={typingSet.has(user.socketId)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-800 truncate">{user.userName}</p>
              {typingSet.has(user.socketId) ? (
                <p className="text-xs text-ink-400 flex items-center gap-1">
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block w-1 h-1 rounded-full bg-ink-400"
                        style={{ animation: `pulseDot 1s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </span>
                  typing
                </p>
              ) : (
                <p className="text-xs text-ink-400">
                  pos {user.cursor?.pos ?? '—'}
                </p>
              )}
            </div>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.color }}
            />
          </div>
        ))}

        {activeUsers.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-xs text-ink-300">No other collaborators yet.</p>
            <p className="text-xs text-ink-300 mt-1">Share the URL to invite others.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-ink-100">
        <p className="text-xs text-ink-300">
          Version <span className="font-mono">{serverVersion}</span>
        </p>
      </div>
    </aside>
  );
}
