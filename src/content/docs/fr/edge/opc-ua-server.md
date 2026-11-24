---
title: "Le serveur OPC UA"
description: "Publiez les appareils et tags configurés sous forme d'espace d'adressage OPC UA en lecture seule : votre SCADA voit chaque tag sans nouveau pilote."
---

Le serveur OPC UA de HotLoop, depuis la version 4.13.0, publie les appareils et les tags configurés dans le Gateway sous forme d'espace d'adressage OPC UA. Un client OPC UA tiers, un logiciel SCADA, un IHM, un historien ou un outil de test comme UaExpert peut ainsi lire les tags en direct du Gateway sans que personne n'écrive de pilote HotLoop pour l'autre côté.

Activé par défaut (`HOTLOOP_OPCUA_SERVER_ENABLED`), dans le binaire et dans le chart Helm. Il démarre avec l'authentification HotLoop activée et un identifiant qui lui est propre, `opcua-reader`, que HotLoop crée avec un mot de passe généré que les Paramètres montrent à un administrateur (`GET /api/opcua/server`) ; il peut lire les tags et les valeurs, rien de plus. Avec l'authentification HotLoop désactivée, il n'y a aucun utilisateur avec qui se connecter, donc le serveur reste en attente et le signale (il ne refuse pas de démarrer). Si un autre serveur OPC UA de la machine occupe déjà le 4840, il reste en attente et le signale ; un port que vous avez choisi et qui ne peut pas être ouvert est une erreur : ouvrir un listener sur un réseau d'usine est une décision qu'un déploiement prend en connaissance de cause. Port par défaut 4840.

