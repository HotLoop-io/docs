---
title: "Zwei Sandboxes in HotLoop Flow"
description: "Wie der Function-Knoten und die WebAssembly-Sandbox abgegrenzt sind, was jede berühren kann und wie ein Plugin in der zweiten läuft."
---

Der Function-Knoten läuft auf dem JavaScript-Interpreter (siehe [Sicherheitslage](/de/flow/security/)). Ein Aufruf kostet 11.6 bis 13.7 µs. Es ist keine Grenze gegenüber dem Speicher: Eine Funktion, die in einer Schleife Speicher belegt, lässt den Go-Heap wachsen, bis der Pod stirbt, und alles, was der JavaScript-Interpreter dagegen tun kann, ist ein Wanduhr-Timeout.

Das kostet 184 bis 196 µs pro Aufruf, das Fünfzehn- bis Sechzehnfache eines JavaScript-Interpreter-Aufrufs. Es lohnt sich genau dann, wenn Sie Code ausführen, dem Sie nicht ganz trauen, und sonst nicht.

Ein Flow führt einen WASM-Gast über ein Plugin aus: ein signiertes Modul mit einem Deskriptor, aus dem der Editor seinen Dialog zeichnet, das keinen Host-Zugriff bekommt, wenn es ihn nicht anfordert und Sie Ja sagen. Der Speicher ist pro Knoten begrenzt, eine Nachricht bekommt ein Timeout, und ein Gast, der eines von beiden überschreitet, wird abgebrochen, landet mit dem Grund an einem Catch-Knoten und reißt nichts anderes mit. Alles steht in [Plugins ohne npm](/de/flow/plugins/), einschließlich der Frage, wie Sie dem Schlüssel eines Herausgebers vertrauen und was die Ablehnungen sagen. Was es für Sie bedeutet: Das, wofür Node-RED npm und eine komplette Node.js-Installation braucht, führt Flow als abgeschottete Datei aus, die Sie vor dem Laden prüfen können.

Ein Plugin kann statt in JavaScript auch in Rust, TinyGo, Zig oder AssemblyScript geschrieben sein, sodass die Signalverarbeitung, die ein OT-Flow wirklich will, kompiliert läuft, mit einer Speicherobergrenze, mit der man nicht verhandeln kann.

Die Gast-ABI besteht aus drei Exporten, zwei davon Allokator-Hooks, und ist mit Absicht so klein. Jeder Export ist Angriffsfläche und eine Sache mehr, die jeder Gast-Autor richtig machen muss.

| Export | Signatur | Erforderlich |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | ja |
| `hotloop_flow_alloc` | `(size i32) -> i32` | ja |
| `hotloop_flow_free` | `(ptr i32, size i32)` | nein |

Das `i64`-Ergebnis packt einen Offset in die oberen 32 Bit und eine Länge in die unteren 32, und zeigt auf eine JSON-Antwort im eigenen Speicher des Gasts. Alles läuft als JSON hindurch, sodass ein Gast in jeder Sprache es ohne gemeinsamen Schema-Compiler erzeugen kann.

Die Grenzen sind mit Absicht klein. Das läuft auf Edge-Hardware neben den Flows, auf die es wirklich ankommt, und ein Knoten, der mehr braucht, soll das sagen müssen:

| Grenze | der JavaScript-Interpreter | WASM |
|---|---|---|
| Timeout pro Aufruf | 5 s | 5 s |
| Speicherobergrenze | keine durchsetzbar | 16 MiB pro Knoten, sofern das Plugin nichts anderes sagt, höchstens 64 MiB, sofern Sie `plugins.maxMemoryMiB` nicht erhöhen, hart |
| Maximale Ausgabe | 16 MiB | 8 MiB |

Beide Laufzeiten sind reines Go ohne cgo.
