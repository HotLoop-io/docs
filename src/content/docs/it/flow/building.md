---
title: "Compilare Flow dal codice sorgente"
description: "Compilare il binario di Flow dal codice sorgente: un binario statico con l'editor dentro e nessuna libreria C sotto."
---

HotLoop Flow è un binario statico con l'editor dentro, perciò la maggior parte delle persone scarica l'immagine pubblicata e non compila nulla. Per una propria compilazione il codice sorgente è pubblico, e servono Go e Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

Il risultato è statico, senza una libreria C sotto, quindi gira su un'immagine distroless senza nient'altro installato. Ogni versione di Flow è compilata da un tag di versione e da nient'altro, così l'immagine nel proprio impianto è sempre una che si può nominare e ricondurre a una versione.