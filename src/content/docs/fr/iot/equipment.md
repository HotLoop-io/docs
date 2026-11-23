---
title: "L'arbre des équipements et les libellés"
description: "Un seul arbre ISA-95 de l'entreprise à l'équipement, plus des libellés, pour que règles et agents parlent de la pompe et non du registre 40001."
---

Une usine a déjà sa façon de s'organiser, et tout SCADA, MES et historian qu'elle possède s'en sert : ISA-95. Entreprise, site, zone, ligne, cellule, unité, équipement. C'est donc ce que HotLoop utilise, un seul arbre, et non une liste pour les étages, une autre pour les zones et une troisième pour les appareils. Voir [Entités](/fr/iot/entities/) pour ce qui s'y rattache.

## Niveaux

| Niveau | Ce que c'est en général |
|---|---|
| `enterprise` | L'entreprise |
| `site` | Une usine |
| `area` | Un service ou un bâtiment : Conditionnement, Utilités, Parc de cuves |
| `line` | Une ligne de production |
| `cell` | Une cellule de travail sur une ligne, ou une cellule de procédé dans une usine de production par lots |
| `unit` | Une unité de production : un réacteur, un refroidisseur, un four |
| `equipment` | Une machine ou une partie de machine : une pompe, un skid, un moteur |

Un enfant est toujours d'un niveau inférieur à celui de son parent, donc un site ne se place jamais sous une ligne. Il peut sauter des niveaux : une unité directement sous une zone convient, tout comme une ligne directement sous un site dans une usine sans zones. La seule exception est `equipment` dans `equipment`, parce qu'un skid contient des pompes et qu'une pompe contient un moteur, et que l'ISA-95 cesse de nommer des niveaux bien avant qu'une usine cesse d'imbriquer des choses. Un nœud peut se trouver à la racine, à n'importe quel niveau ; la plupart des usines commencent à `site`.

Deux nœuds frères de même niveau et de même nom sont le même endroit, donc l'arbre refuse le second.

Un nœud ne peut jamais devenir son propre ancêtre : déplacer un nœud sous lui-même ou sous l'un de ses descendants est refusé. La seule façon d'obtenir une boucle est de modifier la table `equipment` à la main. Si quelqu'un le fait, rien de ce qui parcourt l'arbre ne se bloque, et la modification d'un nœud de la boucle est refusée avec un message qui nomme les nœuds et vous dit de mettre à NULL le `parent_id` de l'un d'eux.

## Le texte du site, de la zone et de la ligne fonctionne toujours

Chaque appareil a des champs de texte libre `site`, `area` et `line` depuis avant l'existence de l'arbre. Ils ne disparaissent pas. L'éditeur d'appareils de la 4.15 les écrit, `list_devices` et `describe_device` les lisent, tout comme chaque agent et chaque script écrit par quelqu'un contre eux. Le texte et l'arbre sont donc maintenus d'accord, dans les deux sens, dans la même transaction que la modification :

**Enregistrer un appareil avec du texte et sans `equipmentId`** retrouve le site, la zone et la ligne que le texte nomme, ou les crée, chacun sous le précédent, et place l'appareil sur le plus profond. Deux appareils avec le même texte arrivent sur le même nœud ; rien n'est jamais dupliqué. Le texte que vous avez envoyé est exactement celui qui est stocké : un client qui ne sait rien de l'arbre reçoit ce qu'il a toujours reçu, plus un `equipmentId` qu'il peut ignorer.

**Enregistrer un appareil avec un `equipmentId` qui le déplace** prend le texte dans le chemin du nœud, quel que soit le texte envoyé avec. Placez un appareil sur une cellule sous `Plant A / Packing / Line 2` et son texte devient `Plant A`, `Packing`, `Line 2`.

Deux détails rendent cela sûr pour les clients qui ne connaissent pas l'arbre :

- Un texte qui dit encore ce que dit le nœud actuel de l'appareil le laisse où il est. Le texte n'a que trois colonnes, donc un appareil sur une cellule ou sur une machine sous sa ligne ne peut dire que la ligne. L'enregistrer avec ce même texte ne le fait pas remonter à la ligne.
- Un client qui lit un appareil et le renvoie en entier, `equipmentId` compris, avec le texte modifié, obtient la modification du texte. Le `equipmentId` qu'il a renvoyé est celui que l'appareil avait déjà, ce n'est donc pas un déplacement, et c'est le texte qui décide.

Un site est trouvé où qu'il soit, pas seulement à la racine, donc placer `Plant A` sous une entreprise ne fait pas qu'un appareil suivant qui dit `Plant A` en crée un second.

