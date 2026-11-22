---
title: "Wenn Flow den Start verweigert"
description: "Die Startfehler, die Flow absichtlich ausgibt, was jeder bedeutet und die Lösung in einer Zeile."
---

Abgesehen von den einfachen Konfigurationsfehlern (ein Tippfehler im YAML, ein Port außerhalb des Bereichs) verweigert es den Start aus fünf Gründen, alle mit Absicht. Jeder gibt die Lösung aus statt eines Stack-Traces, denn wer ihn liest, starrt auf einen CrashLoopBackOff und braucht meine Go-Pfade nicht.

| Verweigerung | Lösung |
|---|---|
| Die Authentifizierung ist deaktiviert | Konfigurieren Sie einen Benutzer. Oder, wenn das Netzwerk wirklich isoliert ist und Sie das bewusst verantworten, setzen Sie `HOTLOOP_FLOW_INSECURE=true` in der Umgebung. `auth.enabled: false` in der Datei allein reicht nicht. (Bis einschließlich 2.0.4 tat die Variable nichts, und Sie bekamen diese Verweigerung trotzdem. Behoben in 2.0.5.) |
| Die Authentifizierung ist aktiv, aber es gibt keine Benutzer | Setzen Sie `auth.users` oder `HOTLOOP_FLOW_ADMIN_USER` und `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| Ein `passwordHash`, der kein bcrypt ist | Führen Sie `hotloop-flow hash-password` aus. Diese Prüfung gibt es, damit ein Klartextpasswort nie versehentlich in einer ConfigMap landet. |
| Kein Zugangsdaten-Geheimnis | Setzen Sie `HOTLOOP_FLOW_CREDENTIAL_SECRET`. Oder `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true`, wenn diese Instanz gar keine Geheimnisse hält. |
| `discovery` oder `exec` aktiv mit leerer Positivliste | Listen Sie auf, was erlaubt ist, oder schalten Sie die Funktion ab. Eine leere Positivliste, großzügig gelesen, ist genau der Weg, auf dem aus einer schmalen Fähigkeit eine Shell wird. |

Was es *nicht* verweigert, ist der Start wegen eines einzelnen fehlerhaften Knotens. Ein Flow mit einem einzigen kaputten Knoten führt alle anderen Knoten aus und protokolliert den Fehler, denn eine Linie wegen eines Tippfehlers in einem Dialog stillzulegen ist schlimmer, als 40 von 41 Knoten laufen zu lassen und das zu sagen. Dasselbe gilt für eine exec-Positivliste, die etwas nennt, das noch nicht im `PATH` liegt: Es warnt beim Booten und löst es erneut auf, wenn ein Flow es benutzt, da ein Init-Container oder ein eingehängtes Volume es nach dem Start legitim nachliefern können.

Lässt sich die Flow-Datei nicht parsen, probiert es die Sicherungen von der neuesten an, behält die beschädigte Datei daneben als `.corrupt` und protokolliert genau, auf welche Sicherung es zurückgegriffen hat. Lässt sich auch keine davon parsen, hält es dort an, statt leer hochzukommen und gesund auszusehen, während alle Ihre Flows weg sind. Und ein Deployment schreibt die Flow-Datei *bevor* es die alte Runtime stoppt, sodass Ihre bisherigen Flows weiterlaufen, wenn das Speichern fehlschlägt, statt dass die Linie wegen eines misslungenen Speicherns steht. Diese Reihenfolge ist nicht die naheliegende, sie ist kein Zufall, und ein Test schlägt fehl, wenn jemand sie vertauscht.
