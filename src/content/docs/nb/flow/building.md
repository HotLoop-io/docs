---
title: "Bygg Flow fra kildekoden"
description: "Bygg Flow-binæren fra kildekoden: én statisk binær med editoren inni og ikke noe C-bibliotek under."
---

HotLoop Flow er én statisk binær med editoren inni, så de fleste henter det publiserte imaget og bygger aldri noe. Vil du ha ditt eget bygg, er kildekoden offentlig, og et bygg trenger Go og Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

Resultatet er statisk, uten C-bibliotek under, så det kjører på et distroless-image uten noe annet installert. Hver Flow-utgivelse bygges fra en versjonsetikett og ingenting annet, så imaget på fabrikkgulvet ditt er alltid et du kan navngi og spore tilbake til en utgivelse.