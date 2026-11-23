---
title: "Den innebygde MQTT-brokeren"
description: "En broker i samme prosess, slik at én liten boks kan være hele installasjonen, med lyttere, kontoer og innstillingene som slår den på."
---

HotLoop kan kjøre sin egen MQTT-broker i prosessen, siden 4.11.0, så en liten HotLoop-installasjon på én maskin har ingenting ekstra å deploye. På som standard (`HOTLOOP_BROKER_ENABLED`), i binærfilen og i Helm-chartet. Den lytter på :1883; hvis den porten er tatt av en annen broker på maskinen, hviler den innebygde brokeren og sier det i loggen, og HotLoop starter (sett `HOTLOOP_BROKER_LISTEN_ADDR` til en ledig adresse, eller slå den av). En port du har valgt som ikke kan bindes er fortsatt en feil: en utrulling som allerede kjører Mosquitto eller EMQX har ingenting å peke dette på, og å starte en ny broker ved siden av en som allerede finnes er ikke en trygg standard å gjette seg til.

## Hvorfor den finnes

Edge-publisering (Gateway som en Sparkplug edge-node) og flåtestyring (sporing av registrerte edge-releer) kobler seg begge *utover* til en MQTT-broker via `BrokerAddress`, og har aldri kjørt en selv. Det er greit når en installasjon allerede har en broker, enten det er en eksisterende Mosquitto-instans eller en som kjører ved siden av HotLoop av andre grunner. Det er ikke greit som *eneste* alternativ: dette prosjektet finnes for å kutte antall bevegelige deler et anlegg er avhengig av, og å kreve en ekstra infrastrukturdel bare for å få en Sparkplug-hub for én Gateway ville være å sette en bevegelig del tilbake gjennom bakdøren.

Med `HOTLOOP_BROKER_ENABLED=true` lytter den samme prosessen etter MQTT-tilkoblinger på sin egen adresse. Edge-publisering, flåtestyring eller `HOTLOOP_EDGE_PUBLISH_BROKER` til en ekstern edge-relé kan alle pekes mot `localhost:1883` (i klyngen, Gatewayens egen Service-adresse).

## Når du bruker den, og når ikke

**Bruk den** til én Gateway, en håndfull edge-releer og trafikkmengder en innebygd broker, som deler prosess med historianen, alarmmotoren og HTTP-API-et, enkelt kan ta unna, det vanlige tilfellet hele dette prosjektet er rettet mot: ett anlegg, én boks, minimal infrastruktur.

**Ikke bruk den** som erstatning for en produksjonsbroker i reell skala: flere uavhengige Sparkplug-vertsapplikasjoner, svært høy fan-out, brobygging mellom lokasjoner, eller belastninger som trenger klynging, horisontal skalering eller en brokers egne dedikerte driftsverktøy (detaljerte målinger, dynamiske ACL-er, plugin-økosystemer) er alle reelle grunner til å kjøre Mosquitto, EMQX eller en annen dedikert broker, og til å peke Gatewayens egne `EdgePublishConfig`/`FleetConfig` mot den slik enhver annen installasjon allerede kan. Denne pakken konkurrerer ikke med den bruken; den finnes for installasjonene som ellers ikke ville hatt noen broker i det hele tatt.

## Innlogginger, og hva hver av dem kan røre

Tre typer innlogginger slipper inn, og de er ikke like.

**Innlogginger laget i HotLoop** (Settings, MQTT, eller `/api/broker/logins` i [HTTP-API-et](/nb/iot/api/)) har regler: topicene innloggingen kan publisere til og topicene den kan abonnere på. `%u` i en regel er innloggingens eget navn og `%p` oppdagelsesprefikset. De starter fra en profil og kan redigeres av deg etterpå:

| Profil | Publiser | Abonner | For |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | en Shelly Gen2 eller nyere, innlogging oppkalt etter MQTT-topicprefikset |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | en ESPHome-node, innlogging oppkalt etter noden |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | en Tasmota-enhet, innlogging oppkalt etter topicen |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | en Zigbee2MQTT-bro, innlogging oppkalt etter basetopicen |
| `integration` | ingenting | `#` | et dashbord, en historian, du med MQTT Explorer |
| `full` | `#` | `#` | hva som helst, hele anlegget |

Navngi en Shellys innlogging etter topicprefikset, så kan den melde seg selv og rapportere som seg selv, og det er alt. Den kan ikke publisere til `cmnd/boiler/POWER`, den kan ikke annonsere en enhet i andres navn, og den kan ikke abonnere på `#` og lese anlegget. Brokeren sjekker hver publisering, hvert abonnement og hver melding på vei ut til en abonnent, så en regel kan ikke strekkes med et smart jokertegn. Et last will sjekkes også, når klienten kobler til: broker-biblioteket publiserer wills uten å spørre noen, så en innlogging hvis will peker et sted den ikke kan publisere, slipper ikke inn. Ellers kunne en billig plugg etterlate en retained `ON` på kjelen og trekke ut sin egen støpsel.

En endring i en innlogging gjelder fra den klientens neste pakke. Snevre inn en innlogging, og den tilkoblede enheten mister topicene med en gang; slett en, og klienten som fortsatt henger på, kan ikke gjøre noe som helst og kan ikke koble til igjen. Passord er bcrypt-hasher i `broker_logins`, som er i hver sikkerhetskopi; API-et svarer aldri med noen av delene.

