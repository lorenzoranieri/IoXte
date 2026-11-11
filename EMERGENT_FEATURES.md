# Inventario funzionalità Emergent → mappa IoXte

Documento di studio e checklist. Ricerca effettuata l’11 novembre 2026 (Europe/Rome) sulle fonti pubbliche di Emergent. IoXte **non** copia logo, marchi o testi letterali di Emergent: stessi flussi e stessa struttura di prodotto, con nome, voce e identità proprie.

## Fonti

| Fonte | URL | Uso |
|---|---|---|
| Sito marketing | https://emergent.sh/ | Landing, claim, passi, FAQ di marketing |
| Listino prezzi | https://emergent.sh/pricing | Piani Free / Standard / Pro, sconto annuale, tab Enterprise |
| Help: piani e free tier | https://help.emergent.sh/plans-the-free-tier | Cosa è incluso/escluso per piano |
| Help: crediti | https://help.emergent.sh/managing-credit-usage e https://emergent.sh/docs/how-credits-work-basics | Consumo, ricariche, scadenza, budget di sessione |
| Help: tour workspace | https://help.emergent.sh/a-tour-of-the-workspace | Chat, anteprima, segreti, GitHub, Publish, allegati |
| Help: primo build | https://help.emergent.sh/watch-your-app-come-alive | Build/Plan, step agente, checkpoint, anteprima |
| Help: pubblicazione | https://help.emergent.sh/put-your-app-live, https://help.emergent.sh/deploying-web, https://help.emergent.sh/the-chat-to-deployment-flow | Preview vs production, Publish / Re-publish / Replace, URL `.emergent.host` |
| Help: fasce hosting | https://help.emergent.sh/deployment-plan-levels | Starter 50 / Launch 125 / Grow 225 / Scale 450 / Elite 1100 crediti/mese |
| Help: FAQ completa | https://help.emergent.sh/faqs | Stack, auth, export, mobile, DB, legal, crediti, job type |
| Help: integrazioni | https://help.emergent.sh/key-integrations-catalogue | LLM, pagamenti, email, auth, storage |
| Help: partenza idea | https://help.emergent.sh/start-with-your-idea | Tipi job, anatomia del prompt, esempi |
| Help: SEO | https://help.emergent.sh/get-found-on-google | Toggle Enable SEO in pubblicazione |
| Blog / changelog | https://emergent.sh/blog | Visual Edits (16 set 2026), E3 (8 giu 2026), Emmy, MCP, MongoDB Atlas, modelli |
| News Pro / Claude | https://emergent.sh/news/emergent-joins-the-claude-startups-program | Dettaglio Pro a ottobre 2026 |
| Recensioni | https://www.producthunt.com/products/emergent-2/reviews | Percezione: build fullstack, test, publish; criticità supporto/dati |
| Secondaria prezzi | https://www.greta.sh/blog/greta-vs-emergent-best-ai-app-builder-for-startups (verifica 5 nov 2026) | Business custom; extra mobile +10 / +25 crediti |
| Help: che cos'è Wingman | https://help.emergent.sh/what-is-wingman | Assistente standalone, distinto dal builder; memoria, chiamate, sync |
| Help: integrazioni e task Wingman | https://help.emergent.sh/integrations-scheduled-tasks | 300+ app, approval, task schedulati, canali WhatsApp/Telegram, crediti |
| Help: MCP Wingman | https://help.emergent.sh/custom-mcp-integrations | Connettori MCP e stesso flusso di permessi |
| News lancio Wingman | https://emergent.sh/news/emergent-launches-wingman-autonomous-ai-agent | WhatsApp/Telegram/iMessage, più agenti, conferme sulle azioni importanti |
| Guida assistenti 2026 | https://emergent.sh/learn/ai-personal-assistant-for-business | Piani Wingman distinti dal builder; canali di messaggistica |
| getwingman.com | https://getwingman.com/ | Prodotto web standalone |

## Listino Emergent (da riportare al titolare per decidere i prezzi IoXte)

Valori copiati come **punto di partenza** in `config/plans.json` (modificabile). Verificati il 2026-11-11.

### Piani di abbonamento (Individual)

