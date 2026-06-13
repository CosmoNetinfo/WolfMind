with open('src/App.tsx', 'r', encoding='utf-8') as f:  
    c = f.read()  
c = c.replace('addLog(Impossibile recuperare i modelli da Ollama.);', 'addLog(Impossibile recuperare i modelli da Ollama., \'ERROR\');')  
c = c.replace('addLog(Errore recupero modelli GGUF: );', 'addLog(Errore recupero modelli GGUF: , \'ERROR\');')  
c = c.replace('addLog(Errore pipeline: );', 'addLog(Errore pipeline: , \'ERROR\');')  
c = c.replace('addLog(STT: \" "\);', 'addLog(STT: \\, \'USER\');')  
c = c.replace('addLog(Risposta generata correttamente.);', 'addLog(Risposta generata correttamente., \'API\');')  
with open('src/App.tsx', 'w', encoding='utf-8') as f:  
    f.write(c)  
