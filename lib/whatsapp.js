/**
 * Nia su WhatsApp — equivalente IoXte di Emergent Wingman.
 * Canale: WhatsApp Cloud API (Meta). Senza chiavi, resta usabile via /api/whatsapp/simulate.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export function verifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY || "ioxte-verify";
}

export function createNia(ctx) {
  const { store, ROOT } = ctx;
  const files = {
    links: path.join(store.dir, "whatsapp-links.json"),
    pairing: path.join(store.dir, "nia-pairing.json"),
    memory: path.join(store.dir, "nia-memory.json"),
    messages: path.join(store.dir, "nia-messages.json"),
    tasks: path.join(store.dir, "nia-tasks.json"),
    approvals: path.join(store.dir, "nia-approvals.json"),
    allow: path.join(store.dir, "nia-allow.json"),
    focus: path.join(store.dir, "nia-focus.json"),
  };

  const read = (f, fb) => store.read(f, fb);
  const write = (f, d) => store.write(f, d);

  function links() { return read(files.links, []); }
  function saveLinks(rows) { write(files.links, rows); }

  function normalizePhone(p) {
    return String(p || "").replace(/\D/g, "").replace(/^00/, "");
  }

  function linkForPhone(phone) {
    const n = normalizePhone(phone);
    return links().find((l) => l.phone === n && !l.disconnectedAt);
  }

  function userById(id) {
    return store.allUsers().find((u) => u.id === id);
  }

  function memoryOf(userId) {
    const all = read(files.memory, {});
    return all[userId] || { facts: [], updatedAt: null };
  }

  function saveMemory(userId, mem) {
    const all = read(files.memory, {});
    all[userId] = mem;
    write(files.memory, all);
  }

  function logMsg(row) {
    const all = read(files.messages, []);
    all.push({ ...row, at: new Date().toISOString() });
    write(files.messages, all.slice(-2000));
  }

  function focusOf(userId) {
    return read(files.focus, {})[userId] || null;
  }
  function setFocus(userId, projectId) {
    const all = read(files.focus, {});
    all[userId] = projectId;
    write(files.focus, all);
  }

  function createPairing(userId) {
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const rows = read(files.pairing, []);
    const rec = { code, userId, expiresAt: Date.now() + 15 * 60 * 1000 };
    write(files.pairing, rows.filter((r) => r.userId !== userId && r.expiresAt > Date.now()).concat(rec));
    return rec;
  }

  function consumePairing(text) {
    const code = String(text || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 5 || code.length > 8) return null;
    const rows = read(files.pairing, []);
    const hit = rows.find((r) => r.code === code && r.expiresAt > Date.now());
    if (!hit) return null;
    write(files.pairing, rows.filter((r) => r.code !== code));
    return hit;
  }

  async function sendText(to, body, extras = {}) {
    const phone = normalizePhone(to);
    logMsg({ dir: "out", phone, body, extras });
    if (!whatsappConfigured()) {
      return { demo: true, to: phone, body };
    }
    const payload = extras.interactive
      ? {
          messaging_product: "whatsapp",
          to: phone,
          type: "interactive",
          interactive: extras.interactive,
        }
      : {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: String(body).slice(0, 4096), preview_url: Boolean(extras.preview) },
        };
    const url = `${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("WhatsApp send failed", res.status, data);
      return { error: data, status: res.status };
    }
    return data;
  }

  function approvalButtons(id, question) {
    return {
      type: "button",
      body: { text: question.slice(0, 1024) },
      action: {
        buttons: [
          { type: "reply", reply: { id: `ok:${id}`, title: "Approva" } },
          { type: "reply", reply: { id: `no:${id}`, title: "Annulla" } },
          { type: "reply", reply: { id: `al:${id}`, title: "Sempre" } },
        ],
      },
    };
  }

  function isAlwaysAllowed(userId, action) {
    const allow = read(files.allow, {});
    return (allow[userId] || []).includes(action);
  }

  function alwaysAllow(userId, action) {
    const allow = read(files.allow, {});
    allow[userId] = Array.from(new Set([...(allow[userId] || []), action]));
    write(files.allow, allow);
  }

  function requestApproval(userId, phone, action, payload, question) {
    if (isAlwaysAllowed(userId, action)) return { auto: true };
    const id = crypto.randomBytes(4).toString("hex");
    const rows = read(files.approvals, []);
    rows.push({ id, userId, phone, action, payload, at: Date.now() });
    write(files.approvals, rows);
    return { id, question };
  }

  async function resolveApproval(userId, phone, raw) {
    const t = raw.toLowerCase().trim();
    const btn = raw.match(/^(ok|no|al):([a-f0-9]+)$/i);
    const rows = read(files.approvals, []).filter((a) => a.userId === userId);
    if (!rows.length && !btn) return null;
    const rec = btn
      ? read(files.approvals, []).find((a) => a.id === btn[2] && a.userId === userId)
      : rows.at(-1);
    if (!rec) return null;
    const decision = btn ? btn[1].toLowerCase() : (/^(s[iì]|ok|approva|yes|sempre)/i.test(t) ? ( /sempre|always/.test(t) ? "al" : "ok") : /^(no|annulla|deny)/i.test(t) ? "no" : null);
    if (!decision) return null;
    write(files.approvals, read(files.approvals, []).filter((a) => a.id !== rec.id));
    if (decision === "no") return { reply: "Ok, non faccio nulla." };
    if (decision === "al") alwaysAllow(userId, rec.action);
    return executeAction(userId, rec.action, rec.payload);
  }

  async function executeAction(userId, action, payload) {
    const user = userById(userId);
    if (action === "publish") {
      const r = await ctx.publishProject?.(user, payload.projectId, payload.tier || "starter");
      return { reply: r?.error ? r.error : `Pubblicata: ${r.url}` };
    }
    if (action === "shutdown") {
      const r = await ctx.shutdownProject?.(user, payload.projectId);
      return { reply: r?.error ? r.error : "Pubblicazione spenta. L'addebito della fascia si interrompe." };
    }
    if (action === "unlink") {
      disconnect(payload.phone);
      return { reply: "Canale WhatsApp scollegato. Nia resta attiva sul web: puoi ricollegarti quando vuoi." };
    }
    return { reply: "Azione sconosciuta." };
  }

  function disconnect(phone) {
    const n = normalizePhone(phone);
    saveLinks(links().map((l) => (l.phone === n && !l.disconnectedAt ? { ...l, disconnectedAt: new Date().toISOString() } : l)));
  }

  function attachLink(phone, userId) {
    const n = normalizePhone(phone);
    const rows = links().filter((l) => !(l.phone === n && !l.disconnectedAt));
    rows.push({ phone: n, userId, linkedAt: new Date().toISOString() });
    saveLinks(rows);
  }

  function helpText(user) {
    return [
      "Sono Nia, l'assistente IoXte su WhatsApp.",
      "Parla in italiano, come in una chat normale. Qualche scorciatoia utile:",
      "• saldo / piano — crediti e abbonamento",
      "• progetti — elenco dei tuoi lavori",
      "• apri [nome] — scegli il progetto attivo",
      "• costruisci [idea] — l'agente genera l'app (consuma crediti)",
      "• modifica [cosa cambiare] — itera il progetto attivo",
      "• pubblica — chiede conferma, poi mette online l'app",
      "• ricorda che… / cosa ricordi",
      "• ricordami ogni giorno alle 9: … — attività pianificate",
      "• attività / pausa / riprendi / cancella",
      "• scollega — stacca solo WhatsApp, Nia resta sul web",
      user ? `Sei collegato come ${user.name} (${user.plan}, ${ctx.creditBalance(user)} crediti).` : "",
    ].filter(Boolean).join("\n");
  }

  function parseSchedule(text) {
    const tz = "Europe/Rome";
    const everyDay = text.match(/ogni giorno alle\s+(\d{1,2})(?::(\d{2}))?/i);
    const weekly = text.match(/ogni\s+(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\s+alle\s+(\d{1,2})(?::(\d{2}))?/i);
    const once = text.match(/alle\s+(\d{1,2})(?::(\d{2}))?/i);
    const desc = text.replace(/^(ricordami|promemoria|crea un.attivit[aà]|ogni giorno[^,.]*,?\s*)/i, "").trim();
    if (everyDay) {
      return { kind: "cron", hour: +everyDay[1], minute: +(everyDay[2] || 0), tz, description: desc || "Promemoria giornaliero", label: `Tutti i giorni alle ${everyDay[1].padStart(2,"0")}:${(everyDay[2]||"00")}` };
    }
    if (weekly) {
      const map = { lunedi:1, lunedì:1, martedi:2, martedì:2, mercoledi:3, mercoledì:3, giovedi:4, giovedì:4, venerdi:5, venerdì:5, sabato:6, domenica:0 };
      const day = map[weekly[1].toLowerCase()] ?? 1;
      return { kind: "weekly", day, hour: +weekly[2], minute: +(weekly[3] || 0), tz, description: desc, label: `${weekly[1]} alle ${weekly[2]}:${weekly[3]||"00"}` };
    }
    if (/tra\s+(\d+)\s+min/i.test(text)) {
      const m = +text.match(/tra\s+(\d+)\s+min/i)[1];
      return { kind: "once", at: Date.now() + m * 60000, tz, description: desc, label: `Tra ${m} minuti` };
    }
    if (once) {
      const now = new Date();
      const at = new Date(now);
      at.setHours(+once[1], +(once[2] || 0), 0, 0);
      if (at <= now) at.setDate(at.getDate() + 1);
      return { kind: "once", at: at.getTime(), tz, description: desc, label: `Alle ${once[1]}:${once[2]||"00"}` };
    }
    return null;
  }

  function tasksOf(userId) {
    return read(files.tasks, []).filter((t) => t.userId === userId && !t.deleted);
  }

  function upsertTask(task) {
    const all = read(files.tasks, []);
    const i = all.findIndex((t) => t.id === task.id);
    if (i >= 0) all[i] = task;
    else all.push(task);
    write(files.tasks, all);
  }

  async function handleIncoming({ from, text, name, buttonId }) {
    const phone = normalizePhone(from);
    const body = String(buttonId || text || "").trim();
    logMsg({ dir: "in", phone, body, name });
    if (!body) return { reply: "Ho ricevuto un messaggio vuoto. Scrivi «aiuto» per il menu." };

    const pair = consumePairing(body);
    if (pair) {
      attachLink(phone, pair.userId);
      const user = userById(pair.userId);
      return { reply: `Fatto, ${user?.name || "ciao"}. Questo numero è collegato al tuo account IoXte. Scrivi «aiuto» per vedere cosa posso fare, oppure dimmi che app vuoi costruire.` };
    }

    const link = linkForPhone(phone);
    if (!link) {
      return {
        reply: "Ciao, sono Nia, l'assistente di IoXte su WhatsApp.\nQuesto numero non è ancora collegato a un account.\n\nApri IoXte → Account → «Collega WhatsApp», copia il codice e inviamelo qui. Il codice scade in 15 minuti.",
      };
    }

    const user = userById(link.userId);
    if (!user) {
      return { reply: "L'account collegato non esiste più. Genera un nuovo codice dalla pagina Account." };
    }
    ctx.maybeRefill?.(user);

    const approved = await resolveApproval(user.id, phone, body);
    if (approved) return approved;

    const t = body.toLowerCase();

    if (/^(aiuto|help|menu|ciao nia|\/start|\/help)$/i.test(t)) {
      return { reply: helpText(user) };
    }
    if (/^scollega|disconnect|unlink/i.test(t)) {
      const ap = requestApproval(user.id, phone, "unlink", { phone }, "Vuoi scollegare WhatsApp? Nia resterà disponibile sul web.");
      if (ap.auto) return executeAction(user.id, "unlink", { phone });
      return { reply: ap.question, interactive: approvalButtons(ap.id, ap.question) };
    }
    if (/^(saldo|crediti|piano|il mio piano)/i.test(t)) {
      return { reply: `Piano ${user.plan} (${user.interval}).\nCrediti: ${ctx.creditBalance(user)} (piano ${user.creditsSub || 0}, ricarica ${user.creditsTopup || 0}, promo ${user.creditsPromo || 0}).\nPer cambiare piano apri la pagina Prezzi su IoXte.` };
    }
    if (/^(progetti|lista|i miei lavori)/i.test(t)) {
      const projects = store.allProjects().filter((p) => p.userId === user.id);
      if (!projects.length) return { reply: "Non hai ancora progetti. Scrivi «costruisci …» e ne apro uno." };
      const focus = focusOf(user.id);
      const lines = projects.slice(0, 15).map((p, i) => `${i + 1}. ${p.title}${p.id === focus ? " ← attivo" : ""}${p.published?.slug ? " · pubblicato" : ""}`);
      return { reply: "I tuoi progetti:\n" + lines.join("\n") + "\n\nScrivi «apri 1» oppure «apri [nome]»." };
    }
    const apri = t.match(/^(apri|usa|seleziona)\s+(.+)/i);
    if (apri) {
      const projects = store.allProjects().filter((p) => p.userId === user.id);
      const q = apri[2].trim();
      const idx = parseInt(q, 10);
      const p = Number.isFinite(idx) ? projects[idx - 1] : projects.find((x) => (x.title || "").toLowerCase().includes(q.toLowerCase()));
      if (!p) return { reply: "Non trovo quel progetto." };
      setFocus(user.id, p.id);
      return { reply: `Progetto attivo: «${p.title}». Puoi dirmi «modifica …», «pubblica» o chiedere lo stato.` };
    }
    if (/^cosa ricordi|memoria|cosa sai di me/i.test(t)) {
      const mem = memoryOf(user.id);
      if (!mem.facts.length) return { reply: "Non ho ancora memorie salvate. Dimmi «ricorda che …»." };
      return { reply: "Ricordo:\n• " + mem.facts.map((f) => f.text).join("\n• ") };
    }
    const remember = body.match(/^(ricorda che|ricorda:|memorizza)\s+(.+)/i);
    if (remember) {
      const mem = memoryOf(user.id);
      mem.facts.push({ text: remember[2], at: new Date().toISOString() });
      mem.updatedAt = new Date().toISOString();
      saveMemory(user.id, mem);
      return { reply: `Ok, ho segnato: «${remember[2]}».` };
    }
    if (/^dimentica tutto|cancella memoria/i.test(t)) {
      saveMemory(user.id, { facts: [], updatedAt: new Date().toISOString() });
      return { reply: "Memoria cancellata." };
    }
    if (/^(attivit[aà]|task|promemoria)$/i.test(t)) {
      const tasks = tasksOf(user.id);
      if (!tasks.length) return { reply: "Nessuna attività. Prova: «ricordami ogni giorno alle 9: riassunto dei crediti»." };
      return { reply: tasks.map((x) => `${x.paused ? "⏸" : "▶"} ${x.label} — ${x.description}`).join("\n") };
    }
    const pause = t.match(/^(pausa|riprendi|cancella)\s+(.+)/i);
    if (pause) {
      const tasks = tasksOf(user.id);
      const q = pause[2];
      const task = tasks.find((x) => x.description.toLowerCase().includes(q) || x.label.toLowerCase().includes(q)) || tasks[0];
      if (!task) return { reply: "Nessuna attività da aggiornare." };
      if (pause[1] === "pausa") task.paused = true;
      if (pause[1] === "riprendi") task.paused = false;
      if (pause[1] === "cancella") task.deleted = true;
      upsertTask(task);
      return { reply: `Attività aggiornata (${pause[1]}).` };
    }
    if (/ricordami|ogni giorno|ogni luned|promemoria|crea un.attivit/i.test(t)) {
      const sch = parseSchedule(body);
      if (!sch) return { reply: "Dimmi orario e frequenza, ad esempio: «ricordami ogni giorno alle 9: riassunto dei crediti»." };
      const task = {
        id: crypto.randomBytes(4).toString("hex"),
        userId: user.id,
        phone,
        channel: "whatsapp",
        ...sch,
        paused: false,
        nextRun: nextRunAt(sch),
      };
      upsertTask(task);
      return { reply: `Attività creata: ${task.label}.\n«${task.description}»\nLa consegnerò su WhatsApp (fuso Europe/Rome). Se i crediti finiscono, la metto in pausa e la riprendo da sola dopo una ricarica.` };
    }

    const build = body.match(/^(costruisci|crea|genera|build)\s+(.+)/i);
    if (build) {
      return runBuild(user, build[2], { iterate: false, phone });
    }
    const iterate = body.match(/^(modifica|rendi|cambia|aggiorna)\s+(.+)/i);
    if (iterate) {
      return runBuild(user, iterate[2], { iterate: true, phone });
    }
    if (/^pubblica|ripubblica/i.test(t)) {
      const p = focusedProject(user.id);
      if (!p) return { reply: "Nessun progetto attivo. Scrivi «progetti» e poi «apri 1»." };
      const ap = requestApproval(user.id, phone, "publish", { projectId: p.id, republish: Boolean(p.published?.slug) }, `Pubblico «${p.title}» in fascia Starter (consuma crediti di pubblicazione)?`);
      if (ap.auto) return executeAction(user.id, "publish", { projectId: p.id });
      return { reply: ap.question, interactive: approvalButtons(ap.id, ap.question) };
    }
    if (/^spegni|shutdown/i.test(t)) {
      const p = focusedProject(user.id);
      if (!p?.published?.slug) return { reply: "Nessuna pubblicazione da spegnere." };
      const ap = requestApproval(user.id, phone, "shutdown", { projectId: p.id }, `Spengo la pubblicazione di «${p.title}»?`);
      if (ap.auto) return executeAction(user.id, "shutdown", { projectId: p.id });
      return { reply: ap.question, interactive: approvalButtons(ap.id, ap.question) };
    }
    if (/^chiama|telefon/i.test(t)) {
      return { reply: "Le chiamate in uscita sono previste (come su Wingman) ma restano in attesa di un provider vocale (es. WhatsApp Calling o TWILIO_ACCOUNT_SID)." };
    }

    // General assistant: use memory + optional LLM, else a useful local reply
    return generalAssist(user, body);
  }

  function focusedProject(userId) {
    const id = focusOf(userId);
    const projects = store.allProjects().filter((p) => p.userId === userId);
    return projects.find((p) => p.id === id) || projects[0] || null;
  }

  async function runBuild(user, prompt, { iterate }) {
    const costs = ctx.plansConfig.creditCosts;
    const cost = iterate ? costs.iterate : costs.generateNew;
    if (ctx.creditBalance(user) < cost) {
      return { reply: `Crediti insufficienti (servono ${cost}, ne hai ${ctx.creditBalance(user)}). Ricarica dalla pagina Account oppure scrivi dal web.` };
    }
    let project = iterate ? focusedProject(user.id) : null;
    if (iterate && !project?.html) return { reply: "Non c'è un'app da modificare. Prima scrivi «costruisci …»." };
    if (!project) {
      project = await ctx.createProject?.(user, prompt.slice(0, 48));
    }
    setFocus(user.id, project.id);
    try {
      const result = await ctx.generateForUser({
        user,
        prompt,
        currentHtml: iterate ? project.html : "",
        jobType: project.jobType || "fullstack",
        cost,
      });
      project.html = result.html || project.html;
      project.title = result.title || project.title;
      project.messages = project.messages || [];
      project.messages.push({ role: "user", content: prompt, at: Date.now(), via: "whatsapp" });
      project.messages.push({ role: "assistant", content: "Aggiornato da Nia su WhatsApp.", at: Date.now() });
      project.updatedAt = new Date().toISOString();
      ctx.saveProject(project);
      const left = ctx.creditBalance(user);
      return { reply: `${result.demo ? "Modalità demo: " : ""}Ho ${iterate ? "aggiornato" : "creato"} «${project.title}». Crediti usati: ${cost}, residui: ${left}.\nApri il workspace su IoXte per vederla in anteprima, oppure dimmi un'altra modifica.` };
    } catch (err) {
      return { reply: "Non sono riuscita a costruire l'app: " + err.message };
    }
  }

  async function generalAssist(user, body) {
    const mem = memoryOf(user.id);
    const facts = mem.facts.map((f) => f.text).join("; ");
    const cost = ctx.plansConfig.creditCosts.niaMessage || 0;
    if (ctx.detectProvider?.() && ctx.askLlm) {
      if (cost && ctx.creditBalance(user) < cost) {
        return { reply: "Crediti insufficienti per una risposta con modello. Puoi comunque usare saldo, progetti, promemoria." };
      }
      try {
        const text = await ctx.askLlm({
          system: `Sei Nia, assistente personale di IoXte (equivalente di un wingman su WhatsApp). Rispondi in italiano, breve e concreto. Memorie dell'utente: ${facts || "nessuna"}. Nome: ${user.name}. Piano: ${user.plan}. Non inventare pubblicazioni o pagamenti avvenuti.`,
          user: body,
        });
        if (cost) {
          ctx.spendCredits(user, cost, { reason: "nia-whatsapp", prompt: body.slice(0, 120) });
          ctx.upsertUser(user);
        }
        return { reply: text.slice(0, 4000) };
      } catch (err) {
        return { reply: "Il modello non è raggiungibile: " + err.message };
      }
    }
    return {
      reply: `Ti ascolto${facts ? " (tengo presente: " + facts.slice(0, 180) + ")" : ""}. In modalità demo, senza chiave LLM, posso soprattutto gestire progetti, crediti, memoria e promemoria. Prova «progetti», «saldo» o «costruisci una landing per…». Per risposte libere serve una chiave sul server.`,
    };
  }

  function nextRunAt(sch) {
    const now = new Date();
    if (sch.kind === "once") return sch.at;
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setHours(sch.hour, sch.minute || 0, 0, 0);
    if (sch.kind === "weekly") {
      const diff = (sch.day - d.getDay() + 7) % 7;
      if (diff === 0 && d <= now) d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + diff);
      return d.getTime();
    }
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  async function tick() {
    const all = read(files.tasks, []);
    const now = Date.now();
    for (const task of all) {
      if (task.deleted || task.paused || !task.nextRun || task.nextRun > now) continue;
      const user = userById(task.userId);
      if (!user) continue;
      if (ctx.creditBalance(user) <= 0) {
        task.paused = true;
        task.pauseReason = "no-credits";
        upsertTask(task);
        continue;
      }
      if (task.pauseReason === "no-credits" && ctx.creditBalance(user) > 0) {
        task.paused = false;
        task.pauseReason = null;
      }
      const text = `Promemoria IoXte (${task.label}): ${task.description}`;
      await sendText(task.phone, text);
      if (task.kind === "once") task.deleted = true;
      else task.nextRun = nextRunAt(task);
      task.lastRun = new Date().toISOString();
      upsertTask(task);
    }
    // auto-resume tasks paused for credits
    for (const task of all) {
      if (task.pauseReason === "no-credits") {
        const user = userById(task.userId);
        if (user && ctx.creditBalance(user) > 0) {
          task.paused = false;
          task.pauseReason = null;
          upsertTask(task);
        }
      }
    }
  }

  function extractIncoming(body) {
    const out = [];
    for (const entry of body?.entry || []) {
      for (const change of entry.changes || []) {
        const val = change.value || {};
        for (const msg of val.messages || []) {
          const item = {
            from: msg.from,
            id: msg.id,
            name: val.contacts?.[0]?.profile?.name,
            text: msg.text?.body || msg.image?.caption || msg.document?.caption || "",
            buttonId: msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "",
            type: msg.type,
          };
          out.push(item);
        }
      }
    }
    return out;
  }

  function status() {
    const active = links().filter((l) => !l.disconnectedAt);
    return {
      configured: whatsappConfigured(),
      verifyTokenSet: Boolean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY),
      phoneId: process.env.WHATSAPP_PHONE_ID ? "impostato" : null,
      linkedNumbers: active.length,
      message: whatsappConfigured()
        ? "WhatsApp Cloud API collegata. Imposta il webhook su /api/whatsapp/webhook."
        : "Modalità demo canale: manca WHATSAPP_TOKEN / WHATSAPP_PHONE_ID. Usa /api/whatsapp/simulate per provare Nia senza Meta.",
    };
  }

  return {
    files,
    status,
    verifyToken,
    createPairing,
    linkForUser(userId) {
      return links().find((l) => l.userId === userId && !l.disconnectedAt) || null;
    },
    disconnect,
    disconnectUser(userId) {
      saveLinks(links().map((l) => (l.userId === userId && !l.disconnectedAt ? { ...l, disconnectedAt: new Date().toISOString() } : l)));
    },
    sendText,
    handleIncoming,
    extractIncoming,
    tick,
    tasksOf,
    memoryOf,
    helpText,
    normalizePhone,
  };
}
