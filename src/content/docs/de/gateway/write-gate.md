---
title: "Das Write Gate: sicher schreiben"
description: "Jeder Schreibzugriff, ob von Bildschirm, API, Regel, Skript, Rezept oder Agent, läuft über eine Funktion. Was sie prüft und was Ablehnungen antworten."
sidebar:
  label: "Das Write Gate"
---

Dieses System kann Maschinen bewegen. Deshalb steht hier genau, was zwischen einer Anfrage und einem Gerät liegt, in der Reihenfolge, in der der Code es ausführt.

Jeder Wert auf dem Weg zu einem Gerät läuft durch **eine einzige Funktion, die sich nicht umgehen lässt**: ein Klick auf einem Bildschirm, `POST /api/write`, ein Aufruf eines Entitätsdienstes, eine Automatisierung, ein Skript, ein Rezept, ein Agent über MCP. Die Richtlinie lebt dort und nur dort, denn eine Prüfung, die an sechs Stellen kopiert wurde, ist eine Prüfung, die jemand an der siebten vergisst, und die siebte ist immer die, die auf die laufende Presse schreibt. Ein Test lässt den Build scheitern, wenn irgendetwas in der Laufzeit den Schreibzugriff eines Geräts erreichen kann, ohne durch das Gate zu laufen, und er beweist, dass er scheitern kann, indem er in einer Kopie des Pakets vier Arten von Umgehung einbaut und jede davon erkennt.

