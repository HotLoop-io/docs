---
title: "Notifications d'alarme"
description: "ntfy, Gotify, Discord, webhooks et e-mail. Appuyez sur Acquitter sur votre téléphone et l'alarme est acquittée, signée et à usage unique."
---

Les notifications d'alarme, depuis la version 4.10.0, préviennent un téléphone quand une alarme se déclenche à 03:00. Quand une alarme est **déclenchée**, HotLoop envoie une notification par chaque canal configuré et activé dont le seuil de priorité est atteint par l'alarme. Désactivé par défaut (`HOTLOOP_NOTIFY_ENABLED`) : un déploiement sans personne à prévenir n'a rien à configurer ici.

## Pourquoi seulement « déclenchée »

`alarm.Engine.OnTransition` se produit à chaque transition ISA-18.2 : déclenchée, retournée à la normale, acquittée, mise en attente, remise en service. Ce paquet les écoute toutes, mais n'agit que sur une seule. Prévenir à chaque transition ferait vibrer le téléphone d'un opérateur quand il acquitte sa propre alarme, quand elle revient à la normale toute seule ou quand quelqu'un la met en attente pour un poste, et l'habituerait à écarter les messages sans les lire, comme une alarme qui oscille habitue à ignorer les alarmes. Déclenchée est le seul événement qui veut dire « quelque chose a besoin d'une personne qui ne regarde peut-être pas un écran », et c'est toute la raison d'être de ce paquet.

Le seul autre message est une escalade : l'alarme s'est déclenchée, personne ne l'a acquittée et la politique dit de prévenir la personne suivante. C'est la même alarme qui a toujours besoin de quelqu'un, signalée de nouveau à une autre personne, pas un nouvel événement. Voir « Escalade ».

Un cas ressemble à une remise en service alors que c'est un déclenchement. Si la condition apparaît pendant qu'une alarme est en attente, personne n'a été prévenu : quand la mise en attente se termine (par expiration ou remise en service manuelle), le moteur enregistre la remise en service puis un déclenchement, et ce déclenchement prévient. Une alarme déjà en alarme quand elle a été mise en attente et qui l'est encore revient non acquittée mais ne prévient pas une deuxième fois : elle a déjà prévenu la première.

## Les canaux

Six, et c'est la liste (voir « Notifications » dans la [feuille de route de HotLoop](/fr/roadmap/) pour ce que nous ne faisons pas et pourquoi). Aucun ne demande de SDK de fournisseur ni de compte payant, conformément au plan de ce projet : les intégrations cloud sont des connexions sortantes facultatives que configure l'exploitant, jamais quelque chose dont cette application a besoin pour fonctionner.

- **ntfy** : une notification push sur un téléphone, avec un bouton **Acquitter** qui acquitte l'alarme directement dans HotLoop. Gratuit, et vous pouvez exécuter le serveur sur le réseau de l'usine sans aucun accès à internet. Voir « Configurer ntfy ».
- **Gotify** : une notification push sur un téléphone. Gratuit, auto-hébergé, fonctionne sans internet. Pas de boutons et pas d'application iPhone : c'est un bipeur, pas une voie à double sens. Voir « Configurer Gotify ».
- **Webhook Discord** : un message intégré dans un canal Discord, coloré selon la priorité, avec le tag, la valeur, la limite, la zone et la ligne. Collez une URL et ça marche. Les alarmes critiques peuvent mentionner un rôle. Pas de boutons. Voir « Discord ».
- **Bot Discord** : le même message, avec des boutons **Acquitter** et **Mettre en attente** qui agissent sur l'alarme et enregistrent qui les a pressés. Les appuis reviennent par une connexion que HotLoop ouvre vers Discord, donc l'usine n'a besoin d'aucune adresse publique. Voir « Discord ».

- **Webhook** : un POST du corps JSON propre à HotLoop (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, qui vaut `raised`, ou `escalated` pour une escalade) vers une URL configurée. Il fonctionne avec tout ce qui accepte le JSON que vous lui envoyez : votre propre script derrière un petit écouteur HTTP, Node-RED, n8n ou un déclencheur « n'importe quel webhook » dans un outil de flux. (Pointé vers un sujet ntfy, il prévient, avec le JSON brut comme texte ; utilisez plutôt le canal ntfy ci-dessus.) Un résumé (voir « Limites de débit et résumés ») porte `event` à `summary` et une liste `alarms` qui nomme chaque alarme qu'il contient. Il ne fonctionne pas avec les services qui veulent le corps dans leur propre forme. Discord répond 400 parce qu'il n'y a ni `content` ni `embeds`. Slack, Teams et Google Chat veulent leur propre champ de texte. Pushover veut ses champs `token`, `user` et `message`, et l'API Events de PagerDuty veut un `routing_key`, un `event_action` et un `payload`. Pointez le webhook vers l'un d'eux et chaque message échoue. Discord a ses propres canaux qui construisent le corps attendu par Discord ; utilisez-les.
- **E-mail par SMTP** : envoyé par le relais que l'exploitant a déjà (un serveur de messagerie d'entreprise, le point SMTP d'un fournisseur d'e-mails transactionnels, un relais auto-hébergé). Pas de clé d'API, pas de bibliothèque de fournisseur : `net/smtp` et un message en texte brut construit à la main. Beaucoup de téléphones affichent déjà l'e-mail comme notification push, et beaucoup d'outils d'astreinte acceptent une adresse de passerelle e-mail vers SMS comme « moyen de contact », donc ce seul canal couvre une part importante de « prévenir un téléphone » sans aucune dépendance payante.

## L'URL du webhook n'est jamais imprimée

Pour beaucoup de récepteurs, l'URL est le mot de passe. Discord met le jeton dans le chemin (`/api/webhooks/{id}/{token}`), ntfy l'accepte en `?auth=`, Google Chat en `?key=` et `?token=`. Quiconque détient l'URL peut publier dans votre canal. Donc, quand un envoi échoue, l'erreur nomme le schéma et l'hôte, et rien d'autre :

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

C'est le même texte dans le journal, dans l'événement d'audit et dans la réponse de `POST /api/notify/test`. L'hôte suffit à savoir quel récepteur est en cause ; le chemin et la requête ne quittent jamais le processus. Une URL qui échoue à la validation au démarrage n'est pas non plus répétée dans cette erreur. Si vous devez voir l'URL, regardez `HOTLOOP_NOTIFY_WEBHOOK_URL` là où vous l'avez définie.

## Configurer ntfy

