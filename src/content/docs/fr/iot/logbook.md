---
title: "Le journal d'activité"
description: "Changements d'état, écritures, alarmes, exécutions de règles et changements de configuration sur une seule chronologie, pour l'usine, une zone ou une entité."
---

Une seule chronologie de ce qui s'est passé dans l'usine, le plus récent d'abord : la pompe s'est mise en marche, quelqu'un a écrit 180 dans la consigne de la zone 1, l'alarme de température haute a été déclenchée puis acquittée, l'automatisation de refroidissement s'est exécutée, un appareil a été reconfiguré. Pour toute l'usine, un endroit de l'arbre des équipements et tout ce qui est dessous, ou une seule entité. C'est l'onglet Journal, une section du tiroir de chaque entité, `GET /api/logbook` (voir [l'API HTTP](/fr/iot/api/#logbook)) et l'outil MCP `get_logbook` (voir [MCP](/fr/iot/mcp/)).

La première question quand quelque chose tourne mal est « que s'est-il passé juste avant ? », et jusqu'ici la réponse se trouvait à cinq endroits : l'audit des écritures, l'historique des alarmes, les exécutions d'automatisations, le journal système, et le souvenir de personne sur ce que l'équipement a fait lui-même. Le journal d'activité, c'est ces cinq-là dans une seule liste.

## Ce qu'il contient

| Genre | Provenance | Ce que dit une ligne |
|---|---|---|
| `state` | `entity_state_log` | l'état d'une entité a changé : `changed to on (was off)` |
| `write` | `write_audit` | une écriture sur un tag, réussie, refusée ou échouée, par qui et par quelle porte |
| `alarm` | `alarm_events` | une alarme déclenchée, acquittée, effacée, mise en attente, avec la note donnée |
| `automation` | `automation_runs` | une règle s'est exécutée, comment elle s'est terminée, ce qui l'a lancée |
| `event` | `events` | changements de configuration, résumés d'appels de service et motifs donnés pour les écritures, et ce qu'une console UniFi signale à l'instant où cela arrive, rangé sous le commutateur ou le point d'accès concerné (un commutateur qui perd le contact est un avertissement) |
| `script` | `script_runs` | un [script](/fr/iot/scripts/) s'est exécuté, comment il s'est terminé, qui l'a lancé et ce qui l'a appelé |
| `recipe` | `recipe_applications` | une [recette](/fr/iot/recipes/) a été appliquée ou refusée : quelle version, par qui, combien de cibles ont reçu la valeur et ont été relues |

Seul `state` est nouveau. Les autres sont lus là où ils se trouvent déjà, au moment de la requête, et fusionnés. Rien n'est écrit deux fois, donc rien ne peut contredire la trace dont il provient, et chaque trace garde sa propre rétention (ci-dessous).

Dans le journal système, le journal d'activité prend la catégorie `config` et les lignes propres à la catégorie `write` : le résumé d'un appel de service, un appel de service d'alarme, le motif donné pour une écriture. Les lignes « wrote ... » et « write of ... refused » de la barrière d'écriture elle-même sont écartées, parce qu'elles disent exactement ce que l'audit des écritures contient déjà et que chaque écriture apparaîtrait sinon deux fois.

### Ce qu'il ne contient volontairement pas

**Les mesures numériques.** Un capteur, un nombre, une boucle ou un compteur d'automate change à chaque scrutation, et chaque mesure est déjà dans l'historian. Les consigner de nouveau enterrerait chaque ligne que quelqu'un veut lire sous un million par jour que personne ne veut. Faites-en plutôt des tendances.

**Les boutons.** L'état d'un bouton est l'heure de son dernier appui, et chaque appui est déjà une écriture dans l'audit. Il repasse aussi à inconnu à chaque redémarrage, ce qui ferait une ligne par bouton et par redémarrage sans rien dire.

**Les états des entités d'alarme.** L'historique propre de l'alarme est dans le journal d'activité sous forme de lignes `alarm`, avec davantage de contenu (la valeur, la note, qui l'a acquittée).

Tout le reste est enregistré : capteurs binaires, interrupteurs, texte, sélecteurs, moteurs, vannes, assistants, et scripts à mesure qu'ils arrivent.

**Les assistants sont consignés par celui qui les a changés.** Le changement d'un assistant est écrit dans le journal d'activité dans la même transaction que sa valeur, par le processus qui a fait le changement, avec qui l'a fait, d'où et sous quel id d'appel, et sans limitation de fréquence. L'enregistreur laisse les assistants tranquilles : il ne tourne que dans le Gateway, donc le changement d'un agent via `--mcp-stdio` lui échapperait, et chaque processus qui détient l'assistant voit le changement, donc il serait consigné une fois par processus. Le planning est l'exception, parce que personne ne le règle et que l'horloge le déplace : l'enregistreur le consigne comme n'importe quelle autre entité.

## Rebonds

Un contact qui rebondit à 10 Hz est un seul fait (« il a rebondi, tant de fois »), pas trente-six mille lignes par heure. Chaque entité obtient dix changements consécutifs, puis un toutes les deux secondes. Un changement au-delà n'est pas consigné et il est compté à la ligne suivante de l'entité :

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

Le compte est exact : les lignes plus leurs comptes forment tous les changements que l'entité a faits. Quand le rebond cesse, l'état final de l'entité est toujours consigné, en moins de deux secondes, donc le journal d'activité ne se termine jamais sur un état que l'équipement a quitté. Le nombre de changements supprimés depuis le démarrage est `suppressed` dans `/api/diagnostics`, sous `logbook`.

## last_changed survit à un redémarrage

L'état d'une entité est calculé à partir des tags en direct et jamais stocké, donc avant le journal d'activité chaque redémarrage donnait à toutes les entités l'air d'avoir changé à l'instant. Le journal d'activité garde le dernier état de chaque entité suivie et le moment de son dernier changement (`entity_last_state`), et le moteur d'entités le lit au démarrage. Une entité dont l'état revient identique garde son `last_changed`.

Un redémarrage ressemble à ceci vu de l'intérieur : un appareil n'est pas encore connecté, donc ses entités passent à indisponible, puis à inconnu, puis affichent leur mesure. Ces étapes sont ce processus qui rattrape son retard, pas l'usine qui change, donc on les attend. Un état qui a vraiment changé pendant que le Gateway était arrêté reçoit un `last_changed` neuf et une ligne disant ce qu'il était avant. Pour la même raison, le journal d'activité retient un passage à indisponible ou inconnu pendant la première minute après un démarrage : un appareil toujours arrêté après cela est consigné alors, à l'heure où on l'a vu arrêté pour la première fois.

## Filtres

- **Où :** un nœud de l'arbre des équipements et tout ce qui est dessous. Un lieu est transformé en tous les noms sous lesquels les traces le connaissent : les entités qui s'y trouvent (par leur propre place, sinon celle de leur appareil, la même règle que l'écran Entités), les appareils qui s'y trouvent et chaque tag qu'ils portent, les alarmes sur ces tags, les automatisations dont un déclencheur porte sur l'un d'eux, et le nœud lui-même pour ses changements de configuration. Une exécution d'automatisation est aussi dans un lieu si elle y a écrit pendant qu'elle s'exécutait, quoi qu'il l'ait déclenchée. Les événements d'une console UniFi se retrouvent par le réseau, pas par ce qu'une personne a placé dans l'arbre : le commutateur auquel un appareil lié est suspendu, et chaque commutateur entre lui et la passerelle, de sorte qu'un commutateur qui tombe apparaît sous chaque ligne qu'il alimente. Une console placée dans l'arbre retrouve les événements concernant tout ce qu'elle a adopté. Voir [UniFi Network](/fr/iot/unifi/#événements).
- **Entité :** la même chose, pour une entité : ses changements d'état, les écritures sur elle et sur ses tags, ses alarmes, les règles qu'elle déclenche ou qui ont écrit sur elle, et les changements de configuration sur elle ou sur ses tags. Une entité supprimée depuis est toujours retrouvée par le nom qu'elle avait.
- **Qui :** une partie de l'acteur, sans tenir compte de la casse : `alice`, `automation:cooldown` (les exécutions de la règle et chaque écriture qu'elle a faite), `mcp:` (tout ce qu'un agent a fait). Un changement d'état fait par l'équipement de lui-même n'a pas d'acteur.
- **Genres :** n'importe lesquels des cinq.
- **Quand :** `from` et `to`.

La pagination se fait par curseur, l'heure, le genre et l'id de la dernière ligne, de sorte qu'une page n'est jamais décalée par les lignes ajoutées depuis la précédente.

L'écran se met à jour en direct. Le flux en direct regarde les traces une fois par seconde tant que quelqu'un regarde, et envoie un événement `logbook` nommant les genres qui ont du nouveau ; l'écran redemande alors sa page. Il surveille les tables, pas ce processus, donc une écriture faite par un agent via `--mcp-stdio`, qui est un autre processus, apparaît quand même.

## Combien de temps il conserve

`entity_state_log` est partitionnée par mois, dans les deux modes d'historique (c'est une table partitionnée PostgreSQL ordinaire que `tag_history` soit ou non une hypertable), et un mois est supprimé en entier quand toutes ses lignes sont plus anciennes que `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Par défaut **90**. Supprimer un mois est instantané ; supprimer ses lignes une à une ne l'est pas, c'est pourquoi elle est partitionnée. Une ligne est donc conservée entre 90 jours et 90 jours plus un mois. `0` conserve tout, et le Gateway le dit au démarrage, parce que la table grossit alors jusqu'à ce que le volume soit plein.

La maintenance propre du journal d'activité fait cela, une fois au démarrage puis chaque jour. Elle crée à l'avance la partition du mois dernier et celles des trois mois suivants, pour qu'une ligne ait toujours un endroit où tomber ; une ligne d'un mois sans partition tombe dans la partition par défaut, et la maintenance la déplace dans son mois quand elle le crée (c'est ce qui se passe après une restauration, voir [Sauvegardes et restauration](/fr/iot/backup/)) ou la supprime une fois la rétention dépassée.

Les autres traces gardent ce qu'elles ont toujours gardé :

| Trace | Conservé |
|---|---|
| `write_audit` | tout, jusqu'à ce que quelqu'un le réduise |
| `alarm_events` | tout, jusqu'à ce que quelqu'un le réduise |
| `automation_runs` | les 500 dernières exécutions de chaque automatisation |
| `events` | les 100 000 dernières lignes |

Ainsi, dans une usine très active, les écritures et les alarmes du journal d'activité peuvent remonter plus loin que ses changements d'état, et ses exécutions d'automatisations et changements de configuration moins loin. Le journal d'activité montre ce que les traces contiennent.

## Un seul processus enregistre

Le Gateway enregistre. Un second processus lancé avec `--mcp-stdio` (l'assistant d'un agent à côté du Gateway) lit le journal d'activité et sa référence, de sorte que ce qu'il dit de `last_changed` concorde avec ce que dit le Gateway, mais il n'écrit rien et ne maintient rien : deux enregistreurs consigneraient chaque changement deux fois.

L'enregistreur est un crochet sur le moteur d'entités qui ne fait que mettre en file. Une fois par seconde, une goroutine transforme ce qui est en file en lignes, applique la limite de fréquence et les écrit avec un `COPY` et un upsert des états les plus récents, dans une seule transaction. La file contient 50 000 changements ; au-delà, les plus anciens sont abandonnés et comptés. Une base de données arrêtée garde les lignes en file, jusqu'à la même limite, et elles entrent quand elle revient. `/api/diagnostics` montre tout cela sous `logbook` :

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` au-dessus de zéro signifie que des changements manquent dans le journal d'activité ; `queued` qui ne cesse de croître signifie que la base de données ne suit pas ; `lastError` dit pourquoi la dernière écriture a échoué.

## Sauvegardes

Les deux tables sont dans chaque sauvegarde : `entity_last_state` après les tables d'entités, `entity_state_log` juste avant `tag_history`. Voir [Sauvegardes et restauration](/fr/iot/backup/).
