import { applyDemoIteration, buildDemoApp, DEMO_STEPS, makePlan, staticTests } from "./demos.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Interpreta XAI_API_KEY senza esporre il valore. Riconosce chiavi reali e scarta curl/segnaposto. */
export function interpretXaiKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: false, reason: "missing" };
  let key = s;
  if (/\bcurl\s+/i.test(s) || /api\.x\.ai/i.test(s)) {
    const bearer = s.match(/Bearer\s+([^\s'"]+)/i);
    if (bearer) key = bearer[1];
    else return { ok: false, reason: "curl_example" };
  }
  if (/^\$|[<>]|placeholder|your.?api.?key|XAI_API_KEY/i.test(key) || (key.length < 20 && /\s/.test(s))) {
    return { ok: false, reason: "placeholder" };
  }
  if (/\s/.test(key) && !key.startsWith("xai-")) {
    return { ok: false, reason: "not_a_key" };
  }
  return { ok: true, key };
}

export function explainProviderError(providerName, status, body) {
  const short = String(body || "").replace(/\s+/g, " ").trim().slice(0, 280);
  const lower = short.toLowerCase();
  const name = providerName || "Il modello";
  if (status === 402 || /insufficient|credit|quota|billing|spend limit|payment required|out of credits/.test(lower)) {
    return `${name} segnala crediti o quota insufficienti (errore ${status || 402}). Aggiungi crediti su https://console.x.ai e riprova. ${short ? "Dettaglio: " + short : ""}`.trim();
  }
  if (status === 403 || /forbidden|permission denied|not allowed|access denied/.test(lower)) {
    return `${name} ha rifiutato la richiesta (permesso negato o modello non disponibile, errore ${status || 403}). ${short ? "Dettaglio: " + short : ""}`.trim();
  }
  if (status === 401 || /incorrect api key|invalid api key|invalid-argument|invalid.*key|unauthorized|authentication/i.test(lower)) {
    return `${name} ha rifiutato la chiave API: non è valida o non è riconosciuta. Incolla una chiave reale da https://console.x.ai (di solito inizia con «xai-»). ${short ? "Dettaglio: " + short : ""}`.trim();
  }
  if (status === 429 || /rate limit|too many requests/.test(lower)) {
    return `${name} ha applicato un limite di frequenza (429). Attendi un momento e riprova. ${short ? "Dettaglio: " + short : ""}`.trim();
  }
  return `${name} ha risposto ${status || "con un errore"}. ${short}`.trim();
}

export function keyProblemMessage(reason) {
  if (reason === "missing") {
    return "Manca la chiave XAI_API_KEY (o un'altra chiave LLM) sul server. Impostala e riavvia.";
  }
  return "La variabile XAI_API_KEY è impostata, ma non contiene una chiave segreta valida: sembra un comando curl di esempio (modello citato: grok-4.7) con un segnaposto nell'header Authorization, non una chiave «xai-…». Sostituiscila con la chiave vera da https://console.x.ai e riavvia IoXte.";
}

export function detectProvider() {
  if (process.env.XAI_API_KEY) {
    const parsed = interpretXaiKey(process.env.XAI_API_KEY);
    return {
      id: "xai",
      name: "xAI",
      key: parsed.ok ? parsed.key : "",
      keyOk: parsed.ok,
      keyReason: parsed.ok ? "ok" : parsed.reason,
      model: process.env.XAI_MODEL || "grok-4.7",
      url: "https://api.x.ai/v1/chat/completions",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      id: "openai",
      name: "OpenAI",
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o",
      url: "https://api.openai.com/v1/chat/completions",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      id: "anthropic",
      name: "Anthropic",
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      url: "https://api.anthropic.com/v1/messages",
    };
  }
  return null;
}

const SYSTEM = `Sei l'agente costruttore di IoXte. L'utente descrive un'applicazione in linguaggio naturale (spesso in italiano).
Devi generare UN SOLO file HTML completo e funzionante (DOCTYPE, html, head con CSS, body, JavaScript inline).
Vincoli:
- Nessuna spiegazione, nessun markdown, nessun blocco di codice: restituisci soltanto il documento HTML.
- L'app deve essere bella, responsive, usabile subito, con dati di esempio se serve.
- Persistenza: usa localStorage quando ha senso.
- Lingua dell'interfaccia = lingua della richiesta (default italiano).
- Niente dipendenze obbligatorie non essenziali. Se usi un CDN, gestisci il fallback.
- Se ricevi l'HTML corrente e una richiesta di modifica, applica i cambiamenti e restituisci di nuovo il file completo.
- Non includere codice dannoso, tracking occluso o richieste di password di terzi.`;

export function extractHtml(text) {
  if (!text) return "";
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.search(/<!DOCTYPE html>|<html[\s>]/i);
  const html = (start >= 0 ? raw.slice(start) : raw).trim();
  return html;
}

export async function runGeneration({ prompt, history, currentHtml, jobType, planMode, maxx, systemExtra, attachments, onEvent, forceDemo }) {
  const provider = forceDemo ? null : detectProvider();
  if (planMode) {
    if (!provider) {
      for (const step of DEMO_STEPS.slice(0, 1)) {
        onEvent({ type: "status", step: step.id, label: step.label, detail: step.detail });
        await sleep(280);
      }
      const plan = makePlan(prompt, jobType);
      onEvent({ type: "plan", plan });
      return { kind: "plan", plan, demo: true };
    }
    if (provider.id === "xai" && provider.keyOk === false) {
      throw new Error(keyProblemMessage(provider.keyReason));
    }
    const plan = await callLlm({
      provider,
      messages: [
        { role: "system", content: "Rispondi SOLO con JSON valido: {title,summary,screens:string[],features:string[],questions:string[]}. In italiano, piano di un'app da costruire." },
        { role: "user", content: `Tipo: ${jobType || "fullstack"}\nRichiesta:\n${prompt}` },
      ],
      onDelta: (t) => onEvent({ type: "delta", text: t }),
    });
    let parsed;
    try { parsed = JSON.parse(plan.replace(/```json|```/g, "").trim()); }
    catch { parsed = makePlan(prompt, jobType); }
    onEvent({ type: "plan", plan: parsed });
    return { kind: "plan", plan: parsed, demo: false };
  }

  if (!provider) {
    return runDemo({ prompt, currentHtml, jobType, onEvent });
  }
  if (provider.id === "xai" && provider.keyOk === false) {
    throw new Error(keyProblemMessage(provider.keyReason));
  }

  onEvent({ type: "status", step: "planning", label: "Pianificazione", detail: "L'agente sta interpretando la richiesta." });
  const messages = [
    { role: "system", content: SYSTEM + (systemExtra ? `\nIstruzioni extra del progetto:\n${systemExtra}` : "") + (maxx ? "\nLavora con maggiore attenzione a accessibilità, stati vuoti, dettagli visivi e casi limite." : "") },
  ];
  if (currentHtml) {
    messages.push({ role: "user", content: "HTML corrente dell'app:\n" + currentHtml.slice(0, 120000) });
    messages.push({ role: "assistant", content: "Ho l'HTML corrente. Indica le modifiche." });
  }
  if (Array.isArray(history)) {
    for (const m of history.slice(-12)) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: String(m.content).slice(0, 8000) });
      }
    }
  }
  let userContent = `Tipo di lavoro: ${jobType || "fullstack"}\n\nRichiesta:\n${prompt}`;
  if (attachments?.length) {
    userContent += "\n\nAllegati:\n" + attachments.map((a) => `- ${a.name} (${a.type || "file"}):\n${String(a.text || "").slice(0, 4000)}`).join("\n");
  }
  messages.push({ role: "user", content: userContent });

  onEvent({ type: "status", step: "implementation", label: "Implementazione", detail: `Generazione con ${provider.name} (${provider.model}).` });
  const raw = await callLlm({
    provider,
    messages,
    onDelta: (t) => onEvent({ type: "delta", text: t }),
  });
  const html = extractHtml(raw);
  if (!html || html.length < 40) throw new Error("L'agente non ha restituito un HTML valido.");
  onEvent({ type: "status", step: "testing", label: "Test automatici", detail: "Verifico il documento generato." });
  const tests = staticTests(html);
  onEvent({ type: "tests", tests });
  onEvent({ type: "code", html });
  return { kind: "code", html, tests, demo: false, provider: provider.id, model: provider.model };
}

