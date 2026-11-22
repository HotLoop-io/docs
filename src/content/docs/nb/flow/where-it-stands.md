---
title: "Hvor Flow står"
description: "Hva Flow er bevist mot på ekte utstyr, og hvor det kom fra før det het HotLoop Flow."
---

**Det kjører.** Den starter, serverer API-et og editoren, laster flyter fra volumet, flytter meldinger og kommer tilbake etter en omstart med flytene, legitimasjonen og konteksten sin. Charten ruller den ut i alle tre nettverksmodiene, og hele publiseringskjeden løses opp. Den kjører på et ekte fabrikkgulv.

**Bekreftet mot ekte infrastruktur**: Mosquitto, InfluxDB og PostgreSQL. InfluxDB-tagverdien kom ut av en ekte database som `press 01,west` med mellomrommet og kommaet intakt. Det er unnslippingsfeilen som ellers splitter opp en serie i det stille og koster noen en dag å finne.

**Cookies og multipart svarer slik Node-REDs egne biblioteker gjør**, fordi de ble sjekket mot dem, over hundre tilfeller, og svarene havnet i en golden-fil som testene spiller av gjennom ekte sockets. Det inkluderer de stygge: et UTF-8-filnavn kommer ut ødelagt nøyaktig slik Node-RED-stakken ødelegger det, og en cookie som heter `value` mister verdien sin i `msg.responseCookies`, akkurat som der. Å treffe feilene er poenget. En flyt som lener seg på en av dem, går i stykker den dagen den forsvinner.

**Kjørt på ekte maskinvare (2026-11-17):** S7- og EtherNet/IP-nodene, varige koblinger (lagre og send videre og diskskrivingene) og plugin-er, med fallgruvene og avvisningene deres og en signert plugin i en ekte klynge. Tallene for diskskriving og per kall er fortsatt merket med hvor de ble målt.

Hva som bygges neste gang, og i hvilken rekkefølge, står i [veikartet](/nb/flow/roadmap/).

## Før det het HotLoop Flow

Det het Emberwire, og `v0.1.0` ligger fortsatt der det lå, på `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` var den første utgivelsen under dette navnet, og 2.x leser ingenting det gamle navnet skrev: variablene `EMBERWIRE_*`, de to databasenodetypene `emberwire-`, en WASM-modul bygget mot de gamle eksportene og legitimasjonsfilen fra 0.1.0 må alle gjøres på nytt. Det er et rent brudd med vilje. Ingen hadde bygget på 0.1.0, og et mellomlag for null brukere er bare mer kode som kan bli feil. Siden 2.0.1 får en gammel legitimasjonsfil en tydelig melding som nevner filen, sier at Emberwire skrev den og ber deg legge den til side og skrive inn legitimasjonen på nytt.