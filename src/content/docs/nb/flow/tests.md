---
title: "Tester ved siden av flytene"
description: "Skriv en testfil ved siden av en flyt, kjør den på en simulert klokke, la utrullingen avhenge av den, så forlater ingenting testen."
---

«Ødela endringen min linjen?» skal få svar før utrullingen, av den som gjør endringen, ikke klokken 03 om natten av den som har vakt. Derfor kan en flyt ha tester, og de er YAML som ligger ved siden av flytfilen og går gjennom samme gjennomgang:

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

Dette er den ekte kjøretiden og de ekte nodene, i prosessen, uten server og uten editor. Hver test får sin egen kjøretid, så ingenting en test etterlater i en Delay eller i en kontekst kan lekke over i neste.

- **`inject`** legger inn meldinger, i rekkefølge, og hver behandles før den neste går inn. En node med inngang får den der. En kilde som en Inject eller en MQTT In sender den ut av sin første utgang som om den selv hadde laget den, og en Inject-node uten melding får knappen trykket.
- **`expect`** følger med på utgangen til en node, med porter talt fra 1 slik editoren gjør. En node uten utganger, som en Debug, kontrolleres på det den mottok. En subflyt-instans følges på sine egne utganger, uansett hvor inne i den de kommer fra.
- **`msg`** er det meldingen må inneholde. Hver egenskap du oppgir må finnes med den verdien, helt ned, og alt annet på meldingen ignoreres, så en test om payload ryker ikke når noen begynner å sette `msg.topic`. **`assert`** er et JSONata-uttrykk som må bli sant, for kontroller en bokstavelig verdi ikke kan gjøre. **`error`** er teksten feilen som en Catch-node fanget, må inneholde.
- **`within`** er en frist. En melding som kommer for sent, feiler, og feilen sier hvor sent. **`nothing: true`** og **`count: N`** kontrolleres når flyten har blitt stille, som er det eneste tidspunktet «ingenting kom ut» betyr noe. To forventninger på én port er to meldinger, i den rekkefølgen.

En test slutter så snart alt den venter på har skjedd og flyten ikke har mer å gjøre. `timeout` er 5 sekunder med mindre du sier noe annet, på testens egen klokke, som er neste avsnitt.

En feil sier hva som kom ut i stedet og hvor det avviker:

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

En test som ikke kan kjøres, er en feil og ikke en bestått: en node den navngir som ikke finnes i flyten, et navn to noder deler, en port noden ikke har, eller en node i flyten som ikke starter. Det samme gjelder en feilstavet nøkkel. `expcet:` avvises når filen leses, fordi en skrivefeil som stilltiende ble hoppet over, ville latt en test stå uten noe å kontrollere, og en test uten noe å kontrollere består. Avslutningsstatus er 1 for alt som ikke er fullt bestått, og `-junit` skriver rapporten som alle CI-systemer leser.

## På testens klokke

Ingen kjører en testsuite som venter ut en Delay på fem minutter, så en test venter ikke. Den har sin egen klokke og flytter den rett til det neste noe i flyten venter på: en Delay som slipper, den andre meldingen fra en Trigger, en Inject på intervall eller crontab, en Join eller Batch som går ut på tid, en Link Call som gir opp. Tidtakeren utløses, flyten behandler det den sendte, og først da leter klokken etter det som forfaller neste gang, i samme rekkefølge som de virkelige minuttene ville gitt. Fem minutter Delay er ett steg og omtrent ett millisekund.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** legger en injeksjon på et tidspunkt på testens klokke, og alt som forfaller før det, skjer først. **`within`** og **`timeout`** går også på den klokken, så `timeout: 1h` på en flyt med en Inject hvert tiende minutt er seks tikk og noen få millisekunder. **`clock`** setter når testen starter, for en flyt som bryr seg om klokkeslettet: en crontab som utløses halv sju, utløses når testens klokke viser halv sju. `Date` i en Function-node, tidsstempelet til en Inject, en Change-node som setter en dato og `Expires` på en informasjonskapsel leser alle samme klokke, så en flyt som stempler og sammenligner tider stemmer med seg selv under en test.

Suiten beviser hver tidsnode i paletten mot den, til millisekundet: Delay i modusene fast, tilfeldig, rate og tidsstyrt, Trigger med extend, Inject på intervall, én gang ved oppstart og på crontab, tidsavbrudd i Join og Batch og en Link Call som aldri får svaret sitt. Alt sammen, en times anleggstid inkludert, kjører på godt under ett sekund. Det en test ikke kan flytte, er CPU-en: en flyt som fortsatt er opptatt etter ett minutt ekte tid, får testen til å feile i stedet for å henge suiten. JSONata `$now()` og `$millis()` leser fortsatt veggklokken.

