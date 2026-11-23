---
title: "Note di rilascio: HotLoop Cascade 0.1.2"
description: "Cosa include HotLoop Cascade 0.1.2, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "0.1.2"
---

## Di cosa si tratta

0.1.2 è una correzione di build e nient'altro. Il codice è lo stesso della 0.1.1, e lo è anche tutto ciò che esegui: il chart, le unità Quadlet, le impostazioni, il database.

Cascade ora è costruito e pubblicato su Podman dall'inizio alla fine, e l'immagine contiene esattamente amd64 e arm64.

## Aggiornare dalla 0.1.1

Non c'è nulla da fare. Esegui `helm upgrade` alla 0.1.2, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Nessuna migrazione, nessuna nuova impostazione, e la chiave e i tuoi flussi di lavoro restano dove erano.
