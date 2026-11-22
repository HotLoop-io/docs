---
title: "Hver utrulling er en journal"
description: "Hvem, når, hvorfor og de eksakte bytene i hver utrulling, sammenlignet node for node i API, CLI og git, med en tilbakerulling som beholder påloggingsdata."
---

«Hva er endret, hvem endret det, sett det tilbake» er det første alle spør om etter at en linje har stoppet. Tre `.bak`-filer svarer ikke på noe av det. De vet ikke hvem, de roterer etter tre lagringer, og den du trenger er alltid den fjerde.

Derfor skriver hver utrulling en uforanderlig post under `data/deployments/`: hvem som rullet den ut (fra tokenet deres, aldri fra noe klienten påstår), hvorfra, når, notatet de la igjen, revisjonen den erstattet, flytfilen byte for byte og påloggingsdataene slik de sto etter utrullingen, kryptert nøyaktig som påloggingsfilen. Poster legges bare til. Loggen beholder de siste 100 som standard (`history.retain`, og 0 beholder alle), og den beskjærer aldri den nyeste, fordi den nyeste er den som kjører.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

Et notat følger med utrullingen, som `"note"` i det innpakkede dokumentet (`{"rev": ..., "flows": [...], "note": "..."}`) eller som en `HotLoop-Flow-Deployment-Note`-header. Dokumentformen finnes fordi en nettleser ikke legger noe utenfor Latin-1 i en header, og folk skriver notater på sitt eget språk.

Den gjør to ting du først ville savnet etter at de hadde bitt deg:

- **En manuell redigering blir fanget opp.** Hvis flytfilen på disk ikke er det siste loggen registrerte, fordi noen redigerte den mens prosessen sto stille, registrerer oppstarten den som en `baseline`-post som sier det. Det samme ved første oppstart med en flytfil som allerede finnes. Ellers blir en manuell redigering i det stille til en fortid ingen skrev ned.
- **En logg som ikke kan skrives stopper ikke linjen.** Flytfilen er allerede lagret da, så å avvise utrullingen ville latt disken og flytene som kjører være uenige til neste omstart. Utrullingen går gjennom, og både svaret og loggen sier, med ord, at denne ikke har noen post.

API-et gir aldri ut påloggingsdataene i en post, kryptert eller ikke. De holdes for én oppgave, å sette dem tilbake, og et historikkendepunkt er ikke en måte å gå av gårde med dem.

## Diffen leses som en gjennomgang

En linjediff av en flytfil er ærlig og ubrukelig. Dra en node tjue piksler, og det er en endring. Endre en terskel, og det er en endring. Den som gjennomgår kan ikke se hvilken av dem som snart stopper en presse. Derfor sammenligner Flow node for node:

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Lagt til, fjernet og endret, egenskap for egenskap med gammel og ny verdi, hvilke koblinger som flyttet seg etter utgangsport, og **layout holdt adskilt fra logikk**: å flytte, endre størrelse på eller skjule en etikett er «flyttet på lerretet», aldri en endring, så en opprydding leses som en opprydding. En påloggingsdata leses som «satt» eller «endret», aldri med verdien. Redigeringer inne i en subflyt vises på subflyten, og å dra en av portene er også layout.

Samme svar overalt, fra én pakke i motoren:

