---
title: "Stockage et retransmission dans HotLoop Flow"
description: "Marquez une liaison comme durable : les messages vont sur disque, dans l'ordre, quand le nœud derrière cesse de répondre, et survivent à un kill -9."
---

Marquez une liaison comme durable : tant que le nœud à l'autre bout suit, c'est une liaison ordinaire et elle n'écrit rien sur disque. Dès que ce nœud cesse d'accepter des messages, la liaison déverse vers le même fichier SQLite avant que l'émetteur ne continue, et une pompe les livre du plus ancien au plus récent jusqu'à ce que la cible prenne chacun, par lots de 256 au plus pour une cible qui écrit dans une base de données en une fois (InfluxDB le fait), et un par un pour les autres. Ainsi l'historien tombe, les mesures s'empilent sur disque au lieu de bloquer le flux ou d'être abandonnées, et elles entrent, dans l'ordre, quand il revient. Le prix de ne rien écrire tant que tout va bien est qu'un `kill -9` perd alors ce qui était en mémoire, à peu près une interrogation, et nous préférons le dire ici plutôt que de vous le laisser découvrir.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

Vous n'avez pas à écrire la clé à la main. Double-cliquez sur la liaison dans l'éditeur et cochez *Durable*.

Elle survit à un redémarrage, garde l'ordre, respecte un quota disque (256 MiB par défaut, et la politique de débordement du nœud à l'autre bout décide de ce qui cède quand c'est plein) et affiche sa profondeur sous `hotloop_flow_durable_wire_depth`. C'est au moins une fois, pas exactement une fois, et nous préférons vous le dire ici plutôt que de vous le laisser découvrir dans un post-mortem : les mots exacts, et comment `influxdb out` reste correct malgré tout, sont dans [docs/durable](/fr/flow/durable-state/).

La preuve est `docs/durable/store-and-forward.sh` : un vrai InfluxDB 2.9.1 sous Podman avec vingt mesures par seconde, arrêté dix minutes, remis en route, avec le runtime tué par `kill -9` une fois en pleine panne et une fois en plein vidage. 15,982 mesures acceptées, 15,982 lignes stockées, aucune manquante, aucune en double. Une liaison durable en bonne santé n'écrit rien de son propre chef, et avec le contexte vidé toutes les trente secondes, tout le processus a écrit 1.7 MiB par heure à vingt messages par seconde (0.04 GB par jour). Les tableaux et les commandes sont dans [docs/durable](/fr/flow/durable-state/).

## Un message que la cible refuse pour toujours

Par défaut, une liaison continue de réessayer un message que sa cible fait échouer, avec une pause qui grandit jusqu'à cinq secondes, et rien de ce qui suit ce message n'avance. Pour un historien arrêté, c'est exactement ce qu'il faut. Pour une seule mesure mal formée que l'historien n'acceptera jamais, c'est une liaison bloquée pour de bon, il y a donc une issue, désactivée tant que vous ne la demandez pas.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Donnez à la liaison un nombre de tentatives, dans la boîte de dialogue de liaison de l'éditeur ou comme ci-dessus, et quand la cible a refusé un message de la file ce nombre de fois, la liaison le remonte au flux comme une erreur du nœud qui l'a refusé, avec le message joint comme le fait toute erreur de nœud, puis passe au suivant. Un nœud Catch sur ce flux la reçoit et peut la mettre de côté, alerter ou l'écrire ailleurs. Sans Catch, l'erreur apparaît quand même dans la barre latérale de débogage et le message est perdu, câblez-en donc un. Le premier refus, en mémoire, atteint le Catch comme avant, si bien qu'un Catch voit le même message deux fois : quand il a échoué la première fois et quand la liaison a abandonné. Le compte est par message et en mémoire, donc un redémarrage le remet à zéro. `hotloop_flow_durable_wire_given_up_total` les compte, à côté de la profondeur. Une limite qui n'est pas un entier de 1 ou plus est signalée et la liaison continue de réessayer, car l'ignorer en silence laisserait bloquée une liaison à laquelle quelqu'un avait demandé de s'arrêter.
