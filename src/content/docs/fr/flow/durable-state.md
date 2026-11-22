---
title: "État durable, chiffres à l'appui"
description: "Un contexte qui survit à un redémarrage et des liaisons durables qui n'écrivent sur le disque que si la cible ne répond plus, avec les mesures."
---

Un historien arrêté une heure ne devrait pas vous coûter une heure de mesures, tant que la panne tient dans le quota disque (256 MiB par défaut : environ une heure à 100 mesures par seconde pour une mesure de 120 octets, mesuré sur 2.13.1), et un compteur dans un flux ne devrait pas repartir de zéro parce que le pod a changé de place. Les deux reposent sur un fichier SQLite placé sur le volume, et cette page dit ce qu'il contient, ce qu'il garantit, ce qu'il ne garantit pas et ce qu'il coûte à une carte flash.

Un seul fichier, `state.db`, dans le répertoire de données. Le contexte persistant et les files des liaisons durables le partagent, car deux magasins seraient deux choses à dimensionner, à sauvegarder et à garder synchronisées.

## Un contexte qui survit à un redémarrage

Les contextes de flux, global et de nœud sont chargés depuis le fichier à la première utilisation d'une portée, puis vivent en mémoire : les lectures ne touchent donc jamais le disque, et `CompareAndSwap`, `Increment` et `Update` sont le même code qu'avant, atomique sous le même verrou. Un redémarrage vous rend votre compteur et il repart de là, et un `CompareAndSwap` sur une valeur revenue du disque fonctionne toujours, y compris sur l'entier stocké par un nœud function.

Ce que vous abandonnez est voulu : les écritures sont différées. Une valeur modifiée attend `store.context.flushInterval` (30 secondes), puis tout ce qui a changé dans cette fenêtre va dans le fichier en une seule transaction. Dix mille incréments d'un compteur dans une fenêtre font une seule ligne écrite. Une valeur remise à ce qu'elle était déjà n'écrit rien du tout, ce qui est le cas du flux qui stocke la même température chaque seconde et de la carte SD qui, sinon, vous en voudrait. Un arrêt propre écrit tout d'abord. Un `kill -9` ou une coupure de courant perd jusqu'à l'intervalle. Réglez-le sur `0s` et chaque changement est écrit avant le retour de l'appel, et la carte en paie le prix.

Seul ce qui survit à JSON survit à un redémarrage : nombres, chaînes, booléens, dates et heures, tampons d'octets, listes et objets. Mettez une fonction ou une socket dans le contexte et le `set` échoue en nommant la clé, au lieu d'en stocker la moitié. Le contexte d'un nœud disparaît quand le nœud est supprimé et celui d'un flux quand l'onglet l'est, au déploiement, par le même balayage que Node-RED.

## Liaisons durables

Marquez une liaison comme durable sur le nœud d'où elle part. La clé est `ew_durable`, une liste des ids des nœuds où va cette liaison, et le fichier de flux continue de se charger et de s'enregistrer octet pour octet, parce que les autres outils l'ignorent :

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Chaque liaison de `count` vers `influx` est maintenant durable. La liaison vers `reply` reste une liaison ordinaire.

Ce que fait une liaison durable :

