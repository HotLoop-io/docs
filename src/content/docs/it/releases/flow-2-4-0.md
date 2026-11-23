---
title: "Note di rilascio: HotLoop Flow 2.4.0"
description: "Cosa porta HotLoop Flow 2.4.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 permette alla dashboard EmberCORE di far accedere le persone a Flow. Chi apre Flow dalla dashboard entra con il ruolo che il suo tenant gli ha dato, accesso completo o sola lettura, senza un secondo accesso. È disattivato finché non si configura la chiave della dashboard, e nulla di ciò che funzionava prima cambia.

## Novità

**Accesso dalla dashboard EmberCORE**
- La dashboard mette un token che ha firmato in `X-Embernet-Assertion` su ogni richiesta che inoltra a Flow, websocket dell'editor compreso. Flow lo verifica con la chiave pubblica della dashboard: la firma (ES256), l'emittente (`embernet-dashboard`), che sia stato creato per questo Flow in questo tenant (l'audience è `<tenant>/<release>`, quindi un token per un'altra app qui non apre nulla) e la scadenza, circa un minuto. Un token sbagliato in uno qualsiasi di questi punti viene rifiutato, e nient'altro nella richiesta lo salva.
- Il ruolo viene dalla mappa dei ruoli del tenant nella dashboard. `*` è ogni permesso. `read` sono i flussi, la tavolozza, le impostazioni e lo stato, e nulla che li modifichi: né deploy, né inject, né registro dei deploy. Operatori e Visualizzatori ricevono `read` per impostazione predefinita. Un ruolo che non è né l'uno né l'altro, o nessuno, non ha accesso. Chi accede così compare nel registro dei deploy e nel registro di audit come `dashboard:<email>`.
- Non c'è sessione. La dashboard invia un token nuovo a ogni richiesta, quindi un ruolo cambiato lì ha effetto alla richiesta successiva e non c'è nulla da revocare.
- L'editor dice "Aprilo dalla dashboard EmberCORE" invece di offrire un proprio modulo di accesso, e toglie il pulsante Esci quando è stata la dashboard a farti accedere. `GET /auth/mode` è il modo in cui lo chiede, prima che qualcuno abbia effettuato l'accesso.
- Il chart lo accoglie sotto `embernetSignin`. L'App Store passa la chiave pubblica della dashboard; il chart la monta, scrive le impostazioni, riavvia il pod e annota il Service perché la dashboard sappia di dover far accedere le persone.

## Cosa è cambiato

Niente, a meno che tu non imposti la chiave. Senza file della chiave, Flow non legge affatto l'intestazione, e un `helm template` dei valori predefiniti è quello di prima.

## Aggiornamento

Un semplice `helm upgrade` all'immagine e al chart della 2.4.0. Al primo avvio non succede nulla.

Per usarlo a mano, monta la chiave pubblica della dashboard (un file PEM) e imposta `auth.assertion.publicKeyFile` e `auth.assertion.audience`, oppure `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` e `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow rifiuta di partire con una chiave che non riesce a leggere o senza audience. Le altre impostazioni sono `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) e `hideLogin` (`true`).

L'accesso amministratore e i token API continuano a funzionare accanto. Sono l'accesso di emergenza per il personale e l'automazione, e la scomparsa del modulo dell'editor non li tocca.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag contiene il resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
