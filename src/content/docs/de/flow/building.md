---
title: "Flow aus dem Quellcode bauen"
description: "Bauen Sie das Flow-Binary aus dem Quellcode: ein statisches Binary mit dem Editor darin, ohne C-Bibliothek darunter."
---

HotLoop Flow ist ein statisches Binary mit dem Editor darin, daher laden die meisten das veröffentlichte Image und bauen nie etwas selbst. Wenn Sie einen eigenen Build möchten, ist der Quellcode öffentlich, und für den Build brauchen Sie Go und Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

Das Ergebnis ist statisch, ohne C-Bibliothek darunter, und läuft deshalb auf einem Distroless-Image, auf dem sonst nichts installiert ist. Jedes Flow-Release wird aus einem Versions-Tag gebaut und aus nichts sonst, sodass das Image in Ihrer Fertigung immer eines ist, das Sie benennen und auf ein Release zurückführen können.