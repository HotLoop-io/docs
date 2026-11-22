---
title: "Des tests à côté des flux"
description: "Écrivez un fichier de tests à côté d'un flux, lancez-le sur une horloge simulée, conditionnez le déploiement à sa réussite : rien ne sort du test."
---

« Ma modification a-t-elle cassé la ligne ? » doit trouver sa réponse avant le déploiement, auprès de la personne qui modifie, et non à 3 h du matin auprès de la personne d'astreinte. Un flux peut donc avoir des tests, en YAML, qui vivent à côté du fichier du flux et passent par la même relecture :

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

C'est le vrai runtime et les vrais nœuds, dans le processus, sans serveur et sans éditeur. Chaque test a son propre runtime : rien de ce qu'un test laisse dans un Delay ou dans un contexte ne peut fuir vers le suivant.

- **`inject`** envoie des messages, dans l'ordre, chacun traité avant l'entrée du suivant. Un nœud qui a une entrée le reçoit là. Une source comme un Inject ou un MQTT In l'émet par sa première sortie comme si elle l'avait produit, et un nœud Inject sans message voit son bouton pressé.
- **`expect`** observe la sortie d'un nœud, les ports étant comptés à partir de 1 comme dans l'éditeur. Un nœud sans sortie, comme un Debug, est vérifié sur ce qu'il a reçu. Une instance de sous-flux est observée sur ses propres sorties, d'où qu'elles viennent à l'intérieur.
- **`msg`** est ce que le message doit contenir. Chaque propriété indiquée doit y figurer avec cette valeur, jusqu'au fond, et tout le reste du message est ignoré : un test sur le payload ne casse donc pas quand quelqu'un se met à renseigner `msg.topic`. **`assert`** est une expression JSONata qui doit donner vrai, pour les vérifications qu'un littéral ne peut pas faire. **`error`** est le texte que doit contenir l'erreur interceptée par un nœud Catch.
- **`within`** est une échéance. Un message en retard échoue, et l'échec dit de combien. **`nothing: true`** et **`count: N`** sont vérifiés une fois le flux retombé au calme, le seul moment où « rien n'est sorti » veut dire quelque chose. Deux attentes sur un même port sont deux messages, dans cet ordre.

Un test se termine dès que tout ce qu'il attend s'est produit et que le flux n'a plus rien à faire. Le `timeout` est de 5 secondes, sauf indication contraire, sur l'horloge propre du test, ce que décrit la section suivante.

Un échec indique ce qui est sorti à la place et où cela diffère :

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

Un test qui ne peut pas s'exécuter est une erreur, pas une réussite : un nœud nommé qui n'est pas dans le flux, un nom partagé par deux nœuds, un port que le nœud n'a pas, ou un nœud du flux qui ne démarre pas. Une clé mal orthographiée aussi. `expcet:` est refusé à la lecture du fichier, car une faute de frappe ignorée en silence laisserait un test sans rien à vérifier, et un test sans rien à vérifier réussit. Le code de sortie est 1 pour tout ce qui n'est pas une réussite complète, et `-junit` écrit le rapport que lit tout système de CI.

## Sur l'horloge du test

Personne ne lance une suite de tests qui attend un Delay de cinq minutes : un test n'attend donc pas. Il tient sa propre horloge et l'avance directement jusqu'à la prochaine chose qu'attend quelque chose dans le flux : un Delay qui relâche, le second message d'un Trigger, un Inject à intervalle ou en crontab, un Join ou un Batch qui expire, un Link Call qui abandonne. Le minuteur se déclenche, le flux traite ce qu'il a émis, et seulement alors l'horloge cherche l'échéance suivante, dans l'ordre où les vraies minutes l'auraient amenée. Cinq minutes de Delay font un pas et environ une milliseconde.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** place une injection à un instant de l'horloge du test, et tout ce qui est dû avant a lieu d'abord. **`within`** et **`timeout`** sont aussi sur cette horloge : `timeout: 1h` sur un flux avec un Inject toutes les dix minutes, ce sont six ticks et quelques millisecondes. **`clock`** fixe le début du test, pour un flux qui dépend de l'heure : un crontab prévu à six heures et demie se déclenche quand l'horloge du test indique six heures et demie. Le `Date` d'un nœud Function, l'horodatage d'un Inject, un nœud Change qui fixe une date et l'`Expires` d'un cookie lisent la même horloge : un flux qui horodate et compare des heures reste cohérent avec lui-même sous test.

La suite éprouve avec elle chaque nœud de temporisation de la palette, à la milliseconde : Delay en modes fixe, aléatoire, débit et horaire, Trigger avec extend, Inject à intervalle, une fois au démarrage et en crontab, expirations de Join et de Batch, et un Link Call qui n'obtient jamais sa réponse. Tout cela, une heure de temps d'usine comprise, s'exécute en bien moins d'une seconde. Ce qu'un test ne peut pas déplacer, c'est le CPU : un flux encore occupé après une minute de temps réel fait échouer le test au lieu de bloquer la suite. `$now()` et `$millis()` de JSONata lisent toujours l'horloge réelle.

