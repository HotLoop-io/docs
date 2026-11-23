---
title: "Réseau UniFi"
description: "Switchs, ports, PoE, bascule WAN et clients d'une console UniFi en tags ordinaires, avec écrans, événements et commandes inactives jusqu'à armement."
---

Le réseau d'une usine est un équipement. Quand un automate se tait, la première question est « est-ce l'automate, ou le port du switch où il est branché », et jusqu'ici la réponse se trouvait dans l'application UniFi sur le téléphone de quelqu'un. HotLoop lit donc la console UniFi elle-même : chaque switch, chaque port, la consommation PoE, les liens WAN et la santé du site, sous forme de tags ordinaires. Les alarmes, les tendances, les entités, les automatisations, OPC UA et MCP fonctionnent alors dessus sans savoir qu'UniFi existe.

Voici le pilote, la surveillance OT qui s'appuie dessus, les écrans, le flux d'événements et les premières commandes (U1 à U5 dans la [feuille de route](/fr/roadmap/)). **Il lit le réseau, et ne le modifie que lorsqu'une personne a armé un tag pour cela.** Chaque tag est créé en lecture seule. Les quelques points qui sont des commandes (plus bas, « Commandes ») passent par la porte d'écriture comme n'importe quel tag : rien n'en envoie une tant que quelqu'un n'a pas marqué ce tag comme modifiable, et un compte de console en View Only est refusé par la console elle-même. Pour tout sauf les commandes, le compte utilisé peut être View Only.

## Ajouter une console

Un appareil HotLoop correspond à **un site sur une console**. Le Cloud Gateway et l'Express placé derrière sont deux consoles, donc deux appareils, avec deux identifiants, car chaque console a ses propres comptes locaux.

