const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const EXAMPLES = [
  { label: "Tracker di abitudini", text: "Costruisci un tracker di abitudini in cui posso aggiungere abitudini, segnarle ogni giorno e vedere la serie di giorni consecutivi. Design caldo e colorato, un tocco per completare." },
  { label: "Registro spese", text: "Costruisci un registro spese semplice: importo, categoria e data, filtri per categoria e totale del mese. Tema moderno, inserimento rapido in cima all'elenco." },
  { label: "Landing di prodotto", text: "Crea una landing page per un piccolo brand di ceramiche: titolo, galleria di pezzi con prezzo e una form per iscriversi al lancio. Stile pulito, molto spazio bianco." },
  { label: "Ricettario", text: "Un ricettario in cui aggiungo titolo, ingredienti e passi, con tag per tipo di piatto e ricerca per ingrediente. Deve essere facile da scorrere e veloce da compilare." },
];

const state = {
  route: location.hash || "#/",
  config: null,
  health: null,
  user: null,
  token: localStorage.getItem("ioxte.token") || "",
  projects: JSON.parse(localStorage.getItem("ioxte.projects") || "[]"),
  currentId: null,
  annual: true,
  jobType: "fullstack",
  planMode: false,
  maxx: false,
  agentTier: "i1",
  budget: "",
  attachments: [],
  generating: false,
  steps: [],
  streamText: "",
  tab: "preview",
  viewport: "desktop",
  visualEdit: false,
  visualQueue: [],
  toast: "",
  modal: null,
  nia: false,
  niaInput: "",
};

function saveLocal() {
  localStorage.setItem("ioxte.projects", JSON.stringify(state.projects));
  if (state.token) localStorage.setItem("ioxte.token", state.token);
}

