---
title: "Typede ledninger"
description: "Legg et JSON Schema på json-noden og sjekk meldinger på en ledning: en feil form havner i en Catch-node som navngir hvert feil felt."
---

En melding med feil form er feilen vi minst av alt vil ha på en linje som går. En temperatur som kommer som strengen `"hot"`, en manglende `id`, et tall der det skulle vært en liste: ingenting krasjer, flyten fortsetter, og noe lenger ned gjør stille det gale. Flow bringer JSON Schema til det problemet i tre steg.

## Skjema på `json`-noden

Gi `json`-noden et skjema i innstillingene, og hver verdi den håndterer sjekkes mot det. En verdi som passer, går videre. En verdi som ikke passer, går til en Catch-node, fortsetter ikke nedover ledningen, og feilen navngir hvert feil felt:

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` bærer det samme som en liste av `{path, keyword, message}`-objekter, for en Catch-node som vil rute etter det. Stier leses slik en Change-node skriver dem: `payload.sensors[2].temp`.

Hvis noden ikke har skjema i innstillingene og en melding bærer `msg.schema`, validerer noden mot det i stedet, slik Node-REDs `json`-node gjør. En melding som består, får `msg.schema` fjernet. En som feiler, beholder det. Skjemaet i innstillingene vinner når begge er der.

- Skjemaet er JSON Schema draft 2020-12 med mindre det navngir et annet utkast med `$schema`. Utkast 4, 6, 7 og 2019-09 godtas.
- Et ugyldig skjema i innstillingene lar utrullingen feile med validatorens begrunnelse. Et ugyldig `msg.schema` er en feil på den meldingen.
- Et skjema er selvstendig. En `$ref` til en annen URL eller en fil avvises, ikke hentes, slik at en edge-boks uten vei ut oppfører seg som alle andre.
- `format` sjekkes for formatene validatoren kjenner og ignoreres for resten, slik de fleste validatorer gjør.
- En flyt uten skjema noe sted oppfører seg nøyaktig som før.

Alt annet i Flow som trenger å sjekke en verdi mot et skjema, bruker den samme pakken.

## Skjemaer på porter

Enhver node kan oppgi hva den tar imot og hva hver utgangsport lover. To valgfrie nøkler på noden, begge i flytfilen, begge ignorert av ethvert annet verktøy som leser den, slik at en flyt som bærer dem fortsatt rundturer byte for byte:

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` er det noden tar imot. `ew_outSchemas` er en liste med ett skjema eller `null` for hver utgangsport. Et skjema beskriver hele meldingen, så payloaden er `properties.payload`. Nøkler som starter med understrek, `_msgid` og kjøretidens øvrige bokføring, holdes utenfor det den ser, så et lukket skjema ikke trenger å navngi dem. De er JSON Schema som `json`-nodens, og den samme pakken sjekker dem.

**Et avvik editoren kan se, avvises ved utrulling.** Når begge ender av en ledning oppgir et skjema og ingen melding kunne tilfredsstille begge, avvises utrullingen før en eneste byte er skrevet, på samme måte som testporten: en 422, ingenting startet på nytt, ingenting lagret, og en oppføring i revisjonssporet som `deploy.refused` med årsaken `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Den avviser bare det den kan bevise. Ulike typer i samme felt, en verdi utenfor den andre endens `enum` eller område, et felt mottakeren krever og avsenderens lukkede skjema utelukker, et felt avsenderen alltid sender og mottakerens lukkede skjema avviser. En avsender som bare ikke nevner et felt mottakeren krever, avvises ikke, for meldingen kan godt bære det, og et skjema som bruker `$ref`, `allOf`, `anyOf`, `oneOf`, `not` eller `if` blir ikke overstyrt i den delen. Et falskt avslag stopper en utrulling for ingenting, og alt den ikke kan bevise, fanges fortsatt under kjøring. Et skjema som ikke kompilerer, eller et `ew_outSchemas` som er lengre enn nodens utganger, avvises på samme måte. Tilbakerullinger sjekkes ikke, av samme grunn som de ikke er stengt av tester.

**En Inject-nodes litteraler teller som en type.** En Inject har ikke noe eget skjema, men det den setter med sikkerhet er like godt som ett. Når en Inject er koblet rett til en node med `ew_inSchema`, sjekkes den litterale payloaden, og enhver annen litteral egenskap den setter, mot det skjemaet ved utrulling, og en litteral mottakeren aldri kan ta imot, avvises på samme måte, med samme 422 og samme `deploy.refused` i revisjonssporet:

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Bare en litteral sjekkes: en streng, et tall, en boolsk verdi eller JSON. Et tidsstempel, en miljøvariabel, flyt- eller global kontekst, en annen meldingsegenskap, JSONata, en buffer eller et regulært uttrykk er ikke kjent før noden utløses, så det hoppes over, aldri gjettes. En påkrevd egenskap Inject ikke setter, er heller ikke en konflikt, fordi en verdi som ikke er statisk kan sette den. Bare ledningen fra Inject til noden bedømmes: en litteral som går gjennom en annen node først, overlates til sjekken under kjøring. Editoren tegner den samme konflikten på den ledningen.

**En den ikke kan se, går til en Catch-node og til en metrikk.** En melding som kommer til en node og bryter nodens `ew_inSchema`, når aldri noden. En melding som forlater en port og bryter portens skjema, stoppes hos avsenderen og leveres aldri. Uansett utløses den som en feil fra noden som holdt skjemaet, og Catch-noden får den med stien til hvert feil felt i `msg.error.message` og som en liste i `msg.error.violations`, hver `{path, keyword, message}`:

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` teller dem per node, og teller også `json`-nodens avvik. En node uten skjemaer koster én nil-sjekk, og en flyt uten noen oppfører seg nøyaktig som før.

## Typer på ledningene, i editoren

En ledning med en type i en av endene bærer den. Editoren skriver typen på ledningen, midt på kurven: avsenderens, i noen få tegn (`payload {temp: number}`), og hele historien når du holder over ledningen.

- **Begge ender oppgir en type og er enige:** grønn kontur, avsenderens type.
- **Bare én ende oppgir en:** stiplet og dempet, så du ser hvor en ledning fortsatt er utypet.
- **Begge oppgir en og kan aldri bli enige:** ledningen og etiketten blir røde og sier hvilket felt, `≠ payload.temp`, og verktøytipset har kjøretidens begrunnelse. Utrullingen ville avvist det, og nå ser du det før du trykker Deploy.

Det røde er ikke editoren som gjetter. Den spør kjøretiden, `POST /flows/types`, som kjører den samme sjekken utrullingen avviser med, så lerretet og utrullingen ikke kan være uenige. Editoren spør bare når noe på lerretet har et skjema, litt etter siste endring. En flyt uten skjemaer gjør ingen kall og tegner ingenting nytt.

Sett typene i en nodes dialog, under **Types**: et inngangsskjema og ett for hver utgangsport. Tom betyr ingen type, og en node du aldri har typet, får ikke nøklene. Å skrive noe som ikke er JSON, eller som ikke er et objekt, avvises i dialogen.
