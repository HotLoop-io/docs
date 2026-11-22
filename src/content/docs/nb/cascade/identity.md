---
title: "Identitet og tilgang"
description: "Egne roller, innlogging med LDAP, Active Directory og SAML, og SCIM-klargjøring, alt med i hver Cascade uten noe betalt nivå."
---

Hvem som slipper inn, og hva de kan gjøre når de er inne. Cascade leverer alt dette til alle. Ingenting her er et betalt nivå, og det ligger ingen lisenssjekk bak.

Hvert endepunkt nedenfor står i OpenAPI-dokumentet på `/api/v1/openapi.json`, og hvert av dem har en test som kaller det.

## Egne roller

I editoren: Innstillinger, Roller. Alle leser rollene; en eier eller administrator lager, endrer og sletter egne roller, og gir dem til folk i et prosjekt fra samme skjermbilde.

Et prosjekt har fire innebygde roller: admin, editor, operator og viewer. De ligger i koden og endrer seg aldri. Når ingen av dem passer, lager du en egen rolle: et navn og en liste med prosjekttillatelser.

En linjeleder som kan starte linjens arbeidsflyter og lese kjøringene deres, men ikke redigere noe, er den vanligste grunnen:

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Legg deretter noen inn i et prosjekt med den rollen, med samme kall som for en innebygd rolle:

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

Dette bør du vite:

- `GET /api/v1/permissions` lister alle tillatelser en rolle kan ha, og `GET /api/v1/roles` lister de fire innebygde rollene og de egne med det hver av dem kan gjøre. Alle som er logget inn kan lese begge, fordi en prosjektadministrator trenger dem for å velge en rolle.
- Å lage, endre og slette en egen rolle er en jobb for en eier eller administrator av instansen, tillatelsen `role.manage`. En prosjektadministrator kan gi en rolle til folk i prosjektet sitt, men kan ikke skrive en ny, slik at ingen gir seg selv mer enn de fikk.
- En rolle har bare prosjekttillatelser. Den kan ikke ha `user.manage`, `audit.read` eller noen annen instanstillatelse, og å be om en gir en 400.
- Et navn er 2 til 40 små bokstaver, sifre og bindestreker, og begynner med en bokstav. Det kan ikke endres etterpå, fordi medlemmer og tjenestekontoer har en rolle via navnet. De fire innebygde navnene er tatt.
- Når tillatelsene til en rolle endres, gjelder det alle som har den ved neste forespørsel. Ingenting er bufret, så det finnes ikke noe vindu der en fjernet tillatelse fortsatt virker.
- En tjenestekontonøkkel kan ha en egen rolle som prosjektrolle, og omfangene til en API-nøkkel begrenser den fortsatt.
- Å slette en rolle som noen har, avvises med 409, som sier hvor mange medlemmer og tjenestekontonøkler som har den. Flytt dem først.
- Rolleendringer står i revisjonsloggen som `role.created`, `role.updated` (med tillatelsene før og etter) og `role.deleted`.

## LDAP og Active Directory

Folk logger inn med navnet og passordet de allerede har på anlegget: OpenLDAP, 389 Directory Server, FreeIPA eller Active Directory. Det fungerer ved siden av de lokale kontoene og OIDC, og er av til du setter `HOTLOOP_CASCADE_LDAP_URL`.

Slik går en innlogging:

1. En tjenestekonto (eller et anonymt søk, hvis katalogen din tillater det) finner personen med brukerfilteret.
2. Den slår opp gruppene personen er med i.
3. Selve katalogen sjekker passordet, ved å binde seg som personen. Cascade lagrer aldri passordet og ser aldri en hash av det. Kontoen som lages her har ikke noe eget passord, så katalogpassordet kan ikke brukes på `/login` som et lokalt passord.
4. Kontoen lages ved første innlogging (med mindre du slår det av), og rollen følger gruppene ved hver innlogging etter det.

Innloggingssiden viser et andre skjema når det er på, og det samme er ett kall, `POST /auth/ldap/login` med `{"username": "...", "password": "..."}`. Et feil navn og et feil passord får samme svar. Et tomt passord når aldri katalogen, fordi de fleste kataloger svarer med suksess på en binding med tomt passord.

### Innstillinger

Alle er miljøvariabler. Med Helm-charten legger du dem i `env`, og bindepassordet i `extraEnv` fra en hemmelighet.

