---
title: "Autenticazione e utenti"
description: "Accessi, ruoli, token e schermata degli utenti, e ciò che un'installazione dietro un proxy attendibile deve dichiarare apertamente per farne a meno."
---

HotLoop ha un proprio accesso dalla 4.4.0, e ogni prodotto lo richiede per impostazione predefinita. Funzionare senza resta possibile, di proposito, per un'installazione davvero isolata dietro la dashboard che vuole dichiararlo, vedi [Funzionare senza accesso](#funzionare-senza-accesso), ma un semplice `helm install` o un'unità Podman Quadlet ora parte richiedendolo.

## In breve

- **Utenti locali, password bcrypt, sessioni sul server.** Non c'è ancora un provider di identità esterno; vedi [MCP](/it/iot/mcp/) per il perimetro separato a token bearer che protegge l'interfaccia degli agenti, e che questo non sostituisce.
- **Tre ruoli: admin, operator, viewer.** L'admin può fare tutto, inclusa la gestione degli utenti. L'operator può leggere tutto e scrivere tag, riconoscere gli allarmi e avviare le automazioni. Il viewer può leggere tutto e nient'altro. A un utente si può anche dare un elenco esplicito di autorizzazioni al posto di un ruolo, per tutto ciò che è più ristretto.
- **Una sessione è un cookie o un token bearer**, quello che al client riesce più comodo. L'interfaccia del browser usa il cookie; uno script o un altro servizio usa `Authorization: Bearer <token>`.
- **Un pannello condiviso fa accedere le persone con un PIN o un badge** e le disconnette quando nessuno lo tocca, così ogni scrittura porta il nome di una persona. Vedi [Pannelli kiosk](#pannelli-kiosk-pin-o-badge-e-disconnessione-per-inattività).
- **Le sessioni scadono.** `HOTLOOP_AUTH_SESSION_TTL`, 12 ore per impostazione predefinita. Non esiste "ricordami": una sessione che dura più di un turno di lavoro è una sessione che nessuno sorveglia.

## Ottenere il primo account

Il chart ne genera uno alla prima installazione e lo mostra una sola volta, nell'output NOTES di `helm install`:

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Se avviate direttamente il binario, generate un hash e impostate due variabili:

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` accetta anche `-password` direttamente, per uno script che ne ha già una:

```sh
hotloop hash-password -password 'something-long'
```

L'account admin così creato è un **avvio iniziale**, non un interruttore di reimpostazione. Una volta che esiste, cambiare `HOTLOOP_ADMIN_PASSWORD_HASH` e riavviare non fa nulla: `EnsureAdminUser` crea l'account solo se quel nome utente non esiste già, così un valore qui non può mai sovrascrivere una password che un operatore ha poi cambiato dall'interfaccia. Conta soprattutto in un aggiornamento Helm: riapplicare lo stesso `values.yaml` non deve ripristinare in silenzio la password di qualcuno.

## Ruoli

| Ruolo | Cosa può fare |
|---|---|
| **admin** | Tutto: `*`. Compreso creare, disabilitare ed eliminare utenti. |
| **operator** | Leggere ogni schermata. Scrivere tag (`POST /api/write`) e comandare entità (`POST /api/services/...`), impostare helper (`helpers.write`, vedi [Helper](/it/iot/helpers/)), avviare e fermare script (`scripts.run`, vedi [Script](/it/iot/scripts/)), applicare ricette (`recipes.apply`, vedi [Ricette](/it/iot/recipes/)), creare una regola da un blueprint e aggiornarla (`blueprints.apply`, vedi [Blueprint](/it/iot/blueprints/)), vedere le dashboard offerte al ruolo (`dashboards.read`, vedi [Dashboard](/it/iot/dashboards/)), leggere l'energia usata e quanto è costata (`energy.read`, vedi [Energia](/it/iot/energy/); creare un contatore o una tariffa è `energy.write`, compito di un admin), riorganizzare la bacheca, riconoscere, sospendere e riattivare gli allarmi, avviare le automazioni. Non può modificare le *definizioni* di dispositivi, tag, allarmi, automazioni, script, ricette, blueprint o dashboard, e non può gestire gli utenti. |
| **viewer** | Leggere ogni schermata. Nient'altro. |

A un utente si può dare un elenco esplicito di `permissions` al posto di un ruolo, che **sostituisce** del tutto il ruolo anziché aggiungersi: un utente è "il ruolo operator" oppure "esattamente queste autorizzazioni", mai entrambi, così c'è un solo posto dove guardare per sapere cosa può fare qualcuno.

Le stringhe di autorizzazione hanno la forma `resource.action`, `tags.write`, `alarms.ack`, oppure un carattere jolly di risorsa, `tags.*`, o il jolly globale `*`.

## Pannelli kiosk: PIN o badge, e disconnessione per inattività

Sul vostro computer siete già connessi: avete digitato la password una volta, e una scrittura passa dritta dal write gate e vi viene attribuita, come sempre. Questo non è cambiato. Un pannello a parete non è il computer di nessuno. Se è connesso come `panel-3`, la traccia di controllo dice "panel-3 ha aperto la valvola", e questa non è una traccia di controllo. Quindi un pannello fa accedere una persona con un PIN o un badge, ogni scrittura è di quella persona, e il pannello la disconnette quando nessuno lo tocca.

### Cosa vede l'operatore

Un pannello è uno schermo fisico: HotLoop aperto su `/?screen=<name>` (vedi [Dashboard](/it/iot/dashboards/#ruoli-e-schermi)). Senza nessuno connesso, mostra un solo campo, "PIN o badge", e nulla dell'impianto. Digitate il PIN e premete Invio, oppure passate il badge. Il pannello apre la sua dashboard, con chi è connesso e un pulsante **Esci** nell'angolo, perché l'intestazione che normalmente lo direbbe su un pannello non c'è. Premere un pulsante di scrittura chiede la conferma e il motivo come altrove, e la scrittura è registrata a nome di quella persona.

Dopo il limite di inattività senza che nessuno tocchi lo schermo, il pannello disconnette la persona e torna al campo del PIN. Lo applica anche il server, non solo la pagina: una sessione kiosk rimasta inattiva così a lungo viene eliminata, e una scrittura inviata dopo con il suo cookie viene rifiutata con un `401`, così chiudere la pagina, o una pagina bloccata, non lascia nessuno connesso. Se il pannello deve essere usato con una password, "Usa una password" sotto il campo è l'accesso ordinario, con le solite 12 ore e senza limite di inattività, perché è l'accesso personale di qualcuno.

Conta come toccare: un tocco, un clic, un tasto o una scrittura. Non conta: la dashboard che aggiorna i suoi valori, né il flusso in tempo reale, che proseguono che ci sia qualcuno o no.

### Configurazione

Un admin dà a ciascuna persona un codice in **Impostazioni, Utenti**: **PIN o badge** sulla sua riga, il codice due volte, **Imposta**. Oppure tramite l'API, che è ciò che userebbe uno script che emette badge:

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **Un PIN è una credenziale.** È memorizzato come hash bcrypt con lo stesso costo di una password, mai in chiaro, mai nel log di sistema e mai in una risposta. L'elenco degli utenti dice solo `hasPin`. Un backup conserva gli hash esattamente come quelli delle password ([Backup e ripristino](/it/iot/backup/)).
- **Un badge è un valore digitato da un lettore a tastiera.** Non c'è un driver hardware. Un lettore che si comporta come una tastiera digita il numero del badge nell'unico campo del pannello e preme Invio, che è l'invio del modulo. Quindi un badge è un codice come un PIN: ciò che digita il lettore, da 6 a 72 caratteri senza spazi, impostato sull'account nello stesso posto. Leggerlo da un lettore che non si comporta come una tastiera non è realizzato.
- **Un codice, un account.** Il pannello trova la persona dal solo codice, dato che un lettore di badge non digita un nome utente, quindi impostare un codice che ha già un altro account viene rifiutato.
- **Il codice viene verificato rispetto a ogni account che ne ha uno,** con lo stesso bcrypt che costa una password, perché un hash con salt non si può cercare per valore. Ci mette tanto quanti sono gli account con un codice, un paio di secondi al massimo con decine di account, e ci mette lo stesso tempo che il codice sia giusto o sbagliato.
- **Un codice accede con il ruolo dell'account.** Datelo a chi ha il ruolo che deve avere a un pannello. Una sessione kiosk ha le autorizzazioni proprie dell'account e nulla di più ristretto, e il codice di un viewer fa accedere un viewer, le cui scritture il gate rifiuta come sempre.
- **Disabilitare un account** termina le sue sessioni di pannello insieme alle altre, e il codice di un account disabilitato non accede. **Togliere il codice** disconnette l'account dai pannelli e lascia stare la sua password e la sessione del suo computer.

### Il tempo di disconnessione per inattività

Quindici minuti per impostazione predefinita. È abbastanza lungo per gestire un cambio di lavorazione al pannello con una cartella in mano, o per andare alla valvola e vederla muoversi, e abbastanza breve perché un pannello lasciato alla fine di un lavoro non porti ancora il nome di qualcuno quando arriva la persona dopo. È un mio giudizio, non un numero fissato dal codice o da una norma. Cambiatelo in **Impostazioni, Stabilimento, Disconnessione kiosk per inattività (secondi)**, da 10 secondi a 12 ore, senza ridistribuire, oppure impostate un valore predefinito con `HOTLOOP_AUTH_KIOSK_IDLE` (una durata, `15m`). Ciò che è impostato in Impostazioni prevale sulla variabile. La sessione termina comunque a `HOTLOOP_AUTH_SESSION_TTL`, come ogni sessione.

### Il blocco dopo password e PIN errati

Una password o un PIN errati vengono contati sull'**account** su cui sono stati provati. Dieci errori di fila bloccano quell'account per cinque minuti, e nessun altro. Una password o un PIN corretti prima del decimo fanno ripartire il conteggio, e un blocco scaduto ne dà dieci nuovi. Un account bloccato rifiuta un accesso qualunque cosa si digiti, giusta o sbagliata, con un `429` che dice quanto attendere. Un blocco ferma i nuovi accessi e nient'altro: una sessione che l'account ha già prosegue, con le sue richieste e il suo flusso in tempo reale, così dieci tentativi sbagliati di qualcun altro non possono spegnere lo schermo di un operatore sulla linea. Vale sia per l'accesso con password sia per quello con PIN, e ogni blocco è nel log di sistema (categoria `auth`).

- **Da dove vengono i numeri.** NIST SP 800-63B dice che un verificatore limita i tentativi falliti consecutivi su un singolo account: la revisione 3, sezione 5.2.2, e la revisione 4, sezione 3.2.2, fissano entrambe il massimo a 100 e dicono che un operatore può fissarlo più basso. La revisione 4 permette anche di far attendere il richiedente dopo i fallimenti. Questa è quell'attesa, non una disabilitazione permanente. Dieci è un decimo del tetto del NIST, e più di quanto nessuno sbagli per caso. Cinque minuti sono abbastanza per far restare fuori portata, con dieci tentativi ogni cinque minuti, il milione di possibilità di un PIN di sei caratteri (circa 350 giorni per provarle tutte), e abbastanza brevi perché un operatore che ha sbagliato a digitare la password sia di nuovo operativo dopo un caffè. Sei caratteri come minimo per un PIN è il limite della sezione 5.1.1.2 della revisione 3 per un segreto assegnato, quale è un PIN consegnato da un admin. Dieci e cinque sono una mia scelta entro il limite del NIST, non numeri del NIST.
- **Entrambi sono impostazioni.** **Impostazioni, Stabilimento**: "Blocca un account dopo questo numero di password o PIN errati" (predefinito 10, da 1 a 100, e 0 lo disattiva) e "Per quanto tempo un account resta bloccato" (predefinito 5 minuti, da 10 secondi a un giorno). Le variabili sono `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` e `HOTLOOP_AUTH_LOCKOUT_DURATION` (una durata, `5m`). L'impostazione prevale sulla variabile.
- **Un admin può sbloccare un account.** **Impostazioni, Utenti** mostra un account bloccato come `locked` con un pulsante **Sblocca**, oppure `DELETE /api/users/{username}/lockout`. Il conteggio riparte da zero.
- **Mai il pannello.** Un codice errato digitato a un pannello non viene mai contato contro il pannello, così gli errori di una persona non fermano la successiva.
- **Un codice da solo non si può contare, quindi il pannello viene rallentato.** Un lettore di badge digita solo il badge, e un PIN digitato da solo, se è sbagliato, non corrisponde ad alcun account, quindi non c'è un account su cui contarlo. Contarlo contro il pannello lascerebbe fuori il lavoratore successivo per gli errori dell'ultimo, e il pannello non viene mai bloccato. Invece ogni errore consecutivo fa attendere quel pannello mezzo secondo in più prima di controllare il successivo: 0,5 secondi dopo il primo errore, 1 dopo il secondo, e così via fino al tetto, 3 secondi per impostazione predefinita. Uno giusto fa ripartire. Così il lavoratore successivo entra al massimo dopo il tetto, e chi tira a indovinare è limitato a un tentativo per tetto e per pannello: un milione di PIN a sei cifre richiederebbe più di un mese. I tentativi inviati insieme si mettono in coda e ciascuno attende il suo turno. Un PIN digitato con il suo nome utente non viene rallentato: è dell'account, e lo blocca come una password errata. L'attesa massima è in **Impostazioni, Stabilimento, Attesa massima di un pannello dopo PIN errati (secondi)**, da 0 a 30, con `HOTLOOP_AUTH_PANEL_DELAY_CAP` come valore predefinito (una durata, `3s`) e 0 per disattivarla. Tre secondi sono una pausa che un lavoratore che ha sbagliato può sopportare, e abbastanza lenti da pesare per chi prova ogni codice. Il passo di mezzo secondo è fisso.
- **Quale pannello è quale.** L'indirizzo del client: il primo salto di `X-Forwarded-For` quando un proxy l'ha impostato, altrimenti quello della connessione stessa, che è anche ciò che registra l'elenco delle sessioni. Prima dell'accesso non si sa niente di meglio: non c'è ancora una sessione, e un cookie consegnato dal server è uno che il client può buttare per far ripartire l'attesa. Quindi dietro un proxy che imposta `X-Forwarded-For` ogni pannello attende per conto suo. Dietro uno che non lo fa, tutti i pannelli condividono l'indirizzo del proxy e si rallentano a vicenda, al massimo del tetto. E un client che raggiunge direttamente la porta può inviare un proprio `X-Forwarded-For` e schivare l'attesa. Per questo è un rallentamento e il blocco dell'account è il controllo: per un tentativo che conta, usate la forma con nome utente, oppure valori di badge lunghi e casuali.
- **Dice che l'account esiste.** Il `429` è per un account che esiste, quindi dice a chi prova dei nomi quali esistono. È ciò che è un blocco.

### Cosa non fa

- **Un codice da solo non si può bloccare.** Vedi [Il blocco](#il-blocco-dopo-password-e-pin-errati), che spiega perché.
- **Nessun avviso prima della disconnessione.** Il pannello torna al campo del PIN quando il tempo è scaduto.
- **Un pannello lasciato connesso con una password** (come andava usato un pannello prima di questo) funziona ancora come prima e scrive ancora come quell'account. Non date a un pannello condiviso un accesso da operatore permanente; date un PIN alle persone che lo usano.
- **Nessun driver per lettori, nessun SSO, nessuna autorizzazione per pannello.**

## Gestire gli utenti

Solo admin. Nell'interfaccia è **Impostazioni, Utenti**: ogni account con il suo ruolo, se è attivo e quando ha fatto l'ultimo accesso, con Aggiungi un utente, Modifica (ruolo, e disattivazione), Nuova password ed Elimina. Non viene disegnato nulla per chi non ha `users.manage`, né quando l'autenticazione è disattivata. Un account le cui autorizzazioni sono state elencate una per una appare come `custom` con quante sono, e Modifica mantiene l'elenco a meno che non scegliate un ruolo, che lo sostituisce. Le stesse operazioni tramite l'API REST:

Una password è di 8-72 byte: 72 è il limite proprio di bcrypt, e una più lunga viene rifiutata dicendolo. Funziona allo stesso modo via OPC UA (vedi [Il server OPC UA](/it/edge/opc-ua-server/#chi-può-accedere)); nelle versioni precedenti una password di oltre 64 byte poteva accedere qui e non là.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

Due rifiuti vale la pena conoscerli prima che sorprendano qualcuno:

- **Non potete eliminare il vostro account mentre siete connessi con esso.** Passate prima a un altro account admin.
- **Non potete disabilitare né eliminare l'ultimo account admin attivo.** Promuovete un secondo account ad admin, o lasciatene uno in pace, prima di togliere il primo. Senza questo controllo, un solo errore in una sincronizzazione scriptata degli utenti è un blocco senza più nessuna sessione admin da cui annullarlo.

Qualsiasi utente connesso può cambiare la propria password senza nessuna delle due restrizioni:

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

Un cambio di password revoca ogni sessione che quell'account possiede, compresa quella che ha fatto la richiesta. Il client deve accedere di nuovo.

## Le credenziali dei dispositivi sono in sola scrittura

Aggiunto nella 4.15.1. Prima, `GET /api/devices` e `GET /api/devices/{id}` restituivano il `config` e l'`address` di un dispositivo esattamente come memorizzati, così qualsiasi utente connesso, viewer compresi, poteva leggere la password del broker MQTT, le credenziali HTTP e MTConnect, e qualsiasi altra cosa salvata in un dispositivo. La 4.15.0 nascondeva solo la password OPC UA. Dalla 4.15.1 le credenziali di un dispositivo non si possono rileggere tramite l'API da nessun ruolo, **admin compreso**. Per cambiarne una si invia un nuovo valore.

### Cosa conta come credenziale

| Protocollo | Nascosto nella configurazione | Nascosto anche |
|---|---|---|
| MQTT | `password` | le informazioni utente e i valori segreti della query nell'indirizzo (`mqtt://user:pass@broker`) |
| HTTP | `password`; ogni valore in `headers` tranne alcuni semplici (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`); `body` e `writeBody` quando citano una credenziale (`password`, `token`, `apiKey`, e simili); un valore di query dall'aspetto segreto in `writeUrl` | le informazioni utente e i valori segreti della query nell'indirizzo e in `writeUrl` |
| MTConnect | `password`; ogni valore in `headers`, con le stesse eccezioni | le informazioni utente e i valori segreti della query nell'indirizzo |
| OPC UA | `password` | anche le informazioni utente nell'indirizzo sono nascoste, e il driver le ignora, dato che l'URL di un endpoint OPC UA non porta credenziali |
| Modbus, S7comm, EtherNet/IP | nessuna delle loro opzioni è una credenziale | le informazioni utente nell'indirizzo sono nascoste e ignorate dal driver, per lo stesso motivo |

Il percorso di un file di chiave (`keyFile`) non è materiale di chiave e viene mostrato. Neppure un flag come `allowInsecureCredentials`.

Gli elenchi qui sopra sono verificati nel codice. Un test legge la struttura delle opzioni di ogni driver e fallisce quando un'opzione non è né nell'elenco delle credenziali né in quello delle opzioni note per non esserlo (`plainConfigKeys`), quando una mappa di voci libere o un campo di testo libero non è nell'elenco delle credenziali, e quando uno dei due elenchi nomina qualcosa che nessun driver legge. Così una nuova opzione non può essere rilasciata senza che qualcuno decida di quale si tratta.

Come rete di sicurezza sotto gli elenchi, qualsiasi chiave a qualsiasi profondità della configurazione di un dispositivo viene nascosta per nome, in qualsiasi protocollo, quando contiene `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid` o `connectionstring`, oppure termina con `key`, oppure ha come parola intera una tra `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin` o `psk`. Le parole sono separate alla punteggiatura e ai passaggi da minuscola a maiuscola, quindi `db_pass`, `smtp_pw`, `apiAuth` e `sasToken` contano, e `bypass`, `compass`, `passive`, `authority` e `pinned` no. Maiuscole e punteggiatura sono ignorate, come le grafie che `encoding/json` leggerebbe comunque come la stessa chiave (una s lunga per s, il segno Kelvin per k). La regola delle parole brevi è brusca di proposito: una chiave che nessuno ha esaminato, come `authMode`, resta nascosta finché non viene aggiunta a `plainConfigKeys`.

Un valore nascosto per nome, e tutto ciò che sta sotto una chiave del genere, viene sostituito qualunque sia il suo tipo (un numero viene nascosto come una stringa), tranne un booleano, che non può essere una credenziale. Una stringa che porta una credenziale nel suo testo viene nascosta per intero ovunque sia: una riga di comando con `--password hunter2`, una coppia `password=...` o una stringa di connessione, `Authorization: Bearer ...`. Un dispositivo senza credenziale impostata non ne mostra nessuna, così "nessuna password" e "una password che non posso vedere" si distinguono. Una configurazione che non si può leggere come JSON viene mostrata come `{}` anziché così com'è.

Un valore nascosto appare come `[redacted]`. In un indirizzo sostituisce la password e mantiene il nome utente (`http://svc:[redacted]@meter/api`), oppure l'intera informazione utente quando non ci sono i due punti, e il valore di ogni parametro dall'aspetto segreto della query e del frammento (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). I parametri sono separati da `&` o `;`, o dalle loro forme con percentuale `%26` e `%3B`, e ciascuno è giudicato da solo, quindi `?fmt=json` resta leggibile. Un parametro chiamato `code` conta come segreto in un indirizzo, per la chiave di Azure Functions in `?code=`, e in nessun altro posto. Una query che non si può leggere in modo pulito (un escape percentuale non valido, un carattere di controllo) viene nascosta per intero anziché indovinata.

### Salvare un dispositivo

`POST /api/devices` crea un dispositivo quando l'id è nuovo e lo sostituisce quando l'id esiste. Non c'è un `PUT` separato. Per ogni credenziale nell'indirizzo e nella configurazione:

| Cosa invia la richiesta | Risultato |
|---|---|
| Un nuovo dispositivo con un valore reale | Il valore viene memorizzato così com'è. |
| Un nuovo dispositivo con `[redacted]` | Rifiutato con un 400. Il segnaposto non viene mai memorizzato come credenziale. |
| Un dispositivo esistente, `[redacted]` | Il valore memorizzato viene mantenuto. |
| Un dispositivo esistente, chiave omessa | Il valore memorizzato viene mantenuto. Un client che non conosce i segreti non può cancellarne uno per errore. |
| Un dispositivo esistente, una nuova stringa o un nuovo numero | Sostituisce il valore memorizzato. |
| Un dispositivo esistente, una stringa vuota o `null` | Cancella il valore memorizzato. È l'unico modo per rimuovere una credenziale. |
| `[redacted]`, senza nulla di memorizzato da mantenere | Rifiutato con un 400. |

Il segnaposto non viene mai memorizzato, ovunque compaia in una configurazione o in un indirizzo: viene sostituito dal valore memorizzato nello stesso punto, oppure rifiutato quando non ce n'è.

Due dettagli. Dentro `headers` (una mappa le cui voci sono state scelte dalla persona) l'unità è la mappa: una voce omessa viene rimossa, `{}` le cancella tutte, e omettere l'intera chiave `headers` le mantiene. Una chiave viene confrontata senza distinguere le maiuscole, come la confrontano i driver. E tutto ciò che non è una credenziale viene sostituito come sempre: un dispositivo salvato senza alcun `config` mantiene le sue credenziali e nient'altro.

L'editor dei dispositivi dell'interfaccia web mostra la configurazione di un dispositivo come la restituisce l'API, segnaposto compresi, e salva ciò che mostra. Modificare un dispositivo senza toccare una credenziale la mantiene quindi. **Per cambiare un segreto nell'interfaccia, sostituite il `[redacted]` nella configurazione (o nell'indirizzo) con il nuovo valore.** Nulla viene precompilato con il vecchio, quindi chi modifica un dispositivo deve conoscere la credenziale per cambiarla.

### Spostare un dispositivo non porta con sé i suoi segreti

Le credenziali mantenute vengono inviate a qualunque cosa il dispositivo indichi. Se fossero mantenute quando un dispositivo viene spostato, chiunque possa salvare un dispositivo potrebbe leggere una credenziale memorizzata puntandolo a un ascoltatore proprio e lasciando che il gateway la presenti. Perciò, quando un salvataggio cambia l'host o la porta nell'indirizzo, o in `writeUrl`, e manterrebbe una credenziale memorizzata (per segnaposto o per omissione), viene rifiutato con un 400 che nomina le credenziali. Inseritele di nuovo, oppure inviate una stringa vuota per cancellarle. Cambiare il percorso, lo schema o qualsiasi altra cosa del dispositivo non conta come spostamento, e un dispositivo senza credenziale memorizzata si può spostare liberamente.

### Dove una credenziale non compare

Per un dispositivo di ogni protocollo, con una credenziale in ogni posto possibile, i test la cercano in: ogni endpoint dei dispositivi (risposte di elenco, lettura, creazione e aggiornamento) per un viewer, un operator e un admin; ogni altro endpoint di lettura; `/api/diagnostics` e `/api/status`; `/api/sites` e i server MCP in uscita che elenca; il flusso di eventi in tempo reale; il log di sistema e il controllo delle scritture; le risposte di errore; ogni strumento e risorsa MCP; e il log del processo a livello debug, dal runtime e dai driver. Il testo di errore di un driver e gli eventi e i log del runtime vengono ripuliti dalle credenziali di un dispositivo, per valore e per forma, perché un errore può ripetere un indirizzo o la risposta di un server. Una credenziale di uno o due caratteri viene sostituita solo dove compare come parola a sé, dato che sostituirla ovunque rovinerebbe il messaggio.

### Dove le credenziali restano in chiaro

Sola scrittura riguarda l'API. Il gateway ha bisogno dei valori reali per connettersi, e questi posti li conservano come sono memorizzati:

- **Il database.** Le credenziali dei dispositivi sono nelle colonne `config` e `address`. Con `HOTLOOP_SECRET_KEY_FILE` impostato, quelle con chiave in `config` (ogni `password`, i valori delle intestazioni) sono cifrate con una chiave tenuta fuori dal database, e così un indirizzo o un'opzione con una credenziale scritta nel testo (`mqtt://user:pass@host`, `?token=`), sigillati per intero. Vedi [Backup e ripristino](/it/iot/backup/#credenziali-dei-dispositivi-e-chiave-segreta).
- **I backup.** `devices.copy` in un backup le contiene, cifrate o no esattamente come il database. Vedi [Backup e ripristino](/it/iot/backup/#proteggere-i-file-di-backup).
- **I file dei dispositivi dell'Edge Relay.** Il relay legge un file JSON che porta le credenziali dei suoi dispositivi. Vedi [Riferimento di Edge Relay](/it/edge-relay/reference/#credenziali-nel-file-dei-dispositivi-4150).
- **L'invio della configurazione alla flotta.** Un file dei dispositivi inviato a un relay viene pubblicato così com'è su un topic MQTT, retained. Vedi [Gestione della flotta](/it/gateway/fleet/).

Proteggete di conseguenza il database, il volume dei backup, il file dei dispositivi del relay e il broker. Oscurare l'API non cambia nulla di tutto questo.

### Se utenti non fidati potessero raggiungere l'API

Prima della 4.15.1, qualsiasi utente connesso poteva leggere le credenziali dei dispositivi memorizzate tramite l'API. Un operatore il cui gateway era raggiungibile da utenti che non avrebbero dovuto averlo (un account viewer dato a un appaltatore, per esempio) dovrebbe ruotare le credenziali dei dispositivi che contiene: il broker MQTT, gli endpoint HTTP e MTConnect, e gli account OPC UA. Dalla 4.3.1 non c'è stata nessuna versione pubblica, quindi l'esposizione è limitata alle installazioni di build non rilasciate.

## Cosa registra la traccia di controllo

Ogni scrittura passava già da `write_audit` con una colonna `actor`, vedi il write gate nel README principale. Quella colonna ora viene dalla sessione, non da un'intestazione, e a un pannello kiosk la sessione è la persona che ha effettuato l'accesso con il suo PIN o badge:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

registra `j.smith`, il nome utente della sessione che ha fatto la chiamata, non ciò che `X-Forwarded-User` aveva da dire. Gli accessi, gli accessi kiosk, le disconnessioni, i cambi di password e ogni azione di gestione degli utenti, compreso impostare o cancellare un PIN (mai il PIN stesso), sono registrati nel log di sistema (`GET /api/events`, categoria `auth`) per la stessa ragione per cui esiste il controllo delle scritture: un cambiamento tra sei mesi deve poter essere spiegato, non solo visto.

## Funzionare senza accesso

Impostate `HOTLOOP_AUTH_INSECURE=true` (o `auth.insecure: true` nel chart) per funzionare esattamente come ogni versione precedente alla 4.4.0: nessuna sessione richiesta, l'attore registrato per una scrittura viene da `X-EmberNET-User` o da intestazioni di proxy simili, e ricade su `"operator"` se non ce n'è nessuna.

È una scelta reale e difendibile per un'installazione in cui la NetworkPolicy della dashboard EmberNet è il vero perimetro e nient'altro può raggiungere il pod. Non è più l'impostazione predefinita perché è facile credere che quella condizione sia vera e difficile verificarla da dentro il pod: il senso della 4.4.0 è che un errore in una NetworkPolicy, o un'installazione che si scopre non essere dietro la dashboard dopotutto, non deve significare anche che `actor(r)` restituisca qualcosa scelto da un attaccante.

`config.Validate` rifiuta di avviarsi con l'autenticazione né abilitata né riconosciuta in questo modo, proprio perché "nessuna autenticazione" sia sempre una decisione che qualcuno ha preso di proposito, scritta nella configurazione stessa dell'installazione, e non un valore predefinito che nessuno ha scelto.

## Accedere dalla dashboard EmberNet

Un tenant che installa HotLoop dall'App Store EmberNet va da LAUNCH nell'app già connesso come sé stesso, senza che venga distribuita alcuna password. L'host delle app della dashboard mette `X-Embernet-Assertion` su ogni richiesta che porta a questo pod: un token ES256, valido per circa un minuto, firmato con una chiave privata che solo la dashboard possiede. Nomina la persona (`email`), il tenant, l'unica app per cui è stato fatto (`aud`, `<tenant>/<Service name>`) e il ruolo HotLoop a cui il tenant associa il ruolo dashboard di quella persona (`role`: `admin`, `operator` o `viewer`).

È disattivato a meno che non sia configurata una chiave pubblica, e in tal caso tutto il resto funziona come prima: account locali, il cookie, il token bearer, il pannello kiosk.

| Variabile | Valore del chart | Cosa fa |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | la chiave PUBBLICA della dashboard, PEM PKIX, ECDSA P-256. Lo store la compila in fase di deploy. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | ricavato dal namespace e dal nome della release | `<tenant>/<Service name>`. Obbligatorio con la chiave; un token fatto per un'altra app o un altro tenant viene rifiutato. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Cosa fa un'asserzione valida: la persona ottiene un utente qui la prima volta che la dashboard garantisce per lei (con nome tratto dal suo indirizzo, senza password, quindi niente da indovinare), il ruolo dell'utente segue ciò che la dashboard ha inviato a ogni richiesta, e la traccia di controllo la nomina. Cosa fa una non valida: 401, e non viene messa da parte in silenzio a favore di un cookie di sessione che si trova lì per caso. Vengono rifiutati una firma errata, qualsiasi algoritmo diverso da ES256, un token scaduto o non ancora valido, uno che dura più di dieci minuti, un emittente errato, il pubblico di un'altra app o di un altro tenant, una dichiarazione di tenant in disaccordo con il pubblico, un ruolo che non è uno dei nostri e un nome senza indirizzo.

Un admin locale ha l'ultima parola su qualcuno che la dashboard ha lasciato entrare: disabilitate l'utente e resta fuori, dategli un elenco di autorizzazioni esplicito e lo mantiene. Le scritture hanno ancora bisogno degli interruttori di scrittura del pod; un'asserzione non li amplia mai. Uscire da una sessione creata dalla dashboard non la termina: l'accesso finisce alla prima richiesta che la dashboard smette di firmare.

## Cosa questo non copre ancora

- **Nessun OpenID Connect.** Account locali, più l'asserzione firmata della dashboard EmberNet descritta sopra. Un'integrazione con un provider di identità non è realizzata.
- **Nessun ruolo per tenant o per sito.** Le autorizzazioni di un utente sono le stesse ovunque giri il Gateway, il che va bene per un solo stabilimento e richiederebbe più riflessione per il riepilogo multisito in `Sites`.
- **Nessun blocco per un PIN o badge digitato da solo,** solo per una password e per un PIN con il suo nome utente; vedi [Il blocco](#il-blocco-dopo-password-e-pin-errati). Il confronto a tempo costante in `handleLogin` impedisce di enumerare i nomi utente dal tempo di risposta. Una NetworkPolicy o un proxy a monte resta utile davanti all'endpoint di accesso.
