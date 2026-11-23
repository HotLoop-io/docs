---
title: "Utgivelsesnotater: HotLoop core 4.21.0"
description: "Hva HotLoop core 4.21.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.21.0"
---

Denne versjonen legger X.509-innlogging til OPC UA-serveren, tar bort passordgrensen på 64 byte og slår av de utdaterte sikkerhetspolicyene som standard. Den utvider også CODESYS-alarmimporten. Bygd på [4.20.2](/nb/releases/hotloop-4-20-2/).

## Hva som er endret

- **En klient kan logge inn på OPC UA-serveren med et X.509-sertifikat.** En admin knytter klientens offentlige sertifikat til en HotLoop-bruker (Settings, OPC UA certificates, eller API-et, eller MCP-verktøyene), og en klient som har den private nøkkelen, logger inn som den brukeren med den brukerens rettigheter. Å tilbakekalle et sertifikat avslutter den aktive sesjonen innen ti sekunder, og hver sertifikatinnlogging og hvert avslag står i logbook. Det er av til `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`). Enhetsdriveren kan logge inn på samme måte med `userCertificate` og `userPrivateKey` (RSA, nøkkelen forseglet som et passord). En betrodd CA med en navneregel er ikke bygd.
- **Passord på 65 til 72 byte logger nå inn over OPC UA.** De virket alltid i webgrensesnittet. Biblioteket serveren er bygd på, avviste hvert brukernavn-token der passordet var over 64 byte.
- **De utdaterte sikkerhetspolicyene `Basic128Rsa15` og `Basic256` er av som standard.** Serveren lister dem ikke lenger, og en klient som ber om en ved navn, avvises når kanalen åpnes. Dette gjelder nye installasjoner og oppgraderinger. En eldre klient som ikke snakker noe nyere, kobler seg til igjen med `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`), og serveren sier det ved oppstart. Muligheten til å slå dem av er åpen oppstrøms også (pull request 66).
- **CODESYS-alarmimporten leser en Outside range-alarm.** IDE-ens Export Alarms skriver `OutOfArea` for den, og den kommer over som to alarmer, en `lo` ved nedre grense og en `hi` ved øvre. Inside the range, Change, Event og Alarm (API) listes som hoppet over med årsaken: ingenting her sier dem ærlig. Importøren ble utvidet fra en eksport av hver observasjonstype IDE-en tilbyr, beholdt som test-fixture.

## API-endringer

- Nytt: `GET /api/opcua/certificates`, `GET` og `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, alle `users.manage`. Fem nye MCP-verktøy, 133 til sammen.
- Én migrering, 0027: tabellen `user_certificates` (bare offentlige sertifikater). Den er i sikkerhetskopien.

## Oppgradere

En vanlig `helm upgrade`, eller Quadlet-auto-update. Sjekk først om noen av OPC UA-klientene dine står på `Basic256` eller `Basic128Rsa15` (Ignitions tilkobling viser det): den klienten slutter å koble til etter oppgraderingen til du enten flytter den til `Basic256Sha256` eller setter den eldre bryteren ovenfor. En tilbakerulling til forrige versjon ble ikke prøvd med den nye tabellen på plass.

- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) er på 4.21.0, med hver tidligere versjon fortsatt i indeksen.

- Dette bygget er bare amd64, og `stable` beholder arm-imagene det har. Neste versjon er en liten versjonsøkning som bygger arm-imagene.
