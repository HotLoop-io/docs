---
title: "Roadmap di Cascade"
description: "Che cosa Cascade ha già costruito, che cosa ha portato ogni versione e che cosa non è ancora costruito né pianificato."
---

In nessun punto del codice esiste un controllo di licenza. Ogni fase finisce quando il suo elenco «reale» è stato eseguito su sistemi reali, non quando il codice compila.

## 0.1.0, l'MVP

Costruito. Il motore, le esecuzioni durevoli, la coda Postgres e i worker, le espressioni, il passaggio Code nella sua gabbia, il caveau delle credenziali e OAuth2, webhook, pianificazioni e MQTT, utenti con MFA obbligatoria, OIDC, progetti e RBAC, audit, cronologia delle versioni, l'API, l'editor, i connettori dell'elenco approvato, l'importazione dei flussi di lavoro, metriche e tracce, il chart Helm e le unità Quadlet. Rilasciato con `RELEASE_CHECKLIST.md`, non prima.

## 0.2.0, identità e governance

Costruito, e rilasciato dentro la 1.0.0 con il nuovo editor. SAML, LDAP e AD, SCIM, ruoli personalizzati, segreti esterni, invio dei log, variabili, cartelle, analisi, annotazioni delle esecuzioni, i backend blob S3 e Azure e le policy di oscuramento delle esecuzioni. Ognuna è provata contro il vero server con cui dialoga, e ognuna ha la sua schermata nell'editor.

## Che cosa ha portato la 1.0.x

La 1.0.0 è la 0.1.0 più la 0.2.0 più il nuovo editor, tutto in un'unica versione. L'editor era l'ultimo pezzo che volevamo prima di mettere il nostro nome sotto quel numero.

La 1.0.1 ha corretto un errore nell'accesso: un database illeggibile rispondeva «non autenticato» e cancellava il cookie, così un breve guasto disconnetteva tutti e poteva trasformare un secondo fattore giusto in un codice sbagliato. Ora risponde «riprova» e mantiene la sessione. La 1.0.2 ha permesso a un passaggio Code di firmare e verificare con una chiave HMAC conservata come credenziale, e a un webhook di indicare le origini web che possono chiamarlo da un browser. Fra la 1.0.0 e la 1.0.2 non c'era nulla da migrare.

A che cosa si attiene oggi un flusso di lavoro salvato: il file dice di quale versione del suo formato è (`cascade: 1`), ogni passaggio porta la propria versione, e un flusso di lavoro che nomina un passaggio che non esiste più non supera la validazione e non parte, invece di essere modificato in silenzio. È così che i passaggi EmberOps sono stati tolti nella 1.0.0. Ogni versione viene avviata sui dati della precedente prima di uscire: il flusso di lavoro c'è ancora e la credenziale si apre ancora.

## 1.3.0, l'editor in 14 lingue

Costruito. Inglese, spagnolo, francese, italiano, tedesco, norvegese bokmål, bulgaro, greco, coreano, giapponese, vietnamita, hindi, cinese semplificato e arabo. Un selettore di lingua nella barra in alto e nella pagina di accesso; ogni schermata, i titoli e la guida dei passaggi e i rifiuti del server sono tradotti; date, numeri e durate seguono la lingua; l'arabo si scrive da destra a sinistra, con la tela e il codice da sinistra a destra. Ogni lingua è provata su ogni schermata a larghezza desktop e telefono in un browser vero, e la compilazione rifiuta una lingua a cui manca una riga. Le parole vengono dal glossario HotLoop condiviso.

## 1.5.0, eliminare una persona

Realizzato. Un proprietario dell'istanza può eliminare una persona da Utenti, dall'API REST (`DELETE /api/v1/users/{user}`) o dal server MCP (`delete_user`). Il suo account, le sessioni, le passkey, le identità di accesso e le chiavi API spariscono, e il registro di controllo conserva chi l'ha fatto e cosa è andato via. I suoi workflow, le credenziali e le esecuzioni restano: il progetto personale diventa un progetto condiviso con il suo nome e "(removed)", perché un proprietario o un amministratore sposti il lavoro o lo passi a qualcun altro. Nessuno può eliminare il proprio account, e l'ultimo proprietario non può essere eliminato. Disattivare qualcuno esiste ancora per quando vuoi tenere l'account.

## 1.4.2, la pagina di accesso

Realizzato. La pagina di accesso è una scheda centrata su una pagina quieta, con il marchio e il nome del prodotto sopra, il pulsante principale nell'arancione HotLoop, e gli altri modi di entrare (una passkey, l'accesso unico) come semplici pulsanti accanto, in chiaro e in scuro e su un telefono. Il pulsante dell'accesso unico porta l'icona del suo provider quando il provider è Vord. Ogni campo, id e percorso di accesso è quello che era.

## 1.4.1, la pagina Impostazioni

Costruito. La pagina Impostazioni non rimette più un campo al valore precedente quando la risposta di un salvataggio arriva dopo che la persona lo ha modificato: un campo che contiene ancora ciò che è stato inviato prende il valore del server, e uno modificato nel frattempo mantiene la modifica. E gli elenchi di revisione nelle cartelle delle lingue non ci sono più.

## 1.4.0, attesa, conservazione, limiti e backup

