---
title: "Invio alle stazioni di un tenant"
description: "Un file di flussi e i suoi diagrammi FlowLab su ogni installazione Flow di un tenant, una alla volta, con verifica e ripristino in caso di errore."
---

Un tenant EmberNet può eseguire più installazioni di HotLoop Flow, una per ogni stabilimento o linea. Ognuna la chiamiamo stazione. Questa pagina spiega come mettere un file di flussi, e quindi un insieme di diagrammi FlowLab, su tutte, verificare ciascuna e riportare una stazione allo stato precedente se fallisce.

La versione breve: `hotloop-flow stations push -tenant acme -file flows.json` invia alle stazioni che EmberNet mostra in esecuzione per `acme`, una alla volta. Se dopo una stazione non è a posto, quella stazione torna a ciò che aveva e l'invio si ferma. Se il file riavviasse un logger in esecuzione, non succede nulla finché non dite che si può.

## Da dove arrivano le stazioni

Nessuno digita una stazione. L'elenco è ciò che la dashboard EmberNet mostra in esecuzione per il tenant, lo stesso elenco della sua pagina Running Apps: ogni app con l'etichetta `hotloop-flow` che è in esecuzione e appartiene al tenant. Una stazione si raggiunge al suo indirizzo Flux quando la dashboard ne riporta uno, e altrimenti al suo indirizzo di cluster, quindi eseguite l'invio da un luogo in cui quell'indirizzo si risolve.

Il tenant è sempre indicato, e un invio riguarda sempre quell'unico tenant. La dashboard viene interrogata con il vostro token della dashboard, che vi limita ai tenant che potete vedere, e controlliamo di nuovo la risposta: una riga che arriva per un altro tenant viene scartata e contata, mai usata. Un tenant senza Flow in esecuzione risponde con un errore.

## Il comando

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

L'indirizzo della dashboard viene da `-dashboard` o da `HOTLOOP_FLOW_DASHBOARD_URL`, e il suo token da `-dashboard-token-file` o da `HOTLOOP_FLOW_DASHBOARD_TOKEN`. Il token che le stazioni accettano viene da `-token-file` o da `HOTLOOP_FLOW_TOKEN`, come per `hotloop-flow deploy`. Createlo con `hotloop-flow token` e date a ogni stazione quel token come token API con `flows.read`, `flows.write` e `status.read` (un semplice token di deploy ha solo i primi due): la verifica deve leggere i diagrammi di ogni stazione, cosa che un semplice token di deploy non può fare. Le stazioni di uno stesso tenant accettano lo stesso token.

| Opzione | Cosa fa |
|---|---|
| `-dry-run` | Pianifica ogni stazione e non ne modifica nessuna. Mostra cosa c'è in produzione, cosa riavvierebbe ciascuna e quali non è stato possibile pianificare. |
| `-confirm-restart` | Accettate che questo invio possa riavviare logger in esecuzione. |
| `-window 02:00-04:00` | Le ore in cui un riavvio è accettato in anticipo, in `-window-zone` (un nome IANA, UTC se omesso). Un invio dentro la finestra procede. Può superare la mezzanotte, `22:00-02:00`. |
| `-settle 5s` | Quanto tempo hanno i diagrammi di una stazione per partire prima che la verifica li dichiari non in esecuzione. |
| `-json` | Il report in JSON. |

Il codice di uscita 0 significa che ogni stazione è completata. 3 significa che una stazione è fallita e l'invio si è fermato. 4 significa che l'invio attende che accettiate i riavvii. 5 significa stazioni saltate perché non hanno risposto o non è stato possibile pianificarle.

## Cosa fa un invio

Prima pianifica ogni stazione senza modificarne nessuna. Per ciascuna legge il file di flussi e la revisione in produzione, trova il record di deploy a cui potrebbe tornare, elenca i suoi diagrammi e calcola quali logger in esecuzione il file riavvierebbe. Poi, se nulla richiede un sì, procede stazione per stazione in ordine di nome.

