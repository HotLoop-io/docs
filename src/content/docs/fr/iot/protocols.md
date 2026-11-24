---
title: "Protocoles et pilotes"
description: "OPC UA, Modbus, MQTT et Sparkplug B, EtherNet/IP, S7comm, MTConnect et HTTP, avec le degré de validation de chaque pilote sur des équipements réels."
---

Ce document dit exactement ce que parle la passerelle, jusqu'où chaque pilote a été vérifié et que faire pour tout le reste. C'est la première chose à lire, et celle à laquelle se fier quand quelque chose la contredit.

La liste des protocoles natifs est dérivée des pilotes compilés dans le binaire : `/api/protocols`, l'écran Protocoles et l'outil MCP `describe_protocol` lisent tous le même registre. Le catalogue ne peut pas annoncer un protocole que le binaire n'a pas.

## État de la vérification

Chaque protocole que HotLoop parle en natif a déplacé de vraies valeurs depuis un vrai serveur ou appareil, et a tourné sur du matériel réel (2026-11-17). Là où une implémentation indépendante existe, HotLoop a été testé contre elle dans les deux sens.

| Protocole | Natif | État |
|---|---|---|
| Modbus TCP/RTU | oui | **vérifié en réel** |
| OPC UA | oui | **vérifié en réel**, y compris Ignition 8.3.9 dans les deux sens avec nom d'utilisateur et mot de passe sur un canal sécurisé |
| MQTT / Sparkplug B | oui | **vérifié en réel** |
| MTConnect | oui | **vérifié en réel** |
| HTTP / REST | oui | **vérifié en réel** |
| S7comm | oui | **vérifié en réel** (matériel réel, 2026-11-17) |
| EtherNet/IP | oui | **vérifié en réel** (matériel réel, 2026-11-17) |
| UniFi Network | oui | **vérifié en réel**, en lecture seule, sur de vraies consoles et de vrais switches, liens WAN et bascule comprises |
| SNMP | oui | **vérifié en réel**, en lecture seule, en v1, v2c et v3 à tous les niveaux de sécurité |
| CODESYS | oui | **vérifié en réel**, lectures et écritures, dont un programme de plus de 100 000 variables lu en 2,4 secondes |
| BACnet/IP | oui | **vérifié en réel**, en lecture seule |
| OPC UA PubSub (UADP) | oui | **vérifié en réel**, dans les deux sens |
| API Kafka (sortie) | oui | **vérifié en réel** avec Apache Kafka et Redpanda, avec TLS et une connexion SASL |

Les fabricants diffèrent sur leurs valeurs par défaut : quels certificats et quelles politiques de jeton un serveur OPC UA propose, ce qu'un contrôleur BACnet met dans sa liste d'objets, quelles MIB sert un appareil SNMP, comment un automate numérote ses données. Un nouvel appareil sur un nouveau site reste un travail de mise en service : comparez donc une valeur connue sur la sonde de l'intégration avec l'afficheur de l'appareil avant de faire confiance à un écran.

## Protocoles natifs

### OPC UA

Préférez celui-ci quand un appareil offre le choix. Il explore, il est correctement sécurisé et il s'abonne.

Le pilote **s'abonne au lieu d'interroger**. Le serveur envoie une valeur quand elle change, à un rythme qu'il peut tenir, au lieu qu'un client lui pose la même question à chaque cycle sans savoir si quelque chose a bougé. Si un serveur refuse un abonnement, le pilote bascule sur des lectures groupées plutôt que de mettre l'appareil en échec.

Il bascule aussi quand un abonnement ne livre rien du tout. Un serveur envoie la valeur courante de chaque nœud dans sa première publication et ne la renvoie plus tant qu'elle ne change pas : une première publication perdue donne donc une consigne lue comme mauvaise pendant toute la session. Si dix intervalles de publication passent (cinq secondes au minimum) sans aucune valeur de l'abonnement, le pilote journalise un avertissement, supprime l'abonnement et lit les tags à chaque interrogation jusqu'à la prochaine reconnexion de l'appareil. La bibliothèque cliente OPC UA sur laquelle ce pilote est construit peut démarrer sa boucle de publication en pause sur un hôte chargé et ne jamais envoyer de requête de publication ; c'est le cas pour lequel ceci existe.

Il bascule aussi quand un abonnement s'arrête après que des valeurs sont arrivées. La bibliothèque garde ses keep-alive pour elle, si bien qu'une boucle de publication arrêtée ressemble exactement à une usine où rien ne change. Quand un abonnement est resté silencieux pendant dix intervalles de publication (trente secondes au minimum), le pilote lit chaque nœud une fois et le compare à ce que l'abonnement a livré en dernier. Si un nœud diffère en valeur ou en qualité, le serveur retient quelque chose qu'il aurait envoyé : le pilote journalise donc un avertissement, supprime l'abonnement et lit à chaque interrogation jusqu'à la reconnexion de l'appareil. Si tout concorde, il continue et revérifie après le même silence. Un abonnement sain et silencieux coûte une lecture groupée toutes les trente secondes.

**Adressez les nœuds par URI d'espace de noms.** Cela compte plus qu'il n'y paraît :

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

Un *index* d'espace de noms est attribué dans l'ordre où le serveur charge ses espaces de noms. Ajoutez un espace de noms, mettez à jour le firmware, et l'index 3 devient discrètement autre chose : chaque lecture est alors fausse sans la moindre erreur. L'URI fait partie du modèle et ne bouge pas. `Browse` renvoie la forme URI précisément pour cette raison.

Une chaîne brute est refusée comme adresse. Lue comme `ns=0;s=Temperature`, une faute de frappe serait analysée sans problème comme un nœud qui n'existe pas et le tag serait lu mauvais pour toujours. Une forme explicite est exigée pour que l'erreur apparaisse à l'enregistrement.