## Tester fra editoren

Ingen skriver en test for en flyt som virker. De skriver den dagen den slutter å virke, som er en dag for sent. Derfor lager editoren en ut av det flyten nettopp gjorde, med to klikk.

Hver melding i feilsøkingssidepanelet har en **Test**-knapp. Klikk på den, så lager editoren et testutkast fra akkurat den meldingen: det som kom inn ved kilden det kom inn gjennom, lagt inn igjen, og det denne Debug-noden viste, forventet her. Endre det du vil, for en måling med tidsstempel kontrolleres bedre med en `assert` enn spikret til millisekundet. Klikk **Add to tests**, så ligger den i suiten ved siden av flytfilen, helt til slutt, og alt som allerede sto der, blir stående nøyaktig som det var, kommentarer inkludert. Et navn suiten allerede har, får et nummer bakpå i stedet for å erstatte noe.

Slik vet editoren hva som kom inn: kjøretiden beholder de siste 64 meldingene som kom inn i flyten ved en kilde og de siste 64 som nådde en Debug-node, under id-en en melding bærer fra node til node. Det er en ring med en størrelsesgrense, og en melding over 64 KB beholdes ikke i det hele tatt, så den kan aldri bli det som får en pod til å vokse. En melding som er skjøvet ut, eller som en node byttet ut med en ny underveis, kan ikke gjøres om til en test, og editoren sier det i stedet for å gjette hva som kom inn.

