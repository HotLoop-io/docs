---
title: "Ce qui a été exécuté"
description: "Avec quoi la bibliothèque a été compilée, exécutée et relue, et le seul point où deux lecteurs divergent."
---

Cette page décrit l'essai de 1.0.0. L'essai de 1.1.0, avec horodatage et le `.package`, est dans les [notes de version 1.1.0](/fr/releases/transmitter-1-1-0/). La bibliothèque a depuis tourné sur machine physique sans système d'exploitation (2026-11-17).

## La compilation

* Bibliothèque : compile avec 0 erreur et 0 avertissement dans le ScriptEngine de CODESYS 3.5.22.30 (SP22 Patch 3).
* Application d'exemple, compilée avec la bibliothèque installée, pour l'appareil CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0) : 0 erreur, 0 avertissement, prête à être téléchargée.

## Le runtime

CODESYS Control for Linux SL 4.22.0.0 charge l'application comme projet de démarrage et signale `Application started`, `CODESYS Control ready`. Il fonctionne en mode démo, faute de licence de runtime.

## Ce qui est passé sur le fil, et qui l'a lu

L'application d'exemple a deux éditeurs : writer group 1 et dataset writer 1 en encodage Variant (1142 octets), et writer group 2 et dataset writer 2 en encodage RawData (1144 octets). Dix-sept champs chacun : un de chaque type pris en charge par la bibliothèque, un tableau REAL de 250 éléments, un tableau INT de 4 éléments et deux compteurs.

Quatre lecteurs indépendants l'ont lu.

| Lecteur | Ce que c'est | Variant | RawData |
|---|---|---|---|
| Un décodeur écrit à partir de la spécification | écrit uniquement à partir d'OPC 10000-14 et 10000-6, qui lit aussi les mêmes variables sur le serveur OPC UA du runtime et les compare | chaque champ égal à celui de l'automate, aucun trou dans les numéros de séquence des NetworkMessage et DataSetMessage sur la capture | idem |
| Une pile OPC UA PubSub indépendante | un abonné avec des métadonnées de DataSet des 17 champs | les 15 valeurs vérifiées sont égales, y compris la chaîne, les deux tableaux et le TIME | les 11 scalaires numériques sont égaux. Cette pile ne lit ni les chaînes RawData de quelque longueur que ce soit, ni les tableaux RawData |
| L'abonné UADP de HotLoop core | le driver de HotLoop core 4.19.4 et de toutes les versions suivantes, exécuté contre un runtime actif avec la disposition RawData indiquée dans ses types de DataSet | 21 valeurs vérifiées égales, y compris la chaîne, le TIME et les éléments 0, 1, 124 et 249 du tableau REAL de 250 et les quatre du tableau INT, et les deux compteurs qui avancent entre deux lectures espacées de 3 secondes | les mêmes 21 valeurs et les mêmes deux compteurs. 62 key frames reçues, aucune refusée |
| Un second décodeur | le décodeur UADP de notre propre code récepteur, exécuté sur 222 datagrammes capturés avec la disposition des 17 champs | les 111 messages décodés, chaque valeur vérifiée correcte | les 111 messages décodés, chaque valeur vérifiée correcte, les tableaux avec leur longueur Int32 et leur remplissage |

## Tableaux et chaînes RawData

Cette bibliothèque écrit un nombre d'éléments Int32 avant chaque tableau RawData, et une chaîne sous la forme d'une longueur Int32, de ses octets, puis d'un remplissage de zéros jusqu'à MaxStringLength. C'est ce que fait la pile de référence de l'OPC Foundation, et cela suit le texte de la spécification : OPC 10000-14 7.2.4.5.11 (« handled like a Structure DataType », remplissage « to the maximum size indicated by ArrayDimensions or MaxStringLength ») avec OPC 10000-6 5.2.5 (« One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value »).

L'abonné de HotLoop core et le second décodeur lisent tous deux les tableaux RawData de cette façon, avec la longueur et le remplissage, et décodent tous deux le RawData de cette bibliothèque.

Une différence avec la pile de référence : là où elle lève une exception quand une chaîne dépasse MaxStringLength, cette bibliothèque la coupe à une limite de caractère, parce qu'une tâche d'automate n'a nulle part où lever une exception.

## À savoir

* L'essai a eu lieu sur CODESYS Control for Linux SL 4.22.0.0 sur x86-64. La bibliothèque est en Structured Text, et la gestion de l'ordre des octets pour une cible big endian est écrite, mais c'est à vous de la vérifier sur votre propre contrôleur.
* Multicast : le bloc règle le TTL, le loopback et l'interface d'envoi pour un groupe multicast. Vérifiez le groupe sur votre propre réseau.
* Le bloc compte les échecs d'envoi et patiente quand le réseau disparaît ou qu'une adresse est absente, et le programme continue de scruter.
* En mode démo, le runtime s'arrête à la fin de sa fenêtre de deux heures, comme CODESYS l'indique.
