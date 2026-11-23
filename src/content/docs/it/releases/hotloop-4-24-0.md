---
title: "Note di rilascio: HotLoop core 4.24.0"
description: "Cosa porta HotLoop core 4.24.0, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.24.0"
---

Le schermate di HotLoop sono P&ID. Gli allarmi propri di un PLC CODESYS compaiono nell'elenco degli allarmi di HotLoop e un riconoscimento torna al PLC, un'esecuzione di script termina sempre, il volume dati di un box si legge sempre, e le voci della roadmap UniFi Protect, Access e alimentazione sono consegnate. Costruita solo per amd64; la build multi-architettura segue come versione successiva.

## Cosa è cambiato

- **Le schermate sono P&ID.** Trascina serbatoi, pompe, valvole, scambiatori di calore, filtri, strumenti e giunzioni su una pagina di simboli, poi trascina da un punto di connessione a un altro: la tubazione si traccia da sola ad angoli retti attorno a tutto ciò che è nella pagina, si dirama con una giunzione dove la rilasci su un'altra tubazione e si ritraccia mentre sposti un simbolo. Ogni tubazione porta il suo fluido (acqua, vapore, combustibile, aria, energia, segnale e altri, ciascuno con un colore, un codice e un motivo di linea, così il colore non è mai l'unico portatore) e si muove con il suo tag o una regola. Ogni pagina di simboli riceve una barra degli strumenti per ingrandire, spostare, mostrare una mini-mappa e passare alla vista grigia ad alte prestazioni, e un P&ID si salva, si esporta e si importa nello stesso file di schermata. Vedi [Dashboard](/it/iot/dashboards/) e [Screen files](/it/iot/screen-file/).
- **Gli allarmi propri di un PLC CODESYS compaiono nell'elenco degli allarmi di HotLoop.** L'Alarm Configuration di un progetto conserva gruppi e classi di allarmi, e allarmi che osservano una variabile. Un dispositivo CODESYS ora legge quelli che tiene il gestore allarmi del suo PLC (attivi, in attesa di riconoscimento, riconosciuti mentre la condizione vale ancora), e un riconoscimento fatto in HotLoop torna al PLC. Un PLC che non ne ha da dare viene lasciato in pace. Servono la libreria HotLoop Alarms e un blocco nel progetto. Vedi CODESYS-ALARMS.md.
- **Il volume dati del box si legge sempre.** Un box senza nulla montato sotto `/data` non ha `/data`, e il tag `data_util_pct` di salute del box si leggeva cattivo con «no such file or directory». Ora legge il volume su cui verrà creata la cartella dati. Vedi [Protocolli e driver](/it/iot/protocols/#stato-di-salute-della-macchina).
- **Un'esecuzione di script termina sempre.** Quando il database rifiutava la scrittura della fine di un'esecuzione di script, HotLoop lo registrava e si arrendeva, così l'esecuzione risultava «running» per tutta la vita del processo con il suo slot libero da tempo. Ora la scrittura viene richiesta di nuovo, fino a cinque volte con una breve attesa tra l'una e l'altra.
- **UniFi Protect, Access e le prese della PDU SmartPower sono consegnati nella roadmap.** Sono arrivati come dispositivi nella 4.23.6, costruiti sulle API pubblicate, con ogni percorso di Protect corrispondente al documento 7.4.102. Vedi [la roadmap di HotLoop](/it/roadmap/).
- **Una schermata TwinCAT è provata in un browser.** L'esempio TwinCAT PackML viene importato con le sue cornici, renderizzato, e una spia segue un registro dal vivo.
- **I test aspettano ciò che stanno aspettando.** L'attesa del throttle del pannello è verificata come aritmetica, il timer della tenuta forSec è nelle mani del test e non in corsa contro una pausa, il test dei topic di Apache Kafka elimina subito i suoi topic e ha il tempo che serve a un box lento, e un test API non limita più un accesso con un solo campione, perché un box carico risponde quattro volte più lento di un secondo prima.

## Migrazioni

Nessuna.

## Modifiche all'API

Nessuno. Nessuna route è cambiata. La configurazione di una pagina di simboli accetta `pipes`, `view` e il `rot` di un simbolo, e un file di schermata salvato li porta.

## Aggiornare dalla 4.23.6

Un normale `helm upgrade`. Nessuna migrazione e nessun nuovo segreto. Una pagina di simboli senza tubazioni viene disegnata come prima.

## Cosa non è provato

- Il percorso degli allarmi del PLC è stato eseguito contro un vero runtime CODESYS Control for Linux SL 4.22.0.0 con il programma di laboratorio degli allarmi.
- Protect, Access e le prese della PDU seguono le API pubblicate, e la prova su banco con apparecchiature reali segue in ufficio.
