import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { makeStore } from "./lib/store.js";
import { detectProvider, runGeneration, askLlm, extractHtml, listXaiModels, preferCodingModel, interpretXaiKey, keyProblemMessage } from "./lib/llm.js";
import { createNia, whatsappConfigured } from "./lib/whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3055;

loadDotEnv();
const SESSION_SECRET = loadOrCreateSessionSecret();
const store = makeStore(ROOT);
const plansConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "config/plans.json"), "utf8"));

seedLorenzo();

let resolvedModel = process.env.XAI_MODEL || "grok-4.7";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "8mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(enforceRateLimits);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.end();
  next();
});

app.get("/api/health", (_req, res) => {
  const provider = detectProvider();
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const keyOk = provider ? provider.keyOk !== false : false;
  let message;
  if (!provider) {
    message = "Modalità demo: imposta XAI_API_KEY, OPENAI_API_KEY o ANTHROPIC_API_KEY per la generazione con un modello reale. Serve almeno una chiave.";
  } else if (provider.id === "xai" && provider.keyOk === false) {
    message = keyProblemMessage(provider.keyReason);
  } else {
    message = `Generazione reale attiva (${provider.name}, modello ${provider.model}).`;
  }
  res.json({
    ok: true,
    name: "IoXte",
    mode: provider ? "live" : "demo",
    keyOk,
    keyReason: provider?.keyReason || (provider ? "ok" : "missing"),
    provider: provider ? { id: provider.id, name: provider.name, model: resolvedModel || provider.model } : null,
    stripe,
    github: Boolean(process.env.GITHUB_TOKEN),
    whatsapp: whatsappConfigured(),
    message,
  });
});

app.get("/api/config", (_req, res) => {
  const publicPlans = JSON.parse(JSON.stringify(plansConfig));
  delete publicPlans._comment;
  delete publicPlans.notesForOwner;
  res.json({
    plans: publicPlans,
    stripePublishable: process.env.STRIPE_PUBLISHABLE_KEY || "",
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    githubEnabled: Boolean(process.env.GITHUB_TOKEN),
    mode: detectProvider() ? "live" : "demo",
    providers: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID),
      pagbrasil: Boolean(process.env.PAGBRASIL_API_KEY),
      paddle: Boolean(process.env.PADDLE_API_KEY),
      revenuecat: Boolean(process.env.REVENUECAT_API_KEY),
      whatsapp: whatsappConfigured(),
    },
    whatsapp: {
      configured: whatsappConfigured(),
      verifyTokenSet: Boolean(process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY),
    },
  });
});

app.post("/api/auth/signup", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name || name.length < 2) return res.status(400).json({ error: "Indica il tuo nome." });
  if (!validEmail(email)) return res.status(400).json({ error: "Email non valida." });
  if (password.length < 8) return res.status(400).json({ error: "La password deve avere almeno 8 caratteri." });
  if (store.allUsers().find((u) => u.email === email)) {
    return res.status(409).json({ error: "Esiste già un account con questa email. Accedi." });
  }
  const user = newUser({ name, email });
  user.passwordHash = hashPassword(password);
  const users = store.allUsers();
  users.push(user);
  store.saveUsers(users);
  const token = signToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!validEmail(email) || !password) {
    return res.status(400).json({ error: "Inserisci email e password." });
  }
  const user = store.allUsers().find((u) => u.email === email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Email o password non corretti." });
  }
  maybeRefill(user);
  upsertUser(user);
  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/me/profile", auth, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name && name.length >= 2) req.user.name = name.slice(0, 80);
  upsertUser(req.user);
  res.json({ user: publicUser(req.user) });
});

app.post("/api/me/password", auth, (req, res) => {
  const current = String(req.body?.current || "");
  const next = String(req.body?.password || "");
  if (next.length < 8) return res.status(400).json({ error: "La nuova password deve avere almeno 8 caratteri." });
  if (req.user.passwordHash && !verifyPassword(current, req.user.passwordHash)) {
    return res.status(401).json({ error: "Password attuale non corretta." });
  }
  req.user.passwordHash = hashPassword(next);
  upsertUser(req.user);
  res.json({ ok: true, message: "Password aggiornata." });
});

app.get("/api/me", auth, (req, res) => {
  maybeRefill(req.user);
  upsertUser(req.user);
  res.json({ user: publicUser(req.user), usage: req.user.usage?.slice(-50) || [] });
});

app.post("/api/me/system-prompt", auth, (req, res) => {
  if (!planLimits(req.user).canEditSystemPrompt) {
    return res.status(403).json({ error: "La modifica del system prompt è disponibile nel piano Pro." });
  }
  req.user.systemPrompt = String(req.body?.systemPrompt || "").slice(0, 8000);
  upsertUser(req.user);
  res.json({ ok: true });
});

