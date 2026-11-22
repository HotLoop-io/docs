---
title: "Installer HotLoop Flow avec Podman ou Helm"
description: "Lancez HotLoop Flow {{flow}} avec Podman ou Quadlet, sur Kubernetes avec Helm ou depuis les sources. Il démarre verrouillé, fixez d'abord un mot de passe admin."
sidebar:
  label: "Installation"
---

HotLoop Flow {{flow}} est la version actuelle. Il est livré sous la forme `ghcr.io/hotloop-io/hotloop-flow:{{flow}}`, une image pour amd64 et arm64 (celle d'amd64 mesurait 45.64 MB d'après Podman en 2.8.0), plus un chart Helm et les sources à compiler soi-même. 2.9.0, 2.9.1, 2.10.0, 2.11.0, 2.12.0, 2.13.0, 2.14.0, 2.15.0, 2.16.0, 2.16.2, 2.16.3, 2.16.4, 2.16.5 et {{flow}} sont uniquement amd64, et 2.10.2, 2.11.1, 2.12.1, 2.13.1, 2.14.1, 2.15.1 et 2.16.1 sont compilées pour amd64 et arm64 (2.10.1 a un chart mais pas d'image, ne l'épinglez donc jamais), si bien qu'un Pi ou une machine arm64 restée en 2.13.1 peut passer en 2.16.1. L'image est distroless, tourne sous un utilisateur non root et ne contient pas de shell, donc il n'y a rien dans quoi entrer, ni pour vous ni pour qui ne devrait pas être là. Il n'y a pas de voie Docker ou Compose sur cette page : Podman pour une machine, Quadlet pour en faire un service, Helm pour un cluster.

Flow démarre verrouillé. Il refuse de tourner sans compte administrateur, parce qu'un flux peut exécuter des commandes. Et il refuse de tourner sans secret d'identifiants, qui chiffre tous les mots de passe de brokers et de bases de données stockés avec vos flux. Toutes les voies ci-dessous définissent les deux.

Depuis 2.2.0, le contexte et les liaisons durables vivent dans un fichier SQLite, `state.db`, sur le volume de données, de sorte qu'un redémarrage ne les efface plus. Gardez ce volume. Avec `persistence.enabled` à false dans le chart, il survit au redémarrage d'un conteneur mais pas au remplacement d'un pod.

## Podman

Faites d'abord un hash de mot de passe. L'image n'a pas de shell, donc le hachage est une sous-commande du binaire lui-même, et elle refuse tout ce qui fait moins de huit caractères.

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'
```

Faites ensuite le secret d'identifiants et notez-le quelque part où vous le retrouverez dans un an :

```bash
openssl rand -hex 32
```

Lancez-le alors. Les deux valeurs vont entre apostrophes, parce qu'un hash bcrypt est plein de signes dollar que votre shell avalerait sinon.

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>' \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

Ouvrez `http://localhost:1880/` et connectez-vous en tant que `admin`. `/health` répond avec la version dès que le processus est lancé, et `/ready` dit si le runtime a réellement démarré.

Gardez ce secret. Tout ce que Flow chiffre sur le volume n'est lisible qu'avec lui. Recréez le conteneur avec un autre et tous les mots de passe de brokers stockés disparaissent, ce qui ressemble exactement à un démarrage propre jusqu'au moment où MQTT cesse de s'authentifier.

## Quadlet

Pour un service qui démarre au boot et se relance tout seul. Il faut Podman 4.4 ou plus récent. Mettez les secrets dans un fichier que vous seul pouvez lire :

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<the secret>
EOF
```

Décrivez ensuite le conteneur à systemd. Enregistrez ceci sous `~/.config/containers/systemd/hotloop-flow.container` :

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:{{flow}}
ContainerName=hotloop-flow
PublishPort=1880:1880
Volume=hotloop-flow-data:/data
EnvironmentFile=%h/.config/hotloop-flow/hotloop-flow.env

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start hotloop-flow
```

Un service utilisateur ne démarre au boot, et ne survit à votre session, que si le lingering est activé pour votre compte : `loginctl enable-linger`. Sautez cette étape et il tourne très bien jusqu'à ce que vous vous déconnectiez ou que la machine redémarre.

