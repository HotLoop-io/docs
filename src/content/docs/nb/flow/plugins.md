---
title: "Plugins uten npm"
description: "En plugin er en signert WebAssembly-modul med minnetak, tidsavbrudd og beskrivelsesfil, og den får ingen tilgang til verten med mindre du gir den det."
---

En Node-RED-fellesskapsnode er en npm-pakke. Den trenger Node.js på boksen, og når den er installert, kjører den inne i kjøretidens egen prosess med alt den prosessen kan nå. Flow kjører ikke slike noder og kommer aldri til å gjøre det, så dette er hva den gjør i stedet: en plugin er en WebAssembly-modul i en sandkasse med et minnetak og et tidsavbrudd, den kommer med en beskrivelsesfil som editoren tegner dialogen sin fra, den er signert, og den får ingen tilgang til verten med mindre den ber om det og du gir den det.

Hva det betyr for deg: du kan lese hele kontrakten til en plugin i én JSON-fil før den kjører, boksen avviser alt som ikke er signert av en nøkkel du har valgt, og det verste en feilaktig plugin kan gjøre, er å la sine egne meldinger feile.

## Hva en plugin er

En mappe under `<data.dir>/plugins/` (eller `plugins.dir`), oppkalt etter pluginen, med tre filer:

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Hver plugin blir én nodetype, `wasm-<name>`, i Function-delen av paletten. Plugins leses når Flow starter, så å legge til eller endre en er en omstart. Ingenting leses når meldingen behandles.

### Modulen

ABI-en er den i [README](/nb/flow/sandboxes/): `hotloop_flow_process` og `hotloop_flow_alloc` er påkrevd, `hotloop_flow_free` er valgfri, og alt krysser som JSON. En gjest får `{"msg": {...}, "config": {...}}` og returnerer `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`. En meldingsegenskap som ikke er vanlig JSON, som svarhåndtaket en HTTP In-node legger ved eller en binær buffer, gis ikke til gjesten. Noden holder den tilbake og legger den på igjen på hver melding gjesten sender, med mindre gjesten selv har satt den egenskapen, slik at en plugin kan sitte mellom en HTTP In og en HTTP Response. `config` er det nodens dialog inneholder. En `error` får meldingen til å feile til en Catch-node, og det som ble sendt før det, er fortsatt sendt.

Modulen kan importere WASI og, hvis den har oppgitt en kontekstevne, de to kontekstfunksjonene nedenfor. Alt annet den importerer, avvises når pluginen lastes, og avvisningen navngir importen.

### Beskrivelsesfilen

`plugin.json` leses strengt. Et felt Flow ikke kjenner, er et avslag, så en feilstavet `"capabilites"` fanges i stedet for å bli en plugin som i stillhet ba om ingenting.

| Felt | <span class="sr-only">Detaljer</span> |
|---|---|
| `format` | `1`. Påkrevd. |
| `name` | Små bokstaver, sifre og bindestreker, opptil 40, og starter med en bokstav. Må samsvare med mappenavnet, fordi det er det `plugins.grants` og flytfilen bruker. |
| `version` | Påkrevd. Vises i nodens hjelp og i `GET /plugins`. |
| `label`, `description`, `help` | Paletteetiketten, én linje og Markdown for infofeltet. |
| `inputs`, `outputs` | Innganger må være 1. Utganger 0 til 16, standard 1. |
| `props` | Dialogen. De samme egenskapsdeklarasjonene som de innebygde nodene bruker, med typene `string`, `text`, `number`, `bool`, `select`, `json` og `list`. Legitimasjon, referanser til konfigurasjonsnoder og kodeeditortypene avvises: en plugin har ingenting med dem å gjøre. |
| `capabilities` | Vertstilgangen den ber om. |
| `limits` | `memoryMiB` og `timeoutMs` den vil ha som standard. |

Editoren tegner dialogen fra `props` uten noen kode fra pluginen i nettleseren. Hver plugin-node får også et felt for navn, minnegrense og tidsavbrudd. Disse tre navnene er reservert.

## Grenser, og hvordan en felle ser ut