app.post("/api/me/agents", auth, (req, res) => {
  if (!planLimits(req.user).canCustomAgents) {
    return res.status(403).json({ error: "Gli agenti personalizzati sono disponibili nel piano Pro." });
  }
  const agents = Array.isArray(req.user.customAgents) ? req.user.customAgents : [];
  const agent = {
    id: crypto.randomBytes(4).toString("hex"),
    name: String(req.body?.name || "Agente").slice(0, 80),
    prompt: String(req.body?.prompt || "").slice(0, 4000),
  };
  agents.push(agent);
  req.user.customAgents = agents;
  upsertUser(req.user);
  res.json({ agent, agents });
});

app.delete("/api/me", auth, (req, res) => {
  store.saveUsers(store.allUsers().filter((u) => u.id !== req.user.id));
  store.saveProjects(store.allProjects().filter((p) => p.userId !== req.user.id));
  res.json({ ok: true });
});

app.get("/api/projects", auth, (req, res) => {
  res.json({ projects: store.allProjects().filter((p) => p.userId === req.user.id).map(briefProject) });
});

app.post("/api/projects", auth, (req, res) => {
  const p = {
    id: crypto.randomBytes(6).toString("hex"),
    userId: req.user.id,
    title: String(req.body?.title || "Nuovo progetto").slice(0, 80),
    jobType: req.body?.jobType || "fullstack",
    agentTier: req.body?.agentTier || "i1",
    html: req.body?.html || "",
    messages: req.body?.messages || [],
    secrets: {},
    db: { collections: { items: [] } },
    logs: [],
    collaborators: [],
    createdAt: now(),
    updatedAt: now(),
  };
  const all = store.allProjects();
  all.push(p);
  store.saveProjects(all);
  res.json({ project: p });
});

app.get("/api/projects/:id", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  res.json({ project: p });
});

app.put("/api/projects/:id", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  const allow = ["title", "html", "messages", "jobType", "agentTier", "db", "logs", "systemPrompt", "checkpoints", "bundleId"];
  for (const k of allow) if (k in (req.body || {})) p[k] = req.body[k];
  p.updatedAt = now();
  saveProject(p);
  res.json({ project: briefProject(p) });
});

app.delete("/api/projects/:id", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  store.saveProjects(store.allProjects().filter((x) => x.id !== p.id));
  res.json({ ok: true });
});

app.post("/api/projects/:id/fork", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  if (!planLimits(req.user).canGithub && req.user.plan === "free") {
    // fork is Standard+ in Emergent; allow in prototype for Standard+. Free blocked.
    return res.status(403).json({ error: "Duplicare un lavoro è disponibile dal piano Standard." });
  }
  const copy = { ...p, id: crypto.randomBytes(6).toString("hex"), title: `${p.title} (copia)`, createdAt: now(), updatedAt: now(), published: undefined };
  const all = store.allProjects();
  all.push(copy);
  store.saveProjects(all);
  res.json({ project: copy });
});

app.post("/api/projects/:id/secrets", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  p.secrets = p.secrets || {};
  const key = String(req.body?.key || "").trim();
  if (!key) return res.status(400).json({ error: "Chiave mancante." });
  p.secrets[key] = { value: String(req.body?.value || ""), scope: req.body?.scope || "preview", updatedAt: now() };
  p.logs = p.logs || [];
  p.logs.push({ at: now(), level: "info", msg: `Segreto aggiornato: ${key}` });
  saveProject(p);
  res.json({ secrets: maskSecrets(p.secrets) });
});

app.get("/api/projects/:id/secrets", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  res.json({ secrets: maskSecrets(p.secrets || {}) });
});

app.post("/api/projects/:id/invite", auth, (req, res) => {
  const p = mustProject(req, res);
  if (!p) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = req.body?.role === "viewer" ? "viewer" : "editor";
  if (!email) return res.status(400).json({ error: "Email richiesta." });
  p.collaborators = p.collaborators || [];
  p.collaborators.push({ email, role, at: now(), status: process.env.SMTP_URL ? "invited" : "pending-smtp" });
  saveProject(p);
  res.json({
    collaborators: p.collaborators,
    message: process.env.SMTP_URL ? "Invito inviato." : "Invito registrato. Per l'invio email serve SMTP_URL.",
  });
});

