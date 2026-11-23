---
title: "Edge Publish og lagre og videresende"
description: "Publiser alt en enhet leser til en sentral Gateway som en Sparkplug B-kantnode, bufre på disk når forbindelsen faller og spill av i riktig rekkefølge."
---

Edge Publish gjør HotLoop til en Sparkplug B-**kantnode** fra 4.5.0, som publiserer alt den leser til en sentral Gateway over MQTT, i motsatt retning av den eksisterende MQTT-driveren, som bruker Sparkplug som primærvert. Dette er hva det betyr å kjøre den.

Slått på kjører den i samme Gateway-prosess, fortsatt koblet til TimescaleDB, noe som er nyttig når et anlegg vil ha hele Gateways grensesnitt og historikk lokalt og i tillegg en opplenke til en sentral. Flåtestyring for mange Edge Relay kom i 4.7.0 (sporing, fra deres births og deaths) og 4.8.0 (konfigurasjonspush); se siden om flåtestyring.

## Slå den på

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Hver avlesning som når tagg-bussen (den samme strømmen som det levende grensesnittet og alarmevalueringen leser) publiseres som Sparkplug B `NDATA`. Så lenge megleren er tilgjengelig og bekrefter, skjer det rett fra minnet og disken berøres ikke. Når megleren slutter å bekrefte, går avlesningene til videresendingskøen på disk og kommer ut av den, i rekkefølge, når den er tilbake.

## Hva den faktisk gjør

**Abonnert før den fødes.** Ved hver tilkobling, den første og hver gjentilkobling, abonnerer noden på sitt `NCMD`-emne (og sitt emne for konfigurasjonspush) og venter til megleren har bekreftet begge før den publiserer noe. Sparkplug B 3.0 krever dette ("Før en NBIRTH-melding sendes, må MQTT-klienten knyttet til kantnoden abonnere for å motta NCMD-meldinger"), og det med god grunn: En vert har lov til å svare på en birth med en umiddelbar rebirth- eller omstartsforespørsel, og en node som sender birth først kan gå glipp av den. `Start()` returnerer ikke før abonnementene er på plass. Hvis megleren avviser ett (en ACL som ikke lar denne noden lese sitt eget `NCMD`-emne), feiler `Start()` med en feil som sier det; en node ingen kan styre bør ikke starte opp og late som noe annet. En gjentilkobling som ikke kan abonnere på nytt sender ikke birth i den sesjonen; avlesningene går fortsatt til videresendingskøen.

**En megler som ikke er der stopper ikke oppstarten.** Avvist er et konfigurasjonsproblem og får `Start()` til å feile. Utilgjengelig er et avbrudd: `Start()` logger det og returnerer, og noden fortsetter å prøve i bakgrunnen (ett sekund, doblet opp til ett minutt) mens hver avlesning går til videresendingskøen. Tidligere feilet den også i dette tilfellet, og Gateway og Edge avslutter når Edge Publish ikke starter, så en boks som ble startet på nytt under et WAN-avbrudd gikk i krasjløkke, uten skjermer, uten alarmer, uten automatiseringer og uten noe bufret før WAN kom tilbake.

**Én NBIRTH per tilkobling.** Hver kjente tagg, kunngjort med navn og et stabilt alias, og dens nåværende verdi. En birth skjer ved første tilkobling, ved hver gjentilkobling (en Sparkplug-sesjon begynner på nytt, og sekvensnummereringen har ingen mening på tvers av en gjentilkobling), når en tagg ingen har sett før dukker opp i en gruppe, og på forespørsel, se nedenfor.

**NDATA for alt etterpå**, bare med alias, uten navn. `seq` starter på 0 med birth og øker (mod 256) med hver melding til neste.

**NDEATH** på to måter: ryddig ved `Stop()`, og via MQTT-tilkoblingens egen last-will hvis prosessen dør uten å få sjansen. Begge bærer samme `bdSeq`-verdi, som svarer til birth de avslutter. En vert skiller et gammelt dødssertifikat, igjen fra en tidligere sesjon, fra det nåværende ved dette nummeret.

