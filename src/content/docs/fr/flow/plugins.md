---
title: "Plugins sans npm"
description: "Un plugin est un module WebAssembly signé avec plafond mémoire, délai et descripteur, et il n'obtient aucun accès à l'hôte sauf si vous le lui accordez."
---

Un nœud communautaire de Node-RED est un paquet npm. Il exige Node.js sur le boîtier et, une fois installé, il s'exécute dans le processus même du runtime avec tout ce que ce processus peut atteindre. Flow n'exécute pas ces nœuds et ne le fera jamais ; voici ce qu'il fait à la place : un plugin est un module WebAssembly dans un bac à sable avec un plafond mémoire et un délai, il vient avec un descripteur dont l'éditeur tire sa boîte de dialogue, il est signé, et il n'obtient aucun accès à l'hôte sauf s'il le demande et que vous l'accordez.

Ce que cela change pour vous : vous pouvez lire tout le contrat d'un plugin dans un seul fichier JSON avant qu'il s'exécute, le boîtier refuse tout ce qui n'est pas signé par une clé que vous avez choisie, et le pire qu'un plugin défectueux puisse faire est de faire échouer ses propres messages.

## Ce qu'est un plugin

Un répertoire sous `<data.dir>/plugins/` (ou `plugins.dir`), nommé d'après le plugin, avec trois fichiers :

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Chaque plugin devient un type de nœud, `wasm-<name>`, dans la section Function de la palette. Les plugins sont lus au démarrage de Flow, donc en ajouter ou en modifier un demande un redémarrage. Rien n'est lu au moment du message.

### Le module

L'ABI est celle du [README](/fr/flow/sandboxes/) : `hotloop_flow_process` et `hotloop_flow_alloc` sont obligatoires, `hotloop_flow_free` est facultative, et tout transite en JSON. Un invité reçoit `{"msg": {...}, "config": {...}}` et renvoie `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`. Une propriété de message qui n'est pas du JSON simple, comme le gestionnaire de réponse qu'attache un nœud HTTP In ou un tampon binaire, n'est pas remise à l'invité. Le nœud la garde et la remet sur chaque message que l'invité envoie, sauf si l'invité a fixé lui-même cette propriété, de sorte qu'un plugin peut se placer entre un HTTP In et un HTTP Response. `config` est ce que contient la boîte de dialogue du nœud. Une `error` fait échouer le message vers un nœud Catch, et ce qui a été envoyé avant reste envoyé.

Le module peut importer WASI et, s'il a déclaré une capacité de contexte, les deux fonctions de contexte ci-dessous. Tout autre import est refusé au chargement du plugin, et le refus nomme l'import.

### Le descripteur

`plugin.json` est lu strictement. Un champ que Flow ne connaît pas est un refus, de sorte qu'un `"capabilites"` mal orthographié est détecté au lieu de devenir un plugin qui n'a discrètement rien demandé.

| Champ | <span class="sr-only">Détails</span> |
|---|---|
| `format` | `1`. Obligatoire. |
| `name` | Lettres minuscules, chiffres et tirets, 40 au plus, en commençant par une lettre. Doit correspondre au nom du répertoire, car c'est ce qu'utilisent `plugins.grants` et le fichier de flux. |
| `version` | Obligatoire. Affichée dans l'aide du nœud et dans `GET /plugins`. |
| `label`, `description`, `help` | Le libellé de la palette, une ligne, et du Markdown pour le panneau d'informations. |
| `inputs`, `outputs` | Les entrées doivent être 1. Les sorties de 0 à 16, 1 par défaut. |
| `props` | La boîte de dialogue. Les mêmes déclarations de propriétés que celles des nœuds intégrés, avec les types `string`, `text`, `number`, `bool`, `select`, `json` et `list`. Les identifiants, les références à des nœuds de configuration et les types d'éditeur de code sont refusés : un plugin n'a rien à y faire. |
| `capabilities` | L'accès à l'hôte qu'il demande. |
| `limits` | `memoryMiB` et `timeoutMs` qu'il souhaite par défaut. |

L'éditeur dessine la boîte de dialogue à partir de `props` sans aucun code du plugin dans le navigateur. Chaque nœud de plugin reçoit aussi un champ de nom, de limite mémoire et de délai. Ces trois noms sont réservés.

## Limites, et à quoi ressemble un piège