**Tests**-panelet kjører suiten mot arbeidskopien, utrullet eller ikke, og det er poenget: du finner ut av det før utrullingen. Hver node en bestått test gikk gjennom, får et hakk, hver node en feil gjelder, får et kryss med årsaken ved hold over, og et klikk på en feil tar deg til noden. Endre hva som helst, så forsvinner merkene, fordi de beskriver en flyt som ikke finnes lenger. **Edit** åpner hele suiten som YAML. En utrulling som [porten](#utrullingsporten) nekter, havner i samme panel, med feilene på nodene.

Alt dette kjører i en ekte nettleser mot den ekte binærfilen ved hver pull request.

## Utrullingsporten

Tester på noens bærbare viser flyten vedkommende hadde på sin bærbare. Porten viser den som rulles ut. Ha suiten på instansen, ved siden av flytfilen den tester (`data/flows.test.yaml` ved siden av `data/flows.json`, via `PUT /tests` eller editoren), slå på `tests.gate`, og hver utrulling kjører den mot flytene den er i ferd med å sette på plass. En som ikke består, nektes, med en 422 og hele rapporten:

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

Det er en ekte kjøring: binærfilen med porten på, suiten fra toppen av denne delen lagret ved siden av flytfilen sin, og et utrullingstoken.

**Flytene som allerede kjører, merker ingenting.** Porten kjører før en eneste byte er skrevet: ingen flytfil, ingen legitimasjon, ingen utrullingspost, ingen omstart. Avslaget havner i revisjonssporet som en `deploy.refused` som sier at testene feilet. Og testene kjører ikke i serverprosessen i det hele tatt. De kjører i en barneprosess, denne samme binærfilen som `hotloop-flow test -stdin`, som får kandidatflytene og suiten på stdin, fordi en test starter hver node i flyten, og noen av dem registrerer seg der hele prosessen deler dem: en Link In med id-en sin, en HTTP-rute med stien sin. Kjørt her inne ville kandidatens Link In svart for den kjørende flytens så snart den startet. I et barn kan den ikke røre noe linjen bruker, en node som går i panikk i sin egen goroutine, tar ned testen og ikke anlegget, og minnet frigis når den avslutter. Testen beviser det på den harde måten: den avviste kandidaten har samme Link In, og etter avslaget kommer en melding gjennom den kjørende flytens lenke fortsatt fram.

Tre avgjørelser det er greit å kjenne til. **Den er av som standard**, fordi en port operatøren ikke ba om, er en utrulling som feiler klokken 03 av en grunn ingen på vakt har hørt om. **Tester som ikke kan kjøres, består ikke**: et barn som ikke starter, eller en kjøring som varer lenger enn `tests.timeout`, nekter utrullingen og sier hvilket av dem. Og **tilbakerullinger går ikke gjennom porten.** En tilbakerulling er veien ut av en dårlig tilstand til en som allerede har kjørt, og å holde den igjen på grunn av dagens tester er måten å gjøre et avbrudd lengre på. Med porten på og ingen suite er det ingenting som kan feile, så utrullingen går gjennom og loggen sier hvorfor den ikke ble kontrollert.

## Kontekst og legitimasjon

Hver test starter med tom kontekst, uansett hva testen før den etterlot. En teller en test har skrudd til 42, er ikke der den neste starter, for en suite der den andre testen bare består hvis den første kjørte først, er en suite som lyver den dagen noen kjører én test alene. Så en test som trenger en teller på 41, sier det, og sier hva konteksten må inneholde når den er ferdig:

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` i en forventning sammenlignes som `msg`, og `null` betyr at nøkkelen ikke må være satt. En feil sier hva omfanget faktisk inneholder, siden det vanlige svaret er en skrivefeil: `flow context of "Line 3" (t1): cuont: not set; it holds count`.

En test ser aldri den virkelige legitimasjonen. Den kjører med den den navngir, og det er det som gjør den trygg å sjekke inn, og den når en node nøyaktig slik den virkelige ville gjort: passordet i en HTTP-forespørsel dukker opp i `Authorization`-headeren den ville sendt, og en InfluxDB-konfigurasjon som ikke starter uten token, starter med testens. En node som leser et passord fra en montert fil gjennom `ew_credentialFiles`, får testens legitimasjon for det feltet i stedet, fordi en test ikke leser noe fra disken, og en tom en når testen ikke navngir noen.

Konteksten lever i minnet under en test, aldri i tilstandsdatabasen, så en test kan ikke lese det de kjørende flytene har etterlatt eller etterlate noe til dem. En fixture er YAML i testen, ikke en fil som later som den er en database.

## Ingenting forlater testen

En test som kjørte MQTT Out-noden din på ekte, ville publisert til anleggets broker, og da er den ikke en test, den er en utrulling. Derfor får under en test hver node som snakker med verden utenfor prosessen en stand-in: MQTT inn og ut, HTTP in, response og request, PostgreSQL, InfluxDB, TCP og UDP inn, ut og request, WebSocket inn og ut med lytteren og klienten bak, filnodene, `exec`, `scan` og `netinfo`.

Noden gjør fortsatt hele jobben sin helt fram til ledningen. MQTT Out finner fortsatt ut topic, QoS og bytene; HTTP Request lager fortsatt URL-en, bygger innholdet og følger omdirigeringer; PostgreSQL-noden bygger fortsatt SQL-en og parameterne. Så overleverer den det til stand-inen, som registrerer det og svarer med det testen har satt opp. Uten oppsett er svaret ingenting og suksess: ingen rader, en tom 200, en kommando som avsluttet med 0. Kildene (MQTT In, HTTP In, TCP og UDP In, WebSocket In, Watch) abonnerer ikke, lytter ikke og poller ikke, så det som kommer, er det testen injiserer.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** er det noden ville ha sendt, sammenlignet som `msg`. **`replies`** setter opp det som kommer tilbake: det første svaret som er oppført for en node, besvarer det første kallet, det neste det andre, og det siste fortsetter å svare, så «den svarte, så sluttet den» er to linjer. **`error`** får kallet til å feile slik det virkelige gjør, så veien flyten din tar når historikeren er nede, testes før historikeren er det.

| Node | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` for en spørring, `rowCount` for en insert |
| InfluxDB | `line`, linjeprotokollen | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` ved svar) | |
| TCP Request | `host`, `port`, `payload` | `payload`, lest slik noden leser et ekte svar |
| WebSocket Out | `payload` (`session` ved svar) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, innholdet |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Noen få ting kontrollerer ikke en test, med hensikt, fordi de hører til maskinen og ikke flyten: tillatelseslisten for `exec`, sti- og oppdagelsesomfangene og sertifikatene i en `tls-config`. Under en test kjører, åpnes, sondes eller ringes ingenting, så det er ingenting for dem å avgrense eller kryptere, og utrullingen svarer fortsatt for alt dette på maskinen den havner på.

Beviset er en test som peker hver av disse nodene mot en TCP-port, en UDP-port og en katalog testen eier, kjører en måling gjennom alle, kontrollerer byte for byte hva hver ville sendt, og så teller: null tilkoblinger, null datagrammer, ingen filer skrevet, ingenting kjørt. En node som rekker utenfor og ikke har noen stand-in, avvises ved navn før noe kjører, og palett-testen feiler hvis noen legger til en.
