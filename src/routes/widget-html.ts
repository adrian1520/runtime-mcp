// src/routes/widget-html.ts
export const widgetHtml = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Runtime-MCP</title>
  <style>
    :root {
      --bg: #0a0f1c;
      --panel: #111827;
      --accent: #60a5fa;
      --text: #e5eefb;
      --muted: #94a3b8;
      --success: #34d399;
      --error: #fb7185;
    }
    * { box-sizing: border-box; margin:0; padding:0; }
    body {
      font-family: system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 16px;
      line-height: 1.5;
      font-size: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    h2 {
      margin-bottom: 12px;
      font-size: 1.15rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button {
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid #475569;
      background: #1e2937;
      color: white;
    }
    button:hover { background: #334155; }
    button.primary {
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      border-color: transparent;
    }
    pre {
      background: #02060f;
      padding: 14px;
      border-radius: 8px;
      overflow: auto;
      max-height: 380px;
      font-size: 13px;
      white-space: pre-wrap;
      border: 1px solid #1e2937;
    }
    .status {
      padding: 8px 12px;
      border-radius: 6px;
      margin: 10px 0;
      font-size: 13px;
    }
    .success { background: rgba(52, 211, 153, 0.15); color: var(--success); }
    .error { background: rgba(251, 113, 133, 0.15); color: var(--error); }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔧 Runtime-MCP Control Panel</h2>
    
    <div id="status" class="status">Gotowy do działania...</div>
    
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <button id="loadBtn" class="primary">📊 Załaduj dane</button>
      <button id="clearBtn">🧹 Wyczyść</button>
    </div>

    <pre id="output">Kliknij "Załaduj dane" aby sprawdzić repozytorium i pamięć agenta.</pre>
  </div>

  <script type="module">
    const $ = id => document.getElementById(id);
    let isLoading = false;

    function setStatus(msg, type = 'info') {
      const el = $('status');
      el.textContent = msg;
      el.className = 'status ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
    }

    function log(text, type = 'info') {
      const output = $('output');
      const time = new Date().toLocaleTimeString('pl-PL');
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '→';
      output.textContent += \`[\${time}] \${prefix} \${text}\\n\`;
      output.scrollTop = output.scrollHeight;
    }

    async function callTool(name, args = {}) {
      try {
        if (window.openai?.callTool) {
          return await window.openai.callTool(name, args);
        }
        if (window.parent) {
          window.parent.postMessage({ method: 'tools/call', params: { name, args }}, '*');
          return { note: "Wysłano do hosta" };
        }
        throw new Error("Brak wsparcia MCP w tym środowisku");
      } catch (e) {
        console.error(e);
        return { error: e.message };
      }
    }

    async function loadData() {
      if (isLoading) return;
      isLoading = true;
      $('loadBtn').disabled = true;

      setStatus("Ładowanie...", "info");
      log("Rozpoczynanie ładowania...", "info");

      try {
        const [repoRes, memRes] = await Promise.allSettled([
          callTool('repository.files', { limit: 30 }),
          callTool('memory_list', { prefix: '', limit: 12 })
        ]);

        let summary = "=== PODSUMOWANIE ===\\n\\n";

        if (repoRes.status === 'fulfilled') {
          const count = repoRes.value?.files?.length || 0;
          summary += \`📁 Plików w repo: \${count}\\n\`;
        } else {
          summary += "📁 repository.files — błąd\\n";
        }

        if (memRes.status === 'fulfilled') {
          const count = memRes.value?.count || memRes.value?.keys?.length || 0;
          summary += \`💾 Kluczy pamięci: \${count}\\n\`;
        } else {
          summary += "💾 memory_list — błąd\\n";
        }

        $('output').textContent = summary;
        setStatus("✅ Dane załadowane pomyślnie", "success");
        log("Zakończono sukcesem", "success");

      } catch (err) {
        setStatus("Błąd: " + err.message, "error");
        log("Błąd: " + err.message, "error");
      } finally {
        isLoading = false;
        $('loadBtn').disabled = false;
      }
    }

    // Inicjalizacja
    $('loadBtn').addEventListener('click', loadData);
    $('clearBtn').addEventListener('click', () => {
      $('output').textContent = '';
      log('Konsola wyczyszczona', 'info');
    });

    // Auto-load z opóźnieniem
    window.addEventListener('load', () => setTimeout(loadData, 600));
  </script>
</body>
</html>`;
