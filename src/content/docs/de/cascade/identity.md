---
title: "Identität und Zugriff"
description: "Eigene Rollen, Anmeldung mit LDAP, Active Directory und SAML sowie SCIM-Provisionierung, alles in jedem Cascade enthalten, ohne kostenpflichtige Stufe."
---

Wer hineinkommt und was er danach tun darf. Cascade liefert all das an alle aus. Nichts davon ist kostenpflichtig, und dahinter steckt keine Lizenzprüfung.

Jeder Endpoint unten steht im OpenAPI-Dokument unter `/api/v1/openapi.json`, und zu jedem gibt es einen Test, der ihn aufruft.

## Eigene Rollen

Im Editor: Einstellungen, Rollen. Alle lesen die Rollen; ein Eigentümer oder Administrator legt eigene Rollen an, ändert und löscht sie und weist sie auf demselben Bildschirm den Personen eines Projekts zu.

Ein Projekt hat vier eingebaute Rollen: admin, editor, operator und viewer. Sie stecken im Code und ändern sich nie. Wenn keine davon passt, legen Sie eine eigene Rolle an: ein Name und eine Liste von Projektberechtigungen.

Der übliche Anlass ist ein Linienleiter, der die Workflows der Linie starten und deren Läufe lesen, aber nichts bearbeiten darf:

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Dann nehmen Sie jemanden mit dieser Rolle in ein Projekt auf, mit demselben Aufruf wie bei einer eingebauten Rolle:

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

Das sollten Sie wissen:

- `GET /api/v1/permissions` listet jede Berechtigung auf, die eine Rolle tragen kann, und `GET /api/v1/roles` listet die vier eingebauten und die eigenen Rollen mit dem, was jede darf. Alle angemeldeten Personen können beides lesen, weil ein Projektadministrator es braucht, um eine Rolle zu wählen.
- Eigene Rollen anzulegen, zu ändern und zu löschen ist Sache eines Instanz-Eigentümers oder -Administrators, die Berechtigung `role.manage`. Ein Projektadministrator kann den Personen seines Projekts eine Rolle geben, aber keine neue schreiben, damit sich niemand mehr gibt, als er bekommen hat.
- Eine Rolle trägt nur Projektberechtigungen. Sie kann weder `user.manage` noch `audit.read` noch eine andere Instanzberechtigung tragen, und eine solche anzufordern ergibt einen 400.
- Ein Name besteht aus 2 bis 40 Kleinbuchstaben, Ziffern und Bindestrichen und beginnt mit einem Buchstaben. Er lässt sich später nicht ändern, weil Mitglieder und Servicekonten eine Rolle über ihren Namen halten. Die vier eingebauten Namen sind vergeben.
- Eine Änderung der Berechtigungen einer Rolle erreicht alle, die sie halten, bei ihrer nächsten Anfrage. Nichts wird zwischengespeichert, daher gibt es kein Zeitfenster, in dem eine entzogene Berechtigung noch funktioniert.
- Ein Servicekonto-Schlüssel kann eine eigene Rolle als Projektrolle halten, und die Bereiche eines API-Schlüssels schneiden sie weiterhin zu.
- Das Löschen einer Rolle, die jemand hält, wird mit 409 abgelehnt, mit der Zahl der Mitglieder und Servicekonto-Schlüssel, die sie halten. Verschieben Sie diese zuerst.
- Rollenänderungen stehen im Audit-Protokoll als `role.created`, `role.updated` (mit den Berechtigungen vorher und nachher) und `role.deleted`.

## LDAP und Active Directory

Die Leute melden sich mit dem Namen und dem Passwort an, die sie im Werk schon haben: OpenLDAP, 389 Directory Server, FreeIPA oder Active Directory. Es steht neben den lokalen Konten und neben OIDC und ist aus, bis Sie `HOTLOOP_CASCADE_LDAP_URL` setzen.

So läuft eine Anmeldung ab:

1. Ein Servicekonto (oder eine anonyme Suche, wenn Ihr Verzeichnis sie erlaubt) findet die Person mit dem Benutzerfilter.
2. Es schlägt die Gruppen nach, in denen sie ist.
3. Das Verzeichnis selbst prüft das Passwort, indem es sich als die Person bindet. Cascade speichert dieses Passwort nie und sieht nie einen Hash davon. Das hier angelegte Konto hat kein eigenes Passwort, deshalb lässt sich das Verzeichnispasswort auf `/login` nicht wie ein lokales verwenden.
4. Das Konto wird bei der ersten Anmeldung angelegt (außer Sie schalten das ab), und seine Rolle folgt bei jeder weiteren Anmeldung den Gruppen.

