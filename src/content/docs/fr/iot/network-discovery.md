---
title: "Découverte réseau"
description: "HotLoop écoute en mDNS, SSDP et DHCP et montre ce qui est sur le réseau de l'usine, et n'envoie rien tant que vous n'indiquez pas un réseau à sonder."
---

HotLoop écoute le réseau de l'usine et vous dit ce qui s'y trouve : le nœud ESPHome dans la cour, le Shelly sur le compresseur, le serveur OPC UA de la ligne 3, le boîtier UPnP que quelqu'un a branché et oublié, la chose qui vient de demander une adresse. Chacun apparaît dans Devices, Discovered, sous les appareils qui se sont annoncés en MQTT ([découverte MQTT](/fr/iot/mqtt-discovery/)), avec ce que c'est et comment HotLoop pourrait lui parler.

Ensuite, une personne décide. Rien de ce qui est entendu sur le réseau n'est jamais ajouté de lui-même, et rien n'est jamais armé.

## Écouter, ne pas scanner

Sur un réseau OT que vous lisez, on ne scanne pas. Un balayage de ports a déjà fait tomber plus d'un automate qui répondait à un paquet qu'il n'attendait pas, et « ce n'est que de la découverte » ne console personne à trois heures du matin. Par défaut, HotLoop n'envoie donc strictement rien :

- **mDNS** (activé) : les appareils annoncent leurs services au démarrage, et chaque réponse à la question de n'importe qui est diffusée en multicast à tout le segment. Un téléphone qui ouvre une application ou un portable qui cherche une imprimante pose la question ; HotLoop écoute au passage.
- **SSDP** (activé) : les appareils UPnP diffusent en multicast `NOTIFY ssdp:alive` quand ils rejoignent le réseau puis toutes les quelques minutes. HotLoop entend ceux-là aussi.
- **DHCP** (désactivé, voir plus bas) : un appareil qui rejoint le réseau diffuse une demande d'adresse avec sa MAC et généralement son nom.

Demander, c'est **sonder**, et cela s'active réseau par réseau, par le déploiement, jamais par un bouton :

| Variable | Par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | écouter le mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | écouter le SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | écouter les demandes DHCP sur l'UDP 67 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | vide | les réseaux sur lesquels le sondage est activé, en CIDR : `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | la fréquence d'un sondage à cet endroit |

Sur un réseau listé, un sondage envoie une question mDNS pour chaque type de service et pour ceux que HotLoop connaît, repose la question pour chaque type apparu, envoie un `M-SEARCH` SSDP et lit auprès de chaque appareil UPnP sa description (son nom, son fabricant et son modèle). Sur tout autre réseau, il n'envoie rien, et le bouton Probe now est refusé là où rien n'est listé. Listez les réseaux que vous visez : un /8, c'est 16 millions d'adresses, et HotLoop les interrogera si vous le lui demandez.

## Ce qu'il sait contacter

