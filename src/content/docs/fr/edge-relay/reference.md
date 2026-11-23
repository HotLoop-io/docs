---
title: "Référence d'Edge Relay"
description: "Le nœud Sparkplug B sans interface qui interroge et transmet : ce qu'il fait, chaque réglage, la file sur disque, la configuration de flotte et le déploiement."
---

L'Edge Relay, depuis la 4.6.0, est un second binaire qui tourne seul : un nœud edge Sparkplug B qui interroge et transmet, sans base de données, sans interface web, sans authentification et sans chemin d'écriture. Il est fait pour tourner sur un Pi ou un petit PC industriel en périphérie et transmet tout ce qu'il lit à un Gateway complet, qui tourne ailleurs avec une vraie base de données, par le même éditeur Sparkplug B que la 4.5.0 a ajouté.

La note de la 4.5.0 le disait elle-même : la publication edge existait comme une fonction qu'on pouvait activer dans le processus du Gateway complet, « pas encore l'édition Edge Relay autonome et plus légère ». Voici cette édition.

## Ce qu'il n'est pas

**Pas un Gateway plus petit avec moins d'options.** C'est un autre binaire, avec bien moins de dépendances. Il n'embarque ni base de données, ni interface web, ni authentification, ni serveur ou client MCP, ni moteur d'automatisation, ni registre d'entités.

**Incapable de servir une interface, d'accepter une écriture ou de répondre à un appel d'outil MCP.** Les trois exigent ce que ce binaire n'a volontairement pas : une identité authentifiée à laquelle attribuer l'action. Un edge relay ne décide rien et ne confirme rien à une personne ; il lit et il transmet.

**Non configuré par une base de données, et sans API de configuration propre.** Les appareils et les tags viennent d'un fichier JSON local lu au démarrage, ou d'un fichier que le Gateway pousse par le broker et qui s'applique en direct (voir [Envoi de configuration](#envoi-de-configuration-480)). Rien n'écoute sur le relay pour une nouvelle configuration : la seule entrée est la connexion au broker qu'il ouvre déjà vers l'extérieur.

## Comment tout s'articule

En interne, il réutilise le vrai moteur d'interrogation du Gateway, pas une réécriture : le même worker, la même reconnexion avec temporisation et la même boucle d'interrogation qui tournent en production dans le Gateway tournent ici sans changement. Ce qui diffère, c'est *où vont la configuration et l'historique*.

Tout ce qui suit une interrogation, le pilote, le bus de tags, l'éditeur Sparkplug et la file de transmission sur disque, est exactement le code que le Gateway utilise quand `HOTLOOP_EDGE_PUBLISH_ENABLED` est défini. La page Edge publish explique ce que fait cet éditeur : births, numéros de séquence, mise en tampon pendant une panne, relecture à la reconnexion. Rien de cela n'a changé ici ; ce binaire est une autre façon d'arriver au même appel `Offer()`.

## Le fichier d'appareils

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Un tag accepte tout ce qu'acceptent ceux du Gateway, `noData` compris : une liste de valeurs brutes qui signifient « pas de mesure » (le 0x8005 d'un enregistreur), chacune avec sa raison, pour qu'une voie morte s'affiche en erreur sur le relay et dans le flux Sparkplug au lieu d'un nombre. Voir [Valeurs sans donnée](/fr/iot/protocols/#no-data-values).

Les sept pilotes de protocole du Gateway sont compilés : OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect et HTTP. Rien dans le format du fichier d'appareils n'est propre à l'edge relay.

### Discovery (4.18.10)

