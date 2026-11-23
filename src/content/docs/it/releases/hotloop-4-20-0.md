---
title: "Note di rilascio: HotLoop core 4.20.0"
description: "Cosa porta HotLoop core 4.20.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.20.0"
---

La nuova interfaccia web è ora quella su `/`, e un agente può cambiare tutto ciò che può leggere tramite MCP. Non ci sono migrazioni, e un normale `helm upgrade` o l'auto-update di Quadlet la prende. La versione precedente, la [4.19.11](/it/releases/hotloop-4-19-11/), è l'ultima le cui schermate predefinite erano quelle vecchie.

Questa build è solo amd64, e la versione successiva è un piccolo incremento di versione che costruisce le immagini arm, come vanno le due tornate. Nel frattempo `stable` mantiene le immagini arm che ha.

## Cosa è cambiato

- **La nuova interfaccia web è quella predefinita, e quella vecchia non c'è più.** Ogni schermata è stata ricostruita come pagina statica (Astro, con parti in Svelte), incorporata nell'unico binario, senza Node sul box e senza CDN. Era su `/next` per tutta la 4.19.x. Su `/` sono le stesse diciannove schermate con gli stessi controlli, campi, colonne, moduli e parole, per il visualizzatore, l'operatore e l'amministratore. Ciò che appare diverso, di proposito:
  - I colori sono lo sfondo caldo e l'arancione di HotLoop, gli stessi del sito, di Flow e di Cascade, e il marchio è quello ufficiale.
  - Le schermate sono raggruppate in Operate, Plant, Build e System in una barra laterale su una scrivania. Su un telefono c'è una barra di cinque (Board, Alarms, Dashboards, Entities, More), e More apre tutte le schermate.
  - Il controllo del tema dice Dark o Light, dove prima mostrava una luna.
  - Le icone dell'app installata, il colore del tema e il colore della splash seguono il nuovo aspetto.
  - Un cassetto tiene spazio per la sua barra di scorrimento, così una card al suo interno non si sposta quando carica la cronologia.
- **Accedere con HotLoop irraggiungibile dice perché e si riprende da solo.** Un telefono che non ha mai fatto accesso, o è uscito, e apre la pagina senza connessione riceve la schermata di accesso con una frase che dice che HotLoop non risponde da qui. La pagina richiede ogni tre secondi, e quando la connessione torna si ricarica senza toccare nulla. È il vecchio comportamento, mantenuto.
- **MCP può cambiare tutto ciò che può leggere.** C'erano ventisette strumenti che leggevano l'impianto e comandavano le apparecchiature; ora sono 128. Altri sessantaquattro cambiano la configurazione: dispositivi e tag, discovery e broker, reti UniFi, entità, helper, apparecchiature ed etichette, allarmi, automazioni e blueprint (un agente ora può creare la regola da un blueprint, che prima poteva solo vedere in anteprima), script, ricette, dashboard e il resto di ciò che una schermata può salvare. Trentasette raggiungono le funzioni proprie dell'amministratore: utenti e PIN, impostazioni, backup, escalation, destinazioni historian, login del broker, la flotta di edge relay e i report. Nessuno è una seconda implementazione. Ognuno è una route dell'API REST eseguita dall'handler proprio di quella route, così la validazione, il controllo dei permessi, il ricaricamento del runtime e la riga di audit sono quelli della route, con l'agente come attore.
- **Cosa sta davanti a una modifica.** L'interruttore `HOTLOOP_ALLOW_MCP_WRITES` (attivo per impostazione predefinita) deve essere attivo, e un chiamante con `HOTLOOP_MCP_OIDC_WRITE_ROLE` impostato deve avere quel ruolo. La chiamata porta esattamente l'unico permesso che chiede la sua route (`devices.write`, `alarms.write`, `users.manage`, `settings.write` e così via) e senza di esso viene rifiutata con le parole della route stessa. Ogni modifica richiede un `reason`, registrato come riga `config` nel log di sistema accanto a quella della route. Comandare le apparecchiature resta `write_tag`, `call_service`, `run_script`, `apply_recipe` e `trigger_automation` dietro `HOTLOOP_ALLOW_WRITES`, il segno di scrivibile del tag e il suo intervallo. Rendere scrivibile un tag, una regola o una ricetta è configurazione e non comanda nulla finché non viene usato; ciò che comanda allora passa dalla stessa porta. I due interruttori di scrittura non hanno una route, quindi `save_settings` li rifiuta a un agente come fa la schermata Settings, e un agente non può attivare l'interruttore da cui dipendono le sue stesse scritture. La password di un utente passa dalla chiamata come passa dall'API, e la riga di audit non la porta mai. Gli strumenti esistono anche con `--mcp-stdio`. [MCP](/it/iot/mcp/#modificare-la-configurazione) ha ogni strumento, la sua route e il suo permesso.

## Modifiche all'API

- `GET /next` e `GET /next/` sono un `301` verso la radice, così un segnalibro fatto mentre la nuova interfaccia era accanto alla vecchia arriva comunque. Il `Location` è relativo, quindi è corretto sotto un percorso base.
- `GET /static/` non c'è più, e con esso `GET /next/manifest.webmanifest`. La pagina, i suoi file, le icone, `/manifest.webmanifest` e `/sw.js` sono serviti dalla radice come prima; il vecchio foglio di stile e gli script non erano collegati da nessuna parte e non vengono serviti.
- `HOTLOOP_UI` non viene più letto. Impostarlo non fa nulla.
- Nessun'altra route è cambiata. Gli strumenti MCP sono superficie nuova, non route REST.

## Aggiornare dalla 4.19.11

Un normale `helm upgrade`, o l'auto-update di Quadlet. Non ci sono migrazioni e nulla da configurare. Il primo caricamento prende la nuova pagina e il service worker sostituisce la cache del vecchio, così un telefono che aveva l'app installata mostra le nuove schermate alla prossima apertura. Aggiornando non si può annullare nulla, e un rollback alla 4.19.11 è sicuro perché nel database non è cambiato nulla.

## Noto

- Niente di nuovo. Ciò che resta aperto sotto Broken or missing nella [roadmap](/it/roadmap/): i token utente X.509 di OPC UA, le policy obsolete `Basic128Rsa15` e `Basic256` che offre il nostro server OPC UA e le password oltre i 64 byte (entrambe della libreria), e i test di dispositivo silenzioso di S7comm ed EtherNet/IP contro dispositivi reali.
