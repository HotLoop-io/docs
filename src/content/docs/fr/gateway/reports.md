---
title: "Rapports planifiés"
description: "Chiffres de l'historian selon un calendrier, en CSV ou HTML, stockés et envoyés : seules les bonnes lectures comptent, chaque ligne dit combien sont écartées."
---

Les rapports planifiés, depuis 4.14.0, exécutent des rapports définis par l'opérateur selon un calendrier : ils interrogent l'historien, produisent le résultat en CSV et en HTML, le stockent sur un volume et, en option, l'envoient par e-mail. C'est le pendant du module Reporting d'Ignition pour la part de ce module qu'une usine utilise le plus souvent, un tableau de chiffres livré à l'heure. Activé par défaut (`HOTLOOP_REPORTS_ENABLED`), dans le binaire et dans le chart Helm. Les rapports sont gardés sous `HOTLOOP_REPORTS_DIR`, qui vaut par défaut `reports` dans le répertoire de données de HotLoop : `HOTLOOP_DATA_DIR` s'il est défini, `/data` quand il existe et qu'on peut y écrire (un volume de conteneur), et sinon `~/.local/share/hotloop` (ou `$XDG_DATA_HOME/hotloop`), si bien qu'un binaire seul n'a besoin de rien de monté.

## Ce que c'est, et ce que ce n'est pas

- **API uniquement.** Il n'y a pas d'écran pour cela dans cette version. Les rapports se définissent, s'exécutent, se listent et se téléchargent via `/api/reports`. Une interface est un chantier à part.
- **CSV et HTML uniquement.** Pas de PDF. Produire un bon PDF en Go pur, sans binaire externe (l'image d'exécution n'en contient aucun, volontairement), suppose de choisir une bibliothèque PDF et un moteur de mise en page, et c'est une décision en soi. Le fichier HTML est autonome et s'imprime proprement depuis n'importe quel navigateur, ce qui couvre pour l'instant le « il me faut un PDF ».
- **Des tableaux d'agrégats, pas des mises en page libres.** Un rapport est une liste de tags, une fenêtre, une taille de tranche et un ensemble d'agrégations. Ce n'est pas un outil de mise en page.
- **Une seule instance de Gateway.** Le planificateur suppose qu'il est le seul à exécuter des rapports sur cette base de données. Deux réplicas lanceraient chacun tous les rapports. Ce chart exécute un réplica, et le volume des rapports est `ReadWriteOnce`.
- **Pas une fonction d'alarme.** L'e-mail d'alarme est une fonction à part, les [notifications d'alarme](/fr/iot/notifications/). Les rapports partagent avec elle les réglages du relais SMTP et rien d'autre.

## Une définition de rapport

Les définitions sont des données modifiées par l'opérateur, stockées dans la base comme les appareils, les tags, les définitions d'alarme et les membres de la flotte, et gérées via l'API. Exemple :

```json
{
  "id": "line1-daily",
  "name": "Line 1 daily summary",
  "enabled": true,
  "tags": [
    {"deviceId": "press-01", "tagName": "Zone1_Temp"},
    {"deviceId": "press-01", "tagName": "Pressure"}
  ],
  "window": {"count": 1, "unit": "days", "end": "local_midnight"},
  "bucket": "hour",
  "aggregations": ["min", "max", "avg", "count"],
  "schedule": {"kind": "daily", "at": "03:00"},
  "format": "both",
  "recipients": ["ops@example.com"],
  "retain": 30
}
```

| Champ | Signification |
|---|---|
| `id` | De 1 à 64 caractères parmi lettres, chiffres, point, tiret ou tiret bas, commençant par une lettre ou un chiffre. Il nomme le répertoire du rapport sur le volume, il est donc validé comme tous les autres identifiants de cette application. |
| `name` | Affiché dans le titre du HTML et dans l'objet de l'e-mail. Pas de caractères de contrôle. |
| `enabled` | Si le planificateur l'exécute. Un rapport désactivé peut toujours être lancé à la main. |
| `tags` | De 1 à 50 paires appareil et tag. Chacun doit exister à l'enregistrement de la définition et ne doit pas être un tag de type texte. |
| `window` | La période d'historique couverte par chaque exécution. Voir plus bas. |
| `bucket` | `window` (une ligne par tag), `hour` ou `day`. Par défaut `window`. |
| `aggregations` | Une ou plusieurs parmi `min`, `max`, `avg`, `first`, `last` ou `count`, chacune au plus une fois. |
| `schedule` | Voir plus bas. |
| `format` | `csv`, `html` ou `both`. Par défaut `csv`. |
| `recipients` | Facultatif. Adresses simples uniquement (`ops@example.com`, pas `Ops <ops@example.com>`). 20 au maximum. |
| `retain` | Combien d'exécutions conserver. De 1 à 1000. Par défaut 30. |