**Renommer ou déplacer un nœud** réécrit le texte de chaque appareil placé sur ce nœud ou en dessous, dans la même transaction. Si une partie échoue, rien n'a eu lieu : un arbre qui dit une chose et un texte d'appareil qui en dit une autre, c'est exactement ce que la synchronisation des deux devait empêcher. La réponse et le journal système listent chaque appareil dont le texte a changé.

### La mise à niveau

La migration `0006_hierarchy.sql` construit l'arbre à partir du texte que porte déjà chaque appareil existant : un site par nom de site distinct, une zone par nom de zone distinct sous son site, une ligne par ligne distincte sous sa zone, et chaque appareil sur le nœud le plus profond que son texte nomme. Un appareil avec une zone et sans site reçoit une zone à la racine ; un appareil avec une ligne et sans zone reçoit une ligne directement sous son site. Un texte qui n'est que des espaces ne nomme rien. Le texte est utilisé exactement tel que stocké, espaces et casse compris, parce que les noms de l'arbre servent ensuite à réécrire le texte, et rogner pendant la mise à niveau serait un changement de nom silencieux pour chaque appareil qui avait une espace perdue. Aucun texte d'appareil ne change lors de la mise à niveau.

Le côté Go place un appareil selon les mêmes règles, et un test les garde alignés : chaque appareil placé par la mise à niveau, enregistré de nouveau sans y toucher, reste où il est et ne fait rien pousser dans l'arbre.

## Supprimer un nœud

**Un nœud qui a quoi que ce soit en dessous est refusé** : des nœuds enfants, ou des appareils placés dessus. Déplacez-les d'abord. Le refus nomme ce qui bloque.

L'alternative était de rattacher les enfants au parent du nœud supprimé. Cela déplace tous les appareils en dessous et réécrit leur texte, sous un nœud que personne n'a touché, et peut mettre une ligne directement sous un site sans zone entre les deux, un arbre que personne n'a dessiné. Retirer la place des appareils laisserait leur texte nommer un endroit qui n'existe plus, et le prochain enregistrement de l'un d'eux recréerait discrètement le nœud. Les deux surprennent. Un refus qui dit quoi déplacer, non.

Les entités placées sur un nœud supprimé perdent leur placement et retournent suivre leur appareil.

## Les entités dans l'arbre

Chaque réponse d'entité porte désormais trois champs de plus :

| Champ | Quoi |
|---|---|
| `equipment_id` | Où l'entité elle-même est placée, ou null quand elle va simplement là où va son appareil |
| `area_id` | Le `area` le plus proche au niveau du nœud de l'entité ou au-dessus, ou le nœud de son appareil quand elle n'en a pas. Tout ce qui regroupe par zone lit ce champ. Null quand il n'y a pas de zone au-dessus |
| `labels` | Les label_ids de l'entité |

