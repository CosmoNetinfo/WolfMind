// Interactive Mock Demo of WolfMind App

const notesData = {
    "welcome": {
        title: "Benvenuto in WolfMind 🐺",
        content: `# Benvenuto in WolfMind!

Questo è il tuo workspace locale, sicuro e personalizzabile.

## Caratteristiche principali:
- **Editor Markdown** interattivo
- **Auto-Sync Git** invisibile e automatico in Rust
- **Integrazione IA** per assisterti nelle tue note

*Prova a modificare questo testo o a chiedere qualcosa all'IA a destra!*`
    },
    "idea": {
        title: "Idea per Nuova App 💡",
        content: `# Idea: Cosmonet App Hub

Una piattaforma centralizzata per distribuire mini utility di produttività.

## Stack tecnologico:
- Tauri v2 (Rust + React)
- Sincronizzazione tramite Git crittografato
- Ricerca semantica locale`
    },
    "todo": {
        title: "Lista Cose da Fare 📝",
        content: `# Cose da Fare per WolfMind

- [x] Configurare controlli finestra borderless
- [x] Abilitare i permessi in default.json
- [ ] Rilasciare versione v0.1.9
- [ ] Progettare la visualizzazione a grafo delle note`
    }
};

let currentNoteId = "welcome";
let syncTimeout = null;

// Initialize components when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    const noteItems = document.querySelectorAll(".demo-note-item");
    const editorTitle = document.querySelector(".demo-editor-title");
    const editorTextarea = document.querySelector(".demo-editor-textarea");
    const chatMessages = document.querySelector(".demo-chat-messages");
    const chatInput = document.querySelector(".demo-chat-input");
    const chatSendBtn = document.querySelector(".demo-chat-send");
    const syncToast = document.querySelector(".demo-sync-toast");
    const syncText = document.querySelector(".demo-sync-text");
    const syncSpinner = document.querySelector(".demo-sync-spinner");

    // Load initial note
    loadNote(currentNoteId);

    // Sidebar Note Switching
    noteItems.forEach(item => {
        item.addEventListener("click", () => {
            noteItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            
            const noteId = item.getAttribute("data-note-id");
            currentNoteId = noteId;
            loadNote(noteId);
        });
    });

    // Load note function
    function loadNote(noteId) {
        const note = notesData[noteId];
        editorTitle.value = note.title;
        editorTextarea.value = note.content;
    }

    // Trigger Mock Git Auto-Sync
    function triggerGitSync() {
        if (syncTimeout) clearTimeout(syncTimeout);
        
        // Save back changes in local data structure
        notesData[currentNoteId].title = editorTitle.value;
        notesData[currentNoteId].content = editorTextarea.value;

        // Show Staging state
        syncToast.classList.add("visible");
        syncSpinner.style.display = "block";
        syncText.innerHTML = "Git: Esecuzione auto-commit...";

        // Set sequence
        syncTimeout = setTimeout(() => {
            syncText.innerHTML = "Git: Push in corso su origin/main...";
            
            syncTimeout = setTimeout(() => {
                syncSpinner.style.display = "none";
                syncText.innerHTML = "✓ Git: Repository sincronizzato!";
                
                // Auto hide after 3 seconds
                syncTimeout = setTimeout(() => {
                    syncToast.classList.remove("visible");
                }, 3000);
            }, 1200);
        }, 1000);
    }

    // Textarea and title keyup events trigger git auto-sync
    editorTitle.addEventListener("input", () => {
        // Update sidebar item name immediately
        const activeItem = document.querySelector(`.demo-note-item[data-note-id="${currentNoteId}"]`);
        if (activeItem) {
            // Keep icon, only change text
            const icon = activeItem.querySelector('.note-icon') ? activeItem.querySelector('.note-icon').outerHTML : '';
            activeItem.innerHTML = `${icon} ${editorTitle.value}`;
        }
        triggerGitSync();
    });
    
    editorTextarea.addEventListener("input", triggerGitSync);

    // Chat mock logic
    chatSendBtn.addEventListener("click", sendChatMessage);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendChatMessage();
        }
    });

    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // User message
        appendMessage("user", text);
        chatInput.value = "";

        // Scroll
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Simulate AI thinking
        setTimeout(() => {
            let reply = "Ho analizzato la tua richiesta. Desideri che integri questa idea direttamente all'interno delle tue note correnti?";
            
            // Context aware responses
            const lowerText = text.toLowerCase();
            if (lowerText.includes("git") || lowerText.includes("sync")) {
                reply = "L'auto-sync Git di WolfMind viene eseguito nativamente in background. Esegue `git commit -m 'Salvataggio automatico'` seguito da `git push` ad ogni modifica delle note o sessioni.";
            } else if (lowerText.includes("ciao") || lowerText.includes("salve")) {
                reply = "Ciao! Sono il tuo assistente WolfMind IA. Come posso aiutarti a organizzare le tue idee o espandere i tuoi appunti oggi?";
            } else if (lowerText.includes("codice") || lowerText.includes("rust")) {
                reply = "Il core di WolfMind è sviluppato in Rust con Tauri v2 per garantire performance estreme e minimo consumo di RAM (solitamente meno di 60MB).";
            } else if (lowerText.includes("riassumi") || lowerText.includes("roadmap")) {
                reply = "Posso aiutarti a fare un riassunto dei tuoi obiettivi o formattare una timeline per i tuoi progetti personali.";
            }

            appendMessage("ai", reply);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `demo-msg ${sender}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
    }
});