| Variabel | Hva den gjør |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` eller `ldaps://host:636`. Slår det på. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (standard) eller `ad`. Den velger bare standardverdiene nedenfor. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` oppgraderer en `ldap://`-forbindelse til kryptert før noe sendes. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | PEM-fil med utstederne som skal stoles på for katalogens sertifikat. Tom betyr systemets. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | Navnet sertifikatet må gjelde for, når det ikke er verten i URL-en. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | Tjenestekontoen som slår opp folk. Tom er et anonymt søk. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` eller `_FILE` | Passordet, eller en fil som inneholder det. Ikke begge. En DN uten passord avvises, siden det ville vært en anonym binding. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Påkrevd. DN-en folk søkes etter under. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Finner én person. `{username}` er det de skrev, med escape. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | DN-en grupper søkes etter under. Tom betyr ingen gruppeoppslag. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Finner gruppene en person er med i. `{dn}` er DN-en deres, `{username}` det de skrev. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Attributtene for den stabile id-en, e-posten og visningsnavnet. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Par av typen `group=role`, atskilt med komma: `supervisors=admin, operators=member`. En gruppe oppgis med `cn` eller med full DN. Den mektigste rollen blant gruppene til en person vinner. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` eller `none`. Med en rollekobling er standarden `none`, så den som ikke er i noen koblet gruppe, vises bort. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` lager bare kontoer for hånd. Standard er `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Hva innloggingsknappen kaller det. |

Standardverdiene for `ldap`: brukerfilter `(&(objectClass=inetOrgPerson)(uid={username}))`, gruppefilter `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, id `entryUUID`, e-post `mail`, navn `cn`.

Standardverdiene for `ad`: En bruker finnes med `sAMAccountName` eller med brukerens hovednavn, så både `alice` og `alice@plant.example` virker, og en deaktivert konto holdes utenfor søket. Grupper bruker regelen for nøstet medlemskap (`member:1.2.840.113556.1.4.1941:={dn}`), så den som er i en gruppe som ligger inni en koblet gruppe, får også rollen. Id-en er `objectGUID`, skrevet som GUID, e-post `mail`, navn `displayName`.

### Dette bør du vite

- **Active Directory krever kryptering.** Det avviser en enkel binding på en ukryptert forbindelse. Bruk `ldaps://`, eller `ldap://` med `START_TLS=true`. Cascade sjekker sertifikatet mot CA-filen (eller systemets rotsertifikater) og mot servernavnet, og ingen innstilling hopper over sjekken. En katalog som signerer sitt eget sertifikat, trenger CA-en sin i `CA_FILE`.
- **Kontoen er knyttet til katalogens id, ikke navnet.** Gi noen nytt navn i katalogen, eller flytt dem til en annen OU, og det er den samme kontoen her. Den som ikke har `mail`, kan ikke få en konto (innloggingen sier fra om det).
- **Katalogen er autoriteten for adressen.** En konto som allerede finnes her med samme e-post, kobles til katalogoppføringen første gang personen logger inn, uten ekstra verifisering, slik en verifisert OIDC-adresse gjør. Ikke pek dette mot en katalog du ikke driver selv.
- **Den første kontoen en instans får, er eieren**, uansett hvordan den lages. Lag eieren først med oppsettet.
- **En andre faktor satt opp her teller fortsatt.** Et katalogpassord er én faktor. Den som har en autentiseringsapp eller en passkey på kontoen, blir spurt om den etterpå, og kravet om MFA for hele instansen gjelder som for alle andre.
- **Feil passord låser kontoen her også.** Fem på rad på en konto som allerede er knyttet til katalogen, låser den i ett minutt, med dobling, som en lokal, før katalogens egen utestenging rekker å slå inn. En person katalogen ikke kjenner, et feil passord og en låst konto står alle i revisjonsloggen som `auth.login_failed` eller `auth.login_refused`, og en person katalogen slapp gjennom som Cascade avviste (ingen gruppe, ingen e-post, JIT av), er `auth.sso_refused`.
- **En katalog som er nede, er en serverfeil, ikke et feil passord.** Innloggingen sier at katalogen ikke svarte, og detaljene står i loggen.
- Hvert kall til katalogen er begrenset til femten sekunder, og bare én person kan treffe brukerfilteret: to treff er en avvisning som nevner problemet, aldri det første.

## SAML

Single sign-on gjennom en hvilken som helst SAML 2.0-identitetsleverandør. Cascade er tjenesteleverandøren. Det fungerer ved siden av lokale kontoer, OIDC og LDAP, og er av til du oppgir leverandørens metadata.

Trinnene:

1. Cascade publiserer sine egne metadata på `/auth/saml/metadata`. Gi dem til leverandøren, eller skriv inn de to verdiene de inneholder: entity-id-en og assertion consumer service, `<public url>/auth/saml/acs`, HTTP-POST-binding.
2. Sett `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` til leverandørens metadataadresse (noe som `https://sso.plant.example/saml/metadata`), eller `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` til det samme dokumentet lagret på disk.
3. Innloggingssiden viser en «Logg inn med»-knapp. Den går til `/auth/saml/start`.

Dette sjekker den på vei tilbake: signaturen på svaret mot leverandørens sertifikat i metadataene, målgruppen, tidsvinduet, at det svarer på en forespørsel denne nettleseren startet, og at innloggingen ble startet i denne nettleseren. Et svar ingen ba om (en innlogging startet hos leverandøren) avvises. Tilstanden til hver innlogging virker bare én gang, så et avlyttet svar kan ikke spilles av igjen.

| Variabel | Hva den gjør |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` eller `_FILE` | Leverandørens metadata. En av dem slår på SAML; ikke begge. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Hvordan denne instansen oppgir seg selv overfor leverandøren. Standard: metadata-URL-en. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` og `_CERT_FILE` | Nøkkelparet til denne instansen, PEM, RSA eller EC. Begge eller ingen. Standard: et par som lages ved første oppstart som `saml-sp.key` og `saml-sp.crt` i datakatalogen, og beholdes. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` signerer hver forespørsel Cascade sender. Leverandøren må få vite sertifikatet. Standard `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Hva Cascade ber leverandøren identifisere folk med: `persistent` (standard), `email` eller `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Et attributt som identifiserer personen i stedet for NameID. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Hvilke attributter som inneholder e-posten, visningsnavnet og gruppene. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Det samme som for LDAP: gruppe-til-rolle-parene, rollen for alle som ikke er i noen, om en konto lages ved første innlogging, og knappens navn. |

Uten attributtinnstillingene ser Cascade etter de vanlige navnene. E-posten er `email`, `mail`, `emailAddress`, LDAP-objekt-id-en `urn:oid:0.9.2342.19200300.100.1.3` eller claim-URI-en `.../claims/emailaddress`, og faller tilbake på NameID når det er en adresse. Navnet er `displayName`, `name`, eller fornavn og etternavn. Grupper er `groups`, `group`, `memberOf`, URI-en `.../claims/Group` og Microsofts gruppe-claim.

Dette bør du vite:

- **Be om en persistent id.** En konto er knyttet til NameID, og en transient er forskjellig ved hver innlogging. Cascade ber om en persistent og avviser en transient med en melding som sier det, i stedet for å lage en ny konto ved hver innlogging. Kan leverandøren din bare sende en transient id, oppgir du et stabilt attributt i `SUBJECT_ATTR`.
- **Leverandøren er autoriteten for adressen.** Som med LDAP kobles en eksisterende konto med samme e-post ved første SAML-innlogging.
- **Bak en proxy setter du `HOTLOOP_CASCADE_PUBLIC_URL` til adressen folk bruker.** Leverandøren sender POST til assertion consumer-URL-en som bygges fra den.
- **Bruk HTTPS.** Leverandøren svarer med en POST fra et annet nettsted, så informasjonskapselen som knytter en innlogging til nettleseren, må sendes på tvers av nettsteder, noe nettlesere bare tillater på en sikker forbindelse.
- **Mer enn én pod** trenger samme nøkkelpar på alle: legg det i en hemmelighet og oppgi det med `KEY_FILE` og `CERT_FILE`, ellers lager hver pod sitt eget.
- En andre faktor satt opp her teller fortsatt etter en SAML-innlogging, og SAML lar aldri leverandørens egen flerfaktor telle for den.
- Single logout støttes ikke. Å logge ut avslutter økten her.

## SCIM

I editoren: Innstillinger, Innlogging og SCIM viser om SCIM er på, basis-URL-en du skal gi leverandøren, og tokenene, med en knapp for å lage ett (vises bare én gang) og for å trekke tilbake ett. LDAP, SAML og OpenID Connect settes i instansens miljø når den starter, så samme skjermbilde viser hvilke som er på og hvor en leverandør peker (SAML-metadata- og ACS-URL-ene), og later ikke som det endrer dem.

SCIM er måten en identitetsleverandør holder kontoer i takt med katalogen sin: den oppretter en person når de begynner, endrer dem når de bytter, slår dem av når de slutter, og holder gruppene. Cascade er SCIM-serveren (RFC 7643 og 7644, versjon 2.0), og leverandøren er klienten. Den er bygget etter det RFC-ene sier og det vanlige identitetsleverandører sender, og blir prøvd i hver utgivelse mot scim2-tester, en SCIM-klient fra et annet team som kjører alle sjekkene den har. Den er av til du setter `HOTLOOP_CASCADE_SCIM=true`.

Slik setter du det opp:

1. Slå det på med `HOTLOOP_CASCADE_SCIM=true` og start på nytt.
2. Lag et token for leverandøren, som eier eller administrator av instansen: `POST /api/v1/scim-tokens` med `{"name": "plant directory"}`. `secret` i svaret (det begynner med `hlcs_`) vises bare én gang, så legg det inn hos leverandøren med en gang. `GET /api/v1/scim-tokens` lister dem med når hvert ble brukt sist, og `DELETE /api/v1/scim-tokens/{token}` trekker tilbake ett. En person må være logget inn for å lage et token: en API-nøkkel kan ikke, så en lekket nøkkel kan ikke lage flere.
3. Gi leverandøren basis-URL-en, `<public url>/scim/v2`, og tokenet som bearer-token.

Hvert kall trenger tokenet, og hvert svar er `application/scim+json`. Kallene står i revisjonsloggen med tokenets navn som aktør, så `user.created`, `user.disabled` og resten sier hvilken leverandør som gjorde det, sammen med SCIM-hendelsene `scim.user_deleted`, `scim.group_created`, `scim.group_updated` og `scim.group_deleted`.

### Hva det tilbyr

`/ServiceProviderConfig`, `/ResourceTypes` og `/Schemas` sier hva som støttes, og de sier bare det som er sant: filtrering, PATCH, ingen bulk, ingen sortering, ingen ETag-er, ingen passordendringer.

| Ressurs | Kall |
|---|---|
| `/Users` | `GET` (liste, med `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | det samme |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` med spørringen i body |

- **En bruker** er `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` og `active`. Kontoens e-post er den primære, ellers jobbadressen, ellers den første, ellers `userName` når det er en adresse. Alt uten adresse er en 400. Det leverandøren sender, returneres som det ble sendt: et navn den ikke sendte, blir ikke funnet på. `groups` kommer tilbake skrivebeskyttet.
- **En gruppe** er `displayName`, `externalId` og `members`, hvert medlem id-en til en bruker. Et medlem som ikke er en bruker, er en 400.
- **Filtre** har full syntaks: `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, parenteser og `attr[filter]`. Sammenligningen ignorerer store og små bokstaver, unntatt for `id` og `externalId`. Et ugyldig filter er en 400 med `scimType: invalidFilter`.
- **PATCH** tar `add`, `replace` og `remove` med eller uten sti, med verdistier som `emails[type eq "work"].value` og `members[value eq "id"]`, med hvilken som helst staving av store og små bokstaver, og en boolsk verdi som `true` eller som strengen `"False"` som noen leverandører sender. Den endrer nøyaktig det en PUT kunne endret.
- **Lister** står i den rekkefølgen kontoene ble laget, 100 per side med mindre `count` sier noe annet, 200 som mest.