**Découvrir les tags déclare chaque tag du type que le serveur dit que le nœud contient** : Boolean devient `bool`, les types entiers gardent leur largeur (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64` ; SByte et Byte passent à la taille supérieure), Float et Double deviennent `float`, et String, DateTime, LocalizedText et les autres types que le pilote lit comme du texte deviennent `string`. Un type que le serveur ne donne pas, ou sans meilleur nom (une énumération, une structure), reste `float`. Jusqu'au travail avec Ignition décrit plus bas, chaque tag découvert était `float`. Le pilote lisait quand même le texte d'un nœud String, mais le tag disait float, et le serveur OPC UA du Gateway lui-même publie un tag au type avec lequel il est déclaré : un client de ce serveur recevait donc `Bad_TypeMismatch`. Ignition a montré `System_Status` d'Emberburn exactement ainsi. Les tags importés avant la correction gardent leur type : passez à la main un tag de texte en `string`.

Configuration : les options de sécurité, d'identité et de certificat sont décrites dans [OPC UA : sécurité et identifiants](#opc-ua-sécurité-et-identifiants). Les autres sont `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` et `browseServerNodes`. Un nom d'option que le pilote ne connaît pas est une erreur qui liste ceux qu'il connaît, pas un réglage ignoré en silence : une faute de frappe dans `securityMode` se connecterait sans aucune sécurité et ressemblerait exactement à un appareil qui fonctionne.

**Découvrir les tags laisse de côté l'objet `Server` du serveur lui-même** (`i=2253` : son état, ses capacités, ses diagnostics, son tableau d'espaces de noms et sa configuration). Tout serveur OPC UA en a un, et cela peut représenter des centaines de variables mêlées à celles de l'usine. Mettez `browseServerNodes` à `true` sur l'appareil pour les récupérer, ou mettez `browseRoot` à `i=2253` pour regarder dedans volontairement ; une exploration qui part de là le parcourt quand même.

### OPC UA : sécurité et identifiants

Jusqu'à la 4.15.0, le pilote ne savait faire qu'une connexion anonyme et non sécurisée, et pas vers n'importe quel serveur conforme à la spécification : il ne demandait jamais au serveur quelles politiques de jeton d'identité il proposait, et envoyait donc un identifiant de politique de jeton vide, qu'un serveur conforme refuse. Cela incluait le serveur OPC UA de HotLoop lui-même. Le pilote découvre maintenant les endpoints du serveur, en choisit un qui correspond à l'appareil et renvoie l'identifiant de politique que cet endpoint a listé.

#### Options de l'appareil

| Option | Valeur par défaut | Ce qu'elle fait |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` ou `SignAndEncrypt`. Omise avec un `securityPolicy` autre que `None`, elle vaut `SignAndEncrypt`. |
| `securityPolicy` | la meilleure que le serveur propose pour le mode | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` ou `Aes256_Sha256_RsaPss`. `Basic128Rsa15` et `Basic256` sont refusées. |
| `username`, `password` | anonyme | Authentification par nom d'utilisateur. |
| `userCertificate`, `userPrivateKey` | aucune | Authentification utilisateur X.509 : la session se connecte comme l'utilisateur auquel le serveur associe ce certificat, sans mot de passe. Les deux en PEM, à définir ensemble. La clé est RSA (la bibliothèque OPC UA ne signe qu'en RSA ; une clé EC est refusée avec ce message) et c'est un secret comme le mot de passe : scellée au repos, masquée dans toute réponse de l'API, jamais journalisée. Le certificat est celui de l'utilisateur, pas le certificat d'application cliente de `certFile`. Si un `username` est aussi défini, le certificat est utilisé. Avec le serveur de HotLoop lui-même, le certificat doit d'abord être rattaché à un utilisateur ([Le serveur OPC UA](/fr/edge/opc-ua-server/#certificats-utilisateur-x509)). |
| `allowInsecureCredentials` | `false` | Autorise l'envoi d'un mot de passe sur un canal non sécurisé (`securityMode` `None`), ou quand rien ne le chiffre. |
| `certFile`, `keyFile` | générés | Le certificat d'application de ce client et sa clé RSA, pour un mode sécurisé. Définissez les deux ou aucun. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | L'endroit où se trouvent le certificat généré et les magasins `trusted/` et `rejected/`. |
| `serverCertThumbprints` | aucune | Empreintes SHA-1 (40 chiffres hexadécimaux) ou SHA-256 (64) de certificats de serveur à approuver sans fichier dans `trusted/`. Les deux-points et les espaces sont ignorés. |
| `insecureSkipVerify` | `false` | Accepte n'importe quel certificat de serveur. |

Un appareil sans aucune de ces options est ce qu'il a toujours été : anonyme, sur un canal non sécurisé.

#### Comment le pilote choisit un endpoint

Le pilote demande au serveur ses endpoints sur un canal non sécurisé, ce que la spécification oblige les serveurs à autoriser pour la découverte et qui ne transporte rien de secret, puisque la liste des endpoints est publique par conception. Il garde les endpoints dont le mode et la politique de sécurité correspondent à l'appareil et, parmi eux, la politique de jeton de l'identité de l'appareil (anonyme, ou nom d'utilisateur quand un `username` est défini). Le jeton d'identité qu'il envoie ensuite porte l'identifiant de politique que cet endpoint a listé ; il n'en envoie jamais un vide.

- **Il ne sélectionne jamais `Basic128Rsa15` ni `Basic256`.** Toutes deux sont dépréciées par l'OPC Foundation. Cela vaut quand l'une a le niveau de sécurité le plus élevé de la liste, ce qui est la façon dont les serveurs les classent, et quand l'une est la seule chose que le serveur propose, auquel cas la connexion échoue avec une erreur qui le dit. Un appareil ne peut pas être configuré pour en utiliser une, et une politique de jeton qui chiffrerait un mot de passe avec l'une d'elles est refusée aussi. Le serveur de HotLoop lui-même propose les deux à côté des politiques modernes et ne peut pas les désactiver ; c'est donc exercé contre un vrai serveur, et les tests vérifient que l'URI d'aucune des deux n'apparaît dans ce que le pilote envoie.
- **Quand l'appareil ne nomme aucune politique, il préfère `Basic256Sha256`, puis `Aes128_Sha256_RsaOaep`, puis `Aes256_Sha256_RsaPss`**, quel que soit le niveau de sécurité que le serveur leur donne. L'ordre dépend de leur compatibilité, pas de leur robustesse. Certains serveurs ne peuvent pas ouvrir un canal avec `Aes256_Sha256_RsaPss` et ferment la connexion sans dire pourquoi : elle n'est donc utilisée que lorsqu'un appareil la nomme.
- **Si rien ne correspond, l'erreur liste ce que le serveur propose réellement**, avec la politique et l'identifiant de politique de jeton de chaque endpoint, de sorte que la configuration puisse être corrigée à partir du seul message.

#### Le certificat propre du client

Tout mode sécurisé a besoin d'un certificat d'application. Si l'appareil nomme un `certFile` et un `keyFile`, ils sont utilisés tels quels, après vérifications (RSA, au moins 2048 bits, non expiré). Sinon un certificat auto-signé est généré au premier usage et conservé dans le répertoire PKI : RSA-2048, cinq ans, l'URI d'application `urn:hotloop:client:<host name>` dans les noms alternatifs du sujet, la clé en mode `0600`, le certificat en mode `0644` et les répertoires en `0750`. La disposition reflète celle du serveur OPC UA :

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

Il n'est pas régénéré lors d'un démarrage ordinaire, de sorte qu'un serveur à qui l'on a dit de lui faire confiance n'a pas à l'apprendre de nouveau. Il est remplacé, avec un avertissement que chaque serveur doit approuver le nouveau, seulement s'il est illisible, n'est pas du RSA d'au moins 2048 bits ou a moins de 30 jours devant lui. Les appareils qui démarrent au même moment partagent un certificat au lieu d'écrire chacun le leur.

Le répertoire doit être inscriptible et persistant. Dans le chart Helm, c'est `opcuaClient.persistence.enabled` (désactivé par défaut, car il ajoute un volume à une installation existante) ; sur l'edge relay, c'est le volume `/data` existant. Sans répertoire inscriptible, un appareil sécurisé signale une erreur qui nomme la variable à définir, plutôt que de se connecter avec des certificats qui seraient perdus au prochain redémarrage.

Le **serveur** doit aussi faire confiance à ce certificat, ce qui est un réglage du serveur lui-même. Pour le serveur de HotLoop, c'est le même geste : le certificat du pilote apparaît dans le répertoire `rejected/` du serveur après la première tentative refusée, et le déplacer dans `trusted/` l'approuve. Quand un serveur ferme la connexion pendant l'ouverture du canal sécurisé, ce qui est la façon dont beaucoup de serveurs écartent un certificat auquel ils ne font pas confiance, l'erreur nomme le fichier de certificat de ce client et son empreinte pour que l'opérateur sache quoi chercher sur le serveur.

#### Approuver le certificat d'un serveur

Pour un mode sécurisé, ou pour un mot de passe à chiffrer avec la clé du serveur, **le pilote n'accepte pas n'importe quel certificat que le serveur présente.** Il ne fait confiance au certificat que s'il est épinglé dans `serverCertThumbprints` de l'appareil ou s'il est exactement le certificat présent dans `trusted/`. Tout le reste est écrit dans `rejected/<thumbprint>.der` et la connexion échoue, avant l'envoi de tout identifiant, avec un message comme celui-ci :

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Comparez l'empreinte avec l'afficheur du serveur lui-même avant d'approuver : cette comparaison est toute la décision de confiance. Ensuite, faites `mv` du fichier dans `trusted/` (les fichiers PEM et DER sont lus tous deux) et l'appareil se connecte à sa prochaine tentative, qui tombe dans l'intervalle de reconnexion du runtime. Quelques précisions :

- La confiance porte sur le certificat exact, pas sur une chaîne. Un serveur dont le certificat est émis par une CA s'approuve en plaçant le certificat propre de ce serveur dans `trusted/`, comme pour un certificat auto-signé. Faire confiance à une CA n'est pas pris en charge.
- Un certificat expiré mais approuvé par un opérateur reste approuvé, avec un avertissement dans le journal à chaque connexion. Refuser un certificat qu'un opérateur a approuvé exprès ne ferait que le pousser vers `insecureSkipVerify`.
- Un fichier de `trusted/` qui n'est pas un certificat est ignoré et signalé, et ne rend pas inaccessibles les autres serveurs approuvés.
- `rejected/` contient au plus 256 fichiers : un serveur qui présente un certificat différent à chaque connexion ne peut donc pas remplir le disque. Au-delà, la connexion reste refusée, et le message dit que le fichier n'a pas été conservé et comment approuver quand même le certificat.
- `insecureSkipVerify` désactive la vérification. Un tiers sur le chemin peut alors usurper le serveur et lire ce qui lui est envoyé, mot de passe compris. Elle est désactivée par défaut et avertit, avec l'empreinte du certificat, à chaque connexion.

Un appareil anonyme sur un canal non sécurisé n'a besoin de rien de tout cela, car rien n'est signé ni chiffré avec la clé du serveur.

#### Identifiants

Un mot de passe est refusé, avant d'être envoyé, sauf si le canal est sécurisé et que quelque chose chiffre le mot de passe. Ce que le pilote décide, d'après ce que le serveur propose pour l'endpoint retenu :

| Canal | Politique de jeton de nom d'utilisateur du serveur | Résultat |
|---|---|---|
| `SignAndEncrypt` | chiffre le mot de passe (le cas habituel) | se connecte |
| `SignAndEncrypt` | ne le chiffre pas | se connecte : le canal chiffré le transporte, et le journal le dit |
| `Sign` | chiffre le mot de passe | se connecte |
| `Sign` | ne le chiffre pas | **refusé** sauf `allowInsecureCredentials`. `Sign` authentifie les messages mais ne les cache pas. |
| `None` | chiffre le mot de passe | **refusé** sauf `allowInsecureCredentials`. Sur un canal non sécurisé, la clé avec laquelle le mot de passe est chiffré provient d'une réponse que rien n'authentifie : quiconque peut modifier le trafic peut donc le récupérer. Avec l'option activée, il se connecte, avec un avertissement. |
| `None` | ne le chiffre pas | **refusé** sauf `allowInsecureCredentials` |

**Un nom d'utilisateur sur `securityMode` `None` est refusé même quand la politique de jeton du serveur chiffre le mot de passe.** Un chiffrement dont la clé peut être choisie par un attaquant ne protège pas contre cet attaquant, et sur un canal non sécurisé le certificat avec lequel le mot de passe est chiffré est pris dans la réponse du serveur à `CreateSession`, que rien n'authentifie (le test ci-dessous substitue un certificat et récupère le mot de passe). L'erreur le dit et nomme la solution, `securityMode` `SignAndEncrypt`. Les sessions anonymes ne sont pas concernées.

`allowInsecureCredentials` est le seul interrupteur qui laisse partir un mot de passe dans ces conditions. Il est désactivé par défaut et avertit à chaque connexion quand c'est lui qui l'a autorisée. Quand la politique de jeton chiffre le mot de passe, il change ce qu'un écouteur peut lire, pas ce que peut lire un tiers qui modifie le trafic : voir [ce qui transite sur le réseau](#ce-qui-transite-sur-le-réseau). Même avec lui, le certificat du serveur doit d'abord être approuvé quand le mot de passe est chiffré avec lui.

Le mot de passe est un secret partout où le pilote et l'API le manipulent :

- **Réponses de l'API.** Il est remplacé par `[redacted]` dans toute réponse qui renvoie un appareil (`GET /api/devices`, `GET /api/devices/{id}` et la réponse à un enregistrement), de sorte qu'un lecteur, qui détient `devices.read`, ne peut pas le lire. Depuis la 4.15.1, cela vaut pour tous les rôles, administrateur compris, et pour les identifiants de tous les protocoles, pas seulement celui-ci. Réenregistrer un appareil avec le marqueur conserve le mot de passe stocké ; une nouvelle valeur le remplace ; une chaîne vide l'efface ; le marqueur pour un appareil sans mot de passe est refusé au lieu d'être stocké. Omettre le champ le conserve désormais (en 4.15.0, cela l'effaçait). Les règles complètes sont dans [Authentification et utilisateurs](/fr/iot/authentication/#les-identifiants-dappareil-sont-en-écriture-seule). L'éditeur d'appareil de l'interface web affiche la configuration telle que l'API la renvoie et enregistre ce qu'il affiche, ce que ceci gère : modifier un appareil ne lui fait donc pas perdre son mot de passe. (Les tests l'exercent via l'API, pas via un navigateur.)
- **Journaux et erreurs.** Ni les lignes de journal du pilote ni aucune erreur qu'il renvoie ne portent le mot de passe : les messages sont construits à partir de codes d'état et des réglages non secrets de l'appareil. Les tests capturent le journal du processus, le journal du serveur et les erreurs, et y cherchent le mot de passe partout.
- **Outils et ressources MCP, le flux d'événements en direct, le journal système.** Aucun ne renvoie la configuration d'un appareil (chacun décrit un appareil par un jeu fixe de champs), et les tests appellent chaque outil et chaque ressource, ouvrent le flux et lisent le journal système avec un mot de passe configuré, sans le trouver nulle part.
- **La base de données et les sauvegardes.** Le mot de passe est stocké dans la colonne `config` de l'appareil, comme ceux des autres pilotes. Jusqu'à la 4.16.0, il y est en clair, et une sauvegarde le contient. À partir de la 4.17.0, il est chiffré avec une clé conservée hors de la base (voir « Encrypted at rest » plus bas), de sorte qu'un dump ou une sauvegarde ne contient que du texte chiffré. Dans les deux cas, voir [Sauvegardes et restauration](/fr/iot/backup/#protégez-les-fichiers-de-sauvegarde) et protégez la base et le volume de sauvegarde en conséquence.
- **L'edge relay.** Un fichier d'appareil porte aussi le mot de passe. Dans le chart Helm, placez un fichier d'appareil contenant des identifiants dans un Secret et nommez-le dans `devicesSecret` ; les appareils définis directement dans les valeurs du chart finissent dans une ConfigMap. Un fichier d'appareil poussé par fleet config push est publié, retenu, sur un topic MQTT : le broker doit donc être en TLS et restreindre qui peut lire ce topic.

Un mot de passe erroné donne une erreur claire, en une seule tentative, sans blocage et sans nouvelle tentative dans le pilote :

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Le runtime attend alors **dix minutes** (avec une variation aléatoire entre cinq et dix) avant la tentative suivante, au lieu de grimper dans son temporisateur de reconnexion habituel (`HOTLOOP_RECONNECT_MAX`, 60 secondes par défaut). Deux choses rendent une connexion refusée plus coûteuse à répéter qu'une panne réseau. Un serveur qui verrouille un compte après quelques échecs transforme chaque nouvelle tentative rapide en panne pour quiconque utilise ce compte. Et chaque connexion refusée peut laisser une **session créée et jamais activée** sur le serveur, qui compte dans sa limite de sessions jusqu'à expiration (la bibliothèque demande vingt minutes ; `sessionTimeoutMs` la modifie) : contre le serveur de HotLoop lui-même, un appareil au mot de passe erroné qui réessayait toutes les quelques secondes a rempli sa limite par défaut de vingt sessions, après quoi le serveur a refusé tous les autres clients avec `BadTooManySessions`. Un contrôleur avec une petite table de sessions est encore plus exposé. L'appareil ne cesse pas de réessayer : un serveur dont le mot de passe est corrigé de son côté se rétablit donc en moins de dix minutes sans que personne touche à HotLoop ; corriger le mot de passe sur l'appareil, ou l'éteindre puis le rallumer, démarre un nouveau worker, qui essaie immédiatement.

#### Ce qui transite sur le réseau

Mesuré, pas déduit : les tests placent un proxy enregistreur entre le pilote et un serveur et cherchent chaque octet dans les deux sens. La recherche trouve des octets dont on sait qu'ils sont là (la liste des endpoints du serveur, envoyée en clair), ce qui montre que le proxy a bien enregistré la conversation.

| Configuration | Mot de passe | Nom d'utilisateur | Identifiants de nœud et valeurs des tags |
|---|---|---|---|
| `SignAndEncrypt` | non visible | non visible | non visible |
| `Sign` | non visible (la politique de jeton le chiffre) | **lisible** | **lisible** |
| `None`, nom d'utilisateur, la politique de jeton du serveur chiffre (exige `allowInsecureCredentials`) | non visible | **lisible** | **lisible** |
| `None`, anonyme | sans objet | sans objet | **lisible** |
| un serveur qui propose un mot de passe non chiffré, avec `allowInsecureCredentials` | **lisible** | **lisible** | dépend du mode |

La dernière ligne est testée contre un serveur qui ne propose pas vraiment cela : un tiers placé devant un vrai serveur réécrit sa liste d'endpoints pour dire que le mot de passe n'est pas chiffré, sur le canal qu'utilise la découverte, que rien n'authentifie. C'est aussi ainsi que les tests montrent le refus : sans l'option, le pilote refuse, n'ouvre que la connexion de découverte, et aucun identifiant ne circule sur le réseau. La liste des endpoints est précisément ce qu'un tiers sur le chemin peut réécrire, et c'est pourquoi la règle du pilote s'applique à ce qu'on lui dit et n'est pas laissée au serveur pour qu'il la fasse respecter.

Un canal non sécurisé avec un mot de passe a une limite que le tableau ne montre pas et qu'un test montre ; c'est pourquoi le pilote refuse cette combinaison sans l'option. Le mot de passe est chiffré avec le certificat du serveur, ce qui le protège d'un écouteur, et le pilote ne l'enverra pas tant que ce certificat n'est pas approuvé. Mais le certificat avec lequel la bibliothèque OPC UA chiffre est celui de la réponse du serveur à la création de la session, et sur un canal non sécurisé cette réponse n'est pas authentifiée. Un tiers capable de modifier le trafic y place son propre certificat, et le mot de passe est alors chiffré avec la clé de ce tiers : le test le fait, déchiffre le mot de passe avec la clé substituée et le récupère. **Sur `Sign` ou `SignAndEncrypt`, le même tiers ne le peut pas**, car la réponse est protégée par des clés qu'il n'a pas. Sans `allowInsecureCredentials`, le pilote refuse tout simplement d'envoyer le mot de passe, et le test montre que le même tiers n'obtient alors rien ; avec l'option, le pilote avertit à chaque connexion. Utilisez `SignAndEncrypt` partout où le serveur le propose ; un canal non sécurisé avec un mot de passe, activé volontairement, protège contre un écouteur et rien de plus.

#### Reconnexion

La reconnexion propre à la bibliothèque OPC UA est désactivée, et c'est le runtime qui reconnecte. La bibliothèque, une fois la session perdue, en ouvre une nouvelle avec les identifiants qu'on lui a donnés et, quand le serveur les refuse, réessaie aussitôt sans aucun délai : une vingtaine de connexions refusées en douze secondes ont été mesurées, contre un serveur dont le mot de passe avait changé. C'est ainsi qu'un compte se retrouve verrouillé pour tous ceux qui le partagent. Maintenant, une session perdue fait signaler une erreur par `Poll`, le worker du runtime ferme le pilote et en ouvre un nouveau, et le nouveau découvre les endpoints, vérifie le certificat du serveur et se reconnecte, avec le temporisateur à variation aléatoire du runtime et l'attente de dix minutes après un échec d'authentification. Un redémarrage du serveur est surmonté de la même façon : l'appareil lit la nouvelle valeur après le redémarrage, s'étant reconnecté, ce que les tests vérifient en comptant les connexions du serveur et en changeant la valeur après le redémarrage.

Un appareil sans tags n'a rien à lire, et jusqu'à la 4.15.2, cela signifiait que son interrogation n'envoyait rien du tout. Le serveur fermait la session inactive à l'expiration de son délai de session, l'appareil continuait à se dire connecté parce que personne n'avait rien demandé au serveur, et chaque exploration échouait avec `BadSessionIDInvalid` jusqu'au redémarrage du processus. C'est le cas de chaque appareil au moment exact où quelqu'un l'ajoute et clique sur Découvrir les tags. Ignition l'a détecté. Maintenant, un appareil sans tags lit l'état du serveur à chaque interrogation, ce qui garde la session vivante et remarque quand elle meurt, et une exploration qui trouve la session disparue le signale pour que le runtime reconnecte.

Un tag qui n'a pas changé depuis avant le début de la session lit maintenant sa valeur courante avec une bonne qualité. Auparavant, la lecture provisoire signalée en attendant la première valeur était plus récente que l'horodatage source de la valeur elle-même, et le runtime garde la lecture la plus récente et écartait la valeur : un tag stable était donc lu mauvais jusqu'à son prochain changement.

#### Ce qui a été testé, et ce qui ne l'a pas été

OPC UA a été exécuté contre Ignition 8.3.9 et contre des serveurs OPC UA indépendants, avec connexion anonyme et par nom d'utilisateur et mot de passe sur `None`, `Sign` et `SignAndEncrypt`, et sur du matériel réel le 2026-11-17. Chaque serveur de production a ses propres habitudes sur les politiques qu'il propose et sur la façon dont il écarte un certificat : traitez donc une première connexion au serveur d'un nouveau fabricant comme une mise en service.

À savoir :

- Chaque connexion demande maintenant d'abord au serveur ses endpoints, et un appareil sans option de sécurité a besoin d'un endpoint non sécurisé qui liste une politique de jeton anonyme avec un identifiant. Un serveur qui acceptait des sessions anonymes sans en lister une est refusé avec une erreur qui liste ce qu'il propose.
- L'authentification utilisateur par certificat X.509 et par jeton émis n'est pas implémentée pour le pilote. Le `certFile` d'un appareil est son certificat d'application.
- La confiance porte sur le certificat exact. Faire confiance à une autorité de certification, et la révocation de certificats, ne sont pas pris en charge.
- Les politiques de sécurité à courbes elliptiques ne sont pas prises en charge, pas plus que les serveurs qui refusent la découverte sur un canal non sécurisé.
- Un chemin réseau qui tombe sans qu'aucune extrémité voie la fermeture laisse l'appareil sur ses dernières valeurs jusqu'à ce que le système d'exploitation abandonne la connexion.
- Certains serveurs ne peuvent pas ouvrir un canal avec `Aes256_Sha256_RsaPss`.
- Le serveur de HotLoop lui-même accepte des mots de passe jusqu'à 72 octets. Un autre serveur peut avoir sa propre limite.

#### Ignition 8.3

Vérifié contre **Ignition 8.3.9**, la version stable actuelle, dans l'image de conteneur propre à Inductive Automation : le pilote de HotLoop comme client, le serveur OPC UA d'Ignition de l'autre côté, `Basic256Sha256` avec `SignAndEncrypt`, connecté avec un nom d'utilisateur et un mot de passe. Browse a trouvé les tags d'Ignition sous `nsu=urn:inductiveautomation:ignition:opcua:tags`, et les tags `[System]/Gateway` d'horloge, de CPU, de mémoire et de disponibilité ont été importés et lus avec une bonne qualité, poussés par abonnement.

Un gateway Ignition 8.3 standard vous arrêtera quatre fois avant que HotLoop puisse dire un mot :

1. **Son serveur OPC UA n'écoute que sur localhost.** Par défaut, la 8.3 lie le port 62541 à `localhost` : un HotLoop situé ailleurs reçoit donc une connexion refusée et rien d'autre. Dans le Gateway, dans les réglages du serveur OPC UA, mettez Bind Addresses à `0.0.0.0`. Nous avons aussi ajouté à Endpoint Addresses le nom d'hôte que HotLoop contacte ; nous n'avons pas testé si le pilote en a besoin.
2. **Les tags ne sont pas sur OPC UA par défaut.** Activez Expose Tag Providers, sinon une exploration ne trouve que les diagnostics du serveur lui-même et les dossiers d'appareils.
3. **Des certificats, dans les deux sens.** HotLoop refuse le certificat d'Ignition jusqu'à ce que vous l'approuviez, comme ci-dessus. Ignition refuse celui de HotLoop jusqu'à ce que vous lui fassiez confiance dans les certificats du serveur OPC UA du Gateway. Sur le disque, cela revient à le déplacer de `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` vers `.../trusted/certs`, sans redémarrage. **Ignition ne nomme pas ce fichier d'après l'empreinte SHA-1 que HotLoop journalise.** Ouvrez le certificat et comparez son empreinte ; le nom du fichier ne correspondra pas et ce n'est pas le signe d'un imposteur.
4. **La connexion OPC UA est `opcuauser` / `password`** dans la source d'utilisateurs `opcua-module`, sur chaque installation neuve. Changez-la avant que quoi que ce soit de réel se connecte.

Seul ce que le serveur de la 8.3 propose d'emblée a été exercé dans ce sens : `Basic256Sha256` et `SignAndEncrypt`.

**L'autre sens est vérifié aussi : le client OPC UA d'Ignition 8.3.9 lit le serveur OPC UA de HotLoop**, connecté comme lecteur HotLoop, sur chaque politique et mode de sécurité qu'Ignition propose. La mise en place, la confiance des certificats dans les deux sens, les pièges et la matrice des politiques sont dans [Le serveur OPC UA](/fr/edge/opc-ua-server/#ignition-83-comme-client). Il a trouvé deux bugs de HotLoop, tous deux corrigés : le serveur créait un nouveau certificat chaque fois que son conteneur était recréé, ce qui cassait la confiance d'Ignition après chaque mise à jour, et Découvrir les tags déclarait chaque tag comme float, de sorte qu'un tag de texte arrivait chez Ignition en `Bad_TypeMismatch` (plus haut).

Le nœud edge Sparkplug de HotLoop et l'Edge Relay contre le MQTT Engine d'Ignition sont la suite, et ne sont pas faits.

### OPC UA PubSub (UADP)

L'autre OPC UA : non pas un client qui interroge un serveur, mais un éditeur qui envoie des DataSets en datagrammes UDP à qui écoute, en unicast ou en multicast (OPC 10000-14, l'encodage UADP). HotLoop s'abonne, comme appareil, et publie, comme réglage.

**S'abonner.** Ajoutez un appareil avec le protocole `opcua-pubsub`. L'adresse indique où écouter : `udp://239.0.0.1:4840` rejoint un groupe multicast, `udp://:4840` écoute en unicast. L'adresse d'un tag est `<DataSetWriterId>/<field index>`, la position du champ dans le DataSet de l'éditeur en comptant à partir de 0 : `1000/3` est le quatrième champ que publie le writer 1000. UADP ne transporte aucun nom de champ (ils vivent dans un DataSetMetaData que l'éditeur sert par un autre moyen, ou pas du tout), c'est donc la position que peut dire un datagramme. Un champ qui est un tableau est lu élément par élément : `1000/3[17]` est la dix-huitième valeur du tableau qui est le quatrième champ. Browse liste les champs qui ont été entendus, avec leurs types, et un tableau sous forme de ses éléments (les 1000 premiers).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` et `writerGroupId` limitent un appareil à un éditeur et un groupe. Vide et zéro prennent tout. C'est ainsi que plusieurs appareils partagent une adresse : un éditeur qui envoie deux WriterGroups à `udp://:4840` correspond à deux appareils à cet endroit, un avec `"writerGroupId":1` et un avec `"writerGroupId":2`.
- Des appareils peuvent partager une adresse et un port. HotLoop ouvre un socket pour elle (une seule adhésion, pour un groupe multicast sur une carte) et remet chaque datagramme à tous les appareils qui s'y trouvent. Chaque appareil applique ensuite ses propres `publisherId`, `writerGroupId` et `dataSets`, de sorte que chacun voit le flux entier de son éditeur et qu'aucun n'est partagé entre appareils. Le socket se ferme quand le dernier appareil qui l'utilise est retiré ou arrêté, et le suivant qui démarre le rouvre. Les appareils sont appariés sur l'adresse telle qu'écrite : `udp://:4840`, `udp://0.0.0.0:4840` et `udp://[::]:4840` sont trois adresses pour HotLoop, et leur coexistence dépend du système d'exploitation, comme toujours. Un groupe multicast rejoint sur deux cartes différentes fait deux sockets. Rien ne change pour un appareil seul sur son adresse.
- Le groupe, le port et la carte appartiennent à l'appareil : rien n'est figé dans HotLoop. `udp://239.192.0.1:4850` avec `"interface":"eth0"` rejoint ce groupe sur cette carte, et `udp://127.0.0.1:4842` écoute un éditeur sur la même machine. Plusieurs appareils peuvent écouter en même temps sur des groupes et des ports différents, ou sur le même.
- `interface` est la carte réseau sur laquelle un groupe multicast est rejoint, par son nom (`eth0`, `lo`) ou par l'une de ses adresses IPv4 (`127.0.0.1`). Une machine avec plus d'une carte en a besoin. Un éditeur sur la même machine qui envoie à un groupe par loopback (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, loopback activé, sans route) est entendu par un appareil avec `"interface":"lo"` ou `"127.0.0.1"` ; sans interface nommée et sans route, l'adhésion échoue avec `no such device` et le dit.
- `dataSets` ne sert que pour RawData, qui ne transporte aucun type sur le réseau : les types de champs de l'éditeur, dans l'ordre, pour que les octets puissent être lus. Les messages Variant et DataValue transportent les leurs. Chaque entrée est un nom de type (`"Float"`), et peut aussi dire comment un bloc de valeurs est disposé : `"Float*250"` désigne 250 champs à la suite sans longueur devant, comme l'écrit un automate qui envoie un bloc de REAL comme champs séparés ; `"Float[250]"` est un champ tableau d'au plus 250 valeurs, écrit comme la pile de l'OPC Foundation écrit un tableau RawData (un compteur Int32, les valeurs, et un remplissage de zéros jusqu'à 250) ; et `"String(40)"` est un String rempli jusqu'à 40 octets, seul ou sous la forme `"String(40)[4]"`.
- Les key frames remplacent les champs d'un DataSet ; les delta frames modifient ceux qu'elles nomment ; les keep alives prouvent que l'éditeur est vivant. Un message perdu (un trou dans les numéros de séquence) marque les tags de ce DataSetWriter comme **incertains** jusqu'à sa prochaine key frame, puisqu'un delta peut s'être perdu avec lui. Un changement de la version de configuration du DataSet fait oublier tous les champs jusqu'à ce qu'une key frame dise ce qu'ils signifient maintenant.
- Un writer silencieux pendant `timeoutMs` (30 secondes sauf réglage) est lu **mauvais** avec cette précision, et un appareil dont rien n'a été entendu de l'éditeur dans le délai est hors service. Un champ que l'éditeur marque Bad est mauvais, et un champ qu'il marque Uncertain est incertain ; la raison est le code d'état.
- L'heure de la lecture est celle de l'éditeur, prise dans le champ, le DataSetMessage ou le NetworkMessage, quand elle est définie et pas à plus d'une minute en avance sur cette horloge, et l'heure d'arrivée sinon.
- Les tableaux sont lus dans les messages Variant et DataValue (un compteur Int32 et les valeurs, OPC 10000-6 5.2.2.16 ; un tableau multidimensionnel arrive à plat, ligne par ligne) et, avec une disposition, dans RawData. Un compteur que le datagramme ne peut pas contenir est refusé avant que quoi que ce soit soit créé pour lui.
- Lecture seule. La sécurité des messages (NetworkMessages signés ou chiffrés), les messages fragmentés, les messages de découverte, les événements et les champs de structure ne sont pas pris en charge ; un datagramme qui en contient un est refusé, compté par raison, et jamais deviné.

