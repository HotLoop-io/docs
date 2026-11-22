---
title: "Cascade med Podman Quadlet"
description: "Kjør Cascade som systemd-tjenester med Podman Quadlet, på SQLite eller med Postgres og en egen worker, med et oppdateringsvindu som du styrer selv."
---

Det er to måter å kjøre den på. Begge krever Podman 5.0 eller nyere og en installasjon som root, slik at de starter ved oppstart uten at noen er logget inn. Begge følger `ghcr.io/hotloop-io/hotloop-cascade:stable`, kjører den skrivebeskyttet og uten root-rettigheter med alle capabilities fjernet, og lar systemd starte den på nytt. Oppdateringer og hvordan de rulles tilbake står til slutt.

## Én maskin, SQLite

`hotloop-cascade.container` og `hotloop-cascade-data.volume`. Databasen er en fil i volumet, ved siden av nøkkelen som krypterer lagret legitimasjon.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Åpne `http://this-box:8080`. Den første som åpner den, oppretter den første kontoen, så gjør det før du deler adressen.

## PostgreSQL, en server og workere

`postgres/`. Databasen, serveren og, hvis du vil, flere workere. Postgres er køen, så workerne henter jobbene fra samme sted. Databasen ligger på et eget nettverk og publiserer ingen port.

Først tre hemmeligheter, som lages én gang. Kommandoene står øverst i `postgres/hotloop-cascade.container`. Nøkkelen er viktigst: mister du den, blir all lagret legitimasjon uleselig. Ta vare på en kopi et annet sted enn på denne maskinen.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Flere workere: `hotloop-cascade-worker.container`. Workerne deler datavolumet, så de må ligge på samme maskin. Utover én maskin bruker du Helm-chartet.

## Innstillinger

`/etc/hotloop-cascade/cascade.env`, én `NAME=value` per linje, og filen må finnes selv om den er tom (`install`-linjen lager den). De du helst vil ha:

| Innstilling | Hva den gjør |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | Adressen folk bruker for å nå Cascade. Lenkene til webhooks og OAuth-tilbakekall bygges av den. Til du setter den, er den `http://localhost:8080`, som bare fungerer fra selve maskinen. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Krever `Authorization: Bearer` på `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Slår på filtrinnene, i denne katalogen. Monter den også inn i containeren. |

Enhetene setter bare datakatalogen, portene og nøkkelen, og en verdi satt i en enhet slår en verdi i env-filen, så la disse være. Etter en endring: `sudo systemctl restart hotloop-cascade`.

## Kontrollere

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

Helse og målinger ligger på port 8081, publisert bare på loopback. Hvis noe annet allerede bruker 8080 eller 8081, endrer du venstre side av `PublishPort=`-linjene.

## Oppgradere

Applikasjonsenhetene følger `:stable` og har `AutoUpdate=registry`. Slå på Podmans timer én gang per maskin:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Når den utløses, henter Podman `:stable`, og hvis digesten er endret, starter den enheten på nytt med det nye imaget. Enheten regnes ikke som startet før containeren består helsesjekken (`Notify=healthy`; sjekken er binærfilen som spør sin egen `/readyz`, som en JSON-liste fordi imaget ikke har noe shell). Hvis det nye imaget aldri kommer så langt, legger Podman det forrige tilbake under `:stable` og starter det. Ventetiden er opptil 15 minutter, fordi et nytt image migrerer databasen på vei opp.

For å holde oppdateringer tilbake til du sier fra, lar du timeren være av og kjører `sudo podman auto-update` når du er klar. For å la dem skje bare i et vindu, installerer du `update-window.conf` (toppteksten forklarer hvordan).

To ting en tilbakerulling ikke kan angre. Migreringer går bare framover, så ta en sikkerhetskopi før du slår på oppdateringer. En versjon som endrer en tabell slik at den gamle ikke kan lese den, sier fra om det i utgivelsesnotatene. Og databasen: imaget er festet til en eksakt tag og har med vilje ingen oppdateringsetikett. En ny server som ikke starter, angres ved å legge det gamle imaget tilbake, mens et nytt databaseimage kan starte, endre datakatalogen og først deretter vise seg å være en feil. Innenfor PostgreSQL 18 er det en endring av taggen, etter utgivelsesnotatene og en sikkerhetskopi.

I PostgreSQL-varianten er serveren og hver worker egne enheter, så en oppdatering som ikke starter, ruller tilbake akkurat den enheten og ikke den ved siden av.

## Hva som ble prøvd

Enhetene ble kjørt på ekte på Podman 6.1.3, rootless under systemd, med et lokalt register i stedet for ghcr.io og de leverte enhetene uendret bortsett fra vertsportene. Både frittstående og PostgreSQL: en første oppstart som venter på en frisk container; en oppdatering til en ny digest, som kom tilbake frisk med dataene intakte og, i PostgreSQL-varianten, med databasecontaineren urørt; og en oppdatering til et image som avslutter ved oppstart, som `podman auto-update` meldte som `rolled back`, med forrige digest frisk igjen og den tidligere arbeidsflyten fortsatt i gang. Som root-installasjon på Podman 4.9.3 startet og restartet den tidligere versjonen av enhetene under systemd, og `Notify=healthy` støttes ikke av Quadlet 4.9, som er grunnen til at enhetene også har `--sdnotify=healthy`.

Så begge variantene igjen som root-installasjon, slik enhetene sier de skal kjøres, på Podman 5.8.7 under systemd i en privilegert engangscontainer, med det samme lokale registeret i stedet for ghcr.io som speil og enhetene uendret. Frittstående: oppstarten ventet på en frisk container, en drept container kom tilbake frisk, en oppdatering til et godt image kom opp frisk på den nye digesten, en oppdatering til et image som avslutter ved oppstart ble meldt `rolled back` med det gode i gang igjen, og en arbeidsflyt kjørte etter hvert trinn. PostgreSQL, med serveren og en ekstra worker: `systemctl start` på serveren ventet til databasen og så serveren var friske, en drept server kom tilbake, en oppdatering til et godt image flyttet serveren og workeren og lot databasecontaineren være i fred, en oppdatering til et image som avslutter ved oppstart kom tilbake `rolled back` med begge på det gode imaget igjen og databasen urørt, og en arbeidsflyt kjørte før, mellom og etter. Én ting å vite når du leser den utskriften: serveren og workeren deler ett image, og da den første ble rullet tilbake, viste den andre `true` i stedet, med en omstart, og endte på det gode imaget likevel. Hvilken som ruller tilbake først, endret seg fra kjøring til kjøring.

Kjørt på bare metal (2026-11-17), på en ekte Raspberry Pi og med en Quadlet-autooppdatering mot selve ghcr.io.