- **N'écrit rien tant que la cible suit.** Les messages vont de la mémoire directement dans la boîte de réception de la cible, comme sur une liaison ordinaire, et la base d'état n'est pas touchée. Nous avons posé cette règle après qu'une conception qui écrivait tout d'abord a mesuré des centaines de gigaoctets par jour sur une carte flash, pour une panne qui arrive quelques heures par an.
- **Déverse sur disque quand elle ne suit pas.** La liaison commence à déverser dès que le gestionnaire de la cible renvoie une erreur, que sa boîte de réception est pleine ou qu'elle ne tourne pas. À partir de là, chaque message est validé dans le fichier avant le retour du `Send` du nœud émetteur : une fois l'émetteur passé à la suite, un `kill -9` ne peut plus l'emporter. Les messages déjà en route vers la cible sont détournés sur disque derrière celui qui a échoué, dans l'ordre. Dans l'exemple ci-dessus, `reply` vient en second dans le câblage : tant que la liaison déverse, un HTTP 200 signifie que la mesure est sur le disque.
- **Se vide dans l'ordre, par lots quand la cible en prend.** Une pompe remet à la cible les messages les plus anciens du disque et attend qu'ils soient pris. Rien derrière un message ne le dépasse. Une cible qui écrit dans une base de données peut prendre une série de 256 messages au plus comme une seule écriture, et `influxdb out` le fait : avec l'historien qui répond à une écriture en 8 ms, un arriéré se vidait à environ 110 mesures par seconde une par une, ce qu'une usine qui en envoie 100 par seconde ne réduisait presque pas, et il se vide à la vitesse que permettent les écritures quand chacune en porte quelques centaines. Toute autre cible reçoit toujours un message à la fois. Si un lot n'est pas pris, les messages avant le premier échec sont marqués faits, celui-là est retenté seul avec la nouvelle tentative décrite ci-dessous, et le reste est renvoyé en lot. Quand la file est vide, la liaison revient en mémoire et cesse d'écrire.
- **Retente ce que la cible refuse.** Le même message repart après 250 ms, puis 500 ms, en doublant jusqu'à 5 secondes, aussi longtemps qu'il le faut. Les nœuds Catch du flux sont informés du premier échec et pas de chaque nouvelle tentative. Une cible arrêtée, remplacée par un déploiement ou qui n'a pas pu démarrer est attendue, pas ignorée.
- **Survit à un redémarrage.** Tout ce qui reste sur le disque au retour du processus est livré en premier.
- **Respecte un quota disque.** `store.durable.maxBytes` (256 MiB) couvre l'ensemble des liaisons durables, en comptant le corps de chaque message plus 64 octets. Quand il est plein, le nœud où va la liaison décide selon la politique de débordement qu'il a déjà : `block` attend jusqu'à `blockTimeout` qu'il y ait de la place, puis renvoie une erreur, `drop-newest` refuse le message qui arrive, `drop-oldest` évince le plus ancien message qui n'est pas en cours de livraison, `error` lève l'erreur vers un nœud Catch. Chaque cas est compté et annoncé comme un événement d'abandon. Une exception : un message déjà accepté en mémoire que la liaison doit déplacer sur disque y entre au-delà du quota, car le refuser reviendrait à abandonner un message plus ancien et à garder des plus récents. Le dépassement est au plus ce que détient la cible, sa boîte de réception plus le message que sa goroutine a pris et pas encore commencé, si bien que le quota peut afficher quelques messages de trop un instant. Le fichier est un peu plus gros que le quota, à cause de la surcharge de pages de SQLite et du journal d'écriture anticipée, et un test le remplit, le vide et le remplit à nouveau six fois pour prouver qu'il ne continue pas de grossir.
- **Affiche sa profondeur.** `hotloop_flow_durable_wire_depth{wire="..."}` est le nombre de messages en attente, avec `_bytes`, `_delivered_total`, `_retries_total` et `_dropped_total` à côté, et `hotloop_flow_durable_bytes` face à `hotloop_flow_durable_max_bytes` donne le quota.
- **Ne redémarre pas le nœud.** Marquer une liaison comme durable sur un flux en cours d'exécution est un changement de câblage, comme déplacer une liaison.

Une liaison qui cesse d'être durable, ou qui est supprimée, voit sa file purgée, comptée comme abandonnée et annoncée. Ces messages n'ont nulle part où aller, et les garder remplirait le quota avec une file que personne ne voit.

### Ce qu'elle promet, et ce qu'elle ne promet pas

**Tant que la liaison est saine, il y a une fenêtre de perte.** Ce qui est en mémoire, c'est la boîte de réception de la cible et l'appel qu'elle est en train de faire, et un `kill -9` ou une coupure de courant l'emporte. C'est le prix de ne rien écrire, et nous l'avons accepté volontairement : avec une boîte de réception de 1024 et une cible rapide, ce sont les messages d'environ une interrogation. Dès que la liaison déverse, c'est-à-dire quand la cible est en panne et que les données sont en danger, il n'y a plus de fenêtre. Le test kill -9 ci-dessous est fait en pleine panne pour cette raison, avec la file sur disque. Nous n'avons pas tué le runtime pendant que la liaison était saine pour compter, car la réponse est « quelques-uns sont perdus » et c'est la conception.

**La livraison est au moins une fois.** La cible a pris un message quand son gestionnaire revient sans erreur, et la liaison le marque fait sur disque ensuite. Un `kill -9` entre les deux fait repartir le message après le redémarrage. Combien dépend de `store.durable.ackFlush` : les marques sont écrites ensemble, donc avec la valeur par défaut `100ms` ce sont les messages terminés dans les 100 dernières ms, et avec `0s` chaque marque est écrite avant l'envoi du message suivant, donc c'est au plus le message en vol, ou le lot en vol, jusqu'à 256 messages, pour une cible qui prend des lots.

