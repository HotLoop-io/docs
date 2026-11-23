---
title: "Senden an die Stationen eines Tenants"
description: "Eine Flow-Datei und ihre FlowLab-Diagramme auf jede Flow-Installation eines Tenants, eine nach der anderen, jeweils geprüft und bei Fehlern zurückgesetzt."
---

Ein Tenant in EmberNet kann mehrere HotLoop-Flow-Installationen betreiben, eine je Werk oder Linie. Jede nennen wir eine Station. Diese Seite beschreibt, wie man eine Flow-Datei und damit einen Satz FlowLab-Diagramme auf alle bringt, jede prüft und eine Station zurücksetzt, wenn sie fehlschlägt.

Die Kurzfassung: `hotloop-flow stations push -tenant acme -file flows.json` sendet an die Stationen, die EmberNet für `acme` als laufend anzeigt, eine nach der anderen. Ist eine Station danach nicht in Ordnung, geht diese Station auf den vorherigen Stand zurück, und das Senden stoppt. Würde die Datei einen laufenden Logger neu starten, passiert nichts, bis Sie sagen, dass das erlaubt ist.

## Woher die Stationen kommen

Niemand tippt eine Station ein. Die Liste ist das, was das EmberNet-Dashboard für den Tenant als laufend anzeigt, dieselbe Liste wie auf seiner Seite Running Apps: jede App mit dem Label `hotloop-flow`, die läuft und zum Tenant gehört. Eine Station wird unter ihrer Flux-Adresse erreicht, wenn das Dashboard eine meldet, sonst unter ihrer Cluster-Adresse. Führen Sie das Senden daher von einem Ort aus, an dem sich diese Adresse auflösen lässt.

Der Tenant wird immer genannt, und ein Senden gilt immer nur für diesen einen Tenant. Das Dashboard wird mit Ihrem Dashboard-Token gefragt und beschränkt Sie auf die Tenants, die Sie sehen dürfen, und wir prüfen die Antwort noch einmal: Eine Zeile, die für einen anderen Tenant ankommt, wird verworfen und gezählt, nie verwendet. Ein Tenant ohne laufendes Flow antwortet mit einem Fehler.

## Der Befehl

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

Die Dashboard-Adresse stammt aus `-dashboard` oder `HOTLOOP_FLOW_DASHBOARD_URL`, sein Token aus `-dashboard-token-file` oder `HOTLOOP_FLOW_DASHBOARD_TOKEN`. Das Token, das die Stationen akzeptieren, stammt aus `-token-file` oder `HOTLOOP_FLOW_TOKEN`, wie bei `hotloop-flow deploy`. Erzeugen Sie es mit `hotloop-flow token` und geben Sie jeder Station dieses Token als API-Token mit `flows.read`, `flows.write` und `status.read` (ein einfaches Deploy-Token hat nur die ersten beiden): Die Prüfung muss die Diagramme jeder Station lesen, und das kann ein einfaches Deploy-Token nicht. Die Stationen eines Tenants nehmen dasselbe Token.

| Option | Was sie bewirkt |
|---|---|
| `-dry-run` | Plant jede Station und ändert keine. Zeigt, was live ist, was jede neu starten würde und welche nicht geplant werden konnten. |
| `-confirm-restart` | Sie stimmen zu, dass laufende Logger durch dieses Senden neu gestartet werden dürfen. |
| `-window 02:00-04:00` | Die Stunden, in denen ein Neustart im Voraus erlaubt ist, in `-window-zone` (ein IANA-Name, UTC, wenn weggelassen). Ein Senden innerhalb des Fensters läuft weiter. Es kann über Mitternacht gehen, `22:00-02:00`. |
| `-settle 5s` | Wie lange die Diagramme einer Station zum Starten haben, bevor die Prüfung sie als nicht laufend wertet. |
| `-json` | Der Bericht als JSON. |

Exit-Status 0 heißt, jede Station ist fertig. 3 heißt, eine Station ist fehlgeschlagen und das Senden hat gestoppt. 4 heißt, das Senden wartet darauf, dass Sie Neustarts zustimmen. 5 heißt, Stationen wurden übersprungen, weil sie nicht antworteten oder nicht geplant werden konnten.

## Was ein Senden tut

Zuerst plant es jede Station, ohne eine zu ändern. Für jede liest es die laufende Flow-Datei und Revision, findet den Deployment-Eintrag, auf den sie zurückgehen könnte, listet ihre Diagramme auf und ermittelt, welche laufenden Logger die Datei neu starten würde. Wenn dann nichts ein Ja braucht, geht es Station für Station in der Reihenfolge der Namen vor.

