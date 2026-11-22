---
title: "HotLoop Cascade: flussi di lavoro"
description: "Flussi di lavoro che mettono l'impianto in dialogo con tutto il resto, con checkpoint: un nuovo tentativo è una riga nel database. Un solo binario Go statico."
---

Cascade fa dialogare l'impianto con tutto il resto. Un allarme, un webhook, una pianificazione, una nuova riga o una raffica MQTT diventa un lotto di elementi, e gli elementi attraversano passaggi che chiamano sistemi reali con credenziali reali. Se un'API non risponde o la macchina si riavvia a metà strada, il lavoro termina comunque, perché ogni passaggio ha un checkpoint e un nuovo tentativo è una riga nel database.

È un solo binario Go statico. SQLite su un Raspberry Pi, oppure Postgres con quanti worker si vuole su k3s. Anche la coda è Postgres, quindi non c'è un Redis da sorvegliare su un cluster d'impianto.

## Che cosa non fa

**Non scrive sulle apparecchiature.** Cascade legge e si sottoscrive. Qualsiasi cosa muova una valvola o cambi un setpoint passa dal gate di scrittura di HotLoop, così il controllo del gate vede ogni scrittura, qualunque sia il flusso di lavoro che l'ha avviata. Un motore di flussi con una porta sul retro verso il PLC è il modo in cui un registro di controllo smette di essere onesto.

**Non esegue JavaScript nei campi.** Le espressioni dei campi usano expr, lo stesso piccolo linguaggio delle automazioni di HotLoop. Non possono toccare il sistema operativo, la rete o il filesystem e terminano sempre. JavaScript vive in un solo posto, il passaggio Code, che gira in un processo separato e isolato, senza segreti, senza rete e senza filesystem. Tenerlo fuori da ogni altro campo tiene fuori anche l'esecuzione di codice remoto.

**Non limita nulla.** SSO, MFA obbligatoria, RBAC, audit, cronologia delle versioni, chiavi API con ambito e worker in alta disponibilità sono tutti nello stesso binario. Non c'è alcun controllo di licenza in nessun punto del codice.

**Non chiama casa.** Nessun server di licenze, nessuna dipendenza dal cloud. La telemetria è opt-in, disattivata per impostazione predefinita e documentata campo per campo quando arriverà.

## Dove andare ora

[Eseguire Cascade](/it/cascade/running/), eseguirlo [con Podman Quadlet](/it/cascade/quadlet/) o leggere [la roadmap di Cascade](/it/cascade/roadmap/). Se serve in un impianto, [Usare HotLoop in un'azienda](/it/business/) spiega le licenze e come contattarci.