Un relay peut écouter un broker MQTT pour trouver les appareils qui s'annoncent, comme le fait le Gateway (voir [Découverte MQTT](/fr/iot/mqtt-discovery/)), et lire et transmettre ce qu'il entend. Nommez les brokers dans le fichier d'appareils :

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` compte de 1 à 63 lettres minuscules, chiffres et `-`, et n'est pas `embedded`. `broker`, `username`, `password`, `useTls` et `insecureSkipVerify` sont ce que prennent les réglages MQTT du Gateway, vérifiés par le même code. `prefix` vaut `homeassistant` par défaut, et `tasmota` et `shelly` sont activés. Un fichier qui ne nomme aucun broker ne change rien au fonctionnement d'un relay.

Ce qu'il entend devient des appareils et des tags, créés par le même code que celui du Gateway (le format `homeassistant/`, celui de Tasmota, les statuts de Shelly), puis interrogés et transmis par Sparkplug comme les autres. L'id d'un appareil est formé de l'id du broker et de ce que l'appareil dit être, toujours identique (`disc-<identity>-<hash>`), si bien qu'un relay qui redémarre nomme ses métriques de la même façon. Un appareil apparaît quelques secondes après son annonce, un appareil retiré disparaît du birth du nœud lors d'un rebirth, et ni l'un ni l'autre ne coûte la session Sparkplug ni la file de transmission. Un fichier poussé qui ajoute ou retire un broker s'applique aussi en direct.

**Rien de ce qu'il découvre ne peut être armé.** Pas parce qu'un contrôle le dit. Chaque tag créé par la découverte est en lecture seule, comme sur le Gateway ; chaque appareil créé n'est pas accepté ; il n'y a personne sur un relay pour en accepter un ; et un relay n'a aucun chemin d'écriture, donc une commande vers un point découvert, ou vers n'importe quel point, est refusée avant d'approcher un appareil. Le test demande à un relay dont les écritures sont autorisées de commuter une pompe découverte, et vérifie que le topic de commande de la pompe est resté muet.

Un appareil que vous pouvez commander arrive sur un relay dans l'autre sens : vous l'acceptez sur un Gateway, armez les points voulus et poussez le fichier. Quand un fichier contient un appareil que le relay entend aussi (même id de broker, ou même adresse, et même identité), le fichier l'emporte et la copie découverte n'est pas créée, donc un appareil n'est jamais transmis deux fois.

`listenOnly` est activé sauf si vous le désactivez, et alors le relay ne publie rien vers ce broker : ni le message de birth qui fait se réannoncer un éditeur, ni le `status_update` d'un Shelly, ni la requête de puissance d'un Tasmota. Un appareil qui ne parle qu'en cas de changement reste inconnu tant qu'il ne l'a pas fait. Désactivez-le et ce sont les seules choses qu'il envoie, vers les topics que nomme DISCOVERY.md.

Un relay ne garde rien de ce qu'il a entendu. Les configurations `homeassistant/` et Tasmota sont retenues sur leur broker et reviennent au démarrage ; un Shelly dit ses statuts dès que quelque chose change, donc un appareil silencieux depuis le démarrage du relay n'est pas là tant qu'il ne parle pas. Cela, et l'absence de base de données pour mémoriser un appareil accepté, fait la différence avec le Gateway.

`/status` indique, sous `discovery`, pour chaque broker : s'il écoute et s'il est connecté, combien de messages il a reçus, abandonnés et refusés, combien de problèmes il porte, et le nombre d'appareils et de tags créés par la découverte. Il ne dit pas où se trouve un broker ni sur quel topic un problème est survenu.

### Identifiants dans le fichier d'appareils (4.15.0)

Le pilote OPC UA du relay est celui du Gateway, donc un appareil peut porter un `username` et un `password` OPC UA (et les options de sécurité de [Protocoles et pilotes](/fr/iot/protocols/#opc-ua-security-and-credentials)) dans son bloc `config`, et un appareil de tout autre protocole aussi (mots de passe MQTT et HTTP, en-têtes HTTP, identifiants dans une adresse). Ils sont en clair dans le fichier d'appareils, et le relay n'a pas d'API derrière laquelle les cacher (la rédaction d'API ajoutée au Gateway en 4.15.1 ne s'y applique pas ; voir [Authentification et utilisateurs](/fr/iot/authentication/#où-les-identifiants-restent-en-clair)), donc l'emplacement du fichier compte :

- **Dans le chart Helm, utilisez `devicesSecret`.** Les appareils définis dans les valeurs `devices` et `tags` du chart sont rendus dans un ConfigMap, que peut lire quiconque a le droit de lire les ConfigMaps du namespace, et ils restent dans l'enregistrement de la release Helm. Pour des appareils avec identifiants, mettez le fichier d'appareils entier dans un Secret sous la clé `devices.json` et nommez-le dans `devicesSecret` ; le Secret est monté à la place du ConfigMap, qui n'est alors pas créé.
- **Un fichier d'appareils poussé les porte aussi.** Un fichier poussé avec `POST /api/fleet/{id}/config` est publié, retenu, sur un topic MQTT, donc le broker doit porter TLS et restreindre qui peut lire `hotloop/edge-relay-config/#`, sinon quiconque peut s'y abonner lit tous les identifiants qu'il contient. Le relay écrit un fichier poussé avec le mode `0600` sur son volume de données (`/data/pushed-devices.json` dans le chart et l'unité Quadlet), donc il est aussi sur le PVC, pas dans un Secret.
- **Un appareil OPC UA sécurisé conserve un certificat et un magasin de confiance.** Ils vivent sous `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), sur le même volume de persistance que la file de transmission. Avec la persistance du chart désactivée, c'est un emptyDir, donc chaque nouveau pod crée un nouveau certificat et chaque serveur sécurisé doit lui refaire confiance (voir « Persistence off » plus bas) ; un appareil anonyme sur un canal non sécurisé s'en moque. Approuver le certificat d'un serveur est le même geste que sur le Gateway, de `rejected/` vers `trusted/`, fait sur le volume du relay.

## Commandes à distance (4.7.0)

Deux commandes Sparkplug NCMD, toutes deux par la connexion que ce relay ouvre déjà vers l'extérieur, sans connexion entrante :

- **Restart** (`Node Control/Reboot`), depuis la 4.7.0 : le relay publie son propre NDEATH propre et quitte, en comptant sur son superviseur (le `Restart=always` d'une unité Quadlet, ou le `restartPolicy: Always` par défaut d'un Deployment) pour le relancer.

- **Update** (`Node Control/Update`) : un opérateur qui approuve la mise à jour d'image qu'un relay retient. Cela n'agit que sur un relay réglé pour retenir les mises à jour ; voir [Mettre à jour un relay](#mettre-à-jour-un-relay).

Rien côté relay ne décide qui peut les envoyer ; voir la page de gestion de flotte pour le gestionnaire de flotte du côté Gateway qui les envoie, et l'exigence d'ACL du broker, qui est la vraie frontière d'autorisation.

## Mettre à jour un relay

Un relay n'est pas mis à jour par le Gateway. Il ne le peut pas : le Gateway n'a aucun accès à la machine, et le relay ne peut pas remplacer son propre conteneur, donc « mise à jour à distance » signifie des choses différentes selon les deux façons de l'installer, et cette page dit laquelle, car une promesse que la plateforme ne peut pas tenir est pire que pas de promesse.

**La règle est celle que suit chaque boîtier HotLoop : suivre `:stable`, ne jamais figer.** Un relay figé sur `4.17.0` a exactement l'âge du jour où quelqu'un l'a installé, et personne ne pense à retourner dans l'atelier pour le monter. L'image qu'un relay suit est donc `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, et chaque release déplace ce tag. Ce qui change, c'est qui redémarre le relay dessus.

