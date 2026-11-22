---
title: "Gestion de parc"
description: "Suivez chaque Edge Relay par ses naissances et morts Sparkplug, et envoyez rebirth, redémarrage ou fichier d'appareils sans aller jusqu'au boîtier."
---

La gestion de parc, depuis 4.7.0, permet à la Gateway de suivre les edge relays enregistrés, de savoir s'ils sont vivants et, pour un opérateur autorisé, de demander à l'un d'eux un rebirth, un redémarrage ou l'adoption d'une configuration qui vient d'être envoyée. Désactivée par défaut (`HOTLOOP_FLEET_ENABLED`) : un déploiement sans edge relays n'a pas de broker vers lequel la pointer.

## Ce qu'il n'est pas

La gestion de parc possède sa propre connexion MQTT, séparée, et répond à une autre question : un edge relay *enregistré* est-il vivant, et non quelle valeur porte un de ses tags. L'accrocher au pilote qui scrute les tags aurait obligé soit à configurer un Appareil compatible rien que pour voir le parc, soit à fouiller la comptabilité privée par nœud de ce paquet, qui n'a jamais été conçue pour être partagée.

**Pas automatique.** Un edge relay qui apparaît sur le broker ne devient pas pour autant membre du parc. L'appartenance se déclare, par une ligne de `fleet_members` créée avec `POST /api/fleet`, la même distinction que cette application fait déjà entre un tag qu'un pilote découvre et un tag que quelqu'un configure. Un NBIRTH d'un groupe ou d'un nœud que personne n'a enregistré est consigné au niveau debug, puis ignoré.

## Comment tout s'articule

- **La présence**, d'après NBIRTH et NDEATH. Uniquement sortante du côté du relay : il appelle le broker, comme il le fait toujours pour publier ses lectures, donc cela fonctionne à travers un NAT sans aucune connexion entrante vers le relay.

Les commandes circulent dans l'autre sens par Sparkplug NCMD, en prolongeant ce qu'un relay gère déjà :

- Une impulsion bénigne et idempotente.
- **Redémarrage** (`Node Control/Reboot`, le nom que la spécification Sparkplug donne elle-même, pas un nom inventé par cette application) : le relay publie son propre NDEATH propre et quitte ; son superviseur (le `Restart=always` d'une unité Quadlet, ou le `restartPolicy: Always` par défaut d'un Deployment) le relance avec ce qui se trouve sur le disque à cet instant. Aucun nouveau chemin d'arrêt : c'est la même sortie propre que suit déjà le relay à la réception de son `SIGTERM`.

Comme les commandes passent par la même connexion MQTT que le relay ouvre déjà vers l'extérieur, en envoyer une n'exige pas non plus de connexion entrante vers le relay.

Un relay qui apparaît en ligne peut être commandé, sans exception. Chaque relay s'abonne à son topic NCMD, et attend que le broker le confirme, avant de publier une naissance, à chaque connexion, si bien que « En ligne » n'est jamais en avance sur « joignable ». Le gestionnaire s'impose la même règle de son côté : il ne se déclare pas démarré avant que ses abonnements NBIRTH et NDEATH soient confirmés, donc un relay qui naît à l'instant où la Gateway démarre n'est pas manqué. Si l'ACL du broker refuse l'abonnement de l'un ou l'autre côté, ce côté refuse de démarrer et le dit, au lieu de tourner à moitié sourd.

## Envoi de configuration

Envoyer ce qu'un relay scrute ne passe pas par NCMD, car une métrique Sparkplug n'est pas dimensionnée pour un fichier d'appareils entier : cela va vers un **topic MQTT ordinaire et retenu** par relay : `hotloop/edge-relay-config/<group>/<node>`. La remise retenue est ce qui permet de s'en passer d'une demande de « mets-moi à jour » : ce qui a été publié en dernier est remis immédiatement à tout client qui s'abonne, y compris un relay qui se reconnecte après une absence ou qui démarre pour la toute première fois.

Le relay valide de nouveau à la réception : cette application ne peut pas supposer que seule la Gateway publie sur ce topic, seulement qu'elle doit elle-même refuser de publier quelque chose de cassé.