function current() {
  return state.projects.find((p) => p.id === state.currentId) || null;
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Errore ${res.status}`);
  return data;
}

async function restoreSession() {
  if (state.user) return state.user;
  if (!state.token) return null;
  try {
    const me = await api("/api/me");
    state.user = me.user;
    return state.user;
  } catch {
    state.token = "";
    state.user = null;
    localStorage.removeItem("ioxte.token");
    return null;
  }
}

function requireUser() {
  if (state.user && state.token) return true;
  toast("Per generare un'app devi accedere o registrarti. Così i crediti del modello restano sotto controllo.");
  navTo("#/accedi");
  return false;
}

async function boot() {
  try {
    state.health = await fetch("/api/health").then((r) => r.json());
    state.config = await fetch("/api/config").then((r) => r.json());
  } catch (e) {
    state.health = { mode: "demo", message: "Server non raggiungibile." };
  }
  await restoreSession();
  if (state.user) {
    try {
      const { projects } = await api("/api/projects");
      if (projects?.length) {
        const local = state.projects;
        state.projects = projects.map((b) => local.find((p) => p.id === b.id) || { ...b, messages: [], html: "" });
      }
    } catch {}
  } else {
    state.projects = [];
  }
  window.addEventListener("hashchange", () => { state.route = location.hash || "#/"; render(); });
  render();
}

function navTo(hash) { location.hash = hash; }

function toast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => { if (state.toast === msg) { state.toast = ""; render(); } }, 4200);
}

function fmtMoney(n) {
  if (n == null) return "Su preventivo";
  return n === 0 ? "0 $" : `${n} $`;
}

function header(extraRight = "") {
  const u = state.user;
  const demo = state.health?.mode === "demo";
  return `<header class="topnav">
    <a class="wordmark" href="#/"><img src="/img/logo.svg" alt="" /><span>Io<b>X</b>te</span></a>
    <nav>
      <a href="#/">Crea</a>
      <a href="#/prezzi">Prezzi</a>
      <a href="#/account">Account</a>
      <a href="#/nia">Nia</a>
      <a href="#/stato">Stato</a>
    </nav>
    <div class="right">
      ${demo ? `<span class="chip">Modalità <strong>demo</strong></span>` : `<span class="chip">LLM <strong>attivo</strong></span>`}
      ${u ? `<span class="chip">${escape(u.plan)} · <strong>${u.credits}</strong> crediti</span>
        <a class="btn sm ghost" href="#/account">${escape((u.name||"").split(" ")[0]||"Account")}</a>` : `<a class="btn sm ghost" href="#/accedi">Accedi</a><a class="btn sm primary" href="#/accedi">Registrati</a>`}
      ${extraRight}
    </div>
  </header>`;
}

function render() {
  const app = $("#app");
  const r = state.route || "#/";
  document.body.className = r.startsWith("#/workspace") ? "ws" : "";
  const needAuth = r.startsWith("#/workspace/") || r.startsWith("#/account") || r.startsWith("#/nia");
  if (needAuth && !state.user) { app.innerHTML = viewLogin(); }
  else if (r.startsWith("#/workspace/")) renderWorkspace(app);
  else if (r.startsWith("#/prezzi")) app.innerHTML = viewPricing();
  else if (r.startsWith("#/account")) app.innerHTML = viewAccount();
  else if (r.startsWith("#/accedi")) app.innerHTML = viewLogin();
  else if (r.startsWith("#/nia")) app.innerHTML = viewNia();
  else if (r.startsWith("#/stato")) app.innerHTML = viewStatus();
  else if (r.startsWith("#/privacy")) app.innerHTML = viewPrivacy();
  else app.innerHTML = viewLanding();
  bind();
  if (state.toast) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = state.toast;
    app.appendChild(t);
  }
  if (state.modal) app.insertAdjacentHTML("beforeend", state.modal);
}

function viewLanding() {
  const h = state.health || {};
  return `${header()}
  <section class="hero">
    <div class="kicker"><img src="/img/logo.svg" width="16" height="16" alt="" /> Laboratorio di app con l'AI</div>
    <h1>Descrivi l'idea.<br>IoXte la costruisce.</h1>
    <p class="lead">Uno spazio in cui parli con un agente, vedi l'app prendere forma nell'anteprima e la pubblichi quando è pronta. Niente tela da imparare: solo una conversazione e un risultato che puoi usare.</p>
    ${h.mode === "demo" ? `<div class="banner">Modalità demo attiva: le app di esempio ti permettono di provare tutta l'interfaccia. Per la generazione reale serve una chiave <code>XAI_API_KEY</code>, <code>OPENAI_API_KEY</code> o <code>ANTHROPIC_API_KEY</code> sul server.</div>` : (h.keyOk === false ? `<div class="banner err">${escape(h.message||"La chiave del modello non è valida.")}</div>` : "")}
    <div class="composer" id="composer">
      <div class="types">
        ${[["fullstack","App completa"],["mobile","Mobile"],["landing","Landing"],["brainstorm","Brainstorm"]].map(([id,l]) => `<button type="button" data-job="${id}" class="${state.jobType===id?"on":""}">${l}</button>`).join("")}
      </div>
      <textarea id="idea" placeholder="Es. Un'app per tenere i preventivi dei clienti, con stato, importo e una vista mensile…">${escape(state.draft || "")}</textarea>
      <div class="bar">
        <div class="left">
          <div class="seg">
            <button type="button" data-plan="0" class="${!state.planMode?"on":""}">Costruisci</button>
            <button type="button" data-plan="1" class="${state.planMode?"on":""}">Pianifica</button>
          </div>
          <label class="chip"><input type="file" id="attach" hidden multiple /> + Allegati</label>
          <label class="chip" title="Piano Pro"><input type="checkbox" id="maxx" ${state.maxx?"checked":""}/> Intensiva</label>
          <select class="mini" id="agent">
            <option value="i1" ${state.agentTier==="i1"?"selected":""}>I1 Base</option>
            <option value="i2" ${state.agentTier==="i2"?"selected":""}>I2 Squadra</option>
            <option value="i3" ${state.agentTier==="i3"?"selected":""}>I3 Autonomo</option>
          </select>
          <input class="mini" id="budget" placeholder="Tetto crediti" value="${escape(state.budget)}" style="width:110px" />
        </div>
        <div class="right">
          <button class="btn primary" id="go">${state.planMode ? "Prepara il piano" : "Costruisci l'app"}</button>
        </div>
      </div>
    </div>
    <div class="examples">
      ${EXAMPLES.map((e,i) => `<button type="button" data-ex="${i}">${escape(e.label)}</button>`).join("")}
    </div>
  </section>
  <section class="section">
    <h2>Tre passi, e l'app è tua</h2>
    <p class="sub">Niente wizard lunghi. Racconti, sistemi, pubblichi.</p>
    <div class="grid3">
      <article class="card step"><n>1</n><h3>Racconta l'idea</h3><p>Scrivi cosa deve fare, per chi e quale azione è davvero essenziale. L'agente mette in piedi schermate e funzioni.</p></article>
      <article class="card step"><n>2</n><h3>Sistemala parlando</h3><p>Guarda l'anteprima, chiedi «rendi il pulsante rosso», clicca gli elementi o torna a un checkpoint se qualcosa si rompe.</p></article>
      <article class="card step"><n>3</n><h3>Pubblica quando è pronta</h3><p>L'anteprima resta un laboratorio privato. Con un piano adatto ottieni un indirizzo pubblico, lo aggiorni e lo spegni quando vuoi.</p></article>
    </div>
  </section>
  <section class="section">
    <h2>Uno spazio di lavoro, tutto sotto mano</h2>
    <p class="sub">Chat dell'agente, anteprima dal vivo, codice, segreti, pubblicazione e crediti nello stesso schermo.</p>
    <div class="grid4">
      ${[["Chat e passi","Vedi pianificazione, struttura, codice e test mentre arrivano."],["Anteprima viva","Prova l'app subito, anche sul formato telefono."],["Codice tuo","Copialo, scaricalo come HTML o salvalo su GitHub."],["Piani e crediti","La stessa struttura a pacchetti: Free, Standard, Pro e oltre."]].map(([t,p]) => `<article class="card"><h3>${t}</h3><p>${p}</p></article>`).join("")}
    </div>
  </section>
  <section class="section">
    <div class="stats card">
      <div><b>1 file</b><span>App web completa, pronta da aprire</span></div>
      <div><b>4 modi</b><span>App completa, mobile, landing, brainstorm</span></div>
      <div><b>Tu decidi</b><span>Piani e crediti chiari, dal gratuito in su</span></div>
    </div>
  </section>
  <section class="section faq">
    <h2>Domande frequenti</h2>
    ${faqItem("Cos'è IoXte?", "È un generatore di applicazioni: descrivi quello che vuoi in italiano (o in un'altra lingua) e un agente costruisce un'app web che puoi vedere, modificare e scaricare.")}
    ${faqItem("Devo saper programmare?", "No. Se sai programmare puoi comunque aprire il codice, modificarlo a mano e chiedere all'agente di ripartire da lì.")}
    ${faqItem("Chi possiede il codice?", "Tu. Puoi copiarlo, scaricarlo e ospitarlo dove preferisci.")}
    ${faqItem("Cos'è la modalità demo?", "Se sul server non c'è una chiave LLM, IoXte restituisce app di esempio e ti fa provare chat, anteprima, crediti e pubblicazione simulata. Non viene chiamato nessun modello a pagamento.")}
    ${faqItem("Come funzionano i piani?", "Come una piattaforma a crediti: un allotment mensile, ricariche che non scadono e fasce di pubblicazione. Trovi i prezzi aggiornati nella pagina Prezzi.")}
  </section>
  ${footer()}
  ${niaWidget()}`;
}

function faqItem(q, a) { return `<details><summary>${q}</summary><p>${a}</p></details>`; }
function footer() {
  return `<footer class="site"><div>© ${new Date().getFullYear()} IoXte · fatto per Lorenzo Ranieri</div>
    <nav><a href="#/prezzi">Prezzi</a><a href="#/privacy">Privacy</a><a href="#/stato">Stato</a></nav></footer>`;
}

function viewPricing() {
  const cfg = state.config?.plans;
  const plans = cfg?.plans || [];
  const annual = state.annual;
  const pub = cfg?.publishingTiers || [];
  const tops = cfg?.topups || [];
  return `${header()}
  <div class="wrap">
    <div style="text-align:center;max-width:700px;margin:0 auto 28px">
      <div class="kicker">Pacchetti</div>
      <h1 class="serif" style="font-size:2.6rem;margin:0 0 8px">Piani chiari, crediti misurabili</h1>
      <p class="sub">La struttura riprende i pacchetti per clienti di riferimento del mercato (Free, Standard, Pro, Business, Enterprise): allotment mensile, sconto annuale e ricariche. I prezzi che vedi in questa pagina sono quelli in vigore.</p>
    </div>
    <div class="bill-toggle">
      <div class="seg">
        <button type="button" data-ann="0" class="${!annual?"on":""}">Mensile</button>
        <button type="button" data-ann="1" class="${annual?"on":""}">Annuale · risparmi</button>
      </div>
    </div>
    <div class="price-grid">
      ${plans.map((p) => {
        const price = p.custom ? null : (annual && p.annualMonthlyPrice ? p.annualMonthlyPrice : p.monthlyPrice);
        const hi = p.highlighted;
        return `<article class="price-card ${hi?"hi":""}">
          ${hi?`<span class="tag">Consigliato</span>`:""}
          <h3>${escape(p.name)}</h3>
          <p class="tagline">${escape(p.tagline||"")}</p>
          <div class="amt">${p.custom ? "Custom" : fmtMoney(price)} ${p.custom?"":`<small>/ mese</small>`}</div>
          ${annual && p.annualSavings ? `<div class="save">Risparmi ${p.annualSavings} $ all'anno</div>` : `<div class="save">${p.monthlyCredits!=null? p.monthlyCredits+" crediti / mese":"Crediti su misura"}</div>`}
          <ul>${(p.features||[]).map((f)=>`<li>${escape(f)}</li>`).join("")}</ul>
          ${p.custom
            ? `<button class="btn ghost" data-sales="${p.id}">Parliamone</button>`
            : `<button class="btn ${hi?"primary":"ghost"}" data-buy="${p.id}">${p.monthlyPrice===0?"Inizia gratis":"Scegli "+p.name}</button>`}
        </article>`;
      }).join("")}
    </div>
    <h2 class="serif" style="margin:56px 0 8px">Ricariche crediti</h2>
    <p class="sub">I crediti acquistati non scadono. I crediti del piano si azzerano a ogni rinnovo.</p>
    <div class="grid4">
      ${tops.map((t) => `<article class="card"><h3>${t.credits.toLocaleString("it-IT")} crediti</h3><p>${t.price} $ · ${(t.price/t.credits).toFixed(2)} $ / credito</p><button class="btn sm" style="margin-top:12px" data-top="${t.id}">Ricarica</button></article>`).join("")}
    </div>
    <h2 class="serif" style="margin:56px 0 8px">Fasce di pubblicazione</h2>
    <p class="sub">Ogni app pubblicata ha un costo fisso mensile in crediti, finché resta online. Ripubblicare non aggiunge il costo della fascia.</p>
    <div class="grid4">
      ${pub.map((t) => `<article class="card"><h3>${escape(t.name)}</h3><p><strong>${t.creditsPerMonth}</strong> crediti/mese<br>${escape(t.cpu)} · ${escape(t.memory)}<br>${escape(t.use)}</p></article>`).join("")}
    </div>
  </div>${footer()}${niaWidget()}`;
}

function viewAccount() {
  const u = state.user || {};
  const usage = (u._usage || state._usage || []);
  return `${header()}
  <div class="wrap">
    <h1 class="serif">Account</h1>
    <p class="sub">Ciao ${escape(u.name || "Lorenzo")}. Qui gestisci piano, crediti e dati.</p>
    <div class="grid3">
      <article class="card"><h3>Piano</h3><p>Attuale: <strong>${escape(u.plan||"free")}</strong> (${escape(u.interval||"monthly")})</p>
        <p style="margin-top:8px">Crediti: <strong>${u.credits ?? 0}</strong><br>di piano ${u.creditsSub||0} · ricarica ${u.creditsTopup||0} · promo ${u.creditsPromo||0}</p>
        <a class="btn sm primary" style="margin-top:12px" href="#/prezzi">Cambia piano</a>
        <button class="btn sm ghost" id="cancelPlan" style="margin-top:8px">Disdici a fine ciclo</button>
      </article>
      <article class="card"><h3>Profilo</h3>
        <label class="field">Nome <input id="acc-name" value="${escape(u.name||"")}"/></label>
        <label class="field">Email <input id="acc-email" value="${escape(u.email||"")}"/></label>
        <button class="btn sm" id="saveProfile">Salva</button>
      </article>
      <article class="card"><h3>System prompt ${u.limits?.canEditSystemPrompt?"":"(Pro)"}</h3>
        <label class="field">Istruzioni persistenti<textarea id="sys" rows="4">${escape(u.systemPrompt||"")}</textarea></label>
        <button class="btn sm" id="saveSys">Salva prompt</button>
      </article>
    </div>
    <h2 class="serif" style="margin-top:40px">Nia su WhatsApp</h2>
    <article class="card" id="wa-box"><p>Caricamento canale…</p></article>
    <h2 class="serif" style="margin-top:40px">Utilizzo recente</h2>
    <table class="usage"><thead><tr><th>Quando</th><th>Motivo</th><th>Crediti</th><th>Residuo</th></tr></thead>
    <tbody id="usage-body"><tr><td colspan="4">Caricamento…</td></tr></tbody></table>
    <h2 class="serif" style="margin-top:40px">Zona pericolosa</h2>
    <button class="btn warn" id="delAcc">Elimina account e progetti</button>
  </div>${footer()}`;
}

function viewLogin() {
  const signup = state.authMode === "signup";
  return `${header()}
  <div class="wrap" style="max-width:480px">
    <h1 class="serif">${signup ? "Crea un account" : "Accedi a IoXte"}</h1>
    <p class="sub">${signup
      ? "Registrati per costruire app. I nuovi account partono dal piano Free, con un tetto di crediti, così la chiave del modello non resta aperta a tutti."
      : "Accedi con email e password per generare e salvare i tuoi progetti."}</p>
    <div class="seg" style="margin-bottom:16px">
      <button type="button" data-auth="login" class="${!signup?"on":""}">Accedi</button>
      <button type="button" data-auth="signup" class="${signup?"on":""}">Registrati</button>
    </div>
    ${signup ? `<label class="field">Nome <input id="log-name" autocomplete="name" placeholder="Il tuo nome" /></label>` : ""}
    <label class="field">Email <input id="log-email" type="email" autocomplete="username" placeholder="tu@email.it" /></label>
    <label class="field">Password <input id="log-pass" type="password" autocomplete="${signup?"new-password":"current-password"}" placeholder="${signup?"Almeno 8 caratteri":""}" /></label>
    <button class="btn primary" id="doLogin">${signup ? "Crea account" : "Entra"}</button>
  </div>${footer()}`;
}

function viewStatus() {
  const h = state.health || {};
  const p = state.config?.providers || {};
  return `${header()}<div class="wrap">
    <h1 class="serif">Stato della piattaforma</h1>
    <article class="card"><h3>Generazione</h3><p>Modo: <strong>${h.mode}</strong>${h.provider? " · "+h.provider.name+" / "+h.provider.model:""}</p><p>${escape(h.message||"")}</p></article>
    <div class="grid3" style="margin-top:16px">
      ${[["Stripe", p.stripe],["GitHub", state.config?.githubEnabled],["Razorpay", p.razorpay],["Paddle", p.paddle],["PagBrasil", p.pagbrasil],["RevenueCat", p.revenuecat]].map(([n,ok]) => `<article class="card"><h3>${n}</h3><p>${ok?"Collegato":"In attesa di chiavi"}</p></article>`).join("")}
    </div>
  </div>${footer()}`;
}

function viewPrivacy() {
  return `${header()}<div class="wrap"><h1 class="serif">Privacy e dati</h1>
    <p>I progetti di questo prototipo restano sul server IoXte (cartella <code>data/</code>) e, in copia di lavoro, nel tuo browser. Non usiamo i tuoi contenuti per addestrare modelli. Puoi eliminare account e progetti dalla pagina Account. Per un accordo sul trattamento dati o per un'ipotesi di hosting solo UE, scrivi al titolare.</p>
  </div>${footer()}`;
}

function niaWidget() {
  return `<button class="help-fab" id="toggleNia" title="Nia, assistente IoXte">N</button>
    <div class="nia ${state.nia?"":"hide"}" id="nia">
      <strong>Nia</strong> · assistente IoXte
      <p style="color:var(--muted);font-size:13px">Posso spiegarti piani, crediti, la differenza tra anteprima e pubblicazione, o come scrivere un buon primo prompt.</p>
      <p style="font-size:13px">${niaAnswer(state.niaInput) || "Prova a chiedere: «come funzionano i crediti?»"}</p>
      <input class="mini" style="width:100%;margin-top:8px" id="nia-q" placeholder="Scrivi una domanda" value="${escape(state.niaInput||"")}"/>
    </div>`;
}


function viewNia() {
  return `${header()}
  <div class="wrap">
    <div class="kicker">Assistente</div>
    <h1 class="serif">Nia</h1>
    <p class="sub">L'assistente IoXte sui canali che usi già. Su WhatsApp può dirti i crediti, elencare i progetti, costruire o modificare un'app, pubblicare (con conferma) e ricordarti le attività. Equivale, per flusso, a un wingman: non è l'agente di build del workspace, ma è collegata al tuo stesso account.</p>
    <div class="grid3">
      <article class="card"><h3>WhatsApp</h3><p id="nia-wa">Caricamento…</p><a class="btn sm" href="#/account">Gestisci collegamento</a></article>
      <article class="card"><h3>Memoria</h3><div id="nia-mem">…</div></article>
      <article class="card"><h3>Attività</h3><div id="nia-tasks">…</div></article>
    </div>
    <article class="card" style="margin-top:16px" id="nia-help"></article>
  </div>${footer()}${niaWidget()}`;
}

function niaAnswer(q) {
  const t = (q||"").toLowerCase();
  if (!t) return "";
  if (/credit/i.test(t)) return "Ogni generazione scala crediti dal tuo saldo. Prima si usano quelli del piano (scadono al rinnovo), poi promo e ricariche (le ricariche non scadono). I prezzi e i costi dei crediti sono nella pagina Prezzi.";
  if (/pubblic|publish|deploy/i.test(t)) return "L'anteprima è solo tua, nel workspace. Pubblica (dal piano Standard) crea un indirizzo /p/… visibile a tutti. Ripubblicare aggiorna lo stesso indirizzo senza un nuovo addebito di fascia.";
  if (/piano|prezz|plan/i.test(t)) return "Free per esplorare, Standard per pubblicare, Pro per modalità Intensiva e agenti custom, Business ed Enterprise su preventivo. Apri la pagina Prezzi per i pacchetti.";
  if (/demo|chiave|api/i.test(t)) return "Senza chiave LLM sei in modalità demo: l'interfaccia è completa ma le app sono di esempio. Imposta XAI_API_KEY, OPENAI_API_KEY o ANTHROPIC_API_KEY sul server.";
  return "Non ho una scheda precisa su questo, ma nel workspace puoi descrivere il cambiamento e l'agente (o la demo) aggiorna l'app. Per i pagamenti reali serve Stripe.";
}

function renderWorkspace(app) {
  const id = state.route.split("/")[2];
  if (id && id !== state.currentId) {
    state.currentId = id;
    loadProject(id);
  }
  const p = current() || { title: "Nuovo lavoro", messages: [], html: "" };
  const u = state.user || {};
  app.innerHTML = `<div class="ws-shell">
    <div class="ws-bar">
      <a class="wordmark" href="#/"><img src="/img/logo.svg" alt="" width="22" height="22"/><span>Io<b>X</b>te</span></a>
      <span class="title" contenteditable="true" id="proj-title">${escape(p.title||"Senza titolo")}</span>
      <span class="grow"></span>
      <span class="chip">${escape(u.plan||"free")} · <strong>${u.credits??0}</strong></span>
      ${state.health?.mode==="demo"?`<span class="chip">demo</span>`:""}
      <button class="btn sm ghost" id="btn-dl">Scarica</button>
      <button class="btn sm ghost" id="btn-gh">GitHub</button>
      <button class="btn sm gold" id="btn-pub">${p.published?.slug ? "Ripubblica" : "Pubblica"}</button>
      <a class="btn sm ghost" href="#/account">${escape((u.name||"Lorenzo").split(" ")[0])}</a>
    </div>
    <div class="ws-main">
      <aside class="side">
        <h4>Progetti</h4>
        <div style="padding:0 10px 8px"><button class="btn sm ghost" id="new-proj" style="width:100%">+ Nuovo</button></div>
        <div class="plist">
          ${state.projects.map((x) => `<a href="#/workspace/${x.id}" class="${x.id===p.id?"on":""}">${escape(x.title||"Senza titolo")}<small>${new Date(x.updatedAt||x.createdAt||Date.now()).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})}</small></a>`).join("") || "<p style='padding:10px;color:var(--muted);font-size:13px'>Nessun progetto ancora.</p>"}
        </div>
      </aside>
      <section class="chat">
        <div class="thread" id="thread">${renderThread(p)}</div>
        <div class="composer-mini">
          ${state.visualQueue.length?`<div class="edit-badge">${state.visualQueue.length} modifiche visive in coda</div>`:""}
          <textarea id="chat-in" placeholder="Chiedi una modifica, es. rendi il pulsante rosso…" ${state.generating?"disabled":""}></textarea>
          <div class="row">
            <div class="left" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div class="seg">
                <button type="button" data-plan="0" class="${!state.planMode?"on":""}">Costruisci</button>
                <button type="button" data-plan="1" class="${state.planMode?"on":""}">Pianifica</button>
              </div>
              <label class="chip"><input type="checkbox" id="maxx" ${state.maxx?"checked":""}/> Intensiva</label>
            </div>
            <button class="btn primary sm" id="chat-send" ${state.generating?"disabled":""}>${state.generating?"In corso…":"Invia"}</button>
          </div>
        </div>
      </section>
      <section class="stage">
        <div class="tabs">
          ${[["preview","Anteprima"],["code","Codice"],["files","File"],["terminal","Terminale"],["db","Database"],["logs","Log"],["secrets","Segreti"],["tests","Test"],["integrations","Integrazioni"],["analytics","Analytics"]].map(([id,l]) => `<button data-tab="${id}" class="${state.tab===id?"on":""}">${l}</button>`).join("")}
        </div>
        ${stageTools(p)}
        ${stageBody(p)}
      </section>
    </div>
  </div>
  ${niaWidget()}
  ${publishModal(p)}`;
}

function renderThread(p) {
  const msgs = p.messages || [];
  if (!msgs.length && !state.generating) {
    return `<div class="msg agent"><div class="who">Agente IoXte</div>Ciao ${escape((state.user?.name||"Lorenzo").split(" ")[0])}. Dimmi cosa dobbiamo costruire o quale dettaglio cambiare. Posso anche preparare prima un piano.</div>`;
  }
  return msgs.map((m, i) => {
    if (m.role === "user") return `<div class="msg user"><div class="who">Tu</div>${escape(m.content)}</div>`;
    if (m.kind === "error") return `<div class="msg agent error"><div class="who">Errore</div>${escape(m.content)}</div>`;
    if (m.kind === "plan") return planCardHtml(m.plan, i);
    const steps = (m.steps || []).map((s) => `<div class="step-row done"><span class="dot"></span><div><b>${escape(s.label)}</b><div>${escape(s.detail||"")}</div></div></div>`).join("");
    const rb = m.checkpointId ? `<div style="margin-top:8px"><button class="btn sm ghost" data-rb="${m.checkpointId}">Ripristina questo punto</button></div>` : "";
    return `<div class="msg agent"><div class="who">Agente IoXte</div>${escape(m.content||"Ho aggiornato l'app.")}${steps?`<div class="steps">${steps}</div>`:""}${m.tests?`<div style="margin-top:8px;font-size:12px;color:var(--muted)">Test ${m.tests.passed}/${m.tests.total}</div>`:""}${rb}</div>`;
  }).join("") + (state.generating ? `<div class="msg agent"><div class="who">Agente IoXte</div>${renderLiveSteps()}${state.streamText?`<pre style="white-space:pre-wrap;font-size:12px;max-height:160px;overflow:auto">${escape(state.streamText.slice(-1200))}</pre>`:""}</div>` : "");
}

function renderLiveSteps() {
  return `<div class="steps">${(state.steps||[]).map((s,i,a)=>`<div class="step-row ${i===a.length-1?"on":"done"}"><span class="dot"></span><div><b>${escape(s.label)}</b><div>${escape(s.detail||"")}</div></div></div>`).join("")}</div>`;
}

function planCardHtml(plan, i) {
  if (!plan) return "";
  return `<div class="msg agent"><div class="who">Piano proposto</div>
    <div class="plan-card">
      <strong>${escape(plan.title||"Piano")}</strong>
      <p>${escape(plan.summary||"")}</p>
      <div>Schermate</div><ul>${(plan.screens||[]).map(s=>`<li>${escape(s)}</li>`).join("")}</ul>
      <div>Funzioni</div><ul>${(plan.features||[]).map(s=>`<li>${escape(s)}</li>`).join("")}</ul>
      ${(plan.questions||[]).length?`<div>Domande</div><ul>${plan.questions.map(s=>`<li>${escape(s)}</li>`).join("")}</ul>`:""}
      <button class="btn sm primary" data-approve="${i}">Va bene, costruiamo</button>
      <button class="btn sm ghost" data-replan="${i}">Richiedi modifiche</button>
    </div>
  </div>`;
}

function stageTools(p) {
  if (state.tab === "preview") {
    return `<div class="stage-tools">
      <div class="seg">
        <button data-vp="desktop" class="${state.viewport==="desktop"?"on":""}">Desktop</button>
        <button data-vp="mobile" class="${state.viewport==="mobile"?"on":""}">Mobile</button>
      </div>
      <button class="btn sm ghost" id="vis-edit">${state.visualEdit?"Esci dalle modifiche visive":"Modifica visiva"}</button>
      ${p.html?`<a class="btn sm ghost" id="open-prev" href="#" >Apri in nuova scheda</a>`:""}
      ${state.visualEdit?`<span class="edit-badge">Clicca un elemento nell'anteprima</span>`:""}
    </div>`;
  }
  if (state.tab === "code") {
    return `<div class="stage-tools">
      <button class="btn sm ghost" id="copy-code">Copia</button>
      <button class="btn sm" id="apply-code">Applica modifiche</button>
    </div>`;
  }
  return `<div class="stage-tools"></div>`;
}

function stageBody(p) {
  if (state.tab === "preview") {
    if (!p.html) return `<div class="preview-frame"><div class="empty-preview"><h3 class="serif">L'anteprima apparirà qui</h3><p>Invia un'idea nella chat. L'agente costruisce e l'app si apre in questa cornice, isolata dal resto della pagina.</p></div></div>`;
    return `<div class="preview-frame ${state.viewport}"><iframe id="prev" sandbox="allow-scripts allow-forms allow-modals allow-popups" title="Anteprima"></iframe></div>`;
  }
  if (state.tab === "code") {
    return `<div class="codewrap"><textarea id="code-ed">${escape(p.html||"")}</textarea></div>`;
  }
  if (state.tab === "files") {
    return `<div class="tree"><b>app/</b>\n  <b>index.html</b>  — documento unico dell'app\n  README.md\n  .env.example  — i segreti restano nel gestore, non nel codice</div>`;
  }
  if (state.tab === "terminal") {
    const logs = (p.logs||[]).map(l => `[${l.at||""}] ${l.msg}`).join("\n") || "Pronto.\nIn attesa di un job.";
    return `<div class="prewrap"><pre>${escape(logs)}</pre></div>`;
  }
  if (state.tab === "logs") {
    return `<div class="prewrap"><pre>${escape((p.logs||[]).map(l=>JSON.stringify(l)).join("\n")||"Nessun evento.")}</pre></div>`;
  }
  if (state.tab === "db") {
    return `<div class="codewrap"><textarea id="db-ed">${escape(JSON.stringify(p.db||{collections:{items:[]}},null,2))}</textarea></div>`;
  }
  if (state.tab === "secrets") {
    return `<div style="padding:16px">
      <p style="color:var(--muted)">I valori non finiscono nel codice né su GitHub. Anteprima e produzione restano separate.</p>
      <label class="field">Nome <input id="sec-k" placeholder="STRIPE_SECRET_KEY"/></label>
      <label class="field">Valore <input id="sec-v" type="password"/></label>
      <label class="field">Ambito <select id="sec-s"><option>preview</option><option>production</option></select></label>
      <button class="btn sm primary" id="save-sec">Salva segreto</button>
    </div>`;
  }
  if (state.tab === "tests") {
    const t = (p.messages||[]).slice().reverse().find(m=>m.tests)?.tests;
    return `<div style="padding:16px">${t?`<p>Ultimo run: ${t.passed}/${t.total}</p><ul>${t.checks.map(c=>`<li>${c.pass?"✓":"✗"} ${escape(c.name)}</li>`).join("")}</ul>`:"Nessun test ancora. Si avviano a fine generazione."}</div>`;
  }
  if (state.tab === "integrations") {
    const items = ["Stripe","PayPal","Shopify","Razorpay","Paystack","SendGrid","Twilio","Resend","Google Maps","IoXte Auth","Universal LLM Key"];
    return `<div style="padding:16px" class="grid3">${items.map(n=>`<article class="card"><h3>${n}</h3><p>Collega chiedendo all'agente e salvando le chiavi in Segreti. In attesa delle tue credenziali per l'attivazione reale.</p></article>`).join("")}</div>`;
  }
  if (state.tab === "analytics") {
    return `<div style="padding:16px"><h3>Visite pubblicazione</h3><p>${p.published?.visits||0} visualizzazioni su ${p.published?.slug?("/p/"+p.published.slug):"(non ancora pubblicata)"}.</p></div>`;
  }
  return "";
}

function publishModal(p) {
  return `<div class="modal-bg hide" id="pub-modal"><div class="modal">
    <h3>Gestisci pubblicazione</h3>
    <p>L'anteprima resta privata. La pubblicazione crea un indirizzo pubblico su questo server. Dal piano Standard in su.</p>
    <label class="field">Fascia
      <select id="pub-tier">${(state.config?.plans?.publishingTiers||[]).map(t=>`<option value="${t.id}">${t.name} · ${t.creditsPerMonth} crediti/mese</option>`).join("")}</select>
    </label>
    <label class="field"><input type="checkbox" id="pub-seo"/> Abilita SEO</label>
    <label class="field">Dominio custom (in attesa di DNS/TLS)
      <input id="pub-dom" placeholder="app.tua-azienda.it"/>
    </label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn primary" id="do-pub">${p.published?.slug?"Ripubblica":"Pubblica"}</button>
      ${p.published?.slug?`<button class="btn warn" id="do-off">Spegni</button>`:""}
      <button class="btn ghost" id="close-pub">Chiudi</button>
    </div>
    ${p.published?.slug?`<p style="margin-top:12px">Indirizzo attuale: <a href="/p/${p.published.slug}" target="_blank">/p/${escape(p.published.slug)}</a></p>`:""}
  </div></div>`;
}

function bind() {
  $$("[data-auth]").forEach((b) => b.onclick = () => { state.authMode = b.dataset.auth; render(); });
  $$("[data-job]").forEach((b) => b.onclick = () => { state.jobType = b.dataset.job; render(); });
  $$("[data-plan]").forEach((b) => b.onclick = () => { state.planMode = b.dataset.plan === "1"; render(); });
  $$("[data-ex]").forEach((b) => b.onclick = () => { const t = EXAMPLES[+b.dataset.ex].text; const el=$("#idea"); if(el) el.value=t; state.draft=t; });
  $$("[data-ann]").forEach((b) => b.onclick = () => { state.annual = b.dataset.ann === "1"; render(); });
  $$("[data-buy]").forEach((b) => b.onclick = () => checkoutPlan(b.dataset.buy));
  $$("[data-top]").forEach((b) => b.onclick = () => checkoutTopup(b.dataset.top));
  $$("[data-sales]").forEach((b) => b.onclick = () => contactSales(b.dataset.sales));
  $$("[data-tab]").forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  $$("[data-vp]").forEach((b) => b.onclick = () => { state.viewport = b.dataset.vp; render(); });
  $$("[data-approve]").forEach((b) => b.onclick = () => { state.planMode = false; const p=current(); const plan=p?.messages?.[+b.dataset.approve]?.plan; startGenerate(plan ? `Costruisci l'app seguendo questo piano approvato: ${plan.title}. ${plan.summary}` : (p?.messages||[]).filter(m=>m.role==="user").at(-1)?.content, { fromPlan:true }); });
  $$("[data-replan]").forEach((b) => { b.onclick = () => { state.planMode = true; $("#chat-in")?.focus(); }; });
  $$("[data-rb]").forEach((b) => b.onclick = () => restoreCheckpoint(b.dataset.rb));
  $("#go")?.addEventListener("click", () => startFromLanding());
  $("#idea")?.addEventListener("input", (e) => state.draft = e.target.value);
  $("#maxx")?.addEventListener("change", (e) => state.maxx = e.target.checked);
  $("#agent")?.addEventListener("change", (e) => state.agentTier = e.target.value);
  $("#budget")?.addEventListener("input", (e) => state.budget = e.target.value);
  $("#attach")?.addEventListener("change", onAttach);
  $("#chat-send")?.addEventListener("click", () => startGenerate($("#chat-in")?.value));
  $("#chat-in")?.addEventListener("keydown", (e) => { if (e.key==="Enter" && (e.metaKey||e.ctrlKey)) startGenerate(e.target.value); });
  $("#new-proj")?.addEventListener("click", () => newProject(true));
  $("#btn-dl")?.addEventListener("click", downloadHtml);
  $("#btn-gh")?.addEventListener("click", saveGithub);
  $("#btn-pub")?.addEventListener("click", () => $("#pub-modal")?.classList.remove("hide"));
  $("#close-pub")?.addEventListener("click", () => $("#pub-modal")?.classList.add("hide"));
  $("#do-pub")?.addEventListener("click", doPublish);
  $("#do-off")?.addEventListener("click", shutdownPub);
  $("#copy-code")?.addEventListener("click", () => { navigator.clipboard.writeText(current()?.html||""); toast("Codice copiato."); });
  $("#apply-code")?.addEventListener("click", () => { const p=current(); if(!p) return; p.html=$("#code-ed").value; persist(p); state.tab="preview"; render(); });
  $("#save-sec")?.addEventListener("click", saveSecret);
  $("#vis-edit")?.addEventListener("click", () => { state.visualEdit = !state.visualEdit; render(); });
  $("#open-prev")?.addEventListener("click", (e) => { e.preventDefault(); openPreviewTab(); });
  $("#toggleNia")?.addEventListener("click", () => { state.nia = !state.nia; render(); });
  $("#nia-q")?.addEventListener("change", (e) => { state.niaInput = e.target.value; render(); });
  $("#doLogin")?.addEventListener("click", doLogin);
  $("#saveProfile")?.addEventListener("click", async () => {
    const data = await api("/api/me/profile", { method:"POST", body:{ name:$("#acc-name").value } });
    state.user=data.user; saveLocal(); toast("Profilo aggiornato."); render();
  });
  $("#saveSys")?.addEventListener("click", async () => {
    try { await api("/api/me/system-prompt", { method:"POST", body:{ systemPrompt:$("#sys").value } }); toast("Prompt salvato."); }
    catch(e){ toast(e.message); }
  });
  $("#cancelPlan")?.addEventListener("click", async () => { try { const r=await api("/api/cancel-plan",{method:"POST",body:{}}); toast(r.message); } catch(e){ toast(e.message);} });
  $("#delAcc")?.addEventListener("click", async () => {
    if (!confirm("Eliminare account e progetti? L'azione è definitiva.")) return;
    await api("/api/me", { method:"DELETE" }); state.token=""; state.user=null; state.projects=[]; saveLocal(); navTo("#/");
  });
  $("#proj-title")?.addEventListener("blur", () => { const p=current(); if(!p) return; p.title=$("#proj-title").textContent.trim()||p.title; persist(p); });
  const iframe = $("#prev");
  if (iframe && current()?.html) setupIframe(iframe, current().html);
  const thread = $("#thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
  if (state.route.startsWith("#/account")) { loadUsage(); loadWhatsApp(); }
  if (state.route.startsWith("#/nia")) loadNiaPage();
  $("#wa-link")?.addEventListener("click", pairWhatsApp);
  $("#wa-unlink")?.addEventListener("click", async () => {
    try { const r = await api("/api/whatsapp/link", { method:"DELETE" }); toast(r.message); loadWhatsApp(); }
    catch(e){ toast(e.message); }
  });

}

async function loadUsage() {
  try {
    const me = await api("/api/me");
    state.user = me.user;
    const tb = $("#usage-body");
    if (!tb) return;
    const rows = me.usage || [];
    tb.innerHTML = rows.slice().reverse().slice(0, 30).map((u) => `<tr><td>${new Date(u.at).toLocaleString("it-IT")}</td><td>${escape(u.reason||"")}</td><td>−${u.amount}</td><td>${u.left}</td></tr>`).join("") || `<tr><td colspan="4">Nessun movimento ancora.</td></tr>`;
  } catch {}
}

function setupIframe(iframe, html) {
  let doc = html;
  if (state.visualEdit) {
    const hook = `<script>
      document.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const el = e.target;
        el.style.outline = "2px solid #e8c36a";
        const label = (el.innerText||el.tagName).slice(0,80);
        parent.postMessage({ type:"ioxte-edit", tag: el.tagName, text: label }, "*");
      }, true);
    <\/script>`;
    doc = html.replace("</body>", hook + "</body>");
    if (!doc.includes("ioxte-edit")) doc += hook;
  }
  iframe.srcdoc = doc;
}

window.addEventListener("message", (e) => {
  if (e.data?.type !== "ioxte-edit") return;
  const change = prompt(`Cosa vuoi cambiare in «${e.data.text}»?`, "rendi questo elemento più evidente");
  if (!change) return;
  state.visualQueue.push({ target: e.data.text, change });
  toast("Modifica in coda. Invia un messaggio o premi Invia per applicarle.");
  render();
});

async function startFromLanding() {
  const prompt = $("#idea")?.value.trim();
  if (!prompt) return toast("Descrivi prima l'idea.");
  if (!requireUser()) return;
  const p = await newProject(false, prompt.slice(0, 48));
  state.currentId = p.id;
  navTo(`#/workspace/${p.id}`);
  setTimeout(() => startGenerate(prompt), 0);
}

async function newProject(navigate, title) {
  if (!requireUser()) return null;
  const created = await api("/api/projects", { method:"POST", body:{ title: title || "Nuovo lavoro", jobType: state.jobType, agentTier: state.agentTier } });
  const p = { ...created.project, messages: [], html: "", logs: [] };
  state.projects.unshift(p);
  saveLocal();
  if (navigate) navTo(`#/workspace/${p.id}`);
  return p;
}

async function loadProject(id) {
  let p = state.projects.find((x) => x.id === id);
  try {
    const data = await api(`/api/projects/${id}`);
    if (data.project) {
      p = { ...(p||{}), ...data.project };
      const i = state.projects.findIndex((x) => x.id === id);
      if (i>=0) state.projects[i]=p; else state.projects.unshift(p);
    }
  } catch {}
  render();
}

async function startGenerate(prompt, extra = {}) {
  prompt = (prompt || "").trim();
  if (state.visualQueue.length) {
    prompt = (prompt ? prompt + "\n\n" : "") + "Applica queste modifiche visive:\n" + state.visualQueue.map((q) => `- Su «${q.target}»: ${q.change}`).join("\n");
    state.visualQueue = [];
  }
  if (!prompt) return;
  if (!requireUser()) return;
  let p = current();
  if (!p) p = await newProject(false, prompt.slice(0, 48));
  state.currentId = p.id;
  p.messages = p.messages || [];
  p.messages.push({ role: "user", content: prompt, at: Date.now() });
  p.logs = p.logs || [];
  p.logs.push({ at: new Date().toISOString(), msg: "Job avviato: " + prompt.slice(0,80) });
  state.generating = true;
  state.steps = [];
  state.streamText = "";
  persist(p);
  render();
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({
        prompt,
        history: p.messages.slice(-12).map(({role,content}) => ({role, content})),
        currentHtml: extra.fromPlan ? "" : (p.html || ""),
        jobType: p.jobType || state.jobType,
        planMode: state.planMode && !extra.fromPlan,
        maxx: state.maxx,
        agentTier: state.agentTier,
        budget: state.budget ? Number(state.budget) : undefined,
        attachments: state.attachments,
        systemPrompt: state.user?.systemPrompt,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error || "Generazione non riuscita");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let result = {};
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.type === "status") { state.steps.push(ev); render(); }
        if (ev.type === "delta") { state.streamText += ev.text; }
        if (ev.type === "code") { p.html = ev.html; }
        if (ev.type === "tests") { result.tests = ev.tests; }
        if (ev.type === "plan") { result.plan = ev.plan; }
        if (ev.type === "done") { result.done = ev; if (ev.creditsLeft!=null && state.user) state.user.credits = ev.creditsLeft; }
        if (ev.type === "error") throw new Error(ev.message);
      }
    }
    if (result.plan) {
      p.messages.push({ role:"assistant", kind:"plan", plan: result.plan, content: "Ti propongo questo piano prima di scrivere codice." });
    } else {
      const title = result.done?.titleGuess;
      if (title && (!p.title || p.title==="Nuovo lavoro")) p.title = title;
      const cp = Date.now().toString(36);
      p.checkpoints = p.checkpoints || [];
      p.checkpoints.unshift({ id: cp, at: new Date().toISOString(), label: "Dopo generazione" });
      p.messages.push({
        role:"assistant",
        content: result.done?.demo
          ? "Ho preparato un'app di esempio (modalità demo). Provala a destra e dimmi cosa cambiare."
          : "Ho aggiornato l'app. Provala nell'anteprima e dimmi cosa sistemare.",
        steps: state.steps,
        tests: result.tests,
        checkpointId: cp,
      });
      // store checkpoint html via API
      persist(p);
      try { await api("/api/checkpoints", { method:"POST", body:{ projectId:p.id, label:"Dopo generazione" } }); } catch {}
    }
    state.attachments = [];
    p.updatedAt = new Date().toISOString();
    persist(p);
    if (state.user && result.done?.creditsLeft!=null) state.user.credits = result.done.creditsLeft;
  } catch (err) {
    p.messages.push({ role:"assistant", kind:"error", content: "Non sono riuscito a completare il lavoro.\n\n" + err.message });
    toast(err.message);
    persist(p);
  } finally {
    state.generating = false;
    state.steps = [];
    state.streamText = "";
    render();
  }
}