**Il est en lecture seule.** Voir [Pourquoi il est en lecture seule](#pourquoi-il-est-en-lecture-seule). Il sert aussi l'historique de chaque tag : voir [Historique](#historique).

## Ce qui est exposé

Un nœud **Object** par appareil activé, directement sous le dossier standard *Objects*, et un nœud **Variable** par tag activé sous son appareil. Les appareils et les tags désactivés ne sont pas publiés : ils n'ont ni worker ni lecture, et les publier ne ferait que mettre devant un client un nœud Bad permanent. L'espace d'adressage correspond exactement à ce que le runtime interroge.

Tout vit dans un seul espace de noms, `urn:hotloop:ua:gateway`. L'URI de l'espace de noms est une constante, qui ne dérive ni du nom d'hôte ni de l'URI de l'application : un client enregistre un nœud sous la forme URI plus identifiant et retrouve l'indice de l'espace de noms à chaque connexion, et un URI qui changerait avec le nom d'un pod rendrait orpheline chaque souscription configurée dans un projet SCADA. Résolvez l'indice à partir du tableau d'espaces de noms du serveur, par URI, comme le fait un vrai client ; ne présumez pas `ns=2`.

### NodeIds

Les identifiants sont des chaînes de caractères, et ils sont stables :

| Nœud | Identifiant NodeId |
|---|---|
| Appareil | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Propriété `EngineeringUnits` / `EURange` d'un tag | `~EngineeringUnits/<deviceId>/<tagName>` et `~EURange/…` |

La forme du tag est `model.TagKey.String()`, l'écriture `device/tag` que le reste du code utilise déjà : un NodeId et une clé de tag se convertissent donc l'un en l'autre avec `model.ParseTagKey`. Un séparateur `.` n'aurait pas fonctionné : les ids d'appareil peuvent contenir des points, de sorte que `a.b.c` pourrait être l'appareil `a` avec le tag `b.c`, ou l'appareil `a.b` avec le tag `c`. Un id d'appareil ne peut pas contenir de barre oblique, donc la première barre est toujours la frontière, et un nom de tag qui contient des barres (c'est le cas des chemins de navigation OPC UA et des topics MQTT) retombe toujours sur le bon appareil. Les ids de propriété commencent par `~`, ce qu'un id d'appareil ne peut pas faire, si bien qu'une propriété ne peut jamais entrer en collision avec un tag, quel que soit son nom.

### Attributs

| Attribut | Valeur |
|---|---|
| `BrowseName` | l'id de l'appareil / le nom du tag, dans l'espace de noms HotLoop |
| `DisplayName` | le nom de l'appareil / le nom du tag |
| `Description` | la description de l'appareil ou du tag |
| `DataType` | voir ci-dessous |
| `ValueRank` | scalaire (-1) |
| `AccessLevel`, `UserAccessLevel` | `CurrentRead` uniquement (0x01) |
| `MinimumSamplingInterval` | l'intervalle d'interrogation effectif de l'appareil en ms ; les valeurs ne peuvent pas changer plus vite que le runtime ne les interroge, donc un client qui demande une fréquence d'échantillonnage plus rapide la voit relevée à cet intervalle |
| `Historizing` | false |

Un tag avec une unité reçoit une propriété `EngineeringUnits` (`EUInformation`, id d'unité -1 = « pas un code UNECE », le texte de l'unité dans `DisplayName`), et un tag avec une plage reçoit une propriété `EURange`. Un tag sans l'une ni l'autre n'en a aucune.

### Types de données

Le runtime ramène toute lecture numérique à un float64 en unités d'ingénierie : le type déclaré est donc un choix de présentation fait dans `kindForTag`, et il doit être un type dans lequel la valeur peut toujours s'exprimer :

| `dataType` du tag | Type OPC UA |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (le plus large des types signés, pour que rien ne déborde) |
| tout le reste, y compris `float` | Double |
| **tout type entier avec une échelle ou un décalage** | **Double** |

La dernière ligne compte : un registre `int16` mis à l'échelle de 0,1 lit 23,4, et le tronquer en Int16 donnerait au client un 23 avec un statut Good. Une valeur qui ne tient pas dans son type déclaré, un tag `int16` qui livre 70000, est signalée `BadOutOfRange` sans valeur, jamais enroulée ni écrêtée en quelque chose qui a l'air plausible. Un tag numérique dont la lecture contient du texte est `BadTypeMismatch`.

### Valeur, qualité et horodatages

Chaque lecture (et chaque échantillon de souscription) est servie depuis le cache en direct du runtime, la même source que `/api/values`, jamais depuis la base de données. Le code de statut est déduit de cette lecture **et de l'état de la liaison de l'appareil qui se trouve derrière**, parce que le cache seul ne suffit pas : il garde la dernière lecture qu'un appareil a renvoyée, et un appareil qui a quitté le réseau depuis garde une dernière lecture parfaitement bonne en apparence.

| Liaison de l'appareil | Lecture | Statut | Valeur |
|---|---|---|---|
| Connecté, au moins une interrogation livrée pendant cette session | bonne | **Good** | envoyée |
| | incertaine | Uncertain | envoyée |
| | mauvaise, ou qualité non reconnue | Bad | aucune |
| Connecté, aucune interrogation livrée pendant cette session | quelconque | BadWaitingForInitialData | aucune |
| Connecté, rien du tout en cache | n/a | BadWaitingForInitialData | aucune |
| Dégradé (session active, interrogations en échec ou partielles) | bonne | **UncertainLastUsableValue** | envoyée |
| | incertaine | Uncertain | envoyée |
| | mauvaise | Bad | aucune |
| Déconnecté, en cours de connexion, désactivé | quelconque | **BadNoCommunication** | aucune |
| Aucun worker pour l'appareil | quelconque | BadOutOfService | aucune |
| Tag ou appareil supprimé | n/a | BadNodeIdUnknown | aucune |

Good n'est jamais signalé que pour un appareil connecté, sur une interrogation de la session en cours, dont la lecture est bonne. Un tag d'un appareil déconnecté lit Bad, pas sa dernière valeur avec un statut Good.

L'ancienneté n'entre volontairement pas en compte. Les sources pilotées par événements (un tag MQTT/Sparkplug, une souscription OPC UA) peuvent légitimement garder une valeur pendant des heures parce que rien n'a changé, et la déclarer périmée d'après l'horloge serait faux ; savoir si un appareil livre encore des données relève de la liaison.

L'**horodatage source** est l'horodatage propre de la lecture, le moment où l'appareil a été entendu pour la dernière fois, et il est signalé même avec un statut Bad. L'**horodatage serveur** est le moment où la lecture a reçu sa réponse. Les deux sont en UTC.

## Souscriptions

Les clients peuvent créer des souscriptions et des éléments surveillés sur les variables de tags et recevoir des notifications de changement de données, ce qui est la façon dont les clients SCADA consomment réellement les tags. Dans cette bibliothèque, la surveillance se fait par échantillonnage : le serveur lit chaque élément surveillé à son intervalle d'échantillonnage (au moins 100 ms, et au moins l'intervalle d'interrogation de l'appareil) par le même gestionnaire qu'une lecture, et notifie quand la valeur ou le statut change. Un changement de *qualité*, un appareil qui tombe, est donc annoncé de la même façon qu'un changement de valeur.

Un élément surveillé sur un tag supprimé n'est pas laissé en suspens : il reçoit `BadNodeIdUnknown`.

## Ce que voit un client pendant que la configuration change

Quand un tag est supprimé, les lectures et les éléments surveillés qui le visent reçoivent `BadNodeIdUnknown` aussitôt, et il disparaît aussitôt de la navigation de son appareil. Le nœud lui-même reste dans la table des nœuds du serveur pendant environ 5 secondes, inaccessible, puis est supprimé. Un appareil supprimé fonctionne de la même façon sous le dossier Objects.

Une modification ne laisse jamais de trou. Un tag ou un appareil modifié est remplacé par sa nouvelle version sous le même NodeId en une seule étape : une lecture ou une navigation à cet instant voit l'ancienne version ou la nouvelle, jamais « inconnu ». Les souscriptions dessus continuent.

Le délai avant suppression n'est pas décoratif. Le Browse de la bibliothèque lit la liste de références d'un nœud puis cherche chaque cible sans tenir de verrou entre les deux, et si une cible a disparu entre-temps, il fait échouer la navigation du *parent* avec `BadNodeIdUnknown`, comme si l'appareil ou le dossier Objects n'existait pas. Nous supprimions autrefois les nœuds d'un coup, et un client qui parcourait un appareil pendant qu'un tag était supprimé, ou qui lisait un tag pendant qu'on modifiait son appareil, pouvait s'entendre dire qu'un nœud bien réel n'existait pas.

## Pourquoi il est en lecture seule

Cette incrémentation n'implémente pas l'écriture, et le dit à trois endroits à la fois pour qu'aucun changement isolé ne puisse l'ajouter discrètement :

- chaque nœud publié a `AccessLevel = CurrentRead | HistoryRead` et aucun gestionnaire d'écriture n'est installé, donc une écriture est refusée avec `BadNotWritable` et un client peut voir avant d'essayer que le nœud n'est pas inscriptible ;
- les tests écrivent sur un tag en tant que viewer, operator et admin, et vérifient que la réponse est `BadNotWritable` **et que le registre de l'appareil derrière le tag n'a pas changé**.

Un chemin d'écriture OPC UA devrait passer par cette porte, porter son principal jusqu'à la piste d'audit et respecter l'interrupteur général. C'est un changement qui mérite sa propre revue, pas quelque chose qui arrive en sous-produit de la publication des tags, et il n'existe volontairement aucun réglage dans cette version pour l'activer.

## Historique

Chaque nœud de tag est historisé et porte le niveau d'accès HistoryRead. Le serveur répond au service HistoryRead d'OPC UA à partir de l'historique propre de HotLoop, les mêmes lectures que sert `/api/history`, de sorte qu'un client à l'autre bout d'une connexion OPC UA lit ce que le Gateway a conservé sans seconde base de données. Un utilisateur a besoin de ce que demande une lecture de valeur (`tags.read` et `values.read`), vérifié comme pour une lecture de valeur, pour l'utilisateur de la session, et pas une seule fois à l'ouverture de session.

- **Raw** (`ReadRawModifiedDetails`) : les lectures d'une fenêtre, chacune avec sa propre qualité comme statut et son propre horodatage. Un début antérieur à la fin lit vers l'avant et un début postérieur à la fin lit vers l'arrière, de la plus récente à la plus ancienne. Le début est inclus et la fin exclue (OPC UA 10000-11, section 4.6), sauf si le client demande les bornes : on ajoute alors la lecture au début ou juste avant, et la première lecture hors de la fenêtre à la fin. `NumValuesPerNode` est le nombre de valeurs qu'un appel renvoie pour un nœud ; au-delà, ou au-delà de 10 000, elles arrivent par pages, chacune avec un point de continuation valable cinq minutes et à usage unique (1 000 au plus sont conservés en même temps). Une fenêtre sans rien est `Good_NoData`. L'historique modifié est refusé (`BadHistoryOperationUnsupported`) : ici, rien n'est jamais modifié ni supprimé.
- **Processed** (`ReadProcessedDetails`) : Average, Minimum, Maximum, Count, Start, End et Total, sur des intervalles de `ProcessingInterval` à partir de l'heure de début, selon la règle de qualité (README, « The quality rule ») : seules les bonnes lectures à nombre fini comptent. Un intervalle qui n'en a aucune est `Good_NoData` (Count dit 0), et un intervalle dont des lectures ont été écartées lit `Uncertain_DataSubNormal`, si bien que le nombre n'est jamais meilleur que ce qu'il contenait. Un autre agrégat est refusé pour ce nœud (`BadAggregateNotSupported`), un tag de type texte n'en a aucun, et une fenêtre de plus de 10 000 intervalles ou de 500 000 lectures est refusée (`BadTooManyOperations`) plutôt que tronquée. Seule une fenêtre vers l'avant avec ses deux bornes reçoit une réponse.
- **At time** (`ReadAtTimeDetails`) : ce que le tag valait à chaque instant, c'est-à-dire sa dernière lecture à cet instant ou avant, horodatée de l'instant demandé. Il n'interpole jamais, parce qu'une lecture est une valeur que quelqu'un a prise ; un instant antérieur à la première lecture du tag donne `Bad_NoData`.
- Les **événements** ne sont pas servis : `BadHistoryOperationUnsupported`. Un appareil ou tout autre objet n'a pas d'historique non plus, et un nœud de propriété (`EngineeringUnits`, `EURange`) ne porte pas HistoryRead.

L'historien conserve une lecture quand elle franchit la bande morte, pas à chaque interrogation, donc un tag calme a peu de lignes : lisez At time, ou une fenêtre Processed autour de la dernière lecture d'un tag, quand vous avez besoin de ce qu'il valait et pas seulement du moment où il a changé. `HistoryServerCapabilities` indique que l'historique peut être lu et qu'un appel renvoie au plus 10 000 valeurs.

## Santé de la machine, pour le tableau de bord EmberNet

Le Gestionnaire des tâches du tableau de bord lit le processeur, la mémoire, le disque et la gigue temps réel d'une machine depuis la machine elle-même : HotLoop les publie comme un appareil et le serveur sert leur historique ([Historique](#historique)), si bien que le tableau de bord ne lit jamais sa propre base de données pour cela. Ce qui est construit, et comment l'activer :

* **L'appareil.** Avec `HOTLOOP_BOX_HEALTH_NODE` défini (le chart le fixe au nom du nœud Kubernetes), HotLoop crée un appareil dont l'id est exactement ce nom, avec le protocole `boxhealth` ([Protocoles et pilotes](/fr/iot/protocols/#santé-de-la-machine)). Ses tags sont `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (le disque propre de la machine), `data_util_pct` (le volume où HotLoop garde ses données) et, seulement quand `HOTLOOP_BOX_HEALTH_JITTER_FILE` désigne le fichier JSON qu'écrit un agent temps réel, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` et `rtos_jitter_core3_us`. Leurs ids de nœud OPC UA sont dans l'espace de noms `urn:hotloop:ua:gateway` avec l'identifiant de type chaîne `<device id>/<tag>`.
* **Les chiffres de la machine.** Le chart monte la racine de l'hôte sur `/host` et son `/proc` sur `/host/proc`, tous deux en lecture seule, et définit le nom du nœud, **par défaut** (`opcuaServer.dashboard.boxHealth.enabled: true`), si bien que le Gestionnaire des tâches du tableau de bord fonctionne dès l'installation de HotLoop. Seuls un statfs de `/host` et les compteurs de processeur et de mémoire sont lus, et aucun privilège n'est ajouté. Un cluster qui applique le profil restreint de Pod Security refuse un hostPath : dans ce cas, mettez `enabled: false` (ni appareil ni montages) ou `hostMount: false` (l'appareil, mais le disque et le processeur de la machine lisent Bad et disent ce qu'il faut monter). L'appareil n'a pas besoin du serveur OPC UA.
* **Un compte qui peut lire et rien d'autre.** Le chart crée l'utilisateur `embernet-dashboard-read` avec exactement `tags.read` et `values.read` (une liste explicite d'autorisations, jamais un rôle) à la première installation, et garde son mot de passe généré dans le Secret `<release>-opcua-dashboard` (clés `username`, `password` et `password-hash`). Une mise à niveau ne le renouvelle jamais. Un compte qui existe n'est jamais modifié par un redémarrage.
* **Le certificat du tableau de bord.** Le tableau de bord crée le Secret `<release>-opcua-trust`, une clé par certificat nommée `<sha1 thumbprint>.crt`. Le chart le monte, en option, sur `/etc/hotloop/opcua-trust`, et le serveur garde ces fichiers dans `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`) : au démarrage et toutes les 30 secondes, un nouveau fichier est ajouté, un fichier modifié est réécrit, et un fichier qui quitte le Secret est de nouveau retiré. Un fichier qu'un opérateur a placé dans `trusted/` n'est jamais touché, et l'emporte sur une clé du Secret du même nom.
* **Le port.** Le Service propre de la release (celui que découvre le tableau de bord) liste le port OPC UA 4840 quand le serveur est activé, à côté du Service propre du serveur OPC UA.

Le serveur reste ce qu'il était : Basic256Sha256 SignAndEncrypt, pas de sessions anonymes, pas de confiance aveugle.

## Modèle de sécurité

### Transport

Les canaux sécurisés utilisent les politiques de la bibliothèque en Sign et SignAndEncrypt. **`Basic256Sha256` est proposée dans les deux modes**, et c'est celle qu'un client devrait choisir.

**La politique de sécurité None est un choix explicite** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, false par défaut), avec un avertissement au démarrage quand elle est activée. Désactivée, aucun endpoint None n'est annoncé, et un client qui ouvre quand même un canal None ne peut faire que de la découverte : tous les autres services sont refusés. Même activée, un nom d'utilisateur et un mot de passe voyagent toujours dans un jeton chiffré (la politique du jeton est `Basic256Sha256`, jamais None), même si toutes les valeurs que le client lit ensuite sont sans protection.

**Les politiques obsolètes sont désactivées par défaut.** L'OPC Foundation a déclaré obsolètes `Basic128Rsa15` (RSA avec bourrage PKCS#1 v1.5) et `Basic256` (SHA-1). Dans les versions précédentes, les deux étaient proposées dans chaque liste d'endpoints sans moyen de les retirer. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart : `opcuaServer.allowDeprecatedPolicies`, `false` par défaut) en décide :

- **Désactivé (le défaut, pour les nouvelles installations et les mises à niveau).** Aucune des deux politiques ne figure dans un endpoint annoncé à un client, et un client qui ouvre un canal sécurisé avec l'une d'elles est refusé à l'ouverture du canal, avant toute session ou connexion. Les clients en `Basic256Sha256`, `Aes128_Sha256_RsaOaep` ou `Aes256_Sha256_RsaPss` ne sont pas concernés.
- **Activé.** Les deux sont de nouveau proposées en Sign et SignAndEncrypt, pour un ancien client qui ne parle rien de plus récent, avec un avertissement au démarrage. Ne l'activez que jusqu'à la mise à jour de ce client.

Un client qui ne se connecte plus après la mise à niveau et qui utilise l'une de ces deux politiques voit le canal refusé ; activez le réglage, ou passez le client à `Basic256Sha256`.

### Certificat du serveur

Si `HOTLOOP_OPCUA_SERVER_CERT_FILE` et `_KEY_FILE` sont définis, cette paire RSA est utilisée telle quelle. Sinon, un **certificat d'instance d'application autosigné est généré au premier démarrage et conservé** sous `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, clé en mode 0600), si bien que le démarrage suivant présente le même certificat et qu'un client à qui l'on a dit une fois de lui faire confiance n'est pas prévenu de nouveau. Un avertissement est journalisé à chaque démarrage tant que le certificat est autosigné, avec son empreinte SHA-1, la forme qu'affichent les outils OPC UA, pour qu'un opérateur puisse la comparer à ce qu'affiche un client.

Le certificat dit ce que vérifient les clients OPC UA, ce qu'un certificat TLS ordinaire ne fait pas : l'**URI d'application** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, par défaut `urn:hotloop:gateway`, plus `:<siteId>` quand il y en a un) dans les noms alternatifs de sujet de type URI, les noms d'hôte et adresses qu'utilisent les clients (l'hôte de l'endpoint, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, la boucle locale, le nom d'hôte de cette machine) comme SAN DNS et IP, et les usages de clé que la Partie 6 énumère pour une instance d'application. RSA-2048, cinq ans.

Un certificat conservé n'est remplacé, avec un avertissement que les clients doivent faire confiance au nouveau, que s'il ne peut plus remplir son rôle : moins de 30 jours restants, un URI d'application qui ne correspond plus à la configuration, un hôte configuré qu'il ne couvre pas, ou une clé illisible.

**Le nom d'hôte de la machine n'est pas un hôte configuré.** Il entre dans un nouveau certificat, mais un certificat conservé est gardé quand le nom d'hôte change. Dans un conteneur, le nom d'hôte est l'id du conteneur, et dans Kubernetes c'est le nom du pod, donc il change à chaque redéploiement. Tant que cela n'était pas corrigé, il comptait, et chaque mise à niveau d'un Gateway conteneurisé créait un nouveau certificat : Ignition, à qui l'on avait dit de faire confiance à l'ancien, refusait le serveur avec `Bad_SecurityChecksFailed` jusqu'à ce que quelqu'un lui refasse confiance, sur chaque client, après chaque déploiement. Les clients joignent le serveur par `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` et `_CERT_HOSTS` ; définissez-les, et le certificat vit jusqu'à l'approche de son expiration. (Un Gateway sans hôte d'endpoint défini utilise le nom d'hôte de la machine comme hôte d'endpoint, et celui-là compte, puisque c'est ce qu'on dit aux clients. Une raison de plus de le définir.)

**Une clé peut être inutilisable, et le serveur la refuse.** Environ une clé RSA sur vingt ne peut pas porter une connexion OPC UA chiffrée, et chaque connexion chiffrée avec cette clé échoue alors, à chaque fois, le client voyant seulement « le canal sécurisé a été fermé ». Les sessions anonymes et non chiffrées ne sont pas touchées, ce qui rend le diagnostic facile à manquer. Une clé générée est retirée jusqu'à ce qu'elle ne soit pas de celles-là ; une clé fournie par un opérateur qui en est une est refusée au démarrage avec une erreur qui en donne la raison.

### Certificats d'application des clients

OPC UA authentifie l'application autant que l'utilisateur. Le serveur tient une liste de confiance dans `<PKI_DIR>/trusted/` : un client dont le certificat n'y figure pas est refusé au niveau du canal sécurisé, et son certificat est écrit dans `<PKI_DIR>/rejected/`. **Pour approuver un client, déplacez son certificat de `rejected/` vers `trusted/`**, sans redémarrage ; le dossier est relu à chaque connexion. `<PKI_DIR>/issuers/` et `<PKI_DIR>/crl` sont transmis tels quels pour les certificats clients émis par une autorité.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (false par défaut, avec un avertissement au démarrage) saute cette étape. Il ne supprime que l'authentification de l'application : un utilisateur doit toujours s'authentifier avec un nom d'utilisateur et un mot de passe HotLoop.

### Qui peut se connecter

**Nom d'utilisateur et mot de passe, contre les utilisateurs propres de HotLoop.** Il n'y a qu'une base d'utilisateurs, pas un second magasin d'identifiants : l'authentificateur cherche l'utilisateur avec le même `store.User` que la connexion HTTP, compare avec les mêmes hachages bcrypt (`auth.CheckPassword`), normalise le nom d'utilisateur de la même façon (minuscules, sans espaces aux extrémités), exécute une comparaison bcrypt que l'utilisateur existe ou non pour que le temps de réponse ne révèle pas quels noms sont réels, et refuse un compte désactivé. Utilisateur inconnu, mauvais mot de passe, utilisateur désactivé et utilisateur sans l'autorisation reçoivent tous la même réponse, `BadUserAccessDenied`.

**Un utilisateur ne peut lire des tags que si son rôle accorde `tags.read` et `values.read`**, la même paire qui protège `/api/tags` et `/api/values` dans l'API HTTP, résolue par les mêmes `auth.Permissions` et `auth.Allows`, si bien qu'un rôle intégré et une liste explicite d'autorisations se comportent exactement comme là-bas. Les deux sont exigées parce qu'un client OPC UA parcourt la liste des tags et lit les valeurs par une seule connexion, et qu'un utilisateur qui n'aurait que l'une des deux obtiendrait l'autre gratuitement. Tout rôle intégré qui a `values.read` a aussi `tags.read` ; cela ne joue que pour un utilisateur doté d'une liste explicite d'autorisations.

**Les autorisations sont vérifiées à l'usage, pas seulement à la connexion.** La bibliothèque demande les rôles d'une session à chaque navigation, lecture et échantillon de souscription ; ils sont fournis par un cache de courte durée (10 s) de la base d'utilisateurs. Un utilisateur désactivé, supprimé ou privé d'autorisations perd l'accès sur une session active dans cet intervalle, ses éléments surveillés passant à Bad, et non au moment où son client se reconnecte. Une recherche qui échoue compte pour « non ».

**Les sessions anonymes sont désactivées** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`) et aucun jeton anonyme n'est proposé sauf si on l'active, avec un avertissement au démarrage. Les jetons d'identité utilisateur X.509 sont aussi désactivés, et proposés quand `HOTLOOP_OPCUA_SERVER_ALLOW_X509` est défini (voir [Certificats utilisateur X.509](#certificats-utilisateur-x509)). Si l'authentification propre de HotLoop est désactivée (`HOTLOOP_AUTH_INSECURE`), il n'y a aucun utilisateur avec qui se connecter, et le serveur refuse de démarrer sauf si l'accès anonyme est activé.

