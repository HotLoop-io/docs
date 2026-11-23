---
title: "Plugins ohne npm"
description: "Ein Plugin ist ein signiertes WebAssembly-Modul mit Speicherobergrenze, Timeout und Descriptor und erhält keinen Host-Zugriff, solange Sie ihn nicht gewähren."
---

Ein Node-RED-Community-Knoten ist ein npm-Paket. Er braucht Node.js auf der Box und läuft nach der Installation im Prozess der Runtime selbst, mit allem, was dieser Prozess erreichen kann. Flow führt solche Knoten nicht aus und wird es nie tun, deshalb macht es stattdessen Folgendes: Ein Plugin ist ein WebAssembly-Modul in einer Sandbox mit Speicherobergrenze und Timeout, es kommt mit einem Descriptor, aus dem der Editor seinen Dialog zeichnet, es ist signiert, und es erhält keinen Host-Zugriff, es sei denn, es fragt danach und Sie gewähren ihn.

Was das für Sie heißt: Sie können den ganzen Vertrag eines Plugins in einer einzigen JSON-Datei lesen, bevor es läuft, die Box lehnt alles ab, was nicht mit einem von Ihnen gewählten Schlüssel signiert ist, und das Schlimmste, was ein fehlerhaftes Plugin tun kann, ist, seine eigenen Nachrichten scheitern zu lassen.

## Was ein Plugin ist

Ein Verzeichnis unter `<data.dir>/plugins/` (oder `plugins.dir`), benannt nach dem Plugin, mit drei Dateien:

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Jedes Plugin wird zu einem Knotentyp, `wasm-<name>`, im Bereich Function der Palette. Plugins werden beim Start von Flow gelesen, daher ist das Hinzufügen oder Ändern eines Plugins ein Neustart. Zur Nachrichtenzeit wird nichts gelesen.

### Das Modul

Die ABI ist die aus dem [README](/de/flow/sandboxes/): `hotloop_flow_process` und `hotloop_flow_alloc` sind Pflicht, `hotloop_flow_free` ist optional, und alles geht als JSON über die Grenze. Ein Guest bekommt `{"msg": {...}, "config": {...}}` und gibt `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}` zurück. Eine Nachrichteneigenschaft, die kein einfaches JSON ist, etwa das Antwort-Handle, das ein HTTP-In-Knoten anhängt, oder ein binärer Puffer, wird dem Guest nicht übergeben. Der Knoten hält sie zurück und setzt sie auf jede Nachricht zurück, die der Guest sendet, es sei denn, der Guest hat diese Eigenschaft selbst gesetzt, sodass ein Plugin zwischen einem HTTP In und einer HTTP Response sitzen kann. `config` ist das, was der Dialog des Knotens enthält. Ein `error` lässt die Nachricht an einem Catch-Knoten scheitern, und was vorher gesendet wurde, bleibt gesendet.

Das Modul darf WASI importieren und, wenn es eine Kontext-Capability deklariert hat, die beiden Kontextfunktionen unten. Alles andere, was es importiert, wird beim Laden des Plugins abgelehnt, und die Ablehnung nennt den Import.

### Der Descriptor

`plugin.json` wird streng gelesen. Ein Feld, das Flow nicht kennt, ist eine Ablehnung, sodass ein falsch geschriebenes `"capabilites"` erkannt wird, statt ein Plugin zu ergeben, das stillschweigend nichts angefordert hat.

| Feld | <span class="sr-only">Details</span> |
|---|---|
| `format` | `1`. Pflicht. |
| `name` | Kleinbuchstaben, Ziffern und Bindestriche, bis zu 40, beginnend mit einem Buchstaben. Muss dem Verzeichnisnamen entsprechen, weil `plugins.grants` und die Flow-Datei ihn verwenden. |
| `version` | Pflicht. Wird in der Hilfe des Knotens und in `GET /plugins` angezeigt. |
| `label`, `description`, `help` | Das Palettenlabel, eine Zeile und Markdown für die Info-Seitenleiste. |
| `inputs`, `outputs` | Eingänge müssen 1 sein. Ausgänge 0 bis 16, Standard 1. |
| `props` | Der Dialog. Dieselben Eigenschaftsdeklarationen wie bei den eingebauten Knoten, mit den Arten `string`, `text`, `number`, `bool`, `select`, `json` und `list`. Zugangsdaten, Verweise auf Konfigurationsknoten und die Code-Editor-Arten werden abgelehnt: Ein Plugin hat damit nichts zu tun. |
| `capabilities` | Der Host-Zugriff, den es anfordert. |
| `limits` | `memoryMiB` und `timeoutMs`, die es standardmäßig möchte. |

Der Editor zeichnet den Dialog aus `props`, ohne dass Code des Plugins im Browser läuft. Jeder Plugin-Knoten bekommt außerdem ein Feld für Name, Speicherlimit und Timeout. Diese drei Namen sind reserviert.

## Limits, und wie eine Trap aussieht

