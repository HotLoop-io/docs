---
title: "Podman Quadlet på en Pi"
description: "Kjør HotLoop som ekte systemd-tjenester på en Pi eller en liten industri-PC med Podman Quadlet, uten Docker, uten Compose og uten klynge."
---

For en Pi eller en liten industri-PC som **ikke** er en del av en k3s-klynge. Hvis den er det, bruker du produktets chart i stedet. Denne mappen og chartene er de to støttede måtene å kjøre HotLoop på.

Ingen Docker, og ingen løs `podman run` fra et skall som dør med økten. Quadlet gjør containerne til ekte systemd-tjenester: de starter ved oppstart uten innlogget bruker, starter på nytt ved feil og logger til journald.

| Mappe | Produkt | Image |
|---|---|---|
| `iot/` | HotLoop IoT, med PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, med TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, med TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| denne mappen | HotLoop Edge Relay, uten database | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[Produktsiden](/nb/products/) sier hvilket du trenger.

Hver av de tre første har også en `sqlite/`-mappe: samme produkt med databasen som en fil og uten databasecontainer. Se [SQLite i stedet for PostgreSQL](#sqlite-i-stedet-for-postgresql).

## IoT, Edge og Gateway

Hver mappe har de samme enhetene og ett skript:

- **`hotloop.network`**: nettverket appen og databasen deler. Appen når databasen ved navn (`hotloop-db:5432`) og ingenting annet på maskinen kan det, fordi databasen ikke publiserer noen port. Bare appens 8080 er publisert.
- **`hotloop.container`**: appen. Toppen av filen har installasjonstrinnene; les den før du kopierer noe.
- **`hotloop-db.container`**: databasen, samme image og versjon som chartet til produktet kjører. Den melder seg startet når den svarer, så appen venter på en database den kan bruke.
- **`hotloop-db-upgrade.container`** og **`hotloop-db-upgrade.sh`**: databasens flytting fra PostgreSQL 16 til 17, én gang. Den kjører før databaseenheten og bare når volumet fortsatt har 16-data; på et nytt volum, eller et som allerede er på 17, hopper systemd over den. Se [PostgreSQL 16 til 17](#postgresql-16-til-17).
- **`hotloop-db.volume`** og **`hotloop-data.volume`**: databasen, og alt appen skriver under `/data` (sikkerhetskopier, sertifikater, videresendingskøen, rapporter). Navngitte Podman-volumer, så `podman system prune` lar dem være.

Tre Podman-secrets holder det som ikke hører hjemme i en fil: `hotloop-db-password`, `hotloop-secret-key` (krypterer enhetspassordene i databasen; ta vare på en kopi utenfor maskinen) og `hotloop-admin-password-hash` (bcrypt-hashen av den første administratorens passord, aldri selve passordet).

**Podman 5.0 eller nyere.** Raspberry Pi OS Bookworm leveres med Podman 4.3, som ikke har Quadlet i det hele tatt: bruk Raspberry Pi OS Trixie (Podman 5.4) eller nyere. Oppdateringene nedenfor ble kjørt på Podman 6.1.3; Edge Relays enhet, som deler de samme nøklene, på 4.9.3. Og legg databasevolumet på en USB-SSD, ikke på SD-kortet. Historikken skriver hele dagen, og SD-kort dør akkurat av det.

### Hvorfor alle produkter bruker de samme navnene

Navnene på enheter, volumer og secrets er identiske i `iot/`, `edge/` og `gateway/`, med vilje. Å flytte en maskin opp et produkt er å kopiere `hotloop.container` og `hotloop-db.container` fra det større produktet over dine:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Volumene og secretene blir, og det gjør hver enhet, tagg, alarm, bruker og time med historikk også. Ta en sikkerhetskopi først uansett (`POST /api/backup`). Det trinnet er kjørt, fra IoT til Edge til Gateway på ett sett volumer. Å gå ned et produkt igjen er ikke noe å gjøre på en maskin du bryr deg om.

Det betyr også ett HotLoop per maskin. To ville slåss om port 8080 uansett.

### Verifisert

De leverte filene for IoT, Edge og Gateway, urørt, genereres med `quadlet`-generatoren fra Podman 6.1.3 med samme struktur: appen krever databasen og nettverket, publiserer sin egen port og har etiketten for automatisk oppdatering, mens databasen ikke har noen og ikke publiserer noe.

Gateways enheter ble deretter kjørt på ekte: rootless, under systemd, med et lokalt register i stedet for ghcr.io og produktenes eget `podman auto-update`. En første start med databasen frisk og appen frisk etter den; en oppdatering til en versjon som legger en migrering til en tabell appen allerede bruker, tatt med den eksisterende enheten og dataene intakte og uten at databasecontaineren noen gang ble startet på nytt; og en oppdatering til en versjon som migrerer databasen og så ikke kan starte, som Podman rullet tilbake, med forrige versjon som startet frisk på databasen den mislykkede allerede hadde migrert. Edge og IoT kjører på de samme enhetene, og er kjørt under systemd på en ekte Pi, på bare metal (2026-11-17).

## PostgreSQL 16 til 17

HotLoops database er PostgreSQL 17 fra denne versjonen. En maskin som kjørte en tidligere versjon har PostgreSQL 16-data, som PostgreSQL 17 ikke åpner, så flyttingen er en enhet som kjører før databasen. Få de nye filene på plass og start databasen på nytt, og det er alt:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` krever oppgraderingsenheten, så en maskin som bare fikk kopiert den nye databaseenheten starter ikke på 16-data, og journalen sier hvorfor. Oppgraderingsenheten kjører `pg_upgrade` i kopimodus inn i en ny mappe ved siden av den gamle, starter den nye serveren én gang for å bevise at den åpner, og bytter først deretter navnene; de gamle dataene blir liggende på volumet som `pgdata.pg16`. Den henter PostgreSQL 16-imaget bare når volumet trenger det. En feil lar 16-dataene være som de var og databasen ustartet. Hele beskrivelsen, veien tilbake og hvordan du sletter `pgdata.pg16` står i [k3s og Helm](/nb/install/helm/#postgresql-17). For en rootless-installasjon er skriptstien i enheten `~/.config/containers/systemd`, fra `%E`.

## SQLite i stedet for PostgreSQL

Databasen er en innstilling, ikke et image (siden om k3s og Helm, "SQLite"). Under Quadlet betyr det et andre sett med filer, ikke et andre image. Hvert produkts `sqlite/`-mappe har to:

- **`sqlite/hotloop.container`**: bare appen. Ingen `Requires=` på en database, intet nettverk, intet databasepassord, og `HOTLOOP_DB_TYPE=sqlite` med filen på `HOTLOOP_DB_PATH=/data/hotloop.db`. Den følger `:stable` og ruller tilbake en dårlig oppdatering akkurat som PostgreSQL-enheten: samme helsesjekk, samme `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: volumet `hotloop-data`, der databasefilen og dens `-wal` og `-shm` ligger. Det er samme volumnavn som PostgreSQL-filenes, så det er samme datavolum hvis du bytter.

| Mappe | Installasjon | Secrets |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | tre |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | to: `hotloop-secret-key` og `hotloop-admin-password-hash` |

Installer det ene settet eller det andre, aldri begge: de bruker de samme enhetsnavnene. Toppen av `sqlite/hotloop.container` har de nøyaktige trinnene. Kort sagt:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Noen ting å vite før du velger det. SQLite er én skriver på én lokal disk: en Pi legger volumet på en USB-SSD, og nettverkslagring er ikke et alternativ fordi SQLite blir ødelagt på det. Historikken er én tabell med en indeks, ikke partisjoner eller en hypertable, så et anlegg med år med historikk på ett sekund trenger PostgreSQL-filene. Og å flytte en maskin mellom SQLite og PostgreSQL er en sikkerhetskopi og en gjenoppretting ([Sikkerhetskopi og gjenoppretting](/nb/iot/backup/)), ikke et bytte av enheter: den nye databasen starter tom. Ikke kopier en `sqlite/hotloop.container` over en kjørende PostgreSQL-installasjon for å "bytte"; den leser ikke dataene i PostgreSQL-volumet.

Ren PostgreSQL på Edge eller Gateway er TimescaleDB-enheten med `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` lagt til i `hotloop.container`. IoTs enhet er allerede ren PostgreSQL, og IoT har ingen TimescaleDB-enhet i det hele tatt.

### Verifisert (SQLite)

`iot/sqlite/hotloop.container` og volumet ble kjørt rootless på Podman 4.9.3 under systemd (`systemctl --user`) fra de innsjekkede filene, endret bare i navnene, porten, imaget (bygget fra samme tre) og kjøremappen en brukerbehandler trenger. Enheten kom opp frisk, `/healthz` og `/readyz` svarte 200, administratoren logget inn fra hash-secreten, `/api/status` svarte, `hotloop.db`, `hotloop.db-wal` og `hotloop.db-shm` dukket opp på volumet, og en omstart brukte ingen migreringer og logget administratoren inn igjen. Edge og Gateways `sqlite/`-enheter er samme fil bortsett fra imaget og standardverdien for oppbevaring, og er kjørt under systemd som root på en ekte Pi, på bare metal (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: valgfri: holder tilbake image-oppdateringer til en operatør godkjenner dem. Et systemd-tillegg, ikke en del av en standardinstallasjon.
- **`edge-relay.container`**, selve tjenesten. De fulle installasjonstrinnene står i kommentaren i toppen av filen; les den før du kopierer noe.
- **`edge-relay-data.volume`**, et navngitt Podman-volum for videresendingskøen, slik at bufrede målinger overlever en omstart av containeren. Podman oppretter det automatisk første gang tjenesten starter.
- **`devices.example.json`**, et utgangspunkt for enhetsfilen. Kopier den til `/etc/edge-relay/devices.json` og rediger den for de faktiske enhetene på dette anlegget; det fulle formatet står i [referansen for Edge Relay](/nb/edge-relay/reference/).

### Hurtigstart

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Oppdateringer.** Enheten følger `:stable` og oppdaterer seg selv så snart Podmans tidtaker er på:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Hvis et nytt image ikke består helsesjekken sin, setter Podman det gamle tilbake. Gateways flåteliste viser hvert relés versjon og image-digest og logger hver endring. For å holde tilbake oppdateringer til en administrator godkjenner dem på Gateway, installerer du `edge-relay-hold.conf` slik kommentaren øverst i den filen sier, og slår av tidtakeren. Alt dette gjør, og hva det ikke kan, står i [referansen for Edge Relay](/nb/edge-relay/reference/#updating-a-relay).

For å ta i bruk en endring i den lokale filen: rediger den, og kjør deretter `sudo systemctl restart edge-relay.service`. Reléet leser den filen ved oppstart og overvåker den ikke.

En enhetsfil som Gateway sender trenger ikke noe av det: den gjelder live, uten omstart. Den kan ikke skrives til `/etc/edge-relay/devices.json` (den er montert `:ro` på en skrivebeskyttet rot), så den havner på datavolumet som `/data/pushed-devices.json`, og så lenge den finnes, er det den reléet kjører og starter fra. Endringene dine i den lokale filen blir stående ubrukt til du fjerner det som er sendt: `DELETE /api/fleet/{id}/config` på Gateway mens reléet kjører, og det går tilbake til den lokale filen med en gang. Journalen forteller hvilken fil det bruker, så sjekk der før du tviler på JSON-en din.

Verifisert mot den ekte `quadlet`-binæren (`/usr/libexec/podman/quadlet -dryrun` fra `podman-5.8.6`): begge enhetene tolkes uten feil og genererer det forventede `podman run`-kallet, med volumavhengigheten og secreten koblet inn automatisk.
