---
title: "Tableaux de bord par rôle"
description: "Des pages de cartes par rôle ou par écran : jauges, tendances, listes d'entités et boutons, avec la même disposition sur PC de panneau, portable et téléphone."
---

Un tableau de bord est une page de cartes que quelqu'un a construite. Des jauges, des tendances, des listes d'entités, un bouton qui démarre la pompe, un plan d'usine avec les températures placées là où sont les zones. Construisez-en autant que l'usine en a besoin, donnez chacun aux rôles qui en ont besoin ou à l'unique écran sur lequel il vit, et l'ancien Board n'est que l'un d'eux.

Il est dans HotLoop IoT, Edge et Gateway. L'Edge Relay n'a ni interface ni tableaux de bord. L'IHM d'Edge est construite avec cette page et rien d'autre, ce qui explique que le reste soit comme il est.

## Pourquoi il est construit ainsi

**Une carte ne commande rien.** La première question de conception pour toute page de boutons est de savoir si la page est une seconde façon de conduire l'usine. Elle ne l'est pas. Une carte nomme un tag, une entité, un script ou une recette, et le navigateur en fait ce que fait n'importe quel autre écran. Un bouton d'écriture envoie `POST /api/write`. Les commandes d'une entité appellent `POST /api/services`. Un bouton de script ouvre l'invite d'exécution de l'écran Scripts et une carte de recette ouvre le tiroir d'application de l'écran Recettes. Chacune de ces actions a son propre droit et rencontre la barrière d'écriture, donc un tableau de bord ne peut pas non plus être un moyen de la contourner. Ce que protège `dashboards.write`, c'est qui décide de ce que sont les boutons, ce qui est un choix d'ingénieur et est réservé aux administrateurs pour la même raison que l'écriture d'un script.

La conséquence : un tableau de bord enregistré par un administrateur ne fait rien tant qu'un opérateur n'appuie pas sur quelque chose, et ce que fait l'appui est exactement ce que fait un appui sur n'importe quel autre écran, jusqu'à la ligne d'audit.

**Une disposition est un flux, pas des coordonnées.** Les cartes vont dans l'ordre de lecture. Chacune dit sa largeur sur douze colonnes et sa hauteur en lignes, et ne sait rien de l'endroit où elle atterrit. Douze colonnes sur un PC de panneau, six sur un portable avec une autre fenêtre à côté, deux sur une tablette, une sur un téléphone. Une disposition en positions de pixels n'est juste que sur l'écran sur lequel elle a été dessinée, et l'IHM d'Edge doit être juste sur l'écran qu'a la machine.

La conséquence : personne ne construit jamais la version téléphone. Il n'y en a pas.

**Les enregistrements nomment la version.** Que deux personnes modifient un même tableau de bord arrive au changement d'équipe. Un enregistrement porte la `version` à laquelle il a été ouvert, et un enregistrement périmé est refusé par un `409` qui dit qui est arrivé le premier. Sans cela, la deuxième personne qui appuie sur Enregistrer efface l'après-midi de la première sans que ni l'une ni l'autre ne le voie.

## Le modèle

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** se compose de lettres minuscules, de chiffres, de tirets et de traits de soulignement, et commence par une lettre. Il est dans l'adresse et ne change jamais. `wall` est celui du tableau mural.
- **`kind`** est `cards`, ou `wall` pour le tableau mural.
- **`roles`** sont les rôles à qui le tableau de bord est proposé. Vide, ce sont tous les rôles. Celui qui détient `dashboards.write` voit tous les tableaux de bord quoi qu'ils disent, parce qu'il doit pouvoir réparer celui que personne d'autre ne peut ouvrir. Un rôle à qui on n'en propose pas un reçoit un `404` pour lui par son nom, si bien que la liste de ce qui existe n'est pas quelque chose qu'un lecteur peut apprendre en demandant.
- **`homeFor`** sont les rôles pour lesquels il s'ouvre quand ils arrivent sans adresse demandant quoi que ce soit. Un rôle en a au plus un ; le tableau de bord doit être proposé aux rôles dont il est la page d'accueil.
- **`screens`** sont les écrans physiques auxquels il est destiné. Un nom d'écran appartient à un seul tableau de bord.
- **`position`** ordonne le sélecteur. Les nouveaux vont en dernier.
- **`cards`** sont dans l'ordre de lecture, jusqu'à 60 par tableau de bord, 2 Mo pour l'ensemble.
- **`version`** augmente de un à chaque enregistrement.