## Helm

Le chart fonctionne sur n'importe quel Kubernetes, k3s compris.

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

Le chart génère le mot de passe administrateur et le secret d'identifiants à la première installation, et relit les deux dans le Secret existant à chaque mise à niveau, de sorte qu'une mise à niveau ne fait jamais tourner le secret sous vos identifiants stockés. Les notes d'installation indiquent comment lire le mot de passe. Pour la version ci-dessus :

```bash
kubectl get secret line3-flows-auth -o jsonpath='{.data.admin-password}' | base64 -d
kubectl port-forward svc/line3-flows 1880:8080
```

L'utilisateur est `admin`. Avant 2.0.2, ce mot de passe généré ne fonctionnait jamais, car le hash que vérifiait l'application avait été fait à partir d'un autre mot de passe aléatoire que celui que le chart avait stocké. Mettre à niveau une version installée ainsi corrige le problème sur place, et ni le mot de passe ni le secret d'identifiants ne changent.

Une version est une instance, et le chart fixe `replicaCount: 1` exprès. Chaque instance détient l'état des flux et des connexions vivantes vers des brokers et des automates. Deux pods derrière un même Service s'abonneraient tous les deux et écriraient tous les deux, et InfluxDB stockerait silencieusement chaque mesure en double. Pour en faire tourner plus, installez une autre version avec ses propres flux. Deux versions peuvent aussi partager une même tâche, avec un bail qui ne laisse qu'une seule d'entre elles écrire sur l'équipement à la fois : [un secours à chaud avec bail](/fr/flow/failover/).

Il est aussi petit exprès. Le `resources.preset` par défaut est `small`, qui demande 10m de CPU et 64Mi de mémoire. Le processus de Flow a mesuré 16.6 MiB résidents au repos, donc il se planifie sur un nœud de périphérie avec 64Mi de libres, là où la demande par défaut de 512Mi du chart node-red resterait en Pending.

Le pod tourne sous l'uid 65532 sur un système de fichiers racine en lecture seule, sans élévation de privilèges, avec seccomp `RuntimeDefault` et toutes les capacités Linux supprimées, découverte comprise. Jusqu'à 2.0.4, le chart ajoutait `NET_RAW` et `NET_ADMIN` dès que la découverte était activée, pour des balayages ARP que personne n'a jamais écrits. 2.0.5 a arrêté cela, et vous n'avez rien à changer à ce que vous aviez défini.

Le chart a trois modes réseau :

| Mode | Ce qu'il obtient | Instances par nœud |
|---|---|---|
| `cluster` | Une ClusterIP, et tout ce que le cluster route. Le défaut, et la bonne réponse sauf si vous avez besoin de la couche 2. | Illimitées |
| `host` | Les interfaces, la table ARP et le domaine de diffusion de l'hôte. | Une, puisque le port appartient au nœud |
| `macvlan` | Ses propres MAC et IP sur le VLAN cible, sur le segment où sont les automates. Nécessite Multus. | Illimitées |

`macvlan` est la raison d'être des modes, car scanner un réseau d'automates n'a aucun sens depuis un pod qui ne voit que ce que le cluster lui route. Il est sûr en multi-instance et placé juste sur ce segment, sans collision de ports puisque chaque instance porte sa propre adresse. Le [README de Flow](https://github.com/HotLoop-io/hotloop-flow#deploying-on-kubernetes) couvre en détail les modes et les préréglages de ressources.

:::note[Où le chart a été exécuté]
Le chart a été installé et éprouvé sur un cluster k3s de quatre nœuds, en mode réseau `cluster` par défaut : connexion, un flux déployé par l'API, ce flux survivant au redémarrage d'un pod, des mises à niveau, et un déploiement depuis l'App Store EmberNet via Fleet. Les modes `host` et `macvlan` se rendent, passent le lint et sont refusés quand ils sont mal configurés, et ont été exécutés sur du matériel réel (2026-11-17).
:::

## Un VLAN par onglet

