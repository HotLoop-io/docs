---
title: "Traçage et rejeu"
description: "Cliquez sur un message de débogage pour voir son trajet, rejouez-le dans un brouillon, faites d'une trace un test et envoyez des spans à OpenTelemetry."
---

Une valeur dérape à 2 h du matin et la console de débogage vous donne la valeur. Elle ne vous dit pas lequel des neuf nœuds traversés l'a modifiée, combien de temps le plus lent l'a gardée, ni à quoi elle ressemblait en entrant. Pour le savoir, on sème des nœuds Debug dans le flux, on déploie, on attend que cela se reproduise et on les retire.

Chaque message qui entre dans le flux reçoit donc une trace. Chaque message de débogage de la console a un bouton **Trace**, et un clic éclaire sur le canevas le chemin suivi par ce message : les nœuds traversés, les fils empruntés, et tout ce qu'il n'a jamais touché est atténué. Chaque nœud du chemin indique combien de temps il a détenu le message (`8.3 µs`, ou `8.3 µs ×3` quand il en a traité trois morceaux), et le panneau Trace à côté liste chaque saut dans l'ordre avec le message tel que ce nœud l'a reçu. Cliquez sur une ligne et vous voilà sur le nœud. Un saut en échec est rouge, avec l'erreur dessous.

Il suit le message là où il va réellement :

- **À travers un Split.** Une mesure devient trois, et les trois figurent dans la trace, chacune comme son propre saut à chaque nœud après la division.
- **À travers un Join.** Le saut après un Join a pour parents tous les messages que le Join a absorbés pour lui, et pas seulement le dernier arrivé. Les trois branches qui l'ont alimenté sont toutes éclairées.
- **À travers un sous-flux.** Les nœuds à l'intérieur s'exécutent en copies avec leurs propres ids, et les sauts sont consignés sous ces ids. Le canevas éclaire l'instance du sous-flux, car c'est le nœud de l'onglet que vous regardez.
- **Jusqu'à un Catch.** Le nœud qui a échoué porte l'erreur sur son saut, et le Catch qui l'a reçue est le saut suivant, marqué comme atteint par une erreur.

La trace voyage avec le message sans en faire partie. Aucun flux ne peut la lire ni la casser avec `msg = {...}`, et elle n'apparaît jamais dans un nœud Debug, un test ou un payload sur le fil.

## Elle ne peut pas grossir

Elle tourne sur la ligne qu'elle surveille, donc chaque dimension est bornée, et les limites se trouvent sous `trace:` dans la [configuration](/fr/flow/configuration/) :

| Limite | Valeur par défaut |
|---|---|
| Traces conservées, les plus récentes | 256 |
| Sauts qu'une trace conserve, pour qu'une boucle ne puisse pas s'écrire sans fin | 512 |
| Plus gros message dont un saut garde une copie | 16 KiB |
| Le tout, compté approximativement, les plus anciennes oubliées d'abord | 16 MiB |
| Nouvelles traces démarrées par seconde | 1,000 |

Un message de plus de 16 KiB garde son chronométrage et est marqué comme trop gros pour être affiché, et il ne peut être ni rejoué ni transformé en test. Au-delà de 1,000 nouvelles traces par seconde, le reste des messages de cette seconde n'est pas tracé, car un capteur qui parle cent mille fois par seconde paierait sinon une trace pour chacun. Un message ignoré, ou dont la trace a été évincée en cours de route, reste sans trace pour le reste de son trajet ; démarrer une nouvelle trace à mi-chemin ne ferait que remplir le tampon avec les queues de trajets dont les têtes ont disparu. Tout est compté sur `/metrics`, vous voyez donc quand cela arrive.

