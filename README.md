# 🐺 WolfMind

> Assistente AI desktop personale per **DanyWolf** (Daniele Spalletti)  
> *Sviluppato con Tauri v2, React 18, TypeScript e Tailwind CSS.*

WolfMind è un'applicazione desktop **AI vocale multi-agente** con base di conoscenza (Knowledge Base) in Markdown gestita localmente. Nasce per sostituire e ottimizzare il workflow quotidiano di scrittura articoli per **CosmoNet.info**, stesura brief tecnici per **Antigravity** e brainstorming tecnologico offline/locale (ad eccezione delle chiamate API).

---

## 🛠️ Stack Tecnologico

- **Desktop Shell**: [Tauri v2](https://tauri.app/) (Rust) — Garantisce un eseguibile nativo leggerissimo (~3MB installer), basso consumo di RAM e accesso diretto al file system locale.
- **Frontend**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS v3 con design system premium scuro, dettagli luminescenti e micro-animazioni.
- **Speech Integration**: Web Speech API nativa (Chromium) per Speech-To-Text (STT) e Text-To-Speech (TTS) con filtro intelligente dei blocchi di codice e tag.
- **Multi-Agent Pipeline**:
  1. **Agente 1 — Groq (Generatore)**: Utilizza `llama-3.3-70b-versatile` ad altissima velocità e bassissima latenza per generare la risposta principale integrando la KB.
  2. **Agente 2 — OpenRouter (Programmatore)**: Modello `qwen/qwen-2.5-coder-32b-instruct:free`. Si attiva automaticamente in presenza di blocchi di codice o in modalità tecnica, per ottimizzare, completare ed eliminare bug dal codice.
  3. **Agente 3 — OpenRouter (Verificatore)**: Modello `qwen/qwen-2.5-72b-instruct:free` con timeout di 8s per verificare accuratezza, Yoast readability (in modalità articolo) e conformità con il cervello locale.

---

## 📁 Struttura Cartelle (Modalità Portable)

L'applicazione opera in modalità *portable*, salvando tutte le configurazioni e file nella stessa directory dell'eseguibile:

```
📁 WolfMind/
├── WolfMind.exe                    ← Eseguibile dell'applicazione
├── config/
│   ├── settings.json               ← API keys, modelli attivi e preferenze
│   └── profili/
│       ├── chat.md                 ← Prompt di sistema per la chat libera
│       ├── articoli.md             ← Regole Yoast e COSMONET_MASTER_RULES
│       └── dev-brief.md            ← Prompt per la generazione di brief tecnici
├── cervello/                       ← Knowledge Base (KB) locale
│   ├── INDEX.md                    ← Indice e mappa della KB
│   ├── regole-articoli.md          ← Regole editoriali CosmoNet
│   ├── regole-yoast.md             ← Linee guida leggibilità Yoast
│   ├── stack-tecnologico.md        ← Tecnologie e stack preferiti
│   ├── progetti-attivi.md          ← Kashy, TimbroSmart, CareLink, ecc.
│   ├── brief-template.md           ← Template di riferimento per i brief
│   └── sessioni/
│       ├── YYYY-MM-DD-HH-MM.md     ← Riassunti automatici delle sessioni
│       └── ...
└── logs/
    └── app.log                     ← Log di sistema dell'applicazione
```

> [!NOTE]
> All'avvio, se le cartelle o i file di default sopra descritti non esistono, il backend Rust li rigenera automaticamente in modalità *self-healing*.

---

## 🚀 Avvio in Locale

### Prerequisiti
Assicurati di aver installato sul tuo sistema:
1. **Node.js** (versione v18 o superiore)
2. **Rust & Cargo** (installabile tramite [rustup](https://rustup.rs/))

### Installazione delle dipendenze
Dalla cartella principale del progetto, installa le dipendenze npm:
```bash
npm install
```

### Esecuzione in modalità Sviluppo
Avvia il server di sviluppo frontend e la finestra desktop di Tauri con il comando:
```bash
npm run tauri dev
```

### Compilazione per il Rilascio (Production)
Per compilare ed impacchettare l'applicazione in un installer di Windows (.msi/.exe):
```bash
npm run build
# per tauri:
npm run tauri build
```

---

## ⚙️ Configurazione & API Keys

1. Avvia l'applicazione in locale o in release.
2. Apri la sidebar cliccando sull'icona dell'ingranaggio (**⚙️**) in alto a destra.
3. Inserisci la tua **Groq API Key** e **OpenRouter API Key**.
4. Scegli i modelli preferiti per ciascun agente.
5. Abilita o disabilita le opzioni vocali (TTS) e gli agenti aggiuntivi (Programmatore e Verificatore).
6. Le chiavi e le preferenze verranno salvate in modo sicuro e persistente all'interno del file `/config/settings.json`.
