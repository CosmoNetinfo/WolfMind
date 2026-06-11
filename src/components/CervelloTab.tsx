import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CervelloTabProps {
  onRefreshKB: () => void;
  kbFiles: Record<string, string>;
  onLog: (msg: string) => void;
}

export default function CervelloTab({ onRefreshKB, kbFiles, onLog }: CervelloTabProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [newFileName, setNewFileName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (selectedFile && kbFiles[selectedFile] !== undefined) {
      setEditorContent(kbFiles[selectedFile]);
    }
  }, [selectedFile, kbFiles]);

  const handleSelectFile = (name: string) => {
    setSelectedFile(name);
    setEditorContent(kbFiles[name] || '');
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    try {
      await invoke('save_kb_file', { name: selectedFile, content: editorContent });
      onLog(`File salvato: ${selectedFile}`);
      onRefreshKB();
      alert(`File '${selectedFile}' salvato con successo!`);
    } catch (e: any) {
      onLog(`Errore nel salvataggio del file: ${e}`);
      alert(`Errore: ${e}`);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    let name = newFileName.trim();
    if (!name.endsWith('.md')) {
      name += '.md';
    }
    try {
      await invoke('save_kb_file', { name, content: `# ${name.replace('.md', '')}\n\nInserisci qui il contenuto...` });
      onLog(`File creato: ${name}`);
      setNewFileName('');
      setIsCreating(false);
      onRefreshKB();
      setSelectedFile(name);
    } catch (e: any) {
      onLog(`Errore nella creazione del file: ${e}`);
      alert(`Errore: ${e}`);
    }
  };

  const handleDeleteFile = async (name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il file '${name}'?`)) {
      return;
    }
    try {
      await invoke('delete_kb_file', { name });
      onLog(`File eliminato: ${name}`);
      if (selectedFile === name) {
        setSelectedFile(null);
        setEditorContent('');
      }
      onRefreshKB();
    } catch (e: any) {
      onLog(`Errore nell'eliminazione del file: ${e}`);
      alert(`Errore: ${e}`);
    }
  };

  const filteredFiles = Object.keys(kbFiles).filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full gap-4 p-4 text-gray-200">
      {/* File List Panel */}
      <div className="flex w-1/3 flex-col rounded-xl glass border border-gray-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold glow-text-cyan flex items-center gap-2">
            <svg className="w-5 h-5 text-glowCyan animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Cervello Locale
          </h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="p-1.5 rounded-lg bg-darkSecondary border border-gray-700 hover:border-glowCyan text-glowCyan transition-all"
            title="Nuovo File"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Cerca file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-darkBg text-xs border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 focus:outline-none focus:border-glowCyan text-gray-300 transition-colors"
          />
          <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateFile} className="mb-4 p-3 bg-darkBg rounded-lg border border-gray-800 flex gap-2">
            <input
              type="text"
              placeholder="nome-file.md"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="flex-1 bg-darkSecondary border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-glowCyan"
              autoFocus
            />
            <button type="submit" className="bg-darkSecondary text-glowCyan border border-gray-700 hover:border-glowCyan px-3 py-1 rounded text-xs transition-colors">
              Crea
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filteredFiles.length === 0 ? (
            <p className="text-gray-500 text-center text-xs py-8">Nessun file trovato</p>
          ) : (
            filteredFiles.map((name) => (
              <div
                key={name}
                onClick={() => handleSelectFile(name)}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                  selectedFile === name
                    ? 'bg-darkSecondary border-glowCyan text-white glow-shadow-cyan'
                    : 'bg-transparent border-transparent hover:bg-darkSecondary hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <svg className={`w-4 h-4 flex-shrink-0 ${selectedFile === name ? 'text-glowCyan' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs truncate font-medium">{name}</span>
                </div>
                {/* Delete button (only show on hover or when selected, except index/regole templates to protect them) */}
                {!['INDEX.md', 'regole-articoli.md', 'regole-yoast.md', 'stack-tecnologico.md', 'brief-template.md'].includes(name) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 rounded transition-opacity"
                    title="Elimina File"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col rounded-xl glass border border-gray-800 p-4">
        {selectedFile ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{selectedFile}</span>
                <span className="text-xxs px-2 py-0.5 rounded-full bg-darkSecondary border border-gray-700 text-gray-400">Markdown</span>
              </div>
              <button
                onClick={handleSaveFile}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-darkBg text-glowCyan border border-glowCyan/30 hover:border-glowCyan rounded-lg text-xs font-semibold glow-shadow-cyan-hover transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Salva Modifiche
              </button>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="flex-1 w-full bg-darkBg text-gray-300 font-mono text-xs p-4 rounded-lg border border-gray-800 focus:outline-none focus:border-glowCyan resize-none leading-relaxed"
              placeholder="Scrivi qui in Markdown..."
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm font-medium">Seleziona un file per iniziare a modificarlo</p>
            <p className="text-xs text-gray-600 mt-1">Le modifiche avranno effetto immediato sulle risposte dell'AI</p>
          </div>
        )}
      </div>
    </div>
  );
}