- `GET /deployments/{from}/diff/{to}` sammenligner to utrullinger.
- `POST /flows/diff` sammenligner det som kjører med et dokument ingen har rullet ut ennå, som er det du ser på før du trykker Deploy.
- `hotloop-flow diff old.json new.json` på kommandolinjen. `-json` for et program. Avslutter med 1 når noe er forskjellig, som `diff`.
- **Inne i git.** Gjør den til gits diff-driver for flytfiler, så skriver `git diff`, `git log -p` og `git show` den semantiske diffen i stedet for en JSON-blokk:

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  Eller som difftool: `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, så `git difftool -t hotloop-flow`.

En flyt som sammenlignes med seg selv er ingen endring i det hele tatt, for ethvert dokument parseren godtar.

## Sett det tilbake

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

En tilbakerulling ruller ut en gammel post igjen **som en ny post**. Historikken forblir bare-tillegg: utrulling 41 røres ikke, og tilbakerullingen er sin egen post som sier «tilbakerulling til utrulling 41», hvem som gjorde det og hvorfor. Flytfilen kommer tilbake byte for byte, så det er den samme revisjonen som den gang.

**Påloggingsdataene kommer også tilbake.** Hver post bærer dem slik de sto, så en node du slettet kommer tilbake med meglerpassordet sitt i stedet for å komme tilbake og ikke få logget inn. Det er testet mot en ekte Mosquitto som avviser anonyme klienter: slett abonnenten, rull ut, rull tilbake, og den logger inn igjen og meldinger flyter.

Den avviser på tre måter, før noe skrives. En foreldet `HotLoop-Flow-Deployment-Rev` får samme 409 som en utrulling ville fått, fordi en tilbakerulling i kappløp med noen andres utrulling fortsatt er et kappløp. En utrulling som oppbevaringen allerede har fjernet er en 404. Og en post der påloggingsdataene ikke kan dekrypteres med den gjeldende påloggingshemmeligheten er en 422, fordi flyter som ikke kan logge inn noe sted er en tilbakerulling som bare ser ut til å ha virket.

## I editoren

**Deploy ruller ikke ut.** Den åpner en gjennomgang: motorens diff mot det som kjører, tegnet på lerretet og listet med ord, med en boks for notatet. Grønt er lagt til, gult er endret, blått er bare flyttet, og røde spøkelser står der fjernede noder og koblinger var. En fane med noe endret får en prikk. Den andre Deploy-knappen er den som ruller ut, og notatet går i loggen. Rediger hva som helst mens gjennomgangen er åpen, og den lukkes, fordi en gjennomgang av noe du siden har endret er en løgn om det du er i ferd med å sende.

**Historikkpanelet** lister hver utrulling med hvem, når og notatet. *Changes* åpner den utrullingen på et skrivebeskyttet lerret med det den endret tegnet på, over arbeidskopien din, som forblir akkurat slik du forlot den. *Roll back* spør hvorfor, advarer deg hvis du er i ferd med å kaste ulagrede endringer, og ruller den ut.

**En utrullingskonflikt viser hva den andre gjorde.** Det pleide å være en nettleser-`confirm()` som ba deg overskrive den andres arbeid eller miste ditt uten å si hva den andres var. Nå sier den hvem som rullet ut, når, notatet deres og endringen deres node for node, og lar deg så laste inn deres, overskrive med ditt eller fortsette å redigere.

**Kopier, klipp ut og lim inn virker som du forventer, og de snakker flytfilen.** Velg noder, Ctrl+C, og det som ligger på utklippstavlen er den samme JSON-en som alle andre flytverktøy leser, så du kan lime den inn i en chat, en sak eller en annen boks. Innliming setter den der pekeren din er, med nye id-er hver gang, så to ganger gir to kopier og aldri en kollisjon. En kobling til noe du ikke kopierte kuttes i stedet for å peke på ingenting, og en konfigurasjonsnode nodene bruker følger med. Hvis den konfigurasjonsnoden allerede finnes i flyten du limer inn i, deler kopien den i stedet for å åpne en ny tilkobling til noe som teller dem. Påloggingsdata havner aldri på utklippstavlen. Et passord i en innlimingsbuffer er slik det ender i en feilrapport.

**Import og Export** gjør det samme for et utvalg, én flyt eller alt, med en boks å kopiere fra, en Download-knapp og en filvelger på vei inn. Søppel får en begrunnelse («id-en a forekommer to ganger», «oppføring 1 har ingen id») og dialogen forblir åpen. En nodetype denne kjøretiden ikke har kommer inn grå og stiplet, og importen forteller deg hvilke, fordi en node som stille forkastes er verre enn en som lager lyd.

En skjerm er en del av den filen. Dashbordet en flyt tegner (`ui_tab`, `ui_group` og widgetene) er noder i flyten, så en kundes skjermer reiser med flytene deres gjennom Export og Import, og ingen av dem bor i HotLoop Flow selv.

**Subflyter redigeres på sitt eget lerret.** Trykk *+ subflow*, og den åpnes med inn- og utgangsportene sine. Koble dem til nodene inni som alt annet. *Subflow properties* setter navnet, fargen, hvor mange utganger den har og egenskapene en instans kan sette. Instanser i flyter følger med når formen endres, og paletten lister hver subflyt så du kan slippe en. Dobbeltklikk på en instans for å gi den et eget navn og en egen verdi for hver egenskap. En subflyt kan ikke plasseres inni seg selv eller inni en som inneholder den, og en som fortsatt er i bruk kan ikke slettes. Editoren sier det i stedet for å la neste utrulling finne det ut.

**Utvalg til subflyt.** Velg noder og trykk *Selection to subflow*. De flytter inn i en egen subflyt og en instans tar plassen deres. Hver kobling som krysset kanten av utvalget blir en port: den ene veien inn er subflytens inngang, og hver utgang fra en valgt node som gikk et annet sted er en utgang fra subflyten, så flyten gjør det den gjorde. En subflyt har én inngang, så hvis utvalget er koblet til to ulike noder, sier den det og endrer ingenting, fordi å mate begge fra begge ville vært en annen flyt. Velg en gruppe, og den følger med alt i den. En konfigurasjonsnode som hører til flyten og bare brukes av utvalget flytter inn i subflyten sammen med det den peker på. En som noe som ble igjen også bruker blir global i stedet, slik at begge ender fortsetter å dele den ene tilkoblingen, fordi en andre meglertilkobling på en boks som teller dem er den typen overraskelse vi ikke leverer. Miljøvariabler de flyttede nodene leser (typet som env, som `${NAME}` eller `$(NAME)` i en streng, eller `env.get`) og som flyten deklarerer blir egenskaper på subflyten som videresender til flyten, så verdien fortsatt kommer fra der den kom fra og instansen kan overstyre den. Ctrl+Z angrer alt.

**Flyter.** Dobbeltklikk på en fane, eller trykk *Flow properties*, for å gi den nytt navn eller slette den. Sletting spør, tar med seg hver node på flyten, og kutter koblingene og lenkene andre flyter hadde inn til den, så filen ikke blir stående og peke på ingenting. Den tar også de slettede nodene ut av ethvert Catch-, Status- eller Complete-omfang som nevnte dem. En Catch eller Status der hele listen ble slettet beholder sin siste id, siden en tom liste betyr hele flyten og vi ikke skal flippe en node fra å se på én ting til å se på alt bak ryggen din. Ctrl+Z henter den tilbake til du ruller ut. Den siste flyten kan ikke slettes, fordi en kjøretid uten flyt ikke har noe sted å plassere en node.

**Konfigurasjonsnoder** ligger i paletten under *configuration*. De ligger på ingen lerret, så du dobbeltklikker på typen, fyller ut dialogen, og den legges til i listen under *configuration in use*, der et dobbeltklikk redigerer den og krysset sletter den. En som en node fortsatt bruker lar seg ikke slette, og sier hvor mange som bruker den. Dit sender «Add one from the palette first» i en nodes dialog deg.

**Slette en kobling.** Alt-klikk. Et vanlig klikk gjør ingenting, så å streife en kobling mens du velger kan ikke ødelegge en flyt. Ctrl+Z setter den tilbake.

**Varige koblinger.** Dobbeltklikk på en kobling. Kryss av for *Durable*, så tegnes den tykkere og blå, og noden den går ut fra får `ew_durable` i filen. Merket ligger på nodeparet, så det gjelder hver kobling mellom dem. Det er kobling mot kjøretiden, så å merke en starter aldri noden på nytt.

**Grupper.** Ctrl+G pakker inn utvalget, Ctrl+Shift+G tar det fra hverandre. Dobbeltklikk på tittellinjen for å gi den navn og farge. Dra en gruppe, og alt i den følger med. Dra en node inn i en, og den blir med, dra den ut, og den forlater den. Grupper kan nøstes. Å slette en gruppe sletter det som er i den, og Ctrl+Z setter alt tilbake.

**Søk** (Ctrl+F, eller knappen) ser i alle flyter og subflyter samtidig: navn, typer, id-er og hver innstilling, også en linje midt i kroppen på en funksjon. Et treff tar deg til riktig fane med noden valgt og midt i visningen. Konfigurasjonsnoder dukker også opp, og treffet deres åpner dialogen deres, siden de ikke har noen plass på et lerret.

**Feilsøkingsfiltrering.** Snevre inn sidepanelet til én flyt, til nodene du har valgt, til et ord eller bare til feilene. Det gjelder det som allerede ligger i loggen, ikke bare det som kommer neste, så innsnevring får aldri linjen du så på til å forsvinne.

Alt dette klikkes gjennom i en ekte nettleser på hver pull request, mot den ekte binærfilen med editoren innebygd. Det inkluderer hver nodedialog kjøretiden tilbyr: listen kommer fra `GET /nodes`, så en node som legges til neste måned er med i testen neste måned uten at noen husker å legge den til. Da vi skrev testene fant vi to ting som aldri hadde virket i Chromium: dobbeltklikk på en node for å åpne dialogen og det å dra en kobling over på en node. Lerretet holder pekeren gjennom hele draget, så hendelsens mål var alltid lerretet og en kobling sluppet over en node fant aldri noden. Begge så pinlige som feil kan bli i en visuell editor. Begge rettet.

## Flyter som kode

Repositoryet er der flyter blir gjennomgått, så repositoryet bør kunne rulle dem ut. Ha flytfilen i git, sett opp diff-driveren over så pull requesten leses som en gjennomgang, og la sammenslåingen rulle den ut:

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` skriver ut diffen mot det som kjører, den samme teksten som overalt ellers, og ruller så ut mot revisjonen den diffen ble laget fra. Hvis noen ruller ut imellom, er det en 409 og en rød pipeline, ikke en stille overskriving. `-expect-rev` fester det til revisjonen en gjennomgått plan ble laget mot, og `-dry-run` skriver ut diffen og ruller ikke ut noe. En fil uten noe å endre ruller ikke ut noe og legger ikke noe til i historikken, så en sammenslåing som ikke rørte flytene forsøpler ikke loggen. En node som ikke starter rulles ut og lar jobben likevel feile, fordi resten av flyten kjører og noen må se på det. `export -deployment 41` henter hvilken som helst utrulling ut av historikken.