`PUT` remplace toute la définition. Un client peut lire un rapport, modifier un champ et le renvoyer tel quel : les champs en lecture seule ajoutés par le serveur (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` et `updatedAt`) sont acceptés et ignorés.

Une définition qui produirait plus de 1000 tranches est refusée à l'enregistrement (des tranches horaires sur plus de 41 jours environ, par exemple).

## Fenêtres

Une fenêtre est relative au moment où l'exécution a lieu.

| Ce que vous voulez | `count` | `unit` | `end` |
|---|---|---|---|
| Les 24 dernières heures | 24 | `hours` | `run_time` |
| La journée calendaire précédente | 1 | `days` | `local_midnight` |
| Les 7 journées entières précédentes | 7 | `days` | `local_midnight` |
| Une semaine glissante | 7 | `days` | `run_time` |

- `end` est l'instant où l'exécution démarre ou, pour `local_midnight`, le minuit local le plus récent, au plus tard à cet instant. Une exécution à 03:00 qui se termine à minuit local couvre des journées calendaires entières.
- **Les heures sont du temps écoulé. Les jours sont des jours calendaires** dans le fuseau horaire de l'usine. Une fenêtre d'un jour qui se termine à minuit local est une journée locale entière, qui dure 23 heures le jour où l'on avance les horloges et 25 le jour où on les recule. « Les 24 dernières heures » font toujours exactement 24 heures.
- **Une fenêtre est semi-ouverte** : elle inclut son début et exclut sa fin. Une lecture horodatée exactement à minuit appartient à la journée qui commence là. Deux rapports quotidiens consécutifs ne comptent jamais tous deux une lecture et ne la manquent jamais tous deux.
- Une exécution manuelle et une exécution de rattrapage calculent la fenêtre à l'instant où elles s'exécutent.

## Tranches

- `window` : une ligne par tag sur toute la fenêtre.
- `hour` : une ligne par tag et par heure d'horloge locale. Une fenêtre qui ne commence pas à l'heure pile débute par une tranche partielle plus courte, et une qui ne se termine pas à l'heure pile finit par une. Les heures restent à l'heure pile lors d'un changement d'heure et dans les fuseaux dont le décalage n'est pas un nombre entier d'heures.
- `day` : une ligne par tag et par jour calendaire local.

Chaque tag a une ligne pour chaque tranche, y compris les tranches vides. Le rapport n'omet jamais l'heure où un capteur est resté silencieux, car un rapport qui passerait cette ligne sous silence ressemblerait à celui d'un capteur qui n'avait rien à dire. Chaque ligne indique la période exacte qu'elle couvre (`period_start` et `period_end`, avec leurs décalages UTC), de sorte qu'une journée de 23 heures apparaît comme telle.

## Agrégations et règle de qualité

Les agrégations sont `min`, `max`, `avg`, `first` (la plus ancienne lecture de la période d'après son horodatage), `last` (la plus récente) et `count`.

Les rapports suivent la règle de qualité, la même que celle du graphique de tendance, de sorte qu'un rapport et une tendance sur la même heure concordent. Une lecture sans valeur numérique (une lecture de type texte) est aussi écartée. Il n'y a pas d'interrupteur pour cela : une moyenne qui mélange en silence des lectures que l'historian lui-même a marquées comme non fiables est pire qu'un rapport qui dit combien il n'en a pas utilisé.

Chaque ligne porte donc une colonne `excluded` : combien de lectures de cette période ont été écartées. `count` est le nombre de lectures utilisées. L'enregistrement d'exécution et l'e-mail portent les totaux.

**Rien n'est inventé.** Un tag sans aucune lecture exploitable sur une période n'a pas de minimum, et le rapport le dit : les cellules sont vides dans le CSV et affichent `no data` dans le HTML. Elles ne valent jamais zéro. Zéro est une lecture (une vanne fermée, un débit nul) et s'agrège comme n'importe quelle autre valeur. `count` est la seule colonne qui est un nombre lorsqu'il n'y a pas de données, car zéro est un vrai décompte de rien.

## Planifications et heure

Une planification est l'une des suivantes :

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- Un **intervalle** est du temps écoulé (au moins une minute) et ignore l'horloge murale.
- Les heures **quotidiennes et hebdomadaires** sont des heures d'horloge murale dans le fuseau horaire de l'usine, qui est `HOTLOOP_TIMEZONE` (le `global.timezone` du chart). Ce doit être un vrai nom de fuseau, comme `America/Chicago`. Un nom inutilisable provoque un refus de démarrage, rapports activés ou non, et non un repli silencieux sur UTC, car un rapport prévu pour 03:00 local qui part à 03:00 UTC est un bogue que personne ne voit avant que les chiffres soient faux.

### Heure d'été

La prochaine exécution est calculée en construisant une heure d'horloge murale dans le lieu de l'usine avec `time.Date`. Elle n'est jamais calculée en ajoutant 24 heures à l'exécution précédente, ce qui partirait une heure trop tôt ou une heure trop tard d'un changement d'heure à l'autre. Deux heures d'horloge murale posent problème le jour du changement, et la règle pour chacune est fixée dans le code plutôt que laissée à `time.Date`, dont le comportement dans les deux cas est documenté comme non spécifié :

- **Une heure qui n'existe pas** (02:30 le jour du passage à l'heure d'été, quand l'horloge saute de 02:00 à 03:00) part au premier instant après le saut, 03:00. Elle s'exécute en retard d'au plus la taille du saut et ne saute pas la journée.
- **Une heure qui se produit deux fois** (01:30 le jour du retour à l'heure d'hiver) part une seule fois, à sa première occurrence.

### last_run_at, la prochaine exécution et le rattrapage

`last_run_at` est le moment où le planificateur a **démarré** le rapport pour la dernière fois, que cette exécution ait ensuite réussi ou échoué. Une exécution manuelle ne le déplace pas : lancer un rapport à la main à 02:00 n'annule donc pas l'exécution de 03:00 ce soir.

La prochaine exécution est la première heure planifiée après la plus récente entre la création de la définition, sa dernière modification et son `last_run_at`. Mesurer depuis la dernière modification signifie que déplacer un rapport de 03:00 à 09:00 à 10:00 attend demain au lieu de partir aussitôt pour une heure déjà passée.

**Rattrapage.** Si la prochaine exécution après `last_run_at` est déjà dans le passé quand le Gateway démarre, c'est que le Gateway n'était pas là pour la faire, et le rapport s'exécute **une fois**, immédiatement, avec l'étiquette `catchup`. Il n'est pas exécuté une fois par heure manquée : un rapport quotidien qui a manqué trois jours s'exécute une fois, le jour où le Gateway revient, avec la fenêtre que cela donne à cet instant. Les jours manqués ne sont pas rattrapés. Ensuite, le rapport reprend sa planification.

`last_run_at` est écrit **avant** le début de l'exécution, de sorte qu'un Gateway qui meurt en cours d'exécution ne la répète pas au redémarrage par-dessus un e-mail peut-être déjà parti. L'exécution interrompue est enregistrée comme ayant échoué. Une exécution planifiée qui échoue n'est pas retentée ; la prochaine heure planifiée s'exécute normalement, et `POST /api/reports/{id}/run` est là quand quelqu'un veut la relancer.

## Sortie

Chaque exécution écrit ses fichiers sous `HOTLOOP_REPORTS_DIR` (`/data/reports`, un PVC dans le chart) :

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **Les noms de fichiers sont construits uniquement à partir d'un identifiant validé, d'un horodatage UTC et de l'identifiant entier de l'exécution.** Le parcours de chemins est fermé par construction : l'identifiant du rapport doit respecter la même règle d'identifiant que partout ailleurs, et un nom de fichier relu depuis un enregistrement d'exécution est comparé au motif exact ci-dessus avant d'être ouvert. Le `{run}` d'une URL de téléchargement est analysé comme un entier et sert uniquement à retrouver l'enregistrement d'exécution avec l'identifiant du rapport. Le fichier ouvert est celui que cet enregistrement nomme. Rien de l'URL ne devient une partie d'un chemin.
- Les fichiers sont créés avec `O_EXCL` et le mode `0640`, et les répertoires avec `0750`. Un fichier qui existe déjà est une erreur, jamais écrasé. La sortie contient des données d'usine et des noms de tags, le mode est donc un plancher, pas un substitut à la protection du volume.
- **Rétention.** Après chaque exécution, les `retain` exécutions les plus récentes ayant stocké des fichiers sont conservées, et les plus anciennes sont supprimées avec leurs fichiers. Les exécutions en échec, qui n'ont pas de fichiers, sont conservées à part (les `retain` plus récentes d'entre elles), de sorte qu'une série d'échecs ne puisse pas chasser le dernier bon rapport. Tout fichier du répertoire du rapport qui correspond au motif de nommage mais n'est référencé par aucun enregistrement d'exécution restant (le fichier partiel d'une exécution morte) est également supprimé. Un fichier qui ne correspond pas au motif, comme un fichier déposé là par un opérateur, est laissé tranquille.

### CSV

RFC 4180, issu de `encoding/csv`, avec des fins de ligne CRLF. Les colonnes sont `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, une colonne par agrégation dans l'ordre où la définition les liste, et `excluded`. Les horodatages sont en RFC 3339 dans le fuseau horaire de l'usine avec leur décalage. Les nombres sont écrits en pleine précision.

**Injection de formules dans les tableurs.** Un nom de tag ou une unité est un texte que quelqu'un a tapé, et un tableur lit comme une formule une cellule qui commence par `=`, `+`, `-` ou `@`. Toute cellule de texte qui commence par l'un d'eux (ou par une tabulation ou un retour chariot, ou par une espace suivie de l'un d'eux) est précédée d'une apostrophe, que les tableurs traitent comme « ceci est du texte » et n'affichent pas. Les colonnes numériques sont écrites à partir de nombres, donc une lecture négative est laissée telle quelle et se lit toujours comme un nombre.

Le fichier n'a pas de marque d'ordre des octets. Excel ouvre un CSV UTF-8 sans elle comme s'il s'agissait d'une ancienne page de codes, donc un nom de tag contenant des caractères non ASCII peut devoir être importé en UTF-8.

### HTML

Un seul fichier autonome, construit avec `html/template`, de sorte que les noms et les valeurs des tags sont échappés selon l'endroit où ils atterrissent : un tag appelé `<script>` est écrit comme du texte. La feuille de style est intégrée et il n'y a ni script, ni police, ni image, ni lien vers quoi que ce soit, car les déploiements peuvent être isolés du réseau. Il porte aussi une balise meta `Content-Security-Policy` qui interdit de charger quoi que ce soit, et l'API le sert avec une politique qui ajoute `sandbox`, en pièce jointe.

## Envoi par e-mail

Si un rapport a des `recipients`, chaque exécution envoie les fichiers en pièces jointes, via le relais SMTP configuré sous `HOTLOOP_NOTIFY_SMTP_*` (hôte, port, nom d'utilisateur, mot de passe, expéditeur, TLS). Seul le relais est partagé avec le canal d'alarme : que ce canal soit activé et à qui vont les alarmes n'a aucun effet sur les rapports, un déploiement peut donc envoyer des rapports par e-mail sans alerter personne. Le chart écrit les variables du relais pour les seuls rapports quand le canal d'alarme est désactivé.

C'est le même code SMTP que celui du canal d'alarme, pas une seconde copie. Le canal d'alarme envoie désormais lui aussi par ce code. La gestion de la connexion est inchangée (le port 465 parle désormais TLS dès le premier octet, voir [Notifications d'alarme](/fr/iot/notifications/#tls-implicite-port-465)) : STARTTLS dès que le relais le propose, `AUTH` quand des identifiants sont définis, et un échec net avant `AUTH` quand `HOTLOOP_NOTIFY_SMTP_TLS` est défini et que le relais ne propose pas STARTTLS. Pour une alarme ASCII, le message contient les mêmes octets qu'avant, hormis l'en-tête `Date`, et un test le garantit. L'objet d'une alarme non ASCII est désormais envoyé sous forme de mot encodé RFC 2047 au lieu d'UTF-8 brut.

Le message est `multipart/mixed` : une partie texte quoted-printable, puis chaque fichier encodé en base64. **L'injection d'en-têtes est refusée, pas nettoyée.** Les destinataires, l'expéditeur, l'objet et les noms des fichiers joints sont validés : une valeur contenant un CR, un LF ou un autre caractère de contrôle, un destinataire sous forme de nom affiché ou contenant une liste, ou un nom de fichier contenant un guillemet ou un chemin fait échouer le message avant que quoi que ce soit soit envoyé au relais. L'objet propre au canal d'alarme est la seule exception, car une alerte doit partir quel que soit le nom de l'alarme : il remplace d'abord les caractères de contrôle par des espaces.

- **Aucun relais configuré.** Un rapport avec des destinataires s'exécute quand même et stocke ses fichiers, et l'exécution est enregistrée comme `failed`, avec `emailStatus` à `failed` et une erreur indiquant que le relais n'est pas configuré. Il ne réussit pas en silence.
- **Trop gros.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) plafonne les données jointes d'un e-mail. Un rapport qui le dépasse est stocké et téléchargeable, et son exécution enregistre pourquoi il n'a pas été envoyé par e-mail.
- Une exécution lancée à la main peut sauter l'e-mail avec `?deliver=false`.

## Enregistrements d'exécution et piste d'audit

Chaque exécution est enregistrée dans `report_runs` dès le moment où elle démarre : quand elle a commencé et fini, le déclencheur (`schedule`, `catchup` ou `manual`), qui l'a demandée, la fenêtre, le résultat et le texte de l'erreur, le nombre de tags, de lignes, de lectures agrégées et de lectures écartées, les fichiers stockés, le résultat de l'e-mail et ses destinataires, et des notes (par exemple, qu'un tag a été supprimé depuis et qu'il est rapporté d'après son historique enregistré). Le succès et l'échec sont aussi écrits via `rt.Event`, la même piste d'audit que celle des alarmes et des actions de flotte, avec l'identifiant du rapport comme sujet.

