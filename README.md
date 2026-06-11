# 🐺 WolfMind

<p align="center">
  <img src="public/WolfMidLogo.png" width="150" alt="WolfMind Logo" />
</p>

> Assistente AI desktop personale per **DanyWolf** (Daniele Spalletti)  
> *Sviluppato con Tauri v2, React 18, TypeScript e Tailwind CSS.*

## 📸 Screenshot

<p align="center">
  <img src="public/screenshot.png" width="700" alt="WolfMind Interface" />
</p>

WolfMind è un'applicazione desktop **AI vocale multi-agente** con base di conoscenza (Knowledge Base) in Markdown gestita localmente. Nasce per sostituire e ottimizzare il workflow quotidiano di scrittura articoli per **CosmoNet.info**, stesura brief tecnici per **Antigravity** e brainstorming tecnologico offline/locale (ad eccezione delle chiamate API).

---

## 🛠️ Stack Tecnologico

- **Desktop Shell**: [Tauri v2](https://tauri.app/) (Rust) — Garantisce un eseguibile nativo leggerissimo (~3MB installer), basso consumo di RAM e accesso diretto al file system locale.
- **Frontend**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS v3 con design system premium scuro, dettagli luminescenti e micro-animazioni.
- **Speech Integration**: Web Speech API nativa (Chromium) per Speech-To-Text (STT) e Text-To-Speech (TTS) con filtro intelligente dei blocchi di codice e tag.
- **Borderless Window Controls**: Finestra frameless personalizzata con gestione nativa dei controlli di riduzione a icona, massimizzazione e chiusura (risolti e configurati in `v0.1.9`).
- **Interactive Landing Page**: Presentazione del progetto disponibile nella cartella `/landing/` con una demo interattiva completa eseguibile direttamente nel browser.
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

---

## 🔑 Come Ottenere Chiavi API Gratuite

Per utilizzare WolfMind senza costi operativi, puoi avvalerti dei piani gratuiti dei due provider integrati:

### 1. Groq Cloud (Generazione a Bassa Latenza)
Groq offre un piano gratuito estremamente generoso con limiti di rate limiting molto alti per scopi di sviluppo e personali.
* **Come ottenerla**:
  1. Registrati o accedi alla [Groq Console](https://console.groq.com/).
  2. Vai nella sezione **API Keys** nel menu di sinistra.
  3. Fai clic su **Create API Key**, assegna un nome (es. `WolfMind-Local`) e copia la chiave generata (inizia con `gsk_`).
  4. Inseriscila nella sidebar di WolfMind.

### 2. OpenRouter (Modelli Coder e Verificatore Gratuiti)
OpenRouter aggrega centinaia di modelli e offre l'accesso a potenti modelli open source in modalità totalmente gratuita (contrassegnati dal suffisso `:free`).
* **Come ottenerla**:
  1. Accedi o registrati su [OpenRouter.ai](https://openrouter.ai/).
  2. Vai su **Keys** all'interno delle impostazioni del tuo account o nella dashboard principale.
  3. Fai clic su **Create Key**, nominala e copia il codice (inizia con `sk-or-`).
  4. Incolla la chiave nella sidebar di WolfMind.
* **Modelli Consigliati Gratuiti**:
  - Per l'Agente Programmatore: `qwen/qwen-2.5-coder-32b-instruct:free`
  - Per l'Agente Verificatore: `qwen/qwen-2.5-72b-instruct:free` o `deepseek/deepseek-r1:free`

---

## 📖 Guida all'Uso dell'Applicazione

WolfMind è strutturato per essere guidato sia via testo sia via voce. Ecco le funzionalità principali per ciascuna sezione dell'app:

### 💬 Tab Chat (Lavoro con gli Agenti)
La schermata principale dove interagisci con la pipeline intelligente dei tre agenti:
* **Attivazione Vocale**: Fai clic sul pulsante **Microfono** in basso a sinistra. Lo Speech-to-Text si attiverà. WolfMind ascolterà le tue parole e le digiterà per te nel campo di testo.
* **Esecuzione in Pipeline**:
  - Quando invii una richiesta, l'**Agente Generatore** (Groq) formula la prima stesura integrando la tua base di conoscenza locale.
  - Se è abilitato il **Programmatore** e nella risposta è presente del codice, l'Agente Coder (OpenRouter) interviene in background per ottimizzare, correggere bug ed eliminare errori di sintassi.
  - Successivamente, l'**Agente Verificatore** analizza la risposta finale per garantire la coerenza con le tue regole o i concetti Yoast.
* **Sintesi Vocale**: Se abilitata, l'applicazione leggerà la risposta finale con una voce fluida, rimuovendo automaticamente tag HTML o blocchi di codice per non disturbare l'ascolto.
* **Salvataggio Sessione**: Cliccando su **Salva Sessione** in alto a destra, l'intera conversazione viene archiviata come file Markdown `.md` organizzato in `/cervello/sessioni/` con un riepilogo cronologico.

### 🧠 Tab Cervello (Knowledge Base Locale)
Gestione diretta della tua conoscenza offline:
* **Elenco File**: A sinistra vedi tutti i file `.md` della tua cartella `/cervello/`.
* **Editor Integrato**: Cliccando su un file, puoi modificarlo direttamente all'interno dell'editor di testo Markdown integrato a destra. Fai clic su **Salva Modifiche** per salvarlo istantaneamente nel file system.
* **Nuovo File**: Cliccando sul pulsante **`+`** a destra di "Cervello Locale", puoi inserire il nome di un nuovo documento per crearlo all'istante.

### 📁 Tab Sessioni (Storico Conversazioni)
* Consente di sfogliare tutte le vecchie sessioni salvate.
* Clicca su un file per visualizzare il log completo della conversazione precedente formattato in formato testuale all'interno del visualizzatore a destra.

---

## 🔮 Integrazioni Future Possibili

WolfMind è progettato per essere scalabile ed espandibile nel tempo. Ecco le evoluzioni pianificate o possibili per le future versioni:

1. **Integrazione LLM 100% Locali (Ollama)**:
   - Configurazione di endpoint locali (es. `http://localhost:11434`) per consentire a WolfMind di far girare modelli come Llama 3 o Qwen Coder in modalità totalmente offline direttamente sulla GPU del tuo computer.
2. **Vector DB e RAG Avanzato (Memory Agent)**:
   - Implementazione di un database vettoriale embedded (come SQLite-VSS o LanceDB) per indicizzare la Knowledge Base locale. Questo permetterà all'AI di eseguire ricerche semantiche intelligenti invece di leggere la cartella in modo piatto.
3. **Attivazione Vocale Continua ("Wake Word")**:
   - Integrazione di motori locali leggeri come Porcupine o Rust-pocketspinx per consentire all'app di attivarsi pronunciando una parola chiave (es. *"Ehi Wolf"* o *"WolfMind"*), avviando la conversazione a mani libere.
4. **Speech-to-Text e Text-to-Speech Offline**:
   - Sostituzione della Web Speech API con modelli locali (Whisper.cpp per STT ad altissima precisione e Piper TTS per voci in italiano incredibilmente naturali e prive di latenza internet).
5. **[IMPLEMENTATO] Git Sync Automatico delle Note**:
   - Committing e push automatici in background della cartella `/cervello/` su repository remoto ogni volta che modifichi o crei un file Markdown o salvi una sessione, assicurando backup e sincronizzazione immediata senza bloccare l'interfaccia.
6. **[IMPLEMENTATO] Modulo Auto-Updater (Tauri v2)**:
   - Controllo automatico degli aggiornamenti all'avvio dell'app e possibilità di controllo manuale con un clic dalle Impostazioni. Gestisce il download e l'installazione nativa con riavvio per garantire che l'app rimanga sempre aggiornata.



