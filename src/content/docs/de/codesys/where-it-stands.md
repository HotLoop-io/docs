---
title: "Stand von HotLoop for CODESYS"
description: "Wogegen HotLoop for CODESYS auf echter Hardware gelaufen ist und was veröffentlicht ist."
sidebar:
  label: "Stand"
editUrl: false
---

Diese Seite zeigt, was veröffentlicht ist und wie weit HotLoop for CODESYS gelaufen ist.

## Was draußen ist

- **Das Chart.** `hotloop-codesys` 0.3.8 steht im Index unter `https://hotloop.io/hotloop-codesys/`, veröffentlicht am 2026-11-19, mit allen früheren Versionen daneben. Es umhüllt HotLoop 4.22.0. Installieren Sie 0.3.8: [Die Versionshinweise](/de/releases/codesys-0-3-5/) sagen, was jedes Chart geändert hat.
- **Das Provisioner-Image.** `ghcr.io/hotloop-io/hotloop-provision` in 0.3.3 lässt sich ohne Anmeldung ziehen, für amd64 und für arm64, und das Chart führt es aus.
- **Der App-Store-Eintrag.** Er steht im App Store von EmberCORE, und EmberNet installiert ihn auf Ihrem Tenant.

## Wie weit es gelaufen ist

Das Chart auf einem k3s-Knoten mit Store-förmigen Werten, eine echte CODESYS Control for Linux SL 4.22.0.0 Runtime auf demselben Knoten mit einem Demoprogramm und ein HotLoop-Edge-Image.

- Das Gerät, seine Tags (keiner schreibbar), sein Alarm und sein Bild erschienen ohne Handgriff.
- Jeder Wert wurde gut gelesen und bewegte sich.
- Die Pods kamen nach dem Löschen eines Pods zurück.
- Die Installation wurde während eines Runtime-Neustarts mit dem Grund "the PLC's runtime is not answering" als schlecht gelesen und kam etwa 88 Sekunden später von selbst zurück.
- Eine signierte Anmeldung aus dem Dashboard meldete eine Person als Bediener oder als Administrator an, und eine falsche App, ein falscher Tenant, eine abgelaufene Anmeldung, ein falscher Aussteller und eine manipulierte wurden jeweils abgelehnt.
- Das veröffentlichte Chart wird mit Helm aus dem Live-Index gerendert.

Der Konnektor darunter, der CODESYS-Treiber von HotLoop core, ist live gegen eine CODESYS Control for Linux SL 4.22.0.0 Runtime geprüft, für Lesen und Schreiben, und auf Bare Metal (2026-11-17). Schreibzugriffe gibt es im Konnektor, und dieses Produkt schaltet sie nie ein.

All das ist auch auf Bare Metal gelaufen (2026-11-17).

## Was ein Profil noch nicht kann

Ein Profil erzeugt ein Bild. Es erzeugt ein Gerät aus `device` oder mehrere beliebiger Protokolle aus `devices`, und es gibt darin absichtlich keine Möglichkeit, eine Variable als schreibbar zu markieren.
