---
title: "Compilar Flow desde el código fuente"
description: "Compile el binario de Flow desde el código fuente: un binario estático con el editor dentro y ninguna biblioteca C por debajo."
---

HotLoop Flow es un binario estático con el editor dentro, así que la mayoría de la gente descarga la imagen publicada y nunca compila nada. Si quiere su propia compilación, el código fuente es público, y compilar requiere Go y Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

El resultado es estático, sin biblioteca C por debajo, así que funciona en una imagen distroless sin nada más instalado. Cada versión de Flow se compila a partir de una etiqueta de versión y de nada más, de modo que la imagen de su planta siempre es una que puede nombrar y rastrear hasta una versión.