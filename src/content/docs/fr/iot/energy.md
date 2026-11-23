---
title: "Énergie"
description: "Compteurs en tranches de 15 minutes, un tarif qui chiffre chaque tranche à sa création, une pénalité de puissance, les équipes et le coût d'une unité produite."
---

Ce que l'usine consomme et ce que cela coûte : kilowattheures, gaz, eau, air comprimé et coût d'une unité produite, sur un seul écran, pensé pour un atelier. Pas de nouveau matériel ni de nouveau protocole. Un compteur est un tag que HotLoop lit déjà, et ceci est la comptabilité posée par-dessus : ce que le tag a compté, conservé dans la base de données et chiffré.

## Un compteur

Un compteur lit un tag comme une quantité consommée. Il a l'un de deux modes.

| Mode | Le tag est | Ce qui a été consommé est |
|---|---|---|
| `counter` | un comptage cumulé : un registre de kWh, un totalisateur de gaz, les impulsions d'un compteur d'eau | de combien il a avancé, multiplié par le `factor` du compteur |
| `power` | un débit : les kW consommés maintenant, en `W`, `kW` ou `MW` | la moyenne de deux mesures sur le temps qui les sépare |

`factor` est ce que vaut un pas du compteur dans l'unité du compteur : `0.001` transforme un registre en Wh en kWh, `0.01` signifie qu'une impulsion vaut un centième de mètre cube. S'il est omis, il vaut 1. Un compteur de puissance n'a pas de facteur : son `power_unit` et son `unit` (`Wh`, `kWh` ou `MWh`) disent comment convertir.

| Genre | Pour | Unité habituelle |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | gaz | m³ |
| `water` | eau | m³ |
| `air` | air comprimé | m³ |
| `heat` | vapeur, eau chaude, chaleur | kWh |
| `production` | unités produites | unités |

Un compteur `production` compte ce que la ligne a produit. Il n'a pas de tarif, et c'est lui par lequel on divise le coût d'une unité.