1. **Créez un compte local sur la console.** Settings, Admins & Users, Add Admin, cochez **Restrict to Local Access Only**, rôle **View Only**. Un compte cloud Ubiquiti ne peut se connecter que depuis l'application : il exige le MFA, et la console répond 403 à un script. Le nôtre s'appelle `hotloop-ro`.
2. **Ajoutez l'appareil.** Protocole `unifi`, adresse : l'URL de la console, `https://host` pour une console sous UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` pour la Network Application auto-hébergée. Un intervalle d'interrogation de 15 s convient bien ; le pilote ne lit jamais une console plus d'une fois toutes les 10 s, quelle que soit la valeur réglée.
3. **Enregistrez sans empreinte.** La première connexion échoue, volontairement, avec l'empreinte du certificat présenté par la console. Vérifiez que c'est bien votre console (la console affiche son certificat, ou `openssl s_client -connect host:443` passé dans `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` donne le même résultat), collez-la dans `certFingerprint`, puis enregistrez.
4. Les tags se créent d'eux-mêmes à l'interrogation suivante. Voir plus bas.

Un appareil UniFi ne peut être enregistré que si HotLoop dispose d'une clé pour chiffrer le mot de passe (`HOTLOOP_SECRET_KEY_FILE`, que le chart met en place tout seul). Voir [Sauvegardes et restauration](/fr/iot/backup/#identifiants-dappareils-et-clé-secrète).

| Option | Par défaut | Ce qu'elle fait |
|---|---|---|
| `site` | `default` | Le nom court du site, celui des URL de la console. `default` est le premier site de chaque console |
| `username`, `password` | obligatoires | Le compte local. Le mot de passe est en écriture seule par l'API et chiffré dans la base de données |
| `certFingerprint` | aucune | Le SHA-256 de la clé publique du certificat de la console, en hexadécimal. Deux-points, espaces et majuscules sont acceptés |
| `caFile` | aucun | Fait confiance à une CA au lieu d'une empreinte, pour les consoles dotées de vrais certificats |
| `insecureSkipVerify` | `false` | Fait confiance à n'importe quel certificat. Pour un banc d'essai, jamais pour une usine |
| `clientTimeoutSec` | `90` | Combien de temps après la dernière observation d'un client par la console il compte encore comme présent sur le réseau. Plancher : 30. Voir [clients](#clients-réseaux-ot-et-où-un-automate-est-branché) |

### Pourquoi le certificat est épinglé

Les consoles livrent des certificats auto-signés, et la réponse paresseuse consiste à sauter la vérification. C'est acceptable pour lire un compteur. Ça ne l'est pas pour une connexion qui voit tout le réseau de l'usine et, à partir des PR d'écriture, redémarre ses ports. Une console épinglée qui présente un autre certificat est refusée pendant la poignée de main TLS, **avant l'envoi de l'identifiant ou du mot de passe**, et l'erreur nomme les deux empreintes. L'épinglage porte sur la clé publique : une console qui réémet son certificat avec la même clé continue de fonctionner.

Il n'y a pas de « confiance au premier usage » silencieuse. Le seul moment où faire confiance à un certificat a un sens, c'est quand une personne le regarde, et c'est donc à ce moment-là que cela se fait.

## Connexions : une fois, et pas davantage sauf nécessité

Se reconnecter à chaque vérification a fait répondre 429 à notre propre Cloud Gateway, qui a verrouillé le compte. Deux fois. D'où :

- **Une session par console et par processus.** Chaque interrogation, et chaque site de la console, passe par la même connexion. Deux appareils pour deux sites d'une même console avec le même compte forment une seule session.
- **Il ne se reconnecte que lorsque la console dit que la session a disparu** (401), un appelant à la fois, et **jamais plus d'une fois par minute**, quoi qu'il arrive. Une session qui meurt deux fois en une minute laisse l'appareil en lecture mauvaise jusqu'à la fin de la minute, et c'est le compromis voulu.
- **Une connexion refusée n'est pas retentée.** Un mauvais mot de passe, un compte cloud ou un verrouillage 429 attend au moins cinq minutes, davantage si le `Retry-After` de la console l'indique, et l'erreur de l'appareil dit lequel c'était. Éteindre puis rallumer l'appareil n'achète pas un autre essai : le processus s'en souvient.
- **Il se déconnecte** quand le dernier appareil utilisant une console s'arrête, pour que les redémarrages n'empilent pas des sessions sur la console.
- **Un assistant `--mcp-stdio` ne se connecte jamais.** Il tourne à côté du Gateway, qui détient déjà la session, et une seconde connexion depuis la même machine est exactement ce qui provoque le 429. Ses appareils UniFi restent à l'arrêt là-bas pendant qu'ils tournent dans le Gateway.

## Tags

Chaque tag est créé par le pilote, en lecture seule jusqu'à ce qu'une personne l'arme, nommé d'après les adresses MAC et les numéros de port, jamais les noms d'affichage : renommer un switch dans l'application UniFi ne casse donc rien. `<mac>` est l'adresse MAC de l'appareil en minuscules sans séparateurs, `<nn>` le numéro de port sur deux chiffres.

| Tag | Type | Ce que c'est |
|---|---|---|
| `d.<mac>.state` | texte | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Connecté à la console |
| `d.<mac>.uptime_s` | int, s | Disponibilité |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | Processeur et mémoire |
| `d.<mac>.temp_c` | float, °C | Température, sur les appareils dotés d'une sonde |
| `d.<mac>.clients` | int | Clients connectés par son intermédiaire |
| `d.<mac>.fw` | texte | Version du micrologiciel |
| `d.<mac>.wan<N>.up` | bool, connectivity | Le WAN N est **vivant** selon les contrôles de santé de la passerelle elle-même (`last_wan_interfaces`, puis `last_wan_status`). Pas le `up` du bloc WAN, qui signifie configuré. Une console qui ne donne ni l'un ni l'autre lit mauvais, jamais actif |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Sa latence, bonne uniquement tant que le WAN est vivant |
| `d.<mac>.wan<N>.availability_pct` | float, % | Disponibilité selon les moniteurs de la passerelle sur sa fenêtre (un jour), quand elle en fournit une |
| `d.<mac>.wan.active` | texte | Quel WAN porte le trafic : celui de la liaison montante s'il est vivant, sinon le premier vivant, `none` s'il n'y en a aucun |
| `d.<mac>.wan.failover` | bool, problem | Le trafic passe par autre chose que le premier WAN : l'usine est sur le secours |
| `p.<mac>.<nn>.up` | bool, connectivity | Liaison du port |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Vitesse de la liaison ; 0, valide, sur un port sans liaison |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Trafic |
| `p.<mac>.<nn>.errors` | int | Erreurs de réception plus de transmission |
| `p.<mac>.<nn>.poe_w` | float, W, power | Consommation PoE, sur les ports pouvant fournir du PoE |
| `p.<mac>.<nn>.poe_mode` | texte | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | texte | La santé du site : `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Latence Internet, quand elle est fournie |
| `site.network_version` | texte | La version de Network exécutée par la console |
| `site.events_live` | bool, connectivity | Le websocket d'événements de la console est connecté. 0 signifie que HotLoop interroge seulement, ce qui coûte de la vitesse et rien d'autre |
| `site.last_event` | texte | L'événement le plus récent signalé par la console sur le site, avec ses propres mots |
| `d.<mac>.last_event` | texte | L'événement le plus récent concernant cet appareil. Vide tant qu'il n'en a pas eu |