Une carte est un `id` (unique dans son tableau de bord, créé par la page), un `type`, un `title` facultatif, `w` (1 à 12) et `h` (1 à 8), et un `config` qui dépend du type. Omettez `w` et `h` et la valeur par défaut du type est utilisée. Un config est vérifié strictement : une clé que le type n'a pas est une erreur, et ce qui est stocké a toutes les valeurs par défaut remplies. Une carte qui nomme un tag, une entité, un script ou une recette qui n'existe pas est refusée à l'enregistrement du tableau de bord. Un bouton sur un tag qui n'est pas marqué inscriptible, ou un bouton dont le nombre est hors de la plage du tag, est refusé aussi : la barrière refuserait chaque appui, et c'est la personne qui le construit qui doit l'entendre, pas celle qui appuie.

## Les cartes

| Type | Ce que c'est | Config | Taille par défaut |
|---|---|---|---|
| `status` | Appareils actifs, tags qui remontent, alarmes, historien, durée de fonctionnement : le bandeau du Board | aucune | 12 x 1 |
| `gauge` | Un tag comme le cadran du Board, avec sa plage et ses limites d'alarme marquées | `tag` | 3 x 3 |
| `value` | Un tag comme un grand nombre, coloré selon son état d'alarme | `tag`, `decimals` | 3 x 2 |
| `trend` | Jusqu'à six tags de 15 minutes à une semaine | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Les entités que vous choisissez, comme leurs propres tuiles avec leurs propres commandes | `entities` (jusqu'à 30) | 6 x 3 |
| `alarms` | La liste des alarmes, avec Acquitter pour qui le peut | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Écrit une valeur dans un tag, après confirmation | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Lance un script par l'invite de l'écran Scripts | `script`, `label` | 3 x 1 |
| `recipe` | Choisit une recette parmi huit au plus et ouvre son tiroir d'application | `recipes` | 4 x 2 |
| `markdown` | Texte : titres, listes, gras, italique, code, liens http(s) | `text` | 4 x 2 |
| `camera` | Un instantané qui se rafraîchit, ou un flux JPEG de mouvement | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | Un plan d'usine avec des tags en direct placés dessus | `image`, `markers` | 6 x 5 |
| `setpoint` | Un nombre saisi pour un tag, avec limites, une unité et une confirmation, et ce que l'appareil renvoie | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Une image d'une machine ou d'un procédé : des symboles placés au pixel sur un fond, reliés par des tuyaux, dessinés à partir de leurs tags | `image`, `width`, `height`, `symbols`, `pipes`, `view` | 8 x 5 |

Ce qui vaut la peine d'être su sur celles qui ne sont pas évidentes :

