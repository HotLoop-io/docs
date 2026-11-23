---
title: "Le soleil"
description: "Lever, coucher, aube, crépuscule et position du soleil calculés sur le boîtier à partir de la latitude et de la longitude, sans service météo ni internet."
---

Dites à HotLoop où se trouve l'usine et il sait où est le soleil. Lever, coucher, aube, crépuscule, midi solaire, la hauteur du soleil et son azimut, le tout calculé sur le boîtier à partir d'une latitude et d'une longitude. Pas de service météo, pas de clé d'API, pas d'internet. Un site dont la liaison montante est tombée il y a trois semaines allume quand même les lumières de la cour à la tombée de la nuit, et c'est toute la raison pour laquelle ce n'est pas un appel vers le cloud de quelqu'un d'autre.

## La mise en place

Deux variables, en degrés décimaux, le nord et l'est étant positifs :

| Variable | Exemple | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | nord positif |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | est positif, donc toute l'Amérique est négative |

Dans le chart, ce sont `plant.latitude` et `plant.longitude`. Les deux ou aucune. Une moitié de position, un nombre hors de la planète ou `41°29'58"N` arrêtent HotLoop au démarrage en nommant la variable, car un lever du soleil calculé à partir d'une faute de frappe se trompe de plusieurs heures et paraît parfaitement raisonnable à l'écran. Prenez les nombres sur n'importe quelle carte : clic droit, copier les coordonnées.

Sans elles, il n'y a pas d'entités du soleil, et une règle avec un déclencheur solaire n'est pas armée (le journal système indique quelles deux variables définir). L'écran Paramètres affiche les deux, en lecture seule. Un lever du soleil est quelque chose sur lequel les règles se déclenchent, il évolue donc avec un déploiement relu.

## Les entités

| Entité | État | <span class="sr-only">Détails</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` du lever au coucher | attributs `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, dans le fuseau horaire du site |
| `sensor.sun_elevation` | degrés au-dessus de l'horizon, négatif en dessous | degrés entiers |
| `sensor.sun_azimuth` | degrés dans le sens horaire depuis le nord vrai, 90 est l'est | degrés entiers |

Elles sont de plateforme `sun`, elles se lisent et n'acceptent aucun service. `sun_up` est calculé exactement, il bascule donc à la seconde même où se déclenchent les déclencheurs de lever et de coucher, et non d'après l'élévation arrondie.

L'élévation et l'azimut sont en degrés entiers, volontairement. Le soleil se déplace d'environ un quart de degré par minute. À un dixième de degré, cela ferait un nouvel état, une ligne de journal et un point d'historique toutes les 24 secondes, toute la journée, tous les jours, pour chaque capteur, pour une précision sur laquelle personne n'automatise. Une règle qui veut « le soleil est à plus de 10 degrés » l'obtient au degré près.

Sous le soleil de minuit ou dans la nuit polaire, le prochain coucher ou lever peut être à des semaines, et l'attribut dit quand. S'il n'y en a pas dans l'année, il indique `none within a year` au lieu d'être discrètement omis.

## Les déclencheurs

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` ou `dusk`, décalés de `offsetSec` (négatif pour avant, six heures au plus de chaque côté). Voir [Automatisations](/fr/iot/automations/#déclencheurs-solaires). `binary_sensor.sun_up` fonctionne aussi avec un déclencheur `state` ordinaire, et avec `states['binary_sensor.sun_up'] == 'off'` dans une condition, pour « seulement après la tombée de la nuit ».

## Ce que veulent dire les nombres

- **Le lever et le coucher** sont le moment où le bord supérieur du soleil est sur l'horizon, avec la correction habituelle pour la courbure de la lumière dans l'air : le centre à 0,833 degré sous l'horizon. C'est ce que tous les almanachs et tous les téléphones appellent le lever du soleil.
- **L'aube et le crépuscule** sont le crépuscule civil, le centre 6 degrés plus bas. C'est la ligne autour de laquelle on écrit l'éclairage extérieur : après le crépuscule civil, il faut des lumières pour travailler dehors.
- **Le midi solaire** est le moment où le soleil est plein sud (plein nord, au sud de l'équateur) et au plus haut. Il est rarement 12:00 à l'horloge ; en été, sur le bord ouest d'un fuseau horaire, il est bien plus d'une heure.
- **L'élévation** est l'endroit où le soleil semble être, corrigée de la réfraction. L'azimut se mesure depuis le nord vrai, pas le nord magnétique.

La réserve de l'horizon plat : ces valeurs valent pour un horizon au niveau de la mer. Une usine dans une vallée perd le soleil derrière la crête avant le coucher, et HotLoop ne connaît pas la crête. Mettez un décalage sur le déclencheur.

## Comment nous savons que c'est juste

Les calculs sont ceux de la NOAA : les équations derrière la calculatrice solaire du Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), qui viennent de *Astronomical Algorithms* de Jean Meeus. Portées telles quelles, bizarrerie comprise (le midi solaire de la NOAA lit l'équation du temps autour de minuit UT plutôt qu'à midi, une affaire de secondes, et c'est conservé pour que nous coïncidions avec la NOAA à la seconde).

Le test lit les 4 380 cellules de lever et de coucher et tient chaque passage à la minute publiée par la NOAA, plus deux secondes, et chacun des 2 190 midis à moins d'une seconde. Environ 97 pour cent tombent exactement sur la même minute ; le reste est à une seconde environ de la demi-minute, ce qui fait deux calculatrices en désaccord sur le dernier chiffre, pas sur le soleil. Chaque jour où la NOAA dit qu'il n'y a ni lever ni coucher, HotLoop dit la même chose.

La NOAA ne publie aucune table du crépuscule, l'aube et le crépuscule sont donc tenus à leur définition : au moment où HotLoop dit que c'est le crépuscule, le même calcul de position place le centre du soleil 6 degrés plus bas, à un cinquantième de degré près.

La NOAA dit que sa méthode est bonne à environ une minute entre les cercles polaires et se dégrade vers les pôles, où le soleil frôle l'horizon et où une minuscule erreur sur sa hauteur se compte en minutes à l'horloge. Utqiagvik passe la même barre que partout ailleurs. Aux pôles eux-mêmes, la méthode jour par jour peut manquer l'unique lever de l'année ; si vous exploitez une usine au pôle Sud, mettez un horaire.
