---
title: "Feuille de route de Flow"
description: "Les phases de Flow, ce qui est fait et ce qui vient, y compris la réécriture de l'éditeur en Astro."
---

Ce que HotLoop Flow va devenir, dans l'ordre où il se construit. Si ce n'est pas sur cette liste, ce ne sera pas fait : mettez-le sur la liste.

Flow se construit à côté de HotLoop et reste un produit à part. FlowLab et ses diagrammes, la phase 9, forment un pack distinct qui vit à côté du moteur de messages.

## À quoi sert Flow

Un moteur de flux visuel pour l'atelier. Chaque déploiement est comparé, testé et à un clic du retour arrière. Quand quelque chose part de travers à 3 h du matin, vous voyez exactement par quel chemin un message est passé et à quoi il ressemblait à chaque saut. Il tient dans un seul binaire statique assez petit pour un Pi, et il ne s'effondre pas quand un capteur devient bavard.

Il lit aussi vos `flows.json` existants tels quels. C'est un plus, pas l'objectif.

Les règles sous lesquelles chaque point ci-dessous est livré :

- Pas de bouchons. Si ce n'est pas construit, testé contre le réel et fonctionnel, ce n'est pas coché.
- Tout ce qui peut commander un équipement passe par une porte qui peut dire non, et qui dit pourquoi.
- Rien n'est jeté en silence. Chaque rejet, refus et débordement est compté et apparaît dans les métriques.
- Le fichier de flux continue de se charger et de s'enregistrer octet pour octet. Les nouvelles données vont dans des clés que les autres outils ignorent, et le test d'aller-retour couvre les fichiers qui en portent.

---

### Phase 0 : dire la vérité

Le README affirme des choses que le code ne soutient pas. On corrige cela avant de promettre quoi que ce soit de nouveau, parce qu'un README qui ment une fois se lit ensuite comme s'il mentait toujours.

- [x] Le bac à sable WASM est réel et testé, mais aucun nœud ne l'utilise et il n'est pas dans le binaire. On le dit tant que la phase 6 ne l'a pas rendu vrai
- [x] Deux commentaires de code renvoient à un magasin de contexte embarqué qui n'existe pas. On les supprime
- [x] Remesurer la mémoire au repos et en charge de la même façon sur la même machine, publier la commande avec le chiffre, et abandonner tout chiffre que personne ne peut reproduire
- [x] CVE-2025-41656 est un fournisseur qui livre un autre moteur de flux avec l'authentification désactivée, pas une CVE de ce moteur. On corrige l'attribution dans le README et dans la ligne `exec` de `docs/compatibility.md`
- [x] Réécrire le haut du README autour de ce que Flow fait. L'import de flux existants passe dans sa propre section plus bas, avec l'aller-retour exact à l'octet et `hotloop-flow import` comme preuve
- [x] La documentation de déploiement parle de Kubernetes, de Podman et de Quadlet, pas de l'App Store d'une seule entreprise
- [x] Des tests pour les paquets qui n'en ont aucun : `api` (connexion, permissions, le 409 sur un déploiement périmé), `config` (chaque refus au démarrage que liste le README) et `cmd` (le déploiement écrit le fichier de flux avant d'arrêter l'ancien runtime), plus `js`, le bac à sable du nœud Function, qui n'en avait pas non plus

### Phase 1 : historique, différences, retour arrière

Chaque déploiement est un enregistrement : qui, quand, une note, les octets exacts et ce qui a changé. « Qu'est-ce qui a changé, qui l'a changé, remettez-le » est la première chose que tout le monde demande après l'arrêt d'une ligne, et aujourd'hui la réponse, ce sont trois fichiers `.bak`.