| Entendu | C'est | En l'acceptant |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | un serveur OPC UA (OPC 10000-12 Annexe C : l'endpoint est l'adresse et le port du SRV plus le `path` du TXT) | crée un appareil OPC UA à cet endpoint, anonyme et non sécurisé au départ, sans tags. Parcourez-le avec Discover tags et réglez sa sécurité avant qu'il porte quoi que ce soit d'important |
| mDNS `_shelly._tcp`, ou `_http._tcp` avec `gen` | un Shelly, Gen2 ou plus récent (son TXT `gen`, `app` et `ver`) | crée un appareil HTTP qui lit `http://<it>/rpc/Shelly.GetStatus`, l'appel d'état propre à Shelly, en lecture seule, sans tags. Discover tags liste toutes les valeurs. Un Shelly dont la connexion est activée veut une authentification digest, que le pilote HTTP ne fait pas |
| mDNS `_esphomelib._tcp` | un nœud ESPHome (son TXT : `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | l'enregistre comme connu et ne crée rien. HotLoop lit ESPHome en MQTT : donnez au nœud un bloc `mqtt:` pointant vers le broker de HotLoop et il s'annonce, et la carte le dit (rapprochement par MAC) |
| mDNS `_mqtt._tcp` | un broker MQTT | l'enregistre. Ajoutez-le dans Settings, MQTT pour entendre ce qui s'annonce dessus |
| mDNS `_http._tcp`, tout le reste | une page web, ou un service dont HotLoop ne connaît pas le nom | l'enregistre |
| SSDP | un appareil UPnP, par son uuid : types d'appareil, `SERVER` et, avec le sondage activé, sa description | l'enregistre |
| DHCP | un appareil qui demande une adresse : MAC, nom d'hôte, classe de fournisseur | l'enregistre |

« L'enregistre » mérite quand même un clic. Sur un réseau d'usine, chaque boîtier devrait être connu de quelqu'un, et une trouvaille acceptée est une décision avec un nom et une heure. Le prochain inconnu se remarque.

Une carte indique quand deux trouvailles sont le même boîtier : la MAC mDNS d'un nœud ESPHome et son annonce MQTT, une demande DHCP et un hôte mDNS à la même adresse.

Accepter n'arme rien. Un appareil créé par l'acceptation n'a aucun tag tant que quelqu'un ne les choisit pas, et chaque point qui s'y trouve est en lecture seule tant que quelqu'un ne l'arme pas dans l'éditeur de tags, par la même porte d'écriture que tout le reste. L'adresse de la proposition vient de l'annonce de l'appareil lui-même, et la boîte de dialogue d'acceptation l'affiche pour que vous vérifiiez que c'est bien le boîtier que vous croyez.

**Ignore** masque une trouvaille et la garde masquée quand elle est entendue de nouveau. **Un-ignore** la ramène.

## Rien n'est digne de confiance

Quiconque peut poser un paquet sur le segment peut se prétendre n'importe quoi. Donc :

- chaque chaîne est tronquée et dépouillée de ses caractères de contrôle, et l'écran la met dans la page comme du texte, jamais du HTML ;
- une description UPnP n'est lue que depuis l'adresse d'où vient l'annonce, seulement sur un réseau de sondage, jamais à travers une redirection, et jamais au-delà de 64 Kio. Un `NOTIFY` usurpé qui pointe `LOCATION` vers la page web d'un automate, ou vers HotLoop lui-même, n'obtient rien de récupéré ;
- chaque listener accepte 500 datagrammes par seconde et abandonne et compte le reste ;
- le registre contient 1 024 trouvailles. Les nouvelles au-delà sont abandonnées et comptées tant que quelqu'un n'en a pas traité, et l'écran le dit ;
- une question sur le fil est la question de quelqu'un, pas une annonce : les réponses connues qu'elle porte sont les croyances de celui qui demande, et on n'en fait rien.

## Où HotLoop doit se trouver pour entendre quelque chose

Le multicast et le broadcast ne traversent ni un routeur, ni un NAT, ni un réseau de conteneurs. HotLoop entend le segment sur lequel il se trouve, et rien d'autre :

- **Une machine sur le réseau de l'usine** (le binaire, ou Podman avec `--network host`) : entend tout.
- **Kubernetes avec un réseau de pods** : n'entend rien de l'usine. L'écran Discovered montre les interfaces sur lesquelles il écoute, ce qui permet de le constater. Donnez au pod `hostNetwork: true`, ou une seconde interface sur le segment de l'usine (Multus avec macvlan), et il entend l'usine. Le chart ne fait ni l'un ni l'autre pour vous : mettre un pod sur le réseau de l'hôte est une décision sur le nœud, pas une valeur par défaut.

mDNS (5353) et SSDP (1900) sont des ports ordinaires au-dessus de 1024, donc sans privilège. HotLoop les partage avec ce qui les détient déjà, un avahi-daemon de l'hôte compris.

## DHCP

Faisable, en toute honnêteté, mais il faut deux choses qu'un conteneur n'obtient pas par défaut, ce qui explique qu'il soit désactivé :

1. **Les broadcasts de l'usine.** Une demande DHCP part vers 255.255.255.255, donc HotLoop doit être sur le segment : réseau de l'hôte ou une interface dessus, comme ci-dessus.
2. **Le port UDP 67**, qui est sous 1024. L'image de HotLoop s'exécute avec l'uid 65532. Donnez au binaire `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), ou réglez le `net.ipv4.ip_unprivileged_port_start` de l'hôte à 67 ou moins. Dans Kubernetes, ajouter `NET_BIND_SERVICE` aux capabilities d'un conteneur non root ne le rend pas effectif à lui seul ; c'est la capability du fichier ou le sysctl qui le fait.

Il n'a jamais besoin d'un socket brut ni d'un conteneur privilégié : un socket UDP ordinaire sur le port 67 reçoit les broadcasts. Il ne répond jamais, ne propose jamais d'adresse, n'envoie jamais un octet. Il partage le port, donc un serveur DHCP sur le même hôte qui le partage aussi continue de fonctionner ; un serveur qui le garde pour lui seul fait échouer le listener de HotLoop, et l'écran dit pourquoi, sans toucher au serveur.

Ce qu'il ne peut pas voir : les renouvellements, qui vont en unicast au serveur. HotLoop entend un appareil quand il rejoint le réseau, pas toutes les heures ensuite.

## Plusieurs réplicas

Seul le réplica qui détient le verrou de la découverte réseau écoute et sonde ; les autres réessaient toutes les 30 secondes, donc un autre prend le relais si le titulaire disparaît. Deux sondeurs interrogeraient chaque appareil deux fois.

## Sauvegardes

`net_finds` figure dans chaque sauvegarde : ce qui a été entendu, et qui a accepté ou ignoré quoi. Les décisions sont la partie que le réseau ne redit jamais.

## Comment c'est testé

La découverte a été exécutée sur de vrais réseaux contre de vrais annonceurs, des nœuds ESPHome, Shelly et OPC UA, un serveur multimédia UPnP et des clients DHCP, et sur du matériel réel le 2026-11-17.