Créez-en un sur l'écran Énergie (Nouveau compteur) ou avec `POST /api/energy/meters` (voir [l'API HTTP](/fr/iot/api/#énergie)). Seul un administrateur crée, modifie ou supprime un compteur (`energy.write`) ; tout le monde lit (`energy.read`). Le tag doit exister et être un nombre. Si le tag est supprimé plus tard, le compteur indique qu'il attend, et reprend le tag quand il est recréé.

## Comment il compte

Toutes les dix secondes, le moteur lit le tag de chaque compteur depuis le même cache que celui de chaque écran, et calcule ce qu'ajoute chaque nouvelle mesure. Ce qu'elle ajoute va dans des tranches de 15 minutes, dans la base de données, dans la même transaction que la dernière mesure du compteur. Un redémarrage ne perd donc rien et ne compte rien deux fois.

* **Un compteur cumulatif** ajoute de combien il a avancé depuis la dernière mesure, réparti sur le temps entre les deux mesures proportionnellement au temps passé dans chaque tranche.
* **Un compteur qui recule** a été remis à zéro ou remplacé. Rien n'indique combien a été consommé, donc rien n'est ajouté : la nouvelle valeur est le nouveau point de départ, et le compteur comptabilise la remise à zéro (`status.resets`).
* **Un compteur qui a continué de compter pendant que HotLoop était arrêté.** L'avance est réelle et elle est conservée en entier, répartie uniformément sur l'intervalle, et chaque tranche touchée est marquée **estimée**. Un intervalle est plus de dix minutes entre deux mesures.
* **Une puissance** est la moyenne de deux mesures sur le temps qui les sépare. Pour un intervalle de plus de dix minutes, il n'y a rien : le compteur n'invente pas de puissance pour un temps que personne n'a lu, et l'intervalle est compté (`status.gap_seconds`). Chaque tranche indique combien de ses 900 secondes ont une mesure (`covered_seconds`), et l'écran affiche « Lu pendant 63 % de la période » quand un compteur de puissance n'a pas été lu pendant une partie de celle-ci. Une mesure de puissance qui n'a rien consommé couvre quand même son temps.
* **Une mesure mauvaise** (la qualité du tag n'est pas bonne) n'ajoute rien, et le compteur le dit sur sa carte avec la raison. Un compteur cumulatif qui n'était pas lu et revient compte ce dont il a avancé entre-temps, comme un intervalle.
* **Une mesure qui n'a pas pu être enregistrée** est recalculée au cycle suivant à partir du même point de départ.

## Ce que cela coûte

Un tarif chiffre chaque tranche à sa création : un `price` fixe par unité et, en option, des `bands` pour un tarif horosaisonnier. Une plage est `from` et `to` sur un quart d'heure de l'horloge propre du site (un `to` antérieur au `from` passe minuit), les `days` où elle s'applique (`mon` à `sun`, tous les jours si omis) et un `price`. La première plage valable à cet instant l'emporte ; en dehors de toutes les plages, le prix fixe s'applique. Une tranche est chiffrée au milieu du temps que couvre chaque mesure.

Comme le coût est stocké avec la tranche, **un prix modifié plus tard ne change pas ce que le mois dernier a coûté.** Changer le tarif d'un compteur change ce qu'il compte à partir de là.

`currency` est un code ou un symbole. Les coûts dans deux devises ne sont jamais additionnés : le résumé a un coût pour chacune.

### Une pénalité de puissance

Un compteur d'électricité en `Wh`, `kWh` ou `MWh` peut avoir un `demand_price` dans son tarif : ce que coûte un kilowatt du quart d'heure le plus élevé de l'usine. Sur une fenêtre, la puissance appelée d'une tranche est les kilowatts qu'elle a atteints en moyenne (un quart d'heure qui a consommé 25 kWh a fait en moyenne 100 kW) et sa charge est cela multiplié par le prix de puissance qu'avait le compteur à la création de la tranche. La charge de la fenêtre est la plus élevée d'entre elles, qui pour un seul prix est le pic multiplié par le prix. Le résumé donne à chacun de ces compteurs un `demand` avec le pic en kW, son début et la charge, et met la charge dans le coût de la fenêtre et dans le coût d'une unité produite. Le `cost` du compteur reste ce que l'énergie a coûté.

Comme le prix de l'énergie, le prix de la puissance est conservé avec chaque tranche à sa création (migration 0030), donc **changer un prix de puissance change ce qui est compté à partir de là et jamais le mois écoulé.** Les tranches créées avant que le compteur ait un prix de puissance n'en portent aucun : elles montrent un pic et pas de charge.

Un fournisseur facture la puissance sur son mois de facturation, demandez donc `this_month` ou `last_month` pour voir la ligne de la facture ; une fenêtre plus courte donne la charge du quart d'heure le plus élevé qu'elle contient. Si le quart d'heure de pic n'a pas été lu en entier (`peak_covered_seconds` en dessous de 900), le pic est sous-estimé, et l'écran le dit. Les capteurs `Today` ci-dessous ne comptent que l'énergie : une pénalité de puissance est une ligne de la facture du mois, pas quelque chose qui s'accumule toute la journée.

## Le coût d'une unité produite

Le coût sur une fenêtre des compteurs chiffrés que vous choisissez, divisé par ce qu'un compteur de production a compté sur la même fenêtre. Le résumé en donne un par compteur de production et par devise. Quand rien n'a été produit, le coût par unité est `null` avec le `reason` `nothing_made`, et l'écran affiche « Rien produit » : ce n'est pas une réponse, ce n'est ni zéro ni une division par zéro. Même chose quand des unités ont été produites et qu'aucun compteur chiffré n'a encore compté de consommation (`nothing_counted`, « Aucune énergie comptée pour l'instant ») : les compteurs sont lus l'un après l'autre, donc un registre qui n'a pas encore bougé n'est pas un produit gratuit. Un compteur qui a compté quelque chose à un prix nul compte quand même, et donne un coût nul.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` le calcule pour une ligne : `meters` nomme les compteurs dont le coût entre dans le calcul, `per` le compteur de production. Sans eux, ce sont tous les compteurs chiffrés sur tous les compteurs de production.

## Fenêtres

`period` vaut `today`, `yesterday`, `this_week` (les semaines commencent le lundi), `last_week`, `this_month`, `last_month`, `last_7_days` ou `last_30_days`, une équipe, ou donnez `from` et `to` en RFC 3339 (400 jours au plus). Les jours, semaines et mois sont ceux **du site**, dans son propre fuseau horaire (`HOTLOOP_TIMEZONE`) : minuit est le minuit de l'usine, et la journée de 23 ou 25 heures est la vraie journée. Une équipe s'écrit `shift:06:00-14:00`, de et à sur un quart d'heure de l'horloge du site, et un `to` qui n'est pas postérieur au `from` passe minuit (`shift:22:00-06:00`). `shift:` est la dernière qui a commencé, c'est-à-dire celle en cours quand il y en a une, et `last_shift:` est celle d'avant. Une équipe est construite à partir du jour calendaire, donc la nuit du changement d'heure dure ce qu'elle a vraiment duré. L'écran a une case Équipe à côté des périodes, et les mêmes noms vont dans la période des outils MCP. Les séries sont découpées par pas de `quarter` (8 jours au plus), `hour`, `day` ou `month`.

## À l'écran

L'écran Énergie (groupe Usine) a un sélecteur de période, le coût de la période, le coût par unité produite de chaque compteur de production et une carte par compteur : ce qu'il a consommé, ce que cela a coûté, une barre par heure (ou par jour) et, quand cela s'applique, s'il est lu, si une partie est estimée et sur quelle part de la période un compteur de puissance a été lu. Une barre au contour en pointillés est estimée. Un compteur qui ne peut pas être lu dit pourquoi. Chaque mot est dans les 14 langues.

## Entités

Chaque compteur fournit des capteurs que tout écran et toute règle peuvent utiliser :

| Entité | État |
|---|---|
| `sensor.<meter>_today` | ce que le compteur a consommé depuis minuit du site, dans son unité |
| `sensor.<meter>_cost_today` | ce que cela a coûté (un compteur chiffré) |
| `sensor.<production meter>_cost_per_unit_today` | le coût d'aujourd'hui sur les unités produites aujourd'hui. `unknown` tant que rien n'est produit, et quand les compteurs sont chiffrés en deux devises |

Ils sont de la plateforme `energy`, ils lisent, et n'acceptent aucun service. Un compteur qui a cessé de répondre reste ce qu'il avait consommé jusque-là, avec la qualité `uncertain` et `meter_status` qui dit pourquoi.

## MCP

Les agents lisent et gèrent les compteurs par les mêmes routes :

| Outil | Fait |
|---|---|
| `list_energy_meters`, `get_energy_meter` | les compteurs, comment chacun est lu, et la consommation et le coût d'aujourd'hui |
| `get_energy_summary` | ce que chaque compteur a consommé et coûté sur une période nommée, le coût dans chaque devise et le coût d'une unité produite |
| `get_energy_series` | la consommation d'un compteur sur une période nommée, par pas |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | créer, modifier et supprimer un compteur. Chacun demande un motif et est audité |

Les filtres `meters` et `per` du coût par unité sont des paramètres de requête REST.

## Sauvegarde et mises à jour

Trois tables le contiennent (migration 0029) : `energy_meters`, `energy_meter_state` et `energy_buckets`, toutes dans la sauvegarde. La migration 0030 ajoute le prix de puissance aux compteurs et à chaque tranche. Les migrations ne font qu'ajouter. Une tranche pèse environ 100 octets, donc un compteur pèse environ 3,5 Mo par an.

## Ce qu'il ne fait pas

* **Il ne connaît pas vos équipes.** Une équipe est nommée dans la requête, sous la forme `shift:06:00-14:00` ; il n'y a pas de liste des équipes de l'usine où choisir, et une équipe qui ne tombe pas sur un quart d'heure est refusée parce que les tranches sont des quarts d'heure.
* **Il ne facture pas la puissance à votre place.** La charge est le quart d'heure le plus élevé de la fenêtre multiplié par le prix ; les cliquets, les puissances minimales et les charges de facteur de puissance d'un fournisseur n'y figurent pas.
* **Il ne lit pas un compteur à votre place.** Le tag arrive d'abord : ajoutez l'appareil (Modbus, MQTT, OPC UA, ou Emberburn pour un appareil simulé), puis créez le compteur.