**`bdSeq` teller sesjoner, og tellingen overlever en omstart.** Hver MQTT CONNECT får neste nummer: 0 ved en køs første sesjon, én mer hver gang, tilbake til 0 etter 255 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment: `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), og NBIRTH på den tilkoblingen bærer samme nummer som willen den registrerte (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Det ligger i videresendingskøens fil, slik at en node som startes på nytt fortsetter å telle i stedet for å begynne på 1 igjen og gi verten en will den allerede har sett, som en vert har rett til å ignorere som utdatert. En gjentilkobling er en ny sesjon, så den får også et nytt nummer; den gamle koden beholdt ett i hele prosessens levetid fordi MQTT-klientbiblioteket gjenbruker willen det ble opprettet med, og noden bygger nå en ny klient, og dermed en ny will, for hvert tilkoblingsforsøk. Metrikken er INT64, slik spesifikasjonen ber om (den gikk ut som UInt64 før; verdien ligger i samme felt, så en vert som leser den etter verdi merker det ikke).

**`NCMD` → `Node Control/Rebirth`.** En vert som ber om en rebirth får en fersk NBIRTH, med samme `bdSeq`. En rebirth er ikke en ny sesjon, så den får ikke et nytt nummer (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Når opplenken er nede

**Disken er for avbrudd, ikke for hver spørring.** Mens opplenken er oppe og megleren bekrefter, ligger avlesningene bare i minnet til tømmeren har sendt dem og megleren har bekreftet dem, og ingenting skrives til disk. I det øyeblikket det ikke finnes noen sesjon, en bekreftelse uteblir, eller minnet ville passere 100 000 avlesninger, går alt i minnet til diskkøen i rekkefølge, alt etter det havner bak, og tømmeren leser fra disken, eldst først, og tar en avlesning av først når megleren har bekreftet den. Noden går tilbake til minnet bare når disken er tom, så det finnes aldri et øyeblikk der nyere avlesninger kan passere eldre.

Vi bygde dette to ganger, og den første versjonen var feil for maskinvaren. Den skrev hver avlesning til disk før den ble sendt, så et brutalt avbrudd mistet ingenting noden hadde godtatt. Men den skrev også omtrent 5 MB i sekundet ved 2 000 avlesninger i sekundet, som er 450 GB om dagen, fra omtrent 160 kø-commits i sekundet med åtte sider hver. Det dreper et SD-kort og er et latterlig slitasjenivå for alt flashminne. Diskkostnaden i jevn drift er nå null (tallene står nedenfor), og det vi ga opp for det er sagt rett ut i neste avsnitt.

**Et hardt drap mens opplenken er oppe mister det som lå i minnet.** Et SIGKILL, et strømbrudd eller en kernel panic, mens forbindelsen er oppe og megleren bekrefter, tar de avlesningene som ennå ikke var bekreftet. Det er omtrent én spørring: ved 2 000 avlesninger i sekundet og en bekreftelsesrundtur på noen få millisekunder, noen hundre avlesninger på det meste, og like mange spørringer som verten ville ha sett et øyeblikk senere. De telles ikke som forkastet, fordi ingenting vet at de fantes. Et ryddig stopp (`Stop`, et SIGTERM, en omstart) skriver det som er i minnet til disk først og mister ingenting. En kuttet forbindelse mister heller ingenting uansett, fordi det første noden gjør når forbindelsen slutter å bekrefte er å flytte minnet til disk. Det ene tilfellet denne utformingen ikke dekker er at prosessen dør mens forbindelsen er oppe, og det er ikke dekket med vilje.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` begrenser avbruddskøen, og standarden er 64 MiB, omtrent to minutter avbrudd ved 2 000 avlesninger i sekundet (testriggen nedenfor kjører den der: omtrent 248 000 avlesninger får plass, målt i 4.21.1). Utover det går de eldste avlesningene først og telles. Sett den til 0, og køen er ubegrenset: Prosessen advarer om det ved oppstart, fordi et svært langt avbrudd på en ubegrenset kø fyller volumet i stedet for å forkaste gamle avlesninger slik historianens egen kø i minnet allerede gjør.

En avlesning tømmeren henter ut innen et par sekunder etter at den ble satt i kø, går ut som taggens nåværende verdi, i én `NDATA` sammen med resten av spørringen. En som ventet lenger, eller som ble etterlatt av en prosess som døde, går ut merket `is_historical`, slik at en vert ikke lar den overskrive det taggen gjør nå. Ved gjentilkobling tømmes køen **før** noe nyere publiseres, eldst først, fordi det bare finnes én vei ut.

