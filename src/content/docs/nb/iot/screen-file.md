---
title: "Skjermfiler"
description: "Eksporter et dashbord til en fil og importer det i en annen installasjon, med hver tag, enhet og skript listet opp og en kobling for navn som er ulike."
---

En skjerm tilhører kunden, og den reiser som en fil. Eksporter et dashbord fra én installasjon, importer det i en annen, og ingenting av det bor i HotLoops kode: ikke oppsettet, ikke tagnavnene, ikke teksten. Den samme filen fungerer i HotLoop IoT, Edge og Gateway, fordi de kjører ett sett dashbord ([Dashbord](/nb/iot/dashboards/)).

Edge Relay har ikke noe grensesnitt og ingen skjermer. Flows dashbord er en del av flytene, som har sin egen Importer og Eksporter. For HotLoop for CODESYS er skjermene Edge sine.

## Slik bruker du det

På Dashbord-skjermen lagrer **Eksporter** (ved siden av Rediger, for dashbordet på skjermen) `<id>.hotloop-screen.json`. **Importer** (i linjen ved siden av Nytt dashbord) leser en fil, forteller deg hva den trenger og hva som mangler her, lar deg koble hver manglende tag, enhet, entitet, skript eller oppskrift til en som finnes, sjekker igjen og lagrer det. Import krever `dashboards.write`, så det er en administrators jobb. Eksport krever `dashboards.read`, og dashbordet må være ett du blir tilbudt.