Les classes d'appareil se retrouvent dans les entités : la liaison d'un port sort donc comme capteur binaire de connectivité et sa consommation PoE comme capteur de puissance, sans que personne ne les règle.

**Les tags s'ajoutent d'eux-mêmes et ne disparaissent jamais tout seuls.** Un switch adopté la semaine prochaine apparaît sous forme de tags à l'interrogation suivante, sur la même session, sans rien redémarrer. Un switch débranché lit `online` 0 et ses ports passent en qualité mauvaise, de sorte qu'une alarme sur lui le dit au lieu de disparaître avec lui. Supprimer ses tags est une décision humaine. Un tag que quelqu'un a désactivé reste désactivé : le pilote n'a pas voix au chapitre.

Seuls les appareils adoptés reçoivent des tags. Un switch branché par quelqu'un et adopté par personne ne fait pas encore partie du réseau de l'usine. Un point que la console ne fournit pas lit mauvais, jamais un zéro inventé : un switch qui ne fournit aucune consommation PoE a ses tags `poe_w` en lecture mauvaise.

Le Edge Relay peut lui aussi interroger une console. Il lit les tags que déclare son fichier d'appareil et n'en ajoute aucun, faute d'endroit où les conserver.

## Commandes

Six types de points sont des commandes. Chacun est créé en lecture seule comme tout autre tag, et ne fait rien tant que quelqu'un ne le marque pas comme inscriptible. Le compte avec lequel HotLoop se connecte doit être Administrateur local pour ceux-ci ; en View Only la console répond HTTP 403 et HotLoop le dit, et rien ne change.

| Tag | Écriture | Ce que fait la console |
|---|---|---|
| `d.<mac>.locate` | `true` ou `false` | Fait clignoter la LED de l'appareil jusqu'à ce qu'on l'éteigne. Relit ce que dit la console. |
| `d.<mac>.restart` | `true` | Redémarre l'appareil à sa prochaine communication. `false` ne fait rien. Lit 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Coupe puis rétablit le PoE du port. `false` ne fait rien. Lit 0. |
| `p.<mac>.<nn>.poe_mode` | `auto`, `off`, `pasv24` ou `passthrough` | Fixe le mode PoE du port. Les autres réglages du port du switch sont lus d'abord et renvoyés avec le changement, si bien qu'aucun n'est perdu. `off` est refusé sur un port qui porte le réseau, comme l'est un cycle d'alimentation. |
| `w.<id>.enabled` | `true` ou `false` | Active ou désactive un réseau sans fil. Seul ce champ est envoyé : la phrase secrète et tous les autres réglages restent. `<id>` est l'identifiant du réseau côté console, qu'un renommage ne change pas. |
| `c.<mac>.blocked` | `true` ou `false` | Bloque un client surveillé sur le réseau, ou le laisse revenir. Le point existe pour un client que la console a déjà vu. |

Il n'a ni localisation, ni mode PoE, ni désactivation de port, ses actions sur les clients se limitent à l'autorisation d'invités (pas de blocage), et une mise à jour de Wifi Broadcast remplace tout le réseau. Il demande aussi une clé d'API, un second identifiant. HotLoop envoie donc tout cela par les propres commandes de la console, une session et une connexion pour tout, comme le fait l'interface web.

