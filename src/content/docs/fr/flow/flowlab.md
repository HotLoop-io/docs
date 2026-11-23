---
title: "FlowLab : bancs d'essai"
description: "Exécutez un onglet comme un diagramme pour bancs d'essai et enregistreurs de données : nœuds, boucles, fil d'erreur, port série, panneau et débogueur."
---

FlowLab est la partie de Flow dédiée aux bancs d'essai et aux enregistreurs de données, et son unité est le diagramme : l'autre façon dont Flow exécute un onglet. Dans un flux, un message traverse un nœud et n'importe quelle entrée le réveille. Dans un diagramme, chaque nœud s'exécute une fois par exécution, quand chaque entrée reliée par un fil contient une valeur. Deux nœuds sans fil entre eux s'exécutent en même temps. C'est ainsi que l'on construit un banc d'essai ou un enregistreur de données : lire un appareil, interpréter la lecture, décider si elle est stable, l'afficher, l'enregistrer.

Les flux ne sont pas touchés par tout cela. Un onglet qui porte `ew_diagram` est laissé en dehors du runtime de messages, et tous les autres onglets s'exécutent exactement comme avant.

Ce que cela change pour vous : vous dessinez la logique une fois, vous appuyez sur Exécuter et vous regardez les valeurs circuler sur les fils. Toute personne qui a l'adresse du panneau peut suivre la même exécution sur un téléphone.

## Le fichier

Un diagramme est un onglet avec un objet `ew_diagram`. Ses nœuds sont des entrées ordinaires du fichier de flux. `wires` nomme le nœud où va un fil, comme toujours, et `ew_in` sur le nœud source indique sur quelle entrée de la cible arrive chaque fil, dans la même forme :

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

Le fichier se charge et s'enregistre octet pour octet avec ces clés. Réglages de l'onglet :

| Clé | Ce qu'elle fait |
|---|---|
| `autostart` | `true` lance l'exécution au démarrage de Flow et après chaque déploiement, sans aucun navigateur ouvert. |
| `role` | `"body"` pour un diagramme qu'exécute une boucle. Un corps ne s'exécute pas seul. |

Chaque nœud a aussi une entrée facultative `after` et une sortie `done`. Reliez le `done` d'un nœud à l'`after` d'un autre et le second attend le premier, sans rien entre les deux. L'ordre est un fil que l'on voit et que l'on peut comparer avec diff.

## Exécution

Un diagramme s'exécute à partir de ce qui est déployé. Dans l'éditeur, ouvrez un onglet de diagramme et appuyez sur Exécuter. La barre au-dessus du canevas propose :

- **Surligner l'exécution** : chaque nœud attend un instant avant de s'exécuter pour que vous puissiez suivre, et le fil traversé par une valeur s'allume. Elle se désactive d'elle-même après dix minutes.
- **Mettre en pause, Reprendre, Entrer, Enjamber, Sortir** : le pas à pas avance nœud par nœud. Enjamber exécute tout le corps d'une boucle. Entrer s'arrête au premier nœud du corps.
- **Arrêt sur la sélection** : un point d'arrêt sur le nœud sélectionné. Appuyez deux fois sur un fil pour le sonder, ce qui garde ses 100 dernières valeurs, ou pour s'arrêter quand une valeur y est déposée. Une sonde ne change jamais une exécution.
- **Ouvrir le panneau** : la page de l'opérateur.

Survolez n'importe quel fil après une exécution pour voir la dernière valeur qu'il a transportée. Le bouton des problèmes énumère toutes les raisons pour lesquelles un diagramme ne peut pas s'exécuter, chacune avec le nœud et l'entrée.

| Appel | Ce qu'il fait |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Ce qui est déployé, le panneau et la dernière valeur de chaque fil. |
| `GET /diagrams/{id}/trace` | Ce qu'a fait la dernière exécution, dans l'ordre : chaque nœud qui a démarré ou fini et chaque valeur qui a traversé un fil, avec les millisecondes depuis le début de l'exécution. Un diagramme qui ne s'est pas exécuté depuis son déploiement répond 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Nécessite `diagram.run`. Chacune est dans le journal d'audit avec son auteur. |
| `POST /diagrams/{id}/sub` | Envoyez `{flows, nodes, name}` et recevez le fichier de flux avec ces nœuds transformés en sous-diagramme. Lit et calcule seulement : rien n'est enregistré ni déployé. |
| `PUT /diagrams/{id}/controls/{node}` | Règle un contrôle. Vérifié selon son type, sa plage et ses choix. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Les clés sont un id de nœud, `wire:<wire key>` ou `diagram:<tab>`. |

Les événements d'une exécution partent sur le même socket que ceux de l'éditeur, sous les noms `diagram/<id>/node`, `token`, `run`, `paused` et `values`.

## Nœuds