- **`button`** envoie `value` avec le type sous lequel il a été enregistré. Un nombre est un nombre, `true` est un booléen, une chaîne est du texte. `1` et `1.0` sont des écritures différentes sur un automate et la barrière décide d'après le type JSON, donc la carte ne transforme pas l'un en l'autre. `confirm` est activé sauf s'il est désactivé, et il demande alors « cela commande de vrais équipements » avec la valeur courante et une raison qui va dans la piste d'audit (`dashboard <id> / <card>` si elle est laissée vide). Le désactiver convient à un panneau où maintenir le bouton est le but ; c'est une décision d'ingénieur et l'option « Confirmer avant d'écrire » de l'écran Paramètres le réactive.
- **`alarms`** liste les alarmes de toute l'usine sauf si vous la dirigez ailleurs. `devices` est une liste d'ids d'appareils. `equipment` est une liste d'ids de nœuds d'équipement issus de `GET /api/equipment`, de n'importe quel niveau (un site, un secteur, une ligne, une cellule), et un nœud représente tous les appareils placés à son niveau ou en dessous, si bien que la page d'un secteur peut afficher les alarmes du secteur et celles de personne d'autre. Avec les deux, une alarme est listée quand elle figure dans l'un ou l'autre. Omettez-les, ou laissez-les vides, et la carte couvre toute l'usine, ce que faisait toute carte enregistrée avant ces champs. La limite compte ce qui reste après le filtre, et `outstanding` écarte toujours ce qui est revenu à la normale et acquitté. Une carte limitée à un endroit sans alarmes dit « ici » pour que personne ne la lise comme une usine calme, et une carte dont l'équipement a été supprimé depuis le dit au lieu d'afficher une liste vide. L'équipement est stocké sous la forme de l'id du nœud, donc renommer ou déplacer un nœud ne casse pas la carte. Le tableau de bord est refusé à l'enregistrement si un appareil ou un nœud n'existe pas. Dans le générateur vous saisissez le chemin (`Plant 2 / Scrubbers / Kettle 3`) et il garde l'id. Cette carte lit l'arbre, donc un rôle a besoin de `equipment.read` (les opérateurs et les lecteurs l'ont).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** trace la fenêtre que vous avez demandée, qui se termine maintenant, et pas seulement l'intervalle que les mesures ont fini par couvrir : `minutes: 480` est un axe des huit dernières heures avec un repère à chaque heure pleine, dans le fuseau horaire de celui qui regarde. Un tag qui n'a pas bougé est une ligne plate à sa dernière bonne mesure, parce que c'est ce à quoi ressemble un broyeur arrêté ou une vanne fermée, et l'historien ne garde une mesure que lorsqu'une valeur dépasse sa bande morte, donc il peut y avoir une mesure dans la fenêtre, ou aucune. Rien sur la ligne n'est inventé. Ce que le tag tenait au début de la fenêtre est sa dernière bonne mesure avant elle (`GET /api/history` le dit avec `carry=true`), et la ligne est cette valeur du début de la fenêtre à la première mesure qu'elle contient. Après la dernière mesure elle est maintenue jusqu'à la dernière fois que le tag a donné de ses nouvelles, jamais au-delà de maintenant. Il n'y a pas de ligne avant la première mesure que quiconque possède, et un tag dont la dernière mesure avant la fenêtre était mauvaise n'a aucun report, parce que ce qu'il tenait n'est pas connu. Une série de mauvaises mesures est un trou, comme toujours. Une mesure isolée est une ligne jusqu'à maintenant, ou un point s'il n'y a nulle part où la tracer.

  La légende nomme chaque ligne par le nom propre du tag, le même nom que montre la carte de nombre, sans l'appareil devant. Deux lignes de même nom venant d'appareils différents gardent leurs ids complets pour que vous puissiez les distinguer. `labels` est un objet facultatif qui va d'un tag de `tags` au texte que vous voulez à la place, de 1 à 80 caractères, et une étiquette pour un tag qui n'est pas tracé est refusée. L'infobulle au survol porte toujours l'id complet à côté de l'étiquette.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** charge l'adresse dans le navigateur, pas sur le serveur. Le config d'une carte est lisible par tous les rôles qui ouvrent le tableau de bord, donc une adresse contenant un identifiant ou un jeton est refusée à l'enregistrement du tableau de bord. Utilisez une adresse du réseau de l'usine qui n'en demande aucun, ou un proxy qui ajoute l'identifiant. Une image fixe est récupérée de nouveau toutes les `refreshSec` secondes avec un paramètre de requête `_hl` pour que le navigateur n'affiche pas la première pour toujours.
