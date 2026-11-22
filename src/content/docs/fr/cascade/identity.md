---
title: "Identité et accès"
description: "Rôles personnalisés, connexion par LDAP, Active Directory et SAML, et provisionnement SCIM, le tout inclus dans chaque Cascade sans aucune offre payante."
---

Qui entre, et ce qu'il peut faire une fois dedans. Cascade livre tout cela à tout le monde. Rien ici n'est payant et aucune vérification de licence ne se cache derrière.

Chaque endpoint ci-dessous figure dans le document OpenAPI à `/api/v1/openapi.json`, et chacun a un test qui l'appelle.

## Rôles personnalisés

Dans l'éditeur : Paramètres, Rôles. Tout le monde lit les rôles ; un propriétaire ou un administrateur crée, modifie et supprime les rôles personnalisés, et les attribue aux membres d'un projet depuis le même écran.

Un projet a quatre rôles intégrés : admin, editor, operator et viewer. Ils vivent dans le code et ne changent jamais. Quand aucun n'a la bonne taille, créez un rôle personnalisé : un nom et une liste d'autorisations de projet.

Un chef de ligne qui peut lancer les flux de travail de la ligne et lire leurs exécutions, sans rien pouvoir modifier, en est la raison habituelle :

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Placez ensuite quelqu'un dans un projet avec ce rôle, par le même appel que pour un rôle intégré :

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

À savoir :

- `GET /api/v1/permissions` liste chaque autorisation qu'un rôle peut porter, et `GET /api/v1/roles` liste les quatre rôles intégrés et les rôles personnalisés avec ce que chacun peut faire. Toute personne connectée peut lire les deux, car un administrateur de projet en a besoin pour choisir un rôle.
- Créer, modifier et supprimer un rôle personnalisé revient à un propriétaire ou un administrateur de l'instance, avec l'autorisation `role.manage`. Un administrateur de projet peut donner un rôle aux membres de son projet sans pouvoir en écrire un nouveau, de sorte que personne ne s'accorde plus que ce qu'on lui a donné.
- Un rôle ne porte que des autorisations de projet. Il ne peut porter ni `user.manage`, ni `audit.read`, ni aucune autre autorisation d'instance, et en demander une renvoie un 400.
- Un nom compte de 2 à 40 lettres minuscules, chiffres et tirets, et commence par une lettre. Il ne peut pas être changé ensuite, car les membres et les comptes de service détiennent un rôle par son nom. Les quatre noms intégrés sont pris.
- Modifier les autorisations d'un rôle atteint tous ceux qui le détiennent à leur requête suivante. Rien n'est mis en cache, il n'y a donc aucune fenêtre où une autorisation retirée fonctionnerait encore.
- Une clé de compte de service peut détenir un rôle personnalisé comme rôle de projet, et les portées d'une clé d'API la restreignent toujours.
- Supprimer un rôle que quelqu'un détient est refusé avec un 409, qui indique combien de membres et de clés de compte de service le détiennent. Déplacez-les d'abord.
- Les changements de rôle figurent dans le journal d'audit sous `role.created`, `role.updated` (avec les autorisations avant et après) et `role.deleted`.

## LDAP et Active Directory

Les gens se connectent avec le nom et le mot de passe qu'ils ont déjà à l'usine : OpenLDAP, 389 Directory Server, FreeIPA ou Active Directory. Cela cohabite avec les comptes locaux et avec OIDC, et reste désactivé tant que vous ne définissez pas `HOTLOOP_CASCADE_LDAP_URL`.

Voici comment se déroule une connexion :

