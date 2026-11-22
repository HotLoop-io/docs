---
title: "Ta med Node-RED-flytene dine"
description: "Importer en flows.json fra Node-RED uendret, se hva hver node blir til, og hva Flow nekter å kjøre og hvorfor."
---

Flow leser v1-formatet til Node-REDs `flows.json`, den flate JSON-tabellen som hver Node-RED-eksport og hver oppføring i flytbiblioteket er skrevet i. Pek den på filen din, så kjører den.

**Den laster og lagrer byte for byte.** Last en fil, lagre den uten å endre noe, og du får identiske byte tilbake: samme rekkefølge på nøklene, samme mellomrom, ingen escape-tegn som er skrevet om av seg selv. Endrer du én egenskap, er forskjellen én linje og ikke hele noden.

Det er vanskeligere i Go enn det høres ut. Et JavaScript-objekt beholder innsettingsrekkefølgen til nøklene, så en JavaScript-kjøretid får dette gratis fra `JSON.parse` og `JSON.stringify` uten at noen tenker på det. Et Go-map har ingen rekkefølge i det hele tatt, og `encoding/json` sorterer nøklene med vilje. I stedet for å tvinge et rekkefølgebevarende map gjennom hver leseløype i koden, beholdes de opprinnelige bytene for hver oppføring og sendes ut igjen når den tolkede formen er uendret, og kodes ellers på nytt etter den opprinnelige nøkkelrekkefølgen. `json.Compact` og `json.Indent` er transformasjoner på bytenivå, så de endrer innrykk uten å omorganisere noe.

Det har betydning av to grunner, begge kjedelige og begge reelle. Flytfilen din ligger på et volum og i git, og den skal ikke endre seg bare fordi en pod ble startet på nytt. Og når en operatør går gjennom differansen fra en utrulling før den sendes til en linje, skal vedkommende se hva som er endret og absolutt ingenting annet. Den regelen står, selv om tester og typer kommer inn i filen: nye data havner i nøkler som andre verktøy ignorerer, og rundturstesten dekker filer som har dem.

En nodetype som denne versjonen aldri har sett, overlever lasting og lagring med alle egenskaper intakte, så det er trygt å kjøre en flyt her og levere den tilbake etterpå. Node-REDs `flows_cred.json`, som er AES-256-CTR, importeres skrivebeskyttet, og alt som leses slik, krypteres på nytt med GCM ved neste lagring.

**Før du distribuerer noe, spør hva som kommer til å skje:**

```bash
hotloop-flow import flows.json
```

Den rapporterer hver nodetype i filen, også de inne i underflyter, delt i støttet, delvis støttet med mangelen skrevet ut, og ikke støttet. Det indre av en underflyt telles mot den utvidede grafen i stedet for filen, så en instans blir aldri rapportert som «støttet» mens den tier om hva som ligger inni. Det er forskjellen på å finne det ut ved skrivebordet og å finne det ut når en linje stopper.

En node kan også peke på en konfigurasjonsnode som ikke er i filen. Slett en flyt, og dens egen MQTT-broker går med, mens en underflyt som brukte den brokeren fortsetter å peke på en id som ikke navngir noe. En håndredigering eller en halvkopiert eksport gjør det samme. Vi oppdaget det før da første melding traff noden, og nodene som bare slår opp serveren sin sa da ingenting. Nå har importrapporten en seksjon for dette som navngir hver node og id-en den ikke finner, editoren legger de samme linjene i loggen ved lasting, og en utrulling svarer med dem og merker nodene som mislyktes ved oppstart, med egenskapen som har feil id. Resten av flyten kjører videre. En node du har deaktivert, og en TLS-innstilling som er tom eller sier `true` eller `false`, rapporteres ikke, for det er ikke feil.

En id som finnes er ikke det samme som en id som virker. Det overså vi første gang. Peker innstillingen på en fane, en underflyt, en gruppe eller en vanlig node, eller på en konfigurasjonsnode av feil slag, som en TLS-innstilling rettet mot en MQTT-broker, får den samme rapport og samme mislykkede oppstart, og linjen sier hva id-en egentlig er og hvilket slag innstillingen vil ha. Editoren tilbyr bare riktig slag, så dette kommer bare fra en håndredigering eller en innlimt id, som er akkurat der det gjør vondt.