L'API publiée n'a pas de configuration de port à écrire. Il n'y a donc aucun moyen pour HotLoop d'éteindre un port sur 10.6 dont on ait vu qu'il tienne, et il n'en envoie pas. Il faut la propre requête de l'interface web pour "Disabled", capturée sur une vraie console.

Un cycle d'alimentation peut abîmer une usine (une automatisation qui redémarre un automate toutes les deux minutes grille son alimentation), donc deux règles tiennent quel que soit le demandeur : un port est redémarré au plus une fois toutes les 15 minutes (l'heure du dernier cycle est conservée dans la base de données, un redémarrage ne l'oublie donc pas, et un cycle dont l'heure ne peut pas être vérifiée est refusé), et un port qui porte le réseau n'est jamais redémarré. C'est une liaison montante, et tout port auquel un autre équipement est raccordé, d'après la topologie de la console elle-même ; le port qui alimente un secours 5G en fait partie. Un refus dit quelle règle l'a causé. Une commande que la console elle-même refuse n'use pas le délai de repos.

## Clients, réseaux OT et où un automate est branché

Deux tâches, toutes deux en lecture seule.

**Où est-il branché.** Un automate se tait et la première question est de savoir si c'est l'automate ou le port du switch. Liez une fois l'appareil HotLoop à son client sur le réseau, et son tiroir affiche « sur USW Lite 8 PoE port 5, liaison coupée » avant que quiconque ouvre l'application UniFi. Le lien donne aussi des tags de client sur l'appareil de la console : l'état du port se met donc en tendance et en alarme à côté des valeurs Modbus qui se sont arrêtées.

**Ce qui se trouve sur le réseau SCADA.** Marquez un réseau comme OT, acceptez ce qui lui appartient, et tout le reste qui y apparaît déclenche une alarme qui le nomme. Quelqu'un branche un portable sur le switch SCADA à 2 h du matin, vous le savez à 2 h du matin.

### Rien n'est identifié par l'IP

La liste de clients de la console est en retard. D'où :

- **Un client, c'est son adresse MAC.** La liaison propose un client par son IP, car c'est ce que vous savez de votre automate, mais une personne le confirme une fois et ensuite la MAC est la clé. Le tag d'IP dit que c'est l'avis de la console.
- **En ligne ne veut pas dire « dans la liste ».** Un client est en ligne quand la console l'a vu dans les `clientTimeoutSec` (90 s) **et**, pour un client filaire, que le port de son switch a une liaison. Le port est la moitié rapide : on débranche le câble et le port lit coupé à la lecture suivante, pendant que la liste rattrape encore son retard.

### Lier un appareil

