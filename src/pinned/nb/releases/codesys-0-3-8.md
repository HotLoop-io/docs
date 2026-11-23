---
title: "Utgivelsesnotater HotLoop for CODESYS 0.3.8"
description: "Chart 0.3.8 for HotLoop for CODESYS: provisioner-imaget det kjører er 0.3.3, bygget for amd64 og arm64."
sidebar:
  label: "0.3.8"
---

## Hva som er endret

0.3.8 er i indeksen `{{codesysChartRepo}}`, publisert 2026-11-19.

- **Det kjører provisioner 0.3.3,** det første provisioner-imaget bygget for amd64 og for arm64, så chartet installeres på en arm64-node.
- **Ingenting annet endret seg.** Malene, verdiene og HotLoop det omslutter (4.22.0) er de samme som i [0.3.7](/nb/releases/codesys-0-3-7/).

Hva det betyr for deg: installer denne. På en amd64-node er ingenting annerledes.

## Hva som ble sjekket

Det publiserte chartets verdier leser provisioner 0.3.3 og HotLoop 4.22.0, og image-indeksen for 0.3.3 lister amd64 og arm64. Chartet ble ikke installert på nytt på en klynge for denne utgivelsen, fordi bare image-taggen flyttet seg.
