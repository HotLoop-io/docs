---
title: "Les migrations ne font qu'ajouter"
description: "Pourquoi une migration ne supprime, ne renomme ni ne retype jamais rien, pour qu'une mise à jour ratée revienne à la dernière version sans perdre une ligne."
---

Une migration ajoute. Elle ne supprime, ne renomme ni ne change jamais le type de rien, ne durcit jamais une colonne ou une contrainte par laquelle la version précédente écrit, et ne supprime jamais de données. C'est toute la règle, et un test fait échouer la compilation quand une migration l'enfreint.

## Pourquoi

Chaque boîtier suit `:stable` et la mise à jour automatique de Podman le fait avancer. Quand une version migre la base de données puis échoue à son contrôle de santé, la mise à jour est annulée et la version précédente démarre sur le schéma laissé par la nouvelle. Une migration ne peut pas être annulée avec elle. Il faut donc que la version précédente fonctionne sur le nouveau schéma, et la seule façon de le promettre est que le nouveau schéma contienne tout ce que contenait l'ancien, dans la même forme, en acceptant les mêmes écritures.

Ajoutez une colonne et l'ancienne version ne la regarde jamais. Supprimez-en une et la première requête de l'ancienne version est une erreur, dans une usine, à trois heures du matin, sans plus rien vers quoi revenir.

Le chart Helm a le même problème : `helm rollback` remet l'ancienne image et laisse la base de données là où la nouvelle l'a mise.

## Les changements qui semblent demander plus

On ne peut pas supprimer, donc un changement qui semble l'exiger se fait en ajoutant puis en laissant l'ancien tranquille.

- **Renommer une colonne.** Ajoutez la nouvelle colonne avec une valeur par défaut. La nouvelle version lit la nouvelle et écrit dans les deux. L'ancienne colonne reste, inutilisée, pour de bon.
- **Changer un type.** Pareil : une nouvelle colonne du nouveau type, la nouvelle version écrit dans les deux, l'ancienne colonne reste.
- **Une colonne qui doit désormais être NOT NULL.** On l'impose dans l'application. Si une contrainte est vraiment nécessaire, elle va sur une table qui est nouvelle.
- **Retirer une table.** On cesse de l'utiliser. Elle reste.
- **Nettoyer d'anciennes données.** L'application le fait à l'exécution (la rétention le fait déjà), pas une migration.

Les colonnes mortes coûtent quelques octets. Une migration qui ne peut pas être défaite alors que la version à laquelle elle appartient le peut coûte une usine.

## La protection : une application refuse un schéma auquel on ne peut pas se fier

Ajouter est sûr pour une version, pas pour toujours. Une version n'a été éprouvée que sur le schéma qui la suit immédiatement, donc l'application compte de combien la base de données est en avance.

`schema_migrations` enregistre, à côté de chaque migration, quelle version l'a appliquée (`app_version`). Au démarrage, avant de toucher à quoi que ce soit, l'application compare les migrations de la base de données avec celles qu'elle embarque :

| La base de données contient | Ce qui se passe |
|---|---|
| Rien que cette version ne connaisse pas | Démarre |
| Des migrations d'une version plus récente | Démarre, avec un avertissement nommant les deux versions. C'est une mise à jour annulée. Elle ne migre rien, et la version plus récente retrouve son schéma déjà en place à son retour |
| Des migrations de deux versions plus récentes ou plus | Refuse de démarrer, en nommant cette version, la migration la plus récente qu'elle connaît, la plus récente de la base de données et les versions qui les ont écrites |

Le refus s'affiche ainsi :

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

Sur un boîtier qui suit `:stable`, la mise à jour suivante règle le problème, car `:stable` passe à la version la plus récente, qui connaît toutes les migrations. L'unité reste alors en « activating ». C'est voulu : un boîtier arrêté qui dit pourquoi vaut mieux qu'un boîtier en marche et dans l'erreur.

La protection s'exécute que le démarrage migre ou non (`HOTLOOP_DB_MIGRATE`), et lors d'une restauration, qui ouvre la base de données de la même façon. Une base de données antérieure à la protection n'a pas de colonne `app_version` et ne peut pas contenir une migration plus récente que la version qui la lit, donc elle démarre ; la colonne est ajoutée au premier démarrage d'une version qui a la protection.

## La preuve avant une vraie version

Avant la publication d'une version, la version précédente est démarrée sur la base de données que la nouvelle a migrée, et on lui fait ouvrir une session, lire des appareils et des tags, écrire à travers la porte et lire l'historique. Si elle n'y arrive pas, la version ne sort pas.
