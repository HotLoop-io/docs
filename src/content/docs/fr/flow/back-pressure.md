---
title: "La contre-pression, à la vue de tous"
description: "Un plafond sur chaque file, une règle pour ce qui arrive au plafond et un graphique de chaque message qui n'a pas tenu, avant l'arrêt par manque de mémoire."
---

Voilà tout le projet. La défaillance typique d'un moteur de flux sur un boîtier en périphérie est un pod qui gonfle en silence jusqu'à ce que le kubelet le tue, et le journal qu'il laisse n'explique rien à celui qui tient l'astreinte. Alors chaque endroit où un message ou un octet peut s'accumuler a un plafond, et chaque plafond est une décision écrite et documentée dans [Compatibilité Node-RED](/fr/flow/compatibility/), pas une limite que nous avons fixée sans jamais la mentionner.

| Ce qui peut s'accumuler | Ce qui l'arrête |
|---|---|
| La boîte de réception d'un nœud | Un plafond (1024 par défaut) et l'une de quatre politiques de débordement |
| Files de délai et de limitation de débit | Un plafond ; au-delà, le message est refusé vers un nœud Catch |
| Minuteries de Trigger | Un plafond |
| Sortie de `exec` | Limitée par flux ; une troncature lève une erreur |
| Processus `exec` | Une limite de concurrence ; au-delà, ils sont refusés |
| Lectures de fichiers | Limitées, avec des modes par ligne et par blocs |
| Corps de requêtes HTTP | Limités |
| Attente d'une réponse HTTP | Un 504 après un délai |
| Connexions et trames TCP | Bornées |
| Files d'envoi WebSocket | Bornées ; un client lent est déconnecté |

Les politiques de débordement, définies globalement et modifiables par nœud :

| Politique | Ce qui se passe |
|---|---|
| `block` | L'émetteur attend qu'il y ait de la place, jusqu'à `blockTimeout`. La contre-pression remonte en amont, ce qui est presque toujours la bonne réponse. |
| `drop-newest` | Le message qui arrive est écarté. Compté et annoncé. |
| `drop-oldest` | La tête de la file part pour faire de la place. Compté et annoncé. Pour « seule la dernière mesure compte ». |
| `error` | L'envoi est refusé et remonté à un nœud Catch, pour que le flux décide. |

Rien n'est jeté en silence. Chaque abandon est compté, poussé vers l'éditeur comme un événement et exporté comme une métrique sur laquelle vous pouvez alerter. Quand une limite mord, vous l'apprenez par un graphique, pas par un opérateur.

## Une goroutine par nœud

Chaque instance de nœud a sa propre goroutine et sa propre boîte de réception. Ordonné dans un nœud, parallèle entre les nœuds. Un nœud Function qui fait un vrai travail occupe un cœur pendant que l'éditeur, l'API, le websocket et tous les autres flux continuent d'avancer.

## Chaque destinataire reçoit sa propre copie

Quand un fil se divise, chaque nœud à l'autre bout reçoit sa propre copie du message, si bien que deux branches qui se croient propriétaires du message ne peuvent pas se corrompre l'une l'autre, et une branche ne se comporte jamais autrement que ses sœurs d'apparence identique à cause de l'ordre dans lequel vous les avez câblées. C'est un bogue qui se reproduit les mardis, et il n'existe pas ici.

Ce n'est pas gratuit. Copier un petit message (une mesure et un sujet) coûte de 411 à 453 ns et 680 octets, et une chaîne de cinq nœuds fait avancer un message toutes les 1,14 à 1,40 µs, copies comprises. Là où la copie fait mal, c'est sur une grosse charge utile binaire : un tampon de 1 MiB coûte de 128 à 156 µs et un mégaoctet de plus sur le tas pour chaque destinataire. Les grosses charges utiles binaires voyagent donc sous forme d'`ImmutableBytes`, qui partage le tampon au lieu de le copier : **de 250 à 279 ns et 360 octets pour le même message de 1 MiB.** Les nœuds de fichier et HTTP remettent déjà ainsi les charges utiles binaires, vous l'obtenez donc sans le demander.

## Un contexte qui sait compter

Les contextes de flux et global ont `get` et `set`, et aussi `CompareAndSwap`, `Increment` et `Update`. Deux branches qui font un get-modify-set sur un même compteur se font concurrence et perdent des mises à jour, et on n'y peut rien avec get et set seuls. Avec `Increment`, il n'y a rien à disputer.

Et il survit à un redémarrage. Les contextes de flux, global et de nœud vivent dans un fichier SQLite sur le volume, chargé la première fois qu'un périmètre est utilisé et écrit en différé, si bien qu'un compteur ou un verrou dans un flux est là où vous l'avez laissé quand le pod revient. Les opérations atomiques sont le même code qu'avant. Les changements sont regroupés en une écriture toutes les trente secondes et une valeur fixée à ce qu'elle était déjà n'écrit rien, car nous nous soucions plus de ce que cela fait à une carte SD que de faire preuve d'ingéniosité. Un arrêt propre écrit tout ; un `kill -9` perd jusqu'à ces trente secondes, et `store.context.flushInterval` est le réglage. Les détails, et ce que cela coûte à une carte, sont dans [docs/durable](/fr/flow/durable-state/).
