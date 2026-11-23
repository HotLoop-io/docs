---
title: "Versionshinweise: HotLoop Cascade 1.0.2"
description: "Was HotLoop Cascade 1.0.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.0.2"
---

## Worum es geht

1.0.2 lässt einen Workflow Dinge signieren und prüfen, ohne dass ein Geheimnis je in Elementdaten steht, und lässt ein öffentliches Formular auf einer anderen Website einen Webhook aus dem Browser aufrufen. Sonst hat sich gegenüber 1.0.1 nichts geändert.

## Neu im Code-Schritt

- **Krypto-Helfer.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` und `safeEqual(a, b)`. Sie werden in Go berechnet, die Ergebnisse sind also die der Standardbibliothek, und das Skript hat weiterhin kein `require`, kein Netzwerk und keine Dateien.
- **Zugangsdaten für den Schritt.** Der Code-Schritt hat einen Zugangsdaten-Slot `secret`. Geben Sie ihm Zugangsdaten vom Typ `HMAC key` (ein neuer eingebauter Typ mit einem einzigen geheimen Feld, `key`), und das Skript liest sie als `credential.key`. Der Schlüssel liegt im Tresor wie jedes andere Geheimnis, und der Tresor schwärzt ihn in allem, was der Lauf speichert, selbst wenn das Skript ihn zurückgibt. Ein Schritt ohne Zugangsdaten sieht ein leeres `credential`-Objekt.

Der Grund: Ein öffentliches Formular prüft einen Proof of Work mit einem HMAC. Bisher ging das in einem Workflow nur, indem man den Schlüssel in ein Element oder eine Variable legte, und beides landet in gespeicherten Läufen oder im Klartext. Jetzt gehört der Schlüssel zu den Zugangsdaten und der gespeicherte Lauf enthält die Signatur und sonst nichts.

## Neu bei einem Webhook

- **`corsOrigins`.** Ein Webhook-Trigger nimmt eine Liste von Web-Origins (`https://example.com`, oder `*`), deren Seiten ihn aus einem Browser aufrufen dürfen. Cascade beantwortet die Preflight-Anfrage des Browsers selbst, ohne einen Lauf zu starten, und fügt der Antwort für einen aufgeführten Origin `Access-Control-Allow-Origin` hinzu. Ein Webhook ohne Eintrag verhält sich exakt wie zuvor: keine CORS-Header, also kann eine Browserseite die Antwort nicht lesen. Ein Eintrag muss ein Origin sein, ohne Pfad.

## Upgrade und zurück

Keine Migrationen. `helm upgrade` auf 1.0.2, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. Workflows, die die neuen Helfer nie berühren, verhalten sich exakt wie zuvor, deshalb ist das Zurückspielen von 1.0.1 für sie sicher; ein Workflow, der einen neuen Helfer aufruft, scheitert auf 1.0.1 mit nicht definiertem Helfer. Ein Backup vor jedem Update bleibt eine gute Gewohnheit.
