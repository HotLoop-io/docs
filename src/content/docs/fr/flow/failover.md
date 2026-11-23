---
title: "Veille chaude avec un bail"
description: "Deux installations de Flow se partagent un travail : un bail dans PostgreSQL et une barrière sur chaque écriture vers un équipement, donc une seule écrit."
---

Deux installations de Flow peuvent se partager le travail d'une seule. L'une est l'écrivain : c'est la seule qui envoie quoi que ce soit aux équipements. L'autre est la veille : elle exécute les mêmes flux, lit, s'abonne et garde son contexte au chaud, mais retient toute écriture vers les équipements jusqu'à ce qu'elle prenne la place de l'écrivain. Si l'écrivain meurt, se bloque ou perd sa liaison, la veille prend le relais en à peu près la durée d'un bail, et celle qui était l'écrivain ne peut plus écrire tant qu'elle n'a pas regagné le bail.

C'est pour le cas où un redémarrage n'est pas assez rapide et où un second écrivain est pire qu'une courte attente. Si un redémarrage est assez rapide, une seule installation et une replanification Kubernetes sont plus simples, et c'est ce que fait le chart par défaut.

## Fonctionnement

Le bail est une ligne dans un PostgreSQL que les deux installations peuvent joindre. L'écrivain le renouvelle toutes les quelques secondes. La veille le réclame au même rythme et ne l'obtient qu'une fois qu'il a expiré. À chaque changement de titulaire, le numéro de barrière de la ligne augmente, et Flow le signale.

Chaque écriture vers un équipement pose la même question juste avant d'être envoyée : est-ce que je détiens le bail, avec plus de durée restante qu'il n'en faut à une écriture ? Sinon, l'écriture est refusée avec une erreur comptabilisée qui arrive au nœud Catch du flux, et rien n'est envoyé, pas même une connexion. Cette vérification, faite au moment de chaque écriture, est ce qui empêche deux installations d'écrire en même temps :

- Le titulaire compte son bail à partir du moment où il l'a demandé, jamais à partir du moment où la réponse est arrivée, si bien qu'il ne croit jamais avoir plus de temps que la base de données.
- Le titulaire cesse d'écrire quand il lui reste moins de bail qu'il n'en faut à une écriture (`writeMargin`), ce qui arrive avant l'expiration du bail. La veille ne peut prendre le bail qu'après son expiration. Il y a donc un intervalle, et pas de chevauchement.
- Un titulaire qui est gelé puis dégelé, ou coupé puis reconnecté, constate que son bail a disparu, refuse ses écritures et demande le bail comme n'importe qui.
- L'horloge de la base de données décide quand le bail se termine, si bien que deux machines dont les horloges divergent s'accordent quand même sur qui le détient.

Les écritures qui posent la question sont celles qui peuvent commander un équipement : `modbus write`, `s7 write`, `opcua write` et `ethernetip write`, que ce soit en direct ou par la porte d'écriture de HotLoop, les nœuds `hotloop script` et `hotloop recipe`, et dans un diagramme FlowLab l'écriture série, une commande d'instrument qui écrit (en plus de l'interrupteur d'écriture propre à cet instrument) et l'écriture HotLoop. Envoyer un message à un broker MQTT, à une base de données ou une notification n'est pas soumis à la barrière : ce n'est pas une commande vers un équipement, et sa répétition est sans danger là où une consigne répétée pourrait ne pas l'être. Un test de flux remplace le monde extérieur et n'est jamais retenu.

## Ce que cela coûte et ce que cela ne vous donne pas

