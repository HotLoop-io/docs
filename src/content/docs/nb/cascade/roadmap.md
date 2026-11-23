---
title: "Veikart for Cascade"
description: "Hva Cascade har bygget, hva hver utgivelse leverte, og hva som verken er bygget eller planlagt."
---

Ingen steder i koden finnes en lisenssjekk. Hver fase er ferdig når den «ekte» listen er gjennomført mot ekte systemer, ikke når koden kompilerer.

## 0.1.0, MVP-en

Bygget. Motoren, varige kjøringer, Postgres-køen og workerne, uttrykk, Code-trinnet i buret sitt, hvelvet for legitimasjon og OAuth2, webhooks, tidsplaner og MQTT, brukere med påkrevd MFA, OIDC, prosjekter og RBAC, revisjon, versjonshistorikk, API-et, editoren, koblingene på den godkjente listen, import av arbeidsflyter, målinger og spor, Helm-chartet og Quadlet-enhetene. Utgitt med `RELEASE_CHECKLIST.md`, ikke før.

## 0.2.0, identitet og styring

Bygget, og levert i 1.0.0 sammen med den nye editoren. SAML, LDAP og AD, SCIM, egne roller, eksterne hemmeligheter, loggstrømming, variabler, mapper, innsikt, kjøringsmerknader, blob-lagrene for S3 og Azure og regler for sladding av kjøringer. Hver av dem er prøvd mot den ekte serveren den snakker med, og hver har sin skjerm i editoren.

## Hva 1.0.x leverte

1.0.0 er 0.1.0 pluss 0.2.0 pluss den nye editoren, og ingenting mer. Vi kalte den 1.0.0 fordi editoren var den siste brikken vi ville ha før vi satte navnet vårt under tallet, ikke fordi alt nedenfor er ferdig.

1.0.1 rettet en feil i innloggingen: en database som ikke kunne leses, svarte «ikke logget inn» og slettet cookien, så et kort avbrudd logget alle ut og kunne gjøre en riktig andre faktor om til en feil kode. Nå svarer den «prøv igjen» og beholder økten. 1.0.2 lot et Code-trinn signere og verifisere med en HMAC-nøkkel lagret som legitimasjon, og lot en webhook oppgi hvilke nettopprinnelser som kan kalle den fra en nettleser. Ingenting ble migrert mellom 1.0.0 og 1.0.2.

Hva en lagret arbeidsflyt holder seg til i dag: filen sier hvilken versjon av formatet den har (`cascade: 1`), hvert trinn har sin egen versjon, og en arbeidsflyt som nevner et trinn som ikke finnes lenger, består ikke valideringen og starter ikke, i stedet for å bli endret i det stille. Slik ble EmberOps-trinnene tatt ut i 1.0.0. Utover det er det ingen lovnad om formatet eller API-et ennå, og ingen oppgraderingstest fra hver tidligere utgivelse: det som testes står i `RELEASE_CHECKLIST.md`, som oppgraderer for hånd fra forrige utgivelse. En lovnad kommer hit når vi kan holde den, og ikke før.

## 1.3.0, editoren på 14 språk

Bygget. Engelsk, spansk, fransk, italiensk, tysk, norsk bokmål, bulgarsk, gresk, koreansk, japansk, vietnamesisk, hindi, forenklet kinesisk og arabisk. En språkvelger i toppfeltet og på innloggingssiden; hver skjerm, trinntitlene og hjelpen og serverens avslag er oversatt; datoer, tall og varigheter følger språket; arabisk skrives fra høyre mot venstre, med lerretet og koden fra venstre mot høyre. Hvert språk er prøvd på hver skjerm i skrivebords- og telefonbredde i en ekte nettleser, og bygget avviser et språk som mangler en linje. Ordene kommer fra den felles HotLoop-ordlisten.

## 1.5.0, slette en person

Bygget. En eier av instansen kan slette en person fra Brukere, REST-API-et (`DELETE /api/v1/users/{user}`) eller MCP-serveren (`delete_user`). Kontoen, øktene, passkeys, innloggingsidentitetene og API-nøklene deres forsvinner, og revisjonsloggen beholder hvem som gjorde det og hva som gikk. Arbeidsflytene, legitimasjonen og kjøringene deres blir: det personlige prosjektet blir et delt prosjekt oppkalt etter dem med "(removed)", slik at en eier eller administrator kan flytte arbeidet eller gi det videre. Ingen kan slette sin egen konto, og den siste eieren kan ikke slettes. Å slå av noen finnes fortsatt, for når du vil beholde kontoen.

## 1.4.2, påloggingssiden

Bygget. Påloggingssiden er et sentrert kort på en rolig side, med produktmerket og navnet over, hovedknappen i HotLoop-oransje og de andre måtene inn (en passkey, enkel pålogging) som vanlige knapper ved siden av, i lyst og mørkt og på en telefon. Knappen for enkel pålogging har ikon fra leverandøren sin når leverandøren er Vord. Hvert felt, hver id og hver påloggingssti er som den var.

## 1.4.1, innstillingssiden

Bygget. Innstillingssiden setter ikke lenger et felt tilbake når svaret på en lagring kommer etter at personen har endret det: et felt som fortsatt har det som ble sendt, tar serverens verdi, og et som er redigert siden, beholder redigeringen. Og gjennomgangslistene i språkmappene er borte.

