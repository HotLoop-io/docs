---
title: "La surveillance"
description: "Santé, disponibilité, métriques Prometheus et traces pour chaque exécution et chaque étape : un travail bloqué se voit sur un graphique, pas dans une plainte."
---

`/healthz` indique que le processus est en marche. `/readyz` indique qu'il peut faire son travail : la base de données répond et a le schéma dont ce binaire a besoin. `/metrics` est au format Prometheus : exécutions par statut et leur durée, temps passé dans chaque type d'étape, nombre d'exécutions en file, en cours ou en attente et depuis combien de temps la plus ancienne attend, latence des webhooks, échecs de renouvellement OAuth et déclencheurs qui tiennent une connexion. Ils partagent l'adresse principale, ou ont une adresse à eux avec `HOTLOOP_CASCADE_OPS_LISTEN` (un worker n'a pas d'autre adresse et utilise `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` fait exiger un jeton porteur à `/metrics`.

Chaque exécution est une trace OpenTelemetry avec un span par étape. Indiquez un point de terminaison OTLP avec les variables standard (`OTEL_EXPORTER_OTLP_ENDPOINT` et sa famille) et les spans y sont envoyés ; si aucun n'est indiqué, rien n'est envoyé. L'identifiant de trace est celui de l'exécution, ou la trace de l'appelant quand un webhook arrive avec un `traceparent`, et l'étape HTTP en transmet un à ce qu'elle appelle.