app.post("/api/generate", auth, async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "Descrivi l'app che vuoi costruire." });

  maybeRefill(req.user);
  const costs = plansConfig.creditCosts;
  const isIterate = Boolean(req.body?.currentHtml);
  const planMode = Boolean(req.body?.planMode);
  const maxx = Boolean(req.body?.maxx);
  const jobType = req.body?.jobType || "fullstack";
  const agentTier = req.body?.agentTier || "i1";
  const budget = Number(req.body?.budget || 0) || null;

  if (maxx && !planLimits(req.user).canMaxx) {
    return res.status(403).json({ error: "La modalità Intensiva è disponibile nel piano Pro." });
  }

  let cost = planMode || jobType === "brainstorm"
    ? costs.planOnly
    : isIterate
      ? (req.body?.visualEdits ? costs.visualEditBatch : costs.iterate)
      : costs.generateNew;
  if (jobType === "brainstorm" && planMode) cost = costs.brainstorm;
  if (agentTier === "i2") cost *= costs.agentI2Multiplier;
  if (agentTier === "i3") cost *= costs.agentI3Multiplier;
  if (maxx) cost *= costs.maxxMultiplier;
  cost = Math.max(1, Math.round(cost));
  if (budget && cost > budget) {
    return res.status(402).json({ error: "Il costo stimato supera il tetto di spesa di questa sessione.", cost, budget });
  }
  const balance = creditBalance(req.user);
  if (balance < cost) {
    return res.status(402).json({
      error: "Crediti insufficienti. Ricarica o passa a un piano superiore.",
      credits: balance,
      cost,
    });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    send({ type: "meta", cost, demo: !detectProvider(), balance });
    const result = await runGeneration({
      prompt,
      history: req.body?.history || [],
      currentHtml: req.body?.currentHtml || "",
      jobType,
      planMode: planMode || jobType === "brainstorm",
      maxx,
      systemExtra: req.body?.systemPrompt || req.user.systemPrompt || "",
      attachments: req.body?.attachments || [],
      onEvent: send,
    });
    spendCredits(req.user, cost, {
      reason: planMode ? "piano" : isIterate ? "iterazione" : "generazione",
      prompt: prompt.slice(0, 180),
    });
    upsertUser(req.user);
    if (result.html) {
      const testsCost = plansConfig.creditCosts.tests;
      // tests included conceptually in the step; do not double-charge in demo to keep free tier usable
    }
    send({
      type: "done",
      kind: result.kind,
      demo: result.demo,
      provider: result.provider || null,
      model: result.model || null,
      creditsCharged: cost,
      creditsLeft: creditBalance(req.user),
      titleGuess: guessTitleFromHtml(result.html),
    });
  } catch (err) {
    send({ type: "error", message: err.message || "Generazione non riuscita." });
  } finally {
    res.end();
  }
});

app.post("/api/checkout", auth, async (req, res) => {
  const { kind, planId, interval, topupId } = req.body || {};
  if (kind === "topup") return checkoutTopup(req, res, topupId);
  const plan = plansConfig.plans.find((p) => p.id === planId);
  if (!plan) return res.status(400).json({ error: "Piano sconosciuto." });
  if (plan.custom) return res.status(400).json({ error: "Questo piano è su preventivo. Usa il modulo contatto." });
  if (plan.monthlyPrice === 0) {
    assignPlan(req.user, "free", "monthly");
    upsertUser(req.user);
    return res.json({ demo: false, activated: true, user: publicUser(req.user) });
  }
  const annual = interval === "annual";
  const amount = Math.round((annual ? plan.annualMonthlyPrice : plan.monthlyPrice) * 100) * (annual ? 12 : 1);
  if (!process.env.STRIPE_SECRET_KEY) {
    assignPlan(req.user, plan.id, annual ? "annual" : "monthly");
    upsertUser(req.user);
    return res.json({
      demo: true,
      activated: true,
      message: "Modalità demo pagamenti: piano attivato in locale. Per addebiti reali imposta STRIPE_SECRET_KEY e STRIPE_PUBLISHABLE_KEY.",
      user: publicUser(req.user),
    });
  }
  try {
    const stripe = await getStripe();
    const origin = publicUrl(req);
    const priceId = annual ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
    const line = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: plansConfig.currency || "usd",
            product_data: { name: `IoXte ${plan.name}` },
            unit_amount: annual ? Math.round(plan.annualMonthlyPrice * 100) : Math.round(plan.monthlyPrice * 100),
            recurring: { interval: annual ? "year" : "month" },
          },
          quantity: 1,
        };
    if (!priceId && annual) {
      line.price_data.unit_amount = Math.round(plan.annualMonthlyPrice * 12 * 100);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [line],
      success_url: `${origin}/#/account?checkout=success`,
      cancel_url: `${origin}/#/prezzi?checkout=cancel`,
      customer_email: req.user.email,
      metadata: { userId: req.user.id, planId: plan.id, interval: annual ? "annual" : "monthly", kind: "plan" },
    });
    res.json({ url: session.url, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkout/topup", auth, (req, res) => checkoutTopup(req, res, req.body?.topupId));

app.post("/api/cancel-plan", auth, async (req, res) => {
  if (process.env.STRIPE_SECRET_KEY && req.user.stripeSubscriptionId) {
    try {
      const stripe = await getStripe();
      await stripe.subscriptions.update(req.user.stripeSubscriptionId, { cancel_at_period_end: true });
      req.user.cancelAtPeriodEnd = true;
      upsertUser(req.user);
      return res.json({ ok: true, message: "Disdetta programmata a fine ciclo su Stripe." });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  req.user.pendingPlan = "free";
  req.user.cancelAtPeriodEnd = true;
  upsertUser(req.user);
  res.json({
    ok: true,
    demo: !process.env.STRIPE_SECRET_KEY,
    message: "Disdetta registrata. Il piano Free verrà applicato al prossimo rinnovo. (Senza Stripe la disdetta è solo locale.)",
  });
});

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  // Mounted separately? This route may not get raw body because of json middleware.
  res.status(200).json({ received: true, note: "Usa /api/stripe/webhook per la verifica firma." });
});

app.post("/api/publish", auth, (req, res) => {
  const limits = planLimits(req.user);
  if (!limits.canPublish) {
    return res.status(403).json({
      error: "La pubblicazione in produzione è disponibile dal piano Standard.",
      hint: "Puoi comunque scaricare il file HTML o usare l'anteprima nel workspace.",
    });
  }
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project || !project.html) return res.status(400).json({ error: "Progetto o codice mancante." });
  const tierId = req.body?.tier || "starter";
  const tier = plansConfig.publishingTiers.find((t) => t.id === tierId) || plansConfig.publishingTiers[0];
  const cost = tier.creditsPerMonth;
  if (creditBalance(req.user) < cost) {
    return res.status(402).json({ error: "Crediti insufficienti per questa fascia di pubblicazione.", cost });
  }
  const slug = slugify(req.body?.slug || project.title) + "-" + project.id.slice(0, 4);
  const existing = (project.published || {}).slug;
  const slugFinal = existing || slug;
  spendCredits(req.user, cost, { reason: "pubblicazione", slug: slugFinal, tier: tier.id });
  upsertUser(req.user);
  const meta = {
    slug: slugFinal,
    projectId: project.id,
    userId: req.user.id,
    title: project.title,
    tier: tier.id,
    seo: Boolean(req.body?.seo),
    customDomain: req.body?.customDomain || "",
    publishedAt: now(),
    visits: (project.published?.visits || 0),
  };
  store.writePublishedFiles(slugFinal, project.html, meta);
  const rec = {
    ...meta,
    versions: [{ at: now(), label: "Prima pubblicazione" }, ...(project.published?.versions || [])].slice(0, 3),
  };
  project.published = rec;
  project.updatedAt = now();
  saveProject(project);
  const idx = store.allPublished().filter((x) => x.slug !== slugFinal);
  idx.push(rec);
  store.savePublished(idx);
  res.json({ url: `/p/${slugFinal}`, published: rec, creditsLeft: creditBalance(req.user) });
});

app.post("/api/publish/republish", auth, (req, res) => {
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project?.published?.slug) return res.status(400).json({ error: "Il progetto non è ancora pubblicato." });
  const slug = project.published.slug;
  const meta = { ...project.published, republishedAt: now() };
  meta.versions = [{ at: now(), label: "Ripubblicazione" }, ...(meta.versions || [])].slice(0, 3);
  store.writePublishedFiles(slug, project.html, meta);
  project.published = meta;
  saveProject(project);
  res.json({ url: `/p/${slug}`, published: meta, charged: 0 });
});

