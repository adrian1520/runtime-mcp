export const widgetHtml = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Runtime-MCP</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0f1c;
      --panel: #111827;
      --accent: #60a5fa;
      --text: #e5eefb;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 12px;
      line-height: 1.5;
      font-size: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    h2 { margin: 0 0 12px 0; font-size: 1.1rem; }
    button {
      background: #1e2937;
      color: white;
      border: 1px solid #475569;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { background: #334155; border-color: var(--accent); }
    button.primary { background: #2563eb; border-color: transparent; }
    pre {
      background: #0f172a;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      font-size: 13px;
      max-height: 420px;
      white-space: pre-wrap;
    }
    .status { font-size: 13px; margin: 8px 0; }
    .error { color: #fb7185; }
    .success { color: #34d399; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔧 Runtime-MCP Dashboard</h2>
    <div class="status" id="status">Inicjalizacja...</div>
    
    <button id="loadBtn" class="primary">Odśwież dane repo + pamięci</button>
    <button id="clearBtn">Wyczyść</button>

    <pre id="output">Kliknij przycisk aby załadować dane...</pre>
  </div>

  <script type="module">
    const $ = id => document.getElementById(id);
    let isLoading = false;

    function log(text, type = 'info') {
      const output = $('output');
      const timestamp = new Date().toLocaleTimeString('pl-PL');
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      output.textContent += \`[\${timestamp}] \${prefix} \${text}\\n\`;
      output.scrollTop = output.scrollHeight;
    }

    function setStatus(text, isError = false) {
      const statusEl = $('status');
      statusEl.textContent = text;
      statusEl.className = 'status ' + (isError ? 'error' : 'success');
    }

    async function safeCallTool(name, args = {}) {
      try {
        if (window.openai?.callTool) {
          return await window.openai.callTool(name, args);
        }
        if (window.parent) {
          window.parent.postMessage({
            method: 'tools/call',
            params: { name, args }
          }, '*');
          return { status: 'sent' };
        }
        return { error: "Brak MCP hosta" };
      } catch (err) {
        console.error(err);
        return { error: err.message || 'Nieznany błąd' };
      }
    }

    async function loadData() {
      if (isLoading) return;
      isLoading = true;
      $('loadBtn').disabled = true;
      
      setStatus('Ładowanie danych...');
      log('Rozpoczęto ładowanie...', 'info');

      try {
        const results = await Promise.allSettled([
          safeCallTool('repository.files', { limit: 50 }),
          safeCallTool('memory_list', { prefix: '', limit: 15 })
        ]);

        let summary = '';

        if (results[0].status === 'fulfilled') {
          const files = results[0].value?.files || results[0].value || [];
          summary += \`Plików: \${files.length || 0}\\n\`;
        } else {
          summary += '❌ repository.files — błąd\\n';
        }

        if (results[1].status === 'fulfilled') {
          const mem = results[1].value || {};
          summary += \`Memory keys: \${mem.count || mem.keys?.length || 0}\\n\`;
        } else {
          summary += '❌ memory_list — błąd\\n';
        }

        $('output').textContent = summary || 'Brak danych';
        setStatus('✅ Dane załadowane', false);
        log('Zakończono pomyślnie', 'success');

      } catch (e) {
        setStatus('Błąd ładowania: ' + e.message, true);
        log('Błąd: ' + e.message, 'error');
      } finally {
        isLoading = false;
        $('loadBtn').disabled = false;
      }
    }

    // Event listeners
    $('loadBtn').addEventListener('click', loadData);
    $('clearBtn').addEventListener('click', () => {
      $('output').textContent = '';
      log('Wyczyszczono konsolę', 'info');
    });

    // Auto load po załadowaniu
    window.addEventListener('load', () => {
      setTimeout(loadData, 800);
    });
  </script>
</body>
</html>`;
