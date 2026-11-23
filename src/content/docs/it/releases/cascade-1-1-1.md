---
title: "Note di rilascio: HotLoop Cascade 1.1.1"
description: "Cosa include HotLoop Cascade 1.1.1, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "1.1.1"
---

## Di cosa si tratta

1.1.1 è la 1.1.0 con l'immagine arm64 aggiunta, e un'etichetta. Il codice è quello della 1.1.0, il chart cambia solo la sua versione, e ogni impostazione, route e schermata è quella della 1.1.0.

L'etichetta è `org.opencontainers.image.version`. L'immagine non l'aveva mai, quindi leggendo la configurazione dell'immagine non compariva alcuna versione. Ora riporta la versione della release, presa dallo stesso argomento di build da cui deriva la versione del binario.

## Perché è una release a sé

Il multi-architettura esce in una sua esecuzione. La 1.1.0 è stata costruita solo per amd64, è andata in produzione e lì è risultata stabile, e questo è il piccolo cambio di versione che le costruisce entrambe. Da qui in poi `stable`, `latest`, `1.1`, `1` e `1.1.1` elencano amd64 e arm64.

## Aggiornare, e tornare indietro

Nessuna migrazione. `helm upgrade` alla 1.1.1, oppure lascia che `:stable` faccia avanzare le unità Quadlet. Una macchina arm64 che scaricava l'immagine arm64 fornita dalla 1.0.2 ora riceve quella della 1.1.1. Rimettere la 1.1.0 o la 1.0.2 è sicuro, perché nel database non è cambiato nulla.
