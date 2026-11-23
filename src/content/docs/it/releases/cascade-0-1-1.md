---
title: "Note di rilascio: HotLoop Cascade 0.1.1"
description: "Cosa include HotLoop Cascade 0.1.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "0.1.1"
---

## Di cosa si tratta

0.1.1 è la prima versione che non è una candidata. Esisteva un tag 0.1.0 che non ha mai pubblicato nulla: è stato annullato prima di arrivare al registro. Un tag non si sposta, quindi questo è lo stesso codice, finalmente pubblicato.

Cos'è: il motore di flussi di lavoro che volevamo per un impianto. Un solo binario Go statico, SQLite su una macchina o Postgres con worker quando serve di più, e l'editor incorporato nel binario, quindi non c'è altro da eseguire.

## Cosa contiene

Il motore, con ogni passo salvato come punto di controllo, così un `kill -9` nel mezzo di un'esecuzione riparte da dove si era fermata. Attese durevoli, nuovi tentativi, porte di errore e flussi di errore. Espressioni e un passo Code che esegue JavaScript isolato, in un processo tutto suo.

Webhook con una casella in ingresso durevole, pianificazioni che scattano esattamente una volta per ogni slot, a prescindere da quanti nodi principali le controllano, MQTT e un trigger per i file che arrivano in una directory. Un passo HTTP per tutto ciò che ha un'API e connettori per HotLoop, Postgres, EmberOps, email, ntfy, Gotify e Discord. Nessun altro, di proposito.

Un archivio di credenziali con rotazione delle chiavi, OAuth2 per ogni tipo di autorizzazione che serve a un impianto, accesso con password, TOTP, passkey o il tuo provider OpenID Connect, MFA obbligatoria, progetti e ruoli, un registro di controllo verificabile, ogni salvataggio conservato come versione e un'API con ambiti e un documento OpenAPI. Metriche, tracce e probe, così qualcuno oltre a me può capire quando qualcosa si blocca.

## Come si esegue

L'immagine è amd64 e arm64. Scaricala tramite il digest indicato sopra se vuoi un deploy che non possa spostarsi.

Su k3s: il chart Helm, standalone oppure diviso in server e worker.

Su una macchina normale: le unità Quadlet in `deploy/quadlet`, SQLite su una macchina o Postgres con worker aggiuntivi. Seguono `:stable`, e il timer di aggiornamento automatico di Podman le fa avanzare. Un aggiornamento che non parte in buona salute torna all'immagine che era in esecuzione. L'abbiamo provato davvero, in entrambe le varianti, su Podman 5.8.7 sotto systemd: l'avvio aspetta lo stato sano, un container terminato torna su, un buon aggiornamento passa, uno cattivo torna indietro e un flusso viene eseguito dopo ciascuno.

## Cose da sapere

Le migrazioni vanno solo avanti. Un rollback rimette l'immagine precedente, ma non annulla la migrazione del database: fai un backup prima di attivare gli aggiornamenti.

Il registro era privato per questa versione, quindi serviva prima un `podman login ghcr.io` come root. L'immagine e il chart sono pubblici dalla 0.1.2 in poi e si scaricano senza accesso.

Se perdi la chiave che protegge le credenziali salvate, ogni credenziale diventa illeggibile. Tienine una copia in un posto che non sia la macchina.

## Licenza

Cascade è sotto la Business Source License 1.1 (`BUSL-1.1`) di HotLoop, come il resto della gamma HotLoop. Non è open source e non farò finta che lo sia. Ogni versione diventa GPL-3.0 o successiva quattro anni dopo la prima pubblicazione. L'uso domestico e di laboratorio è gratuito, così come l'uso in produzione di scuole, organizzazioni non profit ed enti pubblici. L'uso aziendale passa da EmberNet, dove registrarsi è gratis e lo è anche l'uso aziendale. Non sono concessi l'hosting come servizio per altri, la rivendita e l'incorporazione in qualcosa che vendi. Il file `LICENSE` è il testo legale e prevale su questo paragrafo.

## Cosa non c'è ancora

SAML, LDAP, SCIM, ambienti, lo scheduler HA con lease, altri connettori, passi di IA. Questo è dalla 0.2.0 in poi, ed è tutto nella roadmap.
