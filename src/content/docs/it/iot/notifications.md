---
title: "Notifiche degli allarmi"
description: "ntfy, Gotify, Discord, webhook ed e-mail. Premi Riconosci sul telefono e l'allarme risulta riconosciuto, firmato e valido una sola volta."
---

Le notifiche di allarme, da 4.10.0, avvisano un telefono quando un allarme scatta alle 3 di notte. Quando un allarme **scatta**, HotLoop invia una notifica attraverso ogni canale configurato e attivo la cui soglia di priorità l'allarme raggiunge. Attive nel chart Helm da 4.23.6 (`HOTLOOP_NOTIFY_ENABLED`), non inviano nulla finché un canale non è attivato con la sua destinazione: un deployment senza nessuno da avvisare non ha nulla da configurare qui.

## Perché solo "attivato"

`alarm.Engine.OnTransition` scatta a ogni transizione ISA-18.2: attivato, rientrato, riconosciuto, sospeso, ripreso. Questo pacchetto le ascolta tutte, ma agisce solo su una. Avvisare a ogni transizione farebbe vibrare il telefono dell'operatore quando riconosce il proprio allarme, quando rientra da solo o quando qualcuno lo sospende per un turno, abituandolo a scartare gli avvisi senza leggerli, come un allarme che oscilla abitua a ignorare gli allarmi. Attivato è l'unico evento che significa "qualcosa richiede una persona che forse non sta guardando uno schermo", ed è l'intera ragione per cui esiste questo pacchetto.

L'unico altro avviso è un'escalation: l'allarme è stato attivato, nessuno lo ha riconosciuto e la policy dice di avvisare la persona successiva. È lo stesso allarme che ha ancora bisogno di qualcuno, comunicato di nuovo a un'altra persona, non un evento nuovo. Vedi "Escalation".

Un caso sembra una ripresa ed è in realtà un'attivazione. Se la condizione si presenta mentre un allarme è sospeso, nessuno è stato avvisato: quando la sospensione termina (per scadenza o per ripresa manuale) il motore registra la ripresa e poi un'attivazione, e l'attivazione avvisa. Un allarme che era già in allarme quando è stato sospeso e lo è ancora torna non riconosciuto ma non avvisa di nuovo: ha già avvisato la prima volta.

## I canali

Sono sei, e questa è la lista (vedi "Notifiche" nella [roadmap di HotLoop](/it/roadmap/) per ciò che non facciamo e perché). Nessuno richiede un SDK di un fornitore né un account a pagamento, in linea con il piano di questo progetto: le integrazioni cloud sono connessioni in uscita facoltative che configura l'operatore, mai qualcosa di cui questa applicazione abbia bisogno per funzionare.

- **ntfy**: una notifica push sul telefono, con un pulsante **Riconosci** che riconosce l'allarme direttamente in HotLoop. Gratuito, e il server può girare sulla rete dell'impianto senza alcun accesso a internet. Vedi "Configurare ntfy".
- **Gotify**: una notifica push sul telefono. Gratuito, self-hosted, funziona senza internet. Niente pulsanti e nessuna app per iPhone, quindi è un cercapersone, non una comunicazione a due vie. Vedi "Configurare Gotify".
- **Webhook Discord**: un messaggio incorporato in un canale Discord, colorato per priorità, con tag, valore, limite, area e linea. Incolla un URL e funziona. Gli allarmi critici possono menzionare un ruolo. Niente pulsanti. Vedi "Discord".
- **Bot Discord**: lo stesso messaggio, con i pulsanti **Riconosci** e **Sospendi** che agiscono sull'allarme e registrano chi li ha premuti. Le pressioni tornano su una connessione che HotLoop apre verso Discord, quindi l'impianto non ha bisogno di un indirizzo pubblico. Vedi "Discord".

- **Webhook**: un POST del corpo JSON proprio di HotLoop (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, che vale `raised`, oppure `escalated` per un'escalation) verso un URL configurato. Funziona con qualsiasi cosa accetti il JSON che gli invii: un tuo script dietro un piccolo ascoltatore HTTP, Node-RED, n8n o un trigger "qualsiasi webhook" in uno strumento di flussi. (Puntato a un topic ntfy avvisa, con il JSON grezzo come testo; usa invece il canale ntfy qui sopra.) Un riepilogo (vedi "Limiti di frequenza e riepiloghi") ha `event` impostato su `summary` e un elenco `alarms` che nomina ogni allarme incluso. Non funziona con i servizi che vogliono il corpo nella loro forma. Discord risponde 400 perché mancano `content` ed `embeds`. Slack, Teams e Google Chat vogliono un proprio campo di testo. Pushover vuole i campi `token`, `user` e `message`, e l'API Events di PagerDuty vuole un `routing_key`, un `event_action` e un `payload`. Punta il webhook a uno di questi e ogni avviso fallisce. Discord ha canali propri che costruiscono il corpo che Discord si aspetta; usa quelli.
- **E-mail via SMTP**: inviata tramite il relay che l'operatore ha già (un server di posta aziendale, l'endpoint SMTP di un fornitore di e-mail transazionali, un relay self-hosted). Nessuna chiave API, nessuna libreria di fornitore: `net/smtp` e un messaggio in testo semplice costruito a mano. Molti telefoni mostrano già l'e-mail come notifica push, e molti strumenti di reperibilità accettano un indirizzo ponte da e-mail a SMS come "metodo di contatto", quindi questo solo canale copre una parte consistente di "avvisare un telefono" senza alcuna dipendenza a pagamento.

## Dove vanno gli allarmi: Impostazioni

Ogni canale è attivo per impostazione predefinita e inattivo finché non ha dove inviare. Un canale attivo senza destinazione non impedisce mai l'avvio di HotLoop, aspetta e lo dice. Un amministratore dà a ciascuno la sua destinazione in Impostazioni, "Dove vanno gli allarmi e le letture": l'URL del webhook, il relay email e i destinatari, il server e il topic ntfy, il server e il token Gotify, l'URL del webhook Discord, il token e il canale del bot Discord, e il broker e il gruppo Sparkplug del publisher edge. Ognuno mostra cosa sta facendo (invia, aspetta una destinazione, spento) e cosa gli manca.

