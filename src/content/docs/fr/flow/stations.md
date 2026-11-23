---
title: "Envoi vers les stations d'un tenant"
description: "Un fichier de flux et ses diagrammes FlowLab sur chaque installation Flow d'un tenant, une à une, vérifiée à chaque fois, avec retour arrière en cas d'échec."
---

Un tenant EmberNet peut exécuter plusieurs installations de HotLoop Flow, une par usine ou par ligne. Nous appelons chacune une station. Cette page explique comment placer un fichier de flux, donc un ensemble de diagrammes FlowLab, sur toutes, vérifier chacune et remettre une station en l'état si elle échoue.

La version courte : `hotloop-flow stations push -tenant acme -file flows.json` envoie vers les stations qu'EmberNet affiche comme en cours d'exécution pour `acme`, une à une. Si une station n'est pas correcte ensuite, cette station revient à ce qu'elle avait et l'envoi s'arrête. Si le fichier redémarrait un enregistreur en marche, rien ne se passe tant que vous n'avez pas dit que c'est permis.

## D'où viennent les stations

Personne ne saisit une station à la main. La liste est ce que le tableau de bord EmberNet affiche comme en cours d'exécution pour le tenant, la même liste que sa page Running Apps : chaque application portant l'étiquette `hotloop-flow` qui est en cours d'exécution et appartient au tenant. On joint une station à son adresse Flux lorsque le tableau de bord en indique une, et à son adresse de cluster sinon : lancez donc l'envoi depuis un endroit où cette adresse se résout.

Le tenant est toujours nommé, et un envoi ne concerne jamais que ce tenant. Le tableau de bord est interrogé avec votre jeton de tableau de bord, qui vous limite aux tenants que vous pouvez voir, et nous revérifions la réponse : une ligne qui arrive pour un autre tenant est écartée et comptée, jamais utilisée. Un tenant sans Flow en cours d'exécution répond par une erreur.

## La commande

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

L'adresse du tableau de bord vient de `-dashboard` ou de `HOTLOOP_FLOW_DASHBOARD_URL`, et son jeton de `-dashboard-token-file` ou de `HOTLOOP_FLOW_DASHBOARD_TOKEN`. Le jeton qu'acceptent les stations vient de `-token-file` ou de `HOTLOOP_FLOW_TOKEN`, comme pour `hotloop-flow deploy`. Créez-le avec `hotloop-flow token`, et donnez à chaque station ce jeton comme jeton d'API avec `flows.read`, `flows.write` et `status.read` (un simple jeton de déploiement n'a que les deux premiers) : la vérification doit lire les diagrammes de chaque station, ce qu'un simple jeton de déploiement ne peut pas faire. Les stations d'un même tenant acceptent le même jeton.

| Option | Ce qu'elle fait |
|---|---|
| `-dry-run` | Planifie chaque station sans en modifier aucune. Montre ce qui est en production, ce que chacune redémarrerait et celles qui n'ont pas pu être planifiées. |
| `-confirm-restart` | Vous acceptez que cet envoi redémarre des enregistreurs en marche. |
| `-window 02:00-04:00` | Les heures où un redémarrage est accepté d'avance, dans `-window-zone` (un nom IANA, UTC si omis). Un envoi dans la fenêtre se poursuit. Elle peut passer minuit, `22:00-02:00`. |
| `-settle 5s` | Le temps dont disposent les diagrammes d'une station pour démarrer avant que la vérification les déclare à l'arrêt. |
| `-json` | Le rapport en JSON. |

Le code de sortie 0 signifie que toutes les stations sont faites. 3 signifie qu'une station a échoué et que l'envoi s'est arrêté. 4 signifie que l'envoi attend que vous acceptiez les redémarrages. 5 signifie que des stations ont été ignorées parce qu'elles n'ont pas répondu ou n'ont pas pu être planifiées.

## Ce que fait un envoi

Il planifie d'abord chaque station sans en modifier aucune. Pour chacune, il lit le fichier de flux et la révision en production, trouve l'enregistrement de déploiement auquel elle pourrait revenir, liste ses diagrammes et détermine quels enregistreurs en marche le fichier redémarrerait. Puis, si rien n'exige un oui, il avance station par station, par ordre de nom.