### Quadlet (un Pi ou un petit PC industriel) : il se met à jour seul

L'unité de [`deploy/quadlet`](/fr/install/quadlet/) suit `:stable` et porte le label que cherche la mise à jour automatique de Podman. Activez le minuteur une fois par machine :

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Quand le minuteur se déclenche, Podman tire `:stable` et, si le digest a changé, redémarre l'unité sur la nouvelle image. Trois choses permettent de la laisser seule, et les trois ont été prouvées en les exécutant, pas en lisant :

- **Un relay qui ne peut pas revenir est remis en place.** L'unité a un healthcheck (`/edge-relay --healthcheck`, car l'image n'a ni shell ni curl pour en lancer un) et ne dit à systemd qu'elle est up qu'une fois qu'il passe. Si la nouvelle image ne le passe jamais, Podman remet l'image précédente sous `:stable` et démarre celle-ci. Une release qui ne démarre pas coûte quelques minutes sur un boîtier, pas un relay qui reste à l'arrêt. Sous Podman 4.9 (Ubuntu 24.04), `Notify=healthy` seul ne le fait pas : il est lu comme un simple `true`, le relay est déclaré up dès que son conteneur démarre, et Podman signale la mise à jour comme réussie alors que le relay est mort. L'unité définit donc explicitement `--sdnotify=healthy`.
- **Le Gateway voit chaque mise à jour.** Un relay met sa version et le digest de son image dans chaque birth. La liste de flotte du Gateway montre les deux par relay et écrit une ligne dans le journal système quand l'un change : ce qu'il était, ce qu'il est maintenant et les deux digests. C'est la piste d'audit, et elle couvre une mise à jour de toute cause, y compris celle d'un opérateur sur le boîtier.
- **Une mise à jour laisse les données tranquilles.** La file de transmission et un fichier d'appareils poussé vivent sur le volume de données, qu'une nouvelle image ne touche pas. Ce qui se perd, c'est l'interrogation pendant le redémarrage du relay, quelques secondes au plus.

