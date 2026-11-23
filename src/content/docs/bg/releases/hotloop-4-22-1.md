---
title: "Бележки към изданието: HotLoop core 4.22.1"
description: "Какво носи HotLoop core 4.22.1, какво се променя при обновяването и какво да прочетете, преди да пипнете работещ завод."
sidebar:
  label: "4.22.1"
---

Това е multi-arch изграждането на [4.22.0](/bg/releases/hotloop-4-22-0/). Продуктовият код е същият като на 4.22.0: страницата на панела, която запълва екрана си, Import from CODESYS на екрана Alarms, споделените OPC UA PubSub сокети и HotLoop Free Use License 1.0. 4.22.0 беше изграждането за amd64, а `stable` запази arm образите, които вече държеше.

4.22.1 изгражда пълния набор: Gateway за amd64 и arm64, а Edge, IoT и Edge Relay за amd64, arm64 и arm/v7. Прочетете [бележките на 4.22.0](/bg/releases/hotloop-4-22-0/) за всичко, което се е променило след 4.21.1.

- И четирите chart-а (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) са на 4.22.1, като всяка по-ранна версия още е в индекса.
