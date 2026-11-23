---
title: "Note di rilascio: HotLoop Cascade 1.0.0"
description: "Cosa include HotLoop Cascade 1.0.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.0.0"
---

## Di cosa si tratta

1.0.0 è il lavoro su identità e governance e un nuovo editor, in un'unica versione. Tutto ciò che c'era nella 0.1.2 è ancora qui e funziona come prima: il motore, i connettori, l'importatore, il chart Helm, le unità Quadlet e il formato dei file dei flussi di lavoro. Cambia ciò che un impianto può fare con un'istanza, e il suo aspetto mentre lo fa.

La chiamiamo 1.0.0 perché l'editor è l'ultimo pezzo che volevamo prima di mettere il nostro nome sotto quel numero. Ogni schermata funziona con l'API vera, e ogni funzione qui sotto è stata provata contro il vero server con cui dialoga, non contro un sostituto.

## Il nuovo editor

È ricostruito con Astro e isole Svelte, con i colori e i caratteri di HotLoop, e segue il tema chiaro o scuro del sistema finché non ne scegli uno. È ancora incorporato nel binario e non scarica nulla da nessuna parte, quindi una macchina senza internet lo esegue come una connessa. Ogni schermata del vecchio editor è qui e fa quello che faceva, canvas compreso: abbiamo portato il suo codice invece di riscriverlo, e abbiamo contato ogni schermata, pulsante, campo e chiamata API prima e dopo per essere sicuri che non mancasse nulla.

Gli URL che avevi salvato funzionano ancora. `#/w/<id>`, `#/x/<id>`, `#/executions` e i link di debug aprono le stesse schermate, e `/app/main.js` e `/app/main.css` rispondono ancora.

## Le novità

SAML, provato con Keycloak, solo con risposte firmate. LDAP e Active Directory, provati con OpenLDAP e un controller di dominio Samba, con ruoli ricavati dai gruppi. SCIM, provato con scim2-tester, così un provider crea e disattiva account senza che nessuno tocchi una schermata. Ruoli personalizzati, creati dai permessi del progetto. Segreti esterni in OpenBao o HashiCorp Vault, così la password di una credenziale vive nell'archivio e ruota lì. Streaming del registro di controllo e delle esecuzioni concluse verso syslog (TCP, UDP o TLS) e OTLP, provato con un vero server syslog e Loki. Variabili, cartelle, analisi, annotazioni sulle esecuzioni, criteri di oscuramento e archivi di blob S3 e Azure, provati con Garage e Azurite.

L'editor ha una schermata per ciascuno: Variabili, Analisi e, in Impostazioni, Ruoli, Oscuramento, Segreti esterni, Streaming dei log, e Accesso e SCIM. A ogni persona viene offerto solo ciò che il suo ruolo consente, e il server rifiuta comunque il resto.

## I passi EmberOps non ci sono più

Abbiamo tolto il connettore EmberOps. I nove passi (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` e `call`), il trigger "Quando un documento EmberOps viene creato o modificato", il tipo di credenziale EmberOps e le schermate e la documentazione che li offrivano non sono nella 1.0.0. Se devi raggiungere EmberOps, il passo HTTP chiama la sua API REST con una credenziale, e funziona già oggi.

Un flusso di lavoro salvato con uno di questi passi non viene scartato né modificato in silenzio. Non supera la validazione e non parte, e il messaggio indica il passo e dice che i passi EmberOps sono stati rimossi nella 1.0.0. Elimina il passo, oppure sostituiscilo con un passo HTTP, e torna a funzionare. Una credenziale di tipo EmberOps resta nel tuo elenco, inutilizzata, e puoi eliminarla. L'importatore non porta più un nodo EmberOps: arriva disattivato, con le sue impostazioni nelle note, come ogni nodo per cui non ha un passo.

## Aggiornare dalla 0.1.2

`helm upgrade` alla 1.0.0, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Otto migrazioni (da 0018 a 0025) vengono eseguite durante l'aggiornamento. Creano tabelle per ruoli, variabili, cartelle, annotazioni, criteri di oscuramento, SCIM, provider di segreti e destinazioni di log, e aggiungono una colonna: la cartella in cui si trova un flusso di lavoro. Non toccano ciò che hai, quindi i tuoi flussi di lavoro, le credenziali e le esecuzioni restano dove erano e la chiave li apre ancora. SAML, LDAP, SCIM e gli archivi di blob restano spenti finché non imposti le loro variabili `HOTLOOP_CASCADE_*`, descritte in `docs/IDENTITY.md` e `docs/GOVERNANCE.md`. Non cambia nulla per un'istanza che non ne imposta nessuna, a meno che un tuo flusso di lavoro usi un passo EmberOps (vedi sopra).

## Cose da sapere

Le migrazioni vanno solo avanti. Un rollback rimette l'immagine precedente, ma non annulla la migrazione del database: fai un backup prima di aggiornare e consideralo la strada del ritorno. Nulla in queste migrazioni modifica o rimuove ciò che c'era, ma non abbiamo eseguito la vecchia immagine sul nuovo schema, quindi non lo promettiamo.

I segreti esterni richiedono percorsi consentiti. Un provider senza alcun percorso viene rifiutato, di proposito, perché il token dell'archivio di solito può leggere molto più di quanto dovrebbe poter indicare chi modifica le credenziali.

SCIM non mostra mai a un provider il proprietario dell'istanza, e un DELETE da un provider disattiva e nasconde l'account invece di cancellarlo, così un provider non può rimuovere l'ultima persona che può accedere. Una ricreazione riporta lo stesso account.

Le variabili non sono segreti. Chiunque possa leggere un progetto ne legge le variabili, e il valore non viene oscurato nei dati di esecuzione. Le password vanno nelle credenziali o in un archivio esterno.

## Licenza

Cascade è sotto la Business Source License 1.1 (`BUSL-1.1`) di HotLoop, come il resto della gamma HotLoop. Non è open source e non farò finta che lo sia. Ogni versione diventa GPL-3.0 o successiva quattro anni dopo la prima pubblicazione. L'uso domestico e di laboratorio è gratuito, così come l'uso in produzione di scuole, organizzazioni non profit ed enti pubblici. L'uso aziendale passa da EmberNet, dove registrarsi è gratis e lo è anche l'uso aziendale. Non sono concessi l'hosting come servizio per altri, la rivendita e l'incorporazione in qualcosa che vendi. Il file `LICENSE` è il testo legale e prevale su questo paragrafo.
