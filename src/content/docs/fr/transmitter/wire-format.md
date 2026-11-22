---
title: "Ce qui passe sur le fil"
description: "Le NetworkMessage et le DataSetMessage qu'envoie HotLoop Transmitter, octet par octet, avec les sections d'OPC 10000-14 et 10000-6 qui définissent chacun."
---

Chaque octet ci-dessous vient d'OPC 10000-14 (partie 14, PubSub) version 1.05 et d'OPC 10000-6 (partie 6, mappages), lues sur reference.opcfoundation.org le 2026-10-31. Les numéros de section sont ceux à ouvrir quand un octet semble faux. Rien ici n'a été appris en regardant les paquets d'un autre fournisseur.

Un bloc éditeur envoie un NetworkMessage par intervalle de publication. Un NetworkMessage porte un DataSetMessage, un Data Key Frame, donc chaque message contient tous les champs. Depuis 1.1.0, chaque message porte un horodatage de l'horloge de l'automate, dans le NetworkMessage et dans le DataSetMessage, sauf si `bTimestamp` vaut FALSE, auquel cas les octets sont exactement ceux de 1.0.0. Les tableaux montrent les deux : les lignes marquées horodaté n'existent que lorsque l'horodatage est activé.

Toutes les valeurs sur plusieurs octets sont little endian, comme le définit le binaire OPC UA ; le bloc les écrit octet par octet, donc l'ordre des octets de l'hôte n'a pas d'importance.

## NetworkMessage (partie 14, 7.2.4.4.2)