| Nœud | Ce qu'il fait |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Valeurs et arithmétique. Les opérations mathématiques s'appliquent élément par élément sur les tableaux. |
| `dia-wait` | Attend, puis transmet son entrée. |
| `dia-bundle`, `dia-field`, `dia-array` | Enregistrements et tableaux. |
| `dia-while`, `dia-for` | Boucles. Le corps est un diagramme à part, nommé par son onglet. Les valeurs reportées partent d'un fil ou de Start values et ressortent telles qu'elles étaient au dernier passage. Une boucle for prend un nombre ou un tableau. Une boucle while s'exécute au moins une fois. |
| `dia-case` | Structure de cas. La valeur sur `selector` choisit un corps à exécuter, et seul ce corps s'exécute. Un booléen choisit `true` ou `false`, un nombre choisit le cas de cette valeur quelle que soit son écriture, et une chaîne ou un enum choisit le cas de ce nom. Les cas sont un objet JSON de nom de cas vers diagramme, et une valeur qu'aucun cas ne nomme exécute le cas par défaut. Sans cas par défaut, le nœud met une erreur sur son fil d'erreur, et le déploiement avertit qu'il n'y a pas de cas par défaut (un booléen avec les deux cas est exempté). Chaque corps doit renvoyer chaque résultat sous le même nom, et un corps qui ne le fait pas est un problème au déploiement. La sortie `case` dit quel cas s'est exécuté. |
| `dia-body-in`, `dia-body-out` | Les deux extrémités d'un corps. `iter` est le numéro du passage. `stop` termine une boucle while. Le nom d'une valeur reportée la renvoie au passage suivant. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | Un port série. Les lectures se terminent sur un terminateur ou un nombre d'octets. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Un instrument de test, par adresse. Voir Instruments plus bas. |
| `dia-parse-reading`, `dia-stable` | Extraient un nombre et une unité d'une ligne, et disent si les dernières lectures concordent. |
| `dia-log-text` | Ajoute un enregistrement comme une ligne d'un fichier texte, avec une colonne d'heure. |
| `dia-daq-read` | Lit des échantillons d'une tâche d'acquisition de données sur du matériel NI, par le gRPC Device Server de NI. Voir Acquisition de données plus bas. |
| `dia-mqtt-out` | Publie sa valeur par un serveur MQTT que configure le fichier de flux, la même connexion que celle des nœuds MQTT. Marquez-le durable et un message que le broker manque est écrit sur disque et envoyé, dans l'ordre, au retour du broker, même après un redémarrage. |
| `dia-postgres-out` | Écrit un enregistrement comme une ligne d'une table PostgreSQL ou TimescaleDB, par le serveur que configure le fichier de flux, la même connexion que celle du nœud postgres. Marquez-le durable et une ligne que la base de données manque est gardée sur disque et écrite, dans l'ordre, à son retour. Voir Une base de données qui tombe plus bas. |
| `dia-log-tdms` | Ajoute un enregistrement à un fichier TDMS, un canal par champ. Voir plus bas. |
| `dia-control`, `dia-indicator`, `dia-chart` | Le panneau. |
| `dia-stats` | La moyenne, la valeur RMS, le minimum, le maximum et l'écart type d'un tableau. L'écart type divise par n moins un, il faut donc deux lectures. |
| `dia-integral` | L'aire sous un tableau par la méthode des trapèzes, sous forme d'un seul nombre ou d'une aire cumulée à chaque échantillon. |
| `dia-derivative` | La pente à chaque échantillon d'un tableau. |
| `dia-filter` | Un filtre de Butterworth passe-bas, passe-haut, passe-bande ou coupe-bande d'ordre 1 à 10, avec une fréquence de coupure en hertz. |

### Filtres

Le nœud de filtre est un filtre de Butterworth : plat dans la bande passante, sans ondulation, et à 3 dB en dessous à la fréquence de coupure. Il est conçu à partir du filtre analogique par la transformation bilinéaire avec la coupure pré-déformée, de sorte que le point à 3 dB tombe sur la fréquence que vous avez saisie, et il s'exécute comme une chaîne de sections du second ordre pour qu'un ordre élevé reste précis. Un passe-bande ou un coupe-bande d'ordre n a 2n pôles. Une coupure doit être supérieure à zéro et inférieure à la moitié de la fréquence d'échantillonnage, et une conception impossible à construire est listée dans les problèmes avant l'exécution. La fréquence d'échantillonnage est une propriété, ou une entrée qui l'emporte sur elle. Le filtre garde sa mémoire d'un appel à l'autre pendant une exécution, de sorte qu'un tableau découpé en morceaux par une boucle ressort comme s'il avait été filtré d'un bloc, et chaque nouvelle exécution repart du repos.

Ce qu'il ne sait pas faire : ce n'est pas un filtre à phase linéaire, il retarde donc chaque fréquence d'une durée différente, et il n'a pas de mode à phase nulle qui filtre dans les deux sens. Là où le timing entre deux signaux doit rester aligné, ou la forme d'une onde doit survivre, ce n'est pas le bon filtre. L'intégrale et la dérivée prennent le temps entre échantillons dans une entrée `dt` en secondes, une entrée `rate` en hertz ou la propriété Samples per second.

### Journal TDMS

`dia-log-tdms` écrit les mesures d'un banc d'essai dans un fichier TDMS, le format qu'ouvrent les outils d'acquisition et d'analyse de données. Reliez un enregistrement à `row`. Chaque champ de l'enregistrement est un canal d'un même groupe, donc un enregistrement avec `pressure`, `ok` et `operator` fait trois canaux. Un nombre est stocké comme un flottant 64 bits, vrai ou faux comme un booléen, et tout le reste comme du texte. Un champ qui contient une liste de nombres ajoute toute la liste, ce qui permet d'y mettre un bloc d'échantillons. Réglages :

| Paramètre | Signification |
|---|---|
| `path` | Le fichier. Un fichier déjà présent est complété, de sorte qu'une exécution après l'autre construit un seul fichier. |
| `group` | Le groupe où vont les canaux. |
| `columns` | Les champs à enregistrer, dans l'ordre. Vide, il enregistre tous les champs, par nom. |
| `properties` | Un objet JSON de propriétés du fichier, comme `{"title": "bench 4", "station": 4}`, écrit au début de l'exécution. |
| `sync` | Activé par défaut : chaque ligne atteint le disque avant que le nœud ne termine. |