Une exécution interrompue par l'arrêt, par sa limite de temps (`HOTLOOP_REPORTS_RUN_TIMEOUT`) ou par la suppression du rapport est enregistrée comme échouée avec ce motif. Une exécution laissée à `running` par un processus mort est marquée échouée au prochain démarrage du Gateway. Une seule exécution d'un rapport est en cours à la fois ; une seconde demande pendant qu'une tourne reçoit un `409`.

## API

| Route | Autorisation | <span class="sr-only">Détails</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Toutes les définitions, chacune avec son `nextRunAt` et sa dernière exécution |
| `POST /api/reports` | `reports.write` | Créer. `409` si l'identifiant existe |
| `GET /api/reports/{id}` | `reports.read` | Une définition |
| `PUT /api/reports/{id}` | `reports.write` | Remplacer. L'identifiant ne peut pas changer |
| `DELETE /api/reports/{id}` | `reports.write` | Supprimer, avec ses exécutions et ses fichiers. Une exécution en cours est d'abord annulée |
| `POST /api/reports/{id}/run` | `reports.run` | Exécuter maintenant et attendre. `?deliver=false` saute l'e-mail |
| `GET /api/reports/{id}/runs` | `reports.read` | Enregistrements d'exécution, les plus récents d'abord (`?limit=`, jusqu'à 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Diffuser un fichier stocké en pièce jointe |

`POST .../run` renvoie l'enregistrement d'exécution avec `200` que l'exécution ait réussi ou non. Le statut dit si la requête a été menée à bien, et le `status` de l'enregistrement dit si le rapport l'a été. Une exécution qui échoue est un résultat, et elle est enregistrée dans tous les cas. L'exécution n'est pas liée à la connexion du client : raccrocher n'interrompt pas un rapport qui a peut-être déjà lancé un e-mail.

Avec la fonction désactivée, la liste répond `{"reports": [], "configured": false}` et toutes les autres routes répondent par une erreur qui nomme `HOTLOOP_REPORTS_ENABLED`.

### Qui peut faire quoi

| Rôle | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| lecteur | oui | non | non |
| opérateur | oui | oui | non |
| administrateur | oui | oui | oui |

- **Lire** est ouvert aux lecteurs car un rapport stocké est un agrégat d'un historique qu'un lecteur peut déjà lire via `values.read` ; le lire ou le télécharger n'accorde donc rien de nouveau.
- **Exécuter** est ouvert aux opérateurs car exécuter un rapport ne livre jamais qu'aux destinataires qu'un administrateur a déjà choisis, et il peut être exécuté sans livraison.
- **Écrire est réservé aux administrateurs.** Une définition nomme les adresses auxquelles sa sortie est envoyée par e-mail : pouvoir en définir une, c'est pouvoir envoyer des données d'usine à une adresse arbitraire selon un calendrier. C'est plus proche par nature de `notify.test` et `fleet.config` (aussi réservés aux administrateurs, aussi « faire quelque chose vers le monde extérieur ») que d'une lecture. C'est un choix d'appréciation, qui pourrait être revu si un vrai flux de travail exigeait que les opérateurs construisent des rapports.
- Un opérateur peut toujours provoquer l'envoi d'un e-mail aux destinataires d'un rapport en l'exécutant, et de façon répétée. Il y a une garde d'une exécution à la fois et `?deliver=false`, mais pas de limitation de débit.
- Un utilisateur ayant une liste de permissions explicite détient exactement ce qu'elle nomme ; le joker `reports.*` couvre les trois.

## Configuration

| Variable | Par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | La fonction est désactivée, planificateur compris, tant que ceci n'est pas défini |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Où sont écrits les fichiers de chaque exécution. Prévu pour être un PVC (`reports.persistence` dans le chart) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Borne une exécution : requête, rendu, écriture et e-mail |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | La plus grande quantité de données jointes dans un e-mail |
| `HOTLOOP_TIMEZONE` | `UTC` | Le fuseau horaire de l'usine. Doit être un vrai nom de fuseau, sinon HotLoop ne démarre pas |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | Le relais par lequel les rapports envoient leurs e-mails. Voir [Notifications d'alarme](/fr/iot/notifications/) |