1. **Deployt** die Datei mit der Revision, die der Plan gesehen hat, sodass ein Deployment, das jemand zwischendurch gemacht hat, abgelehnt statt überschrieben wird. Nur was sich geändert hat, startet neu. Zugangsdaten wandern nie: Jede Station behält ihre eigenen Passwörter, und die Schreibzugriffe eines Instruments bleiben aus, bis jemand an dieser Station sie einschaltet.
2. **Prüft.** Die Station muss die Revision melden, die jede Station haben soll. Die Revision ergibt sich aus dem Inhalt der Datei, dieselbe Datei ist also überall dieselbe Revision, und das Senden nennt sie, bevor es beginnt. Jedes Diagramm in der Datei, das von selbst startet, muss auf der Station sein, ohne Problem, und innerhalb der Beruhigungszeit laufen oder beendet sein. Auch ein Knoten, der nicht gestartet ist, lässt die Prüfung fehlschlagen.
3. **Eine Station, die die Prüfung nicht besteht, geht zurück.** Sie wird auf das Deployment zurückgesetzt, auf dem sie war, als eigenes Deployment, und es wird geprüft, dass sie wieder auf ihrer alten Revision ist. Dort stoppt das Senden.

Der Bericht sagt, was mit jeder Station geschah:

| Status | Bedeutung |
|---|---|
| `done` | Deployt und die Prüfung bestanden. |
| `unchanged` | Schon auf dieser Revision, und ihre Diagramme sind, wie sie sein sollen. |
| `failed` | Nicht deployt (die Station hat es abgelehnt, oder jemand hat zwischendurch deployt), oder schon auf dieser Revision und nicht in Ordnung. Es wurde nichts geändert. |
| `reverted` | Hat die Prüfung nicht bestanden und ist wieder auf der Revision, die sie hatte. |
| `revert-failed` | Hat die Prüfung nicht bestanden und konnte nicht zurückgesetzt werden. Hier muss ein Mensch ran. |
| `skipped` | Nicht angefasst. Sie hat nicht geantwortet, oder sie hat keinen Deployment-Eintrag ihrer laufenden Revision, sodass ein fehlgeschlagenes Senden dort nicht rückgängig zu machen gewesen wäre. Deployen Sie einmal von Hand dorthin oder reparieren Sie die Verbindung, und senden Sie erneut. |
| `not-started` | Das Senden stoppte vor dieser Station. Sie ist, wie sie war. |
| `planned` | Die Antwort eines Probelaufs. |

Übersprungene Stationen stoppen das Senden nicht. Ein Senden ist wiederholbar: Eine Station, die schon auf der Revision ist, ist `unchanged`, sodass ein zweites Senden nur zu Ende bringt, was das erste nicht geschafft hat.

## Neustarts

Ein Diagramm, das von selbst startet, ist ein Logger. Ein geändertes zu deployen startet es neu, und ein entferntes wird gestoppt. Ein Senden, das das einem laufenden Logger antun würde, stoppt, bevor es irgendetwas anfasst, und der Bericht nennt jede Station und jeden Logger. Dann lässt eines von drei Dingen es weiterlaufen:

- Sie antworten an der Eingabeaufforderung mit Ja, wenn der Befehl in einem Terminal läuft;
- Sie übergeben `-confirm-restart`;
- die Zeit liegt innerhalb des Fensters, das Sie mit `-window` angegeben haben.

Ohne eines davon startet nichts neu. Ein Diagramm, das sich nicht geändert hat, behält seinen Lauf, und ein neues startet einfach.

## Aus einer Instanz und für einen Agenten

Eine Instanz kann über ihre Admin-API an die Stationen ihres eigenen Tenants senden, und genau das nutzen die MCP-Tools `list_stations` und `push_to_stations`. Setzen Sie alle vier der folgenden, in der Konfigurationsdatei unter `stations:` oder per Umgebung, und die Routen `GET /stations` und `POST /stations/push` erscheinen. Ohne sie gibt es sie nicht.

| Einstellung | Umgebung | Was es ist |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | Das EmberNet-Dashboard, das die Installationen des Tenants kennt. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | Der eine Tenant, für den diese Instanz sendet. Eine Anfrage kann keinen anderen nennen. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | Eine Datei mit dem Dashboard-Token. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | Eine Datei mit dem Deploy-Token, das die Stationen akzeptieren. |

Im Chart sind es `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` und `stations.deployTokenSecret`, jedes Secret mit einem Token und als Datei eingehängt; mit Podman und Quadlet sind es die vier Umgebungsvariablen und die zwei eingehängten Secrets in [Flow bereitstellen](/de/flow/deploying/). Setzen Sie alle vier oder keine: Ein Chart-Rendering mit einigen wird abgelehnt, ebenso ein Start mit einigen.

`POST /stations/push` braucht `flows.write` und nimmt `{flows, note, confirmRestart, window, windowZone, dryRun}`. Lassen Sie `flows` weg, sendet es, was diese Instanz ausführt. Es antwortet mit demselben Bericht plus `ok`, und ein Senden steht im Audit-Log als `stations.push`. `GET /stations` braucht `flows.read`. Ein Senden, das auf ein Ja wartet, antwortet mit `needsConfirm` true und hat nichts geändert: Senden Sie es erneut mit `confirmRestart` oder einem Fenster.

## Was nicht belegt ist

Die Form der Dashboard-Liste wurde am Live-Dashboard für einen echten Tenant gelesen. Es wurde noch nicht über Flux an die Stationen eines Tenants gesendet, also ist es Ihre Sache, mit `stations list` und einem `-dry-run` zu prüfen, ob die vom Dashboard genannte Adresse von dort erreichbar ist, wo Sie senden.