app.post("/api/publish/replace", auth, (req, res) => {
  const dest = store.allProjects().find((p) => p.id === req.body?.targetProjectId && p.userId === req.user.id);
  const src = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!dest?.published?.slug || !src) return res.status(400).json({ error: "Progetto o pubblicazione di destinazione mancante." });
  const keepDb = Boolean(req.body?.keepDatabase);
  const slug = dest.published.slug;
  const meta = { ...dest.published, replacedFrom: src.id, replacedAt: now() };
  if (!keepDb) dest.dbProduction = JSON.parse(JSON.stringify(src.db || { collections: {} }));
  store.writePublishedFiles(slug, src.html, meta);
  dest.html = src.html;
  dest.published = meta;
  saveProject(dest);
  res.json({ url: `/p/${slug}`, published: meta });
});

app.post("/api/publish/shutdown", auth, (req, res) => {
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project?.published?.slug) return res.status(400).json({ error: "Nessuna pubblicazione da spegnere." });
  project.published.shutdownAt = now();
  project.published.live = false;
  saveProject(project);
  res.json({ ok: true, message: "Pubblicazione spenta. L'addebito mensile della fascia si interrompe." });
});

app.post("/api/publish/rollback", auth, (req, res) => {
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project?.published?.slug) return res.status(400).json({ error: "Nessuna pubblicazione." });
  const html = store.readVersion(project.id, req.body?.versionId);
  if (!html) return res.status(404).json({ error: "Versione non trovata." });
  store.writePublishedFiles(project.published.slug, html, project.published);
  project.html = html;
  saveProject(project);
  res.json({ ok: true, url: `/p/${project.published.slug}` });
});

app.get("/p/:slug", (req, res) => {
  const rec = store.allPublished().find((p) => p.slug === req.params.slug);
  if (!rec || rec.live === false || rec.shutdownAt) return res.status(404).send("App non pubblicata o spenta.");
  const html = store.readPublishedHtml(req.params.slug);
  if (!html) return res.status(404).send("File non trovato.");
  rec.visits = (rec.visits || 0) + 1;
  const idx = store.allPublished().map((x) => (x.slug === rec.slug ? rec : x));
  store.savePublished(idx);
  const analytics = store.read(store.files.analytics, {});
  analytics[rec.slug] = rec.visits;
  store.write(store.files.analytics, analytics);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/api/publish/:slug/analytics", auth, (req, res) => {
  const analytics = store.read(store.files.analytics, {});
  res.json({ visits: analytics[req.params.slug] || 0 });
});

