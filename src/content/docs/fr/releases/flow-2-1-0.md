---
title: "Notes de version : HotLoop Flow 2.1.0"
description: "Ce que apporte HotLoop Flow 2.1.0, ce qui change à la mise à jour et ce qu'il faut lire avant de toucher à une usine en marche."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 reprend les phases 0 à 2 de la [feuille de route](/fr/flow/roadmap/) et comble les manques du quotidien qui empêchaient de mettre un vrai flux en production. Chaque déploiement devient un enregistrement que vous pouvez comparer, tester, relire et restaurer. Un flux peut avoir des tests qui s'exécutent avant qu'un mauvais déploiement n'arrive. Un enregistrement redémarre les nœuds modifiés et laisse le reste de l'usine tranquille.

Rien dans cette version ne change la façon dont un fichier de flux est lu ou écrit. L'aller-retour octet pour octet reste intact : un `flows.json` qui tournait en 2.0.5 tourne en 2.1.0.

## Nouveautés

**Déploiements**
- Chaque déploiement est un enregistrement : qui, d'où, quand, la note, la révision remplacée, le fichier de flux octet pour octet et les identifiants chiffrés tels qu'ils étaient. `GET /deployments` les lit. `history.retain` garde les 100 derniers par défaut.
- Une comparaison qui se lit comme une relecture : nœud par nœud, propriété par propriété, la mise en page séparée de la logique, les identifiants jamais affichés. Dans l'API, en ligne de commande (`hotloop-flow diff`) et comme pilote de diff de git lui-même.
- La restauration remet un ancien enregistrement comme un nouveau déploiement, flux et identifiants ensemble : un nœud supprimé revient donc avec le mot de passe de son broker.
- Déploiement partiel : un enregistrement redémarre les nœuds qui ont changé. Les sessions MQTT, les écouteurs et les files Delay de tout le reste continuent de tourner. `HotLoop-Flow-Deployment-Type` (ou l'en-tête de Node-RED) choisit nœuds, flux ou complet.
- L'éditeur relit avant de déployer, avec la comparaison dessinée sur le canevas et une note, et affiche l'historique avec un bouton de restauration.
- Les flux comme du code : `hotloop-flow deploy` affiche la différence avec ce qui tourne et déploie sur la révision dont il est parti, si bien qu'une course donne un pipeline rouge. `hotloop-flow export` rend le fichier en production octet pour octet. `hotloop-flow token` crée un jeton d'API et le hachage à configurer pour lui.
- Miroir git facultatif : avec `history.git` renseigné, chaque déploiement est un commit signé par la personne qui a déployé.

**Tests**
- Tests de flux : `flows.test.yaml` à côté de `flows.json`, lancé par `hotloop-flow test` (JUnit avec `-junit`) sur le vrai runtime et les vrais nœuds. Delay, Trigger, Inject, Join et Batch tournent sur une horloge que le test fait avancer : cinq minutes de Delay tiennent en une étape. Tout ce qui parle au monde extérieur, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, fichiers, exec, est simulé, et le test vérifie ce qui serait sorti.
- La barrière de déploiement : activez `tests.gate` et un déploiement dont les flux échouent à la suite de tests renvoie un 422 avec le rapport complet. Les restaurations ne passent pas par la barrière, car une restauration est la voie de sortie.
- L'éditeur transforme un message de débogage en test et le lance.

**Nœuds et protocoles**
- JSONata, validé sur la suite publiée de jsonata-js 2.2.2 : 1673 cas sur 1686 passent, et les 13 qui ne passent pas sont listés par nom avec leur raison.
- Inject se déclenche sur un crontab, à la même minute que Node-RED, avec les changements d'heure de six fuseaux vérifiés.
- MQTT 5 (propriétés, options d'abonnement, expiration de session) et le testament. MQTT 3.1.1 fonctionne toujours.
- TLS sur TCP, sur la requête HTTP et sur MQTT via un nœud `tls-config`. L'écouteur et le client WebSocket démarrent, et le client fait du TLS.
- Cookies et multipart en HTTP, vérifiés avec les bibliothèques que Node-RED utilise.
- Split, Join et Batch fonctionnent comme ceux de Node-RED : flux continu, délais d'attente, réduction, intervalles. Link Call et le mode retour de Link Out.
- Un mot de passe peut vivre dans un Secret monté plutôt que dans le flux. Le chart Helm gagne `secrets.mounts`.

**Connexion**
- Connexion en deux étapes (TOTP), gratuite, pour toute personne qui l'active depuis l'éditeur.
- Verrouillages, sessions qui survivent à un redémarrage et journal d'audit de qui a fait quoi et d'où (`GET /audit`, `audit.read`).

## Ce qui a changé

- Le verrouillage est activé par défaut : 5 échecs sur un compte depuis une adresse, ou 20 depuis une adresse, le verrouille 15 minutes avec un 429. `auth.lockout` change les chiffres.
- Les sessions sont conservées dans `data/sessions.json` sous forme de hachages et suivent la configuration à chaque requête : retirer une permission ou un utilisateur de la configuration prend effet à la requête suivante.
- Une restauration est un redémarrage complet, sauf si vous en demandez moins.
- L'image embarque `LICENSE`, `NOTICE` et `THIRD_PARTY_LICENSES` dans `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` liste chaque module Go et paquet npm du binaire avec sa version et le texte de sa licence, généré à la compilation. La compilation échoue sur une dépendance GPL, AGPL ou LGPL, ou sur une dépendance que personne ne peut identifier.
- `NOTICE` était faux. Il disait qu'aucun code de Node-RED n'était ici. Cron, Split, Join, Batch, Link Call, tls-config et le travail sur les cookies et le multipart HTTP sont des portages, et il liste maintenant chaque fichier porté avec son origine, le titulaire du copyright et la licence, avec le texte ISC complet pour cronosjs et le texte MIT pour le reste. Chaque fichier porté le dit de la même façon en en-tête.
- Un déploiement refusé n'élague plus les identifiants en mémoire, et un double-clic sur un nœud dans Chromium ouvre sa boîte de dialogue. Les deux ont été trouvés pendant ce travail.

## Notes de mise à jour

Depuis la 2.0.5, il suffit de changer l'image (`helm upgrade`, ou le nouveau tag dans votre unité Quadlet). Pas de migration, pas d'option.

- Le premier démarrage crée `sessions.json`, `audit.log` et un répertoire `deployments` sous `data.dir`. Les sessions étaient auparavant en mémoire : tout le monde se reconnecte une fois après la mise à jour.
- Tout ce qui est nouveau dans la configuration est facultatif et désactivé ou inoffensif par défaut. Rien de ce que vous avez ne cesse de fonctionner.
- Jetons WebSocket : l'éditeur envoie désormais son jeton comme sous-protocole, `hotloop-flow.bearer.<token>`, proposé à côté de `hotloop-flow`. C'est la méthode à privilégier pour tout ce qui se connecte à `/comms`. Un script qui envoie `?access_token=` dans l'URL fonctionne toujours, et le serveur consigne un avertissement pour chaque connexion de ce type, en expliquant que le jeton fuit dans les journaux de proxy et d'accès et ce qu'il faut envoyer à la place. L'URL elle-même n'est jamais écrite dans le journal de Flow ni dans la piste d'audit. La suppression de la forme par URL attend une future version majeure.

## Nouveaux réglages

| YAML | Environnement | Par défaut |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` refuse un déploiement dont les flux échouent à `flows.test.yaml`. |
| `tests.timeout` | | `2m`, la durée réelle maximale d'une exécution des tests. Une exécution qui ne peut pas finir refuse le déploiement. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | vide. Arborescences supplémentaires où un `tls-config` ou un fichier d'identifiants peut être lu, en plus de `data.dir`. Ce n'est pas le périmètre des nœuds de fichier : un nœud File In ne peut toujours pas les lire. |
| `secrets.mounts` (chart) | | vide. Secrets Kubernetes montés en lecture seule, chacun ajouté au périmètre des secrets. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | aucun. Jetons d'API pour les machines, conservés sous forme de hachages. La variable d'environnement crée un jeton `deploy` qui peut lire et déployer, et rien de plus. Créez-en un avec `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` garde tous les enregistrements. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | désactivé. |
| `audit.maxBytes`, `audit.keep` | | 16 Mio, 4 fichiers. |

Image : `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 et linux/arm64. Chart : `https://hotloop.io/hotloop-flow/`. Le README de ce tag contient le reste : https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