Une connexion réussie est consignée dans le journal système comme une connexion HTTP. Les connexions échouées sont consignées uniquement dans le journal du processus, avec la raison, pour qu'un appelant non authentifié ne puisse pas remplir la piste d'audit. Au plus quatre vérifications de mot de passe tournent en même temps, car chacune est une comparaison bcrypt volontairement lente et OPC UA n'a pas d'équivalent du limiteur de débit placé devant HTTP ; au-delà, il n'y a ni verrouillage ni limite de débit, comme pour la connexion HTTP.

La bibliothèque garde l'identité utilisateur déchiffrée, mot de passe compris, dans l'objet de session tant que la session vit. Elle n'est qu'en mémoire et n'est jamais journalisée, mais un vidage mémoire d'un Gateway en fonctionnement contiendrait les mots de passe des utilisateurs alors connectés.

**Les mots de passe de toute longueur acceptée par HotLoop, jusqu'à 72 octets (la limite de bcrypt), peuvent se connecter.** Dans les versions précédentes, un mot de passe de 65 à 72 octets pouvait ouvrir une session dans l'interface web et pas ici (`BadIdentityTokenRejected`). La longueur comptait le mot de passe plus le nonce serveur de 32 octets, si bien que le mot de passe plafonnait à 64 octets. Rien dans RSA ni dans la spécification ne l'exige : le jeton est chiffré en autant de blocs qu'il en faut et le décodeur les lit déjà tous. La vérification est désormais que la longueur soit d'au moins 32 et d'au plus les octets réellement déchiffrés, ce que la vérification devait garantir, puisqu'elle dimensionne le tampon créé ensuite. Une longueur qui annonce plus que ce qui est arrivé est toujours refusée, donc un client ne peut pas faire allouer au serveur ce qu'il n'a pas envoyé. La branche `main` amont (vérifiée le 2026-11-16) a encore ce plafond ; le changement est proposé en amont sous forme de pull request depuis HotLoop-io/opcua.

