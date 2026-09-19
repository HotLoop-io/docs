---
title: Security posture
description: Not a feature list. The four places where "anyone who can edit a flow" stops being a synonym for "anyone who owns the box."
---

Node-RED's actual trust model is that anyone who can deploy a flow already owns the box, and the `exec` node is right there in the palette. That model is fine on a Pi in a workshop. It is not fine on a customer's plant floor, and it is not hypothetical: [CVE-2025-41656](https://nvd.nist.gov/vuln/detail/CVE-2025-41656) records unauthenticated remote command execution, rated critical, because authentication for the Node-RED server is not configured by default.

Flow changes that in four places.

## It refuses to start without authentication

Not a warning in a log nobody reads, and not a default you are trusted to change. It is a startup error, with the remedy printed next to it. The cause NVD records for the CVE above is that authentication is not configured by default, and this removes that default entirely.

## The `exec` node ships disabled

An operator names the commands a flow is permitted to run, and an enabled node with an empty allowlist is a configuration error, not a license to run anything.

The allowlist matches on the **resolved absolute path**, not the string the flow typed. Comparing strings would let a flow ask for `curl` and receive whichever `curl` sits first on a `PATH` that a Function node can read and a sidecar can influence.

There is also no shell. The command line is split on quoting rules only, and an unquoted metacharacter is refused rather than passed through as a literal and hoped about.

## The file nodes are scoped to the data volume

Symlinks are resolved over the longest existing prefix of the path. That closes the obvious hole: write a file under the volume, symlink it to `/`, then read straight through the link. A textual prefix check waves that through without blinking.

## Credentials and flow files are protected properly

Credentials are AES-256-GCM with Argon2id. Node-RED uses AES-256-CTR keyed by a raw SHA-256 of your secret. CTR has no MAC, so anyone who can write the credentials file on a shared volume can flip chosen plaintext bits, which turns "can write a file" into "can change a broker password to one they picked." And plain SHA-256 is not a key derivation function. It is fast by design, which is precisely backwards for the one thing standing between a stolen file and a weak passphrase. There is no CVE on either of those, and both are still real.

The flow file itself is written to a temporary file, synced, renamed into place, and the directory is synced, three backups deep. If it ever reads a corrupt one, it recovers from a backup and says so out loud.

## Discovery nodes

The discovery nodes get the same treatment. They are off by default, bounded by an operator-configured CIDR allowlist, and a hostname that resolves to one in-scope address and one out-of-scope address is refused outright, because otherwise DNS is simply the way around the allowlist.

## Function nodes

Node's own documentation says that [the `node:vm` module is not a security mechanism and should not be used to run untrusted code](https://nodejs.org/api/vm.html), and Node-RED's Function node relies on it. Flow runs Function code in an embedded JavaScript interpreter with no host bindings, and offers WASM guests with a hard memory ceiling for code that needs a stronger boundary.