app.post("/api/github/save", auth, async (req, res) => {
  if (!planLimits(req.user).canGithub) {
    return res.status(403).json({ error: "Il salvataggio su GitHub è disponibile dal piano Standard." });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: "GitHub non è collegato.",
      message: "Imposta GITHUB_TOKEN (e opzionalmente GITHUB_OWNER) per creare un Gist o un repository.",
    });
  }
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project?.html) return res.status(400).json({ error: "Codice mancante." });
  try {
    const r = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "IoXte", "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `IoXte — ${project.title}`,
        public: false,
        files: { "index.html": { content: project.html } },
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "GitHub error");
    res.json({ url: data.html_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/feedback", auth, (req, res) => {
  const item = { at: now(), userId: req.user.id, message: String(req.body?.message || "").slice(0, 4000) };
  store.push(store.files.feedback, item);
  res.json({ ok: true, message: process.env.SMTP_URL ? "Inviato." : "Feedback salvato in data/feedback.json." });
});

app.post("/api/contact-sales", (req, res) => {
  const item = { at: now(), name: req.body?.name, email: req.body?.email, plan: req.body?.plan, message: req.body?.message };
  store.push(store.files.leads, item);
  res.json({ ok: true, message: "Richiesta salvata. Ti ricontatteremo." });
});

app.post("/api/checkpoints", auth, (req, res) => {
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project) return res.status(404).json({ error: "Progetto non trovato." });
  const rec = store.saveVersion(project.id, project.html || "", req.body?.label || "Checkpoint");
  project.checkpoints = project.checkpoints || [];
  project.checkpoints.unshift(rec);
  saveProject(project);
  res.json({ checkpoint: rec, checkpoints: project.checkpoints.slice(0, 20) });
});

app.get("/api/checkpoints/:projectId", auth, (req, res) => {
  res.json({ checkpoints: store.listVersions(req.params.projectId) });
});

app.post("/api/checkpoints/restore", auth, (req, res) => {
  const project = store.allProjects().find((p) => p.id === req.body?.projectId && p.userId === req.user.id);
  if (!project) return res.status(404).json({ error: "Progetto non trovato." });
  const html = store.readVersion(project.id, req.body?.versionId);
  if (!html) return res.status(404).json({ error: "Checkpoint non trovato." });
  project.html = html;
  project.updatedAt = now();
  saveProject(project);
  res.json({ html, project: briefProject(project) });
});

app.post("/api/storage/:projectId", auth, (req, res) => {
  const dir = path.join(store.dir, "storage", req.params.projectId);
  fs.mkdirSync(dir, { recursive: true });
  const name = (req.body?.name || "file.txt").replace(/[^\w.\-]+/g, "_");
  const buf = Buffer.from(req.body?.contentBase64 || "", "base64");
  fs.writeFileSync(path.join(dir, name), buf);
  res.json({ ok: true, path: name, bytes: buf.length });
});

app.get("/api/mcp", auth, (req, res) => {
  res.json({
    name: "ioxte",
    description: "Connettore MCP IoXte. Collegamento in attesa di autenticazione MCP.",
    tools: ["generate_app", "list_projects", "publish_app"],
    status: "awaiting_keys",
  });
});


const nia = createNia({
  store,
  ROOT,
  plansConfig,
  creditBalance,
  spendCredits,
  upsertUser,
  maybeRefill,
  saveProject,
  detectProvider,
  askLlm,
  generateForUser,
  createProject: createProjectForUser,
  publishProject: publishForUser,
  shutdownProject: shutdownForUser,
});

app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"] || req.query.hub?.mode;
  const token = req.query["hub.verify_token"] || req.query.hub?.verify_token;
  const challenge = req.query["hub.challenge"] || req.query.hub?.challenge;
  if (mode === "subscribe" && token && token === nia.verifyToken()) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.status(403).send("Verify token non valido.");
});

app.post("/api/whatsapp/webhook", (req, res) => {
  res.status(200).json({ received: true });
  const msgs = nia.extractIncoming(req.body || {});
  (async () => {
    for (const msg of msgs) {
      try {
        const result = await nia.handleIncoming(msg);
        if (result?.reply || result?.interactive) {
          await nia.sendText(msg.from, result.reply || "", { interactive: result.interactive });
        }
      } catch (err) {
        console.error("Nia WhatsApp error", err);
        try { await nia.sendText(msg.from, "Si è verificato un errore. Riprova tra poco."); } catch {}
      }
    }
  })();
});

app.get("/api/whatsapp/status", auth, (req, res) => {
  const link = nia.linkForUser(req.user.id);
  res.json({
    ...nia.status(),
    linked: Boolean(link),
    phone: link ? "••••" + String(link.phone).slice(-3) : null,
    linkedAt: link?.linkedAt || null,
    memory: nia.memoryOf(req.user.id),
    tasks: nia.tasksOf(req.user.id),
  });
});

