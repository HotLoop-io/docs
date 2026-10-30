---
reviewed: hotloop=4.18.11
title: "Upgrading HotLoop Gateway to {{hotloop}}"
description: "From 4.18.10 the database moves to PostgreSQL 17 by itself, which needs disk and a backup. From 4.17.0 it is a plain helm upgrade. Older, you go in hops."
sidebar:
  label: "Upgrading"
---

Four ways onto {{hotloop}}, and they are nothing alike. From 4.18.10 the database engine changes under you, and you want to know that before it happens. From 4.17.0 it's a plain `helm upgrade`, with a couple of defaults that moved. From 4.16.0 you go through 4.17.0 first, and afterwards a new Secret is as much a part of your plant's data as the database is. From 4.3.1 it's a renamed chart that a plain `helm upgrade` can't touch, and you go through 4.16.0 and 4.17.0 on the way. The release notes cover one hop at a time, and none of them covers jumping over a release, so this page doesn't promise that one works. Find the one that's yours and read all of it before you touch a running plant.

:::note[Older charts are fetched by URL]
The chart repository's index lists only the latest chart, {{hotloop}}, so `hotloop/hotloop --version 4.17.0` won't resolve. The older chart tarballs are still served, and the commands below for 4.16.0 and 4.17.0 name the chart by its URL instead, like `https://hotloop.io/hotloop/hotloop-4.17.0.tgz`.
:::

## Upgrading from 4.18.10

