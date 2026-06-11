import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CervelloTabProps {
  onRefreshKB: () => void;
  kbFiles: Record<string, string>;
  onLog: (msg: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CervelloTab({ onRefreshKB, kbFiles, onLog, onShowToast }: CervelloTabProps) {
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
      onShowToast(`File '${selectedFile}' salvato con successo!`);
    } catch (e: any) {
      onLog(`Errore nel salvataggio del file: ${e}`);
      onShowToast(`Errore: ${e}`, 'error');
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
      onShowToast(`Errore: ${e}`, 'error');
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
      onShowToast(`Errore: ${e}`, 'error');
    }
  };

  const filteredFiles = Object.keys(kbFiles).filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full gap-5 p-6 text-slate-700">
      {/* File List Panel */}
      <div className="flex w-80 flex-col rounded-2xl glass p-4 border border-sky-100/40 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-800 glow-cyan flex items-center gap-2">
            <svg className="w-4 h-4 text-glowCyan animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Cervello Locale
          </h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:border-glowCyan hover:bg-glowCyan/10 text-slate-500 hover:text-glowCyan transition-all duration-300 shadow-sm"
            title="Nuovo File"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Cerca file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full premium-input text-xs py-2 pl-9 pr-3"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateFile} className="mb-4 p-3 bg-slate-100 rounded-xl border border-slate-200 flex gap-2">
            <input
              type="text"
              placeholder="nome-file.md"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="flex-1 premium-input px-2 py-1 text-xs"
              autoFocus
            />
            <button type="submit" className="bg-glowCyan/10 text-glowCyan border border-glowCyan/30 hover:border-glowCyan px-3 py-1 rounded-lg text-xs transition-all duration-300 font-semibold">
              Crea
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredFiles.length === 0 ? (
            <p className="text-slate-500 text-center text-xs py-8">Nessun file trovato</p>
          ) : (
            filteredFiles.map((name) => {
              const isSelected = selectedFile === name;
              return (
                <div
                  key={name}
                  onClick={() => handleSelectFile(name)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-glowCyan/15 to-glowBlue/5 border-glowCyan text-glowCyan shadow-sm border-l-[3px]'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <svg className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${isSelected ? 'text-glowCyan' : 'text-slate-500 group-hover:text-glowCyan'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs truncate font-medium tracking-wide">{name}</span>
                  </div>
                  {/* Delete button (except standard template files) */}
                  {!['INDEX.md', 'regole-articoli.md', 'regole-yoast.md', 'stack-tecnologico.md', 'brief-template.md'].includes(name) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all duration-300"
                      title="Elimina File"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col rounded-2xl glass border border-sky-100/40 p-5 shadow-xl">
        {selectedFile ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wide text-slate-800">{selectedFile}</span>
                <span className="text-xxs px-2.5 py-0.5 rounded-full bg-glowCyan/10 border border-glowCyan/20 text-glowCyan font-medium">Markdown</span>
              </div>
              <button
                onClick={handleSaveFile}
                className="flex items-center gap-2 px-4 py-2 bg-glowCyan/10 text-glowCyan border border-glowCyan/45 hover:border-glowCyan hover:bg-glowCyan/15 rounded-xl text-xs font-bold transition-all duration-300 glow-shadow-cyan-hover"
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
              className="flex-1 w-full bg-white text-slate-800 font-mono text-xs p-5 rounded-xl border border-slate-200 focus:outline-none focus:border-glowCyan resize-none leading-relaxed shadow-inner"
              placeholder="Scrivi qui in Markdown..."
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm font-semibold text-slate-400">Nessun file selezionato</p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs text-center leading-normal">Seleziona un file Markdown dal Cervello a sinistra per visualizzarlo o modificarlo direttamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