function persist(p) {
  const i = state.projects.findIndex((x) => x.id === p.id);
  if (i>=0) state.projects[i]=p;
  saveLocal();
  api(`/api/projects/${p.id}`, { method:"PUT", body:{ title:p.title, html:p.html, messages:p.messages, logs:p.logs, db:p.db, jobType:p.jobType, checkpoints:p.checkpoints } }).catch(()=>{});
}

function downloadHtml() {
  const p = current();
  if (!p?.html) return toast("Non c'è ancora codice da scaricare.");
  const blob = new Blob([p.html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(p.title||"app").replace(/\s+/g,"-")}.html`;
  a.click();
}

function openPreviewTab() {
  const p = current();
  if (!p?.html) return;
  const w = window.open("", "_blank");
  w.document.write(p.html);
  w.document.close();
}

async function saveGithub() {
  const p = current();
  if (!p) return;
  try {
    persist(p);
    const r = await api("/api/github/save", { method:"POST", body:{ projectId:p.id } });
    toast("Salvato su GitHub: " + r.url);
  } catch (e) { toast(e.message); }
}

async function doPublish() {
  const p = current();
  if (!p) return;
  persist(p);
  const republish = Boolean(p.published?.slug);
  try {
    const r = await api(republish ? "/api/publish/republish" : "/api/publish", {
      method:"POST",
      body:{ projectId:p.id, tier: $("#pub-tier")?.value, seo: $("#pub-seo")?.checked, customDomain: $("#pub-dom")?.value },
    });
    p.published = r.published;
    if (state.user && r.creditsLeft!=null) state.user.credits = r.creditsLeft;
    persist(p);
    toast("Pubblicata: " + r.url);
    $("#pub-modal")?.classList.add("hide");
    render();
  } catch (e) { toast(e.message); }
}

async function shutdownPub() {
  const p = current();
  try {
    await api("/api/publish/shutdown", { method:"POST", body:{ projectId:p.id } });
    if (p.published) p.published.live = false;
    persist(p);
    toast("Pubblicazione spenta.");
    render();
  } catch(e){ toast(e.message); }
}

async function saveSecret() {
  const p = current();
  try {
    await api(`/api/projects/${p.id}/secrets`, { method:"POST", body:{ key:$("#sec-k").value, value:$("#sec-v").value, scope:$("#sec-s").value } });
    toast("Segreto salvato.");
  } catch(e){ toast(e.message); }
}

async function restoreCheckpoint(id) {
  const p = current();
  try {
    const r = await api("/api/checkpoints/restore", { method:"POST", body:{ projectId:p.id, versionId:id } });
    if (r.html) { p.html = r.html; persist(p); toast("Checkpoint ripristinato."); render(); }
  } catch(e){ toast(e.message); }
}

async function onAttach(e) {
  const files = [...(e.target.files||[])];
  state.attachments = [];
  for (const f of files) {
    const text = f.type.startsWith("text") || /json|csv|md/.test(f.name) ? await f.text() : `[file ${f.name} · ${f.type} · ${f.size} byte]`;
    state.attachments.push({ name:f.name, type:f.type, text: text.slice(0,8000) });
  }
  toast(`${files.length} allegato/i pronto/i.`);
}

async function checkoutPlan(planId) {
  try {
    if (!requireUser()) return;
    const r = await api("/api/checkout", { method:"POST", body:{ kind:"plan", planId, interval: state.annual?"annual":"monthly" } });
    if (r.url) { location.href = r.url; return; }
    if (r.user) state.user = r.user;
    toast(r.message || "Piano aggiornato.");
    render();
  } catch(e){ toast(e.message); }
}

async function checkoutTopup(id) {
  try {
    if (!requireUser()) return;
    const r = await api("/api/checkout/topup", { method:"POST", body:{ topupId:id } });
    if (r.url) { location.href = r.url; return; }
    if (r.user) state.user = r.user;
    toast(r.message || "Crediti aggiunti.");
    render();
  } catch(e){ toast(e.message); }
}

async function contactSales(plan) {
  const message = prompt("Scrivi due righe sulla tua organizzazione:") || "";
  try {
    await api("/api/contact-sales", { method:"POST", body:{ name:state.user?.name, email:state.user?.email, plan, message } });
    toast("Richiesta salvata.");
  } catch(e){ toast(e.message); }
}

async function doLogin() {
  try {
    const signup = state.authMode === "signup";
    const body = { email: $("#log-email")?.value, password: $("#log-pass")?.value };
    if (signup) body.name = $("#log-name")?.value;
    const data = await api(signup ? "/api/auth/signup" : "/api/auth/login", { method:"POST", body });
    state.token=data.token; state.user=data.user; saveLocal();
    toast(signup ? "Account creato. Benvenuto." : "Accesso effettuato.");
    navTo("#/");
  } catch (e) {
    toast(e.message);
  }
}

function escape(s) {
  return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

boot();


async function loadWhatsApp() {
  const box = document.getElementById("wa-box");
  if (!box) return;
  try {
    const s = await api("/api/whatsapp/status");
    box.innerHTML = `<p>${s.linked ? "Numero collegato: <strong>"+s.phone+"</strong> dal "+new Date(s.linkedAt).toLocaleString("it-IT") : "Nessun numero collegato."}</p>
      <p style="margin-top:8px;color:var(--muted)">${s.message}</p>
      <div id="wa-code" style="margin:8px 0;font-family:var(--serif);font-size:1.6rem;letter-spacing:.12em"></div>
      <button class="btn sm primary" id="wa-link">${s.linked?"Genera un nuovo codice":"Collega WhatsApp"}</button>
      ${s.linked?`<button class="btn sm warn" id="wa-unlink">Scollega</button>`:""}`;
    document.getElementById("wa-link")?.addEventListener("click", pairWhatsApp);
    document.getElementById("wa-unlink")?.addEventListener("click", async () => {
      try { const r = await api("/api/whatsapp/link", { method:"DELETE" }); toast(r.message); loadWhatsApp(); }
      catch(e){ toast(e.message); }
    });
  } catch (e) {
    box.innerHTML = `<p>${escape(e.message)}</p>`;
  }
}

async function pairWhatsApp() {
  try {
    const r = await api("/api/whatsapp/link", { method:"POST", body:{} });
    const el = document.getElementById("wa-code");
    if (el) el.textContent = r.code;
    toast(r.message + (r.hint ? " " + r.hint : ""));
  } catch (e) { toast(e.message); }
}

async function loadNiaPage() {
  try {
    const d = await api("/api/nia");
    const wa = document.getElementById("nia-wa");
    if (wa) wa.innerHTML = d.whatsapp.linked ? "Collegata al numero "+d.whatsapp.phone : "Non ancora collegata. Vai su Account per ottenere il codice.";
    const mem = document.getElementById("nia-mem");
    if (mem) mem.innerHTML = (d.memory?.facts||[]).length ? "<ul>"+d.memory.facts.map(f=>"<li>"+escape(f.text)+"</li>").join("")+"</ul>" : "<p>Nessun ricordo ancora. Su WhatsApp scrivi «ricorda che…».</p>";
    const tk = document.getElementById("nia-tasks");
    if (tk) tk.innerHTML = (d.tasks||[]).length ? "<ul>"+d.tasks.map(t=>"<li>"+(t.paused?"Pausa · ":"")+escape(t.label)+" — "+escape(t.description)+"</li>").join("")+"</ul>" : "<p>Nessuna attività. Su WhatsApp: «ricordami ogni giorno alle 9: …».</p>";
    const h = document.getElementById("nia-help");
    if (h) h.innerHTML = "<pre style='white-space:pre-wrap;font:inherit'>"+escape(d.help||"")+"</pre>";
  } catch (e) { toast(e.message); }
}
