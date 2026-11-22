---
title: "Intégrations"
description: "Pointez HotLoop vers un appareil dont vous avez l'adresse, voyez ce qu'il contient et gardez les points voulus. SNMP, BACnet/IP et OPC UA, lecture seule."
---

Une intégration est le moyen de pointer HotLoop vers un type d'appareil dont vous connaissez l'adresse, de répondre à quelques questions, de voir ce qu'il contient réellement et de garder les points que vous voulez. Elle crée l'appareil et ses tags. Les entités découlent des tags comme pour n'importe quel tag, de sorte que les nouveaux points sont dans l'API des entités, dans les automatisations et sur les tableaux de bord une minute plus tard.

Il y a trois façons pour un appareil d'entrer dans HotLoop, et elles sont faites pour coexister :

| <span class="sr-only">Details</span> | Qui la lance | Ce qu'il faut |
|---|---|---|
| [Découverte MQTT](/fr/iot/mqtt-discovery/) | L'appareil, en s'annonçant sur un broker | Un éditeur qui parle l'un des formats |
| [Découverte réseau](/fr/iot/network-discovery/) | Le réseau, en étant écouté | Rien de la part de l'appareil ; elle vous dit ce qu'elle a entendu et comment HotLoop pourrait lui parler |
| **Intégrations** (cette page) | Vous, avec une adresse | Un appareil qui répond à son propre protocole |

Une intégration n'écrit jamais dans l'appareil, et rien de ce qu'elle crée n'est armé. Un point trouvé est un point dont personne n'a encore décidé qu'il pouvait être commandé : chaque tag créé par une configuration est donc en lecture seule jusqu'à ce que quelqu'un l'arme, un par un, dans l'éditeur de tags, comme pour un tag de toute autre source.

## Ce qui est disponible