Chaque nœud de plugin a son propre plafond mémoire et son propre délai. Le descripteur du plugin fixe les valeurs par défaut (16 MiB et une seconde quand il ne dit rien), un nœud peut les modifier dans sa boîte de dialogue, et `plugins.maxMemoryMiB` (64) et `plugins.maxTimeout` (5s) sont ce que le boîtier autorisera au maximum. Un nœud qui demande plus que ce que le boîtier permet fait échouer le déploiement et dit quel réglage augmenter.

Un invité qui dépasse son plafond tombe dans un piège. Un invité encore en cours à l'expiration de son délai est arrêté. Dans les deux cas, le message va au nœud Catch le plus proche, l'instance est jetée pour que le message suivant reparte propre, et aucun autre nœud n'est touché. Ce que voit le nœud Catch dans `msg.error.message` :

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

Le plafond est réservé d'avance : un nœud avec un plafond de 64 MiB comptabilise 64 MiB du heap Go tant que son instance existe, que l'invité y touche ou non, parce que faire grossir un tampon en le copiant laisserait l'hôte détenir brièvement plusieurs fois le plafond. Le test qui le prouve mesure ce qu'un appel a alloué au total (256 MiB pour un plafond de 256 MiB) et que le heap revient à son point de départ après le piège. Réglez donc les plafonds sur ce dont un plugin a besoin, pas sur le plus grand nombre que vous pouvez taper.

## Capacités

Pas de capacité, pas d'accès. Chacune n'est branchée que lorsque le descripteur la demande et que `plugins.grants` l'accorde à ce plugin par son nom.

| Capacité | Ce qu'elle donne | Sans elle |
|---|---|---|
| `clock` | Les vraies horloges murale et monotone. | L'invité voit une horloge de substitution qui commence au 2022-01-01 et n'a rien à voir avec celle de l'usine. |
| `random` | Les octets aléatoires du système d'exploitation. | La même séquence fixe à chaque fois. |
| `context.flow` | Lire et écrire le contexte de flux du flux propre au nœud. | Les fonctions de contexte n'existent pas pour lui. |
| `context.global` | Lire et écrire le contexte global. | Pareil. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Demander quelque chose qui n'est pas accordé n'échoue pas au moment du message. Cela fait échouer le déploiement : le flux est refusé avec un 422 avant que quoi que ce soit soit écrit, les flux en marche ne s'en aperçoivent pas, et le message nomme le nœud et la ligne à ajouter :

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

Un retour en arrière est un déploiement, donc un retour vers des flux qui utilisent un plugin dont l'autorisation a été retirée depuis est refusé de la même façon. Un plugin installé mais non autorisé apparaît quand même dans la palette, avec ses capacités dans son aide.

### Les fonctions de contexte

Un invité qui déclare une capacité de contexte peut importer celles-ci depuis le module `hotloop_flow`. Les valeurs transitent en JSON.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

La portée vaut `0` pour le flux et `1` pour le global. `context_get` renvoie la longueur du JSON et ne l'écrit que s'il tient dans `outCap`, de sorte qu'un invité qui reçoit plus que ce qu'il a offert réessaie avec un tampon plus grand. Une clé absente donne `-1`, et `-2` signifie refusé : la portée n'était pas accordée, la clé ou le JSON était mauvais, ou le magasin a dit non. Un invité ne peut pas lire une portée qui ne lui a pas été accordée en essayant.

## Signature, et faire confiance à un éditeur

Un plugin est signé avec une clé ed25519. La signature couvre les deux fichiers, pas seulement le module, car le descripteur est l'endroit où un plugin demande l'accès. Si l'on ne signe que le module, quiconque a un accès en écriture au répertoire pourrait ajouter une capacité à un plugin signé. Le message signé est :

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

Rien n'est consulté au chargement d'un plugin : ni réseau, ni journal de transparence, ni chaîne de certificats. La vérification, c'est la signature, la clé qu'elle nomme et votre liste de clés. C'est un choix délibéré pour un boîtier sur un réseau d'usine qui peut n'avoir aucune route vers l'extérieur. Cela veut aussi dire qu'il n'y a pas de service de révocation : révoquer une clé, c'est la retirer de `plugins.trustedKeys` et redémarrer.