app.post("/api/whatsapp/link", auth, (req, res) => {
  const rec = nia.createPairing(req.user.id);
  res.json({
    code: rec.code,
    expiresInMinutes: 15,
    message: "Apri WhatsApp, scrivi a Nia (il numero Business di IoXte) e invia solo questo codice. Scade in 15 minuti.",
    configured: whatsappConfigured(),
    hint: whatsappConfigured() ? null : "Il canale è in modalità demo: puoi anche provare POST /api/whatsapp/simulate con { from, text: codice }.",
  });
});

app.delete("/api/whatsapp/link", auth, (req, res) => {
  nia.disconnectUser(req.user.id);
  res.json({ ok: true, message: "WhatsApp scollegato. Nia resta disponibile sul web." });
});

app.post("/api/whatsapp/simulate", auth, async (req, res) => {
  const from = req.body?.from || ("39" + String(req.user.id).replace(/\D/g, "").slice(0, 10).padEnd(10, "0"));
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Campo text obbligatorio." });
  try {
    const result = await nia.handleIncoming({ from, text, name: req.body?.name || "Simulatore", buttonId: req.body?.buttonId });
    const sent = await nia.sendText(from, result.reply || "", { interactive: result.interactive });
    res.json({ demo: !whatsappConfigured(), incoming: { from, text }, reply: result.reply, interactive: result.interactive || null, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/nia", auth, (req, res) => {
  const link = nia.linkForUser(req.user.id);
  res.json({
    name: "Nia",
    memory: nia.memoryOf(req.user.id),
    tasks: nia.tasksOf(req.user.id),
    whatsapp: { linked: Boolean(link), phone: link ? "••••" + String(link.phone).slice(-3) : null },
    help: nia.helpText(req.user),
  });
});

setInterval(() => {
  nia.tick().catch((err) => console.error("Nia tick", err));
}, 30000);


app.use(express.static(path.join(ROOT, "public")));
app.get(["/", "/index.html"], (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

const server = app.listen(PORT, "0.0.0.0", () => {
  const provider = detectProvider();
  console.log(`IoXte in ascolto su http://0.0.0.0:${PORT}  mode=${provider ? "live:" + provider.id : "demo"} model=${resolvedModel} keyOk=${provider ? provider.keyOk !== false : false}`);
  resolvePreferredModel().catch((err) => console.error("Selezione modello xAI:", err.message));
});

function loadDotEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function seedLorenzo() {
  const users = store.allUsers();
  const email = (process.env.OWNER_EMAIL || "lorenzo@ioxte.local").trim().toLowerCase();
  let user = users.find((u) => u.email === email);
  if (!user) {
    user = newUser({ id: "lorenzo", name: process.env.OWNER_NAME || "Lorenzo Ranieri", email });
    users.push(user);
  }
  const fromEnv = process.env.OWNER_PASSWORD;
  if (!user.passwordHash) {
    if (fromEnv && fromEnv.length >= 8) {
      user.passwordHash = hashPassword(fromEnv);
    } else {
      const bootstrap = crypto.randomBytes(9).toString("base64url");
      user.passwordHash = hashPassword(bootstrap);
      const note = path.join(store.dir, "owner-login.txt");
      fs.writeFileSync(
        note,
        "Account titolare IoXte (cambiala al primo accesso)\n" +
          "email: " + email + "\n" +
          "password: " + bootstrap + "\n",
        { mode: 0o600 }
      );
      console.log("Password iniziale del titolare scritta in data/owner-login.txt (non pubblica).");
    }
  }
  store.saveUsers(users);
}

function newUser({ id, name, email }) {
  const free = plansConfig.plans.find((p) => p.id === "free");
  return {
    id: id || crypto.randomBytes(6).toString("hex"),
    name,
    email,
    plan: "free",
    interval: "monthly",
    creditsSub: free.monthlyCredits,
    creditsTopup: 0,
    creditsPromo: 0,
    periodStart: now(),
    usage: [],
    createdAt: now(),
    customAgents: [],
    systemPrompt: "",
  };
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    interval: u.interval,
    credits: creditBalance(u),
    creditsSub: u.creditsSub,
    creditsTopup: u.creditsTopup,
    creditsPromo: u.creditsPromo,
    periodStart: u.periodStart,
    cancelAtPeriodEnd: Boolean(u.cancelAtPeriodEnd),
    limits: planLimits(u),
    customAgents: u.customAgents || [],
    systemPrompt: u.systemPrompt || "",
  };
}

function planOf(user) {
  return plansConfig.plans.find((p) => p.id === user.plan) || plansConfig.plans[0];
}
function planLimits(user) {
  return planOf(user).limits || {};
}

function creditBalance(u) {
  return (u.creditsSub || 0) + (u.creditsPromo || 0) + (u.creditsTopup || 0);
}

function spendCredits(user, amount, meta) {
  let left = amount;
  const take = (field) => {
    const n = Math.min(user[field] || 0, left);
    user[field] = (user[field] || 0) - n;
    left -= n;
  };
  take("creditsSub");
  take("creditsPromo");
  take("creditsTopup");
  user.usage = user.usage || [];
  user.usage.push({ at: now(), amount, ...meta, left: creditBalance(user) });
}

function assignPlan(user, planId, interval) {
  const plan = plansConfig.plans.find((p) => p.id === planId);
  user.plan = planId;
  user.interval = interval;
  user.periodStart = now();
  user.cancelAtPeriodEnd = false;
  user.pendingPlan = null;
  user.creditsSub = plan.monthlyCredits || 0;
}

function maybeRefill(user) {
  if (!user.periodStart) user.periodStart = now();
  const start = new Date(user.periodStart);
  const cycleDays = user.interval === "annual" ? 365 : 30;
  if (Date.now() - start.getTime() > cycleDays * 86400000) {
    if (user.pendingPlan) user.plan = user.pendingPlan;
    const plan = planOf(user);
    user.creditsSub = plan.monthlyCredits || 0;
    user.periodStart = now();
    user.pendingPlan = null;
  }
}

function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); }
  catch { return null; }
}

function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : req.query.token;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: "Accesso richiesto." });
  const user = store.allUsers().find((u) => u.id === data.uid);
  if (!user) return res.status(401).json({ error: "Utente non trovato." });
  maybeRefill(user);
  req.user = user;
  next();
}

