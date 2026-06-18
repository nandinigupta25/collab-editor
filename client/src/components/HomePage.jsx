/**
 * HomePage.jsx
 *
 * Landing page: create a new document or open a recent one.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, ArrowRight, Clock } from 'lucide-react';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Load document list
  useEffect(() => {
    fetch(`${SERVER}/api/documents`)
      .then((r) => r.json())
      .then((docs) => {
        setRecentDocs(docs.slice(-10).reverse()); // show newest first
        setLoadingDocs(false);
      })
      .catch(() => setLoadingDocs(false));
  }, []);

  const createDocument = useCallback(async () => {
    setCreating(true);
    try {
      const res  = await fetch(`${SERVER}/api/documents`, { method: 'POST' });
      const data = await res.json();
      navigate(`/doc/${data.docId}`);
    } catch (err) {
      console.error('Failed to create document:', err);
      setCreating(false);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-ink-100 h-12 flex items-center px-6">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-accent" />
          <span className="font-semibold text-sm text-ink-800 tracking-tight">Collab</span>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-semibold text-ink-900 mb-3" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>
            Write together, in real time.
          </h1>
          <p className="text-ink-500 text-sm max-w-sm mx-auto">
            Create a document, share the link, and collaborate instantly — no sign-in required.
          </p>
        </div>

        {/* Create button */}
        <button
          onClick={createDocument}
          disabled={creating}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-accent hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md mb-10"
        >
          {creating ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Plus size={18} />
              New Document
            </>
          )}
        </button>

        {/* Recent documents */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-ink-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Recent Documents
            </h2>
          </div>

          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-ink-100 animate-pulse" />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="text-center py-10 text-ink-300 text-sm">
              No documents yet. Create your first one above.
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/doc/${doc.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-lg border border-ink-100 hover:border-accent hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    <FileText size={15} className="text-ink-400 group-hover:text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 truncate">
                      {doc.title || 'Untitled Document'}
                    </p>
                    <p className="text-xs text-ink-400 mt-0.5 font-mono">
                      {doc.id.slice(0, 8)}… · v{doc.version}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-ink-300 group-hover:text-accent transition-colors flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-ink-300">
        Real-time collaboration via Socket.io + Operational Transformation
      </footer>
    </div>
  );
}