Chaque ligne est un segment, écrit d'un seul bloc. Si le courant est coupé au milieu de l'une d'elles, le fichier montre où elle a été coupée, un lecteur renvoie toutes les lignes qui la précèdent, et l'exécution suivante répare la fin du fichier et continue. Le type d'un champ est fixé par la première ligne d'une exécution. Une ligne ultérieure qui ne correspond pas, comme du texte dans une colonne numérique, va sur le fil d'erreur comme entrée incorrecte et le fichier reste intact. Un nombre manquant est écrit comme not-a-number.

Pour ouvrir le fichier, utilisez n'importe quel lecteur TDMS. Les propriétés de canal comme `unit_string` et les propriétés de forme d'onde `wf_start_time`, `wf_increment` et `wf_samples` sont prises en charge par la bibliothèque ; le nœud ne les renseigne pas encore.

Ce que le lecteur accepte : des segments little endian et big endian, des données entrelacées et contiguës, des métadonnées omises d'un segment quand elles n'ont pas changé, une nouvelle liste d'objets, des entiers de 8, 16, 32 et 64 bits, des flottants de 32 et 64 bits, des booléens, du texte et des horodatages. Ce qu'il refuse, par son nom et sans lire le fichier à moitié : les données brutes écrites par un pilote d'acquisition de données, les données mises à l'échelle ou compressées, les flottants à précision étendue, les nombres à virgule fixe et complexes. Ce que le rédacteur écrit : little endian, des données contiguës et ces mêmes types. Il n'écrit pas en big endian.

### Le fil d'erreur

Les nœuds qui parlent au monde extérieur ont `err` en entrée et `err` en sortie. Une erreur est un enregistrement : un indicateur, un code numérique, le texte source et le nœud d'où elle vient. Un nœud qui reçoit une erreur ne fait aucun travail et la transmet, donc une panne au début d'une chaîne fait sauter tout ce qui suit et n'apparaît qu'une fois à la fin. Reliez une erreur à la sortie de corps `err` d'une boucle et la boucle s'arrête dessus, avec l'erreur sur la sortie d'erreur de la boucle. Un indicateur d'erreur sur le panneau devient rouge en cas de panne et s'efface quand la valeur suivante arrive sans erreur.

### Une cible qui tombe

Un `dia-mqtt-out` durable envoie directement au broker tant qu'il répond. Quand il ne répond pas, le message est validé dans le magasin durable de Flow avant que le nœud ne termine, et une pompe livre la file, le plus ancien d'abord, au retour du lien. Tout ce qui est mis pendant que d'autres attendent passe derrière eux, donc rien ne dépasse rien. La livraison depuis la file est au moins une fois : un message dont l'envoi a expiré parce que le client n'avait pas remarqué la perte du lien peut tout de même être livré à la reconnexion du client, il peut donc arriver deux fois, une pour chaque envoi expiré. La file vit dans le même magasin et sous le même quota de disque qu'un fil durable, et elle se vide après un redémarrage sans exécution et sans navigateur. Sans durable, un message que le broker manque est une erreur sur le fil d'erreur.

### Une base de données qui tombe

`dia-postgres-out` écrit chaque enregistrement qu'il reçoit comme une ligne, dans la table que vous nommez, par un serveur `hotloop-flow-postgres`. Les champs d'un enregistrement vont dans les colonnes du même nom, donc un enregistrement avec `n` et `sensor` remplit les colonnes `n` et `sensor`. Listez les colonnes, séparées par des virgules, pour n'en écrire que certaines ou fixer leur ordre ; laissez la liste vide et le nœud utilise les champs de l'enregistrement. Le nœud s'exécute à chaque passage d'une boucle, donc une boucle écrit une ligne par passage. Une table ou une colonne qui n'est pas un nom simple est un problème au déploiement, jamais une instruction au milieu d'une exécution. Un entier va aussi bien dans une colonne integer, float ou numeric, et un enregistrement ou un tableau entre tel quel, ce que prend une colonne json ou jsonb.

Nommez une **colonne d'heure** et chaque ligne reçoit l'heure à laquelle elle est arrivée au nœud. C'est l'heure de la mesure, pas celle de l'écriture : une ligne qui a attendu cinq minutes sur disque garde la minute où elle a été faite.

Sans **Conserver ce que la base de données manque**, une ligne que la base de données n'accepte pas est une erreur sur le fil d'erreur du nœud et elle est perdue. Avec cette option, la ligne entre directement tant que la base répond. Quand la base ne répond pas, la ligne est validée dans le magasin durable de Flow avant que le nœud ne termine, et la sortie `sent` du nœud dit `false`. Les lignes attendent sur disque, survivent à un redémarrage et sont écrites dans l'ordre une fois la base revenue, sans que rien de ce qui entre après elles ne les dépasse. Un arriéré est écrit en nombreuses lignes par instruction, jusqu'à 256, donc celui qui s'est accumulé pendant l'absence de la base est rattrapé en quelques secondes et non à la vitesse d'un aller-retour par ligne. Le test laisse 30 000 lignes en attente sur disque, soit cinq minutes à 100 par seconde, et toutes sont écrites dans l'ordre quelques secondes après le retour de la base.

