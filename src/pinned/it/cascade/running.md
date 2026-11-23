---
title: "Eseguire Cascade"
description: "Come eseguire Cascade con Podman Quadlet oppure con Helm su k3s, su SQLite o Postgres, con il controllo di stato usato dalle unit e dalle probe del chart."
---

:::note[Comprende ciò che sta arrivando]
Questa pagina comprende anche alcune cose più recenti di HotLoop Cascade 1.4.2, l'ultima versione rilasciata. Una parte potrebbe non essere in ciò che hai installato. Le [note di rilascio](/it/releases/) dicono cosa è cambiato.
:::

Su un host Podman, `deploy/quadlet` contiene unit systemd. Un file e un volume sono Cascade su SQLite; `deploy/quadlet/postgres` è il server, un worker e PostgreSQL su una rete propria. Entrambi partono all'avvio, ripartono in caso di errore e girano in sola lettura, senza root e con ogni capability rimossa. Il suo README spiega i passaggi.

Per scaricare una versione a mano:

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:1.5.0
```

Le unit seguono `:stable` e il timer di aggiornamento automatico di Podman le aggiorna.

Su k3s, `charts/hotloop-cascade` è il chart Helm:

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version 1.5.0
```

Il chart porta le etichette lette dalla dashboard EmberNet, sul Service e sui pod che servono l'editor, così un Cascade installato dall'App Store compare in Running Apps con un pulsante LAUNCH. `gui.appName`, `gui.port` e `gui.displayName` cambiano ciò che viene mostrato.

È un solo pod su SQLite con un volume. `--set split=true` con PostgreSQL (`--set postgresql.enabled=true` per uno gestito dal chart, oppure `externalDatabase.existingSecret` per il proprio) lo divide in pod API, webhook e worker che si scalano separatamente. La chiave che protegge le credenziali memorizzate viene creata alla prima installazione e conservata quando la release viene disinstallata, perché una chiave che se ne va con la release si porta via ogni credenziale di un database conservato. Va salvata in un backup.

`hotloop-cascade healthcheck` interroga l'endpoint di stato del server in esecuzione e termina con 0 o 1. Sia le unit Quadlet sia le probe del chart usano gli endpoint che ci sono dietro.
