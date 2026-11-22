---
title: "Démarrage rapide de HotLoop Flow"
description: "Compilez ou lancez HotLoop Flow, définissez le compte administrateur et le secret d'identifiants qu'il exige, et démarrez-le depuis les sources ou l'image."
---

Depuis les sources :

```bash
cd web && npm install && npm run build && cd ..
go build -o hotloop-flow ./cmd/hotloop-flow

export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET="$(openssl rand -hex 32)"

./hotloop-flow
```

La compilation de l'éditeur vient d'abord et n'est pas facultative. Le bundle est intégré avec `go:embed`, donc une compilation Go sans lui échoue sur un motif manquant au lieu de produire un binaire sans éditeur.

Ou passez tout cela :

```bash
podman run --rm -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<bcrypt hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET="$(openssl rand -hex 32)" \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

Générez le hash avec `podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'`. L'image est distroless, non root, sans shell : il n'y a rien dans quoi faire un `exec` et rien sur quoi rebondir pour qui obtiendrait une exécution de code.

Ouvrez ensuite <http://localhost:1880>. Déposez un `flows.json` dans le répertoire de données et redémarrez, ou construisez simplement le flux dans l'éditeur. L'éditeur est Astro avec des îlots Svelte sur un canevas en TypeScript pur et SVG natif, compilé en fichiers statiques dans le binaire : 190.7 kB de JS et 30.1 kB de CSS minifiés, 62.5 kB et 6.8 kB en gzip, lus dans `web/dist/_astro` après `npm run build`. Rien n'y est téléchargé de nulle part, donc il fonctionne sur une machine sans internet.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `hotloop-flow` | Sert le runtime, l'API d'administration et l'éditeur. C'est le défaut. |
| `hotloop-flow -config <path>` | Pareil, depuis un fichier YAML. Lit aussi `HOTLOOP_FLOW_CONFIG`. |
| `hotloop-flow hash-password` | Hash bcrypt d'un mot de passe. Accepte `-password` ou `HOTLOOP_FLOW_PASSWORD`. Refuse tout ce qui fait moins de 8 caractères. |
| `hotloop-flow import <flows.json>` | Indique ce qui se passerait avant de le déployer. |
| `hotloop-flow diff <old> <new>` | Diff nœud par nœud de deux fichiers de flux. Sert aussi de pilote de diff et de difftool pour git. |
| `hotloop-flow plugin keygen`, `sign`, `verify` | Crée une clé d'éditeur, signe un [plugin](/fr/flow/plugins/) et lance toutes les vérifications qu'un serveur fait au chargement, en disant pourquoi il refuserait. |
| `hotloop-flow test <tests.yaml>` | Lance des [tests de flux](/fr/flow/tests/) dans le processus. `-junit` pour la CI/CD. |
| `hotloop-flow deploy -file <flows.json>` | Affiche le diff par rapport à une instance en marche, puis déploie avec une note. Pour la CI/CD. |
| `hotloop-flow export` | Le fichier de flux en cours d'exécution, octet pour octet, ou `-deployment N` depuis l'historique. |
| `hotloop-flow token` | Un nouveau jeton d'API et le hash à configurer pour lui. |
| `hotloop-flow bench` | Le banc d'essai qui a produit [les chiffres](/fr/flow/overview/#les-chiffres). |
| `hotloop-flow version` | La version. |