La place propre d'une entité l'emporte sur celle de son appareil. Cela compte pour un appareil qui est tout un automate : son tag de température appartient au four, son tag de refroidisseur aux Utilités. Placez une entité avec `PUT /api/entities/{entity_id}` :

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` la fait revenir suivre l'appareil. `labels` remplace l'ensemble complet. Les deux demandent `entities.write`, comme tout autre champ du registre.

## Libellés

Un libellé est une étiquette au sens courant : `critical`, `line 1 utilities`, `calibrate quarterly`. Les appareils et les entités en portent autant qu'on veut.

Un libellé a un `label_id` et un `name`. Le `label_id` est fabriqué à partir du nom la première fois (lettres minuscules, chiffres et tirets bas, `_2`, `_3` en cas de collision) et ne change jamais, parce que c'est ce à quoi les automatisations et les écrans se réfèrent. Le nom peut changer quand vous voulez. Vous pouvez aussi choisir vous-même le `label_id` en en créant un.

Supprimer un libellé l'enlève de tout ce qui le porte.

Les libellés d'un appareil se définissent avec `PUT /api/devices/{id}/labels`, pas par `POST /api/devices`. Tout client qui enregistre un appareil aujourd'hui envoie l'appareil entier sans libellés, et les effacerait à chaque enregistrement.

## API

Les endpoints d'équipements et de libellés utilisent des noms de champs en snake_case, comme les endpoints d'entités, parce que l'arbre est le registre des zones du modèle d'entités et qu'il est conçu pour les mêmes consommateurs. Le nouveau champ de l'appareil est `equipmentId`, en camelCase, comme le reste de l'API des appareils.

| Endpoint | Autorisation | Quoi |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Chaque nœud, avec son `path` de noms depuis la racine. Filtre : `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}` : le nœud, les nœuds directement dessous, et ce qui est placé directement dessus |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | N'importe lequel de `name`, `description`, `level`, `parent_id` (null pour la racine). Répond `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Refusé avec un 409 tant que quoi que ce soit se trouve en dessous |
| `GET /api/labels` | `equipment.read` | Chaque libellé |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}` qui le portent |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Nom, couleur, icône, description. Jamais le label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | Le retire de tout |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, l'ensemble complet |
| `POST /api/devices` | `devices.write` | Gagne l'`equipmentId` facultatif, comme ci-dessus |
| `GET /api/devices/{id}` | `devices.read` | Gagne `labels` à côté de `device` et `tags` |

Chaque rôle détient `equipment.read` : où sont les choses, c'est ce que le site et la zone d'un appareil disaient déjà à un lecteur. Seul l'administrateur détient `equipment.write`, parce que renommer ou déplacer un nœud réécrit le site, la zone et la ligne de chaque appareil en dessous, et que c'est de la configuration.

Chaque modification arrive dans le journal système, catégorie `config`, sujet `equipment:<id>` ou `label:<label_id>`.

## MCP

`list_devices` et `describe_device` répondent à partir du texte, comme toujours, et leur sortie ne change pas. Un test la fige octet pour octet sur ce que répondait la version d'avant l'arbre, puis réorganise l'arbre autour de l'appareil (une entreprise au-dessus de son site, une cellule sous sa ligne, un libellé) et vérifie que rien de ce que voit un agent n'a bougé. Quand l'arbre change bien le texte, un renommage par exemple, l'agent voit le nouveau texte, comme si quelqu'un l'avait saisi dans l'appareil. `list_entities` est l'endroit où les agents voient l'arbre : il filtre par un nœud et tout ce qui est en dessous, et donne la place de chaque entité. Voir [MCP](/fr/iot/mcp/#entités).

## Sauvegarde et restauration

`equipment`, `labels`, `entity_labels` et `device_labels` sont dans la sauvegarde, tout comme les nouvelles colonnes `equipment_id`. `equipment` se référence elle-même (`parent_id`), ce qu'une restauration ne peut pas ordonner : après le déplacement d'un nœud, un parent peut très bien être stocké après son enfant. La contrainte est `DEFERRABLE INITIALLY DEFERRED`, elle est donc vérifiée quand la restauration valide, une fois toutes les lignes en place, et il en va de même pour tout ce qui réécrit l'arbre en plus d'une instruction. Le test de garde de la sauvegarde n'autorise une table à se référencer elle-même que si cette contrainte est différée, et le test aller-retour stocke un enfant avant son parent exprès.

Une sauvegarde faite avant cette version se restaure toujours. Ses fichiers `devices` et `entities` ont une colonne de moins ; la restauration les charge dans les premières colonnes de la table (une nouvelle colonne est toujours ajoutée à la fin) et la nouvelle prend sa valeur par défaut. Puis, dans la même transaction, elle place chaque appareil restauré dans l'arbre d'après son texte, comme l'aurait fait la mise à niveau.

## L'écran Usine

L'arbre, sur le côté, avec une carte pour le nœud choisi : son chemin, les appareils qui s'y trouvent, les entités placées dessus et ce qui est en dessous. Un administrateur peut ajouter un nœud à la racine ou sous celui qui est choisi, le renommer, changer son niveau, le déplacer, le supprimer, y placer un appareil ou en retirer un, et définir les libellés d'un appareil. La liste des niveaux ne propose que les niveaux que les règles permettent, aussi bien par rapport au parent que par rapport aux enfants déjà dessous, et un déplacement ne propose que les parents sous lesquels un nœud de ce niveau peut aller, jamais le nœud lui-même ni rien de ce qui est en dessous. Le serveur revérifie tout, et un refus (une suppression avec quelque chose encore dessous, par exemple) est affiché exactement comme il l'a écrit. Déplacer un appareil est le même enregistrement que celui de l'éditeur d'appareils, avec un `equipmentId`, donc le texte suit l'arbre comme décrit plus haut.

Les libellés se gèrent en bas de l'écran : un nom, une couleur et une description, avec le `label_id` choisi une fois pour toutes. Les entités reçoivent leur place et leurs libellés depuis leur tiroir sur l'écran Entités.

Tous les autres voient le même écran sans rien sur quoi appuyer.