La livraison depuis le disque est au moins une fois. Une ligne dont l'insert a été envoyé quand le lien est tombé a pu être validée avec la réponse perdue, et elle est renvoyée, donc elle peut être écrite deux fois, un lot au plus. Si cela compte, donnez à la table une clé unique et choisissez **Ignorer la ligne** pour En cas de conflit : la seconde est alors écartée par la base.

Une ligne que la base refuse pour ce qu'elle contient, comme une valeur trop grande pour sa colonne ou une clé déjà là avec En cas de conflit laissé sur Lever une erreur, serait refusée à chaque fois. Elle est abandonnée avec un événement d'audit, `diagram.row_rejected`, qui porte la ligne, et les lignes suivantes sont écrites. Sans cela, une seule mauvaise ligne arrêterait le journal. Une base qui est arrêtée, une table qui n'existe pas encore et un mauvais mot de passe ne sont pas dans ce cas : ces lignes attendent.

### Instruments

`dia-instr-open` prend une adresse : `10.0.0.5:5025` pour un instrument du réseau local sur un socket brut, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` pour un instrument série, ou un simple `/dev/ttyUSB0` ou `COM3` pour 9600 8N1. L'exécution ferme la session à sa fin. Si le lien tombe, la requête suivante le rouvre et la chute est comptée sur la session.

`dia-instr-query` écrit une commande et le terminateur, puis lit la réponse. Choisissez texte (une ligne, sur `reply`), none (une simple écriture) ou block, qui lit un bloc binaire `#41024...` et sort les échantillons sur `samples` sous forme de tableau, en int8, uint8, int16, uint16, int32, float32 ou float64, big ou little endian. Un bloc indéfini `#0` se termine à la première fin de ligne. Une réponse qui n'arrive pas à temps est un dépassement de délai sur le fil d'erreur avec l'adresse.

`dia-scpi-parse` lit une réponse texte comme une liste de nombres, un nombre, une identité (`*IDN?` en fabricant, modèle, numéro de série et firmware) ou un octet d'état (`*STB?` ou `*ESR?`) en noms de ses bits actifs.

### Série

Un port qui disparaît, comme un câble débranché ou un adaptateur retiré, est une panne sur le fil d'erreur de la lecture. La lecture suivante tente de le rouvrir, une fois par seconde, et compte la perte et le retour. Un port a un contrôle de flux, aucun, matériel (RTS et CTS) ou logiciel (XON et XOFF), sous Linux, réglé sur le terminal lui-même ; un pseudo-terminal montre que le réglage est arrivé, et ce que font les lignes sur un vrai adaptateur n'a pas été démontré.

### Acquisition de données

`dia-daq-read` lit une tâche d'un matériel NI, comme un châssis CompactDAQ, par le gRPC Device Server ouvert de NI. Flow parle à ce serveur par le réseau, donc le matériel peut se trouver sur une autre machine que Flow, et Flow n'a besoin d'aucun pilote NI ni d'aucune bibliothèque de fournisseur. Il reste un seul binaire statique.

**Sur la machine où le matériel est branché**, installez le pilote DAQmx de NI et le gRPC Device Server de NI (https://github.com/ni/grpc-device, sous licence MIT). Le serveur n'écoute que sur cette machine (`localhost`, port 31763) tant que son fichier de configuration ne dit pas autre chose. Pour l'atteindre depuis Flow sur une autre machine, réglez `address` dans son `server_config.json` sur `[::]` ou sur l'interface voulue, et activez TLS en réglant `server_cert`, `server_key` et, pour le TLS mutuel, `root_cert`, avec les fichiers dans le dossier `certs` à côté du fichier de configuration. Le README de NI donne les détails de la version que vous utilisez. Ne laissez pas ouvert sur un réseau d'usine le port par défaut non sécurisé du serveur : quiconque peut l'atteindre peut piloter le matériel.

**Dans le nœud**, réglez :

* `address` sur le `host:port` du serveur.
* `tls` sur `off` (seulement pour un serveur sur la même machine), `on` (Flow vérifie le certificat du serveur avec `caFile`, ou avec les autorités du système si ce champ est vide) ou `mutual` (Flow présente aussi `certFile` et `keyFile`, que le serveur vérifie avec son `root_cert`). `serverName` est le nom à chercher dans le certificat du serveur quand ce n'est pas l'hôte de `address`.
* `device` et `channels` pour nommer le matériel, comme `cDAQ1Mod1` et `ai0:3`, ou une liste comme `ai0, ai2`. `kind` vaut `voltage`, `current` ou `thermocouple`, avec `min` et `max` pour la plage attendue et `terminal` pour le câblage. Les thermocouples prennent un `tcType` et une `unit` et utilisent la compensation de soudure froide du module lui-même.
* `mode`, `rate` et `samples`. Le mode fini prend une acquisition de `samples` par canal à `rate` à chaque appel, en la relançant à chaque fois. Le mode continu démarre la tâche au premier appel et chaque appel lit les `samples` suivants, donc un nœud dans le corps d'une boucle lit un flux bloc par bloc. `trigger` démarre la tâche sur un front numérique à une borne comme `/cDAQ1/PFI0`.

`y` est l'ensemble des échantillons sous forme de tableau pour un canal, ou un tableau de tableaux, un par canal dans l'ordre où vous les avez nommés. `dt` est le nombre de secondes entre échantillons, un sur la fréquence, donc la durée d'un bloc en secondes est son nombre d'échantillons fois `dt` : 1 000 échantillons à 1 000 échantillons par seconde couvrent 1,000 s. L'horloge propre de l'appareil date les échantillons, comme toujours. Flow ne fait que déplacer les données. Un refus du serveur ou du pilote ressort sur `err` avec le code et le texte du pilote, et un serveur qui ne répond pas dans `callTimeoutSec` est un dépassement de délai. La tâche vit le temps de l'exécution et est effacée sur le serveur à sa fin, de sorte que le matériel est de nouveau libre.

Ce qui est fait : entrée analogique en tension, entrée analogique en courant et température de thermocouple, finies ou continues, avec une horloge d'échantillonnage et un déclencheur numérique de départ facultatif. Ce qui ne l'est pas : les entrées et sorties numériques et les compteurs utilisent d'autres appels de lecture et ne sont pas construits, pas plus que les écritures, les autres types de déclencheur ou la mise à l'échelle au-delà de ce que fait le module.

Le nœud a été exécuté contre un serveur de substitution qui parle les mêmes appels et répond par une sinusoïde, et sur du matériel réel (2026-11-17).

## Le panneau

`/panel/<diagram id>` sur un runtime ouvre une page avec les contrôles, indicateurs et graphiques du diagramme, connectée de la même façon que l'éditeur. Elle est faite pour être utilisée au pouce : rien n'y est plus petit qu'un doigt. Un graphique garde ses 1 024 derniers points sauf si vous le changez, et indique combien il en a abandonné. Un graphe remplace ses données à chaque tableau. Un graphique XY trace x en fonction de y et garde aussi l'historique. Un graphique d'intensité prend une grille, un tableau de lignes de nombres toutes de même longueur (jusqu'à 512 sur 512), et dessine chaque valeur comme une couleur du plus petit au plus grand qu'elle contient, en remplaçant l'image à chaque grille ; un tableau plat ou une grille irrégulière est une erreur sur le fil d'erreur du nœud.

