---
title: "Découverte MQTT"
description: "Pointez ESPHome, Zigbee2MQTT, Tasmota ou un Shelly vers le broker et il apparaît, en lecture seule jusqu'à ce qu'un admin l'accepte et arme chaque point."
---

Pointez un appareil vers le broker de HotLoop et il apparaît. Ses capteurs lisent, ses interrupteurs montrent leur état, ses entités portent les noms, unités et classes qu'il a annoncés. Personne ne saisit de liste de tags.

Et il ne peut rien commander. Chaque point que crée la découverte est en lecture seule, et le reste jusqu'à ce qu'un admin accepte l'appareil puis arme chaque point à la main, en regardant le topic exact vers lequel la commande ira. Un appareil qui s'annonce est un appareil qui vous dit ce qu'il est. C'est utile. Ce n'est pas un appareil qui gagne le droit de basculer un relais de votre usine, et HotLoop ne fait pas semblant que ce le soit.

## Qui le parle

Le format est celui des topics comme `homeassistant/sensor/kitchen/power/config`. Il porte le nom du projet qui l'a défini ; HotLoop le parle parce que les éditeurs le font, et c'est toute la relation.

| Éditeur | Comment il arrive ici | Contre quoi nous le testons |
|---|---|---|
| **ESPHome** (son composant `mqtt:`) | par composant, activé par défaut, retenu | sortie enregistrée de vrais nœuds (voir plus bas) |
| **Zigbee2MQTT** | par composant, avec des modèles sur presque tout | sortie enregistrée de vraies installations |
| **Tasmota** | son propre format, plus bas | sortie enregistrée de neuf vrais appareils |
| **Shelly** (Gen2, Gen3, Gen4) | aucune annonce ; appris à partir des états qu'il publie, plus bas | sortie enregistrée de quinze séries de vrais messages et la documentation du fabricant |
| Tout autre éditeur du format | pareil | les règles du format lui-même |

ESPHome est tenu aux enregistrements de vrais nœuds, comme Zigbee2MQTT.

Les enregistrements sont des messages qu'une vraie installation a publiés, capturés par la personne qui l'exploite, avec l'éditeur, la version et l'appareil notés et rien de changé sauf les espaces du JSON.

## Tasmota

Le Tasmota actuel ne publie pas le format `homeassistant/`. Sa documentation dit qu'il a été retiré de toutes les versions. Ce qu'il publie, retenu, est le sien :

- `tasmota/discovery/<MAC>/config` : l'appareil (son topic, son modèle de full topic, ses relais et lumières, ses mots d'allumage et d'extinction, ses mots de dernière volonté) ;
- `tasmota/discovery/<MAC>/sensors` : ce que ses capteurs lisent à cet instant.

Les deux sont écrits par `TasDiscovery` dans `xdrv_12_discovery.ino` de Tasmota (lu sur arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop transforme les deux en les mêmes composants que tout autre éditeur, donc tout ce qui suit (l'écran Découverts, l'acceptation, l'armement, la porte d'écriture, la lecture) suit un seul chemin de code. La MAC est l'identité de l'appareil ; un appareil qui s'annonce aussi au format `homeassistant/` (un vieux firmware avec SetOption19) est le même appareil.

| Tasmota dit | HotLoop crée |
|---|---|
| un relais (`rl` 1) | un interrupteur : lit `stat/<topic>/POWER` (`POWER1`, `POWER2` et ainsi de suite quand il y en a plusieurs), avec les mots d'allumage et d'extinction de l'appareil ; commande `cmnd/<topic>/POWER[n]` avec ON ou OFF |
| une lumière (`rl` 2) | une lumière : allumée et éteinte de la même façon. Avec un variateur, son niveau est la clé `Dimmer` de `tele/<topic>/STATE`, de 0 à 100, et se règle avec `cmnd/<topic>/Dimmer` |
| chaque nombre du message des capteurs | un capteur chacun, lu depuis `tele/<topic>/SENSOR` par son chemin (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), avec l'unité et la classe que Tasmota donne à ce nom. Le tableau d'un compteur triphasé donne un capteur par phase |
| sa dernière volonté | disponibilité : `tele/<topic>/LWT`, avec les mots Online et Offline de l'appareil |

Les topics sont construits comme Tasmota les construit : son full topic avec `%prefix%` et `%topic%` remplis, de sorte qu'un appareil dont le propriétaire a changé le full topic (`tasmota/35D7A0/%prefix%/`, ou `bi/test/%topic%/%prefix%`) lit et commande sur les topics qu'il utilise réellement.

Ce qu'il ne lit pas, il le dit, dans les problèmes de la source et jamais par le silence : volets, entrée d'interrupteur, bouton, iFan, caméra, couleurs d'une lumière colorée et luminosité d'un appareil ayant plus d'une lumière. Rien dans les enregistrements ne montre que l'un d'eux fonctionne, donc rien ici ne prétend les lire.

**Demander.** Tasmota signale un relais quand il change et tout toutes les cinq minutes. Donc quand la lecture d'un appareil commence, HotLoop envoie un message vide à `cmnd/<topic>/POWER`, auquel Tasmota répond avec l'état de chaque relais sans rien bouger ; sans lui, un appareil qui n'a pas changé lit inconnu jusqu'à cinq minutes après le démarrage de HotLoop. Le message est vide, vers un topic qui se termine par `POWER` et rien d'autre, et une source en écoute seule n'envoie rien du tout.

**La luminosité d'une lumière** arrive avec la télémétrie de Tasmota (toutes les cinq minutes sauf si le `TelePeriod` de l'appareil est plus court), pas au moment où elle change. L'allumage et l'extinction arrivent aussitôt.