Jeder Plugin-Knoten hat seine eigene Speicherobergrenze und sein eigenes Timeout. Der Descriptor des Plugins setzt die Standardwerte (16 MiB und eine Sekunde, wenn er nichts sagt), ein Knoten kann sie in seinem Dialog ändern, und `plugins.maxMemoryMiB` (64) und `plugins.maxTimeout` (5s) sind das, was die Box überhaupt erlaubt. Ein Knoten, der mehr verlangt, als die Box erlaubt, lässt das Deploy scheitern und sagt, welche Einstellung zu erhöhen ist.

Ein Guest, der über seine Obergrenze hinauswächst, löst eine Trap aus. Ein Guest, der beim Timeout noch läuft, wird gestoppt. In beiden Fällen geht die Nachricht an den nächsten Catch-Knoten, die Instanz wird verworfen, damit die nächste Nachricht sauber beginnt, und kein anderer Knoten wird berührt. Was der Catch-Knoten in `msg.error.message` sieht:

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

Die Obergrenze wird im Voraus reserviert: Ein Knoten mit 64 MiB Obergrenze bucht 64 MiB des Go-Heaps, solange seine Instanz existiert, ob der Guest sie berührt oder nicht, denn einen Puffer durch Kopieren wachsen zu lassen, würde den Host kurzzeitig ein Vielfaches der Obergrenze halten lassen. Der Test, der das beweist, misst, was ein Aufruf insgesamt belegt hat (256 MiB bei 256 MiB Obergrenze) und dass der Heap nach der Trap wieder dort ist, wo er begann. Setzen Sie die Obergrenzen also auf das, was ein Plugin braucht, nicht auf die größte Zahl, die Sie tippen können.

## Capabilities

Keine Capability, kein Zugriff. Jede wird nur eingebunden, wenn der Descriptor sie anfordert und `plugins.grants` sie diesem Plugin namentlich gewährt.

| Capability | Was sie gibt | Ohne sie |
|---|---|---|
| `clock` | Die echten Wand- und monotonen Uhren. | Der Guest sieht eine Ersatzuhr, die am 2022-01-01 beginnt und mit der der Anlage nichts zu tun hat. |
| `random` | Die Zufallsbytes des Betriebssystems. | Jedes Mal dieselbe feste Folge. |
| `context.flow` | Den Flow-Kontext des eigenen Flows des Knotens lesen und schreiben. | Die Kontextfunktionen existieren für ihn nicht. |
| `context.global` | Den globalen Kontext lesen und schreiben. | Dasselbe. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Etwas anzufordern, das nicht gewährt ist, scheitert nicht zur Nachrichtenzeit. Es lässt das Deploy scheitern: Der Flow wird mit einem 422 abgelehnt, bevor etwas geschrieben wird, die laufenden Flows merken nichts, und die Meldung nennt den Knoten und die Zeile, die hinzuzufügen ist:

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

Ein Rollback ist ein Deploy, daher wird ein Rollback auf Flows, die ein Plugin nutzen, dessen Gewährung inzwischen entzogen wurde, auf dieselbe Weise abgelehnt. Ein Plugin, das installiert, aber nicht gewährt ist, erscheint trotzdem in der Palette, mit seinen Capabilities in seiner Hilfe.

### Die Kontextfunktionen

Ein Guest, der eine Kontext-Capability deklariert, darf diese aus dem Modul `hotloop_flow` importieren. Werte gehen als JSON über die Grenze.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

Der Scope ist `0` für den Flow und `1` für global. `context_get` gibt die Länge des JSON zurück und schreibt es nur, wenn es in `outCap` passt, sodass ein Guest, der mehr zurückbekommt, als er angeboten hat, es mit einem größeren Puffer erneut versucht. Ein Schlüssel, der nicht da ist, ist `-1`, und `-2` heißt verweigert: Der Scope war nicht gewährt, der Schlüssel oder das JSON war falsch, oder der Speicher hat Nein gesagt. Ein Guest kann einen Scope, der ihm nicht gewährt wurde, nicht durch Probieren lesen.

## Signieren, und einem Herausgeber vertrauen

Ein Plugin wird mit einem ed25519-Schlüssel signiert. Die Signatur deckt beide Dateien ab, nicht nur das Modul, weil der Descriptor der Ort ist, an dem ein Plugin Zugriff anfordert. Würde nur das Modul signiert, könnte jeder mit Schreibzugriff auf das Verzeichnis einem signierten Plugin eine Capability hinzufügen. Die signierte Nachricht ist:

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

Beim Laden eines Plugins wird nichts nachgeschlagen: kein Netzwerk, kein Transparenzlog, keine Zertifikatskette. Die Prüfung ist die Signatur, der Schlüssel, den sie nennt, und Ihre Schlüsselliste. Das ist eine bewusste Entscheidung für eine Box in einem Anlagennetz, das möglicherweise keinen Weg nach draußen hat. Es heißt auch, dass es keinen Widerrufsdienst gibt, also bedeutet das Widerrufen eines Schlüssels, ihn aus `plugins.trustedKeys` zu entfernen und neu zu starten.

