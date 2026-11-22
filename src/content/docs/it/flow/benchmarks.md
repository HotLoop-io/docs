---
title: "Benchmark delle prestazioni"
description: "Tempo di avvio, memoria, throughput e latenza misurati di Flow su un desktop e su un Raspberry Pi 5, cosa questi numeri non sono e come ripetere il test."
---

Solo numeri assoluti. Una tabella affiancata si sposta ogni volta che cambia la macchina e finisce per descrivere l'altro prodotto più di questo.

Flow risponde a circa 15.000 richieste al secondo su un desktop e a circa 13.000 al secondo su un Raspberry Pi 5, con meno di 30 MiB di memoria sul desktop e 42 MiB sul Pi. È tutto il senso di un motore di flussi abbastanza piccolo per il box che sta in reparto.

## Il flusso

Cinque nodi: un endpoint HTTP, tre modifiche di proprietà, una risposta. Nulla è veloce di proposito. È la forma di un piccolo flusso reale, che è ciò di cui deve occuparsi il benchmark di un motore di flussi. Il generatore di carico è a ciclo chiuso: ogni client invia la richiesta successiva quando è tornata la precedente, quindi misura ciò che l'altro capo può assorbire e non può produrre la latenza fuorviante che riporta un generatore a ciclo aperto quando il bersaglio resta indietro.

## Provalo tu stesso

`hotloop-flow bench` è incluso nel binario. `-launch` avvia il binario, misura quanto tempo passa prima che il flusso risponda (avvio a freddo), legge la memoria residente del processo due secondi dopo (a riposo), poi la campiona durante il carico e conserva il picco. `-target` senza `-launch` pilota un'istanza già in esecuzione, un container o un pod, via HTTP, per throughput e latenza.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Risultati

Misurato su un desktop x86 (24 CPU), con il binario statico nativo, tre esecuzioni ciascuno.

| <span class="sr-only">Dettagli</span> | Esecuzione 1 | Esecuzione 2 | Esecuzione 3 |
|---|---|---|---|
| Avvio a freddo | 0.05 s | 0.05 s | 0.05 s |
| RSS, a riposo | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, picco sotto carico | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| Throughput HTTP | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| Latenza HTTP p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Motore, per messaggio | 2.61 µs | 3.11 µs | 2.20 µs |
| Motore, memoria allocata per messaggio | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Risultati su un Raspberry Pi 5

Misurato su un Raspberry Pi 5 da 8 GB, con il clock limitato a 2.0 GHz, come pod su k3s, senza nient'altro sul nodo. Lo stesso flusso, tre esecuzioni, ciascuna in un pod nuovo.

| <span class="sr-only">Dettagli</span> | Esecuzione 1 | Esecuzione 2 | Esecuzione 3 |
|---|---|---|---|
| Avvio a freddo | 0.46 s | 0.15 s | 0.10 s |
| RSS, picco sotto carico | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| Throughput HTTP | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| Latenza HTTP p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Motore, per messaggio | 8.15 µs | 7.74 µs | 7.89 µs |

Mantenuto per 600 secondi, lo stesso comando sulla stessa scheda si assesta a 11.4k req/s con p50 a 0.58 ms e p99 a 3.00 ms. La scheda funziona con un semplice dissipatore, senza raffreddamento attivo, e va in throttling con un carico simile, quindi questo è il dato onesto per un box che resta sotto carico.

### Cosa non sono questi numeri

**Il throughput HTTP include lo stack HTTP.** Di proposito: è ciò che sperimenta un client del tuo flusso. Non è una misura dello scheduler. Le righe del motore lo sono, senza alcun I/O nel percorso.

**Una forma di flusso, una dimensione di payload, una concorrenza.** Un flusso che fa I/O reale, una pubblicazione MQTT o una scrittura su database, è dominato da quell'I/O. Questi numeri sono l'overhead del runtime stesso, non una promessa su ogni carico di lavoro.

**La coda si muove più della mediana.** In saturazione tutto si mette in coda e la coda comanda il p99. La mediana è il punto in cui emerge il costo di gestire una richiesta.

**Questo è il flusso di benchmark, non i fili durevoli.** Nulla qui misura lo store dietro un filo durevole né le scritture su scheda SD.

## Memoria

La RSS è la memoria residente del processo stesso, letta da `/proc`. Non è ciò che riporta `podman stats`, che mostra ciò che il kernel addebita al container e può indicare molto meno di ciò che il processo trattiene davvero.