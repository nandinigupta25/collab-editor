/**
 * App.jsx
 *
 * Root component. Sets up client-side routing:
 *   /          → HomePage   (document list + create)
 *   /doc/:docId → DocumentPage (collaborative editor)
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import DocumentPage from './components/DocumentPage';

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<HomePage />} />
      <Route path="/doc/:docId" element={<DocumentPage />} />
      {/* Catch-all: redirect unknown routes to home */}
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
