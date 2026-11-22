---
title: "Ce que Transmitter ajoute à la tâche"
description: "Le coût mesuré de l'éditeur sur une tâche cyclique de 20 ms, et ce que cela dit et ne dit pas d'un contrôleur physique."
---

Mesuré sur 1.1.0 avec horodatage activé. Le runtime est CODESYS Control for Linux SL 4.22.0.0 en mode démo, avec une tâche cyclique de 20 ms épinglée sur quatre cœurs. L'essai de publication comporte deux éditeurs, un Variant et un RawData, chacun envoyant environ 1,1 Ko toutes les 100 ms, donc un message part tous les cinq cycles. Les statistiques ont été remises à zéro 45 s après le démarrage du runtime et lues 240 s plus tard.

| Mesure | référence (sans éditeur) | deux éditeurs, horodatage activé |
|---|---|---|
| Temps moyen dans `PLC_PRG` par cycle | 103 ns | 9 584 ns |
| Temps le plus long dans `PLC_PRG` sur la fenêtre | 1 us | 81 us |
| Cycles sous 10 us | 11 997 sur 11 997 | 9 580 sur 11 976 |
| Cycles de 10 à 50 us | 0 | 2 299 |
| Cycles de 50 à 100 us | 0 | 97 |
| Cycles de 100 us ou plus | 0 | 0 |
| Messages envoyés / refusés / créneaux ignorés | 0 / 0 / 0 | 2 849 / 0 / 3 |

Ce que cela dit :

* **Un cycle qui envoie coûte de 10 à 100 us.** Environ 2 400 cycles de la fenêtre ont envoyé (un sur cinq), donc les cycles d'envoi constituent tout le coût : 96 pour cent d'entre eux ont pris de 10 à 50 us et 4 pour cent de 50 à 100 us, pour deux messages d'environ 1,16 Ko. Les cycles intermédiaires coûtent ce que coûte la référence.
* **Le coût moyen ajouté est d'environ 9,5 us par cycle de 20 ms**, soit 0,05 pour cent de la tâche. L'horodatage est une lecture d'horloge et 17 octets de plus par message, et cet essai ne montre aucun coût pour lui.
* **Aucun envoi n'a été refusé.** Trois créneaux de publication ont été ignorés, donc la tâche a pris du retard trois fois. Le bloc n'attend jamais le réseau, même si un envoi peut être lent quand le noyau est occupé : lisez le chiffre le plus long comme une limite de la mesure, et placez l'éditeur dans sa propre tâche de basse priorité si la principale est juste.

Ce que cela ne dit pas : le coût sur votre contrôleur. Ces chiffres viennent d'un conteneur sur un hôte généraliste. Un petit processeur ARM peut être dix à cent fois plus lent, et le coût augmente avec la taille de la liste de champs. Mesurez-le sur la cible avec `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` et `udiMaxSendUs` du bloc, qui sont là pour cela.