- **Le délai de bascule** est à peu près la durée du bail. Avec les valeurs par défaut (bail de 15 secondes, renouvelé toutes les 5 secondes, marge de 5 secondes), une veille a pris le relais 14,7 secondes après l'arrêt brutal de l'écrivain. Avec un bail de 6 secondes, 5,7 secondes. Un écrivain qui s'arrête proprement abandonne le bail, et la veille a pris le relais en 0,35 seconde.
- **Une écriture plus longue que `writeMargin`** peut survivre au bail. Gardez les délais d'expiration de protocole des nœuds qui écrivent en dessous. Une écriture déjà en vol quand un processus est gelé a déjà passé sa vérification et peut encore arriver.
- **Au moins une fois.** Un automate qui a pris une écriture dont l'accusé de réception a été perdu peut voir le nouvel écrivain la renvoyer. C'est sans danger pour une consigne, pas pour une impulsion ou un incrément : écrivez des consignes, pas des deltas.
- **Les files restent locales.** Les fils durables et le contexte sont sur le disque de chaque installation. Ce qui était en file chez un écrivain mort n'est pas chez la veille.
- **La base de données est une dépendance.** Un écrivain qui ne peut pas la joindre ne peut pas renouveler, et cesse d'écrire quand son bail devient trop court. Placez le bail sur une base de données au moins aussi disponible que les équipements qu'elle protège.

## Mise en place

Installez Flow deux fois, en deux releases Helm ou deux unités Quadlet, chacune avec son propre volume, et pointez les deux vers le même bail. Donnez à la seconde le même fichier de flux qu'à la première et gardez-le ainsi avec un envoi vers les stations ([Envoi vers les stations d'un tenant](/fr/flow/stations/)), car Flow ne copie pas les flux d'une installation à l'autre.

| Réglage | Environnement | De quoi il s'agit |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | Un fichier contenant l'URL PostgreSQL de la base de données du bail. La définir active le failover. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | Le bail. Le même sur les deux. Par défaut `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | Le nom propre de cette installation. Il doit différer entre les deux et vaut par défaut le nom d'hôte. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | La durée d'une attribution, donc à peu près le délai de bascule. Par défaut `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | La fréquence à laquelle le titulaire redemande. Par défaut un tiers du ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | La durée de bail qu'il doit rester à une écriture. Par défaut `5s`. |

Flow refuse de démarrer quand les réglages feraient passer le titulaire sous sa marge entre deux renouvellements, par exemple une marge aussi longue que le ttl.

Dans le chart, ce sont `failover.urlSecret` (un Secret dont la clé contient l'URL, monté comme fichier et jamais placé dans le ConfigMap), `failover.name`, `failover.ttl`, `failover.renewEvery` et `failover.writeMargin`. Avec Quadlet, ce sont les variables d'environnement ci-dessus, et l'URL est un secret Podman monté comme fichier :

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Le voir

- `GET /failover` (et l'outil MCP `get_failover`) indique si cette installation est `active`, `standby` ou `lost`, qui détient le bail, le numéro de barrière qu'elle détient et combien d'écritures elle a retenues, selon ce qui écrivait. Il exige `status.read` et n'existe que lorsque le failover est configuré.
- L'éditeur affiche une bannière sur une veille et sur un titulaire qui a perdu son bail.
- Le point de terminaison des métriques comporte `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` et `hotloop_flow_failover_refused_total{op}`.
- Les deux installations consignent quand elles prennent le bail et quand on le leur retire.

## Ce qui est démontré, et ce qui ne l'est pas

Démontré sur deux vrais processus Flow face à un vrai PostgreSQL et à un serveur Modbus TCP qui consigne chaque écriture, chaque installation écrivant une valeur étiquetée toutes les 200 ms : l'écrivain arrêté brutalement en plein flux, la veille a pris le relais après un bail, et aucune écriture de la veille n'est venue avant la dernière écriture de l'écrivain ni après elle (0 et 0) ; l'écrivain gelé plus longtemps que le bail puis dégelé n'a pas réécrit ; l'écrivain arrêté proprement, la veille a pris le relais en 0,35 seconde. Un test pour chacun des chemins d'écriture ci-dessus montre que l'écriture d'une veille ou d'un titulaire périmé est refusée avant que quoi que ce soit soit envoyé, et que la même écriture est envoyée quand la porte est ouverte.

Non démontré : le comportement d'un vrai automate face à une écriture répétée, une bascule de base de données sous le bail et un réseau coupé dans un seul sens. Le serveur Modbus est un simulateur qui parle le protocole. Le failover n'est pas essayé sur un cluster, et les valeurs du chart et les lignes Quadlet sont rendues et vérifiées, pas installées. Les textes de la bannière de l'éditeur n'ont pas été relus par un locuteur natif.
