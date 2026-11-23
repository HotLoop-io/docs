---
title: "Installere HotLoop Edge {{hotloop}}"
description: "Installer HotLoop Edge {{hotloop}} på k3s med Helm eller på en industri-PC med Podman Quadlet, og slå så på OPC UA-serveren og Sparkplug-publiseringen."
sidebar:
  label: "Installasjon"
---

HotLoop Edge kom første gang i 4.18.10. Imaget er `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}`, bygget for amd64, arm64 og arm/v7, og chartet er `hotloop-edge` i samme Helm-repository som resten av produktrekken. Begge lastes ned uten innlogging. Det finnes bevisst ingen Docker- eller Compose-vei, og en bar `podman run` fra et skall som dør med økten er ikke en installasjon.

Et cluster bruker Helm. En industri-PC eller en Pi uten cluster bruker Podman Quadlet. Databasen velger du én gang: TimescaleDB (standard), vanlig PostgreSQL eller en SQLite-fil helt uten databasecontainer.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-edge --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Kall releasen `hotloop`, uansett hvilket produkt det er. Releasenavnet er det databasevolumet, Secrets og Service er oppkalt etter, og å beholde det er det som lar en lokasjon gå opp til et større produkt senere.

Det deployer Edge pluss TimescaleDB 2.30.1 på PostgreSQL 17 ved siden av, på et volum på 20 Gi, med 90 dagers historikk. Chartet genererer databasepassordet, MCP-tokenet og et administratorpassord i release-Secret, og gjenbruker dem ved hver oppgradering. Det genererer også `<release>-secret-key`, nøkkelen som krypterer hvert enhetspassord HotLoop lagrer. Den nøkkelen er en del av dataene dine, og [installasjonssiden for Gateway](/nb/gateway/install/#ta-sikkerhetskopi-av-nøkkelen-før-du-trenger-den) forklarer hvorfor og hvordan du sikkerhetskopierer den. Det er den samme nøkkelen.

For vanlig PostgreSQL eller en SQLite-fil setter du `database.type` til `postgresql` eller `sqlite` når du installerer. En SQLite-fil er én skriver på én lokal disk, så den er én replika og aldri NFS. Å bytte database senere er en sikkerhetskopi og en gjenoppretting, fordi den nye databasen starter tom. [Sikkerhetskopier](/nb/iot/backup/) har gjenopprettingen.

### Logge inn

Brukeren er `admin`. Installasjonsnotatene skriver ut kommandoen som leser passordet tilbake:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Åpne `http://localhost:8080`. Skriving leveres avslått: hver tag er skrivebeskyttet til noen slår den på, og `safety.allowWrites` forblir `false` til du bestemmer at denne boksen får flytte maskineri. [Skriveporten](/nb/gateway/write-gate/) har hver sjekk, i rekkefølge.

### Hva Edge legger til, og hvordan du slår det på

Begge er av som standard, fordi det å åpne en lytter eller en opplink på et anleggsnettverk er noe en installasjon gjør med vilje.

**OPC UA-serveren** er `opcuaServer.enabled: true`, på port 4840. Sett `opcuaServer.endpointHost` til navnet en klient når boksen på, slik at sertifikatet stemmer. [OPC UA-serveren](/nb/edge/opc-ua-server/) har sikkerhetsmodellen, og den er skrivebeskyttet.

**Boksens helse og vertsmonteringen.** OPC UA-serveren i chartet leverer også helsen til denne boksen (CPU, minne, disk og sanntidsjitter når en agent skriver filen) til EmberNet-dashbordet, og lager en innlogging for dashbordet som kan lese tags og verdier og ingenting annet. Det er på som standard: chartet monterer vertens rot på `/host` og dens `/proc` på `/host/proc`, begge skrivebeskyttet, og legger ikke til noen rettigheter. Et cluster som håndhever den begrensede Pod Security-profilen avviser en hostPath, og der setter du `opcuaServer.dashboard.boxHealth.enabled: false` for ingen enhet og ingen monteringer, eller `opcuaServer.dashboard.boxHealth.hostMount: false` for å beholde enheten, med disk- og CPU-avlesningen merket som dårlig og med beskjed om hva som må monteres. [OPC UA-serveren](/nb/edge/opc-ua-server/#maskinhelse-for-embernet-dashbordet) har resten.

**Sparkplug-publisering** er `edgePublish.enabled: true`, der `edgePublish.broker` og `edgePublish.group` er påkrevd. Sett også `edgePublish.node`, ellers er node-ID-en releasenavnet. Videresendingskøen ligger på et volum på 1 Gi, `edgePublish.queueMaxBytes` er 64 MiB som standard (omtrent 248 000 målinger: omtrent to minutter ved 2 000 målinger i sekundet, ved omtrent 240 byte per måling), og utover det forkastes de eldste målingene og telles. `0` er ubegrenset, og et langt nok avbrudd fyller da volumet. Edge-publisering krever `replicaCount` 1, og chartet nekter å rendre ellers. [Edge-publisering og lagring og videresending](/nb/edge/edge-publish/) forklarer hva den gjør når opplinken dør.

### Hva du bør sette før et ekte anlegg ser det

| Verdi | Standard | Hvorfor du endrer den |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, tom | Hva anlegget heter på skjermer, i sider og for andre lokasjoner. |
| `global.timezone` | `America/New_York` | Tidsplaner og skiftbytter går etter den. Den må være et ekte sonenavn. |
| `publicUrl` | tom | Adressen en telefon på anleggets Wi-Fi når HotLoop på. Uten den har varsler ingen lenke tilbake. |
| `safety.allowWrites` | `false` | Hovedbryteren. Av, skriver ingenting til en maskin, fra noe sted. |
| `historian.retentionDays` | `90` | Antall dager med historikk som beholdes. |
| `database.postgresql.persistence.size` | `20Gi` | Her bor historikken din. Dimensjoner den etter antall tags og oppbevaringen over. |
| `opcuaClient.persistence.enabled` | `false` | Slå den på før du legger til en sikret OPC UA-enhet, slik at klientens sertifikater overlever en omstart. |
| `secretKey.existingSecret` | tom | En Secret du styrer selv, med nøkkelen til enhetspassordene. Sett den hvis du rendrer chartet med `helm template`. |

## Podman Quadlet

Quadlet gjør containerne om til ekte systemd-tjenester: de starter ved oppstart uten at noen er innlogget, starter på nytt når de dør og logger til journalen. Det krever **Podman 5.0 eller nyere**. Raspberry Pi OS Bookworm leveres med 4.3, som ikke har Quadlet i det hele tatt, så en Pi trenger Trixie eller nyere. Legg databasevolumet på en USB-SSD og ikke på SD-kortet.

Enhetene ligger i `edge/`-mappen i HotLoop-repositoryet, under `deploy/quadlet/`, og har de samme navnene som IoT og Gateway sine. [Podman Quadlet](/nb/install/quadlet/) forklarer hver fil.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-edge:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-edge:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Åpne så `http://<this box>:8080` og logg inn som `admin`. Ta vare på en kopi av nøkkelen et sted som ikke er denne boksen, for å miste den betyr å skrive inn hvert enhetspassord på nytt.

Enheten publiserer bare port 8080. Når du slår på OPC UA-serveren (4840) eller den innebygde MQTT-brokeren (1883), legger du til en `PublishPort=`-linje for den i `hotloop.container`. Quadlet-enheten beholder 90 dagers historikk som standard, akkurat som chartet.

Vil du ha vanlig PostgreSQL på Edge? Det er TimescaleDB-enheten med `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` lagt til i `hotloop.container`. Vil du ha en SQLite-fil? Bruk filene i `edge/sqlite/` og ingenting fra mappen over, fordi de deler enhetsnavn: det er `hotloop.container` og `hotloop-data.volume`, og to secrets, `hotloop-secret-key` og `hotloop-admin-password-hash`.

Enheten følger `:stable`, og Podman flytter den når tidsuret er på:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Et nytt image migrerer databasen på vei opp, og hvis det ikke kan starte, setter Podman det forrige tilbake. Databasecontaineren følger bevisst ikke `:stable`. [Den automatiske oppdateringen av :stable](/nb/install/auto-update/) forklarer hva en oppdatering gjør, hva en tilbakerulling ikke kan angre, og hvordan du holder oppdateringer tilbake til du sier fra. Ta en sikkerhetskopi før du slår på oppdateringer.

## Gå opp til et større produkt

Fra IoT til Edge til Gateway beholdes hver enhet, tag, entitet, automasjon, alarm, bruker og time med historikk. På Quadlet er det å kopiere `hotloop.container` og `hotloop-db.container` fra det største produktet over dine, og [produktoversikten](/nb/products/) har Helm-formen. Overgangen er kjørt på Quadlet, IoT så Edge så Gateway på ett databasevolum, og som en `helm upgrade` på et ekte cluster. Å gå ned igjen til et mindre produkt er ikke en overgang å gjøre på en boks du bryr deg om, så ta en sikkerhetskopi først.

## Hvor langt den er kjørt

Edge sine Quadlet-enheter er kjørt under systemd, uten root, inkludert en oppdatering som migrerer, ikke får startet og rulles tilbake. En ekte Pi under systemd som root og de 32-bits arm-imagene er kjørt på ekte maskinvare, på bare metal (2026-11-17).

## Lisens

HotLoop Edge er under HotLoop Source License Agreement 1.0. Det er gratis og har åpen kildekode å se på, men er ikke åpen kildekode i OSI sin forstand. Bruk hjemme og i laboratorium er gratis, og det samme gjelder skoler, ideelle organisasjoner og offentlige organer for deres egen drift. Se [lisenssiden](/nb/license/) og [Bruke HotLoop i en bedrift](/nb/business/).