Plusieurs personnes peuvent suivre une même exécution. Régler un contrôle depuis le navigateur nécessite `diagram.run`, est vérifié sur le serveur et inscrit dans le journal d'audit.

## Contrôles

Un `dia-control` a un **type** (ce qu'il contient) et un **aspect** (la façon dont le panneau le dessine). Le serveur vérifie chaque valeur selon le type, quel que soit l'aspect, donc un script qui appelle `PUT /diagrams/{id}/controls/{node}` obéit aux mêmes règles qu'un doigt. Ce qu'un opérateur règle est sur le panneau dès que le diagramme est déployé, avant la première exécution, et le nœud de contrôle donne au diagramme cette valeur à chaque exécution.

| Type | Aspects | Ce que le diagramme lit |
|---|---|---|
| `number` | `entry` (saisi), `spin` (saisi, avec un bouton moins et un bouton plus qui avancent selon `step` et s'arrêtent aux bornes de la plage), `slider`, `knob` | un nombre, tenu entre `min` et `max` quand ils sont réglés |
| `bool` | `switch`, `button` (un appui le met à vrai, et `latch` le remet quand le diagramme le lit), `led` (une LED sur laquelle on appuie) | vrai ou faux |
| `string` | une zone de texte | du texte |
| `enum` | une liste déroulante de `options` | une des options |
| `array` | une liste où l'opérateur ajoute et retire des éléments | une liste de nombres, d'interrupteurs ou de textes, selon `elem` ; `min` et `max` bornent chaque nombre, et `maxlen` borne la longueur |
| `record` | une entrée par champ | un objet avec exactement les `fields` (`rate:number, on:bool, note:string`), chaque champ toujours présent |

Un slider et un knob ont besoin d'une plus petite et d'une plus grande valeur. Un knob sans les deux est un avertissement au déploiement et est dessiné comme une saisie jusqu'à ce qu'il les ait (un slider faisait déjà de même). Le knob est un cadran qui balaie 270 degrés : faites-le tourner à la souris ou au doigt, appuyez dessus pour le placer là, ou utilisez les flèches (un `step`), Page précédente et Page suivante (dix pas), Début et Fin. Il écrit quand vous le relâchez. La valeur de départ d'un tableau est du JSON (`[1, 2, 3]`) ou une simple liste séparée par des virgules (`1, 2, 3`), et la valeur de départ d'un enregistrement est un objet JSON (`{"rate": 3}`) ; un champ omis démarre vide. Un enregistrement sans champs, un nom de champ inconnu ou une valeur de départ qui ne convient pas est un problème au déploiement.

Chaque bouton, saisie, interrupteur et cadran du panneau mesure au moins 44 pixels dans les deux sens, et la page ne défile pas latéralement sur un téléphone de 390 pixels.

Un contrôle est écrit quand on le change, et le diagramme le lit quand le nœud de contrôle s'exécute ; aucun contrôle ne lance une exécution ni ne déclenche un nœud de lui-même quand il change. C'est la structure d'événements, et elle n'est pas construite.

## Ce que ce n'est pas

Un diagramme s'exécute dans un processus Go sur un système d'exploitation généraliste. Le ramasse-miettes et l'ordonnanceur peuvent retarder un nœud de quelques millisecondes, donc un nœud ne peut pas promettre une échéance. Un travail qui doit en respecter une relève d'un automate ou d'un runtime conçu pour cela. Le timing des échantillons d'un appareil d'acquisition de données n'est pas touché par tout cela : c'est l'horloge de l'appareil qui le fait, et Flow ne fait que déplacer les données.

## Tests d'un diagramme

Un fichier de tests de flux peut contenir un test de diagramme à côté des tests de messages. Il règle les contrôles du diagramme, l'exécute une fois avec le vrai moteur de diagrammes et dit ce que contiennent ses indicateurs :

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

Un contrôle que le diagramme n'a pas, une valeur qu'il refuse, un indicateur qui n'en est pas un, un nom que deux éléments partagent et un diagramme qui ne peut pas s'exécuter sont des erreurs avec leur raison. Un diagramme avec un nœud qui atteindrait l'extérieur du test (un port série, un instrument, un appareil d'acquisition de données, MQTT en sortie, une écriture HotLoop, un fichier journal) est refusé, parce qu'un test de diagramme n'a pas de substitut pour eux. Un appareil série scripté, pour tester un câble débranché ou une série de trames parasites, n'est pas construit.

## La liste d'erreurs en CI/CD

`hotloop-flow test` et la barrière de déploiement lancent la vérification de l'éditeur sur chaque diagramme du fichier de flux. Un diagramme qui ne peut pas s'exécuter est listé comme `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` et fait échouer le fichier même si tous les tests passent ; le rapport JUnit porte chacun comme une erreur de type `diagram`. Un avertissement, comme une structure de cas sans cas par défaut, est listé et ne fait pas échouer.

## Formes d'onde

Une forme d'onde est un bloc d'échantillons régulièrement espacés qui sait quand il a commencé et quel est l'écart entre eux, sous forme d'enregistrement sur le fil : `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` en construit une à partir d'un tableau (le pas vient de `dt`, sinon de `rate`, sinon de son réglage ; le début de `t0`, sinon du moment de l'exécution) et `dia-wave-parts` en défait une, y compris la durée qu'elle couvre. Une forme d'onde contient au plus `maxSamples` échantillons (1 048 576 par défaut) ; le reste est coupé et compté sur `dropped`. Les nœuds d'analyse acceptent une forme d'onde là où ils prennent un tableau et utilisent son pas. `dia-log-tdms` écrit une colonne de forme d'onde comme un canal avec `wf_start_time`, `wf_increment`, `wf_samples` et les attributs comme propriétés du canal.

