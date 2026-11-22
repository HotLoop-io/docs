---
title: "Installare HotLoop for CODESYS"
description: "Installa HotLoop for CODESYS dall'App Store di EmberCORE o con Helm: che cosa serve al nodo, il Secret del profilo, che cosa fa da solo e come verificarlo."
sidebar:
  label: "Installazione"
---

HotLoop for CODESYS è un chart Helm, `hotloop-codesys`, che installa HotLoop Edge e un provisioner sullo stesso nodo di un runtime CODESYS. Il chart è pubblicato in `{{codesysChartRepo}}`, con {{codesys}} come la più recente, e l'immagine del provisioner si scarica senza accesso. Su EmberNet è un'app dell'App Store. Senza EmberNet è Helm su k3s.

## Che cosa serve prima al nodo

- **Un runtime CODESYS sullo stesso nodo che pubblichi il proprio server OPC UA sulla porta 4840.** Il provisioner ricava da Kubernetes l'indirizzo del nodo stesso e legge `<node address>:4840`. Il chart del runtime pubblica quella porta sull'host.
- **Una Symbol Configuration nel programma del PLC** con *Support OPC UA features* attivo, che elenchi le variabili che si vogliono vedere, oppure `{attribute 'symbol' := 'read'}` su di esse nella dichiarazione. Un PLC senza Symbol Configuration risponde alla configurazione con un messaggio che dice di aggiungerne una. È l'unica modifica al progetto del PLC.
- **HotLoop {{codesysNeeds}}**, che il chart racchiude. Il connettore CODESYS è arrivato con HotLoop 4.19.4. Il chart dipende dal chart `hotloop-edge` sulla linea `~{{codesysNeeds}}`.
- **Un profilo.** Un Secret con una chiave. [La pagina del profilo](/it/codesys/profile/) ne descrive la forma.

## Dall'App Store di EmberCORE

Il chart è contrassegnato per il personale, quindi lo Store lo elenca per il personale di EmberNet, che lo installa sul tenant del cliente. Non è un pulsante che preme il tenant stesso, quindi ci si rivolge a chi segue il proprio tenant. Lo Store scrive il profilo nel namespace del tenant come `<release>-profile`, passa al chart il nodo scelto e le etichette del tenant, e passa la chiave pubblica del dashboard per l'accesso. Dopo non c'è altro da fare.

## Con Helm

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

Si chiama il Secret `<release>-profile`, oppure si cambia ciò che il chart cerca con `profile.existingSecret` (il Secret) e `profile.key` (la chiave, `profile.json` per impostazione predefinita). Per fissare l'installazione al nodo del runtime, si imposta `nodeSelector`. Per HotLoop da solo, senza profilo, da configurare a mano, si installa con `--set provisioner.enabled=false`.

## Con un runtime sulla rete del nodo

Un runtime installato dal suo chart con `network.hostNetwork=true` occupa la porta 8080 dell'host per WebVisu, quindi la pagina di HotLoop non può mettersi in ascolto anche sulla 8080. Il chart fa ascoltare la pagina di HotLoop sulla 8090 dentro il pod e mantiene il Service sulla 8080, così il riquadro dell'App Store e il provisioner la raggiungono come prima. Si installa con la rete dell'host attiva per entrambi:

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

I listener OPC UA PubSub di HotLoop si legano a una porta UDP in modo esclusivo, quindi due listener sulla stessa porta non possono connettersi entrambi. Il provisioner rifiuta un profilo che lo richiede, e dice perché.

## Che cosa fa l'installazione

1. HotLoop Edge si avvia su quel nodo con SQLite sullo storage local-path del nodo. Nessun pod di database, una replica, e la strategia di aggiornamento è `Recreate`.
2. Il provisioner si avvia sullo stesso nodo. Legge il profilo montato a ogni passaggio, quindi un profilo più recente raggiunge un'installazione in esecuzione. Attende HotLoop e il runtime CODESYS del nodo, poi imposta il dispositivo, le variabili, gli allarmi e la schermata del profilo.
3. Controlla di nuovo ogni cinque minuti e mantiene il dispositivo allineato mentre il programma del PLC cambia. Le variabili che un profilo elenca e che il PLC ora ha vengono aggiunte, e una che il PLC non ha più viene letta come non valida con il motivo del server.
4. Entrambi i pod tollerano `node.kubernetes.io/unreachable` e `not-ready` senza `tolerationSeconds`, così un nodo che perde il suo piano di controllo li mantiene. Il chart lo porta con sé e non dipende dall'impostazione del cluster.

Il server OPC UA, il broker integrato, la pubblicazione sull'edge e i backup sono disattivati, perché nessuno è voluto accanto a un runtime. Se ne vuole attivare uno, lo si fa dai values di `hotloop-edge`.

## Verificarlo

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

Un buon avvio dice che il dispositivo è stato impostato con le sue variabili, nessuna scrivibile, e che sono stati creati gli allarmi e la schermata. Si apre il servizio HotLoop, si accede come `admin` e si guarda Dispositivi e Dashboard. La password di admin è nel Secret della release, come per qualsiasi chart HotLoop.

## Accesso dal dashboard

Da HotLoop 4.19 il chart Edge fa accedere una persona dall'asserzione firmata del dashboard di EmberCORE (i values `embernetSignin`, quattro variabili `HOTLOOP_AUTH_ASSERTION_*` e l'annotazione del Service `embernet.ai/signin: assertion`). Questo chart eredita tutto ciò dal subchart `hotloop-edge`, e lo Store gli passa la chiave pubblica. Il provisioner usa l'account admin del chart, che l'accesso locale consente ancora. In un cluster di prova un'asserzione corretta ha fatto accedere una persona come operator o come admin, e un'asserzione di un'app sbagliata, di un tenant sbagliato, scaduta, di un emittente sbagliato e una manomessa sono state tutte rifiutate.

## Fin dove è stato eseguito

È stato eseguito su hardware fisico (2026-11-17), e il chart viene generato dall'indice in linea con Helm. [A che punto è](/it/codesys/where-it-stands/).