- **`map`** est une image et des repères. L'image est une adresse http(s) ou une image téléversée dans la carte (png, jpeg, webp ou gif, jusqu'à 500 Ko, stockée dans la carte). Les repères sont des tags, placés en pourcentage de la largeur et de la hauteur de l'image pour qu'ils restent là où on les a mis à toute taille. C'est un plan d'usine, pas un plan de rues : une carte à tuiles demande un serveur de tuiles sur internet, et le PC de panneau d'une usine ne peut généralement pas en joindre un.
- **`setpoint`** est pour un nombre que quelqu'un saisit : une température, une vitesse, un niveau. Le champ connaît l'unité du tag (ou la `unit` de la carte) et ses limites : `min` et `max` ensemble, ou la plage propre du tag quand la carte n'en donne pas. Une carte peut seulement resserrer la plage du tag, jamais l'élargir, parce que la barrière d'écriture refuse une valeur hors de la plage du tag quoi que dise une carte ; une carte qui en offre plus est refusée à l'enregistrement du tableau de bord, de même qu'une carte sur un tag qui contient du texte ou un interrupteur (utilisez un `button` pour ceux-là). Hors des limites, hors du `step`, ou pas un nombre, la saisie le dit sous le champ et **Régler** reste désactivé. **Régler** demande d'abord, avec la valeur courante et une raison pour la piste d'audit, sauf si la carte a été construite avec `confirm` désactivé et que les Paramètres ne l'annulent pas, puis passe par `POST /api/write` : l'interrupteur général d'écriture, l'indicateur d'inscriptibilité du tag, le droit du rôle et la ligne d'audit sont les mêmes que pour toute autre écriture. La carte attend ensuite que la mesure de l'appareil montre la valeur et la surveille deux secondes de plus, puis dit ce que l'appareil tient : « Relu 70 C depuis l'appareil : c'est la valeur envoyée » ; ou, si l'automate a pris l'écriture et l'a ramenée à sa propre limite, « L'appareil a pris 70 C puis l'a changé en 60 C » ; ou, si la mesure ne l'a jamais montrée, « L'appareil indique 60 C, pas 70 C ». La ligne « dans l'appareil maintenant » est la mesure en direct en permanence, donc elle montre aussi un programme d'automate qui écrase la valeur plus tard. Tant que l'appareil n'a pas de bonne mesure (un automate éteint ou injoignable), le champ et Régler sont désactivés et la carte dit que l'appareil ne répond pas, parce qu'une écriture ne pourrait qu'être refusée.
- **`symbols`** est une image d'une machine. `width` et `height` sont la taille propre de la page en pixels (800 sur 450 si omis), `image` est un fond facultatif (une adresse http(s), ou une image téléversée dans la carte, comme pour `map`), et `symbols` est une liste d'éléments placés au pixel depuis le coin supérieur gauche : `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. La page est dessinée comme une seule image mise à l'échelle, si bien que chaque symbole garde sa place à toute taille de carte et sur un téléphone. Les types sont `pump`, `motor` et `fan` (ils tournent tant que le tag est actif), `valve` (ouverte ou fermée), `tank` (rempli entre `min` et `max`, ou la plage du tag, ou 0 à 100), `heater` et `lamp` (allumés quand actif), `pipe` (ce qu'il contient bouge tant que son tag facultatif est actif), `readout` (le nombre, avec `unit` et `decimals`) et `label` (texte fixe). `invert` lit un tag à l'envers, et le `tone` d'un voyant (`ok`, `warn`, `bad` ou `info`) est la couleur dans laquelle il s'allume : un voyant de marche est vert et un voyant de défaut est rouge, et le tag dit seulement quand il est allumé. N'importe quel symbole peut porter deux règles qui lisent un tag. `show` le fait apparaître seulement tant que la règle est vraie (`"show": {"tag": "plc/bDoorOpen", "op": "off"}`) : tant qu'elle n'est pas vraie le symbole n'est pas dessiné, et le générateur l'affiche estompé pour qu'on puisse encore le sélectionner. `colors` est jusqu'à quatre règles, chacune avec un `tone` (`ok`, `warn`, `bad` ou `info`) : la première qui est vraie peint le symbole de cette teinte, quoi que dise son propre tag, et quand aucune n'est vraie il est dessiné comme il l'était. Une règle est `tag`, un `op` et, pour les comparaisons qui en ont besoin, une `value` : `on` (le tag n'est pas 0, la valeur par défaut), `off`, `eq`, `ne`, `gt`, `ge`, `lt` et `le`. Une règle dont le tag n'a pas de bonne lecture n'est pas vraie et ne cache rien, si bien qu'une connexion perdue ne fait jamais disparaître un symbole. Une règle peut aussi combiner des règles : `{"all": [...]}` est vraie tant que toutes le sont et `{"any": [...]}` tant qu'une l'est (le AND et le OR d'un automate), sur trois niveaux et huit parties au plus, et n'a pas de tag à elle. Un tag perdu rend un `all` faux, et un `any` reste vrai grâce aux autres. Un voyant peut aussi porter une règle `lit` à la place de son tag, pour un voyant allumé par une comparaison ou une combinaison (`"lit": {"tag": "plc/Mode", "op": "eq", "value": 3}`) ; il n'a alors pas besoin de tag. Les tags des règles sont des tags que l'écran nomme, si bien qu'un fichier d'écran les liste et les déplace avec le reste. Un symbole dit son état avec des mots autant qu'avec la couleur (une légende et un titre), est dessiné rouge ou chaud quand son tag est en alarme ou en est revenu, et est estompé avec "no reading" quand le tag n'a pas de bonne lecture. Le mouvement s'arrête quand la personne a demandé à son système moins de mouvement. Les symboles sont dessinés par HotLoop pour HotLoop ; aucun n'est emprunté. Un symbole avec un tag ouvre ce tag quand on clique dessus, comme une épingle sur un plan d'usine. Il ne commande rien : placez à côté une carte `setpoint` ou `button` pour cela. Dans le générateur un symbole se saisit et se déplace avec le pointeur, ou avec les flèches du clavier (Maj déplace de dix pixels), ou reçoit ses pixels par un nombre.

  **Symboles de procédé et tuyaux.** Une carte symbols est aussi un P&ID. En plus des types ci-dessus elle place `controlvalve`, `checkvalve`, `compressor`, `heatexchanger`, `filter`, `vessel`, `flowmeter`, `instrument` (une bulle ISA : son `label` donne les lettres, et elle montre le nombre de son tag), `junction`, `source` et `sink`. Un symbole a `rot` (`90`, `180` ou `270`) pour le tourner par quarts de tour autour de son centre ; le texte ne tourne pas. La plupart des symboles ont des points de connexion : `in` et `out` pour une pompe, `top`, `bottom`, `left-1` à `left-3` et `right-1` à `right-3` pour une cuve, `w` et `e` pour une vanne, et ainsi de suite. Un tuyau en relie deux :

  ```json
  "pipes": [
    { "id": "tank-out", "from": { "symbol": "tank-1", "port": "bottom" },
      "to": { "symbol": "p1", "port": "in" }, "medium": "water", "tag": "plc/Flow" }
  ]
  ```

  Seul ce qui est relié est stocké. La page calcule le trajet partout où elle dessine le tuyau : des angles droits, en contournant chaque symbole de la page avec du jeu, avec le moins de coudes possible, et un tuyau qui part d'un symbole part du côté vers lequel regarde son point de connexion. Déplacez un symbole et ses tuyaux se retracent pendant qu'il bouge, dans le générateur et dans un fichier enregistré. Un T est un symbole `junction` avec trois tuyaux dessus (ses points `n`, `e`, `s` et `w` sont tous en son centre), et dans le générateur déposer un tuyau sur un autre coupe ce tuyau avec une jonction pour vous. `medium` est l'un de `process` (la valeur par défaut), `water`, `wastewater`, `fuel`, `oil`, `air`, `steam`, `gas`, `chemical`, `coolant`, `hydraulic`, `vacuum`, `nitrogen`, `power` ou `signal`. Chacun a sa couleur, et signal et power ont aussi leur propre motif de ligne, si bien qu'un tuyau ne se distingue jamais par la couleur seule. `tag` (avec `invert`) dit quand le fluide circule dans le tuyau, de `from` à `to`, et `flow` le dit avec une règle, les mêmes règles que `show` et `colors` d'un symbole. Un tuyau sans l'un ni l'autre est dessiné plein et immobile. `label` fait jusqu'à 24 caractères le long du tuyau. Un tuyau porte un tag ou une règle, pas les deux. Une page contient jusqu'à 120 symboles et 240 tuyaux.

  **La barre d'outils.** Chaque carte symbols, à l'affichage comme à la construction, a une barre d'outils en haut à droite : zoom avant, zoom arrière, ajuster la page, la mini-carte et la vue haute performance. Le zoom se fait aussi avec Ctrl et la molette (la molette seule continue de faire défiler le tableau de bord), `+`, `-` et `0` sur la page ; faites glisser la page pour la déplacer. Une fois zoomée, la mini-carte montre la page entière avec un cadre là où vous êtes, et appuyer ou glisser dessus vous y emmène. La vue haute performance est la page grise ISA-101 : équipements gris et tuyaux gris, un remplissage plus sombre pour en marche ou ouvert au lieu du vert, le fluide du tuyau comme un code court à côté (W pour l'eau, S pour la vapeur, SIG pour le signal), et une couleur seulement sur ce qui est en alarme ou peint par une règle. `view` à `hp` fait ouvrir une page dans cette vue ; la barre d'outils bascule dans les deux sens pour qui regarde, et rien n'est stocké par cela. Le flux n'est animé que quand la personne n'a pas demandé à son système moins de mouvement.
- **`markdown`** est construit en nœuds DOM et jamais en HTML, si bien que rien de ce qui y est saisi ne peut devenir du balisage ni un script.
- **`gauge`, `value`, `map`, `setpoint`** affichent « n'est plus sur cette gateway » si leur tag est supprimé après l'enregistrement du tableau de bord, au lieu d'un cadran qui ne bouge jamais.

## Le tableau mural

Le tableau mural est le tableau de bord `wall`, de genre `wall`. Il est toujours là, il ne peut pas être supprimé, et il n'a pas de cartes : ses jauges sont les tags épinglés sur l'écran Board, conservés dans le propre réglage du tableau où ils ont toujours été. `GET` et `PUT /api/board`, l'adresse `#board`, le sélecteur d'épingles et le glisser pour ranger sont intacts.