1. **Distribuisce** il file con la revisione vista dal piano, così un deploy fatto da qualcuno nel frattempo viene rifiutato invece di essere sovrascritto. Si riavvia solo ciò che è cambiato. Le credenziali non viaggiano mai: ogni stazione conserva le proprie password, e le scritture di uno strumento restano disattivate finché qualcuno su quella stazione non le attiva.
2. **Verifica.** La stazione deve rispondere con la revisione che ogni stazione deve avere. La revisione deriva dal contenuto del file, quindi lo stesso file è la stessa revisione ovunque, e l'invio dice quale sia prima di iniziare. Ogni diagramma del file che parte da solo deve essere sulla stazione, senza problemi, e in esecuzione o terminato entro il tempo di assestamento. Anche un nodo che non è partito fa fallire la verifica.
3. **Una stazione che fallisce la verifica torna indietro.** Viene riportata al deploy in cui si trovava, come un deploy a sé, e si verifica che sia sulla sua vecchia revisione. L'invio si ferma lì.

Il report dice cosa è successo a ogni stazione:

| Stato | Significato |
|---|---|
| `done` | Distribuita e superata la verifica. |
| `unchanged` | Già su questa revisione, e i suoi diagrammi sono come devono essere. |
| `failed` | Non distribuita (la stazione l'ha rifiutata, o qualcuno ha distribuito nel frattempo), oppure già su questa revisione e non a posto. Non è stato cambiato nulla. |
| `reverted` | Ha fallito la verifica ed è tornata alla revisione che aveva. |
| `revert-failed` | Ha fallito la verifica e non è stato possibile riportarla indietro. Questa richiede una persona. |
| `skipped` | Non toccata. Non ha risposto, oppure non ha un record di deploy della sua revisione in produzione, quindi un invio fallito non avrebbe potuto essere annullato lì. Distribuite una volta a mano, oppure sistemate il collegamento, e inviate di nuovo. |
| `not-started` | L'invio si è fermato prima di questa stazione. È com'era. |
| `planned` | La risposta di una simulazione. |

Le stazioni saltate non fermano l'invio. Un invio è ripetibile: una stazione già sulla revisione è `unchanged`, quindi un secondo invio completa solo ciò che il primo non ha fatto.

## Riavvii

Un diagramma che parte da solo è un logger. Distribuirne uno modificato lo riavvia, e uno rimosso si ferma. Un invio che farebbe questo a un logger in esecuzione si ferma prima di toccare qualsiasi cosa, e il report nomina ogni stazione e ogni logger. Poi una di tre cose lo lascia procedere:

- rispondete sì al prompt, quando il comando è eseguito in un terminale;
- passate `-confirm-restart`;
- l'ora rientra nella finestra indicata con `-window`.

Niente si riavvia senza una di esse. Un diagramma che non è cambiato mantiene la sua esecuzione, e uno nuovo parte semplicemente.

## Da un'istanza, e per un agente

Un'istanza può inviare alle stazioni del proprio tenant tramite la sua API di amministrazione, che è ciò che usano gli strumenti MCP `list_stations` e `push_to_stations`. Impostate tutte e quattro le seguenti, nel file di configurazione sotto `stations:` o tramite ambiente, e compaiono le rotte `GET /stations` e `POST /stations/push`. Senza di esse non esistono.

| Impostazione | Ambiente | Cos'è |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | La dashboard EmberNet che conosce le installazioni del tenant. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | L'unico tenant per cui questa istanza invia. Una richiesta non può nominarne un altro. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | Un file che contiene il token della dashboard. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | Un file che contiene il token di deploy che le stazioni accettano. |

Nel chart sono `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` e `stations.deployTokenSecret`, ciascun Secret con un solo token e montato come file; con Podman e Quadlet sono le quattro variabili d'ambiente e i due segreti montati in [Distribuzione di Flow](/it/flow/deploying/). Impostatele tutte e quattro o nessuna: un render del chart con solo alcune viene rifiutato, e così un avvio con solo alcune.

`POST /stations/push` richiede `flows.write` e accetta `{flows, note, confirmRestart, window, windowZone, dryRun}`. Se omettete `flows`, invia ciò che esegue questa istanza. Risponde con lo stesso report, più `ok`, e un invio compare nel registro di audit come `stations.push`. `GET /stations` richiede `flows.read`. Un invio che attende un sì risponde con `needsConfirm` true e non ha cambiato nulla: inviatelo di nuovo con `confirmRestart` o una finestra.

## Cosa non è dimostrato

La forma dell'elenco della dashboard è stata letta dalla dashboard in produzione per un tenant reale. Non è mai stato fatto un invio alle stazioni di un tenant tramite Flux, quindi verificare se l'indirizzo fornito dalla dashboard è raggiungibile da dove eseguite l'invio spetta a voi, con `stations list` e un `-dry-run`.