Why bother: the database is PostgreSQL 17 now, and the box moves itself. You also get [integrations](/iot/integrations/) with SNMP and BACnet/IP, kiosk sign-in, alarm escalation, and a UI that installs on a phone. [The Gateway overview](/gateway/overview/#new-in-41811) has the list. What follows is the part that bites.

PostgreSQL will not open another major version's data directory, so a bare image change would have left every existing box with a database that can't start. HotLoop doesn't ask you to dump and reload. The first start after the upgrade runs a script before the database, and the script does the move.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

The same for `hotloop-edge` and `hotloop-iot`. Take a backup on 4.18.10 first and copy it off the box. HotLoop's own backup is made by the running app through the running database, so it can't be taken in the step that runs before the database starts.

### What happens on the first start from 4.18.10

- **The database pod sits in `Init`, and the app waits for it.** On the chart it is two init containers on the database pod: the old image hands over its PostgreSQL 16 install and the new image runs `pg_upgrade`, in copy mode, into a new directory beside the old one. It starts the new server once to prove it opens, and only then swaps the names. How long that takes scales with your data, so watch the log the first time on a big one: `kubectl logs <release>-postgresql-0 -c pg-upgrade`. On Quadlet it is `hotloop-db-upgrade.container`, a oneshot unit the database unit requires: `journalctl -u hotloop-db-upgrade`.
- **It needs about as much free space as your data takes, and it checks before it starts.** If there isn't room it stops with the 16 data exactly as it was and the database not started. Free the disk and start it again.
- **`pgdata.pg16` stays on the volume, and it is yours to delete.** The old directory is renamed and left there. It is the whole PostgreSQL 16 database as it stood at the upgrade, which is your backup and your way back, and it is as big as the database. When the box has run on 17 as long as you want:

  ```bash
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **A failure leaves you where you were.** If anything fails before the swap, the 16 data is untouched and the database does not start on a half-built directory. On the chart the pod stays in `Init:Error`. On Quadlet the upgrade unit fails and the database unit behind it never starts. Fix what the log says and start it again.
- **`helm rollback` to 4.18.10 will not start its database.** This is the caveat. A rollback puts the database image back to PostgreSQL 16, and 16 will not open a 17 directory. Nothing is lost and nothing is half changed, the database just does not start. Getting it back means the swap in [the deployment guide](https://github.com/HotLoop-io/hotloop/blob/v4.18.11/docs/DEPLOYMENT.md#going-back): stop the database, move `pgdata` to `pgdata.pg17` and `pgdata.pg16` to `pgdata`. **That drops every write made on 17 since the upgrade,** because `pgdata.pg16` is the database as it was at that moment. Roll forward when you can. The swap back works once, and the next upgrade refuses to run while a `pgdata.pg16` is in the way. It is documented, not run by a test.
- **Quadlet boxes aren't hit by that.** Podman's auto-update rolls back only the app, never the database, and the 4.18.10 app reads a PostgreSQL 17 database fine, because migrations only add. A Quadlet box that rolls an update back keeps running.
- **One new migration, `0025_kiosk_pin`.** It only adds columns, every one with a default, so 4.18.10 runs on the schema it leaves.
- **A lockout is on now, for every install.** Ten wrong passwords or PINs in a row lock that one account for 5 minutes, and an admin can unlock it. A script that retries a wrong password more than ten times starts getting `429`. `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0` turns it off.
- **Turning the upgrade off.** `database.postgresql.upgrade.enabled: false` drops the init containers, and a volume still on 16 then stops the database from starting. Leave it on. With it on, a fresh install still pulls the PostgreSQL 16 image once per node, because an init container's image is pulled before it runs.

### Quadlet, and the Edge Relay

Copy the new `hotloop-db.container`, `hotloop-db-upgrade.container`, and `hotloop-db-upgrade.sh` from your product's directory in `deploy/quadlet/` into the units directory, run `systemctl daemon-reload`, and restart `hotloop-db.service`. The database unit requires the upgrade unit, so a box that only got the new database unit does not start on 16 data, and says why. The Edge Relay has no database and nothing to do. It ships at {{hotloop}} because every product ships in lockstep.

### API changes from 4.18.10

- **New routes:** `GET` and `PUT /api/notify/escalation`, `GET /manifest.webmanifest` and `GET /sw.js` (no session, because a phone asks before anybody has signed in), `GET /api/integrations` with `POST /api/integrations/{id}/probe` and `/setup`, `POST /api/auth/kiosk`, `POST /api/auth/activity`, `PUT` and `DELETE /api/users/{username}/pin`, and `DELETE /api/users/{username}/lockout`.
- **A new permission, `notify.escalation`,** admin only. The viewer and operator roles did not get it.
- **Two new protocols,** `snmp` and `bacnet`, in `GET /api/protocols`. The alarm trail has two new event types, `escalated` and `escalation-ended`, and a script that assumes the old list will meet them.
- **Times come back in UTC,** every one history hands back. A script that compared the strings sees the offset become `Z`. One that compares instants sees nothing.

## Upgrading from 4.17.0

Why bother: the Gateway stops being the only image. IoT and Edge are new, the database is a setting, devices that announce themselves over MQTT show up on their own, history can be written out to the plant's own database, and a box that follows `:stable` rolls a bad update back by itself. That last one only works because migrations only add. [The Gateway overview](/gateway/overview/#new-in-41810) has the list.

It's a plain `helm upgrade`. I rendered the 4.17.0 and {{hotloop}} Gateway charts side by side with the same values: the same eight objects, the same selectors, the same volume claims.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`--reset-then-reuse-values`, or your values file with `-f`. Plain `--reuse-values` happens to render this time, but it replays 4.17.0's values and drops every default this release added, which is how you end up on the old queue limit below without meaning to.

### What happens on the first start from 4.17.0

- **Migrations 0016 to 0025 run:** `0016_mqtt_discovery`, `0017_broker_logins`, `0018_mqtt_sources`, `0019_historian_targets`, `0020_net_finds`, `0021_mqtt_source_dialects`, `0022_mqtt_source_shelly`, `0023_dashboards` (the table the dashboards you build are saved in) and `0024_tag_no_data` (a `no_data` column on tags, empty for every tag that already exists, which is what those tags already did) and `0025_kiosk_pin` (columns for a PIN hash, a session's idle limit, and the lockout counters). All additive. `pg_dump` first, like always.
- **`edgePublish.queueMaxBytes` defaults to 64 MiB, not unbounded.** It only matters if you publish upstream over Sparkplug. Past the limit the oldest readings are dropped and counted. An unbounded queue fills the volume in a long enough outage, which is worse, but it is a changed default. 64 MiB is about two and three quarter minutes at 2,000 readings a second, so size it from your own rate (about 180 bytes a reading), or set it to `0` for the old behavior. HotLoop warns at startup when you do. A release upgraded with `--reuse-values` keeps whatever it had.
- **Broker logins.** Logins from `HOTLOOP_BROKER_USERS` still do anything, as before, because nobody should upgrade into a plant whose Sparkplug traffic bounces off rules they never wrote. Logins you make in Settings, MQTT carry topic rules from a profile. A broker with no `HOTLOOP_BROKER_USERS` starts now, and only HotLoop and the logins made in it get in.
- **The database moves from PostgreSQL 16 to 17 on this first start,** by itself, and it needs free disk. [The 4.18.10 section](#upgrading-from-41810) says how it goes, and that is the part to read first.
- **Going back to 4.17.0 is a database swap now, not a `helm rollback`.** The schema only grew and 4.17.0 runs on it, but 4.17.0's database is PostgreSQL 16 and will not open the 17 directory the upgrade left; the swap back is in the 4.18.10 section. Take a backup before you upgrade anyway. From here on the app also counts how far ahead its database is, and refuses to start, naming both versions, once the database is two releases ahead of it.
- **Want a different product?** IoT to Edge to the Gateway keeps every device, tag, entity, automation, alarm, user, and hour of history. Take a backup, then `helm upgrade hotloop hotloop/hotloop-edge` on the same release. [The lineup](/products/) has what has and hasn't been run, and going back down a product hasn't.

### The Edge Relay, and Quadlet

Upgrade the relay's chart with `--reset-then-reuse-values` too. Quadlet users take the new `edge-relay.container`: it follows `:stable` instead of pinning 4.17.0, and it carries the healthcheck and `--sdnotify=healthy` that make a bad update roll back. Without those two a dead update is reported as a success. A device file pushed from the Gateway applies live now, with no restart, where on 4.17.0 it waited for one. [The Edge Relay install page](/edge-relay/install/) has the unit in full.

The Gateway has Quadlet units now, which 4.17.0 didn't. They're the `gateway/` directory of [Podman Quadlet](/install/quadlet/), and [the Gateway install page](/gateway/install/#podman-quadlet) has the steps.

### API changes from 4.17.0

- **New routes:** `/api/discovery` and its `accept`, `ignore`, `unignore`, and `review` actions, `/api/network-discovery`, and its `probe`, `accept`, `ignore`, and `unignore`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` and `POST /api/fleet/{id}/update`, which approves the image update a relay is holding. Nothing was removed.
- **`GET /api/status` says `product` and `features`,** and the image digest. A script asks instead of probing. A route for a feature the product doesn't have answers `404` with `{"error":...,"product":...,"feature":...}`.
- **New permission:** `fleet.update`, admin only. The operator role didn't change.

## Upgrading from 4.16.0

This is the hop to 4.17.0, and from 4.17.0 you go on to {{hotloop}} with [the section above](#upgrading-from-4170). Everything below was proven against 4.17.0.

Why bother: 4.16.0 has bugs a running plant can trip over, and 4.17.0 fixes them. The command prompt can swallow a Set, so an operator watches the prompt close, figures the setpoint went out, and nothing was written. Saving a rule in the editor, even to rename it, quietly resets its run budget to five minutes. A device file pushed to an Edge Relay never lands, while the Gateway says `config pushed`. And an EmberNet App Store deploy loses its tenant. On top of the fixes you get [recipes](/iot/recipes/), [scripts](/iot/scripts/), [blueprints](/iot/blueprints/), [helpers](/iot/helpers/), the [logbook](/iot/logbook/), the new [automation](/iot/automations/) steps, read-only [UniFi](/iot/unifi/), and [MCP](/iot/mcp/) going from 16 tools to 25.

It's a plain `helm upgrade`. We rendered both charts at both versions: every selector and every volume claim is identical, and the only new object is the key's Secret.

```bash
helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.17.0.tgz --reset-then-reuse-values
```

`--reset-then-reuse-values`, or your values file with `-f`. **Not `--reuse-values`.** That replays 4.16.0's values and drops every default this chart added, and the render dies on the first one it needs (`nil pointer evaluating interface {}.enabled`, from `secretKey`). Nothing changes on the cluster when it does, so just run it again the right way.

### What happens on the first start

We checked this by running the released 4.16.0 image on a database, then 4.17.0 on the same one.

- **Migrations 0009 to 0015 run:** `0009_helpers`, `0010_logbook`, `0011_scripts`, `0012_tag_device_class`, `0013_recipes`, `0014_blueprints`, and `0015_unifi`. All additive. On an empty plant they took a fifth of a second. On yours they take as long as your database does. `pg_dump` first, like always.
- **Your device passwords get encrypted.** The chart makes `<release>-secret-key` on this upgrade (it didn't exist in 4.16.0), and the Gateway seals every stored credential at that start and says so in its log: `encrypted stored device credentials devices=N`. The devices keep connecting, and nobody has to type anything in again.
- **From then on, that key is part of your data.** Start the Gateway without it and every device with a sealed password stays down, retrying, with an error that names the key it needs. A backup taken after the upgrade restores only where that key is mounted, and `--restore-from` refuses it by name anywhere else. If the key is gone for good, `--restore-keep-unreadable-credentials` brings everything else back and leaves those devices down until somebody types the passwords in again. A backup from 4.16.0 restores anywhere, and its credentials are sealed as soon as the restore finishes.
- **Going back to 4.16.0** on the same database starts (we tried it), but 4.16.0 knows nothing about sealing. It hands each device the sealed text as its password, so anything that checks a password refuses it. If you have to go back, restore the `pg_dump` you took before the upgrade. That's the whole reason you took it.
- **Rendering the chart instead of installing it?** The key is generated by a `lookup` that only a real `helm install` or `helm upgrade` can do. Anything that runs `helm template` and applies the result gets a new key on every render, and the next sync locks every sealed password out. Make your own key with `hotloop gen-secret-key`, put it in a Secret you manage, and set `secretKey.existingSecret`. Helm, Fleet, and the EmberNet App Store all install for real and don't need this.

So the new job after this upgrade: back up `<release>-secret-key` the way you back up the rest of the cluster's secrets, and keep it somewhere other than next to your backups. A key sitting beside the backups it protects protects nothing. [Install](/gateway/install/#back-up-the-key-before-you-need-it) has the rest of what the key covers.

### The Edge Relay

The relay is 4.17.0 too, released from the same tag. Upgrade its chart to 4.17.0, by the same kind of URL, `https://hotloop.io/hotloop/hotloop-edge-relay-4.17.0.tgz`, and with the same flag rule: `--reset-then-reuse-values` or your values file. `--reuse-values` on the relay doesn't even fail. It drops the chart's new `pushedDevicesFile` default, renders the variable empty, and a push goes right back to dying on the read-only mount. Then know four things.

- **A pushed device file lives at `/data/pushed-devices.json`** (`HOTLOOP_EDGE_RELAY_PUSHED_FILE`, the chart's `pushedDevicesFile`), on the relay's volume. It wins over the chart's `devices` for as long as it exists, through restarts, reschedules, and a `helm upgrade` that changes `devices`. The relay logs which file it booted from. To go back to the local file, `DELETE /api/fleet/{id}/config` on the Gateway (`fleet.config`) while the relay is connected, then restart it. That restart is 4.17.0's. From 4.18.10 a connected relay switches back on the spot.
- **An old push can come back.** A push you made to a 4.16.0 relay never landed, but the broker still holds it, retained, and a 4.17.0 relay picks it up at its first boot and runs it. If it's stale, clear it with the same `DELETE` right after the upgrade and restart the relay. From 4.18.10 the clear applies live and the restart isn't needed.
- **Quadlet: take the new `edge-relay.container`.** 4.17.0's unit pinned 4.17.0 and set `HOTLOOP_EDGE_RELAY_PUSHED_FILE`, and the current one sets it too, but follows `:stable` instead. Without that line a push still fails on the read-only root. [The Edge Relay install page](/edge-relay/install/#quadlet) has the unit in full.
- **`persistence.enabled=false` boots now,** on an emptyDir capped at `persistence.size`. Know what it costs before you pick it: every time the pod is replaced you lose the forward queue, any pushed device file, and the OPC UA client certificate. Anything you care about gets a PVC, which is the default.

### What a script against the API will notice

- **A time that hasn't happened is left out.** Not `null`, left out. 4.16.0 sent `0001-01-01T00:00:00Z` for `lastRun` on a rule or script that never ran, `lastPoll` and `lastGood` on a device never polled, `clearedAt`, `ackedAt` and `shelvedUntil` on a standing alarm, `raisedAt` on one never raised, the same fields on the live feed's `alarm` event, and a few more. That's how a rule that had never run said "Last run 739887d ago". If your code tests for year one, test for the field being there instead.
- **Operators get new permissions the moment you upgrade:** `helpers.write`, `scripts.run`, `recipes.apply`, and `blueprints.apply`. So your operators can set helpers, run scripts, apply recipes, and make rules from blueprints straight away. Writing scripts, recipes, and blueprints (`scripts.write`, `recipes.write`, `blueprints.write`) is admin. Everybody reads them. A recipe can also name its own `recipes.apply.<name>`.
- **New routes:** `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, the UniFi ones (`/api/devices/{id}/network` and `/api/unifi/{id}/...`), and `DELETE /api/fleet/{id}/config`.
- **Tags carry `deviceClass`**, and it rides through to their entities.
- **Rules carry `blueprintId`, `blueprintVersion`, and `blueprintInputs`.** A rule written by hand has none. Saving a rule still replaces it whole, and a body can't move a rule to a different blueprint or version.

## Upgrading from 4.3.1

4.3.1 was published in August, and nothing after it was until 4.16.0. Everything from 4.4.0 to 4.15.3 was merged and never published, so leaving 4.3.1 you take all of it in one jump, under a new name, a new image, a new chart, and a new license. This section takes you to 4.16.0, the release this procedure was proven against. From there, [Upgrading from 4.16.0](#upgrading-from-4160) above is the plain upgrade to 4.17.0, and [Upgrading from 4.17.0](#upgrading-from-4170) is the one after it. Read all three before you touch a running plant. They're short, and they're shorter than explaining to the plant manager why the historian is empty.

### New name on everything

| What | 4.3.1 | 4.16.0 and later |
|---|---|---|
| Image | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| Chart repository | the old address, now a 404 | `https://hotloop.io/hotloop` |
| Chart | `industrial-iot` | `hotloop` |
| Environment variables | `IIOT_*` | `HOTLOOP_*` (since 4.9.0) |

### It is not a plain helm upgrade

The chart's name is baked into the Deployment's and the StatefulSet's selectors, and Kubernetes flat out refuses to change a selector in place. Point the old release at the new chart and it just fails. Keep the release name and the namespace, and:

1. `pg_dump` the database. Belt and braces. You'll be glad you did.
2. Delete the old Deployment (`<release>`) and StatefulSet (`<release>-postgresql`). The database volume is its own claim, and it stays put.
3. Add the repository and upgrade with the values file you ran 4.3.1 with:

   ```bash
   helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.16.0.tgz \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   That's the 4.16.0 chart by its URL, because the repository's index lists only the latest chart. Once you're on 4.16.0, add the repository (`helm repo add hotloop https://hotloop.io/hotloop`) for the hops after it.

   Nothing in that file was removed from the chart. Rename any `IIOT_` in `extraEnv` to `HOTLOOP_`, and drop an `image.repository` override if you had one. Don't use `--reuse-values`. It skips every default this chart added since 4.3.1, which is more than half its keys, and you'd be running a chart that's mostly holes.

The names, the Secret's database password and the volume claim render identical to 4.3.1's, so the new database pod mounts the old data. The Gateway migrates the schema forward on start, and updates TimescaleDB from 2.29.1 to 2.30.1 while it's at it.

We proved that by rendering both charts side by side, not by running it on a live cluster. That gap is exactly why step 1 exists. If the upgrade surprises you, you have a dump from five minutes ago, and we want to hear about it at [support@hotloop.io](mailto:support@hotloop.io).

### What behaves differently

- **There's a login.** Before 4.4.0 there wasn't one at all. The chart creates an `admin` account on first install; [Install](/gateway/install/#sign-in) has the command that reads the password back.
- **Writes default to off**, agents included, since 4.4.0. If your 4.3.1 values file never set `safety.allowWrites`, every write your operators and rules used to make is refused after the upgrade until you set it. That's deliberate, and it's your cue to review what's armed before you turn it back on.
- **A timezone that won't load stops startup.** `HOTLOOP_TIMEZONE` or `TZ` set to something bogus used to run on UTC without a word, which quietly shifts every report, schedule, and shift change by hours.
- **Device credentials read back as `[redacted]`** to every role, admin included (4.15.1). Saving a device with the placeholder keeps the stored password.
- **The poll settings are `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL`, and `HOTLOOP_POLL_TIMEOUT`.** The old Settings screen told you to set `HOTLOOP_POLL_INTERVAL_MS`, `HOTLOOP_MIN_POLL_INTERVAL_MS`, and `HOTLOOP_TIMEOUT_MS`, which nothing ever read. If you set those, they did nothing. Rename them.
- **OPC UA tags you imported keep the type they were imported with.** Discover tags used to call every node a float. It reads each node's real type now, but tags imported before keep `float`, and HotLoop's own OPC UA server publishes a tag as its declared type, so a text tag reaches Ignition as `Bad_TypeMismatch`. Go declare your text tags `string`.
- **Edge publish has a values block now.** If you set it through `extraEnv`, move it to `edgePublish:` and drop the variables, or they're set twice.
- **The OPC UA server says `HotLoop`** as its manufacturer, where it used to say Fireball Industries. If a client or an inventory script matches on that string, change it before it stops matching.
- **The license.** The terms changed after 4.3.1. The current ones are on [the License page]({{LICENSE_URL}}).

### API changes from 4.3.1

If you have a script or an integration against the API, this is the list. Everything else is additions. The 4.16.0 to 4.17.0 changes [above](#what-a-script-against-the-api-will-notice) come on top, and so do the 4.17.0 to {{hotloop}} ones [above them](#api-changes-from-4170).

- **Empty lists are `[]`, never `null`,** in every response and every stream event, at any depth. `GET /api/runs`, automations, a device's tags, the write audit, users, alarm events, sparklines, and an empty history window all used to answer `null`. A `null` you still see is never a list; it's a documented nullable field, like an entity's `equipment_id`.
- **`/api/history` buckets with no good reading are `null`,** and draw as gaps, and bad readings stay out of trend averages. A trend and a report over the same hour now say the same thing.
- **An error the API can't place is a 500** with a reference into the server log, not a 400. A device that errors on a write or a browse is a 502. [The write gate](/gateway/write-gate/#what-each-refusal-answers) has every status a write can get.
- **`alarm.turn_on`, and any other service an alarm entity doesn't take, is a 400** ("unknown service"). It used to answer success and do nothing, which is the worst possible answer.
- **Unshelving an alarm that isn't shelved is a 409.** It used to set the alarm to normal whatever it was doing, which could wipe a cleared, unacknowledged alarm off the list, the exact alarm ISA-18.2 exists to keep on it.
- **Tag JSON always carries `minValue`, `maxValue`, and `hasRange`,** and `hasRange` alone says whether there's a range. A range starting at 0 used to look like no minimum.
- **New: `?dry_run=true` on `POST /api/services/{domain}/{service}`.** It runs the gate's checks, writes nothing, audits nothing, and answers with the refusal the real call would give. `dry_run` takes `true` or `false` and nothing else; `yes` is a 400, because a guess the wrong way turns a question into a command.
- **`GET /api/settings`** names the variable a value actually came from in `envVar`, fallbacks included, and a variable set to an empty string counts as unset.

The [release notes](https://hotloop.io/releases/core/) have the rest of what changed, version by version back to 4.4.0. Once you're up on 4.16.0 and the historian is still full, go do [Upgrading from 4.16.0](#upgrading-from-4160), and then [Upgrading from 4.17.0](#upgrading-from-4170).