Ce qu'il tire du fait d'être un tableau de bord, c'est le sélecteur (c'est la première pastille de chaque tableau de bord et le Board a aussi la barre) et les affectations : il peut être proposé à certains rôles, être l'accueil d'un rôle, et celui d'un écran physique. Un téléviseur au mur ouvre `/?screen=wall-tv` et obtient le Board sans l'en-tête ni les onglets.

## Rôles et écrans

**Par rôle.** `roles` décide à qui un tableau de bord est proposé. `homeFor` décide où un rôle atterrit. Un opérateur dont l'accueil est `line-2` ouvre HotLoop sur la Ligne 2. Avec un fragment d'URL dans l'adresse (`#alarms`) la page s'ouvre où l'adresse le dit.

**Par écran.** Un écran est un affichage physique. Ouvrez HotLoop sur `/?screen=<name>` et il montre le tableau de bord dont `screens` porte ce nom, sans en-tête, sans onglets et avec des cibles tactiles plus grandes, parce que celui qui passe devant un PC de panneau n'a que faire d'une sortie de la page. Un nom qu'aucun tableau de bord n'a le dit au lieu d'afficher autre chose.

**Un panneau identifie les personnes, pas lui-même.** Sans personne d'identifié, il affiche un seul champ « PIN ou badge ». Un opérateur saisit son PIN, ou scanne son badge (un lecteur de type clavier le saisit dans le champ), et le panneau ouvre le tableau de bord. Son nom et un bouton **Se déconnecter** se trouvent dans le coin, puisque l'en-tête qui les montrerait n'est plus là. Chaque écriture que fait un bouton de ce tableau de bord passe par la barrière d'écriture sous le nom de cette personne, et la piste d'audit et le journal de bord la nomment : « olga a écrit 250 dans line-02/Speed », pas « panel-3 ». Après quinze minutes sans que personne ne touche l'écran (un réglage) le panneau la déconnecte et revient au champ, et une écriture envoyée ensuite est refusée. Un administrateur donne à chaque personne un code sous **Paramètres, Utilisateurs**. L'ensemble, ce qu'est un badge, comment le code est stocké et ce qu'il ne fait pas, se trouve dans [Authentification et utilisateurs](/fr/iot/authentication/#panneaux-kiosque--pin-ou-badge-et-déconnexion-à-linactivité).

