---
title: "Cascade-editoren"
description: "Editoren er bygget inn i Cascade-binærfilen: mapper, lerret med kjør hit, kjøringer tegnet trinn for trinn, legitimasjon, prosjekter, brukere og revisjon."
---

Editoren er bakt inn i binærfilen, så det er ingenting annet å kjøre og ingenting den henter fra noe sted: åpne adressen serveren lytter på og logg inn. Det er en Astro-app med Svelte-øyer, bygget til statiske filer når imaget bygges, i de samme fargene og den samme skriften som alle andre HotLoop-skjermer, lys eller mørk etter systemet ditt til du velger.

![Arbeidsflyter, i mapper](/synced/cascade/docs/screenshots/workflows.png)

Arbeidsflyter bor i prosjekter, og et prosjekts arbeidsflyter bor i mapper som kan nøstes så dypt som anlegget ditt: område, linje, celle. En arbeidsflyt flyttes mellom mapper fra sin egen rad.

![Lerretet, et trinn valgt og innstillingene ved siden av](/synced/cascade/docs/screenshots/editor.png)
![Det samme, i mørk modus](/synced/cascade/docs/screenshots/editor-dark.png)

Lerretet er der det alltid har vært: dra fra en utgang til en inngang, flytt et trinn, `Ctrl+S` for å lagre, `Delete` for å ta bort et trinn. Kjør hit kjører det som står på skjermen, ulagret, opp til trinnet du valgte og viser det det ga ut som en tabell, som felt eller som JSON, og du kan feste den utdataen slik at trinnet slutter å kjøre mens du bygger de neste. Hvert felt tar et uttrykk og viser hva det blir med siste testkjøring. En lagring over en annens blir meldt fra om, ikke fulgt.

![En mislykket kjøring, tegnet slik den gikk](/synced/cascade/docs/screenshots/run.png)

En kjøring tegnes med hvordan hvert trinn gikk. Prøv den på nytt fra trinnet som feilet, fra et hvilket som helst trinn, eller feilsøk den i editoren mot endringer: trinnene før det du kjører på nytt beholder det de gjorde, så en skriving som allerede har skjedd, skjer ikke to ganger. En person kan etterpå legge igjen tommel opp eller ned, et notat og tagger på en kjøring, og kjøringslisten finner kjøringer ut fra dem.

![Kjøringer, med det folk har sagt om dem](/synced/cascade/docs/screenshots/executions.png)
![Innsikt for de siste sju dagene](/synced/cascade/docs/screenshots/insights.png)
![Roller](/synced/cascade/docs/screenshots/roles.png)
![Sladdingspolicyer](/synced/cascade/docs/screenshots/redaction.png)

Resten av styringsarbeidet ligger under Innstillinger: roller og hvem som har dem, sladdingspolicyer (en arbeidsflyt velger en i innstillingene sine, fra editoren), eksterne leverandører av hemmeligheter, loggstrømming, og pålogging og SCIM. En eier eller admin endrer disse; alle andre leser det de har lov til, blir aldri tilbudt en knapp serveren vil avvise, og serveren avviser den likevel.

Fire skjermer står ved siden av arbeidsflytene. Legitimasjon opprettes, åpnes, endres, deles med andre prosjekter og slettes i sitt eget prosjekt; et hemmelig felt legges inn én gang, og skjermen sier bare at det er satt. Prosjekter viser hvem som er med i hvert og i hvilken rolle, og tjenestekontonøklene en varig integrasjon logger på med. Kontoen din (adressen i toppfeltet) lager og tilbakekaller API-nøklene dine, som REST-API-et og MCP-serveren logger på med, og endrer passordet ditt. For eiere og administratorer har Innstillinger de generelle innstillingene (andre faktor, feilarbeidsflyten), Brukere oppretter personer, slår dem av og lar en eier slette en (innloggingene og nøklene deres forsvinner, arbeidsflytene deres blir), og revisjonsloggen leses, filtreres og kontrolleres mot manipulering der. Innloggingen er den samme editoren, på `/login`, og beholder enkel pålogging, katalogpålogging, passkeys og gjenopprettingskoder.

![Legitimasjon, der hemmeligheten aldri vises](/synced/cascade/docs/screenshots/credentials.png)
![Prosjekter, og hvem som er med i ett](/synced/cascade/docs/screenshots/projects.png)
![Revisjonsloggen, og sjekken av at den er intakt](/synced/cascade/docs/screenshots/audit.png)
![Kontoen din og API-nøklene dens](/synced/cascade/docs/screenshots/account.png)

Hva det betyr for deg: alt Cascade kan gjøre, kan du gjøre fra denne skjermen, på en anleggsmaskin uten internett, uten en linje curl.

Editoren snakker språket til den som står foran den. Velgeren i toppfeltet (og på påloggingssiden) lister hvert språk med sitt eget navn, husker valget i den nettleseren og starter på nettleserens språk første gang. Trinntitler og hjelpen deres, legitimasjonstyper, knappene, avvisningene serveren sender, datoer, tall og varigheter kommer alle på språket du valgte, og arabisk går fra høyre til venstre, mens arbeidsflytlerretet fortsatt tegnes fra venstre til høyre som for alle andre. Et språk tilbys bare når hvert ord i det er der: `web/src/i18n/check.mjs` får bygget til å feile når det mangler en linje, en plassholder eller en flertallsform, og `web/scripts/i18n-scan.mjs` får det til å feile på tekst skrevet rett inn i en skjerm. Ordene bor i `web/src/i18n/locales/<language>/`, og en trinntype eller avvisning serveren får, sjekkes mot dem av en Go-test. En kjørings egen utdata, og alt et program et trinn kalte sa, vises slik det ble registrert.

Hva det betyr for deg: operatørene dine leser skjermen på sitt eget språk, og en ny skjerm kan ikke slippes med en linje engelsk som ingen har oversatt.
