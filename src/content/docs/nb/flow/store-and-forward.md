---
title: "Lagre og send videre i HotLoop Flow"
description: "Merk en kobling som varig, og meldinger går til disk, i rekkefølge, når noden bak slutter å svare, og de overlever et kill -9."
---

Merk en kobling som varig, og så lenge noden i den andre enden holder følge, er den en vanlig kobling og skriver ingenting til disk. I det øyeblikket noden slutter å ta imot meldinger, renner koblingen over i den samme SQLite-filen før avsenderen går videre, og en pumpe leverer dem eldst først til målet tar hver enkelt, i partier på opptil 256 for et mål som skriver til en database i ett jafs (InfluxDB gjør det), og én om gangen for resten. Så historianen går ned, målingene hoper seg opp på disk i stedet for å blokkere flyten eller bli forkastet, og de går inn, i rekkefølge, når den kommer tilbake. Prisen for å skrive ingenting mens alt er friskt, er at et `kill -9` da mister det som lå i minnet, omtrent én avlesnings verdi, og det sier vi heller her enn at du finner det ut selv.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

Du trenger ikke skrive nøkkelen for hånd. Dobbeltklikk på koblingen i editoren og kryss av for *Durable*.

Den overlever en omstart, holder rekkefølgen, respekterer en diskkvote (256 MiB som standard, og overflytpolicyen til noden i den andre enden avgjør hva som må vike når det er fullt) og viser dybden sin som `hotloop_flow_durable_wire_depth`. Den er minst én gang, ikke nøyaktig én gang, og det sier vi heller her enn at du finner det ut i en ettertidsgjennomgang: de eksakte ordene, og hvordan `influxdb out` likevel forblir korrekt, står i [docs/durable](/nb/flow/durable-state/).

Beviset er `docs/durable/store-and-forward.sh`: en ekte InfluxDB 2.9.1 i Podman under tjue målinger i sekundet, stoppet i ti minutter, hentet tilbake, med kjøretiden drept med `kill -9` én gang midt i avbruddet og én gang midt i tømmingen. 15,982 målinger akseptert, 15,982 rader lagret, ingen manglet, ingen doblet. En frisk varig kobling skriver ingenting selv, og med kontekst tømt hvert tretti sekund, skrev hele prosessen 1.7 MiB i timen ved tjue meldinger i sekundet (0.04 GB i døgnet). Tabellene og kommandoene står i [docs/durable](/nb/flow/durable-state/).

## En melding målet nekter for alltid

Som standard prøver en kobling på nytt en melding målet feiler på, med en pause som vokser til fem sekunder, og ingenting bak den meldingen flytter seg. For en historian som er nede, er det helt riktig. For én misdannet måling historianen aldri vil ta imot, er det en kobling som sitter fast for godt, så det finnes en vei ut, og den er av til du ber om den.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Gi koblingen et antall forsøk, i editorens koblingsdialog eller som over, og etter at målet har avvist en melding fra køen så mange ganger, løfter koblingen den til flyten som en feil fra noden som avviste den, med meldingen vedlagt slik enhver nodefeil bærer den, og går videre til neste. En Catch-node på den flyten får den og kan parkere den, varsle om den eller skrive den et annet sted. Uten Catch vises feilen fortsatt i feilsøkingssidepanelet, og meldingen er borte, så koble til en. Den første avvisningen, i minnet, når Catch som den alltid har gjort, så en Catch ser den samme meldingen to ganger: én gang da den først feilet og én gang da koblingen ga opp. Tellingen er per melding og i minnet, så en omstart starter den på nytt. `hotloop_flow_durable_wire_given_up_total` teller dem, ved siden av dybden. En grense som ikke er et helt tall på 1 eller mer, blir meldt, og koblingen fortsetter å prøve på nytt, for å ignorere den i det stille ville latt en kobling som noen hadde bedt om å stoppe, sitte fast.