| Intégration | Protocole | Vérifiée avec |
|---|---|---|
| Serveur OPC UA (`opcua`) | [OPC UA](/fr/iot/protocols/#opc-ua) | Un vrai serveur OPC UA |
| Appareil SNMP (`snmp`) | [SNMP](/fr/iot/protocols/#snmp) | Un vrai agent SNMP, v1, v2c et v3 |
| Appareil BACnet/IP (`bacnet`) | [BACnet/IP](/fr/iot/protocols/#bacnetip) | Une pile BACnet indépendante |
| Automate CODESYS (`codesys`) | [CODESYS](/fr/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, exécutant deux vrais programmes d'automate, dont un bien plus volumineux |

D'autres s'ajoutent sur ce cadre à mesure qu'on peut les éprouver sur un vrai serveur.

## Dans l'autre sens

Une intégration fait entrer un appareil. Pour envoyer les mesures et les événements de HotLoop vers un broker Kafka, voir [le flux d'événements de l'API Kafka](/fr/iot/historian-targets/#api-kafka-flux-dévénements) dans les cibles d'historien : Apache Kafka et Redpanda, TLS et SASL, les mesures sur un topic et le journal système sur un autre. Pour les envoyer en OPC UA PubSub (UADP sur UDP), ou pour lire ceux d'un éditeur, voir [OPC UA PubSub](/fr/iot/protocols/#opc-ua-pubsub-uadp) : en lire un revient à un appareil avec le protocole `opcua-pubsub`, sans flux de configuration, car un datagramme porte des positions de champs et pas de noms.

## SNMP

Pour un switch, un onduleur, une PDU, un compteur d'énergie ou tout ce qui exécute un agent SNMP. Les questions suivent la version : v2c demande une communauté, v3 demande un utilisateur et seulement les phrases secrètes que son niveau de sécurité exige. Il n'y a pas de communauté par défaut.

La sonde parcourt le groupe system, les tables d'interfaces, les ressources de l'hôte, la table de charge et les sorties extend d'un agent SNMP, soit les objets que HotLoop sait nommer, et montre chacun avec ce que l'agent a dit contenir à l'instant. Elle **suggère** ceux que veut quelqu'un qui pointe vers un nouvel appareil : le nom, l'emplacement et la disponibilité de l'appareil (en secondes, pas en centièmes comme l'agent), l'état opérationnel et le nombre d'erreurs de chaque interface, ses compteurs d'octets (ceux sur 64 bits quand l'agent en a), les charges moyennes et les lignes extend. Elle indique dans ses notes combien de points suggérés sont des compteurs, car un compteur sur un graphique demande un taux.

Tout le reste que l'agent possède reste lisible : configurez-le à la main comme un tag dont l'adresse est l'OID. Voir [le pilote SNMP](/fr/iot/protocols/#snmp) pour savoir ce que devient un tag, ce que fait un objet manquant et pourquoi une mauvaise communauté v2c ressemble à un appareil mort.

Ici, SNMP est toujours en lecture seule. HotLoop n'envoie pas de SET.

## BACnet/IP

Pour un contrôleur de gestion technique du bâtiment, un compteur, un thermostat : tout ce qui est sur le réseau IP et parle BACnet. Les questions sont l'adresse de l'appareil, l'instance de l'appareil si vous la connaissez (HotLoop refuse alors qu'un autre appareil réponde à cette adresse) et la carte réseau d'où émettre si la machine en a deux.

La sonde demande à l'appareil qui il est, lit sa liste d'objets et lit tous les objets analogiques, binaires et multi-états qu'elle trouve (ainsi que les valeurs entières, analogiques larges, accumulateurs et chaînes de caractères) : nom, description, unités, valeur courante et indicateurs d'état. Elle montre chacun avec ce qu'elle a lu à l'instant et suggère les cent premiers. Les unités arrivent sous forme d'étiquette et, quand elles en désignent une, de classe d'appareil, de sorte qu'une entrée `degrees-celsius` est une température en `°C`.

Elle indique dans ses notes combien d'objets signalent un défaut (ils lisent mauvais tant que l'appareil ne l'a pas effacé) et combien sont hors service (ils lisent incertain, car la valeur est celle qu'on leur a écrite). La description d'un objet multi-états énumère ses états, et son échantillon montre l'état en plus du nombre.

Ici, BACnet est toujours en lecture seule. HotLoop n'écrit aucune propriété et n'atteint pas un appareil derrière un routeur BACnet : voir [le pilote BACnet/IP](/fr/iot/protocols/#bacnetip) pour ce qui est couvert ou non.

## CODESYS

Pour un automate qui exécute un runtime CODESYS Control. Les questions sont celles d'OPC UA (adresse, sécurité, un nom d'utilisateur et un mot de passe si la gestion des utilisateurs de l'automate est activée) et, seulement si vous en avez besoin, la partie de l'application à lister, les noms de l'automate et de l'application, et le nombre d'éléments d'un tableau à lister.

La sonde se connecte au serveur OPC UA du runtime, trouve l'automate et son application, et liste les variables que l'application exporte (sa Symbol Configuration) sous les noms écrits par le programmeur, avec leurs types et la possibilité ou non de les écrire. Elle suggère les variables propres de l'application, pas les éléments de ses tampons, et indique dans ses notes combien de tableaux elle n'a listés qu'en partie. Un automate qui n'exporte rien se voit expliquer comment exporter quelque chose.

Un appareil CODESYS est lu une fois par seconde, ce qui correspond à la fréquence à laquelle le pilote demande au serveur OPC UA du runtime d'observer chaque variable, de sorte qu'un écran a au plus une seconde de retard sur l'automate. La valeur par défaut du runtime lui-même est de cinq secondes, ce qui est lent pour un écran : une pompe démarre et la page l'indique cinq secondes plus tard. Modifiez l'intervalle d'interrogation de l'appareil, ou son `samplingIntervalMs`, pour en demander davantage ; le plancher auquel chaque appareil est soumis et les OperationLimits du serveur continuent de s'appliquer.

Configurez avec `"dashboard": true` dans la requête et les points que vous gardez reçoivent aussi un tableau de bord portant le nom de l'appareil : un titre, une tendance des nombres qui bougent, les alarmes de l'appareil et une carte de valeur pour chaque point sous un titre pour sa liste de variables. C'est un premier écran fait à partir du programme tel qu'il est, et il se modifie comme n'importe quel tableau de bord. Rien dessus ne commande quoi que ce soit, et chaque tag reste en lecture seule jusqu'à son armement.

Un automate dont le runtime redémarre ou dont un nouveau programme est téléchargé est repris tout seul : voir [le pilote CODESYS](/fr/iot/protocols/#codesys).

## Le déroulement

Trois appels, dans l'ordre, et les deux premiers n'enregistrent rien.

1. **Demander.** `GET /api/integrations` liste toutes les intégrations et leurs questions. Chaque question a un genre (`text`, `number`, `bool`, `choice` ou `secret`), une valeur par défaut, un caractère obligatoire ou non et, quand elle ne compte qu'après une autre réponse, `showWhen`. Un écran est dessiné à partir de cela et de rien d'autre, ce qui explique qu'une nouvelle intégration n'ait pas besoin d'un nouvel écran.
2. **Regarder.** `POST /api/integrations/{id}/probe` prend les réponses, les vérifie, se connecte au vrai appareil avec le pilote propre à l'intégration, et indique ce qu'il est et ce qu'il contient : un nom suggéré, ce qu'il dit de lui-même, des notes à lire et chaque point trouvé sous forme d'enregistrement en forme de tag avec un `sample` de ce qui a été lu, pour que vous puissiez le comparer au nombre affiché sur l'écran de la machine elle-même.
3. **Garder.** `POST /api/integrations/{id}/setup` prend les mêmes réponses et les noms des points à garder (aucun nom donné garde ceux marqués `suggested`), crée l'appareil et ses tags et recharge le runtime. L'appareil est activé et interrogé. Une intégration capable de composer un premier tableau de bord (CODESYS) le fait quand la requête contient `"dashboard": true`, et répond avec l'identifiant du tableau de bord.

La configuration regarde l'appareil de nouveau au lieu de se fier à la sonde. Ce qu'un client croit avoir trouvé il y a une minute est une affirmation, et les points sont vérifiés par rapport à l'appareil tel qu'il est au moment où il est créé. Un nom qui n'y figure pas donne une erreur `400`, pas un point ignoré, car quelqu'un l'a demandé par son nom.

Une configuration qui échoue en route (l'appareil enregistré, les tags non) supprime l'appareil qu'elle vient de créer. Un appareil qui existe déjà est refusé par une erreur `400` au lieu d'être écrasé : pour ajouter des points à un appareil que vous avez, utilisez son Browse et Import.

## Les réponses sont vérifiées avant toute tentative

Le cadre vérifie chaque réponse par rapport à sa question avant qu'une intégration la voie, et signale tous les problèmes d'un coup, de sorte qu'un formulaire se corrige en une seule fois :

* une question obligatoire laissée vide donne "X is required" ;
* un nombre doit être entier et dans la plage de la question, un choix doit être l'un de ses choix, un bool doit être un bool ;
* une réponse à une question que l'intégration ne pose pas est refusée, pas ignorée, car un `pasword` mal orthographié écarté sans un mot est un appareil qui n'arrive pas à se connecter sans aucun indice sur la raison ;
* un secret ne peut pas être le marqueur `[redacted]` que l'API affiche à la place d'un secret enregistré. Le renvoyer enregistrerait le marqueur comme mot de passe ;
* une question qui ne s'affiche pas (`showWhen`) est ignorée et n'est pas obligatoire.

Les identifiants sont conservés comme ceux d'un appareil : scellés au repos quand HotLoop a une clé de scellement, et masqués dans chaque réponse de l'API et chaque erreur. Une sonde n'enregistre jamais ce qu'on lui a donné.

## Quand l'appareil ne répond pas

`502`, avec ce qui s'est mal passé : "could not reach the device: ..." quand rien ne s'est connecté, "connected, but could not list its points: ..." quand la connexion a eu lieu puis plus de réponse. C'est la réponse de l'appareil qu'il faut lire, pas un défaut de HotLoop ni une mauvaise requête. Un port fermé, une mauvaise communauté ou un pare-feu aboutissent tous ici, et le message est celui du pilote lui-même.

## Sa place dans le produit

La sonde et la configuration traversent le réseau depuis la machine HotLoop, donc les deux demandent `devices.write`, comme pour enregistrer un appareil. Lister demande `devices.read`. Chaque produit les possède. Les routes sont dans [l'API HTTP](/fr/iot/api/#integrations).

## En ajouter une

* `Info()` dit ce que c'est : id, nom, protocole du pilote, comment demander l'adresse, et les questions ;
* `Configure()` transforme les réponses vérifiées en adresse et en bloc de configuration propre au pilote, et refuse ce qu'une question ne peut pas exprimer ;
* `Discover()` atteint le vrai appareil et indique ce qu'il contient.

Au démarrage, le cadre refuse une intégration qui ne peut pas être une entrée du catalogue : un id en double, un protocole que le modèle ne déclare pas, une question sans libellé, un choix sans options, une valeur par défaut qui n'est pas une réponse valide, ou un `showWhen` qui nomme une question inexistante. Un test oblige aussi chaque intégration à reposer sur un protocole dont un pilote est compilé.

Là où il n'y a pas de vrai serveur à exécuter, il n'y a pas d'intégration, et la [feuille de route](/fr/roadmap/) dit lesquelles attendent du matériel.
