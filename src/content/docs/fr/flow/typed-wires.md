---
title: "Fils typés"
description: "Posez un JSON Schema sur le nœud json et vérifiez les messages d'un fil : une mauvaise forme arrive à un nœud Catch qui nomme chaque champ erroné."
---

Un message à la mauvaise forme est la panne que nous voulons le moins sur une ligne en marche. Une température qui arrive sous forme de chaîne `"hot"`, un `id` manquant, un nombre là où il fallait une liste : rien ne plante, le flux continue, et quelque chose en aval fait discrètement le mauvais travail. Flow applique JSON Schema à ce problème en trois étapes.

## Schéma sur le nœud `json`

Donnez au nœud `json` un schéma dans ses réglages et chaque valeur qu'il traite est vérifiée par rapport à lui. Une valeur conforme continue. Une valeur non conforme va à un nœud Catch, ne continue pas le long du fil, et l'erreur nomme chaque champ erroné :

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` porte la même chose sous forme de liste d'objets `{path, keyword, message}`, pour un nœud Catch qui veut aiguiller selon elle. Les chemins se lisent comme les écrit un nœud Change : `payload.sensors[2].temp`.

Si le nœud n'a pas de schéma dans ses réglages et qu'un message porte `msg.schema`, le nœud valide par rapport à celui-ci, comme le fait le nœud `json` de Node-RED. Un message conforme perd son `msg.schema`. Un message en échec le garde. Le schéma des réglages l'emporte quand les deux sont là.

- Le schéma est du JSON Schema draft 2020-12 sauf s'il nomme un autre draft avec `$schema`. Les drafts 4, 6, 7 et 2019-09 sont acceptés.
- Un schéma invalide dans les réglages fait échouer le déploiement avec la raison du validateur. Un `msg.schema` invalide est une erreur sur ce message.
- Un schéma est autonome. Un `$ref` vers une autre URL ou un fichier est refusé, pas téléchargé, si bien qu'un boîtier edge sans route vers l'extérieur se comporte comme les autres.
- `format` est vérifié pour les formats que le validateur connaît et ignoré pour les autres, comme dans la plupart des validateurs.
- Un flux sans schéma nulle part se comporte exactement comme avant.

Tout ce qui, dans Flow, doit vérifier une valeur par rapport à un schéma utilise le même paquet.

## Schémas sur les ports

Tout nœud peut déclarer ce qu'il accepte et ce que promet chacun de ses ports de sortie. Deux clés facultatives sur le nœud, toutes deux dans le fichier de flux, toutes deux ignorées par tout autre outil qui le lit, si bien qu'un flux qui les porte fait encore l'aller-retour octet pour octet :

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` est ce que le nœud accepte. `ew_outSchemas` est une liste avec un schéma ou `null` pour chaque port de sortie. Un schéma décrit le message entier, le payload est donc `properties.payload`. Les clés qui commencent par un tiret bas, `_msgid` et le reste de la comptabilité interne du runtime, sont exclues de ce qu'il voit, de sorte qu'un schéma fermé n'a pas à les nommer. Ce sont des JSON Schema comme celui du nœud `json`, et le même paquet les vérifie.