Le bloc `reports` du chart contient `enabled`, `runTimeout`, `maxEmailBytes` et `persistence` (taille, classe de stockage, mode d'accès). `notify.smtp` fournit le relais. Les rapports ne sont pas démarrés en mode `--mcp-stdio`, où un agent lance le binaire comme assistant, et un second planificateur à côté du vrai Gateway exécuterait chaque rapport dû deux fois.

## Sauvegardes

Les définitions de rapports et les enregistrements d'exécution sont des données utilisateur et font partie de la sauvegarde de la base de données. Les fichiers de sortie n'en font pas partie : ils sont sur le volume des rapports, et restaurer une sauvegarde dans un nouveau déploiement ramène les enregistrements mais pas les fichiers, donc télécharger une ancienne exécution là-bas répond que le fichier n'est plus sur le disque. Copiez le volume des rapports si les fichiers comptent.

Ajouter ces deux tables à la liste de sauvegarde est le genre de changement qu'on oublie facilement, le paquet de sauvegarde a donc maintenant des garde-fous. Un test liste chaque table du schéma et échoue si l'une n'est ni dans `backup.Tables` ni dans une liste d'exclusion explicite avec un motif. Un autre vérifie que `Tables` est dans l'ordre des clés étrangères, en lisant les clés étrangères depuis la base de données. Le test aller-retour sème une définition de rapport et une exécution et vérifie les valeurs restaurées et la séquence.

## Ce qui a été vérifié et ce qui ne l'a pas été

HotLoop a été exécuté sur du vrai matériel et de vrais serveurs, et sur du matériel réel le 2026-11-17.
