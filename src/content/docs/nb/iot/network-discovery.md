---
title: "Nettverksoppdagelse"
description: "HotLoop lytter med mDNS, SSDP og DHCP og viser hva som er på anleggsnettverket, og sender ingenting med mindre du oppgir et nettverk å sondere."
---

HotLoop lytter til anleggsnettverket og forteller deg hva som er på det: ESPHome-noden på gårdsplassen, Shellyen på kompressoren, OPC UA-serveren på linje 3, UPnP-boksen noen koblet til og glemte, tingen som nettopp ba om en adresse. Hver av dem dukker opp under Devices, Discovered, under enhetene som meldte seg over MQTT ([MQTT-oppdagelse](/nb/iot/mqtt-discovery/)), med hva den er og hvordan HotLoop kunne snakke med den.

Så avgjør en person. Ingenting som høres på nettverket blir noen gang lagt til av seg selv, og ingenting blir noen gang armert.

## Lytt, ikke skann

På et OT-nettverk du leser, skanner du ikke. En portskanning har veltet mer enn én PLS som svarte på en pakke den aldri ventet, og «det er bare oppdagelse» er ingen trøst klokken tre om natten. Så som standard sender HotLoop ingenting i det hele tatt:

- **mDNS** (på): enheter kunngjør tjenestene sine når de starter, og hvert svar på noens spørsmål sendes som multicast til hele segmentet. En telefon som åpner en app eller en laptop som leter etter en skriver, spør; HotLoop overhører.
- **SSDP** (på): UPnP-enheter sender `NOTIFY ssdp:alive` som multicast når de kommer på og hvert par minutter etterpå. HotLoop overhører de også.
- **DHCP** (av, se nedenfor): en enhet som kommer på nettverket kringkaster en forespørsel om en adresse med MAC-en sin og vanligvis navnet sitt.

