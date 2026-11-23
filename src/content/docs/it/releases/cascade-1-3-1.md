---
title: "Note di rilascio: HotLoop Cascade 1.3.1"
description: "Cosa include HotLoop Cascade 1.3.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.3.1"
---

## Di cosa si tratta

1.3.1 è la 1.3.0 con l'immagine arm64 aggiunta. Il codice è quello della 1.3.0, il chart cambia solo la sua versione, e ogni impostazione, route, schermata e strumento è quello della 1.3.0.

## Perché è una release a sé

Il multi-architettura esce in una sua esecuzione. La 1.3.0 è stata costruita solo per amd64, è andata in produzione e lì è risultata stabile, e questo è il piccolo cambio di versione che le costruisce entrambe. Da qui in poi `stable`, `latest`, `1.3`, `1` e `1.3.1` elencano amd64 e arm64.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.3.1, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Una macchina arm64 che scaricava l'immagine arm64 fornita dalla 1.2.1 ora riceve quella della 1.3.1, con l'editor in 14 lingue. Rimettere la 1.3.0 o la 1.2.1 è sicuro, perché nel database non è cambiato nulla.