async function runDemo({ prompt, currentHtml, jobType, onEvent }) {
  for (const step of DEMO_STEPS) {
    onEvent({ type: "status", step: step.id, label: step.label, detail: step.detail });
    await sleep(step.id === "implementation" ? 450 : 280);
  }
  const html = currentHtml ? applyDemoIteration(currentHtml, prompt) : buildDemoApp(prompt, { jobType });
  const tests = staticTests(html);
  onEvent({ type: "tests", tests });
  onEvent({ type: "code", html });
  return { kind: "code", html, tests, demo: true };
}

async function callLlm({ provider, messages, onDelta }) {
  if (provider.id === "anthropic") return callAnthropic({ provider, messages, onDelta });
  const body = {
    model: provider.model,
    stream: true,
    temperature: 0.5,
    messages,
  };
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(explainProviderError(provider.name, res.status, t));
  }
  return readOpenAiStream(res, onDelta);
}

async function callAnthropic({ provider, messages, onDelta }) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const msgs = messages.filter((m) => m.role !== "system");
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 16000,
      stream: true,
      system,
      messages: msgs,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(explainProviderError("Anthropic", res.status, t));
  }
  let out = "";
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() || "";
    for (const line of parts) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const j = JSON.parse(data);
        const t = j.delta?.text || "";
        if (t) { out += t; onDelta?.(t); }
      } catch {}
    }
  }
  return out;
}