**En pipeline holder aldri et administratorpassord.** Den får et API-token:

```bash
hotloop-flow token -name ci
```

skriver ut et token, én gang, til hemmelighetslageret til pipeline, og hashen som gis til kjøretiden: `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` for et utrullingstoken, eller `auth.tokens` i konfigurasjonsfilen for alt annet. Kjøretiden holder bare hashen, som med et passord. Et utrullingstoken kan lese flytene og rulle ut, som inkluderer tilbakerulling, og ingenting annet: ingen innstillinger, ingen inject, ingen editor. Begge kommandoene leser tokenet fra `HOTLOOP_FLOW_TOKEN` (eller `-token-file`) og instansen fra `HOTLOOP_FLOW_URL` (eller `-url`), aldri et token på kommandolinjen, der det ville havnet i prosesslisten og i hver pipeline-logg som gjentar kommandoen. Historikken viser tokenet som den som rullet ut, `token:ci`, med notatet pipelinen ga.

Påloggingsdata reiser aldri denne veien. De ligger ikke i flytfilen, så en utrulling fra git lar hvert meglerpassord stå akkurat der det var.

## Et git-speil, hvis du vil ha et

Utrullingsloggen ligger på boksen. Et repository er der alle andre allerede ser: det har en nettvisning, blame, sikkerhetskopier og folk som kan lese det. Pek Flow mot et, og hver utrulling blir en commit av flytfilen på en gren bare Flow skriver til, **med den som rullet den ut som forfatter**, på det tidspunktet de rullet den ut, med notatet deres som melding:

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