Die Anmeldeseite zeigt ein zweites Formular, wenn es aktiv ist, und dasselbe ist ein einziger Aufruf, `POST /auth/ldap/login` mit `{"username": "...", "password": "..."}`. Ein falscher Name und ein falsches Passwort bekommen dieselbe Antwort. Ein leeres Passwort erreicht das Verzeichnis nie, weil die meisten Verzeichnisse einen Bind mit leerem Passwort als Erfolg beantworten.

### Einstellungen

Alle sind Umgebungsvariablen. Beim Helm-Chart gehören sie in `env`, das Bind-Passwort in `extraEnv` aus einem Secret.

| Variable | Was sie bewirkt |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` oder `ldaps://host:636`. Schaltet es ein. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (Standard) oder `ad`. Wählt nur die Standardwerte unten. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` stuft eine `ldap://`-Verbindung auf Verschlüsselung hoch, bevor etwas gesendet wird. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | PEM-Datei der Stellen, denen für das Zertifikat des Verzeichnisses vertraut wird. Leer heißt die des Systems. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | Der Name, auf den das Zertifikat ausgestellt sein muss, wenn er nicht der Host in der URL ist. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | Das Servicekonto, das Personen nachschlägt. Leer ist eine anonyme Suche. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` oder `_FILE` | Sein Passwort oder eine Datei, die es enthält. Nicht beides. Ein DN ohne Passwort wird abgelehnt, da es ein anonymer Bind wäre. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Pflicht. Der DN, unter dem Personen gesucht werden. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Findet eine Person. `{username}` ist, was sie eingegeben hat, maskiert. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | Der DN, unter dem Gruppen gesucht werden. Leer heißt keine Gruppensuche. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Findet die Gruppen einer Person. `{dn}` ist ihr DN, `{username}` das, was sie eingegeben hat. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Die Attribute für die stabile ID, die E-Mail und den Anzeigenamen. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Paare `group=role`, durch Kommas getrennt: `supervisors=admin, operators=member`. Eine Gruppe wird über ihr `cn` oder ihren vollständigen DN benannt. Die mächtigste Rolle unter den Gruppen einer Person gewinnt. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` oder `none`. Mit einer Rollenzuordnung ist der Standard `none`, wer also in keiner zugeordneten Gruppe ist, wird abgewiesen. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` legt Konten nur von Hand an. Standard `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Wie die Anmeldeschaltfläche es nennt. |

Die Standardwerte für `ldap`: Benutzerfilter `(&(objectClass=inetOrgPerson)(uid={username}))`, Gruppenfilter `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, ID `entryUUID`, E-Mail `mail`, Name `cn`.

Die Standardwerte für `ad`: Ein Benutzer wird über `sAMAccountName` oder den User Principal Name gefunden, sodass `alice` und `alice@plant.example` beide funktionieren, und ein deaktiviertes Konto bleibt aus der Suche draußen. Gruppen nutzen die Regel für verschachtelte Mitgliedschaft (`member:1.2.840.113556.1.4.1941:={dn}`), sodass auch jemand in einer Gruppe, die in einer zugeordneten Gruppe liegt, die Rolle erhält. Die ID ist `objectGUID`, als GUID geschrieben, E-Mail `mail`, Name `displayName`.

### Das sollten Sie wissen

- **Active Directory verlangt Verschlüsselung.** Es lehnt einen einfachen Bind auf einer unverschlüsselten Verbindung ab. Nutzen Sie `ldaps://` oder `ldap://` mit `START_TLS=true`. Cascade prüft das Zertifikat gegen die CA-Datei (oder die Systemwurzeln) und gegen den Servernamen, und keine Einstellung überspringt die Prüfung. Ein Verzeichnis, das sein Zertifikat selbst signiert, braucht seine CA in `CA_FILE`.
- **Das Konto hängt an der ID des Verzeichnisses, nicht am Namen.** Benennen Sie jemanden im Verzeichnis um oder verschieben ihn in eine andere OU, bleibt es hier dasselbe Konto. Jemand ohne `mail` kann kein Konto bekommen (die Anmeldung sagt es).
- **Das Verzeichnis ist die Autorität für die Adresse.** Ein hier schon vorhandenes Konto mit derselben E-Mail wird bei der ersten Anmeldung dieser Person mit dem Verzeichniseintrag verknüpft, ohne zusätzliche Prüfung, so wie bei einer verifizierten OIDC-Adresse. Richten Sie das nicht auf ein Verzeichnis, das Sie nicht betreiben.
- **Das erste Konto einer Instanz ist ihr Eigentümer**, wie auch immer es angelegt wird. Legen Sie den Eigentümer zuerst mit der Einrichtung an.
- **Ein hier eingerichteter zweiter Faktor zählt weiterhin.** Ein Verzeichnispasswort ist ein Faktor. Wer eine Authenticator-App oder einen Passkey am Konto hat, wird anschließend danach gefragt, und die instanzweite MFA-Pflicht gilt wie für alle.
- **Falsche Passwörter sperren das Konto auch hier.** Fünf hintereinander auf einem Konto, das schon mit dem Verzeichnis verknüpft ist, sperren es für eine Minute, mit Verdopplung, wie bei einem lokalen, noch bevor die Sperre des Verzeichnisses greifen muss. Eine Person, die das Verzeichnis nicht kennt, ein falsches Passwort und ein gesperrtes Konto stehen alle im Audit-Protokoll als `auth.login_failed` oder `auth.login_refused`, und eine Person, die das Verzeichnis durchgelassen und Cascade abgewiesen hat (keine Gruppe, keine E-Mail, JIT aus), ist `auth.sso_refused`.
- **Ein Verzeichnis, das ausgefallen ist, ist ein Serverfehler, kein falsches Passwort.** Die Anmeldung sagt, dass das Verzeichnis nicht geantwortet hat, und die Einzelheiten stehen im Log.
- Jeder Aufruf ans Verzeichnis ist auf fünfzehn Sekunden begrenzt, und nur eine Person darf auf den Benutzerfilter passen: Zwei Treffer sind eine Ablehnung, die das Problem benennt, nie der erste Treffer.