**Une incompatibilité que l'éditeur peut voir est refusée au déploiement.** Quand les deux extrémités d'un fil déclarent un schéma et qu'aucun message ne pourrait satisfaire les deux, le déploiement est refusé avant qu'un octet soit écrit, comme la barrière de tests : un 422, rien de redémarré, rien d'enregistré, et une trace dans l'audit sous `deploy.refused` avec la raison `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Il ne refuse que ce qu'il peut prouver. Des types différents sur le même champ, une valeur hors de l'`enum` ou de la plage de l'autre extrémité, un champ que le récepteur exige et que le schéma fermé de l'émetteur exclut, un champ que l'émetteur envoie toujours et que le schéma fermé du récepteur refuse. Un émetteur qui ne mentionne simplement pas un champ exigé par le récepteur n'est pas refusé, car le message pourrait bien le porter, et un schéma qui utilise `$ref`, `allOf`, `anyOf`, `oneOf`, `not` ou `if` n'est pas remis en cause dans cette partie. Un faux refus bloque un déploiement pour rien, et tout ce qu'il ne peut pas prouver est encore attrapé à l'exécution. Un schéma qui ne compile pas, ou un `ew_outSchemas` plus long que les sorties du nœud, est refusé de la même façon. Les retours en arrière ne sont pas vérifiés, pour la raison qui fait que les tests ne les conditionnent pas.

**Les littéraux d'un nœud Inject comptent comme un type.** Un Inject n'a pas de schéma propre, mais ce qu'il fixe à coup sûr en vaut un. Quand un Inject est câblé directement à un nœud avec un `ew_inSchema`, le payload littéral, et toute autre propriété littérale qu'il fixe, est vérifié par rapport à ce schéma au déploiement, et un littéral que le récepteur ne pourra jamais accepter est refusé de la même façon, avec le même 422 et le même `deploy.refused` dans l'audit :

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Seul un littéral est vérifié : une chaîne, un nombre, un booléen ou du JSON. Un horodatage, une variable d'environnement, le contexte de flux ou global, une autre propriété du message, du JSONata, un tampon ou une expression régulière ne sont connus qu'au déclenchement du nœud, donc ils sont ignorés, jamais devinés. Une propriété requise que l'Inject ne fixe pas n'est pas non plus un conflit, car une valeur non statique peut la fixer. Seul le fil de l'Inject au nœud est jugé : un littéral qui passe d'abord par un autre nœud est laissé à la vérification à l'exécution. L'éditeur dessine le même conflit sur ce fil.

**Celle qu'il ne voit pas va à un nœud Catch et à une métrique.** Un message qui arrive à un nœud et enfreint son `ew_inSchema` n'atteint jamais le nœud. Un message qui quitte un port en enfreignant son schéma est arrêté chez l'émetteur et jamais livré. Dans les deux cas, il est levé comme une erreur du nœud qui portait le schéma, et le nœud Catch la reçoit avec le chemin de chaque champ erroné dans `msg.error.message` et sous forme de liste dans `msg.error.violations`, chacun `{path, keyword, message}` :

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` les compte par nœud, et compte aussi les incompatibilités du nœud `json`. Un nœud sans schéma coûte une vérification de nil, et un flux sans aucun se comporte exactement comme avant.

## Des types sur les fils, dans l'éditeur

Un fil avec un type à l'une ou l'autre extrémité le porte. L'éditeur écrit le type sur le fil, au milieu de la courbe : celui de l'émetteur, en quelques caractères (`payload {temp: number}`), et toute l'histoire au survol du fil.

- **Les deux extrémités déclarent un type et s'accordent :** contour vert, le type de l'émetteur.
- **Une seule extrémité en déclare un :** pointillé et atténué, pour voir où un fil reste sans type.
- **Les deux en déclarent un et ne peuvent jamais s'accorder :** le fil et son étiquette passent au rouge et disent quel champ, `≠ payload.temp`, et l'infobulle donne la raison du runtime. Le déploiement le refuserait, et vous pouvez maintenant le voir avant d'appuyer sur Deploy.

Le rouge n'est pas l'éditeur qui devine. Il interroge le runtime, `POST /flows/types`, qui exécute la même vérification que celle par laquelle le déploiement refuse, si bien que le canevas et le déploiement ne peuvent pas diverger. L'éditeur n'interroge que lorsque quelque chose sur le canevas a un schéma, peu après la dernière modification. Un flux sans schémas ne fait aucun appel et ne dessine rien de nouveau.

Réglez les types dans la boîte de dialogue d'un nœud, sous **Types** : un schéma d'entrée, et un pour chaque port de sortie. Vide signifie sans type, et un nœud que vous n'avez jamais typé ne gagne pas les clés. Écrire quelque chose qui n'est pas du JSON, ou qui n'est pas un objet, est refusé dans la boîte de dialogue.