Ouvrez le tiroir d'un appareil. Si une console UniFi lue par HotLoop liste un client à l'IP de l'appareil, la section Network le propose ; un administrateur clique sur **Link**. Pas d'IP de départ (un appareil adressé par nom) : liez-le par MAC. Ou par l'API, `PUT /api/devices/{id}/network`, voir [l'API HTTP](/fr/iot/api/#put-apidevicesidnetwork).

Le client d'un appareil lié reçoit des tags et une alarme, **« PLC-07 off the network »**, priorité 1, avec une temporisation de 120 s pour qu'un automate qui redémarre ne prévienne personne.

### Réseaux OT et liste des connus

Marquez un réseau comme OT (`PUT /api/unifi/{id}/networks/{network}` avec `{"ot": true}`), puis acceptez ce qui s'y trouve : tout en l'état actuel en un seul appel (`POST .../accept-all`), ou un appareil à la fois. Le marquer crée l'alarme **« Unknown device on SCADA »**, priorité 1, sur `n.<network>.unknown`. Le dernier intrus est nommé dans `n.<network>.unknown_last`, avec sa MAC, le nom qu'il se donne, son IP et le port du switch ou le SSID par lequel il est entré.

Un appareil connu peut être **surveillé** (`"watch": true`) : il reçoit les mêmes tags et la même alarme de sortie du réseau qu'un appareil lié. Un automate est surveillé. Un portable de maintenance autorisé mais qui va et vient est connu et non surveillé, sinon il alerte quelqu'un à chaque départ.

Les alarmes sont des définitions d'alarme ordinaires. Mettez-les en attente, acquittez-les, envoyez-les vers Discord, modifiez leur temporisation. Retirez la surveillance, le lien ou la marque OT et HotLoop retire l'alarme qu'il avait créée pour eux : un tag que plus personne ne lit ne retient donc pas une alarme ouverte. Une alarme écrite à la main par un administrateur n'est jamais touchée.

L'enregistrement appartient à HotLoop, dans sa propre base de données (`unifi_networks`, `unifi_known`, `unifi_links`, toutes dans les sauvegardes), jamais à la console. Un changement parvient au pilote en marche à sa lecture suivante, sur la session qu'il a déjà : il ne redémarre pas l'appareil, car un redémarrage déconnecte et le budget d'une connexion par minute le tiendrait dehors pendant une minute.

### Les tags

| Tag | Type | Ce que c'est |
|---|---|---|
| `n.<network>.clients` | int | Clients sur le réseau maintenant, en ligne selon le test ci-dessus. Chaque réseau LAN en reçoit un |
| `n.<network>.unknown` | int | Sur un réseau OT : clients en ligne qui ne figurent pas dans sa liste de connus |
| `n.<network>.unknown_last` | texte | Le plus récent d'entre eux, en toutes lettres. Vide quand il n'y en a pas |
| `c.<mac>.online` | bool, connectivity | Client surveillé ou lié sur le réseau |
| `c.<mac>.ip` | texte | Son IP, telle que la console l'a vue en dernier |
| `c.<mac>.sw_mac`, `.sw_port` | texte, int | Le switch et le port d'un client filaire. Conservés après le débranchement : où il *était* est justement l'intérêt |
| `c.<mac>.port_up` | bool, connectivity | La liaison de ce port. Mauvaise quand le switch lui-même a quitté la console, car alors personne ne sait |
| `c.<mac>.last_seen_s` | int, s | Secondes depuis la dernière observation par la console |

`<network>` est l'identifiant du réseau côté console : renommer SCADA dans l'application ne casse donc rien. Un réseau marqué OT que la console a depuis supprimé lit mauvais avec ce motif, jamais un zéro silencieux. Un client que la console n'a jamais vu lit `online` 0 et le reste mauvais, en le disant.

Seuls les clients surveillés et liés reçoivent des tags `c.*`. Un réseau invité qui brasse 300 téléphones ne crée pas 300 jeux de tags.

### Lire sans interroger la console

`GET /api/unifi/{id}/networks`, `/clients` et `/known`, le tiroir et l'outil MCP `find_network_client` lisent tous la dernière lecture du pilote. Aucun ne fait de requête propre : un écran laissé ouvert, ou un agent qui interroge en boucle, ne coûte donc rien à la console et ne peut pas être la cause du 429. Le revers : un assistant `--mcp-stdio`, qui ne se connecte jamais, indique qu'il n'y a pas de lecture de console dans son processus.

## Les écrans

L'onglet UniFi a six vues et un sélecteur de console. Tout ce qu'il affiche est la dernière lecture de la console par le pilote : le laisser ouvert ne coûte rien à la console et ne peut pas être la cause d'un 429. Il réinterroge HotLoop toutes les quelques secondes et ne se redessine que si quelque chose a changé, si bien qu'une carte que quelqu'un a fait défiler dans un coin y reste.

- **Overview (Vue d'ensemble).** Une carte par console. En haut de celle d'une passerelle se trouve la bande WAN : un segment par WAN, vert quand le contrôle de santé de la passerelle dit qu'il est vivant, rouge sinon, celui qui porte le trafic étant entouré. Quand le site fonctionne sur un secours, toute la bande passe à l'ambre et dit lequel et depuis quand. Ce « depuis » est le moment où HotLoop l'a lu ainsi pour la première fois, pas celui où la passerelle a basculé, et un HotLoop démarré alors que le site était déjà sur la 5G le dit à partir de son propre démarrage. Nous n'imprimons pas une heure que nous n'avons pas. En dessous : appareils en ligne, clients filaires et sans fil, clients par réseau, les appareils perdus par la console et les derniers événements. Un WAN dont la console ne dit rien est gris et affiche « no liveness reported », jamais vert. Chaque WAN qui signale une latence a une courbe à côté du chiffre, la même ligne que dessinent les tuiles d'entité, tirée du tampon propre de HotLoop pour ce tag. Un administrateur dispose de **Create the usual alarms** en bas de la carte, voir [les alarmes de départ](#les-alarmes-de-départ).
- **Map (Carte).** De gauche à droite à partir de la passerelle. Elle est tracée de la même façon à chaque fois (un arbre net, sans physique, même lecture en entrée et mêmes pixels en sortie), donc elle ne tremble pas sur un écran mural. Les câbles sont la `downlink_table` de la console elle-même : un switch n'est branché sur un autre que parce que la console le dit. Un appareil que rien ne liste comme branché quelque part reste seul et affiche « no uplink listed ». Nous n'allons pas l'accrocher à la passerelle sur une supposition pour nous tromper ensuite sur le chemin du réseau de l'automate. Les clients filaires se placent sur le switch et le port où la console les a appris, les clients sans fil sur leur AP et leur SSID, comptés dans une pastille sur la carte. Cliquez sur un appareil et tout ce qui n'est pas en aval de lui s'estompe, et le panneau latéral liste ce qui l'est, ses clients, et les lignes de l'arbre Plant qu'il alimente : les appareils HotLoop liés à un client en dessous, chacun avec le chemin d'équipement où il se trouve. La carte zoome et se déplace : pincez avec deux doigts, faites glisser avec un, ctrl et molette ou le pincement d'un pavé tactile autour du pointeur, ou les boutons plus, moins et Fit, de la carte entière jusqu'à huit fois. C'est du SVG pur, donc elle reste nette à toute échelle, et l'endroit où vous la placez reste en place pendant l'actualisation de l'écran. Un glissement qui se termine sur un appareil ne le sélectionne pas. **Plant overlay** place les appareils HotLoop liés à un client dans un cadre en pointillés par ligne de l'arbre Plant, à droite du réseau et étiqueté avec le chemin de la ligne, chacun avec un câble vers le port du switch où il est branché, ce que le réseau dit de lui (actif, coupé ou non vu) et ce que HotLoop en dit. Un appareil lié mais sur aucune ligne se trouve dans un cadre nommé « Not on the Plant tree ». Il reste activé une fois que vous l'avez activé. Deux consoles forment une seule image : une machine d'une autre console que HotLoop lit et que cette console liste comme client filaire est dessinée ici avec son propre sous-arbre, en pointillés, marquée « separate console ». La carte s'exporte en SVG pour le classeur du site.
- **Devices (Appareils).** Un tableau, et un clic sur l'un donne sa face avant : les ports dessinés comme le panneau avant, une rangée pour un petit switch, deux pour 24 et 48 ports avec les impairs au-dessus des pairs. Vert pour une liaison, gris pour aucune, **rouge pour un port qui était actif et qui est tombé** (HotLoop se souvient qu'il était actif depuis qu'il a commencé à surveiller), pointillé pour un port désactivé, un éclair PoE (les watts sont dans l'infobulle et le détail du port), une flèche sur la liaison montante. Cliquez sur un port pour voir qui s'y trouve, ce qui y est branché, le mode PoE, les watts et le trafic, avec une courbe de ce qu'il a reçu et envoyé. Un appareil perdu par la console n'affiche ni chiffres ni liens de port, car ce qu'il a dit en dernier n'est plus d'actualité.
- **Clients.** Avec recherche par nom, MAC ou IP, avec où il se trouve, quand la console l'a vu pour la dernière fois, connu ou inconnu sur un réseau OT, et l'appareil HotLoop qui lui est lié. Les administrateurs acceptent un inconnu depuis la ligne.
- **Networks (Réseaux).** Le commutateur OT, par réseau, et « accepter tout en l'état ». Cela modifie l'enregistrement de HotLoop, pas la console.
- **WiFi.** Les SSID, s'ils émettent, sur quel réseau ils sont et combien de clients s'y trouvent. Si la console ne montre pas au compte ses réseaux sans fil, l'écran le dit au lieu de prétendre qu'il n'y en a aucun.

Les routes derrière tout cela sont `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` et `.../events`, documentées dans [L'API HTTP](/fr/iot/api/).

### Les alarmes de départ

Les alarmes qu'une usine veut sur son réseau avant que personne n'ait eu à y penser, créées à partir de ce que la console connaît maintenant. **Create the usual alarms** sur la vue d'ensemble (ou `POST /api/unifi/{id}/starter-alarms`, voir [l'API HTTP](/fr/iot/api/)) crée :

| Alarme | Sur | Priorité | Temporisation |
|---|---|---|---|
| un appareil hors ligne | `d.<mac>.online`, pour chaque switch, AP et passerelle adoptés | 2 | 60 s, pour qu'un redémarrage de micrologiciel n'alerte personne |
| une liaison montante coupée | `p.<mac>.<nn>.up` sur le port par lequel chaque appareil est branché à son amont | 1 | 10 s |
| une passerelle sur un WAN de secours | `d.<mac>.wan.failover`, pour une passerelle avec deux WAN ou plus | 2 | 30 s |
| un port PoE au-dessus d'une limite | `p.<mac>.<nn>.poe_w`, seulement quand vous donnez une limite en watts | 3 | 30 s |

Ce sont des définitions d'alarme ordinaires : mettez-les en attente, acquittez-les, envoyez-les vers Discord, modifiez la temporisation ou la limite, supprimez-en une. Appuyer de nouveau après avoir adopté d'autres équipements n'ajoute que les nouveaux, et un tag qui a déjà une alarme, faite à la main ou par un appui précédent, est laissé tranquille. L'alarme PoE prend une limite que vous donnez plutôt qu'une que HotLoop choisirait, car aucune console que nous lisons ne dit quel est le budget d'un port, et un chiffre que nous aurions deviné serait un chiffre auquel quelqu'un se fierait. « Unknown device on an OT network » et « a watched client off the network » ne sont pas dans le bouton : elles sont créées quand un réseau est marqué OT et quand un appareil est surveillé ou lié, avec l'enregistrement qui leur donne un sens.

## Événements

Le websocket d'événements de la console (`/proxy/network/wss/s/<site>/events` sous UniFi OS, `/wss/s/<site>/events` sur l'application auto-hébergée), sur la même session que tout le reste. Il ne se connecte jamais de son propre chef : une poignée de main refusée avec 401 passe par le même budget de connexion qu'une lecture, et une connexion refusée est attendue, pas retentée.