**Sur chaque broker**, le format est un interrupteur (`tasmota` sur le broker, dans Paramètres, MQTT). Un broker ajouté maintenant l'a activé ; le broker intégré l'a toujours ; un broker qui existait déjà continue d'écouter exactement comme avant, donc il est désactivé jusqu'à ce que quelqu'un l'active. Désactivé signifie que HotLoop ne s'abonne même pas à `tasmota/discovery/#` là.

Une configuration n'est pas digne de confiance, comme toute autre. Une publiée sous une MAC qui n'est pas celle qu'elle dit, un full topic sans `%topic%` ou avec un joker, un topic contenant une barre oblique, un mot d'allumage contenant une apostrophe, une version qu'il ne connaît pas : chacune est refusée avec la raison, et rien n'est créé. Un nom de capteur contenant un guillemet n'atteint jamais un modèle.

**Contre quoi cela a été testé.** Les vrais messages de neuf appareils, capturés depuis la console même de Tasmota :

| Enregistrement | Appareil | Source |
|---|---|---|
| esp32-8relay-13.4.0 | carte ESP32, 8 relais, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 sans relais, trois démarrages | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | capteur de CO2 et de particules, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | le même boîtier en 15.4.0, dont le firmware publiait du JSON avec une virgule finale | le même ticket |
| nous-a1t-energy-plug-14.5.0 | prise NOUS A1T avec mesure d'énergie | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | compteurs et compteur triphasé, full topic modifié | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 sous Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | compteur d'énergie TuyaMCU, full topic modifié | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | deux relais, d'après le journal de la propre console de l'auteur de Tasmota | github.com/arendst/Tasmota/issues/24006 |