### Certificats utilisateur X.509

Un client peut se connecter avec un certificat au lieu d'un mot de passe. Désactivé par défaut : définissez `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`), et le serveur propose le jeton utilisateur Certificate sur ses endpoints sécurisés et l'indique au démarrage. Sans cela, aucun endpoint n'en propose et une connexion par certificat est refusée.

**Comment un certificat est associé à un utilisateur.** Un admin attache le certificat à un utilisateur HotLoop : Paramètres, Certificats OPC UA, Attacher un certificat (ou l'API, `POST /api/users/{username}/certificates`, ou l'outil MCP `add_user_certificate`). Le registre garde le certificat public, son empreinte SHA-256, qui l'a attaché et quand, s'il est révoqué, et quand il s'est connecté pour la dernière fois. Un client qui le présente et prouve qu'il détient la clé privée se connecte **en tant que cet utilisateur**. Rien d'autre n'est configuré et rien dans le certificat lui-même n'est approuvé : le nom commun n'est pas regardé, il n'y a pas d'autorité à exploiter, et un certificat que personne n'a attaché ne fait rien.

**Ce que porte le jeton.** Un client peut envoyer son certificat suivi de ceux qui l'ont émis ; le premier est le certificat qui a été attaché, et les autres sont ignorés.

**Preuve de la clé.** La bibliothèque vérifie la signature du jeton sur le certificat du serveur et le nonce de session, que seul le détenteur de la clé privée peut produire ; un certificat présenté avec la signature d'une autre clé est refusé.