**L'interrogation reste la vérité.** Un événement n'écrit jamais un tag. Ce qu'il fait :

1. Il arrive dans le **journal** à l'instant où il est reçu, avec la phrase propre du contrôleur (« Switch[...] was disconnected ») et sa clé. Un switch qui tombe figure sur la chronologie quand cela arrive, pas quand l'interrogation suivante le remarque. Il est classé sous le switch, le point d'accès ou la passerelle concerné, pas sous l'appareil de la console elle-même, car la console est la machine où tourne le contrôleur et non ce qui est tombé. Un événement qui ne nomme qu'un client (la console dit qui s'est connecté, pas où) est classé sous le switch ou l'AP où la dernière lecture place ce client, et si le client est nouveau il attend la lecture que l'événement vient de demander, jusqu'à trente secondes, puis va sous la console si cette lecture ne l'a toujours pas. Le filtre **Where** du journal retrouve un événement depuis l'usine : un appareil HotLoop lié à son client, le switch où la console dit que ce client se trouve, et chaque switch entre là et la passerelle d'après la table de downlink de la console elle-même. Un switch tombé figure sur la chronologie de chaque ligne qu'il alimente et d'aucune autre. Demander la console elle-même fonctionne toujours comme avant : le journal système par `subject` égal à l'identifiant de la console, et le journal avec la console parmi les appareils de la portée, renvoient tous les événements de cette console, ceux de chaque switch compris.
2. Il entre dans le journal que montre la vue d'ensemble, et dans `site.last_event` et `d.<mac>.last_event`, de sorte qu'une automatisation peut se déclencher dessus.
3. Il demande tout de suite la lecture suivante. Le plancher de lecture est de dix secondes ; un événement le ramène à cinq, de sorte que les tags et les entités rattrapent leur retard à la prochaine interrogation au lieu de jusqu'à dix secondes plus tard. Un réseau WiFi chargé envoie un événement pour chaque téléphone qui passe, et la console n'est pas lue pour chacun d'eux.

