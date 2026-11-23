---
title: "Edge Publish et stockage-retransmission"
description: "Publiez tout ce qu'un équipement lit vers un Gateway central en nœud Sparkplug B, mettez en tampon sur disque si la liaison tombe, puis rejouez dans l'ordre."
---

Edge Publish, depuis la 4.5.0, fait de HotLoop un **nœud de périphérie** Sparkplug B qui publie tout ce qu'il lit vers un Gateway central par MQTT, dans le sens inverse du pilote MQTT existant, qui consomme Sparkplug comme hôte principal. Voilà ce que veut dire l'exécuter.

La publication edge est activée par défaut dans le Gateway et dans Edge, et reste inactive tant qu'elle n'a pas de broker et de groupe Sparkplug, par le chart ou l'environnement, ou saisis par un administrateur sous Paramètres, "Où vont les alarmes et les mesures" (voir [Notifications d'alarme](/fr/iot/notifications/#where-alarms-go-settings)). Ce qui y est enregistré l'emporte, et c'est lu au démarrage de HotLoop, parce que le publieur possède le fichier de la file et le nœud. Sans rien de renseigné, il ne publie rien et n'empêche pas HotLoop de démarrer.

Une fois activé, il tourne dans le même processus Gateway, toujours connecté à TimescaleDB, ce qui est utile quand un site veut l'interface et l'historique du Gateway complet en local, en plus d'une liaison montante vers un Gateway central. La gestion de parc pour de nombreux Edge Relay est arrivée en 4.7.0 (suivi, à partir de leurs births et deaths) et en 4.8.0 (envoi de configuration) ; voir la page de gestion de parc.

## L'activer

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Chaque lecture qui arrive sur le bus de tags (le même flux que lisent l'interface en direct et l'évaluateur d'alarmes) est publiée en `NDATA` Sparkplug B. Tant que le broker est joignable et confirme, cela se fait directement depuis la mémoire et le disque n'est pas touché. Quand le broker cesse de confirmer, les lectures vont dans la file de retransmission sur disque et en sortent, dans l'ordre, à son retour.

## Ce qu'il fait réellement

**Abonné avant de naître.** À chaque connexion, la première et chaque reconnexion, le nœud s'abonne à son topic `NCMD` (et à son topic d'envoi de configuration) et attend que le broker confirme les deux avant de publier quoi que ce soit. Sparkplug B 3.0 l'exige (« Avant d'envoyer un message NBIRTH, le client MQTT associé au nœud de périphérie doit s'abonner pour recevoir les messages NCMD »), et pour une bonne raison : un hôte a le droit de répondre à un birth par une demande immédiate de rebirth ou de redémarrage, et un nœud qui fait son birth d'abord peut la manquer. `Start()` ne rend pas la main tant que les abonnements ne sont pas en place. Si le broker en refuse un (une ACL qui ne laisse pas ce nœud lire son propre topic `NCMD`), `Start()` échoue avec une erreur qui le dit ; un nœud que personne ne peut commander ne doit pas démarrer en faisant semblant du contraire. Une reconnexion qui ne peut pas se réabonner ne fait pas de birth sur cette session ; les lectures continuent d'aller dans la file de retransmission.

**Un broker absent n'empêche pas le démarrage.** Un refus est un problème de configuration et fait échouer `Start()`. Une injoignabilité est une panne : `Start()` la consigne et rend la main, et le nœud continue d'essayer en arrière-plan (une seconde, en doublant jusqu'à une minute) pendant que chaque lecture va dans la file de retransmission. Auparavant il échouait aussi dans ce cas, et le Gateway et l'Edge se ferment quand Edge Publish ne démarre pas, si bien qu'un équipement redémarré pendant une coupure du WAN bouclait en erreur, sans écrans, sans alarmes, sans automatisations et sans rien en tampon jusqu'au retour du WAN.

**Un NBIRTH par connexion.** Chaque tag connu, annoncé par son nom avec un alias stable, et sa valeur actuelle. Un birth a lieu à la première connexion, à chaque reconnexion (une session Sparkplug repart de zéro, et sa numérotation de séquence n'a aucun sens d'une reconnexion à l'autre), quand un tag que personne n'avait vu apparaît dans un lot, et sur demande, voir plus bas.

**NDATA pour tout le reste**, par alias seulement, sans nom. `seq` commence à 0 avec le birth et augmente (modulo 256) à chaque message jusqu'au suivant.

**NDEATH** de deux façons : proprement à `Stop()`, et via le last-will de la connexion MQTT elle-même si le processus meurt sans avoir pu le faire. Les deux portent la même valeur `bdSeq`, qui correspond au birth qu'ils terminent. Un hôte distingue un ancien certificat de décès, resté d'une session précédente, du certificat actuel grâce à ce numéro.

**`bdSeq` compte les sessions, et le compte survit à un redémarrage.** Chaque MQTT CONNECT reçoit le numéro suivant : 0 à la première session d'une file, un de plus à chaque fois, retour à 0 après 255 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment : `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), et le NBIRTH de cette connexion porte le même numéro que le will qu'elle a enregistré (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Il vit dans le fichier de la file de retransmission, de sorte qu'un nœud redémarré continue de compter au lieu de repartir de 1 et de remettre à l'hôte un will qu'il a déjà vu, qu'un hôte a le droit d'ignorer comme périmé. Une reconnexion est une nouvelle session, elle reçoit donc aussi un nouveau numéro ; l'ancien code en gardait un pour toute la vie du processus parce que la bibliothèque cliente MQTT réutilise le will avec lequel elle a été créée, et le nœud construit désormais un client neuf, donc un will neuf, à chaque tentative de connexion. La métrique est de type INT64, comme le demande la spécification (elle partait en UInt64 avant ; la valeur circule dans le même champ, donc un hôte qui la lit par valeur ne s'en aperçoit pas).

**`NCMD` → `Node Control/Rebirth`.** Un hôte qui demande un rebirth reçoit un NBIRTH neuf, avec le même `bdSeq`. Un rebirth n'est pas une nouvelle session, il ne reçoit donc pas de nouveau numéro (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Quand la liaison montante est coupée

**Le disque sert aux pannes, pas à chaque scrutation.** Tant que la liaison montante est active et que le broker confirme, les lectures restent en mémoire seulement jusqu'à ce que le vidangeur les ait envoyées et que le broker les ait confirmées, et rien n'est écrit sur le disque. Dès qu'il n'y a plus de session, qu'une confirmation ne vient pas, ou que la mémoire dépasserait 100 000 lectures, tout ce qui est en mémoire passe dans la file sur disque dans l'ordre, tout ce qui suit se range derrière, et le vidangeur lit sur le disque, le plus ancien d'abord, ne retirant une lecture qu'une fois que le broker l'a confirmée. Le nœud ne revient à la mémoire que lorsque le disque est vide, il n'y a donc jamais un moment où des lectures plus récentes dépassent des plus anciennes.

Nous l'avons construit deux fois, et la première version était mauvaise pour le matériel. Elle écrivait chaque lecture sur disque avant de l'envoyer, si bien qu'un arrêt brutal ne perdait rien de ce que le nœud avait accepté. Mais elle écrivait aussi environ 5 Mo par seconde à 2 000 lectures par seconde, soit 450 Go par jour, à partir d'environ 160 commits de file par seconde à huit pages chacun. Cela tue une carte SD et représente une usure ridicule pour n'importe quelle mémoire flash. Le coût disque en régime établi est maintenant nul (les chiffres sont plus bas), et ce à quoi nous avons renoncé en échange est dit clairement dans la section suivante.

**Un arrêt brutal avec la liaison active perd ce qui était en mémoire.** Un SIGKILL, une coupure de courant ou un kernel panic, pendant que la liaison est active et que le broker confirme, emportent les lectures qui n'étaient pas encore confirmées. Cela représente environ une scrutation : à 2 000 lectures par seconde et avec un aller-retour de confirmation de quelques millisecondes, quelques centaines de lectures au plus, soit autant de scrutations que l'hôte aurait vues un instant plus tard. Elles ne sont pas comptées comme abandonnées, parce que rien ne sait qu'elles ont existé. Un arrêt propre (`Stop`, un SIGTERM, un redémarrage) écrit d'abord sur disque ce qui est en mémoire et ne perd rien. Une liaison coupée ne perd rien non plus dans les deux cas, parce que la première chose que fait le nœud quand la liaison cesse de confirmer est de déplacer la mémoire sur le disque. Le seul cas que cette conception ne couvre pas est celui du processus qui meurt alors que la liaison est active, et il n'est pas couvert volontairement.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` borne la file de panne, et sa valeur par défaut est 64 MiB, environ deux minutes de panne à 2 000 lectures par seconde (le banc d'essai ci-dessous l'exécute à ce niveau : environ 248 000 lectures y tiennent, mesuré en 4.21.1). Au-delà, les lectures les plus anciennes partent d'abord et sont comptées. Mettez-la à 0 et la file n'a plus de limite : le processus vous en avertit au démarrage, parce qu'une très longue panne sur une file sans limite remplit le volume au lieu d'abandonner les anciennes lectures comme le fait déjà la propre file en mémoire de l'historien.

Une lecture que le vidangeur sort dans les quelques secondes qui suivent sa mise en file part comme valeur actuelle du tag, dans un seul `NDATA` avec le reste de sa scrutation. Une lecture qui a attendu plus longtemps, ou qui a été laissée par un processus mort, part marquée `is_historical`, pour qu'un hôte ne la laisse pas écraser ce que le tag fait maintenant. À la reconnexion, la file est vidée **avant** que quoi que ce soit de plus récent soit publié, le plus ancien d'abord, car il n'y a qu'une seule sortie.

Un rejeu est empaqueté : jusqu'à 200 lectures historiques partagent un `NDATA`, chaque métrique portant son propre horodatage et `is_historical`. La spécification l'autorise (« Plusieurs changements de valeur d'une même métrique PEUVENT être inclus dans le même message Sparkplug NDATA ... tant qu'ils ont des horodatages différents », Sparkplug B 3.0, Operational Behavior, Data Publish), de sorte qu'un message ne contient jamais deux fois un tag à la même milliseconde et en commence un autre. Nous les avons empaquetées parce qu'une lecture par message était le goulot d'étranglement, et le profilage l'a confirmé : 57 % du CPU du rejeu était l'appel système write que la bibliothèque cliente MQTT fait une fois par paquet, et 200 000 lectures en file ont pris 58,5 secondes, 3 418 par seconde, face à une usine qui en produit 2 000 par seconde. Un rejeu plus lent que l'usine est un retard qui ne finit jamais. Empaquetées, les mêmes 200 000 lectures prennent 2,9 secondes, 68 237 par seconde, mesuré alors que le nœud était encore en QoS 1. Les lectures en direct partent toujours à raison d'une scrutation par `NDATA`.

**QoS 0, comme le dit la spécification, et un aller-retour pour savoir que c'est arrivé.** NBIRTH et NDATA partent en QoS 0 et sans retained (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). Le will NDEATH est en QoS 1 et sans retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), de même que le NDEATH propre que publie `Stop`. Le piège du QoS 0 est qu'il n'y a pas d'accusé de réception : une publication « se termine » quand les octets atteignent le socket local, et cela marche très bien vers une liaison morte, donc la traiter comme une livraison retirerait des lectures du disque au moment même où elles comptent. À la place, le nœud envoie une requête derrière chaque morceau (un SUBSCRIBE à son propre topic NCMD, qu'il doit de toute façon avoir le droit de faire) et conserve le morceau jusqu'à ce que le broker y réponde. Une connexion est un flux d'octets ordonné et un broker traite les paquets d'un client dans l'ordre où il les lit, donc la réponse signifie qu'il a lu tout ce qui précède. C'est la garantie qu'apportait un PUBACK, un aller-retour par morceau au lieu d'un accusé par message. Un test écrit dans une liaison silencieuse et vérifie que rien ne quitte la file, ni en mémoire ni sur disque ; sans l'aller-retour, les 30 lectures qu'elle contenait sont parties.

**Une connexion qui ne répond plus est abandonnée, pas attendue jusqu'au bout.** Si le broker ne confirme pas un morceau, ou si la bibliothèque cliente MQTT ne peut pas accepter un message, le nœud ferme lui-même cette connexion et démarre une nouvelle session (`bdSeq` suivant, birth neuf) en conservant tout ce qui n'est pas confirmé (déplacé sur disque s'il était en mémoire). Il le faut, parce qu'une liaison qui meurt sans reset accepte des écritures jusqu'à ce que le tampon d'envoi du noyau soit plein, et alors l'unique goroutine d'écriture de la bibliothèque cliente MQTT reste bloquée dans un write. C'est aussi la goroutine qui envoie le PING de keepalive, donc le keepalive ne se déclenche jamais et le nœud reste dans la connexion morte aussi longtemps que dure la panne : une coupure d'essai de six minutes a montré qu'il ne s'en était pas aperçu avant le retour de la liaison. Pire, la passe qui écrivait s'est réveillée sur la nouvelle connexion et a continué d'envoyer le reste de son ancien morceau avant le NBIRTH de la nouvelle session, avec les numéros de séquence de l'ancienne. Désormais chaque passe appartient à la session dans laquelle elle a commencé et reçoit une erreur, pas le fil, une fois cette session terminée.

La livraison est **au moins une fois**. Un morceau que le broker a pris mais n'a jamais confirmé est renvoyé, comme historique, et un arrêt brutal entre la livraison et le moment où le nœud la note fait la même chose. Un hôte qui consomme ceci doit tolérer un doublon ; il ne doit jamais supposer que cette file a déjà dédoublonné pour lui.

### Ce qu'il promet, et les chiffres derrière

- **Ordre exact.** Chaque lecture de chaque tag arrive à l'hôte dans l'ordre où elle a été lue, en direct et rejouée ensemble, à travers un SIGKILL et un redémarrage.
- **Un fichier borné.** La borne porte sur le fichier de la file, ce qui remplit le volume, pas sur les données qu'il contient. Le fichier de la file, ce sont les données plus les en-têtes de page, les pages de branche, une liste libre et une marge de croissance ; avec l'ancienne borne (le décompte propre de la file des octets de feuille), le fichier sortait au double des données. Toute valeur inférieure à 1 MiB fonctionne comme 1 MiB, avec un avertissement au démarrage.
- **Rien de perdu pendant une panne.** Dès que la liaison cesse de confirmer, chaque lecture est sur le disque et y reste jusqu'à ce que le broker l'ait confirmée, de sorte que chaque lecture ressort à travers une panne, une connexion morte, un arrêt propre, et un SIGKILL ou une coupure de courant au milieu de la panne. L'exception est celle d'en haut : un arrêt brutal ou une coupure de courant avec la liaison active perd environ une scrutation, les lectures encore en mémoire.
- **Abandons bruyants et comptés au-delà de la borne.** Les lectures les plus anciennes partent d'abord, et chacune entre dans un compteur d'abandons qui vit dans le fichier de la file, de sorte qu'un redémarrage n'efface pas la preuve. Il est dans `GET /api/diagnostics` sous `edgePublish` (et dans le `/status` du relay sous `uplink`), à côté de ce qui est en file, de la taille du fichier et de l'état d'un éventuel rejeu. Le journal le dit une fois par minute tant que cela se produit, jamais une fois par scrutation. Le compte peut avoir un peu d'avance sur la perte et jamais de retard : les lectures que l'hôte a reçues juste avant une coupure, dont la confirmation n'est jamais venue, sont toujours sur le disque quand la borne les prend, et sont comptées bien que l'hôte les ait.
- **Une lecture qui n'a été que scrutée peut être perdue lors d'un arrêt brutal avec la liaison active.** Entre le moment où le pilote remet une lecture et celui où le broker la confirme, elle n'existe que dans le processus, et un SIGKILL ou une coupure de courant l'emporte. C'est le prix de ne pas écrire chaque scrutation sur disque, et nous l'avons choisi plutôt que 450 Go par jour. Arrêtez le processus quand rien n'est en vol et la réponse est exacte : chaque lecture que l'usine a fournie a été livrée ou comptée.

Tout cela est mesuré avec un vrai HotLoop Edge qui scrute 20 appareils HTTP de 25 tags chacun toutes les 250 ms (2000 lectures par seconde), en publiant vers un vrai Mosquitto. Chaque appareil répond à chaque scrutation par un compteur supérieur d'une unité au précédent, de sorte qu'un juge côté hôte sait exactement quelle lecture a manqué, laquelle est revenue deux fois et laquelle est sortie dans le désordre. La liaison montante est coupée en débranchant le broker du réseau : le socket de l'Edge devient silencieux, sans reset ni raccrochage. Pour arrêter le processus avec rien en vol, l'usine s'interrompt quelques secondes avant le SIGKILL (« quiesced ») ; les autres arrêts tombent là où en est la scrutation (« instant »). Les exécutions du 2026-10-12, avec une borne de 64 MiB. « Before » est `15419f1`, la version qui précède ce travail. « Write-ahead » est `165411f`, qui écrivait chaque lecture sur disque d'abord et que nous avons retirée. « Now » est la mémoire tant que la liaison est active et le disque pendant une panne :

| <span class="sr-only">Details</span> | Avant | Écriture préalable | Maintenant |
|---|---|---|---|
| Régime établi, liaison montante active, 2 000 readings/s | 2 018 readings/s, 0 bytes/s vers le disque, 9 % d'un CPU | 2 031 readings/s, 5,4 Mo/s vers le disque (450 Go par jour), 14 % d'un CPU | 10 minutes : 2 002 readings/s, 0 bytes écrits sur le disque (0 bytes par jour), 0 page écrite du magasin de file embarqué, fichier de file de 32 768 bytes avant et après, 9 % d'un CPU |
| Rejeu d'une panne de 5 minutes, alors que les lectures arrivent toujours à 2 000 readings/s | 829 745 lectures en 4 m 11 s, 3 308 par seconde | de 194 247 à 308 582 par seconde | 244 335 lectures en 824 ms, 296 523 par seconde |
| Comptabilité après une panne de 5 minutes | perdues 441 255, comptées 441 255 | perdues 474 978, comptées 474 978 | perdues 599 165, comptées 599 165, toutes les plus anciennes, toutes dues à la borne |
| Ordre, alias, trous de séquence, direct pendant un rejeu | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL avec rien en vol, liaison montante active | perdues 0 | perdues 0 | perdues 0 |
| SIGKILL avec rien en vol, à 90 s d'une coupure silencieuse de 5 minutes, au-delà de la borne | non exécuté | perdues 528 167, comptées 528 667 | perdues 520 661, comptées 521 161 (les 500 en plus ont été livrées, jamais confirmées) |
| Dix SIGKILL instantanés, liaison montante active | perdues 0 (une exécution précédente : 50 sur quatre) | perdues 0 (une exécution précédente : 250) | perdues 0 dans cette exécution ; un arrêt peut emporter environ une scrutation, voir plus haut |

Le coût est dans la première ligne. L'écriture préalable faisait environ 160 commits par seconde (un par scrutation pour la mettre sur disque, un par morceau pour l'en retirer) à environ huit pages de 4 Ko chacun, soit 5 Mo/s et 450 Go par jour, et une carte SD n'y survit pas. En régime établi, le nœud n'écrit désormais plus du tout dans la file : le compteur `write_bytes` de l'Edge dans `/proc` n'a pas bougé en dix minutes. Les dix arrêts instantanés n'ont rien perdu lors de cette exécution, et c'est de la chance, pas une promesse : la fenêtre, ce sont les lectures en mémoire quand le processus meurt, environ une scrutation.

Une version précédente a trouvé l'autre moitié de ce pour quoi ce travail était fait : le QoS 0 et une connexion qui cesse de répondre. Voir « Une connexion qui ne répond plus est abandonnée » plus haut. La coupure de cinq minutes avant ce correctif avait laissé le nœud dans une connexion morte pendant toute la panne, puis envoyer un morceau périmé avant le birth de la nouvelle session ; 100 lectures sont arrivées dans le désordre.

Une version précédente a trouvé l'autre moitié de ce pour quoi ce travail était fait : le QoS 0 et une connexion qui cesse de répondre. Voir « Une connexion qui ne répond plus est abandonnée » plus haut. La coupure de cinq minutes avant ce correctif avait laissé le nœud dans une connexion morte pendant toute la panne, puis envoyer un morceau périmé avant le birth de la nouvelle session ; 100 lectures sont arrivées dans le désordre.

À cette charge, une file de 64 MiB contient environ deux minutes de panne : environ 248 000 lectures, soit environ 236 octets par lecture avec des noms de tag de neuf caractères (mesuré en 4.21.1, fichier de file de 61,7 Mo), et un nom de tag plus long coûte davantage. Dimensionnez la borne d'après votre propre débit et vos propres noms de tag. Les lignes du 2026-10-12 ci-dessus concordent : la panne de 5 minutes a rejoué 244 335 lectures, soit les mêmes deux minutes. Le rejeu n'est plus une limite : il tourne à plus de cent fois la cadence d'arrivée des lectures.

Le juge signalait de 4 000 à 6 000 doublons dans une exécution sans panne. Nous avons capturé le trafic pour savoir à qui ils étaient : chacun était un NBIRTH répétant la dernière valeur d'un tag qu'un message antérieur avait déjà portée, avec l'horodatage propre de la lecture, et pas un seul n'était un NDATA envoyé deux fois. Un birth doit porter la valeur actuelle de chaque métrique du nœud (c'est à cela que sert un birth), et le nœud refait un birth chaque fois qu'un nouveau tag apparaît, de sorte que les births suivants répètent les précédents. Le publieur avait raison et le juge avait tort. Il les compte désormais à part comme des instantanés et réserve « doublon » à une lecture publiée de nouveau comme donnée, le seul type qu'un hôte pourrait prendre pour une nouvelle. Dans l'exécution stable et dans celle des dix arrêts, le nombre reçu est maintenant exactement égal au nombre fourni : 1 296 275 et 916 350.

## Ce qui a été vérifié ou non

HotLoop a été exécuté sur du vrai matériel et de vrais serveurs, et sur du matériel réel le 2026-11-17.

## Configuration

| Variable | Par défaut | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | La fonction est désactivée tant que ceci n'est pas défini |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | s. o. | Hôte seul, `host:port`, ou une URL complète |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | s. o. | Id de groupe Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_NODE` | nom d'hôte du pod | Id de nœud Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | s. o. | Identifiants du broker |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | À activer par déploiement ; ne le définissez jamais par défaut |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | Le fichier de la file de retransmission |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | Le fichier de la file ne dépasse jamais cette taille ; les lectures les plus anciennes sont évincées, et comptées, pour rester en dessous. `0` signifie sans limite, avec un avertissement. Toute autre valeur inférieure à 1 MiB fonctionne comme 1 MiB, avec un avertissement |

## Dans le chart Helm

Le chart du Gateway a un bloc `edgePublish:` qui définit tout cela. Il est désactivé par défaut, et désactivé il produit exactement ce que le chart produisait avant l'existence du bloc. Ne définissez plus ces valeurs par `extraEnv`.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

Le chart décide de quelques points à votre place :

- Le fichier de la file est `/data/edge-publish/forward.db`, sur son propre PVC. Ce n'est pas une valeur, parce que partout ailleurs dans le pod le système de fichiers racine est en lecture seule. Avec `persistence.enabled: false`, il va sur un emptyDir, qui conserve les lectures d'une panne à travers un redémarrage du conteneur mais pas à travers un pod replanifié.
- L'id de nœud est par défaut le nom de la release, et non le nom d'hôte du pod. Un pod de Deployment reçoit un nouveau nom d'hôte à chaque déploiement, et l'hôte verrait un nouveau nœud de périphérie à chaque fois, avec les lectures en tampon rejouées sous lui.
- Le Deployment passe en `Recreate` et `replicaCount` doit valoir 1. Le fichier de la file prend un verrou : lors d'une mise à jour progressive, le nouveau pod ne peut pas l'ouvrir, ne devient jamais prêt, et le déploiement se bloque. Et deux réplicas feraient deux publieurs sur un même id de nœud.

Le chart de l'Edge Relay (`charts/hotloop-edge-relay`) a son propre bloc `edgePublish:` du même genre, sans `enabled` : le relay publie toujours.