**Ce qu'il peut faire.** Exactement ce que peut faire l'utilisateur. La connexion exige que l'utilisateur soit activé et détienne `tags.read` et `values.read`, la même paire qu'une connexion par mot de passe, et la session est vérifiée toutes les 10 secondes comme l'une d'elles : un utilisateur désactivé ou privé de l'autorisation perd une session active par certificat dans cet intervalle. Elle est en lecture seule comme toute session ici ; une session par certificat ne peut pas écrire, quel que soit le rôle de l'utilisateur.

**Refusé, avec la raison dans le journal.** Un certificat qui n'est pas enregistré, est révoqué, a expiré, n'est pas encore valide, ou dont l'utilisateur n'existe plus, est désactivé ou n'a pas l'autorisation, reçoit `BadUserAccessDenied`, la même réponse pour tous, si bien qu'un client n'apprend rien sur la cause. La raison va dans le journal du processus et la piste d'audit.

**Révoquer.** Révoquez-le sur le même écran (ou avec `POST .../{thumbprint}/revoke`). Il cesse de se connecter aussitôt et une session ouverte avec lui prend fin en 10 secondes. Un certificat révoqué reste listé, avec qui l'a révoqué et quand, pour qu'une connexion refusée indique « révoqué » et non « inconnu » ; supprimez-le pour l'oublier. Les sauvegardes emportent le registre, révocations comprises.

