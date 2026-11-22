---
title: "Jedes Deployment ist ein Protokoll"
description: "Wer, wann, warum und die exakten Bytes jedes Deployments, knotenweise verglichen in API, CLI und git, mit einem Rollback, der Zugangsdaten behält."
---

„Was hat sich geändert, wer hat es geändert, setzt es zurück“ ist das Erste, was jeder fragt, nachdem eine Linie stehen geblieben ist. Drei `.bak`-Dateien beantworten nichts davon. Sie wissen nicht, wer, sie werden nach drei Speichervorgängen überschrieben, und die, die Sie brauchen, ist immer die vierte.

Deshalb schreibt jedes Deployment einen unveränderlichen Eintrag unter `data/deployments/`: wer es ausgeführt hat (aus seinem Token, nie aus dem, was der Client behauptet), von wo, wann, die hinterlassene Notiz, die abgelöste Revision, die Flow-Datei Byte für Byte und die Zugangsdaten, wie sie nach dem Deployment standen, genauso verschlüsselt wie die Zugangsdatendatei. Einträge werden nur angehängt. Das Protokoll behält standardmäßig die letzten 100 (`history.retain`, und 0 behält alle) und beschneidet nie den neuesten, weil der neueste der ist, der läuft.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

Eine Notiz kommt mit dem Deployment, als `"note"` im verpackten Dokument (`{"rev": ..., "flows": [...], "note": "..."}`) oder als Header `HotLoop-Flow-Deployment-Note`. Die Dokumentform gibt es, weil ein Browser nichts außerhalb von Latin-1 in einen Header legt und Menschen Notizen in ihrer eigenen Sprache schreiben.

Es leistet zwei Dinge, die Sie erst vermissen würden, wenn sie Sie gebissen haben:

- **Eine Handbearbeitung wird erkannt.** Wenn die Flow-Datei auf der Platte nicht das Letzte ist, was das Protokoll festgehalten hat, weil jemand sie bearbeitet hat, während der Prozess stand, trägt der Start sie als `baseline`-Eintrag ein, der das sagt. Dasselbe beim ersten Start mit bereits vorhandener Flow-Datei. Sonst wird eine Handbearbeitung stillschweigend zu einer Vergangenheit, die niemand aufgeschrieben hat.
- **Ein Protokoll, das nicht geschrieben werden kann, hält die Linie nicht an.** Die Flow-Datei ist an dieser Stelle schon gespeichert, eine Ablehnung des Deployments ließe also Platte und laufende Flows bis zum nächsten Neustart auseinanderlaufen. Das Deployment geht durch, und Antwort wie Protokoll sagen in Worten, dass dieses keinen Eintrag hat.

Die API gibt die Zugangsdaten eines Eintrags nie heraus, verschlüsselt oder nicht. Sie werden für eine einzige Aufgabe aufbewahrt, sie zurückzuspielen, und ein History-Endpunkt ist kein Weg, sie mitzunehmen.

## Der Diff liest sich wie ein Review

Ein zeilenweiser Diff einer Flow-Datei ist ehrlich und nutzlos. Ziehen Sie einen Knoten um zwanzig Pixel, ist das eine Änderung. Ändern Sie einen Schwellwert, ist das eine Änderung. Der Prüfer kann nicht sagen, welche davon gleich eine Presse anhält. Deshalb vergleicht Flow knotenweise:

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Hinzugefügt, entfernt und geändert, Eigenschaft für Eigenschaft mit altem und neuem Wert, welche Verbindungen sich nach Ausgangsport verschoben haben, und **Layout getrennt von Logik**: Ein Label zu verschieben, in der Größe zu ändern oder auszublenden ist „auf der Arbeitsfläche verschoben“, nie eine Änderung, sodass sich ein Aufräumen wie ein Aufräumen liest. Eine Zugangsdate liest sich als „gesetzt“ oder „geändert“, nie mit ihrem Wert. Änderungen innerhalb eines Subflows erscheinen am Subflow, und das Ziehen eines seiner Ports ist ebenfalls Layout.

Überall dieselbe Antwort, aus einem einzigen Paket der Engine:

- `GET /deployments/{from}/diff/{to}` vergleicht zwei Deployments.
- `POST /flows/diff` vergleicht, was live läuft, mit einem Dokument, das noch niemand deployt hat, also das, was man ansieht, bevor man auf Deploy drückt.
- `hotloop-flow diff old.json new.json` auf der Kommandozeile. `-json` für ein Programm. Beendet sich mit 1, wenn sich etwas unterscheidet, wie `diff`.
- **In git.** Machen Sie es zum Diff-Treiber von git für Flow-Dateien, und `git diff`, `git log -p` und `git show` geben den semantischen Diff statt eines JSON-Blocks aus:

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  Oder als Difftool: `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, dann `git difftool -t hotloop-flow`.

Ein Flow, der mit sich selbst verglichen wird, ist gar keine Änderung, für jedes Dokument, das der Parser akzeptiert.

## Zurücksetzen

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

Ein Rollback deployt einen alten Eintrag erneut **als neuen Eintrag**. Die Historie bleibt nur anfügbar: Deployment 41 wird nicht angefasst, und der Rollback ist ein eigener Eintrag, der „Rollback auf Deployment 41“ sagt, wer es getan hat und warum. Die Flow-Datei kommt Byte für Byte zurück, es ist also dieselbe Revision wie damals.

**Die Zugangsdaten kommen auch zurück.** Jeder Eintrag trägt sie, wie sie standen, ein von Ihnen gelöschter Knoten kommt also mit dem Passwort seines Brokers zurück, statt zurückzukommen und sich nicht anmelden zu können. Das ist gegen einen echten Mosquitto getestet, der anonyme Clients abweist: Subscriber löschen, deployen, zurückrollen, und er meldet sich wieder an und Nachrichten fließen.

Er lehnt auf drei Wegen ab, bevor etwas geschrieben wird. Ein veraltetes `HotLoop-Flow-Deployment-Rev` bekommt dasselbe 409 wie ein Deployment, denn ein Rollback im Wettlauf mit dem Deployment eines anderen bleibt ein Wettlauf. Ein Deployment, das die Aufbewahrung schon entfernt hat, ist ein 404. Und ein Eintrag, dessen Zugangsdaten sich mit dem aktuellen Zugangsdaten-Geheimnis nicht entschlüsseln lassen, ist ein 422, weil Flows, die sich nirgends anmelden können, ein Rollback sind, der nur so aussieht, als hätte er funktioniert.

## Im Editor

**Deploy deployt nicht.** Es öffnet ein Review: den Diff der Engine gegen das, was läuft, auf der Arbeitsfläche gezeichnet und in Worten aufgelistet, mit einem Feld für die Notiz. Grün ist hinzugefügt, Bernstein ist geändert, Blau ist nur verschoben, und rote Geister stehen dort, wo entfernte Knoten und Verbindungen waren. Ein Tab mit irgendeiner Änderung bekommt einen Punkt. Der zweite Deploy-Button ist der, der deployt, und die Notiz geht ins Protokoll. Bearbeiten Sie irgendetwas, während das Review offen ist, schließt es sich, denn ein Review von etwas, das Sie inzwischen geändert haben, ist eine Lüge über das, was Sie gleich ausliefern.

**Das Verlaufspanel** listet jedes Deployment mit Wer, Wann und der Notiz. *Changes* öffnet dieses Deployment auf einer schreibgeschützten Arbeitsfläche mit dem, was es geändert hat, darübergezeichnet, über Ihrer Arbeitskopie, die genau so bleibt, wie Sie sie verlassen haben. *Roll back* fragt nach dem Grund, warnt Sie, wenn Sie ungespeicherte Änderungen wegwerfen wollen, und deployt es.

**Ein Deploy-Konflikt zeigt, was die andere Person getan hat.** Früher war es ein `confirm()` des Browsers, das fragte, ob Sie die Änderung der anderen überschreiben oder Ihre verlieren wollen, ohne zu sagen, was deren war. Jetzt sagt es, wer deployt hat, wann, deren Notiz und deren Änderung knotenweise, und lässt Sie dann deren Stand laden, mit Ihrem überschreiben oder weiterbearbeiten.

**Kopieren, Ausschneiden und Einfügen funktionieren, wie man es erwartet, und sie sprechen die Flow-Datei.** Markieren Sie Knoten, Strg+C, und in Ihrer Zwischenablage liegt dasselbe JSON, das jedes andere Flow-Werkzeug liest, Sie können es also in einen Chat, ein Ticket oder auf eine andere Maschine einfügen. Einfügen setzt es dorthin, wo Ihr Zeiger steht, jedes Mal mit neuen IDs, zweimal einfügen ergibt also zwei Kopien und nie eine Kollision. Eine Verbindung zu etwas, das Sie nicht kopiert haben, wird gekappt, statt ins Leere zu zeigen, und ein Konfigurationsknoten, den die Knoten nutzen, kommt mit. Ist dieser Konfigurationsknoten im Flow, in den Sie einfügen, schon vorhanden, teilt die Kopie ihn, statt eine zweite Verbindung zu etwas zu öffnen, das sie zählt. Zugangsdaten landen nie in der Zwischenablage. Ein Passwort in einem Einfügepuffer ist der Weg, auf dem es in einem Fehlerbericht endet.

**Import und Export** tun dasselbe für eine Auswahl, einen Flow oder alles, mit einem Feld zum Kopieren, einem Download-Button und einer Dateiauswahl beim Import. Unsinn bekommt eine Begründung („die ID a kommt zweimal vor“, „Eintrag 1 hat keine ID“), und der Dialog bleibt offen. Ein Knotentyp, den diese Runtime nicht hat, kommt grau und gestrichelt herein, und der Import sagt Ihnen, welche, denn ein stillschweigend verworfener Knoten ist schlimmer als ein lauter.

Eine Bildschirmseite ist Teil dieser Datei. Das Dashboard, das ein Flow zeichnet (`ui_tab`, `ui_group` und die Widgets), besteht aus Knoten im Flow, die Bildschirme eines Kunden reisen also mit seinen Flows durch Export und Import, und keiner davon lebt in HotLoop Flow selbst.

**Subflows werden auf einer eigenen Arbeitsfläche bearbeitet.** Drücken Sie *+ subflow*, und sie öffnet sich mit ihren Ein- und Ausgangsports. Verbinden Sie sie mit den Knoten darin wie alles andere. *Subflow properties* legt den Namen, die Farbe, die Zahl der Ausgänge und die Eigenschaften fest, die eine Instanz setzen kann. Instanzen in Flows ziehen mit, wenn sich die Form ändert, und die Palette listet jeden Subflow, damit Sie einen ablegen können. Doppelklicken Sie auf eine Instanz, um ihr einen eigenen Namen und einen eigenen Wert für jede Eigenschaft zu geben. Ein Subflow kann nicht in sich selbst oder in einen, der ihn enthält, gesetzt werden, und einer, der noch in Gebrauch ist, kann nicht gelöscht werden. Der Editor sagt das, statt es das nächste Deployment herausfinden zu lassen.

**Auswahl zu Subflow.** Markieren Sie Knoten und drücken Sie *Selection to subflow*. Sie wandern in einen eigenen Subflow, und eine Instanz tritt an ihre Stelle. Jede Verbindung, die den Rand der Auswahl überquerte, wird zu einem Port: Der einzige Weg hinein ist der Eingang des Subflows, und jeder Ausgang eines markierten Knotens, der woandershin ging, ist ein Ausgang des Subflows, sodass der Flow tut, was er tat. Ein Subflow hat einen Eingang. Ist die Auswahl mit zwei verschiedenen Knoten verbunden, sagt er das und ändert nichts, denn beide aus beiden zu speisen wäre ein anderer Flow. Markieren Sie eine Gruppe, und sie kommt mit allem darin mit. Ein Konfigurationsknoten, der zum Flow gehört und nur von der Auswahl genutzt wird, geht mit in den Subflow, samt dem, worauf er zeigt. Einer, den auch etwas Zurückgebliebenes nutzt, wird stattdessen global, damit beide Enden dieselbe Verbindung weiter teilen, denn eine zweite Broker-Verbindung auf einer Maschine, die sie zählt, ist die Art Überraschung, die wir nicht ausliefern. Umgebungsvariablen, die die verschobenen Knoten lesen (typisiert als env, als `${NAME}` oder `$(NAME)` in einer Zeichenkette oder `env.get`) und die der Flow deklariert, werden zu Eigenschaften des Subflows, die an den Flow weiterleiten, sodass der Wert weiter von dort kommt, woher er kam, und die Instanz ihn überschreiben kann. Strg+Z macht alles rückgängig.

**Flows.** Doppelklicken Sie auf einen Tab oder drücken Sie *Flow properties*, um ihn umzubenennen oder zu löschen. Das Löschen fragt nach, nimmt jeden Knoten des Flows mit und kappt die Verbindungen und Links, die andere Flows dorthin hatten, damit die Datei nicht ins Leere zeigt. Es nimmt die gelöschten Knoten auch aus jedem Catch-, Status- oder Complete-Bereich, der sie nannte. Ein Catch oder Status, dessen ganze Liste gelöscht wurde, behält seine letzte ID, denn eine leere Liste bedeutet den ganzen Flow, und wir lassen keinen Knoten hinter Ihrem Rücken von der Überwachung einer Sache zur Überwachung von allem wechseln. Strg+Z holt es zurück, bis Sie deployen. Der letzte Flow kann nicht gelöscht werden, weil eine Runtime ohne Flow keinen Platz für einen Knoten hat.

**Konfigurationsknoten** stehen in der Palette unter *configuration*. Sie liegen auf keiner Arbeitsfläche, Sie doppelklicken also auf den Typ, füllen den Dialog aus, und er wird der Liste unter *configuration in use* hinzugefügt, wo ein Doppelklick ihn bearbeitet und das Kreuz ihn löscht. Einer, den ein Knoten noch nutzt, lässt sich nicht löschen und sagt, wie viele ihn nutzen. Dorthin schickt Sie „Add one from the palette first“ im Dialog eines Knotens.

**Eine Verbindung löschen.** Alt-Klick. Ein einfacher Klick tut nichts, sodass das Streifen einer Verbindung beim Markieren keinen Flow kaputt machen kann. Strg+Z holt sie zurück.

**Dauerhafte Verbindungen.** Doppelklicken Sie auf eine Verbindung. Haken Sie *Durable* an, und sie wird dicker und blau gezeichnet, und der Knoten, den sie verlässt, bekommt `ew_durable` in der Datei. Die Markierung liegt auf dem Knotenpaar, gilt also für jede Verbindung dazwischen. Es ist Verdrahtung zur Runtime, das Markieren startet den Knoten also nie neu.

**Gruppen.** Strg+G umschließt die Auswahl, Strg+Umschalt+G löst sie auf. Doppelklicken Sie auf die Titelleiste, um sie zu benennen und einzufärben. Ziehen Sie eine Gruppe, und alles darin geht mit. Ziehen Sie einen Knoten in eine, und er tritt bei, ziehen Sie ihn heraus, und er verlässt sie. Gruppen lassen sich verschachteln. Das Löschen einer Gruppe löscht, was darin ist, und Strg+Z holt alles zurück.

**Die Suche** (Strg+F oder die Schaltfläche) sucht in allen Flows und Subflows gleichzeitig: Namen, Typen, IDs und jede Einstellung, auch eine Zeile mitten im Rumpf einer Funktion. Ein Treffer bringt Sie zum richtigen Tab mit dem markierten Knoten in der Mitte der Ansicht. Konfigurationsknoten tauchen ebenfalls auf, und ihr Treffer öffnet ihren Dialog, da sie keinen Platz auf einer Arbeitsfläche haben.

**Debug-Filter.** Schränken Sie die Seitenleiste auf einen Flow, auf die markierten Knoten, auf ein Wort oder nur auf die Fehler ein. Er gilt für das, was schon im Protokoll steht, nicht nur für das, was als Nächstes kommt, sodass das Einschränken die Zeile, die Sie ansahen, nie verschwinden lässt.

All das wird bei jedem Pull Request in einem echten Browser durchgeklickt, gegen die echte Binärdatei mit dem eingebetteten Editor. Dazu gehört jeder Knotendialog, den die Runtime anbietet: Die Liste kommt von `GET /nodes`, ein nächsten Monat hinzugefügter Knoten ist also nächsten Monat im Test, ohne dass jemand daran denken muss, ihn hinzuzufügen. Beim Schreiben dieser Tests fanden wir zwei Dinge, die in Chromium nie funktioniert hatten: der Doppelklick auf einen Knoten zum Öffnen seines Dialogs und das Ziehen einer Verbindung auf einen Knoten. Die Arbeitsfläche hält den Zeiger während des gesamten Ziehens, das Ziel des Ereignisses war also immer die Arbeitsfläche, und eine über einem Knoten losgelassene Verbindung fand den Knoten nie. Beides so peinlich, wie Fehler in einem visuellen Editor nur sein können. Beides behoben.

## Flows als Code

Das Repository ist der Ort, an dem Flows geprüft werden, also sollte das Repository sie auch deployen können. Halten Sie die Flow-Datei in git, richten Sie den Diff-Treiber von oben ein, damit sich der Pull Request wie ein Review liest, und lassen Sie den Merge deployen:

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` gibt den Diff gegen das, was läuft, aus, derselbe Text wie überall, und deployt dann gegen die Revision, aus der dieser Diff entstand. Deployt dazwischen jemand, ist das ein 409 und eine rote Pipeline, kein stilles Überschreiben. `-expect-rev` bindet es an die Revision, gegen die ein geprüfter Plan erstellt wurde, und `-dry-run` gibt den Diff aus und deployt nichts. Eine Datei ohne Änderungen deployt nichts und fügt der Historie nichts hinzu, ein Merge, der die Flows nicht berührt hat, müllt das Protokoll also nicht zu. Ein Knoten, der nicht startet, wird deployt und lässt den Job trotzdem fehlschlagen, weil der Rest des Flows läuft und jemand hinsehen muss. `export -deployment 41` holt jedes Deployment aus der Historie zurück.