L'essai d'endurance : **un million de messages à travers cinq nœuds, 2026-10-18**, sur la même machine que [les chiffres ci-dessus](/fr/flow/overview/#les-chiffres). Heap après un GC forcé, relevé tous les cent mille messages :

| Traçage | Heap, à chaque point de contrôle | Messages par seconde |
|---|---|---|
| Traçage désactivé | **1.3 MiB** | 192,596 |
| Traçage de chaque message (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Limites par défaut | **4.0 MiB** | 195,199 |

C'est le même chiffre aux dix points de contrôle. Le traceur a tenu 808,448 octets dans 256 traces du premier point de contrôle au dernier, a oublié 999,744 messages du million en route, et n'a jamais approché ses 16 MiB. Tracer chaque message a un coût : cette chaîne est passée de 192k par seconde à 116k. C'est pourquoi la limite par défaut existe. À 1,000 traces par seconde, le coût se perd dans le bruit, et en dessous une trace pèse environ 3 KB. Si vous voulez quand même chaque message, réglez `perSecond: 0` et lisez la première ligne de ce tableau avant de décider. Reproduisez-le avec :

Si le heap cesse d'être plat, le test échoue.

## Le rejouer dans un brouillon

Vous avez trouvé la mauvaise valeur, vous pensez connaître le correctif, et vous avez modifié un nœud sur le canevas. Ne déployez pas pour le savoir. **Replay into draft** prend le message qui a démarré la trace, l'injecte dans le flux tel qu'il est sur votre canevas à cet instant, déployé ou non, et vous dit où il finit par rapport à l'endroit où il avait fini la première fois.

« Finir » désigne les endroits où le message s'est arrêté : un nœud Debug, un MQTT Out, un Switch qui n'a rien reconnu, un Join encore en attente. Pour chacun, la comparaison dit que c'est identique, ou quelles propriétés ont changé (`payload: "HIGH" -> "CRITICAL"`), ou que l'original s'y est arrêté et pas le rejeu, ou l'inverse. Le chemin du rejeu lui-même est éclairé sur le canevas, vous voyez donc où le brouillon l'a envoyé. **Back to the original trace** remet la première.

Il s'exécute comme un [test de flux](/fr/flow/tests/), dans un processus enfant avec le vrai runtime et les vrais nœuds, et pour la même raison : votre brouillon démarre tous ses nœuds et rien ne peut toucher l'usine. Un nœud qui aurait appelé un service web répond donc par rien, et un flux dont la sortie dépend d'une réponse apparaît comme une différence. C'est le résultat honnête. Il ne fera pas semblant d'avoir parlé à un automate auquel il n'a jamais parlé.

## Une trace devient un test

**Make test** dans le panneau Trace rédige un [test de flux](/fr/flow/tests/#des-tests-depuis-léditeur) à partir de toute la trace : le message qui l'a démarrée, injecté à la source par laquelle il est entré, et chaque endroit où il a fini qu'un test peut surveiller, avec ce que ce nœud a reçu comme valeur attendue. Ce sont les deux mêmes clics qu'un test depuis un message de débogage, et c'est mieux pour les flux tordus, car une trace se souvient de chaque extrémité atteinte par un message. Une division vers trois nœuds Debug fait trois attentes, là où un message de débogage en faisait une.

Elle dit pourquoi quand elle ne peut pas. Une trace démarrée dans un sous-flux, depuis la deuxième sortie d'une source, ou depuis un message trop gros pour être conservé ne peut pas être réinjectée comme un test l'exige. Et un message écarté par un Switch ne finit nulle part où un test peut regarder ; il est donc refusé plutôt qu'écrit en test vide, car un test sans rien à vérifier passe.

## OpenTelemetry

Pointez-le vers un collecteur et chaque saut part sous forme de span :

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Une trace est une trace OpenTelemetry et un saut est un span, avec le saut qui a envoyé le message pour parent. Le span d'un Join a le premier pour parent et les autres comme liens. Chaque span porte l'id du nœud, son type, l'id du message, le nombre de messages que le nœud a transmis et le port de sortie par lequel il a été atteint, et une erreur est un span avec un statut d'erreur. **Les messages ne sortent jamais.** Un payload est la donnée d'une usine et un collecteur est le serveur d'un tiers : ce qui sort, c'est la forme du trajet et son chronométrage.

Il parle OTLP/HTTP avec l'encodage JSON que définit la spécification, écrit à la main dans un seul fichier, plutôt que d'embarquer le SDK OpenTelemetry avec son protobuf et son gRPC pour faire le même unique POST. Le binaire a un budget de taille et nous ne le dépensons pas là-dessus. Chaque id de span, parent, lien, nom, attribut et statut d'erreur doit correspondre. Il n'y a aucun mock dans ce test. Si le collecteur est en panne, l'export abandonne des spans et les compte, et le flux ne s'en aperçoit jamais ; `hotloop_flow_otlp_spans_failed_total` qui dépasse zéro est le signal pour le savoir.
