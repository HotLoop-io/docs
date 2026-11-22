---
title: "Migrationen fügen nur hinzu"
description: "Warum eine Migration nie etwas löscht, umbenennt oder im Typ ändert, damit ein missglücktes Update ohne Datenverlust auf das letzte Release zurückgehen kann."
---

Eine Migration fügt hinzu. Sie löscht, benennt oder ändert nie den Typ von irgendetwas, verschärft nie eine Spalte oder eine Einschränkung, durch die das letzte Release schreibt, und löscht nie Daten. Das ist die ganze Regel, und ein Test lässt den Build scheitern, wenn eine Migration sie bricht.

## Warum

Jede Box folgt `:stable`, und das automatische Update von Podman bewegt sie. Wenn ein Release die Datenbank migriert und dann seine Gesundheitsprüfung nicht besteht, wird das Update zurückgerollt, und das vorherige Release startet auf dem Schema, das das neue hinterlassen hat. Eine Migration lässt sich nicht mit zurückrollen. Das vorherige Release muss also auf dem neuen Schema laufen, und das lässt sich nur versprechen, wenn das neue Schema alles enthält, was das alte enthielt, in derselben Form und mit denselben Schreibzugriffen.

Fügen Sie eine Spalte hinzu, und das alte Release sieht sie nie an. Löschen Sie eine, und die erste Abfrage des alten Releases ist ein Fehler, in einer Anlage, nachts um drei, ohne etwas, wohin man zurückkann.

Das Helm-Chart hat dasselbe Problem: `helm rollback` bringt das alte Image zurück und lässt die Datenbank dort, wo das neue sie hingebracht hat.

## Die Änderungen, die mehr zu brauchen scheinen

Löschen geht nicht, also wird eine Änderung, die eines zu brauchen scheint, durch Hinzufügen gemacht, und das Alte bleibt unangetastet.

- **Eine Spalte umbenennen.** Fügen Sie die neue Spalte mit einem Standardwert hinzu. Das neue Release liest die neue und schreibt in beide. Die alte Spalte bleibt, ungenutzt, für immer.
- **Einen Typ ändern.** Genauso: eine neue Spalte des neuen Typs, das neue Release schreibt in beide, die alte Spalte bleibt.
- **Eine Spalte, die jetzt NOT NULL sein muss.** Das wird in der Anwendung durchgesetzt. Wird eine Einschränkung wirklich gebraucht, kommt sie auf eine Tabelle, die neu ist.
- **Eine Tabelle ausmustern.** Man hört auf, sie zu benutzen. Sie bleibt.
- **Alte Daten aufräumen.** Das macht die Anwendung zur Laufzeit (die Aufbewahrung tut das bereits), keine Migration.

Tote Spalten kosten ein paar Byte. Eine Migration, die sich nicht rückgängig machen lässt, während das Release, zu dem sie gehört, sich zurückrollen lässt, kostet eine Anlage.

## Die Sperre: Eine Anwendung verweigert ein Schema, dem man nicht trauen kann

Hinzufügen ist für ein Release sicher, nicht für immer. Ein Release ist nur auf dem Schema direkt nach ihm erprobt, also zählt die Anwendung, wie weit die Datenbank voraus ist.

`schema_migrations` hält neben jeder Migration fest, welches Release sie angewendet hat (`app_version`). Beim Start, bevor sie irgendetwas anfasst, vergleicht die Anwendung die Migrationen in der Datenbank mit denen, die in ihr eingebaut sind:

| Die Datenbank hat | Was passiert |
|---|---|
| Nichts, was dieses Release nicht kennt | Startet |
| Migrationen von einem neueren Release | Startet, mit einer Warnung, die beide Versionen nennt. Das ist ein zurückgerolltes Update. Es migriert nichts, und das neuere Release findet sein Schema bei der Rückkehr schon vor |
| Migrationen von zwei oder mehr neueren Releases | Verweigert den Start und nennt dieses Release, die neueste Migration, die es kennt, die neueste in der Datenbank und die Releases, die sie geschrieben haben |

Die Verweigerung lautet:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

Auf einer Box, die `:stable` folgt, behebt das nächste Update es, denn `:stable` rückt auf das neueste Release vor, das jede Migration kennt. Die Unit steht dann auf »activating«. Das ist Absicht: Eine Box, die ausgefallen ist und sagt warum, ist besser als eine Box, die läuft und falsch liegt.

Die Sperre läuft, ob der Start migriert oder nicht (`HOTLOOP_DB_MIGRATE`), und bei einer Wiederherstellung, die die Datenbank auf dieselbe Weise öffnet. Eine Datenbank aus der Zeit vor der Sperre hat keine Spalte `app_version` und kann keine Migration enthalten, die neuer ist als das Release, das sie liest, also startet sie; die Spalte wird beim ersten Start eines Releases mit der Sperre hinzugefügt.

## Der Nachweis für ein echtes Release

Bevor ein Release ausgeliefert wird, wird das vorherige Release auf der Datenbank gestartet, die das neue migriert hat, und muss sich anmelden, Geräte und Tags lesen, durch das Gate schreiben und den Verlauf lesen. Schafft es das nicht, wird das Release nicht ausgeliefert.
