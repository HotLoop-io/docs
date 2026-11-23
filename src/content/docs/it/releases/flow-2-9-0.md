---
title: "Note di rilascio: HotLoop Flow 2.9.0"
description: "Cosa porta HotLoop Flow 2.9.0, cosa cambia con l'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 aggiunge nodi connettori nativi per la migrazione di un impianto reale. Esegue i nodi Node-RED su cui si appoggiano i flow di un impianto, Modbus, la dashboard, PostgreSQL ed e-mail, più i `Buffer` e `setInterval` che chiamano i nodi funzione che li circondano. Un flow acquisito da una macchina Node-RED che li usa si carica, funziona e si salva senza modifiche. Permette anche a un solo Flow di tenere una scheda per ogni macchina su un computer la cui unica porta porta una VLAN per ciascuna, anche quando tutte le VLAN hanno la stessa sottorete e gli stessi indirizzi di dispositivo.

## Novità

- **Modbus di Node-RED.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` e il `modbustcp-server` passivo. L'uscita è quella che inviano i nodi della comunità: `msg.payload` come elenco di valori, `msg.responseBuffer` come `{data, buffer}`, `msg.input`, e gli errori dalla seconda uscita.
- **La dashboard.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` e `ui_template`, serviti su `/ui` dal binario, senza scaricare nulla da fuori dell'impianto. Quello che un operatore fa sulla pagina esce dal nodo come messaggio. `ui_template` esegue il sottoinsieme in stile AngularJS che gli impianti usano: `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` e `postgresql`. La connessione si apre alla prima query, così un database non ancora avviato non ferma il flow.
- **E-mail.** Il nodo di uscita `e-mail` su SMTP, con STARTTLS, un interruttore per il certificato e XOAUTH2.
- **`Buffer`, `setInterval` e `setTimeout` nel nodo funzione.** I timer girano sull'orologio del nodo, ogni callback ha lo stesso limite di CPU di un messaggio, e ogni timer viene fermato quando il flow si ferma o viene ridistribuito.
- **Un'interfaccia di rete per ogni client.** Un nodo, una scheda o una configurazione client può indicare l'interfaccia a cui si collegano le sue connessioni (`SO_BINDTODEVICE`), così una scheda per l'essiccatore 14 raggiunge solo il `192.168.1.5` della VLAN 14. Per la scheda si usa la variabile d'ambiente `FLOW_NETWORK_INTERFACE` della scheda, che ogni nodo client al suo interno eredita. È presente sui nodi Modbus, PostgreSQL, e-mail, richiesta TCP, uscita UDP e richiesta HTTP.

Il README ha una nuova sezione, `docs/node-red-types.md` dice cosa funziona e in cosa differisce, e `docs/compatibility.md` è rigenerato dal registro.

## Cosa è cambiato

- Nel nodo funzione `Buffer`, `setTimeout` e `setInterval` erano assenti di proposito, e due test lo fissavano. Ora ci sono, perché le funzioni di un impianto li usano. Nient'altro è cambiato nell'ambiente isolato: non ci sono ancora `require`, `process` né la libreria standard di Node.
- Con l'hook non impostato si comporta come l'upstream. NOTICE e `HOTLOOP_PATCH.txt` dicono cosa è cambiato.
- Il motivo sono i nodi connettori Node-RED nativi per la migrazione di un impianto reale.

## Nuove impostazioni

- `HOTLOOP_FLOW_UI_PATH`, predefinito `/ui`: dove viene servita la dashboard.
- `FLOW_NETWORK_INTERFACE`, una variabile d'ambiente di scheda, sottoflusso o processo: l'interfaccia a cui si legano i client di quella scheda. Vuota per impostazione predefinita, il che lascia scegliere all'host, come prima.
- Un campo **Interfaccia di rete** su ogni nodo client e configurazione.
- Valore del chart `bindToInterface.netRaw`, predefinito `false`. Legare un socket a un'interfaccia non richiede alcuna capability su Linux 5.7 e successivi. Su un kernel più vecchio richiede `CAP_NET_RAW`, e impostarlo su `true` aggiunge quella sola capability al pod e nient'altro. Il pod ha anche bisogno della rete dell'host (`network.mode: host`) per vedere un'interfaccia VLAN.

## Aggiornamento

Un semplice `helm upgrade` all'immagine e al chart 2.9.0, oppure il nuovo tag nella tua unità Quadlet. Al primo avvio non succede nulla, non c'è nulla da migrare, e un flow che non usava nessuno dei nuovi tipi funziona come prima. Un flow che ha già questi tipi (un file Node-RED acquisito) ora li avvia, dove prima segnalava ciascuno come tipo di nodo sconosciuto.

## Una modifica a NOTICE e alle licenze

NOTICE aggiunge la voce della libreria Modbus, che ora è una copia modificata. Nell'immagine non c'è nessun nuovo modulo di terze parti.

Immagine: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, prima linux/amd64, con arm64 a seguire nella 2.9.1. Chart: `https://hotloop.io/hotloop-flow/`. Il README di questo tag ha il resto, con le immagini: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