## SAML

Single Sign-on über jeden SAML-2.0-Identity-Provider. Cascade ist der Service Provider. Es steht neben lokalen Konten, OIDC und LDAP und ist aus, bis Sie die Metadaten des Providers nennen.

Die Schritte:

1. Cascade veröffentlicht seine eigenen Metadaten unter `/auth/saml/metadata`. Geben Sie sie dem Provider, oder tragen Sie die beiden Werte ein, die sie enthalten: die Entity-ID und den Assertion Consumer Service, `<public url>/auth/saml/acs`, HTTP-POST-Binding.
2. Setzen Sie `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` auf die Metadatenadresse des Providers (etwa `https://sso.plant.example/saml/metadata`) oder `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` auf dasselbe auf Platte gespeicherte Dokument.
3. Die Anmeldeseite zeigt eine Schaltfläche „Anmelden mit“. Sie führt zu `/auth/saml/start`.

Was auf dem Rückweg geprüft wird: die Signatur der Antwort gegen das Zertifikat des Providers in seinen Metadaten, die Zielgruppe, das Zeitfenster, dass sie eine Anfrage beantwortet, die dieser Browser gestartet hat, und dass die Anmeldung in diesem Browser gestartet wurde. Eine Antwort, die niemand angefordert hat (eine beim Provider gestartete Anmeldung), wird abgelehnt. Der Zustand jeder Anmeldung gilt nur einmal, sodass eine abgefangene Antwort nicht wieder abgespielt werden kann.

