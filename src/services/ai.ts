export type ChatContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

export interface VerificationResult {
  status: 'ok' | 'warning' | 'error' | 'unavailable';
  note: string;
}

/**
 * Sends a message to the Local Generator Model (Ollama/GGUF)
 */
export async function sendMessageToLocalGenerator(
  model: string,
  systemPrompt: string,
  conversationHistory: ChatMessage[],
  ollamaUrl?: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
  ];

  const baseUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'llama3',
        messages,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP Motore Locale: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error("Local Generator error:", error);
    throw new Error("Impossibile connettersi al server locale. Assicurati che il Motore sia avviato o che Ollama sia acceso.");
  }
}

/**
 * Sends a verification request to Local Model (Verifier Agent) with an 8-second timeout
 */
export async function verifyResponseWithLocalVerifier(
  model: string,
  originalUserPrompt: string,
  generatorResponse: string,
  kbContext: string,
  activeMode: string,
  ollamaUrl?: string
): Promise<VerificationResult> {

  const verifierSystemPrompt = `Sei l'Agente Verificatore di WolfMind. Il tuo compito è analizzare la risposta fornita da un modello AI (il Generatore) a fronte della richiesta dell'utente, del contesto della Knowledge Base locale e della modalità di lavoro attiva (${activeMode.toUpperCase()}).

Devi rispondere ESCLUSIVAMENTE con un oggetto JSON valido. Non includere blocchi di codice markdown (tipo \`\`\`json), non aggiungere prefazioni o postfazioni. Restituisci SOLO l'oggetto JSON con questa struttura:
{
  "status": "OK" | "WARNING" | "ERROR",
  "note": "Una spiegazione sintetica in italiano dei riscontri. Sii molto critico ed esigente."
}

Regole di valutazione:
- OK: La risposta del generatore è corretta, accurata, completa e coerente con la Knowledge Base.
- WARNING: La risposta è discreta ma presenta lievi inesattezze, omette dettagli rilevanti o non rispetta a pieno le linee guida Yoast (se articolo).
- ERROR: La risposta contiene errori gravi, contraddice i dati del cervello, manca di parti tecniche fondamentali, o fallisce la struttura (es. non è in HTML Formato C se articolo, o manca il blocco SEO).`;

  const userPrompt = `MODALITÀ DI LAVORO ATTIVA: ${activeMode.toUpperCase()}

RICHIESTA DELL'UTENTE:
"""
${originalUserPrompt}
"""

CONTESTO KNOWLEDGE BASE (CERVELLO):
"""
${kbContext}
"""

RISPOSTA GENERATA DA ANALIZZARE:
"""
${generatorResponse}
"""

Fornisci la tua verifica strutturata esclusivamente in JSON come richiesto.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  const baseUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          { role: 'system', content: verifierSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return {
        status: 'unavailable',
        note: `Verifica non disponibile: errore Motore Locale (Status ${response.status}). Dettaglio: ${errBody}`
      };
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content?.trim() || '';

    try {
      // Try parsing the response as JSON
      const parsed = JSON.parse(rawContent);
      const status = (parsed.status || 'OK').toUpperCase();
      const note = parsed.note || 'Verifica completata con successo.';

      let statusEnum: 'ok' | 'warning' | 'error' = 'ok';
      if (status === 'WARNING') statusEnum = 'warning';
      if (status === 'ERROR') statusEnum = 'error';

      return {
        status: statusEnum,
        note
      };
    } catch (parseError) {
      console.warn("Could not parse verifier JSON directly, trying regex extract:", rawContent);
      // Fallback regex attempt in case the model outputted markdown or extra text
      const jsonMatch = rawContent.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const status = (parsed.status || 'OK').toUpperCase();
          const note = parsed.note || 'Verifica completata.';
          let statusEnum: 'ok' | 'warning' | 'error' = 'ok';
          if (status === 'WARNING') statusEnum = 'warning';
          if (status === 'ERROR') statusEnum = 'error';
          return { status: statusEnum, note };
        } catch (_) {}
      }
      return {
        status: 'ok', // fallback to ok to not block user, but show parsing note
        note: `Verifica completata (risposta non strutturata): ${rawContent}`
      };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("OpenRouter Verifier error or timeout:", error);
    return {
      status: 'unavailable',
      note: error.name === 'AbortError' 
        ? 'Verifica non disponibile: il verificatore ha impiegato più di 8 secondi (Timeout).' 
        : 'Verifica non disponibile: errore di connessione con il verificatore.'
    };
  }
}

/**
 * Sends a code refinement request to Local Model (Coder Agent)
 */
export async function refineCodeWithLocalCoder(
  model: string,
  originalUserPrompt: string,
  generatorResponse: string,
  kbContext: string,
  ollamaUrl?: string
): Promise<string> {

  const coderSystemPrompt = `Sei l'Agente Programmatore di WolfMind. Il tuo compito è analizzare la risposta tecnica del Generatore e assicurarti che tutti i blocchi di codice o di markup presenti siano completi (nessun segnaposto o commento incompleto), sintatticamente corretti, privi di bug e scritti secondo le best practice.
Riscrivi la risposta ottimizzando esclusivamente le porzioni di codice o di markup, lasciando intatto il testo circostante. Se non è presente alcun codice, restituisci la risposta originale intatta.`;

  const userPrompt = `RICHIESTA UTENTE:
"""
${originalUserPrompt}
"""

CONTESTO KB:
"""
${kbContext}
"""

RISPOSTA GENERATORE:
"""
${generatorResponse}
"""

Fornisci la versione finale ottimizzata mantenendo la stessa struttura della risposta originale.`;

  const baseUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          { role: 'system', content: coderSystemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP Motore Locale: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || generatorResponse;
  } catch (error: any) {
    console.error("OpenRouter Coder error:", error);
    throw new Error(error.message || "Errore durante il raffinamento del codice.");
  }
}

