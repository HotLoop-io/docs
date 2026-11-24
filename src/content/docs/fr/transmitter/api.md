---
title: "API HotLoop Transmitter"
description: "Toutes les entrées, sorties et méthodes du bloc fonctionnel éditeur de HotLoop Transmitter."
---

Tout se trouve dans l'espace de noms `HLTX`. Le bloc est `HLTX.FB_HLTX_Publisher`.

## Entrées

| Entrée | Type | Par défaut | Signification |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE ouvre le socket et commence à publier. FALSE le ferme et remet le bloc à `Disabled`, ce qui efface aussi un `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | adresse IPv4 en notation pointée : un hôte unicast, ou un groupe multicast de 224.0.0.0 à 239.255.255.255 |
| `uiPort` | UINT | 4840 | port UDP de destination. 4840 est celui qu'enregistre OPC UA |
| `sLocalAddress` | STRING(15) | vide | multicast uniquement : l'adresse de l'interface d'émission. Vide, c'est l'OS qui choisit |
| `usiMulticastTTL` | USINT | 1 | durée de vie multicast |
| `uiPublisherId` | UINT | 1 | PublisherId, envoyé en UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | temps entre les messages. Minimum T#1MS. Le bloc ne peut envoyer qu'à un cycle, donc la cadence réelle est l'intervalle arrondi au nombre entier de cycles supérieur de la tâche qui l'appelle |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` ou `RawData`. À changer bloc désactivé |
| `udiGroupVersion` | UDINT | 1 | GroupVersion dans l'en-tête de groupe |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion du DataSet. Incrémentez le major chaque fois que la liste de champs change |
| `bTimestamp` | BOOL | TRUE | horodate chaque message avec l’horloge de l’automate, dans le NetworkMessage et le DataSetMessage (à la milliseconde, voir `WIRE-FORMAT.md`). FALSE envoie les octets de la 1.0.0, 17 octets de moins |
| `bDeltaFrames` | BOOL | FALSE | Encodage Variant seulement. Envoie un Data Delta Frame (uniquement les champs modifiés, chacun avec son index) entre les trames clés, et un KeepAlive quand rien n’a changé. FALSE envoie à chaque fois une trame clé complète, que tout abonné lit. Un abonné qui ignore les trames delta montre un changement à la trame clé suivante |
| `uiKeyFrameEvery` | UINT | 10 | avec `bDeltaFrames` : une trame clé complète tous les tant de messages, pour qu’un abonné arrivé en retard ait l’image complète dans ce délai |
| `bHighResTimestamp` | BOOL | TRUE | horodate avec l’heure en millisecondes de l’horloge quand le runtime l’a. FALSE horodate en secondes entières, comme la 1.1.0 |
| `tRetry` | TIME | T#2S | délai avant de rouvrir le socket après dix envois consécutifs en échec |

## Sorties

| Sortie | Type | Signification |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (attente avant réouverture du socket) ou `ConfigError` (voir `eError` ; rien n'est envoyé) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE tant que des messages partent |
| `udiSent` | UDINT | messages remis au réseau |
| `udiSendErrors` | UDINT | envois que l'OS a refusés ou écourtés |
| `udiSkipped` | UDINT | créneaux de publication manqués parce que la tâche a pris du retard |
| `uiMessageSize` | UINT | octets du dernier message |
| `diLastSocketResult` | UDINT | le dernier code d'erreur du runtime pour un appel de socket, 0 signifie correct |
| `diLastClockResult` | UDINT | le dernier résultat de lecture de l'horloge de l'automate pour un horodatage, 0 signifie correct. Quand il n'est pas 0, le message part sans horodatage |
| `bDeltaActive` | BOOL | TRUE tant que les trames delta sont utilisées : `bDeltaFrames` est activé, le DataSet est Variant et les champs tiennent dans la copie de 4096 octets des valeurs précédentes |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | Data Delta Frames et messages KeepAlive envoyés |
| `bStampHighRes` | BOOL | TRUE quand l’horodatage du dernier message portait l’heure en millisecondes de l’horloge, FALSE quand il est revenu aux secondes entières ou est parti sans horodatage |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | microsecondes passées dans le dernier appel du bloc, et la plus longue depuis l'activation ou `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | le plus long temps passé à construire un message, et dans l'appel d'envoi lui-même, depuis l'activation ou `Clear()` |

## Méthodes

Ajoutez les champs une fois, avant le premier appel, dans l'ordre où un récepteur doit les lire. Chaque méthode renvoie TRUE quand le champ a été accepté. Jusqu'à 128 champs.

| Méthode | Ajoute |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | un scalaire. `pValue` est `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | une STRING. `uiMaxLen` est le N de `STRING(N)` |
| `AddWString(pValue, uiMaxLen)` | un WSTRING, envoyé en UTF-8. `uiMaxLen` est le N de `WSTRING(N)` |
| `AddDataSet(uiWriterId, udiConfigMajor)` | démarre un autre DataSet dans le même NetworkMessage : les champs ajoutés ensuite lui appartiennent. À chaque intervalle de publication, un NetworkMessage porte alors un DataSetMessage par DataSet, si bien que plusieurs writers partagent un datagramme. Jusqu’à 8 DataSets ; les trames delta sont désactivées dès qu’il y en a plus d’un |
| `SetStatus(pStatus)` | donne un statut au dernier champ ajouté. `pStatus` est `ADR` d’un UDINT contenant un StatusCode OPC UA. Tant qu’il n’est pas 0, le champ part comme ce StatusCode à la place de sa valeur (encodage Variant), et un récepteur le lit comme une mauvaise qualité. 0 envoie la valeur. RawData n’a pas de statut, un publieur RawData continue donc d’envoyer la valeur |
| `AddArray(pFirst, eType, uiCount)` | un tableau de `uiCount` éléments de n’importe quel type sauf STRING et WSTRING. `pFirst` est `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | la forme générale que les autres appellent |
| `Clear()` | oublie la liste de champs et le temps d'appel maximal |

Le bloc conserve les adresses que vous lui donnez, donc après un changement en ligne qui déplace des variables, appelez `Clear()` et ajoutez de nouveau les champs. WORD, DWORD et LWORD entrent comme UINT, UDINT et ULINT par la méthode de même taille.

## L'appeler

Appelez l'instance une fois par cycle depuis une seule tâche. N'appelez pas une instance depuis deux tâches. Plusieurs éditeurs dans un même programme ne posent pas de problème et chacun possède son propre socket ; donnez à chacun son propre writer group id et dataset writer id.