2.9.0 permet à un onglet, un sous-flux ou un seul nœud de lier ses connexions à une interface réseau, si bien qu'un seul Flow peut garder un onglet par machine sur une boîte dont l'unique port porte un VLAN pour chacune, même quand tous les VLAN ont le même sous-réseau et les mêmes adresses d'appareils. La façon par onglet est la variable d'environnement `FLOW_NETWORK_INTERFACE` sur l'onglet, et tous les nœuds clients qu'il contient en héritent. 2.9.1 ajoute le même champ au nœud `modbus-server`, de sorte que deux serveurs peuvent écouter sur la même adresse et le même port, un par VLAN.

Le pod doit voir l'interface du VLAN, donc lancez-le avec le réseau de l'hôte : `network.mode: host` dans le chart, ou `Network=host` dans une unité Quadlet. Lier un socket à une interface ne demande aucune capacité sur Linux 5.7 et plus récent. Sur un noyau plus ancien, il faut `CAP_NET_RAW`, et la valeur de chart `bindToInterface.netRaw` (`false` par défaut) ajoute cette seule capacité et rien d'autre. Cela a été prouvé dans un laboratoire de deux espaces de noms réseau qui partagent `192.168.1.0/24`, et rien n'a tourné sur le réseau d'un atelier.

## Depuis l'App Store EmberNet

Vous n'en avez pas besoin, et il n'y a aucune étape EmberNet nulle part pour faire tourner Flow. Mais le chart porte les étiquettes que cherche l'App Store EmberNet, donc si vous exploitez déjà EmberCORE, Flow est dans son catalogue et apparaît sous forme de tuile.

Pour un tenant sur son propre cluster, EmberCORE le déploie via Fleet, ce qui demande EmberCORE 4.9.37 ou plus récent. Les versions antérieures créaient un bundle Fleet qui n'installait rien. Depuis Flow 2.0.3, le chart met les étiquettes de tenant d'EmberCORE sur tout ce qu'il crée.

Depuis 2.0.4, la tuile déployée affiche correctement son nom et son icône. Le pod et le Service portent l'annotation `embernet.ai/app-icon`, qui vaut par défaut l'icône propre du chart, de sorte qu'EmberCORE cesse de deviner une icône d'après le nom de la version, ce qui ne correspondait jamais. Définissez `embernet.appIcon` pour utiliser la vôtre, et servez-la avec `Access-Control-Allow-Origin`, sinon la tuile reste vide. L'étiquette `embernet.ai/app-name` est maintenant le nom du chart, pas celui de la version. L'instance reste dans `app.kubernetes.io/instance` et dans le nom du Service, et aucun sélecteur n'a changé, donc la mise à niveau sur place ne pose pas de problème.

Les [notes de version](https://hotloop.io/releases/flow/) listent toutes les versions jusqu'à 0.1.0.

## Depuis les sources

Il faut Go et Node. L'éditeur est compilé d'abord et intégré au binaire avec `go:embed`, donc une compilation Go sans lui échoue sur un motif manquant au lieu de vous remettre un binaire sans éditeur.

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

Le répertoire de données par défaut est `/data`, ce qui convient dans un conteneur et n'est sans doute pas ce que vous voulez sur votre portable : pointez-le ailleurs :

```bash
export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>'
./hotloop-flow
```

## Si vous venez d'Emberwire 0.1.0

2.x est une rupture nette, voulue : 0.1.0 n'avait aucun utilisateur à casser, et une couche de compatibilité sans utilisateurs n'est qu'un endroit où vivent les bogues. Les variables `EMBERWIRE_*` sont désormais `HOTLOOP_FLOW_*`, les deux types de nœuds de configuration de base de données sont `hotloop-flow-influxdb` et `hotloop-flow-postgres`, les modules WASM exportent `hotloop_flow_*`, les métriques sont `hotloop_flow_*` et l'en-tête de déploiement est `HotLoop-Flow-Deployment-Rev`.

Un fichier d'identifiants de 0.1.0 ne peut pas être lu. Depuis 2.0.1, Flow le dit au démarrage : il nomme le fichier, dit qu'Emberwire l'a écrit et vous demande de le mettre de côté et de ressaisir les identifiants. L'image 0.1.0 est toujours à `ghcr.io/embernet-ai/emberwire:0.1.0`, et les [notes de version](https://hotloop.io/releases/flow/) listent chaque rupture.
