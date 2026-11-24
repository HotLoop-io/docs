---
title: "HotLoop Transmitter: Überblick"
description: "Eine CODESYS-Bibliothek in Structured Text über SysSocket UDP, die SPS-Werte als OPC UA PubSub (UADP) veröffentlicht, ohne weitere Bibliothek oder Konfigurator."
---

HotLoop Transmitter stellt die Werte einer SPS als OPC UA PubSub ins Netz, so wie es Teil 14 der OPC-UA-Spezifikation vorsieht, aus einer Bibliothek, die Sie in das CODESYS-Projekt legen. Es ist ein Transmitter im Sinne der Messschleife: das Teil, das den Prozesswert auf die Leitung bringt, damit ihn etwas anderes lesen kann.

Es ist in Structured Text über `SysSocket` UDP geschrieben und braucht keine weitere Bibliothek, keine zusätzliche Lizenz und keinen Konfigurator. Sie fügen die Bibliothek hinzu, rufen einen Funktionsbaustein einmal pro Zyklus auf, und in jedem Veröffentlichungsintervall geht eine UADP NetworkMessage an eine Unicast-Adresse oder eine Multicast-Gruppe.

Was das für Sie heißt: Eine SPS ohne PubSub-Bibliothek kann mit ein paar Zeilen Structured Text alles speisen, was OPC UA PubSub abonniert, auch HotLoop selbst. Jede Nachricht trägt einen Zeitstempel der SPS-Uhr, außer Sie schalten ihn mit `bTimestamp` ab.

## Warum Structured Text und nicht Go

Jedes neue HotLoop-Werkzeug ist in Go geschrieben, außer es gibt einen echten Grund. Das ist der echte Grund: Es muss im eigenen Scan der SPS laufen, in der IEC-61131-3-Runtime, als Bibliothek, die der Programmierer aus seinem Projekt einbindet. Eine CODESYS-Runtime führt Structured Text aus, kein Go. Die Tests und Werkzeuge rund um die Bibliothek (das Capture-Werkzeug, der Verifizierer) sind in Go.

## So nutzen Sie es

1. Installieren Sie `HotLoopTransmitter-1.3.0.library` im CODESYS-Bibliotheksrepository (Tools, Library Repository, Install), oder installieren Sie `HotLoopTransmitter-1.3.0.package` mit dem CODESYS Installer, und fügen Sie sie dann dem Library Manager des Projekts hinzu. Die [Installationsseite](/de/transmitter/install/) hat die Downloads und die Einzelheiten.
2. Deklarieren Sie einen Publisher, fügen Sie die zu veröffentlichenden Variablen einmal beim Start hinzu und rufen Sie ihn in jedem Zyklus auf:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

Die [API-Seite](/de/transmitter/api/) listet jeden Eingang, Ausgang und jede Methode auf. Die [Seite zum Leitungsformat](/de/transmitter/wire-format/) zeigt das Paket Byte für Byte, mit den Abschnitten der Spezifikation, die jedes Byte definieren.

## Was es mit Ihrem Zyklus macht und was nicht

* Es blockiert nie. Der Socket ist nicht blockierend, und die Nachricht wird in einem festen Puffer aufgebaut.
* Die Kosten eines Aufrufs sind die Kosten, eine Nachricht aufzubauen, und sie fallen nur in den Zyklen an, in denen eine Nachricht hinausgeht. Gemessen auf einem 20-ms-Task mit zwei Publishern und eingeschalteten Zeitstempeln: im Mittel etwa 9,6 us zusätzlich pro Zyklus, 10 bis 100 us in den Zyklen, die senden, und der längste Zyklus im Lauf dauerte 81 us. Ein ausgelasteter Host hat einen einzelnen Sendevorgang schon auf Millisekunden gedehnt. Die gemessenen Zahlen und ihre Grenzen stehen auf der [Zeitseite](/de/transmitter/timing/).
* Ein Socket-Fehler, eine falsche Adresse oder eine zu große Feldliste lässt die Anwendung nie ausfallen. Der Baustein meldet einen `eState` und einen `eError`, zählt den Fehler, und das Programm scannt weiter.
* Es fragmentiert nicht. Eine Nachricht ist höchstens 1472 Byte groß. Passt eine Feldliste nicht, geht der Baustein in `ConfigError` und sendet nichts.

## Getestet mit

Der CODESYS Control for Linux SL 4.22.0.0 Runtime und auf Bare Metal (2026-11-17). Auf der [Zeitseite](/de/transmitter/timing/) und der [Nachweisseite](/de/transmitter/proof/) steht, was ausgeführt und zurückgelesen wurde.

Im Einsatz in einem Werk? [HotLoop im Unternehmen nutzen](/de/business/) behandelt die Lizenzierung und wie Sie uns erreichen.

## Lizenz

Das HotLoop Source License Agreement 1.0, wie bei jedem HotLoop-Produkt. Die Nutzung ist kostenlos und der Quellcode einsehbar, es ist keine Open Source im Sinne der OSI, und Abschnitt 5 erlaubt es Ihnen, die Bibliothek in Ihre eigenen SPS-Projekte einzubauen und das kompilierte Ergebnis auszuliefern oder zu verkaufen, nie die Bibliothek selbst. Die [Lizenzseite](https://hotloop.io/license/) hat den Text.