Zigbee2MQTT er den spesielle: én bro annonserer hver enhet på radioen sin, så profilen kan publisere hvor som helst under prefikset. Det er broens jobb, og det er grunnen til at Discovered-skjermen viser hvem som annonserte hva.

**`HOTLOOP_BROKER_USERS`** er den gamle listen med `user:password`-par (bare det første kolonet deler, så et passord kan inneholde ett). Disse kan gjøre hva som helst, på alle topicer, akkurat som i 4.16 og 4.17. Det er med vilje: ingen oppgraderer inn i et anlegg der Sparkplug-trafikken plutselig preller mot en ACL de aldri har skrevet. Det betyr også at hver av disse innloggingene er en nøkkel til hele anlegget. Flytt enheter til innlogginger laget i HotLoop, og behold miljøvariabel-innloggingene for det som virkelig trenger alt: flåten, en edge-relé, edge-publisereren. Sjekkes i konstant tid; et brukernavn med feil passord avvises.

**Anonym** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, standard `false`) er hva som helst, for alle som kan nå porten. Det er et valg per installasjon for et pålitelig LAN eller en testrigg, aldri noe denne prosessen avgjør er greit på egen hånd, og Discovered-skjermen sier det i rødt mens det er på. Det løsner ingenting for en klient som sender et brukernavn: et feil passord er fortsatt et feil passord.

En broker uten `HOTLOOP_BROKER_USERS` og med anonym av starter helt fint. Til noen lager en innlogging i HotLoop, er HotLoop det eneste som kan koble til.

Andre brokere er deres egen sak. På Mosquitto eller EMQX er det den brokeren som håndhever ACL-ene, samme grense som [flåtestyring](/nb/gateway/fleet/) trekker, og [MQTT-oppdagelse](/nb/iot/mqtt-discovery/) har en ACL for HotLoops egen innlogging der.

## Oppdagelse, og HotLoops egen innlogging

Med brokeren på lytter HotLoop på den etter enheter som melder seg selv (se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/)). Brokeren noterer hvilken innlogging og hvilken klient som publiserte hver oppdagelseskonfigurasjon. Discovered-skjermen viser det, og en enhet som er godtatt fra én innlogging og så annonseres av en annen, holdes tilbake for en person, med en advarsel i loggen ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). Enten har noen flyttet enheten til en ny innlogging, eller en innlogging utgir seg for å være en enhet den ikke er. En person avgjør hvilket.

HotLoops egen klient på denne brokeren (oppdagelseslytteren og driverne til oppdagede enheter) logger inn med en innlogging brokeren lager ved hver oppstart og bare holder i minnet. Den kan gjøre hva som helst. Det er ikke noe å konfigurere for den, ingenting på disk og ingenting i en sikkerhetskopi; det er en ny etter hver omstart.

## TLS

En vanlig TCP-lytter (`HOTLOOP_BROKER_LISTEN_ADDR`, standard `:1883`) er alltid tilgjengelig så snart brokeren er aktivert. Å sette `HOTLOOP_BROKER_TLS_ENABLED=true` med `HOTLOOP_BROKER_TLS_CERT_FILE` og `HOTLOOP_BROKER_TLS_KEY_FILE` legger til en andre, uavhengig lytter (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, standard `:8883`) avsluttet med det sertifikatet. Begge lytterne kjører samtidig når TLS er aktivert, ingenting stenger den ukrypterte, så en operatør som vil ha kun TLS-tilgang, håndhever det i nettverkslaget (en NetworkPolicy, en brannmurregel), på samme måte som dette chartet allerede overlater bredere beslutninger om nettverkseksponering til `networkPolicy.ingress` i stedet for at applikasjonen selv avgjør hvilke av portene sine som kan nås.

I motsetning til SMTP-kanalens STARTTLS-oppgradering i selve forbindelsen er brokerens TLS-lytter en andre, separat socket, samme form som Mosquitto, EMQX og de fleste MQTT-brokere bruker for en ukryptert port ved siden av en TLS-port, og den mest naturlige for MQTT, som (i motsetning til SMTP) ikke har en bredt implementert oppgradering i forbindelsen.

Denne pakken genererer ikke et eget sertifikat, selvsignert eller på annen måte, for ingenting videre nedstrøms ville ende opp med å stole på et den fant på, så et ekte sertifikat (fra en intern CA, `cert-manager` eller en hvilken som helst annen kilde) er alltid operatørens å skaffe.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | Funksjonen er av til dette settes |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | Den ukrypterte TCP-lytteren |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Legger til en andre, uavhengig TLS-lytter |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Brukes bare når TLS er aktivert |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Påkrevd når TLS er aktivert |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Valg per installasjon; sett aldri dette som standard |
| `HOTLOOP_BROKER_USERS` | ingen | `user:password,user2:password2`. Hver kan gjøre hva som helst; se over. Innlogginger med regler lages i HotLoop |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Lytt etter enheter som melder seg selv; se [MQTT-oppdagelse](/nb/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Topicprefikset annonseringene kommer under |

## Hva som er verifisert og hva som ikke er det

HotLoop er kjørt mot ekte utstyr og ekte servere, og på ekte maskinvare 2026-11-17.