Cela ressemble à un trou, voici donc ce qui le comble pour la cible pour laquelle tout cela a été conçu. Un message qui traverse une liaison durable est estampillé `msg._queuedAt` avec l'heure à laquelle il est entré dans la liaison, et `influxdb out`, sans horodatage configuré, écrit le point à cette heure. Une répétition est la même série à la même heure, qu'InfluxDB traite comme un écrasement : le nombre de lignes ne bouge pas. Cela corrige aussi l'autre défaut du stockage et retransmission : sans lui, chaque mesure retenue pendant une panne est horodatée au retour d'InfluxDB, et une heure d'historique arrive en une minute. Un puits qui horodate à l'arrivée, un `now()` dans un insert Postgres par exemple, stockerait une répétition deux fois, et placerait aussi l'heure rejouée au mauvais endroit. Utilisez `msg._queuedAt`.

**« Pris » ne vaut que ce que vaut le nœud.** `influxdb out` fait son écriture dans le gestionnaire : pris veut donc dire écrit. Un nœud qui confie le travail à une autre goroutine et revient a promis moins, et la liaison ne peut pas être plus durable que ce à quoi elle est reliée.

**Certaines propriétés ne font pas le voyage.** Un descripteur vivant ne peut pas traverser un redémarrage ni recevoir de réponse après coup : `msg.req` et `msg.res` (ceux du nœud HTTP In) et tout ce qui ne se sérialise pas sont donc retirés des messages d'une liaison durable, et la première fois que cela arrive sur une liaison, le nom de la propriété est consigné dans le journal. La charge utile n'est jamais retirée : s'il ne peut pas être stocké, le message est refusé avec une erreur qui nomme le chemin.

**Un seul message défectueux peut bloquer une liaison.** Une cible qui refuse toujours le même message le reçoit toujours, avec la pause de 5 secondes entre les essais, et les messages derrière attendent. Le compteur de nouvelles tentatives et la profondeur permettent de le voir. C'est le bon choix pour un historien en panne. C'est le mauvais pour un message mal formé : une liaison peut donc recevoir une limite, `"ew_durable_attempts": {"influx": 20}` sur le nœud d'où elle part, ou la boîte de dialogue de la liaison dans l'éditeur. Quand la cible a refusé un message autant de fois depuis la file, il part vers le flux comme une erreur du nœud qui l'a refusé, avec le message joint, un nœud Catch peut le mettre de côté, et la liaison avance. Sans la clé, rien ne change. Il n'y a toujours pas de file de lettres mortes : un nœud Catch est l'endroit où la construire, et `hotloop_flow_durable_wire_given_up_total` compte ce qui y est allé.

