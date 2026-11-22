---
title: "Διαμόρφωση"
description: "Κάθε ρύθμιση που διαβάζει το Flow, η προεπιλογή της, η μεταβλητή περιβάλλοντος που την αντικαθιστά και τι κάνει μια λάθος τιμή στην εκκίνηση."
---

Δηλωτικό YAML με αντικατάσταση από μεταβλητές περιβάλλοντος. Μπορείτε να το επικυρώσετε, να το συγκρίνετε, να το παράγετε από ένα ConfigMap και να το αναλύσετε χωρίς να το εκτελέσετε, και αυτό είναι όλα όσα πρέπει να επιτρέπει ένα αρχείο διαμόρφωσης, και τίποτα παραπάνω. Κάθε πεδίο παρακάτω είναι προαιρετικό και εμφανίζεται με την προεπιλογή του.

```yaml
server:
  host: 0.0.0.0
  port: 1880
  adminRoot: /              # where the editor and admin API live
  httpRoot: /               # where a flow's HTTP In nodes live
  readTimeout: 60s          # generous: a big deploy over a slow edge link is legitimate
  writeTimeout: 0s          # zero on purpose, the comms websocket is long-lived
  shutdownTimeout: 20s
  maxRequestBytes: 33554432 # 32 MiB, bounds a flow deploy

data:
  dir: /data                # the PVC. Flows, credentials, the deployment log and state.db live here
  flowFile: flows.json
  credentialsFile: credentials.json
  credentialSecret: ""      # empty means plaintext, which is refused by default
  allowPlaintextCredentials: false
  backupGenerations: 3

history:
  retain: 100               # deployment records kept under data.dir/deployments; 0 keeps all
  git:
    url: ""                 # empty is off; see "A git mirror"
    branch: main
    path: flows.json
    emailDomain: flow.invalid

auth:
  enabled: true             # off refuses to start unless HOTLOOP_FLOW_INSECURE=true
  sessionTTL: 168h          # sessions live in data.dir/sessions.json, hashed, and survive restarts
  lockout:
    attempts: 5             # failures for one account from one address before it locks there
    perAddress: 20          # failures from one address, any account, before the address locks
    window: 15m
    duration: 15m
  users:
    - username: admin
      passwordHash: "$2a$10$..."   # bcrypt only, never plaintext
      permissions: ["*"]
  tokens:                   # API tokens for machines; the hash only, from: hotloop-flow token
    - name: ci
      hash: "sha256:..."
      permissions: ["flows.read", "flows.write"]   # add "status.read" for a token that pushes to stations
      # rateLimit: {calls: 60, per: 1m}   # MCP tool calls per window; unset is no limit

runtime:
  inboxCapacity: 1024
  overflow: block           # block | drop-newest | drop-oldest | error
  blockTimeout: 30s
  closeTimeout: 15s

store:
  path: ""                  # empty is state.db in data.dir: persistent context and durable wires
  synchronous: normal       # normal | full. full fsyncs every commit, and wears the card
  context:
    persist: true           # false is memory only
    flushInterval: 30s      # a changed value waits this long; a kill -9 loses it. 0s writes at once
  durable:
    maxBytes: 268435456     # disk quota for every durable wire together
    ackFlush: 100ms         # how long a delivered message waits to be marked done; 0s marks each one first

discovery:
  enabled: false
  allowedCIDRs: []          # enabled with this empty is a startup error

exec:
  enabled: false
  allowedCommands: []       # enabled with this empty is a startup error

files:
  allowedPaths: []          # extra trees on top of data.dir, which is always allowed

plugins:
  dir: ""                   # empty means plugins/ inside data.dir
  trustedKeys: []           # publisher keys: ed25519:<base64>, a PEM public key, or a file holding one. Empty refuses every plugin
  grants: {}                # plugin name to the host access it may have: clock, random, context.flow, context.global
  maxMemoryMiB: 64          # the most memory any one plugin node can be given
  maxTimeout: 5s            # the longest any one plugin node can be given for a message

secrets:
  allowedPaths: []          # where a tls-config may read a certificate or key, on top of data.dir

logging:
  level: info               # error | warn | info | debug | trace
  format: text              # text for a terminal, json for a cluster

metrics:
  enabled: true
  path: /metrics

audit:
  maxBytes: 16777216        # data.dir/audit.log rotates at 16 MiB
  keep: 4                   # rotated files kept beside it

tests:
  gate: false               # refuse a deploy that fails data.dir/flows.test.yaml
  timeout: 2m               # wall clock for one run of the flow tests

trace:                      # where every message went, kept in memory, bounded
  enabled: true
  traces: 256               # journeys kept, newest
  maxHops: 512              # hops one journey keeps
  maxMessageBytes: 16384    # the biggest message a hop keeps a copy of
  maxBytes: 16777216        # everything together, oldest forgotten first
  perSecond: 1000           # new traces a second; 0 traces every message
  otlp:
    endpoint: ""            # http://collector:4318 sends every hop as a span
    serviceName: hotloop-flow
    interval: 2s            # the longest a finished hop waits to be sent
```

Ένα τυπογραφικό λάθος σε αυτό το αρχείο είναι αποτυχία εκκίνησης και όχι μια ρύθμιση που σιωπηλά δεν κάνει τίποτα, επειδή τα άγνωστα πεδία απορρίπτονται. Ένας χειριστής που γράφει λάθος το `credentialSecret` πρέπει να το ανακαλύψει αμέσως, όχι έξι μήνες αργότερα, όταν θα προσέξει ότι το αρχείο διαπιστευτηρίων είναι σε απλό κείμενο.

