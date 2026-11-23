---
title: "Note di rilascio: HotLoop core 4.21.0"
description: "Cosa porta HotLoop core 4.21.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.21.0"
---

Questa versione aggiunge l'accesso X.509 al server OPC UA, gli toglie il limite di 64 byte sulle password e disattiva per impostazione predefinita le policy di sicurezza obsolete. Amplia anche l'importazione degli allarmi CODESYS. Costruita sulla [4.20.2](/it/releases/hotloop-4-20-2/).

## Cosa è cambiato

- **Un client può accedere al server OPC UA con un certificato X.509.** Un amministratore allega il certificato pubblico del client a un utente HotLoop (Settings, OPC UA certificates, o l'API, o gli strumenti MCP), e un client che detiene la chiave privata accede come quell'utente con i suoi permessi. Revocare un certificato termina la sua sessione attiva entro dieci secondi, e ogni accesso con certificato e ogni rifiuto è nel logbook. È disattivato finché non si imposta `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`). Il driver del dispositivo può accedere allo stesso modo con `userCertificate` e `userPrivateKey` (RSA, la chiave sigillata come una password). Una CA fidata con una regola sul nome non è realizzata.
- **Le password da 65 a 72 byte ora accedono via OPC UA.** Hanno sempre funzionato nell'interfaccia web. La libreria su cui è costruito il server rifiutava qualsiasi token di nome utente la cui password superasse i 64 byte.
- **Le policy di sicurezza obsolete `Basic128Rsa15` e `Basic256` sono disattivate per impostazione predefinita.** Il server non le elenca più e un client che ne chiede una per nome viene rifiutato all'apertura del canale. Vale per le nuove installazioni e per gli aggiornamenti. Un client legacy che non parla nulla di più recente si connette di nuovo con `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`), e il server lo dice all'avvio. L'opzione di disattivarle è aperta anche a monte (pull request 66).
- **L'importazione degli allarmi CODESYS legge un allarme Outside range.** Export Alarms dell'IDE scrive `OutOfArea` per esso, e passa come due allarmi, un `lo` al limite inferiore e un `hi` a quello superiore. Inside the range, Change, Event e Alarm (API) sono elencati come saltati con il motivo: nulla qui li dice onestamente. L'importatore è stato ampliato a partire da un export di ogni tipo di osservazione che l'IDE offre, conservato come fixture di test.

## Modifiche all'API

- Novità: `GET /api/opcua/certificates`, `GET` e `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, tutte `users.manage`. Cinque nuovi strumenti MCP, 133 in tutto.
- Una migrazione, la 0027: la tabella `user_certificates` (solo certificati pubblici). È nel backup.

## Aggiornamento

Un normale `helm upgrade`, o l'auto-update di Quadlet. Controlla prima se qualcuno dei tuoi client OPC UA usa `Basic256` o `Basic128Rsa15` (lo mostra la connessione di Ignition): quel client smette di connettersi dopo l'aggiornamento finché non lo sposti su `Basic256Sha256` o non attivi l'interruttore legacy qui sopra. Un rollback alla versione precedente non è stato provato con la nuova tabella al suo posto.

- Tutti e quattro i chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) sono alla 4.21.0, con tutte le versioni precedenti ancora nell'indice.

- Questa build è solo amd64, e `stable` mantiene le immagini arm che ha. La versione successiva è un piccolo incremento di versione che costruisce le immagini arm.