Le digest qu'un relay rapporte est ce qu'affiche `podman image inspect --format '{{.Digest}}'` sur ce boîtier, c'est-à-dire ce que suit la mise à jour automatique. Podman peut connaître une image par plus d'un digest (il les liste sous `RepoDigests`) quand un registre stocke un format de manifeste différent de celui qu'il utilise ; comparez-le donc de la même façon sur chaque relay, pas à l'en-tête d'un registre.

### Quadlet, retenir les mises à jour jusqu'à l'approbation d'un opérateur (optionnel)

Certains sites préfèrent choisir le moment : un relay sur une ligne qui ne peut pas cligner pendant une équipe. C'est `edge-relay-hold.conf`, un drop-in systemd, et ce n'est jamais le défaut. Avec lui, le relay rapporte `"updateMode": "approve"`, le minuteur est coupé et rien n'est mis à jour tant qu'un admin n'envoie pas `POST /api/fleet/{id}/update` depuis le Gateway. Le relay quitte alors avec le statut 75, systemd le relance sur l'image qu'il a, et un travail séparé attend qu'il soit sain et lance `podman auto-update` : la nouvelle image s'il y en a une, avec le même rollback, et un relay qui a cligné pour rien sinon. Prouvé avec une vraie mise à jour retenue 30 secondes pendant que le relay tournait sans être touché, puis prise à l'approbation.

Sachez ce que cela coûte. Le minuteur doit être coupé pour toute la machine, car la mise à jour automatique de Podman agit sur chaque conteneur labellisé et on ne peut pas lui en faire sauter un ; un boîtier qui doit l'utiliser pour autre chose ne peut pas retenir ce relay. Et le Gateway ne peut pas vous dire qu'une mise à jour attend, seulement ce que chaque relay exécute maintenant : comparez donc la liste de flotte à ce qu'est `:stable` avant d'approuver. Une approbation ne porte pas d'image : on ne peut dire au relay que de se mettre à jour vers ce que suit sa propre unité.

### Helm : vous lancez `helm upgrade`

Un pod ne peut pas se remplacer lui-même, et un Deployment appartient à Helm, donc il n'y a pas de mise à jour à distance pour le chart. Le `image.tag` du chart vaut par défaut son `appVersion`, qui est la release, donc :

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

fait passer le pod sur la nouvelle release. La stratégie du chart arrête l'ancien pod avant de démarrer le nouveau (`maxSurge: 0`, car la file de transmission est un fichier à un seul écrivain sur un volume), donc il y a un trou le temps qu'il monte. Le Gateway voit toujours la nouvelle version dans le birth suivant du relay et journalise le changement. Sous Helm, un relay ne rapporte pas de digest d'image (un conteneur ne voit pas le sien, et Kubernetes ne le lui transmet pas), seulement sa version. `Node Control/Update` ne fait rien ici et le relay le dit dans son journal ; Helm est l'approbation.

### Ce qui n'est pas là, et pourquoi

- **Images signées et liste blanche de digests.** Le Gateway ne peut imposer ni l'une ni l'autre sur un boîtier auquel il n'a pas accès, et un contrôle que le relay exécute sur lui-même est un contrôle qu'un relay compromis saute. Podman peut vérifier les signatures au pull (`policy.json`), ce qui est l'endroit où cela marche ; rien ici ne met cette politique en place pour vous, et `:stable` est approuvé comme n'importe quel tag.
- **Déploiement progressif.** Chaque relay d'un boîtier suit le même tag sur son propre minuteur, donc une flotte se met à jour selon la dispersion du minuteur, pas par vagues, et le rollback ci-dessus limite l'effet d'une mauvaise release. Pour échelonner volontairement, retenez les sites qui doivent attendre avec le drop-in de retenue et approuvez-les dans l'ordre voulu.

## Envoi de configuration (4.8.0)

Un nouveau fichier d'appareils peut être poussé sur un topic MQTT distinct, simple (non Sparkplug) et retenu. Voir la section « Config push » de la page de gestion de flotte pour le côté Gateway. Jusqu'à la 4.17, un envoi ne faisait que préparer le fichier et le relay continuait d'interroger l'ancienne liste jusqu'à ce que quelque chose le redémarre. Chaque changement de ce qu'un relay interroge devenait un redémarrage du relay, de sa session broker et de chaque session d'appareil, sur un boîtier censé rester des mois sans être touché. Désormais un envoi s'applique dès qu'il arrive.

