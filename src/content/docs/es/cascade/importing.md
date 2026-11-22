---
title: "Traer un flujo de trabajo"
description: "Importe un flujo de trabajo existente a Cascade: qué se traslada y qué le indica el importador que no pudo trasladar."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` convierte un flujo de trabajo exportado como JSON desde otra herramienta. Traslada lo que puede asegurar: los pasos que conoce y las lecturas de campos en sus ajustes. Todo lo demás llega desactivado, con sus ajustes originales en sus notas, y el informe enumera cada elemento y el motivo. Nunca convierte una expresión JavaScript en una suposición de lo que significaba, y nunca trae credenciales, porque una exportación no las incluye: el informe indica qué ranura necesita cuáles. Después, `workflows import workflow.yaml` lo importa.
