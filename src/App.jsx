import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';
import {
  FileText,
  Download,
  Share2,
  Cloud,
  Check,
  Sparkles,
  Printer,
  RotateCcw,
  Code2,
  Eye,
  Columns
} from 'lucide-react';
import {
  isFirebaseConfigured,
  saveCloudSnippet,
  loadCloudSnippet
} from './firebase';

const DEFAULT_DOC = `# System Architecture & API Specification

Welcome to **Live Markdown & Diagram Studio** — a Rich Internet Application (RIA) built for instant technical documentation, live Mermaid diagrams, and one-click sharing.

## 1. Request Lifecycle Diagram

\`\`\`mermaid
sequenceDiagram
    participant Client as Browser SPA
    participant Edge as Vercel / Firebase CDN
    participant Store as LocalStorage / Firestore
    Client->>Edge: Load Static Bundle
    Client->>Store: Auto-Sync Document State
    Store-->>Client: Hydrate Shared Note (?id=...)
\`\`\`

## 2. Endpoint Matrix

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| \`GET\` | \`/api/notebooks/:id\` | No | Fetch public read-only note |
| \`POST\` | \`/api/notebooks\` | Yes | Create or update cloud snapshot |

## 3. Sample Edge Function

\`\`\`javascript
export default async function handler(req, res) {
  const { id } = req.query;
  return res.status(200).json({ id, status: 'ready', timestamp: Date.now() });
}
\`\`\`

> **Tip:** Edit anything on the left pane. Changes auto-save locally in real time, and you can generate a shareable URL or export HTML/PDF anytime.
`;

mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

