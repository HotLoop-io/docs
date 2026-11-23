---
title: "Varm standby med lease"
description: "To Flow-installasjoner deler én jobb: et lease i PostgreSQL og en sperre på hver skriving til utstyr, slik at bare én skriver om gangen."
---

To installasjoner av Flow kan dele jobben til én. Den ene er skriveren: den er den eneste som sender noe til utstyr. Den andre er standby: den kjører de samme flytene, leser, abonnerer og holder konteksten sin varm, men holder tilbake all skriving til utstyr til den tar skriverens plass. Hvis skriveren dør, henger seg eller mister forbindelsen, overtar standby på omtrent like lang tid som et lease, og den som var skriver, kan ikke skrive igjen før den har vunnet leaset tilbake.

Dette er for tilfellet der en omstart ikke er rask nok, og en andre skriver er verre enn en kort ventetid. Hvis en omstart er rask nok, er én enkelt installasjon og en Kubernetes-omplanlegging enklere, og det er det chartet gjør som standard.

## Slik fungerer det

Leaset er én rad i en PostgreSQL begge installasjonene kan nå. Skriveren fornyer det hvert par sekunder. Standby prøver å få det i samme takt og får det først etter at det er utløpt. Hver gang innehaveren skifter, øker fencing-nummeret på raden, og Flow rapporterer det.

Hver skriving til utstyr stiller det samme spørsmålet rett før den sendes: har jeg leaset, med mer tid igjen enn en skriving trenger? Hvis ikke, avvises skrivingen med en telt feil som når Catch-noden i flyten, og ingenting sendes, ikke engang en forbindelse. Den sjekken, gjort i øyeblikket for hver skriving, er det som hindrer to installasjoner i å skrive samtidig:

- Innehaveren teller leaset sitt fra det øyeblikket den ba om det, aldri fra det øyeblikket svaret kom tilbake, så den tror aldri at den har lenger tid enn databasen.
- Innehaveren slutter å skrive når den har mindre lease igjen enn en skriving trenger (`writeMargin`), som er før leaset utløper. Standby kan først ta leaset etter at det er utløpt. Det er altså et gap og ingen overlapping.
- En innehaver som fryses og tines, eller kuttes av og kobles til igjen, finner leaset sitt borte, avviser skrivingene sine og ber om leaset som alle andre.
- Databasens klokke avgjør når leaset slutter, så to maskiner med klokker som ikke stemmer, er likevel enige om hvem som har det.

Skrivingene som spør, er de som kan kommandere utstyr: `modbus write`, `s7 write`, `opcua write` og `ethernetip write`, enten direkte eller gjennom HotLoops skriveport, nodene `hotloop script` og `hotloop recipe`, og i et FlowLab-diagram den serielle skrivingen, en instrumentkommando som skriver (sammen med instrumentets egen skrivebryter) og HotLoop-skrivingen. Å sende en melding til en MQTT-megler, en database eller et varsel er ikke sperret: det er ikke en kommando til utstyr, og en gjentakelse er ufarlig der et gjentatt settpunkt kanskje ikke er det. En flytest står i for omverdenen og holdes aldri tilbake.

## Hva det koster og hva det ikke gir deg

- **Overtakelsestiden** er omtrent lengden på leaset. Med standardverdiene (15 sekunders lease, fornyet hvert 5. sekund, 5 sekunders margin) overtok en standby 14,7 sekunder etter at skriveren ble drept. Med 6 sekunders lease, 5,7 sekunder. En skriver som stopper rent, gir fra seg leaset, og standby overtok på 0,35 sekunder.
- **En skriving som tar lengre tid enn `writeMargin`,** kan overleve leaset. Hold protokolltidsavbruddene til nodene som skriver, under den. En skriving som allerede er underveis når en prosess fryses, har allerede passert sjekken og kan fortsatt komme frem.
- **Minst én gang.** En PLS som tok imot en skriving der kvitteringen gikk tapt, kan se at den nye skriveren sender den på nytt. Det er trygt for et settpunkt og ikke for en puls eller en økning, så skriv settpunkter, ikke deltaer.
- **Køer forblir lokale.** Varige ledninger og kontekst ligger på hver installasjons egen disk. Det som sto i kø på en skriver som døde, er ikke hos standby.
- **Databasen er en avhengighet.** En skriver som ikke når den, kan ikke fornye, og slutter å skrive når leaset blir for kort. Legg leaset på en database som er minst like tilgjengelig som utstyret den beskytter.

## Sette det opp

Installer Flow to ganger, som to Helm-utgivelser eller to Quadlet-enheter, hver med sitt eget volum, og pek begge mot det samme leaset. Gi den andre den samme flytfilen som den første, og hold den slik med en sending til stasjoner ([Sending til en tenants stasjoner](/nb/flow/stations/)), fordi Flow ikke kopierer flyter mellom de to.

| Innstilling | Miljø | Hva det er |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | En fil med PostgreSQL-URL-en til lease-databasen. Å sette den slår på failover. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | Leaset. Det samme på begge. Standard `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | Denne installasjonens eget navn. Det må være forskjellig mellom de to, og er som standard vertsnavnet. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | Hvor lenge en tildeling varer, og dermed omtrent overtakelsestiden. Standard `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | Hvor ofte innehaveren spør på nytt. Standard en tredjedel av ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | Hvor mye lease en skriving trenger igjen. Standard `5s`. |

Flow nekter å starte når innstillingene ville få innehaveren til å gå under marginen sin mellom fornyelsene, for eksempel en margin like lang som ttl.

I chartet er disse `failover.urlSecret` (en Secret der nøkkelen inneholder URL-en, montert som en fil og aldri lagt i ConfigMap), `failover.name`, `failover.ttl`, `failover.renewEvery` og `failover.writeMargin`. Med Quadlet er de miljøvariablene ovenfor, og URL-en er en Podman-hemmelighet montert som en fil:

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Se det

- `GET /failover` (og MCP-verktøyet `get_failover`) sier om denne installasjonen er `active`, `standby` eller `lost`, hvem som har leaset, fencing-nummeret den har, og hvor mange skrivinger den har holdt tilbake, etter hva som skrev. Det krever `status.read` og finnes bare når failover er satt opp.
- Editoren viser et banner på en standby og på en innehaver som har mistet leaset sitt.
- Metrikkendepunktet har `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` og `hotloop_flow_failover_refused_total{op}`.
- Begge installasjonene logger når de tar leaset og når det tas fra dem.

## Hva som er bevist, og hva som ikke er det

Bevist på to ekte Flow-prosesser mot en ekte PostgreSQL og en Modbus TCP-server som logger hver skriving, der hver installasjon skrev en merket verdi hvert 200 ms: med skriveren drept midt i strømmen overtok standby etter ett lease, og ingen skriving fra standby kom før skriverens siste skriving eller etter den (0 og 0); med skriveren frosset lenger enn leaset og tint skrev den ikke igjen; med skriveren stoppet rent overtok standby på 0,35 sekunder. En test for hver skrivevei ovenfor viser at skrivingen fra en standby eller en utdatert innehaver avvises før noe sendes, og viser at den samme skrivingen sendes når porten er åpen.

Ikke bevist: oppførselen til en ekte PLS ved en gjentatt skriving, en database-failover under leaset og et nettverk som er kuttet i bare én retning. Modbus-serveren er en simulator som snakker protokollen. Failover er ikke prøvd på en klynge, og chart-verdiene og Quadlet-linjene er rendret og kontrollert, ikke installert. Tekstene i editorbanneret har ikke vært gjennomgått av noen med språket som morsmål.
