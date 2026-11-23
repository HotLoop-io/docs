---
title: "Roadmap von HotLoop for CODESYS"
description: "Was HotLoop for CODESYS gebaut, veröffentlicht und auf echter Hardware ausgeführt hat."
sidebar:
  label: "Roadmap"
editUrl: false
---

Das ist die Liste dessen, was fertig ist und was noch fehlt, in der Reihenfolge, in der es erledigt wird. Sie verspricht nichts, was nicht im Code oder in einem Testplan steht, und [Stand](/de/codesys/where-it-stands/) sagt, wie weit es gelaufen ist.

## Gebaut

- [x] Ein Chart um HotLoop Edge mit Standardwerten für eine Runtime auf einem Knoten: SQLite, ein Replikat, Toleranzen, die beide Pods bei verlorener Control Plane behalten.
- [x] Ein Provisioner, der ein Profil anwendet und es richtig hält, mit einer Revision, die schützt, was eine Person geändert hat.
- [x] Ein Profil, das eine Liste von Geräten beliebiger von HotLoop gesprochener Protokolle trägt, sodass ein Listener ohne SPS konfiguriert zurückkommt.
- [x] Gerät, Tags, Alarm und Bild ohne Handgriff erstellt, gegen eine CODESYS Control for Linux SL 4.22.0.0 Runtime in einem Container.
- [x] Wiederherstellung nach einem Runtime-Neustart ohne Eingriff, in etwa 88 Sekunden.
- [x] Eine signierte Anmeldung aus dem EmberCORE-Dashboard, mit den Ablehnungen.

## Ausgeliefert

- [x] HotLoop 4.22.0, das Release, das das Chart umhüllt.
- [x] Das Chart veröffentlicht unter `https://hotloop.io/hotloop-codesys/`, 0.3.8 das neueste.
- [x] Das Provisioner-Image öffentlich, es lässt sich also ohne Anmeldung ziehen, 0.3.3.
- [x] Ein Multi-Arch-Provisioner-Image, amd64 und arm64, ab 0.3.3 und Chart 0.3.8.
- [x] Zwei OPC-UA-PubSub-Listener auf einem UDP-Port, mit HotLoop 4.22.0 und Chart 0.3.7.
- [x] [Versionshinweise](/de/releases/codesys-0-3-10/) für jedes Chart, 0.3.0 bis 0.3.10.

## Auf Bare Metal bewährt

- [x] Auf Bare Metal ausgeführt (2026-11-17), einschließlich einer Installation von der echten App-Store-Seite, so wie es die Mitarbeiter tun, k3s v1.35.7, einem Knoten, der seine Verbindung zur Control Plane tatsächlich verliert und die Pods behält, einem Download aus der CODESYS-IDE bei laufender Runtime, einer Runtime im eigenen Netz des Hosts neben dem HotLoop-Pod auf einem Knoten und einer Runtime mit eingeschalteter Benutzerverwaltung und einem zertifikatgesicherten OPC-UA-Endpunkt.

## Noch zu bauen

- [ ] Mehr als ein Bild in einem Profil.
