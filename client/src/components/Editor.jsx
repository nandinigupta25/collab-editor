/**
 * Editor.jsx
 *
 * The main text editing canvas.
 *
 * Design decisions:
 * - Uses a <textarea> rather than contentEditable. This makes OT cursor math
 *   trivial (selectionStart / selectionEnd are plain integers) and avoids the
 *   notorious inconsistencies of contentEditable across browsers.
 * - Remote user cursors are rendered as absolutely-positioned overlays on a
 *   hidden <div> that mirrors the textarea content and dimensions.
 * - Local edits fire `onChange` → diff → ops → server.  We never replace
 *   `value` from a remote op without first saving + restoring selectionStart
 *   (done in useCollaboration via RAF).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── RemoteCursorOverlay ───────────────────────────────────────────────────────

/**
 * Renders coloured caret lines + name labels at each remote user's cursor
 * position by mirroring the textarea into a hidden div and measuring text
 * geometry with a canvas.
 *
 * This is a best-effort visual: pixel-perfect only when font / line-height
 * of the mirror div matches the textarea exactly.
 */
function RemoteCursorOverlay({ content, activeUsers, textareaRef }) {
  const mirrorRef = useRef(null);
  const [caretPositions, setCaretPositions] = useState([]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const mirror   = mirrorRef.current;
    if (!textarea || !mirror) return;

    // Copy computed styles that affect text layout
    const cs = window.getComputedStyle(textarea);
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
      'letterSpacing', 'wordSpacing', 'padding', 'paddingTop',
      'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderLeft', 'borderRight', 'width', 'whiteSpace', 'wordBreak',
    ];
    props.forEach((p) => (mirror.style[p] = cs[p]));
    mirror.style.position  = 'absolute';
    mirror.style.top       = '0';
    mirror.style.left      = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow  = 'hidden';
    mirror.style.height    = 'auto';
    mirror.style.border    = 'none';
    mirror.style.background = 'transparent';

    // Compute caret pixel position for each remote user
    const positions = activeUsers
      .filter((u) => u.cursor?.pos !== undefined)
      .map((user) => {
        const pos = Math.min(Math.max(0, user.cursor.pos), content.length);

        // Render text up to cursor in the mirror div
        const before = document.createElement('span');
        before.textContent = content.slice(0, pos);
        const caret = document.createElement('span');
        caret.textContent = '|';
        mirror.innerHTML = '';
        mirror.appendChild(before);
        mirror.appendChild(caret);

        const mirrorRect  = mirror.getBoundingClientRect();
        const caretRect   = caret.getBoundingClientRect();

        return {
          socketId: user.socketId,
          userName: user.userName,
          color:    user.color,
          top:  caretRect.top  - mirrorRect.top  + textarea.scrollTop,
          left: caretRect.left - mirrorRect.left,
        };
      });

    setCaretPositions(positions);
  }, [content, activeUsers, textareaRef]);

  return (
    <>
      {/* Hidden mirror div for measurement */}
      <div ref={mirrorRef} aria-hidden="true" className="pointer-events-none select-none" />

      {/* Cursor overlays */}
      {caretPositions.map((c) => (
        <div
          key={c.socketId}
          className="pointer-events-none absolute"
          style={{ top: c.top, left: c.left }}
        >
          {/* Caret line */}
          <div
            className="absolute"
            style={{
              width: '2px',
              height: '1.35em',
              backgroundColor: c.color,
              borderRadius: '1px',
              marginLeft: '-1px',
            }}
          />
          {/* Name label */}
          <div
            className="absolute text-white text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{
              backgroundColor: c.color,
              top: '-1.6em',
              left: '-1px',
              fontSize: '0.6rem',
              lineHeight: '1.4',
            }}
          >
            {c.userName}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export default function Editor({
  content,
  title,
  activeUsers,
  myInfo,
  textareaRef,
  onContentChange,
  onCursorChange,
  onTitleChange,
}) {
  const wrapperRef       = useRef(null);
  const titleInputRef    = useRef(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Update stats whenever content changes
  useEffect(() => {
    setCharCount(content.length);
    const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
    setWordCount(words);
  }, [content]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e) => {
      const newText   = e.target.value;
      const cursorPos = e.target.selectionStart;
      onContentChange(newText, cursorPos);
    },
    [onContentChange]
  );

  const handleKeyUp = useCallback(
    (e) => {
      const el = e.target;
      onCursorChange(el.selectionStart, {
        start: el.selectionStart,
        end:   el.selectionEnd,
      });
    },
    [onCursorChange]
  );

  const handleClick = useCallback(
    (e) => {
      const el = e.target;
      onCursorChange(el.selectionStart, {
        start: el.selectionStart,
        end:   el.selectionEnd,
      });
    },
    [onCursorChange]
  );

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    },
    [textareaRef]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-ink-50">
      {/* ── Document header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 pt-5 pb-2 bg-white border-b border-ink-100">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          maxLength={100}
          placeholder="Untitled Document"
          className="flex-1 text-lg font-semibold text-ink-900 bg-transparent border-none outline-none placeholder-ink-300 min-w-0 mr-4 font-sans"
          aria-label="Document title"
        />

        {/* Collaborator avatar stack */}
        {activeUsers.length > 0 && (
          <div className="flex -space-x-2 mr-3">
            {activeUsers.slice(0, 5).map((user) => (
              <div
                key={user.socketId}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold select-none"
                style={{ backgroundColor: user.color }}
                title={user.userName}
              >
                {user.userName.charAt(0).toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-7 h-7 rounded-full border-2 border-white bg-ink-300 flex items-center justify-center text-white text-xs font-bold">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-ink-400 font-sans flex-shrink-0">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="text-ink-200">·</span>
          <span>{charCount} {charCount === 1 ? 'char' : 'chars'}</span>
        </div>
      </div>

      {/* ── Page canvas ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div
          className="mx-auto bg-white rounded-sm shadow-page"
          style={{ maxWidth: '720px', minHeight: 'calc(100vh - 180px)' }}
        >
          {/* Relative wrapper so cursor overlay can be positioned inside */}
          <div ref={wrapperRef} className="relative px-14 py-12">
            {/* Remote cursor overlay */}
            <RemoteCursorOverlay
              content={content}
              activeUsers={activeUsers}
              textareaRef={textareaRef}
            />

            {/* Main textarea */}
            <textarea
              ref={textareaRef}
              className="editor-area w-full bg-transparent resize-none border-none"
              value={content}
              onChange={handleChange}
              onKeyUp={handleKeyUp}
              onClick={handleClick}
              onSelect={handleClick}
              placeholder="Start writing…"
              data-placeholder="Start writing…"
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
              aria-label="Document editor"
              style={{
                minHeight: 'calc(100vh - 280px)',
                // Override default textarea appearance
                caretColor: myInfo?.color ?? '#2563EB',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