async function readOpenAiStream(res, onDelta) {
  let out = "";
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() || "";
    for (const line of parts) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content || "";
        if (t) { out += t; onDelta?.(t); }
      } catch {}
    }
  }
  return out;
}


export async function askLlm({ system, user }) {
  const provider = detectProvider();
  if (!provider) throw new Error("Nessun provider LLM configurato.");
  const messages = [
    { role: "system", content: system || "Rispondi in italiano, in modo breve." },
    { role: "user", content: user },
  ];
  if (provider.id === "anthropic") {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: provider.model, max_tokens: 800, system: system || "", messages: [{ role: "user", content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || res.status);
    return (data.content || []).map((c) => c.text || "").join("");
  }
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({ model: provider.model, temperature: 0.4, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || res.status);
  return data.choices?.[0]?.message?.content || "";
}


export async function listXaiModels(key) {
  const res = await fetch("https://api.x.ai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(explainProviderError("xAI", res.status, text));
  const data = JSON.parse(text);
  const rows = data.data || data.models || [];
  return rows.map((m) => (typeof m === "string" ? m : m.id || m.name)).filter(Boolean);
}

/** Preferisce un modello grok-4 / code, poi grok-4.7, poi il primo grok disponibile. */
export function preferCodingModel(ids) {
  const list = ids.map((s) => String(s));
  const usable = list.filter((id) => !/imagine|video|image|tts|voice|realtime/i.test(id));
  const pri = [
    /grok-build/i,
    /grok-4(?:\.\d+)?-code/i,
    /grok-4.*code/i,
    /grok-code/i,
    /grok-4\.20.*reasoning/i,
    /grok-4\.20-multi-agent/i,
    /^grok-4\.7$/,
    /^grok-4\.6$/,
    /^grok-4\.5$/,
    /grok-4\./,
    /grok-4-fast/,
    /grok-4/,
  ];
  const pool = usable.length ? usable : list;
  for (const re of pri) {
    const hit = pool.find((id) => re.test(id));
    if (hit) return hit;
  }
  return pool.find((id) => /grok/i.test(id)) || pool[0] || "grok-4.7";
}
