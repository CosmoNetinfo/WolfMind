import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import CervelloTab from './components/CervelloTab';
import { sendMessageToGroq, verifyResponseWithOpenRouter, refineCodeWithCoderAgent, ChatMessage, VerificationResult } from './services/ai';

interface AppSettings {
  groq_api_key: string;
  openrouter_api_key: string;
  groq_model: string;
  openrouter_model: string;
  coder_enabled: boolean;
  openrouter_coder_model: string;
  tts_enabled: boolean;
  tts_voice: string;
  tts_rate: number;
  verifier_enabled: boolean;
  active_mode: 'chat' | 'articolo' | 'brief';
  kb_max_tokens: number;
  auto_save_session: boolean;
  language: string;
}

interface MessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  verification?: VerificationResult;
  timestamp: string;
  isGenerating?: boolean;
}

export default function App() {
  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    groq_api_key: '',
    openrouter_api_key: '',
    groq_model: 'llama-3.3-70b-versatile',
    openrouter_model: 'qwen/qwen-2.5-72b-instruct:free',
    coder_enabled: true,
    openrouter_coder_model: 'qwen/qwen-2.5-coder-32b-instruct:free',
    tts_enabled: true,
    tts_voice: 'auto-italian',
    tts_rate: 1.05,
    verifier_enabled: true,
    active_mode: 'chat',
    kb_max_tokens: 8000,
    auto_save_session: true,
    language: 'it'
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'cervello' | 'sessioni'>('chat');
  const [messages, setMessages] = useState<MessageUI[]>([]);
  const [inputText, setInputText] = useState('');
  const [statusText, setStatusText] = useState('Pronto');
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Files & Context data
  const [kbFiles, setKbFiles] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedSessionContent, setSelectedSessionContent] = useState<string | null>(null);
  const [selectedSessionName, setSelectedSessionName] = useState<string | null>(null);

  // Speech API refs
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Log message helper
  const addLog = async (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 100));
    try {
      await invoke('write_app_log', { message: msg });
    } catch (_) {}
  };

  // Load Settings and KB on mount
  useEffect(() => {
    loadAppConfig();
    setupSpeechRecognition();
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAppConfig = async () => {
    try {
      const settingsStr = await invoke<string>('get_settings');
      const parsedSettings = JSON.parse(settingsStr);
      setSettings(parsedSettings);
      addLog("Impostazioni caricate correttamente.");

      const kb = await invoke<Record<string, string>>('get_kb_files');
      setKbFiles(kb);
      addLog(`Knowledge base caricata: ${Object.keys(kb).length} file.`);

      const profs = await invoke<Record<string, string>>('get_profiles');
      setProfiles(profs);

      const sess = await invoke<string[]>('get_sessions');
      setSessions(sess);
    } catch (e) {
      addLog(`Errore nel caricamento delle configurazioni: ${e}`);
    }
  };

  const handleSaveSettings = async (updated: AppSettings) => {
    try {
      setSettings(updated);
      await invoke('save_settings', { settingsJson: JSON.stringify(updated, null, 2) });
      addLog("Impostazioni salvate con successo.");
    } catch (e) {
      addLog(`Errore nel salvataggio delle impostazioni: ${e}`);
    }
  };

  const refreshKB = async () => {
    try {
      const kb = await invoke<Record<string, string>>('get_kb_files');
      setKbFiles(kb);
    } catch (e) {
      addLog(`Errore nell'aggiornamento KB: ${e}`);
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'it-IT';

      rec.onstart = () => {
        setIsListening(true);
        setStatusText('Ascolto attivo...');
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setInputText(prev => prev ? prev + ' ' + resultText : resultText);
        addLog(`STT: "${resultText}"`);
      };

      rec.onerror = (event: any) => {
        addLog(`Errore STT: ${event.error}`);
        setIsListening(false);
        setStatusText('Pronto');
      };

      rec.onend = () => {
        setIsListening(false);
        setStatusText('Pronto');
      };

      recognitionRef.current = rec;
    } else {
      addLog("Riconoscimento vocale non supportato in questo browser/piattaforma.");
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast("Riconoscimento vocale non supportato.", 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Speak TTS helper
  const handleTTS = (text: string) => {
    if (!settings.tts_enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean up Markdown and code blocks for speech synthesis
    let cleanText = text.replace(/<[^>]*>/g, ''); 
    cleanText = cleanText.replace(/```[\s\S]*?```/g, '[Codice generato omesso dalla lettura vocale]');
    cleanText = cleanText.replace(/[*#_\-`\[\]()]/g, ''); 
    
    const words = cleanText.split(/\s+/);
    if (words.length > 300) {
      cleanText = words.slice(0, 300).join(' ') + '... [Nota: Lettura vocale troncata]';
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'it-IT';
    utterance.rate = settings.tts_rate || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const itVoice = voices.find(v => v.lang.startsWith('it') || v.name.toLowerCase().includes('italian'));
    if (itVoice) {
      utterance.voice = itVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Compile context from KB Markdown files up to token (char) limit
  const compileKBContext = (): string => {
    let context = '';
    const maxChars = settings.kb_max_tokens * 4; 
    for (const [filename, content] of Object.entries(kbFiles)) {
      context += `\n\n--- FILE: ${filename} ---\n${content}`;
      if (context.length > maxChars) {
        context = context.slice(0, maxChars) + '\n... [Contesto KB troncato per raggiunti limiti]';
        break;
      }
    }
    return context;
  };

  // Send message pipeline
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userQuery = inputText.trim();
    setInputText('');
    setStatusText('Generazione risposta...');

    const now = new Date().toLocaleTimeString();
    const userMsg: MessageUI = {
      id: Math.random().toString(),
      role: 'user',
      content: userQuery,
      timestamp: now
    };

    setMessages(prev => [...prev, userMsg]);

    const activeProfilePrompt = profiles[settings.active_mode === 'brief' ? 'dev-brief' : settings.active_mode] || '';
    const kbContext = compileKBContext();
    const compiledSystemPrompt = `${activeProfilePrompt}\n\nCONTESTO KNOWLEDGE BASE DI RIFERIMENTO:\n${kbContext}`;

    const history: ChatMessage[] = messages.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content
    })).concat([{ role: 'user' as const, content: userQuery }]);

    const assistantMsgId = Math.random().toString();
    const assistantMsgPlaceholder: MessageUI = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      isGenerating: true
    };

    setMessages(prev => [...prev, assistantMsgPlaceholder]);

    try {
      // 1. Generator Agent (Groq)
      let aiResponse = await sendMessageToGroq(
        settings.groq_api_key,
        settings.groq_model,
        compiledSystemPrompt,
        history
      );

      // 1.5 Coder Agent (OpenRouter) - Refines code output if active & detected
      if (settings.coder_enabled && settings.openrouter_api_key && (aiResponse.includes('```') || settings.active_mode === 'brief')) {
        setStatusText('Ottimizzazione codice (Programmatore)...');
        try {
          const refinedResponse = await refineCodeWithCoderAgent(
            settings.openrouter_api_key,
            settings.openrouter_coder_model,
            userQuery,
            aiResponse,
            kbContext
          );
          aiResponse = refinedResponse;
          addLog(`Codice ottimizzato con successo dall'Agente Programmatore.`);
        } catch (coderError: any) {
          addLog(`Errore Agente Programmatore (uso risposta originale): ${coderError.message}`);
        }
      }

      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: aiResponse, isGenerating: false } : m));
      addLog(`Risposta generata correttamente.`);

      // Read output aloud if TTS enabled
      handleTTS(aiResponse);

      // 2. Verifier Agent (OpenRouter)
      if (settings.verifier_enabled && settings.openrouter_api_key) {
        setStatusText('Verifica risposta...');
        const verResult = await verifyResponseWithOpenRouter(
          settings.openrouter_api_key,
          settings.openrouter_model,
          userQuery,
          aiResponse,
          kbContext,
          settings.active_mode
        );

        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, verification: verResult } : m));
        addLog(`Verifica completata: ${verResult.status.toUpperCase()}`);

        if (verResult.status === 'warning' || verResult.status === 'error') {
          if (settings.tts_enabled) {
            handleTTS(`Attenzione: verifica completata con anomalie. ${verResult.note}`);
          }
        }
      }

      setStatusText('Pronto');
    } catch (error: any) {
      addLog(`Errore pipeline: ${error.message}`);
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
        ...m, 
        content: `Errore nella generazione: ${error.message}`, 
        isGenerating: false,
        verification: { status: 'error', note: error.message }
      } : m));
      setStatusText('Errore');
    }
  };

  const handleNewSession = async () => {
    if (messages.length === 0) {
      addLog("Nessuna conversazione da salvare.");
      return;
    }

    if (!confirm("Sei sicuro di voler iniziare una nuova sessione? La conversazione corrente verrà salvata e pulita.")) {
      return;
    }

    setStatusText('Salvataggio sessione...');
    try {
      const summaryPrompt = `Riassumi la seguente sessione di chat tra DanyWolf e l'assistente AI WolfMind. 
Genera un report strutturato in Markdown (.md) che includa:
- Argomenti principali discussi
- Decisioni tecniche prese
- Codice o formule utili generate
- Prossimi step da seguire.

Usa l'italiano e sii conciso ed efficace.`;

      const chatHistoryText = messages.map(m => `[${m.role.toUpperCase()} - ${m.timestamp}]:\n${m.content}\n`).join('\n');

      let sessionSummary = '';
      if (settings.groq_api_key) {
        sessionSummary = await sendMessageToGroq(
          settings.groq_api_key,
          settings.groq_model,
          summaryPrompt,
          [{ role: 'user', content: `Ecco i messaggi della sessione:\n\n${chatHistoryText}` }]
        );
      } else {
        sessionSummary = `# Sessione Log\n\nSalvato in modalità offline senza riassunto AI.\n\n${chatHistoryText}`;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
      const filename = `${dateStr}-${timeStr}`;

      await invoke('save_session', { name: filename, content: sessionSummary });
      addLog(`Sessione salvata: ${filename}.md`);
      
      // Refresh session list
      const sess = await invoke<string[]>('get_sessions');
      setSessions(sess);

      setMessages([]);
      setStatusText('Pronto');
      showToast(`Sessione salvata come '${filename}.md'`);
    } catch (e: any) {
      addLog(`Errore nel salvataggio della sessione: ${e}`);
      showToast(`Errore nel salvataggio: ${e}`, 'error');
      setStatusText('Errore');
    }
  };

  const handleExportModeContent = async (msg: MessageUI) => {
    if (settings.active_mode === 'articolo') {
      try {
        await navigator.clipboard.writeText(msg.content);
        addLog("HTML dell'articolo copiato.");
        showToast("HTML copiato nella clipboard!");
      } catch (err) {
        showToast("Impossibile copiare: " + err, 'error');
      }
    } else if (settings.active_mode === 'brief') {
      const projectName = prompt("Inserisci il nome del progetto per salvare il brief (es: kashy-brief):", "progetto-brief");
      if (!projectName) return;
      try {
        await invoke('save_session', { name: projectName, content: msg.content });
        addLog(`Brief salvato come: ${projectName}.md`);
        const sess = await invoke<string[]>('get_sessions');
        setSessions(sess);
        showToast(`Brief '${projectName}.md' salvato.`);
      } catch (e: any) {
        showToast("Errore nel salvataggio: " + e, 'error');
      }
    }
  };

  const viewSessionContent = async (name: string) => {
    setSelectedSessionContent(null);
    try {
      const content = await invoke<string>('read_session', { name });
      setSelectedSessionContent(content);
    } catch (e) {
      addLog(`Errore lettura sessione: ${e}`);
      setSelectedSessionContent(`Errore nel caricamento della sessione: ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-darkBg text-slate-800 font-sans selection:bg-glowCyan/20 selection:text-slate-900">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/90 border-b border-sky-100/45 glass shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/WolfMidLogo.png" className="w-9 h-9 object-contain" alt="Logo" />
            <span className="text-lg font-bold tracking-wider gradient-text-premium">
              WolfMind
            </span>
          </div>
          <div className="flex rounded-xl bg-slate-150 p-1 border border-slate-200/50">
            {(['chat', 'articolo', 'brief'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleSaveSettings({ ...settings, active_mode: mode })}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                  settings.active_mode === mode
                    ? 'gradient-active font-bold'
                    : 'text-slate-650 hover:text-slate-900'
                }`}
              >
                {mode === 'brief' ? 'BRIEF DEV' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2.5 items-center">
          {(['chat', 'cervello', 'sessioni'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'sessioni') {
                  invoke<string[]>('get_sessions').then(setSessions);
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-350 ${
                activeTab === tab
                  ? 'bg-glowCyan/15 border border-glowCyan/45 text-glowCyan shadow-[0_0_12px_rgba(2,132,199,0.08)]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`p-2 rounded-xl bg-slate-100 border border-slate-200 hover:border-glowCyan/60 text-slate-500 hover:text-glowCyan transition-all duration-350 ${
              showSettingsPanel ? 'border-glowCyan text-glowCyan bg-glowCyan/10' : ''
            }`}
            title="Impostazioni"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar panel */}
        <div className={`w-80 bg-white/95 border-r border-sky-100/40 p-5 flex flex-col gap-4 overflow-y-auto z-10 glass transition-all ${showSettingsPanel ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase">Pannello Impostazioni</h3>
            <button onClick={() => setShowSettingsPanel(false)} className="text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors">Chiudi</button>
          </div>

          {/* API Keys configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">Groq API Key</label>
              <input
                type="password"
                value={settings.groq_api_key}
                onChange={(e) => handleSaveSettings({ ...settings, groq_api_key: e.target.value })}
                placeholder="gsk_..."
                className="w-full premium-input text-xs px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={settings.openrouter_api_key}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_api_key: e.target.value })}
                placeholder="sk-or-..."
                className="w-full premium-input text-xs px-4 py-2"
              />
            </div>
          </div>

          {/* AI Models configuration */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">Generatore (Groq)</label>
              <select
                value={settings.groq_model}
                onChange={(e) => handleSaveSettings({ ...settings, groq_model: e.target.value })}
                className="w-full premium-input text-xs px-3 py-2"
              >
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                <option value="gemma2-9b-it">gemma2-9b-it</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
              </select>
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">Verificatore (OpenRouter)</label>
              <select
                value={settings.openrouter_model}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_model: e.target.value })}
                className="w-full premium-input text-xs px-3 py-2"
              >
                <option value="qwen/qwen-2.5-72b-instruct:free">qwen/qwen-2.5-72b-instruct:free</option>
                <option value="mistralai/mistral-7b-instruct:free">mistralai/mistral-7b-instruct:free</option>
                <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free</option>
              </select>
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">Programmatore (OpenRouter)</label>
              <select
                value={settings.openrouter_coder_model}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_coder_model: e.target.value })}
                className="w-full premium-input text-xs px-3 py-2"
              >
                <option value="qwen/qwen-2.5-coder-32b-instruct:free">qwen/qwen-2.5-coder-32b-instruct:free</option>
                <option value="meta-llama/llama-3.1-8b-instruct:free">meta-llama/llama-3.1-8b-instruct:free</option>
              </select>
            </div>
          </div>

          {/* Configuration options (Toggles) */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Sintesi Vocale (TTS)</span>
              <input
                type="checkbox"
                checked={settings.tts_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, tts_enabled: e.target.checked })}
                className="rounded border-slate-300 text-glowCyan focus:ring-glowCyan bg-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Programmatore (Coder)</span>
              <input
                type="checkbox"
                checked={settings.coder_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, coder_enabled: e.target.checked })}
                className="rounded border-slate-300 text-glowCyan focus:ring-glowCyan bg-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Verificatore (Verifier)</span>
              <input
                type="checkbox"
                checked={settings.verifier_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, verifier_enabled: e.target.checked })}
                className="rounded border-slate-300 text-glowCyan focus:ring-glowCyan bg-white"
              />
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-slate-400 tracking-wider mb-1">Velocità Voce ({settings.tts_rate}x)</label>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={settings.tts_rate}
                onChange={(e) => handleSaveSettings({ ...settings, tts_rate: parseFloat(e.target.value) })}
                className="w-full accent-glowCyan cursor-pointer h-1 rounded-lg bg-white/10"
              />
            </div>
          </div>

          {/* Log Window */}
          <div className="flex-1 flex flex-col pt-3 border-t border-slate-200">
            <span className="text-xxs font-semibold uppercase text-slate-500 tracking-wider mb-1.5">Log di Sistema</span>
            <div className="flex-1 bg-slate-100 border border-slate-200/60 rounded-xl p-3 font-mono text-[10px] overflow-y-auto max-h-44 text-slate-600 space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate select-text">{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Tab Area */}
        <div className="flex-1 flex flex-col h-full bg-transparent">
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Reset Session & Info Bar */}
              <div className="flex justify-between items-center px-6 py-2.5 bg-white/40 border-b border-sky-100/40 text-xxs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse"></span>
                  <span>Modello Attivo: <strong className="text-slate-800">{settings.groq_model}</strong></span>
                </div>
                <button
                  onClick={handleNewSession}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-glowCyan/65 hover:text-glowCyan rounded-lg text-xxs font-bold uppercase transition-all duration-300 shadow-sm"
                >
                  Salva Sessione
                </button>
              </div>

              {/* Chat bubble list */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                    <img src="/WolfMidLogo.png" className="w-24 h-24 object-contain" alt="WolfMind Logo" />
                    <div className="text-center space-y-1 max-w-sm">
                      <h2 className="text-lg font-bold text-slate-800 tracking-wide gradient-text-premium">Sistemi Pronti alla Conversazione</h2>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Parla o digita per avviare la sessione. Gli agenti di ottimizzazione e verifica sono attivi in modalità <strong className="text-glowCyan uppercase">{settings.active_mode}</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 mb-1 px-1">{msg.timestamp}</div>
                      
                      <div
                        className={`rounded-2xl px-5 py-3.5 border text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-glowCyan to-glowBlue border-glowBlue/10 text-white shadow-md'
                            : 'bg-white border-slate-200/80 text-slate-800 shadow-md'
                        }`}
                      >
                        {msg.isGenerating ? (
                          <div className="flex items-center gap-3 py-1.5 text-glowCyan font-medium">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Generazione risposta in corso...</span>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans font-normal leading-relaxed tracking-wide select-text">{msg.content}</div>
                        )}
                      </div>

                      {/* Verification badge & note */}
                      {msg.role === 'assistant' && msg.verification && (
                        <div className="mt-3.5 w-full space-y-2">
                          <div className="flex items-center gap-2">
                            {msg.verification.status === 'ok' && (
                              <span className="inline-flex items-center gap-1.5 text-xxs text-emerald-400 font-bold bg-emerald-950/30 px-3 py-1 rounded-lg border border-emerald-900/40 tracking-wider">
                                ✅ VERIFICA SUPERATA
                              </span>
                            )}
                            {msg.verification.status === 'warning' && (
                              <span className="inline-flex items-center gap-1.5 text-xxs text-yellow-400 font-bold bg-yellow-950/30 px-3 py-1 rounded-lg border border-yellow-900/40 tracking-wider">
                                ⚠️ RISCONTRI DUBBIOSI
                              </span>
                            )}
                            {msg.verification.status === 'error' && (
                              <span className="inline-flex items-center gap-1.5 text-xxs text-red-400 font-bold bg-red-950/30 px-3 py-1 rounded-lg border border-red-900/40 tracking-wider">
                                ❌ RILEVATI ERRORI
                              </span>
                            )}
                            {msg.verification.status === 'unavailable' && (
                              <span className="inline-flex items-center gap-1.5 text-xxs text-slate-400 font-bold bg-slate-950/30 px-3 py-1 rounded-lg border border-slate-900/40 tracking-wider">
                                ⚠️ VERIFICA NON DISPONIBILE
                              </span>
                            )}
                          </div>
                          
                          {/* Note text inside premium card */}
                          {msg.verification.note && (
                            <div className="text-xxs text-slate-650 border border-sky-100/40 rounded-xl bg-sky-50/50 p-3.5 leading-relaxed font-sans max-w-lg select-text shadow-inner">
                              <div className="font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Dettagli Analisi
                              </div>
                              {msg.verification.note}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Export buttons for Mode results */}
                      {msg.role === 'assistant' && !msg.isGenerating && settings.active_mode !== 'chat' && (
                        <div className="mt-2.5 flex gap-2">
                          <button
                            onClick={() => handleExportModeContent(msg)}
                            className="inline-flex items-center gap-1.5 text-xxs text-glowCyan hover:text-white bg-glowCyan/5 hover:bg-glowCyan/15 px-3 py-1.5 rounded-xl border border-glowCyan/25 hover:border-glowCyan transition-all duration-300 font-semibold"
                          >
                            {settings.active_mode === 'articolo' ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                Copia HTML
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Salva MD
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-5 bg-white/95 border-t border-sky-100/40 flex items-center gap-3.5 backdrop-blur-md">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3.5 rounded-2xl border transition-all duration-350 shadow-md ${
                    isListening
                      ? 'bg-red-50 text-red-500 border-red-300 animate-pulse shadow-red-100'
                      : 'bg-white text-glowCyan border-slate-200 hover:border-glowCyan/50 hover:bg-glowCyan/5'
                  }`}
                  title={isListening ? "Ferma ascolto" : "Parla"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isListening ? "Riconoscimento vocale attivo..." : `Invia un messaggio in modalità ${settings.active_mode.toUpperCase()}...`}
                  className="flex-1 premium-input px-5 py-4 text-sm"
                  disabled={isListening}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-3.5 bg-glowCyan text-white border border-glowCyan hover:bg-glowCyan/90 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 rounded-2xl transition-all duration-300 font-semibold shadow-md glow-shadow-cyan-hover"
                  title="Invia"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'cervello' && (
            <CervelloTab
              kbFiles={kbFiles}
              onRefreshKB={refreshKB}
              onLog={addLog}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'sessioni' && (
            <div className="flex h-full w-full gap-5 p-6 text-slate-700">
              {/* Sessions List */}
              <div className="flex w-80 flex-col rounded-2xl glass p-4 border border-sky-100/40 shadow-xl">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-800 glow-cyan flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-glowCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sessioni Salvate
                </h3>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {sessions.length === 0 ? (
                    <p className="text-slate-500 text-center text-xs py-8">Nessun file sessione presente</p>
                  ) : (
                    sessions.map((name) => {
                      const isSelected = selectedSessionName === name;
                      return (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedSessionName(name);
                            viewSessionContent(name);
                          }}
                          className={`p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                            isSelected
                              ? 'bg-gradient-to-r from-glowCyan/15 to-glowBlue/5 border-glowCyan text-glowCyan shadow-sm border-l-[3px]'
                              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <span className="text-xs truncate font-medium block">{name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* View Panel */}
              <div className="flex-1 flex flex-col rounded-2xl glass border border-sky-100/40 p-5 shadow-xl">
                {selectedSessionName ? (
                  <div className="flex-1 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold tracking-wide text-slate-800">{selectedSessionName}</span>
                    </div>
                    <div className="flex-1 w-full bg-white text-slate-700 font-mono text-xs p-5 rounded-xl border border-slate-200 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                      {selectedSessionContent || 'Caricamento contenuto sessione...'}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <p className="text-sm font-semibold">Seleziona una sessione per visualizzarla</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="flex items-center justify-between px-6 py-2.5 bg-white/90 border-t border-sky-100/40 text-[10px] text-slate-500 font-medium tracking-wide">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-glowCyan shadow-[0_0_6px_rgba(102,252,241,0.8)]"></span>
          <span>Sistema: <strong className="text-slate-700">{statusText}</strong></span>
        </div>
        <div className="flex items-center gap-5">
          <span>Verifica: <strong className={settings.verifier_enabled ? "text-emerald-400" : "text-slate-500"}>{settings.verifier_enabled ? "ATTIVA" : "DISATTIVA"}</strong></span>
          <span>Programmatore: <strong className={settings.coder_enabled ? "text-indigo-400" : "text-slate-500"}>{settings.coder_enabled ? "ATTIVO" : "DISATTIVO"}</strong></span>
          <span>Modalità: <strong className="text-glowCyan uppercase font-semibold">{settings.active_mode}</strong></span>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-12 right-6 z-50 glass px-5 py-3.5 border-l-4 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 animate-toast ${
          toast.type === 'error' ? 'border-red-500/80 bg-red-950/35' : 
          toast.type === 'info' ? 'border-glowBlue/80 bg-glowBlue/10' : 'border-glowCyan/80 bg-glowCyan/5'
        }`}>
          <span className="text-xs font-bold tracking-wide text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