Ce sont des enregistrements, pas un appareil sur le banc. Ce que les enregistrements n'ont pas, c'est la luminosité (la ligne `tele/STATE` du variateur était illisible dans son journal d'origine ; sa clé `Dimmer` se trouve dans le `STATUS11` du même enregistrement, que Tasmota construit avec la même fonction) et la requête de puissance avec sa réponse (les enregistrements montrent la question et la réponse, depuis la console de Tasmota, pas HotLoop qui demande).

## Shelly

Un Shelly Gen2, Gen3 ou Gen4 n'annonce rien. Il n'y a pas de topic de configuration à attendre. Ce qu'il fait, une fois MQTT activé et ses notifications d'état activées, c'est publier l'état complet de chaque composant sur `<prefix>/status/<component>` (`switch:0`, `cover:0`, `light:0`, `input:0`, un `boolean:200` virtuel) à chaque changement, et sa dernière volonté sur `<prefix>/online`. HotLoop apprend donc l'appareil à partir de ce qu'il dit : les composants qu'il a publiés, les champs que chacun a portés, et la MAC tirée de son état `sys`. Le préfixe est par défaut l'identifiant de l'appareil (`shellyplus2pm-485519968144`), qui est son modèle et sa MAC, donc un appareil sur son préfixe par défaut n'attend même pas `sys`. Un appareil sur un préfixe saisi à la main (`ShellyLichtGarten`) doit publier `sys` avant de pouvoir être distingué d'un autre, et tant qu'il ne l'a pas fait, il est nommé dans les problèmes de la source et n'est pas créé.

Ce qui a été appris est conservé, par préfixe, et ne fait que grandir. Un composant qui se tait n'a pas été retiré, et un état contenant moins que le précédent n'enlève rien, donc un redémarrage ne fait pas perdre de pièces à un appareil. Tout ce qui suit est le même chemin que pour tout autre éditeur : l'écran Découverts, l'acceptation, l'armement de chaque point, la porte d'écriture, la lecture.

| Shelly dit | HotLoop crée |
|---|---|
| `switch:n` avec un `output` | un interrupteur : lit `output` depuis `<prefix>/status/switch:n` ; commande `<prefix>/command/switch:n` avec `on` ou `off` |
| `light:n` | une lumière de la même façon, avec `set,true` et `set,false` ; avec `brightness` dans son état, un niveau de 0 à 100, envoyé sous la forme `set,true,<level>` |
| `cover:n` | un volet : lit `state` (open, closed, opening, closing, stopped) et envoie `open`, `close` et `stop`. Un volet qui dit `pos_control` est calibré, donc il lit aussi `current_pos` et reçoit `pos,<n>` ; un qui ne l'est pas ne fait qu'ouvrir et fermer |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` sur un switch, light ou cover | un capteur chacun, en W, V, A, Hz, Wh et degrés C, avec la classe que leur donne la documentation de Shelly |
| `input:n` | un capteur binaire de son `state` |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | capteurs et capteurs binaires de batterie, d'alimentation externe, de tension, de niveau de lumière, de présence et de nombre d'objets |
| `boolean:n`, `number:n`, `enum:n` (composants virtuels) | capteurs en lecture seule. Régler un composant virtuel est un appel RPC, que ceci ne fait pas, et chacun est signalé dans les problèmes de la source |
| sa dernière volonté `online` | disponibilité, avec les `true` et `false` propres à Shelly |

Les commandes sont celles que la page MQTT du fabricant liste sous MQTT Control, et les tests tiennent HotLoop à cette liste : `on`, `off` et `toggle` pour un interrupteur ; `set,<bool>,<brightness>` pour une lumière ; `open`, `close`, `stop` et `pos,<n>` pour un volet. Chacune est une écriture à travers la porte, armée par une personne.

**Demander.** Un Shelly publie un composant quand il change, donc un appareil qui n'a pas changé lirait inconnu jusqu'à ce qu'il change. Quand la lecture d'un appareil commence, HotLoop envoie `status_update` à `<prefix>/command`, ce qui, selon cette même page, fait publier à l'appareil l'état de ses composants et ne bouge rien. C'est ce seul mot, vers un topic qui se termine par `/command` et rien d'autre, et une source en écoute seule n'envoie rien du tout. Cela se produit chaque fois que la lecture de l'appareil démarre, donc armer plusieurs points à la suite demande plusieurs fois.

**Ce que l'appareil doit avoir activé.** MQTT activé, avec l'adresse du broker ; les notifications d'état activées (`status_ntf`) ; et, pour les commandes, le contrôle activé (`enable_control`). Le broker propre à HotLoop a un profil d'identifiant `shelly`, nommé d'après le préfixe de l'appareil, qui lui permet de publier ses états et d'entendre `<prefix>/command` et rien d'autre.

**Ce qu'il ne lit pas.** Dit, dans les problèmes de la source, jamais par le silence : un composant d'un genre qu'on ne lui a pas montré (`lora:100` sur un Gen4 avec le complément LoRa, un `pm1`, un `em`), un switch ou un cover qui a omis le champ d'où il est lu, et le réglage d'un composant virtuel. Les événements d'entrée (une double pression, une pression longue) arrivent sur le topic de notification RPC, `<prefix>/events/rpc`, et ne sont pas lus ; seul le `state` d'une entrée l'est. Un préfixe de plus de deux niveaux (`home/garage/boiler`) n'est pas entendu ; un ou deux, oui. Rien n'est envoyé par RPC.

**Sur chaque broker**, c'est un interrupteur (`shelly` sur le broker, dans Paramètres, MQTT). Un broker ajouté maintenant l'a activé ; le broker intégré l'a toujours ; un broker qui existait déjà continue d'écouter exactement comme avant, donc il est désactivé jusqu'à ce que quelqu'un l'active. C'est un interrupteur parce que les topics sur lesquels il écoute, `+/status/+`, sont larges, et qu'un broker qui transporte autre chose sous `*/status/*` le veut désactivé. Désactivé signifie que HotLoop ne s'y abonne pas.

Il n'est pas digne de confiance, comme tout autre topic. Sont ignorés : un préfixe qui n'est pas composé de lettres, de chiffres et de `_.-`, un composant qui n'est pas de la forme `kind:number`, une charge qui n'est pas un objet ou dépasse 64 KiB, un appareil qui déclare plus de 64 composants, et plus de 512 appareils appris à la fois ; et une structure conservée sous un préfixe qui prétend être un autre est refusée.

**Contre quoi cela a été testé.** Quinze séries de vrais messages et la documentation du fabricant lui-même.

| Enregistrement | Appareil | Source |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM en volet roulant, calibré | le même dépôt, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | le même, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, deux voies | le même, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 avec le complément LoRa | le même, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | le même, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, avec la MAC de l'auteur masquée | le même, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | le même, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, avec un voltmètre | le dépôt ioBroker, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, trois zones | le même, issues/1228 |
| frankever-sprinkler-virtual-components | un contrôleur d'arrosage sur un préfixe propre, composants virtuels | le même, issues/1207 |
| official-docs-component-status | les exemples de composants du fabricant : Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | les commandes MQTT Control du fabricant | le même |
| official-docs-mqtt-page, official-docs-notifications | la page MQTT du fabricant et ses exemples de notifications | le même |

Deux d'entre eux ne peuvent pas devenir un appareil, et les tests le disent : le préfixe du Pro 4PM contient le masquage de l'auteur (`xxxx`) et n'a pas de `sys`, et celui de la lumière du jardin est un préfixe propre qui n'en a pas non plus. Les deux attendent leur MAC, comme le ferait un vrai.

**Ceci est vérifié sur des enregistrements et sur la documentation, pas sur un Shelly au banc.** Il n'y en a pas encore ici. Les états sont ce que de vrais appareils ont publié, les topics que HotLoop lit sont des topics que ces appareils ont utilisés, et les commandes ont les formes que documente le fabricant. Ce que les enregistrements ne peuvent pas montrer : une commande qui bouge réellement un relais, un volet qui atteint réellement une position, et la réponse à `status_update`. Quand un Shelly sera au banc, ce sont les trois choses à essayer d'abord.

## Ce qui se passe quand quelque chose s'annonce

1. **Il apparaît.** Sur le broker intégré, un appareil qui s'annonce est aussitôt un appareil HotLoop : protocole `mqtt`, non placé dans l'arborescence, nommé d'après ce qu'il s'est appelé (`kitchen-plug`, puis `-2` en cas de collision), en lecture. Ses tags sont nommés d'après ce qu'il a annoncé (`power`, `relay`). Ses entités reçoivent le nom, la classe d'appareil, la classe d'état, l'unité, la catégorie et l'icône que la configuration leur a donnés, et une entité que la configuration déclare désactivée par défaut démarre désactivée.
2. **Rien n'est armé.** Chaque tag est créé en lecture seule. Un interrupteur, un nombre ou un texte reçoit aussitôt son entité de commande, non armée (`armed: false`), de sorte qu'un écran ou une automatisation peut nommer `switch.kitchen_plug_relay` dès le premier jour. Elle se met à fonctionner à l'instant où une personne arme le point, et pas avant.
3. **Un admin décide.** Appareils, Découverts. Qui l'a annoncé (sur le broker intégré, l'identifiant et l'id de client qui ont publié sa configuration), chaque composant qu'il créerait, chaque topic qu'il lit, chaque topic de commande en entier, et ce qu'il faut regarder :

   - un topic de commande en dehors des topics que le composant lit (une « lampe » dont les commandes vont à `cmnd/boiler/POWER`) ;
   - un topic de commande à l'intérieur du préfixe de découverte, ou un topic qu'un autre appareil revendique aussi ;
   - une configuration qui demande des commandes retenues, parce qu'une commande retenue est rejouée à chaque reconnexion de l'appareil ;
   - des modèles que HotLoop ne sait pas évaluer, et des clés de configuration que le format ne définit pas.

   **Accepter** le garde en lecture et rend ses points armables, un par un, dans l'éditeur de tags. Cela n'arme rien. Si l'appareil a suggéré une zone et qu'un nœud de l'arborescence porte exactement ce nom, la boîte de dialogue d'acceptation la préremplit. Un éditeur n'a pas le droit de se ranger lui-même sous Chaufferie ; une personne clique sur accepter. **Ignorer** écarte l'appareil, les tags et les entités (l'historique reste, comme celui de tout appareil) et le garde écarté quand il s'annonce de nouveau. Supprimer un appareil découvert revient à l'ignorer, parce qu'un appareil qui continue de s'annoncer reviendrait tout simplement.

## Quand il change d'avis

**Un autre identifiant est retenu pour examen, quoi qu'il dise.** Sur le broker intégré, un appareil se souvient de l'identifiant avec lequel il a été accepté. Le même appareil annoncé par un autre identifiant est retenu pour examen avec les deux identifiants côte à côte, même quand la configuration est mot pour mot la même, et le journal reçoit un avertissement. Soit quelqu'un a déplacé l'appareil vers un nouvel identifiant, soit un identifiant annonce un appareil qui n'est pas le sien. Appliquer, et le nouvel identifiant est celui d'où il est accepté. Rejeter, et cet identifiant qui annonce la même chose reste rejeté.

**Une configuration qui change sous un appareil accepté est retenue pour examen.** La configuration acceptée continue de tourner. L'écran Découverts montre le changement champ par champ, en cours contre annoncé, et un admin l'applique ou le rejette. Une unité qui passe de °C à °F, ou un topic d'état pointé ailleurs, c'est exactement ainsi qu'un mauvais chiffre acquiert un visage de confiance. Appliquer un changement ne modifie jamais le fait qu'un point soit armé : c'était la décision d'une personne et cela le reste.

Une mise à jour de firmware, un nouveau nom d'appareil, un nouveau modèle ou une autre icône s'appliquent d'eux-mêmes. Personne ne devrait avoir à cliquer pour un changement de version.

Avant que quiconque accepte un appareil, l'annonce la plus récente s'applique toujours : personne n'a encore rien bâti dessus.

**Une configuration vide retire un composant.** Ses points lisent mauvais, en disant « retiré par l'éditeur à 14:02 », et rien n'est supprimé. Une alarme sur ce point garde sa cible et dit pourquoi il est mauvais. Si le même composant revient, il est rétabli, et tant qu'il n'a pas envoyé de nouvelle valeur il lit « annoncé de nouveau après un retrait ; en attente de sa prochaine valeur » plutôt que de faire passer la valeur d'avant son départ. Un appareil que personne n'a accepté et qui retire tous ses composants disparaît, parce que personne n'a rien bâti dessus.

**Zigbee2MQTT qui renomme un appareil** efface ses anciens topics de configuration et en annonce de nouveaux avec les mêmes identifiants uniques. HotLoop identifie les composants par l'identifiant unique, donc c'est un retrait et un rétablissement à une seconde d'écart, et rien n'est perdu.

## Lecture

Un état passe par le modèle de valeur du composant, s'il en a un, puis par la correspondance propre du composant : `payload_on`/`payload_off` pour un capteur binaire (`ON`/`OFF` par défaut), `state_on`/`state_off` pour un interrupteur, un nombre pour un nombre, l'une des options pour un select. **Tout ce qui ne convient pas est une mauvaise lecture avec la raison**, affichée sur la tuile :

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (il a envoyé `None`, `null`, rien, ou `unknown`)
- `no update for 300 s (expire_after)`

Le premier est réel : Zigbee2MQTT 1.41.0 annonce ainsi le capteur de fenêtre d'une Avatto TRV07, et la personne qui l'a capturé a ouvert un ticket parce que la fenêtre ne s'affichait jamais. HotLoop l'affiche mauvais et dit pourquoi au lieu de deviner.

**La disponibilité** est la liaison de l'appareil, pas une lecture. Tant que l'appareil dit qu'il est hors ligne sur son topic de disponibilité, il apparaît déconnecté avec ses propres mots (« the device says it is offline (plug/status = offline) ») et ses entités sont indisponibles. Jusqu'à l'arrivée du premier message de disponibilité, un appareil dont la disponibilité est configurée n'est pas disponible. C'est la règle du format, et c'est la bonne. La session avec le broker n'est pas coupée pour autant : elle est partagée avec tous les autres appareils de ce broker.

`expire_after` rend une valeur mauvaise après autant de secondes sans mise à jour. `off_delay` éteint un capteur binaire après autant de secondes, parce que la configuration dit que l'appareil n'envoie jamais l'extinction. Les attributs JSON arrivent sur l'entité, jusqu'à 64 clés et 8 KiB, sous les propres attributs de HotLoop (`friendly_name`, `source`, `armed` et les autres l'emportent toujours).

Un composant sans topic d'état lit mauvais pour toujours. HotLoop ne suppose jamais un état à partir d'une commande.

## Commandes

Rien n'est commandé tant que trois conditions ne sont pas réunies, dans cet ordre :

1. **Une personne a accepté l'appareil.** Jusque-là l'éditeur de tags n'arme aucun point dessus (« accept the device first »), et la porte d'écriture refuse d'elle-même ses commandes, donc une ligne modifiée à la main ou une vieille sauvegarde avec le point armé n'aboutit à rien non plus.
2. **Une personne a armé le point**, dans l'éditeur de tags, un à la fois. Avant la case, l'éditeur dit où vont les commandes et ce qu'elles envoient : « Commands go to `plug/relay/set`, sending ON or OFF. »
3. **La porte d'écriture laisse passer la commande**, comme toute autre écriture : écritures activées, l'interrupteur MCP pour un agent, la plage du tag, les contrôles propres à l'entité, une session active. Auditée avec son id d'appel, refusée ou non. La simulation pose exactement les mêmes questions.

Ce qui part est ce que dit la configuration : `payload_on` et `payload_off` pour un interrupteur, `payload_press` pour un bouton, l'option pour un select, la valeur pour un nombre ou un texte (un entier comme un entier, `5` et non `5.0`), à travers le modèle de commande de la configuration s'il y en a un. Un bouton s'appuie une fois. Son « relâchement » serait une seconde commande que l'appareil n'a jamais demandée, donc un bouton découvert est à tir unique.

Une lumière reçoit `payload_on`/`payload_off` (une lumière à schéma JSON, `{"state":"ON"}`), et une luminosité en pourcentage mise à l'échelle de son propre `brightness_scale` et arrondie, sur son topic de commande de luminosité (une lumière à schéma JSON, `{"state":"ON", "brightness":128}`). Un volet reçoit `payload_open`, `payload_close` ou `payload_stop`, et une position mise à l'échelle depuis le pourcentage vers ses propres `position_closed`..`position_open` par `set_position_template`. Une vanne reçoit ses charges d'ouverture et de fermeture (une vanne qui signale une position, ses `position_open` et `position_closed`), une position sur son topic de commande, et `payload_stop` une fois : comme un bouton, l'arrêt d'une vanne découverte est à tir unique. Une charge que la configuration désactive avec `null` (un volet sans arrêt) est une commande que la porte refuse en disant pourquoi.

La porte refuse une commande, en disant pourquoi, quand :

- personne n'a accepté l'appareil ;
- le broker sur lequel il se trouve est en écoute seule ;
- l'éditeur a retiré le composant ;
- son modèle de commande sort du sous-ensemble (« command template not supported: filter `regex_replace` is not supported at column 12 »). Ce n'est jamais « envoyer la valeur brute » ;
- sa configuration n'a pas de topic de commande ;
- sa configuration n'a pas de charge pour ce qui a été demandé : un arrêt sur un volet dont la configuration dit `payload_stop: null`, une option qu'un select n'a pas, une luminosité supérieure à 100 %. La charge est produite dans le contrôle, donc la simulation dit non aussi.

**Les commandes retenues suivent la configuration.** Si une configuration demande `retain: true`, HotLoop publie les commandes de ce composant en mode retenu, et le dit partout où une personne décide à son sujet : l'écran Découverts le signale et l'éditeur de tags le dit en termes simples. Comprenez ce que cela signifie avant d'en armer un : le broker garde la dernière commande et la remet à l'appareil à chaque reconnexion, à trois heures du matin, sans qu'aucune main n'ait touché à rien. La commande est quand même passée par la porte et figure toujours dans la piste d'audit avec un nom à côté ; elle se produit simplement de nouveau.

Il n'existe nulle part de « publier ceci sur ce topic » : ni dans les automatisations, ni dans les scripts, ni dans MCP. Ce serait une porte dérobée autour de la porte avec un plus joli nom. Dans le code, deux choses dans la découverte publient : l'écriture du driver, que seule la porte atteint, et la naissance. Un test de garde vérifie les types du paquet du driver et fait échouer la construction si quoi que ce soit d'autre appelle l'une ou l'autre, avec un contournement planté pour prouver qu'il mord.

## Modèles

Pas de Python, pas de moteur Jinja. Pas de boucles, donc un modèle coûte ce que coûte sa longueur.

`{% set name = value %}` est dedans, et seulement cette forme : Zigbee2MQTT écrit le mode de chaque thermostat sous la forme `{% set values = {'manual':'heat', ...} %}` puis le consulte, et un thermostat dont le mode ne peut pas être lu est un thermostat auquel on ne peut pas se fier. Pas d'espace de noms, pas de dépaquetage, pas de forme en bloc. `.keys()` est dedans aussi, seulement comme membre de droite de `in`, parce que c'est le seul endroit où ces modèles l'utilisent.

| <span class="sr-only">Détails</span> | <span class="sr-only">Détails</span> |
|---|---|
| Structure | texte, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, contrôle des espaces par `-` |
| Variables | modèles de valeur : `value`, `value_json` (seulement quand la charge est du JSON), `entity_id`, `name` ; modèles de commande : `value`, `entity_id`, `name` |
| Expressions | littéraux, `.attr`, `['key']`, `[0]`, tranches, `+ - * / // % **`, `~`, comparaisons, `and or not`, `in`, `x if c else y`, `.get(key, default)` sur une table, `in mapping.keys()` |
| Tests | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Filtres | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Fonctions | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Quand le format documente un filtre autrement que le Jinja standard, HotLoop suit le format. Celui qui compte : **`float` et `int` sans valeur par défaut échouent** sur ce qui n'est pas un nombre. Le Jinja standard rend discrètement `0`, et c'est le zéro qui dit que le réservoir est vide alors que le capteur a cessé de répondre.

Les valeurs sont rendues comme le `str()` de Python les rend, parce que c'est contre cela que les configurations de chaque éditeur ont été écrites : `True`, `None`, `21.0` reste `21.0`. Ce n'est pas cosmétique. Le capteur de contact de Zigbee2MQTT annonce `payload_on: false` et correspond au `False` rendu.

**Une clé absente est une erreur sauf si elle a été traitée.** `{{ value_json.temperature }}` sur une charge qui n'en a pas est une mauvaise lecture qui le dit, pas une chaîne vide. `default`, `is defined` et un simple `{% if value_json.x %}` la traitent exprès, et sont corrects.

**Hors du sous-ensemble, refusé à l'arrivée de la configuration**, avec l'endroit : « value template not supported: filter `regex_findall_index` is not supported at column 12 ». Le composant est quand même créé, pour qu'on voie qu'il existe, et il lit mauvais avec cette raison. Il n'y a pas de rendu partiel au mieux ni de « utiliser la charge brute à la place ». Deux vrais modèles sont refusés exprès : `now()` (une valeur qui dépend du moment où HotLoop l'a évaluée n'est pas une lecture de l'appareil), et un modèle d'événement Zigbee2MQTT qui construit des motifs regex avec des espaces de noms et `regex_findall`.

Limites : 4 KiB de modèle, imbrication sur 32 niveaux, 64 KiB de sortie, entiers sur 64 bits (un dépassement est une erreur, pas un bouclage).

Les filtres propres au format, qui ne sont pas du Jinja standard, ont des cas écrits à la main qui citent le comportement documenté auquel chacun nous tient. Chaque modèle des enregistrements doit être analysé.

## Ce que HotLoop construit à partir de quoi

| Composant | Tag | Entités |
|---|---|---|
| `sensor` | `float` quand il a une unité, une classe d'état ou une classe d'appareil numérique, sinon `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor, et une entité de commande switch, non armée |
| `number` | `float`, avec le `min`/`max` de la configuration comme plage du tag | sensor, et une entité de commande number, non armée, avec min, max et pas |
| `text` | `string` | sensor, et une entité de commande text, non armée |
| `select` | `string`, ne lisant qu'une de ses options | sensor, et un select avec les options de la configuration, non armé |
| `button` | `string`, acceptant une pression et ne lisant rien | un bouton à tir unique, non armé (l'entité de lecture du tag lui-même est créée masquée) |
| `light` | `bool` allumé/éteint ; `float` luminosité de 0 à 100 % quand elle en a une | une lumière, non armée |
| `cover` | `string` d'état, qui accepte aussi `open`, `close` et `stop` ; `float` de position de 0 à 100 % quand il en a une | un volet, non armé |
| `valve` | `string` d'état ; `float` de position de 0 à 100 % s'il en signale une ; `bool` de commande (ouvrir ou fermer) et `bool` d'arrêt, commandés et jamais lus | une vanne, non armée, son arrêt à tir unique |
| `event` | `string`, le type d'événement | un événement |
| `device_automation` (un déclencheur) | `string`, `<type>_<subtype>` quand sa charge arrive | un événement, un par déclencheur |
| `lock` | `string`, lu avec ses propres mots et acceptant `lock`, `unlock`, `open` | une serrure, non armée |
| `fan` | `bool` allumé/éteint ; `float` vitesse de 0 à 100 % ; `string` préréglage et direction ; `bool` oscillation, chacun quand il en a un | un ventilateur, non armé |
| `siren` | `bool` | une sirène, non armée |
| `scene` | `bool`, une pression | un bouton à tir unique, non armé |
| `notify` | `string`, un message, commandé et jamais lu | un notificateur, non armé |
| `update` | `string` des versions installée et la plus récente | une mise à jour : active quand elles diffèrent. Sa commande d'installation n'est jamais envoyée |
| `device_tracker` | `string`, `home`, `not_home` ou une zone | un traceur |
| `tag` | `string`, l'id du tag quand on en scanne un | un événement |
| `climate` | `string` de mode ; `float` de consigne, consignes basse et haute et consigne d'humidité, chacune avec le `min_temp`/`max_temp` de la configuration (ou `min_humidity`/`max_humidity`) comme plage ; `float` de température et d'humidité de la pièce ; `string` de modes de ventilateur, d'oscillation et de préréglage et d'action ; `bool` d'alimentation, commandé et jamais lu ; chacun quand il en a un | un thermostat, non armé |
| `humidifier` | `bool` allumé/éteint ; `float` de consigne d'humidité dans sa plage ; `string` de mode et d'action ; `float` d'humidité de la pièce | un humidificateur, non armé |
| `water_heater` | `string` de mode ; `float` de consigne dans sa plage et de température actuelle ; `bool` d'alimentation, commandé et jamais lu | un chauffe-eau, non armé |
| `alarm_control_panel` | `string` d'état, lu avec les mots du format et acceptant les actions que liste son `supported_features`, chacune avec sa propre charge | un panneau d'alarme, non armé |
| `vacuum` | `string` d'état, acceptant les actions que liste son `supported_features` ; `float` de batterie ; `string` de vitesse du ventilateur, chacun tiré de son état JSON | un aspirateur, non armé |
| `lawn_mower` | `string` d'activité ; `bool` de démarrage de la tonte, de pause et de retour à la base, chacun une pression sur son propre topic, commandé et jamais lu | une tondeuse, non armée |
| `camera` | `string`, un hachage court de la dernière image ; l'image elle-même est conservée en mémoire | une caméra |
| `image` | pareil, pour une image sur `image_topic` ; ou `string`, l'URL de `url_topic` | une image |

Pour une lumière, un volet, une vanne, un événement, un déclencheur et chaque composant des lignes qui suivent, les entités de lecture propres aux tags sont créées masquées : la chose est une seule entité sur les écrans. Chaque tag reste armé séparément, donc un volet dont vous faites confiance à la position mais pas à l'ouverture ni à la fermeture peut être exactement cela. Une chose qui gagne une valeur après son acceptation (un firmware qui se met à signaler une luminosité) est un changement à examiner, et quand une personne l'applique, l'entité reçoit le rôle en même temps que le tag.

Les messages d'état d'une lumière à schéma JSON sont fusionnés, parce que le schéma envoie ce qui a changé : un message ne contenant qu'une luminosité, ou le `last_seen` de Zigbee2MQTT seul, laisse la lumière allumée. Sa couleur, sa température de couleur et son effet sont affichés comme attributs, non commandés ; l'allumage, l'extinction et la luminosité le sont, et l'écran Découverts le dit pour une lumière qui a de la couleur. Les topics de couleur d'une lumière à schéma par défaut sont dans le même cas : non lus, non commandés, et listés. Le schéma à modèle n'est pas pris en charge et le dit. L'inclinaison d'un volet n'est ni lue ni commandée, et le dit.

Un déclencheur d'appareil ne se déclenche que sur son propre `payload` : Zigbee2MQTT met chaque action d'un bouton sur un seul topic, et chaque déclencheur en est une. Un déclencheur sans `payload` se déclenche sur n'importe quoi sur son topic.

La vitesse d'un ventilateur se lit sur le `speed_range_min`..`speed_range_max` propre à la configuration comme le fait le format : le premier cran au-dessus de l'arrêt est le premier pour cent. Un niveau que la configuration dit impossible (un ventilateur ESPHome qui annonce quatre crans et signale 25) est une mauvaise lecture qui le dit, pas 625 pour cent.

L'écran Découverts liste chaque topic vers lequel les commandes d'un composant peuvent aller : le topic de luminosité d'une lumière, le topic de vitesse d'un ventilateur, en plus du principal, et signale chacun qui est hors de ce que le composant lit, à l'intérieur du préfixe, ou revendiqué par un autre appareil.

La plage de consigne d'un thermostat ou d'un chauffe-eau est celle de la configuration, et la valeur par défaut du format quand elle n'en donne pas (de 7 à 35 °C pour un thermostat, de 43,3 à 60 °C pour un chauffe-eau, en °F quand la configuration dit `temperature_unit: F`). C'est la plage du tag, donc la porte refuse 31 °C à une vanne de radiateur qui plafonne à 30 avant que quoi que ce soit soit envoyé. Ses modes sont la liste de la configuration, et un mode qu'elle ne liste pas est refusé de la même façon. Les écrans proposent exactement ceux-là, et quand un changement appliqué apporte un nouveau mode, les écrans l'obtiennent aussi.

Le `code` d'un panneau d'alarme est ce que l'écran d'un consommateur demande avant d'envoyer quoi que ce soit. Dans HotLoop, qui peut armer ou désarmer relève de la porte, avec le tag armé par une personne et chaque commande auditée, donc l'action part comme le dit la configuration. Un panneau dont le modèle de commande veut le code lui-même (`{{ code }}`) ne peut pas être commandé : HotLoop n'a pas de code à y mettre, et l'écran Découverts le dit. Le `send_command_topic` d'un aspirateur n'est pas utilisé : une commande arbitraire est exactement ce que HotLoop ne peut pas vérifier par rapport à la configuration.

L'image d'une caméra ou d'un image est conservée en mémoire, la dernière de chaque composant, jusqu'à 4 MiB, et servie par `GET /api/entities/{entity_id}/image`. HotLoop ne la garde que si les octets sont un JPEG, PNG, GIF ou WebP, quoi que prétende le `content_type` de la configuration : un SVG est un document qui exécute du script, et une « image » qui exécute du script chez quiconque ouvre le tableau de bord est une faille. Son tag contient un hachage court, donc l'historique dit quand l'image a changé sans une base de données pleine de JPEG. Une image annoncée par URL est un lien : HotLoop l'affiche, seulement si elle est en http ou https, et ne la télécharge jamais, parce qu'un serveur qui télécharge toute adresse qu'un appareil nomme peut être pointé vers n'importe quoi sur le réseau. Aucune n'est consignée dans le journal de bord ; une caméra change chaque seconde et tag_history a déjà chaque changement.

Chaque composant que définit le format devient quelque chose. Un composant qu'il ne définit pas (un `kettle`) est stocké avec ce qu'il a annoncé et listé comme ne créant rien. Le format n'a pas de composant date, heure ou datetime, donc cette liste non plus.

Les ID d'entité sont ceux de HotLoop, faits à partir de l'appareil et du tag. L'`object_id` et le `default_entity_id` d'une configuration sont ignorés : une configuration ne choisit pas un nom dans l'espace de noms de HotLoop, et une configuration hostile choisirait `switch.boiler_main`.

## Rien n'est digne de confiance

Tout ce que dit une configuration vient de qui peut publier sur le préfixe. Donc :

- les noms et textes sont plafonnés et dépouillés des caractères de contrôle, et l'écran les met dans la page comme du texte, jamais du HTML ;
- un topic avec un joker, un topic `$`, ou un `~` sans base où le mettre est refusé avec la raison ;
- une configuration de plus de 64 KiB est refusée ; un appareil ne peut pas avoir plus de 512 composants ; pas plus de 256 appareils ne peuvent attendre une décision sur un broker ; les messages de configuration au-delà de 200 par seconde sont abandonnés et comptés. Chaque refus est compté et affiché sur l'écran Découverts, jamais abandonné sans un mot ;
- HotLoop s'abonne à `<prefix>/+/+/config` et `<prefix>/+/+/+/config`, jamais à `#` sous le préfixe, donc un topic profond égaré ne peut pas lui faire analyser quoi que ce soit ;
- une charge d'état de plus de 256 KiB, ou qui n'est pas en UTF-8, est une mauvaise lecture.

Avec les connexions anonymes autorisées sur le broker intégré, n'importe qui sur le réseau peut annoncer des appareils et publier sur n'importe quel topic de commande, et l'écran Découverts le dit en rouge. Donnez à chaque appareil son propre identifiant créé dans HotLoop, à partir de son profil, nommé d'après son topic ([Le broker MQTT intégré](/fr/iot/broker/)) : il peut alors s'annoncer et rien d'autre, et il ne peut pas toucher au topic de commande d'un autre appareil.

## Côté broker

La découverte s'exécute sur le broker intégré (voir [le broker MQTT intégré](/fr/iot/broker/)), activée par défaut dès que le broker l'est. Le client propre à HotLoop se connecte avec un identifiant créé à chaque démarrage et conservé seulement en mémoire : il n'y a rien à configurer et rien dans une sauvegarde qui puisse fuiter. Il publie une seule chose qui lui est propre, la naissance (`<prefix>/status` = `online`), qui fait s'annoncer de nouveau les éditeurs qui l'écoutent.

| Variable | Par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Écouter les annonces sur le broker intégré |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Le préfixe de topic sous lequel elles arrivent |

Un client par broker, `hotloop-disc-embedded`, partagé par l'écouteur et le driver de chaque appareil découvert. Un assistant `--mcp-stdio` n'en ouvre aucun : un second client avec le même id éjecterait celui du Gateway du broker toutes les quelques secondes. Avec plusieurs réplicas sur une même base de données, seul celui qui détient le verrou de découverte écoute.

## Autres brokers

Beaucoup d'usines font déjà tourner un broker : un Mosquitto qui sert d'UNS, celui qu'une boîte Zigbee2MQTT a apporté avec elle. HotLoop les écoute aussi. Paramètres, MQTT, ajouter un broker : un id (qui nomme le broker dans chaque appareil qui en vient), où il se trouve, un identifiant, et le préfixe sous lequel ses éditeurs s'annoncent. Le broker n'a pas besoin d'être activé, et HotLoop n'a pas besoin du broker intégré pour cela.

Trois choses diffèrent du broker propre à HotLoop, exprès :

- **Les appareils attendent dans la boîte de réception.** Sur un broker d'usine très actif, « apparaître d'eux-mêmes » veut dire trois cents appareils à l'écran avant midi. Un appareil annoncé est donc listé sur l'écran Découverts, sans rien créer et sans rien lire, jusqu'à ce que quelqu'un l'accepte. Alors il est créé, il lit, et ses points peuvent être armés comme n'importe quel autre. Un broker auquel vous faites assez confiance pour tout y déverser peut être basculé sur « les appareils apparaissent d'eux-mêmes ».
- **Pas de dernière volonté.** HotLoop se connecte sans. Une volonté `offline` sur un broker partagé dirait à tous les autres éditeurs que quelque chose a disparu, alors que ce n'était que HotLoop. Les tests vérifient le paquet CONNECT lui-même, et coupent la connexion pour prouver que rien n'est dit.
- **Ses ACL lui sont propres.** HotLoop ne peut pas voir qui a publié quoi sur le broker de quelqu'un d'autre, donc il n'y a pas de « annoncé par identifiant » là, et ce que chaque identifiant peut toucher relève de ce broker. Donnez à HotLoop un identifiant qui lit le préfixe et les topics des appareils que vous acceptez, et qui écrit la naissance et les topics de commande, rien d'autre. Pour Mosquitto :

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**L'écoute seule** est pour un broker sur lequel HotLoop ne doit pas parler : l'UNS de production, l'usine de quelqu'un d'autre. HotLoop n'y publie jamais rien. Pas de naissance, pas de commande. C'est la règle de la session, pas celle de l'écran : sa publication refuse, et la porte d'écriture refuse chaque commande vers ses appareils avec « the broker plant-uns is listen-only », simulation comprise, même sur un appareil que quelqu'un a accepté et un point que quelqu'un a armé. Son identifiant n'a besoin que de lignes `topic read`.

Le mot de passe est scellé avec la clé des identifiants d'appareil (`HOTLOOP_SECRET_KEY_FILE`), comme celui d'une console UniFi, et ne ressort jamais de l'API. Sans clé, un broker avec mot de passe est refusé, pas stocké en clair. Une sauvegarde le contient scellé et se restaure selon la même règle que les identifiants d'un appareil ([Sauvegardes et restauration](/fr/iot/backup/)). Un broker dont le mot de passe ne peut pas être ouvert est listé, pas connecté, et dit pourquoi.

Modifiez un broker et l'écouteur et chaque appareil qui en vient se reconnectent avec les nouveaux paramètres. Désactivez-en un et ses appareils restent, lisant mauvais et disant que leur broker ne tourne pas ici. En supprimer un emporte la boîte de réception, et c'est refusé, en les nommant, tant que des appareils que quelqu'un a acceptés depuis lui existent.

## Sur un Edge Relay

Un Edge Relay découvre aussi, avec le même code, mais il n'a pas de base de données où garder une décision ni d'écran où la prendre. Il prend donc ce qu'il entend, le lit et le transmet par Sparkplug, et rien de ce qu'il trouve ne peut être armé : ses tags sont en lecture seule comme chaque tag découvert, ses appareils ne sont jamais acceptés, et le relais n'a aucun chemin d'écriture. Nommez les brokers dans son fichier d'appareils ; voir la [référence de l'Edge Relay](/fr/edge-relay/reference/#discovery-41810). Un appareil que vous pouvez commander y arrive par l'autre côté : accepté et armé sur un Gateway, dans un fichier qu'il pousse. Il oublie ce qu'il a entendu quand il s'arrête, et l'entend de nouveau depuis le broker.

## Redémarrages et rejeux

Les appareils acceptés tournent à partir de leurs lignes d'appareil. HotLoop n'a pas besoin d'un seul message retenu pour redémarrer avec son usine.

Le broker intégré ne conserve rien d'un redémarrage à l'autre, donc chaque configuration « manque » ensuite. **Une configuration manquante n'est pas un retrait** : seule une configuration vide explicite l'est. Autre chose retirerait toute l'usine à chaque redémarrage de la machine. Jusqu'à ce qu'un appareil envoie son prochain état, ses entités lisent inconnu, jamais la valeur d'avant le redémarrage déguisée en valeur actuelle.

Un broker qui rejoue des centaines de configurations retenues d'un coup est un seul lot : deux secondes de calme, un passage, un rechargement. Un rejeu de ce qui est déjà enregistré ne change rien et ne recharge rien.

## Sauvegardes

`mqtt_devices` (qui a accepté et ignoré quoi), `mqtt_configs` (chaque configuration telle qu'elle est arrivée, octet pour octet) et `mqtt_discovered` (chaque composant, normalisé) sont dans chaque sauvegarde. Les décisions sont la part qu'aucun appareil ne peut annoncer en retour.

## L'API

Sous `/api/discovery`. Voir [l'API HTTP](/fr/iot/api/#découverte-mqtt).

## Trouvé sur le réseau

Le même écran liste les appareils que HotLoop a entendus sur le réseau de l'usine par mDNS, SSDP et DHCP, décidés de la même façon. Voir [Découverte réseau](/fr/iot/network-discovery/).