Passordet er et tilgangstoken fra git-serveren, og det legges i `HOTLOOP_FLOW_GIT_PASSWORD` fra en Secret, aldri i filen (`HOTLOOP_FLOW_GIT_URL` og `HOTLOOP_FLOW_GIT_USERNAME` virker også). En URL med passord i avvises ved oppstart, så URL-en alltid kan logges. Bare `http://` og `https://`: containerimaget har ingen git-binærfil for `file://` og ingen nøkler for `ssh://`, og et speil som feiler på hver push er verre enn et som nekter å starte. Tilbakerullinger og oppstartsgrunnlinjer sier hva de er i committen, og hver commit bærer en `Flow-Deployment: N`-trailer, som er hvordan en omstartet prosess, eller en der klonen ble slettet, tar opp igjen akkurat der repositoryet sier den kom til, uten duplikat.

**Det holder aldri opp en utrulling.** Pushingen skjer i sin egen goroutine. En git-server som er nede, treg eller nekter pushen koster en utrulling ingenting: commitene venter i en lokal klon under `data/git-mirror` og går ut ved neste push som virker, forsøkt på nytt hvert minutt. `GET /deployments` sier hvor langt speilet kom og siste feil, og `hotloop_flow_git_mirror_behind_deployments` er tallet du bør varsle på. Testet mot gits egen smart-HTTP-server bak basic-autentisering: tre utrullinger gir tre commits av tre forfattere, en push serveren nekter venter og tar igjen når den slutter å nekte, og en utrulling med en git-server som bruker ti sekunder på å si nei kommer tilbake på millisekunder.

Det er ren Go (go-git), så binærfilen forblir statisk. Det koster omtrent 3.8 MB binærfil, og derfor er det målt og ikke antatt. Binærfilen var 48,083,106 byte før katalogene.