Lieber fühlen als lesen? [hotloop.io hat eine interaktive Version](https://hotloop.io/gateway/#the-gate). Legen Sie die Schalter um, senden Sie einen Sollwert und sehen Sie genau, wo er abprallt.

## Die Prüfungen, in der Reihenfolge

1. **Der Aufrufer darf schreiben.** Das passiert an der Tür der API, vor dem Gate. Ein angemeldeter Benutzer braucht `values.write`, um `POST /api/write` aufzurufen: Bediener und Administratoren haben es, Betrachter nicht, und ohne es antwortet die API mit 403. Die Tür eines Agenten ist das MCP-Bearer-Token, und ohne es bekommt er ein 401 und sieht nicht einmal die Werkzeugliste. In beiden Fällen erfährt das Gate nichts davon, daher steht es nicht im Schreib-Audit. (Ein Aufruf eines Entitätsdienstes funktioniert anders, [weiter unten](#jede-tür-dasselbe-gate).)
2. **Schreiben ist eingeschaltet.** `safety.allowWrites`, der Hauptschalter. Seit 4.4.0 standardmäßig aus.
3. **Agent-Schreibzugriffe sind eingeschaltet.** `safety.allowMcpWrites`, nur geprüft, wenn die Anfrage über MCP kam. Er schränkt den Hauptschalter ein und kann ihn nie umgehen: Bei eingeschaltetem Schreiben und ausgeschaltetem Agentenschalter kann ein Bediener ein Tag ansteuern, ein Agent nicht. Wird er bei ausgeschaltetem `safety.allowWrites` eingeschaltet, weigert sich das Gateway zu starten, statt Sie raten zu lassen, welcher gewinnt.
4. **Das Tag ist scharf.** Jedes Tag ist schreibgeschützt, bis jemand es `writable` markiert, eines nach dem anderen und mit Absicht. Ein Browse-Import von 4.000 Tags macht keines davon scharf. Ein Tag, das nicht existiert, wird hier ebenfalls abgelehnt.
5. **Der Wert liegt im Bereich.** Hat das Tag einen Bereich und ist der Wert eine Zahl, wird ein Wert außerhalb davon **abgelehnt, nie begrenzt**. Wer 500 bei einem Tag eingegeben hat, das bei 400 endet, hat einen Fehler gemacht und muss davon erfahren. Stillschweigend 400 zu senden heißt, etwas zu tun, das niemand verlangt hat, und niemand merkt es.
6. **Die eigene Prüfung des Aufrufers besteht.** Eine Entität ergänzt, was nur sie weiß: Schrittweite und engeren Bereich einer Zahl, Muster und Länge eines Textes, die Optionen einer Auswahl, den Ausgang eines Regelkreises, abgelehnt, wenn der Kreis nicht gerade auf Hand steht, die Entität mitten im Aufruf deaktiviert oder gelöscht. Sie läuft im Gate, nach Richtlinie und Bereich des Tags, damit ein Bediener immer zuerst vom Tag erfährt, und vor der Audit-Zeile, damit eine Entitätsablehnung genau wie eine Tag-Ablehnung festgehalten wird. Sie kann nur ablehnen. Sie kann den Wert nicht ändern und nichts durchlassen, was das Gate gestoppt hätte.
7. **Das Gerät läuft.** HotLoop hat einen laufenden Worker dafür. Ein deaktiviertes Gerät oder eines, das nie gestartet ist, wird mit `the device is not connected` abgelehnt, statt einen Wert ins Leere zu werfen.

**Erst dann wird die Audit-Zeile geöffnet, und erst dann geht der Wert hinaus.** Kann die Zeile nicht geschrieben werden, wird der Schreibzugriff gar nicht gesendet. Ein nicht auditierbarer Schreibzugriff ist einer, über den hinterher niemand Rechenschaft ablegen kann, und bei Anlagen, die sich bewegen, lohnt dieser Tausch nicht. Die Zeile wird mit Ergebnis und Latenz in einem von der Anfrage gelösten Kontext abgeschlossen, damit ein Schreibzugriff, der in ein Timeout läuft oder abgebrochen wird, trotzdem festhält, was geschah.

Jede Ablehnung ab Prüfung 2 wird als Ablehnung auditiert: eine Zeile mit Akteur, Quelle, dem angefragten Wert, dem Wert, den er ersetzt hätte, und `refused:` mit dem Grund, dazu eine Warnung im Systemprotokoll. Wer wiederholt versucht, ein Tag anzusteuern, das er nicht darf, bleibt unsichtbar, wenn es nicht aufgeschrieben wird, und ein Ingenieur soll es hinterher finden können. Prüfung 1 steht nicht im Schreib-Audit, weil das Gate sie nie gesehen hat.

### Warum diese Reihenfolge

Die Richtlinie läuft, bevor die Audit-Zeile geöffnet wird, also wird eine Ablehnung als Ablehnung festgehalten und nicht als Versuch, der zufällig scheiterte. Die Audit-Zeile wird geöffnet, bevor der Wert die Leitung erreicht, also hat ein Schreibzugriff, der hängt oder den Prozess mitreißt, trotzdem Spuren des Versuchs hinterlassen. In einer Fertigung ist "wir wissen nicht, ob dieser Befehl hinausgegangen ist" die schlimmste Antwort.

### Eine Sache, die Prüfung 7 nicht erfasst

Prüfung 7 fragt, ob das Gerät einen Worker hat, nicht ob seine Sitzung in genau diesem Moment steht. Ein Gerät, das vom Netz gefallen ist und sich neu verbindet, besteht sie. Die Audit-Zeile wird geöffnet, der Treiber hat keine Sitzung, und der Schreibzugriff scheitert als `the device is not connected`, festgehalten als fehlgeschlagener Versuch, nicht als Ablehnung. In beiden Fällen erreicht nichts das Gerät. Der [Probelauf](#vor-dem-senden-fragen-der-probelauf) prüft auch die Sitzung und sagt das gleich vorab.

## Was jede Ablehnung antwortet

Der Statuscode sagt, wessen Problem es ist, denn so liest ein Bediener ihn.

| Was passiert ist | Der Fehler lautet | HTTP |
|---|---|---|
| Keine Berechtigung, an der Tür | `<user> does not have the "values.write" permission` | 403 |
| Schreiben ist ausgeschaltet | `writes are disabled on this deployment` | 403 |
| Agent-Schreibzugriffe sind ausgeschaltet | `writes from MCP clients are disabled on this deployment` | 403 |
| Das Tag ist nicht scharf | `this tag is not marked writable` | 403 |
| Die Entität ist deaktiviert | `the entity is disabled` | 403 |
| Das Tag existiert nicht | das Tag und `not found` | 404 |
| Die Entität verschwand mitten im Aufruf oder ist in keinem Zustand, der es erlaubt (ein Regelkreis nicht auf Hand) | was sich geändert hat | 409 |
| Der Wert liegt außerhalb des Tag-Bereichs | `value is outside the tag's configured range` | 422 |
| Die Entität akzeptiert den Wert nicht (Schritt, Muster, Optionen, eigener Bereich) | `the value is not one this entity accepts` und warum | 422 |
| Das Gerät ist nicht verbunden | `the device is not connected` | 503 |
| Das Gerät antwortete mit Nein | die eigenen Worte des Geräts | 502 |
| Der Schreibzugriff konnte nicht auditiert werden, oder alles andere, was die API nicht einordnen kann | `internal error (ref …)`, mit den Details im Serverprotokoll unter dieser Referenz | 500 |

Alles, was die API nicht einordnen kann, ist ein 500. Früher war es ein 400, und das hieß, dass ein Datenbankausfall einem Bediener sagte, er habe etwas falsch eingegeben, und er suchte einen Tippfehler, der nicht existierte.

Über MCP gibt es keine Statuscodes. Eine Ablehnung kommt als Werkzeugergebnis mit der Markierung `isError` zurück, in den Worten des Gates selbst:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Das ist eine Antwort, kein Transportfehler. Der Aufruf wurde verstanden und bewusst abgelehnt, und ein erneuter Versuch führt zur selben Antwort.

## Vor dem Senden fragen: der Probelauf

Das Gate hat einen zweiten Einstiegspunkt, der fragt, ohne zu handeln. Er führt dieselben Prüfungen in derselben Reihenfolge aus und gibt für eine Ablehnung denselben Fehlertext. Er öffnet keine Audit-Zeile, löst kein Ereignis aus, zählt nichts und erreicht das Gerät nie. Er geht sogar einen Schritt weiter als der echte Schreibzugriff: Ein Gerät, dessen Worker läuft, dessen Sitzung aber unten ist, wird als nicht verbunden gemeldet, statt als "das würde hinausgehen".

Wo Sie ihn bekommen:

- **Aufrufe von Entitätsdiensten**: `POST /api/services/{domain}/{service}?dry_run=true`. Er antwortet mit 200 und dem Urteil: jeden Schreibzugriff, den er ausführen würde, als `would_write`, oder den ersten, der abgelehnt würde, als `not_sent`, mit dem Grund wortwörtlich. Eine Anfrage, die nicht einmal geplant werden konnte (keine solche Entität, ein Dienst, den die Domäne nicht kennt, fehlerhafte Daten), antwortet mit demselben Status wie der echte Aufruf. `dry_run` nimmt `true` oder `false` und sonst nichts, und `yes` ergibt ein 400, weil ein Raten in die falsche Richtung aus einer Frage einen Befehl macht.
- **Die Befehlseingabe** fragt, während Sie tippen, und zeigt "Would be refused: ...", bevor jemand bestätigt.
- **Skripte**, neu in 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** in der Ausführungsleiste oder MCPs `run_script` mit `dryRun`. Jeder Schritt wird gegen die Anlage durchlaufen, wie sie gerade ist, und der erste Schreibzugriff, der abgelehnt würde, beendet den Durchlauf in den Worten des Gates. Siehe [Skripte](/de/iot/scripts/).
- **Rezepte**, neu in 4.17.0: Jedes Ziel wird diesen Prüfungen unterzogen, bevor der erste Wert hinausgeht, und ein einziger schlechter Wert lehnt das ganze Rezept ab, ohne dass etwas geschrieben wird. `POST /api/recipes/{id}/validate` und MCPs `validate_recipe` fragen, ohne anzuwenden. Siehe [Rezepte](/de/iot/recipes/).
- **Blueprints**, neu in 4.17.0: **Check first** zeigt, was die Regel täte, wenn sie jetzt auslöste, jeder Schreibzugriff diesen Prüfungen unterzogen, bevor die Regel existiert. Siehe [Blueprints](/de/iot/blueprints/).

Ein sauberer Probelauf ist ein Rat, kein Versprechen. Das Gate entscheidet beim echten Schreiben weiter selbst, denn ein Gerät kann ausfallen, oder jemand kann ein Tag entschärfen, zwischen Ihrer Frage und Ihrem Befehl.

:::caution[Noch auf 4.16.0? Die Eingabe kann ein Set verschlucken]
In 4.16.0 erscheint das Urteil des Probelaufs etwa eine Viertelsekunde, nachdem Sie aufhören zu tippen, genau wenn die Maus Richtung Set fährt, und die Eingabe wächst oder schrumpft darunter. Set verschiebt sich um etwa 30 px, der Klick trifft also ins Leere oder auf den Hintergrund und schließt die Eingabe. Der Bediener sieht sie sich schließen, nimmt an, der Sollwert sei hinausgegangen, und es wurde nichts geschrieben. Behoben in 4.17.0: Das Urteil steht neben den Schaltflächen und nichts bewegt sich. Bis Sie [aktualisieren](/de/gateway/upgrading/), prüfen Sie nach dem Drücken von Set, ob sich der Wert wirklich geändert hat.
:::

## Jede Tür, dasselbe Gate

- **Die Bildschirme und `POST /api/write`.** Der Akteur ist der angemeldete Benutzername, nicht ein Header, den jeder setzen könnte.
- **Entitätsdienste**, `POST /api/services/{domain}/{service}`. `switch.turn_on` auf `switch.press_01_pump` ist ein Tag-Schreibzugriff durch dieses Gate, auditiert gegen die Entität mit ihrer entity_id, dem Dienst und einer Aufruf-ID. Ein Tastendruck sind zwei Schreibzugriffe unter einer Aufruf-ID. Ein Benutzer ohne `values.write` wird hier nicht an der Tür gestoppt: Die fehlende Berechtigung wird dem Gate als eigene Prüfung des Aufrufers übergeben, sodass ein abgelehnter Entitätsaufruf wie jede andere Ablehnung gegen die Entität auditiert wird, mit dem angefragten Wert, und trotzdem 403 antwortet.
- **Automatisierungen** schreiben als `automation:<rule-id>`. Eine Regel bekommt nicht mehr Rechte als ein Mensch. Siehe [Automatisierungen](/de/iot/automations/).
- **Skripte**, neu in 4.17.0, schreiben als `script:<id>` und behalten die Quelle dessen, der sie gestartet hat, sodass ein Skript, das ein Agent anstößt, den Agentenschalter genauso trifft wie das eigene `write_tag` des Agenten.
- **Rezepte**, neu in 4.17.0, schreiben jedes Ziel unter einer Aufruf-ID, sodass `GET /api/writes?call=<id>` die ganze Anwendung im Audit-Pfad ist.
- **Agenten** schreiben als `mcp:<client name>`. `write_tag` und `call_service` durchlaufen dieselben Prüfungen wie ein Bediener, und beide weigern sich zu laufen, ohne dass ein Grund angegeben ist, der neben dem Schreibzugriff im Systemprotokoll landet. Eine Audit-Zeile, die sechs Monate später niemand erklären kann, ist nur ein Zeitstempel mit schlechtem Gewissen. `trigger_automation` verweigert sich ganz, solange Agent-Schreibzugriffe aus sind, ebenso `run_script` und `apply_recipe`, weil eine Regel, ein Skript oder ein Rezept Anlagen ansteuern kann und sonst ein Weg um den Schalter wäre. Siehe [Model Context Protocol](/de/iot/mcp/).

## Warum Schreiben standardmäßig aus ist

Vor 4.4.0 waren `safety.allowWrites` und `safety.allowMcpWrites` standardmäßig `true`. Jetzt sind sie `false`. Ein Tag war immer schreibgeschützt, bis es scharf gemacht wurde, aber eine frische Installation soll nicht ein `writable`-Flag davon entfernt sein, Anlagen anzusteuern, bevor jemand sie sich angesehen hat.

Zusätzlich zum Gate sorgt `safety.confirmWrites` (standardmäßig an) dafür, dass die Bildschirme vor dem Senden um Bestätigung bitten. Das ist eine Abfrage im Browser, keine Prüfung im Gate, und es ist die einzige Sicherheitseinstellung, die Sie im Einstellungsbildschirm ändern können. `safety.allowWrites` und `safety.allowMcpWrites` sind dort mit Absicht schreibgeschützt: Die Hauptkontrolle darüber, ob dieser Prozess Anlagen ansteuern kann, gehört nicht hinter dieselbe Browsersitzung, die die Schreibzugriffe auslöst.

## Schreiben bewusst einschalten

1. Fügen Sie das Gerät hinzu und entdecken Sie seine Tags, wo das Protokoll sie auflisten kann. Modbus und S7comm können ihre eigenen Punkte nicht aufzählen, deklarieren Sie diese also nach der Dokumentation des Geräts.
2. Markieren Sie Tags einzeln als schreibbar, und nur die, die Sie meinen.
3. Setzen Sie `safety.allowWrites: true` in Ihrer Werte-Datei und führen Sie `helm upgrade` aus. Bis dahin kann nichts aus den Schritten 1 und 2 ein Ventil bewegen.
4. Nur wenn auch Agenten Anlagen ansteuern sollen, setzen Sie `safety.allowMcpWrites: true`.

## Was es nicht tut

Die Anwendung kann nicht alles erzwingen, und es ist besser, das zu sagen, als Sie es annehmen zu lassen.

- **Es ist keine Verriegelung.** Eine Abschaltung, die Menschen oder die Anlage schützt, gehört in die SPS, fest verdrahtet, wo sie hingehört, und nicht in etwas, das in einem Netzwerk läuft.
- **Es überwacht Ihren Broker nicht.** Wenn Sie Knotenbefehle per MQTT an Edge Relays senden, muss die eigene Zugriffskontrolle des Brokers einschränken, wer sie veröffentlichen darf, nämlich auf die Zugangsdaten des Gateways.
- **Der OPC-UA-Server kann gar nicht schreiben.** Er ist schreibgeschützt, ohne Schreib-Handler und ohne Einstellung, die einen hinzufügt, sodass das SCADA, das ihn liest, darüber nichts ansteuern kann.