**Eine Pipeline hält nie ein Administratorpasswort.** Sie bekommt ein API-Token:

```bash
hotloop-flow token -name ci
```

gibt ein Token einmalig für den Secret-Speicher der pipeline aus und den Hash, den man der Runtime gibt: `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` für ein Deploy-Token oder `auth.tokens` in der Konfigurationsdatei für alles andere. Die Runtime hält immer nur den Hash, wie bei einem Passwort. Ein Deploy-Token kann die Flows lesen und deployen, was das Zurückrollen einschließt, und sonst nichts: keine Einstellungen, kein Inject, kein Editor. Beide Befehle lesen das Token aus `HOTLOOP_FLOW_TOKEN` (oder `-token-file`) und die Instanz aus `HOTLOOP_FLOW_URL` (oder `-url`), nie ein Token auf der Kommandozeile, wo es in der Prozessliste und in jedem pipeline-Protokoll landen würde, das den Befehl wiedergibt. Die Historie zeigt das Token als Deployer, `token:ci`, mit der Notiz, die die Pipeline mitgegeben hat.

Zugangsdaten reisen nie auf diesem Weg. Sie stehen nicht in der Flow-Datei, ein Deployment aus git lässt also jedes Broker-Passwort genau dort, wo es war.

## Ein git-Spiegel, wenn Sie einen wollen