**Audit.** Chaque connexion par certificat est une entrée du journal (catégorie auth) qui nomme l'utilisateur, l'empreinte et le sujet du certificat, et l'application cliente. Chaque refus en est une aussi, avec la raison. Un client qui retente le même refus écrit une entrée par minute pour ce certificat et cette raison, pas une par essai ; chaque refus figure quand même dans le journal du processus. Attacher, révoquer et supprimer un certificat sont des entrées qui indiquent qui l'a fait. La clé privée n'est dans aucune d'elles, et HotLoop n'en possède jamais : seuls des certificats publics sont envoyés ou conservés.

**Pas la liste de confiance des applications.** Un certificat d'application client dans `<PKI_DIR>/trusted/` permet au client d'ouvrir un canal sécurisé ; ce n'est pas une connexion. Un certificat utilisateur est un autre objet : celui d'une personne, attaché à un utilisateur. Un même certificat peut servir aux deux côté client, mais le serveur les traite comme deux actes.

**Le client propre de HotLoop** se connecte aussi de cette façon : voir `userCertificate` et `userPrivateKey` dans [Protocoles et pilotes](/fr/iot/protocols/#opc-ua).

Non construit : une autorité de certification à laquelle on ferait confiance pour se porter garante des certificats clients, et une règle de nommage qui les associe aux utilisateurs. Le registre couvre une usine qui attache ses certificats clients un par un ; une autorité s'ajouterait à lui, elle ne le remplacerait pas.

**RsaEncryptedSecret, le format qu'OPC UA demande au-delà de 64 octets.** OPC 10000-4 7.40.4 dit qu'un client chiffre un mot de passe de plus de 64 octets sur une politique de sécurité RSA sous forme de RsaEncryptedSecret (7.40.2.4), et non dans l'ancien format. Le client propre à l'OPC Foundation fait exactement cela, et le client OPC UA de HotLoop aussi désormais. Le serveur lit les deux. Il regarde d'abord le début du jeton : un RsaEncryptedSecret est vérifié pour sa politique de sécurité, son certificat, son heure de signature, sa signature, son bourrage et le nonce de la session, et ne livre le mot de passe que si tout est correct ; tout le reste va à l'ancien décodeur, de sorte qu'un client qui envoie l'ancien format au-delà de 64 octets se connecte toujours. Toutes les politiques RSA sont couvertes, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` et `Aes256_Sha256_RsaPss`, ainsi que `Basic128Rsa15` et `Basic256` lorsqu'elles sont activées. C'est éprouvé face au Reference Server et au ConsoleReferenceClient de l'OPC Foundation (UA-.NETStandard 2.0.2) dans les deux sens, avec un utilisateur dont le mot de passe fait 10, 64, 65, 72, 100 et 200 octets.

### Les diagnostics du serveur sont retirés

Les nœuds de diagnostic par session de la bibliothèque permettraient à tout utilisateur connecté de parcourir le nom d'utilisateur et l'adresse client de toutes les autres sessions ; ils sont donc désactivés, et l'objet `Server/ServerDiagnostics` est retiré de l'espace d'adressage (la bibliothèque écrit aussi ses compteurs sans verrou).

## Changements de l'espace d'adressage à l'exécution

Les appareils et les tags sont ajoutés, modifiés et supprimés pendant que le Gateway fonctionne, et l'espace d'adressage suit sans redémarrage. **Mécanisme : un rappel du runtime, plus un minuteur comme filet de sécurité.**

- `runtime.Manager.OnReload` rappelle après chaque `Reload` réussi. Toute mutation d'appareil ou de tag faite par l'API se termine par un `Reload`, donc un changement fait par l'interface ou l'API est publié en quelques instants. Le rappel ne fait que signaler une goroutine de réconciliation ; il ne fait jamais le travail lui-même, si bien qu'une réconciliation lente ne peut pas bloquer la requête d'API qui l'a déclenchée.
- Une réconciliation périodique (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, 30 s par défaut) rattrape tout ce qui change la configuration sans `Reload`.

Les deux exécutent la même différence idempotente contre les appareils et tags activés de la base de données. Elle ne touche que ce qui diffère : un tag modifié est remplacé, un tag supprimé est retiré, et tout le reste, y compris les éléments surveillés que les clients tiennent dessus, reste exactement comme il était. Les nœuds d'un nouvel appareil entrent dans l'espace en un seul appel, donc un client qui navigue pendant une réconciliation voit un appareil avec tous ses tags ou aucun.

Un rappel a été préféré à l'interrogation seule parce que le runtime a déjà le signal propre (`Reload`) et qu'il rend un changement visible en millisecondes au lieu de jusqu'à un intervalle complet ; le minuteur reste parce que l'espace d'adressage ne doit pas dépendre du fait que chaque futur auteur de configuration pense à recharger.

## Connecter un client

L'endpoint est `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. Dans un cluster, le chart prend par défaut comme hôte le nom DNS du Service de la release ; en dehors, définissez le nom ou l'adresse que les clients utiliseront vraiment (une adresse LoadBalancer, un enregistrement DNS) : il est annoncé dans chaque URL d'endpoint et écrit dans le certificat généré. Ce n'est **pas** l'adresse sur laquelle le serveur écoute : la bibliothèque écoute sur toutes les interfaces et ne prend qu'un port.

Avec UaExpert ou tout autre client :

1. Ajoutez le serveur avec cette URL et choisissez `Basic256Sha256` / `Sign & Encrypt`.
2. Choisissez *Username*, et connectez-vous avec un utilisateur HotLoop qui a `tags.read` et `values.read` ; ou, avec `HOTLOOP_OPCUA_SERVER_ALLOW_X509` activé, choisissez *Certificate* et fournissez le certificat utilisateur et sa clé qu'un admin a attachés à un utilisateur.
3. La première connexion est refusée parce que le serveur ne fait pas encore confiance au certificat du client. Trouvez-le dans `<PKI_DIR>/rejected/` (sur le volume PKI dans un cluster), déplacez-le vers `trusted/` et reconnectez-vous.
4. La première fois, le client demande s'il faut faire confiance au certificat du serveur ; comparez l'empreinte avec celle du journal de démarrage.
5. Parcourez *Objects* → l'appareil → ses tags, et faites glisser des tags dans la vue d'accès aux données ; ils se souscrivent.

## Ignition 8.3 comme client

**Vérifié le 2026-09-27 avec Ignition 8.3.9**, la version stable actuelle, dans l'image de conteneur officielle d'Inductive Automation (`inductiveautomation/ignition:8.3.9`, édition standard en période d'essai), face à un Gateway HotLoop dont l'appareil de démonstration `extruder-1` est alimenté par un simulateur. Ce qui a été démontré, de bout en bout :

- une connexion OPC UA d'Ignition vers `opc.tcp://<gateway>:4840` avec `Basic256Sha256` et `SignAndEncrypt`, connectée en tant que **viewer** HotLoop ;
- la confiance entre certificats dans les deux sens, comme ci-dessous ;
- des tags OPC dans le fournisseur `[default]` d'Ignition pointant vers des nœuds HotLoop, lus avec la qualité Good et changeant au rythme du simulateur. Chaque valeur qu'Ignition a affichée était une valeur que le `/api/values` de HotLoop avait conservée : le même double traverse le réseau sans changement, donc on les compare à l'égalité, pas à la proximité. Un tag texte déclaré `string` dans HotLoop a lu « RUNNING » dans un tag String d'Ignition ;
- une écriture depuis Ignition refusée : Ignition a envoyé l'écriture, HotLoop a répondu `Bad_NotWritable` (lu sur le réseau via un canal Sign seul, où la réponse est signée mais non chiffrée), et la valeur de HotLoop n'a pas bougé ;
- toutes les politiques et tous les modes de sécurité qu'Ignition propose, ci-dessous.

### Mise en place

Côté HotLoop, avant Ignition :

1. Activez le serveur et définissez `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` avec le nom par lequel Ignition joint le Gateway. Ce nom figure dans chaque URL d'endpoint que le serveur annonce et dans son certificat.
2. Créez un utilisateur HotLoop pour Ignition avec le rôle **viewer** (un admin le fait avec `POST /api/users` ; voir [Authentification et utilisateurs](/fr/iot/authentication/)). Tout rôle avec `tags.read` et `values.read` peut se connecter ; rien de plus n'est proposé, puisque le serveur est en lecture seule.

Dans le Gateway Ignition (l'interface web sur le port 8088) :

3. Sur la page **OPC Connections** sous Connections (`/app/connections/opc-client-connections`), créez une connexion **OPC UA**. URL de l'endpoint `opc.tcp://<gateway>:4840` ; choisissez l'endpoint `Basic256Sha256` / `SignAndEncrypt` ; authentification **Username**, avec l'utilisateur et le mot de passe HotLoop. La connexion passe aussitôt en Faulted, ce qui est normal : étape 4.
4. **Approuvez Ignition dans HotLoop.** Le certificat client d'Ignition se trouve maintenant dans `<PKI_DIR>/rejected/` du Gateway (`/data/opcua-pki/rejected` dans le conteneur et le chart), nommé d'après son empreinte SHA-1, `<thumbprint>.crt`. Comparez l'empreinte avec le certificat client OPC UA d'Ignition lui-même, affiché sur la page des certificats OPC (`/app/connections/opc/security/certificates`). Puis déplacez le fichier vers `trusted/`. Aucun redémarrage de part ni d'autre. HotLoop ne journalise pas le refus ; le fichier en est le seul signe.
5. **Approuvez HotLoop dans Ignition.** La connexion échoue maintenant dans l'autre sens : le statut dit `Bad_SecurityChecksFailed ... unable to find valid certification path`. Le certificat de HotLoop est dans les certificats **client** rejetés d'Ignition, sur la même page. Comparez son empreinte avec celle que HotLoop journalise au démarrage (`generated a self-signed OPC UA application certificate ... thumbprint=`) et faites-lui confiance. Aucun redémarrage ; la connexion s'établit en quelques secondes.
6. **Tags.** Créez des tags OPC avec la connexion comme serveur OPC et des chemins d'élément sous la forme URI de l'espace de noms, qu'Ignition accepte tels quels :

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Déclarez chacun comme ce que HotLoop publie (voir [Types de données](#types-de-données)) : Float8 pour un float, Boolean, String, Int2 pour un `int16`, Int4 pour un `uint16` ou `int32`, Int8 pour les entiers plus larges. Ils se souscrivent à la cadence du groupe de tags, et HotLoop relève une cadence d'échantillonnage plus rapide jusqu'à l'intervalle d'interrogation de l'appareil.

La même chose, par fichiers ou par l'API REST :

- La connexion est la ressource `data/config/resources/core/ignition/opc-connection/<name>/config.json`, de type de profil `com.inductiveautomation.OpcUaServerType`, ou `POST /data/api/v1/resources/ignition/opc-connection`. Deux choses n'y sont pas évidentes. Le mot de passe est un secret intégré, un JWE que `POST /data/api/v1/encryption/encrypt` fabrique à partir du texte en clair ; une simple chaîne n'est pas acceptée. Et le bloc `security` a besoin de l'alias du magasin de clés client du gateway et de son mot de passe : sans lui, la connexion échoue avec une NullPointerException, et avec un alias vide elle échoue avec `Unable to retrieve KeyPair for alias 'client'`. Copiez le bloc de la connexion de bouclage `Ignition OPC UA Server` fournie d'origine, qui porte les deux.
- Les certificats sont sous `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), ou via `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` et `POST .../trusted/<sha1>` par l'API. **Ignition ne nomme pas les fichiers d'après l'empreinte** ; le champ `signature` de l'API est l'empreinte SHA-1, et il correspond à ce que HotLoop journalise.
- Les tags s'importent avec `POST /data/api/v1/tags/import?provider=default&type=json`.
- Chaque appel d'API demande une clé d'API (la page API Keys, `/app/platform/security/api-keys`), et une clé ne passe que si l'un de ses niveaux de sécurité figure dans les autorisations de lecture ou d'écriture du gateway (la ressource `security-properties`).

### À quoi s'attendre

- **`Bad_SecurityChecksFailed` veut dire deux choses différentes.** Ignition affiche le même statut quand HotLoop refuse le certificat d'Ignition (étape 4 ; le message n'a pas de raison) et quand Ignition refuse celui de HotLoop (étape 5 ; le message dit *unable to find valid certification path*). Regardez d'abord le `rejected/` de HotLoop.
- **Un redéploiement de HotLoop garde son certificat.** Jusqu'à la 4.15.3, ce n'était pas le cas : le certificat devait couvrir le nom d'hôte du conteneur, qui change chaque fois que le conteneur est recréé, si bien que chaque mise à niveau créait un nouveau certificat et qu'Ignition refusait le serveur jusqu'à ce que quelqu'un lui refasse confiance. Voir [Certificat du serveur](#certificat-du-serveur). Le certificat change toujours si le volume PKI est perdu.
- **Un tag texte déclaré numérique lit `Bad_TypeMismatch`.** HotLoop publie un tag avec le type sous lequel il est déclaré, et un tag `float` qui contient « RUNNING » ne peut pas être un Double. Les tags créés par Discover tags jusqu'à la 4.15.3 étaient tous déclarés `float` ; voir [Protocoles et pilotes](/fr/iot/protocols/#opc-ua). Déclarez-les `string`.
- **Les écritures sont refusées, et Ignition en brouille la raison.** HotLoop répond `Bad_NotWritable`. Le serveur OPC UA d'Ignition lui-même, à qui l'on demande d'écrire le même tag, ne transmet qu'un `Bad` générique (0x80000000). La valeur du tag Ignition ne change pas.
- **Les politiques obsolètes ne fonctionnent que si on les active.** Ignition propose `Basic128Rsa15` et `Basic256`. Choisissez `Basic256Sha256` ou l'une des politiques `Aes` dans la connexion.
- **La période d'essai.** Un gateway 8.3 sans licence fonctionne deux heures puis cesse d'exécuter jusqu'à ce que l'essai soit réinitialisé dans l'interface web du Gateway. Les tags deviennent périmés à ce moment-là ; c'est Ignition, pas la connexion.

### Matrice des politiques

Chaque ligne est une session neuve avec cette politique et ce mode, lisant des valeurs en direct. Les deux lignes obsolètes ont été mesurées avec `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` activé ; désactivé, comme il l'est par défaut, ces deux politiques ne sont pas proposées et un canal qui en demande une est refusé :

| Politique | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | fonctionne | fonctionne |
| `Aes128_Sha256_RsaOaep` | fonctionne | fonctionne |
| `Aes256_Sha256_RsaPss` | fonctionne | fonctionne |
| `Basic256` (obsolète) | fonctionne | fonctionne |
| `Basic128Rsa15` (obsolète) | fonctionne | fonctionne |

`None` n'est pas proposée sauf si `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` est défini, et n'a pas été essayée.

## Configuration

| Variable | Par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | Activé dans le binaire et le chart ; `false` arrête le serveur |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | Port TCP, sur toutes les interfaces |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | le nom d'hôte de cette machine | Ce à quoi l'on dit aux clients de se connecter ; aussi écrit dans un certificat généré. **À définir.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Doit rester stable d'un redémarrage à l'autre ; doit être un URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Certificat, clé, `trusted/`, `rejected/`. À placer sur un volume |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Utilise cette paire RSA au lieu d'en générer une ; définissez les deux ou aucune |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Noms DNS / IP supplémentaires pour un certificat généré |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Propose la politique de sécurité None. Signalé au démarrage |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Accepte les sessions sans identité. Signalé au démarrage |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Saute l'approbation des certificats clients. Signalé au démarrage |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Propose le jeton utilisateur Certificate : un client se connecte avec un certificat attaché à un utilisateur ([Certificats utilisateur X.509](#certificats-utilisateur-x509)). Noté au démarrage |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Propose les politiques obsolètes `Basic128Rsa15` et `Basic256` pour un ancien client ([Transport](#transport)). Signalé au démarrage |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = illimité |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = illimité |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | La période de la réconciliation de sécurité |

Le serveur n'est pas démarré en mode `--mcp-stdio` : c'est un agent qui lance ce binaire comme assistant, et qu'un second processus se dispute le port 4840 avec le vrai Gateway ne doit pas pouvoir arriver.

### Helm

`opcuaServer.*` dans `charts/hotloop/values.yaml`. L'activer ajoute un Service (`<release>-opcua`, ClusterIP par défaut ; LoadBalancer ou NodePort est un choix délibéré pour un client hors du cluster), un PVC pour le dossier PKI (`opcuaServer.persistence` ; le perdre oblige chaque client à faire confiance à un nouveau certificat), le port du conteneur et, pour que `networkPolicy.enabled` et `opcuaServer.enabled` ensemble ne laissent pas en silence un serveur à l'écoute que rien ne peut atteindre, le port dans la règle d'ingress de la NetworkPolicy par défaut. Un `networkPolicy.ingress` personnalisé remplace cette règle, comme pour le broker, et doit alors lister lui-même le port. `opcuaServer.tls.existingSecret` fournit un Secret `kubernetes.io/tls` au lieu d'un certificat généré.

## Ce qui a été vérifié ou non

HotLoop a été exécuté sur du vrai matériel et de vrais serveurs, et sur du matériel réel le 2026-11-17.
