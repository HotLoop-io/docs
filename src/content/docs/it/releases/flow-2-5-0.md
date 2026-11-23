---
title: "Note di rilascio: HotLoop Flow 2.5.0"
description: "Cosa porta HotLoop Flow 2.5.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 è un nuovo editor. Stessi flussi, stesso motore, stesse scorciatoie, e finalmente sembra appartenere al resto di HotLoop invece di arrivare da un'altra azienda. Se cabli impianti per mestiere, ottieni una schermata che si adatta a ciò che fai tutto il giorno: mettere la cosa sulla tela, fare il deploy e guardarla girare.

## Novità

**L'editor assomiglia a HotLoop.** Stessi colori, stessi caratteri, chiaro e scuro secondo il tuo sistema, con un pulsante nella barra superiore quando vuoi l'altro. L'arancione significa "qui puoi fare clic" e nient'altro. Non significa un avviso, una selezione o un percorso fatto da un messaggio.

**Debug e runtime sono passati sotto la tela.** Il log di debug e la tabella Runtime stanno ora in un dock lungo il bordo inferiore, affiancati, così una riga di debug ha tutta la larghezza della tela invece di una colonna stretta dove ogni payload andava a capo quattro volte. La tabella Runtime accanto continua a contare ciò che è entrato e uscito da ogni nodo, con una barra per quanto è piena ogni coda. Cosa significa per te: vedi arrivare una lettura e il nodo da cui viene senza scorrere né strizzare gli occhi.

**Cronologia, Test e Traccia restano a destra.** Quello su cui stai lavorando sale in cima. Premi Deploy e la revisione è la prima cosa in quella colonna, con la casella della nota sotto. Fai clic su Traccia su una riga di debug e la traccia prende il primo posto.

**Una traccia ora è blu.** Il percorso fatto da un messaggio è disegnato in blu sulla tela, con il tempo passato in ogni nodo. La revisione prima di un deploy segna i nodi aggiunti, modificati, spostati e rimossi in verde, ambra, blu e rosso. Cosa significa per te: ora distingui una traccia da una selezione a colpo d'occhio, perché hanno smesso di condividere un colore.

**Un accesso che assomiglia al resto di HotLoop.** Una scheda, il logo vero e gli stessi campi. Dietro la dashboard EmberCORE ti dice ancora di entrare dalla dashboard.

**La ricerca mostra la sua scorciatoia.** Il pulsante dice Ctrl F, così non devi indovinare.

**Un doppio clic subito dopo una modifica va a segno.** L'editor controlla i tipi dei tuoi collegamenti un attimo dopo ogni modifica, e prima ridisegnava ogni collegamento anche quando la risposta non era cambiata, quindi un doppio clic su un nodo poteva colpire un collegamento che veniva sostituito a metà clic e non fare nulla. Ora ridisegna solo quando qualcosa è davvero cambiato.

## Cosa è cambiato

Niente che riguardi i tuoi flussi. Un file di flussi si carica e si salva byte per byte, esattamente come prima. Collegare, trascinare, annullare, copia e incolla, Ctrl+Invio, Esc, spostare con i tasti freccia, zoom, selezione a rettangolo e trascinamento dalla tavolozza funzionano come prima, e ognuno dei 60 test nel browser passa senza che una loro riga sia stata toccata. Abbiamo anche percorso ogni schermata e ogni finestra di dialogo sulla 2.4.0 e su questa build con lo stesso flusso d'impianto, 48 stati, e non è mancato nulla.

Cose che sembrano diverse di proposito: i pannelli di debug e runtime sono passati nel dock, il messaggio vuoto del pannello Test ora dice "dock di debug" perché è lì che sta il log, una traccia e una revisione sono disegnate in blu e nei colori di stato, il pulsante del tema dice Scuro o Chiaro, e la ricerca mostra la sua scorciatoia.

**Una cosa è più lenta, e preferiamo dirlo piuttosto che farla scoprire a te.** La pagina resta bianca per un istante finché l'editor non si è caricato, mentre quello vecchio disegnava prima la sua cornice. L'abbiamo misurato con la cache del browser disattivata, dalla richiesta della pagina di accesso al modulo a schermo. Su questa macchina sono circa 12 ms in più. Su un collegamento da 20 Mbps sono circa 100 ms in più (230 ms sono diventati 335 ms), e su un collegamento da 1,6 Mbps con 150 ms di latenza sono circa mezzo secondo in più (1,46 s sono diventati 1,96 s). Su una LAN d'impianto sono pochi millisecondi. Su un brutto collegamento vedrai una pagina bianca per un attimo, e poi l'editor. È un costo una tantum per caricamento di pagina, non per clic.

## Nuove impostazioni

Nessuno. Non c'è niente da attivare, e niente qui ha un interruttore per disattivarlo.

## Aggiornamento

Un semplice `helm upgrade` all'immagine e al chart della 2.5.0, o il nuovo tag nella tua unità Quadlet. Al primo avvio non succede nulla, non c'è niente da migrare, e i flussi, i record di deploy e le credenziali non vengono toccati. Ricarica la scheda dell'editor una volta dopo il riavvio del pod, così il browser smette di mostrare quello vecchio.

## Licenze

L'editor ora include due caratteri, Inter e JetBrains Mono, sotto la SIL Open Font License 1.1. Le loro licenze sono in `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES` con le altre, e `NOTICE` dice come viene generato quel file.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 e linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Il README a questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