Å spørre er **sondering**, og det slås på per nettverk, av installasjonen, aldri med en knapp:

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | lytt etter mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | lytt etter SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | lytt etter DHCP-forespørsler på UDP 67 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | tom | nettverkene sondering er på for, som CIDR-er: `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | hvor ofte en sondering kjører der |

På et oppført nettverk sender en sondering et mDNS-spørsmål for hver tjenestetype og for de HotLoop kjenner, spør igjen om hver type som dukket opp, sender én SSDP `M-SEARCH` og leser beskrivelsen til hver UPnP-enhet (navn, produsent og modell) fra enheten. På alle andre nettverk sender den ingenting, og knappen Probe now avvises der ingenting er oppført. Oppfør nettverkene du mener: et /8 er 16 millioner adresser, og HotLoop vil spørre på det hvis du ber den om det.

## Hva den kan snakke med

| Hørt | Det er | Når du godtar den |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | en OPC UA-server (OPC 10000-12 vedlegg C: endepunktet er SRV-ens adresse og port pluss TXT-ens `path`) | lager en OPC UA-enhet på det endepunktet, anonym og usikret til å begynne med, uten tags. Bla gjennom den med Discover tags og sett sikkerheten før den bærer noe som betyr noe |
| mDNS `_shelly._tcp`, eller `_http._tcp` med `gen` | en Shelly, Gen2 eller nyere (TXT-ens `gen`, `app` og `ver`) | lager en HTTP-enhet som leser `http://<it>/rpc/Shelly.GetStatus`, Shellys eget statuskall, skrivebeskyttet, uten tags. Discover tags lister hver verdi. En Shelly med innlogging på vil ha digest-autentisering, som HTTP-driveren ikke støtter |
| mDNS `_esphomelib._tcp` | en ESPHome-node (TXT-en: `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | registrerer den som kjent og lager ingenting. HotLoop leser ESPHome over MQTT: gi noden en `mqtt:`-blokk som peker mot HotLoops broker, så melder den seg selv, og kortet sier det (samsvar på MAC) |
| mDNS `_mqtt._tcp` | en MQTT-broker | registrerer den. Legg den til under Settings, MQTT for å høre hva som melder seg på den |
| mDNS `_http._tcp`, alt annet | en nettside, eller en tjeneste HotLoop ikke har ord for | registrerer den |
| SSDP | en UPnP-enhet, etter uuid: enhetstyper, `SERVER` og, med sondering på, beskrivelsen | registrerer den |
| DHCP | en enhet som ber om en adresse: MAC, vertsnavn, leverandørklasse | registrerer den |

«Registrerer den» er fortsatt verdt et klikk. På et anleggsnettverk bør hver boks være en noen kjenner til, og et godtatt funn er en beslutning med navn og tidspunkt på. Neste ukjente ting skiller seg ut.

Et kort sier når to funn er samme boks: en ESPHome-nodes mDNS-MAC og MQTT-kunngjøringen dens, en DHCP-forespørsel og en mDNS-vert på samme adresse.

Å godta armerer ingenting. En enhet som lages ved godkjenning har ingen tags før noen velger dem, og hvert punkt på den er skrivebeskyttet til noen armerer det i tag-editoren, gjennom samme skrive-port som alt annet. Adressen i forslaget kom fra enhetens egen kunngjøring, og godkjenningsdialogen viser den så du kan sjekke at det er boksen du tror det er.

**Ignore** skjuler et funn og holder det skjult når det høres igjen. **Un-ignore** henter det tilbake.

## Alt er upålitelig

Alle som kan legge en pakke på segmentet, kan påstå å være hva som helst. Derfor:

- hver streng klippes og strippes for kontrolltegn, og skjermen legger den på siden som tekst, aldri HTML;
- en UPnP-beskrivelse leses bare fra adressen kunngjøringen kom fra, bare på et sonderingsnettverk, aldri gjennom en omdirigering og aldri mer enn 64 KiB. En forfalsket `NOTIFY` som peker `LOCATION` mot en PLS-ens nettside, eller mot HotLoop selv, får ingenting hentet;
- hver lytter tar 500 datagrammer i sekundet og forkaster og teller resten;
- registeret rommer 1 024 funn. Nye utover det forkastes og telles til noen tar tak i noen, og skjermen sier det;
- et spørsmål på linjen er noens spørsmål, ikke en kunngjøring: de kjente svarene det bærer, er spørsmålsstillerens oppfatninger, og det gjøres ingenting med dem.

## Hvor HotLoop må sitte for å høre noe

Multicast og kringkasting krysser ikke en ruter, en NAT eller et containernettverk. HotLoop hører segmentet den sitter på, og ingenting annet:

- **En boks på anleggsnettverket** (binærfilen, eller Podman med `--network host`): hører alt.
- **Kubernetes med et pod-nettverk**: hører ingenting fra anlegget. Discovered-skjermen viser grensesnittene den lytter på, og slik finner du ut av det. Gi poden `hostNetwork: true`, eller et andre grensesnitt på anleggssegmentet (Multus med macvlan), så hører den anlegget. Chartet gjør ingen av delene for deg: å sette en pod på vertens nettverk er en beslutning om noden, ikke en standard.

mDNS (5353) og SSDP (1900) er vanlige porter over 1024, så de trenger ingen rettigheter. HotLoop deler dem med det som allerede har dem, en avahi-daemon på verten inkludert.

## DHCP

Mulig, ærlig talt, men det trenger to ting en container ikke får som standard, og derfor er det av:

1. **Anleggets kringkastinger.** En DHCP-forespørsel går til 255.255.255.255, så HotLoop må være på segmentet: vertsnettverk eller et grensesnitt på det, som over.
2. **UDP-port 67**, som er under 1024. HotLoops image kjører som uid 65532. Gi enten binærfilen `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), eller sett vertens `net.ipv4.ip_unprivileged_port_start` til 67 eller lavere. I Kubernetes gjør det ikke capabilityen effektiv av seg selv å legge `NET_BIND_SERVICE` til en ikke-root-containers capabilities; fil-capabilityen eller sysctl-en gjør det.

Den trenger aldri en rå socket eller en privilegert container: en vanlig UDP-socket på port 67 mottar kringkastingene. Den svarer aldri, tilbyr aldri en adresse, sender aldri en byte. Den deler porten, så en DHCP-server på samme vert som også deler den, fortsetter å fungere; en som holder porten for seg selv, får HotLoops lytter til å feile, og skjermen sier hvorfor, uten at serveren røres.

Hva den ikke kan se: fornyelser, som går unicast til serveren. HotLoop hører en enhet når den kommer på, ikke hver time etterpå.

## Flere replikaer

Bare replikaen som holder låsen for nettverksoppdagelsen lytter og sonderer; de andre prøver igjen hvert 30. sekund, så en tar over hvis innehaveren forsvinner. To som sonderte, ville spurt hver enhet to ganger.

## Sikkerhetskopier

`net_finds` er i hver sikkerhetskopi: hva som ble hørt, og hvem som godtok eller ignorerte hva. Beslutningene er den delen nettverket aldri sier igjen.

## Hvordan det testes

Oppdagelsen er kjørt på ekte nettverk mot ekte kunngjørere, ESPHome-, Shelly- og OPC UA-noder, en UPnP-mediaserver og DHCP-klienter, og på ekte maskinvare 2026-11-17.
