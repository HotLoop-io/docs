---
title: "Installere HotLoop IoT {{hotloop}}"
description: "Installer HotLoop IoT {{hotloop}} på k3s med Helm, eller på en Pi eller liten PC som systemd-tjenester med Podman Quadlet, på PostgreSQL eller en SQLite-fil."
sidebar:
  label: "Installasjon"
---

HotLoop IoT kom første gang i 4.18.10. Imaget er `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`, bygget for amd64, arm64 og arm/v7, og chartet er `hotloop-iot` i samme Helm-repository som resten av produktrekken. Begge lastes ned uten innlogging. Det finnes bevisst ingen Docker- eller Compose-vei, og en bar `podman run` fra et skall som dør med økten er ikke en installasjon.

To veier. Et cluster bruker Helm. En Pi, en NUC eller en liten industri-PC uten cluster bruker Podman Quadlet. Uansett velger du databasen én gang: PostgreSQL 17 (standard) eller en SQLite-fil helt uten databasecontainer.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Kall releasen `hotloop`, uansett hvilket produkt det er. Releasenavnet er det databasevolumet, Secrets og Service er oppkalt etter, og å beholde det er det som lar en lokasjon gå opp til et større produkt senere.

Det deployer IoT pluss PostgreSQL 17.11 ved siden av, på et volum på 10 Gi, med 30 dagers historikk. Chartet genererer databasepassordet, MCP-tokenet og et administratorpassord i release-Secret, og gjenbruker dem ved hver oppgradering, så en `helm upgrade` bytter aldri ut et passord bak ryggen din.

For en SQLite-fil og ingen database-pod ber du om det når du installerer:

```bash
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace \
  --set database.type=sqlite
```

SQLite er én skriver på én lokal disk, så det er én replika, og volumet legges på lokal lagring, aldri NFS. En lokasjon med år med historikk på ett sekund vil ha PostgreSQL. IoT-chartet tar `postgresql` eller `sqlite` og ingenting annet: å be det om `timescaledb` får installasjonen til å feile. Å bytte mellom de to senere er en sikkerhetskopi og en gjenoppretting, ikke en verdiendring, fordi den nye databasen starter tom. [Sikkerhetskopier](/nb/iot/backup/) har gjenopprettingen.

### Ta sikkerhetskopi av nøkkelen

