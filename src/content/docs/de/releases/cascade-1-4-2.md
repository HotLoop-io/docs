---
title: "Versionshinweise: HotLoop Cascade 1.4.2"
description: "Was HotLoop Cascade 1.4.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.4.2"
---

## Worum es geht

1.4.2 gibt der Anmeldeseite ein aufgeräumteres Aussehen. Die Engine, das Dateiformat, die REST-API, der MCP-Server und alle anderen Bildschirme sind die von 1.4.1.

## Die Anmeldeseite

Die Seite ist jetzt eine einzelne Karte auf ruhigem Hintergrund, mit der Marke und dem Namen HotLoop Cascade zentriert darüber. Anmelden ist der eine orange Button. Die Anmeldung mit Passkey und Single Sign-on sind schlichte Buttons darunter, und der Single-Sign-on-Button zeigt das Vord-Symbol, wenn Vord der Anbieter ist. Sie liest sich in Hell und Dunkel und auf einem Telefon gleich, und die Sprach- und Design-Buttons bleiben oben rechts.

An der Art der Anmeldung hat sich nichts geändert: dieselben Felder, dieselben Zugänge, Ersteinrichtung, Anmeldung über das Verzeichnis, der zweite Faktor, das Hinzufügen eines Passkeys oder einer Authenticator-App. Die Seite behält ihre IDs, sodass Passwortmanager und Lesezeichen sich wie zuvor verhalten.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. `stable`, `latest`, `1.4` und `1` führen das neue amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten.