## Αντικαταστάσεις από μεταβλητές περιβάλλοντος

Το περιβάλλον υπερισχύει του αρχείου, που είναι ο μόνος εφαρμόσιμος διαχωρισμός στο Kubernetes: ένα Helm chart βάζει τις συνηθισμένες ρυθμίσεις σε ένα ConfigMap και εισάγει τα μυστικά από ένα Secret.

| Μεταβλητή | Ορίζει |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Διαδρομή προς το αρχείο YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Τον listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Προθέματα διαδρομών. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Πού βρίσκεται η κατάσταση. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Το μυστικό κρυπτογράφησης των διαπιστευτηρίων. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Έναν μόνο λογαριασμό διαχειριστή με πλήρη δικαιώματα, που κάνει ένα container χρησιμοποιήσιμο στην πρώτη εκκίνηση χωρίς προσάρτηση αρχείου. Πρέπει να οριστούν και τα δύο. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Ένα token ανάπτυξης με όνομα `deploy`, για CI: `flows.read` και `flows.write`, τίποτα άλλο. Το hash, ποτέ το token. Ένα token που στέλνει και στους σταθμούς ([Αποστολή στους σταθμούς ενός tenant](/el/flow/stations/)) χρειάζεται και `status.read`, γι' αυτό δημιουργήστε το στο αρχείο διαμόρφωσης. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Σύνδεση από τον πίνακα ελέγχου EmberCORE. Το κλειδί είναι το δημόσιο κλειδί ES256 του πίνακα ελέγχου (αρχείο PEM) και το audience είναι `<tenant>/<release>`. Χωρίς αρχείο κλειδιού είναι απενεργοποιημένη, και η προεπιλογή είναι απενεργοποιημένη. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | Ο εκδότης (`embernet-dashboard`), η κεφαλίδα (`X-Embernet-Assertion`) και αν ο επεξεργαστής παραλείπει τη δική του φόρμα σύνδεσης (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Ο καθρέφτης git. Ο κωδικός (ένα token πρόσβασης) ορίζεται μόνο από το περιβάλλον. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Προεπιλογές του χρονοπρογραμματιστή. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Η βάση δεδομένων κατάστασης: πού βρίσκεται και αν κάθε commit συγχρονίζεται με fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Μόνιμο πλαίσιο. Το `false` το απενεργοποιεί· το διάστημα είναι μια διάρκεια όπως `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Κεφαλίδες για τον συλλέκτη, ζεύγη `Name=value` χωρισμένα με κόμματα, που προστίθενται σε όσες υπάρχουν στο αρχείο. Για ένα κλειδί API που δεν έχει θέση σε ένα ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Η ποσόστωση δίσκου για τα ανθεκτικά καλώδια και πόσο περιμένει ένα παραδομένο μήνυμα για να σημανθεί ως ολοκληρωμένο. |
| `HOTLOOP_FLOW_TESTS_GATE` | Το `true` ενεργοποιεί την [πύλη ανάπτυξης](/el/flow/tests/#η-πύλη-ανάπτυξης). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Καταγραφή. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Κόμβοι ανακάλυψης. CIDR χωρισμένα με κόμματα. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Ο κόμβος exec. Εντολές χωρισμένες με κόμματα. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Πού βρίσκονται τα plugins και ποια κλειδιά εκδοτών είναι έμπιστα. Κλειδιά χωρισμένα με κόμματα. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Τι μπορούν να χρησιμοποιούν τα plugins: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Τα όρια μνήμης και χρόνου ανά μήνυμα ενός κόμβου plugin. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Πρόσθετες ρίζες του κόμβου file. Χωρισμένες με κόμματα. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Πρόσθετες ρίζες από τις οποίες μπορεί να διαβαστεί ένα αρχείο μυστικού. Χωρισμένες με κόμματα. |
| `HOTLOOP_FLOW_INSECURE` | Το `true` εκτελεί με απενεργοποιημένη την πιστοποίηση, και τίποτα άλλο δεν το κάνει. Μετρούν μόνο τα `1`, `true`, `yes` και `on`, ώστε το `false` ή το `0` να μην μπορεί να την απενεργοποιήσει κατά λάθος. Για ένα απομονωμένο δίκτυο που έχετε αποφασίσει να αναλάβετε. Δεν απαλλάσσει από το μυστικό διαπιστευτηρίων. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Επιτρέπει μη κρυπτογραφημένα διαπιστευτήρια σε αδράνεια. |

Οι μεταβλητές ενεργοποίησης και απενεργοποίησης δέχονται μόνο `1`, `true`, `yes` και `on`, με οποιαδήποτε κεφαλαία ή πεζά. Οτιδήποτε άλλο είναι απενεργοποιημένο, άρα το `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` σημαίνει όχι, όχι «είναι ορισμένη, άρα ναι». Ένας διακόπτης ασφαλείας που ενεργοποιείται επειδή κάποιος πληκτρολόγησε `=false` είναι ακριβώς το είδος του πράγματος που καταλήγει σε αναφορά συμβάντος.

Ό,τι δεν υπάρχει σε αυτόν τον πίνακα είναι μόνο για το αρχείο, και αυτό είναι σκόπιμο: το TTL συνεδρίας, οι γενιές αντιγράφων ασφαλείας, τα όρια μεγέθους αιτημάτων και τα χρονικά όρια του διακομιστή είναι αποφάσεις που κάποιος πρέπει να ελέγχει σε ένα ConfigMap, όχι να πληκτρολογεί σε ένα shell στις 3 τα ξημερώματα ενώ μια γραμμή είναι σταματημένη.
