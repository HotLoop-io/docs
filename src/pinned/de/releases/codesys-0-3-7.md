---
title: "Versionshinweise: HotLoop for CODESYS 0.3.7"
description: "Chart 0.3.7 von HotLoop for CODESYS: umhüllt HotLoop 4.22.0 und führt den Provisioner 0.3.2 aus."
sidebar:
  label: "0.3.7"
---

## Was sich geändert hat

0.3.7 steht im Index `{{codesysChartRepo}}`, veröffentlicht am 2026-11-19.

- **Es umhüllt HotLoop 4.22.0,** das jedem OPC-UA-PubSub-Gerät auf derselben Adresse und demselben Port einen gemeinsamen Socket gibt, sodass zwei Listener auf einem UDP-Port sitzen können.
- **Der Provisioner nimmt zwei Listener auf einem Port.** Der Provisioner 0.3.2 weist ein Profil mit zwei `opcua-pubsub`-Geräten auf einem Port nicht mehr ab.

Was das für Sie bedeutet: Ein Profil mit mehreren PubSub-Publishern auf einem Port installiert und liest sich.

## Was geprüft wurde

Eine frische Installation mit einem Profil des eigenen Geräts der Runtime, zwei PubSub-Listenern auf demselben UDP-Port, einem Alarm und einer Bildschirmseite, neben einer echten CODESYS-Control-for-Linux-SL-4.22.0.0-Runtime mit der Transmitter-Bibliothek: Alles wurde ohne Handgriff angelegt, die Variablen der SPS lasen sich gut, der Alarm löste auf dem eigenen Wert der SPS aus, und beide Listener lasen sich verbunden. Gegen einen echten Publisher in beiden Kodierungen las sich jedes der 32 Felder gut und gleich der SPS. Beide Pods gelöscht und die Runtime neu gestartet: HotLoop kam von selbst mit seinen drei Geräten zurück.