- I canali di allarme si applicano nel momento in cui l'impostazione viene salvata: il dispatcher viene ricostruito sul posto, ciò che i vecchi canali trattenevano parte per primo, e la connessione del bot Discord viene chiusa prima che se ne apra una nuova. **Invia un test** (`POST /api/notify/test`) raggiunge poi il canale appena salvato.
- Il publisher edge possiede un file di coda e un nodo Sparkplug, quindi la sua destinazione viene letta all'avvio di HotLoop. La schermata dice "Saved, applies when HotLoop restarts".
- Ciò che è salvato lì prevale sul chart o sull'ambiente, che servono solo a inizializzarlo. Un valore lasciato vuoto mantiene ciò che è memorizzato; Cancella lo rimuove. Un segreto (un URL di webhook, un topic ntfy, un token, una password) non viene più mostrato, solo se è impostato, ed è sigillato nel database quando HotLoop ha una chiave segreta.
- Una destinazione viene controllata come l'ambiente all'avvio, prima che venga memorizzato qualcosa, e una sbagliata viene rifiutata dicendo cosa non va (mai il valore).
- Un interruttore per canale lo spegne del tutto: spento significa nessun canale, nessun invio.
- `GET /api/destinations` e `PUT /api/destinations/{kind}` sono le route; il PUT richiede `settings.write`. Vedi [l'API HTTP](/it/iot/api/).

## L'URL del webhook non viene mai stampato

Per molti destinatari l'URL è la password. Discord mette il token nel percorso (`/api/webhooks/{id}/{token}`), ntfy lo accetta come `?auth=`, Google Chat come `?key=` e `?token=`. Chiunque abbia l'URL può pubblicare nel tuo canale. Per questo, quando un invio fallisce, l'errore nomina lo schema e l'host e nient'altro:

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

È lo stesso testo nel log, nell'evento di audit e nella risposta di `POST /api/notify/test`. L'host basta per capire quale destinatario ha avuto il problema; il percorso e la query non lasciano mai il processo. Neppure un URL che non supera la validazione all'avvio viene ripetuto in quell'errore. Se serve vedere l'URL, guarda `HOTLOOP_NOTIFY_WEBHOOK_URL` dove l'hai impostato.

## Configurare ntfy

[ntfy](https://ntfy.sh) è un server push a pubblicazione e sottoscrizione. HotLoop pubblica ogni allarme su un topic; l'app ntfy sul telefono vi si iscrive.

1. Avvia un server, oppure usa ntfy.sh. Su una rete d'impianto, avvia il tuo (`binwiederhier/ntfy`, un container) e blindalo: imposta `auth-default-access: deny-all`, crea per HotLoop un utente che può scrivere sul topic e uno per ogni persona che può leggerlo. Su ntfy.sh, o su qualsiasi server raggiungibile da chiunque, **il nome del topic è la password**: chi lo indovina legge i tuoi allarmi. Fallo lungo e casuale.
2. Dai a HotLoop un token di accesso (`ntfy token add hotloop`) oppure un nome utente e una password per quell'utente.
3. Imposta `HOTLOOP_PUBLIC_URL` sull'indirizzo con cui un telefono raggiunge HotLoop, ad esempio `https://hotloop.plant.example`. Senza, la notifica arriva comunque, ma senza il pulsante Riconosci e senza tocco per aprire, perché il telefono non avrebbe dove inviare né l'uno né l'altro.
4. Configuralo e riavvia:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` invia una notifica di prova. Non ha il pulsante Riconosci, perché non c'è alcun allarme dietro da riconoscere.

L'URL è solo il server. Il topic ha la sua impostazione, mai nell'URL: così HotLoop sa quale parte è il segreto e la tiene fuori da ogni errore, riga di log ed evento di audit.

Che cosa arriva:

| <span class="sr-only">Dettagli</span> | <span class="sr-only">Dettagli</span> |
|---|---|
| Titolo | Il nome dell'allarme |
| Corpo | Il messaggio dell'allarme, la sua priorità, l'origine (`device/tag`) e quando è stato attivato |
| Priorità | Critica 5 (max: su Android può superare Non disturbare, se lo consenti), Alta 4, Media 3, Bassa 2 |
| Etichette | Un'emoji per gravità e la priorità a parole, così l'elenco sul telefono si scorre a colpo d'occhio |
| Tocco | Apre l'elenco allarmi di HotLoop, quando `HOTLOOP_PUBLIC_URL` è impostato |
| Pulsante | **Riconosci**, quando `HOTLOOP_PUBLIC_URL` è impostato. Vedi "Link di riconoscimento" |

### L'avvertenza per iPhone

Android funziona senza internet: l'app ntfy mantiene una propria connessione con il tuo server e riceve ogni messaggio all'istante sul Wi-Fi dell'impianto.

Gli iPhone no. Apple lascia passare un push solo attraverso i propri server (APNs), e solo ntfy.sh può parlare con APNs. Un server self-hosted va configurato con `upstream-base-url: https://ntfy.sh`, e a quel punto inoltra a ntfy.sh una richiesta di polling (senza contenuto del messaggio, solo "è arrivato qualcosa su questo topic") che sveglia il telefono, il quale poi scarica il messaggio dal tuo server. Quindi in un impianto senza internet gli iPhone non ricevono notifiche istantanee da un ntfy self-hosted. Le vedono quando aprono l'app. Se le tue persone hanno iPhone e l'impianto è isolato da internet, ntfy non è il tuo cercapersone; lo è l'e-mail tramite un relay, oppure Discord se l'impianto può raggiungerlo. Gotify non ha alcuna app per iPhone.

Il pulsante Riconosci è una richiesta dal telefono a `HOTLOOP_PUBLIC_URL`, quindi il telefono deve poter raggiungere quell'indirizzo: sul Wi-Fi dell'impianto, o tramite la VPN che usi. Funziona allo stesso modo su entrambe le piattaforme.

## Configurare Gotify

[Gotify](https://gotify.net) è un piccolo server push self-hosted con un'app Android. Non serve internet, non serve alcun account da nessuna parte.

1. Avvia `gotify/server` e accedi alla sua interfaccia web.
2. In **Apps**, crea un'applicazione chiamata HotLoop. Copia il suo token.
3. Configuralo e riavvia:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

Il token va nell'intestazione `X-Gotify-Key`, mai come `?token=` nell'URL, dove finirebbe nel log di accesso di ogni proxy.

Le priorità corrispondono a ciò che l'app Android ne fa: Critica 10 e Alta 8 sono di importanza alta (suono e finestra a comparsa), Media 5 è una notifica normale con suono, Bassa 2 è silenziosa. Il messaggio è in Markdown (il nome dell'allarme in grassetto, i dettagli come elenco, il testo dell'allarme con i caratteri speciali protetti così che un nome con un asterisco si legga com'è), e toccarlo apre l'elenco allarmi di HotLoop quando `HOTLOOP_PUBLIC_URL` è impostato.

**Nessun riconoscimento.** Le notifiche Gotify non hanno pulsanti di azione, quindi non c'è modo di mettervi un pulsante Riconosci, e non lo simuleremo con un link che riconosce con un semplice GET: le anteprime dei link e gli scanner di sicurezza aprono i link da soli, e un allarme non deve mai essere riconosciuto da un robot. Riconosci in HotLoop. Nemmeno **un'app per iPhone**.

## Discord

Due strade. Il webhook è un cercapersone: incolla un URL, ricevi gli allarmi in un canale. Il bot è a due vie: gli stessi messaggi con i pulsanti **Riconosci** e **Sospendi**, e la traccia di audit dice quale persona li ha premuti. Entrambi richiedono che l'impianto raggiunga Discord via internet (HTTPS in uscita verso `discord.com` e, per il bot, un WebSocket verso `*.discord.gg`). Nessuno dei due richiede che Discord raggiunga l'impianto.

### Che cosa arriva

| <span class="sr-only">Dettagli</span> | <span class="sr-only">Dettagli</span> |
|---|---|
| Testo | `[Critical] Boiler Trip`, ciò che mostra la notifica push di un telefono. Su un allarme critico, la menzione del ruolo configurato davanti |
| Titolo dell'embed | Lo stesso, con un link all'elenco allarmi di HotLoop quando `HOTLOOP_PUBLIC_URL` è impostato |
| Colore | Critica rosso, alta arancione, media giallo, bassa blu |
| Descrizione | Il messaggio dell'allarme |
| Campi | Tag (`device/tag`), Valore (la lettura che l'ha attivato), Limite (`hi 90`, dalla definizione), Area / Linea (dal dispositivo), Attivato (nel fuso orario di ciascun lettore) |
| Piè di pagina | `HotLoop | <HOTLOOP_PLANT_NAME>`, così un server con più impianti può distinguerli (solo `HotLoop` quando il nome dell'impianto non è impostato) |
| Pulsanti (solo bot) | Riconosci, Sospendi 1 h, Apri in HotLoop |

Un'ondata diventa un riepilogo, come su ogni altro canale: i primi cinque partono, poi un messaggio elenca il resto, con tutti i nomi che entrano e il conteggio degli altri, così il conteggio non viene mai tagliato.

Discord rifiuta un messaggio troppo lungo (2000 caratteri di testo, 256 di titolo, 4096 di descrizione, 25 campi, 6000 in tutto), e un messaggio rifiutato è un avviso che non è partito. Per questo HotLoop taglia perché ci stia, su un confine di carattere, con `...` dove ha tagliato.

### Nessuno viene menzionato per sbaglio

Ogni messaggio parte con `allowed_mentions: {"parse": []}`. Senza, Discord avvisa chiunque il testo menzioni, quindi un allarme che qualcuno ha chiamato "@everyone tank overflow" sveglierebbe l'intero server. Con, nulla nel testo avvisa nessuno. L'unica eccezione è il ruolo che configuri per Critica (`..._CRITICAL_ROLE`), nominato esplicitamente come unica menzione consentita, e solo su un allarme critico o su un riepilogo che ne contiene uno. Una notifica di prova non menziona mai nessuno. Anche il testo dell'allarme viene protetto come Markdown, quindi un nome con `*` si legge com'è e un `<@&role>` in un nome viene mostrato, non usato.

Perché la menzione funzioni il ruolo deve essere menzionabile: nelle impostazioni dei ruoli del server attiva **Consenti a chiunque di menzionare questo ruolo**, oppure dai al bot il permesso **Menziona @everyone, @here e tutti i ruoli**.

### Limiti di frequenza e ban di Discord

Discord risponde "troppo veloce" con un 429 e dice quanto aspettare, nel corpo (`retry_after`, al millisecondo) e in `X-RateLimit-Reset-After`. È il tempo che HotLoop attende prima di riprovare, entro i soliti tre tentativi e 30 secondi (vedi "Nuovi tentativi"). Quando Discord avvisa che il budget è esaurito prima di rifiutare (`X-RateLimit-Remaining: 0`), l'invio successivo attende il ripristino invece di provocare un 429.

Discord banna l'indirizzo di qualunque cosa accumuli 10.000 richieste rifiutate (401, 403, 429) in dieci minuti, e il ban porta con sé ogni integrazione Discord su quell'indirizzo. Quindi, quando Discord risponde **401, 403 o 404** (un webhook sbagliato o cancellato, un token del bot errato, un canale che il bot non vede), HotLoop **disattiva quel canale** dopo quella singola richiesta. Lo registra una volta, ogni allarme successivo viene rifiutato senza richiesta (e viene tracciato nell'audit come non inviato, così "qualcuno è stato avvisato" ha ancora una risposta), e compare in `GET /api/diagnostics` sotto `notify.channels`, con il motivo e da quando:

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Correggi l'impostazione e riavvia HotLoop. Un 500 o nessuna risposta non disattiva nulla; vengono ritentati come su ogni altro canale.

### Configurare il webhook

1. In Discord, apri le impostazioni del canale (l'ingranaggio), **Integrazioni**, **Webhook**, **Nuovo webhook**. Chiamalo HotLoop. **Copia URL webhook**.
2. Facoltativo: un ruolo da menzionare su Critica. Attiva la **Modalità sviluppatore** (Impostazioni utente, Avanzate), poi fai clic destro sul ruolo in Impostazioni server, Ruoli, e **Copia ID ruolo**. È un numero, non un nome.
3. Configuralo e riavvia:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` invia un messaggio di prova.

**L'intero URL è la password.** Chiunque lo abbia può pubblicare nel tuo canale come il webhook. HotLoop non lo stampa mai: non nel log, non in un errore, non in un evento di audit, non in una risposta API, e neppure un URL che non supera la validazione all'avvio viene ripetuto in quell'errore. Nel chart Helm va in un Secret. Se trapela, elimina il webhook in Discord e creane uno nuovo.

Un webhook non può portare un pulsante che faccia qualcosa, quindi qui non c'è Riconosci. Il titolo rimanda all'elenco allarmi di HotLoop. Per avere i pulsanti, usa il bot.

### Configurare il bot

1. Vai al [portale sviluppatori di Discord](https://discord.com/developers/applications), **New Application**, chiamala HotLoop. L'**Application ID** nella pagina General Information è ciò che serve al link di invito.
2. Scheda **Bot**: **Reset Token** e copialo. Discord lo mostra una volta sola. È `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. Nella stessa pagina disattiva **Public Bot**, così nessuno tranne te può aggiungerlo a un server, e lascia disattivati tutti e tre i **Privileged Gateway Intents**. HotLoop non chiede a Discord alcun evento (intents 0); le pressioni dei pulsanti arrivano comunque.
3. Invitalo nel tuo server con il minimo che gli serve, View Channels, Send Messages ed Embed Links (permessi `19456`), e nessun altro scope oltre a `bot`:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Aggiungi **Mention @everyone, @here, and All Roles** (`permissions=150528`) solo se il ruolo Critica non è menzionabile e preferisci non renderlo tale. Modificare il proprio messaggio dopo una pressione non richiede alcun permesso; passa dalla pressione stessa.
4. Il canale: con la Modalità sviluppatore attiva, fai clic destro su di esso, **Copia ID canale**. Se il canale è privato, aggiungi il ruolo del bot.
5. I ruoli che possono premere i pulsanti. Crea un ruolo (ad esempio "Alarm ack"), assegnalo alle persone che possono riconoscere da Discord e copia il suo id. Sospendere toglie un allarme dall'elenco per un'ora, quindi ha una propria impostazione; può essere lo stesso ruolo o uno più ristretto.
6. Configuralo e riavvia:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. Il log dice `connected to the Discord Gateway; Discord buttons work`, e `GET /api/diagnostics` mostra `"gateway": {"connected": true}` sotto il canale `discord`. `POST /api/notify/test` pubblica un messaggio di prova (senza pulsanti, non c'è alcun allarme dietro).

**Finché non imposti i ruoli, nessuno può premere nulla.** Con `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` o `_SHELVE_ROLES` vuoti, ogni pressione di quel pulsante viene rifiutata, alla persona che preme viene detto quale impostazione è vuota, e HotLoop lo segnala all'avvio:

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

È voluto. Un pulsante che chiunque nel server può premere non è un'impostazione predefinita da distribuire: i server accumulano persone.

**Chi ha premuto.** Un riconoscimento da Discord viene registrato come `discord:<username>#<user id>` (l'id, perché un nome utente Discord può cambiare e l'id no), con la nota "acknowledged from Discord by alice (1010...)". Per registrarlo con l'utente HotLoop, associali: `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. L'associazione dà solo il nome dell'autore. Non controlla i permessi dell'utente HotLoop: è il ruolo Discord a decidere chi può premere.

**Sospendi** sospende per `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE`, un'ora per impostazione predefinita, al massimo 24 ore come ogni sospensione. È un tempo fisso, non un menu: alle 03:00 un pulsante che fa una cosa nota vale più di un menu a tendina. Rifiuta un allarme rientrato (sospenderlo nasconderebbe ciò che lo attiverà la volta dopo) e uno già sospeso.

Dopo una pressione, il messaggio dice chi ha fatto cosa e quando, ed entrambi i pulsanti diventano grigi, così la persona che guarda il canale subito dopo vede che è già gestito. Una pressione rifiutata riceve risposta solo dalla persona che l'ha fatta, con il motivo, ed è registrata nel log di sistema.

### Come viene autorizzata una pressione

Lo stesso meccanismo del link Riconosci di ntfy (vedi "Link di riconoscimento"), più la parola di Discord su chi ha premuto:

- **Il pulsante è firmato.** Ogni pulsante porta un token firmato con lo stesso segreto dei link di riconoscimento, per quell'azione (riconoscere o sospendere, inclusa nella firma, così una non può essere riusata come l'altra), su quell'allarme, attivato in quel momento. Discord ammette 100 caratteri di dati per pulsante e un id di allarme può averne 64, quindi questa è una forma compatta della stessa asserzione: 8 byte di orario di attivazione, 4 di scadenza e un HMAC a 96 bit. Falsificarne uno significa indovinare 96 bit, una pressione Discord per tentativo, dall'interno del server e con il ruolo giusto.
- **La persona ha un ruolo che hai indicato.** Discord comunica al bot i ruoli di chi preme insieme alla pressione, sulla connessione autenticata del bot. Chiunque possa assegnare ruoli nel tuo server può assegnare questo, quindi tratta quei ruoli come il permesso che sono.
- **L'occorrenza è ancora quella corrente.** Il motore verifica, sotto il proprio lock, che l'attivazione corrente dell'allarme sia quella sul pulsante. Il messaggio di ieri non può riconoscere l'intervento di oggi.
- **Una sola volta.** La prima azione su un'occorrenza da qualunque notifica (ntfy o Discord) viene registrata e tutte le successive vengono rifiutate. Due persone che premono insieme: una vince, all'altra viene detto.
- **Scadenza.** Dopo `HOTLOOP_NOTIFY_ACK_TTL` (12 ore) i pulsanti smettono di funzionare; agisci in HotLoop.

Il token del bot è una credenziale per l'intero bot. Non viene mai registrato nel log, mai in un errore, mai in una risposta API; nel chart Helm va in un Secret. Lo stesso vale per il token di interazione di ogni pressione, che Discord dà al bot per quindici minuti per rispondere. Se il token del bot trapela, reimpostalo nel portale sviluppatori.

### La connessione Gateway

Le pressioni arrivano dal Gateway di Discord, un WebSocket che HotLoop apre verso Discord e tiene aperto. Il client è quello di HotLoop, su [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, fissata; era già nel grafo delle dipendenze di questo modulo, è piccola ed è la libreria WebSocket più usata in Go). Non abbiamo preso una libreria Discord come discordgo: è un intero SDK Discord (REST, voce, una cache di stato) per l'unico evento che ci serve, e questo progetto non include SDK di fornitori. Il client:

- si identifica con intents 0, quindi Discord gli invia solo le pressioni;
- invia heartbeat all'intervallo indicato da Discord, risponde subito a una richiesta di heartbeat e considera un heartbeat non confermato come una connessione morta;
- riprende la sessione dopo una caduta, un Reconnect (op 7) o una Invalid Session riprendibile (op 9), così una pressione avvenuta durante la riconnessione viene riprodotta, non persa; una sessione che non può essere ripresa attende da uno a cinque secondi e ne avvia una nuova;
- si identifica al massimo una volta ogni cinque secondi, e per niente quando Discord dice che gli avvii di sessione del giorno sono esauriti, finché non si azzerano;
- si riconnette con un'attesa che raddoppia da un secondo a un minuto;
- si ferma definitivamente davanti a un token rifiutato o a intents rifiutati, disattiva il canale e lo mostra in `/api/diagnostics`, invece di riconnettersi all'infinito.

Discord dà al bot tre secondi per rispondere a una pressione, quindi la prima cosa che fa HotLoop è rispondere "ricevuto" (un aggiornamento differito), poi fa il lavoro. Quella risposta è anche ciò che impedisce a due repliche di HotLoop di agire su una stessa pressione: entrambe la ricevono, Discord accetta la prima risposta e rifiuta la seconda, e la replica rifiutata si ferma. Eseguito come helper MCP (`--mcp-stdio`), HotLoop non apre alcuna connessione Gateway; quella vera gestisce le pressioni.

## Limiti di frequenza e riepiloghi

Un calo di tensione o il riavvio di un PLC attiva quaranta allarmi in un secondo. Un invio per allarme fa bannare l'IP di un webhook Discord, supera il limite per IP di ntfy e seppellisce l'allarme che conta sotto trentanove che non contano, sul telefono che li riceve. Per questo ogni canale ha un budget, un secchio di gettoni: una raffica che può partire tutta insieme, poi un invio in più a ogni ricarica.

| Canale | Raffica predefinita | Poi uno ogni |
|---|---|---|
| ntfy | 10 | 5 s (sotto il limite di ntfy.sh di 60, poi uno ogni 5 s, per IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Webhook Discord | 5 | 2 s (Discord concede a un webhook circa 5 richieste ogni 2 s, e a un canale 30 messaggi al minuto) |
| Bot Discord | 5 | 2 s |

Cambiali per canale con `HOTLOOP_NOTIFY_<CHANNEL>_BURST` e `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Ciò che il budget consente parte da solo, subito. Ciò che non consente viene trattenuto, e quando è dovuto il prossimo invio tutto ciò che è trattenuto parte come **un solo** riepilogo:

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

Nessun allarme va perso: il riepilogo li nomina tutti, fino a 25, e conta il resto ("...and 13 more"). È grave quanto l'allarme peggiore che contiene, e l'evento di audit elenca l'id di ogni allarme che ha rappresentato. Non ha il pulsante Riconosci, perché non c'è un singolo allarme che possa riconoscere. Se è stato trattenuto un solo allarme, parte come se stesso, pulsante compreso. Una volta che gli allarmi vengono trattenuti, i nuovi si uniscono al gruppo anche se il budget è tornato, così un riepilogo non arriva mai dopo un allarme attivato più tardi di tutti quelli che contiene. All'arresto, tutto ciò che è ancora trattenuto parte subito, oltre il budget: la scelta, a quel punto, è tra un invio di troppo e allarmi di cui nessuno viene mai informato.

Il budget è per canale, quindi un'ondata che mette in coda il relay SMTP non blocca ntfy, e la soglia di ogni canale continua a valere: un allarme Bassa non finisce mai nel riepilogo di un canale impostato su Alta e superiori.

## Nuovi tentativi

Un invio che riceve un 429, un 5xx o nessuna risposta (rifiutato, azzerato, scaduto) viene ritentato, fino a tre tentativi in tutto, tutti entro 30 secondi dal primo. Quando il destinatario dice quanto attendere (`Retry-After`, in secondi o come data), si attende quel tempo; altrimenti un secondo, poi due. Un destinatario che chiede più dei 30 secondi rimasti non viene atteso: il fallimento viene segnalato subito, dicendolo. Dopo 30 secondi è meglio segnalare come fallito un avviso non partito, nel log e nella traccia di audit, che ritentarlo in silenzio per minuti mentre l'allarme resta lì.

Qualunque altro 4xx (un token sbagliato, un topic su cui l'utente non può scrivere, una richiesta malformata) non viene mai ritentato. Sarà la stessa risposta ogni volta finché qualcuno non corregge la configurazione, e Discord banna un IP che continua a inviare richieste già rifiutate.

`POST /api/notify/test` fa esattamente un tentativo per canale. Una prova chiede che cosa fa il canale adesso, e un nuovo tentativo farebbe sembrare a posto un destinatario instabile.

## Link di riconoscimento

Il pulsante Riconosci su una notifica ntfy è una richiesta a `POST /api/notify/ack/{token}` su `HOTLOOP_PUBLIC_URL`. La persona che lo preme alle 03:00 non è autenticata da nessuna parte, quindi **il token è l'intera autorizzazione**. Funziona solo se il token è infalsificabile, ristretto, monouso e di breve durata, e ognuna di queste proprietà viene applicata:

- **Infalsificabile.** Il token è un'asserzione (quale allarme, quando è stato attivato, quale canale, quando scade il link) più un HMAC-SHA256 di essa con un segreto del server. Cambia un byte, o firma con un'altra chiave, e viene rifiutato. Il segreto è `HOTLOOP_NOTIFY_ACK_SECRET` se lo imposti (almeno 32 caratteri; `openssl rand -hex 32`). Se non lo imposti, HotLoop genera 32 byte casuali la prima volta che gli servono e li conserva nel proprio database (la tabella `settings`, chiave `notify.ackSecret`), così i link continuano a funzionare dopo un riavvio e tutte le repliche concordano. Non viene mai mostrato nella schermata delle impostazioni né in alcuna risposta API. Si trova nei backup del database, come tutto il resto del database; se per te è un problema, imposta la variabile da un Secret Kubernetes (`notify.ackSecret.existingSecret` nel chart), e non tocca mai il database. Cambiare il segreto invalida tutti i link già inviati, che è anche il modo per revocarli tutti insieme.
- **Ristretto.** L'asserzione nomina un allarme **e il momento in cui è stato attivato**. Un pulsante dell'intervento di ieri dello stesso allarme non può riconoscere quello di oggi, che nessuno ha ancora visto: il motore verifica, sotto lo stesso lock del riconoscimento, che l'attivazione corrente dell'allarme sia quella dell'asserzione (`alarm.Engine.AckOccurrence`). Il link può riconoscere e nient'altro. Non può sospendere, azzerare, scrivere un tag né leggere nulla, quindi il peggio che un link trapelato possa fare è esattamente ciò che avrebbe fatto la pressione del pulsante.
- **Monouso.** Il primo uso di un link per un'occorrenza viene registrato nel database (`notify_ack_links`), e ogni uso successivo viene rifiutato, anche quando l'allarme deve essere riconosciuto di nuovo senza una nuova attivazione (sospeso mentre era ancora in allarme e ripreso, torna non riconosciuto). Lo stato dell'allarme da solo non basta per questo; serve la registrazione.
- **Breve durata.** Scade, per impostazione predefinita 12 ore dopo l'invio (`HOTLOOP_NOTIFY_ACK_TTL`, al massimo 168 h). Abbastanza lungo per "guardo quando arrivo", abbastanza breve perché lo screenshot di una notifica non sia una credenziale permanente.

Una pressione riuscita è un normale riconoscimento ISA-18.2 attraverso il motore allarmi, tracciato esattamente come uno dalla schermata allarmi: un evento di allarme e una voce del log di sistema con l'attore `notify:ntfy` e la nota "acknowledged from the ntfy notification". Le azioni HTTP di ntfy non dicono quale telefono ha premuto il pulsante, quindi non c'è un nome di persona da aggiungere. Quando più persone condividono un topic, la traccia di audit dice che è stato il telefono, non chi. Il bot Discord conosce l'utente e lo riporta (vedi "Discord").

Ogni rifiuto riceve risposta con ciò che è andato storto ed è registrato nel log di sistema sotto `notify:<channel>` (o `notify:ack-link` per un token troppo rovinato per dire quale canale l'ha inviato), perché un pulsante che non fa nulla in silenzio non si distingue da uno che nessuno ha premuto:

| Risposta | Perché |
|---|---|
| 403 | Falsificato, alterato o firmato con un altro segreto |
| 410 | Autentico ma scaduto |
| 409 | Già usato, oppure l'allarme è stato attivato di nuovo da allora, oppure non resta nulla da riconoscere |
| 404 | L'allarme non esiste più, oppure i link di riconoscimento sono disattivati |

Il token non viene mai scritto nel log, mai inserito in un evento di audit e mai restituito da alcuna API: finché è valido è una credenziale. Si trova nel messaggio ntfy, necessariamente, quindi chiunque possa leggere il tuo topic ntfy può premere il pulsante. Blinda il topic.

L'endpoint risponde con `Access-Control-Allow-Origin: *` così il pulsante funziona anche dall'app web di ntfy, che lo preme dalla propria origine. Questo non regala nulla: nulla su questa route legge un cookie o una sessione.

## Escalation

Nessuno ha riconosciuto l'allarme in N minuti, quindi la persona successiva lo riceve. Il primo avviso parte esattamente come sempre, a ogni canale la cui soglia è raggiunta dall'allarme. L'escalation è ciò che accade dopo, se l'allarme è ancora lì non riconosciuto. Un avviso arrivato su un telefono che nessuno aveva in mano è il guasto per cui questo esiste: alle 03:00 la persona di reperibilità dorme, e l'allarme non deve aspettarla.

Si configura in **Impostazioni, Escalation degli allarmi**, o tramite API (`GET` e `PUT /api/notify/escalation`). È solo per amministratori, perché contiene i topic ntfy delle persone e decide chi viene svegliato. A differenza dei canali, che vengono letti dall'ambiente all'avvio di HotLoop, la policy è un dato che modifichi e ha effetto quando la salvi. I canali che può usare sono quelli che l'installazione ha già configurato. Non si aggiunge nulla all'elenco di quattro, più il webhook e l'e-mail.

### La policy

| Campo | <span class="sr-only">Dettagli</span> |
|---|---|
| `enabled` | Disattivata finché non la attivi. Una policy disattivata non esegue alcuna escalation |
| `minPriority` | L'allarme meno grave che passa in escalation: `critical`, `high`, `medium` o `low`. Predefinita `high`. Un allarme Media fermo da un'ora è un ordine di lavoro, non una telefonata alle 03:00 |
| `contacts` | Le persone. Ognuna ha un `name`, e un `ntfyTopic`, `emails`, o entrambi. Fino a 50 |
| `steps` | Fino a 10. Ognuno ha `afterMinutes` (da 1 a 1440) e chi avvisare: `contacts` per nome, `channels` per nome, o entrambi |
| `repeatEveryMinutes`, `repeatTimes` | Dopo l'ultimo passo, reinvia con questa frequenza, altrettante volte in più (al massimo 20). Entrambi a zero per non ripetere |

Una **persona** riceve una notifica tutta sua. Il suo `ntfyTopic` è un topic sul server ntfy su cui questo HotLoop già pubblica, con lo stesso accesso, quindi il suo telefono si iscrive a un topic solo suo. Le sue `emails` passano dal relay SMTP che HotLoop ha già. Una persona con un topic richiede ntfy configurato, e una con un indirizzo richiede l'e-mail configurata, e la policy viene rifiutata dicendolo se non lo sono. Su un server raggiungibile da chiunque, un topic è una password: fallo lungo e casuale. L'API mostra i topic agli amministratori e a nessun altro, e non compaiono mai nel registro, nel log di sistema né in un errore.

Un **canale** in un passo è uno di quelli dell'installazione (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) e raggiunge chiunque vi sia: il canale Discord condiviso, un'app Gotify condivisa da una squadra, un webhook verso qualcosa che avvisa. La policy viene rifiutata se un passo ne nomina uno che questo HotLoop non ha configurato, e la risposta elenca quelli che ha.

### Quando partono

Un passo è dovuto `afterMinutes` dopo il precedente, e il primo passo `afterMinutes` dopo l'attivazione dell'allarme. È una somma dall'attivazione, non da quando è finito l'ultimo invio, quindi un relay lento o un riavvio non allungano la pianificazione che hai scritto. Con passi di 5 e 10 e una ripetizione di 15 minuti, due volte:

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Che cosa la ferma

La catena vale per un'occorrenza di un allarme, e si ferma, con una riga che dice perché, quando accade una di queste cose:

- **Qualcuno lo riconosce.** Da qualunque parte: la schermata allarmi, il pulsante Riconosci su ntfy o Discord, l'API, un'automazione. Tutti finiscono nel motore allarmi, e prima che parta ogni passo l'escalator chiede al motore se questa occorrenza è ancora non riconosciuta. Un hook che arriva in ritardo non può farlo avvisare per un allarme che qualcuno ha già gestito.
- **Rientra.** L'allarme è ancora nell'elenco e attende un riconoscimento, ma nessuno viene svegliato per qualcosa che si è risolto da solo. È una scelta fatta apposta; cambia la soglia o i passi se ne vuoi un'altra.
- **Viene sospeso.**
- **Scatta di nuovo.** È una nuova occorrenza con la sua catena, contata dalla propria attivazione. La catena di ieri non avvisa mai per l'allarme di oggi.

Un allarme che qualcuno gestisce prima che il passo 1 sia dovuto non lascia alcuna traccia nello storico delle escalation, il che significa che il sistema funziona.

### Che cosa arriva

Un'escalation è la notifica dell'allarme con il titolo cambiato e una riga aggiunta:

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Mantiene la priorità dell'allarme, quindi una Critica resta a priorità massima su Android. Porta lo stesso pulsante Riconosci firmato del primo avviso su ntfy e Discord (vedi "Link di riconoscimento"), così la persona che sveglia può riconoscere da dove è stata avvisata. Gotify e l'e-mail non hanno il pulsante. Un webhook riceve il solito JSON di HotLoop con `event` impostato su `escalated`.

Un canale condiviso ha un proprio ritmo come ogni altro (vedi "Limiti di frequenza e riepiloghi"), quindi un calo di tensione che lascia quaranta allarmi non riconosciuti passa in escalation come un solo riepilogo, "40 alarms nobody has acknowledged", non quaranta avvisi e un ban. La notifica personale di una persona è un invio a sé.

### La traccia di audit

Ogni escalation è una riga nello storico dell'allarme stesso, che è ciò che legge il [registro](/it/iot/logbook/), quindi vi compare senza alcuna configurazione aggiuntiva, archiviata sotto l'allarme con l'attore `escalation`:

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` e il tipo `alarm` del registro riportano le stesse righe come tipi `escalated` e `escalation-ended`. Un passo che non ha raggiunto nessuno lo dice in maiuscolo (`NOBODY WAS REACHED`) con ogni errore a seguire, e la catena prosegue comunque al passo successivo: un relay guasto non deve fermare l'avviso che parte per un'altra via. Il salvataggio della policy è nel log di sistema senza i topic.

### Riavvii, e dove gira

Le catene vivono in memoria, quindi un riavvio alle 03:00 nel mezzo di una non può farla perdere. All'avvio HotLoop guarda ogni allarme ancora non riconosciuto, legge quanti passi le righe di audit dicono essere partiti per quell'occorrenza e riprende da lì: non reinvia il passo 1 e non salta il passo 2. Un passo scaduto mentre HotLoop era spento parte nei primi secondi dopo il ritorno. Un passo in corso quando il processo è stato terminato può partire due volte, che è il verso giusto in cui sbagliare per un allarme.

Una policy salvata si applica agli allarmi attivati dopo il salvataggio. Un riavvio riprende ogni allarme ancora non riconosciuto, a prescindere da quando è stato attivato.

Lo esegue il Gateway. Un helper `--mcp-stdio` no, quindi un allarme non viene mai portato in escalation da due processi.

## TLS sul canale SMTP

Il canale passa a TLS tramite STARTTLS automaticamente ogni volta che il relay annuncia l'estensione, a prescindere da qualsiasi impostazione qui sotto. Non è un comportamento facoltativo da attivare: `net/smtp.PlainAuth` di Go rifiuta di trasmettere nome utente e password su una connessione che non sia già TLS (o verso un server che si chiami letteralmente `localhost`), e praticamente ogni fornitore reale che richiede autenticazione, Gmail, SendGrid, Mailgun, il relay di un provider internet, richiede STARTTLS sulla porta 587 o TLS implicito sulla 465 (vedi sotto) per arrivarci. Un relay senza autenticazione configurata, raggiungibile su una rete isolata, può non offrire affatto STARTTLS, e questo canale non lo richiede in quel caso.

`HOTLOOP_NOTIFY_SMTP_TLS` non attiva il passaggio a TLS, trasforma la sua *assenza* in un errore netto: se impostato e il relay non annuncia STARTTLS, `Send` rifiuta prima ancora di tentare `AUTH`, invece di autenticarsi in chiaro verso un relay che per caso è raggiungibile come `localhost`. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` salta la verifica del certificato nel passaggio, la stessa via di fuga che `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` e `HOTLOOP_FLEET_TLS_SKIP_VERIFY` offrono già per le proprie connessioni MQTT, per un relay che presenta un certificato autofirmato.

### TLS implicito, porta 465

Un relay sulla porta 465 si aspetta che l'intera connessione sia TLS dal primo byte (RFC 8314), non un saluto in chiaro e un passaggio. HotLoop faceva solo il passaggio, quindi sulla 465 la prima cosa che diceva era in chiaro a un relay che aspettava un handshake TLS, e l'invio moriva. Ora **la porta 465 è TLS implicito** e ogni altra porta è STARTTLS come prima, senza alcuna impostazione da toccare:

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Se un relay fa TLS implicito su una porta propria, o parla STARTTLS sulla 465, `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` dice quale, `true` o `false`, e prevale sulla porta. Nel chart Helm impostalo sotto `extraEnv`. Tutto il resto è uguale in entrambi i casi: nome utente e password viaggiano sulla connessione cifrata, `HOTLOOP_NOTIFY_SMTP_TLS` è soddisfatto da essa (non c'è nulla da richiedere) e `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` salta il controllo del certificato nel suo handshake. Il certificato del relay viene controllato a meno che tu non lo disattivi. I report pianificati usano le stesse impostazioni del relay e quindi la stessa regola.

Se l'handshake fallisce, l'errore lo dice e nomina `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, che è ciò che serve a un relay che parte in chiaro.

Provato contro una vera libreria di server SMTP con un listener solo TLS, e contro Mailpit eseguito con `--smtp-require-tls`, la versione fissata del laboratorio v1.31.2. Non verificato contro l'endpoint 465 di un fornitore commerciale.

## Un solo percorso SMTP, condiviso con i report pianificati

Dalla versione 4.14.0 il canale allarmi invia tramite `notify.SendMessage`, una funzione generale che invia un messaggio, con allegati facoltativi, a un elenco di destinatari. I report pianificati (vedi [Report pianificati](/it/gateway/reports/)) inviano i loro file CSV e HTML con la stessa funzione e le stesse impostazioni del relay (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), quindi c'è un solo punto che si collega, passa a STARTTLS, si autentica e decide che cosa può contenere un'intestazione. Si condivide solo il relay: `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` e `HOTLOOP_NOTIFY_SMTP_TO` riguardano gli allarmi, e un relay configurato per i report non attiva il canale allarmi.

Due comportamenti dell'e-mail di allarme sono cambiati, entrambi nel senso della sicurezza. Il mittente e ogni destinatario vengono ora validati come indirizzi semplici prima di qualunque connessione, mentre prima uno malformato falliva al relay. E un oggetto con caratteri non ASCII viene inviato come parola codificata RFC 2047 invece che come UTF-8 grezzo. Un nome di allarme che contiene un carattere di controllo viene appiattito in spazi invece di essere rifiutato, perché un avviso deve partire comunque si chiami l'allarme.

## Soglie di priorità

Ogni canale ha il proprio `MinPriority`, la priorità di allarme meno grave per cui scatta ancora. `model.AlarmPriority` va da 1 (Critica, la più grave) a 4 (Bassa), quindi "Alta e superiori" è `MinPriority = 2`: un allarme raggiunge la soglia di un canale quando il suo numero di priorità è minore o uguale alla soglia. Un webhook configurato solo per Critica e un relay SMTP configurato per Media e superiori possono osservare lo stesso motore allarmi e scattare su insiemi di allarmi del tutto diversi; nulla richiede che concordino.

## Che cosa non è

**Non è un ricaricamento a caldo dei canali.** I canali vengono letti una volta, dalla configurazione, all'avvio del processo, come `EdgePublishConfig` e `FleetConfig`. Cambiare `HOTLOOP_NOTIFY_*` richiede un riavvio per avere effetto, e in questo MVP non c'è un'API per aggiungere o rimuovere un canale a runtime. La policy di escalation è l'eccezione: chi viene avvisato dopo, e quando, è un dato che modifichi e ha effetto quando lo salvi (vedi "Escalation").

**Non è una tabella a sé.** Ogni tentativo di notifica, riuscito o fallito, viene scritto tramite `runtime.Manager.Event`, lo stesso meccanismo generico di eventi di audit con cui già registrano tutte le azioni su allarmi e flotta. Non serviva inventare una tabella `notifications` dedicata per una funzione di queste dimensioni; il log di sistema risponde già a "è stata inviata una notifica, e ha funzionato".

**Non è una coda durevole.** I nuovi tentativi sono limitati (tre tentativi, 30 secondi, vedi "Nuovi tentativi") e gli allarmi trattenuti vivono in memoria finché non parte il loro riepilogo. Un avviso che continua a fallire viene registrato e tracciato e il dispatcher va avanti. Un allarme che resta attivo perché nessuno l'ha riconosciuto resta visibile nella schermata allarmi e in `alarm_events` indipendentemente dal fatto che un avviso sia mai arrivato: la notifica è una comodità sopra il sistema allarmi, non un sostituto.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | La funzione è disattivata finché non viene impostata questa |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Obbligatorio quando il canale webhook è abilitato. Deve essere `http://` o `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low`, oppure `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Obbligatorio quando il canale SMTP è abilitato |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Facoltativo. Ometti entrambi per un relay anonimo |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Obbligatorio quando il canale SMTP è abilitato |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Obbligatorio quando il canale SMTP è abilitato. Indirizzi separati da virgole |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Richiede che il relay offra STARTTLS; vedi "TLS sul canale SMTP" sopra, STARTTLS viene usato automaticamente ogni volta che è offerto, a prescindere da questa impostazione |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Salta la verifica del certificato nel passaggio a STARTTLS, o nell'handshake del TLS implicito. Scelta per singola installazione; non impostarla mai come predefinita |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` sulla porta 465, altrimenti `false` | TLS dal primo byte invece di STARTTLS; vedi "TLS implicito, porta 465". Impostala per prevalere sulla porta |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | Gli stessi valori di quelli del webhook |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Obbligatorio. Solo il server, `https://ntfy.example.com`, senza percorso |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Obbligatorio. Da 1 a 64 lettere, cifre, `-` e `_`. Su un server pubblico è la password |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Un token di accesso ntfy (`tk_...`), inviato come token bearer |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Autenticazione basic al posto di un token. Non entrambi |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Mette un pulsante Riconosci su ogni allarme (richiede `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | Gli stessi valori di quelli del webhook |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Obbligatorio. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Obbligatorio. Il token dell'applicazione che Gotify ti ha dato per HotLoop |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | Gli stessi valori di quelli del webhook |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Obbligatorio. L'URL che dà Copia URL webhook di Discord. Tutto l'URL è la password |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | Un id di ruolo da menzionare sugli allarmi critici |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | Gli stessi valori di quelli del webhook |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Obbligatorio. Il token del bot, da solo, senza `Bot ` davanti |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Obbligatorio. L'id del canale in cui pubblicare |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Id di ruolo separati da virgole i cui membri possono premere Riconosci. **Vuoto significa nessuno** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Lo stesso per Sospendi. **Vuoto significa nessuno** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, separati da virgole: le persone le cui azioni vengono registrate con il loro nome HotLoop |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | Per quanto tempo Sospendi sospende. Al massimo `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | Un id di ruolo da menzionare sugli allarmi critici |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | Gli stessi valori di quelli del webhook |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Solo per far passare le richieste del bot da un proxy |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | per canale | Il limite di frequenza; vedi "Limiti di frequenza e riepiloghi". `<CHANNEL>` è `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` o `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | L'indirizzo con cui un telefono raggiunge HotLoop, percorso base incluso. Necessario per il tocco per aprire e per il pulsante Riconosci |
| `HOTLOOP_NOTIFY_ACK_SECRET` | generato | Firma i link di riconoscimento. Almeno 32 caratteri. Se non impostato: generato una volta e conservato nel database |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Per quanto tempo funziona un link di riconoscimento. Al massimo `168h` |

Nel chart Helm si trovano sotto `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` e il `publicUrl` di primo livello. Token, password e l'URL del webhook Discord vanno in un Secret gestito dal chart, oppure indica il tuo con `existingSecret`.

## API

| Route | Permesso | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Invia subito una notifica di prova sintetica su ogni canale configurato |
| `POST /api/notify/ack/{token}` | nessuno; il token è l'autorizzazione | Riconosce l'occorrenza di allarme per cui il token è stato emesso. Vedi "Link di riconoscimento" |
| `GET /api/notify/escalation` | `notify.escalation` | La policy di escalation, i canali che un passo può nominare e le catene aperte in questo momento. Vedi "Escalation" |
| `PUT /api/notify/escalation` | `notify.escalation` | Sostituisce l'intera policy. Rifiutata con il motivo se un passo non nomina nessuno o nomina un canale non configurato |
| `GET /api/diagnostics` | `status.read` | Sotto `notify.channels`, lo stato di ogni canale: se Discord lo ha rifiutato (e perché, e da quando), e la connessione Gateway del bot Discord |

`notify.escalation` è solo per amministratori allo stesso modo. Anche leggere la policy lo richiede, perché contiene i topic ntfy delle persone.

`notify.test` è solo per amministratori, concesso dal carattere jolly che il ruolo di amministratore già possiede e deliberatamente non aggiunto all'elenco dei permessi del ruolo operatore: inviare un vero messaggio esterno e consumare la quota che consente un fornitore di avvisi o un relay SMTP è più vicino a `fleet.restart` e `fleet.config` (anch'essi solo per amministratori, anch'essi "fai qualcosa verso l'esterno adesso") che a una lettura, la stessa restrizione che questa applicazione applica già a quei due.

La risposta riporta l'esito di ciascun canale invece di un unico successo o fallimento della richiesta:

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Che cosa è stato verificato e che cosa no

HotLoop è stato eseguito contro apparecchiature e server reali, e su bare metal il 2026-11-17.