Das Deployment-Protokoll liegt auf der Maschine. Ein Repository ist der Ort, an dem alle anderen schon nachsehen: Es hat eine Weboberfläche, Blame, Backups und Leute, die es zu lesen verstehen. Richten Sie Flow auf eines, und jedes Deployment wird zu einem Commit der Flow-Datei auf einem Branch, in den nur Flow schreibt, **mit dem Autor, der es deployt hat**, zu der Zeit, zu der er deployt hat, mit seiner Notiz als Nachricht:

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

Das Passwort ist ein Zugriffstoken des git-Servers und kommt aus einem Secret in `HOTLOOP_FLOW_GIT_PASSWORD`, nie in die Datei (`HOTLOOP_FLOW_GIT_URL` und `HOTLOOP_FLOW_GIT_USERNAME` funktionieren ebenfalls). Eine URL mit Passwort wird beim Start abgelehnt, die URL lässt sich also immer protokollieren. Nur `http://` und `https://`: Das Image hat kein git-Binary für `file://` und keine Schlüssel für `ssh://`, und ein Spiegel, der bei jedem Push fehlschlägt, ist schlimmer als einer, der sich weigert zu starten. Rollbacks und Start-Baselines sagen im Commit, was sie sind, und jeder Commit trägt einen `Flow-Deployment: N`-Trailer, so macht ein neu gestarteter Prozess, oder einer, dessen Klon gelöscht wurde, genau dort weiter, wo das Repository sagt, dass er angekommen war, ohne Duplikat.

**Er hält nie ein Deployment auf.** Das Pushen läuft in einer eigenen Goroutine. Ein git-Server, der ausgefallen, langsam ist oder den Push verweigert, kostet ein Deployment nichts: Die Commits warten in einem lokalen Klon unter `data/git-mirror` und gehen beim nächsten funktionierenden Push hinaus, jede Minute erneut versucht. `GET /deployments` sagt, wie weit der Spiegel gekommen ist, und den letzten Fehler, und `hotloop_flow_git_mirror_behind_deployments` ist die Zahl, auf die man alarmieren sollte. Getestet gegen den eigenen Smart-HTTP-Server von git hinter Basic-Auth: Drei Deployments ergeben drei Commits von drei Autoren, ein vom Server verweigerter Push wartet und holt auf, sobald der Server aufhört zu verweigern, und ein Deployment mit einem git-Server, der zehn Sekunden braucht, um Nein zu sagen, kehrt in Millisekunden zurück.

Es ist reines Go (go-git), die Binärdatei bleibt also statisch. Sie kostet etwa 3.8 MB Binärgröße, weshalb es gemessen und nicht angenommen ist. Die Binärdatei hatte vor den Katalogen 48,083,106 Byte.
