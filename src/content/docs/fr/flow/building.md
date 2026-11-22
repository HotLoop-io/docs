---
title: "Compiler Flow depuis les sources"
description: "Compilez le binaire de Flow depuis les sources : un binaire statique avec l'éditeur à l'intérieur, sans bibliothèque C en dessous."
---

HotLoop Flow est un binaire statique avec l'éditeur à l'intérieur, si bien que la plupart des gens récupèrent l'image publiée et ne compilent jamais rien. Si vous voulez votre propre compilation, le code source est public, et il faut Go et Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

Le résultat est statique, sans bibliothèque C en dessous, il tourne donc sur une image distroless sans rien d'autre d'installé. Chaque version de Flow est compilée à partir d'une étiquette de version et de rien d'autre, de sorte que l'image sur votre atelier est toujours une image que vous pouvez nommer et relier à une version.