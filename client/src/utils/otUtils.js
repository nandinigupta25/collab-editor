/**
 * otUtils.js
 *
 * Client-side utilities for generating Operational Transformation ops
 * from textarea diffs, and for adjusting local cursor position after
 * a remote op is applied so the caret never jumps unexpectedly.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Diff two strings and return a list of atomic insert/delete operations.
 * Uses the simplest approach: find the common prefix & suffix, then emit
 * deletes for removed chars (right-to-left) and inserts for added chars.
 *
 * @param {string} oldText
 * @param {string} newText
 * @param {string} siteId  - unique identifier for this client
 * @param {number} clientVersion - current known server version
 * @returns {Array<Op>}
 */
export function diffToOps(oldText, newText, siteId, clientVersion) {
  // Find common prefix length
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix length (from end, not overlapping prefix)
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldMiddle = oldText.slice(prefixLen, oldText.length - suffixLen);
  const newMiddle = newText.slice(prefixLen, newText.length - suffixLen);

  const ops = [];
  const timestamp = Date.now();

  // Delete characters in the old middle section (high-to-low pos so indices stay stable)
  for (let i = oldMiddle.length - 1; i >= 0; i--) {
    ops.push({
      type: 'delete',
      pos: prefixLen + i,
      siteId,
      clientVersion,
      timestamp,
      opId: uuidv4(),
    });
  }

  // Insert characters from the new middle section
  for (let i = 0; i < newMiddle.length; i++) {
    ops.push({
      type: 'insert',
      pos: prefixLen + i,
      char: newMiddle[i],
      siteId,
      clientVersion,
      timestamp,
      opId: uuidv4(),
    });
  }

  return ops;
}

/**
 * Adjust a local cursor position given an incoming remote operation,
 * so the cursor appears to stay in the same logical position in the text.
 *
 * @param {number} cursorPos   - current local cursor position
 * @param {object} remoteOp   - the transformed op from the server
 * @returns {number}           - adjusted cursor position
 */
export function adjustCursorForRemoteOp(cursorPos, remoteOp) {
  if (remoteOp.type === 'insert') {
    // If insert happened before or at cursor, push cursor right
    if (remoteOp.pos <= cursorPos) {
      return cursorPos + 1;
    }
  } else if (remoteOp.type === 'delete') {
    // If delete happened before cursor, pull cursor left
    if (remoteOp.pos < cursorPos) {
      return Math.max(0, cursorPos - 1);
    }
  }
  return cursorPos;
}

/**
 * Apply a single op directly to a string (mirrors server logic for instant local preview).
 */
export function applyOpToString(content, op) {
  if (op.type === 'insert') {
    const pos = Math.min(Math.max(0, op.pos), content.length);
    return content.slice(0, pos) + op.char + content.slice(pos);
  }
  if (op.type === 'delete') {
    if (op.pos < 0 || op.pos >= content.length) return content;
    return content.slice(0, op.pos) + content.slice(op.pos + 1);
  }
  if (op.type === 'replace') {
    return op.content ?? content;
  }
  return content;
}

/**
 * Generate a random adjective+noun display name.
 */
export function generateUserName() {
  const adjectives = ['Swift', 'Calm', 'Bold', 'Keen', 'Wise', 'Jade', 'Amber', 'Crisp'];
  const nouns = ['Fox', 'Owl', 'Elk', 'Jay', 'Hawk', 'Wolf', 'Bear', 'Deer'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

/**
 * Generate a stable anonymous user ID stored in sessionStorage.
 */
export function getOrCreateUserId() {
  const key = 'collab_user_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/**
 * Generate or retrieve a stable display name stored in sessionStorage.
 */
export function getOrCreateUserName() {
  const key = 'collab_user_name';
  let name = sessionStorage.getItem(key);
  if (!name) {
    name = generateUserName();
    sessionStorage.setItem(key, name);
  }
  return name;
}
