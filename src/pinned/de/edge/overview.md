---
title: "HotLoop Edge im Überblick"
description: "HotLoop Edge ist IoT plus Maschinenebene: OPC-UA-Server, Sparkplug B und Store and Forward, das das Werk bei gekappter Verbindung am Laufen hält."
sidebar:
  label: "Übersicht"
---

:::note[Edge ist erschienen, erstmals in 4.18.10]
Das Image ist `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}`, gebaut für amd64, arm64 und arm/v7, etwa 37 MB auf amd64 und 34 MB auf arm, und das Chart ist `hotloop-edge` von `https://hotloop.io/hotloop`. Beides lässt sich ohne Anmeldung laden. Die Quadlet-Units liegen im Verzeichnis `edge/` von [Podman Quadlet](/de/install/quadlet/). [Installieren Sie es](/de/edge/install/). Vor 4.18.10 konnte das Gateway am Rand laufen und Sparkplug nach oben veröffentlichen, und das kann es seit 4.5.0, aber dafür brauchte es das ganze Gateway.
:::

Edge ist eine Box, die neben einer Linie festgeschraubt wird. Sie liest die Maschine, führt die Regeln an der Maschine aus, arbeitet weiter, wenn das WAN ausfällt, und sagt dem Rest des Werks, was sie gesehen hat. Sie nutzt dasselbe Schreib-Gate wie alles andere.

Sie kann alles, was [IoT](/de/iot/overview/) kann, und zwei Dinge obendrauf.

## Was Edge dazubringt

- **[Edge-Veröffentlichung und Store and Forward](/de/edge/edge-publish/).** Sie veröffentlicht alles, was sie liest, als Sparkplug-B-Edge-Node nach oben. Fällt die Verbindung aus, puffert sie auf die Platte und spielt in der richtigen Reihenfolge nach, sobald die Verbindung wieder da ist. So bekommt der Historian oben den Ausfall aufgefüllt statt einer Lücke, solange der Ausfall in die Warteschlange passt. Die Warteschlange hat standardmäßig 64 MiB, etwa 248.000 Messwerte: etwa 41 Minuten bei 100 Messwerten pro Sekunde, etwa zwei Minuten bei 2.000. Darüber fallen die ältesten Messwerte zuerst weg, jeder wird gezählt, und `edgePublish.queueMaxBytes` erhöht das Limit. Messwerte gehen in den Speicher, solange der Broker sie bestätigt, und nur auf die Platte, wenn er aufhört. Ein Test kappt die Verbindung unter Last, beendet den Prozess mitten im Ausfall und zählt jeden Messwert. Ein harter Abbruch bei bestehender Verbindung kann noch etwa einen Abfragezyklus an Messwerten kosten, und die Seite sagt das, mit Zahlen.
- **[Der OPC-UA-Server](/de/edge/opc-ua-server/).** Schreibgeschützt und gesichert. Das SCADA, das Sie schon haben, sieht jedes Tag ohne neuen Treiber, und Ignition 8.3.9 hat ihn von Anfang bis Ende gelesen. Er ist vom ersten Start an an, auf Port 4840.

Die lokalen Bildschirme und die Logik laufen bei gekappter Verbindung weiter, und ein Test startet das echte Binary gegen eine Verbindung, die alles verschluckt, um das zu beweisen. Eine Box, die während eines WAN-Ausfalls neu startet, kommt mit ihren Bildschirmen und Alarmen hoch, während sie vor 4.18.10 ohne Bildschirme und Alarme in einer Absturzschleife hing, bis das WAN zurückkam. Die Dashboards sind die Bildschirme, und sie stehen in [IoT](/de/iot/dashboards/). Ein HMI-Schreibzugriff, der einen Menschen, eine PIN oder einen Ausweis an einem gemeinsamen Bedienfeld nennt, ist noch nicht gebaut. Er steht in [der Roadmap](/de/roadmap/).

## Was es nicht hat

Keine Flotte, kein Multi-Standort und keine geplanten Berichte. Die gehören zum [Gateway](/de/gateway/overview/) und sind nicht im Edge-Binary.

## Datenbanken

SQLite, PostgreSQL oder TimescaleDB, aus demselben Binary. Das Chart und die Quadlet-Units betreiben standardmäßig TimescaleDB und behalten 90 Tage Verlauf, sofern Sie es nicht ändern. Im Chart ist das `database.type`, und `HOTLOOP_DB_TYPE=sqlite` stellt die Box auf eine Datei ohne Datenbank-Container. [Die Produktübersicht](/de/products/) hat die Tabelle.

## Installation

[Die Edge-Installationsseite](/de/edge/install/) hat Helm und Podman Quadlet, mit den Befehlen. Ein Standort, der von IoT auf Edge und auf das Gateway wechselt, behält jedes Gerät, jeden Tag, jede Entität, Automatisierung, jeden Alarm, Benutzer und jede Stunde Verlauf, und [die Produktübersicht](/de/products/) sagt, wie.

Setzen Sie es in einem Werk ein? [HotLoop im Unternehmen nutzen](/de/business/) behandelt die Lizenz und wie Sie uns erreichen.
