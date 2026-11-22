---
title: "Chaque déploiement laisse une trace"
description: "Qui, quand, pourquoi et les octets exacts de chaque déploiement, comparés nœud par nœud (API, CLI, git), avec un retour arrière qui garde les identifiants."
---

« Qu'est-ce qui a changé, qui l'a changé, remettez-le » est la première question de tout le monde après l'arrêt d'une ligne. Trois fichiers `.bak` n'y répondent à aucune. Ils ne savent pas qui, ils tournent après trois enregistrements, et celui dont vous avez besoin est toujours le quatrième.

Chaque déploiement écrit donc un enregistrement immuable sous `data/deployments/` : qui l'a déployé (d'après son jeton, jamais d'après ce que le client affirme), d'où, quand, la note laissée, la révision remplacée, le fichier de flux octet pour octet, et les identifiants tels qu'ils étaient après le déploiement, chiffrés exactement comme le fichier d'identifiants. Les enregistrements sont en ajout seul. Le journal garde les 100 derniers par défaut (`history.retain`, et 0 les garde tous), et il n'élague jamais le plus récent, car le plus récent est celui qui tourne.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

Une note entre avec le déploiement, sous la forme `"note"` dans le document enveloppé (`{"rev": ..., "flows": [...], "note": "..."}`) ou d'un en-tête `HotLoop-Flow-Deployment-Note`. La forme document existe parce qu'un navigateur ne met rien en dehors de Latin-1 dans un en-tête, et que chacun écrit ses notes dans sa langue.

Il fait deux choses dont vous ne remarqueriez l'absence qu'une fois mordu :

- **Une modification à la main est repérée.** Si le fichier de flux sur le disque n'est pas la dernière chose enregistrée par le journal, parce que quelqu'un l'a modifié pendant que le processus était arrêté, le démarrage l'enregistre comme une entrée `baseline` qui le dit. Idem au premier démarrage avec un fichier de flux déjà présent. Sinon, une modification à la main devient discrètement un passé que personne n'a consigné.
- **Un journal qui ne peut pas être écrit n'arrête pas la ligne.** Le fichier de flux est déjà enregistré à ce stade : refuser le déploiement laisserait le disque et les flux en cours en désaccord jusqu'au prochain redémarrage. Le déploiement continue, et la réponse comme le journal disent, en toutes lettres, que celui-ci n'a pas d'enregistrement.

L'API ne livre jamais les identifiants d'un enregistrement, chiffrés ou non. Ils sont gardés pour une seule tâche, les remettre en place, et un point de terminaison d'historique n'est pas un moyen de les emporter.

## Le diff se lit comme une relecture

Un diff ligne à ligne d'un fichier de flux est honnête et inutile. Déplacez un nœud de vingt pixels, c'est un changement. Modifiez un seuil, c'est un changement. Le relecteur ne peut pas dire lequel est sur le point d'arrêter une presse. Flow compare donc nœud par nœud :

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Ajoutés, supprimés et modifiés, propriété par propriété avec l'ancienne et la nouvelle valeur, quelles liaisons ont bougé par port de sortie, et **la mise en page séparée de la logique** : déplacer, redimensionner ou masquer une étiquette, c'est « déplacé sur le canevas », jamais un changement, si bien qu'un rangement se lit comme un rangement. Un identifiant se lit « défini » ou « modifié », jamais avec sa valeur. Les modifications à l'intérieur d'un sous-flux apparaissent sur le sous-flux, et faire glisser l'un de ses ports relève aussi de la mise en page.

La même réponse partout, depuis un seul paquet du moteur :

