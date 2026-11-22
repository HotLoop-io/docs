---
title: "Langues de l'interface web"
description: "L'interface web en anglais et treize autres langues, l'arabe étant disposé de droite à gauche, à choisir dans la barre du haut ou sur la carte de connexion."
---

L'interface web de HotLoop IoT, Edge et Gateway (et de HotLoop for CODESYS, qui exécute l'interface d'Edge) existe en anglais et en 13 autres langues : espagnol (es), français (fr), italien (it), allemand (de), norvégien bokmål (nb), bulgare (bg), grec (el), coréen (ko), japonais (ja), vietnamien (vi), hindi (hi), chinois simplifié (zh-Hans) et arabe (ar, disposé de droite à gauche).

Choisissez-en une dans la liste des langues de la barre du haut, ou sur la carte de connexion. Le choix est conservé dans ce navigateur. Sans choix, la page prend la première des langues du navigateur que HotLoop propose, et l'anglais si aucune ne correspond. Une langue n'apparaît dans la liste que lorsque son fichier est complet.

Ce qui suit la langue : chaque mot de chaque écran, l'ordre et les signes des nombres (une virgule décimale en allemand, en français et en espagnol), les dates et les heures (horloge de 24 heures), les formes du pluriel (l'arabe en a six) et le sens de la page. Les noms de produits et de protocoles (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) restent tels qu'écrits. Les valeurs de l'usine, comme les noms de tags, les noms d'appareils, les messages d'alarme saisis par quelqu'un et le texte d'erreur renvoyé par le serveur, sont affichées telles quelles.

## Comment ça marche

* [i18next](https://www.i18next.com/) 27 cherche le message, remplit `{{name}}` et choisit la forme du pluriel. Il interroge `Intl.PluralRules` du navigateur lui-même, donc les règles de pluriel sont celles d'Unicode CLDR. Les nombres et les dates utilisent `Intl.NumberFormat` et `Intl.DateTimeFormat` via `web/src/lib/format.ts`.
* Les messages se trouvent dans `web/src/i18n/locales/<language>.json`, à plat, une clé par message. `en.json` est la source. Chaque autre fichier a exactement ses clés.
* Dans un modèle ou un script, écrivez `tl('area.key')` ou `tl('area.key', { name })`. Un message avec un compte a une clé par forme du pluriel (`key_one`, `key_other`, et `key_few`, `key_many`, `key_two`, `key_zero` là où une langue en a) et se demande par la clé seule avec `count` : `tl('overview.tags_count', { count: n })`.
* L'anglais fait partie de la page. Une autre langue est un fichier à part, récupéré quand quelqu'un la choisit.
* `web/src/i18n/index.svelte.ts` garde la langue ; la changer redessine tous les écrans. Un mot gardé dans une constante en haut d'un fichier `.ts` est lu une seule fois au chargement du fichier et n'est pas traduit : écrivez-le comme un getter (`get label() { return tl('x.y'); }`) ou gardez la clé et appelez `tl()` à l'endroit où il est dessiné.
* La page définit `<html lang dir>`. Le CSS utilise des propriétés logiques (`margin-inline-start`, `inset-inline-end`, `text-align: start`), donc la mise en page se retourne toute seule pour l'arabe.

## Ajouter ou changer un mot

1. Ajoutez le message à `en.json` et écrivez-le dans le code avec `tl()`.
2. Ajoutez-le à chaque autre fichier de langue, rédigé par une personne qui lit cette langue, en suivant la base de termes partagée du codex (`work/notes/i18n/glossary/`). Des phrases courtes et claires. Les noms de produits et de protocoles restent en anglais.
3. Lancez `cd web && npm run check:i18n`. Il échoue quand un fichier de langue n'a pas une clé, a un `{{placeholder}}` différent de l'anglais ou n'a pas une forme de pluriel dont sa langue a besoin ; quand une clé n'est pas utilisée ; et quand de l'anglais est écrit dans un modèle ou dans le code sans passer par `tl()`. Il s'exécute avant chaque `npm run build` et dans `npm run typecheck`, donc la suite complète et la compilation de la version s'arrêtent dessus. L'anglais qui doit rester (un nom, un exemple de code) va dans `web/i18n/allow.json` avec la raison.

Définissez `HOTLOOP_TEST_BROWSER_GALLERY` et `HOTLOOP_TEST_BROWSER_ARTIFACTS` pour garder une capture de chacun.

## Ce qui n'est pas traduit

* Le texte envoyé par le serveur : les messages d'erreur de l'API, les messages de notification et d'alarme, et la CLI. L'interface les affiche tels qu'ils arrivent.
* La documentation, les noms du serveur OPC UA, le broker MQTT et les valeurs du chart Helm.
