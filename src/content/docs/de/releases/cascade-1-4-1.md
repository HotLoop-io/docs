---
title: "Versionshinweise: HotLoop Cascade 1.4.1"
description: "Was HotLoop Cascade 1.4.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.4.1"
---

## Worum es geht

1.4.1 behebt eine Sache auf der Einstellungsseite und räumt die Sprachordner auf. Die Engine, das Dateiformat, die REST-API, der MCP-Server und alle anderen Bildschirme sind die von 1.4.0.

## Die Einstellungsseite behält, was Sie geändert haben

Jedes Speichern auf der Einstellungsseite wird mit den Einstellungen beantwortet, wie der Server sie hat. Wenn Sie ein Feld änderten, nachdem Sie auf Speichern gedrückt hatten und bevor diese Antwort zurückkam, setzte die Antwort das Feld ohne Meldung auf den Wert zurück, den Sie gerade verlassen hatten. Ein Admin, der speicherte und gleich danach das nächste Feld änderte, konnte diese Änderung verlieren.

Jetzt übernimmt ein Feld, das noch enthält, was gesendet wurde, den Wert des Servers, und ein Feld, das Sie seither bearbeitet haben, behält Ihre Bearbeitung. Ein Browser-Test hält die Antwort anderthalb Sekunden zurück und ändert dazwischen ein Feld. Auf der Seite von 1.4.0 schlägt er fehl (er zeigt den ersten Wert, wo der zweite gesetzt war), auf dieser Seite besteht er.

## Die Sprachordner

Die `_review.json`-Listen in jedem Sprachordner sind weg, ebenso die Build-Prüfung, die sie las. Sonst las sie niemand, und eine Durchsicht durch Muttersprachler ist nicht geplant. Die Übersetzungen sind die, die 1.4.0 ausgeliefert hat.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. `stable`, `latest`, `1.4` und `1` führen das neue amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten.

## Upgrade und zurück

Keine Migrationen: Das Schema ist das von 1.4.0. `helm upgrade` auf 1.4.1, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. 1.4.0 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat.