- `GET /deployments/{from}/diff/{to}` compare deux déploiements.
- `POST /flows/diff` compare ce qui tourne avec un document que personne n'a encore déployé, ce que l'on regarde avant d'appuyer sur déployer.
- `hotloop-flow diff old.json new.json` en ligne de commande. `-json` pour un programme. Sort avec 1 quand quelque chose diffère, comme `diff`.
- **Dans git.** Faites-en le pilote de diff de git pour les fichiers de flux, et `git diff`, `git log -p` et `git show` affichent le diff sémantique à la place d'un bloc JSON :

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  Ou comme difftool : `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, puis `git difftool -t hotloop-flow`.

Un flux comparé à lui-même n'est aucun changement, pour tout document que l'analyseur accepte.

## Remettre comme avant

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

Un retour arrière redéploie un ancien enregistrement **comme un nouvel enregistrement**. L'historique reste en ajout seul : le déploiement 41 n'est pas touché, et le retour arrière est sa propre entrée, qui dit « retour au déploiement 41 », qui l'a fait et pourquoi. Le fichier de flux revient octet pour octet, c'est donc la même révision qu'alors.

**Les identifiants reviennent aussi.** Chaque enregistrement les porte tels qu'ils étaient : un nœud que vous avez supprimé revient avec le mot de passe de son broker, au lieu de revenir et d'échouer à se connecter. C'est testé contre un vrai Mosquitto qui refuse les clients anonymes : supprimez l'abonné, déployez, revenez en arrière, et il se reconnecte et les messages circulent.

Il refuse de trois façons, avant que quoi que ce soit soit écrit. Un `HotLoop-Flow-Deployment-Rev` périmé reçoit le même 409 qu'un déploiement, car un retour arrière en concurrence avec le déploiement de quelqu'un reste une course. Un déploiement que la rétention a déjà supprimé est un 404. Et un enregistrement dont les identifiants ne peuvent pas être déchiffrés avec le secret d'identifiants actuel est un 422, parce que des flux qui ne peuvent se connecter à rien sont un retour arrière qui n'en a que l'apparence.

## Dans l'éditeur

**Deploy ne déploie pas.** Il ouvre une relecture : le diff du moteur par rapport à ce qui tourne, dessiné sur le canevas et listé en mots, avec une zone pour la note. Le vert est ajouté, l'ambre est modifié, le bleu est seulement déplacé, et des fantômes rouges occupent la place des nœuds et liaisons supprimés. Un onglet où quelque chose a changé reçoit un point. Le second bouton Deploy est celui qui déploie, et la note va dans le journal. Modifiez quoi que ce soit pendant que la relecture est ouverte et elle se ferme, car la relecture de quelque chose que vous avez changé depuis est un mensonge sur ce que vous allez pousser.

**Le panneau d'historique** liste chaque déploiement avec qui, quand et la note. *Changes* ouvre ce déploiement sur un canevas en lecture seule avec ce qu'il a changé dessiné dessus, par-dessus votre copie de travail, qui reste exactement comme vous l'avez laissée. *Roll back* demande pourquoi, vous prévient si vous êtes sur le point de perdre des modifications non enregistrées, et le déploie.

**Un conflit de déploiement montre ce que l'autre personne a fait.** C'était un `confirm()` du navigateur qui vous demandait d'écraser le travail de l'autre ou de perdre le vôtre sans dire en quoi consistait le sien. Maintenant il dit qui a déployé, quand, sa note et son changement nœud par nœud, puis vous laisse charger le sien, écraser avec le vôtre ou continuer à modifier.

**Copier, couper et coller fonctionnent comme on s'y attend, et ils parlent le fichier de flux.** Sélectionnez des nœuds, Ctrl+C, et ce qui est dans votre presse-papiers est le même JSON que lit tout autre outil de flux : vous pouvez le coller dans un chat, un ticket ou une autre machine. Coller le met là où se trouve votre pointeur, avec de nouveaux ids à chaque fois, donc coller deux fois donne deux copies et jamais une collision. Une liaison vers quelque chose que vous n'avez pas copié est coupée au lieu de pointer dans le vide, et un nœud de configuration utilisé par les nœuds vient avec. Si ce nœud de configuration est déjà dans le flux où vous collez, la copie le partage au lieu d'ouvrir une seconde connexion vers quelque chose qui les compte. Les identifiants ne vont jamais dans le presse-papiers. Un mot de passe dans un tampon de collage, c'est ainsi qu'il finit dans un rapport de bogue.

**Import et Export** font de même pour une sélection, un flux ou tout, avec une zone pour copier, un bouton Download et un sélecteur de fichier à l'entrée. Un fichier absurde reçoit une raison (« l'id a apparaît deux fois », « l'entrée 1 n'a pas d'id ») et la boîte de dialogue reste ouverte. Un type de nœud que ce runtime n'a pas entre en gris et en pointillés, et l'import vous dit lesquels, car un nœud abandonné en silence est pire qu'un nœud bruyant.

Un écran fait partie de ce fichier. Le tableau de bord qu'un flux dessine (`ui_tab`, `ui_group` et les widgets) est constitué de nœuds du flux : les écrans d'un client voyagent donc avec ses flux par Export et Import, et aucun ne vit dans HotLoop Flow lui-même.

**Les sous-flux se modifient sur leur propre canevas.** Appuyez sur *+ subflow* et il s'ouvre avec ses ports d'entrée et de sortie. Reliez-les aux nœuds à l'intérieur comme n'importe quoi d'autre. *Subflow properties* fixe le nom, la couleur, le nombre de sorties et les propriétés qu'une instance peut définir. Les instances dans les flux suivent quand la forme change, et la palette liste chaque sous-flux pour que vous puissiez en déposer un. Double-cliquez sur une instance pour lui donner son propre nom et sa propre valeur pour chaque propriété. Un sous-flux ne peut pas être placé dans lui-même ni dans un sous-flux qui le contient, et un sous-flux encore utilisé ne peut pas être supprimé. L'éditeur le dit plutôt que de laisser le déploiement suivant le découvrir.

**De la sélection à un sous-flux.** Sélectionnez des nœuds et appuyez sur *Selection to subflow*. Ils passent dans un sous-flux à eux et une instance prend leur place. Chaque liaison qui franchissait le bord de la sélection devient un port : la seule voie d'entrée est l'entrée du sous-flux, et chaque sortie d'un nœud sélectionné qui allait ailleurs est une sortie du sous-flux, de sorte que le flux fait ce qu'il faisait. Un sous-flux n'a qu'une entrée : si la sélection est câblée vers deux nœuds différents, il le dit et ne change rien, car alimenter les deux depuis les deux serait un autre flux. Sélectionnez un groupe et il vient avec tout ce qu'il contient. Un nœud de configuration qui appartient au flux et que seule la sélection utilise passe dans le sous-flux avec elle, ainsi que ce vers quoi il pointe. Un nœud que quelque chose laissé derrière utilise aussi devient global, pour que les deux extrémités continuent de partager la même connexion, car une seconde connexion au broker sur une machine qui les compte est le genre de surprise que nous ne livrons pas. Les variables d'environnement lues par les nœuds déplacés (typées env, sous la forme `${NAME}` ou `$(NAME)` dans une chaîne, ou `env.get`) et que le flux déclare deviennent des propriétés du sous-flux qui renvoient au flux, si bien que la valeur vient toujours d'où elle venait et que l'instance peut la remplacer. Ctrl+Z défait le tout.

**Flux.** Double-cliquez sur un onglet, ou appuyez sur *Flow properties*, pour le renommer ou le supprimer. Supprimer demande confirmation, emporte tous les nœuds du flux, et coupe les liaisons et les liens que d'autres flux avaient vers lui pour que le fichier ne pointe pas dans le vide. Cela retire aussi les nœuds supprimés de toute portée Catch, Status ou Complete qui les nommait. Un Catch ou un Status dont toute la liste a été supprimée garde son dernier id, car une liste vide signifie tout le flux et nous ne ferons pas passer un nœud de la surveillance d'une chose à celle de tout, dans votre dos. Ctrl+Z le ramène jusqu'au déploiement. Le dernier flux ne peut pas être supprimé, car un runtime sans flux n'a nulle part où mettre un nœud.

**Les nœuds de configuration** sont dans la palette sous *configuration*. Ils ne sont sur aucun canevas : double-cliquez sur le type, remplissez la boîte de dialogue, et il s'ajoute à la liste sous *configuration in use*, où un double-clic le modifie et la croix le supprime. Un nœud encore utilisé par un autre ne se supprime pas, et dit combien l'utilisent. C'est là que vous envoie « Add one from the palette first » dans la boîte de dialogue d'un nœud.

**Supprimer une liaison.** Alt-clic. Un simple clic ne fait rien, si bien qu'effleurer une liaison en sélectionnant ne peut pas casser un flux. Ctrl+Z la remet.

**Liaisons durables.** Double-cliquez sur une liaison. Cochez *Durable* et elle est dessinée plus épaisse et en bleu, et le nœud dont elle part reçoit `ew_durable` dans le fichier. La marque est sur la paire de nœuds, elle vaut donc pour toutes les liaisons entre eux. C'est du câblage vers le runtime : marquer une liaison ne redémarre jamais le nœud.

**Groupes.** Ctrl+G enveloppe la sélection, Ctrl+Maj+G la défait. Double-cliquez sur la barre de titre pour la nommer et la colorer. Faites glisser un groupe et tout ce qu'il contient suit. Faites glisser un nœud dans un groupe et il le rejoint, faites-le glisser dehors et il le quitte. Les groupes s'imbriquent. Supprimer un groupe supprime son contenu, et Ctrl+Z remet tout.

**La recherche** (Ctrl+F, ou le bouton) regarde dans tous les flux et sous-flux à la fois : noms, types, ids et chaque réglage, y compris une ligne au milieu du corps d'une fonction. Un résultat vous amène au bon onglet avec le nœud sélectionné et au milieu de la vue. Les nœuds de configuration apparaissent aussi, et leur résultat ouvre leur boîte de dialogue, puisqu'ils n'ont pas de place sur un canevas.

**Filtrage du débogage.** Restreignez la barre latérale à un flux, aux nœuds sélectionnés, à un mot ou aux seules erreurs. Cela s'applique à ce qui est déjà dans le journal, pas seulement à ce qui arrive ensuite, si bien que restreindre ne fait jamais disparaître la ligne que vous regardiez.

Tout cela est parcouru à la souris dans un vrai navigateur à chaque pull request, contre le vrai binaire avec l'éditeur intégré. Cela comprend chaque boîte de dialogue de nœud que propose le runtime : la liste vient de `GET /nodes`, si bien qu'un nœud ajouté le mois prochain est dans le test le mois prochain sans que personne ait à penser à l'ajouter. En écrivant ces tests, nous avons trouvé deux choses qui n'avaient jamais fonctionné dans Chromium : le double-clic sur un nœud pour ouvrir sa boîte de dialogue, et le glissement d'une liaison sur un nœud. Le canevas garde le pointeur pendant tout le glissement : la cible de l'événement était donc toujours le canevas, et une liaison relâchée au-dessus d'un nœud ne trouvait jamais le nœud. Deux bogues aussi gênants que possible dans un éditeur visuel. Les deux sont corrigés.

## Les flux comme du code

Le dépôt est l'endroit où les flux sont relus, il devrait donc pouvoir les déployer. Gardez le fichier de flux dans git, configurez le pilote de diff ci-dessus pour que la pull request se lise comme une relecture, et laissez la fusion le déployer :

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` affiche le diff par rapport à ce qui tourne, le même texte que partout ailleurs, puis déploie par rapport à la révision sur laquelle ce diff a été fait. Si quelqu'un déploie entre-temps, c'est un 409 et un pipeline rouge, pas un écrasement silencieux. `-expect-rev` l'épingle à la révision sur laquelle un plan relu a été fait, et `-dry-run` affiche le diff sans rien déployer. Un fichier sans rien à changer ne déploie rien et n'ajoute rien à l'historique, si bien qu'une fusion qui n'a pas touché aux flux ne pollue pas le journal. Un nœud qui ne démarre pas est déployé et fait quand même échouer le job, car le reste du flux tourne et quelqu'un doit regarder. `export -deployment 41` ressort n'importe quel déploiement de l'historique.