En avspilling er pakket: opptil 200 historiske avlesninger deler én `NDATA`, og hver metrikk bærer sitt eget tidsstempel og `is_historical`. Spesifikasjonen tillater det ("Flere verdiendringer for samme metrikk KAN inkluderes i samme Sparkplug NDATA-melding ... så lenge de har ulike tidsstempler", Sparkplug B 3.0, Operational Behavior, Data Publish), så en melding inneholder aldri én tagg to ganger i samme millisekund og begynner neste melding. Vi pakket dem fordi én avlesning per melding var flaskehalsen, og profileringen sa det: 57 % av avspillingens CPU var write-systemkallet MQTT-klientbiblioteket gjør én gang per pakke, og 200 000 køede avlesninger tok 58,5 sekunder, 3 418 i sekundet, mot et anlegg som produserer 2 000 i sekundet. En avspilling som er tregere enn anlegget er et etterslep som aldri tar slutt. Pakket tar de samme 200 000 avlesningene 2,9 sekunder, 68 237 i sekundet, målt mens noden fortsatt var på QoS 1. Levende avlesninger går fortsatt ut som én spørring per `NDATA`.

**QoS 0, slik spesifikasjonen sier, og en rundtur for å vite at det kom frem.** NBIRTH og NDATA går ut med QoS 0 og uten retained (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). NDEATH-willen er QoS 1 og uten retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), og det samme er den ryddige NDEATH som `Stop` publiserer. Haken med QoS 0 er at det ikke finnes noen kvittering: En publisering "fullføres" når bytene når den lokale socketen, og det fungerer fint inn i en død forbindelse, så å behandle det som levering ville tatt avlesninger av disken akkurat når de betyr noe. I stedet sender noden en forespørsel bak hver bit (en SUBSCRIBE til sitt eget NCMD-emne, som den uansett må ha lov til) og beholder biten til megleren svarer på den. En tilkobling er en ordnet bytestrøm, og en megler behandler en klients pakker i den rekkefølgen den leser dem, så svaret betyr at den leste alt før det. Det er forsikringen en PUBACK ga, én rundtur per bit i stedet for én kvittering per melding. En test skriver inn i en stille forbindelse og sjekker at ingenting forlater køen, hverken fra minnet eller disken; uten rundturen gikk alle de 30 avlesningene i den ut.

**En tilkobling som slutter å svare gis opp, den bare ventes ikke ut.** Hvis megleren ikke bekrefter en bit, eller MQTT-klientbiblioteket ikke kan ta imot en melding, lukker noden den tilkoblingen selv og starter en ny sesjon (neste `bdSeq`, ny birth) med alt ubekreftet beholdt (flyttet til disk, hvis det var i minnet). Den må gjøre det, fordi en forbindelse som dør uten en reset tar imot skriving til kjernens sendebuffer er full, og da sitter MQTT-klientbibliotekets ene skrive-goroutine fast i en write. Det er også goroutinen som sender keepalive-PING, så keepalive utløses aldri, og noden sitter i den døde tilkoblingen så lenge avbruddet varer: Et seks minutters testkutt fant at den ikke hadde merket det før forbindelsen kom tilbake. Verre ble det da runden som hadde skrevet våknet på den nye tilkoblingen og fortsatte å sende resten av sin gamle bit før den nye sesjonens NBIRTH, med den gamle sesjonens sekvensnumre. Nå tilhører hver runde sesjonen den startet i og får en feil, ikke ledningen, når den sesjonen er over.

Leveringen er **minst én gang**. En bit megleren tok imot men aldri bekreftet sendes på nytt, som historikk, og et drap mellom leveringen og at noden noterer den gjør det samme. En vert som bruker dette må tåle en duplikat; den må aldri anta at denne køen allerede har fjernet duplikater for den.

### Hva den lover, og tallene bak

- **Nøyaktig rekkefølge.** Hver avlesning av hver tagg når verten i den rekkefølgen den ble lest, levende og avspilt sammen, gjennom et SIGKILL og en omstart.
- **En begrenset fil.** Grensen gjelder køens fil, det som fyller volumet, ikke dataene i den. Køens fil er dataene pluss sideoverskrifter, grensider, en frilisten og vekstmargin; med den gamle grensen (køens egen telling av løvbyte) ble filen dobbelt så stor som dataene. Alt under 1 MiB kjører med 1 MiB, med en advarsel ved oppstart.
- **Ingenting går tapt i et avbrudd.** Så snart forbindelsen slutter å bekrefte, ligger hver avlesning på disken og blir der til megleren har bekreftet den, så hver avlesning kommer tilbake gjennom et avbrudd, en død tilkobling, et ryddig stopp, og et SIGKILL eller strømbrudd midt i avbruddet. Unntaket er det ovenfor: Et hardt drap eller strømbrudd mens forbindelsen er oppe mister omtrent én spørring, avlesningene som fortsatt var i minnet.
- **Høylytte, telte tap utover grensen.** De eldste avlesningene går først, og hver av dem går inn i en tapsteller som ligger i køfilen, slik at en omstart ikke visker ut beviset. Den står i `GET /api/diagnostics` under `edgePublish` (og i relayens `/status` under `uplink`), ved siden av det som ligger i kø, filens størrelse og om en avspilling pågår. Loggen sier det én gang i minuttet mens det skjer, aldri én gang per spørring. Tellingen kan ligge litt foran tapet og aldri bak: Avlesninger verten fikk rett før et brudd, hvis bekreftelse aldri kom, ligger fortsatt på disken når grensen tar dem, og telles selv om verten har dem.
- **En avlesning som bare er spurt kan gå tapt ved et hardt drap mens forbindelsen er oppe.** Mellom at driveren overleverer en avlesning og at megleren bekrefter den, finnes den bare i prosessen, og et SIGKILL eller strømbrudd tar den. Det er prisen for ikke å skrive hver spørring til disk, og vi valgte det fremfor 450 GB om dagen. Drep den når ingenting er underveis, og svaret er nøyaktig: Hver avlesning anlegget ga fra seg ble levert eller telt.

