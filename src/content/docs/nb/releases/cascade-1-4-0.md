---
title: "Utgivelsesnotater: HotLoop Cascade 1.4.0"
description: "Hva HotLoop Cascade 1.4.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.4.0"
---

## Hva dette er

1.4.0 gjør en Cascade-installasjon enklere å drifte over lang tid: serveren venter på databasen i stedet for å krasje, ferdige kjøringer kan beholdes i et antall dager og ryddes bort sammen med filene sine, en eier kan begrense hvor ofte en API-nøkkel kaller, og hele instansen kan sikkerhetskopieres og settes tilbake. Den avgjør også den ene skaleringstesten veikartet hadde stående åpen. Motoren, filformatet for arbeidsflyter, REST-API-et, MCP-serveren (83 verktøy) og de 14 språkene er som i 1.3.0.

## Venter på databasen

I den delte installasjonen (server-, worker- og webhook-pods på PostgreSQL) startet podene før databasens navn ble løst og startet om to eller tre ganger før de var klare. 1.2.1 og 1.3.0 gjorde det samme. En server, worker eller webhook som ikke når databasen, sier nå fra om det i loggen ("waiting for the database", med hvor lenge den har ventet) og prøver igjen, i opptil fem minutter, og kobler så til når databasen svarer. Feil passord, en ugyldig adresse eller en database som ikke finnes, stopper den fortsatt med en gang, fordi venting ikke kan fikse det. Chartets oppstartssjekk venter like lenge som programmet. En fersk delt installasjon på en ekte k3s viste ingen omstarter, i alle tre kjøringene av chart-testen.

## Beholde ferdige kjøringer

Innstillinger har et nytt felt, Behold ferdige kjøringer i (dager), og `PATCH /api/v1/settings` tar `retentionDays`. Det er av som standard (0), og hver kjøring beholdes som alltid. Sett et tall, og én gang i timen sletter en hovednode de vellykkede, mislykkede og avbrutte kjøringene som ble avsluttet lenger siden enn det, med stegdataene deres. En kjøring som fortsatt pågår, røres aldri, og det samme gjelder en kjøring hvis forelder pågår. Hver bunke skriver `execution.pruned` i revisjonsloggen, og endring av innstillingen skriver `instance.retention`.

Den samme timesvise runden rydder nå også blobblageret, enten oppbevaring er på eller ikke: utdata som er for store for databasen, og vedlegg som ingen kjøring peker på lenger. En fil to kjøringer deler, blir til den siste av dem går, og bare filer skrevet for mer enn 24 timer siden vurderes, så en fil et steg nettopp har lagret, fjernes aldri. Dette er nytt også for kjøringer du sletter for hånd; før lot en slettet kjøring de store utdataene ligge på disken for alltid. En runde som ikke kan lese det den trenger, fjerner ingenting, og hver runde skriver `blobs.collected` i revisjonsloggen.

## En grense for hver API-nøkkel

Innstillinger har et nytt felt, API-forespørsler per nøkkel per minutt, og `PATCH /api/v1/settings` tar `apiRateLimit`. Det er av som standard. Sett et tall, og hver API-nøkkel, og hver agent som er logget inn over MCP med en, kan gjøre så mange forespørsler i minuttet. Et kall over grensen besvares med 429 og en `Retry-After`. Hver nøkkel har sin egen telling, og personer som er logget inn i editoren, holdes ikke til den. Tellingen er hver prosess sin egen, så med tre hovednoder kan en nøkkel gjøre opptil tre ganger så mange. Endring skriver `instance.api_rate_limit` i revisjonsloggen.

## Sikkerhetskopi og gjenoppretting

`hotloop-cascade backup DIR` skriver en ny katalog med en konsistent kopi av SQLite-databasen tatt mens serveren kjører, nøkkelfilen som forsegler all lagret legitimasjon, blobfilene og en `manifest.json` med hashene deres. `hotloop-cascade restore DIR` setter dem tilbake, etter å ha sjekket hver fil mot manifestet, og nekter å overskrive en database eller en annen nøkkel med mindre du sier `--replace`. For PostgreSQL inneholder sikkerhetskopien nøkkelen, blobene og manifestet, og skriver ut `pg_dump`-kommandoen for databasens halvdel; gjenopprettingen skriver ut den for `pg_restore`. Blober lagret i S3 eller Azure kopieres ikke. `docs/GOVERNANCE.md` har detaljene.

## Testene som sto bak

- Skaleringstesten veikartet satte, er gjort. To hovednoder på én PostgreSQL kjørte i en time en arbeidsflyt som utløses hvert minutt, mens den ene ble drept med SIGKILL ved tidslukegrensen, syv ganger på rad og holdt nede omtrent 25 sekunder hver gang: 61 kjøringer for 61 minuttslukene, ingen glippet, ingen doblet.
- OAuth-serveren i teststakken (Hydra) kjører nå på Postgres. Den feilet i parallelle kjøringer før, besto etter, og feilet igjen da endringen ble reversert. Ingen Cascade-kode inspiserer tokens.
- Chart-testen feiler nå hvis en pod starter om ved installasjon.
- Et loggmål som feiler, venter nå ut back-offen fra tidspunktet feilen er registrert, ikke fra sendingen feilet. En treg skriving av feilnotatet brukte opp det første sekundet, og det umiddelbare nye forsøket ble sendt i stedet for å holdes tilbake; suiten stoppet på det under belastning.
- Språksjekken går nå gjennom skjermen som viser én kjøring, i begge bredder, på alle språk, fordi stegordene og statusordene til en kjøring er de et anlegg leser mest.
- De to nye avvisningene i innstillingene er oversatt på alle språk, og innstillingshjelpen sier at de store utdataene følger kjøringene.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. `stable`, `latest`, `1.4` og `1` lister det nye amd64-avbildet ved siden av arm64-avbildet de allerede pekte på.

## Oppgradere, og gå tilbake

Ingen migreringer: skjemaet er det 1.3.0 har. `helm upgrade` til 1.4.0, eller la `:stable` flytte Quadlet-enhetene. Det er trygt å sette 1.3.1 tilbake, fordi ingenting i databasen endret seg. Det en tilbakerulling ikke kan angre, er en opprydding: kjøringer oppbevaring slettet er borte, og det samme gjelder blobene den timesvise oppryddingen fjernet. Oppbevaring er av til du slår den på, så ta en sikkerhetskopi først; blob-oppryddingen kjører uten den.
