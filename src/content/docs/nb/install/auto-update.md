---
title: "Den automatiske oppdateringen :stable"
description: "Hver maskin følger taggen stable. Hva en oppdatering gjør, hva en tilbakerulling ikke angrer, og hvordan du holder den tilbake til du sier fra."
---

Hver maskin følger `:stable`, og Podman oppdaterer den. Det er regelen for alle fire produktene, og derfor fester ingen enhet her et versjonsnummer: en maskin festet til `4.17.0` er akkurat så gammel som dagen noen installerte den, og ingen drar tilbake til anlegget for å bytte en tag. Hver utgivelsestag flytter `:stable`, og en utgivelse der enhetene ikke følger den, blir avvist.

Slå på timeren én gang per maskin:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Hva en oppdatering gjør

Podman henter `:stable` når timeren utløses, og hvis digesten har endret seg, starter den appens enhet på nytt med det nye avbildet. Bare appens: databasecontaineren røres ikke, så en oppdatering avbryter ikke historikken. Enheten har en helsesjekk som ikke trenger skall (avbildet har ikke noe): `hotloop healthcheck` spør appens egen `/readyz`, som bare svarer så lenge databasen svarer. Enheten blir stående i «activating» til den består, slik at Podman kan se forskjell på en oppdatering som kom opp igjen og en som ikke gjorde det, og hvis det nye avbildet aldri kommer opp, setter den det forrige tilbake under `:stable` og starter det.

Når det nye avbildet starter, kjører det migreringene sine først, på databasen som allerede finnes, og en stor database tar tid. Enheten gir appen 15 minutter på å svare før den kaller oppdateringen mislykket, og feil i løpet av de første fem minuttene teller ikke, for en migrering er ikke en feil.

To ting ble funnet ved å kjøre det, ikke ved å lese om det, og enhetene bærer rettelsen for hver. En vanlig `HealthCmd`-streng kjøres gjennom `/bin/sh -c`, og avbildet har ikke skall, så sjekken kunne aldri bestå: den er en JSON-array. Og eldre Quadlet leser `Notify=healthy` som vanlig `true` og sender `--sdnotify=conmon`, som melder appen oppe i det øyeblikket containeren starter: en oppdatering som ikke kunne starte ble rapportert som vellykket, og ingenting ble rullet tilbake. Enhetene sier selv `--sdnotify=healthy`.

## Hvorfor det ikke er noen pod

Appen og databasen delte tidligere en pod. Det kostet tilbakerullingen, og det ble funnet ved å kjøre den, ikke ved å lese manualen. For en container i en pod starter Podmans automatiske oppdatering **podens** enhet på nytt, og podens enhet kommer fint opp uansett hva som er galt med appen inni. En utgivelse som ikke kunne starte, ble rapportert som `UPDATED true`, appen gikk i krasjløkke på den (tjue omstarter de første minuttene), og `:stable` på maskinen var det ødelagte avbildet. Den startet også databasen på nytt ved hver appoppdatering. Med et nettverk i stedet er appen sin egen enhet, Podman starter den på nytt, og enheten blir stående i «activating» til appen svarer på `/readyz`: den samme utgivelsen kom tilbake som `UPDATED rolled back`.

## Hva en tilbakerulling ikke kan angre

En migrering. Når en utgivelse migrerer databasen og så feiler helsesjekken, setter Podman den forrige utgivelsen tilbake, og den starter på skjemaet den mislykkede etterlot. Det er trygt, og det holdes trygt på tre måter ([Migreringer legger bare til](/nb/iot/migrations/) har detaljene):

- **Migreringer legger bare til.** En tabell, en kolonne med standardverdi, en indeks. Aldri en sletting, en omdøping eller en typeendring, slik at den forrige utgivelsen finner alt den kjente der det var, og aldri ser på det som er lagt til.
- **En app avviser et skjema den ikke kan stole på.** Databasen registrerer hvilken utgivelse som brukte hver migrering. En tilbakerullet utgivelse som ligger ett steg bak, starter og sier det i loggen sin. En som ligger to eller flere utgivelser bak, starter ikke og sier hvorfor, med begge versjonene navngitt. Dette er tilfellet der en maskin feiler en oppdatering, ruller tilbake, feiler en ny, og databasen nå har flyttet seg to ganger. Appen avslutter straks med meldingen i `journalctl -u hotloop`, og `Restart=always` i enheten prøver stadig og blir stadig avvist. Det som løser det, er en utgivelse som kjenner skjemaet: den nyeste, som er det `:stable` er (`sudo podman auto-update`, eller hent den og start på nytt). Eller gjenopprett en sikkerhetskopi tatt av utgivelsen du kjører ([Sikkerhetskopi og gjenoppretting](/nb/iot/backup/)).

En tilbakerulling har altså ikke lenger noe forbehold i utgivelsesnotatene. Det den fortsatt ikke kan angre, er data: den mislykkede utgivelsen kan ha skrevet rader som den gamle ignorerer. Ta en sikkerhetskopi før du slår på oppdateringer; det er det eneste som står mellom en dårlig utgivelse og en gjenoppretting.