**Publier.** Désactivé tant que `HOTLOOP_UADP_PUBLISH_ENABLED` n'est pas défini, dans Edge et Gateway (les produits qui ont le serveur OPC UA). Il envoie les tags qu'une disposition nomme :

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Variable | Valeur par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` pour un groupe multicast, `udp://host:4840` pour un seul abonné |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` ou `_LAYOUT` | | la disposition ci-dessus, en fichier ou en ligne (le fichier l'emporte) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | un nombre ou un texte |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | au plus ce nombre d'intervalles entre key frames |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | champs DataValue (valeur, état, heure) au lieu de Variants |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | un DataSet qui a changé part en delta frame (seulement les champs modifiés) entre les key frames |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | les noms et types de champs de chaque DataSet sont annoncés tous les tant d'intervalles ; `0` n'en envoie aucun |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | celle du système, `1` | la carte par laquelle le multicast sort, et sa limite de sauts |

Chaque DataSet part sur son propre DataSetWriter, un NetworkMessage chacun. Un DataSet dont les valeurs ont changé part en key frame (tous les champs), un qui n'a pas changé en keep alive, et une key frame au moins tous les `KEY_FRAME_EVERY` intervalles pour qu'un abonné arrivé tard converge. Une key frame est complète, donc un datagramme perdu coûte un intervalle et non une valeur fausse. Avec `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true`, un DataSet qui a changé part plutôt en delta frame, qui ne porte que les champs modifiés depuis le dernier message et leurs positions, et la key frame arrive toujours au moins tous les `KEY_FRAME_EVERY` intervalles ; un delta perdu coûte alors jusqu'à ce nombre d'intervalles avec un champ périmé, ce qui est le prix d'un message plus petit sur une liaison lente. L'abonné de HotLoop lit les delta frames. value. Un tag mauvais est publié comme son état et jamais comme sa dernière valeur ; un tag dont rien n'a encore été lu est publié comme `BadWaitingForInitialData`. Les valeurs sont bornées à leur type publié, non enroulées. La sécurité des messages n'est pas prise en charge, donc cela relève d'un réseau auquel l'usine fait confiance. Les tags de la même disposition peuvent être lus par l'abonné de HotLoop sur une autre machine.