Chartet genererer også `<release>-secret-key` (`hotloop-secret-key` med kommandoene over). Den holder nøkkelen som krypterer hvert passord HotLoop lagrer for en enhet. Nøkkelen er aldri i databasen og aldri i en sikkerhetskopi, så den er en del av dataene dine: en sikkerhetskopi gjenoppretter legitimasjon bare der den nøkkelen er montert. Chartet beholder Secret gjennom en `helm uninstall`. Ta vare på den et annet sted enn ved siden av sikkerhetskopiene dine, for en nøkkel som ligger ved siden av sikkerhetskopiene den beskytter, beskytter ingenting. [Installere Gateway](/nb/gateway/install/#back-up-the-key-before-you-need-it) har hele historien, og det er den samme nøkkelen.

### Logge inn

Brukeren er `admin`. Installasjonsnotatene skriver ut kommandoen som leser passordet tilbake:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Åpne `http://localhost:8080`. Den administratorkontoen er en oppstart, ikke en tilbakestillingsbryter: når den finnes, gjør det ingenting å endre `auth.admin.password` og oppgradere, så et passord noen har satt i grensesnittet blir aldri overskrevet av neste deploy.

Legg nå til en enhet, oppdag taggene dens og prøv å skrive til en. Du kan ikke. Skriving leveres avslått, hver tag er skrivebeskyttet til noen armerer den, og `safety.allowWrites` forblir `false` til du bestemmer at denne installasjonen får flytte maskineri. [Skriveporten](/nb/gateway/write-gate/) har hver sjekk, i rekkefølge.

### Hva du bør sette før et ekte anlegg ser det

Legg disse i en verdifil og installer med `-f`.

| Verdi | Standard | Hvorfor du endrer den |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, tom | Hva anlegget heter på skjermer, i sider og for andre lokasjoner. |
| `plant.latitude`, `plant.longitude` | tom | Hvor anlegget ligger, i desimalgrader. [Solen](/nb/iot/sun/) regnes ut fra dem på boksen. Begge eller ingen. |
| `global.timezone` | `America/New_York` | Tidsplaner og skiftbytter går etter den. Den må være et ekte sonenavn, fordi et som ikke lar seg laste stopper oppstarten. |
| `publicUrl` | tom | Adressen en telefon på anleggets Wi-Fi når HotLoop på. Uten den har varsler ingen lenke tilbake, og ntfy får ingen Bekreft-knapp. |
| `safety.allowWrites` | `false` | Hovedbryteren. Av, skriver ingenting til en maskin, fra noe sted. |
| `safety.allowMcpWrites` | `true` | Lar agenter skrive gjennom samme port, på siden 4.19.4. Den følger hovedbryteren: med `safety.allowWrites` av skriver ingenting, agenter inkludert. Sett den til `false`, og agenter kan fortsatt lese hele anlegget og aldri skrive. |
| `historian.retentionDays` | `30` | Antall dager med historikk som beholdes. Gateway og Edge beholder 90, fordi disken på en Pi er liten. |
| `logbook.retentionDays` | `90` | Dager med tilstandsendringer for entiteter som [loggboken](/nb/iot/logbook/) beholder. |
| `database.postgresql.persistence.size` | `10Gi` | Her bor historikken din. Dimensjoner den etter antall tags og oppbevaringen over. |
| `secretKey.existingSecret` | tom | En Secret du styrer selv, med nøkkelen til enhetspassordene. Sett den hvis du rendrer chartet med `helm template`, som ikke kan generere en stabil nøkkel. |
| `opcuaClient.persistence.enabled` | `false` | Slå den på før du legger til en sikret OPC UA-enhet, slik at klientens sertifikater overlever en omstart. |
| `ingress` | av | Bare hvis du vil ha den tilgjengelig utenfra clusteret med et navn. |

## Podman Quadlet

For en boks som ikke står i et cluster. Quadlet gjør containerne om til ekte systemd-tjenester: de starter ved oppstart uten at noen er innlogget, starter på nytt når de dør og logger til journalen. Det krever **Podman 5.0 eller nyere**. Raspberry Pi OS Bookworm leveres med 4.3, som ikke har Quadlet i det hele tatt, så en Pi trenger Trixie eller nyere. Legg databasevolumet på en USB-SSD og ikke på SD-kortet, fordi historikken skriver hele dagen og SD-kort dør nettopp av det.

Enhetene ligger i `iot/`-mappen i HotLoop-repositoryet, under `deploy/quadlet/`. [Podman Quadlet](/nb/install/quadlet/) forklarer hva hver fil er. Kortversjonen for PostgreSQL:

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-iot:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-iot:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Åpne så `http://<this box>:8080` og logg inn som `admin`. De tre secretene er databasepassordet, nøkkelen som krypterer enhetspassord (mister du den, må hvert enkelt skrives inn på nytt, så ta vare på en kopi et sted som ikke er denne boksen) og bcrypt-hashen av administratorens passord, aldri selve passordet.

For en SQLite-fil i stedet bruker du filene i `iot/sqlite/` og ingenting fra mappen over. De har de samme enhetsnavnene, så det er det ene settet eller det andre, aldri begge. Det er to filer, `hotloop.container` og `hotloop-data.volume`, og to secrets, `hotloop-secret-key` og `hotloop-admin-password-hash`. Databasen er `/data/hotloop.db` på volumet `hotloop-data`.

Enheten følger `:stable`, og Podman flytter den når tidsuret er på:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Et nytt image migrerer databasen på vei opp, og hvis det ikke kan starte, setter Podman det forrige tilbake. Databasecontaineren følger bevisst ikke `:stable`. [Den automatiske oppdateringen av :stable](/nb/install/auto-update/) forklarer hva en oppdatering gjør, hva en tilbakerulling ikke kan angre, og hvordan du holder oppdateringer tilbake til du sier fra. Ta en sikkerhetskopi før du slår på oppdateringer.

## Gå opp til et større produkt

Fra IoT til Edge til Gateway beholdes hver enhet, tag, entitet, automasjon, alarm, bruker og time med historikk, og [produktoversikten](/nb/products/) har fremgangsmåten. Overgangen er kjørt på Quadlet og som en `helm upgrade` på et ekte cluster. Å gå ned igjen til et mindre produkt er ikke en overgang å gjøre på en boks du bryr deg om, så ta en sikkerhetskopi først.

## Hvor langt den er kjørt

IoTs Quadlet-enheter for SQLite og PostgreSQL er kjørt under systemd, uten root, fra de innsjekkede filene, og en ekte Pi under systemd som root og de 32-bits arm-imagene er kjørt på ekte maskinvare, på bare metal (2026-11-17).

## Lisens

HotLoop IoT er under HotLoop Source License Agreement 1.0. Det er gratis og har åpen kildekode å se på, men er ikke åpen kildekode i OSI sin forstand. Bruk hjemme og i laboratorium er gratis, og det samme gjelder skoler, ideelle organisasjoner og offentlige organer for deres egen drift. Se [lisenssiden](/nb/license/) og [Bruke HotLoop i en bedrift](/nb/business/).