- [x] Journal des déploiements : chaque déploiement est un enregistrement immuable avec l'utilisateur, l'heure, une note facultative, les octets du flux et les identifiants chiffrés tels qu'ils étaient. La rétention est un réglage. `GET /deployments`
- [x] Différence sémantique : nœud par nœud, propriété par propriété. Ajouté, supprimé, modifié, recâblé. Déplacer un nœud apparaît comme de la mise en page, jamais comme un changement de logique. Par l'API et sous la forme `hotloop-flow diff a.json b.json`
- [x] La différence fonctionne comme un difftool git, si bien qu'une pull request sur un flux se lit « seuil de la règle 2 de 7,5 à 8,0 » au lieu d'un bloc de JSON
- [x] Retour arrière : redéploie un ancien enregistrement comme un nouveau, identifiants compris, si bien qu'un nœud supprimé revient avec le mot de passe de son broker. L'historique reste en ajout seul
- [x] Éditeur : panneau d'historique, la différence dessinée sur le canevas, « relire et déployer » avec une note, un bouton de retour arrière. Un conflit de déploiement montre ce que l'autre personne a changé au lieu d'une boîte oui/non
- [x] Flux en tant que code : `hotloop-flow deploy` et `hotloop-flow export` pour la CI/CD, avec un jeton réservé au déploiement, pour qu'un pipeline ne détienne jamais un mot de passe d'administrateur
- [x] Miroir git facultatif : chaque déploiement poussé sous forme de commit signé par la personne qui a déployé. Go pur, et le contrôle de taille du binaire passe toujours
- [x] Journal d'audit : connexions, connexions échouées, déploiements, retours arrière et injections, chacun avec qui et d'où. Le journal des déploiements en est la première table
- [x] MFA (TOTP), gratuite et activable par quiconque la veut. Rien de ce qui touche à une connexion sûre n'est jamais payant
- [x] Limitation des tentatives de connexion et verrouillage, sessions qui survivent à un redémarrage, et jeton du websocket envoyé comme sous-protocole au lieu d'être dans l'URL. Un jeton dans l'URL fonctionne toujours pour les scripts existants et consigne un avertissement, parce que les casser lors d'une mise à jour était pire que la fuite ; le retirer attend une version majeure

### Phase 2 : tests de flux

« Mon changement a-t-il cassé la ligne ? » trouve sa réponse avant le déploiement, pas après. Les tests sont du YAML à côté des flux, donc ils se comparent et se relisent de la même façon.

- [x] `hotloop-flow test` : le vrai runtime et les vrais nœuds, dans le processus. Injectez un message, attendez ce qui sort d'un port dans un délai, attendez rien, attendez qu'une erreur arrive à un Catch. Sortie JUnit pour la CI/CD
- [x] E/S virtualisées : un MQTT out, une écriture en base ou une requête HTTP dans un test enregistre ce qu'il aurait envoyé et ne touche jamais le réseau
- [x] Horloge virtuelle : un Delay de cinq minutes s'exécute en millisecondes, et chaque nœud de temporisation est prouvé contre elle
- [x] Fixtures de contexte et d'identifiants, et assertions sur le contexte ensuite. Un test ne peut pas s'appuyer sur ce qu'un autre a laissé derrière lui
- [x] Barrière de déploiement : lorsqu'elle est active, un déploiement qui échoue à ses tests est refusé avec les assertions en échec, et les flux déjà en marche ne s'en aperçoivent pas
- [x] Éditeur : transformez un message de débogage capturé en test en deux clics, lancez la suite depuis l'éditeur, avec réussite et échec affichés sur les nœuds

### Phase 3 : traçage et rejeu

- [x] Cliquez sur un message de débogage et le canevas éclaire le chemin qu'il a pris, avec le temps et la charge utile à chaque saut, à travers les séparations, les jonctions et les sous-flux
- [x] Tampon de trace borné. La mémoire reste plate sous un test d'endurance d'un million de messages, et le chiffre est publié
- [x] Rejouer un message capturé dans un brouillon du flux et comparer la sortie
- [x] Une trace capturée devient un test de la phase 2
- [x] Export OpenTelemetry, prouvé contre un vrai collecteur

