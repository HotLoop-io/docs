---
title: "Lingue dell'interfaccia web"
description: "L'interfaccia web in inglese e in altre tredici lingue, con l'arabo disposto da destra a sinistra, da scegliere nella barra in alto o nella scheda di accesso."
---

L'interfaccia web di HotLoop IoT, Edge e Gateway (e di HotLoop for CODESYS, che esegue l'interfaccia di Edge) è disponibile in inglese e in altre 13 lingue: spagnolo (es), francese (fr), italiano (it), tedesco (de), norvegese bokmål (nb), bulgaro (bg), greco (el), coreano (ko), giapponese (ja), vietnamita (vi), hindi (hi), cinese semplificato (zh-Hans) e arabo (ar, disposto da destra a sinistra).

Sceglietene una nella casella della lingua nella barra in alto, oppure nella scheda di accesso. La scelta viene ricordata in questo browser. Se non scegliete nulla, la pagina usa la prima delle lingue del browser che HotLoop ha, e l'inglese se nessuna corrisponde. Una lingua compare nel selettore solo quando il suo file è completo.

Ciò che segue la lingua: ogni parola di ogni schermata, l'ordine e i segni dei numeri (una virgola decimale in tedesco, francese e spagnolo), le date e le ore (orologio a 24 ore), le forme del plurale (l'arabo ne ha sei) e la direzione della pagina. I nomi di prodotti e protocolli (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) restano come sono scritti. I valori dell'impianto, come i nomi dei tag, i nomi dei dispositivi, i messaggi di allarme scritti da qualcuno e il testo di errore rimandato dal server, vengono mostrati così come sono.

## Pensato per chi lo usa

* Ogni schermata è disegnata da un messaggio per frase, così una lingua non è mai mezza pagina di parole sue e mezza di inglese. Una lingua compare nel selettore solo quando ogni schermata è completa.
* I plurali seguono le regole CLDR di Unicode per ogni lingua, così "1 dispositivo", "2 dispositivi" e le sei forme dell'arabo si leggono come si aspetta un madrelingua.
* Numeri e date vengono dalla formattazione del browser stesso per la lingua scelta, così un lettore tedesco vede 1.234,5 e uno statunitense vede 1,234.5.
* Cambiare lingua ridisegna tutte le schermate insieme, senza ricaricare. L'inglese fa parte della pagina e si carica con essa; ogni altra lingua viene scaricata solo quando qualcuno la sceglie, così uno stabilimento che lavora in una lingua non scarica mai le altre dodici.
* La disposizione si gira da sola per l'arabo: margini, allineamento e spaziatura si invertono con la lingua.

Un test del browser nella suite completa lo dimostra sulla pagina reale. Apre HotLoop in ogni lingua con una larghezza da desktop e da telefono e percorre ogni schermata. La direzione è giusta, niente scorre di lato, nessun messaggio appare come segnaposto, i numeri si leggono alla maniera della lingua, e la scelta sopravvive a un ricaricamento.

## Cosa non viene tradotto

* Il testo che invia il server: i messaggi di errore dell'API, i messaggi di notifica e di allarme, e la CLI. L'interfaccia li mostra come arrivano.
* La documentazione, i nomi del server OPC UA, il broker MQTT e i valori del chart Helm.