Sur votre propre ordinateur rien de cela ne s'applique : vous êtes connecté avec votre mot de passe, l'écriture d'un bouton passe directement par la barrière et vous journalise, et il n'y a pas de déconnexion sur inactivité. Un panneau qui était connecté avec un compte d'opérateur permanent, comme un panneau devait être exploité avant les PIN, fonctionne toujours et écrit toujours sous ce compte. Ne donnez pas un tel identifiant à un panneau partagé.

C'est ce qu'est l'IHM d'Edge : un tableau de bord avec `screens` défini, sur une machine qui ouvre cette adresse, avec les personnes qui s'y connectent par PIN ou badge.

## Construire

Celui qui détient `dashboards.write` (les administrateurs) voit **Modifier** sur un tableau de bord et **Nouveau tableau de bord** dans la barre. Pendant la modification :

- les cartes sont inertes, donc saisir un bouton pour le déplacer ne peut pas l'actionner ;
- glissez une carte sur une autre pour la mettre là, ou utilisez les flèches de sa barre d'outils, qui sont ce qu'a un téléphone, parce qu'un écran tactile ne démarre pas de glissement ;
- glissez le coin pour redimensionner : la largeur s'aligne sur une colonne de douze, la hauteur sur une ligne ;
- l'engrenage modifie la carte, le bouton de copie la duplique, la croix la supprime ;
- **Paramètres** est le nom, à qui il est proposé, pour qui il s'ouvre d'abord, ses écrans physiques et sa place dans le sélecteur.

