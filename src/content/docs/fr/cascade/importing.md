---
title: "Importer un flux de travail"
description: "Importez un flux de travail existant dans Cascade : ce qui est repris, et ce que l'importateur vous signale comme non repris."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` convertit un flux de travail exporté en JSON depuis un autre outil. Il reprend ce dont il est sûr : les étapes qu'il connaît et les lectures de champs dans leurs réglages. Tout le reste arrive désactivé, avec ses réglages d'origine dans ses notes, et le rapport liste chaque élément et la raison. Il ne transforme jamais une expression JavaScript en supposition sur ce qu'elle voulait dire, et il n'apporte jamais d'identifiants, parce qu'un export n'en contient pas : le rapport indique quel emplacement a besoin de quoi. Ensuite, `workflows import workflow.yaml` l'importe.
