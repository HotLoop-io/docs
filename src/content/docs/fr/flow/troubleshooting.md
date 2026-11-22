---
title: "Quand Flow refuse de démarrer"
description: "Les erreurs de démarrage que Flow produit exprès, ce que chacune signifie et la correction en une ligne."
---

Hormis les erreurs de configuration ordinaires (une faute de frappe dans le YAML, un port hors plage), il refuse de démarrer pour cinq raisons, toutes voulues. Chacune affiche la correction au lieu d'une trace de pile, parce que celui qui la lit regarde un CrashLoopBackOff et n'a pas besoin de mes chemins Go.

| Refus | Correction |
|---|---|
| L'authentification est désactivée | Configurez un utilisateur. Ou, si le réseau est vraiment isolé et que vous avez décidé d'assumer, définissez `HOTLOOP_FLOW_INSECURE=true` dans l'environnement. `auth.enabled: false` dans le fichier ne suffit pas à lui seul. (Jusqu'à 2.0.4 incluse, la variable ne faisait rien et vous obteniez ce refus quand même. Corrigé en 2.0.5.) |
| L'authentification est activée sans utilisateurs | Définissez `auth.users`, ou `HOTLOOP_FLOW_ADMIN_USER` et `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| Un `passwordHash` qui n'est pas du bcrypt | Lancez `hotloop-flow hash-password`. Cette vérification existe pour qu'un mot de passe en clair ne finisse jamais par accident dans un ConfigMap. |
| Pas de secret d'identifiants | Définissez `HOTLOOP_FLOW_CREDENTIAL_SECRET`. Ou `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true` si cette instance ne détient aucun secret. |
| `discovery` ou `exec` activés avec une liste d'autorisations vide | Listez ce qui est permis, ou désactivez la fonction. Une liste d'autorisations vide lue de façon permissive, c'est exactement ainsi qu'une capacité étroite devient un shell. |

Ce pour quoi il ne refusera *pas* de démarrer, c'est un seul nœud défectueux. Un flux avec un seul nœud cassé exécute tous les autres nœuds et journalise l'échec, parce que mettre une ligne à l'arrêt pour une faute de frappe dans une boîte de dialogue est pire que faire tourner 40 nœuds sur 41 et le dire. Idem pour une liste d'autorisations exec qui nomme quelque chose qui n'est pas encore dans le `PATH` : il avertit au démarrage et le résout de nouveau quand un flux l'utilise, car un conteneur d'initialisation ou un volume monté peuvent légitimement l'amener après le démarrage.

Si le fichier de flux ne s'analyse pas, il essaie les sauvegardes de la plus récente à la plus ancienne, garde le fichier corrompu à côté sous le nom `.corrupt` et journalise exactement la sauvegarde utilisée. Si aucune ne s'analyse non plus, il s'arrête là, au lieu de démarrer vide et d'avoir l'air sain alors que tous vos flux ont disparu. Et un déploiement écrit le fichier de flux *avant* d'arrêter l'ancien runtime : si l'enregistrement échoue, vos flux précédents continuent de tourner au lieu que la ligne s'arrête à cause d'un mauvais enregistrement. Cet ordre n'est pas l'ordre évident, il n'est pas accidentel, et un test échoue si quelqu'un l'inverse.
