---
title: "Panoramica di HotLoop Edge"
description: "HotLoop Edge è IoT più il livello macchina: server OPC UA, Sparkplug B e store and forward che tengono in marcia l'impianto senza collegamento."
sidebar:
  label: "Panoramica"
---

:::note[Edge è disponibile, dalla versione 4.18.10]
L'immagine è `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}`, compilata per amd64, arm64 e arm/v7, circa 37 MB su amd64 e 34 MB su arm, e il chart è `hotloop-edge` da `https://hotloop.io/hotloop`. Entrambi si scaricano senza accesso. Le unità Quadlet sono nella directory `edge/` di [Podman Quadlet](/it/install/quadlet/). [Installalo](/it/edge/install/). Prima della 4.18.10 il Gateway poteva funzionare sul campo e pubblicare Sparkplug verso monte, e lo fa dalla 4.5.0, ma serviva tutto il Gateway.
:::

Edge è una scatola fissata accanto a una linea. Legge la macchina, esegue le regole sulla macchina, continua a funzionare quando la WAN cade e racconta al resto dell'impianto ciò che ha visto. Funziona sulla stessa porta di scrittura di tutto il resto.

Ha tutto ciò che ha [IoT](/it/iot/overview/), e due cose in più.

## Che cosa aggiunge Edge

- **[Pubblicazione Edge e store and forward](/it/edge/edge-publish/).** Pubblica verso monte tutto ciò che legge come nodo edge Sparkplug B. Quando il collegamento cade, accumula su disco e riproduce in ordine al ritorno del collegamento, così l'historian a monte riceve l'interruzione recuperata e non un buco, finché l'interruzione sta nella coda. La coda è di 64 MiB per impostazione predefinita, circa 248.000 letture: circa 41 minuti a 100 letture al secondo, circa due minuti a 2.000. Oltre questo limite le letture più vecchie vengono scartate per prime, ognuna contata, e `edgePublish.queueMaxBytes` lo alza. Le letture vanno in memoria finché il broker le conferma e su disco solo quando smette, e un test interrompe il collegamento sotto carico, termina il processo a metà interruzione e conta ogni lettura. Un arresto forzato con il collegamento attivo può ancora costare circa una lettura di polling, e la pagina lo dice, con i numeri.
- **[Il server OPC UA](/it/edge/opc-ua-server/).** Sola lettura e protetto. Lo SCADA che avete già vede ogni tag senza un nuovo driver, e Ignition 8.3.9 lo ha letto da capo a fondo. Resta disattivato finché non lo attivate.

Le schermate locali e la logica continuano a funzionare senza collegamento, e un test avvia il vero binario contro un collegamento che inghiotte tutto per dimostrarlo. Una scatola che si riavvia durante un'interruzione della WAN riparte con le sue schermate e i suoi allarmi, mentre prima della 4.18.10 andava in crash loop senza schermate e senza allarmi finché la WAN non tornava. I dashboard sono le schermate, e stanno in [IoT](/it/iot/dashboards/). Una scrittura HMI che indichi una persona, un PIN o un badge su un pannello condiviso non è ancora realizzata. È nella [roadmap](/it/roadmap/).

## Che cosa non ha

Niente flotta, niente multi-sito, niente report pianificati. Quelli sono del [Gateway](/it/gateway/overview/), e non sono nel binario Edge.

## Database

SQLite, PostgreSQL o TimescaleDB, dallo stesso binario. Il chart e le unità Quadlet usano TimescaleDB per impostazione predefinita e conservano 90 giorni di storico salvo modifica. Nel chart è `database.type`, e `HOTLOOP_DB_TYPE=sqlite` mette la scatola su un file, senza contenitore di database. [La gamma](/it/products/) ha la tabella.

## Installarlo

[La pagina di installazione di Edge](/it/edge/install/) ha Helm e Podman Quadlet, con i comandi. Passare un sito da IoT a Edge al Gateway conserva ogni dispositivo, tag, entità, automazione, allarme, utente e ora di storico, e [la gamma](/it/products/) spiega come.

Lo usate in uno stabilimento? [Usare HotLoop in un'azienda](/it/business/) spiega la licenza e come contattarci.