### En tant qu'éditeur

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` écrit une clé privée PKCS #8 et une clé publique PKIX au format PEM, les mêmes fichiers que produisent `openssl genpkey -algorithm ed25519` et `openssl pkey -pubout`, et refuse d'écraser l'un ou l'autre. Il affiche l'id de la clé et la forme sur une ligne de la clé publique. Gardez la clé privée hors de git. Aucune clé n'est versionnée.

### En tant qu'opérateur

Sur le chart Helm, ce sont `plugins.trustedKeys`, `plugins.grants` et `plugins.volume`, dans [Déployer Flow](/fr/flow/deploying/).

Vous faites confiance à un éditeur en mettant sa clé publique dans `plugins.trustedKeys`, ou dans `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, séparées par des virgules. Chaque entrée est la ligne `ed25519:<base64>`, une clé publique PEM ou le chemin d'un fichier qui en contient une, ce qui permet d'y faire entrer un Secret ou un ConfigMap monté :

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Sans clé de confiance, tout plugin est refusé. Une clé qu'on ne peut pas analyser est une erreur de démarrage. La confiance est par clé et non par plugin : faire confiance à un éditeur, c'est faire confiance à tout ce qu'il signe. Ce qu'un plugin peut ensuite utiliser est une décision distincte, prise dans `plugins.grants` par nom.

## Quand il refuse

Un plugin qui ne se charge pas est consigné au démarrage, listé avec sa raison dans `GET /plugins`, absent de la palette, et nommé dans le refus quand on déploie un flux qui l'utilise. Un mauvais plugin n'empêche jamais le reste de Flow de démarrer. `hotloop-flow plugin verify` exécute les mêmes vérifications, de sorte qu'un éditeur voit ce que verrait un opérateur.

| Ce qui ne va pas | Ce qu'il dit |
|---|---|
| Pas de `plugin.sig` | `unsigned: plugin.sig is missing` |
| Module ou descripteur modifié après la signature | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Signé par une clé à laquelle vous ne faites pas confiance | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Aucune clé configurée | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| Fichier de signature endommagé | `signature file is malformed: ...` |
| Descripteur avec un champ inconnu, un mauvais type ou une mauvaise capacité | `plugin.json is not valid: ...` nommant le champ |
| Le module importe quelque chose que l'hôte ne fournit pas | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| Le module utilise les fonctions de contexte sans déclarer de capacité | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| Le nom du répertoire et `name` diffèrent | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

La signature est vérifiée avant l'analyse du descripteur et avant la compilation du module, de sorte que du code non signé n'est jamais compilé.

## Les deux exemples

* `moving-average` est en Rust. Il fait la moyenne d'une mesure sur les N derniers messages et garde sa fenêtre dans sa propre mémoire. Il ne demande rien. `cargo build --locked --release --target wasm32-wasip1`, puis `plugin.wasm` est le `moving_average.wasm` produit.
* `stamp` est en TinyGo. Il ajoute l'heure à chaque message, donc il demande `clock`. Il se construit avec le propre conteneur de TinyGo, à l'aide de Podman : `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow est une maison Go. L'hôte, la signature, la CLI et chaque test sont en Go, et l'exemple TinyGo est du Go. L'exemple Rust est là parce qu'un format de plugin qui ne marcherait que pour le langage dans lequel l'hôte est écrit ne serait pas un format de plugin, et parce que Rust est ce dans quoi une bibliothèque de traitement du signal a le plus de chances d'être déjà écrite. C'est la raison écrite du seul exemple qui n'est pas en Go. Les crates avec lesquels il se construit sont `serde` et `serde_json`, tous deux sous licence permissive, compilés dans le module d'exemple et non dans Flow.

## Ce qui n'est pas prouvé

* Les plugins ont été exécutés sur du matériel réel (2026-11-17).
* Sur Kubernetes, les fichiers du plugin arrivent par `plugins.volume`, n'importe quelle source de volume. Un ConfigMap ne contient un plugin que jusqu'à sa limite de 1 MiB, donc un plugin de la taille de l'exemple TinyGo veut un claim.
* Il n'y a pas de capacité réseau. Un plugin ne peut pas faire de requête, et c'est voulu tant que personne n'a de raison assortie d'une liste d'hôtes autorisés.
* Les tests Flow exécutent les plugins pour de vrai, dans le même processus enfant que tous les autres nœuds. Les capacités d'un plugin sont celles que le déploiement lui donnerait.
* `hotloop-flow test` lancé à la main depuis un shell ne charge pas les plugins. La barrière de déploiement et les exécutions de tests de l'éditeur, si.
