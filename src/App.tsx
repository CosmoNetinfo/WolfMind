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
      alert("Riconoscimento vocale non supportato.");
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
    let cleanText = text.replace(/<[^>]*>/g, ''); // strip HTML tags
    cleanText = cleanText.replace(/```[\s\S]*?```/g, '[Codice generato omesso dalla lettura vocale]');
    cleanText = cleanText.replace(/[*#_\-`\[\]()]/g, ''); // strip markdown syntax
    
    // Limits text to speak to avoid buffer overload (max 300 words)
    const words = cleanText.split(/\s+/);
    if (words.length > 300) {
      cleanText = words.slice(0, 300).join(' ') + '... [Nota: Testo troppo lungo, la lettura vocale è stata troncata]';
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
    const maxChars = settings.kb_max_tokens * 4; // Approx 4 chars per token
    for (const [filename, content] of Object.entries(kbFiles)) {
      context += `\n\n--- FILE: ${filename} ---\n${content}`;
      if (context.length > maxChars) {
        context = context.slice(0, maxChars) + '\n... [Contesto KB troncato per raggiunti limiti di token]';
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

    // Format chat history for API
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

      // 1.5 Coder Agent (OpenRouter) - Refines code output if detected or in tech mode
      if (settings.coder_enabled && settings.openrouter_api_key && (aiResponse.includes('```') || settings.active_mode === 'brief')) {
        setStatusText('Ottimizzazione codice...');
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
      addLog(`Groq generato con successo: ${aiResponse.slice(0, 50)}...`);

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
          // Play warning audio cue or TTS notice
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
      alert(`Sessione salvata con successo come '${filename}.md'`);
    } catch (e: any) {
      addLog(`Errore nel salvataggio della sessione: ${e}`);
      alert(`Errore nel salvataggio: ${e}`);
      setStatusText('Errore');
    }
  };

  const handleExportModeContent = async (msg: MessageUI) => {
    if (settings.active_mode === 'articolo') {
      // Copy HTML logic
      try {
        await navigator.clipboard.writeText(msg.content);
        addLog("HTML dell'articolo copiato nella clipboard.");
        alert("Codice HTML copiato nella clipboard con successo!");
      } catch (err) {
        alert("Impossibile copiare nella clipboard: " + err);
      }
    } else if (settings.active_mode === 'brief') {
      // Save MD logic
      const projectName = prompt("Inserisci il nome del progetto per salvare il brief (es: kashy-brief):", "progetto-brief");
      if (!projectName) return;
      try {
        await invoke('save_session', { name: projectName, content: msg.content });
        addLog(`Brief salvato come: ${projectName}.md`);
        // Refresh session list
        const sess = await invoke<string[]>('get_sessions');
        setSessions(sess);
        alert(`Brief '${projectName}.md' salvato nella cartella sessioni.`);
      } catch (e: any) {
        alert("Errore nel salvataggio: " + e);
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
    <div className="flex flex-col h-screen w-screen bg-darkBg text-gray-200">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-darkSecondary/50 border-b border-gray-800 glass">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider text-white glow-text-cyan flex items-center gap-2">
            <img src="/logo.png" className="w-8 h-8 rounded-lg border border-glowCyan/30 object-cover" alt="Logo" />
            WolfMind
          </span>
          <div className="flex rounded-lg bg-darkBg p-0.5 border border-gray-800">
            {(['chat', 'articolo', 'brief'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleSaveSettings({ ...settings, active_mode: mode })}
                className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-all ${
                  settings.active_mode === mode
                    ? 'bg-darkSecondary text-glowCyan glow-shadow-cyan border border-gray-700'
                    : 'text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {mode === 'brief' ? 'BRIEF DEV' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {(['chat', 'cervello', 'sessioni'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'sessioni') {
                  invoke<string[]>('get_sessions').then(setSessions);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                activeTab === tab
                  ? 'bg-glowCyan/10 text-glowCyan border border-glowCyan/20'
                  : 'text-gray-400 hover:text-white hover:bg-darkSecondary/35'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="p-1.5 rounded-lg bg-darkSecondary border border-gray-700 hover:border-glowCyan text-gray-400 hover:text-white transition-all"
            title="Impostazioni"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar panel */}
        <div className={`w-80 bg-darkSecondary/35 border-r border-gray-850 p-4 flex flex-col gap-4 overflow-y-auto ${showSettingsPanel ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
            <h3 className="font-semibold text-white text-sm">Pannello Impostazioni</h3>
            <button onClick={() => setShowSettingsPanel(false)} className="text-gray-500 hover:text-white text-xs">Chiudi</button>
          </div>

          {/* API Keys configuration */}
          <div className="space-y-3">
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">Groq API Key</label>
              <input
                type="password"
                value={settings.groq_api_key}
                onChange={(e) => handleSaveSettings({ ...settings, groq_api_key: e.target.value })}
                placeholder="gsk_..."
                className="w-full bg-darkBg border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-glowCyan"
              />
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={settings.openrouter_api_key}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_api_key: e.target.value })}
                placeholder="sk-or-..."
                className="w-full bg-darkBg border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-glowCyan"
              />
            </div>
          </div>

          {/* AI Models configuration */}
          <div className="space-y-3">
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">Modello Generatore (Groq)</label>
              <select
                value={settings.groq_model}
                onChange={(e) => handleSaveSettings({ ...settings, groq_model: e.target.value })}
                className="w-full bg-darkBg border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-glowCyan"
              >
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                <option value="gemma2-9b-it">gemma2-9b-it</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
              </select>
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">Modello Verificatore (OpenRouter)</label>
              <select
                value={settings.openrouter_model}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_model: e.target.value })}
                className="w-full bg-darkBg border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-glowCyan"
              >
                <option value="qwen/qwen-2.5-72b-instruct:free">qwen/qwen-2.5-72b-instruct:free</option>
                <option value="mistralai/mistral-7b-instruct:free">mistralai/mistral-7b-instruct:free</option>
                <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free</option>
              </select>
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">Modello Programmatore (OpenRouter)</label>
              <select
                value={settings.openrouter_coder_model}
                onChange={(e) => handleSaveSettings({ ...settings, openrouter_coder_model: e.target.value })}
                className="w-full bg-darkBg border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-glowCyan"
              >
                <option value="qwen/qwen-2.5-coder-32b-instruct:free">qwen/qwen-2.5-coder-32b-instruct:free</option>
                <option value="meta-llama/llama-3.1-8b-instruct:free">meta-llama/llama-3.1-8b-instruct:free</option>
              </select>
            </div>
          </div>

          {/* Audio options (TTS) */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Sintesi Vocale (TTS)</span>
              <input
                type="checkbox"
                checked={settings.tts_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, tts_enabled: e.target.checked })}
                className="rounded text-glowCyan focus:ring-glowCyan"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Programmatore Attivo</span>
              <input
                type="checkbox"
                checked={settings.coder_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, coder_enabled: e.target.checked })}
                className="rounded text-glowCyan focus:ring-glowCyan"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Verificatore Attivo</span>
              <input
                type="checkbox"
                checked={settings.verifier_enabled}
                onChange={(e) => handleSaveSettings({ ...settings, verifier_enabled: e.target.checked })}
                className="rounded text-glowCyan focus:ring-glowCyan"
              />
            </div>
            <div>
              <label className="block text-xxs font-semibold uppercase text-gray-400 mb-1">Velocità Voce (TTS Rate)</label>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={settings.tts_rate}
                onChange={(e) => handleSaveSettings({ ...settings, tts_rate: parseFloat(e.target.value) })}
                className="w-full accent-glowCyan"
              />
              <div className="flex justify-between text-xxs text-gray-500">
                <span>Lenta</span>
                <span>{settings.tts_rate}x</span>
                <span>Veloce</span>
              </div>
            </div>
          </div>

          {/* Log Window inside Settings */}
          <div className="flex-1 flex flex-col pt-2 border-t border-gray-800">
            <span className="text-xxs font-semibold uppercase text-gray-400 mb-1">Log di Sistema</span>
            <div className="flex-1 bg-darkBg border border-gray-800 rounded-lg p-2 font-mono text-xxs overflow-y-auto max-h-40 text-gray-500 space-y-1">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate">{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Tab Area */}
        <div className="flex-1 flex flex-col h-full bg-darkBg">
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Reset Session & Info Bar */}
              <div className="flex justify-between items-center px-6 py-2 bg-darkSecondary/25 border-b border-gray-850 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Modello Generatore: <strong className="text-white">{settings.groq_model}</strong></span>
                </div>
                <button
                  onClick={handleNewSession}
                  className="px-2.5 py-1 bg-darkSecondary border border-gray-700 hover:border-glowCyan hover:text-white rounded text-xxs font-semibold uppercase transition-colors"
                >
                  Nuova Sessione
                </button>
              </div>

              {/* Chat bubble list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-darkSecondary border border-gray-800 flex items-center justify-center glow-shadow-cyan overflow-hidden">
                      <img src="/logo.png" className="w-full h-full object-cover" alt="WolfMind Logo" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">WolfMind Pronto ad Assisterti</p>
                      <p className="text-xs text-gray-600 mt-1 max-w-xs">
                        Parla o scrivi per avviare la conversazione in modalità <strong>{settings.active_mode.toUpperCase()}</strong>.
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
                      <div className="text-xxs text-gray-550 mb-1 px-1">{msg.timestamp}</div>
                      
                      <div
                        className={`rounded-xl px-4 py-3 border text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-darkSecondary/80 border-gray-750 text-white'
                            : 'bg-darkSecondary/40 border-gray-800 text-gray-200'
                        }`}
                      >
                        {msg.isGenerating ? (
                          <div className="flex items-center gap-2 py-1 text-glowCyan">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Generazione in corso...</span>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                        )}
                      </div>

                      {/* Verification badge & note */}
                      {msg.role === 'assistant' && msg.verification && (
                        <div className="mt-2 w-full">
                          <div className="flex items-center gap-2">
                            {msg.verification.status === 'ok' && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/40">
                                ✅ Verifica OK
                              </span>
                            )}
                            {msg.verification.status === 'warning' && (
                              <span className="inline-flex items-center gap-1 text-xs text-yellow-400 font-semibold bg-yellow-950/30 px-2 py-0.5 rounded border border-yellow-900/40">
                                ⚠️ Dubbioso
                              </span>
                            )}
                            {msg.verification.status === 'error' && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-400 font-semibold bg-red-950/30 px-2 py-0.5 rounded border border-red-900/40">
                                ❌ Errore
                              </span>
                            )}
                            {msg.verification.status === 'unavailable' && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-semibold bg-gray-950/30 px-2 py-0.5 rounded border border-gray-900/40">
                                ⚠️ Verifica Non Disponibile
                              </span>
                            )}
                          </div>
                          
                          {/* Note text (expandable/visible for Warning and Error, or even OK if present) */}
                          {msg.verification.note && (
                            <details className="mt-1 text-xxs text-gray-450 border border-gray-850 rounded bg-darkBg/30 p-2 cursor-pointer">
                              <summary className="font-semibold select-none text-gray-500">Nota del Verificatore</summary>
                              <p className="mt-1 text-gray-400 leading-normal font-sans">{msg.verification.note}</p>
                            </details>
                          )}
                        </div>
                      )}

                      {/* Export buttons for Mode results */}
                      {msg.role === 'assistant' && !msg.isGenerating && settings.active_mode !== 'chat' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleExportModeContent(msg)}
                            className="inline-flex items-center gap-1 text-xxs text-glowCyan hover:text-white bg-darkSecondary/80 hover:bg-darkSecondary px-2.5 py-1 rounded border border-gray-800 hover:border-glowCyan transition-all"
                          >
                            {settings.active_mode === 'articolo' ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                Copia HTML
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <form onSubmit={handleSendMessage} className="p-4 bg-darkSecondary/20 border-t border-gray-850 flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-xl border transition-all ${
                    isListening
                      ? 'bg-red-950/40 text-red-400 border-red-500/50 animate-pulse shadow-md shadow-red-900/10'
                      : 'bg-darkBg text-glowCyan border-gray-850 hover:border-glowCyan'
                  }`}
                  title={isListening ? "Ferma ascolto" : "Parla"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isListening ? "Ascolto in corso..." : `Messaggio in modalità ${settings.active_mode.toUpperCase()}...`}
                  className="flex-1 bg-darkBg text-sm border border-gray-850 rounded-xl px-4 py-3 text-gray-250 focus:outline-none focus:border-glowCyan transition-colors"
                  disabled={isListening}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-3 bg-darkBg text-glowCyan border border-gray-850 hover:border-glowCyan disabled:border-gray-850 disabled:text-gray-600 rounded-xl transition-all font-semibold"
                  title="Invia"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
            />
          )}

          {activeTab === 'sessioni' && (
            <div className="flex h-full w-full gap-4 p-4 text-gray-200">
              {/* Sessions List */}
              <div className="flex w-1/3 flex-col rounded-xl glass border border-gray-800 p-4">
                <h3 className="text-lg font-semibold glow-text-cyan flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-glowCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sessioni Salvate
                </h3>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {sessions.length === 0 ? (
                    <p className="text-gray-500 text-center text-xs py-8">Nessun file sessione presente</p>
                  ) : (
                    sessions.map((name) => (
                      <div
                        key={name}
                        onClick={() => {
                          setSelectedSessionName(name);
                          viewSessionContent(name);
                        }}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                          selectedSessionName === name
                            ? 'bg-darkSecondary border-glowCyan text-white'
                            : 'bg-transparent border-transparent hover:bg-darkSecondary hover:text-white'
                        }`}
                      >
                        <span className="text-xs truncate font-medium block">{name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* View Panel */}
              <div className="flex-1 flex flex-col rounded-xl glass border border-gray-800 p-4">
                {selectedSessionName ? (
                  <div className="flex-1 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-white">{selectedSessionName}</span>
                    </div>
                    {/* Render raw content of the session log */}
                    <div className="flex-1 w-full bg-darkBg text-gray-300 font-mono text-xs p-4 rounded-lg border border-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {/* We will load the actual content using a Tauri command */}
                      {selectedSessionContent || 'Caricamento contenuto sessione...'}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <p className="text-sm font-medium">Seleziona una sessione per visualizzarla</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="flex items-center justify-between px-6 py-2 bg-darkSecondary/90 border-t border-gray-850 text-xxs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Stato: <strong className="text-gray-300">{statusText}</strong></span>
        </div>
        <div className="flex items-center gap-4">
          <span>Verifica: <strong className={settings.verifier_enabled ? "text-emerald-400" : "text-gray-400"}>{settings.verifier_enabled ? "ON" : "OFF"}</strong></span>
          <span>Modalità: <strong className="text-glowCyan uppercase">{settings.active_mode}</strong></span>
        </div>
      </footer>
    </div>
  );
}
