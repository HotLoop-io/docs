---
title: "Versionshinweise: HotLoop core 4.21.0"
description: "Was HotLoop core 4.21.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.21.0"
---

Diese Version fügt dem OPC-UA-Server die X.509-Anmeldung hinzu, nimmt ihm die Passwortgrenze von 64 Byte und schaltet die veralteten Sicherheitsrichtlinien standardmäßig ab. Sie erweitert außerdem den CODESYS-Alarmimport. Gebaut auf der [4.20.2](/de/releases/hotloop-4-20-2/).

## Was sich geändert hat

- **Ein Client kann sich mit einem X.509-Zertifikat am OPC-UA-Server anmelden.** Ein Admin hängt das öffentliche Zertifikat des Clients an einen HotLoop-Benutzer (Settings, OPC UA certificates, oder die API, oder die MCP-Werkzeuge), und ein Client, der den privaten Schlüssel hält, meldet sich als dieser Benutzer mit dessen Berechtigungen an. Das Widerrufen eines Zertifikats beendet seine laufende Sitzung innerhalb von zehn Sekunden, und jede Zertifikatsanmeldung und jede Ablehnung steht im Logbook. Es ist aus, bis `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (Chart `opcuaServer.allowX509`). Der Gerätetreiber kann sich genauso mit `userCertificate` und `userPrivateKey` anmelden (RSA, der Schlüssel versiegelt wie ein Passwort). Eine vertrauenswürdige CA mit Namensregel ist nicht gebaut.
- **Passwörter mit 65 bis 72 Byte melden sich jetzt über OPC UA an.** In der Web-Oberfläche funktionierten sie immer. Die Bibliothek, auf der der Server gebaut ist, lehnte jedes Benutzernamen-Token ab, dessen Passwort über 64 Byte lang war.
- **Die veralteten Sicherheitsrichtlinien `Basic128Rsa15` und `Basic256` sind standardmäßig aus.** Der Server listet sie nicht mehr, und ein Client, der eine beim Namen verlangt, wird beim Öffnen des Kanals abgelehnt. Das gilt für neue Installationen und für Updates. Ein Legacy-Client, der nichts Neueres spricht, verbindet sich wieder mit `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (Chart `opcuaServer.allowDeprecatedPolicies: true`), und der Server sagt das beim Start. Die Option, sie abzuschalten, ist auch Upstream offen (Pull Request 66).
- **Der CODESYS-Alarmimport liest einen Outside-range-Alarm.** Export Alarms der IDE schreibt dafür `OutOfArea`, und er kommt als zwei Alarme an, ein `lo` an der unteren Grenze und ein `hi` an der oberen. Inside the range, Change, Event und Alarm (API) werden als übersprungen mit dem Grund aufgelistet: Nichts hier sagt sie ehrlich. Der Importer wurde anhand eines Exports jedes Beobachtungstyps erweitert, den die IDE anbietet, aufbewahrt als Test-Fixture.

## API-Änderungen

- Neu: `GET /api/opcua/certificates`, `GET` und `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, alle `users.manage`. Fünf neue MCP-Werkzeuge, insgesamt 133.
- Eine Migration, 0027: die Tabelle `user_certificates` (nur öffentliche Zertifikate). Sie ist im Backup.

## Update

Ein normales `helm upgrade` oder das Quadlet-Auto-Update. Prüfen Sie zuerst, ob einer Ihrer OPC-UA-Clients auf `Basic256` oder `Basic128Rsa15` steht (die Verbindung von Ignition zeigt es): Dieser Client verbindet sich nach dem Update nicht mehr, bis Sie ihn auf `Basic256Sha256` umstellen oder den Legacy-Schalter oben setzen. Ein Rollback auf die vorige Version wurde mit der neuen Tabelle an ihrem Platz nicht ausprobiert.

- Alle vier Charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) stehen auf 4.21.0, mit jeder früheren Version weiter im Index.

- Dieser Build ist nur amd64, und `stable` behält die arm-Images, die es hält. Die nächste Version ist eine kleine Versionserhöhung, die die arm-Images baut.
