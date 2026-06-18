/**
 * Toolbar.jsx
 *
 * Top application bar: branding, document actions, share, connection status.
 */

import React, { useState, useCallback } from 'react';
import {
  FileText,
  Share2,
  Check,
  ChevronLeft,
  Wifi,
  WifiOff,
  Loader,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socketService';

export default function Toolbar({ connectionStatus, docId }) {
  const navigate = useNavigate();
  const [copied, setCopied]   = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without HTTPS
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleForceSync = useCallback(() => {
    setSyncing(true);
    socketService.requestSync();
    setTimeout(() => setSyncing(false), 1000);
  }, []);

  const statusConfig = {
    connected:    { label: 'Synced',      Icon: Wifi,    cls: 'text-emerald-600' },
    connecting:   { label: 'Connecting…', Icon: Loader,  cls: 'text-amber-500' },
    disconnected: { label: 'Offline',     Icon: WifiOff, cls: 'text-red-500' },
  }[connectionStatus] || {};

  const { label: statusLabel, Icon: StatusIcon, cls: statusCls } = statusConfig;

  return (
    <header className="h-12 flex items-center px-4 gap-3 bg-white border-b border-ink-100 flex-shrink-0">
      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        className="p-1.5 rounded-md hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition-colors"
        title="All documents"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-1.5">
        <FileText size={16} className="text-accent" />
        <span className="font-semibold text-sm text-ink-800 font-sans tracking-tight">
          Collab
        </span>
      </div>

      <div className="w-px h-5 bg-ink-100 mx-1" />

      {/* Doc ID pill */}
      <span className="text-xs text-ink-400 font-mono truncate max-w-[120px] hidden sm:inline">
        {docId?.slice(0, 8)}…
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status */}
      <div className={`flex items-center gap-1.5 text-xs font-medium ${statusCls}`}>
        {connectionStatus === 'connecting' ? (
          <StatusIcon size={13} className="animate-spin" />
        ) : (
          <StatusIcon size={13} />
        )}
        <span className="hidden sm:inline">{statusLabel}</span>
      </div>

      {/* Force sync button (shown when offline or as recovery) */}
      {connectionStatus !== 'connected' && (
        <button
          onClick={handleForceSync}
          title="Force sync"
          className="p-1.5 rounded-md hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition-colors"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        </button>
      )}

      {/* Share / copy link */}
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-blue-700 transition-colors"
      >
        {copied ? <Check size={13} /> : <Share2 size={13} />}
        {copied ? 'Copied!' : 'Share'}
      </button>
    </header>
  );
}