Alt dette er målt med en ekte HotLoop Edge som spør 20 HTTP-enheter med 25 tagger hver hvert 250 ms (2000 avlesninger i sekundet), og publiserer til en ekte Mosquitto. Hver enhet svarer på hver spørring med en teller som er én høyere enn forrige, så en dommer på vertssiden vet nøyaktig hvilken avlesning som manglet, hvilken som kom tilbake to ganger og hvilken som kom i feil rekkefølge. Opplenken kuttes ved å trekke megleren av nettverket: Edges socket blir stille, uten reset, uten påhengt. For å drepe med ingenting underveis pauser anlegget noen sekunder før SIGKILL ("quiesced"); de andre drapene lander der spørringen tilfeldigvis er ("instant"). Kjøringene 2026-10-12, med en grense på 64 MiB. "Before" er `15419f1`, bygget før dette arbeidet. "Write-ahead" er `165411f`, som skrev hver avlesning til disk først og som vi tok ut igjen. "Now" er minne mens forbindelsen er oppe og disk under et avbrudd:

| <span class="sr-only">Details</span> | Før | Skriv først | Nå |
|---|---|---|---|
| Jevn drift, opplenke oppe, 2 000 readings/s | 2 018 readings/s, 0 bytes/s til disk, 9 % av en CPU | 2 031 readings/s, 5,4 MB/s til disk (450 GB om dagen), 14 % av en CPU | 10 minutter: 2 002 readings/s, 0 bytes skrevet til disk (0 bytes om dagen), 0 sider skrevet i det innebygde kølageret, køfil på 32 768 bytes før og etter, 9 % av en CPU |
| Avspilling av et 5 minutters avbrudd, mens avlesninger fortsatt kommer inn med 2 000 readings/s | 829 745 avlesninger på 4 m 11 s, 3 308 i sekundet | 194 247 til 308 582 i sekundet | 244 335 avlesninger på 824 ms, 296 523 i sekundet |
| Regnskap etter et 5 minutters avbrudd | tapt 441 255, telt 441 255 | tapt 474 978, telt 474 978 | tapt 599 165, telt 599 165, alle de eldste, alle fra grensen |
| Rekkefølge, alias, sekvenshull, levende inni en avspilling | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL med ingenting underveis, opplenke oppe | tapt 0 | tapt 0 | tapt 0 |
| SIGKILL med ingenting underveis 90 s inn i et stille 5 minutters kutt, utover grensen | ikke kjørt | tapt 528 167, telt 528 667 | tapt 520 661, telt 521 161 (de 500 ekstra ble levert, aldri bekreftet) |
| Ti øyeblikkelige SIGKILL, opplenke oppe | tapt 0 (en tidligere kjøring: 50 av fire) | tapt 0 (en tidligere kjøring: 250) | tapt 0 i denne kjøringen; et drap kan ta omtrent én spørring, se ovenfor |

Kostnaden står i den første raden. Skriv-først gjorde omtrent 160 commits i sekundet (én per spørring for å få det på disk, én per bit for å ta det av) med omtrent åtte 4 KB-sider hver, som er 5 MB/s og 450 GB om dagen, og et SD-kort overlever ikke det. I jevn drift skriver noden nå slett ikke til køen: Edges `write_bytes`-teller i `/proc` rørte seg ikke på ti minutter. De ti øyeblikkelige drapene mistet ingenting i den kjøringen, og det er flaks, ikke et løfte: Vinduet er avlesningene i minnet når prosessen dør, omtrent én spørring.

