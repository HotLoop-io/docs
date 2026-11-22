---
title: "HotLoop for CODESYS: Überblick"
description: "HotLoop neben einer CODESYS-Runtime: Bilder und Alarme für eine CODESYS-SPS, gelesen über den OPC-UA-Server der Runtime, ohne Installation in CODESYS."
sidebar:
  label: "Überblick"
editUrl: false
---

HotLoop for CODESYS ist HotLoop, das auf demselben Knoten läuft wie eine CODESYS-Runtime. Es liest die Variablen der SPS über den OPC-UA-Server der Runtime, legt sie auf Bilder, die auf einem Panel-PC, einem Telefon oder einer Wand funktionieren, löst Alarme darauf aus und führt die Historie. In CODESYS wird nichts installiert, und nichts schreibt in die SPS. Es ist das Bild, das Sie sonst in CODESYS WebVisu bauen würden, nur außerhalb der Runtime gezeichnet. Was Ihnen das bringt: Die Bediener bekommen ein Bild ohne Download auf die SPS, und die SPS bekommt ein zweites Augenpaar, das von nichts anderem auf dem Knoten abhängt.

Es ist eines der acht HotLoop-Produkte und hat seine eigene Release-Linie. Das neueste Chart ist 0.3.8, veröffentlicht am 2026-11-16. Darunter liegt HotLoop Edge, alles auf den [Edge-Seiten](/de/edge/overview/) gilt also auch hier.

![Das Bild Line 2: vier Wertkarten, eine Anzeige, ein Fünfzehn-Minuten-Trend und eine Alarmliste](/codesys/screen.png)
![Dasselbe, dunkel](/codesys/screen-dark.png)

Das ist ein echter Lauf: die Standardoberfläche von HotLoop liest eine CODESYS Control for Linux SL 4.22.0.0 Runtime. Das SPS-Programm ist das Demoprogramm von HotLoop, die Zahlen sind also die der Demo. Die Beschriftungen (Line 2, Mixer temperature, Riverside Bottling) sind erfunden und werden vom [Profil](/de/codesys/profile/) gesetzt.

## Die drei Teile

| Teil | Was es ist | Wo es liegt |
|---|---|---|
| Das Chart `hotloop-codesys` | Ein Wrapper um `hotloop-edge` mit Standardwerten für eine Runtime auf einem Knoten: SQLite, ein Replikat, und abgeschaltet, was neben einer SPS nicht gebraucht wird. Jede Korrektur der HotLoop-Charts kommt hier an. | `https://hotloop.io/hotloop-codesys/` |
| Der Provisioner | Eine statische Go-Binärdatei, die ein Profil auf HotLoop anwendet und es richtig hält. Sie hält kein Profil. | `ghcr.io/hotloop-io/hotloop-provision` |
| Ein Profil | Eine JSON-Datei: das Gerät, die zu behaltenden Variablen, die Alarme und ein Bild. Die einzige Eingabe, die Sie geben. | Ein Secret im Namespace der Installation, [hier beschrieben](/de/codesys/profile/) |

## Wie es die SPS liest

CODESYS dokumentiert einen einzigen Weg, wie ein Dritter die Variablen einer Steuerung lesen kann, und das ist der OPC-UA-Server der Runtime selbst. Die SPS veröffentlicht, was Sie sehen wollen, mit einer Symbol Configuration in der IDE, und HotLoop liest diese Variablen unter den Namen, die der Programmierer ihnen gegeben hat, wie `Application.GVL_Line.rTemp`, nicht über eine Node-ID. Die Symbol Configuration ist die einzige Änderung am SPS-Projekt. Das Kanalprotokoll des CODESYS Gateway ist für Dritte nicht dokumentiert, und dies spricht es nicht.

Gelesen wird über den CODESYS-Konnektor von HotLoop core, das ist der OPC-UA-Treiber plus das, was eine CODESYS-SPS obendrauf braucht: Erkennung dessen, was die Anwendung exportiert, der Typen, die sie hat, Arrays und Strukturen, die bis zu einem Punkt pro Feld aufgelöst werden, ein Wiederverbinden ohne Eingriff nach einem Neustart oder Download und jede Anfrage auf die Grenzen zugeschnitten, die die Runtime veröffentlicht. Die [Protokollseite](/de/iot/protocols/) enthält die Referenz des Konnektors ab HotLoop 4.19.4 und sagt, wogegen er geprüft wurde und wogegen nicht.

## Was es von allein tut

Sobald HotLoop und die Runtime des Knotens beide antworten, richtet der Provisioner das Gerät des Profils, seine Variablen, seine Alarme und sein Bild ein. Danach schaut er alle fünf Minuten wieder nach. Eine Variable des Profils, die die SPS inzwischen bekommen hat, wird hinzugefügt. Eine, die die SPS nicht mehr hat, wird mit dem Grund des Servers als schlecht gelesen. Das Bild und die Alarme werden angelegt, wenn sie fehlen, und nur ersetzt, wenn das `revision` des Profils höher ist als das, das sie erzeugt hat, sodass eine Änderung von Hand erhalten bleibt, bis absichtlich ein neueres Profil ausgeliefert wird.

## Was es nicht tut

- **Es schreibt nicht in Ihre SPS.** Jeder Tag, den der Provisioner einrichtet, ist schreibgeschützt, und das Profil markiert keinen als schreibbar. Eine Person kann einen Tag später scharf schalten, und dann haben das [Schreib-Gate](/de/gateway/write-gate/) und die eigenen Symbolrechte der SPS ein Wort mitzureden.
- **Es legt nichts in die Runtime.** Keine Bibliothek, keine Task, keinen Agenten.
- **Es braucht keinen Datenbank-Pod.** SQLite auf dem eigenen Speicher des Knotens, ein Replikat.
- **Es ist darauf ausgelegt, seine Bilder bei verlorener Verbindung zu behalten.** Beide Pods tolerieren einen nicht erreichbaren oder nicht bereiten Knoten ohne Zeitlimit, und die Toleranzen stehen im Chart. [Stand](/de/codesys/where-it-stands/) sagt, was auf einem echten Knoten gelaufen ist.

## Wie es weitergeht

[Installieren Sie es](/de/codesys/install/), lesen Sie, was ein [Profil](/de/codesys/profile/) enthält, oder sehen Sie [den Stand](/de/codesys/where-it-stands/) und die [Roadmap](/de/codesys/roadmap/). Im Einsatz in einem Werk? [HotLoop im Unternehmen nutzen](/de/business/) behandelt die Lizenzierung und wie Sie uns erreichen.