| Piano | Mensile | Annuale (al mese) | Risparmio annuale | Crediti | Note |
|---|---:|---:|---:|---:|---|
| Free | $0 | — | — | 10 | Pricing page: «10 free monthly credits». Help: «10 credits on your first day». Niente publish production né domini custom (la help accenna a un’eventuale pubblicazione frontend-only gratuita). |
| Standard | $20 | $17 | $36 | 100 | App web e mobile, hosting privato, publish, domini custom, GitHub, fork. |
| Pro | $200 | $167 | $396 | 750 | Contesto 1M, Ultra thinking / Maxx, system prompt, agenti custom, prestazioni 2×, supporto prioritario. |

### Piani custom (tab Enterprise / Business)

| Piano | Prezzo | Contenuti dichiarati |
|---|---|---|
| Business | Custom | Tutto Pro + RBAC, SSO, workspace condivisi / co-editing |
| Enterprise | Custom | Limiti crediti per utente, audit log, DB self-hosted, deploy in VPC, gruppi utente, report crediti e analytics, SLA |

### Ricariche crediti (top-up)

- Documentati gli estremi: **250 crediti a $50** fino a **10.000+ crediti a $2.000** (https://help.emergent.sh/managing-credit-usage).
- Rapporto risultante: **$0,20 / credito**.
- I crediti di abbonamento **non si accumulano**; le ricariche **non scadono**; i promo hanno scadenza visibile. Si consumano prima i crediti in scadenza.
- Processori: Stripe, Razorpay (India), PagBrasil (Brasile), Paddle, RevenueCat.
- Budget per sessione sul task; avviso email sotto il 20% dell’allocazione.

### Fasce di pubblicazione (addebito mensile in crediti, non a ora)

| Fascia | Crediti/mese | CPU | RAM |
|---|---:|---|---|
| Starter | 50 | 0.05 vCPU | 200 MB |
| Launch | 125 | 0.5 vCPU | 2 GB |
| Grow | 225 | 1 vCPU | 4 GB |
| Scale | 450 | 2 vCPU | 8 GB |
| Elite | 1.100 | 4 vCPU | 16 GB |

Re-publish, replace e rollback delle pubblicazioni sono gratuiti. Minimo 50 crediti per andare live. Extra mobile (fonte secondaria Greta, 5 nov 2026): +10 crediti/mese (10 build store), +25 per build illimitate.

## Flusso UX da rispecchiare

1. **Landing / home**: composer grande, tipi di lavoro (Fullstack, Mobile, Landing, Brainstorm), interruttore Build / Plan, esempi di prompt, invio idea.
2. **Workspace**: chat agente a sinistra con avanzamento passo-passo (Pianificazione, Struttura, Implementazione, Test); a destra anteprima live e schede Codice / file; elenco progetti; pulsanti Pubblica / Scarica / GitHub.
3. **Iterazione**: messaggi tipo «rendi il pulsante rosso», allegati, modifiche visive, checkpoint e rollback.
4. **Pubblicazione**: distinta da anteprima; URL stabile; eventuale dominio custom; storico versioni.
5. **Account / prezzi**: piano, crediti, ricariche, utilizzo.

## Checklist funzionalità (ogni voce ha un corrispettivo IoXte)

Legenda stato:

- **OK** — funzionante in questo prototipo
- **KEY** — interfaccia e API collegate, in attesa di chiavi/env o di un provider esterno
- **SIM** — comportamento fedelmente simulato nel prototipo (es. single-file HTML al posto di un monorepo React/Python/Mongo)

### A. Acquisizione e landing

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| A1 | Sito marketing con hero e CTA | Landing italiana originale, wordmark IoXte | OK |
| A2 | Composer grande per descrivere l’idea | Textarea centrale con invio | OK |
| A3 | Prompt di esempio cliccabili | Chip originali in italiano (tracker, spese, landing, ricette…) | OK |
| A4 | Tipi job: Fullstack / Mobile / Landing / Brainstorm | Selettore «App completa / Mobile / Landing / Brainstorm» | OK |
| A5 | Interruttore Build / Plan (⌥P) | «Costruisci / Pianifica» | OK |
| A6 | Testimonianze, metriche, 3 passi, FAQ | Sezioni originali in italiano (numeri non copiati da Emergent) | OK |
| A7 | Registrazione / accesso | Accesso email + nome, sessione persistente (utente predefinito: Lorenzo Ranieri) | OK |
| A8 | Prompt in più lingue | Accettati; UI piattaforma in italiano | OK |

### B. Workspace e chat agente

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| B1 | Chat persistente con storico | Salvata su `localStorage` e `data/projects.json` | OK |
| B2 | Stream passi agente (planning, scaffolding, implementation, testing) | Passi in italiano in tempo reale (SSE) | OK |
| B3 | Domande di chiarimento / card piano da approvare | Modalità Pianifica: card «Richiedi modifiche» / «Va bene, costruiamo» | OK |
| B4 | Riepilogo a fine build e invito a provare l’anteprima | Messaggio agente + refresh iframe | OK |
| B5 | Anteprima interattiva in iframe, auto-refresh | `iframe` sandboxed con `srcdoc` | OK |
| B6 | Apri anteprima in nuova scheda | Pulsante dedicato (`/preview/:id` o blob) | OK |
| B7 | Schede Codice / albero file / vista editor | Tab Codice + albero virtuale del file singolo (e asset logici) | SIM |
| B8 | Copia codice e modifica manuale | Copia, editor, ri-applicazione all’anteprima | OK |
| B9 | Terminale | Tab Terminale con log di build/test del job | SIM |
| B10 | Log applicazione | Tab Log (generazione, publish, errori) | OK |
| B11 | Database Manager (Mongo, edit live, no undo) | Tab Database: store JSON per progetto, modificabile | SIM |
| B12 | Segreti / variabili d’ambiente (criptati, preview ≠ production) | Tab Segreti, valori mascherati, file su server (non in git) | OK |
| B13 | Allegati in chat (immagini, CSV, PDF, testo) | Icona allegato + drag-and-drop; testo/CSV inoltrati all’agente; immagini come nota o, con chiave vision, analizzate | OK / KEY |
| B14 | Checkpoint automatici e rollback dalla timeline | Snapshot codice + ripristino (cancella messaggi successivi, opzionale) | OK |
| B15 | Elenco progetti / job, riapertura | Sidebar progetti, nuovo, elimina, rinomina | OK |
| B16 | Fork del lavoro | Duplica progetto (Standard+) | OK |
| B17 | Feedback widget | Pannello «Invia feedback» (salvato in `data/feedback.json`; email se SMTP) | OK / KEY |
| B18 | Assistente in-app (Emmy) | «Nia», assistente IoXte con FAQ locale e, se c’è chiave LLM, risposte vere | OK / KEY |

### C. Generazione codice e agenti

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| C1 | Generazione da linguaggio naturale | Proxy LLM server-side, streaming SSE | OK / KEY |
| C2 | Iterazione conversazionale («rendi il pulsante rosso») | Stesso endpoint con storico e HTML corrente | OK |
| C3 | Modalità demo se manca la chiave | Demo etichettata, app di esempio contestuali, report «serve una chiave» | OK |
| C4 | Livelli agente E1 / E2 / E3 | Selettore I1 Base / I2 Squadra / I3 Autonomo (nomi propri, non marchio Emergent) | SIM |
| C5 | Selettore modello (GPT, Claude, Gemini, …) | Selettore; il backend usa la chiave disponibile (xAI / OpenAI / Anthropic) | OK / KEY |
| C6 | Maxx / Ultra thinking (Pro, più crediti) | «Modalità Intensiva», moltiplicatore crediti, solo piano Pro | OK |
| C7 | System prompt edit (Pro) | Impostazioni progetto, campo prompt, gated Pro | OK |
| C8 | Agenti custom (Pro) | Catalogo agenti utente, prompt e strumento, gated Pro | SIM |
| C9 | Contesto 1M (Pro) | Flag piano; il provider reale dipende dalla chiave | KEY |
| C10 | Test automatici (unit, integration, smoke, visivi, agentic E3) | Step «Test» + report in tab Test; in demo, check statici sull’HTML | SIM |
| C11 | Stack React / Next / Tailwind / shadcn + FastAPI + Mongo | Il prototipo genera **un’unica app HTML/CSS/JS** (requisito del brief); l’albero file è virtuale | SIM |
| C12 | App mobile Expo / React Native, web↔mobile | Tipo job Mobile: anteprima in cornice telefono; export «progetto Expo» zippato come scheletro; store in attesa di account Apple/Google | SIM / KEY |
| C13 | Generazione media AI | Pulsante «Genera immagine»; in attesa di chiave (xAI/OpenAI); placeholder in demo | KEY |
| C14 | Universal LLM Key per le app generate | Segreto speciale `IOXTE_LLM_KEY` iniettato a runtime se presente; altrimenti BYO key | KEY |
| C15 | Import codebase / GitHub all’avvio job | Dialog «Importa» (URL pubblico o incolla); OAuth GitHub in attesa di `GITHUB_TOKEN` | OK / KEY |

### D. Anteprima, modifiche visive, download

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| D1 | Visual Edits: click sull’anteprima, elenco modifiche, invio all’agente | Modalità «Modifica visiva» con highlight e coda di cambiamenti | OK |
| D2 | Device frame / viewport (desktop, tablet, mobile) | Selettore viewport sull’anteprima | OK |
| D3 | Download / export codice | Download `.html` (e ZIP con README). Emergent non ha un bottone archive ufficiale: IoXte lo offre comunque, come da brief. | OK |
| D4 | Copia negli appunti | Pulsante Copia | OK |
| D5 | Proprietà del codice all’utente | Dichiarato in termini/FAQ e README | OK |

### E. Pubblicazione e hosting

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| E1 | Publish primo rilascio → URL stabile | `GET /p/:slug` sullo stesso server, gated Standard+ | OK |
| E2 | Re-publish a zero downtime, stesso URL, senza nuovo fee di fascia | Pulsante Ripubblica, aggiorna i file, non riaddebita la fascia | OK |
| E3 | Replace (job/fork diverso, scelta DB) | Dialog Sostituisci: scegli progetto e se mantenere i dati | SIM |
| E4 | Preview ≠ production (segreti e DB separati) | Store preview e production distinti | OK |
| E5 | Fasce Starter…Elite, addebito crediti mensile | Scelta fascia in «Gestisci pubblicazione», consumo crediti | OK |
| E6 | Spegnimento: il billing della fascia si interrompe | Pulsante Spegni pubblicazione | OK |
| E7 | Dominio custom + SSL + DNS | Form dominio e istruzioni DNS; TLS/DNS reali in attesa di infrastruttura | KEY |
| E8 | Toggle SEO | Flag sul published app e meta prerender semplificato | SIM |
| E9 | Storico pubblicazioni e rollback (fino a 3 immagini) | Elenco versioni, ripristina | OK |
| E10 | Health check / CDN | Health su `/p/:slug` e `/api/health`; CDN in attesa di deploy (Render) | OK / KEY |
| E11 | Publish mobile su App Store / Play via EAS | Wizard store + istruzioni; build EAS in attesa di credenziali | KEY |
| E12 | Bundle ID / package name bloccati dopo il primo build | Salvati sul progetto e non più editabili | SIM |

### F. Integrazioni e autenticazione delle app generate

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| F1 | Pannello integrazioni | Gestisci → Integrazioni, catalogo | OK |
| F2 | Stripe / PayPal / Shopify / Razorpay / Paystack | Schede + campi segreto; codice di integrazione generato se l’utente lo chiede; checkout vero in attesa delle chiavi del cliente | KEY |
| F3 | SendGrid / Twilio / Resend | Come sopra | KEY |
| F4 | Auth integrata (email/password, Google, OTP) e Auth0/Clerk/Firebase | «IoXte Auth» di prototipo (localStorage) + hook per Clerk/Auth0 se ci sono chiavi | SIM / KEY |
| F5 | Storage file/media integrato | Upload su `data/storage/:projectId` | OK |
| F6 | Google Maps / altre API | Voce catalogo + segreto `GOOGLE_MAPS_API_KEY` | KEY |
| F7 | MCP connector (Claude / ChatGPT) | Endpoint `/api/mcp` descritto, in attesa di autenticazione MCP | KEY |

### G. GitHub e collaborazione

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| G1 | Salva su GitHub (Standard+), niente pull mid-job | API + UI; crea Gist o repo se `GITHUB_TOKEN` è presente | KEY |
| G2 | Invito collaboratori, permessi | UI invita per email, ruoli viewer/editor; invio email in attesa di SMTP | KEY |
| G3 | Co-editing in tempo reale (Business) | Presenza e lock semplici sul progetto (stesso browser / storage); sync realtime in attesa di infra | SIM / KEY |
| G4 | RBAC, SSO, audit log, gruppi (Business/Enterprise) | Pagine e API stub, gated piano; SSO in attesa di IdP | KEY |

### H. Piani, crediti, pagamenti

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| H1 | Pagina prezzi con piani e toggle mensile/annuale | `/#/prezzi`, importi da `config/plans.json` | OK |
| H2 | Assegnazione piano all’utente | Campo `plan` sul profilo, upgrade immediato dopo checkout (o demo) | OK |
| H3 | Assegnazione crediti mensili e reset ciclo | Allotment da piano, refill alla data di rinnovo, niente rollover dei crediti subscription | OK |
| H4 | Consumo crediti per generazione / test / publish | Addebito da `creditCosts` e fasce; storico utilizzo | OK |
| H5 | Moltiplicatori Maxx e agente superiore | Applicati al costo del job | OK |
| H6 | Top-up crediti, non scadono | Pacchetti da config, checkout Stripe o attivazione demo | OK / KEY |
| H7 | Checkout Stripe abbonamenti | `price_data` da config se `STRIPE_SECRET_KEY`; webhook; altrimenti modalità demo etichettata | KEY (demo OK) |
| H8 | Altri processori (Razorpay, PagBrasil, Paddle, RevenueCat) | Hook in config e API «provider non configurato» | KEY |
| H9 | Budget per sessione / tetto spesa | Campo nel composer, pausa automatica | OK |
| H10 | Dashboard utilizzo e avviso sotto 20% | Pagina Account; banner in-app (email in attesa di SMTP) | OK / KEY |
| H11 | Upgrade / downgrade / disdetta | Flusso account; Stripe portal se chiave presente, altrimenti locale | OK / KEY |
| H12 | Piano Business/Enterprise «contattaci» | CTA, form contatto salvato in `data/leads.json` | OK |

### I. Dati, sicurezza, account, compliance

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| I1 | Isolamento dati per app | Cartelle per progetto e published slug | OK |
| I2 | DPA / GDPR / export / cancellazione | Pagine informative + elimina account/progetto (zona pericolosa) | SIM |
| I3 | Hosting EU-only | Non self-serve; nota «contatta» come da Emergent | KEY |
| I4 | Impostazioni account, pericoloso elimina | Pagina Account | OK |
| I5 | Status / trust centre | `/api/health` e pagina Stato | SIM |

### J. Funzioni di piattaforma extra viste su blog/FAQ

| # | Funzionalità Emergent | IoXte | Stato |
|---|---|---|---|
| J1 | Analytics app pubblicata | Contatore visite su `/p/:slug` e tab Analytics | OK |
| J2 | Job schedulati / cron | UI «Attività pianificate»; esecuzione in-process; su Render usare un cron (documentato) | SIM / KEY |
| J3 | Migrazione MongoDB Atlas del cliente (Pro) | Wizard istruzioni + campi `MONGO_URL` / `DB_NAME` | KEY |
| J4 | Deploy nel cloud del cliente (VPC, Enterprise) | Pagina richiesta, in attesa di accordo e chiavi cloud | KEY |
| J5 | i18n nelle app generate | Richiedibile in chat; l’agente (o la demo) può aggiungere uno switcher lingua | OK |
| J6 | Community Discord, email support, live chat | Link e widget Nia; inbox in attesa di canale reale | KEY |

## Limiti consapevoli del prototipo

- L’agente produce **un’app web in un solo file HTML/CSS/JS**, non un monorepo React + FastAPI + MongoDB in Kubernetes. L’UX (chat, passi, anteprima, publish, crediti) è allineata a Emergent; la profondità dello stack no.
- Senza `OPENAI_API_KEY` / `XAI_API_KEY` / `ANTHROPIC_API_KEY` la generazione è in **modalità demo**.
- Senza `STRIPE_SECRET_KEY` i pagamenti si attivano in locale con etichetta chiara (nessuna carta viene caricata).
- Pubblicazione = hosting sullo stesso processo Node (`/p/:slug`), non una flotta autoscaling. Adatto a una demo, non a traffico di produzione reale.
- GitHub, EAS, SSO, VPC, processori di pagamento diversi da Stripe e invio email restano **collegati in attesa di chiavi**.

## Come aggiornare questo inventario

Nuova funzione vista su Emergent: aggiungi una riga nella tabella giusta, implementa almeno UI + API (OK o KEY), aggiorna lo stato.


## Wingman (WhatsApp e altri canali) — studio e mappa IoXte

Ricerche del 11 novembre 2026. Il messaggio dell’utente («wingman_3») è stato interpretato come il prodotto **Wingman** di Emergent (assistente sui canali di messaggistica, inclusa la terza linea di canale dopo web/app: WhatsApp). Non è un marchio da copiare: in IoXte l’equivalente si chiama **Nia**.

### Cos’è (e cosa non è)

Fonti: https://help.emergent.sh/what-is-wingman

Wingman è l’assistente personale **standalone** di Emergent, **distinto** dalla piattaforma che costruisce le app.

| | App builder Emergent | Wingman |
|---|---|---|
| Scopo | Costruire, testare e pubblicare app in chat | Assistente personale per compiti quotidiani |
| Memoria | Contesto del workspace/progetto | Memoria persistente tra conversazioni e dispositivi |
| Accesso | Workspace su Emergent | Web (getwingman.com), iOS, Android, WhatsApp, Telegram, iMessage |
| Output | App web/mobile pubblicate | Risposte, azioni, attività pianificate |

La documentazione ufficiale è esplicita: *«Wingman is not the AI that builds your apps inside Emergent»*.

Nella pratica, però, l’account è lo stesso ecosistema (si entra con le credenziali Emergent da `app.emergent.sh/wingman` o getwingman.com) e i crediti di Wingman sono **un listino separato** da quello del builder (fonte: https://emergent.sh/learn/ai-personal-assistant-for-business, 15 luglio 2026):

| Piano Wingman | Prezzo | Crediti |
|---|---:|---:|
| Starter | $0 | 10 |
| Growth | $20 / mese | 100 |
| Pro | $50 / mese | 275 |

(sconto sul primo mese delle fasce a pagamento, secondo la stessa pagina). In IoXte, per semplicità del prototipo, Nia **condivide i crediti e il piano dell’account IoXte** e si collega agli stessi progetti: è una scelta di prodotto da rivedere se si vorrà un listino assistente separato.

### Canali e collegamento dell’account

- Canali: web, app native, **WhatsApp**, Telegram, iMessage.
- Collegamento: nell’interfaccia Wingman, *Connect* / *Setup → Channels → WhatsApp* (o Telegram / iMessage). Compare un **codice (o link) di accoppiamento**; si apre la chat del bot e si invia il codice. Stesso schema visto nelle guide di collegamento (es. walkthrough Telegram/WhatsApp: si copia un codice e lo si incolla nella chat).
- **Scollegare un canale non elimina** il Wingman. Eliminarlo (Setup → Settings → Delete Wingman) cancella conversazioni, integrazioni, canali e automazioni in modo permanente.
- Memoria e cronologia restano legate all’account e si sincronizzano tra i canali in cui si è collegati.
- La memoria non è usata per addestrare i modelli del builder; si può cancellare dalle impostazioni.

### Come si parla (non è un menu di comandi fissi)

L’interazione è in **linguaggio naturale**. Non risulta un elenco ufficiale tipo `/start`, `/publish`. Si danno incarichi in chiaro («mandami ogni mattina il riassunto della posta», «metti in pausa il promemoria del lunedì»).

Azioni tipiche documentate o mostrate nel lancio:

- Delega quotidiana: calendario, posta, to-do, briefing pre-riunione, follow-up.
- Ricerca web, analisi file (immagini, PDF; fogli via esecuzione codice), esecuzione codice, memoria — anche senza integrazioni.
- Integrazioni OAuth (infrastruttura Composio): 300+ servizi (Gmail, Calendar, Sheets, Drive, Slack, Notion, LinkedIn, GitHub, CRM, ecc.). Ogni Wingman ha connessioni proprie.
- Azioni di sola lettura: automatiche. Azioni che modificano dati esterni: **chiedono approvazione** (una volta oppure «Always Allow»). I prompt di approvazione arrivano **sul canale in uso**, quindi anche in WhatsApp.
- Attività pianificate: ricorrenti o una tantum, fuso orario dell’utente, consegna su web / Telegram / **WhatsApp**. Si creano dalla tab Tasks o in chat. Pausa, ripresa, modifica, elimina. Se i crediti finiscono, il task va in *Paused (No Credits)* e **riparte da solo** dopo una ricarica.
- Più Wingman specializzati (marketing, operations, sales, creator, job hunter, generalista), tono/personalità regolabili.
- Chiamate in uscita con scheda di stato (dialing / in corso / completata).
- MCP custom, oltre al catalogo ufficiale.

### Relazione con progetti del builder

Ufficialmente Wingman **non** è l’agente che scrive il codice nel workspace. Resta un assistente di produttività, con l’ecosistema Emergent a portata (dalla stessa famiglia di prodotto si può passare a costruire un’app). Non è documentato un comando WhatsApp del tipo «pubblica il job X».

In IoXte, su richiesta esplicita («collegata agli account/progetti, stesse funzionalità»), **Nia fa entrambe le cose**: assistente (memoria, attività, conferme) **e** ponte verso i progetti IoXte (saldo, elenco, costruzione, iterazione, pubblicazione con conferma).

### Checklist Nia (equivalente IoXte)

| # | Funzionalità Wingman | IoXte (Nia) | Stato |
|---|---|---|---|
| W1 | Canale WhatsApp (Cloud API) | Webhook `GET/POST /api/whatsapp/webhook`, invio via Graph API | KEY (demo OK) |
| W2 | Token, phone id, verify token in env | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | KEY |
| W3 | Accoppiamento numero ↔ account con codice a tempo | Account → «Collega WhatsApp», codice 15 min, si invia in chat | OK |
| W4 | Scollegare il canale senza cancellare l’assistente | «scollega» (con conferma) o pulsante in Account; Nia resta sul web (`/#/nia`) | OK |
| W5 | Chat in linguaggio naturale + scorciatoie documentate | Interpretazione italiano; menu «aiuto» | OK |
| W6 | Memoria persistente, elenco e cancellazione | «ricorda che…», «cosa ricordi», «dimentica tutto»; pagina Nia | OK |
| W7 | Attività pianificate, consegna su WhatsApp, fuso Europe/Rome | «ricordami ogni giorno alle 9: …»; pausa/riprendi/cancella; tick a 30s | OK |
| W8 | Pausa automatica senza crediti e ripresa dopo ricarica | `Paused (No Credits)` + auto-resume | OK |
| W9 | Approvazione azioni rilevanti (una volta / sempre) | Pulsanti Approva / Annulla / Sempre (o «sì» / «sempre» in testo) su pubblica, spegni, scollega | OK |
| W10 | Ponte a progetti e crediti IoXte | saldo, progetti, apri, costruisci, modifica, pubblica | OK |
| W11 | Risposte libere con LLM | Usa la chiave sul server; in demo spiega i limiti | OK / KEY |
| W12 | Integrazioni 300+ (Gmail, Calendar, …) via OAuth | Catalogo e hook; connessione reale in attesa di OAuth/Composio o chiavi | KEY |
| W13 | Telegram e iMessage | Non in questo prototipo (stesso modello di canale, da replicare) | KEY |
| W14 | Chiamate in uscita | Risposta esplicita: in attesa di WhatsApp Calling o `TWILIO_*` | KEY |
| W15 | Più assistenti specializzati / personalità | Un Nia per account; personalità via system prompt del piano Pro | SIM |
| W16 | Template Meta per messaggi fuori dalla finestra 24h | Documentato per il go-live; i promemoria provano un messaggio libero e possono fallire fuori finestra senza template approvati | KEY |
| W17 | Piani crediti dedicati all’assistente | Non separati: usano i crediti IoXte (`creditCosts.niaMessage`). Si può sdoppiare in `plans.json` | SIM |

### Cosa serve per andare live su WhatsApp

1. Account Meta for Developers e Business Manager verificato, con WhatsApp Business Account (WABA).
2. App Meta con prodotto WhatsApp; numero di test o numero business reale; annotare il **Phone number ID**.
3. Token: in produzione un token permanente di System User (non quello temporaneo di 24 ore).
4. Scegliere un `WHATSAPP_VERIFY_TOKEN` e configurare il webhook `https://<PUBLIC_URL>/api/whatsapp/webhook`, campi sottoscritti: `messages`.
5. Impostare sul server (o su Render): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `PUBLIC_URL` in HTTPS. Opzionale `WHATSAPP_APP_SECRET` per la firma.
6. Display name del business approvato; policy privacy pubblicata (Meta la chiede).
7. App Review Meta se si esce dalla modalità di sviluppo (destinatari oltre i numeri di test).
8. **Message templates** approvati per i messaggi iniziati dall’azienda (promemoria fuori dalla finestra di 24 ore dal messaggio dell’utente). Senza template, i task schedulati possono fallire.
9. (Facoltativo) WhatsApp Calling o Twilio per le chiamate in uscita; OAuth per Gmail/Calendar se si vogliono le integrazioni complete.

Finché le chiavi mancano, Nia è provabile con `POST /api/whatsapp/simulate`.