Et tidligere bygg fant den andre halvparten av det dette arbeidet var til for: QoS 0 og en tilkobling som slutter å svare. Se "En tilkobling som slutter å svare gis opp" ovenfor. Fem minutters kuttet før den rettelsen lot noden sitte i en død tilkobling hele avbruddet og så sende en utdatert bit foran den nye sesjonens birth; 100 avlesninger kom i feil rekkefølge.

Et tidligere bygg fant den andre halvparten av det dette arbeidet var til for: QoS 0 og en tilkobling som slutter å svare. Se "En tilkobling som slutter å svare gis opp" ovenfor. Fem minutters kuttet før den rettelsen lot noden sitte i en død tilkobling hele avbruddet og så sende en utdatert bit foran den nye sesjonens birth; 100 avlesninger kom i feil rekkefølge.

Ved den belastningen rommer en kø på 64 MiB omtrent to minutter avbrudd: omtrent 248 000 avlesninger, som er omtrent 236 byte per avlesning med tagg-navn på ni tegn (målt i 4.21.1, køfil 61,7 MB), og et lengre tagg-navn koster mer. Dimensjoner grensen ut fra din egen rate og dine egne tagg-navn. Radene fra 2026-10-12 ovenfor stemmer: 5 minutters avbruddet spilte av 244 335 avlesninger, som er de samme to minuttene. Avspillingen er ikke lenger en begrensning: Den kjører med over hundre ganger raten avlesningene kommer inn med.

Dommeren pleide å rapportere 4 000 til 6 000 duplikater i en kjøring uten avbrudd. Vi fanget trafikken for å finne ut hvem sine de var: Hver eneste var en NBIRTH som gjentok den siste verdien til en tagg en tidligere melding allerede hadde båret, med avlesningens eget tidsstempel, og ikke én var en NDATA sendt to ganger. En birth må bære den nåværende verdien til hver metrikk noden har (det er det en birth er til for), og noden sender birth på nytt hver gang en ny tagg dukker opp, så senere births gjentar tidligere. Utgiveren hadde rett og dommeren tok feil. Den teller nå disse separat som øyeblikksbilder og beholder "duplikat" for en avlesning som er publisert på nytt som data, den eneste typen en vert kan ta for ny. I den jevne kjøringen og kjøringen med ti drap er mottatt nå nøyaktig lik overlevert: 1 296 275 og 916 350.

## Hva som er verifisert og hva som ikke er det

HotLoop er kjørt mot ekte utstyr og ekte servere, og på ekte maskinvare 2026-11-17.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | Funksjonen er av til dette settes |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | ikke aktuelt | Bare vert, `host:port`, eller en full URL |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | ikke aktuelt | Sparkplug-gruppe-ID |
| `HOTLOOP_EDGE_PUBLISH_NODE` | Pod-vertsnavn | Sparkplug-node-ID |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | ikke aktuelt | Legitimasjon for megleren |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | Velges per utrulling; sett aldri dette som standard |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | Videresendingskøens fil |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | Køfilen vokser aldri utover dette; de eldste avlesningene fjernes, og telles, for å holde seg under. `0` er ubegrenset, med en advarsel. Alt annet under 1 MiB kjører med 1 MiB, med en advarsel |

## I Helm-chartet

Gateway-chartet har en `edgePublish:`-blokk som setter alt dette. Den er av som standard, og av gir den nøyaktig det chartet ga før blokken fantes. Sett ikke disse via `extraEnv` lenger.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

Noen få ting bestemmer chartet for deg:

- Køfilen er `/data/edge-publish/forward.db`, på sin egen PVC. Det er ikke en verdi, fordi alle andre steder i poden er rotfilsystemet skrivebeskyttet. Med `persistence.enabled: false` havner den på en emptyDir, som beholder et avbrudds avlesninger gjennom en container-omstart, men ikke gjennom en pod som flyttes.
- Node-ID-en er som standard release-navnet, ikke pod-vertsnavnet. En Deployment-pod får nytt vertsnavn ved hver utrulling, og verten ville sett en ny kantnode hver gang, med de bufrede avlesningene avspilt under den.
- Deployment bytter til `Recreate`, og `replicaCount` må være 1. Køfilen tar en lås: Under en rullerende oppdatering kan den nye poden ikke åpne den, blir aldri klar, og utrullingen henger. Og to replikaer ville vært to utgivere på én node-ID.

Edge Relay-chartet (`charts/hotloop-edge-relay`) har sin egen `edgePublish:`-blokk etter samme mønster, uten `enabled`: Relayen publiserer alltid.
