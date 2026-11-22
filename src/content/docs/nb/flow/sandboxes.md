---
title: "To sandkasser i HotLoop Flow"
description: "Hvordan Function-noden og WebAssembly-sandkassen er avgrenset, hva hver av dem kan røre, og hvordan en plugin kjører i den andre."
---

Function-noden kjører på JavaScript-tolken (se [Sikkerhetsstilling](/nb/flow/security/)). Et kall koster 11.6 til 13.7 µs. Det er ingen grense mot minne: en funksjon som allokerer i en løkke får Go-heapen til å vokse til poden dør, og alt JavaScript-tolken kan gjøre med det er en tidsavbrudd på veggklokken.

Det koster 184 til 196 µs per kall, femten til seksten ganger et kall til JavaScript-tolken. Verdt å betale akkurat når du kjører kode du ikke stoler helt på, og ikke ellers.

En flyt kjører en WASM-gjest gjennom en plugin: en signert modul med en beskrivelse som editoren tegner dialogen sin fra, som ikke får noen vertstilgang med mindre den ber om det og du sier ja. Minnet er begrenset per node, en melding får et tidsavbrudd, og en gjest som sprenger noen av dem, stopper, havner i en Catch-node med årsaken og tar ikke noe annet med seg. Alt står i [Plugin-er uten npm](/nb/flow/plugins/), også hvordan du stoler på en utgivers nøkkel og hva avvisningene sier. Hva det betyr for deg: det Node-RED trenger npm og en hel Node.js-installasjon til, kjører Flow som en sandkasset fil du kan bekrefte før den lastes.

En plugin kan skrives i Rust, TinyGo, Zig eller AssemblyScript i stedet for JavaScript, så signalbehandlingen en OT-flyt faktisk vil ha, kjører kompilert, med et minnetak den ikke kan krangle med.

Gjeste-ABI-et er tre eksporter, to av dem allokatorkroker, og det er så lite med vilje. Hver eksport er angrepsflate og én ting til hver gjesteforfatter må gjøre riktig.

| Eksport | Signatur | Påkrevd |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | ja |
| `hotloop_flow_alloc` | `(size i32) -> i32` | ja |
| `hotloop_flow_free` | `(ptr i32, size i32)` | nei |

`i64`-resultatet pakker en forskyvning i de høye 32 bitene og en lengde i de lave 32, og peker på et JSON-svar i gjestens eget minne. Alt krysser som JSON, så en gjest i et hvilket som helst språk kan lage det uten en delt skjemakompilator.

Grensene er små med vilje. Dette kjører på kantmaskinvare ved siden av flytene som virkelig betyr noe, og en node som trenger mer, bør måtte si fra:

| Grense | JavaScript-tolken | WASM |
|---|---|---|
| Tidsavbrudd per kall | 5 s | 5 s |
| Minnetak | ingen som kan håndheves | 16 MiB per node med mindre pluginen sier noe annet, maks 64 MiB med mindre du hever `plugins.maxMemoryMiB`, hardt |
| Maks utdata | 16 MiB | 8 MiB |

Begge kjøretidene er ren Go uten cgo.