**Un fichier d'appareils peut contenir des identifiants, et un envoi le publie.** Le bloc `config` d'un appareil contient ce avec quoi son pilote se connecte, par exemple le `username` et le `password` OPC UA (4.15.0), et le fichier est publié tel quel, retenu. Quiconque peut s'abonner à `hotloop/edge-relay-config/#` peut le lire, donc le broker doit avoir TLS et une ACL sur ce topic avant qu'on envoie un fichier contenant des identifiants. L'API de la Gateway masque les identifiants des appareils à tous les rôles depuis 4.15.1, mais un fichier envoyé n'est pas derrière l'API et cela ne le change pas. Voir la [référence Edge Relay](/fr/edge-relay/reference/#credentials-in-the-device-file-4150) et [Authentification et utilisateurs](/fr/iot/authentication/#where-credentials-are-still-in-the-clear).

**Un envoi s'applique en direct et ne redémarre jamais rien.** Jusqu'à 4.17, un envoi ne faisait que préparer le fichier, et pour qu'il compte il fallait une seconde action, un `POST /api/fleet/{id}/restart`, qui coupait la session du relay avec le broker et toutes les sessions d'appareils qu'il tenait, pour changer un seul tag. Désormais :

- **Un relay en marche** valide le fichier, l'enregistre et l'applique sur place : les nouveaux appareils se connectent, les supprimés se déconnectent, les modifiés se reconnectent, et chaque appareil inchangé garde sa session. La session Sparkplug et la file de transfert restent actives tout du long. Le nœud fait un rebirth pour son nouvel ensemble de métriques et met d'abord à nul celles qu'il a retirées, pour qu'un hôte ne continue pas d'afficher la dernière bonne valeur d'un appareil supprimé. La [référence Edge Relay](/fr/edge-relay/reference/#what-a-live-apply-keeps-and-what-it-changes) dit exactement ce qui part sur le fil et pourquoi.
- **Un fichier que le relay refuse** (il ne s'analyse pas, ne se valide pas, ne peut pas être enregistré) ne change rien sur le relay, et le `/status` du relay le dit sous `config.rejected`. `GET /api/fleet` l'affiche pour chaque membre qui a un `statusUrl`, à côté de l'empreinte du fichier qu'il exécute, de sorte que « je l'ai envoyé » et « il l'exécute » sont deux choses que l'on peut vérifier, pas une seule que l'on suppose. La Gateway valide aussi avant de publier, donc en pratique il s'agit d'un relay d'une version plus récente ou plus ancienne qui n'est pas d'accord sur les règles, ou de quelque chose d'autre que la Gateway qui publie sur le topic.
- **Un relay hors ligne** reçoit l'envoi retenu dès qu'il se connecte. Au démarrage, il l'attend quelques secondes avant de charger son fichier local, donc il démarre sur la liste envoyée au lieu de partir sur l'ancienne puis de basculer.

Un fichier envoyé atterrit sur le volume de données du relay, pas par-dessus son fichier d'appareils local, et l'emporte sur le local tant que l'envoi n'est pas retiré. La [référence Edge Relay](/fr/edge-relay/reference/#where-a-pushed-file-lives-and-which-file-wins) donne les règles de priorité et le bogue de 4.16.0 qui les a rendues nécessaires.

**Retirer un envoi** se fait avec `DELETE /api/fleet/{id}/config` (`fleet.config`, comme pour envoyer). Cela publie un message retenu vide sur le topic de configuration du membre, ce qui est la façon dont MQTT supprime une valeur retenue, si bien qu'aucun démarrage ultérieur n'applique l'envoi. Un relay connecté à ce moment abandonne son fichier envoyé et revient à son fichier local en direct, comme un envoi s'applique, sauf si son fichier local ne se charge pas, auquel cas il garde celui envoyé et le dit. Un relay qui était hors ligne n'entend jamais l'effacement (un message vide n'est pas retenu), donc renvoyez-le une fois le relay revenu.

## Ce que chaque relay exécute, et ses mises à jour

Chaque relay met sa version et l'empreinte de son image dans chaque naissance, tout comme un Edge ou une Gateway avec la publication edge activée, donc un boîtier enregistré ici comme membre montre la même chose (des métriques de type chaîne nommées `Node Info/Version` et `Node Info/ImageDigest`, sans alias, de sorte qu'un hôte Sparkplug qui ne les connaît pas les ignore). `GET /api/fleet` les affiche en `release` sur chaque membre : `version`, `imageDigest` et `since`, quand la Gateway a entendu cette version pour la première fois. Un relay plus ancien n'en rapporte aucune, et la Gateway n'en dit rien plutôt que d'inventer une « version inconnue ».

Quand la version d'un membre change, la Gateway l'écrit dans le journal système comme un événement `config` sur ce membre, avec l'ancienne et la nouvelle version et empreinte dans son détail (`{"kind":"fleet.release",...}`). La première version qu'elle entend est aussi consignée, comme référence à laquelle la suivante sera comparée. Cela survit à un redémarrage de la Gateway, car le dernier enregistrement est relu depuis le journal : un redémarrage n'invente jamais une mise à jour. C'est la piste d'audit de chaque mise à jour que prend un relay, par quelque voie que ce soit (le minuteur de Podman, une approbation, `helm upgrade`, quelqu'un sur le boîtier), parce que la Gateway ne provoque pas de mise à jour et ne peut que la signaler. Un tag mobile est la façon dont `:stable` se met à jour, donc une empreinte différente sous la même version est aussi consignée, comme « une image différente de la même version ».

`POST /api/fleet/{id}/update` (`fleet.update`, administrateurs uniquement) approuve la mise à jour qu'un relay retient. Cela n'a d'effet que sur un relay réglé pour retenir les mises à jour ; tout autre relay consigne qu'il l'a ignorée. La requête ne nomme aucune image. Ce que cela fait et ne fait pas pour chaque type d'installation se trouve dans la [référence Edge Relay](/fr/edge-relay/reference/#updating-a-relay).

## Autorisation des commandes

Deux couches, délibérément pas une seule :

- **Au niveau de l'API**, un opérateur a besoin de `fleet.rebirth` pour demander un rebirth ; redémarrer, approuver une mise à jour ou envoyer une configuration exigent respectivement `fleet.restart`, `fleet.update` et `fleet.config`, accordés uniquement à l'administrateur. Un redémarrage perturbe davantage un cycle de scrutation en cours qu'une impulsion de rebirth, et envoyer ce qu'un relay scrute est traité de la même façon, le même rétrécissement que `alarms.ack` et `automations.trigger` modélisent déjà pour d'autres actions « fais-le maintenant ».
- **Au niveau du broker**, cette application ne peut rien imposer : la publication NCMD et le topic de configuration doivent tous deux être restreints, par les ACL propres au broker, aux identifiants MQTT de la Gateway elle-même. Sans cela, quiconque atteint le broker et connaît le groupe et le nœud d'un relay peut publier la même commande ou la même configuration que cette fonction. Configurez-le au déploiement ; ce n'est pas facultatif parce que cela se situe en dehors du code de cette application.

## API

| Route | Autorisation | <span class="sr-only">Détails</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Chaque membre enregistré, avec sa présence en direct et, là où c'est configuré, un `/status` scruté |
| `POST /api/fleet` | `fleet.write` | Crée ou met à jour un membre (un corps avec un `id` existant le met à jour) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Supprime un membre enregistré |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Publie `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Publie `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Approuve la mise à jour d'image qu'un relay retient (sans effet sur un relay qui n'en retient pas) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Envoie un nouveau fichier d'appareils (corps JSON brut, validé avant publication) ; un relay en marche l'applique en direct |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Efface l'envoi, pour que le relay revienne à son fichier d'appareils local, en direct s'il est connecté |

## Configuration

| Variable | Valeur par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | La fonction est désactivée tant que ceci n'est pas défini |
| `HOTLOOP_FLEET_BROKER` | n/a | Obligatoire si activée. Un hôte seul, `host:port` ou une URL complète |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Identifiants du broker |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | À activer par déploiement ; ne le réglez jamais par défaut |

## Ce qui a été vérifié et ce qui ne l'a pas été

HotLoop a été exécuté face à de vrais équipements et de vrais serveurs, et sur du matériel réel le 2026-11-17.
