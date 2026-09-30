---
title: "Flow security: a safer Node-RED alternative"
description: "Where \"anyone who can edit a flow\" stops meaning \"anyone who owns the box\": login, exec, file scope, credentials, discovery and the Function sandbox."
sidebar:
  label: "Security posture"
---

In Node-RED, being able to deploy a flow means owning the box. That's the real trust model, and with `exec` sitting in the palette, it's an honest one. It's fine on a Pi in a workshop. It's not fine on a customer's plant floor, and there's a CVE to prove it.

Pilz put Node-RED on its IndustrialPI 4 and never turned authentication on. That became [CVE-2025-41656](https://certvde.com/en/advisories/VDE-2025-045/): anyone who could reach the device could run commands on it with high privileges, CVSS 10. The CVE is in Pilz's firmware, not in Node-RED, and that deserves saying plainly. But what the vendor shipped was Node-RED's own default, no login, and it scored a perfect 10.

Flow changes the answer in six places. Each one says what it stops and what you set.

## It refuses to start without authentication

No login configured means no start. Not a log warning nobody will ever read, not a default somebody is supposed to remember to change: a startup error, with the fix printed next to it. The CVE above came from a default, so Flow doesn't have that default, and there's nothing to forget.

Running without a login takes `HOTLOOP_FLOW_INSECURE=true` in the environment, set on purpose, for an isolated network where you've accepted the risk. Only `1`, `true`, `yes` and `on` count, in any case, so somebody typing `=false` or `=0` can't turn the login off by accident. `auth.enabled: false` in the config file isn't enough on its own, because a config file is where a copy-paste lands. With the variable set, every boot logs a warning, and the editor shows a **no login** badge where Sign out would be, so the next person to open it knows the door is open. It doesn't waive the credential secret, which has its own opt-out.

:::caution[Up to 2.0.4, the opt-out never worked]
From 0.1.0 through 2.0.4, `HOTLOOP_FLOW_INSECURE=true` switched authentication off, the startup check refused any config with authentication off, and the refusal told you to set the variable you had just set. The config package had no tests, which is how that lived so long. 2.0.5 fixes it, adds tests that fail on the old check, and was driven both ways end to end in a browser before it was tagged.
:::

Past the login routes themselves, three answer without a token, on purpose: `/health`, `/ready` and `/metrics`. The kubelet and a Prometheus scraper carry no token, and putting auth on a probe restart-loops the pod forever. `/metrics` carries counts and node ids, never message contents or configuration.

## The `exec` node ships disabled

An operator names the commands a flow may run, in `exec.enabled` and `exec.allowedCommands` (or `HOTLOOP_FLOW_EXEC_ENABLED` and `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS`, comma-separated). Enabled with an empty list is a startup error, not a license to run anything, because an empty list read as "anything goes" turns one narrow feature into a remote shell.

The allowlist matches the **resolved absolute path**, not the string the flow typed. Compare strings instead, and a flow that asks for `curl` gets whatever `curl` comes first on the `PATH`, which a Function node can read and a sidecar can influence. A listed command that isn't on the `PATH` yet only warns at boot and gets resolved again when a flow uses it, since an init container or a mounted volume can legitimately bring it in later.

There's no shell, either. The command line is split on quoting rules only, and an unquoted shell metacharacter (`|`, `&`, `;`, `$` and friends) is refused, not passed along as a literal with fingers crossed. So `ping -c1 10.0.0.1; rm -rf /data` is an error, not two commands.

Output is capped per stream, and a command that blows past the cap is killed and reported instead of filling the heap. One honest gap: a command that forks children of its own may leave them behind when it's killed.

## The file nodes are scoped to the data volume

File, File In and Watch can reach the data directory and nothing else unless you list it in `files.allowedPaths` (or `HOTLOOP_FLOW_FILE_ALLOWED_PATHS`). If you add a path, mount it into the container too. In Node-RED the file nodes take any path at all, which makes editing a flow the same as reading any file the process can, a mounted Kubernetes Secret included.

Symlinks are resolved over the longest existing prefix of the path. That closes the obvious hole: plant a symlink under the volume pointing at `/`, then read straight through it. A plain string prefix check never notices. File In reads are size-capped too, so pointing one at the wrong file is an error, not an OOM-kill.

## Credentials and the flow file are written properly

Credentials are AES-256-GCM, keyed with Argon2id. Node-RED uses AES-256-CTR keyed with a raw SHA-256 of your secret, and that has two problems. CTR has no MAC, so anyone who can write the credentials file on a shared volume can flip bits in the plaintext without the key, which turns "can write a file" into "can change a broker password to one they picked." And plain SHA-256 isn't a key derivation function. It's fast by design, and fast is the last thing you want between a stolen file and a weak passphrase. Argon2id makes every guess cost 64 MiB of memory. No CVE on either of Node-RED's problems. Both are still real.

A tampered file fails to decrypt instead of decrypting to something an attacker chose. A wrong secret and a tampered file get the same error, on purpose, because telling an attacker which one they hit is a free oracle.

The flow file is written to a temp file, fsynced, renamed into place, and the directory fsynced, three backups deep. A power cut mid-save leaves either the old file or the new one, never a blend. If it ever reads a corrupt one, it tries the backups newest first, keeps the bad file next to it as `.corrupt`, logs which backup it used, and `/ready` reports it as `recoveredFromBackup`. If no backup parses, it stops, instead of starting empty and reporting healthy with every flow gone. And a deploy writes the flow file before it stops the old runtime, so a failed save leaves your previous flows running instead of taking the line down.

## Discovery stays inside the lines you draw

The `scan` and `netinfo` nodes are off by default. Turn them on with `discovery.enabled` and `discovery.allowedCIDRs` (or `HOTLOOP_FLOW_DISCOVERY_ENABLED` and `HOTLOOP_FLOW_DISCOVERY_CIDRS`), and enabled with an empty list is a startup error. A hostname that resolves to one address inside the allowlist and one outside it is refused outright, or DNS becomes the side door.

They need no extra privilege. `scan` only makes TCP connections, which need no capability and finish the handshake instead of leaving half-open connections on a PLC, and `netinfo` only reads the interface list. So the pod keeps every Linux capability dropped with discovery on. Up to 2.0.4 the chart added `NET_RAW` and `NET_ADMIN` whenever discovery was enabled, for ARP sweeps that were never written. Privilege nothing uses is a gift to whoever breaks in. 2.0.5 removed them, and CI fails if one comes back.

## Function nodes run in a sandbox with no way out

Node's own documentation says [the `node:vm` module is not a security mechanism and must not be used to run untrusted code](https://nodejs.org/api/vm.html), and Node-RED's Function node relies on it. Flow runs Function code on goja, a JavaScript interpreter in pure Go with no host bindings: no `require`, no `process`, no `Buffer`, no door to the host at all. A test runs the classic constructor-chain escape to prove it reaches nothing. Every call has a 5 second limit, which Node-RED leaves optional and off, and a call costs 11.6 to 13.7 µs.

What goja can't do is cap memory. A function that allocates in a loop grows the Go heap until the pod dies, and the time limit is the only brake. There's a second sandbox built for that, a WebAssembly host with a hard 64 MiB ceiling where a guest that allocates past it traps and the host carries on. **No node uses it yet.** It isn't in the binary, so today you can't run a WASM guest in a flow, and a `wasm` node is Phase 6 of the [roadmap](https://github.com/HotLoop-io/hotloop-flow/blob/main/docs/ROADMAP.md). Until then, give edit access only to people whose Function code you'd trust not to eat the pod's memory.
