/**
 * server.js — Entry point for the collaborative editor backend.
 *
 * Sets up Express + Socket.io with CORS, health-check endpoint,
 * and delegates real-time events to the collaboration handler.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const collaborationHandler = require('./handlers/collaborationHandler');
const documentManager = require('./managers/documentManager');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5174';
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ── REST endpoints ────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Create a new document and return its ID
app.post('/api/documents', (_req, res) => {
  const docId = uuidv4();
  documentManager.getOrCreate(docId); // initialize empty doc
  res.json({ docId });
});

// Get document snapshot (for SSR / link preview)
app.get('/api/documents/:docId', (req, res) => {
  const { docId } = req.params;
  const snapshot = documentManager.getSnapshot(docId);
  res.json(snapshot);
});

// List all documents
app.get('/api/documents', (_req, res) => {
  res.json(documentManager.listDocuments());
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Reconnection handled client-side; these keep transports efficient
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

io.on('connection', (socket) => {
  collaborationHandler(io, socket);
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀  Collaborative Editor server running`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Accepting connections from ${CLIENT_ORIGIN}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});