## Réglages

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Environnement : `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. Le chart reprend les mêmes noms sous `store:` dans `values.yaml`.

`synchronous: normal` fait tourner le fichier en mode d'écriture anticipée sans fsync à chaque validation. Une validation survit à l'arrêt brutal du processus, ce qui est le test `kill -9` ci-dessous. Elle ne survit pas à une coupure de courant sur tous les systèmes de fichiers. `full` y survit, et `full` est celui qui use la carte.

## La preuve

Mesuré avec un vrai InfluxDB 2.9.1 sous Podman. Rien n'est simulé.

Un producteur envoie vingt fois par seconde une mesure numérotée au flux de flow.json. Le flux la compte dans le contexte de flux et l'envoie par une liaison durable à `influxdb out`. La mesure ne porte aucun horodatage : un message livré deux fois ferait donc deux lignes. Un petit relais entre le flux et InfluxDB consigne chaque écriture qu'InfluxDB a acceptée, car InfluxDB traite un point écrit deux fois à la même heure comme un seul point, et les lignes seules ne peuvent pas montrer une répétition.

| Heure | Ce qui s'est passé |
|---|---|
| 00:13:53 | Le flux démarre, 20 mesures par seconde. |
| 00:14:53 | `podman kill` sur InfluxDB. Il reste arrêté dix minutes. La liaison déverse sur disque. |
| 00:19:54 | Cinq minutes plus tard, profondeur de file 5,989 sur disque. `kill -9` sur le runtime. |
| 00:19:59 | Le runtime redémarre, InfluxDB toujours arrêté. Il trouve 5,992 messages sur disque et continue d'en prendre de nouveaux. |
| 00:24:59 | InfluxDB démarre. Profondeur de file 11,989. |
| 00:25:25 | Vidage en cours, profondeur de file 5,987. `kill -9` sur le runtime encore, en pleine file. |
| 00:25:30 | Le runtime redémarre avec 5,948 sur disque. |
| 00:25:53 | Arriéré vidé. Quatre-vingt-dix secondes de plus d'entrée régulière, puis un décompte. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Chaque mesure à laquelle le flux a répondu 200 est dans InfluxDB, une fois. **Aucune ne manque, aucune en double.** Les 203 qui ont échoué étaient des requêtes arrivées pendant que le runtime était arrêté, c'est-à-dire le producteur à qui l'on répond non, et aucune n'a été stockée.

Cinq messages ont été remis deux fois à InfluxDB. Ce sont ceux que le deuxième kill a surpris entre le moment où InfluxDB les a pris et celui où la marque « fait » a atteint le disque, dans la fenêtre d'`ackFlush`. Chacun portait le même `_queuedAt` : la seconde écriture a écrasé la première et le nombre de lignes n'a pas bougé. Voilà à quoi ressemble [au moins une fois](#ce-quelle-promet-et-ce-quelle-ne-promet-pas) quand cela fonctionne. C'est aussi ce qu'un puits qui horodate à l'arrivée aurait stocké deux fois.

Ce que cela ne couvre pas : un `kill -9` pendant que la liaison est saine. Les mesures en mémoire à ce moment sont perdues, par conception, et nous ne les avons pas comptées.

## Ce qu'elle écrit sur disque

`write_bytes` de `/proc/<pid>/io` est ce que le noyau a reçu l'ordre d'envoyer au stockage pour le processus, écritures annulées déduites. C'est le chiffre qui compte pour une carte flash. Chaque ligne correspond à 300 secondes d'un scénario, après 30 secondes de stabilisation, avec disk-writes.sh. Le flux est le flux de la preuve avec InfluxDB derrière, donc la charge est réelle.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Scénario | Débit | Vidage du contexte | Écrit par heure | Par jour |
|---|---|---|---|---|
| Repos, une liaison durable dans le flux | aucun | 5 s | 0 octet | 0 |
| Liaison durable saine, charge constante | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Liaison durable saine, charge constante | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Idem, contexte vidé toutes les 5 s | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Idem, contexte vidé toutes les 5 s | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Contexte seul, liaison ordinaire | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Liaison qui déverse, InfluxDB arrêté | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Liaison qui déverse, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Lisez-le en trois parties.

**Au repos, rien n'est écrit.** Zéro octet en cinq minutes.

**Une liaison saine n'écrit rien de son propre chef.** Les lignes saines sont du contexte persistant, un compteur incrémenté à chaque message, et rien d'autre. La ligne contexte seul avec une liaison ordinaire est dans le bruit par rapport à elles. Le vidage du contexte était de cinq secondes par défaut jusqu'à ce tableau : à vingt messages par seconde, cela faisait 5.1 MiB par heure, 0.12 GB par jour, et trente secondes le ramènent à 1.7 MiB, ce qui explique le défaut de trente. Un kill -9 perd alors jusqu'à trente secondes de contexte.

**Une liaison qui déverse coûte cher, et seulement pendant qu'elle déverse.** Chaque message est sa propre validation, environ 10 KB d'écritures chacun, car l'émetteur attend le disque. Dix minutes de panne à vingt par seconde font environ 120 MiB, une panne d'une journée environ 17 GB. C'est le prix de « sur disque avant que l'émetteur passe à la suite », payé seulement pendant que l'historien est en panne. La validation groupée partage une transaction entre émetteurs concurrents, mais un seul émetteur fait une validation.

Un dernier chiffre, parce qu'il m'a surpris. À 100 messages par seconde, ce banc n'a pas gardé la liaison saine : la cible a cessé de suivre, la liaison a déversé et a continué de déverser pendant tout le test, 3,548 MiB par heure. Nous n'avons pas cherché si le relais ou InfluxDB était le plus lent. C'est la conception qui fonctionne comme écrit, car « en retard » compte comme ne pas suivre, et cela veut dire qu'une cible plus lente que son entrée met une liaison durable sur le disque. À 50 messages par seconde, elle est restée saine.

La conception précédente écrivait chaque message sur disque d'abord. Avec le premier schéma (pages de 4 KiB, une table et un index), cela mesurait 632 MiB par heure à 20 messages par seconde même avec InfluxDB sain, et 1,163 MiB avec chaque marque « fait » écrite aussitôt. C'est de là que vient « le disque seulement pendant une panne ».

### Sur du matériel réel

Ces chiffres ont été mesurés sur une machine x86 sous WSL2, et le magasin durable a depuis tourné sur du matériel réel (2026-11-17). Les octets écrits sont une propriété du code et de la taille de page : les chiffres ci-dessus restent donc valables. Ce que fait une carte de ces écritures (amplification d'écriture, usure) ne l'est pas, pas plus que la mémoire, le temps de démarrage et le débit soutenu en messages par seconde : ces chiffres restent donc étiquetés avec l'endroit où ils ont été mesurés.