Gjennom API-et er det [`GET /api/dashboards/{id}/export`](/nb/iot/api/#get-apidashboardsidexport) og [`POST /api/dashboards/import`](/nb/iot/api/#post-apidashboardsimport), som er det skjermen kaller. En import lagrer aldri noe som det å bygge det samme dashbordet ville avvist.

## Filen

UTF-8 JSON, opptil 4 MiB.

```json
{
  "format": "hotloop-screen",
  "formatVersion": 1,
  "exported": { "product": "edge", "version": "4.22.1", "at": "2026-11-19T16:00:00Z" },
  "screen": {
    "id": "line-2",
    "name": "Line 2",
    "kind": "cards",
    "roles": ["operator", "admin"],
    "homeFor": ["operator"],
    "screens": ["line-2-panel"],
    "position": 1,
    "cards": [
      { "id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3, "config": { "tag": "press-01/Zone1_Temp" } }
    ]
  },
  "requires": {
    "tags": [ { "key": "press-01/Zone1_Temp", "dataType": "float", "unit": "C", "writable": false } ],
    "entities": [], "scripts": [], "recipes": [], "devices": [], "equipment": []
  }
}
```

**`format` og `formatVersion`.** `format` er alltid `hotloop-screen`. `formatVersion` er et helt tall fra 1. En HotLoop leser sin egen versjon og eldre, og avviser en nyere ved å si hvilken versjon filen er og hvilken den leser. Et felt lagt til i filen er en ny versjon, fordi en leser avviser et felt den ikke kjenner: et felt som droppes uten et ord er verre enn et avslag. Dette er versjon 1.

**`exported`.** Hvilket produkt og hvilken versjon som skrev den, og når. For den som leser filen. Ingenting avgjøres ut fra den: korttypene avgjør om en HotLoop kan vise skjermen, og en ukjent korttype avvises med navn.

**`screen`.** Dashbordet slik dashbord-API-et holder det, uten installasjonens egen regnskapsføring (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` utelates når den er tom. Kortene står i leserekkefølge, hvert med sin størrelse (`w` av 12 kolonner, `h` i rader) og sin `config`, nøyaktig slik [Dashbord](/nb/iot/dashboards/#kortene) beskriver hver type. Oppsettet er det: en flyt av kort, aldri pikselkoordinater. Et symbols-kort plasserer symbolene sine per piksel på sin egen side, inne i config, og rørene (hva som forbinder hvilket koblingspunkt på hvilket symbol, i hvilket medium, og taggen det flyter med) ligger i config ved siden av. En rute er aldri i filen: siden regner den ut på nytt overalt der skjermen åpnes, så et P&ID kommer tilbake tegnet slik det gikk ut.

**Ressursene ligger inni.** En planløsning på et kartkort og bakgrunnen til et symbolkort er base64 PNG-data-URL-er i kortets `config`, så én fil er hele skjermen, og å sende den er å sende bildet også. Grensene er dashbordets: 700 KB per bilde og 2 MiB per skjerm.

**`requires`.** Hva skjermen trenger fra installasjonen den havner på, regnet ut fra kortene: hver tag den leser (med typen og enheten den hadde der den ble eksportert, og om en knapp eller et settpunkt skriver til den) og id-ene til entiteter, skript, oppskrifter, enheter og utstyr kortene nevner. Det er for folk og for verktøy som vil se før de importerer. Importen regner det ut på nytt fra kortene og stoler aldri på denne blokken. Der typen til en tag i filen avviker fra taggen den havner på, er det en advarsel.

**Veggtavlen eksporteres ikke.** Den er en installasjons festede målere, ikke et oppsett. Å eksportere den gir en `400`, og en fil der `kind` er `wall` avvises.

**Tildelinger.** `roles`, `homeFor`, `screens` og `position` ligger i filen slik at en skjerm kommer tilbake som den dro. De er også den delen som er mest knyttet til én installasjon: et panelnavn tilhører ett dashbord på en installasjon, og en rolle har ett hjem. En import bruker dem, og sier fra (`assignment`) når denne installasjonen allerede gir det skjermnavnet eller den rollens hjem til et annet dashbord. **Hopp over tildelingene** lar `screens` og `homeFor` ligge og beholder `roles`.

## Importere

Kontrollene kjører i denne rekkefølgen, og ingenting lagres før alle er bestått:

1. **Filen.** JSON, riktig `format`, en versjon dette bygget leser, ingen felt det ikke kjenner, type `cards`.
2. **Endringene dine i den.** En ny id eller et nytt navn, ingen tildelinger og **koblingen**: `tags` (hel nøkkel til hel nøkkel, slik filen navngir taggen eller slik den leses etter at enheten er flyttet), `devices` (id til id; flytter også enhetsdelen av hver tag `tags`-koblingen ikke nevner, så å flytte en skjerm fra én PLS til en annen er én oppføring), `entities`, `scripts`, `recipes` og `equipment` (id-er er tall som bare betyr noe der de ble laget, så de kobles én og én). Tegnforklaringen til en trend flytter seg med taggen sin. En koblingsoppføring ingen kort brukte er en advarsel, fordi en kobling som ikke gjorde noe er slik en skjerm ender opp med å peke på det gamle.
3. **Dashbordets egne regler.** Id, navn, hvert korts config, størrelser, bytegrensen, i den formen det lagres.
4. **Alt kortene nevner, uten unntak.** Hver manglende tag, entitet, skript, oppskrift, enhet og utstyrs-id listes opp, ikke bare den første, så én runde sier hva som må kobles. En knapp eller et settpunkt på en tag som ikke er skrivbar, er `writable`. En knappeverdi eller en settpunktgrense utenfor taggens område og en rolle som ikke finnes, er `screen`.
5. **Id-en og tildelingene.** En id som er tatt, er `exists`, med mindre du ba om å **erstatte** den, som lagrer over det dashbordet i versjonen det har nå (så en lagring gjort mens du så på, er en `409`, ikke en overskriving).

En tørrkjøring gjør alt dette og lagrer ingenting. Importen logges som en `config`-hendelse på dashbordet: hvem, fra hvilket produkt og hvilken versjon, hvor mange kort.

## Flytte en skjerm

Eksporter på den første installasjonen. På den andre må du sørge for at enhetene og taggene skjermen leser finnes (de bærer adresser som hører til anlegget, så en skjermfil bærer dem ikke). Importer. Er tagnavnene ulike, kobler du dem i dialogen, eller kobler enheten hvis det bare er den som er ulik. Skjermen åpnes på den andre installasjonen slik den var på den første.

## En CODESYS-visualisering

Den samme importen leser en CODESYS-visualisering (IDE-ens egen eksport) og lager skjermen av den, og sier hva den utelot: [Importer en CODESYS-skjerm](/nb/iot/codesys-screen-import/).

## Hva som ikke er i versjon 1

Enhetene og taggene en skjerm leser (adressene deres hører til anlegget, ikke skjermen), veggtavlen, flere skjermer i én fil og en signatur på filen. En fil er vanlig JSON: les den før du importerer en du har fått tilsendt.