## Des tests depuis l'éditeur

Personne n'écrit de test pour un flux qui marche. On l'écrit le jour où il cesse de marcher, c'est-à-dire un jour trop tard. L'éditeur en fabrique donc un à partir de ce que le flux vient de faire, en deux clics.

Chaque message du panneau de débogage a un bouton **Test**. Cliquez, et l'éditeur rédige un test à partir de ce message : ce qui est entré par la source d'où il est venu, réinjecté, et ce que ce nœud Debug a affiché, attendu ici. Modifiez ce que vous voulez, car une lecture qui porte un horodatage se vérifie mieux avec un `assert` que figée à la milliseconde. Cliquez sur **Add to tests** et il rejoint la suite à côté du fichier du flux, à la fin, tout ce qui était déjà écrit restant exactement tel quel, commentaires compris. Un nom que la suite possède déjà reçoit un numéro à la fin plutôt que de remplacer quoi que ce soit.

Comment l'éditeur sait ce qui est entré : le runtime conserve les 64 derniers messages entrés dans le flux par une source et les 64 derniers arrivés à un nœud Debug, sous l'identifiant qu'un message porte d'un nœud à l'autre. C'est un anneau de taille plafonnée, et un message de plus de 64 Ko n'est pas conservé du tout, il ne peut donc jamais faire grossir un pod. Un message repoussé hors de l'anneau, ou qu'un nœud a remplacé par un nouveau en chemin, ne peut pas être rédigé en test, et l'éditeur le dit au lieu de deviner ce qui est entré.

Le panneau **Tests** exécute la suite sur la copie de travail, déployée ou non, et c'est tout l'intérêt : vous le savez avant le déploiement. Chaque nœud traversé par un test réussi reçoit une coche, chaque nœud concerné par un échec reçoit une croix avec la raison au survol, et un clic sur un échec vous mène à son nœud. Modifiez quoi que ce soit et les marques disparaissent, car elles décrivent un flux qui n'existe plus. **Edit** ouvre toute la suite en YAML. Un déploiement que la [barrière](#la-barrière-de-déploiement) refuse arrive dans le même panneau, avec les échecs sur les nœuds.

Tout cela s'exécute dans un vrai navigateur contre le vrai binaire à chaque pull request.

## La barrière de déploiement