[ntfy](https://ntfy.sh) est un serveur push de publication et d'abonnement. HotLoop publie chaque alarme sur un sujet ; l'application ntfy du téléphone s'y abonne.

1. Lancez un serveur, ou utilisez ntfy.sh. Sur un réseau d'usine, lancez le vôtre (`binwiederhier/ntfy`, un conteneur) et verrouillez-le : définissez `auth-default-access: deny-all`, créez un utilisateur pour HotLoop qui peut écrire sur le sujet, et un par personne qui peut le lire. Sur ntfy.sh, ou sur tout serveur accessible à tous, **le nom du sujet est le mot de passe** : quiconque le devine lit vos alarmes. Choisissez-le long et aléatoire.
2. Donnez à HotLoop un jeton d'accès (`ntfy token add hotloop`) ou un nom d'utilisateur et un mot de passe pour cet utilisateur.
3. Définissez `HOTLOOP_PUBLIC_URL` avec l'adresse par laquelle un téléphone joint HotLoop, par exemple `https://hotloop.plant.example`. Sans elle, la notification arrive quand même, mais sans bouton Acquitter et sans toucher pour ouvrir, car le téléphone n'aurait nulle part où envoyer l'un ou l'autre.
4. Configurez-le et redémarrez :

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` envoie une notification de test. Elle n'a pas de bouton Acquitter, parce qu'aucune alarme ne se trouve derrière.

L'URL est le serveur seul. Le sujet a son propre réglage, jamais dans l'URL : ainsi HotLoop sait quelle partie est le secret et la garde hors de chaque erreur, ligne de journal et événement d'audit.

Ce qui arrive :

| <span class="sr-only">Détails</span> | <span class="sr-only">Détails</span> |
|---|---|
| Titre | Le nom de l'alarme |
| Corps | Le message de l'alarme, sa priorité, son origine (`device/tag`) et l'heure de son déclenchement |
| Priorité | Critique 5 (max : sur Android, elle peut passer outre Ne pas déranger, si vous l'autorisez), Élevée 4, Moyenne 3, Faible 2 |
| Étiquettes | Un émoji selon la gravité et la priorité en toutes lettres, pour que la liste sur le téléphone se parcoure d'un coup d'œil |
| Toucher | Ouvre la liste d'alarmes de HotLoop, quand `HOTLOOP_PUBLIC_URL` est définie |
| Bouton | **Acquitter**, quand `HOTLOOP_PUBLIC_URL` est définie. Voir « Liens d'acquittement » |

### La réserve pour iPhone

Android fonctionne sans aucun internet : l'application ntfy garde sa propre connexion avec votre serveur et reçoit chaque message instantanément par le Wi-Fi de l'usine.

Pas les iPhone. Apple ne laisse passer un push que par ses propres serveurs (APNs), et seul ntfy.sh peut parler à APNs. Un serveur auto-hébergé doit être configuré avec `upstream-base-url: https://ntfy.sh`, puis il transmet une demande d'interrogation (sans contenu de message, juste « quelque chose est arrivé sur ce sujet ») à ntfy.sh, qui réveille le téléphone, lequel va alors chercher le message sur votre serveur. Donc, dans une usine sans internet, les iPhone ne reçoivent pas de notifications instantanées d'un ntfy auto-hébergé. Ils les voient à l'ouverture de l'application. Si vos équipes ont des iPhone et que l'usine est isolée d'internet, ntfy n'est pas votre bipeur ; l'e-mail par un relais l'est, ou Discord si l'usine peut l'atteindre. Gotify n'a aucune application iPhone.

Le bouton Acquitter est une requête du téléphone vers `HOTLOOP_PUBLIC_URL`, donc le téléphone doit pouvoir joindre cette adresse : par le Wi-Fi de l'usine, ou par le VPN que vous utilisez. Il fonctionne de la même façon sur les deux plateformes.

## Configurer Gotify

[Gotify](https://gotify.net) est un petit serveur push auto-hébergé avec une application Android. Pas besoin d'internet, pas de compte nulle part.

1. Lancez `gotify/server` et connectez-vous à son interface web.
2. Sous **Apps**, créez une application nommée HotLoop. Copiez son jeton.
3. Configurez-le et redémarrez :

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

Le jeton va dans l'en-tête `X-Gotify-Key`, jamais en `?token=` dans l'URL, où il finirait dans le journal d'accès de chaque proxy.

Les priorités correspondent à ce que fait l'application Android : Critique 10 et Élevée 8 sont d'importance haute (son et fenêtre contextuelle), Moyenne 5 est une notification normale avec son, Faible 2 est silencieuse. Le message est en Markdown (le nom de l'alarme en gras, les détails en liste, le texte propre de l'alarme échappé pour qu'un nom contenant un astérisque s'affiche tel quel), et le toucher ouvre la liste d'alarmes de HotLoop quand `HOTLOOP_PUBLIC_URL` est définie.

**Pas d'acquittement.** Les notifications Gotify n'ont pas de boutons d'action, donc impossible d'y mettre un bouton Acquitter, et nous ne le simulerons pas avec un lien qui acquitte sur un simple GET : les aperçus de liens et les scanners de sécurité ouvrent les liens tout seuls, et une alarme ne doit jamais être acquittée par un robot. Acquittez dans HotLoop. **Pas d'application iPhone** non plus.

## Discord

Deux voies d'entrée. Le webhook est un bipeur : collez une URL, recevez les alarmes dans un canal. Le bot est à double sens : les mêmes messages avec des boutons **Acquitter** et **Mettre en attente**, et la piste d'audit dit quelle personne les a pressés. Les deux demandent que l'usine joigne Discord par internet (HTTPS sortant vers `discord.com` et, pour le bot, un WebSocket vers `*.discord.gg`). Aucun ne demande que Discord joigne l'usine.

### Ce qui arrive

| <span class="sr-only">Détails</span> | <span class="sr-only">Détails</span> |
|---|---|
| Texte | `[Critical] Boiler Trip`, ce qu'affiche la notification push d'un téléphone. Sur une alarme critique, une mention du rôle configuré placée devant |
| Titre du message intégré | Le même, avec un lien vers la liste d'alarmes de HotLoop quand `HOTLOOP_PUBLIC_URL` est définie |
| Couleur | Critique en rouge, élevée en orange, moyenne en jaune, faible en bleu |
| Description | Le message de l'alarme |
| Champs | Tag (`device/tag`), Valeur (la mesure qui l'a déclenchée), Limite (`hi 90`, tirée de la définition), Zone / Ligne (de l'appareil), Déclenchée (dans le fuseau horaire de chaque lecteur) |
| Pied de message | `HotLoop | <HOTLOOP_PLANT_NAME>`, pour qu'un serveur qui contient plusieurs usines puisse les distinguer (juste `HotLoop` quand le nom de l'usine n'est pas défini) |
| Boutons (bot seulement) | Acquitter, Mettre en attente 1 h, Ouvrir dans HotLoop |

Un déluge devient un résumé, comme sur tous les autres canaux : les cinq premiers partent, puis un message liste le reste, avec autant de noms que possible et le nombre des autres, pour que le nombre ne soit jamais coupé.

Discord refuse un message trop long (2000 caractères de texte, 256 de titre, 4096 de description, 25 champs, 6000 au total), et un message refusé est un avertissement qui n'est pas parti. HotLoop coupe donc pour que ça tienne, sur une limite de caractère, avec `...` à l'endroit de la coupe.

### Personne n'est mentionné par accident

Chaque message part avec `allowed_mentions: {"parse": []}`. Sans cela, Discord prévient tout ce que le texte mentionne, donc une alarme que quelqu'un a nommée « @everyone tank overflow » réveillerait tout le serveur. Avec cela, rien dans le texte ne prévient personne. La seule exception est le rôle que vous configurez pour Critique (`..._CRITICAL_ROLE`), nommé explicitement comme seule mention autorisée, et seulement sur une alarme critique ou un résumé qui en contient une. Une notification de test ne mentionne jamais personne. Le texte propre de l'alarme est aussi échappé en Markdown, donc un nom contenant `*` s'affiche tel quel et un `<@&role>` dans un nom est montré, pas utilisé.

Pour que la mention fonctionne, le rôle doit être mentionnable : dans les réglages de rôles du serveur, activez **Autoriser tout le monde à mentionner ce rôle**, ou donnez au bot la permission **Mentionner @everyone, @here et tous les rôles**.

### Limites de débit et bannissements de Discord

Discord répond « trop vite » par un 429 et dit combien de temps attendre, dans le corps (`retry_after`, à la milliseconde) et dans `X-RateLimit-Reset-After`. C'est la durée que HotLoop attend avant de réessayer, dans la limite habituelle de trois tentatives et 30 secondes (voir « Nouvelles tentatives »). Quand Discord annonce que le budget est épuisé avant de refuser (`X-RateLimit-Remaining: 0`), l'envoi suivant attend la remise à zéro au lieu de provoquer un 429.

Discord bannit l'adresse de tout ce qui cumule 10 000 requêtes refusées (401, 403, 429) en dix minutes, et le bannissement emporte avec lui toutes les intégrations Discord de cette adresse. Donc, quand Discord répond **401, 403 ou 404** (un webhook faux ou supprimé, un mauvais jeton de bot, un canal que le bot ne voit pas), HotLoop **désactive ce canal** après cette seule requête. Il le journalise une fois, chaque alarme suivante est refusée sans requête (et auditée comme non envoyée, pour que « quelqu'un a-t-il été prévenu » garde une réponse), et cela apparaît dans `GET /api/diagnostics` sous `notify.channels`, avec la raison et le moment :

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Corrigez le réglage et redémarrez HotLoop. Un 500 ou l'absence totale de réponse ne désactive rien ; ils sont réessayés comme sur tout autre canal.

### Configurer le webhook

1. Dans Discord, ouvrez les réglages du canal (la roue dentée), **Intégrations**, **Webhooks**, **Nouveau webhook**. Nommez-le HotLoop. **Copier l'URL du webhook**.
2. Facultatif : un rôle à mentionner sur Critique. Activez le **Mode développeur** (Paramètres utilisateur, Avancés), puis faites un clic droit sur le rôle dans Paramètres du serveur, Rôles, et **Copier l'identifiant du rôle**. C'est un nombre, pas un nom.
3. Configurez-le et redémarrez :

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` envoie un message de test.

**Toute l'URL est le mot de passe.** Quiconque la détient peut publier dans votre canal en tant que webhook. HotLoop ne l'imprime jamais : ni dans le journal, ni dans une erreur, ni dans un événement d'audit, ni dans une réponse d'API, et une URL qui échoue à la validation au démarrage n'est pas non plus répétée dans cette erreur. Dans le chart Helm, elle va dans un Secret. Si elle fuit, supprimez le webhook dans Discord et créez-en un nouveau.

Un webhook ne peut pas porter un bouton qui fasse quoi que ce soit, donc il n'y a pas d'Acquitter ici. Le titre renvoie vers la liste d'alarmes de HotLoop. Pour des boutons, utilisez le bot.

### Configurer le bot

1. Allez sur le [portail développeur Discord](https://discord.com/developers/applications), **New Application**, nommez-la HotLoop. L'**Application ID** de la page General Information est ce dont le lien d'invitation a besoin.
2. Onglet **Bot** : **Reset Token** et copiez-le. Discord ne l'affiche qu'une fois. C'est `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. Sur la même page, désactivez **Public Bot**, pour que personne d'autre que vous ne puisse l'ajouter à un serveur, et laissez les trois **Privileged Gateway Intents** désactivés. HotLoop ne demande aucun événement à Discord (intents 0) ; les appuis de boutons arrivent quand même.
3. Invitez-le sur votre serveur avec le strict nécessaire, View Channels, Send Messages et Embed Links (permissions `19456`), et aucun autre scope que `bot` :

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Ajoutez **Mention @everyone, @here, and All Roles** (`permissions=150528`) seulement si le rôle Critique n'est pas mentionnable et que vous préférez ne pas le rendre tel. Modifier son propre message après un appui ne demande aucune permission ; cela passe par l'appui lui-même.
4. Le canal : avec le Mode développeur activé, faites un clic droit dessus, **Copier l'identifiant du salon**. Si le canal est privé, ajoutez-y le rôle du bot.
5. Les rôles qui peuvent presser les boutons. Créez un rôle (par exemple « Alarm ack »), donnez-le aux personnes qui peuvent acquitter depuis Discord, et copiez son identifiant. Mettre en attente retire une alarme de la liste pendant une heure, donc il a son propre réglage ; ce peut être le même rôle ou un plus restreint.
6. Configurez-le et redémarrez :

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. Le journal dit `connected to the Discord Gateway; Discord buttons work`, et `GET /api/diagnostics` affiche `"gateway": {"connected": true}` sous le canal `discord`. `POST /api/notify/test` publie un message de test (sans boutons, aucune alarme ne se trouve derrière).

**Tant que vous ne définissez pas les rôles, personne ne peut rien presser.** Avec `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` ou `_SHELVE_ROLES` vides, chaque appui sur ce bouton est refusé, la personne qui presse apprend quel réglage est vide, et HotLoop le dit au démarrage :

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

C'est voulu. Un bouton que n'importe qui sur le serveur peut presser n'est pas une valeur par défaut à livrer : les serveurs accumulent du monde.

**Qui a pressé.** Un acquittement depuis Discord est enregistré sous `discord:<username>#<user id>` (l'identifiant, car un nom d'utilisateur Discord peut changer et l'identifiant non), avec la note « acknowledged from Discord by alice (1010...) ». Pour l'enregistrer sous l'utilisateur HotLoop, associez-les : `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. L'association ne fait que nommer l'acteur. Elle ne vérifie pas les permissions de l'utilisateur HotLoop : c'est le rôle Discord qui décide qui peut presser.

**Mettre en attente** met en attente pour `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE`, une heure par défaut, 24 heures au plus comme toute mise en attente. C'est une durée fixe, pas un menu : à 03:00, un bouton qui fait une chose connue vaut mieux qu'une liste déroulante. Il refuse une alarme revenue à la normale (la mettre en attente cacherait ce qui la déclenchera ensuite) et une alarme déjà en attente.

Après un appui, le message dit qui a fait quoi et quand, et les deux boutons passent en gris, pour que la personne suivante qui regarde le canal voie que c'est pris en charge. Un appui refusé n'est répondu qu'à la personne qui l'a fait, avec la raison, et enregistré dans le journal système.

### Comment un appui est autorisé

La même mécanique que le lien Acquitter de ntfy (voir « Liens d'acquittement »), plus la parole de Discord sur qui a pressé :

- **Le bouton est signé.** Chaque bouton porte un jeton signé avec le même secret que les liens d'acquittement, pour cette action (acquitter ou mettre en attente, inscrite dans la signature, pour que l'une ne puisse pas être rejouée comme l'autre), sur cette alarme, déclenchée à ce moment. Discord autorise 100 caractères de données par bouton et un identifiant d'alarme peut en avoir 64, donc c'est une forme compacte de la même assertion : 8 octets d'heure de déclenchement, 4 d'expiration et un HMAC de 96 bits. En forger un revient à deviner 96 bits, un appui Discord par essai, depuis l'intérieur du serveur et avec le bon rôle.
- **La personne détient un rôle que vous avez nommé.** Discord indique au bot les rôles de la personne avec l'appui, par la connexion authentifiée du bot. Quiconque peut distribuer des rôles sur votre serveur peut distribuer celui-ci, donc traitez ces rôles comme la permission qu'ils sont.
- **L'occurrence est toujours courante.** Le moteur vérifie, sous son propre verrou, que le déclenchement actuel de l'alarme est celui du bouton. Le message d'hier ne peut pas acquitter le déclenchement d'aujourd'hui.
- **Une seule fois.** La première action sur une occurrence depuis n'importe quelle notification (ntfy ou Discord) est enregistrée et toutes les suivantes sont refusées. Deux personnes qui pressent en même temps : l'une gagne, l'autre en est informée.
- **Expiration.** Après `HOTLOOP_NOTIFY_ACK_TTL` (12 heures), les boutons cessent de fonctionner ; agissez dans HotLoop.

Le jeton du bot est un identifiant pour tout le bot. Il n'est jamais journalisé, jamais dans une erreur, jamais dans une réponse d'API ; dans le chart Helm, il va dans un Secret. Il en va de même pour le jeton d'interaction de chaque appui, que Discord donne au bot pendant quinze minutes pour y répondre. Si le jeton du bot fuit, réinitialisez-le dans le portail développeur.

### La connexion Gateway

Les appuis arrivent par le Gateway de Discord, un WebSocket que HotLoop ouvre vers Discord et garde ouvert. Le client est celui de HotLoop, sur [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, épinglée ; elle figurait déjà dans le graphe de dépendances de ce module, elle est petite et c'est la bibliothèque WebSocket la plus utilisée en Go). Nous n'avons pas pris une bibliothèque Discord comme discordgo : c'est un SDK Discord complet (REST, voix, cache d'état) pour le seul événement dont nous avons besoin, et ce projet n'embarque pas de SDK de fournisseurs. Le client :

- s'identifie avec les intents 0, donc Discord ne lui envoie que les appuis ;
- envoie des battements à l'intervalle que donne Discord, répond tout de suite à une demande de battement et traite un battement non acquitté comme une connexion morte ;
- reprend la session après une coupure, un Reconnect (op 7) ou une Invalid Session reprenable (op 9), donc un appui fait pendant la reconnexion est rejoué, pas perdu ; une session qui ne peut pas être reprise attend de une à cinq secondes et en démarre une nouvelle ;
- s'identifie au plus une fois toutes les cinq secondes, et pas du tout quand Discord dit que les démarrages de session du jour sont épuisés, jusqu'à leur remise à zéro ;
- se reconnecte avec une attente qui double d'une seconde à une minute ;
- s'arrête définitivement sur un jeton refusé ou des intents refusés, désactive le canal et l'affiche dans `/api/diagnostics`, plutôt que de se reconnecter sans fin.

Discord donne au bot trois secondes pour répondre à un appui, donc la première chose que fait HotLoop est de répondre « bien reçu » (une mise à jour différée), puis de faire le travail. Cette réponse est aussi ce qui empêche deux réplicas de HotLoop d'agir sur un même appui : les deux le reçoivent, Discord prend la première réponse et refuse la seconde, et le réplica refusé s'arrête. Exécuté comme assistant MCP (`--mcp-stdio`), HotLoop n'ouvre aucune connexion Gateway ; la vraie traite les appuis.

## Limites de débit et résumés

Une chute de tension ou un redémarrage d'automate déclenche quarante alarmes en une seconde. Un envoi par alarme fait bannir l'IP d'un webhook Discord, atteint la limite par IP de ntfy, et enfouit l'alarme qui compte sous trente-neuf qui ne comptent pas, sur le téléphone qui les reçoit. Donc chaque canal a un budget, un seau de jetons : une rafale qui peut partir d'un coup, puis un envoi de plus à chaque recharge.

| Canal | Rafale par défaut | Puis un toutes les |
|---|---|---|
| ntfy | 10 | 5 s (sous la limite propre de ntfy.sh de 60, puis un toutes les 5 s, par IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Webhook Discord | 5 | 2 s (Discord autorise à un webhook environ 5 requêtes toutes les 2 s, et à un canal 30 messages par minute) |
| Bot Discord | 5 | 2 s |

Changez-les par canal avec `HOTLOOP_NOTIFY_<CHANNEL>_BURST` et `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Ce que le budget permet part tout seul, tout de suite. Ce qu'il ne permet pas est retenu, et quand le prochain envoi est dû, tout ce qui est retenu part en **un seul** résumé :

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

Aucune alarme n'est perdue : le résumé les nomme toutes, jusqu'à 25, et compte le reste (« ...and 13 more »). Il est aussi grave que la pire alarme qu'il contient, et l'événement d'audit liste l'identifiant de chaque alarme qu'il représentait. Il n'a pas de bouton Acquitter, car il n'y a pas d'alarme unique qu'il pourrait acquitter. Si une seule alarme a été retenue, elle part sous sa propre forme, bouton compris. Dès que des alarmes sont retenues, les nouvelles rejoignent le lot même si le budget est revenu, de sorte qu'un résumé n'arrive jamais après une alarme déclenchée plus tard que tout ce qu'il contient. À l'arrêt, tout ce qui est encore retenu part d'un coup, hors budget : le choix est alors entre un envoi de trop et des alarmes dont personne n'est jamais informé.

Le budget est par canal, donc un déluge qui met le relais SMTP en file n'arrête pas ntfy, et le seuil de chaque canal s'applique toujours : une alarme Faible ne se retrouve jamais dans le résumé d'un canal réglé sur Élevée et au-dessus.

## Nouvelles tentatives

Un envoi qui reçoit un 429, un 5xx ou aucune réponse (refusé, réinitialisé, expiré) est retenté, trois tentatives au plus, toutes dans les 30 secondes qui suivent la première. Quand le récepteur dit combien de temps attendre (`Retry-After`, en secondes ou en date), on attend cette durée ; sinon une seconde, puis deux. Un récepteur qui demande plus que les 30 secondes restantes n'est pas attendu : l'échec est signalé tout de suite, en le disant. Après 30 secondes, mieux vaut signaler comme échoué un message qui n'est pas parti, dans le journal et la piste d'audit, que le retenter discrètement pendant des minutes alors que l'alarme reste là.

Tout autre 4xx (un mauvais jeton, un sujet où l'utilisateur ne peut pas écrire, une requête mal formée) n'est jamais retenté. La réponse sera la même à chaque fois tant que personne ne corrige la configuration, et Discord bannit une IP qui continue d'envoyer des requêtes qu'il a déjà refusées.

`POST /api/notify/test` fait exactement une tentative par canal. Un test demande ce que fait le canal maintenant, et une nouvelle tentative ferait paraître sain un récepteur instable.

## Liens d'acquittement

Le bouton Acquitter d'une notification ntfy est une requête vers `POST /api/notify/ack/{token}` sur `HOTLOOP_PUBLIC_URL`. La personne qui le presse à 03:00 n'est connectée à rien, donc **le jeton est toute l'autorisation**. Cela ne marche que si le jeton est infalsifiable, étroit, à usage unique et de courte durée, et chacun de ces points est appliqué :

- **Infalsifiable.** Le jeton est une assertion (quelle alarme, quand elle s'est déclenchée, quel canal, quand le lien expire) plus un HMAC-SHA256 de celle-ci avec un secret du serveur. Changez un octet, ou signez avec une autre clé, et il est refusé. Le secret est `HOTLOOP_NOTIFY_ACK_SECRET` si vous le définissez (32 caractères au moins ; `openssl rand -hex 32`). Sinon, HotLoop génère 32 octets aléatoires la première fois qu'il en a besoin et les garde dans sa base de données (la table `settings`, clé `notify.ackSecret`), donc les liens continuent de fonctionner après un redémarrage et tous les réplicas sont d'accord. Il n'est jamais affiché dans l'écran de réglages ni dans aucune réponse d'API. Il figure dans les sauvegardes de la base de données, comme tout le reste de la base ; si c'est un problème pour vous, définissez la variable depuis un Secret Kubernetes (`notify.ackSecret.existingSecret` dans le chart), et il ne touche jamais la base. Changer le secret invalide tous les liens déjà envoyés, ce qui est aussi la façon de tous les révoquer d'un coup.
- **Étroit.** L'assertion nomme une alarme **et le moment où elle s'est déclenchée**. Un bouton du déclenchement d'hier de la même alarme ne peut pas acquitter celui d'aujourd'hui, que personne n'a encore vu : le moteur vérifie, sous le même verrou que l'acquittement, que le déclenchement actuel de l'alarme est celui de l'assertion (`alarm.Engine.AckOccurrence`). Le lien peut acquitter et rien d'autre. Il ne peut ni mettre en attente, ni normaliser, ni écrire un tag, ni rien lire, donc le pire qu'un lien divulgué puisse faire est exactement ce qu'aurait fait l'appui sur le bouton.
- **Usage unique.** La première utilisation d'un lien pour une occurrence est enregistrée dans la base de données (`notify_ack_links`), et toute utilisation suivante est refusée, même quand l'alarme doit être acquittée de nouveau sans nouveau déclenchement (mise en attente alors qu'elle était encore en alarme, puis remise en service, elle revient non acquittée). L'état propre de l'alarme ne suffit pas pour cela ; l'enregistrement, si.
- **Courte durée.** Il expire, par défaut 12 heures après l'envoi (`HOTLOOP_NOTIFY_ACK_TTL`, 168 h au plus). Assez long pour « je regarde en arrivant », assez court pour qu'une capture d'écran de notification ne soit pas un identifiant permanent.

Un appui réussi est un acquittement ISA-18.2 ordinaire par le moteur d'alarmes, audité exactement comme un acquittement depuis l'écran d'alarmes : un événement d'alarme et une entrée du journal système avec l'acteur `notify:ntfy` et la note « acknowledged from the ntfy notification ». Les actions HTTP de ntfy ne disent pas quel téléphone a pressé le bouton, donc il n'y a pas de nom de personne à ajouter. Quand plusieurs personnes partagent un sujet, la piste d'audit dit que c'est le téléphone, pas qui. Le bot Discord connaît l'utilisateur et l'y inscrit (voir « Discord »).

Chaque refus est répondu avec ce qui n'a pas marché et enregistré dans le journal système sous `notify:<channel>` (ou `notify:ack-link` pour un jeton trop abîmé pour dire quel canal l'a envoyé), car un bouton qui ne fait rien en silence ne se distingue pas d'un bouton que personne n'a pressé :

| Réponse | Pourquoi |
|---|---|
| 403 | Falsifié, altéré ou signé avec un autre secret |
| 410 | Authentique mais expiré |
| 409 | Déjà utilisé, ou l'alarme s'est redéclenchée depuis, ou il ne reste rien à acquitter |
| 404 | L'alarme n'existe plus, ou les liens d'acquittement sont désactivés |

Le jeton lui-même n'est jamais journalisé, jamais placé dans un événement d'audit et jamais renvoyé par une API : tant qu'il est valide, c'est un identifiant. Il figure bien dans le message ntfy, forcément, donc quiconque peut lire votre sujet ntfy peut presser le bouton. Verrouillez le sujet.

Le point d'accès répond avec `Access-Control-Allow-Origin: *` pour que le bouton marche aussi depuis l'application web ntfy, qui le presse depuis sa propre origine. Cela ne donne rien : rien sur cette route ne lit un cookie ni une session.

## Escalade

Personne n'a acquitté l'alarme en N minutes, donc la personne suivante la reçoit. Le premier message part exactement comme toujours, vers chaque canal dont l'alarme atteint le seuil. L'escalade est ce qui se passe ensuite, si l'alarme est toujours là sans acquittement. Un message arrivé sur un téléphone que personne ne tenait est l'échec pour lequel cela existe : à 03:00, la personne d'astreinte dort, et l'alarme ne doit pas l'attendre.

Vous la configurez dans **Réglages, Escalade des alarmes**, ou par l'API (`GET` et `PUT /api/notify/escalation`). Elle est réservée aux administrateurs, car elle contient les sujets ntfy des personnes et décide qui on réveille. Contrairement aux canaux, lus dans l'environnement au démarrage de HotLoop, la politique est une donnée que vous modifiez et elle prend effet à l'enregistrement. Les canaux qu'elle peut utiliser sont ceux que le déploiement a déjà configurés. Rien de nouveau n'est ajouté à la liste de quatre, plus le webhook et l'e-mail.

### La politique

| Champ | <span class="sr-only">Détails</span> |
|---|---|
| `enabled` | Désactivée jusqu'à ce que vous l'activiez. Une politique désactivée n'escalade rien |
| `minPriority` | L'alarme la moins grave qui escalade : `critical`, `high`, `medium` ou `low`. Par défaut `high`. Une alarme Moyenne qui traîne depuis une heure est un ordre de travail, pas un appel à 03:00 |
| `contacts` | Les personnes. Chacune a un `name`, et un `ntfyTopic`, des `emails`, ou les deux. Jusqu'à 50 |
| `steps` | Jusqu'à 10. Chacune a `afterMinutes` (de 1 à 1440) et qui prévenir : `contacts` par nom, `channels` par nom, ou les deux |
| `repeatEveryMinutes`, `repeatTimes` | Après la dernière étape, renvoyer à cette fréquence, autant de fois en plus (20 au plus). Les deux à zéro pour ne pas répéter |

Une **personne** reçoit une notification à elle. Son `ntfyTopic` est un sujet du serveur ntfy sur lequel ce HotLoop publie déjà, avec le même identifiant, donc son téléphone s'abonne à un sujet qui n'est qu'à elle. Ses `emails` passent par le relais SMTP que HotLoop a déjà. Une personne avec un sujet demande ntfy configuré, et une avec une adresse demande l'e-mail configuré, et la politique est refusée en le disant s'ils ne le sont pas. Sur un serveur que tout le monde peut atteindre, un sujet est un mot de passe : choisissez-le long et aléatoire. L'API montre les sujets aux administrateurs et à personne d'autre, et ils ne figurent jamais dans le journal de bord, le journal système ni une erreur.

Un **canal** dans une étape est un de ceux du déploiement (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) et atteint tous ceux qui s'y trouvent : le canal Discord partagé, une application Gotify qu'une équipe partage, un webhook vers quelque chose qui prévient. La politique est refusée si une étape en nomme un que ce HotLoop n'a pas configuré, et la réponse liste ceux qu'il a.

### Quand les choses partent

Une étape est due `afterMinutes` après la précédente, et la première étape `afterMinutes` après le déclenchement de l'alarme. C'est une somme depuis le déclenchement, pas depuis la fin du dernier envoi, donc un relais lent ou un redémarrage n'étire pas le calendrier que vous avez écrit. Avec des étapes de 5 et 10 et une répétition de 15 minutes, deux fois :

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Ce qui l'arrête

La chaîne vaut pour une occurrence d'une alarme, et elle s'arrête, avec une ligne qui dit pourquoi, quand l'un de ces cas se produit :

- **Quelqu'un l'acquitte.** De n'importe où : l'écran d'alarmes, le bouton Acquitter sur ntfy ou Discord, l'API, une automatisation. Tous finissent dans le moteur d'alarmes, et avant chaque étape l'escaladeur demande au moteur si cette occurrence est toujours non acquittée. Un crochet qui arrive en retard ne peut pas lui faire prévenir pour une alarme que quelqu'un a déjà traitée.
- **Elle revient à la normale.** L'alarme est toujours dans la liste d'alarmes et attend un acquittement, mais personne n'est réveillé pour quelque chose qui s'est réglé tout seul. C'est un choix que nous avons fait exprès ; changez le seuil ou les étapes si vous en voulez un autre.
- **Elle est mise en attente.**
- **Elle se redéclenche.** C'est une nouvelle occurrence avec sa propre chaîne, comptée depuis son propre déclenchement. La chaîne d'hier ne prévient jamais pour l'alarme d'aujourd'hui.

Une alarme que quelqu'un traite avant l'échéance de l'étape 1 ne laisse aucune trace dans l'historique d'escalade, ce qui est le système qui fonctionne.

### Ce qui arrive

Une escalade est la notification propre de l'alarme avec son titre changé et une ligne ajoutée :

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Elle garde la priorité de l'alarme, donc une Critique reste en priorité maximale sur Android. Elle porte le même bouton Acquitter signé que le premier message sur ntfy et Discord (voir « Liens d'acquittement »), donc la personne qu'elle réveille peut acquitter depuis l'endroit où on l'a prévenue. Gotify et l'e-mail n'ont pas de bouton. Un webhook reçoit le JSON habituel de HotLoop avec `event` à `escalated`.

Un canal partagé est cadencé comme les autres (voir « Limites de débit et résumés »), donc une chute de tension qui laisse quarante alarmes non acquittées escalade en un seul résumé, « 40 alarms nobody has acknowledged », pas quarante messages et un bannissement. La notification propre à une personne est un envoi à part.

### La piste d'audit

Chaque escalade est une ligne dans l'historique propre de l'alarme, que lit le [journal de bord](/fr/iot/logbook/), donc elle y apparaît sans réglage supplémentaire, classée sous l'alarme avec l'acteur `escalation` :

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` et le type `alarm` du journal de bord portent les mêmes lignes sous les types `escalated` et `escalation-ended`. Une étape qui n'a joint personne le dit en majuscules (`NOBODY WAS REACHED`) avec chaque échec à la suite, et la chaîne passe quand même à l'étape suivante : un relais en panne ne doit pas arrêter le message qui part par une autre voie. L'enregistrement de la politique figure dans le journal système sans les sujets.

### Redémarrages, et où cela s'exécute

Les chaînes vivent en mémoire, donc un redémarrage à 03:00 au milieu de l'une d'elles ne doit pas la faire perdre. Au démarrage, HotLoop regarde chaque alarme encore non acquittée, lit combien d'étapes les lignes d'audit disent être parties pour cette occurrence, et reprend à partir de là : il ne renvoie pas l'étape 1 et ne saute pas l'étape 2. Une étape arrivée à échéance pendant l'arrêt de HotLoop part dans les premières secondes après son retour. Une étape en cours quand le processus a été tué peut partir deux fois, ce qui est le bon sens de se tromper pour une alarme.

Une politique enregistrée s'applique aux alarmes déclenchées après l'enregistrement. Un redémarrage reprend toute alarme encore non acquittée, quelle que soit l'heure de son déclenchement.

Le Gateway l'exécute. Un assistant `--mcp-stdio` non, donc une alarme n'est jamais escaladée par deux processus.

## TLS sur le canal SMTP

Le canal passe en TLS par STARTTLS automatiquement dès que le relais annonce l'extension, quel que soit le réglage ci-dessous. Ce n'est pas un comportement facultatif à activer : `net/smtp.PlainAuth` de Go refuse de transmettre un nom d'utilisateur et un mot de passe sur une connexion qui n'est pas déjà TLS (ou vers un serveur qui s'appelle littéralement `localhost`), et pratiquement tout fournisseur réel qui exige une authentification, Gmail, SendGrid, Mailgun, le relais d'un fournisseur d'accès, exige STARTTLS sur le port 587 ou du TLS implicite sur le 465 (voir plus bas) pour y arriver. Un relais sans authentification configurée, accessible sur un réseau isolé, peut ne pas offrir STARTTLS du tout, et ce canal ne l'exige pas dans ce cas.

`HOTLOOP_NOTIFY_SMTP_TLS` n'active pas la montée en TLS, il transforme son *absence* en échec franc : s'il est défini et que le relais n'annonce pas STARTTLS, `Send` refuse avant de tenter `AUTH`, au lieu de s'authentifier discrètement en clair auprès d'un relais qui se trouve simplement joignable comme `localhost`. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` saute la vérification du certificat lors de la montée en TLS, la même échappatoire que `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` et `HOTLOOP_FLEET_TLS_SKIP_VERIFY` offrent déjà pour leurs propres connexions MQTT, pour un relais qui présente un certificat auto-signé.

### TLS implicite, port 465

Un relais sur le port 465 attend que toute la connexion soit en TLS dès le premier octet (RFC 8314), pas un accueil en clair suivi d'une montée en TLS. HotLoop ne faisait autrefois que la montée en TLS, donc sur le 465 la première chose qu'il disait était du clair à un relais qui attendait une négociation TLS, et l'envoi mourait. Maintenant **le port 465 est en TLS implicite** et tous les autres ports sont en STARTTLS comme avant, sans aucun réglage à toucher :

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Si un relais fait du TLS implicite sur un port à lui, ou parle STARTTLS sur le 465, `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` dit lequel, `true` ou `false`, et l'emporte sur le port. Dans le chart Helm, définissez-le sous `extraEnv`. Tout le reste est identique dans les deux cas : le nom d'utilisateur et le mot de passe passent sur la connexion chiffrée, `HOTLOOP_NOTIFY_SMTP_TLS` est satisfait par elle (il n'y a rien à exiger) et `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` saute la vérification du certificat lors de sa négociation. Le certificat du relais est vérifié sauf si vous le désactivez. Les rapports planifiés utilisent les mêmes réglages de relais, donc la même règle.

Si la négociation échoue, l'erreur le dit et nomme `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, ce dont a besoin un relais qui démarre en clair.

Éprouvé contre une vraie bibliothèque de serveur SMTP avec un écouteur TLS seul, et contre Mailpit lancé avec `--smtp-require-tls`, la version épinglée du laboratoire v1.31.2. Non vérifié contre le point 465 d'un fournisseur commercial.

## Un seul chemin SMTP, partagé avec les rapports planifiés

Depuis la version 4.14.0, le canal d'alarme envoie par `notify.SendMessage`, une fonction générale qui envoie un message, avec des pièces jointes facultatives, à une liste de destinataires. Les rapports planifiés (voir [Rapports planifiés](/fr/gateway/reports/)) envoient leurs fichiers CSV et HTML par la même fonction et les mêmes réglages de relais (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), donc il y a un seul endroit qui se connecte, monte en STARTTLS, s'authentifie et décide ce qu'un en-tête peut contenir. Seul le relais est partagé : `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` et `HOTLOOP_NOTIFY_SMTP_TO` concernent les alarmes, et un relais configuré pour les rapports n'active pas le canal d'alarme.

Deux comportements de l'e-mail d'alarme ont changé, tous deux dans le sens de la sécurité. L'expéditeur et chaque destinataire sont maintenant validés comme adresses simples avant toute connexion, alors qu'auparavant une adresse mal formée échouait au relais. Et un objet avec des caractères non ASCII est envoyé comme mot codé RFC 2047 au lieu d'UTF-8 brut. Un nom d'alarme qui contient un caractère de contrôle est aplati en espaces plutôt que refusé, parce qu'un message doit partir quel que soit le nom de l'alarme.

## Seuils de priorité

Chaque canal a son propre `MinPriority`, la priorité d'alarme la moins grave pour laquelle il se déclenche encore. `model.AlarmPriority` va de 1 (Critique, la plus grave) à 4 (Faible), donc « Élevée et au-dessus » est `MinPriority = 2` : une alarme atteint le seuil d'un canal quand son propre numéro de priorité est inférieur ou égal au seuil. Un webhook configuré pour Critique seulement et un relais SMTP configuré pour Moyenne et au-dessus peuvent surveiller le même moteur d'alarmes et se déclencher sur des ensembles d'alarmes entièrement différents ; rien n'exige qu'ils s'accordent.

## Ce que ce n'est pas

**Pas un rechargement à chaud des canaux.** Les canaux sont lus une fois, depuis la configuration, au démarrage du processus, comme `EdgePublishConfig` et `FleetConfig`. Changer `HOTLOOP_NOTIFY_*` demande un redémarrage pour prendre effet, et il n'y a pas d'API pour ajouter ou retirer un canal à l'exécution dans ce MVP. La politique d'escalade est l'exception : qui est prévenu ensuite, et quand, est une donnée que vous modifiez et elle prend effet à l'enregistrement (voir « Escalade »).

**Pas une table à part.** Chaque tentative de notification, réussie ou non, est écrite par `runtime.Manager.Event`, le même mécanisme générique d'événements d'audit par lequel passent déjà toutes les actions d'alarme et de flotte. Il n'y avait pas lieu d'inventer une table `notifications` dédiée pour une fonction de cette taille ; le journal système répond déjà à « une notification a-t-elle été envoyée, et a-t-elle marché ».

**Pas une file durable.** Les nouvelles tentatives sont bornées (trois tentatives, 30 secondes, voir « Nouvelles tentatives ») et les alarmes retenues vivent en mémoire jusqu'au départ de leur résumé. Un message qui échoue toujours est journalisé et audité et le répartiteur passe à la suite. Une alarme qui reste déclenchée parce que personne ne l'a acquittée reste visible dans l'écran d'alarmes et dans `alarm_events`, qu'un message soit arrivé ou non : la notification est un confort au-dessus du système d'alarmes, pas un remplacement.

## Configuration

| Variable | Par défaut | <span class="sr-only">Détails</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | La fonction est désactivée tant que ceci n'est pas défini |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Obligatoire quand le canal webhook est activé. Doit être `http://` ou `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low`, ou `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Obligatoire quand le canal SMTP est activé |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Facultatif. Omettez les deux pour un relais anonyme |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Obligatoire quand le canal SMTP est activé |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Obligatoire quand le canal SMTP est activé. Adresses séparées par des virgules |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Exiger que le relais offre STARTTLS ; voir « TLS sur le canal SMTP » plus haut, STARTTLS est utilisé automatiquement dès qu'il est offert, quel que soit ce réglage |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Saute la vérification du certificat lors de la montée en STARTTLS, ou lors de la négociation du TLS implicite. Choix propre à chaque déploiement ; ne l'activez jamais par défaut |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` sur le port 465, sinon `false` | TLS dès le premier octet au lieu de STARTTLS ; voir « TLS implicite, port 465 ». Définissez-le pour passer outre le port |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | Mêmes valeurs que celles du webhook |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Obligatoire. Le serveur seul, `https://ntfy.example.com`, sans chemin |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Obligatoire. De 1 à 64 lettres, chiffres, `-` et `_`. Sur un serveur public, c'est le mot de passe |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Un jeton d'accès ntfy (`tk_...`), envoyé comme jeton bearer |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Authentification basique à la place d'un jeton. Pas les deux |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Met un bouton Acquitter sur chaque alarme (demande `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | Mêmes valeurs que celles du webhook |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Obligatoire. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Obligatoire. Le jeton d'application que Gotify vous a donné pour HotLoop |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | Mêmes valeurs que celles du webhook |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Obligatoire. L'URL que donne Copier l'URL du webhook de Discord. Elle tout entière est le mot de passe |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | Un identifiant de rôle à mentionner sur les alarmes critiques |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | Mêmes valeurs que celles du webhook |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Obligatoire. Le jeton du bot, seul, sans `Bot ` devant |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Obligatoire. L'identifiant du canal où publier |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Identifiants de rôle séparés par des virgules dont les membres peuvent presser Acquitter. **Vide veut dire personne** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Pareil pour Mettre en attente. **Vide veut dire personne** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, séparés par des virgules : ceux dont les actions sont enregistrées sous leur nom HotLoop |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | La durée de la mise en attente. `24h` au plus |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | Un identifiant de rôle à mentionner sur les alarmes critiques |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | Mêmes valeurs que celles du webhook |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Seulement pour faire passer les requêtes du bot par un proxy |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | selon le canal | La limite de débit ; voir « Limites de débit et résumés ». `<CHANNEL>` est `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` ou `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | L'adresse par laquelle un téléphone joint HotLoop, chemin de base compris. Nécessaire pour toucher pour ouvrir et pour le bouton Acquitter |
| `HOTLOOP_NOTIFY_ACK_SECRET` | généré | Signe les liens d'acquittement. Au moins 32 caractères. Non défini : généré une fois et gardé dans la base de données |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Combien de temps un lien d'acquittement fonctionne. `168h` au plus |

Dans le chart Helm, ils se trouvent sous `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` et le `publicUrl` de premier niveau. Les jetons, mots de passe et l'URL du webhook Discord vont dans un Secret que gère le chart, ou nommez le vôtre avec `existingSecret`.

## API

| Route | Permission | <span class="sr-only">Détails</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Envoie tout de suite une notification de test synthétique par chaque canal configuré |
| `POST /api/notify/ack/{token}` | aucune ; le jeton est l'autorisation | Acquitte l'occurrence d'alarme pour laquelle le jeton a été émis. Voir « Liens d'acquittement » |
| `GET /api/notify/escalation` | `notify.escalation` | La politique d'escalade, les canaux qu'une étape peut nommer et les chaînes ouvertes en ce moment. Voir « Escalade » |
| `PUT /api/notify/escalation` | `notify.escalation` | Remplace toute la politique. Refusée avec la raison si une étape ne nomme personne ou nomme un canal non configuré |
| `GET /api/diagnostics` | `status.read` | Sous `notify.channels`, l'état de chaque canal : si Discord l'a refusé (et pourquoi, et depuis quand), et la connexion Gateway du bot Discord |

`notify.escalation` est réservée aux administrateurs de la même façon. Lire la politique la demande aussi, car elle contient les sujets ntfy des personnes.

`notify.test` est réservée aux administrateurs, accordée par le joker que le rôle d'administrateur porte déjà et volontairement non ajoutée à la liste des permissions du rôle d'opérateur : envoyer un vrai message externe et dépenser le quota que permet un fournisseur d'astreinte ou un relais SMTP ressemble plus à `fleet.restart` et `fleet.config` (aussi réservées aux administrateurs, aussi « faire quelque chose vers l'extérieur tout de suite ») qu'à une lecture, le même resserrement que cette application applique déjà à ces deux-là.

La réponse indique le résultat propre de chaque canal plutôt qu'un simple succès ou échec de la requête :

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Ce qui a été vérifié et ce qui ne l'a pas été

HotLoop a été exécuté contre de vrais équipements et de vrais serveurs, et sur machine nue le 2026-11-17.