**Ce qui a été prouvé.** Une pile OPC UA PubSub indépendante publie vers l'abonné de HotLoop et s'abonne au publieur de HotLoop en multicast, et le publieur de HotLoop est lu correctement par l'abonné de HotLoop. **Sécurité des messages.** Un appareil abonné peut exiger que les NetworkMessages de son publieur soient signés, ou signés et chiffrés (OPC 10000-14 7.2.4.4.3), avec les deux politiques que définit la spécification, `PubSub-Aes128-CTR` et `PubSub-Aes256-CTR` :

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

Les clés sont statiques : définies des deux côtés sous un SecurityTokenId (`keyId`), en hexadécimal ou en base64. Ce sont des secrets, affichés comme `[redacted]` et conservés à l'enregistrement. Un appareil qui détient deux clés accepte un publieur qui passe de l'une à l'autre. Avec `security` défini, un message qui n'est pas signé (ou pas chiffré, sous `signAndEncrypt`), qui est signé avec une autre clé ou qui a été modifié en route est refusé et compté (`unsecured`, `signature`, `security_key`) avant que quoi que ce soit n'en soit lu. Un Security Key Service (GetSecurityKeys, clés tournantes) n'est pas implémenté. Le publieur signe avec `HOTLOOP_UADP_PUBLISH_SECURITY_MODE` (`sign` ou `signAndEncrypt`), `_POLICY`, `_KEY_ID`, `_SIGNING_KEY`, `_ENCRYPTING_KEY` et `_KEY_NONCE`.

**Métadonnées et découverte.** Un publieur annonce comment s'appellent ses DataSets et de quoi ils sont faits sous la forme d'une réponse de découverte portant un DataSetMetaData, en fragments quand elle est grande (7.2.4.4.4, 7.2.4.6). Un appareil abonné les lit : les champs sont nommés dans Browse (`writer1001_<field name>`), un DataSet RawData n'a pas besoin de types `dataSets` dans la configuration parce que les métadonnées le disposent, et un DataSet qui change sa version de configuration repart de sa prochaine key frame. Les `dataSets` de la configuration l'emportent toujours quand les deux sont là. La demande de découverte d'un abonné n'est pas envoyée, et un publieur n'en traite aucune.

