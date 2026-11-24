---
title: "Utgivelsesnotater: HotLoop Cascade 1.6.0"
description: "Hva HotLoop Cascade 1.6.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.6.0"
---

## Hva dette er

1.6.0 er utgivelsen der Cascade slutter å bare være et sted arbeidsflyter kjører og blir et sted folk, modeller og andre servere tar del. En kjøring kan stoppe og spørre en person på telefonen. En kjøring kan spørre en modell du eier. Arbeidsflytene dine kan leve i Git, og en produksjonsinstans kan nekte å bli redigert for hånd. Og hvilken som helst nett-API kan bli til steg fra en fil. Motoren, filformatet og alt annet er det 1.5.1 har.

## Spør en person, fra en telefon

Det nye steget Be om godkjenning stopper kjøringen og venter. Legg `execution.approvalUrl` i et push-varsel, og den som får det, trykker på det, leser det du skrev, fyller ut et lite skjema hvis du lagde ett og trykker Godkjenn eller Avvis. Siden er enkel, rask, krever ingen innlogging med mindre du ber om det, og snakker nettleserens språk på alle fjorten. Kjøringen går videre ut av Godkjent eller Avvist med hvem som svarte, når og hva de sa. Hvert svar er en post: i redigeringsvinduet på kjøringen, i API-et på `GET /api/v1/approvals`, i MCP-serveren som `list_approvals` og i revisjonsloggen. La steget kreve en innlogget konto, og det tar bare imot svar fra kontoene du lister opp. En lenke virker én gang. Venting koster ingenting, så et svar kan komme en uke senere og overleve enhver omstart.

## Spør en modell

To nye steg, KI: spør en modell og KI: kjør en agent. Modellen er din: legitimasjon peker på en server du kjører (Ollama, vLLM, llama.cpp) eller en vertstjeneste du har nøkkel til, over OpenAI-protokollen eller Anthropics. Ingenting går dit legitimasjonen ikke peker, det finnes ingen vertstjeneste, og hvert kall går gjennom utgangspolicyen som alle andre. Spør en modell legger svaret på elementet, som tekst eller som et JSON-objekt som passer et skjema du oppgir. Kjør en agent gir modellen et mål og en liste verktøy der hvert verktøy er en annen av arbeidsflytene dine. Den ber om ett, Cascade kjører det, leverer resultatet tilbake, og dette gjentas til modellen svarer eller går tom for runder. Mellom rundene venter kjøringen i databasen, så et tregt verktøy koster ingen worker.

## Arbeidsflyter i Git

Koble et prosjekt til et depot, en gren og en mappe, og push eller pull. Push skriver én fil per arbeidsflyt, oppkalt etter den og med dens id, og committer som personen som pushet med meldingen de ga. Pull får prosjektet til å stemme med depotet: nye filer blir arbeidsflyter (avslått til du slår dem på), endrede filer blir nye versjoner, id-ene beholdes slik at en arbeidsflyt er den samme på hver instans, og en endring gjort på begge sider meldes og lates være i fred med mindre du sier hvem som vinner. Slettinger skjer bare når du ber om det. Det er et kort på hvert prosjekt, seks API-ruter og seks MCP-verktøy. Den snakker HTTPS med et brukernavn og et token eller passord i hvelvet, gjennom utgangspolicyen.

## Beskyttede instanser

Gi en instans et navn (utvikling, test, produksjon), og det vises i et merke øverst på hver skjerm. Beskytt den, fra Innstillinger eller med `HOTLOOP_CASCADE_PROTECTED` (chartets `protected`-verdi, som ingen innstilling kan oppheve), og arbeidsflytene kan ikke opprettes, redigeres, gjenopprettes eller slettes for hånd i redigeringsvinduet, API-et eller MCP. De kommer ved å hente fra Git. Legitimasjon, variabler, kjøringer og å slå en arbeidsflyt av og på forblir åpne, fordi de er ulike fra miljø til miljø. En beskyttet instans henter og pusher ikke.

## Kontakter som filer

En kontakt er en fil som sier hvor en API er, hvordan man logger inn, og hva hvert kall tar imot og svarer. Legg den i `HOTLOOP_CASCADE_CONNECTORS_DIR` (mappen `connectors` i datakatalogen), og hver operasjon er et steg, med skjema, en egen legitimasjonstype, sideinndeling og gjentakelser sortert slik de innebygde kontaktene sorterer dem. Formatet er publisert, versjonert og har et JSON Schema (`hotloop-cascade connector schema`). Verktøyene for å skrive en ligger i binærfilen: `connector init`, `validate`, `call` (prøv en operasjon mot den virkelige API-en) og `index` og `install` for deling, der en indeks er statiske filer med en hash hver. Cascade henter aldri en indeks du ikke har navngitt. MCP-serveren har nå 91 verktøy.

## Gå tilbake

Denne utgivelsen legger til tre tabeller (godkjenninger og to for Git), og migreringer går bare framover, så å gå tilbake til 1.5.1 krever sikkerhetskopien du tok før oppgraderingen, ikke bare det gamle avbildet. Ingenting eksisterende endrer form.