function upsertUser(user) {
  const users = store.allUsers();
  const i = users.findIndex((u) => u.id === user.id);
  if (i >= 0) users[i] = user;
  else users.push(user);
  store.saveUsers(users);
}

function saveProject(p) {
  const all = store.allProjects();
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p;
  store.saveProjects(all);
}

function mustProject(req, res) {
  const p = store.allProjects().find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!p) { res.status(404).json({ error: "Progetto non trovato." }); return null; }
  return p;
}

function briefProject(p) {
  return {
    id: p.id,
    title: p.title,
    jobType: p.jobType,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    hasCode: Boolean(p.html),
    published: p.published ? { slug: p.published.slug, live: p.published.live !== false, visits: p.published.visits || 0 } : null,
  };
}

function maskSecrets(secrets) {
  const out = {};
  for (const [k, v] of Object.entries(secrets || {})) {
    const val = typeof v === "string" ? v : v.value;
    out[k] = { ...((typeof v === "object" && v) || {}), value: val ? "••••" + String(val).slice(-3) : "", hasValue: Boolean(val) };
  }
  return out;
}

function now() { return new Date().toISOString(); }

function slugify(s) {
  return String(s || "app")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "app";
}

function guessTitleFromHtml(html) {
  const m = String(html || "").match(/<title>([^<]+)<\/title>/i);
  return m ? m[1] : null;
}

function publicUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

