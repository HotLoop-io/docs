---
title: "Deux bacs à sable dans HotLoop Flow"
description: "Comment le nœud Function et le bac à sable WebAssembly sont cloisonnés, ce que chacun peut toucher, et comment un plugin tourne dans le second."
---

Le nœud Function s'exécute sur l'interpréteur JavaScript (voir [Posture de sécurité](/fr/flow/security/)). Un appel coûte de 11.6 à 13.7 µs. Ce n'est pas une frontière vis-à-vis de la mémoire : une fonction qui alloue en boucle fait grossir le tas Go jusqu'à la mort du pod, et tout ce que l'interpréteur JavaScript peut y faire, c'est un délai d'horloge murale.

Cela coûte de 184 à 196 µs par appel, quinze à seize fois un appel à l'interpréteur JavaScript. Cela vaut le coup exactement quand vous exécutez du code dont vous n'êtes pas totalement sûr, et pas autrement.

Un flux exécute un invité WASM via un plugin : un module signé avec un descripteur dont l'éditeur tire sa boîte de dialogue, qui n'obtient aucun accès à l'hôte tant qu'il ne le demande pas et que vous ne dites pas oui. La mémoire est plafonnée par nœud, un message a un délai, et un invité qui dépasse l'un ou l'autre est interrompu, arrive à un nœud Catch avec la raison et n'emporte rien d'autre. Tout est dans [Plugins sans npm](/fr/flow/plugins/), y compris comment faire confiance à la clé d'un éditeur et ce que disent les refus. Ce que cela signifie pour vous : ce pour quoi Node-RED a besoin de npm et d'une installation complète de Node.js, Flow l'exécute comme un fichier isolé que vous pouvez vérifier avant son chargement.

Un plugin peut être écrit en Rust, TinyGo, Zig ou AssemblyScript au lieu de JavaScript, si bien que le traitement du signal qu'un flux OT veut vraiment s'exécute compilé, avec un plafond de mémoire qu'on ne peut pas discuter.

L'ABI de l'invité tient en trois exports, dont deux crochets d'allocateur, et elle est aussi petite exprès. Chaque export est une surface d'attaque, et une chose de plus que chaque auteur d'invité doit réussir.

| Export | Signature | Requis |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | oui |
| `hotloop_flow_alloc` | `(size i32) -> i32` | oui |
| `hotloop_flow_free` | `(ptr i32, size i32)` | non |

Le résultat `i64` empaquette un décalage dans les 32 bits de poids fort et une longueur dans les 32 de poids faible, pointant vers une réponse JSON dans la mémoire propre à l'invité. Tout traverse en JSON, si bien qu'un invité dans n'importe quel langage peut le produire sans compilateur de schéma partagé.

Les limites sont petites exprès. Cela tourne sur du matériel de périphérie à côté des flux qui comptent vraiment, et un nœud qui a besoin de plus doit le dire :

| Limite | l'interpréteur JavaScript | WASM |
|---|---|---|
| Délai par appel | 5 s | 5 s |
| Plafond de mémoire | aucun applicable | 16 MiB par nœud sauf indication du plugin, 64 MiB au maximum sauf si vous relevez `plugins.maxMemoryMiB`, ferme |
| Sortie maximale | 16 MiB | 8 MiB |

Les deux environnements d'exécution sont du Go pur, sans cgo.
