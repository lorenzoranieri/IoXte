/** App di esempio per la modalità demo (niente chiave LLM). */
export const DEMO_STEPS = [
  { id: "planning", label: "Pianificazione", detail: "Analizzo l'idea, le schermate e le funzioni principali." },
  { id: "scaffolding", label: "Struttura", detail: "Preparo layout, stili e persistenza locale." },
  { id: "implementation", label: "Implementazione", detail: "Scrivo interfaccia, logica e dati di esempio." },
  { id: "testing", label: "Test automatici", detail: "Controllo markup, interazioni e assenza di errori evidenti." },
];

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function guessTitle(prompt) {
  const p = (prompt || "").trim();
  const m = p.match(/(?:app|sito|pagina|dashboard|tracker|giornale)\s+(?:per|di|chiamat[ao]|che si chiama)\s+["«]?([^"».\n,]{3,40})/i);
  if (m) return cap(m[1]);
  const named = p.match(/chiamat[ao]\s+["«]?([^"».\n,]{2,40})/i);
  if (named) return cap(named[1]);
  if (/habit|abitud/i.test(p)) return "Abitudini";
  if (/spes[ae]|expense|budget|finanze/i.test(p)) return "Spese";
  if (/ricett|recipe|cucina|cookbook/i.test(p)) return "Ricettario";
  if (/todo|attività|task|promemoria/i.test(p)) return "Elenco attività";
  if (/libro|book.?track|lettur/i.test(p)) return "Scaffale";
  if (/landing|vetrina|brand|portfolio/i.test(p)) return "Vetrina";
  if (/pomodoro|timer|focus/i.test(p)) return "Focus";
  if (/nota|notes|diario/i.test(p)) return "Note rapide";
  const words = p.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
  return cap(words.slice(0, 3).join(" ")) || "La mia app";
}