| Octets | Valeur | Signification |
|---|---|---|
| 1 | `F1` | UADPVersion 1 dans les bits 0 à 3. UADPFlags dans les bits 4 à 7 : PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) et ExtendedFlags1 (bit 7), tous présents |
| 1 | `21` horodaté, `01` non horodaté | ExtendedFlags1 : type de PublisherId 001 = UInt16 dans les bits 0 à 2, Timestamp (bit 5) quand horodaté. Pas de DataSetClassId, pas d'en-tête de sécurité, pas de PicoSeconds, pas d'ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags : WriterGroupId, GroupVersion, NetworkMessageNumber et SequenceNumber présents |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | toujours 1, car 0 est invalide |
| 2 | SequenceNumber | compte les messages envoyés, repasse à 0 après 65535 |
| 1 | Count | toujours 1 (en-tête de charge utile, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, horodaté uniquement | le Timestamp du NetworkMessage (7.2.4.4.2), un DateTime (partie 6, 5.2.2.5) : des ticks de 100 ns depuis 1601-01-01 00:00:00 UTC en Int64. Il vient après l'en-tête de charge utile et avant le DataSetMessage |

Comme Count vaut 1, la charge utile n'a pas de tableau Sizes. Le bloc n'envoie ni messages fragmentés, ni messages de découverte, ni champs promus, ni en-tête de sécurité, et un récepteur qui exige l'un d'eux n'est pas servi par cette version.

## DataSetMessage (partie 14, 7.2.4.5.4 et 7.2.4.5.5)

| Octets | Valeur | Signification |
|---|---|---|
| 1 | `69` Variant, `6B` RawData ; horodaté `E9` et `EB` | DataSetFlags1 : valide (bit 0), encodage des champs (bits 1 et 2 : 00 Variant, 01 RawData), numéro de séquence (bit 3), ConfigurationVersion major (bit 5) et minor (bit 6), et DataSetFlags2 (bit 7) quand horodaté. Le statut est absent. Non horodaté, DataSetFlags2 est absent aussi et le type est celui par défaut, un Data Key Frame |
| 1 | `10`, horodaté uniquement | DataSetFlags2 : type de message 0 (Data Key Frame) dans les bits 0 à 3, Timestamp (bit 4) |
| 2 | Numéro de séquence du DataSetMessage | compte les messages envoyés, repasse à 0 après 65535 |
| 8 | Timestamp, horodaté uniquement | le Timestamp du DataSetMessage (7.2.4.5.4), le même DateTime que celui du NetworkMessage, après le numéro de séquence |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | Variant uniquement. Omis pour RawData (7.2.4.5.5) |
| ... | les champs | dans l'ordre où ils ont été ajoutés |

## L'horodatage

Le bloc lit l'horloge temps réel de l'automate une fois par message avec `SysTimeRtcGet` (la bibliothèque système SysTimeRtc, que fournit le runtime), qui donne des secondes entières depuis 1970-01-01 UTC, et écrit `(seconds + 11644473600) * 10000000` comme DateTime. Les deux horodatages d'un message sont cette valeur unique. Deux choses en découlent :

* La résolution est d'une seconde. Un récepteur voit le même horodatage sur chaque message d'une même seconde, et il a jusqu'à une seconde de retard sur l'instant où le message a été construit. Les horodatages sous la seconde sont sur la feuille de route.
* L'heure n'est exacte que si l'horloge de l'automate l'est. Un contrôleur dont l'horloge n'est pas réglée horodate son message 1970. Quand l'horloge ne peut pas être lue (`diLastClockResult` n'est pas 0), le message part sans horodatage, ce que la partie 14 autorise, plutôt que de ne pas partir.

Incrémentez `udiConfigMajor` chaque fois que la liste de champs change. Un récepteur qui conserve une disposition indexée sur la version peut alors refuser un message construit pour une autre liste au lieu de le décoder de travers.

## Champs, encodage Variant (partie 6, 5.2.2.16)

Chaque champ est un octet EncodingMask, puis la valeur. Les bits 0 à 5 du masque sont l'identifiant du type intégré (partie 6, 5.1.2, tableau 1), et le bit 7 indique que la valeur est un tableau, auquel cas un nombre d'éléments Int32 précède les éléments.

| Type d'automate | Identifiant de type | Octets de la valeur |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` ou `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4, IEEE 754 |
| LREAL | 11 Double | 8, IEEE 754 |
| STRING | 12 String | longueur Int32 en octets, puis UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | millisecondes, c'est ainsi qu'un TIME CODESYS est stocké |

Une STRING CODESYS stocke un octet par caractère. Les octets jusqu'à `7F` sont de l'ASCII et sortent inchangés. Les octets au-dessus de `7F` sont lus comme de l'ISO 8859-1 et écrits sous leur forme UTF-8 sur deux octets. C'est une hypothèse sur la page de codes de l'automate, et c'est le seul endroit où le bloc interprète du texte.

## Champs, encodage RawData (partie 14, 7.2.4.5.11)

Pas de masque et pas de nombre : chaque champ est simplement sa valeur, dans l'ordre, donc le récepteur doit connaître la disposition. La partie 14 dit que les champs sont "handled like a Structure DataType", donc chaque valeur est encodée comme un champ de Structure dans la partie 6.

* **Les scalaires** sont leurs octets de valeur, comme dans le tableau Variant, sans masque.
* **Les tableaux** sont un nombre d'éléments Int32 puis les éléments (partie 6, 5.2.5 : "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Le bloc envoie toujours tous les éléments qu'on lui a donnés, donc le nombre est égal à la taille déclarée du tableau et il n'y a pas de remplissage derrière.
* **Les chaînes** sont une longueur Int32 en octets et les octets UTF-8, puis des octets nuls jusqu'à MaxStringLength, donc le champ fait toujours 4 + MaxStringLength octets (7.2.4.5.11 : "the field shall be padded with bytes with value zero"). Le bloc utilise le N de `STRING(N)` comme MaxStringLength, en octets. Un texte plus long est coupé à une limite de caractère, parce que le champ ne peut pas grandir. Les métadonnées de champ du récepteur doivent porter le même MaxStringLength et une entrée ArrayDimensions pour chaque tableau.

C'est la lecture de la pile de référence de l'OPC Foundation elle-même. Dans UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`), `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` lignes 389 à 403 disent qu'une chaîne est "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", et que pour un tableau "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray` aux lignes 593 à 648 l'implémente, et `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` l'affirme. La [page de preuves](/fr/transmitter/proof/) donne le reste.

## Taille

Le bloc construit le message dans un tampon de 1472 octets : 1500 octets de charge utile Ethernet moins 20 d'IP et 8 d'UDP, donc un message ne se fragmente jamais. Une liste de champs qui ne tient pas met le bloc en `ConfigError` avec l'erreur `TooBig` ; il ne tronque pas. Un tableau REAL de 250 éléments en encodage Variant fait 1005 octets, donc un message avec ce tableau plus l'en-tête tient, et deux ne tiennent pas.
