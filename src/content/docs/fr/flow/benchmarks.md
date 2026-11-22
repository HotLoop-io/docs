---
title: "Benchmarks de performance"
description: "Démarrage, mémoire, débit et latence mesurés de Flow sur un poste de bureau et un Raspberry Pi 5, ce que ces chiffres ne sont pas et comment refaire le test."
---

Des chiffres absolus uniquement. Un tableau comparatif bouge chaque fois que la machine change, et il finit par décrire l'autre produit plus que celui-ci.

Flow répond à environ 15 000 requêtes par seconde sur un poste de bureau et à environ 13 000 par seconde sur un Raspberry Pi 5, avec moins de 30 MiB de mémoire sur le poste de bureau et 42 MiB sur le Pi. C'est tout l'intérêt d'un moteur de flux assez petit pour le boîtier qui se trouve dans l'atelier.

## Le flux

Cinq nœuds : un point de terminaison HTTP, trois modifications de propriétés, une réponse. Rien n'y est rapide exprès. C'est la forme d'un petit flux réel, ce dont doit traiter un benchmark de moteur de flux. Le générateur de charge fonctionne en boucle fermée : chaque client envoie la requête suivante quand la précédente est revenue, il mesure donc ce que l'autre bout peut absorber et ne peut pas produire la latence trompeuse qu'un générateur en boucle ouverte rapporte quand la cible prend du retard.

## Faites-le vous-même

`hotloop-flow bench` est livré dans le binaire. `-launch` démarre le binaire, chronomètre le temps avant que le flux réponde (démarrage à froid), lit la mémoire résidente du processus deux secondes plus tard (au repos), puis l'échantillonne pendant la charge et conserve le pic. `-target` sans `-launch` pilote une instance déjà en cours d'exécution, un conteneur ou un pod, en HTTP, pour le débit et la latence.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Résultats

Mesuré sur un poste de bureau x86 (24 CPU), avec le binaire statique natif, trois exécutions de chaque.

| <span class="sr-only">Détails</span> | Exécution 1 | Exécution 2 | Exécution 3 |
|---|---|---|---|
| Démarrage à froid | 0.05 s | 0.05 s | 0.05 s |
| RSS, au repos | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, pic sous charge | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| Débit HTTP | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| Latence HTTP p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Moteur, par message | 2.61 µs | 3.11 µs | 2.20 µs |
| Moteur, mémoire allouée par message | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Résultats sur un Raspberry Pi 5

Mesuré sur un Raspberry Pi 5 de 8 Go, avec son horloge plafonnée à 2.0 GHz, comme un pod sur k3s, sans rien d'autre sur le nœud. Le même flux, trois exécutions, chacune dans un pod neuf.

| <span class="sr-only">Détails</span> | Exécution 1 | Exécution 2 | Exécution 3 |
|---|---|---|---|
| Démarrage à froid | 0.46 s | 0.15 s | 0.10 s |
| RSS, pic sous charge | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| Débit HTTP | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| Latence HTTP p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Moteur, par message | 8.15 µs | 7.74 µs | 7.89 µs |

Maintenue pendant 600 secondes, la même commande sur la même carte se stabilise à 11.4k req/s avec un p50 de 0.58 ms et un p99 de 3.00 ms. La carte tourne avec un simple dissipateur, sans refroidissement actif, et bride sous une telle charge : c'est donc le chiffre honnête pour un boîtier qui reste chargé.

### Ce que ces chiffres ne sont pas

**Le débit HTTP inclut la pile HTTP.** C'est voulu : c'est ce que vit un client de votre flux. Ce n'est pas une mesure de l'ordonnanceur. Les lignes du moteur, elles, en sont une, sans aucune E/S sur le chemin.

**Une forme de flux, une taille de charge utile, une concurrence.** Un flux qui fait de vraies E/S, une publication MQTT ou une écriture en base, est dominé par ces E/S. Ces chiffres sont la surcharge propre de l'exécution, pas une promesse sur chaque charge de travail.

**La queue bouge plus que la médiane.** En saturation tout fait la queue et c'est la file d'attente qui commande le p99. La médiane est l'endroit où se voit le coût du traitement d'une requête.

**C'est le flux de test, pas les fils durables.** Rien ici ne mesure le stockage derrière un fil durable ni les écritures sur carte SD.

## Mémoire

La RSS est la mémoire résidente du processus lui-même, lue dans `/proc`. Ce n'est pas ce que rapporte `podman stats`, qui montre ce que le noyau impute au conteneur et peut afficher bien moins que ce que le processus détient réellement.