### Hva det ikke gjør

- **Det viser eller endrer aldri eieren.** Instanseieren står ikke i listen, kan ikke hentes, patches eller slettes, og kan ikke legges i en gruppe. En e-post som tilhører eieren, er en konflikt.
- **Det sletter aldri en konto.** `DELETE` slår personen av, noe som avslutter øktene deres, tar dem ut av gruppene og skjuler dem for SCIM. Alt de har laget og hver revisjonsrad blir stående. Hvis leverandøren oppretter dem igjen med samme adresse, kommer den samme kontoen tilbake, påslått. `active: false` slår av uten å skjule.
- **En SCIM-konto har ikke passord.** Den logger inn gjennom OIDC, SAML eller LDAP, som kobler seg til den via adressen.
- **Det rører ikke prosjekter.** SCIM jobber med kontoer og instansroller. Hvem som er i hvilket prosjekt, avgjøres fortsatt her.

### Roller fra grupper

Som standard er en ny konto et medlem, og SCIM endrer aldri noens rolle. For at gruppene skal avgjøre, kobler du gruppenavn til roller:

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Rollen til en person følger da gruppene hver gang et medlemskap endres: den mektigste koblede rollen vinner, og den som ikke er i noen, får standarden. Bare `admin` og `member` kan kobles, fordi en leverandør aldri lager en eier. Bruk én kilde til roller. Hvis OIDC eller SAML også kobler grupper til roller, vinner den som sist endret rollen til en person, og de to vil kjempe mot hverandre.

Leverandøren trenger de samme gruppenavnene, og må sende gruppene med medlemmene sine, noe hver leverandør som støtter SCIM-grupper, kan.
