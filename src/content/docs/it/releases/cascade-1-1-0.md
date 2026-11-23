---
title: "Note di rilascio: HotLoop Cascade 1.1.0"
description: "Cosa include HotLoop Cascade 1.1.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.1.0"
---

## Di cosa si tratta

1.1.0 dà a Cascade un server MCP e le schermate che mancavano all'editor, e sposta l'accesso nell'editor. Il motore, il formato dei file dei flussi di lavoro e l'API REST sono quelli della 1.0.2.

## Il server MCP

Si trova su `/mcp`, allo stesso indirizzo dell'API, viene fornito attivo e scrive. Ogni MCP della famiglia HotLoop legge e scrive, e Cascade era l'ultimo a non avere alcun MCP.

Un agente accede con una chiave API e ottiene ciò che potrebbe fare il titolare di quella chiave, ridotto agli ambiti della chiave. Ci sono 79 strumenti, e ognuno è una route dell'API REST: una chiamata passa per il gestore della route stessa, quindi il controllo dei permessi, la validazione, la scrittura e la riga di controllo sono quelli della route. Nulla è stato copiato nel server MCP, quindi nulla può divergere, e nulla è stato lasciato fuori, quindi nulla viene saltato.

- Uno strumento che modifica qualcosa richiede un `reason`, e il registro di controllo lo conserva accanto alla modifica, con la chiave e il nome che il client si è dato.
- Il segreto di una credenziale non torna mai indietro, a nessuno. Una credenziale creata tramite MCP ha i suoi segreti sigillati appena arrivano.
- `HOTLOOP_CASCADE_MCP` e `HOTLOOP_CASCADE_MCP_WRITES` sono gli interruttori del deployment, entrambi attivi per impostazione predefinita. Nessuno strumento e nessuna route API può cambiarli, quindi un agente che può modificare le impostazioni dell'istanza non può comunque riattivare le scritture.
- Le route che rifiutano da sole una chiave (creazione di chiavi API, token SCIM, provider di segreti e destinazioni di log) non sono strumenti, perché una chiave che potesse creare chiavi è una chiave trapelata che si tiene in vita da sola. La pagina MCP le elenca con ogni strumento e il permesso che richiede.

## Le schermate

Credenziali, Progetti, il tuo Account e, per proprietari e amministratori, Impostazioni, Utenti e il registro di controllo. Ognuna segue gli stessi permessi dell'API: a ogni persona viene offerto solo ciò che il suo ruolo consente, e il server rifiuta comunque il resto.

- **Credenziali** si creano, si aprono, si modificano, si condividono con altri progetti e si eliminano. Un segreto si inserisce una volta e la schermata dice solo che è impostato.
- **Progetti** ha i membri e i loro ruoli, e le chiavi degli account di servizio con cui accede un'integrazione permanente, mostrate una sola volta.
- **Account** crea e revoca le tue chiavi API, con cui accedono l'API e MCP, e cambia la tua password.
- **Utenti** crea persone e le disattiva o riattiva. Il **registro di controllo** si legge, si filtra e si verifica contro la manomissione. **Impostazioni** ha il requisito del secondo fattore e il flusso di errore.

L'accesso ora è la pagina dell'editor stesso, su `/login`, con i colori dell'editor, chiaro e scuro, su un telefono come su una scrivania. Fa tutto ciò che faceva la vecchia pagina: configurazione al primo avvio, password, account di directory, single sign-on, passkey, secondo fattore e codici di recupero.

## Solo amd64, e perché

Questa versione viene costruita solo per amd64. Il multi-architettura esce in una sua esecuzione, quindi la versione dopo questa è un piccolo cambio di versione che le costruisce entrambe. Fino ad allora, `stable`, `latest` e i tag brevi elencano questa immagine amd64 accanto all'immagine arm64 a cui già puntavano, così una macchina arm continua a scaricare. Il tag di versione, `1.1.0`, è solo amd64.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.1.0, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Rimettere la 1.0.2 è sicuro, perché nel database non è cambiato nulla. Ciò che un rollback non può annullare è ciò che un agente ha già fatto: le sue modifiche restano fatte, e le righe di controllo che ha scritto restano nel registro con il tipo di attore `mcp`. Un backup prima di ogni aggiornamento resta una buona abitudine.
