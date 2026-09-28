---
title: "Upgrading HotLoop Gateway from 4.3.1 to 4.16"
description: "4.3.1 to 4.16.0 is not a plain helm upgrade. The new names, the steps that keep your data, what behaves differently, and every API change a script will notice."
sidebar:
  label: "Upgrading from 4.3.1"
---

4.3.1 was the last published release, back in August. Everything from 4.4.0 to 4.15.3 was merged and never published, so going to 4.16.0 you get all of it at once, under a new name, a new image, a new chart and a new license. Read this before you touch a running plant.

## New name on everything

| What | 4.3.1 | 4.16.0 |
|---|---|---|
| Image | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| Chart repository | the old address, now a 404 | `https://hotloop.io/hotloop` |
| Chart | `industrial-iot` | `hotloop` |
| Environment variables | `IIOT_*` | `HOTLOOP_*` (since 4.9.0) |

## It is not a plain helm upgrade

The chart's name is baked into the Deployment's and the StatefulSet's selectors, and Kubernetes won't change a selector in place, so pointing the old release at the new chart just fails. Keep the release name and the namespace, and:

1. `pg_dump` the database. Belt and braces.
2. Delete the old Deployment (`<release>`) and StatefulSet (`<release>-postgresql`). The database volume is its own claim, and it stays.
3. Add the repository and upgrade with the values file you ran 4.3.1 with:

   ```bash
   helm repo add hotloop https://hotloop.io/hotloop
   helm repo update
   helm upgrade <release> hotloop/hotloop --version 4.16.0 \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   Nothing in that file was removed from the chart. Rename any `IIOT_` in `extraEnv` to `HOTLOOP_`, and drop an `image.repository` override if you had one. Don't use `--reuse-values`. It skips every default this chart added since 4.3.1, and that's more than half its keys.

The names, the Secret's database password and the volume claim render identical to 4.3.1's, so the new database pod mounts the old data. The Gateway migrates the schema forward on start and updates TimescaleDB from 2.29.1 to 2.30.1 while it's at it.

We checked that by rendering both charts side by side, not by running it on a live cluster. That is exactly what step 1 is for. If the upgrade surprises you, you have a dump from five minutes ago, and we want to hear about it at [support@hotloop.io](mailto:support@hotloop.io).

## What behaves differently

- **There is a login.** The chart creates an `admin` account on first install; see [Install](/gateway/install/#sign-in) for reading the password back.
- **Writes default to off**, agents included, since 4.4.0. Set `safety.allowWrites` once you've reviewed the deployment.
- **A timezone that won't load stops startup.** `HOTLOOP_TIMEZONE` or `TZ` set to something bogus used to run on UTC without a word, which is worse for reports, schedules and shift changes.
- **Device credentials read back as `[redacted]`** to every role (4.15.1).
- **The poll settings are `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL` and `HOTLOOP_POLL_TIMEOUT`.** The old Settings screen told you `..._MS` names that nothing ever read. If you set those, they did nothing. Rename them.
- **Edge publish has a values block now.** If you set it through `extraEnv`, move it to `edgePublish:` and drop the variables, or they're set twice.
- **The OPC UA server says `HotLoop`** as its manufacturer, where it used to say Fireball Industries. If a client or an inventory script matches on that string, change it.
- **The license.** 4.3.1 was Apache-2.0. 4.16.0 is under the HotLoop Community License v1.0: free for individual, home, hobbyist, nonprofit and education use, and business use is free through EmberNET. See [Licensing](/licensing/).

## API changes

If you have a script or an integration against the API, this is the list. Everything else is additions.

- **Empty lists are `[]`, never `null`,** in every response and every stream event, at any depth. `GET /api/runs`, automations, a device's tags, the write audit, users, alarm events, sparklines and an empty history window all used to answer `null`. A `null` you still see is never a list; it's a documented nullable field, like an entity's `equipment_id`.
- **`/api/history` buckets with no good reading are `null`** and draw as gaps, and bad readings stay out of trend averages.
- **An error the API can't place is a 500** with a reference into the server log, not a 400. A device that errors on a write or a browse is a 502.
- **`alarm.turn_on`, and any other service an alarm entity doesn't take, is a 400** ("unknown service"). It used to answer success and do nothing.
- **Unshelving an alarm that isn't shelved is a 409.** It used to set the alarm to normal whatever it was doing, which could wipe a cleared, unacknowledged alarm off the list.
- **Tag JSON always carries `minValue`, `maxValue` and `hasRange`,** and `hasRange` alone says whether there's a range.
- **New: `?dry_run=true` on `POST /api/services/{domain}/{service}`.** It runs the gate's checks, writes nothing, audits nothing, and answers with the refusal the real call would give. `dry_run` takes `true` or `false` and nothing else; `yes` is a 400, because a guess the wrong way turns a question into a command.
- **`GET /api/settings`** names the variable a value actually came from in `envVar`, fallbacks included, and a variable set to an empty string counts as unset.

The [4.16.0 release notes](https://hotloop.io/releases/gateway/) have the rest of what changed, version by version back to 4.4.0.