Etter kompatibilitetsnivå er de 108 meldingsnodetypene 12 fulle, 50 delvise, 14 bevisst avvikende og 32 Flows egne. Hver node erklærer hvordan den forholder seg til Node-REDs node med samme navn, og **en test lar bygget feile hvis en node hevder delvis kompatibilitet uten å skrive ned hva som mangler.** En node som er 90 % kompatibel og tier om de siste 10 %, er farligere enn en som åpenbart mangler, fordi den første lar en flyt se ut til å virke. Hele matrisen er [Node-RED-kompatibilitet](/nb/flow/compatibility/), generert fra registeret og ikke vedlikeholdt for hånd, fordi et håndvedlikeholdt kompatibilitetsdokument er en løgn med tidsstempel.

Avvikene er bevisste, og hvert enkelt er skrevet ned der: hver mottaker på en forgrening får sin egen kopi, noden `exec` har en tillatelsesliste og ingen shell, filnodene er avgrenset, og alt som står under [Mottrykk, synlig](/nb/flow/back-pressure/) har et tak.

**De fleste Node-RED-fellesskapsnoder kjører ikke her.** De er npm-pakker som trenger Node.js, og det kommer ingen fremtidig versjon der en pakke som trenger Node plutselig virker. Det er prisen for det lille fotavtrykket og sandkassen, sagt rett ut slik at du kan velge bort. Signerte WASM-programtillegg er Flows svar for det du skriver selv: se [Programtillegg uten npm](/nb/flow/plugins/).

Fellesskapsnodene et anlegg støtter seg på er noe annet. Flow kjører Node-RED-typene for Modbus, dashbord, PostgreSQL og e-post nativt, i Go, under egne typenavn, så en flyt som bruker dem lastes og kjører uendret, og det samme gjør `Buffer` og `setInterval` som funksjonsnodene rundt dem kaller. Hva som kjører, hva som er annerledes og hva som er bevist står i docs/node-red-types.md. Enhver annen fellesskapsnode i en flyt feiler for seg selv med typen navngitt, og resten av flyten starter.

JSONata pleide å toppe listen over hva en importert flyt snubler i. De 13 som ikke virker er festet i en test med årsaken til hver, og ti av dem gir fortsatt en feil, bare med en annen kode. `$moment` er den ene Node-RED-funksjonen du kommer til å savne, og den sier hva du skal bruke i stedet for å feile i stillhet.

Cron-planlagte Inject-noder var neste punkt på listen. De utløses nå, og i samme minutt som Node-REDs ville gjort: crontab leses av en port av cronosjs 1.7.1, planleggeren inne i Node-REDs egen Inject-node, og sjekket mot 22 620 utløsninger som cronosjs selv produserte i seks tidssoner, på begge sider av ekte klokkeendringer. Det har betydning klokken 02 om natten. En skiftstart som havner i timen som forsvinner om våren, kjører i det øyeblikket klokkene hopper, og timen som gjentas om høsten kjører én gang, ikke to. Planen leser også veggklokken på nytt hvert minutt, så en boks som starter med feil tid og får den rettet av NTP senere, begynner å utløse til riktig tid i stedet for timer for sent.

Link Call var den siste av de tre. Den virker nå, sammen med returmodusen til Link Out: én logikk, «slå opp denne batchen», «sjekk denne forriglingen», skrevet én gang på sin egen fane og kalt fra hver linje, med veien tilbake lagret på meldingen som en stakk, så en kalt flyt kan gjøre egne kall. Et kall som aldri kommer tilbake gir en feil etter tidsavbruddet i stedet for å henge. En retur som kommer sent går likevel ut, som i Node-RED. Og en retur uten noe å returnere til er en feil en Catch-node ser, i stedet for advarselen Node-RED logger og ingen leser.