**Champs de structure, événements.** Un champ que les métadonnées disent être une structure est lu comme ses membres, qu'un tag adresse comme `1001/0.Value` (et `1001/7[2].Angle` pour un élément d'un tableau de structures) ; une structure envoyée dans un Variant est lue quand les métadonnées la décrivent. Les structures à champs optionnels et les unions sont signalées par leur nom, non devinées. Un DataSetMessage d'Event est appliqué comme les champs qu'il porte et laisse le reste tranquille (`Events` dans les statistiques de l'appareil) ; sa disposition est celle d'une key frame (7.2.4.5.7), lue dans la spécification et non vérifiée contre une autre pile. Certains publieurs écrivent un FieldCount avant une key frame RawData, ce que la spécification ne fait pas ; on l'indique à l'appareil avec `"rawFieldCount":true`.

### CODESYS

Un automate qui exécute un runtime CODESYS Control (Linux SL, ARM64, Raspberry Pi, Windows, l'automate virtuel), lu et écrit par les noms que son programmeur a donnés aux variables : `Application.GVL_Line.rTemp`, pas un identifiant de nœud. C'est le pilote OPC UA avec ce dont un automate CODESYS a besoin en plus, de sorte que tout ce qui figure dans [OPC UA : sécurité et identifiants](#opc-ua-sécurité-et-identifiants) vaut pour lui et que ses options sont ces options.

**Les alarmes propres de l'automate.** Un projet avec une Alarm Configuration garde ses alarmes dans le gestionnaire d'alarmes de l'automate. Avec le bloc de la bibliothèque HotLoop Alarms dans le projet (voir CODESYS alarms), HotLoop affiche ces alarmes dans sa liste d'alarmes, dès que l'appareil est connecté, et un acquittement fait dans HotLoop retourne au gestionnaire d'alarmes. Vérifié en direct contre un vrai runtime CODESYS Control for Linux SL 4.22.0.0 : déclenchement, acquittement, réinitialisation et confirmation. Les listes de textes propres du gestionnaire d'alarmes et une classe autre que les deux essayées ne sont pas vérifiées.

**Pourquoi le serveur OPC UA, et ce que cela signifie pour l'automate.** CODESYS documente une seule voie pour qu'un tiers lise les variables d'un contrôleur, et c'est le serveur OPC UA du runtime lui-même : la Symbol Configuration de l'application (ou, depuis CODESYS 3.5 SP18, un IEC Symbol Set sous le Communication Manager) dit quelles variables sont publiées et avec quel accès, et le serveur les sert. Le protocole de canal du CODESYS Gateway n'est pas documenté pour les tiers et ce pilote ne le parle pas. L'automate doit donc publier ce que vous voulez voir :

1. Dans l'IDE, ajoutez une **Symbol Configuration** à l'application, avec *Support OPC UA features* activé, et cochez les variables, ou marquez-les dans la déclaration avec `{attribute 'symbol' := 'readwrite'}` (`'read'` pour la lecture seule).
2. Téléchargez. Un automate sans Symbol Configuration répond à la mise en place par un message qui dit d'en ajouter une.
3. Une variable n'est modifiable depuis HotLoop que si son symbole est `readwrite` et que l'utilisateur sous lequel il se connecte a le droit de l'écrire (les *Symbol Rights* de l'appareil). HotLoop lit le niveau d'accès et dit lequel des deux a refusé une écriture.

Sources : [CODESYS help, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) et [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (le nom du symbole est `<application>.<POU>.<variable>`, l'accès est lecture, écriture ou exécution par symbole, les droits des groupes sont dans l'onglet Symbol Rights de l'appareil, et OPC UA exige un certificat sur le contrôleur) ; le [PLCopen OPC UA information model for IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (version 1.02, la disposition ci-dessous) ; OPC UA Part 5 (OperationLimits). Les identifiants de nœud sont ceux qu'a répondus un runtime 4.22.0.0, contre lequel ce pilote a été écrit ; l'orthographe exacte de `|var|` est celle du runtime, pas un contrat publié, c'est pourquoi un tag est adressé par symbole et que le pilote construit l'identifiant de nœud.

**Disposition.** Le runtime publie, dans le `DeviceSet` d'OPC UA Device Integration, un appareil pour l'automate, `Resources` en dessous, et l'application sous cela, avec `GlobalVars` (les listes de variables) et `Programs` en dessous. Le nœud d'une variable est `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` dans l'espace de noms `CODESYSSPV3/3S/IecVarAccess`. Le pilote trouve l'appareil et l'application par exploration : un tag survit donc au renommage du projet.

**Adresses.** Un symbole IEC, avec ou sans l'application :

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Découvrir les tags** liste ce que l'application exporte, avec les types qu'elle a : un STRING devient `string`, un BYTE `uint16`, un TIME `int64` (millisecondes), une énumération `int32`, les largeurs entières gardent la leur, REAL et LREAL deviennent `float`. Le runtime dit qu'un STRING, BYTE ou TIME est un type du modèle PLCopen (par exemple `ns=3;i=3013`) ; le pilote suit ses références `HasSubtype` jusqu'au type standard dont il est une variété, ce qui est aussi la façon dont une écriture vers un BYTE est envoyée comme Byte. Chaque variable porte l'accès donné à son symbole. Une structure et un tableau sont parcourus : un point par champ et par élément. Il laisse de côté les propriétés propres au runtime (`|vprop|`), la liste des tâches et l'objet Server.

Un tableau liste ses 32 premiers éléments (`arrayElements`), parce qu'un tampon de mille éléments ne représente pas mille choses pour un tableau de bord, et qu'un tag peut de toute façon adresser n'importe quel élément par son symbole. La liste s'arrête à `browseMaxNodes` et le dit ; `browseRoot` placé sur un symbole (`Application.GVL_Demo`) liste une partie de l'application. L'exploration se fait en largeur, de sorte que les variables d'une liste viennent avant les éléments de ses tableaux, et les réponses sont maintenues à une taille que le runtime accepte (il ferme la connexion sur une réponse de cent tableaux de mille éléments).

Configuration : les options OPC UA, et `device` (le nom de l'automate, seulement si le runtime en liste plus d'un), `application` (seulement si aucune ne s'appelle Application), `arrayElements`, `alarmSymbol` (le bloc HotLoop Alarms, seulement pour éviter sa recherche). Une option mal orthographiée est une erreur qui liste les options valides. Le mot de passe est un secret, stocké et masqué comme tout secret d'appareil.

**Ce que le runtime demande à un client.** Il publie des `OperationLimits` de 100 pour les lectures, explorations et éléments surveillés par requête, et refuse une requête plus grosse avec `BadTooManyOperations`. Le pilote lit ces limites à la connexion et découpe chaque requête pour les respecter, pour tout appareil OPC UA (un runtime CODESYS a été le premier pour lequel cela a compté : avant cela, le pilote déclarait chaque tag découvert comme float et ne lisait aucun des tags d'un appareil de plus de 100). L'échantillonnage est d'une seconde par défaut et la file d'un élément, parce qu'un automate a un cycle à respecter et qu'une passerelle Ignition qui le lit déjà ne doit pas se le voir retirer ; définissez `samplingIntervalMs` pour en demander plus.

**Téléchargements, redémarrages et liaison perdue.** Un redémarrage du runtime, ou le chargement d'un nouveau programme, coupe la session. L'appareil passe en déconnecté, chaque tag est lu mauvais avec la raison « le runtime de l'automate ne répond pas », et HotLoop se reconnecte seul avec temporisation et lit les symboles tels qu'ils sont maintenant. Un symbole qui était lu et qui est refusé comme disparu deux fois de suite est pris pour un téléchargement où le runtime a gardé la session, et la session est abandonnée pour la même reconnexion. Un tag d'une variable que le programme n'a pas est lu mauvais avec la raison du serveur et ne provoque pas de reconnexion.

**Sécuriser le serveur OPC UA du runtime.** Un runtime CODESYS Control ne propose que des endpoints non sécurisés tant que son serveur OPC UA n'a pas de certificat, puis il propose aussi les politiques de sa `CommunicationPolicy` (AES128-SHA256-RSAOAEP par défaut, Basic256Sha256, AES256-SHA256-RSAPSS) avec Sign et SignAndEncrypt. CODESYS documente la création de ce certificat dans le Security Screen (CODESYS Security Agent, Devices, le contrôleur, OPC UA Server) et la confiance accordée à un client en déplaçant son certificat de « Certificates in Quarantine » vers « Trusted Certificates ». Le PLC shell du runtime Linux fait la même chose sans l'IDE, avec des commandes que CODESYS liste pour le PLC shell de l'éditeur d'appareil (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), par le socket Unix que le runtime Linux documente pour cela (`/var/opt/codesyscontrolapi/plcshell.sock`, « Accessing the PLC Shell »). Mettez l'appareil en `securityMode` `SignAndEncrypt` avec un `securityPolicy`, connectez-vous une fois (le certificat propre de HotLoop atterrit dans la quarantaine du runtime et la connexion est refusée, avec un message qui le dit), faites confiance à ce certificat, et l'appareil lit. Non montrés : le Security Screen de l'IDE, un certificat signé par une CA, la gestion des utilisateurs avec un runtime sécurisé.

**Un runtime sans licence s'arrête de lui-même.** Un runtime CODESYS Control sans licence tourne en mode démo et s'arrête au bout d'environ deux heures (le journal du runtime dit `no runtime license - running in demo mode(~2 hours)` à chaque démarrage). Du côté de HotLoop, c'est un redémarrage du runtime comme un autre : l'appareil passe en déconnecté avec « le runtime de l'automate ne répond pas » et revient tout seul dès que quelque chose redémarre le runtime (la politique de redémarrage d'un conteneur, une unité systemd). Rien dans HotLoop ne compte les deux heures ni ne traite l'arrêt différemment, et rien ne redémarre le runtime à votre place ; un runtime qui n'est pas redémarré reste déconnecté. Testé sur un runtime 4.22.0.0 dans un conteneur sans licence : il s'est arrêté de lui-même 2 heures et 5 minutes après son démarrage, avec le code de sortie 0 ; la politique de redémarrage du conteneur l'a relancé 31 secondes plus tard, son application tournait 82 secondes après, et l'appareil a de nouveau lu correctement 35 secondes après le démarrage de l'application (2 minutes et 28 secondes après l'arrêt), sans aucune intervention manuelle.

**Écritures.** Un tag est en lecture seule tant que quelqu'un ne le marque pas modifiable, comme pour tout appareil, et rien de ce que crée une mise en place ne l'est. Ensuite, la porte d'écriture est celle d'OPC UA, avec la part de l'automate devant elle : une écriture vers un symbole exporté en lecture seule, ou que l'utilisateur n'a pas le droit d'écrire, est refusée dans les mots de l'automate et jamais envoyée.

**Mise en place depuis le flux d'intégrations** (`codesys`) : l'adresse du runtime, les questions de sécurité OPC UA et, en option, un premier tableau de bord des points conservés (l'écran qu'aurait été WebVisu ; voir [Intégrations](/fr/iot/integrations/#codesys)). Vérifié contre un runtime 4.22.0.0 dans un conteneur ; voir le tableau d'état pour ce que cela ne couvre pas.

### Modbus TCP/RTU

La bête de somme de 1979. Automates, variateurs, compteurs d'énergie, RTU, et le recours de chaque passerelle qui n'a rien de mieux.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**L'ordre des mots** est le réglage que l'on rate le plus, et un float lu avec le mauvais ordre n'est pas manifestement faux à l'écran : c'est un nombre plausible qui n'est pas la vérité. Les quatre permutations sont prises en charge sous les noms qu'impriment les manuels des fabricants : `ABCD`, `CDAB`, `BADC`, `DCBA`. Définissez une valeur par défaut de l'appareil avec `byteOrder` et remplacez-la par tag avec le quatrième champ de l'adresse.

**L'adressage** est brut et base zéro. Si vos schémas utilisent la numérotation traditionnelle de type 40001, mettez `oneBased: true` et écrivez les numéros des schémas. Se tromper d'un est le plus vieux bug de Modbus.

Les lectures sont fusionnées en blocs : des registres adjacents et presque adjacents deviennent une seule requête. `maxGap` contrôle combien de registres inutilisés valent la peine d'être lus pour éviter un deuxième aller-retour (8 par défaut), `maxBlock` plafonne une requête (120 par défaut, plafond du protocole 125).

Écrire un seul bit d'un registre de maintien est une lecture-modification-écriture, car Modbus n'a pas de mise à un atomique de bit à cet endroit. Les quinze autres bits sont préservés.

### MQTT et Sparkplug B

MQTT simple, ou Sparkplug B comme **application hôte primaire complète**.

Topics simples :
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Métriques Sparkplug :
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

En tant qu'hôte primaire, le pilote fait ce que demande la spécification et que la plupart des intégrations omettent :

- Publie une naissance `STATE` retenue avec un will correspondant, pour que les nœuds edge voient l'hôte tomber au lieu de le déduire d'un délai. Forme Sparkplug 3.0 (`spBv1.0/STATE/<host>` portant du JSON) par défaut ; définissez `legacyState` pour la chaîne `ONLINE`/`OFFLINE` d'avant la 3.0.
- Suit le numéro de séquence glissant de chaque nœud et demande à un nœud de renaître quand il en saute un, car un trou signifie que des messages ont été manqués et que la table d'alias n'est plus fiable.
- Demande une renaissance après sa propre reconnexion. Un hôte qui était absent ne sait pas ce qui a changé pendant son absence.
- Associe `NDEATH` à `NBIRTH` par `bdSeq`, de sorte qu'un certificat de décès resté d'une session précédente ne puisse pas tuer la session courante.

L'ordre des messages est imposé. Livrer des messages Sparkplug de façon concurrente les réordonne, ce qui fait paraître un nœud sain comme s'il perdait des messages et provoque une tempête de renaissances.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix et Micro820. Les tags ont des noms, on peut donc demander au contrôleur ce qu'il contient.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP est fortement typé et le contrôleur rejette une lecture dont le type déclaré ne correspond pas : le type doit donc venir de quelque part. Il est pris dans le `dataType` du tag, ou dans un suffixe `:type` qui l'emporte. L'inconnu retombe sur `REAL`, ce que sont la plupart des valeurs de procédé.

Les lectures sont groupées en requêtes multi-services, avec repli sur des lectures individuelles quand un lot échoue, afin qu'un mauvais chemin de tag n'aveugle pas les dix-neuf autres.

### S7comm

Siemens S7-300, 400, 1200 et 1500, en ISO-on-TCP par rack et slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

Le type est obligatoire pour tout ce qui dépasse un octet. Le protocole ne peut pas vous dire si quatre octets sont un REAL ou un DINT : c'est un fait sur le programme de l'automate, pas sur le fil.

Par défaut rack 0, slot 1 (S7-1200/1500). Les S7-300/400 sont généralement en slot 2. `connectType` vaut 3 par défaut (S7 Basic) pour que la passerelle n'occupe pas l'emplacement de connexion PG qu'un ingénieur veut pour TIA Portal.

Il n'y a pas d'exploration. Une CPU S7 ne publie pas la structure de ses blocs de données, qui vit dans le projet TIA Portal.

### MTConnect

Télémétrie de machine-outil en lecture seule. MTConnect n'a pas de canal de commande, et ce pilote ne fait pas semblant du contraire.

Adressez par `dataItemId` ou par nom ; les agents ne sont pas cohérents sur celui qui est stable, et la documentation des machines montre l'un ou l'autre.

Deux détails qui séparent une intégration qui fonctionne d'une intégration seulement plausible : `UNAVAILABLE` est l'agent qui dit explicitement qu'il n'a pas de lecture, cela devient une mauvaise qualité, pas le texte « UNAVAILABLE » et pas zéro. Et le sens d'une Condition est le nom de son élément (`Normal`, `Warning`, `Fault`, `Unavailable`), pas ses données de caractères, qui sont généralement vides.

`Browse` lit `/probe` et parcourt l'arbre des composants à n'importe quelle profondeur.

### HTTP / REST

Le fourre-tout, pour les compteurs d'énergie, capteurs d'ambiance, contrôleurs d'équipementiers et le côté REST d'une passerelle qui parle autre chose de propriétaire en dessous.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Cette troisième forme est celle qui compte : ces API adorent renvoyer un tableau non ordonné d'objets `{name, value}`, et indexer par position est un bug qui attend une mise à jour de firmware.

Une requête sert chaque tag de l'appareil. `Browse` parcourt le document et signale chaque scalaire avec le chemin qui y mène.

### Santé de la machine

La machine sur laquelle tourne HotLoop, comme appareil en lecture seule : `cpu_util_pct` (temps CPU non inactif depuis la dernière lecture), `mem_util_pct` (MemTotal contre MemAvailable), `disk_util_pct` (le disque de la machine, un statfs de la racine de l'hôte montée en lecture seule à `diskPath`, `/host` par défaut), `data_util_pct` (le volume à `dataPath`, `/data`, ou le dossier existant le plus proche au-dessus quand rien n'y est encore monté), et `rtos_jitter_core1_us` à `core3_us` quand `jitterFile` désigne le fichier JSON `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` qu'un agent temps réel réécrit (un fichier de plus de cinq minutes se lit comme mauvais). Le CPU et la mémoire viennent de `procRoot` (`/proc`, ou `/host/proc` quand celui de l'hôte est monté). Une valeur qui ne peut pas être lue est de mauvaise qualité avec la raison, jamais zéro. L'appareil est créé par `HOTLOOP_BOX_HEALTH_NODE` ([Le serveur OPC UA](/fr/edge/opc-ua-server/#santé-de-la-machine-pour-le-tableau-de-bord-embernet)).

### Shelly

Un Shelly de toute génération auquel on parle directement, sans broker au milieu. Voir SHELLY.md. Ajoutez un appareil avec le protocole `shelly` et l'adresse de l'appareil ; s'il a un identifiant, `{"password":"..."}` (l'utilisateur est `admin` ; un appareil Gen2 ou plus récent répond avec son défi de condensat SHA-256 et un appareil Gen1 avec Basic). `/shelly` dit de quelle génération il s'agit. Un appareil Gen2, Gen3 ou Gen4 est lu avec `Shelly.GetStatus` (`POST /rpc`) et chaque composant qu'il signale devient des tags qui s'ajoutent d'eux-mêmes, en lecture seule jusqu'à ce qu'une personne les arme : `switch:0.output`, `switch:0.apower`, `switch:0.aenergy.total`, `switch:0.temperature.tC`, `input:0.state`, `cover:0.current_pos`, `pm1:0.apower`, `em:0.total_act_power`, `temperature:100.tC`, `humidity:100.rh`, et le `sys.uptime` et le `wifi.rssi` de l'appareil. Un champ que l'appareil n'a pas envoyé ne devient pas un tag. La sortie d'un switch (`Switch.Set`), la sortie et la luminosité d'une lumière, la position d'un volet (`Cover.GoToPosition`) et la consigne d'un thermostat peuvent être armées pour l'écriture.

Un appareil Gen2 ou plus récent obtient aussi un websocket (`ws://<device>/rpc`) : le driver envoie une trame de requête avec un `src`, comme l'exige la page du canal RPC de Shelly avant qu'un appareil notifie, répond à une trame 401 avec l'objet `auth` documenté (SHA-256 sur `dummy_method:dummy_uri`), et intègre `NotifyStatus` et `NotifyFullStatus` dans sa copie de l'état, si bien qu'un changement atteint le tag aussitôt et que le sondage intermédiaire lit la copie plutôt que l'appareil. `NotifyEvent` (un appui de bouton, un changement de configuration) est classé dans le journal de bord sous l'appareil. Quand le websocket est coupé, ou n'a pas confirmé l'état récemment (45 secondes sans trame ni pong, 2 minutes sans lecture complète), le sondage lit l'appareil en HTTP.

Un appareil Gen1 (`/status` et chemins de commande GET simples, identifiant Basic) obtient la même forme de tags à partir de ses propres termes : `relay:0.output`, `meter:0.power`, `meter:0.total` (watts-minutes convertis en Wh), `light:0.output` et `.brightness`, `roller:0.current_pos`, `input:0.state`, `temperature:0.tC`, et pour les compteurs d'énergie et les capteurs `emeter:0.power`, `humidity:0.rh`, `flood:0.alarm`. Un relais s'écrit avec `/relay/<id>?turn=on|off`, une lumière avec `/light/<id>?turn=&brightness=`, un volet roulant avec `/roller/<id>?go=to_pos&roller_pos=`. Construit à partir de la documentation publiée de Shelly pour Gen1 et Gen2 et testé contre des enregistrements d'appareils réels (un Plus 1, un Plug S et une ampoule Vintage) ; pas encore contre un appareil sur un banc. Les champs de compteur d'énergie, d'humidité, de batterie et d'inondation de Gen1 viennent de la documentation et n'ont aucun enregistrement derrière eux.

### Firmata

Un Arduino, ou toute carte exécutant un firmware Firmata, en USB série ou TCP, sans programme hôte au milieu. Voir FIRMATA.md. Ajoutez un appareil avec le protocole `firmata` et le port série (`/dev/ttyACM0`, `serial:/dev/ttyUSB0`) ou `host:port` ; options `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`. Le driver attend la version de protocole de la carte (en la demandant toutes les 300 ms), interroge son firmware, ses capacités et sa carte analogique, et crée un tag en lecture seule pour chaque broche numérique et entrée analogique de la carte. L'adresse d'un tag dit quoi faire d'une broche : `D13`, `D2:in`, `D2:pullup`, `D13:out`, `D9:pwm`, `D10:servo`, `A0`, `I2C:0x48:0x00:2`. L'entrée numérique est le rapport de port que la carte envoie lors d'un changement, l'analogique est le rapport de chaque intervalle d'échantillonnage, et chaque sondage demande la version de protocole pour qu'une carte disparue soit vue en un sondage ; un rapport de firmware qui arrive sans avoir été demandé est une carte qui a redémarré. Une broche que les tags ne mentionnent pas n'est pas touchée, et un simple tag `D<n>` met sa broche en entrée quand le driver se connecte, et en sortie à sa première écriture. Construit à partir du protocole 2.8.0 (protocol.md et i2c.md dans github.com/firmata/protocol) et exécuté contre StandardFirmata 2.5.9 sur un ATmega328P simulé : ses broches numériques, résistances de rappel, entrées analogiques à 0, 2,5 et 5 V, registres de comparaison PWM, la broche d'un servo et les registres d'un appareil I2C ont chacun été relus depuis la puce, et non depuis le driver. Non exécuté sur une carte physique.

### ONVIF

Une caméra IP, un encodeur ou un NVR. Voir ONVIF.md. Ajoutez un appareil avec le protocole `onvif`, l'adresse de la caméra et `{"username":"...","password":"..."}`. Le driver lit d'abord GetSystemDateAndTime et estampille son UsernameToken WS-Security avec l'horloge propre de la caméra (Core Specification 5.12 : le condensat est `base64(SHA-1(nonce + created + password))`), lit GetDeviceInformation et GetServices (GetCapabilities pour une caméra plus ancienne), utilise Media2 quand la caméra le liste et Media quand elle ne le liste pas, et lit l'encodeur, la résolution, l'adresse de flux et l'adresse d'instantané de chaque profil. Une caméra qui veut HTTP Digest ou Basic sur le POST SOAP reçoit cela en réponse. Les adresses de service sont jointes à l'hôte avec lequel l'appareil a été ajouté, sauf `"keepXAddrHosts":true`. Un profil PTZ ajoute `ptz.<token>.pan`, `.tilt`, `.zoom` et `.moving` à partir de GetStatus, et les commandes armables `.move` (ContinuousMove, avec un délai facultatif), `.absolute` (AbsoluteMove), `.goto_preset` (GotoPreset, par jeton ou nom), `.stop` et `.home`. Les événements viennent d'un pull point (CreatePullPointSubscription, PullMessages, Renew, Unsubscribe) et deviennent des tags `event.<topic>|<source>|<item>` qui s'ajoutent d'eux-mêmes, avec chaque changement dans le journal de bord. Un instantané est `GET /api/onvif/<device>/profiles/<token>/snapshot` et la découverte est `POST /api/onvif/discover` (WS-Discovery, un Probe multicast pour `NetworkVideoTransmitter`).

Construit à partir des spécifications ONVIF Core, Media, Media2, PTZ et Event (onvif.org/specs). Chaque requête qu'il envoie est valide face aux fichiers WSDL et XSD d'ONVIF (xmllint, avec les 33 types et un élément que libxml2 refuse pour attribution unique de particules assouplis, aucun n'étant utilisé par une requête), et il est exécuté contre onvif_srvd, une pile ONVIF indépendante qui analyse l'en-tête WS-Security sans le vérifier, si bien que le condensat de l'identifiant est confronté à celui de zeep 4.3.3. Le service d'événements et WS-Discovery n'ont que des scripts écrits d'après la spécification contre lesquels s'exécuter. Non exécuté sur une caméra physique.

### UniFi Network

Le réseau de l'usine comme appareil : un site sur une console UniFi, ses switches, chaque port de switch, la consommation PoE, les liens WAN et la santé du site, sous forme de tags qui se créent d'eux-mêmes à mesure que le matériel est adopté, en lecture seule jusqu'à armement. Une connexion par console, le certificat épinglé, et le mot de passe de la console chiffré dans la base de données. Il ne modifie la console que par les quelques tags de commande qu'une personne arme (une LED de repérage, un redémarrage, un cycle d'alimentation PoE d'un port ; voir UNIFI.md). Il écoute aussi le websocket d'événements de la console, de sorte qu'un switch qui tombe figure dans le journal de bord au moment où cela se produit, l'interrogation restant la vérité en dessous, et l'onglet UniFi dessine la vue d'ensemble, la carte, les faces avant, les clients, les réseaux et le WiFi. Tout à son sujet est dans [UniFi Network](/fr/iot/unifi/).

### UniFi Protect

Les caméras, capteurs, lumières et sirènes d'un NVR Protect, par la Protect Integration API avec une clé d'API de la page Integrations de la console (la clé va dans `{"apiKey":"..."}`, scellée comme un mot de passe de console, et le certificat est épinglé avec `certFingerprint` comme pour UniFi Network). Ajoutez un appareil avec le protocole `unifi-protect` et l'adresse de la console. Les tags s'ajoutent d'eux-mêmes, en lecture seule jusqu'à ce qu'ils soient armés : `cam.<id>.online`, `.motion`, et `.smart_person`, `.smart_vehicle`, `.smart_package`, `.smart_licensePlate`, `.smart_face` et `.smart_animal` pour les types qu'une caméra prend en charge ; `sen.<id>.online`, `.open`, `.motion`, `.leak`, `.tamper`, `.temp_c`, `.humidity_pct`, `.light_lux` ; `light.<id>.online`, `.on`, `.motion` ; `siren.<id>.online`. Le mouvement et les détections intelligentes d'une caméra viennent du websocket d'événements de la console, puisque l'enregistrement REST n'en a aucun, donc ils se lisent comme mauvais, jamais comme "pas de mouvement", tant qu'il est coupé. Chaque événement est dans le journal de bord sous l'appareil. Le `.play` d'une sirène est armé pour l'écriture (`true` joue, `false` arrête), de même que `alarm.<trigger>.fire`, qui envoie le webhook du gestionnaire d'alarmes pour l'id de déclencheur que la personne a créé dans Protect, si bien qu'une alarme HotLoop qui l'écrit fait enregistrer les caméras. L'instantané d'une caméra est `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`, un JPEG récupéré quand on le demande. Construit à partir du document OpenAPI d'Ubiquiti pour Protect 7.4.102 ; pas encore exécuté contre une console. Voir [UniFi Network](/fr/iot/unifi/#unifi-protect).

### UniFi Access

Les portes d'une console Access, par l'API développeur d'Access sur le port 12445 avec un jeton d'API de ses paramètres avancés (`{"token":"..."}`, scellé). Ajoutez un appareil avec le protocole `unifi-access` et l'adresse de la console. Par porte, `door.<id>.open` (le capteur de position ; une porte qui n'en a pas se lit comme mauvaise, jamais fermée), `door.<id>.unlocked` (le relais de la serrure), et `door.<id>.unlock`, qu'une personne arme et qui déverrouille la porte quand on écrit `true`, par le sas d'écriture et audité comme toute écriture ; la console la reverrouille selon sa propre règle. Le websocket de notifications garde la position et le verrou à jour entre les sondages, et chaque changement ("1F - Front: opened", "unlocked") est dans le journal de bord sous l'appareil. Construit à partir de l'API telle que la parle le client ouvert maintenu (py-unifi-access, MIT) ; pas encore exécuté contre une console. Voir [UniFi Network](/fr/iot/unifi/#unifi-access).

### SNMP

Tout ce qui a un agent SNMP : switches, onduleurs, PDU, compteurs d'énergie, et chaque machine Linux qui exécute un agent SNMP. Lecture seule. HotLoop n'envoie jamais de SNMP SET, parce qu'un SET peut modifier la configuration d'un switch et que le but de ce pilote est de voir le réseau de l'usine, pas de le piloter.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

L'adresse d'un tag est l'OID d'une instance, des nombres séparés par des points. Un scalaire se termine par `.0` ; une cellule de table se termine par l'index de sa ligne. Le `dataType` du tag décide de ce qu'il devient :

* Un nombre envoyé par l'agent (Integer, Gauge32, Counter32, Counter64, TimeTicks) est ce nombre. L'échelle et le décalage s'appliquent comme partout.
* Un OCTET STRING est du texte, sauf si le tag est un nombre, auquel cas il est analysé. C'est ainsi qu'arrive une charge moyenne (`laLoad` est le texte `0.15`) ou une température derrière un agent. Un texte qui n'est pas un nombre est une mauvaise lecture qui le dit, jamais zéro.
* Un OCTET STRING non imprimable (une adresse MAC) est `0x` suivi de l'hexadécimal.

**Les compteurs sont bruts.** Un Counter32 ou Counter64 ne fait que monter et repasse à zéro. Le tag contient ce que l'agent a envoyé, et un débit est l'affaire de ce qui lit le tag. Counter64 est conservé comme float, exact jusqu'à 2^53 ; un port à la vitesse de ligne met des décennies à y arriver.

**TimeTicks sont des centièmes de seconde**, donc `sysUpTime` lu comme un tag simple est en 1/100 s. L'intégration le convertit en secondes pour vous ; un tag fait à la main doit mettre `scale` à `0.01`.

**Un objet que l'agent n'a pas est une mauvaise lecture avec la raison**, et les autres de la même requête sont quand même lus : v2c et v3 disent lesquels manquaient, et pour v1, qui répond à un objet manquant par une erreur pour toute la requête, le pilote retire celui-là et redemande le reste. Une réponse trop grosse pour l'agent est redemandée en deux moitiés.

Options de l'appareil (`config`) :

| Option | Signification |
|---|---|
| `version` | `1`, `2c` ou `3`. Par défaut `2c` |
| `community` | La communauté v1 et v2c. Obligatoire pour celles-ci, et **il n'y a pas de valeur par défaut** : `public` est la façon dont les switches d'une usine se font lire par quiconque demande. Un secret |
| `username` | L'utilisateur v3 |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` ou `authPriv`. Par défaut : `authPriv` avec une phrase secrète de confidentialité, `authNoPriv` avec seulement une phrase d'authentification, sinon `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` ou `SHA512`. Par défaut `SHA` |
| `authPassword` | La phrase secrète d'authentification. Un secret |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` ou `AES256C`. Par défaut `AES` |
| `privPassword` | La phrase secrète de confidentialité. Un secret |
| `contextName` | Le contexte v3. Presque toujours vide |
| `transport` | `udp` (par défaut) ou `tcp` |
| `retries` | Combien de fois une requête restée sans réponse est renvoyée, de 0 à 10. Par défaut 1 |
| `maxRepetitions` | Lignes par GETBULK dans un parcours. Par défaut 10, ce que répondent les plus petits agents |
| `browseRoots` | OID à parcourir lors de la découverte des points. Par défaut : system, les tables d'interfaces, host resources, la table de charge et les sorties extend d'un agent SNMP |
| `browseMaxNodes` | Où s'arrête une exploration. Par défaut 2000 |

L'adresse est `host` ou `host:port`, port 161 par défaut.

**Une mauvaise communauté ne reçoit aucune réponse.** Un agent SNMPv1 ou v2c ignore une requête portant une communauté qu'il ne connaît pas : une mauvaise communauté, un mauvais port, un pare-feu et un agent arrêté ressemblent donc tous à un délai dépassé, et le message de HotLoop cite les quatre. SNMPv3 les distingue : une mauvaise phrase secrète ou un utilisateur inconnu est refusé comme tel (`ErrAuthRejected`), et HotLoop attend longtemps avant de réessayer les mêmes identifiants.

`Browse` parcourt les sous-arbres que HotLoop sait nommer et donne un nom à chaque objet : celui de la MIB, comme `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, ou l'OID sous la forme `oid.1.3.6.1...` pour un objet qu'il ne connaît pas. Les noms, ainsi que les OID, types et unités qui les sous-tendent, viennent des MIB qui les définissent : SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) et UCD-SNMP-MIB et NET-SNMP-EXTEND-MIB d'un agent SNMP. Tout le reste de ce que l'agent a est quand même lu ; ajoutez-le comme tag par OID.

L'intégration (voir [Intégrations](/fr/iot/integrations/#snmp)) fait les demandes à votre place.

### BACnet/IP

Un contrôleur d'automatisation de bâtiment, un compteur, un thermostat : tout ce qui est sur le réseau IP et parle BACnet. Lecture seule. HotLoop n'écrit jamais une propriété BACnet, car une écriture atterrit sur une sortie commandable via un tableau de priorités, et une priorité laissée en place maintient l'équipement là où on l'a mis, bien après que celui qui l'a posée soit rentré chez lui. C'est une fonction à concevoir exprès, pas à laisser traîner.

Il est tenu à des trames enregistrées sur un vrai appareil, décodées par des tests qui s'exécutent toujours, et à cet appareil lors des essais.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

L'adresse d'un tag est l'objet, `<type>:<instance>`, puis un point et une propriété quand ce n'est pas la valeur courante. Les types, par nom ou abréviation : `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) et `characterstring-value` (`csv`). Les propriétés par nom sont `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` et `application-software-version` ; toute autre propriété est son numéro.

Ce qu'un tag devient dépend de son `dataType` : un nombre envoyé par l'appareil (real, double, unsigned, signed, enumerated, boolean) est ce nombre, et le `active` d'un objet binaire vaut 1 et le `inactive` vaut 0 ; une chaîne de caractères est du texte, ou un nombre si le tag en est un et que le texte est un nombre ; une valeur courante `null` est une mauvaise lecture qui dit que l'appareil n'a rien à signaler. Une propriété qui contient plus d'une valeur (une liste d'objets) ne peut pas être un tag.

**Les indicateurs d'état font partie de la lecture.** Chaque interrogation demande les indicateurs d'état d'un objet dans la même requête que sa valeur courante, et un objet dont l'indicateur de **défaut** est levé est lu **mauvais**, avec la raison. Un objet **hors service** ou **forcé** est lu **incertain** : sa valeur courante est quelque chose qu'une personne ou un programme y a mis, pas une mesure, et les courbes de tendance et les rapports écartent les lectures incertaines comme les mauvaises (la règle de qualité). **En alarme** seul est une bonne lecture d'un point qui est en alarme.

**Ce que l'appareil n'a pas est une mauvaise lecture avec la raison, et le reste est quand même lu.** ReadPropertyMultiple répond à chaque propriété séparément : un objet qui n'existe pas (`unknown-object`) ou une propriété qu'il n'a pas (`unknown-property`) fait échouer ce tag et aucun autre. Un appareil qui refuse ReadPropertyMultiple est lu une propriété à la fois à partir de là.

**Rien n'est segmenté.** Le client dit à l'appareil qu'il ne peut pas recevoir de réponse segmentée. Un appareil dont la réponse ne tiendrait pas dans une trame abandonne (`segmentation-not-supported`), et HotLoop demande deux fois moins d'objets à la fois ; un appareil dont la liste d'objets est trop grosse pour être envoyée en entier est lu un élément à la fois.

Options de l'appareil (`config`) :

| Option | Signification |
|---|---|
| `deviceInstance` | Le numéro d'instance que l'appareil à cette adresse est censé avoir. Quand il est défini et que l'appareil en annonce un autre, la connexion est refusée : un autre appareil qui répond à une adresse réutilisée, ou un contrôleur remplacé, est la façon dont une usine se retrouve avec un nombre faux d'apparence propre |
| `localAddress` | L'adresse de la carte réseau de cette machine depuis laquelle envoyer, pour un hôte qui en a plus d'une. Généralement vide |
| `retries` | Combien de fois une requête restée sans réponse est renvoyée, de 0 à 10. Par défaut 1 |
| `browseMaxObjects` | Où s'arrête une exploration. Par défaut 1000 |

L'adresse est `host` ou `host:port`, port 47808 par défaut. Rien dans BACnet/IP n'est un identifiant, il n'y en a donc aucun à masquer.

**Se connecter demande à l'appareil qui il est.** HotLoop envoie à l'appareil un Who-Is unicast et prend son instance d'appareil dans le I-Am. Un appareil qui ne répond pas à ce Who-Is se voit demander son propre objet appareil sous l'instance générique (4194303), à laquelle le standard dit qu'un appareil répond en tant que lui-même. Un appareil qui ne répond à aucun est signalé avec les deux essayés, car les raisons habituelles se ressemblent : une mauvaise adresse ou un mauvais port, un pare-feu, un appareil arrêté, ou un appareil sur un réseau derrière un routeur.

**Le routage n'est pas construit.** HotLoop parle à un appareil auquel il peut envoyer un datagramme UDP. Un contrôleur sur un tronc MS/TP derrière un routeur BACnet, ou sur un autre réseau BACnet, n'est pas joignable, pas plus qu'un appareil que seul un BBMD peut atteindre (enregistrement d'appareil étranger). Adressez le côté BACnet/IP du routeur lui-même, ou placez une passerelle devant : voir [mode passerelle](#tout-le-reste-le-mode-passerelle).

`Browse` lit l'objet propre de l'appareil (son nom, son fabricant, son modèle et son firmware), sa liste d'objets, et chaque objet que HotLoop lit : nom, description, unités, valeur courante et indicateurs d'état, et le texte d'état d'un objet multi-états. Un tag prend le nom propre de l'objet, avec l'adresse ajoutée quand deux objets le partagent. Les unités deviennent un libellé et, quand elles en désignent une, une classe d'entité : les degrés Celsius sont `°C` et `temperature`, le pourcentage d'humidité relative est `%` et `humidity`, le kilowattheure est `kWh` et `energy`. Une unité pour laquelle HotLoop n'a pas de libellé est laissée sans libellé et nommée dans la description par son numéro. Les numéros et noms de ces unités sont tenus à un vrai appareil, qui envoie le numéro que sa propre table donne à chaque nom. L'intégration (voir [Intégrations](/fr/iot/integrations/#bacnetip)) fait les demandes à votre place.

## Vers l'extérieur : l'API Kafka

Tout ce qui précède fait entrer les valeurs d'un appareil. HotLoop peut aussi les envoyer vers un broker Kafka comme flux d'événements : chaque lecture que conserve l'historien, et chaque ligne du journal système (alarmes, appareils qui tombent et reviennent, changements), en JSON sur les topics que vous nommez. C'est une cible d'historien, réglée dans Paramètres, Cibles d'historique, et elle accepte Apache Kafka, Redpanda et tout ce qui parle l'API Kafka, en TLS avec une connexion SASL. Les formats d'enregistrement, ce que signifie « au moins une fois » ici, et ce qui est ou n'est pas prouvé se trouvent dans [Cibles d'historien](/fr/iot/historian-targets/#api-kafka-flux-dévénements). Le client est [franz-go](https://github.com/twmb/franz-go).

## Tout le reste : le mode passerelle

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Ceux-ci ne sont pas parlés en natif et il n'y a pas de pilote pour eux. C'est un choix délibéré, pas un trou à combler avec un stub.

Les sites qui utilisent ces protocoles ont presque toujours déjà une passerelle qui republie en OPC UA ou en Modbus : un contrôleur PROFINET IO avec un serveur OPC UA, un multiplexeur HART avec une carte Modbus. Pointez un appareil vers cet endpoint et configurez-le en OPC UA ou en Modbus.

Écrire huit pilotes de plus qui dupliquent chacun ce que fait déjà la passerelle existante d'un site ajouterait huit choses de plus à rater subtilement, pour des protocoles dont l'équipement est le plus difficile à tester. Si un site n'a vraiment pas de passerelle et a besoin de l'un d'eux en natif, c'est un vrai travail à planifier, pas un fichier à ajouter qui journalise « not implemented ».

**Il n'y a aucun pilote factice dans cet arbre.** Un protocole a une implémentation qui fonctionne ou figure dans cette section. Un test impose que chaque protocole que déclare le modèle ait un pilote compilé, et inversement.

## Identifiants d'appareil

Le `config` et l'`address` d'un appareil sont l'endroit où un pilote trouve de quoi se connecter. Voici les identifiants que lit chaque protocole, et tous sont en écriture seule via l'API (4.15.1) : ils s'affichent comme `[redacted]` pour tous les rôles, un enregistrement qui envoie le marqueur ou omet la clé conserve la valeur stockée, et une nouvelle chaîne la remplace. Les règles, et ce qui ne passe pas par l'API, sont dans [Authentification et utilisateurs](/fr/iot/authentication/#les-identifiants-dappareil-sont-en-écriture-seule).

| Protocole | Identifiants dans la configuration | Identifiants dans l'adresse |
|---|---|---|
| OPC UA | `password` (avec `username`) | aucun : les informations utilisateur dans l'adresse sont masquées et le pilote les ignore |
| MQTT / Sparkplug B | `password` (avec `username`) | `mqtt://user:pass@host`, que le client utilise |
| HTTP / REST | `password` (avec `username`, envoyé en authentification basique) ; chaque valeur de `headers` sauf les simples comme `Accept` et `Content-Type`, qui est l'endroit où vont une clé d'API ou un en-tête `Authorization` ; `body` et `writeBody` s'ils mentionnent un identifiant | `http://user:pass@host` et les valeurs de requête de style `?api_key=`, dans l'adresse et dans `writeUrl` |
| MTConnect | `password` (avec `username`) ; chaque valeur de `headers`, avec les mêmes exceptions | `http://user:pass@host` et valeurs de requête |
| UniFi Network | `password` (avec `username`). Stocké uniquement chiffré : sans clé (ci-dessous), l'appareil ne peut pas être enregistré | aucun : l'adresse est l'URL `https://` de la console |
| BACnet/IP | aucun | aucun : l'adresse est `host` ou `host:port` |
| CODESYS | `password` (avec `username`), comme pour OPC UA | aucun : les informations utilisateur dans l'adresse sont masquées et le pilote les ignore |
| SNMP | `community` (v1, v2c) ; `authPassword` et `privPassword` (v3), avec `username` | aucun : l'adresse est `host` ou `host:port` |
| Modbus, S7comm, EtherNet/IP | aucun | aucun : les informations utilisateur dans l'adresse sont masquées et le pilote les ignore |

**Chiffré au repos.** Avec `HOTLOOP_SECRET_KEY_FILE` défini (le chart le définit, avec une clé qu'il génère), chaque identifiant de la colonne de configuration ci-dessus est chiffré dans la base avec cette clé, qui vit hors de la base, de sorte qu'un dump ou une sauvegarde ne contient que du texte chiffré. Le reste de HotLoop, et les pilotes, ne voient jamais la différence. Un identifiant écrit dans une URL (`mqtt://user:pass@host`, `?api_key=`) ou dans du texte libre comme un `body` HTTP est chiffré aussi : l'adresse ou l'option entière est scellée et revient exactement comme saisie, et une URL sans rien de secret reste lisible. L'option `password` reste l'endroit le plus propre pour en mettre un. Voir [Sauvegardes et restauration](/fr/iot/backup/#identifiants-dappareils-et-clé-secrète).

Toute autre option dont le nom ressemble à un identifiant (elle contient `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, ou se termine par `key`, ou comporte un mot entier comme `pass`, `pw`, `auth`, `cred` ou `sig`, entre autres) est masquée aussi, quel que soit son protocole : une option ajoutée plus tard à un pilote reste donc masquée tant que quelqu'un ne décide pas qu'elle ne doit pas l'être. Un test parcourt les options de chaque pilote et échoue tant que chacune ne figure pas dans la liste des identifiants ou dans celle des options connues comme n'en étant pas. Voir [Authentification et utilisateurs](/fr/iot/authentication/#les-identifiants-dappareil-sont-en-écriture-seule) pour les règles complètes.

## Ajouter un appareil

1. **Appareils → Ajouter un appareil.** Choisissez le protocole, donnez-lui une adresse.
2. **Découvrir les tags** là où le protocole le permet : OPC UA, EtherNet/IP, MTConnect, MQTT (après une naissance Sparkplug), HTTP, SNMP, BACnet/IP, CODESYS. Modbus et S7comm ne peuvent pas énumérer leurs propres points : déclarez-les d'après la documentation de l'appareil.
3. Les tags importés sont créés **en lecture seule**. Un point que l'appareil expose n'est pas un point dont quelqu'un a décidé qu'il pouvait être commandé. Marquez les tags comme modifiables un par un, délibérément.
4. Définissez `scale` et `offset` pour les valeurs brutes : `engineering = raw × scale + offset`. Si l'instrument envoie un code quand une voie est morte ou hors plage, listez-le sous [Valeurs sans données](#valeurs-sans-données) pour qu'il soit lu mauvais plutôt que comme un nombre.
5. Définissez un `deadband` sur tout ce qui est bruité. Il supprime les écritures dans l'historien pour les changements trop petits pour compter, et sans lui un capteur 12 bits qui oscille sur son dernier bit écrit une ligne à chaque cycle pour toujours.

## Valeurs sans données

Un enregistreur dont le thermocouple est grillé ne se tait pas. Il continue de répondre, et ce qu'il met dans le registre est un code : 0x8005 pour « undefined », 0x7FFF pour « over range ». Lu comme un int16 avec une échelle de 0,1, 0x8005 fait -3276,3 degrés, et avant que nous corrigions cela, il revenait avec une qualité **bonne**, entrait dans l'historien comme une vraie température et y restait pour que les alarmes en jugent. Un capteur mort ressemblait à un capteur froid.

Un tag peut donc lister les valeurs brutes qui signifient « pas de mesure ». Chacune a une raison. Quand la valeur brute d'une lecture figure dans la liste, la lecture est **mauvaise**, la raison l'accompagne, et l'échelle et le décalage n'y touchent jamais.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Ces huit-là sont les codes de la famille Yokogawa DX, tirés du manuel de communication du DX (IM 04L41B01-17E, section 4.3, page 4-35). Ils n'ont rien de spécifique à HotLoop : c'est le même champ sur chaque tag de chaque protocole, et la liste du DX est simplement celle qui nous a mordus en premier. Chacun est sur le tag, de sorte qu'une voie d'enregistreur qui peut réellement lire 0x7F7F dans une autre unité la garde comme lecture.

| Champ | <span class="sr-only">Détails</span> |
|---|---|
| `raw` | Le code de l'appareil, écrit comme son manuel l'imprime : `"0x8005"` (hexadécimal), `"-32763"` ou `32773` (décimal). Une chaîne ou un nombre simple. Obligatoire |
| `reason` | Ce que dit la qualité de la lecture. Jusqu'à 120 caractères. S'il est omis, il dit `raw value 0x8005 means no measurement`, de sorte qu'une lecture ne devient jamais mauvaise sans dire pourquoi |

Dans l'éditeur de tags, c'est la case **Valeurs sans données** : un code par ligne, le code, un espace, la raison.

### Quel nombre écrire

Pour un point Modbus adossé à un registre, le code est l'entier que contient l'appareil, une fois appliqué l'ordre des octets et des mots du point. C'est le même nombre que celui en lequel le point se décode : un manuel qui dit « l'instrument renvoie 8005h » signifie donc exactement `"0x8005"` ici.

- **int16 et les autres types signés.** `0x8005` et `-32763` sont le même registre, et `32773` aussi. Écrivez celui qu'écrit le manuel ; les trois correspondent. Un code qui ne tient pas dans le type (`0x10000` sur un int16) est refusé à la connexion de l'appareil, car une liste qui ne peut jamais correspondre est pire qu'une erreur. Deux écritures d'une même valeur sur un même tag sont refusées aussi.
- **uint16 et les autres types non signés.** De `0` jusqu'au maximum du type. Un nombre négatif est refusé.
- **int32, uint32, int64, uint64.** Les mêmes règles sur 32 et 64 bits. `0x7FFFFFFF` sur un int32 avec l'ordre de mots `CDAB` est la valeur une fois les mots remis dans le bon sens, pas l'ordre dans lequel ils sont sortis du fil.
- **float32 et float64.** Le code est le motif de bits du registre, il doit donc être en hexadécimal : `0x7FC00000` pour un NaN silencieux. Un décimal est refusé, parce que 32773 comme float et 32773 comme motif de bits sont deux choses différentes et nous ne devinerons pas.
- **Bits, coils, entrées discrètes et chaînes.** Pas de nombre brut à comparer : `noData` sur l'un d'eux est donc refusé à la connexion de l'appareil.

La vérification porte sur les bits bruts, avant le décodage, avant l'échelle, avant le décalage.

### Autres protocoles

Chaque pilote qui remet un nombre déjà décodé vérifie la même liste : S7comm, EtherNet/IP, OPC UA, HTTP et MQTT (y compris les appareils découverts). Ce qu'ils comparent est ce nombre décodé, comme nombre entier : écrivez-le donc comme le nombre qu'il est. Un INT S7 contenant 0x8005 vaut -32763, écrivez donc `-32763`. L'hexadécimal n'est ici qu'une autre façon d'écrire le même nombre, car un nombre décodé a perdu sa largeur et ne peut pas être relu comme un motif de bits. Une valeur fractionnaire ne correspond jamais. La liste ne vaut la peine d'être définie que là où l'appareil envoie des codes de ce genre ; la plupart de ce que rapportent MTConnect et UniFi n'en envoie jamais.

### Ce que fait une valeur sentinelle

- La **qualité** est `bad` et la lecture porte la raison. Elle s'affiche sur `GET /api/values` et dans le flux en direct (`reason`), à côté de la qualité dans l'écran Tags, et sur les entités du tag comme attribut `quality_reason`.
- La **valeur** est vide, ni zéro ni le code mis à l'échelle. L'échelle et le décalage ne sont pas appliqués.
- L'**historien** enregistre la qualité comme mauvaise, comme pour toute autre mauvaise lecture, et sa colonne de valeur ne contient rien de significatif. Un intervalle sans aucune bonne lecture apparaît comme un trou sur une courbe de tendance, comme pour toute mauvaise lecture.
- **Alarmes.** Une mauvaise lecture ne déclenche jamais une alarme de valeur : haute, basse, égale, vitesse de variation conservent toutes leur état précédent, comme pour toute mauvaise lecture. Une alarme `bad-quality` sur le tag se déclenche en revanche, et son message par défaut porte la raison (`dx-1/ch01 bad-quality: undefined`). Utilisez `{reason}` dans votre propre message pour l'y mettre.
- Le **journal de bord** enregistre le passage de l'entité du tag en mauvais, et la raison est l'attribut `quality_reason` de l'entité.

### Où cela se trouve

Sur le tag, enregistré avec lui. Par l'API, c'est la liste `noData` sur `POST /api/tags` (voir [l'API HTTP](/fr/iot/api/#post-apitags)), dans l'éditeur c'est la case ci-dessus, et dans un Edge Relay c'est le même JSON dans le tag du fichier d'appareil (voir [Référence Edge Relay](/fr/edge-relay/reference/)). Enregistrer le tag recharge l'appareil en cours d'exécution : un changement prend donc effet à la prochaine interrogation et rien ne se redémarre à la main. Une nouvelle découverte laisse la liste d'un tag intacte.

## Qualité

Chaque lecture porte `good`, `uncertain` ou `bad`.

**Mauvais signifie que la valeur n'est pas connue. Cela ne veut pas dire zéro.** Un pilote qui ne peut pas lire un point émet quand même une lecture, marquée mauvaise, parce que le silence ne se distingue pas d'une valeur qui n'a pas changé, et sur une courbe de tendance, la différence entre « le capteur lit 0 » et « le capteur a cessé de répondre » est la différence entre un problème de procédé et un problème d'instrument.

L'évaluation des alarmes conserve son état précédent sur une mauvaise lecture plutôt que de l'évaluer. Un capteur qui tombe à zéro déclencherait sinon chaque alarme basse de l'unité et ressemblerait à un événement de procédé.