Costruito. Un pod che parte prima del suo database, cosa che il chart fa nella forma divisa, ora lo aspetta e lo dice, invece di riavviarsi due o tre volte (l'installazione non ha mostrato riavvii nel test del chart). E la conservazione: un'impostazione per quanti giorni tenere le esecuzioni concluse, disattivata per impostazione predefinita, e un passaggio ogni ora che rimuove le più vecchie insieme ai dati dei loro passaggi. Lo stesso passaggio rimuove i file nell'archivio blob a cui non punta più nessuna esecuzione: gli output troppo grandi per il database e gli allegati, e un file condiviso solo quando l'ultima esecuzione che lo usa non c'è più. E un limite di frequenza per ogni chiave API, tramite l'API e MCP, disattivato per impostazione predefinita, che risponde 429 indicando quanto aspettare. (Un webhook ha un limite proprio, e un account si blocca dopo ripetute password sbagliate, come prima.) E `hotloop-cascade backup` e `restore`: il database SQLite, la chiave e i file blob con un manifesto di hash, e per PostgreSQL la chiave e i blob più il comando `pg_dump` per la parte del database.

## 1.2.0, gli ultimi quattro strumenti del server MCP

Costruito. Al server MCP mancavano quattro route che una chiave può chiamare: elencare e revocare le proprie chiavi, aprire il webhook di prova di un flusso di lavoro e avviare un accesso OAuth2. Ora sono strumenti, 83 in tutto, ciascuno attraverso la sua route, così valgono gli stessi controlli dei permessi dell'editor. Le dieci route che richiedono una persona autenticata (creare chiavi, token SCIM, provider di segreti e destinazioni dei log, e la propria password) restano fuori, perché una chiave che potesse crearle potrebbe tenersi in vita da sola; la pagina MCP dice quali e perché.

## 1.1.0, MCP e le schermate mancanti

Costruito, ed è questa la versione. Il server MCP su `/mcp`: 79 strumenti, ciascuno una route dell'API REST, così il gestore della route controlla da sé il permesso, convalida il corpo, applica la modifica e scrive la riga di audit. Viene fornito attivo, in lettura e scrittura, come ogni MCP della famiglia HotLoop, e i due interruttori sono quelli della distribuzione (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), che nessuno strumento e nessuna route può cambiare. La pagina MCP elenca ogni strumento e che cosa richiede.

E le schermate che mancavano all'editor: credenziali, progetti (membri e account di servizio), utenti, il registro di audit, le impostazioni e una pagina Account con le chiavi API, ognuna con gli stessi permessi dell'API e provata in un browser vero con ogni ruolo. La pagina di accesso è ora quella dell'editor, con i suoi colori e i suoi caratteri, e non più la vecchia pagina in Go.

## Non costruito: ambienti e scala

Costruito di questa fase: il ruolo webhook (un proprio Deployment nella forma divisa del chart), un limite di concorrenza per flusso di lavoro e molti main su un solo database. Quello che non abbiamo fatto è il test fissato per questa fase: uccidere un main durante una pianificazione al minuto e non trovare nessuna esecuzione duplicata né mancata nell'arco di un'ora.

Non costruito, non pianificato:

- Controllo del codice sorgente con Git e ambienti.
- Istanze protette.

## Non costruito: connettori e persone

I connettori dell'elenco approvato che sono stati costruiti ci sono: HTTP, ntfy, Discord, Gotify, e-mail, HotLoop, MQTT, database, file e gli archivi blob S3 e Azure. Il connettore EmberOps era nella 0.1.x ed è stato tolto nella 1.0.0.

Non costruito, non pianificato:

- La specifica dichiarativa dei connettori pubblicata.
- Un SDK per i plugin e un indice.
- Moduli con passaggi di approvazione umana. Le approvazioni devono funzionare da un telefono, perché chi approva la modifica di una ricetta sta in piedi in linea, non seduto a una scrivania. (Il passaggio Wait trattiene già un'esecuzione finché qualcuno non chiama il suo URL di ripresa, quindi oggi un'approvazione si può costruire con un link; manca il modulo che l'approvatore apre e una traccia di chi ha approvato.)

## Non costruito: passaggi di IA

Passaggi LLM e agente, e un costruttore che usa il tuo modello. Porta la tua chiave o eseguilo in locale. Niente di tutto questo esiste ancora e nessuno lo ha pianificato. Non c'è un servizio ospitato e non ci sarà. (Il server MCP, che permette a un agente di usare Cascade dall'esterno, è costruito: vedi 1.1.0.)

## La nuova interfaccia dell'editor

Costruito, e nella 1.0.0. L'editor è riscritto in Astro con isole Svelte, compilato in risorse statiche e incorporato nel binario Go come il vecchio, quindi è la stessa storia di un solo binario senza nulla di nuovo da eseguire. Prende colori, caratteri e logo dai file del marchio HotLoop e segue il tema chiaro o scuro del sistema. Ha ogni schermata del vecchio editor e fa ciò che faceva (il codice della tela è passato invariato), le funzioni della 0.2.0 hanno le loro schermate, e un test del browser le pilota tutte contro il vero server in un Chrome vero. Niente di tutto ciò ha cambiato l'API, il formato dei file né la parte Go.
