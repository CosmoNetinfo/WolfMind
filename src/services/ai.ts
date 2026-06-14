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
      headers: { 'Content-Type': 'application/json' },
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
    console.error('Local Generator error:', error);
    throw new Error('Il Motore Locale non sta rispondendo. Se lo hai appena avviato, potrebbe stare caricando il modello (richiede fino a 30 secondi per modelli grandi).');
  }
}

/**
 * Sends a verification request to Local Model (Verifier Agent) with an 8-second timeout.
 * FIX: Timeout gestito correttamente con cleanup del timer.
 */
export async function verifyResponseWithLocalVerifier(
  model: string,
  originalUserPrompt: string,
  generatorResponse: string,
  kbContext: string,
  activeMode: string,
  ollamaUrl?: string
): Promise<VerificationResult> {

  const verifierSystemPrompt = `Sei l'Agente Verificatore di WolfMind. Analizza la risposta del Generatore rispetto alla richiesta utente, al contesto KB e alla modalità (${activeMode.toUpperCase()}).

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. Niente markdown, niente prefazioni. Solo JSON:
{
  "status": "OK" | "WARNING" | "ERROR",
  "note": "Spiegazione sintetica in italiano. Sii critico ed esigente."
}

Criteri:
- OK: risposta corretta, accurata, completa e coerente con la KB.
- WARNING: lievi inesattezze, omissioni, o Yoast non rispettato (se articolo).
- ERROR: errori gravi, contraddice la KB, manca struttura fondamentale.`;

  const userPrompt = `MODALITÀ: ${activeMode.toUpperCase()}

RICHIESTA UTENTE:
"""
${originalUserPrompt}
"""

CONTESTO KB:
"""
${kbContext}
"""

RISPOSTA DA VERIFICARE:
"""
${generatorResponse}
"""

Fornisci la verifica in JSON.`;

  const controller = new AbortController();
  // FIX: timeout con cleanup garantito tramite finally
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const baseUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          { role: 'system', content: verifierSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return {
        status: 'unavailable',
        note: `Verifica non disponibile: errore Motore Locale (Status ${response.status}). ${errBody}`
      };
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content?.trim() || '';

    try {
      const parsed = JSON.parse(rawContent);
      const status = (parsed.status || 'OK').toUpperCase();
      const note = parsed.note || 'Verifica completata.';
      let statusEnum: 'ok' | 'warning' | 'error' = 'ok';
      if (status === 'WARNING') statusEnum = 'warning';
      if (status === 'ERROR') statusEnum = 'error';
      return { status: statusEnum, note };
    } catch (_) {
      // Fallback regex se il modello ha aggiunto markdown
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
      return { status: 'ok', note: `Verifica completata (risposta non strutturata): ${rawContent}` };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      status: 'unavailable',
      note: error.name === 'AbortError'
        ? 'Verifica non disponibile: timeout superato (8s).'
        : 'Verifica non disponibile: errore di connessione.'
    };
  }
}

/**
 * Sends a code refinement request to Local Model (Coder Agent).
 * FIX: Nessun busy-wait. Risposta diretta senza loop.
 */
export async function refineCodeWithLocalCoder(
  model: string,
  originalUserPrompt: string,
  generatorResponse: string,
  kbContext: string,
  ollamaUrl?: string
): Promise<string> {

  const coderSystemPrompt = `Sei l'Agente Programmatore di WolfMind. Analizza la risposta del Generatore e ottimizza SOLO i blocchi di codice: completali, correggi bug, applica best practice.
Lascia invariato tutto il testo circostante. Se non c'è codice, restituisci la risposta originale IDENTICA senza modifiche.`;

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

Fornisci la versione finale ottimizzata.`;

  const baseUrl = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          { role: 'system', content: coderSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP Motore Locale: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || generatorResponse;
  } catch (error: any) {
    console.error('Coder Agent error:', error);
    // FIX: in caso di errore ritorna la risposta originale invece di bloccare la pipeline
    return generatorResponse;
  }
}