**Un pipeline ne détient jamais de mot de passe d'administrateur.** Il reçoit un jeton d'API :

```bash
hotloop-flow token -name ci
```

affiche un jeton, une seule fois, pour le coffre de secrets de la pipeline, et le hachage à donner au runtime : `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` pour un jeton de déploiement, ou `auth.tokens` dans le fichier de configuration pour tout autre. Le runtime ne détient jamais que le hachage, comme pour un mot de passe. Un jeton de déploiement peut lire les flux et déployer, ce qui inclut le retour arrière, et rien d'autre : ni réglages, ni inject, ni éditeur. Les deux commandes lisent le jeton dans `HOTLOOP_FLOW_TOKEN` (ou `-token-file`) et l'instance dans `HOTLOOP_FLOW_URL` (ou `-url`), jamais un jeton sur la ligne de commande, où il atterrirait dans la liste des processus et dans chaque journal de pipeline qui répète la commande. L'historique montre le jeton comme déployeur, `token:ci`, avec la note passée par le pipeline.

Les identifiants ne voyagent jamais ainsi. Ils ne sont pas dans le fichier de flux, si bien qu'un déploiement depuis git laisse chaque mot de passe de broker exactement là où il était.

## Un miroir git, si vous en voulez un

Le journal de déploiement vit sur la machine. Un dépôt est l'endroit où tous les autres regardent déjà : il a une vue web, du blame, des sauvegardes et des gens qui savent le lire. Pointez Flow vers l'un d'eux et chaque déploiement devient un commit du fichier de flux sur une branche où Flow est seul à écrire, **signé par celui qui l'a déployé**, à l'heure où il l'a déployé, avec sa note pour message :

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