Rien n'est enregistré avant **Enregistrer**. **Abandonner** jette les modifications. Un `409` à l'enregistrement signifie que quelqu'un a enregistré avant : la page propose de charger sa version.

**Exporter** (à côté de Modifier) enregistre le tableau de bord à l'écran sous forme de fichier, et **Importer** (dans la barre à côté de Nouveau tableau de bord, pour qui détient `dashboards.write`) en charge un dans cette installation, si bien qu'un écran est une donnée du client et circule entre installations sans que personne ne le reconstruise. Voir [Fichiers d'écran](/fr/iot/screen-file/).

## Disposition

| Largeur | Colonnes | Une carte de `w` prend |
|---|---|---|
| Plus de 1100 px | 12 | `w` |
| 700 à 1100 px | 6 | la moitié de `w`, arrondie au-dessus |
| 480 à 700 px | 2 | une, ou les deux quand `w` dépasse 4 |
| Moins de 480 px | 1 | tout |

Les lignes font 76 px avec un espace de 16 px sur les dispositions larges. Sur un téléphone une carte est aussi haute que son contenu avec un plancher fixé par ses lignes, si bien que rien n'est coupé. Le sélecteur défile latéralement à l'intérieur de lui-même et la page ne le fait jamais.

## Sur un téléphone

L'interface web s'installe sur un téléphone et s'ouvre sans connexion. C'est la même page avec un manifeste, des icônes et un service worker, servie par HotLoop lui-même, donc il n'y a rien à construire et rien à installer sur le serveur.

**L'installer.** Sur Android, le menu de Chrome propose **Installer l'application**. Sur un iPhone, la feuille Partager de Safari propose **Sur l'écran d'accueil**. Elle s'ouvre en plein écran, avec le nom de l'usine, et sur Android un appui long sur son icône propose Alarmes et Tableaux de bord. Un navigateur n'installe une page et n'exécute un service worker que sur **https**, ou sur `localhost`. Sur l'adresse `http://` simple d'une usine, HotLoop s'ouvre toujours dans un onglet exactement comme avant, mais il ne peut pas être installé et ne fonctionnera pas hors connexion. Placez un certificat devant pour les téléphones (l'ingress ou le reverse proxy que vous avez déjà). Le navigateur vous dit pourquoi il n'installe pas : outils de développement de Chrome, Application, Manifest.

**Ce qu'il garde.** La page elle-même, et la dernière réponse aux lectures que consulte une personne : la liste des alarmes, les tableaux de bord, les mesures et états d'entités, les appareils et tags, l'état, l'arbre des équipements et le board. Tant que la page est ouverte et connectée, il les demande une fois par minute pour qu'il y ait quelque chose à ouvrir, et pas tant que le téléphone est dans une poche. Ouvrez-la sans connexion et la page se charge, la liste des alarmes et les tableaux de bord montrent ce que le téléphone a vu en dernier, et une barre en bas le dit, avec l'heure :

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Quand la connexion revient, en quelques secondes, la barre disparaît, l'écran se rafraîchit à partir de réponses en direct et le flux en direct se reconnecte.

