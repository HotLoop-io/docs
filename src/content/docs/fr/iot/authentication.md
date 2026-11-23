---
title: "Authentification et utilisateurs"
description: "Connexions, rôles, jetons et écran des utilisateurs, et ce qu'un déploiement derrière un proxy de confiance doit déclarer clairement pour s'en passer."
---

HotLoop a sa propre connexion depuis la 4.4.0, et chaque produit l'exige par défaut. On peut toujours s'en passer, délibérément, pour un déploiement réellement isolé derrière le dashboard et qui veut le déclarer, voir [Fonctionner sans connexion](#fonctionner-sans-connexion), mais un simple `helm install` ou une unité Podman Quadlet démarre désormais en l'exigeant.

## L'essentiel

- **Utilisateurs locaux, mots de passe bcrypt, sessions côté serveur.** Pas encore de fournisseur d'identité externe ; voir [MCP](/fr/iot/mcp/) pour le périmètre distinct à jeton bearer qui protège l'interface des agents, et que ceci ne remplace pas.
- **Trois rôles : admin, operator, viewer.** Le rôle admin peut tout faire, y compris gérer les utilisateurs. Le rôle operator peut tout lire et écrire des tags, acquitter des alarmes et déclencher des automatisations. Le rôle viewer peut tout lire et rien d'autre. On peut aussi donner à un utilisateur une liste de permissions explicite à la place d'un rôle, pour tout besoin plus restreint.
- **Une session est un cookie ou un jeton bearer**, selon ce qui est le plus simple pour le client. L'interface du navigateur utilise le cookie ; un script ou un autre service utilise `Authorization: Bearer <token>`.
- **Un panneau partagé ouvre la session avec un PIN ou un badge** et la ferme quand personne ne le touche, si bien que chaque écriture porte le nom d'une personne. Voir [Panneaux kiosque](#panneaux-kiosque--pin-ou-badge-et-déconnexion-à-linactivité).
- **Les sessions expirent.** `HOTLOOP_AUTH_SESSION_TTL`, 12 heures par défaut. Il n'y a pas de « se souvenir de moi » : une session qui dépasse un poste de travail est une session que personne ne surveille.

## Obtenir le premier compte

Le chart en génère un à la première installation et ne l'affiche qu'une fois, dans la sortie NOTES de `helm install` :

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Si vous lancez directement le binaire, générez un hash et définissez deux variables :

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` accepte aussi `-password` directement, pour un script qui en a déjà un :

```sh
hotloop hash-password -password 'something-long'
```

Le compte admin ainsi créé est une **amorce**, pas un interrupteur de réinitialisation. Une fois qu'il existe, modifier `HOTLOOP_ADMIN_PASSWORD_HASH` et redémarrer ne fait rien : `EnsureAdminUser` ne crée le compte que si ce nom d'utilisateur n'existe pas déjà, de sorte qu'une valeur ici ne peut jamais écraser un mot de passe qu'un opérateur a changé depuis dans l'interface. C'est surtout important lors d'une mise à niveau Helm : réappliquer le même `values.yaml` ne doit pas rétablir en silence le mot de passe de quelqu'un.

## Rôles

| Rôle | Ce qu'il peut faire |
|---|---|
| **admin** | Tout : `*`. Y compris créer, désactiver et supprimer des utilisateurs. |
| **operator** | Lire tous les écrans. Écrire des tags (`POST /api/write`) et commander des entités (`POST /api/services/...`), définir des helpers (`helpers.write`, voir [Helpers](/fr/iot/helpers/)), lancer et arrêter des scripts (`scripts.run`, voir [Scripts](/fr/iot/scripts/)), appliquer des recettes (`recipes.apply`, voir [Recettes](/fr/iot/recipes/)), créer une règle à partir d'un blueprint et la mettre à niveau (`blueprints.apply`, voir [Blueprints](/fr/iot/blueprints/)), voir les dashboards proposés au rôle (`dashboards.read`, voir [Dashboards](/fr/iot/dashboards/)), lire l'énergie consommée et ce qu'elle a coûté (`energy.read`, voir [Énergie](/fr/iot/energy/) ; créer un compteur ou un tarif relève de `energy.write`, réservé à un admin), réorganiser le tableau, acquitter, mettre en attente et rétablir des alarmes, déclencher des automatisations. Ne peut pas modifier les *définitions* des appareils, tags, alarmes, automatisations, scripts, recettes, blueprints ou dashboards, et ne peut pas gérer les utilisateurs. |
| **viewer** | Lire tous les écrans. Rien d'autre. |

On peut donner à un utilisateur une liste `permissions` explicite à la place d'un rôle, qui **remplace** entièrement le rôle au lieu de s'y ajouter : un utilisateur est soit « le rôle operator », soit « exactement ces permissions », jamais les deux, de sorte qu'il n'y a qu'un seul endroit où regarder pour savoir ce que quelqu'un peut faire.

Les chaînes de permission ont la forme `resource.action`, `tags.write`, `alarms.ack`, ou un joker de ressource, `tags.*`, ou le joker global `*`.

## Panneaux kiosque : PIN ou badge, et déconnexion à l'inactivité

Sur votre propre ordinateur, vous êtes déjà connecté : vous avez saisi votre mot de passe une fois, et une écriture passe directement par la porte d'écriture et vous est attribuée, comme toujours. Rien n'a changé à ce sujet. Un panneau au mur n'est l'ordinateur de personne. S'il est connecté en tant que `panel-3`, la piste d'audit indique « panel-3 a ouvert la vanne », ce qui n'est pas une piste d'audit. Un panneau ouvre donc la session d'une personne avec un PIN ou un badge, chaque écriture est celle de cette personne, et le panneau la déconnecte quand personne ne le touche.

### Ce que voit l'opérateur

Un panneau est un écran physique : HotLoop ouvert sur `/?screen=<name>` (voir [Dashboards](/fr/iot/dashboards/#rôles-et-écrans)). Sans personne de connecté, il n'affiche qu'un champ, « PIN ou badge », et rien de l'usine. Saisissez le PIN et appuyez sur Entrée, ou passez le badge. Le panneau ouvre son dashboard, avec la personne connectée et un bouton **Se déconnecter** dans le coin, car l'en-tête qui l'indiquerait normalement n'existe pas sur un panneau. Un appui sur un bouton d'écriture demande la confirmation et le motif comme ailleurs, et l'écriture est enregistrée au nom de cette personne.

Une fois la limite d'inactivité atteinte sans que personne ne touche l'écran, le panneau déconnecte la personne et revient au champ du PIN. Le serveur l'applique en plus de la page : une session kiosque restée inactive aussi longtemps est supprimée, et une écriture envoyée ensuite avec son cookie est refusée avec un `401`, si bien que fermer la page, ou une page figée, ne laisse personne connecté. S'il faut utiliser le panneau avec un mot de passe, « Utiliser un mot de passe » sous le champ est la connexion ordinaire, avec les 12 heures habituelles et sans limite d'inactivité, parce que c'est la connexion personnelle de quelqu'un.

Compte comme toucher : un appui, un clic, une touche ou une écriture. Ne compte pas : le dashboard qui rafraîchit ses valeurs, ni le flux en direct, qui continuent qu'il y ait quelqu'un ou non.

### Mise en place

Un admin donne à chaque personne un code dans **Paramètres, Utilisateurs** : **PIN ou badge** sur sa ligne, le code deux fois, **Enregistrer**. Ou par l'API, ce que ferait un script qui émet des badges :

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **Un PIN est un identifiant.** Il est stocké sous forme de hash bcrypt au même coût qu'un mot de passe, jamais en clair, jamais dans le journal système et jamais dans une réponse. La liste des utilisateurs indique seulement `hasPin`. Une sauvegarde conserve les hashes exactement comme ceux des mots de passe ([Sauvegardes et restauration](/fr/iot/backup/)).
- **Un badge est une valeur que tape un lecteur de type clavier.** Il n'y a pas de pilote matériel. Un lecteur qui se comporte comme un clavier tape le numéro du badge dans l'unique champ du panneau et appuie sur Entrée, ce qui valide le formulaire. Un badge est donc un code comme un PIN : ce que tape le lecteur, de 6 à 72 caractères sans espaces, défini sur le compte au même endroit. La lecture depuis un lecteur qui ne se comporte pas comme un clavier n'est pas réalisée.
- **Un code, un compte.** Le panneau retrouve la personne par le code seul, puisqu'un lecteur de badge ne tape pas de nom d'utilisateur, donc définir un code qu'un autre compte possède déjà est refusé.
- **Le code est vérifié face à chaque compte qui en a un,** avec le même bcrypt que coûte un mot de passe, parce qu'un hash salé ne peut pas être recherché par valeur. Cela prend autant de temps qu'il y a de comptes avec un code, quelques secondes au pire avec des dizaines, et autant que le code soit bon ou mauvais.
- **Un code ouvre la session avec le rôle du compte.** Donnez-le à quelqu'un dont le rôle est celui qu'il doit avoir à un panneau. Une session kiosque a les permissions du compte et rien de plus étroit, et le code d'un viewer ouvre une session viewer, dont la porte refuse les écritures comme toujours.
- **Désactiver un compte** met fin à ses sessions de panneau comme aux autres, et le code d'un compte désactivé n'ouvre plus de session. **Retirer le code** déconnecte le compte des panneaux et laisse tranquilles son mot de passe et la session de son propre ordinateur.

### Le délai de déconnexion à l'inactivité

Quinze minutes par défaut. C'est assez long pour mener un changement de série au panneau avec un porte-bloc, ou pour aller jusqu'à la vanne et la voir bouger, et assez court pour qu'un panneau laissé à la fin d'un travail ne porte pas encore le nom de quelqu'un quand la personne suivante arrive. C'est mon jugement, pas un chiffre que le code ou une norme impose. Modifiez-le dans **Paramètres, Usine, Déconnexion du kiosque à l'inactivité (secondes)**, de 10 secondes à 12 heures, sans redéploiement, ou définissez une valeur par défaut avec `HOTLOOP_AUTH_KIOSK_IDLE` (une durée, `15m`). Ce qui est défini dans Paramètres l'emporte sur la variable. La session se termine aussi à `HOTLOOP_AUTH_SESSION_TTL`, comme toute session.

### Le verrouillage après des mots de passe et des PIN erronés

Un mot de passe ou un PIN erroné est compté sur le **compte** sur lequel il a été essayé. Dix erreurs de suite verrouillent ce compte pendant cinq minutes, et aucun autre. Un bon mot de passe ou PIN avant le dixième remet le compte à zéro, et un verrouillage arrivé à son terme redonne dix essais. Un compte verrouillé refuse une connexion quoi qu'on saisisse, juste ou faux, avec un `429` qui indique combien de temps attendre. Un verrouillage arrête les nouvelles connexions et rien d'autre : une session que le compte a déjà continue, avec ses requêtes et son flux en direct, de sorte que dix mauvaises tentatives d'une autre personne ne peuvent pas rendre muet l'écran d'un opérateur sur la ligne. Il s'applique aussi bien à la connexion par mot de passe qu'à celle par PIN, et chaque verrouillage est dans le journal système (catégorie `auth`).

- **D'où viennent les chiffres.** NIST SP 800-63B dit qu'un vérificateur limite les tentatives échouées consécutives sur un même compte : la révision 3, section 5.2.2, et la révision 4, section 3.2.2, fixent toutes deux le maximum à 100 et disent qu'un opérateur peut le fixer plus bas. La révision 4 permet aussi de faire attendre le demandeur après des échecs. C'est cette attente, pas une désactivation définitive. Dix est un dixième du plafond du NIST, et plus que ce que personne ne se trompe par accident. Cinq minutes, c'est assez long pour que dix essais par cinq minutes tiennent hors de portée le million de possibilités d'un PIN de six caractères (environ 350 jours pour tous les essayer), et assez court pour qu'un opérateur qui s'est trompé de mot de passe soit de retour après un café. Six caractères au minimum pour un PIN, c'est le plancher de la section 5.1.1.2 de la révision 3 pour un secret attribué, ce que représente un PIN remis par un admin. Dix et cinq sont mon choix dans la limite du NIST, pas des chiffres du NIST.
- **Les deux sont des paramètres.** **Paramètres, Usine** : « Verrouiller un compte après ce nombre de mots de passe ou PIN erronés » (10 par défaut, de 1 à 100, et 0 le désactive) et « Durée de verrouillage d'un compte » (5 minutes par défaut, de 10 secondes à un jour). Les variables sont `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` et `HOTLOOP_AUTH_LOCKOUT_DURATION` (une durée, `5m`). Le paramètre l'emporte sur la variable.
- **Un admin peut déverrouiller un compte.** **Paramètres, Utilisateurs** affiche un compte verrouillé comme `locked` avec un bouton **Déverrouiller**, ou `DELETE /api/users/{username}/lockout`. Le compte repart de zéro.
- **Jamais le panneau.** Un mauvais code saisi à un panneau n'est jamais compté contre le panneau, si bien que les erreurs d'une personne n'empêchent pas la suivante.
- **Un code seul ne peut pas être compté, donc le panneau est ralenti.** Un lecteur de badge ne tape que le badge, et un PIN tapé seul ne correspond à aucun compte quand il est faux, donc il n'y a pas de compte sur lequel le compter. Le compter contre le panneau enfermerait dehors le travailleur suivant pour les erreurs du précédent, et le panneau n'est jamais verrouillé. À la place, chaque erreur consécutive fait attendre ce panneau une demi-seconde de plus avant de vérifier la suivante : 0,5 seconde après la première erreur, 1 après la deuxième, et ainsi de suite jusqu'au plafond, 3 secondes par défaut. Un bon code repart de zéro. Le travailleur suivant entre donc au plus après le plafond, et quelqu'un qui devine est limité à un essai par plafond et par panneau : un million de PIN à six chiffres prendrait plus d'un mois. Les essais envoyés ensemble font la queue et chacun attend son tour. Un PIN tapé avec son nom d'utilisateur n'est pas ralenti ; il est celui du compte, et le verrouille comme un mauvais mot de passe. L'attente maximale se règle dans **Paramètres, Usine, Attente maximale d'un panneau après des PIN erronés (secondes)**, de 0 à 30, avec `HOTLOOP_AUTH_PANEL_DELAY_CAP` comme valeur par défaut (une durée, `3s`) et 0 pour la désactiver. Trois secondes, c'est une pause que supporte un travailleur qui s'est trompé, et assez lente pour gêner quelqu'un qui essaie tous les codes. Le pas d'une demi-seconde est fixe.
- **Quel panneau est lequel.** L'adresse du client : le premier saut de `X-Forwarded-For` quand un proxy en a défini un, sinon celle de la connexion elle-même, ce qui est aussi ce qu'enregistre la liste des sessions. On ne connaît rien de mieux avant la connexion : il n'y a pas encore de session, et un cookie remis par le serveur est un cookie que le client peut jeter pour relancer l'attente. Derrière un proxy qui définit `X-Forwarded-For`, chaque panneau attend donc pour son compte. Derrière un proxy qui ne le fait pas, tous les panneaux partagent l'adresse du proxy et se ralentissent mutuellement, au plus du plafond. Et un client qui atteint directement le port peut envoyer son propre `X-Forwarded-For` et esquiver l'attente. C'est pourquoi il s'agit d'un ralentissement et que le verrouillage du compte est le contrôle : pour une devinette qui compte, utilisez la forme avec nom d'utilisateur, ou de longues valeurs de badge aléatoires.
- **Il révèle que le compte existe.** Le `429` s'adresse à un compte qui existe, il indique donc à quelqu'un qui essaie des noms lesquels existent. C'est ce qu'est un verrouillage.

### Ce qu'il ne fait pas

- **Un code seul ne peut pas être verrouillé.** Voir [Le verrouillage](#le-verrouillage-après-des-mots-de-passe-et-des-pin-erronés), qui explique pourquoi.
- **Aucun avertissement avant la déconnexion.** Le panneau revient au champ du PIN quand le temps est écoulé.
- **Un panneau laissé connecté avec un mot de passe** (comme il fallait l'exploiter avant) fonctionne comme avant et écrit toujours en tant que ce compte. Ne donnez à un panneau partagé aucune connexion d'opérateur permanente ; donnez des PIN aux personnes qui l'utilisent.
- **Pas de pilote de lecteur, pas de SSO, pas de permissions par panneau.**

## Gérer les utilisateurs

Réservé aux admins. Dans l'interface, c'est **Paramètres, Utilisateurs** : chaque compte avec son rôle, s'il est actif et sa dernière connexion, avec Ajouter un utilisateur, Modifier (le rôle, et le désactiver), Nouveau mot de passe et Supprimer. Rien n'est affiché pour qui n'a pas `users.manage`, ni quand l'authentification est désactivée. Un compte dont les permissions ont été énumérées une à une apparaît comme `custom` avec leur nombre, et Modifier conserve la liste sauf si vous choisissez un rôle, qui la remplace. Les mêmes opérations par l'API REST :

Un mot de passe fait de 8 à 72 octets : 72 est la limite propre à bcrypt, et un mot de passe plus long est refusé en le disant. Cela fonctionne de la même façon via OPC UA (voir [Le serveur OPC UA](/fr/edge/opc-ua-server/#who-may-log-in)) ; dans les versions antérieures, un mot de passe de plus de 64 octets pouvait ouvrir une session ici et pas là.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

Deux refus méritent d'être connus avant de surprendre quelqu'un :

- **Vous ne pouvez pas supprimer votre propre compte tant que vous êtes connecté avec.** Passez d'abord à un autre compte admin.
- **Vous ne pouvez pas désactiver ni supprimer le dernier compte admin actif.** Promouvez un deuxième compte en admin, ou laissez-en un tranquille, avant de retirer le premier. Sans cette vérification, une seule erreur dans une synchronisation scriptée des utilisateurs est un verrouillage sans aucune session admin d'où le défaire.

Tout utilisateur connecté peut changer son propre mot de passe sans aucune de ces deux restrictions :

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

Un changement de mot de passe révoque toutes les sessions que ce compte détient, y compris celle qui a fait la requête. Le client est censé se reconnecter.

## Les identifiants d'appareil sont en écriture seule

Ajouté en 4.15.1. Avant, `GET /api/devices` et `GET /api/devices/{id}` renvoyaient le `config` et l'`address` d'un appareil exactement tels que stockés, de sorte que n'importe quel utilisateur connecté, viewers compris, pouvait lire le mot de passe du broker MQTT, les identifiants HTTP et MTConnect, et tout ce qui était enregistré dans un appareil. La 4.15.0 ne masquait que le mot de passe OPC UA. Depuis la 4.15.1, les identifiants d'un appareil ne peuvent être relus par l'API par aucun rôle, **admin compris**. Pour en changer un, vous envoyez une nouvelle valeur.

### Ce qui compte comme identifiant

| Protocole | Masqué dans la configuration | Aussi masqué |
|---|---|---|
| MQTT | `password` | les informations d'utilisateur et les valeurs secrètes de la requête dans l'adresse (`mqtt://user:pass@broker`) |
| HTTP | `password` ; chaque valeur de `headers` sauf quelques-unes ordinaires (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`) ; `body` et `writeBody` quand ils mentionnent un identifiant (`password`, `token`, `apiKey`, et semblables) ; une valeur de requête d'allure secrète dans `writeUrl` | les informations d'utilisateur et les valeurs secrètes de la requête dans l'adresse et dans `writeUrl` |
| MTConnect | `password` ; chaque valeur de `headers`, avec les mêmes exceptions | les informations d'utilisateur et les valeurs secrètes de la requête dans l'adresse |
| OPC UA | `password` | les informations d'utilisateur dans l'adresse sont aussi masquées, et le pilote les ignore, puisqu'une URL de point de terminaison OPC UA ne porte pas d'identifiants |
| Modbus, S7comm, EtherNet/IP | aucune de leurs options n'est un identifiant | les informations d'utilisateur dans l'adresse sont masquées et ignorées par le pilote, pour la même raison |

Un chemin vers un fichier de clé (`keyFile`) n'est pas du matériel de clé et s'affiche. Un indicateur comme `allowInsecureCredentials` non plus.

Les listes ci-dessus sont vérifiées dans le code. Un test lit la structure d'options de chaque pilote et échoue quand une option ne figure ni dans la liste des identifiants ni dans celle des options connues pour n'en être pas un (`plainConfigKeys`), quand une table d'entrées libres ou un champ de texte libre ne figure pas dans la liste des identifiants, et quand l'une ou l'autre liste nomme quelque chose qu'aucun pilote ne lit. Une nouvelle option ne peut donc pas être publiée sans que quelqu'un décide de quoi il s'agit.

En filet de sécurité sous les listes, toute clé à n'importe quelle profondeur de la configuration d'un appareil est masquée par son nom, dans n'importe quel protocole, quand elle contient `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid` ou `connectionstring`, ou se termine par `key`, ou a comme mot entier l'un de `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin` ou `psk`. Les mots sont séparés à la ponctuation et aux passages de minuscule à majuscule, donc `db_pass`, `smtp_pw`, `apiAuth` et `sasToken` comptent, et `bypass`, `compass`, `passive`, `authority` et `pinned` non. La casse et la ponctuation sont ignorées, de même que les graphies que `encoding/json` lirait encore comme la même clé (un s long pour s, le signe Kelvin pour k). La règle des mots courts est brutale à dessein : une clé que personne n'a examinée, comme `authMode`, est masquée jusqu'à son ajout à `plainConfigKeys`.

Une valeur masquée par son nom, et tout ce qui se trouve sous une telle clé, est remplacée quel que soit son type (un nombre est masqué comme une chaîne), sauf un booléen, qui ne peut pas être un identifiant. Une chaîne qui porte un identifiant dans son texte est masquée entièrement où qu'elle soit : une ligne de commande avec `--password hunter2`, une paire `password=...` ou une chaîne de connexion, `Authorization: Bearer ...`. Un appareil sans identifiant défini n'en montre aucun, de sorte qu'on distingue « pas de mot de passe » de « un mot de passe que je ne peux pas voir ». Une configuration qui ne peut pas être lue comme du JSON s'affiche comme `{}` plutôt que telle quelle.

Une valeur masquée s'affiche comme `[redacted]`. Dans une adresse, elle remplace le mot de passe et garde le nom d'utilisateur (`http://svc:[redacted]@meter/api`), ou toutes les informations d'utilisateur quand il n'y a pas de deux-points, ainsi que la valeur de chaque paramètre d'allure secrète de la requête et du fragment (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). Les paramètres sont séparés par `&` ou `;`, ou par leurs formes encodées `%26` et `%3B`, et chacun est jugé seul, donc `?fmt=json` reste lisible. Un paramètre nommé `code` compte comme un secret dans une adresse, pour la clé Azure Functions dans `?code=`, et nulle part ailleurs. Une requête qui ne peut pas être lue proprement (un échappement de pourcentage invalide, un caractère de contrôle) est masquée entièrement plutôt que devinée.

### Enregistrer un appareil

`POST /api/devices` crée un appareil quand l'id est nouveau et le remplace quand l'id existe. Il n'y a pas de `PUT` séparé. Pour chaque identifiant dans l'adresse et la configuration :

| Ce qu'envoie la requête | Résultat |
|---|---|
| Un nouvel appareil avec une vraie valeur | La valeur est stockée telle quelle. |
| Un nouvel appareil avec `[redacted]` | Refusé avec un 400. Le marqueur n'est jamais stocké comme identifiant. |
| Un appareil existant, `[redacted]` | La valeur stockée est conservée. |
| Un appareil existant, la clé omise | La valeur stockée est conservée. Un client qui ignore les secrets ne peut pas en effacer un par accident. |
| Un appareil existant, une nouvelle chaîne ou un nouveau nombre | Il remplace la valeur stockée. |
| Un appareil existant, une chaîne vide ou `null` | Il efface la valeur stockée. C'est le seul moyen de retirer un identifiant. |
| `[redacted]`, sans rien de stocké à conserver | Refusé avec un 400. |

Le marqueur n'est jamais stocké, où qu'il apparaisse dans une configuration ou une adresse : il est remplacé par la valeur stockée au même endroit, ou refusé quand il n'y en a pas.

Deux précisions. Dans `headers` (une table dont les entrées ont été choisies par la personne), la table est l'unité : une entrée omise est supprimée, `{}` les efface toutes, et omettre toute la clé `headers` les conserve. Une clé est comparée sans tenir compte de la casse, comme la comparent les pilotes. Et tout ce qui n'est pas un identifiant est remplacé comme toujours : un appareil enregistré sans aucun `config` conserve ses identifiants et rien d'autre.

L'éditeur d'appareils de l'interface web montre la configuration d'un appareil telle que l'API la renvoie, marqueurs compris, et enregistre ce qu'il montre. Modifier un appareil sans toucher à un identifiant le conserve donc. **Pour changer un secret dans l'interface, remplacez le `[redacted]` dans la configuration (ou dans l'adresse) par la nouvelle valeur.** Rien n'est prérempli avec l'ancienne, donc la personne qui modifie un appareil doit connaître l'identifiant pour le changer.

### Déplacer un appareil n'emporte pas ses secrets

Les identifiants conservés sont envoyés à ce que l'appareil vise. S'ils étaient conservés lors du déplacement d'un appareil, quiconque a le droit d'enregistrer un appareil pourrait lire un identifiant stocké en le pointant vers un écouteur à lui et en laissant la passerelle le présenter. Donc, quand un enregistrement change l'hôte ou le port dans l'adresse, ou dans `writeUrl`, et conserverait un identifiant stocké (par marqueur ou par omission), il est refusé avec un 400 qui nomme les identifiants. Saisissez-les de nouveau, ou envoyez une chaîne vide pour les effacer. Changer le chemin, le schéma ou toute autre chose de l'appareil ne compte pas comme un déplacement, et un appareil sans identifiant stocké peut être déplacé librement.

### Où un identifiant n'apparaît pas

Pour un appareil de chaque protocole, avec un identifiant à chaque endroit possible, les tests le cherchent dans : chaque point de terminaison d'appareil (réponses de liste, de lecture, de création et de mise à jour) pour un viewer, un operator et un admin ; chaque autre point de terminaison de lecture ; `/api/diagnostics` et `/api/status` ; `/api/sites` et les serveurs MCP sortants qu'il liste ; le flux d'événements en direct ; le journal système et l'audit des écritures ; les réponses d'erreur ; chaque outil et ressource MCP ; et le journal du processus au niveau debug, du runtime et des pilotes. Le texte d'erreur d'un pilote et les événements et journaux du runtime sont expurgés des identifiants d'un appareil, par valeur et par forme, parce qu'une erreur peut répéter une adresse ou la réponse d'un serveur. Un identifiant d'un ou deux caractères n'est remplacé que là où il figure comme mot à part entière, puisque le remplacer partout ruinerait le message.

### Où les identifiants restent en clair

L'écriture seule concerne l'API. La passerelle a besoin des vraies valeurs pour se connecter, et ces endroits les conservent telles qu'elles sont stockées :

- **La base de données.** Les identifiants d'appareil sont dans les colonnes `config` et `address`. Avec `HOTLOOP_SECRET_KEY_FILE` défini, ceux à clé dans `config` (chaque `password`, les valeurs d'en-têtes) sont chiffrés avec une clé conservée hors de la base, ainsi qu'une adresse ou une option dont le texte contient un identifiant (`mqtt://user:pass@host`, `?token=`), scellées entières. Voir [Sauvegardes et restauration](/fr/iot/backup/#identifiants-dappareils-et-clé-secrète).
- **Les sauvegardes.** `devices.copy` dans une sauvegarde les contient, chiffrés ou non exactement comme la base de données. Voir [Sauvegardes et restauration](/fr/iot/backup/#protégez-les-fichiers-de-sauvegarde).
- **Les fichiers d'appareils de l'Edge Relay.** Le relais lit un fichier JSON qui porte les identifiants de ses appareils. Voir [Référence d'Edge Relay](/fr/edge-relay/reference/#credentials-in-the-device-file-4150).
- **Le push de configuration de la flotte.** Un fichier d'appareils poussé vers un relais est publié tel quel sur un topic MQTT, retenu. Voir [Gestion de flotte](/fr/gateway/fleet/).

Protégez en conséquence la base de données, le volume de sauvegarde, le fichier d'appareils du relais et le broker. Masquer l'API ne change rien à tout cela.

### Si des utilisateurs non fiables pouvaient atteindre l'API

Avant la 4.15.1, n'importe quel utilisateur connecté pouvait lire par l'API les identifiants d'appareil stockés. Un opérateur dont la passerelle était accessible à des utilisateurs qui n'auraient pas dû l'avoir (un compte viewer remis à un sous-traitant, par exemple) doit renouveler les identifiants des appareils qu'elle contient : le broker MQTT, les points de terminaison HTTP et MTConnect, et les comptes OPC UA. Il n'y a eu aucune version publique depuis la 4.3.1, donc l'exposition se limite aux déploiements de builds non publiées.

## Ce que consigne la piste d'audit

Chaque écriture passait déjà par `write_audit` avec une colonne `actor`, voir la porte d'écriture dans le README principal. Cette colonne vient désormais de la session, pas d'un en-tête, et sur un panneau kiosque la session est la personne qui s'est connectée avec son PIN ou son badge :

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

consigne `j.smith`, le nom d'utilisateur de la session qui a fait l'appel, et non ce que `X-Forwarded-User` aurait pu dire. Les connexions, les connexions kiosque, les déconnexions, les changements de mot de passe et chaque action de gestion des utilisateurs, y compris définir ou effacer un PIN (jamais le PIN lui-même), sont consignés dans le journal système (`GET /api/events`, catégorie `auth`) pour la même raison qu'existe l'audit des écritures : un changement dans six mois doit pouvoir s'expliquer, pas seulement se voir.

## Fonctionner sans connexion

Définissez `HOTLOOP_AUTH_INSECURE=true` (ou `auth.insecure: true` dans le chart) pour fonctionner exactement comme toutes les versions avant la 4.4.0 : aucune session exigée, l'acteur enregistré pour une écriture vient de `X-EmberNET-User` ou d'en-têtes de proxy semblables, et retombe sur `"operator"` si aucun n'est défini.

C'est un choix réel et défendable pour un déploiement où la NetworkPolicy du dashboard EmberNet lui-même est le véritable périmètre et où rien d'autre ne peut atteindre le pod. Ce n'est plus la valeur par défaut parce qu'il est facile de croire cette condition remplie et difficile de la vérifier depuis l'intérieur du pod : tout l'intérêt de la 4.4.0 est qu'une erreur dans une NetworkPolicy, ou un déploiement qui s'avère finalement ne pas être derrière le dashboard, ne doit pas en plus faire renvoyer à `actor(r)` quelque chose qu'un attaquant a choisi.

`config.Validate` refuse de démarrer quand l'authentification n'est ni activée ni reconnue de cette façon, précisément pour que « pas d'authentification » soit toujours une décision que quelqu'un a prise volontairement, écrite dans la configuration même du déploiement, et non une valeur par défaut que personne n'a choisie.

## Se connecter depuis le dashboard EmberNet

Un tenant qui installe HotLoop depuis l'App Store EmberNet entre avec LAUNCH dans l'application déjà connecté sous son propre nom, sans qu'aucun mot de passe ne soit distribué. L'hôte d'applications du dashboard ajoute `X-Embernet-Assertion` à chaque requête qu'il achemine vers ce pod : un jeton ES256, valable environ une minute, signé avec une clé privée que seul le dashboard détient. Il nomme la personne (`email`), le tenant, la seule application pour laquelle il a été fait (`aud`, `<tenant>/<Service name>`) et le rôle HotLoop auquel le tenant fait correspondre le rôle de dashboard de cette personne (`role` : `admin`, `operator` ou `viewer`).

Il est désactivé tant qu'aucune clé publique n'est configurée, et alors tout le reste fonctionne comme avant : comptes locaux, le cookie, le jeton bearer, le panneau kiosque.

| Variable | Valeur du chart | Fonction |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | la clé PUBLIQUE du dashboard, PEM PKIX, ECDSA P-256. Le store la renseigne lors d'un déploiement. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | déduit du namespace et du nom de la release | `<tenant>/<Service name>`. Obligatoire avec la clé ; un jeton fait pour une autre application ou un autre tenant est refusé. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Ce que fait une bonne assertion : la personne obtient un utilisateur ici la première fois que le dashboard se porte garant d'elle (nommé d'après son adresse, sans mot de passe, donc rien à deviner), le rôle de l'utilisateur suit ce que le dashboard a envoyé à chaque requête, et l'audit la nomme. Ce que fait une mauvaise : 401, et elle n'est pas écartée discrètement au profit d'un cookie de session qui se trouverait là. Sont refusés une mauvaise signature, tout algorithme autre qu'ES256, un jeton expiré ou pas encore valide, un jeton qui vit plus de dix minutes, un mauvais émetteur, l'audience d'une autre application ou d'un autre tenant, une déclaration de tenant en désaccord avec l'audience, un rôle qui n'est pas l'un des nôtres et un nom sans adresse.

Un admin local garde le dernier mot sur quelqu'un que le dashboard a laissé entrer : désactivez l'utilisateur et il reste dehors, donnez-lui une liste de permissions explicite et il la garde. Les écritures ont toujours besoin des propres interrupteurs d'écriture du pod ; une assertion ne les élargit jamais. Se déconnecter d'une session créée par le dashboard n'y met pas fin : l'accès cesse à la prochaine requête que le dashboard cesse de signer.

## Ce que cela ne couvre pas encore

- **Pas d'OpenID Connect.** Des comptes locaux, plus l'assertion signée du dashboard EmberNet décrite plus haut. Une intégration avec un fournisseur d'identité n'est pas réalisée.
- **Pas de rôles par tenant ni par site.** Les permissions d'un utilisateur sont les mêmes partout où le Gateway s'exécute, ce qui convient pour une seule usine et demanderait plus de réflexion pour la consolidation multisite dans `Sites`.
- **Pas de verrouillage pour un PIN ou un badge tapé seul,** seulement pour un mot de passe et un PIN avec son nom d'utilisateur ; voir [Le verrouillage](#le-verrouillage-après-des-mots-de-passe-et-des-pin-erronés). La comparaison à temps constant dans `handleLogin` empêche l'énumération des noms d'utilisateur par le temps de réponse. Une NetworkPolicy ou un proxy en amont reste utile devant le point de terminaison de connexion.