Hver plugin-node har sitt eget minnetak og sitt eget tidsavbrudd. Pluginens beskrivelsesfil setter standardene (16 MiB og ett sekund når den ikke sier noe), en node kan endre dem i dialogen sin, og `plugins.maxMemoryMiB` (64) og `plugins.maxTimeout` (5s) er det boksen overhodet tillater. En node som ber om mer enn boksen tillater, får utrullingen til å feile og sier hvilken innstilling som må økes.

En gjest som vokser forbi taket sitt, utløser en felle. En gjest som fortsatt kjører når tidsavbruddet inntreffer, stoppes. Uansett går meldingen til nærmeste Catch-node, instansen kastes slik at neste melding starter rent, og ingen andre noder berøres. Det Catch-noden ser i `msg.error.message`:

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

Taket reserveres på forhånd: en node med et tak på 64 MiB bokfører 64 MiB av Go-heapen så lenge instansen finnes, enten gjesten rører den eller ikke, fordi å la en buffer vokse ved å kopiere den ville latt verten kortvarig holde flere ganger taket. Testen som beviser det, måler hva et kall allokerte til sammen (256 MiB for et tak på 256 MiB) og at heapen er tilbake der den startet etter fellen. Så sett takene til det en plugin trenger, ikke til det største tallet du kan skrive.

## Evner

Ingen evne, ingen tilgang. Hver enkelt kobles inn bare når beskrivelsesfilen ber om den og `plugins.grants` gir den til den pluginen ved navn.

| Evne | Hva den gir | Uten den |
|---|---|---|
| `clock` | De virkelige vegg- og monotone klokkene. | Gjesten ser en erstatningsklokke som starter 2022-01-01 og ikke har noe med anleggets å gjøre. |
| `random` | Operativsystemets tilfeldige byte. | Den samme faste sekvensen hver gang. |
| `context.flow` | Lese og skrive flytkonteksten til nodens egen flyt. | Kontekstfunksjonene finnes ikke for den. |
| `context.global` | Lese og skrive den globale konteksten. | Det samme. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Å be om noe som ikke er gitt, feiler ikke når meldingen behandles. Det får utrullingen til å feile: flyten avvises med en 422 før noe skrives, flytene som kjører merker det aldri, og meldingen navngir noden og linjen som skal legges til:

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

En tilbakerulling er en utrulling, så en tilbakerulling til flyter som bruker en plugin hvis tillatelse siden er trukket tilbake, avvises på samme måte. En plugin som er installert men ikke gitt tillatelse, vises fortsatt i paletten, med evnene sine i hjelpen.

### Kontekstfunksjonene

En gjest som oppgir en kontekstevne, kan importere disse fra modulen `hotloop_flow`. Verdier krysser som JSON.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

Omfanget er `0` for flyt og `1` for global. `context_get` returnerer lengden på JSON-en og skriver den bare hvis den får plass i `outCap`, slik at en gjest som får tilbake mer enn den tilbød, prøver igjen med en større buffer. En nøkkel som ikke finnes, er `-1`, og `-2` betyr nektet: omfanget var ikke gitt, nøkkelen eller JSON-en var feil, eller lageret sa nei. En gjest kan ikke lese et omfang den ikke har fått ved å prøve seg frem.

## Signering, og å stole på en utgiver

En plugin signeres med en ed25519-nøkkel. Signaturen dekker begge filene, ikke bare modulen, fordi beskrivelsesfilen er der en plugin ber om tilgang. Signerer man bare modulen, kunne alle med skrivetilgang til mappen legge en evne til en signert plugin. Den signerte meldingen er:

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

Ingenting slås opp når en plugin lastes: ikke nettverk, ikke gjennomsiktighetslogg, ikke sertifikatkjede. Sjekken er signaturen, nøkkelen den navngir og listen din over nøkler. Det er et bevisst valg for en boks på et anleggsnettverk som kanskje ikke har noen vei ut. Det betyr også at det ikke finnes noen tilbakekallingstjeneste, så å tilbakekalle en nøkkel er å fjerne den fra `plugins.trustedKeys` og starte på nytt.