**Hors connexion et jamais connecté.** Un téléphone qui a l'application mais n'est pas connecté (il ne l'a jamais été, ou il s'est déconnecté, ce qui vide ce qu'il avait gardé) n'a rien à montrer sans connexion, donc il affiche l'écran de connexion et dit pourquoi : HotLoop ne répond pas d'ici, et il continue d'essayer. Dès que HotLoop répond, la page se recharge d'elle-même vers la vraie connexion. Il n'affiche jamais une application vide.

**Ce qu'il ne fait jamais.** Rien qui modifie quoi que ce soit n'est envoyé depuis une page hors connexion. Une écriture, qu'il s'agisse d'une valeur dans un tag, d'un script, d'une recette ou d'un acquittement, est refusée avant de quitter la page, avec la raison :

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

Le service worker ne répond pas à une écriture, ne la conserve pas et ne la met pas en file, et il n'y a pas de synchronisation en arrière-plan en lui. Une commande vers un équipement n'est jamais envoyée que par une personne qui regarde une réponse en direct, et un bouton pressé sans connexion n'attend pas quelque part pour partir plus tard. Acquitter depuis une notification est une chose distincte et demande le réseau de la même façon : l'application ntfy appuie sur son propre bouton.

**Ce qu'il ne garde pas.** Le flux en direct, les tendances et l'historique, le journal de bord, les paramètres, les utilisateurs, la politique d'escalade et tout ce qui touche aux notifications. Certains sont trop gros et différents à chaque fois pour valoir d'être gardés, et d'autres contiennent des choses (les sujets ntfy des personnes, les comptes) qui n'ont pas leur place dans le cache d'un téléphone, donc ces écrans ont besoin que HotLoop réponde.

**Sur le téléphone.** Ce qui est gardé vit dans le stockage de cache du navigateur de ce téléphone, 200 réponses au plus, les plus anciennes écartées d'abord. **Se déconnecter le vide**, et une session expirée ou révoquée aussi (le premier `401` le vide). Seule une session connectée est jamais gardée, si bien qu'un téléphone hors connexion ne s'ouvre jamais sur les données de quelqu'un d'autre. Une nouvelle version de HotLoop reçoit un cache de pages à elle et l'ancien est supprimé ; la page est récupérée en direct chaque fois qu'il y a une connexion, donc une nouvelle version ou une usine renommée apparaît à l'ouverture suivante.

Le même test retire le serveur, pour la page et le worker, et recharge : la page s'ouvre, la liste des alarmes et un tableau de bord montrent ce qui a été gardé, une écriture vers un tag et un Acquitter sont tous deux refusés, l'alarme est toujours non acquittée et l'audit d'écriture vide une fois la connexion revenue, et se déconnecter vide ce qui a été gardé. Exécuté sur du matériel réel (2026-11-17), y compris l'installation sur un vrai téléphone, Safari sur un iPhone, et la coupure du Wi-Fi d'une vraie usine.

## Droits

| Droit | Lecteur | Opérateur | Administrateur |
|---|---|---|---|
| `dashboards.read` | oui | oui | oui |
| `dashboards.write` | non | non | oui |

Lire est le droit de tous les rôles, filtré par `roles`. Écrire est celui de l'administrateur. Ce qu'une carte peut faire à l'appui, ce sont les propres droits de la personne qui appuie : un lecteur voit un bouton d'écriture désactivé, et le serveur le refuserait s'il passait outre.

## L'API

| Méthode | Route | Droit |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

La référence avec les corps et les erreurs se trouve dans [l'API HTTP](/fr/iot/api/#tableaux-de-bord). Chaque création, enregistrement et suppression est consignée comme un événement `config` sur le sujet `dashboard:<id>`, si bien que le journal de bord dit qui a changé ce que montre un panneau.

La table est `dashboards`, ajoutée dans la migration 0023 pour PostgreSQL, TimescaleDB et SQLite. Elle ne fait qu'ajouter ([Les migrations ne font qu'ajouter](/fr/iot/migrations/)). La ligne du tableau mural est créée par l'application la première fois qu'on la demande, pas par la migration, si bien qu'une base restaurée depuis une sauvegarde antérieure aux tableaux de bord la retrouve.

## Ce qui n'est pas là

- **Des dispositions exactes au pixel.** Exprès, voir plus haut. Si l'IHM d'une machine a vraiment besoin d'une commande à un endroit fixe, c'est un écran construit pour cette machine, et ce n'est pas ce que ceci est.
- **Une visibilité par carte.** Un tableau de bord est proposé à des rôles ; une carte non. Deux publics avec des cartes différentes sont deux tableaux de bord.
- **Une carte à tuiles.** Voir la carte `map`.
- **Maintenir un bouton.** Un bouton écrit une fois à l'appui. Une commande momentanée qui écrit à l'appui et de nouveau au relâchement est une autre carte et n'est pas construite.
- **Des tableaux de bord dans l'Edge Relay.** Il n'a pas d'interface.