| Variable | Was sie bewirkt |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` oder `_FILE` | Die Metadaten des Providers. Eine von beiden schaltet SAML ein; nicht beide. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Wie sich diese Instanz gegenüber dem Provider benennt. Standard: ihre Metadaten-URL. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` und `_CERT_FILE` | Das Schlüsselpaar dieser Instanz, PEM, RSA oder EC. Beide oder keines. Standard: ein beim ersten Start erzeugtes Paar als `saml-sp.key` und `saml-sp.crt` im Datenverzeichnis, das erhalten bleibt. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` signiert jede Anfrage, die Cascade sendet. Dem Provider muss das Zertifikat mitgeteilt werden. Standard `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Womit Cascade den Provider bittet, Personen zu identifizieren: `persistent` (Standard), `email` oder `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Ein Attribut, das die Person statt der NameID identifiziert. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Welche Attribute E-Mail, Anzeigenamen und Gruppen enthalten. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Dasselbe wie bei LDAP: die Paare Gruppe zu Rolle, die Rolle für alle in keiner, ob bei der ersten Anmeldung ein Konto angelegt wird, und der Name der Schaltfläche. |

Ohne die Attributeinstellungen sucht Cascade nach den gängigen Namen. Die E-Mail ist `email`, `mail`, `emailAddress`, die LDAP-Objekt-ID `urn:oid:0.9.2342.19200300.100.1.3` oder der Claim-URI `.../claims/emailaddress`, und fällt auf die NameID zurück, wenn diese eine Adresse ist. Der Name ist `displayName`, `name` oder Vor- und Nachname. Gruppen sind `groups`, `group`, `memberOf`, der URI `.../claims/Group` und der Gruppen-Claim von Microsoft.

Das sollten Sie wissen:

- **Fordern Sie eine persistente ID an.** Ein Konto hängt an der NameID, und eine transiente ist bei jeder Anmeldung anders. Cascade fordert eine persistente an und lehnt eine transiente mit einer Meldung ab, die das sagt, statt bei jeder Anmeldung ein neues Konto anzulegen. Wenn Ihr Provider nur eine transiente ID senden kann, nennen Sie in `SUBJECT_ATTR` ein stabiles Attribut.
- **Der Provider ist die Autorität für die Adresse.** Wie bei LDAP wird ein vorhandenes Konto mit derselben E-Mail bei der ersten SAML-Anmeldung verknüpft.
- **Hinter einem Proxy setzen Sie `HOTLOOP_CASCADE_PUBLIC_URL` auf die Adresse, die die Leute benutzen.** Der Provider sendet seinen POST an die daraus gebildete Assertion-Consumer-URL.
- **Nutzen Sie HTTPS.** Der Provider antwortet mit einem POST von einer anderen Website, daher muss das Cookie, das eine Anmeldung an ihren Browser bindet, websiteübergreifend gesendet werden, was Browser nur bei einer sicheren Verbindung erlauben.
- **Mehr als ein Pod** braucht auf allen dasselbe Schlüsselpaar: Legen Sie es in ein Secret und nennen Sie es mit `KEY_FILE` und `CERT_FILE`, sonst erzeugt jeder Pod sein eigenes.
- Ein hier eingerichteter zweiter Faktor zählt nach einer SAML-Anmeldung weiterhin, und SAML lässt die Mehrfaktor-Anmeldung des Providers nie dafür zählen.
- Single Logout wird nicht unterstützt. Das Abmelden beendet die Sitzung hier.

## SCIM

Im Editor: Einstellungen, Anmeldung und SCIM zeigt, ob SCIM an ist, die Basis-URL für den Provider und die Tokens, mit einer Schaltfläche, um eines zu erzeugen (es wird nur einmal angezeigt) und um eines zu widerrufen. LDAP, SAML und OpenID Connect werden beim Start in der Umgebung der Instanz gesetzt, daher zeigt derselbe Bildschirm, welche an sind und worauf ein Provider zeigt (die SAML-Metadaten- und ACS-URLs), und tut nicht so, als änderte er sie.

SCIM ist die Art, wie ein Identity Provider Konten mit seinem Verzeichnis im Gleichschritt hält: Er legt eine Person an, wenn sie dazukommt, ändert sie, wenn sie wechselt, schaltet sie ab, wenn sie geht, und pflegt Gruppen. Cascade ist der SCIM-Server (RFC 7643 und 7644, Version 2.0), und der Provider ist der Client. Es ist nach dem gebaut, was die RFCs sagen und was die gängigen Identity Provider senden, und wird in jedem Release gegen scim2-tester getestet, einen SCIM-Client eines anderen Teams, der jede Prüfung ausführt, die er hat. Es ist aus, bis Sie `HOTLOOP_CASCADE_SCIM=true` setzen.

So richten Sie es ein:

1. Schalten Sie es mit `HOTLOOP_CASCADE_SCIM=true` ein und starten Sie neu.
2. Erzeugen Sie als Instanz-Eigentümer oder -Administrator ein Token für den Provider: `POST /api/v1/scim-tokens` mit `{"name": "plant directory"}`. Das `secret` in der Antwort (es beginnt mit `hlcs_`) wird nur einmal angezeigt, tragen Sie es also sofort im Provider ein. `GET /api/v1/scim-tokens` listet sie mit dem Zeitpunkt der letzten Nutzung, und `DELETE /api/v1/scim-tokens/{token}` widerruft eines. Zum Erzeugen eines Tokens muss eine Person angemeldet sein: Ein API-Schlüssel kann das nicht, damit ein durchgesickerter Schlüssel keine weiteren erzeugen kann.
3. Geben Sie dem Provider die Basis-URL, `<public url>/scim/v2`, und das Token als Bearer-Token.

Jeder Aufruf braucht das Token, und jede Antwort ist `application/scim+json`. Aufrufe stehen im Audit-Protokoll mit dem Namen des Tokens als Akteur, sodass `user.created`, `user.disabled` und die übrigen sagen, welcher Provider es getan hat, dazu die SCIM-Ereignisse `scim.user_deleted`, `scim.group_created`, `scim.group_updated` und `scim.group_deleted`.

### Was es bietet

`/ServiceProviderConfig`, `/ResourceTypes` und `/Schemas` sagen, was unterstützt wird, und sie sagen nur, was wahr ist: Filtern, PATCH, kein Bulk, keine Sortierung, keine ETags, keine Passwortänderungen.

| Ressource | Aufrufe |
|---|---|
| `/Users` | `GET` (Liste, mit `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | dasselbe |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` mit der Abfrage im Body |

- **Ein Benutzer** besteht aus `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` und `active`. Die E-Mail des Kontos ist die primäre, sonst die geschäftliche, sonst die erste, sonst `userName`, wenn das eine Adresse ist. Alles ohne Adresse ist ein 400. Was der Provider sendet, kommt so zurück, wie er es gesendet hat: Ein Name, den er nicht gesendet hat, wird nicht erfunden. `groups` kommt schreibgeschützt zurück.
- **Eine Gruppe** besteht aus `displayName`, `externalId` und `members`, jedes Mitglied die ID eines Benutzers. Ein Mitglied, das kein Benutzer ist, ist ein 400.
- **Filter** haben die vollständige Syntax: `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, Klammern und `attr[filter]`. Der Vergleich ignoriert die Groß- und Kleinschreibung, außer bei `id` und `externalId`. Ein fehlerhafter Filter ist ein 400 mit `scimType: invalidFilter`.
- **PATCH** nimmt `add`, `replace` und `remove` mit oder ohne Pfad, mit Wertpfaden wie `emails[type eq "work"].value` und `members[value eq "id"]`, in beliebiger Schreibweise, und einen Boolean als `true` oder als String `"False"`, den manche Provider senden. Es ändert genau das, was ein PUT ändern könnte.
- **Listen** stehen in der Reihenfolge, in der die Konten angelegt wurden, 100 pro Seite, sofern `count` nichts anderes sagt, höchstens 200.