### Als Herausgeber

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` schreibt einen privaten PKCS-#8-Schlüssel und einen öffentlichen PKIX-Schlüssel als PEM, dieselben Dateien, die `openssl genpkey -algorithm ed25519` und `openssl pkey -pubout` erzeugen, und weigert sich, eine von beiden zu überschreiben. Es gibt die Schlüssel-ID und die einzeilige Form des öffentlichen Schlüssels aus. Halten Sie den privaten Schlüssel aus git heraus. Es wird kein Schlüssel eingecheckt.

### Als Betreiber

Im Helm-Chart sind es `plugins.trustedKeys`, `plugins.grants` und `plugins.volume`, in [Flow bereitstellen](/de/flow/deploying/).

Sie vertrauen einem Herausgeber, indem Sie seinen öffentlichen Schlüssel in `plugins.trustedKeys` eintragen, oder in `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, durch Kommas getrennt. Jeder Eintrag ist die Zeile `ed25519:<base64>`, ein öffentlicher PEM-Schlüssel oder der Pfad einer Datei, die einen enthält, womit ein eingehängtes Secret oder eine ConfigMap hereinkommt:

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Ohne vertrauenswürdige Schlüssel wird jedes Plugin abgelehnt. Ein Schlüssel, der sich nicht parsen lässt, ist ein Startfehler. Vertrauen gilt pro Schlüssel und nicht pro Plugin, also heißt einem Herausgeber zu vertrauen, allem zu vertrauen, was er signiert. Was ein Plugin dann nutzen darf, ist eine eigene Entscheidung, die in `plugins.grants` namentlich getroffen wird.

## Wenn es ablehnt

Ein Plugin, das nicht lädt, wird beim Start protokolliert, mit seinem Grund in `GET /plugins` aufgelistet, fehlt in der Palette und wird in der Ablehnung genannt, wenn ein Flow deployt wird, der es nutzt. Ein schlechtes Plugin hindert den Rest von Flow nie am Start. `hotloop-flow plugin verify` führt dieselben Prüfungen aus, sodass ein Herausgeber sieht, was ein Betreiber sehen würde.

| Was nicht stimmt | Was es sagt |
|---|---|
| Keine `plugin.sig` | `unsigned: plugin.sig is missing` |
| Modul oder Descriptor nach dem Signieren geändert | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Mit einem Schlüssel signiert, dem Sie nicht vertrauen | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Gar keine Schlüssel konfiguriert | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| Beschädigte Signaturdatei | `signature file is malformed: ...` |
| Descriptor mit unbekanntem Feld, falscher Art oder falscher Capability | `plugin.json is not valid: ...` mit dem Feldnamen |
| Modul importiert etwas, das der Host nicht bereitstellt | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| Modul nutzt die Kontextfunktionen, ohne eine Capability zu deklarieren | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| Verzeichnisname und `name` weichen ab | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

Die Signatur wird geprüft, bevor der Descriptor geparst und bevor das Modul kompiliert wird, sodass unsignierter Code nie kompiliert wird.

## Die zwei Beispiele

* `moving-average` ist Rust. Es mittelt einen Messwert über die letzten N Nachrichten und hält sein Fenster im eigenen Speicher. Es fordert nichts an. `cargo build --locked --release --target wasm32-wasip1`, dann ist `plugin.wasm` die `moving_average.wasm`, die dabei entsteht.
* `stamp` ist TinyGo. Es fügt jeder Nachricht die Zeit hinzu, also fordert es `clock` an. Es wird mit dem eigenen Container von TinyGo gebaut, mit Podman: `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow ist ein Go-Haus. Der Host, das Signieren, die CLI und jeder Test sind Go, und das TinyGo-Beispiel ist Go. Das Rust-Beispiel gibt es, weil ein Plugin-Format, das nur für die Sprache funktionierte, in der der Host geschrieben ist, kein Plugin-Format wäre, und weil Rust die Sprache ist, in der eine Signalverarbeitungsbibliothek am ehesten schon geschrieben ist. Das ist die schriftliche Begründung für das eine Nicht-Go-Beispiel. Die Crates, mit denen es gebaut wird, sind `serde` und `serde_json`, beide permissiv lizenziert, in das Beispielmodul hineinkompiliert und nicht in Flow.

## Was nicht bewiesen ist

* Plugins wurden auf Bare Metal ausgeführt (2026-11-17).
* Auf Kubernetes kommen die Plugin-Dateien über `plugins.volume`, jede Volume-Quelle. Eine ConfigMap fasst ein Plugin nur bis zu ihrem Limit von 1 MiB, ein Plugin von der Größe des TinyGo-Beispiels braucht also einen Claim.
* Es gibt keine Netzwerk-Capability. Ein Plugin kann keine Anfrage stellen, und das ist Absicht, bis jemand einen Grund mit einer passenden Host-Allowlist hat.
* Flow-Tests führen Plugins echt aus, im selben Kindprozess wie jeden anderen Knoten. Die Capabilities eines Plugins sind dieselben, die das Deploy ihm geben würde.
* `hotloop-flow test`, von Hand in einer Shell ausgeführt, lädt keine Plugins. Das Deploy-Gate und die Testläufe des Editors tun es.