Des tests sur l'ordinateur de quelqu'un prouvent le flux qu'il avait sur son ordinateur. La barrière prouve celui qu'on déploie. Gardez la suite sur l'instance, à côté du fichier de flux qu'elle teste (`data/flows.test.yaml` à côté de `data/flows.json`, via `PUT /tests` ou l'éditeur), activez `tests.gate`, et chaque déploiement la lance sur les flux qu'il s'apprête à installer. Un déploiement qui ne passe pas est refusé, avec un 422 et le rapport complet :

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

C'est une vraie exécution : le binaire avec la barrière activée, la suite du début de cette section gardée à côté de son fichier de flux, et un jeton de déploiement.

**Les flux déjà en marche ne le remarquent pas.** La barrière s'exécute avant qu'un seul octet soit écrit : pas de fichier de flux, pas d'identifiants, pas d'enregistrement de déploiement, pas de redémarrage. Le refus entre dans la piste d'audit sous la forme d'un `deploy.refused` qui indique l'échec des tests. Et les tests ne s'exécutent pas du tout dans le processus du serveur. Ils tournent dans un processus enfant, ce même binaire sous la forme `hotloop-flow test -stdin`, à qui l'on remet sur stdin les flux candidats et la suite, car un test démarre chaque nœud du flux et certains s'enregistrent là où tout le processus les partage : un Link In par son id, une route HTTP par son chemin. Exécuté ici, le Link In du candidat répondrait pour celui du flux en marche dès son démarrage. Dans un enfant, il ne peut toucher à rien de ce que la ligne utilise, un nœud qui plante dans sa propre goroutine fait tomber le test et non l'usine, et la mémoire est rendue à sa sortie. Le test le prouve à la dure : le candidat refusé a le même Link In, et après le refus un message envoyé par le lien du flux en marche arrive toujours.

Trois décisions à connaître. **Elle est désactivée par défaut**, car une barrière que l'exploitant n'a pas demandée est un déploiement qui échoue à 3 h du matin pour une raison que personne dans l'équipe de quart ne connaît. **Les tests qui ne peuvent pas s'exécuter ne passent pas** : un enfant qui ne démarre pas ou une exécution plus longue que `tests.timeout` refuse le déploiement et dit lequel. Et **les rollbacks ne passent pas par la barrière.** Un rollback est la façon de sortir d'un mauvais état vers un état qui a déjà tourné, et le retenir à cause des tests d'aujourd'hui est la meilleure façon de prolonger une panne. Avec la barrière activée et sans suite, il n'y a rien qui puisse échouer : le déploiement passe et le journal dit pourquoi il n'a pas été vérifié.

## Contexte et identifiants

Chaque test commence avec un contexte vide, quoi que le test précédent ait laissé. Un compteur qu'un test a poussé à 42 n'est pas le point de départ du suivant : une suite où le second test ne réussit que si le premier s'est exécuté avant est une suite qui ment le jour où quelqu'un lance un seul test. Un test qui a besoin d'un compteur à 41 le dit donc, et dit ce que le contexte doit contenir à la fin :

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` dans une attente est comparé comme `msg`, et `null` signifie que la clé ne doit pas être définie. Un échec indique ce que contient réellement la portée, car la réponse habituelle est une faute de frappe : `flow context of "Line 3" (t1): cuont: not set; it holds count`.

Un test ne voit jamais les vrais identifiants. Il s'exécute avec ceux qu'il nomme, ce qui le rend sûr à versionner, et ils parviennent à un nœud exactement comme les vrais : le mot de passe d'une requête HTTP apparaît dans l'en-tête `Authorization` qu'elle aurait envoyé, et une configuration InfluxDB qui ne démarre pas sans jeton démarre avec celui du test. Un nœud qui lit un mot de passe dans un fichier monté via `ew_credentialFiles` reçoit à la place l'identifiant du test pour ce champ, car un test ne lit rien sur le disque, et un identifiant vide quand le test n'en nomme aucun.

Le contexte vit en mémoire pour un test, jamais dans la base d'état : un test ne peut donc ni lire ce que les flux en marche ont laissé, ni leur laisser quoi que ce soit. Une fixture est du YAML dans le test, pas un fichier qui fait semblant d'être une base de données.

## Rien ne sort du test

Un test qui exécuterait pour de vrai votre MQTT Out publierait sur le broker de l'usine, et ce n'est plus un test, c'est un déploiement. Sous test, tout nœud qui parle au monde extérieur au processus reçoit donc un substitut : MQTT en entrée et en sortie, HTTP in, response et request, PostgreSQL, InfluxDB, TCP et UDP en entrée, sortie et requête, WebSocket en entrée et en sortie avec l'écouteur et le client qui sont derrière, les nœuds de fichiers, `exec`, `scan` et `netinfo`.

Le nœud fait encore tout son travail jusqu'au fil. Le MQTT Out calcule toujours le topic, le QoS et les octets ; le HTTP Request produit toujours l'URL, construit le corps et suit les redirections ; le nœud PostgreSQL construit toujours le SQL et ses paramètres. Puis il remet le tout au substitut, qui l'enregistre et répond ce que le test a scénarisé. Sans scénario, la réponse est rien et succès : aucune ligne, un 200 vide, une commande terminée avec 0. Les sources (MQTT In, HTTP In, TCP et UDP In, WebSocket In, Watch) ne s'abonnent pas, n'écoutent pas, n'interrogent pas : ce qui arrive est ce que le test injecte.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** est ce que le nœud aurait envoyé, comparé comme `msg`. **`replies`** scénarise ce qui revient : la première réponse listée pour un nœud répond à son premier appel, la suivante au deuxième, et la dernière continue de répondre, si bien que « il a répondu, puis il s'est arrêté » tient en deux lignes. **`error`** fait échouer l'appel comme le ferait le vrai, de sorte que le chemin que prend votre flux quand l'historien est en panne se teste avant qu'il ne le soit.

| Nœud | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` pour une requête, `rowCount` pour un insert |
| InfluxDB | `line`, le line protocol | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` en réponse) | |
| TCP Request | `host`, `port`, `payload` | `payload`, lu comme le nœud lit une vraie réponse |
| WebSocket Out | `payload` (`session` en réponse) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, le contenu |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Quelques points qu'un test ne vérifie pas, volontairement, parce qu'ils relèvent de la machine et non du flux : la liste d'autorisation de `exec`, les périmètres de chemins et de découverte, et les certificats d'un `tls-config`. Sous test, rien ne s'exécute, ne s'ouvre, ne se sonde ni ne se compose, il n'y a donc rien à cloisonner ni à chiffrer, et le déploiement répond toujours de tout cela sur la machine où il atterrit.

La preuve est un test qui pointe chacun de ces nœuds vers un port TCP, un port UDP et un répertoire que le test détient, fait passer une lecture par tous, vérifie octet par octet ce que chacun aurait envoyé, puis compte : zéro connexion, zéro datagramme, aucun fichier écrit, rien d'exécuté. Un nœud qui sort vers l'extérieur sans substitut est refusé par son nom avant que quoi que ce soit s'exécute, et le test de la palette échoue si quelqu'un en ajoute un.
