---
title: "Versionshinweise: HotLoop for CODESYS 0.3.8"
description: "Chart 0.3.8 von HotLoop for CODESYS: Das Provisioner-Image, das es ausführt, ist 0.3.3, gebaut für amd64 und arm64."
sidebar:
  label: "0.3.8"
---

## Was sich geändert hat

0.3.8 steht im Index `{{codesysChartRepo}}`, veröffentlicht am 2026-11-19.

- **Es führt den Provisioner 0.3.3 aus,** das erste Provisioner-Image, gebaut für amd64 und für arm64, sodass das Chart auf einem arm64-Node installiert.
- **Sonst hat sich nichts geändert.** Die Templates, die Werte und das umhüllte HotLoop (4.22.0) sind die von [0.3.7](/de/releases/codesys-0-3-7/).

Was das für Sie bedeutet: Installieren Sie dieses. Auf einem amd64-Node ist nichts anders.

## Was geprüft wurde

Die Werte des veröffentlichten Charts lesen den Provisioner 0.3.3 und HotLoop 4.22.0, und der Image-Index von 0.3.3 listet amd64 und arm64. Das Chart wurde für dieses Release nicht auf einem Cluster neu installiert, weil sich nur das Image-Tag bewegte.