### Was es nicht tut

- **Es zeigt oder ändert nie den Eigentümer.** Der Instanz-Eigentümer steht nicht in der Liste, kann nicht abgerufen, gepatcht oder gelöscht werden und nicht in eine Gruppe aufgenommen werden. Eine E-Mail, die dem Eigentümer gehört, ist ein Konflikt.
- **Es löscht nie ein Konto.** `DELETE` schaltet die Person ab, was ihre Sitzungen beendet, sie aus ihren Gruppen nimmt und für SCIM verbirgt. Alles, was sie angelegt hat, und jede Audit-Zeile bleiben. Legt der Provider sie mit derselben Adresse neu an, kommt dasselbe Konto zurück, eingeschaltet. `active: false` schaltet ab, ohne zu verbergen.
- **Ein SCIM-Konto hat kein Passwort.** Es meldet sich über OIDC, SAML oder LDAP an, die es über die Adresse verknüpfen.
- **Es rührt keine Projekte an.** SCIM arbeitet mit Konten und Instanzrollen. Wer in welchem Projekt ist, wird weiterhin hier entschieden.

### Rollen aus Gruppen

Standardmäßig ist ein neues Konto ein Mitglied, und SCIM ändert nie die Rolle von jemandem. Damit Gruppen entscheiden, ordnen Sie Gruppennamen Rollen zu:

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Die Rolle einer Person folgt dann ihren Gruppen, sooft sich eine Mitgliedschaft ändert: Die mächtigste zugeordnete Rolle gewinnt, und wer in keiner ist, erhält den Standard. Nur `admin` und `member` lassen sich zuordnen, weil ein Provider nie einen Eigentümer anlegt. Nutzen Sie eine einzige Quelle für Rollen. Wenn auch OIDC oder SAML Gruppen Rollen zuordnen, gewinnt, wer die Rolle einer Person zuletzt geändert hat, und die beiden werden sich streiten.

Der Provider braucht dieselben Gruppennamen und muss Gruppen mit ihren Mitgliedern senden, was jeder Provider kann, der SCIM-Gruppen beherrscht.