## Sous-diagrammes

`dia-sub` est un diagramme utilisé comme un nœud : ses entrées et ses sorties forment le connecteur, chaque entrée étant un `dia-body-in` de ce nom dans son corps et chaque sortie un `dia-body-out`. Une entrée est obligatoire sauf si son nom finit par `?` (facultative) ou `~` (recommandée : il s'exécute sans elle et le déploiement avertit quand elle n'est pas reliée). Sélectionnez des nœuds et faites-en un sous-diagramme (`POST /diagrams/{id}/sub`) et les nœuds passent dans un nouvel onglet de corps, un `dia-sub` prend leur place, et le connecteur est déduit des fils qui traversent le bord de la sélection : une entrée pour chaque sortie source qui alimente la sélection, une sortie pour chaque sortie sélectionnée qui alimente les nœuds extérieurs. Les fils extérieurs sont reconnectés, donc une exécution donne les réponses qu'elle donnait avant.

## Types d'enregistrement partagés

Un type d'enregistrement est nommé une seule fois, dans les réglages d'un onglet de diagramme, sous `types`, et chaque `dia-bundle` ou `dia-field` qui met `shape` à son nom est vérifié par rapport à cette définition unique :

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Un champ est `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (un autre type partagé) ou un enum. Renommez un champ dans la définition et tout bundle qui utilise encore l'ancien nom est un problème au déploiement suivant, dans la même liste d'erreurs qu'une entrée non reliée, avec le nœud et le champ. Un bundle tient chaque valeur au type de son champ à l'exécution, et le fil d'erreur porte une valeur qui ne convient pas. `Set.Schema` donne le même type sous forme de JSON Schema, ce que vérifient les fils typés.

## Rotation et rétention

`dia-log-text` et `dia-log-tdms` peuvent démarrer un nouveau fichier quand le fichier actif atteint `rotateMB` mégaoctets ou `rotateHours` heures, et ne garder que les `keep` fichiers terminés les plus récents. Le fichier terminé prend le nom du journal avec l'heure de sa fermeture avant l'extension (`bench.csv` devient `bench-20261114T120000Z.csv`) et le journal continue dans `bench.csv`, avec un nouvel en-tête, ou avec les propriétés du fichier réécrites pour TDMS. La rétention ne supprime que les fichiers qui correspondent à ce modèle, jamais le journal actif et jamais un fichier qui se trouve simplement à côté. L'âge compte à partir du moment où une exécution écrit pour la première fois dans le fichier. Le journal texte s'ouvre dans un tableur et le journal TDMS est le format binaire pour les gros volumes de données.

## Modifier une structure de cas et choisir un diagramme

Les cas d'une structure de cas sont des lignes avec un nom de cas et un sélecteur de diagramme, avec un second sélecteur pour le cas par défaut, et la propriété qui nomme le diagramme qu'une boucle ou un sous-diagramme exécute est aussi un sélecteur. Les sélecteurs listent les diagrammes FlowLab du fichier de flux et enregistrent l'id de l'onglet ; un nom écrit à la main dans un ancien fichier de flux est affiché comme cet onglet et enregistré comme son id, que le runtime lit de la même façon. Les valeurs enregistrées sont le même JSON qu'avant (`cases` est un objet de nom de cas vers diagramme), donc un fichier de flux modifié dans la boîte de dialogue et un fichier modifié à la main sont le même fichier.

## Ouvrir un sous-diagramme sur place

Un nœud de sous-diagramme a une petite case dans son coin supérieur droit. Appuyez dessus, ou sélectionnez le nœud et appuyez sur **Ouvrir sur place** dans la barre du diagramme, et le nœud est dessiné ouvert là où il était : un cadre avec le nom du sous-diagramme, son connecteur nommé sur les deux bords (les entrées à gauche, les sorties à droite, avec les ports `after` et `done` et le fil d'erreur comme n'importe quel nœud), et à l'intérieur les nœuds et les fils de son corps. Rien ne s'ouvre dans une seconde fenêtre et l'onglet où vous êtes ne change pas. Les fils qui menaient au nœud mènent au connecteur du cadre, et une ligne pointillée discrète va de chaque nom du connecteur au nœud body in ou body out de ce nom. La case dans la barre de titre du cadre (ou **Fermer sur place**) le referme.

Ce qui est dessiné dans le cadre, ce sont les nœuds du corps lui-même, pas une copie. Sélectionnez-en un, faites-le glisser, double-cliquez dessus pour ses propriétés, changez sa valeur ou supprimez-le, et vous avez modifié le corps, en une seule étape annulable, et un déploiement l'enregistre. Déplacer le cadre par sa barre de titre déplace le nœud de sous-diagramme, et le corps l'accompagne. Un fil relie deux nœuds d'un même diagramme, donc un fil d'un nœud extérieur à un nœud intérieur est refusé avec des mots ; reliez au connecteur du cadre. Le zoom, le déplacement, l'ajustement et le cadre de sélection fonctionnent comme partout ailleurs.

Les sous-diagrammes ouverts sont une façon de regarder le diagramme. Ce n'est pas dans le fichier de flux, ce n'est pas une étape d'annulation, et un rechargement les ferme tous, donc en ouvrir un ne change jamais ce qu'envoie un déploiement. Un sous-diagramme dans un sous-diagramme ouvert a sa propre case et peut aussi être ouvert, sur trois niveaux. Un corps déjà ouvert ailleurs ne s'ouvre pas une seconde fois, et un sous-diagramme dont le corps mène à un diagramme déjà ouvert est dessiné fermé, donc un diagramme qui se contient lui-même ne peut pas faire boucler l'éditeur. Un corps qui n'est nommé par rien, ou par un nom que deux diagrammes partagent, n'a pas de case, parce que le runtime ne peut pas non plus le trouver. Les boucles et les structures de cas ont aussi des corps et ne s'ouvrent pas encore sur place.

## Créer un sous-diagramme dans l'éditeur

Avec des nœuds sélectionnés sur un diagramme, **Sélection vers un sous-diagramme** dans la barre demande un nom, appelle `POST /diagrams/{id}/sub` avec le fichier de flux que détient l'éditeur et charge la réponse comme une modification annulable : les nœuds passent dans un onglet à part et un nœud de sous-diagramme prend leur place, avec ses entrées et sorties déduites des fils qui traversent la sélection. Rien n'est enregistré avant le déploiement.

## Rejouer une exécution

Surligner l'exécution ralentit une exécution pendant qu'elle se déroule. **Rejouer la dernière exécution**, en bas du canevas, rejoue une exécution déjà terminée, à partir de ce qu'elle a enregistré, pour que vous puissiez la suivre après coup. Elle allume les fils et marque les nœuds comme l'exécution en direct, un événement à la fois, à la vitesse choisie (Lente, Normal, Rapide ou Très rapide), et à la fin le canevas montre ce que l'exécution a laissé. **Arrêter la relecture** l'interrompt plus tôt. Elle ne change rien dans le runtime et ne démarre rien : le bouton est désactivé pendant qu'une exécution est en cours, et une relecture s'arrête quand vous passez à un autre onglet.

Chaque exécution enregistre les débuts et fins de ses nœuds et chaque valeur qui a traversé un fil, jusqu'à 20 000 événements. Une exécution plus longue garde ses 20 000 premiers, le dit à la relecture, et la relecture montre ce début, parce qu'une relecture qui commencerait au milieu n'aurait rien d'où partir. Les valeurs sont gardées comme les courts aperçus que montrent les fils, donc un tableau de milliers d'échantillons est sa longueur et ses premières valeurs. L'enregistrement est celui de la dernière exécution, et une nouvelle exécution le remplace ; il n'est pas conservé après un redémarrage. `GET /diagrams/{id}/trace` est le même enregistrement pour un script.

## Disposition rangée

**Ranger la disposition**, dans la barre d'onglets, dispose les nœuds visibles pour que les données se lisent de gauche à droite et qu'aucun fil ne traverse un nœud. La colonne d'un nœud est la plus longue chaîne de fils qui y mène. Un fil qui saute des colonnes reçoit un couloir à travers elles, les nœuds d'une colonne sont ordonnés pour démêler les croisements, puis chaque long fil est vérifié le long de la courbe sur laquelle il est dessiné par rapport aux nœuds des colonnes qu'il traverse, et un nœud qui gêne est écarté. Le bloc garde son coin supérieur gauche, et l'ensemble est une seule modification annulable. Dans une boucle de câblage, le fil qui la ferme est laissé hors du classement, donc il va à rebours au lieu de faire boucler la disposition.

## Noms de fils

Un fil d'un diagramme est nommé en son milieu, par la sortie d'où il vient (`sum`, `result`, `iterations`), à côté de son type quand l'une des extrémités en déclare un, et le survoler affiche toujours la dernière valeur qu'il a transportée.

## Zoom

Le canevas zoome de 5 % à 400 % autour du pointeur, et lit son zoom comme `data-zoom` sur le canevas.

## Régler un objet du panneau par son nom

`dia-panel-set` change une propriété d'un contrôle ou d'un indicateur pendant que le diagramme s'exécute, par l'étiquette de l'objet (ou son id) : `visible` et `enabled` prennent true ou false, `color` prend red, amber, green, blue, gray ou default, `label` prend du texte, et `min` et `max` prennent un nombre pour un contrôle numérique. Un contrôle désactivé refuse ce qu'un opérateur règle, un objet masqué n'est pas dessiné, et le panneau qu'un opérateur a ouvert suit. Un nom qui ne correspond à aucun objet, ou à plus d'un, est un problème au déploiement quand il est saisi sur le nœud et une erreur sur le fil quand il arrive par un fil, et une exécution part du panneau tel qu'il a été conçu.

## Symboles

Chaque type de nœud FlowLab est dessiné avec un symbole à nous au milieu de son corps (un plus pour les maths, un sigma pour les statistiques, une sinusoïde pour une forme d'onde, une prise pour un port série), à côté de son étiquette. Ce sont de simples traits dessinés dans `web/src/lib/symbols.ts`, pas une police d'icônes ni l'œuvre de quelqu'un d'autre, et un test échoue quand un type de nœud de diagramme nomme une icône qui n'est pas dessinée.

## Écrire sur un équipement : la porte d'écriture

Un diagramme commande un équipement d'une seule façon : `dia-hotloop-write`. Il envoie sa valeur à un tag dans HotLoop (`device/tag`, réglé sur le nœud ou reçu par un fil) par la porte d'écriture de HotLoop, qui décide, dans son propre ordre, que les écritures sont activées, que le tag est armé et que la valeur est dans la plage. Flow n'écrit jamais lui-même sur une machine. HotLoop enregistre chaque tentative, refusée ou non, avec la raison `flow:<diagram>/<node id>`, de sorte que son journal d'audit nomme le diagramme et le nœud. Un refus est une erreur sur le fil d'erreur du nœud avec la raison de la porte elle-même (code 5006), et un HotLoop injoignable aussi ; dans les deux cas l'écriture n'a pas lieu, et le nœud refuse de se déployer sans HotLoop sélectionné. Les nœuds série et instrument bruts parlent à des instruments de banc (multimètres, alimentations, charges), qui n'ont pas de tag dans HotLoop, donc ils ont leur propre interrupteur (ci-dessous).

## L'interrupteur d'écriture des instruments

Lire un instrument ne change rien et est toujours ouvert. En écrire un peut changer quelque chose : la sortie d'une alimentation, la haute tension d'un hipot, le courant d'une charge. Donc chaque instrument démarre avec ses écritures **désactivées**, et une écriture depuis un diagramme est refusée jusqu'à ce que quelqu'un qui a l'autorisation `instrument.write` active les écritures de cet instrument, un instrument à la fois.

- **Ce qui compte comme écriture.** `dia-serial-write` est toujours une écriture. `dia-instr-query` est une lecture quand sa commande est une requête (chaque instruction SCPI qu'elle contient finit par `?`, comme `*IDN?` ou `MEAS:VOLT?;MEAS:CURR?`) et une écriture sinon (`OUTP ON`, `VOLT 5`, `*RST` ou `VOLT 5;MEAS:VOLT?`). Une commande reçue par un fil est comptée comme pouvant écrire.
- **Quel instrument.** L'instrument est son adresse : `tcp://host:port` ou `serial:///dev/ttyUSB0`, sans les réglages série, donc un instrument ouvert de deux façons est un seul interrupteur.
- **Un refus** est une erreur sur le fil d'erreur du nœud (code 5007) qui dit que les écritures vers cet instrument sont désactivées, et l'instrument n'entend jamais la commande.
- **L'activer.** `PUT /instruments/writes` avec `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, qui nécessite `instrument.write` (un administrateur l'a) et est conservé dans `instrument-writes.json` dans le répertoire de données, donc un redémarrage ne change rien. `GET /instruments` liste chaque instrument qui a un interrupteur ou un diagramme déployé qui y écrirait, avec qui l'a réglé et les diagrammes et nœuds concernés.
- **Audit.** Chaque changement d'interrupteur est `instrument.switch`, et chaque écriture d'un diagramme est `instrument.write` ou, quand elle est refusée, `instrument.refused`, avec le diagramme, le nœud, l'instrument et la commande.
- **Le déploiement le dit.** Un nœud qui écrirait sur un instrument est une note sur le diagramme (les **notes** de la barre, et la liste qu'imprime `hotloop-flow test`), qui nomme l'instrument et dit que ses écritures sont désactivées tant que personne ne les active. Les fichiers de flux qui ne font que lire ne changent pas.

## Importer un VI LabVIEW

Importez un `.vi` dans la boîte de dialogue Importer de l'éditeur (ou `import_vi` par MCP, ou `POST /flows/import-vi`) et FlowLab lit ce qu'il peut et liste, avant que quoi que ce soit ne soit ajouté, ce qu'il n'a pas pu lire. Lisez docs/labview-import.md : il dit exactement ce qui passe et ce qui ne passe pas. La version courte : le nom du VI, sa description, sa version, les noms de la face avant et les VI qu'il appelle passent, sous forme de note sur un flux à part. Les fils et les primitives du diagramme de blocs ne passent pas, donc le diagramme est à dessiner par vous, avec ces noms à côté.