## 1.4.0, venting, oppbevaring, grenser og sikkerhetskopi

Bygget. En pod som starter før databasen sin, noe chartet gjør i den delte formen, venter nå på den og sier fra, i stedet for å starte på nytt to eller tre ganger (installasjonen viste ingen omstarter i charttesten). Og oppbevaring: en innstilling for hvor mange dager ferdige kjøringer beholdes, av som standard, og en runde hver time som fjerner de eldre sammen med trinndataene deres. Samme runde fjerner filene i blob-lageret som ingen kjøring peker på lenger: utdata som var for store for databasen, og vedlegg, en delt fil først når den siste kjøringen som bruker den, er borte. Og en hastighetsgrense for hver API-nøkkel, gjennom API-et og MCP, av som standard, besvart med 429 og beskjed om hvor lenge det må ventes. (En webhook har sin egen grense, og en konto låses etter gjentatte feil passord, som før.) Og `hotloop-cascade backup` og `restore`: SQLite-databasen, nøkkelen og blob-filene med et manifest av hasher, og for PostgreSQL nøkkelen og blobene pluss `pg_dump`-kommandoen for databasens halvdel.

## 1.2.0, de fire siste verktøyene i MCP-serveren

Bygget. MCP-serveren manglet fire ruter som en nøkkel kan kalle: liste og tilbakekalle egne nøkler, åpne en arbeidsflyts testwebhook og starte en OAuth2-innlogging. De er verktøy nå, 83 til sammen, hvert gjennom sin rute, så de samme tillatelsessjekkene som i editoren gjelder. De ti rutene som krever en innlogget person (å lage nøkler, SCIM-tokens, hemmelighetsleverandører og loggmål, og eget passord) står fortsatt utenfor, fordi en nøkkel som kunne lage dem, kunne holde seg selv i live; MCP-siden sier hvilke og hvorfor.

## 1.1.0, MCP og skjermene som manglet

Bygget, og dette er utgivelsen. MCP-serveren på `/mcp`: 79 verktøy, hvert en rute i REST-API-et, så rutens egen behandler sjekker tillatelsen, validerer innholdet, gjør endringen og skriver revisjonsraden. Den leveres på, med lesing og skriving, som alle MCP-er i HotLoop-familien, og de to bryterne for den eies av selve utrullingen (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), som ingen verktøy og ingen rute kan endre. MCP-siden har alle verktøyene og hva hvert enkelt ber om.

Og skjermene editoren manglet: legitimasjon, prosjekter (medlemmer og tjenestekontoer), brukere, revisjonsloggen, innstillinger og en kontoside med API-nøkler, hver med de samme tillatelsene som API-et og prøvd i en ekte nettleser med hver rolle. Innloggingssiden er editorens nå, i dens farger og skrift, og ikke den gamle Go-siden.

## Ikke bygget: miljøer og skala

Bygget fra denne fasen: webhook-rollen (en egen Deployment i den delte formen av chartet), en samtidighetsgrense per arbeidsflyt og mange mains mot én database. Det vi ikke har gjort, er testen vi satte for denne fasen: å drepe en main under en tidsplan på minuttnivå og ikke finne noen duplikat eller manglende kjøring over en time.

Ikke bygget, ikke planlagt:

- Kildekodekontroll med Git og miljøer.
- Beskyttede instanser.

## Ikke bygget: koblinger og mennesker

Koblingene på den godkjente listen som ble bygget, er med: HTTP, ntfy, Discord, Gotify, e-post, HotLoop, MQTT, databaser, filer og blob-lagrene for S3 og Azure. EmberOps-koblingen var i 0.1.x og er borte i 1.0.0.

Ikke bygget, ikke planlagt:

- Den publiserte deklarative koblingsspesifikasjonen.
- Et plugin-SDK og en indeks.
- Skjemaer med godkjenningstrinn for mennesker. Godkjenninger må fungere fra en telefon, fordi den som godkjenner en endring i en oppskrift, står ved linjen og ikke sitter ved et skrivebord. (Wait-trinnet holder allerede en kjøring til noen kaller gjenopptakelses-URL-en, så en godkjenning kan bygges av en lenke i dag; det som mangler, er skjemaet godkjenneren åpner og en logg over hvem som godkjente.)

## Ikke bygget: KI-trinn

LLM- og agenttrinn, og en bygger som bruker din egen modell. Ta med din egen nøkkel eller kjør den lokalt. Ingenting av dette finnes ennå, og ingen har planlagt det. Det finnes ingen driftet tjeneste og kommer ikke til å gjøre det. (MCP-serveren, som lar en agent styre Cascade utenfra, er bygget: se 1.1.0.)

## Det nye editorgrensesnittet

Bygget, og i 1.0.0. Editoren er skrevet om i Astro med Svelte-øyer, bygget til statiske ressurser og innebygd i Go-binærfilen slik den gamle var, så det er den samme historien med én binærfil og ingenting nytt å kjøre. Den henter farger, skrift og merke fra HotLoops merkefiler og følger systemets lyse eller mørke modus. Hver skjerm den gamle editoren hadde, er med og gjør det den gjorde (lerretskoden kom over uendret), funksjonene fra 0.2.0 har skjermer, og en nettlesertest styrer hver av dem mot den ekte serveren i en ekte Chrome. Ingenting av dette endret API-et, filformatet eller Go-siden.
