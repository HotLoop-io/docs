---
title: "Versionshinweise: HotLoop for CODESYS 0.3.3"
description: "Chart 0.3.3 von HotLoop for CODESYS: umhüllt HotLoop 4.20.0, sodass die neue Web-Oberfläche und die MCP-Werkzeuge die Tester erreichen."
sidebar:
  label: "0.3.3"
---

## Was sich geändert hat

0.3.3 steht im Index `{{codesysChartRepo}}`, veröffentlicht am 2026-11-15. Der Provisioner ist derselbe, den 0.3.2 ausführte.

- **Es umhüllt HotLoop 4.20.0.** Die neue Web-Oberfläche ist die Seite unter `/`, und ein Agent kann über MCP alles ändern, was er lesen kann, hinter dem Write Gate.

Was das für Sie bedeutet: Eine Box auf 0.3.3 bekommt die neue Oberfläche und die MCP-Werkzeuge mit einem Chart-Upgrade und sonst nichts.

## Was geprüft wurde

Ein Upgrade von 0.3.1 mit einem auf 0.3.3 angewendeten Profil, neben einer CODESYS-Control-for-Linux-SL-4.22.0.0-Runtime: Ein neuer Pod auf 4.20.0 kam hoch, die Geräte und ihre 2232 Tags waren noch da, und die Listener verbanden sich wieder. Es wurde auf Bare Metal ausgeführt (2026-11-17).
