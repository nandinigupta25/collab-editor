/**
 * DocumentPage.jsx
 *
 * Top-level page for editing a specific document.
 * Composes Toolbar, Editor, and UserList, feeding them
 * data from the useCollaboration hook.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollaboration } from '../hooks/useCollaboration';
import Editor from './Editor';
import UserList from './UserList';
import Toolbar from './Toolbar';

export default function DocumentPage() {
  const { docId } = useParams();
  const navigate  = useNavigate();

  // Redirect to home if no docId
  useEffect(() => {
    if (!docId) navigate('/');
  }, [docId, navigate]);

  const {
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
  } = useCollaboration(docId);

  // Update browser title
  useEffect(() => {
    document.title = `${title || 'Untitled'} — Collab`;
  }, [title]);

  if (!docId) return null;

  return (
    <div className="h-screen flex flex-col bg-ink-50 overflow-hidden font-sans">
      {/* Top bar */}
      <Toolbar connectionStatus={connectionStatus} docId={docId} />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor canvas */}
        <Editor
          content={content}
          title={title}
          activeUsers={activeUsers}
          myInfo={myInfo}
          textareaRef={textareaRef}
          onContentChange={handleLocalChange}
          onCursorChange={handleCursorChange}
          onTitleChange={handleTitleChange}
        />

        {/* Collaborator sidebar */}
        <UserList
          activeUsers={activeUsers}
          myInfo={myInfo}
          connectionStatus={connectionStatus}
          serverVersion={serverVersion}
        />
      </div>
    </div>
  );
}