### Som utgiver

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` skriver en privat PKCS #8-nøkkel og en offentlig PKIX-nøkkel som PEM, de samme filene som `openssl genpkey -algorithm ed25519` og `openssl pkey -pubout` lager, og nekter å overskrive noen av dem. Den skriver ut nøkkel-id-en og enlinjeformen til den offentlige nøkkelen. Hold den private nøkkelen utenfor git. Ingen nøkkel committes.

### Som operatør

På Helm-chartet er disse `plugins.trustedKeys`, `plugins.grants` og `plugins.volume`, i [Utrulling av Flow](/nb/flow/deploying/).

Du stoler på en utgiver ved å legge den offentlige nøkkelen deres i `plugins.trustedKeys`, eller i `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, kommaseparert. Hver oppføring er linjen `ed25519:<base64>`, en offentlig PEM-nøkkel eller stien til en fil som inneholder en, og det er slik en montert Secret eller ConfigMap kommer inn:

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Uten klarerte nøkler avvises alle plugins. En nøkkel du ikke kan tolke, er en oppstartsfeil. Tillit gjelder per nøkkel og ikke per plugin, så å stole på en utgiver er å stole på alt de signerer. Hva en plugin så kan bruke, er en egen beslutning, tatt i `plugins.grants` ved navn.

## Når den avviser

En plugin som ikke lastes, logges ved oppstart, listes med årsaken i `GET /plugins`, mangler i paletten og navngis i avvisningen når en flyt som bruker den, utrulles. En dårlig plugin hindrer aldri resten av Flow i å starte. `hotloop-flow plugin verify` kjører de samme sjekkene, så en utgiver ser det en operatør ville sett.

| Hva som er galt | Hva den sier |
|---|---|
| Ingen `plugin.sig` | `unsigned: plugin.sig is missing` |
| Modul eller beskrivelsesfil endret etter signering | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Signert av en nøkkel du ikke stoler på | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Ingen nøkler konfigurert i det hele tatt | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| Skadet signaturfil | `signature file is malformed: ...` |
| Beskrivelsesfil med ukjent felt, feil type eller feil evne | `plugin.json is not valid: ...` med feltnavnet |
| Modulen importerer noe verten ikke tilbyr | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| Modulen bruker kontekstfunksjonene uten å oppgi en evne | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| Mappenavn og `name` er forskjellige | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

Signaturen sjekkes før beskrivelsesfilen tolkes og før modulen kompileres, så usignert kode kompileres aldri.

## De to eksemplene

* `moving-average` er Rust. Den tar gjennomsnittet av en måling over de siste N meldingene og holder vinduet sitt i eget minne. Den ber ikke om noe. `cargo build --locked --release --target wasm32-wasip1`, deretter er `plugin.wasm` den `moving_average.wasm` som bygges.
* `stamp` er TinyGo. Den legger tiden til hver melding, så den ber om `clock`. Den bygges med TinyGos egen container, med Podman: `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow er et Go-hus. Verten, signeringen, CLI-en og hver test er Go, og TinyGo-eksemplet er Go. Rust-eksemplet er der fordi et pluginformat som bare virket for språket verten er skrevet i, ikke ville vært et pluginformat, og fordi Rust er det et signalbehandlingsbibliotek mest sannsynlig allerede er skrevet i. Det er den skrevne begrunnelsen for det ene eksemplet som ikke er Go. Crate-ene det bygges med er `serde` og `serde_json`, begge med tillatende lisens, kompilert inn i eksempelmodulen og ikke inn i Flow.

## Hva som ikke er bevist

* Plugins er kjørt på bare metal (2026-11-17).
* På Kubernetes kommer pluginfilene gjennom `plugins.volume`, hvilken som helst volumkilde. En ConfigMap rommer en plugin bare opp til grensen på 1 MiB, så en plugin på størrelse med TinyGo-eksemplet trenger en claim.
* Det finnes ingen nettverksevne. En plugin kan ikke gjøre en forespørsel, og det er med vilje helt til noen har en grunn med en tillatelsesliste over verter å følge med.
* Flow-tester kjører plugins på ekte, i samme barneprosess som alle andre noder. En plugins evner er de samme som utrullingen ville gitt den.
* `hotloop-flow test` kjørt for hånd fra et skall laster ikke plugins. Utrullingsporten og editorens testkjøringer gjør det.