- Poussé pendant que ce relay **tourne** : les octets sont validés avec les mêmes règles que `LoadDeviceFile` applique au démarrage, enregistrés dans `HOTLOOP_EDGE_RELAY_PUSHED_FILE` (ou par-dessus `HOTLOOP_EDGE_RELAY_DEVICES_FILE` quand il n'est pas défini ; voir plus bas) et appliqués en direct. Enregistré d'abord, exprès : une liste qui a tourné sans être enregistrée reviendrait en silence en arrière au démarrage suivant.
- **Un envoi invalide est refusé et l'ancienne liste continue de tourner.** Un envoi qui ne s'analyse pas, ne valide pas (un appareil en double, un tag sur un appareil que personne n'a déclaré, un protocole inconnu) ou ne peut pas être enregistré ne change rien : ni les appareils en cours, ni le fichier sur disque. Le journal dit pourquoi, et `/status` aussi, sous `config.rejected`, d'où l'écran de flotte du Gateway le reprend.
- Poussé pendant que le relay était **hors ligne** : rien ne peut le recevoir avant le démarrage suivant ; le relay laisse alors quelques secondes à un envoi retenu pour arriver *avant* de charger son fichier d'appareils local, et démarre donc directement dessus. Un envoi qui arrive après ces deux secondes s'applique en direct comme tout autre.
- Le broker rend l'envoi retenu à chaque reconnexion. Le relay reconnaît le fichier qu'il exécute par son sha256, donc les mêmes octets qui reviennent ne changent rien.

### Ce qu'une application en direct conserve, et ce qu'elle change

Le relay calcule ce qui a changé entre le fichier qu'il exécute et le nouveau, appareil par appareil, et ne touche que cela :

- **Un appareil inchangé garde sa session.** Même connexion TCP vers l'automate, même abonnement OPC UA, aucun trou dans ses lectures.
- **Un appareil modifié** (adresse, protocole, intervalle d'interrogation, timeout, bloc de configuration ou tags) est reconnecté avec la nouvelle définition.
- **Un nouvel appareil** est connecté et commence à être interrogé.
- **Un appareil retiré** (ou désormais `"enabled": false`) est déconnecté.
- **La session Sparkplug reste en place.** Pas de NDEATH, pas de reconnexion, même bdSeq, et la file de transmission n'est pas touchée. Un rechargement pendant une panne du broker laisse chaque lecture en tampon dans la file ; elles se vident au retour du broker, comme sans rechargement.

Sur le fil, selon Sparkplug B. Le relay est un nœud edge et chaque tag est une métrique de nœud nommée `device/tag` ; c'est donc l'ensemble de métriques du nœud qui change, et Sparkplug ne donne à un nœud qu'une façon de le changer : un nouveau NBIRTH, qui remplace entièrement le dernier. Ainsi :

- **Les métriques disparues** (un appareil retiré, un tag retiré ou désactivé) sont renvoyées une dernière fois dans un NDATA à null, puis le nœud refait un birth sans elles : même session, même bdSeq, seq remis à 0, le même rebirth que provoque `Node Control/Rebirth`. Le null est là parce qu'un hôte a le droit de garder la dernière valeur d'une métrique qu'un nouveau birth omet, et l'hôte Sparkplug du Gateway fait exactement cela. Sans le null, une vanne retirée du relay resterait pour toujours sur sa dernière bonne lecture, l'air en bonne santé.
- **Les nouvelles métriques** entrent dans un birth à la première interrogation de leur appareil, comme toute métrique au démarrage. Un birth ne nomme jamais une métrique avant qu'une lecture existe derrière.
- **Les lectures d'un tag retiré encore dans la file de transmission** sont abandonnées à la vidange de la file, avec une ligne de journal qui les compte. Le birth du nœud ne porte plus cette métrique, et Sparkplug n'a aucun moyen légal d'en envoyer une qu'il ne porte pas ; les envoyer reviendrait à utiliser un alias dont aucun hôte n'a été informé.

Modifier à la main le fichier d'appareils local exige toujours un redémarrage : le relay le lit au démarrage et quand un envoi est effacé, et ne le surveille pas. Avec le chart, c'est de toute façon ce que fait un `helm upgrade` qui change `devices`.

### Où vit un fichier poussé, et quel fichier l'emporte

Les deux installations prises en charge montent le fichier d'appareils local en lecture seule : le chart depuis un ConfigMap (ou un Secret), l'unité Quadlet comme montage `:ro`, et les deux sur un système de fichiers racine en lecture seule. Jusqu'à la 4.16.0, le relay écrivait un envoi juste à côté de ce fichier, donc sur l'une comme l'autre installation chaque envoi échouait avec

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

et le relay continuait d'interroger l'ancienne liste. Le Gateway disait `config pushed`, le redémarrage passait, et rien ne changeait. C'est corrigé en donnant à l'envoi son propre emplacement :

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** est l'endroit où un envoi est écrit. Le chart le fixe à `/data/pushed-devices.json` sur le PVC (`pushedDevicesFile` dans values.yaml), et l'unité Quadlet fixe le même chemin sur son volume de données nommé. Les deux survivent au conteneur, et le PVC survit à une replanification. Ce dernier point est voulu : un emptyDir serait aussi accessible en écriture, mais il disparaît dès que le pod bouge, et un relay qui retombe en silence sur son ancienne liste d'appareils après un drain de nœud est le même bug avec des étapes en plus.
- **Le fichier poussé l'emporte.** Au démarrage, le relay charge le fichier poussé s'il existe, et le local seulement sinon. Cela vaut après un redémarrage, après une replanification, après que le broker a perdu l'envoi retenu (un redémarrage de Mosquitto sans persistance) et après un `helm upgrade` qui change `devices` ou `tags`. L'envoi est le changement plus récent et délibéré, et le broker rendrait de toute façon la copie retenue au démarrage suivant, donc laisser gagner le fichier local ne durerait qu'un redémarrage. Les premières lignes du journal disent de quel fichier il a démarré : `booting from the pushed device file; the local one is ignored until the push is cleared`.
- **Revenir au fichier local** (les `devices` du chart, ou `/etc/edge-relay/devices.json` sous Quadlet) se fait par `DELETE /api/fleet/{id}/config` sur le Gateway. La suppression efface l'envoi retenu sur le broker, donc aucun démarrage ultérieur ne l'applique, et un relay connecté à ce moment charge son fichier local, supprime son fichier poussé, journalise `the config push was cleared; the local device file takes over` et applique le fichier local en direct, comme un envoi s'applique. Si le fichier local ne se charge pas, le relay garde le fichier poussé en marche et sur disque et le dit dans le journal et dans `/status` : le supprimer d'abord laisserait un relay qui démarre au prochain redémarrage sur un fichier cassé. Corrigez le fichier local et renvoyez la suppression. Faites-le pendant que le relay est **en ligne**. Une suppression n'est pas retenue, donc un relay hors ligne à ce moment ne l'apprend jamais et garde son fichier poussé ; relancez-le et renvoyez la suppression. On peut la répéter sans risque.
- Un fichier poussé qui existe mais ne se charge pas (une panne de disque, ou une release ultérieure aux règles plus strictes) est journalisé comme une erreur et le relay démarre sur le fichier local plutôt que de rester arrêté.
- Si `HOTLOOP_EDGE_RELAY_PUSHED_FILE` n'est pas défini, un envoi écrase `HOTLOOP_EDGE_RELAY_DEVICES_FILE` lui-même, le comportement de la 4.8.0. Cela ne vaut que pour un binaire seul avec un fichier d'appareils modifiable, et il n'y a alors pas de copie séparée qu'un effacement puisse abandonner.

Si un envoi « n'a pas pris », regardez le journal du relay avant tout. Soit il dit de quel fichier il a démarré, soit il dit pourquoi l'envoi a été refusé.

## La surface HTTP

Deux endpoints, tous deux sans authentification, tous deux en lecture seule :

- `GET /healthz` : le processus tourne. Rien de plus ; un appareil déconnecté ne rend pas ce processus malsain.
- `GET /status`, un instantané : nombre d'appareils par état de connexion, nombre de tags, profondeur actuelle de la file de transmission, liste des protocoles compilés, et `uplink` : si le broker est connecté, si une relecture est en cours, et ce que la file de transmission contient, pèse sur disque et a abandonné à sa limite (voir la page Edge publish, « When the uplink is down »). Aucune valeur de tag, aucune adresse d'appareil, aucune configuration : c'est une surface de supervision, pas une copie réduite du tableau de bord du Gateway. `version`, `imageDigest` et `updateMode` disent de quel build il s'agit et s'il retient les mises à jour. Il indique aussi, sous `config`, quel fichier d'appareils tourne : `source` (`local` ou `pushed`), `path`, son `digest` sha256, `appliedAt` et `rejected`, le dernier fichier que le relay a refusé et pourquoi, jusqu'à ce qu'un envoi suivant s'applique. Le digest, pas le fichier : le Gateway peut le comparer à ce qu'il a poussé sans que les adresses et identifiants du fichier sortent par un port non authentifié. Avec un broker `discovery` dans le fichier, il indique aussi, sous `discovery`, comment va chacun et combien d'appareils il a trouvés (voir [Discovery](#discovery-41810)).

Délibérément aucune authentification devant l'un ou l'autre : un edge relay n'a ni base d'utilisateurs, ni magasin de sessions, ni système d'identité pour en bâtir une, et ajouter un seul jeton partagé serait du théâtre plutôt que de la sécurité pour deux endpoints qui n'exposent rien de sensible. Exécutez-le derrière le périmètre réseau dont dépend l'appareil lui-même, la même attente que documente déjà le mode `auth.insecure` du Gateway pour un déploiement derrière un proxy de confiance.

## Configuration

| Variable | Par défaut | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | n/a | Obligatoire. Chemin du fichier d'appareils décrit plus haut |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | unset | Où est conservé un fichier d'appareils poussé ; il l'emporte sur celui ci-dessus tant qu'il existe. Doit être inscriptible et persistant ; le chart et l'unité Quadlet utilisent `/data/pushed-devices.json`. Voir [Où vit un fichier poussé](#où-vit-un-fichier-poussé-et-quel-fichier-lemporte) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | Le serveur de `/healthz` et `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` laisse la mise à jour au superviseur et ignore une approbation du Gateway ; `approve` retient les mises à jour jusqu'à ce qu'une arrive. Voir [Mettre à jour un relay](#mettre-à-jour-un-relay) |
| `HOTLOOP_IMAGE_DIGEST` | unset | Le digest de l'image dont ce relay est issu, tel que son superviseur le connaît. L'unité Quadlet le définit avant chaque démarrage. Rapporté dans `/status` et dans chaque birth ; vide est acceptable |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Intervalle d'interrogation par défaut ; le `pollIntervalMs` propre à un appareil le remplace |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Plancher imposé à chaque appareil, quel que soit son propre réglage |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Timeout par interrogation par défaut ; le `timeoutMs` propre à un appareil le remplace |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Appareils pouvant être en pleine interrogation en même temps |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Bornes de temporisation entre tentatives de reconnexion, avec gigue |
| `HOTLOOP_RING_SIZE` | `120` | Échantillons par tag conservés pour les diagnostics proches de `/status` |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | Le certificat du pilote OPC UA et ses magasins `trusted/` et `rejected/` ; le `pkiDir` propre à un appareil le remplace. Seul un appareil OPC UA sécurisé y touche |

Mêmes noms de variables et mêmes valeurs par défaut que la `RuntimeConfig` du Gateway ; voir sa section « Polling » dans la page k3s et Helm pour les mêmes réglages exprimés en valeurs Helm, car les deux binaires chargent cette configuration par la même fonction `config.LoadRuntimeConfig()`, pas par deux copies qui pourraient diverger.

Plus chaque variable `HOTLOOP_EDGE_PUBLISH_*` que documente la page Edge publish, avec une différence : `HOTLOOP_EDGE_PUBLISH_ENABLED` est ignorée et la transmission est toujours active ; publier ce qu'il lit est toute la raison d'être de ce binaire, pas une option comme sur le Gateway.

## Ce qui a été vérifié ou non

HotLoop a été exécuté sur du vrai matériel et de vrais serveurs, et sur du matériel réel le 2026-11-17.

## Déploiement

Deux chemins pris en charge, tous deux en conteneurs, aucun `podman run` isolé lancé depuis un shell qui meurt avec la session, et pas de Docker :

- **`charts/hotloop-edge-relay`**, un chart Helm k3s, séparé du chart propre du Gateway (`charts/hotloop`), car un edge relay est un artefact vraiment différent qui tourne souvent dans un autre cluster, plus petit, que le Gateway auquel il transmet. Les appareils et les tags se déclarent dans `values.yaml` et sont rendus dans un ConfigMap ; la file de transmission vit sur un petit PVC (voir « Persistence off » plus bas avant de le désactiver).
- **`deploy/quadlet`**, une unité Podman Quadlet pour un Pi ou un petit PC industriel qui ne fait pas du tout partie d'un cluster k3s. Quadlet transforme le conteneur en vrai service systemd : démarre au boot, redémarre en cas d'échec, écrit dans journald ; voir le README de ce répertoire pour l'installation.

Les deux utilisent la même image et les mêmes variables d'environnement documentées plus haut.

Chaque release publie les deux, depuis la 4.16.0. L'image est `ghcr.io/hotloop-io/hotloop-edge-relay`, taguée avec la version de la release (plus `major.minor`, `major`, `latest` et `stable` ; l'unité Quadlet suit `stable`, voir [Mettre à jour un relay](#mettre-à-jour-un-relay)). Elle existe en amd64 et arm64, et en arm 32 bits (arm/v7) dès la première release après la 4.17.0, car un Pi 3 ou une installation Pi OS 32 bits est exactement le boîtier où un relay finit. Le chart est dans le même dépôt Helm que celui du Gateway :

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Persistence off

`persistence.enabled=false` vous donne un relay qui tourne sans PVC, et exactement cela. En 4.16.0, il ne tournait même pas : rien n'était monté sur `/data`, la racine est en lecture seule, et le relay mourait au démarrage avec `open forward queue at /data/forward.db: no such file or directory`. Désormais `/data` est un emptyDir, plafonné à `persistence.size`, et tout ce que le relay écrit y va.

Un emptyDir vit aussi longtemps que le pod. Un redémarrage de conteneur dans le même pod le garde. Un nouveau pod, non, et vous obtenez un nouveau pod lors d'un drain de nœud, de la panne d'un nœud, d'une éviction, d'un `kubectl delete pod` et de tout `helm upgrade` qui renouvelle le Deployment. À chaque fois, vous perdez :

- **La file de transmission.** Chaque lecture mise en tampon pendant que le broker était hors service est perdue, et rien côté Gateway ne sait qu'elle manque.
- **Un fichier d'appareils poussé.** Le relay redémarre sur les `devices` du chart sans se plaindre, jusqu'à ce que le Gateway repousse ou que le broker rejoue un envoi retenu. C'est exactement la défaillance que le PVC est là pour empêcher, et le désactiver vous y expose de nouveau.
- **Le certificat client OPC UA et le magasin de confiance.** Chaque serveur sécurisé doit faire confiance au nouveau certificat, et l'opérateur doit approuver à nouveau le certificat de chaque serveur.

Remplir le plafond, ce que fera une file sans limite (`queueMaxBytes: 0` ; le défaut est 64 MiB) lors d'une panne assez longue, fait expulser le pod et perdre les trois d'un coup. C'est quand même mieux que de remplir le disque du nœud sous tout le reste. Les notes d'installation affichent un avertissement quand la persistance est désactivée. C'est acceptable pour un essai. Pour un relay dont les lectures comptent, donnez-lui le PVC.

### Depuis l'App Store EmberNet

Le store liste le relay sous le nom HotLoop Edge Relay, un par nœud. Un déploiement depuis le store transmet au chart trois choses : le nom d'affichage (le nom de la release), un sélecteur de nœud et les labels du tenant. Il n'a pas de formulaire pour demander autre chose, et le relay ne peut pas tourner sans broker ni groupe Sparkplug. Un déploiement du relay depuis le store s'arrête donc au rendu, exprès, avec une erreur dans le journal du job helm-install qui nomme ce qui manque et affiche la commande exacte pour y remédier.

Nous ne lui avons pas donné de broker par défaut, car il n'en existe aucun qui soit vrai pour l'usine de quelqu'un, et un relay pointé vers une adresse inventée aurait l'air déployé tout en ne transmettant rien. Il ne peut pas non plus attendre sagement un fichier d'appareils poussé : un envoi arrive par la connexion au broker qu'il n'a pas encore.

La solution est de mettre les deux valeurs dans ce que le store a écrit, et l'installation se relance toute seule :

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Une fois en marche, il apparaît dans Apps en cours d'exécution sous le nom donné par le store, avec l'icône HotLoop, limité au tenant qui l'a déployé, et sans bouton LANCER. Ce dernier point est voulu : le chart le labellise `embernet.ai/gui-type: none`, car `/healthz` et `/status` servent à une sonde et au curl d'un opérateur, pas à une page dans un iframe.

Le relay et le Gateway partagent un numéro de version. Une release ne démarre que si les deux charts portent la version du tag et si l'unité Quadlet du relay suit `:stable` ; le relay reçoit donc une nouvelle version à chaque release, que son propre code ait changé ou non. C'est voulu : un seul numéro à demander, et aucun chart de relay qui pointe vers une image de relay que personne n'a poussée. L'unité Quadlet figeait autrefois le numéro de release, ce qui est le contraire du fonctionnement d'un boîtier qui se met à jour seul.
