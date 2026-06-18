/**
 * DocumentManager
 *
 * Manages in-memory document state using a simplified CRDT approach.
 * Each operation carries a Lamport timestamp and a unique site ID,
 * allowing deterministic merge of concurrent edits without data loss.
 *
 * Operations:
 *   { type: 'insert', pos: number, char: string, opId: string, siteId: string, timestamp: number }
 *   { type: 'delete', pos: number, opId: string, siteId: string, timestamp: number }
 *
 * The server maintains the canonical "content" string and a log of all
 * operations so late-joining clients can catch up instantly.
 */

class DocumentManager {
  constructor() {
    // Map of docId -> { content: string, operations: [], version: number, title: string }
    this.documents = new Map();
  }

  /**
   * Returns or creates a document by ID.
   */
  getOrCreate(docId) {
    if (!this.documents.has(docId)) {
      this.documents.set(docId, {
        content: '',
        operations: [],
        version: 0,
        title: 'Untitled Document',
        createdAt: new Date().toISOString(),
      });
    }
    return this.documents.get(docId);
  }

  /**
   * Returns current document snapshot (content + version).
   */
  getSnapshot(docId) {
    const doc = this.getOrCreate(docId);
    return {
      content: doc.content,
      version: doc.version,
      title: doc.title,
      createdAt: doc.createdAt,
    };
  }

  /**
   * Applies an operation to the document and returns the transformed op
   * that should be broadcast to all other clients.
   *
   * Uses Operational Transformation against all concurrent ops that have
   * a higher (or equal) timestamp from a different site that arrived before
   * this op was applied server-side.
   */
  applyOperation(docId, op) {
    const doc = this.getOrCreate(docId);

    // Assign server-side version
    const serverOp = { ...op, serverVersion: doc.version };

    // Transform op against any operations that happened concurrently
    // (i.e., operations the client hadn't seen yet when it sent this op)
    const concurrentOps = doc.operations.filter(
      (existing) => existing.serverVersion >= (op.clientVersion ?? 0)
    );

    let transformedOp = { ...serverOp };
    for (const concurrent of concurrentOps) {
      transformedOp = this._transform(transformedOp, concurrent);
    }

    // Apply the transformed op to document content
    doc.content = this._applyToString(doc.content, transformedOp);
    doc.version += 1;
    transformedOp.serverVersion = doc.version;

    // Store in operation log (keep last 2000 ops to prevent unbounded growth)
    doc.operations.push(transformedOp);
    if (doc.operations.length > 2000) {
      doc.operations = doc.operations.slice(-2000);
    }

    return transformedOp;
  }

  /**
   * Updates the document title.
   */
  updateTitle(docId, title) {
    const doc = this.getOrCreate(docId);
    doc.title = title.slice(0, 100); // cap at 100 chars
    return doc.title;
  }

  /**
   * Operational Transformation: transform op1 against op2.
   * Both were generated concurrently from the same base state.
   */
  _transform(op1, op2) {
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op2.pos < op1.pos || (op2.pos === op1.pos && op2.siteId < op1.siteId)) {
        return { ...op1, pos: op1.pos + op2.char.length };
      }
      return op1;
    }

    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op2.pos < op1.pos) {
        return { ...op1, pos: Math.max(0, op1.pos - 1) };
      }
      return op1;
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op2.pos <= op1.pos) {
        return { ...op1, pos: op1.pos + op2.char.length };
      }
      return op1;
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op2.pos < op1.pos) {
        return { ...op1, pos: Math.max(0, op1.pos - 1) };
      }
      if (op2.pos === op1.pos) {
        // Already deleted by concurrent op — make this a no-op
        return { ...op1, type: 'noop' };
      }
      return op1;
    }

    return op1;
  }

  /**
   * Applies a single operation to a string, returning the new string.
   */
  _applyToString(content, op) {
    if (op.type === 'noop') return content;

    if (op.type === 'insert') {
      const pos = Math.min(Math.max(0, op.pos), content.length);
      return content.slice(0, pos) + op.char + content.slice(pos);
    }

    if (op.type === 'delete') {
      if (op.pos < 0 || op.pos >= content.length) return content;
      return content.slice(0, op.pos) + content.slice(op.pos + 1);
    }

    // Full content replacement (used for paste / large bulk edits)
    if (op.type === 'replace') {
      return op.content ?? content;
    }

    return content;
  }

  /**
   * Applies a bulk-replace operation (used for initial paste or full sync).
   */
  applyReplace(docId, content, siteId) {
    const doc = this.getOrCreate(docId);
    const op = {
      type: 'replace',
      content,
      siteId,
      serverVersion: doc.version + 1,
      clientVersion: doc.version,
      opId: `${siteId}-replace-${Date.now()}`,
    };
    doc.content = content;
    doc.version += 1;
    doc.operations.push(op);
    return op;
  }

  /**
   * Returns list of all tracked document IDs.
   */
  listDocuments() {
    return Array.from(this.documents.entries()).map(([id, doc]) => ({
      id,
      title: doc.title,
      version: doc.version,
      createdAt: doc.createdAt,
    }));
  }
}

module.exports = new DocumentManager();
