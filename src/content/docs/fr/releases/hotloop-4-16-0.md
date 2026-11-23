---
title: "Notes de version: HotLoop core 4.16.0"
description: "Ce qu'apporte HotLoop core 4.16.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher une usine en production."
sidebar:
  label: "4.16.0"
---

La première version publiée depuis la 4.3.1 d'août. Tout ce qui va de la 4.4.0 à la 4.15.3 a été fusionné sans jamais être publié : si vous êtes en 4.3.1, vous recevez tout d'un coup, sous un nouveau nom, avec une nouvelle image, un nouveau chart et une nouvelle licence. **Depuis la 4.3.1, ce n'est pas un simple `helm upgrade`.** Lisez « Mise à jour depuis la 4.3.1 » plus bas avant de toucher une usine en production.

Les notes complètes sont dans le README : Ce qui change dans la 4.16.0, puis chaque version jusqu'à la 4.4.0.

## En bref

- **HotLoop Core : les entités.** Chaque tag est une entité avec un identifiant stable, placée dans une arborescence d'équipements ISA-95. Les moteurs, les vannes, les boucles PID et le reste sont des composites construits à partir de leurs tags, chaque alarme est une entité, et toute commande d'entité passe par la même porte d'écriture qu'une écriture de tag. Les agents (MCP), les automatisations et les nouveaux écrans Entities et Plant s'en servent tous. On peut interroger un appel de service au préalable avec `?dry_run=true`, et l'invite de commande vous dit « Would be refused: ... » avant que vous confirmiez.
- **Des notifications qui arrivent sur un téléphone :** ntfy et le bot Discord avec un bouton Acknowledge, Gotify et un webhook Discord, avec des limites de débit qui regroupent un déluge en un seul résumé.
- **Des correctifs qui comptent sur une usine en production :** la levée d'un report (unshelve) pouvait effacer une alarme non acquittée ; un abonnement OPC UA pouvait se taire pour toujours alors que la session indiquait connecté ; un équipement Modbus silencieux mettait jusqu'à 15 minutes à passer hors ligne ; un webhook en échec journalisait son URL, qui est le mot de passe pour Discord et ntfy ; la restauration chargeait les colonnes par position ; chaque redéploiement remplaçait le certificat du serveur OPC UA, si bien qu'Ignition cessait de lui faire confiance ; Discover tags importait chaque nœud OPC UA en float ; l'écran Settings nommait des variables d'interrogation que rien ne lit.
- **Ignition 8.3.9 lit notre serveur OPC UA**, vérifié de bout en bout, et le serveur indique désormais `HotLoop` comme fabricant.
- **L'Edge Relay arrive** avec sa propre image et son propre chart, en phase avec le Gateway. TimescaleDB 2.30.1, et l'extension se met à jour toute seule.

### Changements de l'API

- Les listes vides sont `[]`, jamais `null`, partout, flux compris.
- Les intervalles de `/api/history` sans bonne mesure valent `null` (un trou), et les mauvaises mesures restent hors des moyennes.
- Une erreur que l'API ne sait pas classer est une 500 avec une référence de journal, pas une 400. Un équipement qui échoue à une écriture ou à une exploration donne une 502.
- Un service qu'une entité d'alarme n'accepte pas (`alarm.turn_on`) donne une 400. Avant, il répondait que tout allait bien et ne faisait rien.
- Lever le report d'une alarme qui n'est pas reportée donne une 409.
- Le JSON d'un tag contient toujours `minValue`, `maxValue` et `hasRange`.
- Nouveau : `?dry_run=true` sur `POST /api/services/{domain}/{service}`. Uniquement `true` ou `false` ; toute autre valeur donne une 400.

### Mise à jour depuis la 4.3.1

- Image `ghcr.io/hotloop-io/hotloop` (avant `ghcr.io/embernet-ai/industrial-iot`), dépôt de charts `https://hotloop.io/hotloop`, chart `hotloop` (avant `industrial-iot`), et chaque variable `IIOT_` devient `HOTLOOP_`.
- Le nom du chart figure dans les sélecteurs des charges de travail, que Kubernetes ne modifie pas sur place. Gardez le nom de la release et le namespace, puis : faites un `pg_dump` de la base ; supprimez l'ancien Deployment (`<release>`) et le StatefulSet (`<release>-postgresql`), ce qui laisse le volume de la base là où il est ; lancez `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. Pas avec `--reuse-values`. Renommez tout `IIOT_` dans `extraEnv` et retirez une surcharge de `image.repository`. Le nouveau pod de base monte l'ancien volume et le Gateway le migre au démarrage.
- Licence : les conditions propres à HotLoop, et non celles livrées avec la 4.3.1. Gratuit pour un usage domestique et de laboratoire ; les entreprises s'inscrivent gratuitement via EmberNet. Les conditions actuelles sont dans LICENSE.
- Il y a une connexion, les écritures sont désactivées par défaut, et un fuseau horaire impossible à charger arrête le démarrage au lieu de continuer en UTC.
