# Collab — Real-time Collaborative Text Editor

A production-ready, Google Docs-style collaborative editor built with:

- **Frontend**: React (Vite) + Tailwind CSS + Lucide React
- **Backend**: Node.js + Express
- **Real-time**: Socket.io (WebSockets with polling fallback)
- **Sync**: Operational Transformation (OT) for conflict-free concurrent edits

---

## Quick Start

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Start both server and client (requires `concurrently`)

```bash
npm install          # installs concurrently at root
npm run dev
```

Or start them separately in two terminals:

```bash
# Terminal 1 — backend (port 3001)
cd server && npm run dev

# Terminal 2 — frontend (port 5173)
cd client && npm run dev
```

### 3. Open and collaborate

1. Navigate to `http://localhost:5173`
2. Click **New Document** — you'll be redirected to a unique document URL like `/doc/<uuid>`
3. Copy the URL and open it in a second browser window/tab
4. Both windows edit the same document in real time 🎉

---

## Project Structure

```
collab-editor/
├── package.json                  ← root: run both together with concurrently
│
├── server/
│   ├── package.json
│   ├── server.js                 ← Express + Socket.io init, REST endpoints
│   ├── handlers/
│   │   └── collaborationHandler.js  ← all Socket.io event logic
│   └── managers/
│       ├── documentManager.js    ← OT engine + in-memory document store
│       └── presenceManager.js    ← active user tracking per document
│
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx              ← React entry point
        ├── App.jsx               ← React Router root
        ├── index.css             ← Tailwind directives + custom CSS
        ├── utils/
        │   ├── socketService.js  ← Socket.io singleton client + queue
        │   └── otUtils.js        ← diff→ops, cursor adjustment, OT helpers
        ├── hooks/
        │   └── useCollaboration.js  ← master hook: socket ↔ React state bridge
        └── components/
            ├── App.jsx           ← routes
            ├── HomePage.jsx      ← document list + create
            ├── DocumentPage.jsx  ← page shell (composes everything)
            ├── Editor.jsx        ← textarea canvas + remote cursor overlay
            ├── UserList.jsx      ← collaborator sidebar
            └── Toolbar.jsx       ← top bar: status, share, nav
```

---

## How OT Works (in this implementation)

1. **Client types** → `diffToOps()` computes a minimal set of `insert`/`delete` ops from the old↔new textarea string diff.
2. **Ops are sent** to the server with the client's last-known `clientVersion`.
3. **Server transforms** each incoming op against any concurrent ops (those with a `serverVersion` ≥ the sender's `clientVersion`) using the classic OT *include* transformation.
4. **Transformed op** is stored in the document log, applied to the canonical string, and broadcast to all other clients.
5. **Remote client** receives the transformed op, applies it to its local string, and adjusts its cursor position so the caret doesn't jump.

Large changes (paste, undo of many chars) skip char-level ops and send a full `replace_content` broadcast instead.

---

## Features

| Feature | Details |
|---|---|
| Real-time sync | Character-level OT via Socket.io |
| Presence awareness | Live collaborator list with color-coded avatars |
| Cursor indicators | Remote users' cursors shown as coloured carets with name labels |
| Auto-reconnect | Exponential backoff, re-joins document on reconnect |
| Bulk paste | Detected automatically, sent as full replace instead of N ops |
| Title sync | Document title synced across all connected clients |
| Document list | Home page shows all server-side documents |
| No auth required | Ephemeral user IDs stored in sessionStorage |

---

## Environment Variables

### Client (`client/.env`)
```
VITE_SERVER_URL=http://localhost:3001
```

### Server (optional env vars)
```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```