Le mot de passe est un jeton d'accès du serveur git, et il va dans `HOTLOOP_FLOW_GIT_PASSWORD` depuis un Secret, jamais dans le fichier (`HOTLOOP_FLOW_GIT_URL` et `HOTLOOP_FLOW_GIT_USERNAME` fonctionnent aussi). Une URL contenant un mot de passe est refusée au démarrage, si bien que l'URL peut toujours être journalisée. `http://` et `https://` seulement : l'image n'a pas de binaire git pour `file://` ni de clés pour `ssh://`, et un miroir qui échoue à chaque push est pire qu'un miroir qui refuse de démarrer. Les retours arrière et les bases de démarrage disent ce qu'ils sont dans le commit, et chaque commit porte un trailer `Flow-Deployment: N`, ce qui permet à un processus redémarré, ou dont le clone a été effacé, de reprendre exactement là où le dépôt dit qu'il en était, sans doublon.

**Il ne retient jamais un déploiement.** Le push se fait sur sa propre goroutine. Un serveur git en panne, lent ou qui refuse le push ne coûte rien à un déploiement : les commits attendent dans un clone local sous `data/git-mirror` et partent au prochain push qui fonctionne, retenté chaque minute. `GET /deployments` dit jusqu'où le miroir est arrivé et la dernière erreur, et `hotloop_flow_git_mirror_behind_deployments` est le nombre sur lequel alerter. Testé contre le propre serveur smart-HTTP de git derrière une authentification basique : trois déploiements font trois commits de trois auteurs, un push que le serveur refuse attend et rattrape son retard quand il cesse de refuser, et un déploiement avec un serveur git qui met dix secondes à dire non revient en quelques millisecondes.

C'est du Go pur (go-git), le binaire reste donc statique. Cela coûte environ 3.8 MB de binaire, ce qui est mesuré et non supposé. Le binaire faisait 48,083,106 octets avant les catalogues.
