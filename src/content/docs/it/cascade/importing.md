---
title: "Importare un flusso di lavoro"
description: "Come portare in Cascade un flusso di lavoro esistente, che cosa viene riportato e che cosa l'importatore segnala di non aver potuto riportare."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` converte un flusso di lavoro esportato come JSON da un altro strumento. Riporta ciò di cui può essere sicuro: i passaggi che conosce e le letture di campo nelle loro impostazioni. Tutto il resto arriva disattivato, con le impostazioni originali nelle sue note, e il report elenca ogni elemento e il motivo. Non trasforma mai un'espressione JavaScript in una supposizione su ciò che intendeva, e non porta mai credenziali, perché un'esportazione non le contiene: il report indica quale slot ha bisogno di quali. Poi `workflows import workflow.yaml` lo importa.