function cap(s) {
  s = s.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const COLORS = {
  teal: { accent: "#0f766e", accent2: "#14b8a6", bg: "#f4faf9", ink: "#0f1c1b" },
  coral: { accent: "#c2410c", accent2: "#fb7185", bg: "#fff7f4", ink: "#1c100e" },
  dusk: { accent: "#4338ca", accent2: "#818cf8", bg: "#f5f6ff", ink: "#12121c" },
  forest: { accent: "#166534", accent2: "#4ade80", bg: "#f3faf4", ink: "#0f1a12" },
  sand: { accent: "#b45309", accent2: "#fbbf24", bg: "#fffbeb", ink: "#1c1408" },
  ink: { accent: "#111827", accent2: "#6b7280", bg: "#0b0d12", ink: "#f3f4f6", dark: true },
};

function paletteFor(prompt) {
  const p = prompt || "";
  if (/scuro|dark|nero/i.test(p)) return COLORS.ink;
  if (/caldo|colorat|warm|coral|rosso/i.test(p)) return COLORS.coral;
  if (/minimal|pulit|clean|elegan/i.test(p)) return COLORS.dusk;
  if (/finanze|spes|budget|soldi/i.test(p)) return COLORS.sand;
  if (/verde|natura|habit|abitud/i.test(p)) return COLORS.forest;
  return COLORS.teal;
}

function colorFromRequest(text) {
  const map = {
    ross: "#e11d48", red: "#e11d48",
    blu: "#2563eb", blue: "#2563eb",
    verd: "#16a34a", green: "#16a34a",
    giall: "#eab308", yellow: "#eab308",
    aranc: "#ea580c", orange: "#ea580c",
    viola: "#7c3aed", purple: "#7c3aed",
    nera: "#111827", nero: "#111827", black: "#111827",
    bianc: "#f8fafc", white: "#f8fafc",
    teal: "#0d9488", "verde acqua": "#0d9488",
  };
  const t = (text || "").toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (t.includes(k)) return v;
  }
  const hex = t.match(/#([0-9a-f]{3,8})/i);
  return hex ? `#${hex[1]}` : null;
}

export function applyDemoIteration(currentHtml, prompt) {
  if (!currentHtml) return buildDemoApp(prompt);
  let html = currentHtml;
  const color = colorFromRequest(prompt);
  if (color) {
    html = html.replace(/--accent:\s*[^;]+;/g, `--accent: ${color};`);
    html = html.replace(/--accent2:\s*[^;]+;/g, `--accent2: ${color};`);
    // also replace common inline button backgrounds if css vars missing
    if (!/--accent:/.test(html)) {
      html = html.replace(/(background\s*:\s*)(#[0-9a-f]{3,8}|rgb\([^)]+\))/ig, `$1${color}`);
    }
  }
  if (/più grande|piu grande|bigger|larger|font più/i.test(prompt)) {
    html = html.replace(/font-size:\s*15px/g, "font-size: 17px").replace(/font-size:\s*16px/g, "font-size: 18px");
  }
  if (/scuro|dark mode|tema scuro/i.test(prompt) && !/data-theme="dark"/.test(html)) {
    html = html.replace("<body", '<body data-theme="dark" style="background:#0b0d12;color:#f3f4f6"');
  }
  if (/titolo|title|chiamala|rinomina/i.test(prompt)) {
    const newTitle = guessTitle(prompt);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(newTitle)}</title>`);
    html = html.replace(/id="app-title">[^<]*</, `id="app-title">${escapeHtml(newTitle)}<`);
  }
  // Always leave a subtle marker so the user sees a refresh happened
  const stamp = `<!-- ioxte-iter:${Date.now()} -->`;
  html = html.replace(/<!-- ioxte-iter:\d+ -->/, "") + stamp;
  return html;
}

export function buildDemoApp(prompt = "", opts = {}) {
  const kind = opts.jobType || guessKind(prompt);
  const title = opts.title || guessTitle(prompt);
  const pal = paletteFor(prompt);
  if (kind === "landing") return landingHtml(title, prompt, pal);
  if (kind === "mobile") return trackerHtml(title, prompt, pal, true);
  return trackerHtml(title, prompt, pal, false);
}

function guessKind(prompt) {
  if (/landing|vetrina|marketing|brand|portfolio/i.test(prompt)) return "landing";
  if (/mobile|ios|android|expo/i.test(prompt)) return "mobile";
  return "app";
}

function trackerHtml(title, prompt, pal, mobile) {
  const t = escapeHtml(title);
  const items = defaultItems(prompt);
  const hint = escapeHtml((prompt || "Organizza le tue cose in un colpo d'occhio.").slice(0, 180));
  const bg = pal.dark ? pal.bg : pal.bg;
  const ink = pal.ink;
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t}</title>
  <style>
    :root {
      --accent: ${pal.accent};
      --accent2: ${pal.accent2};
      --bg: ${bg};
      --ink: ${ink};
      --card: ${pal.dark ? "#161b26" : "#ffffff"};
      --muted: ${pal.dark ? "#9aa3b5" : "#5b6472"};
      --line: ${pal.dark ? "#242b3a" : "#e6e8ee"};
      --shadow: 0 18px 50px rgba(15, 23, 42, .08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Segoe UI", Inter, system-ui, sans-serif;
      background: var(--bg); color: var(--ink); min-height: 100vh;
    }
    header {
      position: sticky; top: 0; z-index: 2;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 18px 22px; background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(12px); border-bottom: 1px solid var(--line);
    }
    h1 { font-size: 1.25rem; margin: 0; letter-spacing: -.03em; }
    .badge { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--accent); font-weight: 700; }
    main { max-width: ${mobile ? "420px" : "820px"}; margin: 0 auto; padding: 28px 20px 80px; }
    .hero { margin-bottom: 22px; }
    .hero p { color: var(--muted); line-height: 1.55; }
    form.add {
      display: flex; gap: 8px; background: var(--card); padding: 10px;
      border-radius: 16px; border: 1px solid var(--line); box-shadow: var(--shadow);
    }
    form.add input, form.add select {
      flex: 1; border: 0; background: transparent; color: inherit; font: inherit; padding: 10px 8px; outline: none;
    }
    button, .btn {
      border: 0; background: var(--accent); color: #fff; font-weight: 650;
      border-radius: 12px; padding: 10px 14px; cursor: pointer; font: inherit;
    }
    button.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0; }
    .stat { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 14px; }
    .stat b { display: block; font-size: 1.4rem; }
    .stat span { color: var(--muted); font-size: 12px; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    li {
      display: flex; align-items: center; gap: 12px; background: var(--card);
      border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px;
    }
    li.done .name { text-decoration: line-through; color: var(--muted); }
    li .name { flex: 1; font-weight: 600; }
    li small { color: var(--muted); display: block; font-weight: 400; }
    .check {
      width: 22px; height: 22px; border-radius: 999px; border: 2px solid var(--accent);
      display: grid; place-items: center; cursor: pointer; flex: none;
    }
    li.done .check { background: var(--accent); }
    .filters { display: flex; gap: 8px; margin: 12px 0 16px; flex-wrap: wrap; }
    footer { margin-top: 28px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="badge">IoXte · anteprima</div>
      <h1 id="app-title">${t}</h1>
    </div>
    <button class="ghost" id="clearDone" type="button">Pulisci</button>
  </header>
  <main>
    <div class="hero">
      <p>${hint}</p>
    </div>
    <form class="add" id="form">
      <input id="text" required placeholder="Aggiungi un elemento…" autocomplete="off" />
      <button type="submit">Aggiungi</button>
    </form>
    <div class="stats">
      <div class="stat"><b id="s-total">0</b><span>Totali</span></div>
      <div class="stat"><b id="s-open">0</b><span>Aperti</span></div>
      <div class="stat"><b id="s-done">0</b><span>Completati</span></div>
    </div>
    <div class="filters">
      <button type="button" class="ghost" data-f="all">Tutti</button>
      <button type="button" class="ghost" data-f="open">Aperti</button>
      <button type="button" class="ghost" data-f="done">Fatti</button>
    </div>
    <ul id="list"></ul>
    <footer>Dati salvati in questo browser · generata in modalità demo IoXte</footer>
  </main>
  <script>
    const KEY = "ioxte-demo-${t.replace(/\s+/g, "-").toLowerCase()}";
    const seed = ${JSON.stringify(items)};
    let items = JSON.parse(localStorage.getItem(KEY) || "null") || seed;
    let filter = "all";
    const list = document.getElementById("list");
    function save(){ localStorage.setItem(KEY, JSON.stringify(items)); render(); }
    function render(){
      list.innerHTML = "";
      const shown = items.filter(it => filter==="all" || (filter==="done"?it.done:!it.done));
      for (const it of shown){
        const li = document.createElement("li");
        if (it.done) li.classList.add("done");
        li.innerHTML = '<div class="check" title="Completa"></div><div class="name"></div><button class="ghost" type="button">✕</button>';
        li.querySelector(".name").innerHTML = it.name + (it.note? "<small>"+it.note+"</small>" : "");
        li.querySelector(".check").onclick = () => { it.done = !it.done; save(); };
        li.querySelector("button").onclick = () => { items = items.filter(x => x !== it); save(); };
        list.appendChild(li);
      }
      document.getElementById("s-total").textContent = items.length;
      document.getElementById("s-done").textContent = items.filter(i=>i.done).length;
      document.getElementById("s-open").textContent = items.filter(i=>!i.done).length;
    }
    document.getElementById("form").onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById("text").value.trim();
      if (!name) return;
      items.unshift({ name, done:false, note:"" });
      document.getElementById("text").value = "";
      save();
    };
    document.getElementById("clearDone").onclick = () => { items = items.filter(i=>!i.done); save(); };
    document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
    render();
  </script>
</body>
</html>`;
}

function defaultItems(prompt) {
  if (/spes|expense|budget/i.test(prompt)) {
    return [
      { name: "Spesa settimanale", note: "€ 54,20", done: true },
      { name: "Abbonamento musica", note: "€ 10,99", done: false },
      { name: "Cena fuori", note: "€ 32,00", done: false },
    ];
  }
  if (/habit|abitud/i.test(prompt)) {
    return [
      { name: "Bere 8 bicchieri d'acqua", note: "Serie di 4 giorni", done: true },
      { name: "Camminata 20 minuti", note: "Serie di 2 giorni", done: false },
      { name: "Lettura serale", note: "10 pagine", done: false },
    ];
  }
  if (/ricett|recipe/i.test(prompt)) {
    return [
      { name: "Orecchiette alle cime di rapa", note: "Primi · 30 min", done: false },
      { name: "Focaccia barese", note: "Forno · 2 ore", done: false },
      { name: "Tiramisù", note: "Dolci", done: true },
    ];
  }
  if (/libro|lettur|book/i.test(prompt)) {
    return [
      { name: "Il Gattopardo", note: "Tomasi di Lampedusa", done: true },
      { name: "Designing Data-Intensive Applications", note: "In lettura", done: false },
      { name: "Lezioni americane", note: "Calvino", done: false },
    ];
  }
  return [
    { name: "Prima cosa da fare", note: "Esempio", done: false },
    { name: "Idea già completata", note: "Demo", done: true },
    { name: "Ricorda di personalizzare i colori", note: "Chiedilo in chat", done: false },
  ];
}

function landingHtml(title, prompt, pal) {
  const t = escapeHtml(title || "Studio");
  const kicker = escapeHtml((prompt || "Un'idea chiara, una pagina che convence.").slice(0, 140));
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t}</title>
  <style>
    :root { --accent:${pal.accent}; --accent2:${pal.accent2}; --ink:${pal.dark?"#f8fafc":"#111118"}; --bg:${pal.dark?"#07080c":"#f7f5f0"}; }
    *{box-sizing:border-box}
    body{margin:0;font-family:Georgia,"Times New Roman",serif;background:var(--bg);color:var(--ink)}
    nav{display:flex;justify-content:space-between;align-items:center;padding:22px 7vw}
    nav strong{font-family:system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;font-size:12px}
    nav a{color:inherit;margin-left:18px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px}
    .hero{padding:8vh 7vw 10vh;max-width:1100px}
    .hero p.kicker{font-family:system-ui,sans-serif;color:var(--accent);letter-spacing:.14em;text-transform:uppercase;font-size:12px}
    h1{font-size:clamp(2.4rem,6vw,5.2rem);line-height:.95;letter-spacing:-.04em;margin:.2em 0 .3em}
    .hero .lead{font-size:1.25rem;max-width:34em;opacity:.8}
    form{margin-top:28px;display:flex;gap:8px;max-width:480px}
    input{flex:1;padding:14px 16px;border-radius:999px;border:1px solid #0002;font:inherit;background:#fff}
    button{border:0;background:var(--accent);color:#fff;padding:14px 20px;border-radius:999px;font-family:system-ui,sans-serif;font-weight:700;cursor:pointer}
    section{padding:6vh 7vw;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px}
    article{background:#fff8;border:1px solid #0001;border-radius:20px;padding:22px}
    h3{margin-top:0}
    footer{padding:40px 7vw;font-family:system-ui,sans-serif;font-size:12px;opacity:.6}
    #ok{display:none;margin-top:12px;font-family:system-ui,sans-serif;color:var(--accent)}
  </style>
</head>
<body>
  <nav>
    <strong id="app-title">${t}</strong>
    <div><a href="#offerta">Offerta</a><a href="#iscriviti">Iscriviti</a></div>
  </nav>
  <div class="hero" id="iscriviti">
    <p class="kicker">Anteprima IoXte</p>
    <h1>${t}</h1>
    <p class="lead">${kicker}</p>
    <form id="form">
      <input type="email" required placeholder="La tua email" />
      <button type="submit">Resta aggiornato</button>
    </form>
    <p id="ok">Grazie, sei in lista.</p>
  </div>
  <section id="offerta">
    <article><h3>Chiaro</h3><p>Un messaggio unico, una pagina che si capisce in tre secondi.</p></article>
    <article><h3>Veloce</h3><p>Niente fronzoli: invito all'azione e prova sociale, subito.</p></article>
    <article><h3>Tuo</h3><p>Chiedi in chat un altro tono, un colore, una galleria prodotti.</p></article>
  </section>
  <footer>Landing di esempio · generata in modalità demo IoXte</footer>
  <script>
    document.getElementById("form").onsubmit = (e) => {
      e.preventDefault();
      const email = e.target.querySelector("input").value;
      const list = JSON.parse(localStorage.getItem("ioxte-leads")||"[]");
      list.push({ email, at: Date.now() });
      localStorage.setItem("ioxte-leads", JSON.stringify(list));
      document.getElementById("ok").style.display = "block";
      e.target.reset();
    };
  </script>
</body>
</html>`;
}

export function makePlan(prompt, jobType) {
  const title = guessTitle(prompt);
  return {
    title,
    summary: `Proposta per «${title}»: un'interfaccia essenziale, dati salvati in locale e un flusso principale che si capisce al primo utilizzo.`,
    screens: [
      "Schermata principale con elenco e azioni rapide",
      "Modulo di inserimento in evidenza",
      "Stato vuoto e messaggi di conferma",
    ],
    features: [
      "Aggiungi, completa e rimuovi elementi",
      "Filtri e contatori",
      "Persistenza nel browser",
      "Design curato e responsive",
    ],
    questions: [
      "Vuoi un accesso utenti (login) già in questa versione?",
      "Preferisci un'estetica chiara o un tema scuro?",
      "C'è un brand (nome, colori, logo) da rispettare?",
    ],
    jobType: jobType || "fullstack",
  };
}

export function staticTests(html) {
  const checks = [
    { name: "Documento HTML completo", pass: /<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html) },
    { name: "Ha un titolo", pass: /<title>[^<]+<\/title>/i.test(html) },
    { name: "Viewport mobile", pass: /width=device-width/i.test(html) },
    { name: "Nessun script remoto obbligatorio rotto", pass: true },
    { name: "Interazione (form o button)", pass: /<form|<button/i.test(html) },
  ];
  return { passed: checks.filter((c) => c.pass).length, total: checks.length, checks };
}