export default function App() {
  const [title, setTitle] = useState('Architecture Spec v1');
  const [markdown, setMarkdown] = useState(DEFAULT_DOC);
  const [viewMode, setViewMode] = useState('split'); // 'edit' | 'split' | 'preview'
  const [statusMsg, setStatusMsg] = useState('Saved locally');
  const [copied, setCopied] = useState(false);
  const [cloudId, setCloudId] = useState('');
  const previewRef = useRef(null);

  // Hydrate from URL hash/query or localStorage on initial mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('data');
    const noteId = params.get('id');

    if (noteId && isFirebaseConfigured) {
      setCloudId(noteId);
      loadCloudSnippet(noteId)
        .then((docData) => {
          if (docData) {
            setTitle(docData.title || 'Shared Note');
            setMarkdown(docData.content || '');
            setStatusMsg(`Loaded cloud note #${noteId}`);
          }
        })
        .catch(() => setStatusMsg('Cloud load failed; using local draft'));
      return;
    }

    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
        if (decoded.title) setTitle(decoded.title);
        if (decoded.markdown) setMarkdown(decoded.markdown);
        setStatusMsg('Loaded from shareable link');
        return;
      } catch {
        // Fallback to localStorage if link payload is malformed
      }
    }

    const saved = localStorage.getItem('ria_studio_doc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTitle(parsed.title || 'Architecture Spec v1');
        setMarkdown(parsed.markdown || DEFAULT_DOC);
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  // Auto-save to localStorage & render Markdown + Mermaid diagrams
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(
        'ria_studio_doc',
        JSON.stringify({ title, markdown })
      );
      setStatusMsg('Auto-saved locally');
    }, 300);

    if (previewRef.current) {
      const rawHtml = marked.parse(markdown, { breaks: true });
      previewRef.current.innerHTML = rawHtml;

      const codeBlocks = previewRef.current.querySelectorAll(
        'pre code.language-mermaid'
      );
      codeBlocks.forEach((block, idx) => {
        const graphDefinition = block.textContent;
        const container = document.createElement('div');
        container.className = 'my-4 flex justify-center bg-white p-4 rounded-lg border border-stone-200';
        const id = `mermaid-svg-${idx}-${Date.now()}`;
        mermaid
          .render(id, graphDefinition)
          .then(({ svg }) => {
            container.innerHTML = svg;
            block.parentElement.replaceWith(container);
          })
          .catch(() => {
            container.innerHTML = `<p class="text-red-600 text-xs font-mono">Mermaid syntax error</p>`;
            block.parentElement.replaceWith(container);
          });
      });
    }

    return () => clearTimeout(timer);
  }, [markdown, title, viewMode]);

  const handleShareLink = () => {
    const payload = btoa(
      unescape(encodeURIComponent(JSON.stringify({ title, markdown })))
    );
    const url = `${window.location.origin}${window.location.pathname}?data=${payload}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setStatusMsg('Shareable URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCloudSave = async () => {
    if (!isFirebaseConfigured) {
      setStatusMsg('Add Firebase keys in .env to enable Cloud Sync');
      return;
    }
    const id = cloudId || Math.random().toString(36).substring(2, 9);
    try {
      setStatusMsg('Syncing to Firestore...');
      await saveCloudSnippet(id, title, markdown);
      setCloudId(id);
      const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
      window.history.replaceState({}, '', url);
      navigator.clipboard.writeText(url);
      setStatusMsg(`Synced to Firestore & copied link (?id=${id})`);
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleExportHtml = () => {
    const htmlContent = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1c1917}pre{background:#1c1917;color:#f5f5f4;padding:1rem;border-radius:8px;overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6d3d1;padding:8px;text-align:left}</style>
</head><body><h1>${title}</h1>${previewRef.current?.innerHTML || ''}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
  };

  const insertTemplate = (snippet) => {
    setMarkdown((prev) => `${prev}

${snippet}`);
  };

  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Top Toolbar */}
      <header className="no-print bg-white border-b border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-600 text-white p-1.5 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Document Title"
            className="font-semibold text-stone-800 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-amber-600 focus:outline-none px-1 py-0.5 text-base"
          />
          <span className="hidden sm:inline-block text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            {statusMsg}
          </span>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
              viewMode === 'edit' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-600'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Editor
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
              viewMode === 'split' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-600'
            }`}
          >
            <Columns className="w-3.5 h-3.5" /> Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
              viewMode === 'preview' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-600'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            onClick={handleShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Share URL'}
          </button>
          <button
            onClick={handleCloudSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white transition"
            title="Requires Firebase .env config"
          >
            <Cloud className="w-3.5 h-3.5" /> Cloud Sync
          </button>
          <button
            onClick={handleExportHtml}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> HTML
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 transition"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </header>

      {/* Quick Insert Ribbon */}
      <div className="no-print bg-stone-100 border-b border-stone-200 px-4 py-1.5 flex items-center justify-between text-xs text-stone-600">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-medium text-stone-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Insert:
          </span>
          <button
            onClick={() =>
              insertTemplate(
                '```mermaid\ngraph TD\n    A[Start] --> B{Valid?}\n    B -->|Yes| C[Deploy]\n    B -->|No| D[Fix]\n```'
              )
            }
            className="px-2 py-0.5 bg-white border border-stone-300 rounded hover:border-amber-500"
          >
            + Flowchart
          </button>
          <button
            onClick={() =>
              insertTemplate(
                '| Feature | Status | Owner |\n| :--- | :--- | :--- |\n| Auth | Ready | Frontend |'
              )
            }
            className="px-2 py-0.5 bg-white border border-stone-300 rounded hover:border-amber-500"
          >
            + Table
          </button>
          <button
            onClick={() => {
              setMarkdown(DEFAULT_DOC);
              setStatusMsg('Reset to starter template');
            }}
            className="px-2 py-0.5 bg-white border border-stone-300 rounded hover:text-red-600 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="hidden md:block text-stone-500">
          {wordCount} words · {markdown.length} chars
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
        {viewMode !== 'preview' && (
          <section className={`no-print flex flex-col ${viewMode === 'edit' ? 'md:col-span-2' : ''}`}>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              placeholder="Write Markdown or ```mermaid diagrams here..."
              className="w-full flex-1 p-6 font-mono text-sm bg-stone-900 text-stone-100 focus:outline-none resize-none leading-relaxed min-h-[75vh]"
            />
          </section>
        )}

        {viewMode !== 'edit' && (
          <section className={`print-full bg-white p-6 md:p-8 overflow-y-auto ${viewMode === 'preview' ? 'md:col-span-2 max-w-4xl mx-auto w-full' : ''}`}>
            <div ref={previewRef} className="markdown-preview" />
          </section>
        )}
      </main>
    </div>
  );
}
