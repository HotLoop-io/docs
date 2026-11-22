---
title: "Lingue dell'interfaccia web"
description: "L'interfaccia web in inglese e in altre tredici lingue, con l'arabo disposto da destra a sinistra, da scegliere nella barra in alto o nella scheda di accesso."
---

L'interfaccia web di HotLoop IoT, Edge e Gateway (e di HotLoop for CODESYS, che esegue l'interfaccia di Edge) è disponibile in inglese e in altre 13 lingue: spagnolo (es), francese (fr), italiano (it), tedesco (de), norvegese bokmål (nb), bulgaro (bg), greco (el), coreano (ko), giapponese (ja), vietnamita (vi), hindi (hi), cinese semplificato (zh-Hans) e arabo (ar, disposto da destra a sinistra).

Sceglietene una nella casella della lingua nella barra in alto, oppure nella scheda di accesso. La scelta viene ricordata in questo browser. Se non scegliete nulla, la pagina usa la prima delle lingue del browser che HotLoop ha, e l'inglese se nessuna corrisponde. Una lingua compare nel selettore solo quando il suo file è completo.

Ciò che segue la lingua: ogni parola di ogni schermata, l'ordine e i segni dei numeri (una virgola decimale in tedesco, francese e spagnolo), le date e le ore (orologio a 24 ore), le forme del plurale (l'arabo ne ha sei) e la direzione della pagina. I nomi di prodotti e protocolli (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) restano come sono scritti. I valori dell'impianto, come i nomi dei tag, i nomi dei dispositivi, i messaggi di allarme scritti da qualcuno e il testo di errore rimandato dal server, vengono mostrati così come sono.

## Come funziona

* [i18next](https://www.i18next.com/) 27 cerca il messaggio, riempie `{{name}}` e sceglie la forma del plurale. Interroga `Intl.PluralRules` del browser stesso, quindi le regole del plurale sono quelle di Unicode CLDR. Numeri e date usano `Intl.NumberFormat` e `Intl.DateTimeFormat` tramite `web/src/lib/format.ts`.
* I messaggi stanno in `web/src/i18n/locales/<language>.json`, in elenco piatto, una chiave per messaggio. `en.json` è la fonte. Ogni altro file ha esattamente le sue chiavi.
* In un template o in uno script, scrivete `tl('area.key')` oppure `tl('area.key', { name })`. Un messaggio con un conteggio ha una chiave per ogni forma del plurale (`key_one`, `key_other`, e `key_few`, `key_many`, `key_two`, `key_zero` dove una lingua le ha) e si richiede con la sola chiave e `count`: `tl('overview.tags_count', { count: n })`.
* L'inglese fa parte della pagina. Un'altra lingua è un file separato, scaricato quando qualcuno la sceglie.
* `web/src/i18n/index.svelte.ts` tiene la lingua; cambiarla ridisegna ogni schermata. Una parola tenuta in una costante all'inizio di un file `.ts` viene letta una sola volta, quando il file si carica, e non viene tradotta: scrivetela come getter (`get label() { return tl('x.y'); }`) oppure tenete la chiave e chiamate `tl()` dove viene disegnata.
* La pagina imposta `<html lang dir>`. Il CSS usa proprietà logiche (`margin-inline-start`, `inset-inline-end`, `text-align: start`), quindi il layout si ribalta da solo per l'arabo.

## Aggiungere o cambiare una parola

1. Aggiungete il messaggio a `en.json` e scrivetelo nel codice con `tl()`.
2. Aggiungetelo a ogni altro file di lingua, scritto da una persona che legge quella lingua, seguendo la base terminologica condivisa del codex (`work/notes/i18n/glossary/`). Frasi brevi e chiare. I nomi di prodotti e protocolli restano in inglese.
3. Eseguite `cd web && npm run check:i18n`. Fallisce quando a un file di lingua manca una chiave, ha un `{{placeholder}}` diverso dall'inglese o manca una forma di plurale di cui la sua lingua ha bisogno; quando una chiave non è usata; e quando dell'inglese è scritto in un template o nel codice senza passare da `tl()`. Gira prima di ogni `npm run build` e in `npm run typecheck`, quindi la suite completa e la build della versione si fermano su di esso. L'inglese che deve restare (un nome, un esempio di codice) va in `web/i18n/allow.json` con il motivo.

Impostate `HOTLOOP_TEST_BROWSER_GALLERY` e `HOTLOOP_TEST_BROWSER_ARTIFACTS` per conservare uno screenshot di ciascuna.

## Cosa non viene tradotto

* Il testo che invia il server: i messaggi di errore dell'API, i messaggi di notifica e di allarme, e la CLI. L'interfaccia li mostra come arrivano.
* La documentazione, i nomi del server OPC UA, il broker MQTT e i valori del chart Helm.