## Hvorfor databasen ikke følger `:stable`

Appen er merket for automatisk oppdatering. Databasecontaineren er ikke det, og `Image=` er en nøyaktig tag. Grunnen er at appens oppdateringer kan angres og databasens kan ikke.

- En **PostgreSQL-hovedversjon** (16 til 17) er ikke en omstart. PostgreSQLs versjonspolicy sier at datakatalogen ikke kan holdes bakoverkompatibel mellom hovedversjoner, og at en dump og innlasting, eller `pg_upgrade`, kreves ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). En tag som fløt mellom hovedversjoner, ville gjort det med et anleggs historikk under en urelatert omstart. Å feste hovedversjonen er minimum, og er ikke en «endepunktsfesting» i den forstand regelen ovenfor handler om. Det eneste hoppet HotLoop har gjort, 16 til 17, er `hotloop-db-upgrade.container`, kjørt med vilje når du kopierer inn de nye enhetene.
- En **mindre utgivelse** (16.14 til 16.15) trenger ikke dump og gjenoppretting. Den samme siden legger til at noen «kan kreve ekstra trinn, så les alltid utgivelsesnotatene først». En maskin uten tilsyn leser ikke utgivelsesnotater.
- **TimescaleDB** (Gateway og Edge) er den andre halvdelen. Appen kjører selv `ALTER EXTENSION timescaledb UPDATE` ved oppstart etter et nyere avbilde, og en utvidelsesoppdatering er en enveisendring i databasen: å sette det eldre avbildet tilbake etterpå angrer den ikke. En flytende Timescale-tag ville latt appens reversible oppdatering dra en irreversibel etter seg.
- Et nytt databaseavbilde som starter og kjører, er ikke et friskt et. Helsesjekken kan se forskjell på en container som ikke starter og en som gjør det, og det er alt. Om en historikk overlevde en motoroppgradering, er ikke noe `pg_isready` svarer på.

Databasetaggen flytter seg derfor med en HotLoop-utgivelse som er testet mot den. `release_guard.sh` holder hver `hotloop-db.container` lik databasen i chartet sitt, slik at en Quadlet-maskin og en chart-installasjon av samme produkt kjører den samme, og avviser en `AutoUpdate=` på den. Prisen er at PostgreSQLs egne patch-utgivelser når en maskin når en utgivelse leverer dem, eller når du endrer taggen for hånd. Innen samme hovedversjon er det en endring i `hotloop-db.container`, en `daemon-reload` og en omstart av poden, etter å ha lest utgivelsesnotatene og tatt en sikkerhetskopi. En hovedversjon er `pg_upgrade`, som HotLoop kjører for 16 til 17, og som du selv kjører, eller gjenoppretter inn i, for alle andre.

## Hold oppdateringer tilbake til du sier fra

Standard er ingen tilbakeholding: oppdateringer skjer når timeren utløses. Et anlegg som vil at et menneske skal avgjøre, har to måter, og ingen av dem krever at appen er tilgjengelig.

- **Hold tilbake.** La `podman-auto-update.timer` være av. Ingenting oppdateres. Når du er klar, kjør `sudo podman auto-update`: det er godkjenningen, med samme helsesjekk og samme tilbakerulling. Podman oppdaterer alle merkede containere på maskinen når den kjører, ikke bare disse, og kan ikke få beskjed om å hoppe over én, så en maskin som må kjøre timeren for andre containere, kan ikke samtidig holde disse tilbake.
- **Et vindu.** `update-window.conf` er en drop-in for timeren som sier når den kan utløses, for eksempel søndag kl. 03:00, i stedet for standarden hver dag ved midnatt:

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

Edge Relay er annerledes på ett punkt: en Gateway kan godkjenne oppdateringen sin fra flåteskjermen, fordi et relé allerede lytter etter kommandoer fra Gatewayen det videresender til. IoT, Edge og Gateway har ingen slik kanal å nås gjennom, og å bygge en ville satt en «start denne maskinen på nytt»-knapp på et webgrensesnitt for en funksjon som `sudo podman auto-update` allerede er. Se [Edge Relay-referansen](/nb/edge-relay/reference/#oppdatere-en-relay) for reléets tilbakeholding, og `edge-relay-hold.conf`.

## Hva Gatewayen ser

`GET /api/status` på en av de tre oppgir `version` og `imageDigest` når enheten har sagt fra (det gjør den, før hver start). En Edge eller Gateway med Edge-publisering på er en Sparkplug-node som et relé, og legger de samme to i hver birth, så en Gateway som har den i flåtelisten sin, viser versjon og digest og logger endringen når en automatisk oppdatering flytter den ([Flåtestyring](/nb/gateway/fleet/)). IoT har ingen oppstrøms, så digesten står på dens egen `/api/status` og ingen andre steder.

## Under Helm

En pod kan ikke erstatte seg selv, så det finnes ingen oppdatering uten tilsyn for chartene: `helm upgrade` er oppdateringen, og `image.tag` i chartet har som standard `appVersion`, som er utgivelsen.
