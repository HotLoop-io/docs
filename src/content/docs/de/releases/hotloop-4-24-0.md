---
title: "Versionshinweise: HotLoop core 4.24.0"
description: "Was HotLoop core 4.24.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.24.0"
---

HotLoop-Bildschirme sind P&IDs. Die eigenen Alarme einer CODESYS-SPS erscheinen in HotLoops Alarmliste, und eine Quittierung geht zurück an die SPS, ein Skriptlauf endet immer, das Datenvolumen einer Box liest sich immer, und die Roadmap-Zeilen zu UniFi Protect, Access und Strom sind ausgeliefert. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Bildschirme sind P&IDs.** Ziehen Sie Tanks, Pumpen, Ventile, Wärmetauscher, Filter, Instrumente und Verbindungen auf eine Symbolseite, dann von einem Anschlusspunkt zum anderen: Die Rohrleitung verlegt sich selbst in rechten Winkeln um alles auf der Seite, zweigt mit einer Verbindung ab, wo Sie sie auf eine andere Leitung fallen lassen, und verlegt sich neu, während Sie ein Symbol bewegen. Jede Leitung trägt ihr Medium (Wasser, Dampf, Brennstoff, Luft, Strom, Signal und mehr, jedes mit Farbe, Kennzeichen und Linienmuster, sodass die Farbe nie der einzige Träger ist) und bewegt sich mit ihrem Tag oder einer Regel. Jede Symbolseite bekommt eine Werkzeugleiste zum Zoomen, Verschieben, Anzeigen einer Minikarte und Wechseln zur grauen Hochleistungsansicht, und ein P&ID wird in derselben Bildschirmdatei gespeichert, exportiert und importiert. Siehe [Dashboards](/de/iot/dashboards/) und [Screen files](/de/iot/screen-file/).
- **Die eigenen Alarme einer CODESYS-SPS erscheinen in HotLoops Alarmliste.** Die Alarm Configuration eines Projekts hält Alarmgruppen und -klassen und Alarme, die eine Variable beobachten. Ein CODESYS-Gerät liest jetzt die, die der Alarmmanager seiner SPS hält (aktiv, wartend auf Quittierung, quittiert, während die Bedingung noch gilt), und eine in HotLoop gemachte Quittierung geht zurück an die SPS. Eine SPS, die keine zu geben hat, bleibt unberührt. Es braucht die HotLoop-Alarms-Bibliothek und einen Baustein im Projekt. Siehe CODESYS-ALARMS.md.
- **Das Datenvolumen der Box liest sich immer.** Eine Box, bei der nichts unter `/data` eingehängt ist, hat kein `/data`, und das Tag `data_util_pct` der Box-Gesundheit las sich schlecht mit „no such file or directory“. Es liest jetzt das Volume, auf dem der Datenordner angelegt werden wird. Siehe [Protokolle und Treiber](/de/iot/protocols/#zustand-der-box).
- **Ein Skriptlauf endet immer.** Wenn die Datenbank das Schreiben des Endes eines Skriptlaufs ablehnte, schrieb HotLoop es ins Log und gab auf, sodass der Lauf für die Lebenszeit des Prozesses „running“ las, obwohl sein Platz längst frei war. Das Schreiben wird jetzt erneut verlangt, bis zu fünfmal mit kurzer Wartezeit dazwischen.
- **UniFi Protect, Access und SmartPower-PDU-Ausgänge sind in der Roadmap ausgeliefert.** Sie kamen als Geräte in der 4.23.6, nach den veröffentlichten APIs gebaut, wobei jeder Pfad von Protect mit dem Dokument 7.4.102 übereinstimmt. Siehe [HotLoops Roadmap](/de/roadmap/).
- **Ein TwinCAT-Bildschirm ist in einem Browser bewiesen.** Das TwinCAT-PackML-Beispiel wird mit seinen Rahmen importiert, gerendert, und eine Lampe folgt einem Live-Register.
- **Tests warten auf das, worauf sie warten.** Das Warten des Panel-Throttles wird als Arithmetik geprüft, der Timer der forSec-Haltezeit liegt in der Hand des Tests und läuft nicht im Rennen gegen eine Pause, der Apache-Kafka-Topic-Test löscht seine Topics sofort und hat die Zeit, die eine langsame Box braucht, und ein API-Test begrenzt eine Anmeldung nicht mehr durch eine einzige Stichprobe, weil eine belastete Box viermal langsamer antwortet als eine Sekunde zuvor.

## Migrationen

Keine.

## API-Änderungen

Keine. Keine Route hat sich geändert. Die Konfiguration einer Symbolseite nimmt `pipes`, `view` und das `rot` eines Symbols, und eine gespeicherte Bildschirmdatei trägt sie.

## Update von 4.23.6

Ein normales `helm upgrade`. Keine Migration und kein neues Secret. Eine Symbolseite ohne Leitungen wird wie zuvor gezeichnet.

## Was nicht bewiesen ist

- Der Alarmpfad der SPS lief gegen eine echte Runtime CODESYS Control for Linux SL 4.22.0.0 mit dem Alarm-Laborprogramm.
- Protect, Access und die Ausgänge der PDU folgen den veröffentlichten APIs, und der Prüfstandslauf mit echter Hardware folgt im Büro.
