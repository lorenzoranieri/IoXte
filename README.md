# IoXte

Generatore di app con l’AI: descrivi un’idea in italiano, un agente costruisce un’app web (un file HTML/CSS/JS), la vedi in anteprima, la iteri in chat, la scarichi e — con un piano adatto — la pubblichi.

Prototipo ispirato al flusso di prodotti come Emergent (landing con composer, workspace chat + anteprima, piani a crediti), con identità, testi e colori originali. Inventario e checklist: [`EMERGENT_FEATURES.md`](./EMERGENT_FEATURES.md). Listino modificabile: [`config/plans.json`](./config/plans.json).

## Requisiti

- Node.js 18 o superiore

## Avvio in locale

```bash
cd ioxte
cp .env.example .env   # opzionale, poi inserisci le chiavi
npm install
npm start
```

Il server ascolta su `http://localhost:3055` (o sulla `PORT` che imposti).

Senza chiavi LLM parte in **modalità demo**: l’interfaccia è completa e genera app di esempio etichettate. Per la generazione reale, nel `.env` (o nell’ambiente) metti **una** di queste chiavi, in ordine di priorità:

- `XAI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Modelli di default: `grok-4-fast`, `gpt-4o`, `claude-sonnet-4-5` (sovrascrivibili con `XAI_MODEL`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`).

### Pagamenti (Stripe)

Imposta `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY`. Il checkout crea i prezzi al volo da `config/plans.json` (non servono Price ID, ma puoi aggiungerli). Imposta anche `PUBLIC_URL` con l’URL pubblico per i redirect.

Senza Stripe, abbonamenti e ricariche si attivano in **modalità demo pagamenti** (nessuna carta viene addebitata) e un messaggio lo dice chiaramente.

### GitHub

`GITHUB_TOKEN` abilita «Salva su GitHub» (Gist privato). Senza token, il pulsante risponde che la chiave manca.

## Deploy su Render

Il server ascolta su `0.0.0.0` e sulla porta `process.env.PORT` (Render la imposta automaticamente; in locale il default è 3055).

1. Carica questo repository (o la cartella `ioxte`) su GitHub.
2. Su [Render](https://render.com) crea un Web Service dal file `render.yaml` (piano *free*), oppure:
   - Runtime: Node
   - Build: `npm install`
   - Start: `npm start`
   - Health check: `/api/health`
3. Nelle Environment Variables aggiungi almeno `SESSION_SECRET` (casuale), `PUBLIC_URL` (l’URL `https://….onrender.com` del servizio), `XAI_API_KEY` (o un’altra chiave LLM) e, in produzione, `OWNER_PASSWORD` (più `OWNER_EMAIL` se non usi il default) per creare l’account titolare al primo avvio. Opzionali: Stripe e WhatsApp.
4. Dopo il primo deploy apri l’URL del servizio e accedi con l’email del titolare.

Il Blueprint `render.yaml` è già pronto: *New → Blueprint* e seleziona il repo.

**Limiti del piano free:** il disco è effimero (utenti, progetti e pubblicazioni salvati in `data/` si perdono quando l’istanza viene ricreata o spegnendosi a lungo) e il servizio va in sleep dopo un periodo di inattività (il primo accesso successivo può richiedere un avvio a freddo di circa un minuto). Per persistenza reale serve un disco a pagamento o un database.

## Piani e prezzi

La struttura dei pacchetti (Free, Standard, Pro, Business, Enterprise, ricariche, fasce di pubblicazione) è allineata al listino pubblico di Emergent, usato solo come punto di partenza. **Modifica `config/plans.json` per decidere i tuoi importi.** Le fonti e i valori rilevati l’11 novembre 2026 sono in `EMERGENT_FEATURES.md`.

## Nia su WhatsApp (equivalente Wingman)

Nia è l’assistente IoXte su WhatsApp: si collega all’account con un codice, vede crediti e progetti, può costruire o modificare un’app, chiede conferma prima di pubblicare e consegna i promemoria sul telefono.

Senza chiavi Meta è in **modalità demo**. Prova:

```bash
# 1. accedi e ottieni un token
TOKEN=$(curl -s http://localhost:3055/api/auth/login -H 'Content-Type: application/json'   -d '{"name":"Lorenzo Ranieri","email":"lorenzo@ioxte.local"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# 2. genera un codice di collegamento
curl -s http://localhost:3055/api/whatsapp/link -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'

# 3. simula l’invio del codice (e poi altri messaggi) da un numero
curl -s http://localhost:3055/api/whatsapp/simulate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"from":"393331112233","text":"CODICE"}'
curl -s http://localhost:3055/api/whatsapp/simulate -H 'Content-Type: application/json'   -d '{"from":"393331112233","text":"saldo"}'
```

Per andare in produzione (Cloud API Meta) vedi la sezione *Cosa serve per andare live su WhatsApp* in `EMERGENT_FEATURES.md`. In breve: WABA, token di System User, `WHATSAPP_PHONE_ID`, webhook HTTPS su `/api/whatsapp/webhook`, verify token, e template approvati per i messaggi fuori dalla finestra 24 ore.

## API utili

- `GET /api/health` — modo demo/live, provider, Stripe, GitHub
- `GET /api/config` — piani pubblici e flag
- `POST /api/auth/login` — sessione (nome + email)
- `POST /api/generate` — generazione in streaming (SSE)
- `POST /api/checkout` e `POST /api/checkout/topup` — abbonamenti e ricariche
- `POST /api/publish` — pubblica su `/p/:slug`
- `GET/POST /api/whatsapp/webhook` — webhook Meta
- `POST /api/whatsapp/link` — codice di accoppiamento
- `POST /api/whatsapp/simulate` — prova Nia senza Meta
- `GET /api/nia` — memoria, attività, stato canale

## Struttura

```
config/plans.json     listino modificabile
lib/demos.js          app di esempio per la demo
lib/llm.js            proxy LLM + streaming
lib/store.js          persistenza JSON in data/
public/               interfaccia (italiano, tema scuro)
server.js             backend Express
render.yaml           Blueprint Render
```

I dati di lavoro (utenti, progetti, pubblicazioni) stanno in `data/`, esclusa da git.

## Licenza di questo prototipo

Uso interno / di valutazione per Lorenzo Ranieri. Il codice delle app generate appartiene a chi le crea.