Le contrôleur marque les événements qui signifient qu'un problème est survenu (`is_negative` : un switch qui perd le contact en est un, un client qui se déconnecte n'en est pas un), et ceux-là sont des avertissements dans le journal. Tout le reste est de l'information, y compris les clés que HotLoop n'a jamais vues.

**Un websocket mort coûte de la vitesse, jamais de l'exactitude.** Il se reconnecte avec une attente de deux secondes jusqu'à une minute. Il envoie des pings, et un flux qui ne répond rien pendant 90 secondes est mort quoi que dise le réseau : il est donc fermé puis rouvert. Pendant qu'il est tombé, `site.events_live` lit 0, la vue d'ensemble affiche « polling only » avec la raison, et l'interrogation continue exactement comme avant.
## Prises de PDU SmartPower

Une PDU SmartPower est adoptée dans la Network Application comme n'importe quel appareil, et son `outlet_table` crée les tags de ses prises, dans le même appareil. Une prise est `o.<mac>.<nn>.…` :

| Tag | Écriture | Ce que c'est |
|---|---|---|
| `o.<mac>.<nn>.on` | `true` ou `false` | Le relais de la prise. L'écrire commute la prise : le tableau `outlet_overrides` entier de la PDU est lu d'abord et renvoyé avec le seul changement (le PUT de la console remplace le tableau, si bien que le nom d'une prise serait perdu autrement). |
| `o.<mac>.<nn>.cycle` | `true` | Éteint la prise, attend cinq secondes, et la rallume. La prise est toujours rallumée, même si la requête est annulée en cours de route. Au plus une fois par 15 minutes, le même délai de repos que le cycle d'alimentation d'un port, tenu de la même façon. Lit 0. |
| `o.<mac>.<nn>.power_w`, `.current_a`, `.voltage_v`, `.pf` | | Ce que mesure la prise. |
| `d.<mac>.pdu_power_w` | | La consommation totale de la PDU, qui alimente le travail sur l'énergie. |

Une prise peut être une machine, donc rien ici n'en commute une sauf si une personne a armé ce tag, et chaque écriture passe par le sas. Le propre cycle de la prise (la récupération automatique de la PDU, `cycle_enabled`) n'est pas touché. Les tests de la PDU tournent contre une console qui garde l'état et accepte le PUT, et une console n'apprend la table de prises d'une PDU que par le propre inform de l'appareil, si bien que les tests le lui donnent ainsi.

## UniFi Protect

Un appareil à part, de protocole `unifi-protect`, parce que Protect a sa propre API et sa propre clé. Voir [Protocoles et drivers](/fr/iot/protocols/#unifi-protect) pour les tags, le flux d'événements et les écritures. L'Integration API est celle que documente la console (`/proxy/protect/integration/v1`, la clé dans l'en-tête `X-API-KEY`), et la clé se crée dans la page Integrations de la console ; elle peut être révoquée séparément, ce qui ne touche pas la connexion Network. Le certificat est épinglé comme pour l'appareil Network. Le mouvement des caméras demande le websocket d'événements : tant qu'il est coupé, le mouvement de la caméra lit mauvais et `site.events_live` lit 0. L'état propre des capteurs est dans l'enregistrement REST et reste bon.

## UniFi Access

Un appareil à part, de protocole `unifi-access`, avec son jeton d'API et le port 12445. Voir [Protocoles et drivers](/fr/iot/protocols/#unifi-access). Déverrouiller est une écriture comme une autre : une personne arme `door.<id>.unlock`, et le sas d'écriture et l'audit s'appliquent, depuis l'écran, une automatisation ou MCP indifféremment.

## Ce qui est vérifié

Le pilote UniFi et les écrans ont été exécutés contre de vraies Network Applications UniFi et de vraies consoles UniFi OS, en lecture seule avec un compte View Only, et sur du matériel réel le 2026-11-17 : la connexion et sa session unique, les tags d'appareil, de port, de PoE, de WAN et de client, le flux d'événements en direct et les écrans construits dessus.
