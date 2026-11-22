---
title: "Migreringer legger bare til"
description: "Hvorfor en migrering aldri sletter, endrer navn på eller endrer type på noe, slik at en mislykket oppdatering kan rulles tilbake uten å miste en rad."
---

En migrering legger til. Den sletter, endrer navn på eller endrer type på ingenting, strammer aldri inn en kolonne eller en begrensning forrige utgivelse skriver gjennom, og sletter aldri data. Det er hele regelen, og en test lar bygget feile når en migrering bryter den.

## Hvorfor

Hver boks følger `:stable`, og Podmans automatiske oppdatering flytter den. Når en utgivelse migrerer databasen og så ikke består helsesjekken, rulles oppdateringen tilbake, og forrige utgivelse starter på skjemaet den nye etterlot. En migrering kan ikke rulles tilbake sammen med den. Så forrige utgivelse må fungere på det nye skjemaet, og den eneste måten å love det på er at det nye skjemaet rommer alt det gamle gjorde, i samme form, og tar imot de samme skrivingene.

Legg til en kolonne, og den gamle utgivelsen ser aldri på den. Slett en, og den gamle utgivelsens første spørring er en feil, på et anlegg, klokka tre om natten, med ingenting å rulle tilbake til.

Helm-chartet har det samme problemet: `helm rollback` setter det gamle bildet tilbake og lar databasen stå der den nye flyttet den.

## Endringene som ser ut til å trenge mer

Du kan ikke slette, så en endring som ser ut til å kreve det, gjøres ved å legge til og så la det gamle være i fred.

- **Endre navn på en kolonne.** Legg til den nye kolonnen med en standardverdi. Den nye utgivelsen leser den nye og skriver til begge. Den gamle kolonnen blir stående, ubrukt, for godt.
- **Endre en type.** Det samme: en ny kolonne av den nye typen, den nye utgivelsen skriver til begge, den gamle kolonnen blir stående.
- **En kolonne som nå må være NOT NULL.** Håndhev det i applikasjonen. Trengs en begrensning virkelig, havner den på en tabell som er ny.
- **Avvikle en tabell.** Slutt å bruke den. Den blir stående.
- **Rydde bort gamle data.** Applikasjonen gjør det mens den kjører (oppbevaring gjør dette allerede), ikke en migrering.

Døde kolonner koster noen få byte. En migrering som ikke kan angres mens utgivelsen den hører til kan, koster et anlegg.

## Vernet: en applikasjon nekter et skjema den ikke kan stoles på

Å legge til er trygt for én utgivelse, ikke for alltid. En utgivelse er bare prøvd på skjemaet like etter seg, så applikasjonen teller hvor langt foran databasen er.

`schema_migrations` registrerer, ved siden av hver migrering, hvilken utgivelse som brukte den (`app_version`). Ved oppstart, før den rører noe, sammenligner applikasjonen migreringene i databasen med de som er bygget inn:

| Databasen har | Hva som skjer |
|---|---|
| Ingenting denne utgivelsen ikke kjenner | Starter |
| Migreringer fra én nyere utgivelse | Starter, med en advarsel som nevner begge versjonene. Dette er en tilbakerullet oppdatering. Den migrerer ingenting, og den nyere utgivelsen finner skjemaet sitt på plass når den kommer tilbake |
| Migreringer fra to eller flere nyere utgivelser | Nekter å starte, og nevner denne utgivelsen, den nyeste migreringen den kjenner, den nyeste i databasen og utgivelsene som skrev dem |

Avvisningen lyder:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

På en boks som følger `:stable` fikser neste oppdatering det, for `:stable` flyttes til den nyeste utgivelsen, som kjenner hver migrering. Enheten står da i «activating». Det er med vilje: en boks som er nede og sier hvorfor, er bedre enn en boks som er oppe og feil.

Vernet kjører enten oppstarten migrerer eller ikke (`HOTLOOP_DB_MIGRATE`), og ved en gjenoppretting, som åpner databasen på samme måte. En database fra før vernet har ingen `app_version`-kolonne og kan ikke inneholde en migrering nyere enn utgivelsen som leser den, så den starter; kolonnen legges til ved første oppstart av en utgivelse som har vernet.

## Å bevise det for en ekte utgivelse

Før en utgivelse sendes ut, startes forrige utgivelse på databasen den nye migrerte, og får logge inn, lese enheter og tagger, skrive gjennom porten og lese historikk. Klarer den ikke det, sendes ikke utgivelsen ut.