1. Un compte de service (ou une recherche anonyme, si votre annuaire l'autorise) trouve la personne avec le filtre d'utilisateur.
2. Il cherche les groupes auxquels elle appartient.
3. L'annuaire lui-même vérifie le mot de passe, en faisant un bind au nom de la personne. Cascade ne stocke jamais ce mot de passe et n'en voit jamais d'empreinte. Le compte créé ici n'a aucun mot de passe propre : le mot de passe de l'annuaire ne peut donc pas servir sur `/login` comme un mot de passe local.
4. Le compte est créé à la première connexion (sauf si vous le désactivez), et son rôle suit ses groupes à chaque connexion suivante.

La page de connexion affiche un second formulaire quand cette option est activée, et la même chose tient en un seul appel, `POST /auth/ldap/login` avec `{"username": "...", "password": "..."}`. Un mauvais nom et un mauvais mot de passe reçoivent la même réponse. Un mot de passe vide n'atteint jamais l'annuaire, car la plupart des annuaires répondent par un succès à un bind sans mot de passe.

### Paramètres

Ce sont tous des variables d'environnement. Avec le chart Helm, mettez-les dans `env`, et le mot de passe du bind dans `extraEnv` à partir d'un secret.

| Variable | Ce qu'elle fait |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` ou `ldaps://host:636`. L'active. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (par défaut) ou `ad`. Elle ne fait que choisir les valeurs par défaut ci-dessous. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` fait passer une connexion `ldap://` en chiffré avant tout envoi. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | Fichier PEM des autorités à approuver pour le certificat de l'annuaire. Vide signifie celles du système. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | Le nom pour lequel le certificat doit être émis, quand ce n'est pas l'hôte de l'URL. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | Le compte de service qui recherche les personnes. Vide, c'est une recherche anonyme. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` ou `_FILE` | Son mot de passe, ou un fichier qui le contient. Pas les deux. Un DN sans mot de passe est refusé, car ce serait un bind anonyme. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Obligatoire. Le DN sous lequel on cherche les personnes. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Trouve une personne. `{username}` est ce qu'elle a saisi, échappé. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | Le DN sous lequel on cherche les groupes. Vide, il n'y a aucune recherche de groupes. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Trouve les groupes d'une personne. `{dn}` est son DN, `{username}` ce qu'elle a saisi. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Les attributs de l'identifiant stable, de l'e-mail et du nom affiché. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Des paires `group=role`, séparées par des virgules : `supervisors=admin, operators=member`. Un groupe se désigne par son `cn` ou par son DN complet. Le rôle le plus puissant parmi les groupes d'une personne l'emporte. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` ou `none`. Avec une correspondance de rôles, la valeur par défaut est `none` : quelqu'un qui n'est dans aucun groupe associé est refusé. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` ne crée les comptes qu'à la main. Par défaut `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Le nom que le bouton de connexion lui donne. |

Les valeurs par défaut de `ldap` : filtre d'utilisateur `(&(objectClass=inetOrgPerson)(uid={username}))`, filtre de groupe `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, identifiant `entryUUID`, e-mail `mail`, nom `cn`.

Les valeurs par défaut de `ad` : un utilisateur est trouvé par `sAMAccountName` ou par nom d'utilisateur principal, si bien que `alice` et `alice@plant.example` fonctionnent tous les deux, et un compte désactivé est écarté de la recherche. Les groupes utilisent la règle d'appartenance imbriquée (`member:1.2.840.113556.1.4.1941:={dn}`) : quelqu'un qui est dans un groupe contenu dans un groupe associé reçoit donc aussi le rôle. L'identifiant est `objectGUID`, écrit en GUID, l'e-mail `mail`, le nom `displayName`.

### Bon à savoir

- **Active Directory exige le chiffrement.** Il refuse un bind simple sur une connexion en clair. Utilisez `ldaps://`, ou `ldap://` avec `START_TLS=true`. Cascade vérifie le certificat par rapport au fichier d'AC (ou aux racines du système) et par rapport au nom du serveur, et aucun paramètre ne permet de sauter cette vérification. Un annuaire qui signe son propre certificat a besoin de son AC dans `CA_FILE`.
- **Le compte est lié à l'identifiant de l'annuaire, pas au nom.** Renommez quelqu'un dans l'annuaire, ou déplacez-le dans une autre UO, et c'est le même compte ici. Quelqu'un sans `mail` ne peut pas recevoir de compte (la connexion le dit).
- **L'annuaire fait autorité pour l'adresse.** Un compte qui existe déjà ici avec le même e-mail est lié à l'entrée de l'annuaire la première fois que cette personne se connecte, sans vérification supplémentaire, comme pour une adresse OIDC vérifiée. Ne pointez pas ceci vers un annuaire que vous n'exploitez pas.
- **Le premier compte d'une instance en est le propriétaire**, quelle que soit la manière dont il est créé. Créez d'abord le propriétaire avec la configuration initiale.
- **Un second facteur configuré ici compte toujours.** Un mot de passe d'annuaire est un facteur. Quelqu'un qui a une application d'authentification ou une passkey sur son compte se la voit demander ensuite, et l'exigence de MFA pour toute l'instance s'applique comme pour tout le monde.
- **Les mauvais mots de passe verrouillent aussi le compte ici.** Cinq d'affilée sur un compte déjà lié à l'annuaire le verrouillent une minute, durée qui double, comme pour un compte local, avant même que le verrouillage de l'annuaire n'ait à intervenir. Une personne que l'annuaire ne connaît pas, un mauvais mot de passe et un compte verrouillé figurent tous dans le journal d'audit sous `auth.login_failed` ou `auth.login_refused`, et une personne que l'annuaire a laissée passer et que Cascade a refusée (aucun groupe, aucun e-mail, JIT désactivé) est `auth.sso_refused`.
- **Un annuaire en panne est une erreur du serveur, pas un mauvais mot de passe.** La connexion indique que l'annuaire n'a pas répondu, et le détail est dans le journal.
- Chaque appel à l'annuaire est limité à quinze secondes, et une seule personne peut correspondre au filtre d'utilisateur : deux correspondances donnent un refus qui nomme le problème, jamais la première.

## SAML

Authentification unique par n'importe quel fournisseur d'identité SAML 2.0. Cascade est le fournisseur de service. Cela cohabite avec les comptes locaux, OIDC et LDAP, et reste désactivé tant que vous n'indiquez pas les métadonnées du fournisseur.

Les étapes :

1. Cascade publie ses propres métadonnées à `/auth/saml/metadata`. Donnez-les au fournisseur, ou saisissez les deux valeurs qu'elles contiennent : l'identifiant d'entité et l'assertion consumer service, `<public url>/auth/saml/acs`, binding HTTP-POST.
2. Définissez `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` avec l'adresse des métadonnées du fournisseur (quelque chose comme `https://sso.plant.example/saml/metadata`), ou `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` avec le même document enregistré sur disque.
3. La page de connexion affiche un bouton « Se connecter avec ». Il mène à `/auth/saml/start`.

Ce qu'il vérifie au retour : la signature de la réponse par rapport au certificat du fournisseur dans ses métadonnées, l'audience, la fenêtre de temps, que c'est la réponse à une requête lancée par ce navigateur, et que la connexion a été lancée dans ce navigateur. Une réponse que personne n'a demandée (une connexion lancée chez le fournisseur) est refusée. L'état de chaque connexion ne sert qu'une fois, si bien qu'une réponse capturée ne peut pas être rejouée.

| Variable | Ce qu'elle fait |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` ou `_FILE` | Les métadonnées du fournisseur. L'une des deux active SAML ; pas les deux. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Comment cette instance se désigne auprès du fournisseur. Par défaut : son URL de métadonnées. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` et `_CERT_FILE` | La paire de clés de cette instance, PEM, RSA ou EC. Les deux ou aucune. Par défaut : une paire créée au premier démarrage sous les noms `saml-sp.key` et `saml-sp.crt` dans le répertoire de données, et conservée. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` signe chaque requête que Cascade envoie. Le fournisseur doit connaître le certificat. Par défaut `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Par quoi Cascade demande au fournisseur d'identifier les personnes : `persistent` (par défaut), `email` ou `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Un attribut qui identifie la personne à la place du NameID. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Les attributs qui contiennent l'e-mail, le nom affiché et les groupes. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Comme pour LDAP : les paires groupe-rôle, le rôle de quiconque n'est dans aucun, la création ou non d'un compte à la première connexion, et le nom du bouton. |

Sans les paramètres d'attributs, Cascade cherche les noms courants. L'e-mail est `email`, `mail`, `emailAddress`, l'identifiant d'objet LDAP `urn:oid:0.9.2342.19200300.100.1.3` ou l'URI de claim `.../claims/emailaddress`, et se rabat sur le NameID quand c'est une adresse. Le nom est `displayName`, `name`, ou le prénom et le nom de famille. Les groupes sont `groups`, `group`, `memberOf`, l'URI `.../claims/Group` et le claim de groupes de Microsoft.

À savoir :

- **Demandez un identifiant persistant.** Un compte est lié au NameID, et un identifiant transitoire est différent à chaque connexion. Cascade en demande un persistant et refuse un transitoire avec un message qui le dit, plutôt que de créer un nouveau compte à chaque connexion. Si votre fournisseur ne peut envoyer qu'un identifiant transitoire, indiquez dans `SUBJECT_ATTR` un attribut stable.
- **Le fournisseur fait autorité pour l'adresse.** Comme avec LDAP, un compte existant avec le même e-mail est lié à la première connexion SAML.
- **Derrière un proxy, définissez `HOTLOOP_CASCADE_PUBLIC_URL` avec l'adresse qu'utilisent les gens.** Le fournisseur envoie son POST à l'URL de l'assertion consumer construite à partir d'elle.
- **Utilisez HTTPS.** Le fournisseur répond par un POST venant d'un autre site : le cookie qui lie une connexion à son navigateur doit donc être envoyé entre sites, ce que les navigateurs n'autorisent que sur une connexion sécurisée.
- **Plus d'un pod** exige la même paire de clés sur chacun : mettez-la dans un secret et indiquez-la avec `KEY_FILE` et `CERT_FILE`, sinon chaque pod crée la sienne.
- Un second facteur configuré ici compte toujours après une connexion SAML, et SAML ne fait jamais compter l'authentification multifacteur propre au fournisseur.
- La déconnexion unique n'est pas prise en charge. Se déconnecter met fin à la session ici.

## SCIM

Dans l'éditeur : Paramètres, Connexion et SCIM indique si SCIM est activé, l'URL de base à donner au fournisseur, et les jetons, avec un bouton pour en créer un (affiché une seule fois) et pour en révoquer un. LDAP, SAML et OpenID Connect se définissent dans l'environnement de l'instance au démarrage : le même écran montre donc lesquels sont actifs et où pointe un fournisseur (les URL de métadonnées et d'ACS de SAML), et ne fait pas semblant de les modifier.

SCIM est la façon dont un fournisseur d'identité garde les comptes synchronisés avec son annuaire : il crée une personne quand elle arrive, la modifie quand elle change de poste, la désactive quand elle part, et tient les groupes à jour. Cascade est le serveur SCIM (RFC 7643 et 7644, version 2.0), et le fournisseur est le client. Il est construit selon ce que disent les RFC et ce qu'envoient les fournisseurs d'identité courants, et il est éprouvé à chaque version avec scim2-tester, un client SCIM d'une autre équipe qui exécute toutes les vérifications qu'il possède. Il est désactivé tant que vous ne définissez pas `HOTLOOP_CASCADE_SCIM=true`.

Pour le mettre en place :

1. Activez-le avec `HOTLOOP_CASCADE_SCIM=true` et redémarrez.
2. Créez un jeton pour le fournisseur, en tant que propriétaire ou administrateur de l'instance : `POST /api/v1/scim-tokens` avec `{"name": "plant directory"}`. Le `secret` de la réponse (il commence par `hlcs_`) n'est affiché qu'une fois : mettez-le donc tout de suite dans le fournisseur. `GET /api/v1/scim-tokens` les liste avec la date de dernière utilisation de chacun, et `DELETE /api/v1/scim-tokens/{token}` en révoque un. Il faut être connecté pour créer un jeton : une clé d'API ne le peut pas, de sorte qu'une clé qui fuit ne peut pas en créer d'autres.
3. Donnez au fournisseur l'URL de base, `<public url>/scim/v2`, et le jeton comme bearer token.

Chaque appel exige le jeton, et chaque réponse est en `application/scim+json`. Les appels figurent dans le journal d'audit avec le nom du jeton comme acteur : `user.created`, `user.disabled` et les autres disent donc quel fournisseur l'a fait, avec les événements SCIM `scim.user_deleted`, `scim.group_created`, `scim.group_updated` et `scim.group_deleted`.

### Ce qu'il propose

`/ServiceProviderConfig`, `/ResourceTypes` et `/Schemas` disent ce qui est pris en charge, et ne disent que ce qui est vrai : filtrage, PATCH, pas de bulk, pas de tri, pas d'ETags, pas de changement de mot de passe.

| Ressource | Appels |
|---|---|
| `/Users` | `GET` (liste, avec `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | la même chose |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` avec la requête dans le corps |

- **Un utilisateur** se compose de `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` et `active`. L'e-mail du compte est le principal, sinon celui du travail, sinon le premier, sinon `userName` quand c'est une adresse. Tout ce qui n'a pas d'adresse donne un 400. Ce que le fournisseur envoie est renvoyé tel quel : un nom qu'il n'a pas envoyé n'est pas inventé. `groups` revient en lecture seule.
- **Un groupe** se compose de `displayName`, `externalId` et `members`, chaque membre étant l'identifiant d'un utilisateur. Un membre qui n'est pas un utilisateur donne un 400.
- **Les filtres** sont la syntaxe complète : `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, parenthèses et `attr[filter]`. La comparaison ignore la casse, sauf pour `id` et `externalId`. Un mauvais filtre donne un 400 avec `scimType: invalidFilter`.
- **PATCH** accepte `add`, `replace` et `remove` avec ou sans chemin, avec des chemins de valeur comme `emails[type eq "work"].value` et `members[value eq "id"]`, quelle que soit la casse, et un booléen sous la forme `true` ou de la chaîne `"False"` que certains fournisseurs envoient. Il change exactement ce qu'un PUT pourrait changer.
- **Les listes** suivent l'ordre de création des comptes, 100 par page sauf si `count` dit autre chose, 200 au maximum.

### Ce qu'il ne fera pas

- **Il n'affiche ni ne modifie jamais le propriétaire.** Le propriétaire de l'instance n'est pas dans la liste, ne peut être ni récupéré, ni modifié, ni supprimé, et ne peut pas être placé dans un groupe. Un e-mail qui appartient au propriétaire est un conflit.
- **Il ne supprime jamais un compte.** `DELETE` désactive la personne, ce qui met fin à ses sessions, la retire de ses groupes et la masque à SCIM. Tout ce qu'elle a créé et chaque ligne d'audit restent. Si le fournisseur la recrée avec la même adresse, le même compte revient, activé. `active: false` désactive sans masquer.
- **Un compte SCIM n'a pas de mot de passe.** Il se connecte par OIDC, SAML ou LDAP, qui s'y lient par l'adresse.
- **Il ne touche pas aux projets.** SCIM travaille avec les comptes et les rôles d'instance. Qui est dans quel projet se décide toujours ici.

### Des rôles à partir des groupes

Par défaut, un nouveau compte est membre et SCIM ne change jamais le rôle de personne. Pour que les groupes décident, associez des noms de groupe à des rôles :

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Le rôle d'une personne suit alors ses groupes chaque fois qu'une appartenance change : le rôle associé le plus puissant l'emporte, et quelqu'un qui n'est dans aucun reçoit la valeur par défaut. Seuls `admin` et `member` peuvent être associés, car un fournisseur ne crée jamais de propriétaire. Utilisez une seule source de rôles. Si OIDC ou SAML associent aussi des groupes à des rôles, c'est celui qui a changé le rôle d'une personne en dernier qui l'emporte, et les deux se battront.

Le fournisseur a besoin des mêmes noms de groupe, et doit pousser les groupes avec leurs membres, ce que sait faire tout fournisseur qui gère les groupes SCIM.
