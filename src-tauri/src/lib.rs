use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// Helper function to get the base installation directory (or CWD in dev)
fn get_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            // If running inside cargo build dirs, fallback to CWD
            if parent.file_name().map(|n| n == "debug" || n == "release").unwrap_or(false) {
                if let Some(grandparent) = parent.parent() {
                    if grandparent.file_name().map(|n| n == "target").unwrap_or(false) {
                        if let Ok(cwd) = std::env::current_dir() {
                            return cwd;
                        }
                    }
                }
            }
            return parent.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

// Ensure all application directories exist and write default files if missing
fn ensure_dirs_and_defaults() -> Result<(), String> {
    let base = get_base_dir();
    let config_dir = base.join("config");
    let profili_dir = config_dir.join("profili");
    let cervello_dir = base.join("cervello");
    let sessioni_dir = cervello_dir.join("sessioni");
    let logs_dir = base.join("logs");

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&profili_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&cervello_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&sessioni_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    // Create default settings if missing
    let settings_path = config_dir.join("settings.json");
    if !settings_path.exists() {
        let default_settings = r#"{
  "groq_api_key": "",
  "openrouter_api_key": "",
  "groq_model": "llama-3.3-70b-versatile",
  "openrouter_model": "qwen/qwen-2.5-72b-instruct:free",
  "coder_enabled": true,
  "openrouter_coder_model": "qwen/qwen-2.5-coder-32b-instruct:free",
  "tts_enabled": true,
  "tts_voice": "auto-italian",
  "tts_rate": 1.05,
  "verifier_enabled": true,
  "active_mode": "chat",
  "kb_max_tokens": 8000,
  "auto_save_session": true,
  "language": "it"
}"#;
        fs::write(&settings_path, default_settings).map_err(|e| e.to_string())?;
    }

    // Default profiles
    let chat_profile = profili_dir.join("chat.md");
    if !chat_profile.exists() {
        fs::write(
            &chat_profile,
            "Sei WolfMind, l'assistente AI personale di DanyWolf (Daniele Spalletti).\n\
            Rispondi in modo diretto, informale ma altamente professionale, usando l'italiano.\n\
            Sei specializzato nel supportarlo nei suoi progetti web, nella scrittura di articoli e nello sviluppo software.",
        )
        .map_err(|e| e.to_string())?;
    }

    let articoli_profile = profili_dir.join("articoli.md");
    if !articoli_profile.exists() {
        fs::write(
            &articoli_profile,
            "Sei WolfMind in modalità SCRITTURA ARTICOLI per CosmoNet.info.\n\
            Genera articoli completi in HTML Formato C (usa tag semantici come <article>, <h2>, <p>, <strong>, ecc. - NESSUN header/html/body/head boilerplate).\n\
            Segui rigorosamente le regole Yoast Readability:\n\
            - Frasi brevi (sotto le 20 parole)\n\
            - Paragrafi non più lunghi di 150 parole\n\
            - Transizioni adeguate ed alta leggibilità\n\
            Alla fine dell'articolo, includi SEMPRE un blocco JSON per la SEO:\n\
            ```json\n\
            {\n\
              \"title\": \"Titolo SEO-friendly (max 60 caratteri)\",\n\
              \"meta_description\": \"Meta descrizione accattivante (max 160 caratteri)\",\n\
              \"focus_keyword\": \"parola chiave principale\"\n\
            }\n\
            ```",
        )
        .map_err(|e| e.to_string())?;
    }

    let dev_brief_profile = profili_dir.join("dev-brief.md");
    if !dev_brief_profile.exists() {
        fs::write(
            &dev_brief_profile,
            "Sei WolfMind in modalità SVILUPPO BRIEF per Antigravity.\n\
            Aiuta DanyWolf a strutturare brief tecnici per nuovi progetti software.\n\
            Usa il Markdown per l'output, strutturando il documento con obiettivi, stack tecnologico, architettura, fasi di sviluppo e requisiti.\n\
            Fai domande chiarificatrici se noti ambiguità o parti mancanti del progetto.",
        )
        .map_err(|e| e.to_string())?;
    }

    // Default Cervello files
    let index_file = cervello_dir.join("INDEX.md");
    if !index_file.exists() {
        fs::write(
            &index_file,
            "# Indice Knowledge Base\n\n- [regole-articoli](file:///cervello/regole-articoli.md) - Regole di scrittura articoli CosmoNet.info\n- [regole-yoast](file:///cervello/regole-yoast.md) - Linee guida SEO Yoast\n- [stack-tecnologico](file:///cervello/stack-tecnologico.md) - Tecnologie di riferimento\n- [progetti-attivi](file:///cervello/progetti-attivi.md) - Stato e dettagli dei progetti attivi",
        )
        .map_err(|e| e.to_string())?;
    }

    let regole_articoli = cervello_dir.join("regole-articoli.md");
    if !regole_articoli.exists() {
        fs::write(
            &regole_articoli,
            "# COSMONET MASTER RULES\n\n\
            1. Gli articoli devono essere scritti in tono professionale ma accessibile (divulgazione scientifica/tecnologica).\n\
            2. Includere sempre fonti verificate e dati numerici quando possibile.\n\
            3. Evitare sensazionalismi.",
        )
        .map_err(|e| e.to_string())?;
    }

    let regole_yoast = cervello_dir.join("regole-yoast.md");
    if !regole_yoast.exists() {
        fs::write(
            &regole_yoast,
            "# Regole Yoast Readability\n\n\
            - Lunghezza frasi: Massimo 20 parole.\n\
            - Parole di transizione: Almeno il 30% delle frasi deve contenerne.\n\
            - Lunghezza paragrafi: Massimo 150 parole per paragrafo.\n\
            - Sottotitoli: Massimo 300 parole tra un sottotitolo (h2/h3) e l'altro.",
        )
        .map_err(|e| e.to_string())?;
    }

    let stack_teco = cervello_dir.join("stack-tecnologico.md");
    if !stack_teco.exists() {
        fs::write(
            &stack_teco,
            "# Stack Tecnologico di Riferimento\n\n\
            - Frontend: Next.js (App Router), React, Tailwind CSS\n\
            - Backend: Supabase (PostgreSQL, Auth, Storage, Edge Functions)\n\
            - Mobile: Flutter o React Native\n\
            - Desktop: Tauri v2",
        )
        .map_err(|e| e.to_string())?;
    }

    let progetti_attivi = cervello_dir.join("progetti-attivi.md");
    if !progetti_attivi.exists() {
        fs::write(
            &progetti_attivi,
            "# Progetti Attivi\n\n\
            - **Kashy**: App gestione spese e budget\n\
            - **TimbroSmart**: Soluzione timbratura dipendenti intelligente\n\
            - **CareLink**: Piattaforma coordinamento assistenza sanitaria",
        )
        .map_err(|e| e.to_string())?;
    }

    let brief_template = cervello_dir.join("brief-template.md");
    if !brief_template.exists() {
        fs::write(
            &brief_template,
            "# Progetto: [Nome Progetto]\n\n\
            ## 1. Obiettivo e Visione\n\n\
            ## 2. Stack Tecnologico Proposto\n\n\
            ## 3. Architettura e Flusso Dati\n\n\
            ## 4. Requisiti Funzionali Chiave\n\n\
            ## 5. Fasi di Sviluppo\n",
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_settings() -> Result<String, String> {
    ensure_dirs_and_defaults()?;
    let settings_path = get_base_dir().join("config").join("settings.json");
    fs::read_to_string(settings_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(settings_json: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let settings_path = get_base_dir().join("config").join("settings.json");
    fs::write(settings_path, settings_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_profiles() -> Result<HashMap<String, String>, String> {
    ensure_dirs_and_defaults()?;
    let profili_dir = get_base_dir().join("config").join("profili");
    let mut profiles = HashMap::new();

    let entries = fs::read_dir(profili_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|s| s == "md").unwrap_or(false) {
            let filename = path.file_stem().unwrap().to_string_lossy().into_owned();
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            profiles.insert(filename, content);
        }
    }
    Ok(profiles)
}

#[tauri::command]
fn save_profile(name: String, content: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let profile_path = get_base_dir().join("config").join("profili").join(format!("{}.md", name));
    fs::write(profile_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_kb_files() -> Result<HashMap<String, String>, String> {
    ensure_dirs_and_defaults()?;
    let cervello_dir = get_base_dir().join("cervello");
    let mut kb_files = HashMap::new();

    let entries = fs::read_dir(cervello_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|s| s == "md").unwrap_or(false) {
            let filename = path.file_name().unwrap().to_string_lossy().into_owned();
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            kb_files.insert(filename, content);
        }
    }
    Ok(kb_files)
}

#[tauri::command]
fn save_kb_file(name: String, content: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let file_path = get_base_dir().join("cervello").join(&name);
    fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_kb_file(name: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let file_path = get_base_dir().join("cervello").join(&name);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn save_session(name: String, content: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let session_path = get_base_dir().join("cervello").join("sessioni").join(format!("{}.md", name));
    fs::write(session_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sessions() -> Result<Vec<String>, String> {
    ensure_dirs_and_defaults()?;
    let sessioni_dir = get_base_dir().join("cervello").join("sessioni");
    let mut sessions = Vec::new();
    let entries = fs::read_dir(sessioni_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|s| s == "md").unwrap_or(false) {
            let filename = path.file_name().unwrap().to_string_lossy().into_owned();
            sessions.push(filename);
        }
    }
    sessions.sort();
    sessions.reverse();
    Ok(sessions)
}

#[tauri::command]
fn read_session(name: String) -> Result<String, String> {
    ensure_dirs_and_defaults()?;
    let session_path = get_base_dir().join("cervello").join("sessioni").join(&name);
    fs::read_to_string(session_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_app_log(message: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let log_path = get_base_dir().join("logs").join("app.log");
    use std::fs::OpenOptions;
    use std::io::Write;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    writeln!(file, "[{}] {}", now, message).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = ensure_dirs_and_defaults();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_profiles,
            save_profile,
            get_kb_files,
            save_kb_file,
            delete_kb_file,
            save_session,
            get_sessions,
            read_session,
            write_app_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

