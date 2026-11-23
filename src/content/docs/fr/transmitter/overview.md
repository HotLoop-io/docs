---
title: "HotLoop Transmitter : présentation"
description: "Une bibliothèque CODESYS en Structured Text sur SysSocket UDP qui publie les valeurs de l'automate en OPC UA PubSub (UADP), sans autre bibliothèque ni outil."
---

HotLoop Transmitter met les valeurs d'un automate sur le réseau en OPC UA PubSub, comme le prévoit la partie 14 de la spécification OPC UA, à partir d'une bibliothèque que vous ajoutez au projet CODESYS. C'est un transmetteur au sens de la boucle d'instrumentation : l'élément qui met la valeur du procédé sur le fil pour que quelqu'un d'autre puisse la lire.

Elle est écrite en Structured Text sur `SysSocket` UDP, et ne demande ni autre bibliothèque, ni licence supplémentaire, ni configurateur. Vous ajoutez la bibliothèque, vous appelez un bloc fonctionnel une fois par cycle, et un NetworkMessage UADP part à chaque intervalle de publication vers une adresse unicast ou un groupe multicast.

Ce que cela change pour vous : un automate sans bibliothèque PubSub peut alimenter tout ce qui s'abonne à OPC UA PubSub, HotLoop compris, avec quelques lignes de Structured Text. Chaque message porte un horodatage de l'horloge de l'automate, sauf si vous le désactivez avec `bTimestamp`.

## Pourquoi du Structured Text et pas du Go

Tout nouvel outil HotLoop est écrit en Go, sauf raison réelle. Voici la raison réelle : il doit s'exécuter dans le cycle de scrutation même de l'automate, dans le runtime IEC 61131-3, comme une bibliothèque que le programmeur référence depuis son projet. Un runtime CODESYS exécute du Structured Text, pas du Go. Les tests et les outils autour de la bibliothèque (l'outil de capture, le vérificateur) sont en Go.

## L'utiliser

1. Installez `HotLoopTransmitter-1.2.0.library` dans le dépôt de bibliothèques CODESYS (Tools, Library Repository, Install), ou installez `HotLoopTransmitter-1.2.0.package` avec le CODESYS Installer, puis ajoutez-la au Library Manager du projet. La [page d'installation](/fr/transmitter/install/) donne les téléchargements et les détails.
2. Déclarez un éditeur de publication, ajoutez une fois au démarrage les variables à publier, et appelez-le à chaque cycle :

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

La [page API](/fr/transmitter/api/) liste chaque entrée, sortie et méthode. La [page du format sur le fil](/fr/transmitter/wire-format/) décrit le paquet octet par octet, avec les sections de la spécification qui définissent chaque octet.

## Ce que cela fera et ne fera pas à votre cycle

* Elle ne bloque jamais. Le socket est non bloquant et le message est construit dans un tampon fixe.
* Le coût d'un appel est celui de la construction d'un message, et il n'est payé que sur les cycles où un message part. Mesuré sur une tâche de 20 ms avec deux éditeurs et horodatage activé : environ 9,6 us ajoutées par cycle en moyenne, de 10 à 100 us sur les cycles qui envoient, et le cycle le plus long de l'essai a duré 81 us. Un hôte chargé a déjà étiré un envoi isolé jusqu'à des millisecondes. Les chiffres mesurés et leurs limites sont sur la [page de timing](/fr/transmitter/timing/).
* Une erreur de socket, une mauvaise adresse ou une liste de champs trop grande ne met jamais l'application en défaut. Le bloc renvoie un `eState` et un `eError`, compte l'échec, et le programme continue de scruter.
* Elle ne fragmente pas. Un message fait au plus 1472 octets. Une liste de champs qui ne tient pas met le bloc en `ConfigError` et n'envoie rien.

## Testée avec

Le runtime CODESYS Control for Linux SL 4.22.0.0, et sur machine physique sans système d'exploitation (2026-11-17). Voir la [page de timing](/fr/transmitter/timing/) et la [page de preuves](/fr/transmitter/proof/) pour ce qui a été exécuté et relu.

Vous l'utilisez dans une usine ? [Utiliser HotLoop en entreprise](/fr/business/) couvre les licences et la façon de nous joindre.

## Licence

Le HotLoop Source License Agreement 1.0, comme tous les produits HotLoop. Elle est gratuite à l'usage et à code source disponible, pas open source au sens de l'OSI, et sa section 5 vous permet d'intégrer la bibliothèque dans vos propres projets d'automate et de livrer ou vendre le résultat compilé, jamais la bibliothèque elle-même. La [page de licence](https://hotloop.io/license/) contient le texte.
