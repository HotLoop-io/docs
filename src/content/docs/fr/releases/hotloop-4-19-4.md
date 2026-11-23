---
title: "Notes de version: HotLoop core 4.19.4"
description: "Ce qu'apporte HotLoop core 4.19.4, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.19.4"
---

Les 4.19.0, 4.19.1, 4.19.2 et 4.19.3 ont été taguées sans jamais être publiées : rien qui porte l'un de ces noms n'existe, et `stable` n'a jamais pointé vers aucune. Voici la première version avec tout ce que leurs notes énumèrent, ce qui inclut une nouveauté depuis la 4.19.1 : les charts acceptent `hostNetwork`.

- La 4.19.1 a ajouté le correctif correspondant et un autre (un écouteur de découverte qui se disait actif avant de pouvoir entendre, plus bas) et a été sautée avant sa sortie.
- La 4.19.2 a ajouté `hostNetwork`.
- Les deux sont corrigés plus bas.
- Tout ce qui figurait dans les notes de la 4.19.0 (MCP, écritures avec échelle, la connexion du store, CODESYS, le flux d'événements Kafka, OPC UA PubSub sur UADP et les correctifs) se trouve dans les notes ci-dessous.

Ce qui est nouveau depuis la 4.19.1 : les charts ont un réglage `hostNetwork`.

## hostNetwork

Tout chart HotLoop qui a un pod (ceux du Gateway, d'IoT et d'Edge, et celui de l'Edge Relay) accepte `hostNetwork: true`. Il est désactivé par défaut, et désactivé le chart produit exactement ce que produisait celui de la 4.19.1.

- **À quoi ça sert.** À un pod qui doit entendre ce que son nœud entend : du multicast UDP sur la boucle locale du nœud (un runtime d'automate sur le même boîtier qui publie OPC UA PubSub vers un groupe multicast sur la boucle locale), ou une seconde carte réseau. Un réseau de pods ne porte ni l'un ni l'autre.
- **Ce que ça fait.** Le Deployment reçoit `hostNetwork: true` et `dnsPolicy: ClusterFirstWithHostNet`, si bien que les noms DNS du cluster continuent de se résoudre.
- **Ce que ça implique pour le pod.** Il utilise les adresses et les ports du nœud : la page répond sur chaque adresse du nœud à `service.targetPort`, donc choisissez un port que rien sur le nœud n'utilise et gardez l'authentification activée. Une NetworkPolicy ne s'applique pas à un pod en réseau hôte (le plugin réseau du cluster les ignore). Épinglez le pod à son nœud avec `nodeSelector`.
- **Un écouteur sur la boucle locale.** L'abonné OPC UA PubSub rejoint un groupe sur une carte désignée par son nom ou son adresse : `"interface": "127.0.0.1"` dans les options de l'équipement le fait rejoindre sur la carte de boucle locale.
- **Rien d'autre.** Le code est celui qu'aurait livré la 4.19.1. Le garde-fou de version rend désormais chaque chart avec et sans le réglage et échoue si l'un des deux rendus est faux.

---

Le reste de cette version, issu de la 4.19.0 et de la 4.19.1 :

Deux choses de la 4.19.4 changent ce que fait une usine existante : lisez-les avant de toucher une usine en production. Les agents via MCP peuvent désormais écrire, et le point d'accès MCP a toujours un jeton. Et une valeur que vous écrivez dans un tag avec échelle atterrit enfin dans le registre comme vous l'entendiez, ce qui veut dire que quiconque contournait l'ancien comportement doit arrêter. Tout le reste est nouveau, ou un correctif.

Les notes complètes sont dans le README : Ce qui change dans la 4.19.4.

### MCP est activé, il écrit, et il a toujours un jeton

- **Les agents peuvent écrire maintenant, là où un opérateur le pouvait.** MCP est activé dans tous les produits HotLoop et il lit et écrit. `allowMcpWrites` vaut true par défaut dans le code et dans les trois charts. Un déploiement qui a `allowWrites` activé et n'a jamais défini `allowMcpWrites` obtient des écritures d'agents après cette mise à jour, par la même porte que l'écran : les permissions de l'utilisateur, la marque inscriptible du tag et sa plage s'appliquent toujours.
- **`allowWrites` n'a pas changé.** Il reste désactivé par défaut et décide toujours si quoi que ce soit peut écrire, l'interface comme les agents. S'il est désactivé, rien n'écrit, MCP compris.
- **Un déploiement qui avait enregistré `allowMcpWrites: false` reste désactivé.** Cela inclut un déploiement installé depuis l'App Store, qui enregistre chaque réponse. Basculez-le si vous voulez que les agents écrivent.
- **Le point d'accès n'est jamais ouvert.** Les charts définissent toujours un jeton MCP. Un HotLoop démarré sans `HOTLOOP_MCP_TOKEN` (une unité Quadlet, un binaire seul) servait `/mcp` à quiconque pouvait atteindre le port et ne journalisait qu'un avertissement. Il crée maintenant un jeton de 24 octets à son premier démarrage et le garde dans sa base, si bien que chaque réplique et chaque restauration portent le même. Un appel sans le jeton reçoit un `401`. Un jeton que vous avez configuré n'est jamais remplacé.
- **Pour obtenir le jeton sur une installation seule ou Quadlet :** `hotloop mcp-token` l'affiche. Si un agent pointe vers `/mcp` sur l'une de ces installations sans jeton, il cesse de fonctionner à cette mise à jour jusqu'à ce que vous lui donniez ce jeton. C'est voulu.
- **Qui a fait l'appel.** Un jeton statique dit quel client a appelé, jamais quelle personne. Avec les réglages OIDC activés, une connexion Vord ou une assertion du hub sur `/mcp` fait que l'audit nomme la personne (`mcp:pat@example.com`), et un rôle d'écriture facultatif restreint les écritures par appelant en plus des interrupteurs ci-dessus. C'est désactivé tant que vous ne le configurez pas, et le jeton continue de fonctionner à côté. [La page MCP](/fr/iot/mcp/) décrit la mise en place.

### Écritures dans un tag avec échelle

- **Ce qui n'allait pas.** Un tag avec une échelle, disons 0.1 sur un registre de température qui contient des dixièmes de degré, vous montre la valeur d'ingénierie : le registre dit 555 et l'écran dit 55.5. L'écriture allait dans l'autre sens sans le même soin. Vous tapiez 55.5 pour la consigne et HotLoop mettait 55 dans le registre, qui se relisait ensuite comme 5.5. C'était pareil sur tous les écrans, par l'API, depuis une automatisation, un script, une recette, une boucle et via MCP, parce que tous passent par la même porte d'écriture. La ligne d'audit disait 55.5 depuis le début, donc rien ne paraissait faux dans le journal.
- **Ce qui change.** Le nombre que vous écrivez est dans les unités propres du tag, comme celui que vous lisez. HotLoop retire l'échelle et le décalage avant d'envoyer : 55.5 sur un tag à l'échelle 0.1 met 555 dans le registre, et il se relit 55.5. Un tag sans échelle ni décalage n'est pas touché du tout. Les bits, les bobines, les chaînes et les écritures Sparkplug et MQTT d'un indicateur ne sont pas mis à l'échelle non plus.
- **Si vous contourniez, arrêtez.** Si quelqu'un tapait des comptes bruts dans un tag avec échelle pour obtenir le bon nombre, en tapant 555 pour obtenir 55.5, cela envoie maintenant 5550 et se relit 555. Tapez la valeur d'ingénierie. Regardez vos tags avec échelle avant de mettre à jour : tout tag ayant une échelle autre que 1, ou un décalage, dans lequel quelqu'un écrit à la main, depuis une automatisation ou depuis une recette, mérite un coup d'œil. Les recettes et automatisations qui écrivaient des comptes doivent voir leurs nombres changés en valeurs d'ingénierie dans la même étape que la mise à jour.
- **Une valeur que le registre ne peut pas contenir est refusée.** Une fois l'échelle retirée, un compte qui ne tient pas dans le registre, 7000 sur un `uint16` d'échelle 0.1, est refusé avec un message clair qui nomme le compte et le registre, et rien n'est envoyé. Avant, il se bouclait sans bruit : 70000 sur un registre 16 bits partait comme 4464. Cela vaut pour les types entiers de Modbus, S7, EtherNet/IP et OPC UA.
- **Une recette avec une valeur qui ne tient pas est refusée en entier.** Avant sa première écriture, chaque cible est vérifiée, donc une recette ne s'applique jamais à moitié avant d'être refusée. Pour Modbus, S7 et EtherNet/IP, la vérification connaît le type de registre de chaque tag par son adresse. Pour OPC UA, qui est la voie vers un runtime CODESYS, elle utilise le type sous lequel est arrivée la dernière lecture du tag. Un tag jamais lu depuis le démarrage de HotLoop n'a pas encore de type de référence, donc une recette qui le vise est refusée à l'écriture de ce tag, après que les cibles précédentes ont été écrites, et l'application enregistre lesquelles. Le lire une fois, ce que l'interrogation fait dans la seconde suivant la connexion, règle cela.
- **Une fraction de compte est coupée.** Un registre contient des comptes entiers, donc 12.34 sur un registre à l'échelle des dixièmes contient 12.3, comme toujours.
- **Ce qui n'a pas changé.** Le contrôle de plage d'un tag et la ligne d'audit utilisent le nombre que vous avez tapé. La porte d'écriture, les permissions et les règles de refus sont les mêmes.

### Une installation depuis le store vous connecte en tant que vous

Le chart créait un mot de passe administrateur aléatoire dans un Secret que le tenant ne peut pas lire, si bien qu'une installation depuis le store arrivait sur une connexion sans issue. Avec la clé publique du tableau de bord configurée, une requête portant une assertion signée valide pour ce tenant et ce Service connecte cette personne, crée son utilisateur la première fois, garde son rôle aligné sur ce qu'a envoyé le tableau de bord, et la piste d'audit la nomme. Une assertion mauvaise, expirée, d'un autre tenant ou d'une autre application est refusée, et la connexion locale n'est pas touchée. C'est désactivé tant qu'aucune clé n'est définie, et les trois charts de produit prennent la clé du store. [Authentification et utilisateurs](/fr/iot/authentication/) donne les réglages.

### CODESYS, avec les noms que le programmeur a donnés aux variables

HotLoop lit et écrit un automate CODESYS par le serveur OPC UA propre au runtime, comme CODESYS le documente : la Symbol Configuration de l'application, publiée sous le modèle PLCopen IEC 61131-3. La découverte liste ce que l'application exporte avec les types et l'accès que le programmeur leur a donnés, en descendant dans les tableaux et les structures, et un tag est un symbole IEC que l'on trouve sous le nom que le projet donne à son automate et à son application. Un redémarrage, un téléchargement ou une liaison perdue se lit comme mauvais avec la raison et revient sans intervention. Nous l'avons prouvé contre un vrai runtime 4.22.0.0 en test, faisant tourner notre propre programme, avec une écriture à laquelle répond la logique de l'automate, et contre un second programme de plus de cent mille variables, lu en 2.4 secondes.

Cela touche un pilote que des usines font tourner, donc clairement : le pilote OPC UA demandait 200 nœuds par requête et ne lisait jamais ce que le serveur autorise. Un runtime CODESYS publie des OperationLimits de 100 et refuse davantage, et le pilote répondait en déclarant float chaque tag découvert et en ne lisant aucun tag d'un équipement de plus de cent. Les requêtes sont maintenant découpées selon les limites que le serveur publie à la connexion, et réduites de moitié quand un serveur qui n'en publie pas dit qu'il y en a trop. Un type de données sous-type d'un type standard (un STRING, BYTE ou TIME de CODESYS) est suivi jusqu'au type standard, donc typé et écrit comme celui-ci. Tout équipement OPC UA en bénéficie, pas seulement les CODESYS.

### Un flux d'événements Kafka

- **Ce que c'est.** HotLoop peut envoyer ses mesures et son journal système vers tout broker qui parle l'API Kafka : Apache Kafka, Redpanda et le reste de cette famille. C'est un nouveau type de cible historian, sous Settings, Historian targets, donc avec la file, le rattrapage à partir de l'historique propre de HotLoop et l'état qu'ont celles-ci. Les mesures vont dans un topic et le journal système (alarmes, équipements qui montent et descendent, changements) dans un autre, en JSON.
- **TLS et SASL.** SCRAM-SHA-256, SCRAM-SHA-512 et PLAIN (PLAIN uniquement sur TLS), avec votre propre CA si le certificat du broker ne vient pas d'une autorité publique. Les certificats client, Kerberos et les connexions OAuth ne sont pas encore pris en charge.
- **C'est au moins une fois.** Une mesure peut arriver deux fois après une panne, parce que le rattrapage chevauche volontairement ce qui est déjà parti. `deviceId`, `tag` et `ts` désignent un doublon. Les événements sont le flux en direct et n'ont pas d'historique à rattraper : un événement produit pendant que le broker est absent est perdu, et l'état de la cible le compte.
- **Un broker qui disparaît en pleine écriture.** La cible passe hors ligne en 25 secondes et les mesures de cette écriture sont dues, au lieu de rester active avec sa file qui déborde.
- **Un topic créé à l'instant.** Le premier regard sur un topic qui vient d'être créé, par vous ou par le dernier essai de la cible elle-même, attend qu'il existe et ait un leader au lieu de déclarer la cible hors ligne.
- **Ce que ça coûte.** Environ 5 MiB sur le binaire de chaque produit avec une base de données. L'Edge Relay n'a pas de cibles historian et ne l'embarque pas. Le client est franz-go, cité dans `NOTICE`.
- **Mise à jour.** La migration 0026 ajoute une colonne `options` aux cibles historian, vide pour chaque cible existante. Rien ne change pour elles. [Cibles historian](/fr/iot/historian-targets/#api-kafka-flux-dévénements) donne les formats d'enregistrement et ce qui est prouvé ou non.

### OPC UA PubSub sur UADP

- **Abonnement.** Un équipement avec le protocole `opcua-pubsub` écoute les DataSets d'un éditeur envoyés en UADP sur UDP, unicast ou multicast. L'adresse d'un tag est `<DataSetWriterId>/<field index>`. Champs Variant, DataValue et RawData, trames key, delta et keep alive. Un message perdu marque les tags de ce writer comme incertains jusqu'à sa prochaine trame key, et un writer silencieux se lit comme mauvais.
- **Publication.** Edge et Gateway peuvent publier en UADP les tags qu'un layout nomme, désactivé tant que `HOTLOOP_UADP_PUBLISH_ENABLED` n'est pas défini. Des trames key quand les valeurs changent et des keep alive quand elles ne changent pas. Un mauvais tag est publié comme son état, jamais comme sa dernière valeur.
- **Pas encore.** La sécurité des messages (messages signés ou chiffrés) est refusée nommément, tout comme les messages fragmentés, la découverte, les événements et les champs de structure. Les trames delta sont lues mais pas envoyées.
- **Tableaux.** Un champ qui est un tableau est lu dans les messages Variant et DataValue, et dans RawData quand le DataSet de l'équipement dit comment il est disposé (`"Float[250]"` pour un tableau avec son nombre, `"Float*250"` pour 250 champs séparés). Un tag nomme un élément, `1000/3[17]`, et Browse les liste.
- **Où il écoute.** Le groupe, le port et la carte réseau sont ceux de l'équipement. Un groupe multicast sur une carte désignée et un port unicast sur cette machine fonctionnent tous deux.
- [Protocoles et pilotes](/fr/iot/protocols/#opc-ua-pubsub-uadp) donne la mise en place et les limites.

### Images, et un second jeu d'écrans

- **amd64 seulement, cette fois.** Les images de la 4.19.4 sont construites pour amd64. Le tag de version ne liste qu'amd64, et `stable` et `latest` portent la nouvelle image amd64 à côté des images arm64 et arm/v7 qu'ils avaient déjà, qui sont celles de la version précédente. Un boîtier arm qui suit `stable` continue de télécharger et de faire tourner ce qu'il faisait tourner. La version suivante reconstruit toutes les architectures et se limite à un changement de numéro de version.
- **Les nouveaux écrans sont sur `/next`.** Une interface web reconstruite est dans chaque image derrière l'ancienne, qui reste celle que vous obtenez sur `/`. Essayez-la sur `/next` sur n'importe quelle installation ; rien ne change pour celle par défaut.

### Correctifs

- **Un processus n'arrête plus l'exécution suivante d'un script avec son propre arrêt qui lui revient.** L'arrêt d'un script est annoncé à tous les processus, y compris celui qui l'a fait, et l'annonce réentendue un instant plus tard annulait l'exécution de ce script en cours : sous charge, une exécution attendue était annulée 8 ms après son début, et une autre ne se terminait jamais. Un processus ignore l'arrêt qu'il a lui-même annoncé, et un arrêt annoncé par un autre processus l'arrête toujours.
- **Un écouteur de découverte est actif quand le broker a répondu à ses abonnements, et seulement alors.** Une attente expirée comptait comme une réponse, tout comme une réponse sur une connexion déjà disparue ; plus aucune des deux, et une réponse tardive compte toujours.
- **Un écouteur de découverte se dit actif quand il peut entendre.** La session MQTT se comptait connectée dès que le broker l'acceptait, et ne sortait ses abonnements qu'ensuite pour attendre que le broker les accorde. Un écouteur qui se déclarait actif là-dessus envoyait le message suivant dans le vide, et l'état ou la configuration d'un équipement non retenus étaient perdus. Il se déclare actif maintenant quand les abonnements sont accordés, à la première connexion et à chaque reconnexion.
- **Une épingle sur le tableau n'efface plus le tableau.** La page ne lisait le tableau qu'à l'ouverture de l'écran du tableau, donc un rechargement sur l'écran des tags contenait une liste vide et la première épingle remplaçait le tableau enregistré par ce seul tag. La page lit désormais le tableau au démarrage, une épingle est refusée tant que ce n'est pas fait, et un enregistrement porte le `rev` du tableau, si bien que le serveur répond `409` à un enregistrement sur un tableau modifié depuis sa lecture. Le `rev` est facultatif dans l'API : si vous l'omettez, l'enregistrement n'est pas contrôlé.
- **Un abonnement OPC UA bloqué est repéré.** La bibliothèque garde ses keep alive pour elle, donc une boucle de publication arrêtée ressemblait à une usine calme et servait ses dernières valeurs comme bonnes. Après dix intervalles de publication de silence (trente secondes au moins), le pilote lit les nœuds une fois, les compare à ce qu'il détient et retombe sur des lectures si l'un diffère.
- **Un automate qui se tait avec son socket ouvert est en panne, pas dégradé.** Modbus, S7 et EtherNet/IP gardaient leurs dernières valeurs jusqu'à ce que TCP abandonne, parce que l'interrogation revenait avant de juger la session. Ils la jugent maintenant. Aucun serveur S7 ou CIP n'est encore sur le câble en test, et la feuille de route le dit.
- **Un identifiant saisi dans une URL ou un texte libre est chiffré au repos.** Chaque écran masquait déjà `mqtt://user:pass@host` et `?token=` aux personnes, mais la base de données et les sauvegardes les gardaient tels que saisis. Une chaîne qui en porte un, d'après le même test que celui qui le masque, est scellée entière et revient exactement comme écrite, si bien que le pilote reçoit toujours l'URL qu'on lui a donnée. Une clé activée plus tard scelle ce qui était stocké avant, et une restauration demande la clé seulement quand une adresse seule en a besoin.
- **Toute heure que l'API écrit est en UTC.** Une usine réglée sur New York écrivait `-04:00` là où une usine en UTC écrivait `Z`, sur une trentaine de champs : `created_at`, `updated_at`, le `raisedAt` d'une alarme, l'heure d'un événement, le `lastPoll` d'un équipement, l'horodatage d'un tag, une entrée du logbook, la prochaine exécution d'un rapport. Elles se lisent pareil des deux côtés maintenant. Si vous les analysez dans un script qui attendait votre décalage local, il reçoit maintenant `Z`.
- **Les partitions mensuelles étaient sautées le 31.** Les tables d'historique et de logbook créaient leur partition suivante en ajoutant un mois à aujourd'hui, et le 31 cela sautait un mois, si bien que les lignes d'un mois se retrouvaient dans la partition par défaut. Elles partent maintenant du premier du mois.
- **Le journal d'événements UniFi est ordonné selon le moment où l'événement s'est produit,** et non selon le moment où la trame est arrivée ici, si bien qu'un rejeu après une reconnexion cesse de se retrouver au-dessus.
- **La façade d'un switch tient sur un téléphone.** Huit ports étaient plus larges qu'un écran de 390 pixels et la page défilait de 113 pixels sur le côté. Les ports sont maintenant des tuiles serrées, avec les watts PoE dans le détail du port, et une façade qui dépasse encore sa carte défile à l'intérieur.
- **Un téléphone sans session et sans connexion reçoit l'écran de connexion et la raison** au lieu d'une application vide, et se recharge quand HotLoop répond.
- **Un rollback tient en une commande.** L'index du chart fusionne dans celui en ligne au lieu d'être reconstruit à partir des charts de la version elle-même, si bien qu'une version plus ancienne se résout toujours.

### Mise à jour depuis la 4.18.11

- Lisez les deux premières sections ci-dessus avant de faire quoi que ce soit sur une usine en production.
- La migration 0026 est la seule. Elle est additive et toute ligne existante continue de fonctionner.
- Une installation seule ou Quadlet reçoit un jeton MCP à son premier démarrage. `hotloop mcp-token` l'affiche.
- `helm upgrade` comme d'habitude. Les unités Quadlet suivent `:stable` et n'ont besoin de rien. `helm rollback` vers la 4.18.11 convient pour cette version : la base est déjà PostgreSQL 17 et rien ici ne la change.