### Phase 4 : état durable

Un historien en panne pendant une heure ne devrait pas vous coûter une heure de mesures.

- [x] Contexte persistant dans SQLite, Go pur sans cgo, avec les opérations atomiques (comparer-échanger, incrémenter, mettre à jour). Un seul magasin pour le contexte maintenant et les files durables ensuite, pas deux. Aujourd'hui les contextes de flux et global disparaissent à chaque redémarrage, c'est le manque le plus susceptible de mordre quelqu'un en premier. Écrit en différé dans une transaction toutes les trente secondes, et une valeur remise à ce qu'elle était n'écrit rien
- [x] Liaisons durables : marquez une liaison durable et sa file se vide dans ce même magasin au lieu de bloquer ou de jeter. Elle survit à un redémarrage, garde l'ordre, respecte un quota de disque, et la profondeur est une métrique. Marquée dans le fichier de flux par `ew_durable`, donc l'aller-retour reste exact à l'octet. Double-cliquez sur une liaison dans l'éditeur pour la marquer
- [x] Stocker et retransmettre prouvé à la dure : tuer le vrai InfluxDB pendant dix minutes sous une entrée régulière, le relever, compter les lignes. Aucune manquante, aucune en double. Puis kill -9 du runtime au milieu de la file et recompter. Le script, les comptes et les écritures disque par heure sont dans [durable/](/fr/flow/durable-state/)
- [x] Prouvé sur un vrai Pi 5 : mémoire, temps de démarrage et débit soutenu, dans [docs/bench](/fr/flow/benchmarks/#résultats-sur-un-raspberry-pi-5), avec le bridage thermique observé
- [ ] Prouvé sur un Pi 4 et un Zero 2 W, et les écritures par heure sur une carte SD, parce qu'un magasin de contexte qui use une carte SD est un bug. Ouvert, car il faut les cartes. Le Pi 5 est mesuré ; un chiffre venu d'une autre machine serait inventé

### Phase 5 : l'atelier

`scan` trouve un automate aujourd'hui et rien dans la palette ne sait lui parler. C'est le plus gros trou d'un produit conçu pour les usines.

- [x] Modbus TCP lecture et écriture
- [x] OPC UA lecture, abonnement et écriture
- [x] S7 lecture et écriture
- [x] Sparkplug B, en nœud de périphérie et en hôte
- [x] EtherNet/IP lecture et écriture
- Tout sur simulateurs. Aucune CPU Siemens ni aucun contrôleur Logix n'a été en face de tout cela
- [x] Nœuds HotLoop : changements d'entité en entrée, état d'entité, appel d'un script, application d'une recette. Chaque commande passe par la porte d'écriture de HotLoop et arrive dans son journal sous la forme `flow:<node id>`, et une écriture que la porte refuse arrive à un nœud Catch avec la raison de la porte
- [x] Quand HotLoop est là, les écritures de Flow vers les équipements passent par la porte de HotLoop au lieu d'aller droit à l'automate. Les deux sont livrés dans la 2.3.0. Une écriture à travers la vraie porte est prouvée pour Modbus contre une image HotLoop publiée ; les nœuds d'écriture OPC UA, S7 et EtherNet/IP envoient par le même code et un test vérifie que chacun propose la porte.

### Phase 6 : des plugins sans npm

- [x] Un nœud `wasm` sur l'hôte qui existe déjà : plafond de mémoire strict, un délai, et un invité qui dépasse l'un ou l'autre s'arrête sans rien entraîner d'autre
- [x] Format de plugin : le module, un descripteur pour que l'éditeur dessine son dialogue, et une signature. Les plugins non signés ou altérés refusent de se charger et disent pourquoi
- [x] Capacités : un plugin n'a aucun accès à l'hôte sauf si son manifeste le demande et que l'opérateur l'accorde. Demander ce qui n'est pas accordé fait échouer le déploiement

### Phase 7 : liaisons typées et MCP

- [x] Validation de schéma sur le nœud `json`, la première tranche
- [x] Schémas facultatifs sur les ports. Un écart que l'éditeur voit est refusé au déploiement ; un écart qu'il ne voit pas va à un nœud Catch avec le chemin du champ fautif, et à une métrique
- [x] Types dessinés sur les liaisons dans l'éditeur
- [x] Flux en tant qu'outils MCP : un nœud outil déclare un nom, une description et un schéma d'entrée, et Flow sert `/mcp`. Un agent qui appelle un flux obtient les mêmes permissions et le même journal d'audit qu'une personne
- [x] Un nœud client MCP, pour qu'un flux puisse appeler les outils d'autres serveurs, celui de HotLoop compris
- [x] Les propres outils MCP de Flow : lister, lire, déployer et annuler des flux, lister les déploiements et appuyer sur un nœud inject, par les gestionnaires mêmes de l'API d'administration avec les mêmes permissions, les mêmes contrôles de déploiement et la même piste d'audit, parce qu'un MCP qui ne pourrait appeler que ce qu'un auteur de flux a câblé ne pourrait ni lire ni écrire Flow lui-même
- [x] Les propres outils MCP de Flow pour les diagrammes et les instruments : lister et lire les diagrammes, en lancer et en arrêter un, piloter son débogueur, régler un contrôle de son panneau, poser des points d'arrêt et des sondes, créer un sous-diagramme, et lire et basculer les écritures d'un instrument, chacun étant une route d'administration exécutée par son propre gestionnaire avec la permission que cette route demande (`status.read`, `diagram.run`, `instrument.write`). Jusqu'ici les routes de diagrammes n'avaient pas d'outil, donc un agent pouvait déployer un diagramme sans pouvoir le lancer. Chaque route d'administration est désormais un outil ou est nommée dans un test comme devant être faite par une personne, et le test échoue quand une nouvelle route est ajoutée sans outil. 44 outils maintenant, avec ceux des stations, de la bascule et des traces

### Phase 8 : l'éditeur, réécrit en Astro

Fait, et avancé. Il devait venir en dernier, et nous l'avons passé devant les premières captures d'écran de Flow, parce que personne ne devrait voir les premières dans un éditeur qui semble venir d'une autre entreprise.

Chaque projet HotLoop reçoit une interface moderne unique, et cet éditeur était celui qui ne collait pas. C'était du TypeScript fait main sur du SVG natif, le bon choix quand l'objectif était un petit binaire statique sans rien à auditer. C'est maintenant Astro avec des îlots Svelte, la même pile que l'éditeur de Cascade, sur les mêmes tokens HotLoop, clair et sombre.

- [x] D'abord une passe de conception, avant une seule ligne d'Astro. À quoi l'éditeur doit ressembler et ce qu'il doit donner à côté du reste de HotLoop, réglé sur le papier et dans les tokens partagés, pour que la réécriture construise ce que quelqu'un a déjà décidé au lieu de décider en route
- [x] L'éditeur reconstruit en Astro avec le canevas, les dialogues, l'historique, la relecture, les tests, le traçage, la recherche et les groupes repris, sans qu'aucun ne régresse. Les tests de navigateur de `web/e2e` sont la barre : ils passent contre le nouvel éditeur sans changement
- [x] Toujours embarqué dans le seul binaire statique, toujours sans réseau nécessaire sur un boîtier de périphérie, toujours dans le budget de taille du binaire, et la barrière de licences couvre toujours tout ce qui part dans le paquet

Le canevas et le graphe en dessous n'ont pas été réécrits. Ils sont passés dans `web/src/lib` comme le TypeScript qu'ils étaient, avec une nouvelle peau, si bien que le câblage, le glisser, l'annulation et l'aller-retour exact à l'octet du fichier de flux sont le code déjà testé. Tout ce qui l'entoure est du Svelte.

Flow reste un produit à part pendant tout cela. Il partage l'apparence de HotLoop, pas le code, et n'est jamais embarqué dans HotLoop.

### Phase 9 : FlowLab, diagrammes

Une seconde façon d'exécuter un onglet, à côté des messages et jamais à leur place. Dans un diagramme, chaque nœud s'exécute une fois, quand chacune de ses entrées câblées a une valeur, et les branches sans liaison entre elles s'exécutent en même temps. C'est ce qu'il faut à un banc d'essai ou à un enregistreur de données : des boucles qui portent une valeur d'un passage au suivant, une erreur qui voyage sur sa propre liaison, un panneau qu'un opérateur peut ouvrir sur un téléphone et un débogueur qui peut suspendre une exécution et montrer ce qu'il y a sur chaque liaison. Les flux existants ne changent pas, et le fichier de flux continue de se charger et de s'enregistrer octet pour octet : un diagramme est un onglet avec une clé `ew_diagram`, et l'entrée sur laquelle arrive une liaison est conservée dans `ew_in` sur le nœud d'où elle part. [FlowLab](/fr/flow/flowlab/) dit le reste.

- [x] L'ordonnanceur : toutes les entrées câblées prêtes, branches indépendantes en parallèle, et une liaison `after` pour l'ordre là où aucune donnée ne circule
- [x] Boucles while et for avec valeurs portées, et une liaison d'erreur qui saute les nœuds après un défaut, arrête une boucle et porte sa source et son code
- [x] Un port série, avec des lectures jusqu'à un terminateur ou un nombre d'octets, un délai sur la liaison d'erreur, et un port rouvert après un câble débranché et compté
- [x] Un analyseur de mesures, la détection de valeur stable et un journal texte avec une colonne d'heure
- [x] Un panneau servi par Flow : commandes, indicateurs et un graphique ou une courbe, ouvert sur un téléphone pendant qu'une exécution est en direct, avec un second observateur sur un poste, chacun suivant l'exécution à la seconde près
- [x] Lancer, arrêter, surligner l'exécution, sondes sur n'importe quelle liaison, points d'arrêt sur les nœuds, les liaisons et les passages, et pas à pas détaillé, principal et sortant
- [x] L'éditeur dessine des ports nommés et des liaisons vers celui où vous déposez, et la même page exécute et débogue
- [x] Structure Case, enregistrements et types partagés, formes d'onde
- [x] Journalisation TDMS et binaire, et sortie vers une base de données et vers MQTT
- [x] Sessions d'instrument, sur socket brut et série, prouvées contre un simulateur et un pty
- [ ] Un client d'acquisition de données prouvé contre le propre serveur de NI. Il est construit et livré, et testé seulement contre un serveur de substitution, il reste donc ouvert tant qu'il n'a pas tourné contre le serveur de NI et un appareil
- [x] Analyse : statistiques et filtres
- [x] Sous-diagrammes, une liste d'erreurs en CI/CD, et le travail de zoom et de mise en page de l'éditeur
- [x] Rejeu d'une exécution terminée : chaque début et fin de nœud et chaque valeur de liaison sont enregistrés, et la barre du diagramme rejoue la dernière exécution sur le canevas. `GET /diagrams/{id}/trace`, l'outil `get_diagram_trace`
- [x] Une destination base de données qui garde ce qu'une base de données rate : `postgres out`, durable, écrit dans l'ordre et par lots quand la base revient, prouvé sur un vrai TimescaleDB
- [x] Pousser un fichier de flux, et donc un jeu de diagrammes, vers chaque installation Flow qu'un tenant exploite dans EmberNet, avec une vérification après chacune et une installation en échec remise en l'état ([Envoi vers les stations d'un tenant](/fr/flow/stations/)), prouvé sur trois vrais processus Flow
- [ ] Prouvé sur un Pi pendant une journée, ce qui demande la carte et une longue exécution

---

## Les manques de tous les jours

Ils avancent en parallèle des phases. Personne ne choisit un moteur de flux parce qu'il les a, mais beaucoup de gens en abandonnent un qui ne les a pas.

- [x] Déploiement partiel : seuls les nœuds modifiés et leurs liaisons redémarrent. Aujourd'hui chaque sauvegarde coupe toutes les sessions MQTT et tous les messages en vol, ce qui apprend aux opérateurs à ne pas déployer pendant une équipe
- [x] JSONata, prouvé contre les exemples publiés, puisque c'est ce sur quoi un flux importé trébuche le plus souvent
- [x] Inject de type cron
- [x] Mode retour de Link Call et de Link Out
- [x] Join par délai et reduce, batch par durée, split en flux continu
- [x] MQTT v5 et last will
- [x] TLS sur TCP, cookies et multipart sur HTTP
- [x] Éditeur : copier-coller, import et export d'une sélection, édition de sous-flux et de groupes, recherche entre les flux, filtrage du débogage
- [x] Manques de l'éditeur que la première passe a laissés : ajouter un nœud de configuration depuis la palette (le dialogue le demandait et on ne pouvait pas), transformer une sélection en sous-flux, renommer et supprimer un flux, et marquer une liaison durable par double-clic
- [x] Une issue pour un message que la cible d'une liaison durable refuse pour toujours : une limite de tentatives facultative par liaison. Après ce nombre de refus, le message va au Catch du flux comme une erreur avec le message joint et la liaison avance. Désactivé par défaut, donc une liaison tient et réessaie exactement comme avant
- `store.*` existait déjà depuis le travail sur le durable et a maintenant le même contrôle
- [x] Un nœud qui pointe vers un nœud de configuration absent du fichier (un flux supprimé avec son propre broker alors qu'un sous-flux, une modification à la main ou un import le nomment encore) est signalé par `hotloop-flow import`, dans l'éditeur au chargement et au déploiement, et dans la réponse du déploiement, et le nœud est un échec de démarrage au lieu d'un nœud qui ne marche jamais en silence
- [x] Les manques que celui-là a laissés : une référence de configuration qui nomme un onglet, un sous-flux, un groupe, un nœud ordinaire ou le mauvais type de nœud de configuration est signalée et échoue au démarrage comme une qui ne nomme rien, un retour arrière met les avertissements du fichier dans le journal de l'éditeur une fois et pas deux, et `hotloop-flow import` écrit son rapport dans un writer comme le fait `deploy`, pour que ses tests cessent de remplacer la sortie standard
- Le projet d'origine a encore la ligne ; nous ne lui avons pas demandé de reprendre le changement
- [x] Le test de purge de liaison durable pouvait compter un rejeté de plus que ce qu'il avait échantillonné comme en file. Le test avait tort, pas la file : il attendait 28 messages sur 30 sur disque puis tenait la purge à exactement ce qu'il avait vu, alors que le spool comptait encore les derniers. Combien des 30 sont sur disque quand la liaison part dépend du timing, il tient donc maintenant la purge à ce qu'il a vu comme plancher et aux 30 envoyés comme plafond
- [x] Le test d'arrêt brutal de liaison durable passait en local et échouait sur un runner plus lent. La file comptait un message comme en attente avant qu'il soit sur disque, si bien qu'une copie prise à l'instant où le compte atteignait 100 pouvait avoir un message de moins. Elle compte maintenant après le commit
- [x] L'éditeur, le texte des nœuds et la page du tableau de bord en 13 langues en plus de l'anglais, avec un glossaire partagé
- [x] Kafka out, et ntfy, gotify et discord out, avec les réglages de notification que core a déjà
- [x] Une liaison durable vers InfluxDB se rattrape par lots allant jusqu'à 256, si bien qu'une heure de retard se vide en secondes et non en minutes
- [x] Les nœuds connecteurs Node-RED dont une migration d'usine a besoin (serveur Modbus sur une interface réseau, e-mail, postgres et les nœuds du tableau de bord), exécutés en natif
- [x] Valeurs du chart et un contrôle de rendu pour l'envoi vers les stations
- [x] Secrets par référence : un nœud lit un mot de passe depuis un Secret Kubernetes monté ou un fichier, si bien qu'il ne vit jamais dans le fichier de flux
- [x] Apportez vos flux : `hotloop-flow import` continue de dire exactement ce qui s'exécutera et ce qui ne s'exécutera pas avant tout déploiement. Il liste les types de nœuds qui s'exécutent, ceux qui s'exécutent avec une différence et laquelle, ceux qui ne démarreront pas, et un nœud qui pointe vers un nœud de configuration absent du fichier

## Plus tard

- [x] Actif/veille : un bail dans un PostgreSQL avec un numéro de barrière, une barrière sur chaque écriture vers un équipement, et une veille qui retient ses écritures jusqu'à ce qu'elle reprenne le bail ([Veille chaude avec un bail](/fr/flow/failover/)). Prouvé sur deux vrais processus Flow contre un vrai PostgreSQL et un serveur Modbus qui consigne chaque écriture : tués en plein flux, gelés puis dégelés, et arrêtés proprement, sans aucune écriture des deux à la fois. Le contexte reste sur le disque de chaque installation et non dans Postgres, ce qui était la première esquisse et n'est pas nécessaire pour empêcher deux écrivains

## Décidé

Chaque question que cette liste portait a sa réponse. Elles restent ici avec les réponses, parce que les raisons sont ce qui empêche quelqu'un de les rouvrir.

Décidé le 2026-10-03 :

- **Les nœuds industriels se construisent dans Flow,** sur les mêmes bibliothèques open source que les pilotes HotLoop. Les pilotes de HotLoop restent ceux de HotLoop. Flow garde sa propre licence, qui était autre quand cela a été décidé et qui est maintenant le HotLoop Source License Agreement 1.0, lequel a remplacé l'EmberNet Source License 1.0 et, avant elle, la Business Source License 1.1 qu'il portait depuis la 2.2.0.
- **Flow reste un produit à part et n'est jamais embarqué dans HotLoop.** Il tourne à côté de HotLoop et parle à l'API de HotLoop de l'extérieur, ce que font les nœuds HotLoop de la phase 5, et c'est toute la relation.
- **Le README commence par ce que Flow fait.** « Câblez l'atelier. Relisez-le comme du code. » L'import de flux existants vit plus bas dans « Apportez vos flux », et rien en haut ne compare Flow à quoi que ce soit. Flow tient debout tout seul.
- **Le contexte persistant est SQLite dès le départ,** Go pur sans cgo. Un seul magasin pour le contexte maintenant et les files durables ensuite, pas un magasin de fichiers d'abord et un second ensuite.
- **Le produit d'automatisation de flux de travail est une chose à part** et ne partage pas le moteur de Flow. L'historique, la différence et le reste restent ici des paquets du moteur, parce que l'API, la CLI, l'éditeur et git doivent tous obtenir la même réponse.

Décidé avant le début de la phase 1 :

- **La MFA et le journal d'audit sortent dans la phase 1,** avant le plus amusant. Les deux sont sortis.
- **L'aller-retour exact à l'octet des fichiers de flux existants reste une règle ferme,** même avec des types et des tests dans le fichier. Les nouvelles données vont dans des clés que les autres outils ignorent, et le test d'aller-retour couvre les fichiers qui en portent.
- **Les benchmarks sont des chiffres absolus uniquement,** chacun avec la commande qui l'a produit. Un tableau comparatif bouge à chaque changement de machine, et finit par décrire l'autre moteur plus que celui-ci.
