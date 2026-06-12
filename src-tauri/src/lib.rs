use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::process::{Child, Command};
use tauri::State;

struct EngineState {
    process: Mutex<Option<Child>>,
}

// Helper function to get the base installation directory (or CWD in dev)
fn get_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            // If running inside cargo build dirs, fallback to CWD
            if parent
                .file_name()
                .map(|n| n == "debug" || n == "release")
                .unwrap_or(false)
            {
                if let Some(grandparent) = parent.parent() {
                    if grandparent
                        .file_name()
                        .map(|n| n == "target")
                        .unwrap_or(false)
                    {
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
    let engine_dir = base.join("engine");
    let models_dir = base.join("models");

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&profili_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&cervello_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&sessioni_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&engine_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

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
  "language": "it",
  "ollama_enabled": false,
  "ollama_url": "http://localhost:11434",
  "ollama_model": "llama3",
  "continuous_listening": false,
  "rag_enabled": true
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

fn auto_git_commit_and_push(file_name: &str) {
    let base = get_base_dir();
    let cervello_dir = base.join("cervello");
    let repo_dir = if cervello_dir.join(".git").exists() {
        cervello_dir
    } else if base.join(".git").exists() {
        base
    } else {
        return;
    };

    let file_name_clone = file_name.to_string();
    std::thread::spawn(move || {
        let _ = std::process::Command::new("git")
            .args(&["add", "-A"])
            .current_dir(&repo_dir)
            .output();

        let commit_msg = format!("WolfMind Auto-Sync: {}", file_name_clone);
        let _ = std::process::Command::new("git")
            .args(&["commit", "-m", &commit_msg])
            .current_dir(&repo_dir)
            .output();

        let _ = std::process::Command::new("git")
            .args(&["push", "origin", "main"])
            .current_dir(&repo_dir)
            .output();
    });
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
    let profile_path = get_base_dir()
        .join("config")
        .join("profili")
        .join(format!("{}.md", name));
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
    fs::write(file_path, content).map_err(|e| e.to_string())?;
    auto_git_commit_and_push(&name);
    Ok(())
}

#[tauri::command]
fn delete_kb_file(name: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let file_path = get_base_dir().join("cervello").join(&name);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    auto_git_commit_and_push(&format!("eliminato {}", name));
    Ok(())
}

#[tauri::command]
fn query_kb_rag(query: String, max_results: usize) -> Result<String, String> {
    ensure_dirs_and_defaults()?;
    let base = get_base_dir();
    let cervello_dir = base.join("cervello");
    let entries = fs::read_dir(cervello_dir).map_err(|e| e.to_string())?;

    let query_terms: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .map(|s| s.chars().filter(|c| c.is_alphanumeric()).collect())
        .filter(|s: &String| !s.is_empty())
        .collect();

    if query_terms.is_empty() {
        return Ok(String::new());
    }

    let mut ranked_files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|s| s == "md").unwrap_or(false) {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let content_lower = content.to_lowercase();
            let filename = path.file_name().unwrap().to_string_lossy().into_owned();
            let filename_lower = filename.to_lowercase();

            let mut score = 0;
            for term in &query_terms {
                let count = content_lower.matches(term).count();
                score += count;
                if filename_lower.contains(term) {
                    score += 15;
                }
            }

            if score > 0 {
                ranked_files.push((score, filename, content));
            }
        }
    }

    ranked_files.sort_by(|a, b| b.0.cmp(&a.0));

    let mut context = String::new();
    let limit = std::cmp::min(ranked_files.len(), max_results);

    for i in 0..limit {
        let (_, filename, content) = &ranked_files[i];
        context.push_str(&format!("=== CONTESTO DA CERVELLO LOCALE: {} ===\n{}\n======================================\n\n", filename, content));
    }

    Ok(context)
}

#[tauri::command]
fn save_session(name: String, content: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let session_path = get_base_dir()
        .join("cervello")
        .join("sessioni")
        .join(format!("{}.md", name));
    fs::write(session_path, content).map_err(|e| e.to_string())?;
    auto_git_commit_and_push(&format!("sessione {}", name));
    Ok(())
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

#[tauri::command]
fn start_local_engine(model_name: String, state: State<'_, EngineState>) -> Result<(), String> {
    let base = get_base_dir();
    let engine_path = base.join("engine").join("llama-server.exe");
    let model_path = base.join("models").join(&model_name);

    if !engine_path.exists() {
        return Err("Motore (llama-server.exe) non trovato nella cartella engine.".to_string());
    }
    if !model_path.exists() {
        return Err("Modello GGUF non trovato.".to_string());
    }

    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    
    // Stop existing if any
    if let Some(mut child) = process_guard.take() {
        let _ = child.kill();
    }

    let child = Command::new(&engine_path)
        .arg("-m")
        .arg(&model_path)
        .arg("--port")
        .arg("11434")
        .spawn()
        .map_err(|e| e.to_string())?;

    *process_guard = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_local_engine(state: State<'_, EngineState>) -> Result<(), String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = process_guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
fn get_local_models() -> Result<Vec<String>, String> {
    ensure_dirs_and_defaults()?;
    let models_dir = get_base_dir().join("models");
    let mut models = Vec::new();
    let entries = fs::read_dir(models_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|s| s == "gguf").unwrap_or(false) {
            let filename = path.file_name().unwrap().to_string_lossy().into_owned();
            models.push(filename);
        }
    }
    models.sort();
    Ok(models)
}

#[tauri::command]
fn import_engine(source_path: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let engine_path = get_base_dir().join("engine").join("llama-server.exe");
    fs::copy(source_path, engine_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_model(source_path: String) -> Result<(), String> {
    ensure_dirs_and_defaults()?;
    let path = PathBuf::from(&source_path);
    let filename = path.file_name().ok_or("Invalid file")?.to_string_lossy().into_owned();
    let target_path = get_base_dir().join("models").join(filename);
    fs::copy(source_path, target_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = ensure_dirs_and_defaults();
    tauri::Builder::default()
        .manage(EngineState {
            process: Mutex::new(None),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            write_app_log,
            query_kb_rag,
            start_local_engine,
            stop_local_engine,
            get_local_models,
            import_engine,
            import_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
