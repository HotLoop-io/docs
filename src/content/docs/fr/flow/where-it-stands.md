---
title: "Où en est Flow"
description: "Sur quel matériel réel Flow a été éprouvé, et d'où il vient avant de s'appeler HotLoop Flow."
---

**Il tourne.** Il démarre, sert l'API et l'éditeur, charge les flux depuis le volume, fait circuler les messages, et revient après un redémarrage avec ses flux, ses identifiants et son contexte. Le chart le déploie dans les trois modes réseau et toute la chaîne de publication se résout. Il tourne dans un vrai atelier.

**Vérifié sur de vraies infrastructures** : Mosquitto, InfluxDB et PostgreSQL. La valeur de tag InfluxDB est ressortie d'une vraie base sous la forme `press 01,west`, espace et virgule intacts. C'est le bogue d'échappement qui, autrement, fragmente une série en silence et fait perdre une journée à quelqu'un pour le trouver.

**Les cookies et le multipart répondent comme les bibliothèques de Node-RED**, parce qu'ils ont été comparés à elles, sur plus d'une centaine de cas, et que les réponses sont passées dans un fichier de référence que les tests rejouent à travers de vraies sockets. Cela comprend les cas laids : un nom de fichier UTF-8 ressort corrompu exactement comme la pile Node-RED le corrompt, et un cookie nommé `value` perd sa valeur dans `msg.responseCookies`, comme là-bas. Reproduire les bogues est le but. Un flux qui s'appuie sur l'un d'eux casse le jour où il disparaît.

**Exécuté sur du matériel réel (2026-11-17) :** les nœuds S7 et EtherNet/IP, les liaisons durables (stockage et retransmission et les écritures disque) et les plugins, avec leurs pièges et leurs refus, et un plugin signé dans un vrai cluster. Les chiffres d'écriture disque et par appel restent étiquetés avec l'endroit où ils ont été mesurés.

Ce qui sera construit ensuite, et dans quel ordre, est dans [la feuille de route](/fr/flow/roadmap/).

## Avant HotLoop Flow

Il s'appelait Emberwire, et `v0.1.0` est toujours là où il était, à `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` a été la première version sous ce nom, et 2.x ne lit rien de ce que l'ancien nom a écrit : les variables `EMBERWIRE_*`, les deux types de nœuds de base de données `emberwire-`, un module WASM compilé contre les anciennes exportations et le fichier d'identifiants de 0.1.0 sont à refaire. C'est une rupture nette, voulue. Personne n'avait construit sur 0.1.0, et une couche de compatibilité pour zéro utilisateur n'est que du code de plus qui peut se tromper. Depuis 2.0.1, un ancien fichier d'identifiants reçoit un message clair qui nomme le fichier, dit qu'Emberwire l'a écrit et vous demande de le mettre de côté et de ressaisir les identifiants.