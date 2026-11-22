---
title: "Einen Workflow übernehmen"
description: "So importieren Sie einen vorhandenen Workflow in Cascade: was übernommen wird und was der Import als nicht übertragbar meldet."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` wandelt einen Workflow um, der als JSON aus einem anderen Werkzeug exportiert wurde. Übernommen wird, was sich sicher abbilden lässt: die Schritte, die Cascade kennt, und die Feldzugriffe in deren Einstellungen. Alles andere kommt ausgeschaltet an, mit den ursprünglichen Einstellungen in den Notizen, und der Bericht listet jeden Eintrag samt Grund auf. Ein JavaScript-Ausdruck wird nie zu einer Vermutung darüber, was er meinte, und Zugangsdaten werden nie mitgebracht, weil ein Export keine enthält: Der Bericht sagt, welcher Platz welche braucht. Danach legt `workflows import workflow.yaml` ihn an.