async function getStripe() {
  const { default: Stripe } = await import("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function checkoutTopup(req, res, topupId) {
  const pack = plansConfig.topups.find((t) => t.id === topupId);
  if (!pack) return res.status(400).json({ error: "Pacchetto non valido." });
  if (!process.env.STRIPE_SECRET_KEY) {
    req.user.creditsTopup = (req.user.creditsTopup || 0) + pack.credits;
    upsertUser(req.user);
    return res.json({
      demo: true,
      activated: true,
      message: `Modalità demo pagamenti: aggiunti ${pack.credits} crediti (non scadono). Per addebiti reali imposta STRIPE_SECRET_KEY.`,
      user: publicUser(req.user),
    });
  }
  try {
    const stripe = await getStripe();
    const origin = publicUrl(req);
    const line = pack.stripePriceId
      ? { price: pack.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: plansConfig.currency || "usd",
            product_data: { name: `IoXte ricarica ${pack.credits} crediti` },
            unit_amount: Math.round(pack.price * 100),
          },
          quantity: 1,
        };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [line],
      success_url: `${origin}/#/account?topup=success`,
      cancel_url: `${origin}/#/account?topup=cancel`,
      customer_email: req.user.email,
      metadata: { userId: req.user.id, topupId: pack.id, kind: "topup", credits: String(pack.credits) },
    });
    res.json({ url: session.url, demo: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}



async function generateForUser({ user, prompt, currentHtml, jobType, cost }) {
  maybeRefill(user);
  const events = [];
  const result = await runGeneration({
    prompt,
    currentHtml: currentHtml || "",
    jobType: jobType || "fullstack",
    planMode: false,
    onEvent: (ev) => events.push(ev),
  });
  spendCredits(user, cost, { reason: currentHtml ? "iterazione-whatsapp" : "generazione-whatsapp", prompt: String(prompt).slice(0, 180) });
  upsertUser(user);
  return {
    html: result.html,
    demo: result.demo,
    title: guessTitleFromHtml(result.html),
    tests: result.tests,
  };
}

function createProjectForUser(user, title) {
  const p = {
    id: crypto.randomBytes(6).toString("hex"),
    userId: user.id,
    title: String(title || "Nuovo progetto").slice(0, 80),
    jobType: "fullstack",
    html: "",
    messages: [],
    secrets: {},
    db: { collections: { items: [] } },
    logs: [{ at: now(), msg: "Creato da Nia su WhatsApp" }],
    createdAt: now(),
    updatedAt: now(),
  };
  const all = store.allProjects();
  all.push(p);
  store.saveProjects(all);
  return p;
}

function publishForUser(user, projectId, tierId) {
  const limits = planLimits(user);
  if (!limits.canPublish) return { error: "La pubblicazione è disponibile dal piano Standard." };
  const project = store.allProjects().find((p) => p.id === projectId && p.userId === user.id);
  if (!project?.html) return { error: "Progetto o codice mancante." };
  const tier = plansConfig.publishingTiers.find((t) => t.id === (tierId || "starter")) || plansConfig.publishingTiers[0];
  if (project.published?.slug) {
    store.writePublishedFiles(project.published.slug, project.html, project.published);
    project.published.republishedAt = now();
    saveProject(project);
    return { url: `/p/${project.published.slug}`, republish: true };
  }
  if (creditBalance(user) < tier.creditsPerMonth) return { error: `Servono ${tier.creditsPerMonth} crediti per la fascia ${tier.name}.` };
  spendCredits(user, tier.creditsPerMonth, { reason: "pubblicazione", tier: tier.id });
  upsertUser(user);
  const slug = slugify(project.title) + "-" + project.id.slice(0, 4);
  const rec = { slug, projectId: project.id, userId: user.id, title: project.title, tier: tier.id, publishedAt: now(), visits: 0, live: true };
  store.writePublishedFiles(slug, project.html, rec);
  project.published = rec;
  saveProject(project);
  const idx = store.allPublished().filter((x) => x.slug !== slug);
  idx.push(rec);
  store.savePublished(idx);
  return { url: `/p/${slug}`, published: rec };
}

function shutdownForUser(user, projectId) {
  const project = store.allProjects().find((p) => p.id === projectId && p.userId === user.id);
  if (!project?.published?.slug) return { error: "Nessuna pubblicazione da spegnere." };
  project.published.shutdownAt = now();
  project.published.live = false;
  saveProject(project);
  return { ok: true };
}



async function resolvePreferredModel() {
  const provider = detectProvider();
  if (!provider || provider.id !== "xai" || !provider.keyOk) return;
  const ids = await listXaiModels(provider.key);
  const picked = preferCodingModel(ids);
  if (picked) {
    resolvedModel = picked;
    process.env.XAI_MODEL = picked;
    console.log("Modello xAI selezionato:", picked, "tra", ids.length, "modelli");
  }
}


function loadOrCreateSessionSecret() {
  const env = process.env.SESSION_SECRET;
  if (env && env !== "ioxte-dev-secret" && env !== "cambia-questo-segreto") return env;
  const f = path.join(ROOT, "data", "session-secret.txt");
  try {
    if (fs.existsSync(f)) {
      const s = fs.readFileSync(f, "utf8").trim();
      if (s) return s;
    }
  } catch {}
  const s = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored).split(":");
    if (!saltHex || !hashHex) return false;
    const check = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 32);
    const expected = Buffer.from(hashHex, "hex");
    if (check.length !== expected.length) return false;
    return crypto.timingSafeEqual(check, expected);
  } catch {
    return false;
  }
}

function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).split(",")[0].trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (req.ip || req.socket?.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

const rateBuckets = new Map();
const RATE_RULES = [
  { match: (req) => req.method === "POST" && req.path === "/api/generate", max: 6, windowMs: 15 * 60 * 1000, name: "generate" },
  { match: (req) => req.method === "POST" && req.path === "/api/auth/login", max: 10, windowMs: 15 * 60 * 1000, name: "login" },
  { match: (req) => req.method === "POST" && req.path === "/api/auth/signup", max: 8, windowMs: 15 * 60 * 1000, name: "signup" },
  { match: (req) => req.method === "POST" && req.path === "/api/whatsapp/simulate", max: 8, windowMs: 15 * 60 * 1000, name: "simulate" },
  { match: (req) => req.method === "POST" && req.path === "/api/contact-sales", max: 8, windowMs: 60 * 60 * 1000, name: "contact" },
];

function enforceRateLimits(req, res, next) {
  const rule = RATE_RULES.find((r) => r.match(req));
  if (!rule) return next();
  const now = Date.now();
  const key = `${rule.name}:${clientIp(req)}`;
  const bucket = rateBuckets.get(key) || [];
  const fresh = bucket.filter((ts) => now - ts < rule.windowMs);
  if (fresh.length >= rule.max) {
    const retry = Math.ceil((rule.windowMs - (now - fresh[0])) / 1000);
    res.setHeader("Retry-After", String(Math.max(retry, 1)));
    return res.status(429).json({
      error: "Troppe richieste da questo indirizzo. Riprova tra poco. (Limite anti-abuso sulla generazione e sull'accesso.)",
    });
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[0] > 60 * 60 * 1000) rateBuckets.delete(k);
    }
  }
  next();
}


process.on("SIGTERM", () => server.close());