1. **Déploie** le fichier avec la révision vue par le plan, de sorte qu'un déploiement fait entre-temps par quelqu'un d'autre soit refusé au lieu d'être écrasé. Seul ce qui a changé redémarre. Les identifiants ne voyagent jamais : chaque station garde ses propres mots de passe, et les écritures d'un instrument restent désactivées tant que quelqu'un sur cette station ne les active pas.
2. **Vérifie.** La station doit répondre avec la révision que toutes les stations doivent avoir. La révision vient du contenu du fichier, si bien que le même fichier donne la même révision partout, et l'envoi indique laquelle avant de commencer. Chaque diagramme du fichier qui démarre seul doit être sur la station, sans problème, et en cours d'exécution ou terminé dans le délai de stabilisation. Un nœud qui n'a pas démarré fait aussi échouer la vérification.
3. **Une station qui échoue à la vérification revient en arrière.** Elle est ramenée au déploiement sur lequel elle était, sous la forme d'un déploiement à part entière, et on vérifie qu'elle est revenue à son ancienne révision. L'envoi s'arrête là.

Le rapport indique ce qui est arrivé à chaque station :

| État | Signification |
|---|---|
| `done` | Déployée et ayant passé la vérification. |
| `unchanged` | Déjà sur cette révision, et ses diagrammes sont comme il faut. |
| `failed` | Non déployée (la station l'a refusé, ou quelqu'un a déployé entre-temps), ou déjà sur cette révision et pas correcte. Rien n'a été modifié. |
| `reverted` | A échoué à la vérification et est revenue sur la révision qu'elle avait. |
| `revert-failed` | A échoué à la vérification et n'a pas pu être remise en l'état. Celle-ci demande une intervention humaine. |
| `skipped` | Non touchée. Elle n'a pas répondu, ou elle n'a pas d'enregistrement de déploiement de sa révision en production, si bien qu'un envoi raté n'aurait pas pu y être annulé. Déployez-y une fois à la main, ou réparez la liaison, puis renvoyez. |
| `not-started` | L'envoi s'est arrêté avant cette station. Elle est comme avant. |
| `planned` | La réponse d'une simulation. |

Les stations ignorées n'arrêtent pas l'envoi. Un envoi est répétable : une station déjà sur la révision est `unchanged`, donc un second envoi ne termine que ce que le premier n'a pas fait.

## Redémarrages

Un diagramme qui démarre seul est un enregistreur. Déployer un diagramme modifié le redémarre, et un diagramme retiré s'arrête. Un envoi qui ferait cela à un enregistreur en marche s'arrête avant de toucher quoi que ce soit, et le rapport nomme chaque station et chaque enregistreur. Ensuite, l'une de ces trois choses le laisse continuer :

- vous répondez oui à l'invite, quand la commande est lancée dans un terminal ;
- vous passez `-confirm-restart` ;
- l'heure se situe dans la fenêtre que vous avez donnée avec `-window`.

Rien ne redémarre sans l'une d'elles. Un diagramme qui n'a pas changé conserve son exécution, et un nouveau démarre simplement.

## Depuis une instance, et pour un agent

Une instance peut envoyer vers les stations de son propre tenant par son API d'administration, ce qu'utilisent les outils MCP `list_stations` et `push_to_stations`. Définissez les quatre réglages suivants, dans le fichier de configuration sous `stations:` ou par l'environnement, et les routes `GET /stations` et `POST /stations/push` apparaissent. Sans eux, elles n'existent pas.

| Réglage | Environnement | De quoi il s'agit |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | Le tableau de bord EmberNet qui connaît les installations du tenant. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | Le seul tenant pour lequel cette instance envoie. Une requête ne peut pas en nommer un autre. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | Un fichier contenant le jeton du tableau de bord. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | Un fichier contenant le jeton de déploiement qu'acceptent les stations. |

Dans le chart, ce sont `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` et `stations.deployTokenSecret`, chaque Secret contenant un seul jeton et monté comme fichier ; avec Podman et Quadlet, ce sont les quatre variables d'environnement et les deux secrets montés de [Déploiement de Flow](/fr/flow/deploying/). Définissez les quatre ou aucun : un rendu de chart avec certains seulement est refusé, tout comme un démarrage avec certains seulement.

`POST /stations/push` exige `flows.write` et accepte `{flows, note, confirmRestart, window, windowZone, dryRun}`. Si vous omettez `flows`, il envoie ce que cette instance exécute. Il répond avec le même rapport, plus `ok`, et un envoi figure dans le journal d'audit sous `stations.push`. `GET /stations` exige `flows.read`. Un envoi qui attend un oui répond avec `needsConfirm` à true et n'a rien modifié : renvoyez-le avec `confirmRestart` ou une fenêtre.

## Ce qui n'est pas démontré

La forme de la liste du tableau de bord a été lue sur le tableau de bord en production pour un vrai tenant. Elle n'a pas été envoyée aux stations d'un tenant via Flux, donc vérifier que l'adresse donnée par le tableau de bord est joignable depuis l'endroit où vous lancez l'envoi vous revient, avec `stations list` et un `-dry-run`.
