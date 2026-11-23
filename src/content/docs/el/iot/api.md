---
title: "Το HTTP API"
description: "Κάθε κλήση που απαντά το HotLoop μέσω HTTP, τι χρειάζεται, τι δέχεται και τι επιστρέφει. Το web περιβάλλον δεν χρησιμοποιεί τίποτα άλλο."
---

Κάθε κλήση που απαντά το Gateway μέσω HTTP, τι χρειάζεται, τι δέχεται και τι επιστρέφει. Το web UI δεν χρησιμοποιεί τίποτα άλλο: πίσω από τις οθόνες δεν υπάρχει ιδιωτικό API, οπότε ό,τι μπορεί να κάνει το UI μπορεί να το κάνει ένα script με τις ίδιες κλήσεις και τα ίδια δικαιώματα.

Αυτή η σελίδα ελέγχεται σε σχέση με τον κώδικα. Άρα η λίστα των routes και το ποιος μπορεί να τα καλεί δεν είναι περιγραφή ενός API όπως ήταν κάποτε. Τα σχήματα των αιτημάτων και των απαντήσεων παρακάτω πάρθηκαν από ένα Gateway που έτρεχε· οι δοκιμές δεν τα ελέγχουν, οπότε αν αλλάξετε έναν handler, αλλάξτε και την ενότητά του εδώ.

Το υπόβαθρο κάθε λειτουργίας βρίσκεται στη δική της σελίδα: [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/), [Οντότητες](/el/iot/entities/), [το δέντρο εξοπλισμού και οι ετικέτες](/el/iot/equipment/), [Αυτοματισμοί](/el/iot/automations/), [Προγραμματισμένες αναφορές](/el/gateway/reports/), [Διαχείριση στόλου](/el/gateway/fleet/), [Ειδοποιήσεις συναγερμών](/el/iot/notifications/), [Αντίγραφα ασφαλείας και επαναφορά](/el/iot/backup/) και [MCP](/el/iot/mcp/). Αυτή η σελίδα είναι η λίστα· εκείνες δίνουν τους λόγους.

## Συμβάσεις

### Πού βρίσκεται

Όλα βρίσκονται στη μία θύρα HTTP της εφαρμογής (`HOTLOOP_LISTEN_ADDR`, `:8080` από προεπιλογή). Πίσω από ένα proxy που σερβίρει την εφαρμογή κάτω από μια διαδρομή, ορίστε `HOTLOOP_BASE_PATH` και το Gateway την αφαιρεί, ώστε τα `/hotloop/api/devices` και `/api/devices` να είναι η ίδια κλήση. Οι διαδρομές παρακάτω γράφονται χωρίς αυτήν.

### Σύνδεση: cookie ή bearer token

Κάθε route `/api/` χρειάζεται συνεδρία, εκτός από τη σύνδεση (με κωδικό, ή με PIN ή κάρτα σε πάνελ kiosk), τα εισερχόμενα webhooks και τους συνδέσμους αναγνώρισης συναγερμών, καθένα από τα οποία φέρει τη δική του απόδειξη μέσα στο αίτημα. Το `POST /api/auth/login` απαντά με ένα token και το ορίζει επίσης ως cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure όταν το αίτημα ήρθε μέσω TLS ή με `X-Forwarded-Proto: https`). Ο περιηγητής χρησιμοποιεί το cookie και δεν βλέπει ποτέ το token. Ένα script στέλνει το token αντί γι' αυτό:

```
Authorization: Bearer 3f9c...e1
```

Και τα δύο είναι η ίδια συνεδρία και ελέγχονται με τον ίδιο τρόπο. Μια συνεδρία διαρκεί `HOTLOOP_AUTH_SESSION_TTL` (12 ώρες από προεπιλογή). Χωρίς συνεδρία, κάθε route `/api/` απαντά:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

ή `"the session is invalid or has expired"` για token που ανακλήθηκε ή έληξε, ή `"this account no longer has access"` για λογαριασμό που απενεργοποιήθηκε.

Με `HOTLOOP_AUTH_INSECURE=true` δεν υπάρχει καθόλου σύνδεση: τίποτα δεν ελέγχεται, κάθε δικαίωμα παρακάτω δίνεται σε όλους, και το όνομα που καταγράφεται σε μια εγγραφή προέρχεται από την κεφαλίδα του proxy `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` ή `X-Forwarded-Email`, ή είναι `operator` αν δεν έχει οριστεί καμία. Αυτό έχει νόημα μόνο πίσω από NetworkPolicy που αφήνει να φτάσει στο pod μόνο το proxy του πίνακα ελέγχου. Δείτε [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/#λειτουργία-χωρίς-σύνδεση).

Το MCP είναι ξεχωριστό: έχει δικό του bearer token (`HOTLOOP_MCP_TOKEN`) και δεν κοιτά ποτέ συνεδρία. Δείτε [MCP](#mcp).

### Δικαιώματα

Ένας συνδεδεμένος χρήστης έχει μια λίστα δικαιωμάτων, από τον ρόλο του ή ορισμένα ρητά στον λογαριασμό. Ένα route που απαιτεί ένα δικαίωμα που ο χρήστης δεν έχει απαντά:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

Ο [πίνακας δικαιωμάτων](#δικαιώματα) λέει ποιος ρόλος έχει τι.

### Σφάλματα

Κάθε αποτυχία που παράγει το ίδιο το API είναι JSON με μία μορφή:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

Το `/readyz` προσθέτει ένα `detail`, και μια αποτυχημένη κλήση υπηρεσίας προσθέτει τις εγγραφές που πρόλαβε να κάνει. Το μήνυμα είναι γραμμένο για το άτομο που το διαβάζει: λέει τι πήγε στραβά και, όταν υπάρχει, τι να κάνει αντί γι' αυτό. Δείξτε το όπως είναι.

| Κατάσταση | Πότε |
|---|---|
| 400 | Το αίτημα είναι λάθος: σώμα με κακή μορφή, πεδίο που αποτυγχάνει στον έλεγχο, άγνωστο πεδίο, παράμετρος που λείπει, άγνωστη υπηρεσία |
| 401 | Δεν υπάρχει συνεδρία, έχει λήξει, ή λάθος κωδικός κατά τη σύνδεση |
| 403 | Ο χρήστης δεν έχει το δικαίωμα, ή η πύλη εγγραφής απέρριψε την εγγραφή βάσει πολιτικής: εγγραφές απενεργοποιημένες, το tag δεν είναι οπλισμένο, η οντότητα είναι απενεργοποιημένη |
| 404 | Αυτό που κατονομάζεται στη διαδρομή ή στο σώμα δεν υπάρχει |
| 409 | Υπάρχει ήδη, ή βρίσκεται σε κατάσταση που δεν το επιτρέπει: συναγερμός που δεν έχει αναβληθεί, κόμβος που έχει ακόμη παιδιά, οντότητα χωρίς γνωστή κατάσταση για εναλλαγή, script που ήδη τρέχει, συνταγή που απορρίφθηκε ή εφαρμόζεται ήδη |
| 422 | Τιμή που η πύλη εγγραφής απέρριψε επί της ουσίας: εκτός του εύρους του tag, εκτός του βήματος μιας οντότητας |
| 502 | Η συσκευή απάντησε με δικό της σφάλμα και το σώμα είναι τα λόγια της· ή μια συνταγή ξεκίνησε και δεν έφτασαν όλοι οι στόχοι, και το σώμα λέει ποιοι στάλθηκαν και ποιοι όχι |
| 503 | Η συσκευή δεν είναι συνδεδεμένη, ή η μηχανή συναγερμών δεν τρέχει |
| 500 | Σφάλμα μέσα στον server. Το σώμα είναι `internal error (ref …); the server log has the detail under that ref` και τίποτα άλλο, και το log έχει ολόκληρο το σφάλμα κάτω από αυτή την αναφορά. Το μοναδικό 500 με πραγματικό μήνυμα είναι το πάτημα ενός κουμπιού του οποίου η αποδέσμευση δεν στάλθηκε, επειδή αυτό το μήνυμα λέει ακριβώς τι να ελέγξετε |

Ό,τι το API δεν μπορεί να κατατάξει είναι 500, ποτέ 400. Μια διακοπή της βάσης δεδομένων που απαντιέται ως 400 λέει στον χειριστή ότι έγραψε κάτι λάθος, και πάει να ψάξει για ένα τυπογραφικό που δεν υπάρχει.

Δύο αποτυχίες δεν προέρχονται από το API και είναι απλό κείμενο, όχι JSON: μια διαδρομή που δεν ταιριάζει σε κανένα route απαντά `404 page not found`, και μια γνωστή διαδρομή που καλείται με λάθος μέθοδο απαντά `405 method not allowed`.

Μια εγγραφή που απορρίφθηκε δεν είναι ποτέ 500. Μια οθόνη εργοστασίου που δείχνει μια άρνηση πολιτικής ως σφάλμα του server μαθαίνει στους χειριστές να αγνοούν τα σφάλματα.

### Σώματα

Τα σώματα των αιτημάτων είναι JSON, έως 4 MiB (για εισερχόμενο webhook, 1 MiB). **Τα άγνωστα πεδία απορρίπτονται**, δεν αγνοούνται:

```json
{"error":"request body: json: unknown field \"x\""}
```

Μια λάθος γραμμένη ρύθμιση που χάνεται σιωπηλά μοιάζει ακριβώς με μια που δούλεψε, γι' αυτό ο αποκωδικοποιητής λέει όχι.

Τα `POST` και `PUT` σε συσκευές, tags, συναγερμούς, αυτοματισμούς, μέλη στόλου και αναφορές αντικαθιστούν ολόκληρο το αντικείμενο: ένα πεδίο που παραλείπεται παίρνει τη μηδενική του τιμή, και ένα boolean που παραλείπεται είναι `false`. Διαβάστε, αλλάξτε, στείλτε πίσω. Εξαιρέσεις είναι τα `PUT` των οντοτήτων και του εξοπλισμού, που αλλάζουν μόνο τα πεδία που στέλνετε, και τα διαπιστευτήρια συσκευών, που διατηρούνται όταν παραλείπονται (δείτε παρακάτω).

### Τα μυστικά είναι μόνο για εγγραφή

Ένα διαπιστευτήριο που είναι αποθηκευμένο σε μια συσκευή (κωδικός broker, κεφαλίδα HTTP, κωδικός μέσα στη διεύθυνση) δεν επιστρέφεται ποτέ, σε κανέναν ρόλο, ούτε στον διαχειριστή. Εμφανίζεται ως `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Όταν αποθηκεύετε τη συσκευή, στείλτε το σύμβολο θέσης (ή αφήστε έξω το κλειδί) για να κρατήσετε την αποθηκευμένη τιμή, στείλτε νέα τιμή για να την αντικαταστήσετε, και στείλτε `""` ή `null` για να την καθαρίσετε. Μια νέα συσκευή δεν μπορεί να αποθηκευτεί με το σύμβολο θέσης, και μια αποθήκευση που μεταφέρει τη συσκευή σε άλλον host με διατηρημένο διαπιστευτήριο απορρίπτεται, ώστε ένας αποθηκευμένος κωδικός να μη μεταφερθεί σε ακροατή κάποιου άλλου. Οι πλήρεις κανόνες βρίσκονται στο [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/#τα-διαπιστευτήρια-συσκευών-είναι-μόνο-για-εγγραφή). Το ίδιο ισχύει για κάθε άλλο διαπιστευτήριο που κρατά το Gateway: οι ρυθμίσεις δείχνουν `set` ή `not set`, τα διαγνωστικά αφαιρούν τα διαπιστευτήρια από τους εξερχόμενους στόχους MCP, και τίποτα σε αυτό το API δεν επιστρέφει hash κωδικού ή token συνεδρίας, εκτός από το ένα που σας δίνει η σύνδεση.

### camelCase, εκτός όπου είναι snake_case

Το μεγαλύτερο μέρος του API είναι camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), όπως από την πρώτη έκδοση και όπως απαιτεί το συμβόλαιο `TagValue` του πίνακα ελέγχου EmberNet.

Τα endpoints οντοτήτων, καταστάσεων, υπηρεσιών, εξοπλισμού και ετικετών είναι snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Είναι σκόπιμο: το API οντοτήτων χρησιμοποιεί τη συνηθισμένη μορφή οντότητας, κατάστασης και υπηρεσίας, ώστε ό,τι τη μιλά ήδη να μιλά και αυτό, και το δέντρο εξοπλισμού είναι το μητρώο περιοχών του μοντέλου οντοτήτων, διαμορφωμένο για τους ίδιους καταναλωτές. Εκεί που συναντιούνται, κάθε πλευρά κρατά τη δική της γραφή: μια συσκευή έχει `equipmentId`, μια οντότητα έχει `equipment_id`.

### Ώρες, διάρκειες και κλειδιά tag

- **Οι χρονοσφραγίδες** είναι RFC 3339 σε UTC, με κλασματικά δευτερόλεπτα όταν υπάρχουν: `2026-09-27T20:21:58.255869Z`. Η ρύθμιση ζώνης ώρας εμφάνισης αλλάζει ό,τι δείχνει το UI, ποτέ ό,τι επιστρέφει το API.
- **Μια ώρα που δεν έχει συμβεί παραλείπεται.** Ένας κανόνας που δεν έχει τρέξει ποτέ δεν έχει `lastRun`, μια συσκευή που δεν έχει ερωτηθεί ποτέ δεν έχει `lastPoll` ούτε `lastGood`, ένας συναγερμός που κανείς δεν αναγνώρισε δεν έχει `ackedAt`, ένα μέλος στόλου που δεν έχει φανεί ποτέ δεν έχει `lastSeen`. Ένα πεδίο ώρας που λείπει σημαίνει ποτέ. Δεν θα δείτε ποτέ τη μηδενική ώρα της Go, `0001-01-01T00:00:00Z`, σε απάντηση ή σε συμβάν ροής. Δώδεκα πεδία την έστελναν, και η οθόνη αυτοματισμών έδειχνε έναν κανόνα που δεν είχε τρέξει ποτέ ως τελευταία εκτέλεση πριν από 739887 ημέρες. Μια δοκιμή διαβάζει κάθε route και κάθε πεδίο ώρας στον κώδικα για να μένει έτσι.
- **Τα sparklines** είναι η εξαίρεση: εκεί το `timestamps` είναι σε Unix χιλιοστά του δευτερολέπτου, επειδή πάει κατευθείαν σε γράφημα.
- **Οι διάρκειες** λένε τη μονάδα τους στο όνομα: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. Το `uptime` στην κατάσταση είναι συμβολοσειρά διάρκειας της Go (`11m13s`).
- **Ένα κλειδί tag** είναι `device/tag`, η μορφή που παίρνει κάθε παράμετρος `?tag=` και κάθε πεδίο `tag`. Τα ονόματα tag μπορεί να περιέχουν κάθετους (διαδρομές OPC UA, topics MQTT), οπότε μόνο η πρώτη κάθετος διαχωρίζει: το `plc-1/Line/Zone 1` είναι το tag `Line/Zone 1` στη συσκευή `plc-1`.
- **Μια αριθμητική παράμετρος ερωτήματος** που δεν είναι αριθμός αγνοείται και χρησιμοποιείται η προεπιλογή, άρα το `?limit=abc` είναι το ίδιο με μη ορισμένο `?limit`.
- **Οι κενές λίστες** είναι `[]`, ποτέ `null`, σε κάθε απάντηση και κάθε συμβάν ροής, σε οποιοδήποτε βάθος. Δεν χρειάζεστε έλεγχο null πριν από το `.length`. Ένα `null` που βλέπετε δεν είναι ποτέ λίστα: είναι ένα από τα τεκμηριωμένα πεδία που επιτρέπουν null, όπως το `equipment_id` μιας οντότητας ή το `parent_id` ενός ριζικού κόμβου. Ένα πεδίο λίστας που σημειώνεται ως προαιρετικό μπορεί και πάλι να λείπει εντελώς.

### Προαιρετικές λειτουργίες

Ο στόλος, οι ειδοποιήσεις, τα αντίγραφα ασφαλείας και οι προγραμματισμένες αναφορές είναι απενεργοποιημένα εκτός αν οριστεί η μεταβλητή τους `HOTLOOP_*_ENABLED`. Με τη λειτουργία απενεργοποιημένη, το route λίστας της απαντά πάλι 200, με `"configured": false` και κενή λίστα, ώστε μια οθόνη να μπορεί να πει «δεν είναι ενεργοποιημένο» αντί για «δεν υπάρχει τίποτα εδώ». Κάθε άλλο route αυτής της λειτουργίας απαντά 400 με σφάλμα που κατονομάζει τη μεταβλητή:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

Το `GET /api/sites` κάνει το ίδιο όταν δεν έχουν ρυθμιστεί εξερχόμενοι διακομιστές MCP.

### Δεν υπάρχει σε αυτό το προϊόν

Το HotLoop διατίθεται ως IoT, Edge, Gateway και Edge Relay από μία βάση κώδικα, και μια λειτουργία που δεν έχει ένα προϊόν δεν είναι απενεργοποιημένη, δεν υπάρχει στο εκτελέσιμο. Σε IoT, Edge και Gateway τα routes της απαντούν πάλι, μετά τον ίδιο έλεγχο δικαιωμάτων, με ένα 404 που το λέει και κατονομάζει και τα δύο άκρα, ώστε ένα script να ξεχωρίζει «λάθος κουτί» από «λάθος URL»:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Όχι 400, επειδή δεν υπάρχει μεταβλητή που να το διορθώνει, και όχι 5xx, επειδή τίποτα δεν πήγε στραβά. Το `GET /api/status` λέει εξαρχής ποιο προϊόν απάντησε και ποιες λειτουργίες έχει, ώστε ένας πελάτης να ρωτά αντί να ψάχνει στα τυφλά.

### Ό,τι αλλάζει κάτι καταγράφεται

Κάθε δημιουργία, αλλαγή, διαγραφή, εγγραφή, αναγνώριση και σύνδεση καταγράφεται στο αρχείο καταγραφής του συστήματος (`GET /api/events`) με το όνομα του χρήστη, και κάθε εγγραφή σε tag, απορριφθείσα ή όχι, καταγράφεται στον έλεγχο εγγραφών (`GET /api/writes`). Το API δεν έχει σιωπηλή διαδρομή.

## Δικαιώματα

Ποιος έχει τι. Ένας λογαριασμός με ρητή λίστα δικαιωμάτων έχει ακριβώς όσα κατονομάζει, αντί για το σύνολο του ρόλου του. Το `*` δίνει τα πάντα και το `resource.*` δίνει τα πάντα κάτω από έναν πόρο (`reports.*`). Ο ρόλος admin είναι `*`.

| Δικαίωμα | viewer | operator | admin |
|---|---|---|---|
| `status.read` | ναι | ναι | ναι |
| `devices.read` | ναι | ναι | ναι |
| `devices.write` | όχι | όχι | ναι |
| `tags.read` | ναι | ναι | ναι |
| `tags.write` | όχι | όχι | ναι |
| `values.read` | ναι | ναι | ναι |
| `values.write` | όχι | ναι | ναι |
| `board.write` | όχι | ναι | ναι |
| `entities.read` | ναι | ναι | ναι |
| `entities.write` | όχι | όχι | ναι |
| `helpers.write` | όχι | ναι | ναι |
| `equipment.read` | ναι | ναι | ναι |
| `equipment.write` | όχι | όχι | ναι |
| `alarms.read` | ναι | ναι | ναι |
| `alarms.write` | όχι | όχι | ναι |
| `alarms.ack` | όχι | ναι | ναι |
| `automations.read` | ναι | ναι | ναι |
| `automations.write` | όχι | όχι | ναι |
| `automations.trigger` | όχι | ναι | ναι |
| `scripts.read` | ναι | ναι | ναι |
| `scripts.run` | όχι | ναι | ναι |
| `scripts.write` | όχι | όχι | ναι |
| `recipes.read` | ναι | ναι | ναι |
| `recipes.apply` | όχι | ναι | ναι |
| `recipes.write` | όχι | όχι | ναι |
| `blueprints.read` | ναι | ναι | ναι |
| `blueprints.apply` | όχι | ναι | ναι |
| `blueprints.write` | όχι | όχι | ναι |
| `dashboards.read` | ναι | ναι | ναι |
| `dashboards.write` | όχι | όχι | ναι |
| `energy.read` | ναι | ναι | ναι |
| `energy.write` | όχι | όχι | ναι |
| `fleet.read` | ναι | ναι | ναι |
| `fleet.write` | όχι | ναι | ναι |
| `fleet.rebirth` | όχι | ναι | ναι |
| `fleet.restart` | όχι | όχι | ναι |
| `fleet.update` | όχι | όχι | ναι |
| `fleet.config` | όχι | όχι | ναι |
| `notify.test` | όχι | όχι | ναι |
| `notify.escalation` | όχι | όχι | ναι |
| `backup.read` | όχι | όχι | ναι |
| `backup.run` | όχι | όχι | ναι |
| `reports.read` | ναι | ναι | ναι |
| `reports.run` | όχι | ναι | ναι |
| `reports.write` | όχι | όχι | ναι |
| `sites.read` | ναι | ναι | ναι |
| `settings.read` | ναι | ναι | ναι |
| `settings.write` | όχι | όχι | ναι |
| `events.read` | ναι | ναι | ναι |
| `logbook.read` | ναι | ναι | ναι |
| `users.manage` | όχι | όχι | ναι |

Η γραμμή είναι η ίδια παντού: ένας χειριστής τρέχει το εργοστάσιο (γράφει τιμές, αναγνωρίζει συναγερμούς, ενεργοποιεί αυτοματισμούς, σκουντά ένα ρελέ), και μόνο ένας διαχειριστής αλλάζει το πώς είναι ρυθμισμένο το εργοστάσιο, ή κάνει κάτι προς τα έξω εκ μέρους του Gateway (επανεκκίνηση ενός relay, αποστολή της διαμόρφωσής του, αποστολή δοκιμαστικής σελίδας, ορισμός αναφοράς που στέλνει δεδομένα του εργοστασίου με email κάπου).

## Ευρετήριο endpoints

Η στήλη δικαιώματος λέει τι ελέγχει το route. Το `session` σημαίνει οποιονδήποτε συνδεδεμένο χρήστη, χωρίς κανένα άλλο δικαίωμα. Το `none` σημαίνει ότι δεν χρειάζεται ούτε συνεδρία, και η ενότητα εξηγεί γιατί. Το `(in handler)` σημαίνει ότι ο έλεγχος γίνεται μέσα στον handler και όχι πριν από αυτόν, και η ενότητα εξηγεί γιατί.

Η στήλη προϊόντος δείχνει το μικρότερο HotLoop που έχει το route: το `all` είναι IoT, Edge και Gateway, το `edge` είναι Edge και Gateway, το `gateway` είναι μόνο το Gateway. Κάθε προϊόν καταχωρεί κάθε route και ελέγχει σε αυτό το ίδιο δικαίωμα. Σε ένα προϊόν που δεν το έχει, το route απαντά 404 και λέει πού βρίσκεται· δείτε [Δεν υπάρχει σε αυτό το προϊόν](#δεν-υπάρχει-σε-αυτό-το-προϊόν).

| Μέθοδος | Διαδρομή | Δικαίωμα | Προϊόν |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| οποιαδήποτε | `/mcp` | token MCP | all |
| οποιαδήποτε | `/mcp/` | token MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| οποιαδήποτε | `/` | none | all |

## Υγεία

Για το kubelet και τους load balancers. Κανένας δεν χρειάζεται συνεδρία: μια διερεύνηση δεν έχει λογαριασμό και καμία δεν λέει τίποτα για το εργοστάσιο.

### `GET /healthz`

Liveness. `200` με το κείμενο `ok` όσο η διεργασία εξυπηρετεί HTTP. Δεν αγγίζει τη βάση δεδομένων, επίτηδες: μια διακοπή της βάσης πρέπει να βγάζει το pod από την κυκλοφορία, όχι να το επανεκκινεί σε βρόχο.

### `GET /readyz`

Readiness. Κάνει ping στη βάση δεδομένων με περιθώριο 5 δευτερολέπτων.

```json
{"status":"ready"}
```

`503` όταν δεν μπορεί να τη φτάσει, με τον λόγο στο `detail` (η μορφή προέρχεται από τον handler· το κείμενο του λόγου είναι ό,τι είπε ο driver της βάσης):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Μια εφαρμογή που δεν φτάνει το historian της δεν πρέπει να δέχεται κίνηση.

## Έλεγχος ταυτότητας

Δείτε [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/) για λογαριασμούς, ρόλους και τον πρώτο διαχειριστή.

### `POST /api/auth/login`

Δεν χρειάζεται συνεδρία, εκ κατασκευής.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `username` | string | Υποχρεωτικό. Τα κεφαλαία/πεζά και τα περιβάλλοντα κενά αγνοούνται |
| `password` | string | Υποχρεωτικό |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Ορίζει επίσης το cookie `iiot_session` στο ίδιο token. `401` `"invalid username or password"` για λάθος όνομα, λάθος κωδικό ή απενεργοποιημένο λογαριασμό εξίσου, και παίρνει τον ίδιο χρόνο σε κάθε περίπτωση: ποιο από τα τρία ήταν δεν είναι κάτι που λες σε έναν άγνωστο. `429` για λογαριασμό που είχε πολλούς λάθος κωδικούς ή PIN στη σειρά, ό,τι κι αν σταλεί, με κεφαλίδα `Retry-After`· δείτε [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/#το-κλείδωμα-μετά-από-λάθος-κωδικούς-και-pin).

### `POST /api/auth/kiosk`

Σύνδεση σε κοινό πάνελ με PIN ή κάρτα, όπως το περιγράφει το [Έλεγχος ταυτότητας και χρήστες](/el/iot/authentication/#πίνακες-kiosk-pin-ή-κάρτα-και-αποσύνδεση-λόγω-αδράνειας). Δεν χρειάζεται συνεδρία, εκ κατασκευής.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `code` | string | Υποχρεωτικό. Το PIN ή η τιμή που πληκτρολόγησε ένας αναγνώστης καρτών σε λειτουργία πληκτρολογίου. Τα περιβάλλοντα κενά αγνοούνται |
| `username` | string | Προαιρετικό. Με αυτό ελέγχεται μόνο το PIN εκείνου του λογαριασμού και ένα λάθος μετρά προς το κλείδωμα εκείνου του λογαριασμού. Χωρίς αυτό, ο κωδικός αναζητείται ανάμεσα σε όλους τους λογαριασμούς |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Ορίζει το cookie `iiot_session` και, σε αντίθεση με το `POST /api/auth/login`, δεν απαντά με το token: μια συνεδρία kiosk ανήκει στον περιηγητή του πάνελ. Το `idleSec` είναι πόσο επιβιώνει η συνεδρία χωρίς να την αγγίξει κανείς. `401` `"that PIN or badge isn't recognized"` για λάθος κωδικό, πολύ σύντομο κωδικό και κωδικό απενεργοποιημένου λογαριασμού εξίσου, και παίρνει τον ίδιο χρόνο σε κάθε περίπτωση. `429` όταν ο λογαριασμός είναι κλειδωμένος (δείτε [Το κλείδωμα](/el/iot/authentication/#το-κλείδωμα-μετά-από-λάθος-κωδικούς-και-pin)), με κεφαλίδα `Retry-After`. Ένας κωδικός που στέλνεται χωρίς `username` και δεν ταιριάζει σε κανέναν δεν μετρά εναντίον κανενός λογαριασμού· το πάνελ που τον έστειλε, ανά διεύθυνση πελάτη, περιμένει μισό δευτερόλεπτο παραπάνω πριν ελεγχθεί η επόμενη τέτοια προσπάθειά του, έως `ui.panelDelaySeconds`, και ένας σωστός το ξεκινά από την αρχή. Το πάνελ δεν κλειδώνει ποτέ. `400` όταν η εγκατάσταση τρέχει χωρίς σύνδεση (`HOTLOOP_AUTH_INSECURE`), αφού τότε δεν υπάρχει κανείς για να συνδεθείς ως αυτός.

### `POST /api/auth/activity`

Κάποιος άγγιξε το πάνελ. Χωρίς σώμα. `{"status":"ok"}`. Σε συνεδρία kiosk αυτό μετατοπίζει το όριο αδράνειάς της· το ίδιο κάνει και κάθε άλλο αίτημα που δεν είναι ανάγνωση (μια εγγραφή, μια αναγνώριση). Ένα `GET`, η ζωντανή ροή και οι φορτώσεις παρασκηνίου της ίδιας της σελίδας δεν το κάνουν: αλλιώς θα κρατούσαν τον τελευταίο άνθρωπο συνδεδεμένο για πάντα. Μια συνεδρία που δημιουργήθηκε με κωδικό δεν έχει όριο αδράνειας και τίποτα να μετατοπιστεί.

### `POST /api/auth/logout`

Τερματίζει τη συνεδρία με την οποία ήρθε το αίτημα (cookie ή bearer) και καθαρίζει το cookie. Χωρίς σώμα. `{"status":"logged out"}`.

### `GET /api/auth/session`

Ποιος είμαι. Για την ακολουθία εκκίνησης του UI.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Μια συνεδρία που δημιουργήθηκε σε πάνελ kiosk προσθέτει `"idleSec"`, το όριο αδράνειάς της σε δευτερόλεπτα, από το οποίο η σελίδα ξέρει ότι πρέπει να αποσυνδεθεί μόνη της.

Με απενεργοποιημένο έλεγχο ταυτότητας (`HOTLOOP_AUTH_INSECURE`), απαντά `{"authenticated":false,"insecure":true}` αντί για 401, ώστε το UI να μπορεί να πει γιατί δεν υπάρχει σύνδεση αντί να μαντεύει.

### `POST /api/auth/password`

Αλλάζει τον δικό σας κωδικό. Χωρίς δικαίωμα: η γνώση του τρέχοντος κωδικού είναι το διαπιστευτήριο.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `currentPassword` | string | Υποχρεωτικό |
| `newPassword` | string | Υποχρεωτικό, τουλάχιστον 8 χαρακτήρες |

`{"status":"password changed; log in again"}`. **Κάθε συνεδρία του λογαριασμού τερματίζεται, και αυτή**, και το cookie καθαρίζεται: μια αλλαγή κωδικού που αφήνει τις παλιές συνεδρίες να δουλεύουν είναι αλλαγή μόνο κατ' όνομα. `401` αν ο τρέχων κωδικός είναι λάθος, `400` αν ο νέος είναι πολύ σύντομος.

## Χρήστες

Όλα μόνο για διαχειριστές (`users.manage`). Τα hash των κωδικών δεν εμφανίζονται ποτέ σε απάντηση· το πεδίο δεν έχει όνομα JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

Το `permissions` εμφανίζεται μόνο σε λογαριασμό που έχει ρητή λίστα. Το `hasPin` λέει αν ο λογαριασμός έχει PIN ή κάρτα kiosk· η τιμή και το hash της δεν εμφανίζονται ποτέ.

### `POST /api/users`

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `username` | string | Υποχρεωτικό. Πεζά γράμματα, ψηφία, τελεία, κάτω παύλα, παύλα, ξεκινώντας με γράμμα ή ψηφίο, 2 έως 64 χαρακτήρες |
| `password` | string | Υποχρεωτικό, τουλάχιστον 8 χαρακτήρες |
| `role` | string | `admin`, `operator` ή `viewer`. Προεπιλογή `viewer` |
| `permissions` | string[] | Προαιρετικό. Αντικαθιστά πλήρως το σύνολο του ρόλου |

Απαντά με τον νέο χρήστη. `400` για κακό όνομα, ρόλο ή κωδικό, `409` αν το όνομα είναι πιασμένο.

### `PUT /api/users/{username}`

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `role` | string | Υποχρεωτικό εκτός αν ορίζεται το `permissions` |
| `permissions` | string[] | Προαιρετικό. Κενό σημαίνει «χρήση του ρόλου» |
| `disabled` | bool | Το `true` απενεργοποιεί τον λογαριασμό και τερματίζει κάθε συνεδρία του |

Απαντά με τον ενημερωμένο χρήστη. `400` για άγνωστο ρόλο, ή για απενεργοποίηση του τελευταίου ενεργού διαχειριστή: αυτό είναι κλείδωμα χωρίς να έχει μείνει κανείς να το αναιρέσει. `404` για άγνωστο χρήστη.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` για τον δικό σας λογαριασμό ή τον τελευταίο ενεργό διαχειριστή, `404` για άγνωστο χρήστη.

### `POST /api/users/{username}/password`

Ένας διαχειριστής ορίζει τον κωδικό κάποιου άλλου χωρίς να ξέρει τον παλιό. `{"password": "..."}`, τουλάχιστον 8 χαρακτήρες. Απαντά `{"status":"password reset"}` και τερματίζει κάθε συνεδρία εκείνου του λογαριασμού.

### `PUT /api/users/{username}/pin`

Ένας διαχειριστής δίνει σε έναν λογαριασμό PIN ή τιμή κάρτας για σύνδεση σε πάνελ kiosk, ή αντικαθιστά αυτό που έχει. `{"code": "482913"}`: 6 έως 72 χαρακτήρες, χωρίς κενά ή χαρακτήρες ελέγχου, ψηφία ή ό,τι άλλο πληκτρολογεί ένας αναγνώστης καρτών. Απαντά `{"status":"PIN set","username":"olga","hasPin":true}`. Η τιμή κατακερματίζεται με bcrypt, όπως ένας κωδικός, και δεν καταγράφεται ούτε στέλνεται ποτέ πίσω. `400` για κωδικό που είναι πολύ σύντομος, πολύ μακρύς ή έχει κενό, και για κωδικό που έχει ήδη άλλος λογαριασμός: ένα πάνελ βρίσκει τον λογαριασμό από τον κωδικό και μόνο, άρα ένας κωδικός ανοίγει έναν λογαριασμό. `404` για άγνωστο χρήστη. Δεν αγγίζει τον κωδικό ούτε καμία συνεδρία.

### `DELETE /api/users/{username}/lockout`

Αφήνει έναν κλειδωμένο λογαριασμό να μπει ξανά πριν λήξει το κλείδωμά του, και μηδενίζει τη μέτρηση των λάθος κωδικών και PIN του. `{"status":"unlocked","username":"olga","locked":false}`. `404` για άγνωστο χρήστη. Ένας κλειδωμένος λογαριασμός δείχνει `"locked":true` και `"lockedUntil"` στο `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Αφαιρεί το PIN ή την κάρτα και αποσυνδέει τον λογαριασμό από κάθε πάνελ kiosk όπου είναι συνδεδεμένος. Ο κωδικός του και οι συνεδρίες του στον δικό του υπολογιστή δεν επηρεάζονται. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` για άγνωστο χρήστη.

### `GET /api/opcua/certificates`

Κάθε πιστοποιητικό X.509 που έχει συνδεθεί με χρήστη για σύνδεση στον διακομιστή OPC UA (δείτε [τον διακομιστή OPC UA](/el/edge/opc-ua-server/#πιστοποιητικά-χρήστη-x509)), το νεότερο πρώτο: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Κάθε ένα έχει `thumbprint` (SHA-256 της μορφής DER, δεκαεξαδικό με πεζά), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` και `revokedBy` μόλις ανακληθεί, `lastUsed` μόλις χρησιμοποιηθεί, και `state`: `active`, `revoked`, `expired` ή `not yet valid`. Μόνο ένα ενεργό πιστοποιητικό συνδέει κάποιον. Το `serverAcceptsCertificates` λέει αν ο διακομιστής OPC UA είναι ενεργός και έχει οριστεί το `HOTLOOP_OPCUA_SERVER_ALLOW_X509`· τα πιστοποιητικά διατηρούνται και στις δύο περιπτώσεις. Αποθηκεύεται ή στέλνεται μόνο το δημόσιο πιστοποιητικό.

### `GET /api/users/{username}/certificates`

Η ίδια λίστα για έναν χρήστη. `404` για άγνωστο χρήστη.

### `POST /api/users/{username}/certificates`

Συνδέει ένα πιστοποιητικό με έναν χρήστη. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`· η ετικέτα είναι προαιρετική. Απαντά `201` με το πιστοποιητικό όπως εμφανίζεται στη λίστα. Το πιστοποιητικό πρέπει να είναι RSA με κλειδί τουλάχιστον 2048 bit και να μην έχει λήξει. Το `400` λέει ποιο από αυτά ισχύει, και για κάτι που δεν είναι πιστοποιητικό: ένα ιδιωτικό κλειδί απορρίπτεται ονομαστικά και δεν διατηρείται ούτε επιστρέφεται ποτέ, και το ίδιο μια αλυσίδα. `404` για άγνωστο χρήστη. `409` όταν το πιστοποιητικό είναι ήδη συνδεδεμένο, σε αυτόν τον χρήστη ή σε άλλον: ένα πιστοποιητικό είναι ένας άνθρωπος. Η αλλαγή καταγράφεται στο ημερολόγιο με το ποιος την έκανε.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Ανακαλεί ένα πιστοποιητικό. Δεν μπορεί πλέον να συνδέσει, μια συνεδρία που άνοιξε με αυτό τερματίζεται μέσα στα 10 δευτερόλεπτα της προσωρινής μνήμης δικαιωμάτων, και οι μεταγενέστερες προσπάθειες απορρίπτονται και καταγράφονται ως ανακληθείσες. Παραμένει στη λίστα ως `revoked` με το ποιος το έκανε και πότε, και μια νέα ανάκληση κρατά την πρώτη εγγραφή. Το `{thumbprint}` είναι το SHA-256 όπως εμφανίζεται· γίνονται δεκτά άνω-κάτω τελεία, κενά και κεφαλαία. `404` όταν το πιστοποιητικό δεν ανήκει σε αυτόν τον χρήστη.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Ξεχνά ένα πιστοποιητικό. Αν συνδεθεί ξανά, δουλεύει ξανά. `404` όταν δεν ανήκει σε αυτόν τον χρήστη. Η διαγραφή του χρήστη διαγράφει τα πιστοποιητικά του.

## Κατάσταση και διαγνωστικά

### `GET /api/status`

Η γραμμή κεφαλίδας: μετρητές runtime, η σύνοψη συναγερμών, το όνομα του εργοστασίου και ποιο προϊόν είναι αυτό. Το `product` είναι `iot`, `edge` ή `gateway`, το ίδιο με το `hotloop --product`. Το `features` δείχνει ποιες από τις λειτουργίες που διαφέρουν ανάμεσα στα προϊόντα έχει αυτό: `edge-publish`, `fleet`, `opcua-server`, `reports` και `sites` σε ένα Gateway, η πρώτη και η τρίτη στο Edge, καμία στο IoT. Το `version` είναι το build, και το `imageDigest` είναι το digest της εικόνας από την οποία ξεκίνησε, κάτι που ένας αριθμός έκδοσης δεν μπορεί να σας πει σε ένα κουτί που ακολουθεί το `:stable`. Υπάρχει μόνο όταν το είπε ο supervisor (οι μονάδες Quadlet το κάνουν, πριν από κάθε εκκίνηση· ένα γυμνό εκτελέσιμο και μια εγκατάσταση Helm δεν μπορούν) και παραλείπεται αλλιώς.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Κάθε πρωτόκολλο που γνωρίζει το Gateway, και αν αυτό το build έχει το driver του.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Ό,τι δείχνει η οθόνη διαγνωστικών: η δεξαμενή της βάσης δεδομένων, η ουρά του historian και το μέγεθος του ιστορικού, ο δίαυλος των tags, η μηχανή οντοτήτων, ο καταγραφέας του ημερολογίου, το runtime, το MCP (διακομιστής και εξερχόμενες συνδέσεις) και οι οπλισμένοι κανόνες της μηχανής αυτοματισμών, οι διαδρομές webhook και η ουρά αλλαγών κατάστασης.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Με εξερχόμενους διακομιστές MCP ρυθμισμένους, το `outbound` απαριθμεί τον καθένα:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Κάθε διαπιστευτήριο στο `target` ή στο `lastError` ενός εξερχόμενου διακομιστή αφαιρείται, επειδή ένα URL ή μια γραμμή εντολών μπορεί να μεταφέρει token και κάθε ρόλος μπορεί να το διαβάσει. Το ίδιο το token MCP είναι πάντα μόνο `tokenSet`.

## Συσκευές

Μια συσκευή είναι μία σύνδεση πάνω από ένα πρωτόκολλο. Τι μπαίνει στα `config` και `address` εξαρτάται από το πρωτόκολλο: δείτε [Πρωτόκολλα και drivers](/el/iot/protocols/).

### `GET /api/devices`

Κάθε συσκευή, με την ζωντανή κατάσταση σύνδεσής της. Τα διαπιστευτήρια είναι `[redacted]`. Το `?q=` κρατά τις συσκευές των οποίων το id, το όνομα, η διεύθυνση ή το πρωτόκολλο περιέχει το κείμενο (χωρίς διάκριση πεζών-κεφαλαίων), το `?limit=` (1 έως 5000, οτιδήποτε άλλο δίνει `400`) τις πρώτες από αυτές· με οποιοδήποτε από τα δύο, το `X-Total-Count` λέει πόσες ταίριαξαν.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

Το `state` είναι `connected`, `connecting`, `degraded` (ενεργή, αλλά οι αναγνώσεις αποτυγχάνουν), `disconnected` ή `disabled`. Τα `lastError`, `errorCount` και τα υπόλοιπα εμφανίζονται όταν υπάρχει κάτι να ειπωθεί.

### `POST /api/devices`

Δημιουργεί τη συσκευή αν το `id` είναι καινούργιο, την αντικαθιστά αν όχι. Δεν υπάρχει `PUT`.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `id` | string | Υποχρεωτικό. 1 έως 64 γράμματα, ψηφία, `.`, `_`, `-`, με αλφαριθμητικό πρώτο χαρακτήρα. Καταλήγει σε URL, topics MQTT και ορίσματα MCP |
| `name` | string | Υποχρεωτικό |
| `protocol` | string | Υποχρεωτικό. Ένα για το οποίο αυτό το build έχει driver (`GET /api/protocols`) |
| `address` | string | Υποχρεωτικό. Host και θύρα, ή URL `opc.tcp://` ή `http://`: αποφασίζει το πρωτόκολλο |
| `enabled` | bool | Αν παραλειφθεί, είναι `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | Το 0 παίρνει την προεπιλογή του runtime. Το διάστημα ανάγνωσης έχει κατώτατο όριο το `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Τοποθετεί τη συσκευή στο δέντρο εξοπλισμού με βάση το όνομα, δημιουργώντας κόμβους όπου χρειάζεται |
| `equipmentId` | int | Την τοποθετεί αντίθετα σε κόμβο του δέντρου· τα `site`, `area` και `line` προέρχονται τότε από τον κόμβο. Δείτε [το δέντρο εξοπλισμού και οι ετικέτες](/el/iot/equipment/) |
| `config` | object | Οι ίδιες οι επιλογές του πρωτοκόλλου. Τα διαπιστευτήρια ακολουθούν τους [κανόνες μόνο για εγγραφή](#τα-μυστικά-είναι-μόνο-για-εγγραφή) |

Τα πεδία runtime (`state`, `lastPoll`, `tagCount` και ούτω καθεξής) είναι μόνο για ανάγνωση· αν τα στείλετε πίσω, αγνοούνται. Απαντά με τη συσκευή που αποθηκεύτηκε, με αποκρυμμένα τα ευαίσθητα. `400` για πρωτόκολλο χωρίς driver, αποτυχημένο έλεγχο ή κανόνα διαπιστευτηρίων· το runtime φορτώνεται ξανά αμέσως μαζί της.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Η συσκευή, τα tags και οι ετικέτες της.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

Το `tags` είναι `[]` για συσκευή που δεν έχει κανένα. `404` για άγνωστο id.

### `DELETE /api/devices/{id}`

Διαγράφει τη συσκευή, τα tags και τις οντότητές τους. **Το ιστορικό της διατηρείται.** `{"deleted":"tank-farm"}`, ή `404`.

### `POST /api/devices/{id}/enabled`

Το `{"enabled": false}` σταματά την ανάγνωση χωρίς να διαγράψει τίποτα. Απαντά `{"enabled":false,"id":"tank-farm"}`. `404` για άγνωστο id.

### `POST /api/devices/{id}/browse`

Ρωτά τη συσκευή ποια σημεία έχει. Χρειάζεται μόνο `devices.read`, επειδή διαβάζει. Χωρίς σώμα.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Ένα πρωτόκολλο που δεν μπορεί να απαριθμήσει τα σημεία του (Modbus, S7comm, HTTP) απαντά `200` με `{"supported":false,"reason":"..."}`: αυτό είναι γεγονός για το πρωτόκολλο, όχι σφάλμα. `503` αν η συσκευή δεν είναι συνδεδεμένη. Το `writable` εδώ είναι ό,τι λέει η συσκευή για το σημείο, όχι αν το Gateway θα το γράψει.

### `POST /api/devices/{id}/import`

Μετατρέπει τα αποτελέσματα περιήγησης σε ρυθμισμένα tags. Χρειάζεται `tags.write`, επειδή δημιουργεί tags.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Κάθε εγγραφή δέχεται `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` και `writable` (το αποτέλεσμα περιήγησης όπως ήρθε). Απαντά `{"inserted":2,"updated":0}`. **Κάθε εισαγμένο tag είναι μόνο για ανάγνωση**, ό,τι κι αν είπε η συσκευή: ένα σημείο που ανακαλύφθηκε δεν είναι σημείο που κάποιος αποφάσισε ότι επιτρέπεται να δέχεται εντολές, και η αντίστροφη προεπιλογή θα οπλιζε μερικές χιλιάδες από αυτά ταυτόχρονα. Οπλίστε όσα εννοείτε με `POST /api/tags`. `404` για άγνωστη συσκευή.

## UniFi: δίκτυα OT, πελάτες και πού βρίσκεται μια συσκευή στο δίκτυο

Η δική του καταγραφή του HotLoop για τις τοποθεσίες UniFi. Δείτε [UniFi Network](/el/iot/unifi/). Το `{id}` κάτω από το `/api/unifi` είναι μια συσκευή UniFi (μία τοποθεσία σε μία κονσόλα)· το `{network}` είναι το ίδιο το ID που δίνει η κονσόλα σε ένα δίκτυο, όπως το δίνει το `GET .../networks`· το `{mac}` δέχεται κάθε συνηθισμένη γραφή και φυλάσσεται με πεζά και άνω-κάτω τελείες.

**Καμία από αυτές δεν ρωτά την κονσόλα τίποτα.** Διαβάζουν την τελευταία ανάγνωση του driver από αυτήν, οπότε μια οθόνη που μένει ανοιχτή δεν κοστίζει τίποτα στην κονσόλα. Αυτό σημαίνει επίσης ότι απαντούν `503` μέχρι η συσκευή να διαβαστεί μία φορά, και πάντα σε έναν βοηθό `--mcp-stdio`, που δεν συνδέεται ποτέ σε κονσόλα. Ούτε καμία τους γράφει σε κονσόλα.

Μια αλλαγή που δημιουργεί ή αφαιρεί έναν συναγερμό το λέει στο `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Αυτοί είναι συνηθισμένοι ορισμοί συναγερμών, κάτω από το `/api/alarms`.

### `GET /api/devices/{id}/network`

Πού βρίσκεται στο δίκτυο μια συσκευή HotLoop (ένα PLC, ένας μετρητής). Συνδεδεμένη:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Αν δεν είναι συνδεδεμένη, το `link` είναι `null` και το `proposals` απαριθμεί τους πελάτες που έχει οποιαδήποτε κονσόλα διαβάζει το HotLoop στην IP της συσκευής, τους νεότερους πρώτα. Μια πρόταση είναι μόνο αυτό: οι IP της κονσόλας καθυστερούν, οπότε τίποτα δεν συνδέεται μέχρι να επιβεβαιώσει ένας διαχειριστής μία.

### `PUT /api/devices/{id}/network`

Το `{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` επιβεβαιώνει ποιος πελάτης είναι η συσκευή. Από εκεί και πέρα το κλειδί είναι η MAC και η IP δεν εμπιστεύεται ποτέ ξανά. Ο πελάτης παίρνει tags (`c.<mac>.*` στην κονσόλα) και έναν συναγερμό, «Το PLC-07 εκτός δικτύου», προτεραιότητας 1 με καθυστέρηση ενεργοποίησης 120 s ώστε μια επανεκκίνηση να μην ειδοποιεί κανέναν. Απαντά `{"link":{...},"change":{...}}`. `400` αν το `consoleId` δεν είναι συσκευή UniFi ή η MAC δεν είναι MAC, `404` για άγνωστη συσκευή.

### `DELETE /api/devices/{id}/network`

Αφαιρεί τη σύνδεση, και τον συναγερμό που έφτιαξε το HotLoop για αυτήν, εκτός αν ο πελάτης παρακολουθείται ακόμη από λίστα γνωστών. `404` αν δεν υπήρχε σύνδεση.

### `GET /api/unifi/{id}/networks`

Τα δίκτυα της τοποθεσίας όπως τα έχει η κονσόλα, με την καταγραφή του HotLoop: `ot`, `known` (πόσες συσκευές υπάρχουν στη λίστα του), `clients` (πάνω του τώρα) και `unknown` (πάνω του τώρα και όχι στη λίστα). Ένα δίκτυο για το οποίο το HotLoop έχει εγγραφή και που η κονσόλα δεν έχει πια, επιστρέφεται με `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

Το `{"ot": true}` σημειώνει ένα δίκτυο ως OT. Ό,τι υπάρχει σε αυτό και δεν είναι στη λίστα γνωστών μετράει στο `n.<network>.unknown` και κατονομάζεται στο `.unknown_last`, και το HotLoop δημιουργεί τον συναγερμό «Άγνωστη συσκευή στο SCADA», προτεραιότητας 1. Το `{"ot": false}` αφαιρεί τη σήμανση και αυτόν τον συναγερμό· η λίστα γνωστών διατηρείται. `400` για ένα WAN ή ένα δίκτυο που η κονσόλα δεν έχει.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Αποδέχεται τώρα ό,τι υπάρχει στο δίκτυο, όπως είναι: το ένα κλικ μετά τη σήμανσή του. Οι συσκευές που είναι ήδη στη λίστα κρατούν το όνομα και την παρακολούθησή τους. Χωρίς σώμα. Απαντά `{"accepted":[{known device}...]}`, αυτές που πρόσθεσε.

### `GET /api/unifi/{id}/known`

Κάθε γνωστή συσκευή στα δίκτυα της τοποθεσίας: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

Το `{"name":"PLC-07","watch":true}` δέχεται μια συσκευή στο δίκτυο, ή αλλάζει το όνομα ή την παρακολούθησή της. Το `watch` της δίνει tags και τον συναγερμό αποσύνδεσης· μια συσκευή που επιτρέπεται αλλά έρχεται και φεύγει (ένα φορητό συντήρησης) γίνεται δεκτή χωρίς αυτό. `400` αν το δίκτυο δεν σημειώθηκε ποτέ ως OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Βγάζει μια συσκευή από τη λίστα. Αν είναι στο δίκτυο, είναι ξανά άγνωστη στην επόμενη ανάγνωση.

### `GET /api/unifi/{id}/clients`

Κάθε πελάτης που απαριθμεί η κονσόλα, συν κάθε παρακολουθούμενος που δεν απαριθμεί, ο καθένας με το πού βρίσκεται, αν είναι online, και τα `ot`, `known`, `watched`, `linkedTo` και μια μονόγραμμη `summary`. Το `?q=` το περιορίζει σε μια MAC, IP ή όνομα.

### `GET /api/unifi/consoles`

Κάθε συσκευή UniFi που έχει το HotLoop, σε λειτουργία ή όχι, για τον επιλογέα της οθόνης UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Μια κονσόλα που αυτή η διεργασία δεν έχει διαβάσει λέει γιατί στο `why`.

### `GET /api/unifi/{id}/overview`

Η κάρτα επισκόπησης: μετρήσεις συσκευών και πελατών (ένας πελάτης μετράει όταν το HotLoop πιστεύει ότι είναι στο δίκτυο, το τεστ που χρησιμοποιούν τα tags `n.<id>.clients`, όχι απλώς όταν τον απαριθμεί η κονσόλα), πελάτες ανά δίκτυο, το `health` των υποσυστημάτων της κονσόλας, και για κάθε gateway η λωρίδα WAN του, `gateways[]`: μία εγγραφή `wans[]` ανά WAN με `alive` (οι δικοί του έλεγχοι υγείας του gateway, ποτέ το `up` του μπλοκ WAN), `known`, `active`, `backup`, καθυστέρηση και διαθεσιμότητα. Το `failover` είναι κίνηση σε WAN που δεν είναι το πρώτο, το `down` είναι κανένα WAN ζωντανό, και το `since` είναι η πρώτη ανάγνωση όπου το HotLoop είδε κίνηση στο WAN όπου είναι τώρα, δηλαδή όταν το πρόσεξε το HotLoop, όχι όταν άλλαξε το gateway. Το `events` είναι η κατάσταση του websocket συμβάντων (`live`, `error`, `reconnects`) και τα δέκα νεότερα συμβάντα.

### `GET /api/unifi/{id}/topology`

Ο χάρτης. Τα `nodes[]` είναι οι υιοθετημένες συσκευές με τη θέση τους στο πλέγμα (`x`, `y`, `layer`: από αριστερά προς τα δεξιά ξεκινώντας από το gateway, διατεταγμένες με τον ίδιο τρόπο για την ίδια ανάγνωση), τα `edges[]` τα καλώδια μεταξύ τους από το δικό της `downlink_table` της κονσόλας, τα `wired[]` και `wifi[]` οι πελάτες που κρέμονται από κάθε θύρα switch και κάθε AP και SSID. Μια συσκευή που τίποτα δεν απαριθμεί ως συνδεδεμένη κάπου σχεδιάζεται μόνη της με ορισμένο το `noUplink`, όχι κρεμασμένη από το gateway με εικασία. Μια συσκευή άλλης κονσόλας UniFi που διαβάζει το HotLoop και που αυτή η κονσόλα απαριθμεί ως πελάτη ράβεται ως κόμβος με ορισμένο το `external` και μια ακμή με `stitched`. Το `feeds` είναι, ανά MAC συσκευής, οι συσκευές HotLoop που συνδέονται με έναν πελάτη κατάντη της, με το `equipmentId` τους για το δέντρο του εργοστασίου, και το `links` οι ίδιες συσκευές ανά MAC πελάτη.

### `GET /api/unifi/{id}/devices`

Κάθε υιοθετημένη συσκευή με τα νούμερά της και το `ports[]` της για την πρόσοψη: σύνδεσμος, ταχύτητα, λειτουργία και κατανάλωση PoE, οι πελάτες που μαθεύτηκαν στη θύρα, η συσκευή που είναι συνδεδεμένη σε αυτήν, και `dropped` για μια θύρα που ήταν πάνω σε προηγούμενη ανάγνωση και τώρα είναι κάτω. Μια συσκευή που έχασε η κονσόλα δεν αναφέρει νούμερα ούτε συνδέσμους θυρών, επειδή ό,τι είπε τελευταίο δεν ισχύει πια.

### `GET /api/unifi/{id}/wifi`

Τα SSID της τοποθεσίας με το `enabled`, το δίκτυο όπου βρίσκονται και πόσοι πελάτες είναι σε καθένα. Όταν η κονσόλα δεν δείχνει σε αυτόν τον λογαριασμό τα ασύρματα δίκτυά της, το `error` λέει γιατί και το `wlans` είναι κενό.

### `GET /api/unifi/{id}/events`

Τα νεότερα συμβάντα που έχει αναφέρει η κονσόλα από τότε που συνδέθηκε το HotLoop, τα νεότερα πρώτα (`?limit=` έως 200, προεπιλογή 50), και η κατάσταση του websocket συμβάντων. Κάθε συμβάν έχει το `key` του controller (`EVT_SW_Lost_Contact`), το δικό του `message`, `severity` (`warning` όταν ο controller το σημειώνει ως κάτι που πάει στραβά) και τη συσκευή, τον πελάτη και τη θύρα στα οποία αναφέρεται. Είναι επίσης στο ημερολόγιο, καταχωρισμένα κάτω από το switch ή το σημείο πρόσβασης στο οποίο αναφέρονται (δείτε [UniFi Network](/el/iot/unifi/#συμβάντα)).

### `POST /api/unifi/{id}/starter-alarms`

Δημιουργεί τους συνηθισμένους συναγερμούς για την τοποθεσία από ό,τι έχει τώρα η κονσόλα, ως συνηθισμένους ορισμούς συναγερμών κάτω από το `/api/alarms`: κάθε υιοθετημένη συσκευή εκτός σύνδεσης (προτεραιότητα 2, καθυστέρηση 60 s), κάθε θύρα uplink κάτω (προτεραιότητα 1, 10 s), ένα gateway με δύο ή περισσότερα WAN που τρέχει σε εφεδρικό (προτεραιότητα 2, 30 s). Το σώμα είναι προαιρετικό. Το `{"poeLimitW": 25}` προσθέτει συναγερμό προτεραιότητας 3 στην κατανάλωση `poe_w` κάθε θύρας PoE πάνω από τόσα watt, με καθυστέρηση 30 s· η κονσόλα δεν λέει ποιος είναι ο προϋπολογισμός μιας θύρας, οπότε το HotLoop δεν μαντεύει έναν. Ένα αρνητικό όριο είναι `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

Τα `kept` είναι συναγερμοί που το σύνολο ζητά και ήταν ήδη εκεί: δικοί του από προηγούμενο πάτημα, ή συναγερμός κάποιου στο ίδιο tag. Έτσι είναι ασφαλές να πατήσετε ξανά μετά την υιοθέτηση περισσότερου εξοπλισμού, και προσθέτει μόνο τον νέο εξοπλισμό. Οι συναγερμοί δικτύου OT και εκτός δικτύου δεν ανήκουν σε αυτό· έρχονται με τη σήμανση ενός δικτύου ως OT και την παρακολούθηση μιας συσκευής. `503` μέχρι η κονσόλα να διαβαστεί μία φορά.

## Ανακάλυψη MQTT

Συσκευές που ανακοίνωσαν τον εαυτό τους μέσω MQTT, και τι αποφάσισε ένας άνθρωπος για την καθεμία. Δείτε [Ανακάλυψη MQTT](/el/iot/mqtt-discovery/). Η ανακάλυψη ακούει στον ενσωματωμένο broker όταν τρέχει, και σε κάθε broker που έχει στηθεί κάτω από το `/api/mqtt/brokers`. Χωρίς κανένα από τα δύο, το `sources` είναι κενό. Σε βοηθό `--mcp-stdio`, που δεν ακούει ποτέ, το `GET /api/discovery` απαντά `{"running":false,"sources":[],"devices":[]}` και κάθε άλλο route `503`.

Το `{source}` είναι ο broker στον οποίο ανακοινώθηκε μια συσκευή (`embedded` για τον δικό του του HotLoop, αλλιώς το id του broker)· το `{key}` είναι αυτό που έδεσε τις ανακοινώσεις της: ο πρώτος αναγνωριστικός της, η MAC της ως `mac:aa:bb:cc:dd:ee:ff`, ή το id κόμβου της. Κωδικοποιήστε το ως URL· τα αναγνωριστικά φέρουν χαρακτήρες που μια διαδρομή δεν αντέχει.

**Καμία από αυτές δεν οπλίζει τίποτα.** Η αποδοχή μιας συσκευής κάνει τα σημεία της οπλίσιμα, ένα ένα, μέσω `POST /api/tags` όπως κάθε άλλο σημείο.

### `GET /api/discovery`

Κάθε πηγή, με ό,τι έχει δει και απορρίψει, και κάθε ανακαλυφθείσα συσκευή:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Μια πηγή με `external` true είναι broker που έχει στηθεί κάτω από το `/api/mqtt/brokers`, και το `broker` λέει πού βρίσκεται. Το `autoCreate` false είναι πηγή της οποίας οι συσκευές περιμένουν στα εισερχόμενα: εμφανίζονται ως `discovered` χωρίς `deviceId`, τίποτα δεν δημιουργείται και τίποτα δεν διαβάζεται μέχρι κάποιος να αποδεχτεί μία. Το `listenOnly` είναι broker στον οποίο το HotLoop δεν δημοσιεύει ποτέ. Το `lastError` λέει γιατί μια πηγή δεν είναι συνδεδεμένη, και ένας κωδικός που δεν ανοίγει.

Το `status` είναι `discovered`, `accepted` ή `ignored`. Ανά εξάρτημα, το `unsupported` απαριθμεί ό,τι δεν μπορεί να χρησιμοποιήσει το HotLoop και γιατί («value template not supported: filter `regex_findall_index` is not supported at column 12»), το `unknownKeys` τα κλειδιά ρύθμισης που η μορφή δεν ορίζει, το `commandTopics` κάθε topic όπου μπορούν να πάνε οι εντολές του (το topic ταχύτητας ενός ανεμιστήρα εκτός από το κύριο), και το `flags` ό,τι πρέπει να κοιτάξει ένας άνθρωπος πριν αποδεχτεί: ένα topic εντολών εκτός των topics που διαβάζει το εξάρτημα, μέσα στο πρόθεμα ανακάλυψης ή διεκδικημένο από άλλη συσκευή, και μια ρύθμιση που ζητά διατηρημένες εντολές. Το `withdrawnAt` ορίζεται σε εξάρτημα που απέσυρε ο εκδότης. Το `suggestedEquipmentId` είναι ο κόμβος του δέντρου που κατονομάζει το `suggested_area` της συσκευής, όταν ακριβώς ένας κόμβος έχει αυτό το όνομα· απλώς προσυμπληρώνει το παράθυρο αποδοχής. Στον ενσωματωμένο broker, τα `announcedBy` και `announcedVia` είναι το login του broker και το id πελάτη που δημοσίευσαν την τελευταία της ρύθμιση, και το `acceptedLogin` το login από το οποίο έγινε αποδεκτή. Μια αποδεκτή συσκευή της οποίας άλλαξε η ανακοίνωση, ή που την ανακοίνωσε διαφορετικό login, έχει `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Μία συσκευή, με την ίδια μορφή. `404` για μία που δεν έχει δει το HotLoop.

### `POST /api/discovery/{source}/{key}/accept`

Αποδέχεται μια συσκευή. Προαιρετικό σώμα `{"equipmentId": 12}` την τοποθετεί στο δέντρο στο ίδιο βήμα. Δεν οπλίζει τίποτα. Απαντά με τη συσκευή. `400` για αγνοημένη.

### `POST /api/discovery/{source}/{key}/ignore`

Απορρίπτει τη συσκευή: η συσκευή της στο HotLoop, τα tags και οι οντότητές της φεύγουν (το ιστορικό μένει), και παραμένει αγνοημένη όταν ανακοινωθεί ξανά. Απαντά με τη συσκευή. Το `DELETE /api/devices/{id}` σε ανακαλυφθείσα συσκευή κάνει το ίδιο, επειδή μια συσκευή που συνεχίζει να ανακοινώνεται απλώς θα επέστρεφε.

### `POST /api/discovery/{source}/{key}/unignore`

Επαναφέρει μια αγνοημένη συσκευή ως ανακαλυφθείσα, από ό,τι ανακοίνωσε τελευταία. `400` αν δεν είναι αγνοημένη.

### `POST /api/discovery/{source}/{key}/review/apply`

Κάνει μια αποδεκτή συσκευή να τρέξει ό,τι ανακοίνωσε. Το αν κάθε σημείο είναι οπλισμένο μένει όπως ήταν. `400` όταν τίποτα δεν περιμένει έλεγχο.

### `POST /api/discovery/{source}/{key}/review/reject`

Κρατά την αποδεκτή ρύθμιση σε λειτουργία και σταματά να προσφέρει αυτή την αλλαγή. Μια διαφορετική αλλαγή αργότερα προσφέρεται ξανά. `400` όταν τίποτα δεν περιμένει.

Ένας έλεγχος μπορεί να αφορά το ποιος την ανακοίνωσε: μια αλλαγή με `"kind":"publisher"` και τη γραμμή σύνοψης «announced by login garage-node; accepted from kitchen-node». Η εφαρμογή της κάνει αυτό το login εκείνο από το οποίο γίνεται αποδεκτή η συσκευή.

## Logins του broker

Τα logins του ενσωματωμένου broker που δημιουργήθηκαν στο HotLoop, το καθένα με τα topics στα οποία μπορεί να δημοσιεύει και να εγγράφεται. Δείτε [τον ενσωματωμένο broker MQTT](/el/iot/broker/). Ένα login είναι κλειδί για τον broker ολόκληρου του εργοστασίου, οπότε αυτά είναι `users.manage`, ενός διαχειριστή. Τίποτα εδώ δεν απαντά ποτέ με κωδικό ή το hash του. Κάθε αλλαγή καταγράφεται και ισχύει από την επόμενη δημοσίευση του πελάτη· κανείς δεν χρειάζεται να επανασυνδεθεί.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

Το `running` είναι false όπου αυτή η διεργασία δεν τρέχει τον broker· τα logins διατηρούνται παρ' όλα αυτά, και ο broker τα διαβάζει όταν ξεκινά. Τα `envLogins` είναι τα ονόματα από το `HOTLOOP_BROKER_USERS`, που μπορούν να κάνουν τα πάντα. Το `%u` σε έναν κανόνα είναι το όνομα του ίδιου του login και το `%p` το πρόθεμα ανακάλυψης· τα `resolved*` είναι οι κανόνες με συμπληρωμένα και τα δύο.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

Το `name` είναι 1 έως 64 γράμματα, ψηφία, `-` και `_` (αντιπροσωπεύει το `%u` στα topics). Το `password` είναι τουλάχιστον 12 χαρακτήρες. Το `profile` συμπληρώνει τους κανόνες· τα `publish` και `subscribe`, όταν δίνονται, τους αντικαθιστούν. Χρειάζεται ένα από τα δύο. Ένας κανόνας είναι φίλτρο topic MQTT: `+` και `#` μόνο ως ολόκληρα επίπεδα, `#` μόνο τελευταίο, ποτέ topic `$`. `201` με το login· `400` για οτιδήποτε από τα παραπάνω ή όνομα που το `HOTLOOP_BROKER_USERS` ήδη έχει· `409` για όνομα που είναι πιασμένο.

### `PUT /api/broker/logins/{name}`

Οποιοδήποτε από τα `profile`, `publish`, `subscribe` και `password`· ό,τι δεν στέλνεται μένει. `200` με το login, `404` για ένα που δεν υπάρχει.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Ένας πελάτης που είναι ακόμη συνδεδεμένος με αυτό δεν μπορεί να κάνει τίποτα από εκεί και πέρα, και δεν μπορεί να συνδεθεί ξανά. `404` για ένα που δεν υπάρχει.

## Ανακάλυψη δικτύου

Συσκευές που ακούστηκαν στο δίκτυο του εργοστασίου μέσω mDNS, SSDP και DHCP, και τι αποφάσισε ένας άνθρωπος για την καθεμία. Δείτε [Ανακάλυψη δικτύου](/el/iot/network-discovery/). Σε βοηθό `--mcp-stdio`, που δεν ακούει ποτέ, το `GET /api/network-discovery` απαντά `{"running":false,"finds":[]}` και κάθε άλλο route `503`.

Το `{key}` είναι το πώς ακούστηκε ένα εύρημα και από ποιον: `mdns:` και το όνομα host mDNS, `ssdp:` και το uuid UPnP, `dhcp:` και η MAC. Κωδικοποιήστε το ως URL.

**Καμία από αυτές δεν οπλίζει τίποτα**, και τίποτα εδώ δεν προστίθεται μέχρι κάποιος να το αποδεχτεί.

### `GET /api/network-discovery`

Οι ακροατές, η διερεύνηση, οι διεπαφές όπου βρίσκονται, και κάθε εύρημα:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

Το `kind` είναι `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (ανακοίνωσε κάτι για το οποίο το HotLoop δεν έχει λέξη), `upnp` ή `dhcp`. Ένα εύρημα του οποίου το `proposal` έχει `protocol` γίνεται, όταν αποδεχτεί, συσκευή αυτού του πρωτοκόλλου στο `address`· ένα χωρίς λέει στο `how` τι θα το έφερνε μέσα. Το `also` απαριθμεί τα άλλα ευρήματα και τις συσκευές που ανακαλύφθηκαν μέσω MQTT και είναι το ίδιο κουτί, ανά MAC ή διεύθυνση. Το `status` είναι `discovered`, `accepted` ή `ignored`, και το `deviceId` η συσκευή που έφτιαξε η αποδοχή. Το `error` ενός ακροατή λέει γιατί δεν ακούει (θύρα 67 πιασμένη ή μη επιτρεπτή, καμία διεπαφή multicast)· το `refused` μετρά τα νέα ευρήματα που απορρίφθηκαν επειδή το αρχείο είναι γεμάτο.

### `GET /api/network-discovery/{key}`

Ένα εύρημα, με την ίδια μορφή. `404` για ένα που δεν έχει ακούσει το HotLoop.

### `POST /api/network-discovery/{key}/accept`

Αποδέχεται ένα εύρημα. Προαιρετικό σώμα `{"equipmentId": 12}` τοποθετεί στο δέντρο τη συσκευή που φτιάχνει. Ένα εύρημα για το οποίο το HotLoop έχει driver γίνεται συσκευή στην προτεινόμενη διεύθυνση, ενεργοποιημένη, χωρίς tags και τίποτα οπλισμένο· κάθε άλλο καταγράφεται ως γνωστό και δεν φτιάχνει τίποτα. Απαντά με το εύρημα. `400` για ένα που έχει ήδη γίνει αποδεκτό ή αγνοηθεί.

### `POST /api/network-discovery/{key}/ignore`

Κρύβει ένα εύρημα για το οποίο κανείς δεν έχει αποφασίσει, και το κρατά κρυμμένο όταν ακουστεί ξανά. `400` για ένα που έχει ήδη κριθεί.

### `POST /api/network-discovery/{key}/unignore`

Επαναφέρει ένα αγνοημένο εύρημα ώστε να κριθεί. `400` αν δεν είναι αγνοημένο.

### `POST /api/network-discovery/probe`

Διερευνά τώρα: ένα ερώτημα mDNS και μια αναζήτηση SSDP σε κάθε διεπαφή της οποίας το δίκτυο αναφέρεται στο `HOTLOOP_NETDISC_PROBE_NETWORKS`, και πουθενά αλλού. Απαντά `{"status": ...}`, με ό,τι δεν βγήκε στο `status.probe.lastError`. `400` όταν κανένα δίκτυο δεν έχει ενεργοποιημένη τη διερεύνηση: αυτό το κουμπί δεν μπορεί να την ενεργοποιήσει, μόνο η εγκατάσταση.

## Ενσωματώσεις

Η ροή ρύθμισης για ένα είδος συσκευής στο οποίο ένας άνθρωπος στρέφει το HotLoop: ρωτά τι χρειάζεται η ενσωμάτωση, κοιτάζει την πραγματική συσκευή με τις απαντήσεις, και φτιάχνει τη συσκευή και τα tags της από ό,τι βρέθηκε. Δείτε [Ενσωματώσεις](/el/iot/integrations/).

**Τίποτα εδώ δεν οπλίζει τίποτα.** Κάθε tag που φτιάχνει μια ρύθμιση είναι μόνο για ανάγνωση. Ο οπλισμός ενός είναι `POST /api/tags` όπως κάθε άλλο σημείο.

### `GET /api/integrations`

Κάθε ενσωμάτωση που έχει αυτό το build, με τις ερωτήσεις που κάνει:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

Το `kind` είναι `text`, `number`, `bool`, `choice` ή `secret`. Ένα πεδίο με `showWhen` (`{"version":["3"]}`) ρωτιέται μόνο όταν άλλη απάντηση έχει μία από αυτές τις τιμές, και η απάντηση σε ερώτηση που δεν εμφανίζεται αγνοείται.

### `POST /api/integrations/{id}/probe`

Ελέγχει τις απαντήσεις και πηγαίνει να δει την πραγματική συσκευή. Δεν αποθηκεύει τίποτα.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Απαντά `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. Το `address` είναι η διεύθυνση όπως την επέλυσε η ενσωμάτωση. Το `found` έχει `name` (πώς λέει τον εαυτό της η συσκευή), `identity` (τι λέει ότι είναι), `notes` (πράγματα που πρέπει να ξέρετε πριν αποδεχτείτε) και `points`, καθένα σε μορφή tag `{name, address, dataType, unit, description, writable, deviceClass}` συν `group`, `sample` (ό,τι διάβασε όταν βρέθηκε) και `suggested`.

`400` για απαντήσεις που δεν ταιριάζουν στις ερωτήσεις, όλα τα προβλήματα μαζί· μια απάντηση σε ερώτηση που η ενσωμάτωση δεν κάνει είναι επίσης `400`, δεν αγνοείται. `502` όταν η συσκευή δεν απάντησε ή απάντησε με κάτι που δεν είναι το πρωτόκολλό της, με ό,τι πήγε στραβά. `404` για ενσωμάτωση που αυτό το build δεν έχει. Ένα μυστικό δεν υπάρχει ποτέ σε απάντηση ή σφάλμα.

### `POST /api/integrations/{id}/setup`

Κοιτάζει ξανά τη συσκευή και μετά τη δημιουργεί μαζί με τα tags της. Το σώμα είναι της διερεύνησης, συν:

| Πεδίο | Σημασία |
|---|---|
| `deviceId` | Το id της νέας συσκευής. Κενό παίρνει ένα από το όνομα. `400` αν το έχει συσκευή |
| `name` | Το όνομα της συσκευής. Κενό παίρνει ό,τι λέει για τον εαυτό της η συσκευή |
| `points` | Ονόματα από το `found.points` προς ρύθμιση. Κενό παίρνει όσα είναι σημειωμένα `suggested`. Ένα όνομα που δεν έχει η συσκευή είναι `400` |
| `site`, `area`, `line` | Πού πηγαίνει στο δέντρο εξοπλισμού, όπως στο `POST /api/devices` |

Τα σημεία ελέγχονται σε σχέση με τη συσκευή όπως είναι τώρα, όχι σε σχέση με ό,τι λέει ένας πελάτης ότι βρήκε πριν από ένα λεπτό. Απαντά `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Η συσκευή είναι ενεργοποιημένη και διαβάζεται, κάθε tag είναι μόνο για ανάγνωση, και κάθε tag έχει την οντότητα ανάγνωσής του. Μια ρύθμιση που αποτυγχάνει στη μέση δεν αφήνει καμία συσκευή.

## Brokers MQTT

Brokers εκτός από τον δικό του του HotLoop στους οποίους ακούει η ανακάλυψη: το Mosquitto ενός εργοστασίου, ο broker που έφερε μαζί του ένα κουτί Zigbee2MQTT. Δείτε [Ανακάλυψη MQTT](/el/iot/mqtt-discovery/#άλλοι-brokers). Οι κωδικοί τους σφραγίζονται με το κλειδί διαπιστευτηρίων συσκευής (`HOTLOOP_SECRET_KEY_FILE`) και δεν επιστρέφονται ποτέ· το `passwordSet` λέει αν υπάρχει αποθηκευμένος, και το `passwordProblem` γιατί ένας αποθηκευμένος δεν ανοίγει. Κάθε αλλαγή καταγράφεται και ισχύει αμέσως: ο ακροατής και οι συσκευές από αυτόν τον broker συνδέονται ξανά.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

Το `secretKey` είναι αν αυτό το HotLoop έχει κλειδί για να σφραγίσει έναν κωδικό.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

Το `id` είναι 1 έως 63 πεζά γράμματα, ψηφία και `-`, όχι `embedded`: ονομάζει τον broker σε κάθε συσκευή που προήλθε από αυτόν και δεν μπορεί να αλλάξει. Το `broker` είναι `host:port` ή URL `tcp://`, `ssl://`, `tls://`, `mqtt://` ή `mqtts://`, χωρίς login μέσα. Το `prefix` είναι από προεπιλογή `homeassistant`· το `autoCreate` false (οι συσκευές περιμένουν στα εισερχόμενα)· το `listenOnly` false· το `tasmota` (ακούει και την ανακάλυψη της ίδιας της Tasmota, `tasmota/discovery/#`) true· το `shelly` (μαθαίνει συσκευές Shelly Gen2 και μεταγενέστερες από τα topics `<prefix>/status/<component>` που δημοσιεύουν) true· το `enabled` true. Ένας κωδικός χρειάζεται όνομα χρήστη και κλειδί: χωρίς `HOTLOOP_SECRET_KEY_FILE` είναι `400`, ποτέ αποθηκευμένος σε καθαρό κείμενο. `201` με τον broker· `409` για id που είναι πιασμένο.

### `PUT /api/mqtt/brokers/{id}`

Οποιοδήποτε από τα παραπάνω πεδία εκτός του `id`· ό,τι δεν στέλνεται μένει. Το `"password":""` καθαρίζει τον κωδικό. `200` με τον broker.

### `DELETE /api/mqtt/brokers/{id}`

Αφαιρεί τον broker και ό,τι ανακοίνωσε και κανείς δεν αποδέχτηκε: τα εισερχόμενα και κάθε συσκευή που έφτιαξε μόνος του. `409` που τα κατονομάζει όσο υπάρχουν ακόμη συσκευές αποδεκτές από αυτόν: αγνοήστε ή διαγράψτε πρώτα εκείνες, ή απενεργοποιήστε τον broker με `"enabled":false`. `200` `{"deleted":"plant-uns"}`.

## Tags

### `GET /api/tags`

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `device` | Μόνο τα tags αυτής της συσκευής. Χωρίς `limit` απαντά με όλα |
| `q` | Αναζήτηση: υποσυμβολοσειρά, χωρίς διάκριση πεζών-κεφαλαίων, του id συσκευής, του ονόματος tag ή της περιγραφής. Λειτουργεί μαζί με το `device` |
| `limit` | Ένας ακέραιος από 1 έως 5000. Προεπιλογή 500 χωρίς `device`. Οτιδήποτε άλλο, και το 5001, είναι `400`: απορρίπτεται, δεν απαντιέται ποτέ με λιγότερα (μέχρι την 4.19.5 κάθε όριο πάνω από 1000 γινόταν σιωπηλά 200) |
| `writable` | `true` για μόνο τα tags που είναι σημειωμένα ως εγγράψιμα (αυτά που προσφέρουν οι επιλογείς εγγραφής) |
| `offset` | Πού ξεκινά η σελίδα, μηδέν ή περισσότερο. Τα tags ταξινομούνται ανά συσκευή και μετά ανά όνομα |

Η κεφαλίδα `X-Total-Count` της απάντησης λέει πόσα tags ταιριάζουν συνολικά, οπότε ένας πελάτης σελιδοποιεί με `offset` μέχρι να τα έχει και ξέρει ότι τα έχει. Μια κενή απάντηση είναι `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Δημιουργεί το tag αν τα `deviceId` και `name` είναι νέα, το αντικαθιστά αν όχι.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `deviceId` | string | Υποχρεωτικό. Η συσκευή πρέπει να υπάρχει (`404` αν όχι) |
| `name` | string | Υποχρεωτικό. Χωρίς χαρακτήρες ελέγχου |
| `address` | string | Υποχρεωτικό. Η δική του διεύθυνση του πρωτοκόλλου |
| `dataType` | string | `bool`, `int`, `float` ή `string` (και τα συνηθισμένα ψευδώνυμα: `int16`, `word`, `coil`...). Αποφασίζει πώς κωδικοποιείται μια εγγραφή |
| `unit`, `description` | string | |
| `enabled` | bool | Αν παραλειφθεί, είναι `false` |
| `writable` | bool | **Οπλίζει το tag για εγγραφή, από κάθε διαδρομή: UI, αυτοματισμοί, οντότητες, MCP.** Αν παραλειφθεί, είναι `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Με `hasRange`, μια εγγραφή εκτός εύρους απορρίπτεται (ποτέ δεν περικόπτεται) |
| `scale`, `offset` | number | μηχανικό μέγεθος = ακατέργαστο x κλίμακα + μετατόπιση. Μια κλίμακα 0 είναι 1 |
| `noData` | list | Ακατέργαστες τιμές που σημαίνουν «καμία μέτρηση», η καθεμία `{"raw", "reason"}`. Το `raw` είναι συμβολοσειρά (`"0x8005"`, `"-32763"`) ή γυμνός αριθμός, και επιστρέφει ως συμβολοσειρά. Μια ανάγνωση της οποίας η ακατέργαστη τιμή είναι στη λίστα έχει κακή ποιότητα με αυτό το `reason`, ελεγμένο πριν από τα `scale` και `offset`. Έως 32 κωδικοί. Ένας κωδικός που δεν είναι ακέραιος, αναφέρεται δύο φορές ή δεν μπορεί να είναι του τύπου του σημείου είναι `400`. Δείτε [Πρωτόκολλα και drivers](/el/iot/protocols/#no-data-values) για το τι να γράψετε για κάθε τύπο και το παράδειγμα Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Αλλαγές μικρότερες από αυτό δεν γράφονται στο ιστορικό |
| `deviceClass` | string | Η κλάση με την οποία ξεκινούν οι οντότητες του tag (`power`, `connectivity`, `temperature`...), όταν σημαίνει κάτι για τον τομέα τους. Λαμβάνεται όταν δημιουργείται το tag και αγνοείται σε αντικατάσταση: από εκεί και πέρα η οντότητα κατέχει την κλάση της, οπότε αλλάξτε τη εκεί |

Απαντά με το tag που αποθηκεύτηκε. Η αποθήκευση ενός με `writable: true` καταγράφεται ως τέτοια: ο οπλισμός ενός tag είναι απόφαση ασφάλειας και παίρνει όνομα δίπλα του. Οι οντότητες του tag δημιουργούνται ή ενημερώνονται πριν από την απάντηση, οπότε ένας πελάτης μπορεί να τις ζητήσει αμέσως.

Ένα tag σε ανακαλυφθείσα συσκευή που κανείς δεν έχει αποδεχτεί δεν μπορεί να οπλιστεί: `400`, «accept the device first». Δείτε [Ανακάλυψη MQTT](/el/iot/mqtt-discovery/#εντολές).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, ή `404`. Το ιστορικό μένει. Οι οντότητες του tag γίνονται ορφανές (δείτε [Οντότητες](/el/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Τιμές, ο πίνακας και εγγραφές

### `GET /api/values`

Η τελευταία ανάγνωση κάθε tag, από τη μνήμη. Το `?device=` το περιορίζει σε μία συσκευή.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Αυτή η μορφή είναι το `TagValue` του πίνακα ελέγχου EmberNet και είναι συμβόλαιο. Το `quality` είναι `good`, `uncertain` ή `bad`· **μια κακή ανάγνωση σημαίνει ότι η τιμή δεν είναι γνωστή, όχι ότι είναι μηδέν**. Μια ανάγνωση συμβολοσειράς φέρει `stringVal`, και το `tagValue` της δεν σημαίνει τίποτα.

Μια ανάγνωση που δεν είναι καλή φέρει `reason` όταν το driver ξέρει γιατί, ώστε μια οθόνη να μπορεί να πει περισσότερα από «κακή»:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Μια καλή ανάγνωση δεν το έχει ποτέ, οπότε το παραπάνω συμβόλαιο είναι byte προς byte αυτό που ήταν. Το historian δεν το κρατά: το `/api/history` έχει την ποιότητα, όχι τον λόγο.

### `GET /api/sparkline`

Οι τελευταίες αναγνώσεις ενός tag που κρατούνται στη μνήμη (`HOTLOOP_RING_SIZE`, 30 από προεπιλογή), για τα μικρά γραφήματα. `?tag=device/tag`, υποχρεωτικό.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

Τα `timestamps` είναι χιλιοστά του δευτερολέπτου Unix. Και τα δύο είναι `[]` για tag χωρίς αναγνώσεις. `400` για κακοσχηματισμένο κλειδί.

### `GET /api/board`

Ποια tags είναι καρφιτσωμένα στον πίνακα, και σε πόσες στήλες. Αποθηκεύεται στη βάση δεδομένων, όχι στον περιηγητή, επειδή ένας πίνακας ανήκει στο εργοστάσιο: ο υπολογιστής πάνελ στο πάτωμα και το φορητό στο γραφείο δείχνουν τον ίδιο.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

Το `rev` κατονομάζει τον πίνακα όπως είναι αποθηκευμένος. Στείλτε το πίσω με μια αποθήκευση και η αποθήκευση απορρίπτεται αν ο πίνακας έχει αλλάξει από τότε (παρακάτω).

### `PUT /api/board`

Η ίδια μορφή. Τα `columns` εκτός 1 έως 4 γίνονται 3· τα διπλότυπα αφαιρούνται. Το `rev` είναι προαιρετικό: με το `rev` του πίνακα που διαβάσατε, μια αποθήκευση πάνω σε πίνακα που έχει αλλάξει από τότε είναι `409` και δεν αλλάζει τίποτα, οπότε μια σελίδα που δεν διάβασε ποτέ τον πίνακα, ή διάβασε παλιό, δεν μπορεί να αντικαταστήσει αυτόν του εργοστασίου με το αντίγραφό της. Αν το παραλείψετε, η αποθήκευση δεν ελέγχεται, κάτι που ταιριάζει σε πελάτη που ορίζει όλον τον πίνακα κάθε φορά. Το web UI διαβάζει τον πίνακα όταν ξεκινά και στέλνει το `rev` με κάθε αποθήκευση. Κάθε tag πρέπει να υπάρχει (`404` που κατονομάζει αυτό που δεν υπάρχει): μια παλιά εγγραφή είναι ένδειξη που δεν κινείται ποτέ. Απαντά με τον πίνακα όπως αποθηκεύτηκε. Οι χειριστές έχουν `board.write`: η τακτοποίηση του πίνακα είναι λειτουργία του εργοστασίου, όχι ρύθμισή του.

### `POST /api/write`

Γράφει μία τιμή σε ένα tag, μέσω της πύλης εγγραφής.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `tag` | string | Υποχρεωτικό. `device/tag` |
| `value` | bool, number or string | Υποχρεωτικό. Το `true` είναι bool, το `42` ακέραιος, το `42.5` float, το `"42"` συμβολοσειρά: ο τύπος JSON είναι ο τύπος που γράφεται, επειδή ένα coil, μια λέξη και ένας πραγματικός είναι τρία διαφορετικά πράγματα στο καλώδιο |
| `reason` | string | Προαιρετικό. Καταγράφεται με την εγγραφή |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Μια τιμή είναι στις μονάδες του tag, όπως μια ανάγνωση.** Σε tag με κλίμακα ή μετατόπιση, ό,τι στέλνετε είναι ό,τι θα διάβαζε πίσω το tag, και το HotLoop στέλνει στη συσκευή το πλήθος που το δίνει: το 55.5 σε καταχωρητή με κλίμακα 0.1 βάζει 555 στον καταχωρητή. (Μέχρι την 4.18, ο αριθμός πήγαινε στη συσκευή όπως ήταν, οπότε το 55.5 γινόταν 55 και διαβαζόταν ως 5.5.) Ο έλεγχος εύρους και η γραμμή ελέγχου χρησιμοποιούν τον αριθμό σας, στις μονάδες του tag. Ένα πλήθος που μετά δεν χωρά στον καταχωρητή, όπως το 7000 σε `uint16` με κλίμακα 0.1, απορρίπτεται με το πλήθος και τον καταχωρητή κατονομασμένα, και τίποτα δεν στέλνεται. Ένα κλάσμα πλήθους κόβεται, όπως πάντα έκανε ένας καταχωρητής ακέραιου πλήθους: το 12.34 σε καταχωρητή κλίμακας δεκάτων κρατά 12.3.

Η πύλη ελέγχει, με τη σειρά, ότι οι εγγραφές είναι ενεργοποιημένες (`HOTLOOP_ALLOW_WRITES`), ότι το tag είναι οπλισμένο και ότι η τιμή είναι εντός εύρους. Κάθε προσπάθεια, απορριφθείσα ή όχι, είναι στο `GET /api/writes`.

| Κατάσταση | Πότε |
|---|---|
| 400 | Καμία τιμή, τιμή `null`, κακοσχηματισμένο κλειδί |
| 403 | Οι εγγραφές είναι απενεργοποιημένες, ή `"tank-farm/level: this tag is not marked writable"` |
| 404 | Δεν υπάρχει τέτοιο tag |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Η συσκευή δεν είναι συνδεδεμένη |

## Ιστορικό και έλεγχος

### `GET /api/history`

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `tag` | Υποχρεωτικό, επαναλαμβανόμενο, έως 50: `?tag=a/x&tag=b/y` |
| `minutes` | Πόσο πίσω από τώρα. Προεπιλογή 60 |
| `bucket` | Μέγεθος διαστήματος σε δευτερόλεπτα. Προεπιλογή: επιλέγεται ώστε το παράθυρο να έχει περίπου 400 διαστήματα, σε κλίμακα από 1 s έως 1 ημέρα |
| `raw` | `true` για τις ίδιες τις αναγνώσεις αντί για διαστήματα |
| `limit` | Προεπιλογή 5000, το πολύ 100000 |
| `carry` | `true` για να λέει επίσης τι κρατούσε κάθε tag όταν ξεκίνησε το παράθυρο (μόνο διαστήματα) |

Σε διαστήματα, τα παλαιότερα πρώτα ανά tag. Το `badCount` είναι πόσες αναγνώσεις στο διάστημα δεν ήταν καλής ποιότητας· μετριούνται, δεν υπολογίζονται στον μέσο όρο. Τα `from` και `to` είναι το παράθυρο στο οποίο αφορά η απάντηση, ακριβώς `minutes` μακριά και που τελειώνει όταν τέθηκε η ερώτηση:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

Το historian κρατά μια ανάγνωση όταν μια τιμή περνά πέρα από τη νεκρή ζώνη της, όχι σε κάθε ανάγνωση, οπότε ένα tag που έμεινε ακίνητο δεν έχει τίποτα στο παράθυρο να σχεδιαστεί. Με `carry=true` η απάντηση έχει επίσης `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: την τελευταία ανάγνωση πριν από το `from`, για κάθε tag του οποίου η τελευταία προηγούμενη ανάγνωση ήταν καλή και είχε αριθμό. Ένα tag του οποίου η τελευταία ανάγνωση ήταν κακή ή αβέβαιη, που δεν έχει προηγούμενη ανάγνωση ή που είναι κείμενο, δεν έχει εγγραφή, επειδή ό,τι κρατούσε δεν είναι γνωστό και δεν θα δώσουμε σε ένα γράφημα μια εικασία. Η κάρτα τάσης σχεδιάζει από αυτό.

Ακατέργαστα, τα νεότερα πρώτα:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` χωρίς `tag`, με περισσότερα από 50, ή με κακοσχηματισμένο κλειδί.

### `GET /api/writes`

Ο έλεγχος εγγραφών, τα νεότερα πρώτα. Κάθε προσπάθεια είναι εδώ, και οι απορριφθείσες, επειδή το «δεν ξέρουμε αν αυτή η εντολή βγήκε» είναι η χειρότερη απάντηση που μπορεί να πάρει ένα εργοστάσιο.

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `tag` | Ένα tag, `device/tag` |
| `device` | Κάθε tag μιας συσκευής (αγνοείται αν οριστεί `tag`) |
| `entity` | Κάθε εγγραφή που έκανε ή είδε να απορρίπτεται μια κλήση υπηρεσίας σε αυτήν την οντότητα, αντί για τα παραπάνω |
| `call` | Κάθε εγγραφή μιας κλήσης, αντί για όλα τα παραπάνω: το πάτημα και η απελευθέρωση ενός κουμπιού, ή κάθε στόχος της εφαρμογής μιας συνταγής, που μοιράζονται το `call_id` τους |
| `limit` | Προεπιλογή 100, το πολύ 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

Το `source` είναι `ui`, `api`, `automation` ή `mcp`. Τα `entityId`, `service` και `callId` υπάρχουν μόνο σε εγγραφές που έκανε μια κλήση υπηρεσίας.

## Οντότητες και καταστάσεις

Κάθε tag παίρνει οντότητες χωρίς να το ζητήσει κανείς· τα σύνθετα (κινητήρες, βαλβίδες, βρόχοι, μετρητές, επιλογείς, κουμπιά, μετεωρολογικοί σταθμοί) τα χτίζει από tags ένας διαχειριστής. Σε snake_case, όπως κάθε endpoint οντοτήτων. Ολόκληρο το μοντέλο βρίσκεται στις [Οντότητες](/el/iot/entities/).

### `GET /api/entities`

Κάθε οντότητα, και οι ορφανές.

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Οντότητες σε μία συσκευή |
| `orphaned` | `true` για μόνο τις ορφανές, `false` για καμία |
| `q`, `limit` | Αναζήτηση: υποσυμβολοσειρά, χωρίς διάκριση πεζών-κεφαλαίων, του id οντότητας, του ονόματος ή του id συσκευής, και το πολύ `limit` από αυτές (1 έως 5000, οτιδήποτε άλλο είναι `400`, ποτέ δεν κόβεται σιωπηλά) ταξινομημένες κατά id οντότητας. Το `X-Total-Count` είναι πόσες ταίριαξαν. Αν παραλειφθούν, η λίστα είναι ολόκληρη |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Τι μπορεί να δημιουργήσει το `POST /api/entities`: κάθε τομέας, οι ρόλοι στους οποίους δένονται τα tags του και οι υπηρεσίες που δέχεται. Ένας ρόλος λέει το `kind` του tag, αν είναι `required`, αν μια υπηρεσία τον γράφει (`command`) και αν η κατάσταση διαβάζεται από αυτόν (`feedback`). Ένας μετεωρολογικός σταθμός δεν δέχεται υπηρεσία.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. Το `state` είναι `null` για απενεργοποιημένη οντότητα. `404` για άγνωστη.

### `GET /api/entities/{entity_id}/image`

Η τελευταία εικόνα μιας κάμερας ή μιας εικόνας, ως τα byte που κρατά το HotLoop: το `Content-Type` είναι αυτό που είναι (`image/jpeg`, `image/png`, `image/gif` ή `image/webp`), με `X-Content-Type-Options: nosniff`, μια απομονωτική `Content-Security-Policy` και ένα `ETag` (το `If-None-Match` παίρνει `304`). `404` για οντότητα που δεν είναι τέτοια, ή πριν φτάσει εικόνα. Το χαρακτηριστικό `entity_picture` της κατάστασης είναι αυτή η διαδρομή με το hash της εικόνας.

### `PUT /api/entities/{entity_id}`

Αλλάζει μόνο τα πεδία που στέλνετε. Μόνο για διαχειριστές: το entity_id είναι το όνομα με το οποίο κάθε αυτοματισμός, πίνακας ελέγχου και πράκτορας αναφέρεται στην οντότητα, και η αλλαγή του είναι ρύθμιση.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `entity_id` | string | Μετονομασία. Το `unique_id` δεν μετακινείται |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Ανά τομέα· δείτε [Οντότητες](/el/iot/entities/#api) |
| `disabled`, `hidden` | bool | Μια απενεργοποιημένη οντότητα δεν έχει κατάσταση και δεν μπορεί να δεχτεί εντολές |
| `equipment_id` | int or null | Την τοποθετεί στο δέντρο· το `null` ακολουθεί ξανά τη συσκευή της |
| `labels` | string[] | Ολόκληρο το σύνολο |

Τα `unique_id`, `domain`, `platform`, η συσκευή και οι δεσμεύσεις δεν αλλάζουν εδώ, και η αποστολή τους είναι 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

Το `warnings` λέει πότε κάτι είναι νόμιμο αλλά περίεργο (μια μονάδα που η κλάση συσκευής συνήθως δεν έχει). `400` για κενό σώμα (`"the update names no field to change"`) ή κακή τιμή, `404` για άγνωστη οντότητα, `409` για entity_id που είναι πιασμένο.

### `POST /api/entities`

Δημιουργεί μια σύνθετη οντότητα. Το σώμα κατονομάζει τον τομέα και δένει tags στους ρόλους του:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Επίσης `entity_id` (αλλιώς παράγεται από το όνομα), `device_class`, `unit_of_measurement`, `icon`, `entity_category` και `options`. Ποιους ρόλους και ποιες επιλογές παίρνει κάθε τομέας βρίσκεται στις [Οντότητες](/el/iot/entities/#composite-equipment). Απαντά `201` `{"entity": {...}, "warnings": [...]}`. `400` για τομέα που δεν δημιουργείται εδώ (ένα `sensor` προέρχεται από το tag του, ένα `alarm` από τον ορισμό του), ρόλο που λείπει ή tag που δεν μπορεί να τον καλύψει, `409` για entity_id που είναι πιασμένο.

### `DELETE /api/entities/{entity_id}`

Διαγράφει μια σύνθετη οντότητα, ή μια ορφανή της οποίας το tag ή ο ορισμός συναγερμού έχει φύγει. `{"deleted":"motor.transfer_pump","entity":{...}}`. Οτιδήποτε άλλο απαντά `409` λέγοντας πώς όντως φεύγει:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Η κατάσταση κάθε ενεργοποιημένης οντότητας, ταξινομημένη κατά entity_id. Το `?domain=` φιλτράρει.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

Το `state` είναι πάντα συμβολοσειρά, ακόμη και για αριθμό· τα `unknown` και `unavailable` σημαίνουν ό,τι λένε. Το `last_reported` είναι η χρονοσφραγίδα της συσκευής για την ανάγνωση πίσω από αυτό.

### `GET /api/states/{entity_id}`

Μία κατάσταση. `404` για άγνωστη οντότητα, και διαφορετικό `404` για απενεργοποιημένη, που λέει πώς να ενεργοποιηθεί: μια απενεργοποιημένη οντότητα δεν λείπει, και η αναφορά της ως ελλείπουσας στέλνει κάποιον να ψάξει για ένα τυπογραφικό.

## Ενέργεια

Τι χρησιμοποιεί το εργοστάσιο και τι κοστίζει: κιλοβατώρες, αέριο, νερό, πεπιεσμένος αέρας, και το κόστος μιας παραχθείσας μονάδας. Ένας μετρητής είναι ένα tag που διαβάζεται ως ποσότητα που χρησιμοποιήθηκε. Ολόκληρο το μοντέλο, τα τιμολόγια και τι κάνει η οθόνη βρίσκονται στην [Ενέργεια](/el/iot/energy/). Η ανάγνωση είναι `energy.read`, που το έχουν όλοι οι ρόλοι· η δημιουργία ή αλλαγή μετρητή ή τιμολογίου είναι `energy.write`, ενός διαχειριστή.

### `GET /api/energy/meters`

Κάθε μετρητής, ανά είδος και μετά ανά όνομα, ο καθένας με το πώς διαβάζεται και τι χρησιμοποίησε σήμερα.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

Το `status.state` είναι `ok`, `waiting` (δεν έχει διαβαστεί ακόμη τίποτα από το tag), `bad` (η ανάγνωση του tag δεν είναι καλή, και το `reason` λέει γιατί) ή `disabled`.

### `POST /api/energy/meters`

Δημιουργεί έναν μετρητή. Το `id` είναι πεζά γράμματα, ψηφία, `-` και `_`. Το `kind` είναι `electricity`, `gas`, `water`, `air`, `heat` ή `production`. Το `mode` είναι `counter` (ένα σωρευτικό tag: ό,τι χρησιμοποιήθηκε είναι πόσο μετακινήθηκε, επί `factor`) ή `power` (ένας ρυθμός: ό,τι χρησιμοποιήθηκε είναι ο ρυθμός επί τον χρόνο που κρατήθηκε, με `power_unit` `W`, `kW` ή `MW`, και `unit` `Wh`, `kWh` ή `MWh`). Το `source` είναι το tag. Το `tariff` είναι μια σταθερή `price` ανά μονάδα με προαιρετικό `currency`, και προαιρετικά `bands` (`from` και `to` σε τέταρτο της ώρας, `days`, `price`) για τιμολόγιο ζωνών ώρας· ένας μετρητής παραγωγής δεν έχει. Ένας μετρητής ηλεκτρισμού σε `Wh`, `kWh` ή `MWh` μπορεί να έχει και `demand_price` στο τιμολόγιο: τι κοστίζει ένα κιλοβάτ του υψηλότερου τετάρτου της ώρας του σε ένα παράθυρο. Αν παραλειφθεί το `enabled`, είναι `true`. `201` με `{"meter": {...}, "warnings": []}`. `400` που λέει τι φταίει: το tag δεν υπάρχει ή δεν είναι αριθμός, μια ζώνη δεν είναι σε τέταρτο της ώρας, ένας μετρητής ισχύος με συντελεστή. `409` για id που είναι πιασμένο.

### `GET /api/energy/meters/{id}`

Ένας μετρητής, όπως τον δείχνει η λίστα. `404` για άγνωστο.

### `PUT /api/energy/meters/{id}`

Αντικαθιστά τον ορισμό ενός μετρητή. Ό,τι έχει ήδη μετρήσει μένει, και κρατά την τιμή στην οποία έγινε. Η στόχευσή του σε άλλο tag ή τρόπο ξεχνά πού σταμάτησε η τελευταία ανάγνωση, επειδή η επόμενη ανάγνωση είναι για κάτι άλλο.

### `DELETE /api/energy/meters/{id}`

Αφαιρεί έναν μετρητή και ό,τι έχει μετρήσει. `404` για άγνωστο.

### `GET /api/energy/summary`

Η χρήση και το κόστος κάθε μετρητή σε ένα παράθυρο, και το κόστος μιας παραχθείσας μονάδας. Το παράθυρο είναι `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, ή μια βάρδια γραμμένη `shift:06:00-14:00` για την τελευταία που ξεκίνησε και `last_shift:06:00-14:00` για την προηγούμενη· οι ημέρες, οι μήνες και οι βάρδιες είναι της τοποθεσίας) ή `?from=&to=` ως RFC 3339, με το from συμπεριλαμβανόμενο και το to όχι, το πολύ 400 ημέρες. Το `meters` είναι λίστα χωρισμένη με κόμματα των μετρητών των οποίων το κόστος μπαίνει στο κόστος ανά μονάδα, και το `per` κατονομάζει τον έναν μετρητή παραγωγής με τον οποίο θα διαιρεθεί.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

Το `coverage` είναι το μερίδιο του παραθύρου μέχρι τώρα που στηρίζουν οι αναγνώσεις. Κόστη σε δύο νομίσματα δεν προστίθενται ποτέ, οπότε υπάρχει γραμμή `per_unit` για καθένα. Το `cost_per_unit` είναι `null` όταν δεν παρήχθη τίποτα (το `reason` είναι `nothing_made`) ή όταν παρήχθησαν πράγματα και κανένας μετρητής με τιμή δεν έχει μετρήσει ακόμη χρήση (`nothing_counted`): αυτό δεν είναι απάντηση, δεν είναι μηδέν.

Ένας μετρητής με `demand_price` έχει ένα `demand` στη γραμμή του: `peak_kw` (το υψηλότερο τέταρτο της ώρας του παραθύρου, ως τα κιλοβάτ που είχε κατά μέσο όρο), `peak_at` (πότε ξεκίνησε), `peak_covered_seconds` (πόσο από αυτό το τέταρτο διαβάστηκε· κάτω από 900 η αιχμή υποτιμάται) και `cost` (η αιχμή επί την τιμή). Το `cost` της γραμμής μένει ό,τι κόστισε η ενέργεια· τα `costs` και `per_unit` περιλαμβάνουν τη χρέωση ισχύος.

### `GET /api/energy/summary/{period}`

Το ίδιο με τη σύνοψη, για μία επώνυμη περίοδο (ή βάρδια) που δίνεται στη διαδρομή. Τα `meters` και `per` πηγαίνουν και πάλι στο ερώτημα.

### `GET /api/energy/series`

Η χρήση ενός μετρητή σε ένα παράθυρο, `?meter=<id>`, το παράθυρο όπως παραπάνω, και `step`: `quarter` (το πολύ 8 ημέρες), `hour` (η προεπιλογή), `day` ή `month`. Ένα βήμα χωρίς αναγνώσεις δεν υπάρχει στη λίστα.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Το ίδιο με τη σειρά, με τον μετρητή, την επώνυμη περίοδο και το βήμα στη διαδρομή, για καλούντα που έχει μόνο μια διαδρομή να δώσει.

## Υπηρεσίες

### `POST /api/services/{domain}/{service}`

Δίνει εντολή σε μία οντότητα: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Μία οντότητα, μία υπηρεσία, μία κλήση. Από κάτω δεν είναι τίποτα άλλο από εγγραφές tag μέσω της ίδιας πύλης εγγραφής με το `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

Το `entity_id` είναι υποχρεωτικό και είναι μία οντότητα, όχι λίστα· το `reason` είναι προαιρετικό· όλα τα υπόλοιπα είναι τα δεδομένα της υπηρεσίας (`value`, `option`, `position`, `mode`, `minutes`, `note`). Οι αριθμοί κρατούν τον τύπο με τον οποίο πληκτρολογήθηκαν. Ο τομέας στη διαδρομή πρέπει να είναι της οντότητας. Κάθε υπηρεσία και τα δεδομένα της βρίσκονται στις [Οντότητες](/el/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Κάθε εγγραφή είναι `written`, `not_sent` (απορρίφθηκε πριν φτάσει στη συσκευή), `failed` (βγήκε και η συσκευή ανέφερε σφάλμα, οπότε δεν είναι γνωστό αν έπιασε) ή `skipped` (μια προηγούμενη εγγραφή της κλήσης δεν πέτυχε). Οι εγγραφές που έχουν ήδη γίνει δεν αναιρούνται ποτέ. Οι υπηρεσίες μιας οντότητας συναγερμού δεν γράφουν κανένα tag και απαντούν με το `alarm` όπως το άφησε η μηχανή. Αυτές ενός helper δεν γράφουν ούτε αυτές κανένα tag και απαντούν με το `state` στο οποίο το άφησαν:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

Το `turn_on` ενός script το τρέχει, με τα δεδομένα ως πεδία του, και απαντά με το `script_run` που ξεκίνησε· οι εγγραφές των βημάτων του ελέγχονται μία μία ως `script:<id>`, όχι εδώ. Το `turn_off` σταματά κάθε εκτέλεσή του. Δείτε [Scripts](#scripts).

Το `turn_on` μιας σκηνής εφαρμόζει τη συνταγή της, με `params` και `version` από τα δεδομένα, και απαντά με ολόκληρη την `recipe_application` και, στο `writes`, κάθε εγγραφή που έκαναν οι στόχοι της, με τη σειρά. Αποτυγχάνει εκτός αν γράφτηκαν όλοι οι στόχοι. Δείτε [Συνταγές](#συνταγές).

Μια αποτυχημένη κλήση απαντά με την κατάσταση του σφάλματος και το ίδιο σώμα συν `error`, ώστε να φαίνεται ακριβώς πού σταμάτησε:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Κατάσταση | Πότε |
|---|---|
| 400 | Χωρίς `entity_id`, λάθος τομέας, άγνωστη υπηρεσία, δεδομένα που η υπηρεσία δεν δέχεται |
| 403 | Το δικαίωμα, ή η πύλη απέρριψε βάσει πολιτικής |
| 404 | Δεν υπάρχει τέτοια οντότητα |
| 409 | Εναλλαγή χωρίς γνωστή κατάσταση, εξοπλισμός σε λάθος κατάσταση για την υπηρεσία |
| 422 | Τιμή που απορρίφθηκε επί της ουσίας |
| 503 | Η συσκευή δεν είναι συνδεδεμένη· η μηχανή συναγερμών δεν τρέχει |
| 500 | Το πάτημα ενός κουμπιού βγήκε και η απελευθέρωσή του όχι. **Το tag μπορεί ακόμη να κρατά την τιμή πατήματος**: ελέγξτε το και αφήστε το με το χέρι |

**Το `?dry_run=true`** ρωτά τι θα έκανε η κλήση και δεν κάνει τίποτα από αυτά: τίποτα δεν γράφεται, δεν ελέγχεται ούτε καταγράφεται. Η κλήση σχεδιάζεται όπως η πραγματική και κάθε εγγραφή υποβάλλεται στους ελέγχους της ίδιας της πύλης, με την ίδια σειρά, αυτή τη στιγμή. Μια ετυμηγορία απαντά 200, απορριφθείσα ή όχι: κάθε εγγραφή `would_write`, ή η πρώτη που θα απορριπτόταν `not_sent` με τον λόγο και οι υπόλοιπες `skipped`, και το `error` είναι το σφάλμα με το οποίο θα αποτύγχανε η πραγματική κλήση, λέξη προς λέξη.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Ένα αίτημα που η πραγματική κλήση θα απέρριπτε πριν από οποιονδήποτε έλεγχο (δεν υπάρχει τέτοια οντότητα, άγνωστη υπηρεσία, δεδομένα που η υπηρεσία δεν δέχεται, εναλλαγή χωρίς γνωστή κατάσταση) απαντά με την κατάσταση και το σφάλμα της πραγματικής κλήσης· το ίδιο και η έλλειψη δικαιώματος. Το `dry_run` είναι `true` ή `false` και τίποτα άλλο: το `yes` είναι 400, όχι εικασία, επειδή η λάθος εικασία μετατρέπει μια ερώτηση σε εντολή. Δείτε [Οντότητες](/el/iot/entities/#asking-first-the-dry-run).

**Γιατί το δικαίωμα ελέγχεται στον handler.** Χρειάζεται `values.write`, το ίδιο με την απευθείας εγγραφή του tag, επειδή αυτό είναι το μόνο που είναι· οι υπηρεσίες μιας οντότητας `alarm` χρειάζονται αντί γι' αυτό `alarms.ack`, το ίδιο με την οθόνη συναγερμών, αυτές ενός helper χρειάζονται `helpers.write`, που το έχει ένας χειριστής, αυτές ενός script χρειάζονται `scripts.run`, το ίδιο με το `POST /api/scripts/{id}/run`, και αυτές μιας σκηνής χρειάζονται `recipes.apply` και το δικό της δικαίωμα της συνταγής όταν κατονομάζει ένα, το ίδιο με το `POST /api/recipes/{id}/apply`. Ο έλεγχος γίνεται μέσα στον handler και όχι μπροστά του ώστε μια άρνηση λόγω έλλειψής του να σταλεί στην πύλη εγγραφής και να **ελεγχθεί έναντι της οντότητας** όπως κάθε άλλη άρνηση, με την τιμή που ζητήθηκε. Ένας χρήστης χωρίς το δικαίωμα παίρνει 403 και μια γραμμή στο `GET /api/writes?entity=...`, όχι 403 και τίποτα. Ένας helper δεν γράφει κανένα tag, οπότε η άρνηση για έναν helper, και αυτή, είναι αντί γι' αυτό προειδοποίηση στο αρχείο καταγραφής συστήματος (`GET /api/events`) έναντι του helper, και το ίδιο για ένα script. Η άρνηση για μια σκηνή είναι μια απορριφθείσα εφαρμογή στο ιστορικό της συνταγής, με τον χρήστη επάνω.

## Βοηθοί

Τιμές που ανήκουν στους ανθρώπους του εργοστασίου και όχι σε ένα PLC: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` και `schedule`. Ένας βοηθός είναι οντότητα (πλατφόρμα `helper`) και εμφανίζεται στα `/api/entities` και `/api/states` όπως κάθε άλλη· αυτές οι διαδρομές είναι η ρύθμισή του. Η τιμή του ορίζεται μέσω των υπηρεσιών παραπάνω, με `helpers.write`. Κάθε τομέας, επιλογή και υπηρεσία περιγράφεται στους [Βοηθούς](/el/iot/helpers/).

### `GET /api/helpers`

Κάθε βοηθός, με τα πεδία της οντότητάς του και το `value`, τη γραμμή που είναι αποθηκευμένη γι' αυτόν:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Δημιουργεί έναν βοηθό με την αρχική του τιμή. Μόνο για διαχειριστές.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Επίσης `entity_id` (αλλιώς παράγεται από το όνομα) και `icon`. Απαντά `201` `{"helper": {...}}`. `400` για τομέα που δεν είναι βοηθού, επιλογή που ο τομέας δεν δέχεται ή `initial` που οι ίδιες οι επιλογές του θα απέρριπταν· `409` για entity_id που χρησιμοποιείται ήδη.

### `GET /api/helpers/{entity_id}`

Ένας βοηθός, όπως στη λίστα. `404` για άγνωστη οντότητα ή για μια που δεν είναι βοηθός.

### `PUT /api/helpers/{entity_id}`

Αλλάζει τα `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` ή `labels`, τα ίδια πεδία με το `PUT /api/entities/{entity_id}`. Μόνο για διαχειριστές. Νέες επιλογές που δεν θα επέτρεπαν την τιμή που κρατά τώρα (ένα εύρος που στένεψε πέρα από αυτήν, αφαιρέθηκε η επιλεγμένη τιμή) δίνουν `400`: μια τιμή δεν μετακινείται ποτέ για να ταιριάξει. Απαντά `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Διαγράφει τον βοηθό και την τιμή του. Μόνο για διαχειριστές. `{"deleted":"timer.purge"}`. Το `DELETE /api/entities/{entity_id}` αρνείται έναν βοηθό με `409` που δείχνει εδώ.

## Εξοπλισμός και ετικέτες

Το δέντρο ISA-95 (επιχείρηση, τοποθεσία, περιοχή, γραμμή, κελί, μονάδα, εξοπλισμός) και οι ελεύθερες ετικέτες. Σε snake_case. Όλοι οι ρόλοι διαβάζουν· μόνο ένας διαχειριστής αλλάζει, επειδή η μετονομασία ή η μετακίνηση ενός κόμβου ξαναγράφει την τοποθεσία, την περιοχή και τη γραμμή κάθε συσκευής από κάτω του. Δείτε [το δέντρο εξοπλισμού και τις ετικέτες](/el/iot/equipment/).

### `GET /api/equipment`

Κάθε κόμβος, ταξινομημένος κατά id, με το `path` των ονομάτων από τη ρίζα. Το `?level=area` φιλτράρει. Το `?q=` κρατά τους κόμβους των οποίων η διαδρομή περιέχει το κείμενο (χωρίς διάκριση πεζών και κεφαλαίων), το `?limit=` (1 έως 5000, οτιδήποτε άλλο είναι `400`) τους πρώτους από αυτούς· με όποιο από τα δύο, το `X-Total-Count` είναι πόσοι ταίριαξαν.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

Το `parent_id` null ή παραλειμμένο δημιουργεί ρίζα. Ένα παιδί πρέπει να είναι χαμηλότερου επιπέδου από τον γονέα του (ένας εξοπλισμός μπορεί να βρίσκεται μέσα σε έναν εξοπλισμό). Απαντά `{"equipment": {...}, "devices_rewritten": []}`. `400` για λάθος επίπεδο ή θέση, `409` για αδελφό με το ίδιο επίπεδο και όνομα.

### `GET /api/equipment/{id}`

Ο κόμβος, οι κόμβοι ακριβώς κάτω από αυτόν, και οι συσκευές και οι οντότητες που βρίσκονται απευθείας πάνω του:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` για id που δεν είναι θετικός αριθμός, `404` για άγνωστο.

### `PUT /api/equipment/{id}`

Οποιοδήποτε από τα `name`, `description`, `level`, `parent_id` (το `null` τον μετακινεί στη ρίζα). Αλλάζουν μόνο τα πεδία που στέλνονται· ένα κενό σώμα είναι 400. Απαντά τον κόμβο και **κάθε συσκευή της οποίας το κείμενο τοποθεσίας, περιοχής ή γραμμής άλλαξε ως συνέπεια**, επειδή αυτό το κείμενο διαβάζουν οι παλαιότεροι πελάτες και τα εργαλεία MCP:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` όσο υπάρχει κάτι από κάτω του ή πάνω του, λέγοντας τι: η διαγραφή ενός κόμβου κάτω από τα πόδια μιας συσκευής δεν είναι απόφαση που παίρνεται τυχαία.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

Το `name` είναι υποχρεωτικό· το `label_id` (1 έως 64 πεζά γράμματα, ψηφία και κάτω παύλες) παράγεται από το όνομα αν παραλειφθεί και δεν αλλάζει ποτέ μετά. Τα `color`, `icon` (`mdi:...`) και `description` είναι προαιρετικά. Απαντά την ετικέτα. `409` για όνομα ή id που χρησιμοποιείται ήδη.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: η ετικέτα και ό,τι τη φέρει. `404` για άγνωστη.

### `PUT /api/labels/{label_id}`

Αντικαθιστά τα `name`, `color`, `icon` και `description`· ένα πεδίο που παραλείπεται καθαρίζεται. Ένα `label_id` στο σώμα πρέπει να ταιριάζει με τη διαδρομή: αλλιώς `400`, επειδή ένα label_id δεν αλλάζει ποτέ.

### `DELETE /api/labels/{label_id}`

Την αφαιρεί από ό,τι τη φέρει. `{"deleted":"critical"}`, ή `404`.

### `PUT /api/devices/{id}/labels`

Το `{"labels": ["critical"]}` αντικαθιστά ολόκληρο το σύνολο μιας συσκευής. Απαντά `{"id":"tank-farm","labels":["critical"]}`. Κάθε ετικέτα πρέπει να υπάρχει (`400` με τα ονόματα όσων λείπουν), και η συσκευή επίσης (`404`). Οι ετικέτες δεν είναι μέρος του `POST /api/devices` επίτηδες: κάθε πελάτης που αποθηκεύει μια συσκευή στέλνει ολόκληρη τη συσκευή χωρίς αυτές, και θα τις έσβηνε σε κάθε αποθήκευση.

## Συναγερμοί

ISA-18.2: η ενεργοποίηση, η αναγνώριση και η επιστροφή στο φυσιολογικό είναι διαφορετικά πράγματα, και το αρχείο μπορεί να πει ποιο από αυτά συνέβη.

### `GET /api/alarms`

Κάθε ορισμός, οι ζωντανοί συναγερμοί και η σύνοψη. Το `?outstanding=true` αφήνει έξω τους φυσιολογικούς και τους σιωπηλούς.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

Το `state` είναι `normal`, `unack-active`, `ack-active`, `rtn-unack` (επέστρεψε στο φυσιολογικό πριν τον αναγνωρίσει κανείς, και μένει στη λίστα ώστε μια ενεργοποίηση στις 3 τα ξημερώματα να μην χαθεί πριν τη δει η πρωινή βάρδια), `shelved` ή `suppressed`. Το `tripValue` είναι η ένδειξη που τον ενεργοποίησε, όχι η τρέχουσα.

### `POST /api/alarms`

Δημιουργεί ή αντικαθιστά έναν ορισμό.

| Πεδίο | Τύπος | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|---|
| `id`, `name` | string | Υποχρεωτικό. Το `id` ακολουθεί τους κανόνες των id συσκευών |
| `deviceId`, `tagName` | string | Υποχρεωτικό |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (καμία ένδειξη για `limit` δευτερόλεπτα), `roc` (ρυθμός μεταβολής πάνω από `limit` ανά δευτερόλεπτο) |
| `limit` | number | |
| `priority` | int | Από 1 (κρίσιμος) έως 4 (χαμηλός) |
| `enabled` | bool | Αν παραλειφθεί, είναι `false` |
| `deadband` | number | Πόσο πίσω πρέπει να έρθει η τιμή πριν αποκατασταθεί ο συναγερμός. Χωρίς νεκρή ζώνη, μια τιμή που κάθεται πάνω στο όριο τρεμοπαίζει |
| `onDelaySec`, `offDelaySec` | int | Πόση ώρα πρέπει να ισχύει η συνθήκη πριν ενεργοποιηθεί ο συναγερμός, ή να λείπει πριν επιστρέψει στο φυσιολογικό |
| `message`, `description` | string | Το `message` δέχεται `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` και `{reason}` (γιατί η ένδειξη είναι κακή, κενό όταν είναι καλή) |

Το `{value}` γράφεται όπως το γράφει η κάρτα τιμής, με τη μονάδα: οι ακέραιοι όπως είναι, δύο δεκαδικά από το 1 και πάνω, ένα από το 100 και πάνω, τέσσερα κάτω από το 1, και επιστημονική γραφή πάνω από δέκα εκατομμύρια ή κάτω από 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Το κάναμε έτσι επειδή ένα tag με κλίμακα 0.1 και ακατέργαστη τιμή 82 είναι 8.200000000000001 ως float, και το banner το έγραφε έτσι. Μια ένδειξη κειμένου λέγεται όπως είναι. Το tag, οι εγγραφές και οι αυτοματισμοί βλέπουν ακόμα τον ακριβή αριθμό· στρογγυλοποιείται μόνο η πρόταση. Το `{limit}` είναι το όριο όπως το πληκτρολογήσατε.

Απαντά τον ορισμό· η μηχανή φορτώνει ξανά και η οντότητα του συναγερμού δημιουργείται πριν από την απάντηση. `400` σε αποτυχία επικύρωσης (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Διαβάζει από το σώμα του αιτήματος το αρχείο που γράφει το Export Alarms του CODESYS IDE (εξαγωγή ομάδας συναγερμών, `.csv`), όπως το έγραψε το IDE (UTF-16 με byte order mark) ή ως UTF-8. Το `?deviceId=` είναι η συσκευή του PLC και είναι υποχρεωτικό. Το `?application=` είναι το όνομα της εφαρμογής κάτω από την οποία βρίσκονται τα tags του, `Application` αν παραλειφθεί: η εξαγωγή ονομάζει μια μεταβλητή από το GVL της (`GVL_Alarm.bPumpFault`) και το tag είναι `Application.GVL_Alarm.bPumpFault`. Το `?defaultPriority=` (1 έως 4) είναι η προτεραιότητα ενός συναγερμού του οποίου η κλάση δεν είναι Error, Warning ή Info. Χωρίς `?apply=true` δεν αποθηκεύεται τίποτα: η απάντηση λέει τι θα περνούσε.

Η οθόνη Συναγερμοί το προσφέρει ως Εισαγωγή από CODESYS (μόνο για διαχειριστές): επιλέξτε τη συσκευή, ονομάστε την εφαρμογή, επιλέξτε το αρχείο, διαβάστε την προεπισκόπηση και μετά εισαγάγετε.

Οι ψηφιακοί συναγερμοί που συγκρίνονται με `= TRUE` ή `= FALSE` γίνονται `true` και `false`, το UpperLimit με `>` γίνεται `hi`, το LowerLimit με `<` γίνεται `lo`, ένας συναγερμός Outside range (`OutOfArea`, με και τους δύο τελεστές `<`) γίνεται δύο συναγερμοί, ένας `lo` στο κάτω όριο και ένας `hi` στο πάνω, το μήνυμα και οι καθυστερήσεις ενεργοποίησης και απενεργοποίησης (χρόνος IEC όπως `T#5s`) περνούν, και το Error είναι προτεραιότητα 2, το Warning 3, το Info 4. Ό,τι άλλο μπορεί να γράψει το IDE δεν διαβάζεται και επιστρέφει στο `skipped` με τη γραμμή του και τον λόγο, επειδή η διάταξη δεν τεκμηριώνεται από το CODESYS και διαβάζεται μόνο ό,τι έχει δείξει μια πραγματική εξαγωγή. Αυτό περιλαμβάνει και το υπόλοιπο που προσφέρει το IDE: το Inside the range (`ForbiddenArea`) είναι αληθές μόνο ανάμεσα σε δύο όρια και ένας συναγερμός εδώ έχει ένα, το Change δεν έχει τεκμηριωμένη διάρκεια, και τα Event και Alarm (API) ενεργοποιούνται από το πρόγραμμα του PLC και δεν έχουν μεταβλητή να παρακολουθηθεί. Το `warnings` απαριθμεί ό,τι πέρασε μόνο εν μέρει (μια άγνωστη κλάση, το latching, ένας συναγερμός υψηλότερης προτεραιότητας).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` για άγνωστη συσκευή, `400` για αρχείο που δεν είναι εξαγωγή ομάδας συναγερμών.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}` ή `404`.

### `POST /api/alarms/{id}/ack`

Προαιρετικό σώμα `{"note": "checking the heater bands"}`. Απαντά με τον συναγερμό όπως είναι τώρα, με `ackedBy` και `ackNote`. `404` για άγνωστο συναγερμό.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, υποχρεωτικό και θετικό: μια αόριστη σίγαση είναι καταστολή, που είναι διαφορετικό πράγμα και δεν είναι δουλειά του χειριστή. Απαντά με τον συναγερμό, `state` `shelved`, με `shelvedUntil` και `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Χωρίς σώμα. Απαντά με τον συναγερμό πίσω στην κατάσταση που του δίνει η συνθήκη του. `409` αν δεν ήταν σε αναβολή.

### `GET /api/alarms/events`

Το ημερολόγιο ελέγχου των συναγερμών, πρώτα τα νεότερα. `?alarm=` ένας ορισμός, `?limit=` (προεπιλογή 200, το πολύ 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

Το `type` είναι `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` ή `escalation-ended`. Τα δύο τελευταία τα γράφει η κλιμάκωση συναγερμών (το `actor` είναι `escalation`), και το `note` τους λέει ποιος ειδοποιήθηκε και γιατί σταμάτησε η αλυσίδα. Δείτε [Ειδοποιήσεις συναγερμών](/el/iot/notifications/#κλιμάκωση).

## Αυτοματισμοί

Εναύσματα, μια συνθήκη, ενέργειες. Η γλώσσα των κανόνων βρίσκεται στους [Αυτοματισμούς](/el/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

Το `armed` δείχνει ποιοι κανόνες τρέχουν πραγματικά, κάτι που δεν είναι το ίδιο με το `enabled`: ένας ενεργοποιημένος κανόνας που σταμάτησε να μεταγλωττίζεται δεν είναι οπλισμένος, και εδώ το μαθαίνετε.

### `POST /api/automations`

Δημιουργεί ή αντικαθιστά έναν κανόνα: `id`, `name`, `description`, `enabled`, `triggers` (τουλάχιστον ένα), `condition`, `actions` (τουλάχιστον μία), `mode` (`skip`, η προεπιλογή, `queue`, `restart` ή `parallel`), `minIntervalSec`, `maxRuntimeSec`. Ο κανόνας μεταγλωττίζεται πριν αποθηκευτεί, και ένας που δεν μεταγλωττίζεται δίνει 400 και δεν φτάνει ποτέ στη βάση δεδομένων: ένας αποθηκευμένος κανόνας που δεν μπορεί να οπλιστεί είναι ένας κανόνας που ο δημιουργός του πιστεύει ότι τρέχει.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Μεταγλωττίζει έναν κανόνα χωρίς να τον αποθηκεύσει, για τον άμεσο έλεγχο του επεξεργαστή. Πάντα `200`· η απάντηση λέει αν μεταγλωττίστηκε:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Χρειάζεται το `automations.write` επειδή υπάρχει για να βοηθά κάποιον να γράψει έναν.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}` ή `404`.

### `POST /api/automations/{id}/enabled`

Το `{"enabled": false}` τον αφοπλίζει χωρίς να τον διαγράφει. Απαντά `{"enabled":false,"id":"fill-tank"}` ή `404`.

### `POST /api/automations/{id}/trigger`

Τον εκτελεί τώρα, σαν να είχε ενεργοποιηθεί ένα έναυσμα. Η συνθήκη εξακολουθεί να ισχύει (μια ψευδής καταγράφει εκτέλεση `skipped`) και το ίδιο ισχύει για τον τρόπο εκτέλεσης· το `minIntervalSec` δεν ισχύει, επειδή ένας άνθρωπος που ζητά εκτέλεση δεν είναι tag που τρεμοπαίζει. Χωρίς σώμα. `202` `{"triggered":"fill-tank"}`: η εκτέλεση γίνεται στο παρασκήνιο, και το `GET /api/runs` έχει το αποτέλεσμα. `400` αν ο κανόνας δεν είναι οπλισμένος. Οι χειριστές έχουν `automations.trigger`· το να τρέξεις κανόνα που έγραψε κάποιος άλλος είναι χειρισμός, το να γράψεις έναν όχι.

### `GET /api/runs`

Ιστορικό εκτελέσεων, πρώτα τα νεότερα. `?automation=` ένας κανόνας, `?limit=` (προεπιλογή 100, το πολύ 1000). `[]` όταν δεν υπάρχουν.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

Το `status` είναι `running`, `succeeded`, `failed`, `skipped`, `timed_out` ή `cancelled`. Τα βήματα κρατούν τις επιλυμένες εισόδους, όχι τα πρότυπα, επειδή αυτό χρειάζεται να διαβάσετε στις 3 τα ξημερώματα.

Ένας κανόνας που φτιάχτηκε από blueprint φέρει άλλα τρία πεδία στο `GET /api/automations`: `blueprintId`, `blueprintVersion` (η έκδοση από την οποία φτιάχτηκε, που είναι και η έκδοση στην οποία μένει) και `blueprintInputs`. Ένας κανόνας γραμμένος με το χέρι δεν έχει κανένα. Ανήκουν στον διακομιστή: το `POST /api/automations` τα δέχεται και τα αγνοεί, και μια επεξεργασία με το χέρι κρατά ό,τι είχε ο κανόνας.

### `POST /api/automations/{id}/blueprint-upgrade`

Μεταφέρει έναν κανόνα που φτιάχτηκε από blueprint στη νεότερη έκδοση του blueprint, κρατώντας το id του, το όνομά του και αν είναι οπλισμένος. Δεν γίνεται ποτέ από μόνο του. Οι χειριστές έχουν `blueprints.apply`, όπως και για τη δημιουργία ενός. Κοιτάξτε πρώτα: το **`?dry_run=true`** δεν αλλάζει τίποτα και απαντά τι θα άλλαζε, μέρος προς μέρος, και τι θα έκανε ο κανόνας αν ενεργοποιούνταν τώρα, με κάθε εγγραφή να περνά από τους ελέγχους της πύλης εγγραφής:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Μια επεξεργασία με το χέρι από τότε που φτιάχτηκε ο κανόνας εμφανίζεται στο `changes` ως αντικατάσταση. Όταν η νέα έκδοση χρειάζεται μια είσοδο για την οποία ο κανόνας δεν έχει τιμή, ή απορρίπτει μια τιμή με την οποία φτιάχτηκε, η δοκιμαστική εκτέλεση το λέει στο `error` και τίποτα άλλο.

Η πραγματική δέχεται `{"version": 2}`, την έκδοση που έδειξε η δοκιμαστική, και `inputs` για ό,τι χρειάζεται η νέα έκδοση. Ένα blueprint που έχει προχωρήσει στο μεταξύ, ή ένας κανόνας που κάποιος αναβάθμισε εν τω μεταξύ, δίνει `409`: μπαίνει ό,τι εξετάστηκε, αλλιώς δεν μπαίνει τίποτα. Μια είσοδος που λείπει δίνει `400`. `200` με το ίδιο σχήμα, όπου το `automation` είναι ο κανόνας όπως αποθηκεύτηκε. Καταγράφεται ως `automation upgraded from blueprint pump_watch version 1 to 2`. Με την ίδια έκδοση και νέα `inputs`, έτσι αλλάζουν οι είσοδοι ενός κανόνα. `400` για κανόνα γραμμένο με το χέρι· `404` αν το blueprint από το οποίο προήλθε δεν υπάρχει πια.

## Scripts

Ονομασμένες ακολουθίες ενεργειών, που τρέχουν κατά παραγγελία: από εδώ, από το βήμα `call_script` ενός κανόνα, από το `run_script` του MCP ή μέσω της οντότητας του script (`script.turn_on`). Η ακολουθία είναι η γλώσσα των αυτοματισμών. Κάθε εγγραφή που κάνει ένα βήμα περνά από την πύλη εγγραφής ως `script:<id>`, με την πηγή αυτού που το ξεκίνησε. Όλα βρίσκονται στα [Scripts](/el/iot/scripts/).

### `GET /api/scripts`

Κάθε script, με τους μετρητές εκτελέσεών του και πόσες εκτελέσεις του τρέχουν τώρα, σε οποιαδήποτε διεργασία:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Δημιουργεί ένα. Μόνο για διαχειριστές. `id` (πεζά γράμματα, ψηφία και κάτω παύλες, με αρχή ένα γράμμα: είναι το αναγνωριστικό αντικειμένου της οντότητας, `script.<id>`), `name`, `description`, `icon`, `fields` (είσοδοι με τύπο), `sequence` (τουλάχιστον μία ενέργεια), `mode` (`skip`, η προεπιλογή, `queue`, `restart` ή `parallel`) και `maxRuntimeSec`. Μεταγλωττίζεται πριν αποθηκευτεί, όπως ένας κανόνας, και ένα script που θα καλούσε τον εαυτό του, άμεσα ή μέσω άλλων scripts, απορρίπτεται. Απαντά `201` με το script. `400` για ό,τι δεν μεταγλωττίζεται· `409` για id που χρησιμοποιείται.

### `POST /api/scripts/validate`

Ελέγχει ένα script χωρίς να το αποθηκεύσει, για τον άμεσο έλεγχο του επεξεργαστή. `200` `{"valid":true}` ή `{"valid":false,"error":"..."}`, με τα λόγια με τα οποία θα απορριπτόταν μια αποθήκευση.

### `GET /api/scripts/{id}`

Ένα script, όπως στη λίστα. `404` αν δεν υπάρχει.

### `PUT /api/scripts/{id}`

Αντικαθιστά τον ορισμό του· το σώμα είναι το ίδιο με της δημιουργίας, και το `id` μπορεί να παραλειφθεί. Μόνο για διαχειριστές. Οι εκτελέσεις του που βρίσκονται σε εξέλιξη ακυρώνονται όταν αλλάξουν τα βήματα, τα πεδία ή ο τρόπος του: ξεκίνησαν από τον παλιό ορισμό.

### `DELETE /api/scripts/{id}`

Το διαγράφει μαζί με το ιστορικό εκτελέσεών του, ακυρώνοντας τις εκτελέσεις του που βρίσκονται σε εξέλιξη. Μόνο για διαχειριστές. `{"deleted":"cip_cycle"}`. Η οντότητά του μένει ορφανή, δεν διαγράφεται.

### `POST /api/scripts/{id}/run`

Το εκτελεί. Οι χειριστές έχουν `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Κάθε πεδίο στο σώμα είναι προαιρετικό, και το σώμα επίσης. Τα πεδία ελέγχονται σε σχέση με του script πριν τρέξει οτιδήποτε: μια τιμή εκτός εύρους, εκτός του βήματός της, που δεν είναι μία από τις επιλογές ή είναι λάθος τύπου δίνει `400`, και δεν μετακινείται ποτέ για να ταιριάξει. `202` με την εκτέλεση μόλις ξεκινήσει· με `"wait":true`, `200` με την εκτέλεση μόλις τελειώσει, μαζί με το ίχνος της.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` όταν είναι απασχολημένο: τρέχει ήδη και ο τρόπος του είναι `skip`, ή τρέχει με μία στην ουρά και ο τρόπος του είναι `queue`. Δεν έτρεξε τίποτα, και μια εκτέλεση `skipped` υπάρχει στο ιστορικό και λέει γιατί:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

Το **`?dry_run=true`** ρωτά τι θα έκανε μια εκτέλεση τώρα και δεν κάνει τίποτα από αυτά. Τα πεδία ελέγχονται με τον ίδιο τρόπο· έπειτα κάθε βήμα διατρέχεται απέναντι στο εργοστάσιο όπως είναι: κάθε εγγραφή και κάθε κλήση υπηρεσίας υποβάλλεται στους δικούς ελέγχους της πύλης, μια συνθήκη αξιολογείται, μια μεταβλητή δεσμεύεται. Μια αναμονή, μια καθυστέρηση και ό,τι δεν γράφει σε κανέναν εξοπλισμό είναι `not_checked`. Η πρώτη εγγραφή που θα απορριπτόταν το τερματίζει, όπως θα τερμάτιζε την εκτέλεση, και το `error` το λέει με τα λόγια της πύλης. `200` με την κρίση, απορριφθείσα ή όχι:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

Το `verdict` κάθε βήματος είναι `would_write`, `refused`, `ends_here` (μια συνθήκη ψευδής τώρα, ή μια διακοπή), `not_checked` ή `ok`. Ένα βήμα ενός script που καλεί αριθμείται κάτω από την κλήση: `3.1`.

### `POST /api/scripts/{id}/stop`

Ακυρώνει όλες τις εκτελέσεις του που βρίσκονται σε εξέλιξη, σε κάθε διεργασία, όπου κι αν είναι. `{"cancelled":1,"stopped":"cip_cycle"}`, όπου `cancelled` είναι οι εκτελέσεις που είχε αυτή η διεργασία. Οι χειριστές έχουν `scripts.run`: το να σταματάς ό,τι μπορείς να ξεκινήσεις είναι μέρος του να το ξεκινάς.

### `GET /api/scripts/{id}/runs`

Οι εκτελέσεις του, πρώτα οι νεότερες, με τα ίχνη τους. `?limit=` (προεπιλογή 50, το πολύ 1000). Το `parent` είναι αυτό που κάλεσε μια εκτέλεση, όταν κάτι το έκανε: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Συνταγές

Σύνολα τιμών που εφαρμόζονται μαζί: οι τιμές στόχοι μιας ποιότητας προϊόντος, μια αλλαγή παραγωγής. Κάθε ένα είναι και οντότητα, `scene.<id>`. Μια συνταγή ελέγχεται ολόκληρη πριν φύγει οτιδήποτε και απορρίπτεται ολόκληρη για οποιονδήποτε λόγο· οι στόχοι της φεύγουν μετά με τη σειρά υπό ένα κοινό id κλήσης, ο πρώτος που αποτυγχάνει σταματά τους υπόλοιπους και τίποτα δεν αναιρείται· κάθε τιμή που γράφεται διαβάζεται ξανά από τη συσκευή. Όλα βρίσκονται στις [Συνταγές](/el/iot/recipes/).

Το όνομα, η περιγραφή, ο κόμβος εξοπλισμού και η άδεια μιας συνταγής αλλάζουν επιτόπου. Ό,τι γράφει (`targets`, `params`, `precondition`, `verify_sec`) είναι έκδοση, και οι εκδόσεις δεν αλλάζουν ποτέ: η αποθήκευση νέου περιεχομένου αποθηκεύει την επόμενη.

### `GET /api/recipes`

Κάθε συνταγή, με το περιεχόμενο της τρέχουσας έκδοσής της και την πιο πρόσφατη εφαρμογή της:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

Το `equipment_id` είναι `null` για συνταγή ολόκληρου του εργοστασίου.

### `POST /api/recipes`

Δημιουργεί μία, ως έκδοση 1. Μόνο για διαχειριστές. `id` (πεζά γράμματα, ψηφία και κάτω παύλες, με αρχή ένα γράμμα: είναι το αναγνωριστικό αντικειμένου της οντότητας, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, η προεπιλογή, ή `recipes.apply.<name>`), `params` (είσοδοι με τύπο), `precondition` (μια έκφραση που πρέπει να είναι αληθής για να ξεκινήσει), `targets` (τουλάχιστον ένας, το πολύ 200, ο καθένας με `entity_id`, `service` και `data` ή `data_expressions`), `verify_sec` (1 έως 600, προεπιλογή 10) και `note`. Ένας στόχος ορίζει μια τιμή: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, στα domains που τα δέχονται. Ένας παλμός ή μια εκκίνηση απορρίπτεται: ανήκει σε script. Η οντότητα κάθε στόχου πρέπει να υπάρχει και κάθε έκφραση πρέπει να μεταγλωττίζεται. `201` με τη συνταγή· `400` για οτιδήποτε στραβό, `409` για id που χρησιμοποιείται.

### `POST /api/recipes/capture`

Συντάσσει ένα προσχέδιο συνταγής από όσα κρατούν οι οντότητες τώρα, μόνο για διαχειριστές, και δεν αποθηκεύει τίποτα:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Καθεμία γίνεται στόχος που την επαναφέρει στην τρέχουσα τιμή της, με τη σειρά που δίνεται· ένας βρόχος γίνεται ο τρόπος λειτουργίας του και μετά η τιμή στόχος του. Η απάντηση είναι μια συνταγή χωρίς id και χωρίς όνομα, για τον επεξεργαστή. Μια οντότητα που δεν υπάρχει, είναι απενεργοποιημένη, διαβάζεται με ποιότητα διαφορετική από καλή, είναι `unknown` ή `unavailable`, ή δεν είναι κάτι που ορίζει μια συνταγή, δίνει `400` που τις κατονομάζει όλες: μια συνταγή φτιαγμένη από κακή ανάγνωση γράφει πίσω την κακή ανάγνωση.

### `GET /api/recipes/{id}`

Μία συνταγή, όπως στη λίστα. `404` αν δεν υπάρχει.

### `PUT /api/recipes/{id}`

Την αποθηκεύει. Μόνο για διαχειριστές. Το σώμα είναι η συνταγή όπως την απάντησε το `GET`, επεξεργασμένη· το `id` μπορεί να παραλειφθεί. Το `current_version` είναι η έκδοση πάνω στην οποία έγινε η επεξεργασία: αν κάποιος έχει αποθηκεύσει άλλη στο μεταξύ, η αποθήκευση δίνει `409` αντί να αντικαταστήσει αθόρυβα τη δική του (το `0` παραλείπει τον έλεγχο). Το νέο περιεχόμενο γίνεται η επόμενη έκδοση, με το `note` να λέει γιατί· μια αλλαγή μόνο στο όνομα, την περιγραφή, τον εξοπλισμό ή την άδεια δεν φτιάχνει καμία.

### `DELETE /api/recipes/{id}`

Τη διαγράφει μαζί με τις εκδόσεις της. Μόνο για διαχειριστές. `{"deleted":"grade_a"}`. Οι εφαρμογές της διατηρούνται, επειδή είναι ό,τι στάλθηκε στο εργοστάσιο, και η οντότητά της μένει ορφανή.

### `GET /api/recipes/{id}/versions`

Κάθε έκδοση, πρώτα οι νεότερες, η καθεμία ακριβώς όπως αποθηκεύτηκε, με το ποιος την αποθήκευσε και τη σημείωση:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Μία έκδοση. `404` αν η συνταγή δεν έχει τέτοια έκδοση, `400` αν το `{version}` δεν είναι αριθμός.

### `POST /api/recipes/{id}/validate`

Θα εφαρμοζόταν αυτή τη στιγμή; Οι χειριστές έχουν `recipes.apply`. Το σώμα είναι αυτό μιας εφαρμογής, και τίποτα δεν γράφεται, καταγράφεται ή αποθηκεύεται στο αρχείο. Γίνεται κάθε έλεγχος που κάνει μια εφαρμογή πριν γράψει: οι παράμετροι, η δική της άδεια της συνταγής, η προϋπόθεση, οι εκφράσεις δεδομένων, αν άλλη εφαρμογή γράφει σε μία από τις οντότητές της, και κάθε στόχος υποβάλλεται στους ελέγχους της πύλης εγγραφής. `200` με την κρίση, `would_apply` ή `refused`, και την κρίση κάθε στόχου: `would_write`, `refused` με τον λόγο, ή `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Παράμετροι που δεν δέχεται δίνουν `400`, όπως θα έδιναν στην πραγματική εφαρμογή.

### `POST /api/recipes/{id}/apply`

Την εφαρμόζει. Οι χειριστές έχουν `recipes.apply`. Μια συνταγή που ορίζει δική της άδεια, `recipes.apply.<name>`, απαιτεί και αυτή, ελεγμένη εδώ απέναντι στη συνταγή· ένας χρήστης που δεν την έχει παίρνει `403` και μια απορριφθείσα εφαρμογή στο ιστορικό με το όνομά του πάνω της.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Όλα είναι προαιρετικά, και το σώμα επίσης. Το `version` εφαρμόζει επίτηδες παλαιότερη έκδοση· αν παραλειφθεί, την τρέχουσα. Το `resume` είναι το id μιας προηγούμενης εφαρμογής αυτής της συνταγής που σταμάτησε στη μέση: οι στόχοι της που δεν γράφτηκαν φεύγουν ως νέα εφαρμογή, με την έκδοση και τις παραμέτρους της, και το `parent` λέει ποια ολοκληρώνει.

Απαντά όταν κάθε τιμή έχει γραφτεί και διαβαστεί ξανά, κάτι που παίρνει το πολύ το `verify_sec` της συνταγής:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Ένας στόχος είναι `written`, `failed` (έφυγε και η συσκευή είπε όχι ή δεν είπε τίποτα), `not_sent`, `skipped` (ένας πριν από αυτόν δεν πέρασε) ή `refused` (προ-επικύρωση). Ένας γραμμένος είναι `verified` όταν η συσκευή διάβασε ξανά, μετά την αποστολή, την τιμή που της στάλθηκε, και `unconfirmed` όταν δεν το έκανε μέσα στο `verify_sec`: έφυγε και μπορεί να μην έγινε δεκτός. Κάθε εγγραφή φέρει το `call_id` της εφαρμογής, οπότε το `GET /api/writes?call=<call_id>` τις δίνει όλες.

| Κατάσταση | Πότε |
|---|---|
| 200 | `applied`: κάθε στόχος γράφτηκε. Ελέγξτε το `verification` του καθενός |
| 400 | Μια παράμετρος που η συνταγή δεν δέχεται, εκτός εύρους ή λάθος τύπου· ένα `resume` χωρίς τίποτα να απομένει για εφαρμογή |
| 403 | Η δική της άδεια της συνταγής. Καταγράφεται ως απορριφθείσα εφαρμογή |
| 404 | Δεν υπάρχει τέτοια συνταγή ή δεν υπάρχει τέτοια έκδοση |
| 409 | `refused`: οποιοσδήποτε λόγος να μην ξεκινήσει, ο καθένας στο `error` και στον στόχο του. Ή άλλη εφαρμογή γράφει αυτή τη στιγμή σε μία από τις οντότητές της. Δεν γράφτηκε τίποτα |
| 502 | `partial` ή `failed`: ξεκίνησε και δεν έφυγαν όλοι οι στόχοι. Το `targets` λέει ακριβώς ποιοι. Τίποτα δεν αναιρείται |

Κάθε απάντηση εκτός από `400` για κακοσχηματισμένο σώμα ή `404` φέρει την εφαρμογή, και κάθε εφαρμογή εκτός από δοκιμαστική εκτέλεση βρίσκεται στο `GET /api/recipes/{id}/applications`, μαζί με τις απορρίψεις.

### `GET /api/recipes/{id}/applications`

Οι εφαρμογές της, πρώτα οι νεότερες, μαζί με τις απορριφθείσες. `?limit=` (προεπιλογή 50, το πολύ 1000). Το `parent` είναι ό,τι την εφάρμοσε, όταν κάτι το έκανε: `automation_run:812`, `script_run:77`, `application:41`. Οι εφαρμογές μιας διαγραμμένης συνταγής εξακολουθούν να απαντώνται.

## Blueprints

Ένας αυτοματισμός γραμμένος μία φορά με τυποποιημένα κενά μέσα του, που συμπληρώνονται για να φτιαχτεί ένας συνηθισμένος κανόνας. Ο κανόνας κρατά την έκδοση από την οποία φτιάχτηκε· η επεξεργασία του blueprint δεν αλλάζει κανέναν κανόνα, και η μεταφορά ενός σε νεότερη έκδοση είναι [μια αναβάθμιση](#post-apiautomationsidblueprint-upgrade) που ζητά κάποιος. Κάθε εγγραφή του κανόνα περνά από την πύλη εγγραφής ως `automation:<id>`. Όλα βρίσκονται στα [Blueprints](/el/iot/blueprints/).

### `GET /api/blueprints`

Κάθε blueprint, πρώτα τα ενσωματωμένα, το καθένα με το πόσοι κανόνες φτιάχτηκαν από αυτό:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

Το `source` είναι `builtin` (έρχεται μέσα στο εκτελέσιμο, μόνο ανάγνωση) ή `user`.

### `POST /api/blueprints`

Γράφει ένα. Μόνο για διαχειριστές. `id` (πεζά γράμματα, ψηφία και κάτω παύλες, με αρχή ένα γράμμα), `name`, `description`, `inputs` (με τύπο, ίδια με τα πεδία ενός script) και `template`: ο κανόνας, με τα `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` και `maxRuntimeSec` του, και τα κενά μέσα του. Το `{"!input": "motor"}` ως τιμή αντικαθίσταται από την είσοδο· το ίδιο και το `${motor}` μέσα σε συμβολοσειρά, ως κυριολεκτικό όπου η συμβολοσειρά είναι έκφραση. Ελέγχεται πριν αποθηκευτεί: κάθε κενό κατονομάζει μια είσοδο, κάθε είσοδος χρησιμοποιείται, και συμπληρωμένο με δείγματα τιμών δίνει έναν κανόνα που μεταγλωττίζεται. `201` με `version` 1. `400` για οτιδήποτε στραβό, `409` για id που χρησιμοποιείται, και ενός ενσωματωμένου.

### `GET /api/blueprints/{id}`

Ένα, όπως στη λίστα. `404` αν δεν υπάρχει.

### `PUT /api/blueprints/{id}`

Αντικαθιστά τον ορισμό του· το σώμα είναι το ίδιο με της εγγραφής ενός, και το `id` μπορεί να παραλειφθεί. Μόνο για διαχειριστές. Το `version` αυξάνεται κατά ένα όταν άλλαξαν τα `inputs` ή το `template`, και όχι για νέο όνομα ή περιγραφή. **Κανένας κανόνας που φτιάχτηκε από αυτό δεν αλλάζει.** Ο καθένας κρατά την έκδοση από την οποία φτιάχτηκε, και το `GET /api/automations` δείχνει ποια. Ένα ενσωματωμένο δίνει `400`: αντιγράψτε το με δικό σας id.

### `DELETE /api/blueprints/{id}`

Μόνο για διαχειριστές. `{"deleted":"pump_watch"}`. `409` όσο υπάρχει οποιοσδήποτε κανόνας φτιαγμένος από αυτό, με τα ονόματά τους: διαγράψτε πρώτα εκείνους. Ένα ενσωματωμένο δίνει `400`.

### `POST /api/blueprints/{id}/instantiate`

Φτιάχνει έναν κανόνα από αυτό και τον οπλίζει. Οι χειριστές έχουν `blueprints.apply`: ποια αντλία και για πόση ώρα είναι δική τους επιλογή, και τι κάνει ο κανόνας αποφασίστηκε όταν γράφτηκε το blueprint.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

Το `name` είναι από προεπιλογή του blueprint και το `enabled` είναι `true`. Κάθε είσοδος ελέγχεται πριν φτιαχτεί οτιδήποτε: μια τιμή εκτός εύρους, εκτός του βήματός της, που δεν είναι μία από τις επιλογές της, μια οντότητα άλλου domain ή λάθος τύπου δίνει `400` που κατονομάζει κάθε λάθος, και δεν μετακινείται ποτέ για να ταιριάξει. Ένα `automationId` που χρησιμοποιείται δίνει `409`: η δημιουργία κανόνα δεν αντικαθιστά ποτέ άλλον. `201` με τον κανόνα, με ορισμένα τα `blueprintId`, `blueprintVersion` και `blueprintInputs`. Καταγράφεται ως `automation made from blueprint motor_running_too_long version 1`.

Το **`?dry_run=true`** δεν φτιάχνει τίποτα. Απαντά τον κανόνα που θα έφτιαχνε και τι θα έκανε αυτός ο κανόνας αν ενεργοποιούνταν τώρα: η συνθήκη αξιολογημένη, κάθε εγγραφή και κλήση υπηρεσίας υποβαλλόμενη στους ελέγχους της πύλης ως `automation:<id>`, η πρώτη άρνηση στο `check.error` με τα λόγια της πύλης. Τίποτα δεν αποθηκεύεται, γράφεται ή ελέγχεται.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Πίνακες ελέγχου

Σελίδες από κάρτες, για τους ρόλους και τις οθόνες που τις χρειάζονται. Ένας πίνακας ελέγχου δεν διατάζει τίποτα: μια κάρτα κατονομάζει ένα tag, μια οντότητα, ένα script ή μια συνταγή, και το κουμπί της γράφει μέσω του [`POST /api/write`](#post-apiwrite) ως το άτομο που το πάτησε. Ο τοίχος είναι ένας από αυτούς. Όλα βρίσκονται στους [Πίνακες ελέγχου](/el/iot/dashboards/).

### `GET /api/dashboards`

Οι πίνακες ελέγχου που προσφέρονται σε αυτόν που καλεί, με τη σειρά που τους δείχνει ο εναλλάκτης, μαζί με τον πίνακα τοίχου. Όποιος έχει `dashboards.write` βλέπει όλους.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Χτίζει έναν. Μόνο για διαχειριστές. `id` (πεζά γράμματα, ψηφία, παύλες και κάτω παύλες, με αρχή ένα γράμμα), `name`, και προαιρετικά `description`, `roles`, `homeFor`, `screens`, `position` και `cards`. `201` με `version` 1, με το μέγεθος και τη ρύθμιση κάθε κάρτας στη μορφή που αποθηκεύτηκαν.

Μια κάρτα είναι `id`, `type`, `title`, `w` (1 έως 12 στήλες), `h` (1 έως 8 γραμμές) και ένα `config`. Οι τύποι και οι ρυθμίσεις τους βρίσκονται στους [Πίνακες ελέγχου](/el/iot/dashboards/#οι-κάρτες). Ελέγχεται πριν αποθηκευτεί:

- ένα κλειδί ρύθμισης που ο τύπος δεν έχει, ένας αριθμός εκτός εύρους, μια διεύθυνση κάμερας ή κάτοψης με login ή token μέσα της, ή πάνω από 60 κάρτες δίνει `400`·
- μια κάρτα που κατονομάζει tag, οντότητα, script ή συνταγή που δεν υπάρχει δίνει `400` που το κατονομάζει·
- ένα `button` σε tag που δεν είναι εγγράψιμο, ή με αριθμό εκτός του εύρους του tag, δίνει `400`: η πύλη θα απέρριπτε κάθε πάτημα·
- ένας ρόλος που δεν υπάρχει δίνει `400`·
- ένα `id` που χρησιμοποιείται, μια οθόνη που ήδη έχει άλλος πίνακας ελέγχου, ή μια αρχική σελίδα ρόλου που ήδη είναι άλλος πίνακας ελέγχου, δίνει `409`.

### `GET /api/dashboards/{id}`

Ένας, όπως στη λίστα. `404` αν δεν υπάρχει, και επίσης αν δεν προσφέρεται σε αυτόν που καλεί.

### `PUT /api/dashboards/{id}`

Τον αντικαθιστά. Μόνο για διαχειριστές. Το σώμα είναι ο πίνακας ελέγχου όπως τον απάντησε το `GET`, με το `version` ορισμένο στην έκδοση στην οποία διαβάστηκε: **είναι υποχρεωτικό**, και μια αποθήκευση που κατονομάζει έκδοση που δεν είναι πια η τρέχουσα δίνει `409` που λέει ποια είναι η τρέχουσα, επειδή η εναλλακτική είναι να σβήνεται αθόρυβα ό,τι μόλις έχτισε το τελευταίο άτομο που αποθήκευσε. Το `id` μπορεί να παραλειφθεί από το σώμα, το `kind` δεν μπορεί να αλλάξει, και τα `createdAt`, `updatedAt` και `updatedBy` ανήκουν στον διακομιστή και αγνοούνται. `200` με τον πίνακα ελέγχου στην επόμενη έκδοση.

Ο πίνακας τοίχου δέχεται `PUT` μόνο για τις αναθέσεις του (`roles`, `homeFor`, `screens`, `position`) και τίποτα άλλο: δεν έχει κάρτες, οπότε ένας με κάρτες δίνει `400`. Οι δείκτες του είναι τα tags του πίνακα, `GET` και `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Μόνο για διαχειριστές. `{"deleted":"line-2"}`. Οι κάρτες δείχνουν πράγματα και δεν κατέχουν τίποτα, οπότε τίποτα άλλο δεν αγγίζεται. Ο πίνακας τοίχου δίνει `400`: υπάρχει πάντα.

Οι δημιουργίες, αποθηκεύσεις και διαγραφές καταγράφονται ως γεγονότα `config` στο υποκείμενο `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

Ο πίνακας ελέγχου ως αρχείο οθόνης: ένα έγγραφο JSON με έκδοση που το [`POST /api/dashboards/import`](#post-apidashboardsimport) φορτώνει σε άλλη εγκατάσταση. Απαντά ως συνημμένο με όνομα `<id>.hotloop-screen.json`. Αυτός που καλεί χρειάζεται `dashboards.read` και πρέπει να του προσφέρεται ο πίνακας ελέγχου, όπως για το `GET` ενός. Ο πίνακας τοίχου δίνει `400`: είναι οι καρφιτσωμένοι δείκτες μιας εγκατάστασης, όχι διάταξη. Η μορφή βρίσκεται στα [Αρχεία οθόνης](/el/iot/screen-file/).

### `POST /api/dashboards/import`

Διαβάζει ένα αρχείο οθόνης, το ελέγχει απέναντι σε αυτή την εγκατάσταση και το αποθηκεύει ως νέο πίνακα ελέγχου. Μόνο για διαχειριστές, και δεν μπορεί να αποθηκεύσει ό,τι θα απέρριπτε το `POST /api/dashboards`. Το σώμα είναι το ίδιο το αρχείο, ή `{"file": {...}}` με επιλογές δίπλα:

| Επιλογή | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `id`, `name` | Αποθήκευση με άλλο id ή όνομα. |
| `replace` | Αν το id χρησιμοποιείται, αποθήκευση πάνω σε αυτόν τον πίνακα ελέγχου στην τρέχουσα έκδοσή του. Χωρίς αυτό, id που χρησιμοποιείται δίνει `409`. |
| `skipAssignments` | Παράλειψη των `screens` και `homeFor` του αρχείου, που ανήκουν στην εγκατάσταση που το έφτιαξε. Τα `roles` μένουν. |
| `remap` | Πώς να λέγονται τα πράγματα εδώ: `tags` (ολόκληρο κλειδί σε ολόκληρο κλειδί, όπως το αρχείο κατονομάζει το tag ή όπως διαβάζεται αφού το έχει μετακινήσει το `devices`), `devices` (id σε id, που μετακινεί και το τμήμα συσκευής κάθε tag που δεν κατονομάζεται στο `tags`), `entities`, `scripts`, `recipes` και `equipment` (id σε id). Μια εγγραφή που τίποτα στην οθόνη δεν χρησιμοποιούσε είναι προειδοποίηση. |
| `dryRun` | Απάντηση με την αναφορά και καμία αποθήκευση. Πάντα `200`. |
| `codesys`, `visualization` | Στη θέση του `file`: το κείμενο μιας εγγενούς εξαγωγής CODESYS και η οπτικοποίηση που θα ληφθεί όταν περιέχει περισσότερες. Η αναφορά έχει τότε ένα `conversion` με το τι έγινε κάθε στοιχείο και τι παραλείφθηκε. Δείτε [Εισαγωγή οθόνης CODESYS](/el/iot/codesys-screen-import/). |

Η απάντηση είναι μια αναφορά, είτε αποθηκεύτηκε κάτι είτε όχι:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Κάθε αναφορά που λείπει καταγράφεται, όχι μόνο η πρώτη. Ένα `kind` είναι `file` (δεν είναι αρχείο οθόνης, λάθος μορφή, νεότερη έκδοση μορφής από αυτήν που διαβάζει αυτό το build, ή πεδίο που δεν γνωρίζει), `screen` (οι δικοί κανόνες του πίνακα ελέγχου: κακή κάρτα, ρόλος που δεν υπάρχει, υπερβολικά μεγάλο), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (κουμπί ή τιμή στόχος σε tag που δεν είναι εγγράψιμο), `assignment` (όνομα οθόνης ή αρχική σελίδα ρόλου που κρατά άλλος πίνακας ελέγχου) ή `exists` (το id χρησιμοποιείται). Μια εισαγωγή με οποιοδήποτε πρόβλημα δεν αποθηκεύει τίποτα: `400`, ή `409` όταν το μόνο πρόβλημα είναι το `exists` ή το `assignment`, με την ίδια αναφορά. Η επιτυχία είναι `201`, ή `200` όταν αντικατέστησε έναν, με την αναφορά και τον αποθηκευμένο `dashboard`. Καταγράφεται ως γεγονός `config` στο υποκείμενο `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

Ενεργοποιεί κάθε αυτοματισμό με έναυσμα `webhook` σε αυτή τη διαδρομή. **Καμία συνεδρία και καμία άδεια**: η διαδρομή είναι το μυστικό που δίνεται σε τρίτο, το ίδιο μοντέλο εμπιστοσύνης που είχε πάντα αυτό το endpoint, και ένα σύστημα SCADA ή ένα callback SaaS δεν έχει λογαριασμό για να συνδεθεί. Διαλέξτε μια διαδρομή που κανείς δεν θα μπορούσε να μαντέψει.

Το σώμα, έως 1 MiB, παραδίδεται στον κανόνα. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` όταν δεν ακούει κανένας: ένα webhook που στέλνει στο κενό μοιάζει ίδιο με ένα που δουλεύει, οπότε το λέει.

## Στόλος

Καταχωρισμένα ρελέ άκρου, η ζωντανή παρουσία τους μέσω Sparkplug, και εντολές προς αυτά. Χρειάζεται `HOTLOOP_FLEET_ENABLED`. Δείτε [Διαχείριση στόλου](/el/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

Το `online` προέρχεται από NBIRTH και NDEATH. Το `release` είναι το build που είπε το ρελέ ότι τρέχει στο τελευταίο του birth: `version`, `imageDigest` (όταν το λέει ο επόπτης του· το Helm chart δεν το λέει) και `since`, πότε το Gateway άκουσε για πρώτη φορά αυτό το build. Ένα ρελέ πολύ παλιό για να αναφέρει ένα δεν έχει κανένα. Για ένα μέλος με `statusUrl`, το `polled` είναι αληθές και τα `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` και `updateMode` (`auto` ή `approve`) προέρχονται από το `/status` του· δεν σημαίνουν τίποτα όταν δεν ήταν προσβάσιμο. Με απενεργοποιημένη τη λειτουργία: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Δημιουργεί ή αντικαθιστά ένα μέλος: `id`, `name`, `group` και `nodeId` (η ταυτότητά του στο Sparkplug) υποχρεωτικά· `description`, `statusUrl` (`http://` ή `https://`) και `enabled` προαιρετικά. Απαντά με το μέλος. Αυτό λειτουργεί με απενεργοποιημένη τη λειτουργία, ώστε ο στόλος να δηλωθεί πριν ενεργοποιηθεί.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, ή `404`.

### `POST /api/fleet/{id}/rebirth`

Δημοσιεύει ένα `Node Control/Rebirth` στο ρελέ. Χωρίς σώμα. `{"status":"rebirth requested"}`. `404` για άγνωστο μέλος.

### `POST /api/fleet/{id}/restart`

Δημοσιεύει `Node Control/Reboot`. `{"status":"restart requested"}`. Μόνο για διαχειριστές: η επανεκκίνηση ενός ρελέ χάνει τα δεδομένα του μέχρι να επιστρέψει.

### `POST /api/fleet/{id}/update`

Εγκρίνει την ενημέρωση εικόνας που κρατά ένα ρελέ. Δημοσιεύει `Node Control/Update`. `{"status":"update approved"}`. Μόνο για διαχειριστές: το ρελέ τερματίζει και ο επόπτης του ξεκινά όποια εικόνα ακολουθεί, οπότε χάνει τα δεδομένα του για όσο αυτό διαρκεί. Κάνει κάτι μόνο σε ρελέ ρυθμισμένο σε `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`· οποιοδήποτε άλλο ρελέ καταγράφει ότι το αγνόησε. Το αίτημα δεν κατονομάζει εικόνα: δεν υπάρχει πού να μπει μία, και αυτό είναι το νόημα. Δείτε την [αναφορά Edge Relay](/el/edge-relay/reference/#ενημέρωση-ενός-relay).

### `POST /api/fleet/{id}/config`

Στέλνει ένα νέο αρχείο συσκευών στο ρελέ, που το εφαρμόζει ζωντανά: χωρίς επανεκκίνηση, με τη συνεδρία του broker και την ουρά προώθησής του να διατηρούνται, και κάθε συσκευή που το αρχείο δεν άλλαξε να μένει συνδεδεμένη. Το σώμα είναι **το ίδιο το αρχείο συσκευών**, ακατέργαστο JSON, χωρίς κάτι γύρω του. Επικυρώνεται πριν δημοσιευτεί οτιδήποτε (`400` `"invalid device file: ..."` αν όχι). Το `{"status":"config pushed"}` σημαίνει ότι το broker το πήρε· αν το ρελέ το τρέχει το λέει το `config.digest` σε αυτό το μέλος στο `GET /api/fleet`, και ένα αρχείο που το ρελέ απέρριψε εμφανίζεται εκεί ως `config.rejected`. Μόνο για διαχειριστές: αλλάζει τι ρωτά το ρελέ. Δείτε [Διαχείριση στόλου](/el/gateway/fleet/#αποστολή-διαμόρφωσης).

### `DELETE /api/fleet/{id}/config`

Παίρνει πίσω την αποστολή. Καθαρίζει τη διατηρημένη ρύθμιση στο broker ώστε καμία μεταγενέστερη εκκίνηση να μην την εφαρμόσει, και ένα ρελέ που είναι συνδεδεμένο αυτή τη στιγμή εγκαταλείπει το αρχείο που του στάλθηκε και επιστρέφει ζωντανά στο τοπικό του αρχείο συσκευών. Χωρίς σώμα. `{"status":"config push cleared"}`, `404` για άγνωστο μέλος, `503` όταν το Gateway δεν είναι συνδεδεμένο στο broker. Μόνο για διαχειριστές, όπως η αποστολή. Δεν επανεκκινεί τίποτα. Στείλτε το όσο το ρελέ είναι online: ένα ρελέ εκτός σύνδεσης δεν το ακούει ποτέ. Δείτε την [αναφορά Edge Relay](/el/edge-relay/reference/#πού-βρίσκεται-ένα-αρχείο-που-στάλθηκε-και-ποιο-αρχείο-κερδίζει).

## Ειδοποιήσεις

Ειδοποίηση ενός τηλεφώνου όταν ενεργοποιείται ένας συναγερμός, μέσω webhook, SMTP, ntfy ή Gotify, και ενημέρωση του επόμενου ατόμου όταν κανείς δεν τον αναγνωρίζει. Χρειάζεται `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Στέλνει τώρα μια συνθετική ειδοποίηση συναγερμού μέσω κάθε ρυθμισμένου καναλιού, ώστε να μάθετε ότι το ρελέ SMTP σας απορρίπτει πριν το κάνει ένας πραγματικός συναγερμός. Χωρίς σώμα. Χρειάζεται `HOTLOOP_NOTIFY_ENABLED`. Μόνο για διαχειριστές: στέλνει πραγματικό μήνυμα και ξοδεύει όποια ποσόστωση επιτρέπει ο πάροχος.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` είτε δούλεψε κάθε κανάλι είτε όχι· κάθε αποτέλεσμα το λέει. Ένα που απέτυχε φέρει `error`. Ένα webhook που απέτυχε κατονομάζει το σχήμα και τον κεντρικό υπολογιστή του και τίποτα άλλο, επειδή για τις περισσότερες υπηρεσίες ειδοποίησης το URL είναι το διαπιστευτήριο. Δείτε [Ειδοποιήσεις συναγερμών](/el/iot/notifications/).

### `GET /api/notify/escalation`

Η πολιτική κλιμάκωσης συναγερμών, τα κανάλια που μπορεί να κατονομάσει ένα βήμα και οι αλυσίδες που είναι ανοιχτές αυτή τη στιγμή. Το `available` είναι `false`, με απενεργοποιημένη πολιτική και χωρίς κανάλια, όταν το `HOTLOOP_NOTIFY_ENABLED` δεν είναι ορισμένο· η απάντηση παραμένει `200`. Μόνο για διαχειριστές τόσο για ανάγνωση όσο και για εγγραφή: η πολιτική περιέχει τα ntfy topics των ανθρώπων, που σε διακομιστή που τον φτάνει ο καθένας είναι κωδικοί πρόσβασης.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

Τα `channels` είναι αυτά που έχει ρυθμίσει αυτό το HotLoop, που είναι όλα όσα μπορεί να κατονομάσει ένα βήμα. Το `active` είναι κάθε συναγερμός που διατρέχει την αλυσίδα: πόσες αποστολές έχουν φύγει από όσες έχει η πολιτική (βήματα, μετά επαναλήψεις), και πότε είναι η επόμενη. Αν δεν έχει αποθηκευτεί τίποτα ακόμη είναι `{"policy":{"enabled":false},...}`: απενεργοποιημένη, χωρίς τίποτα μέσα.

### `PUT /api/notify/escalation`

Αντικαθιστά ολόκληρη την πολιτική, δεν είναι patch, και απαντά ό,τι θα απαντούσε το `GET`. Ισχύει για συναγερμούς που ενεργοποιούνται από τώρα και μετά. `400` όταν οι ειδοποιήσεις δεν είναι ενεργοποιημένες.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

Το `minPriority` είναι `critical`, `high` (η προεπιλογή), `medium` ή `low`. Ένα βήμα οφείλεται `afterMinutes` (1 έως 1440) μετά το προηγούμενο, το πρώτο μετά την ενεργοποίηση, και κατονομάζει `contacts` από τη λίστα, `channels` που έχει η εγκατάσταση, ή και τα δύο. Το πολύ 10 βήματα, 50 επαφές και 20 επαναλήψεις. Τα άγνωστα πεδία απορρίπτονται.

`400` με τον λόγο όταν η πολιτική δεν μπορεί να λειτουργήσει, με λόγια πάνω στα οποία μπορείτε να δράσετε: ένα βήμα που δεν κατονομάζει κανέναν, μια επαφή που δεν είναι στη λίστα, ένα κανάλι που αυτό το HotLoop δεν έχει ρυθμίσει (η απάντηση απαριθμεί αυτά που έχει), ένα ntfy topic χωρίς ρυθμισμένο ntfy ή μια διεύθυνση χωρίς ρυθμισμένο email, μια διεύθυνση που δεν είναι απλή, μια επανάληψη χωρίς διάστημα. Τίποτα δεν αποθηκεύεται όταν απορρίπτεται. Η αποθήκευσή της βρίσκεται στο αρχείο καταγραφής συστήματος, χωρίς τα topics. Δείτε [Ειδοποιήσεις συναγερμών](/el/iot/notifications/#κλιμάκωση).

### `POST /api/notify/ack/{token}`

Το κουμπί **Αναγνώριση** μιας ειδοποίησης ntfy. Το τηλέφωνο που το πατά δεν έχει συνεδρία να στείλει, οπότε **δεν υπάρχει συνεδρία ούτε άδεια**: το υπογεγραμμένο token στη διαδρομή είναι η εξουσιοδότηση, και ό,τι εξουσιοδοτεί είναι η αναγνώριση μιας εμφάνισης ενός συναγερμού, μία φορά, πριν λήξει (`HOTLOOP_NOTIFY_ACK_TTL`, 12 ώρες από προεπιλογή). Ένα κουμπί από το χθεσινό ταξίδι δεν μπορεί να αναγνωρίσει το σημερινό. Είναι `POST` επίτηδες: οι προεπισκοπήσεις συνδέσμων και οι σαρωτές ασφαλείας ανοίγουν συνδέσμους μόνοι τους, και ένας συναγερμός δεν πρέπει ποτέ να αναγνωρίζεται από ρομπότ. Χωρίς σώμα. Απαντά με τον συναγερμό ως αναγνωρισμένο (το σχήμα, από τον χειριστή· τα άλλα παραδείγματα σε αυτό το έγγραφο καταγράφηκαν από Gateway που έτρεχε, αυτό όχι, επειδή εκείνο το Gateway δεν είχε ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Με απενεργοποιημένους τους συνδέσμους αναγνώρισης:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Είναι μια συνηθισμένη αναγνώριση μέσω της μηχανής συναγερμών, ελεγμένη υπό `notify:<channel>`. Κάθε άρνηση απαντάται και καταγράφεται, επειδή ένα κουμπί που αθόρυβα δεν κάνει τίποτα μοιάζει ακριβώς με ένα που κανείς δεν πάτησε:

| Κατάσταση | Πότε |
|---|---|
| 403 | Πλαστό, αλλοιωμένο ή υπογεγραμμένο με άλλο μυστικό |
| 404 | Ο συναγερμός δεν υπάρχει πια, ή οι σύνδεσμοι αναγνώρισης είναι απενεργοποιημένοι (χρειάζονται `HOTLOOP_PUBLIC_URL` και κανάλι με κουμπί) |
| 409 | Έχει ήδη χρησιμοποιηθεί, ο συναγερμός ενεργοποιήθηκε ξανά από τότε, ή δεν έχει μείνει τίποτα για αναγνώριση |
| 410 | Γνήσιο, αλλά ληγμένο |
| 503 | Η αναγνώριση δεν μπόρεσε να αποθηκευτεί· ο σύνδεσμος επιστρέφεται ώστε ένα δεύτερο πάτημα να μπορεί ακόμη να δουλέψει |

Η απάντηση φέρει `Access-Control-Allow-Origin: *` ώστε η web εφαρμογή ntfy να μπορεί να το πατήσει από τη δική της προέλευση· τίποτα σε αυτή τη διαδρομή δεν διαβάζει cookie. Το token δεν καταγράφεται ποτέ και δεν επιστρέφεται πουθενά. Δείτε [Ειδοποιήσεις συναγερμών](/el/iot/notifications/#σύνδεσμοι-αναγνώρισης).

## Αντίγραφα ασφαλείας

Λογικά στιγμιότυπα της βάσης δεδομένων, μόνο με δεδομένα πινάκων. Χρειάζεται `HOTLOOP_BACKUP_ENABLED`. Και τα δύο μόνο για διαχειριστές: μια λίστα δείχνει τον αριθμό γραμμών κάθε πίνακα, μαζί με χρήστες και συνεδρίες. **Δεν υπάρχει endpoint επαναφοράς**, επίτηδες: η επαναφορά είναι σημαία του εκτελέσιμου, που τρέχει μία φορά από κάποιον που ξέρει ότι η βάση δεδομένων προορίζεται να τη δεχτεί, ποτέ δικτυακή κλήση απέναντι σε μια ζωντανή. Δείτε [Αντίγραφα ασφαλείας και επαναφορά](/el/iot/backup/#επαναφορά-ενός-αντιγράφου).

### `GET /api/backup`

Τα αντίγραφα ασφαλείας στον τόμο, το καθένα με το μανιφέστο του.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Παίρνει ένα τώρα και το περιμένει (έως 30 λεπτά: ένα μεγάλο `tag_history` παίρνει ώρα). Χωρίς σώμα. Απαντά με το μανιφέστο: έκδοση, μεταναστεύσεις, και τις γραμμές και τις στήλες κάθε πίνακα.

## Προγραμματισμένες αναφορές

Περιλήψεις του ιστορικού ως CSV και HTML, με πρόγραμμα, με email ή λήψη. Χρειάζεται `HOTLOOP_REPORTS_ENABLED`. Οι θεατές διαβάζουν, οι χειριστές εκτελούν, οι διαχειριστές ορίζουν: ένας ορισμός κατονομάζει πού στέλνονται με email τα δεδομένα του εργοστασίου. Δείτε [Προγραμματισμένες αναφορές](/el/gateway/reports/) για τα πεδία του ορισμού.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Κάθε ορισμός φέρει `nextRunAt` και την πιο πρόσφατη εκτέλεσή του ως `lastRun`.

### `POST /api/reports`

Δημιουργεί έναν ορισμό· το σώμα είναι ο ορισμός όπως παραπάνω. `201`. `400` σε αποτυχία επικύρωσης (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` αν το id υπάρχει.

### `GET /api/reports/{id}`

Ένας ορισμός, όπως στη λίστα. `404` για άγνωστο.

### `PUT /api/reports/{id}`

Αντικαθιστά ολόκληρο τον ορισμό. Το id δεν μπορεί να αλλάξει (`400` αν διαφέρει αυτό του σώματος). Τα `nextRunAt` και `lastRun` γίνονται δεκτά και αγνοούνται, ώστε να μπορείτε να στείλετε πίσω ό,τι διαβάσατε.

### `DELETE /api/reports/{id}`

Τον διαγράφει μαζί με τις εκτελέσεις και τα αρχεία του, ακυρώνοντας μια εκτέλεση σε εξέλιξη. `{"deleted":"line1-hourly"}`, ή `404`.

### `POST /api/reports/{id}/run`

Τον εκτελεί τώρα και περιμένει. Το `?deliver=false` τον παράγει και τον αποθηκεύει χωρίς να στείλει email σε κανέναν, για να δοκιμάσετε έναν ορισμό. Το `200` σημαίνει ότι η εκτέλεση έγινε· το δικό της `status` λέει αν η αναφορά δούλεψε. Μια εκτέλεση που αποτυγχάνει είναι αποτέλεσμα, όχι κακό αίτημα, και καταγράφεται και στις δύο περιπτώσεις.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` για `deliver` που δεν είναι true ή false, `404` για άγνωστη αναφορά.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, πρώτες οι νεότερες, `?limit=` προεπιλογή 50, το πολύ 500. `404` για άγνωστη αναφορά, όχι κενή λίστα.

### `GET /api/reports/{id}/runs/{run}/download`

Μεταδίδει ένα αποθηκευμένο αρχείο ως συνημμένο. `?format=csv` ή `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

Το HTML σερβίρεται με Content-Security-Policy `sandbox`: μια αναφορά είναι έγγραφο για ανάγνωση, όχι σελίδα που της επιτρέπεται να τρέξει οτιδήποτε. Το αρχείο που ανοίγει είναι αυτό που κατονομάζει η εγγραφή της εκτέλεσης· τίποτα στο URL δεν γίνεται μέρος διαδρομής. `400` για αριθμό εκτέλεσης που δεν είναι αριθμός ή μορφή που δεν είναι καμία από τις δύο, `404` για εκτέλεση ή αρχείο που δεν υπάρχει.

## Τοποθεσίες

### `GET /api/sites`

Κάθε τοποθεσία που ομοσπονδεί το Gateway, με ερώτηση για την κατάσταση του εργοστασίου της μέσω MCP παράλληλα, 6 δευτερόλεπτα η καθεμία, ώστε μια νεκρή τοποθεσία να μην καθυστερεί τις υπόλοιπες. Οι τοποθεσίες είναι οι εξερχόμενοι διακομιστές MCP στη ρύθμιση. Δείτε [MCP](/el/iot/mcp/#ομοσπονδία-τοποθεσιών).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Οι μετρήσεις μιας μη προσβάσιμης τοποθεσίας δεν σημαίνουν τίποτα και αφήνονται έξω από το σύνολο: το να μετρηθεί ως μηδέν συναγερμοί μια τοποθεσία που δεν φτάνεις θα ήταν το πιο επικίνδυνο πράγμα που θα μπορούσε να κάνει αυτή η οθόνη. Χωρίς ρυθμισμένες τοποθεσίες: `{"configured":false,"sites":[]}`.

## Ρυθμίσεις

### `GET /api/settings`

Κάθε ρύθμιση, η ισχύουσα τιμή της, από πού προήλθε η τιμή και η μεταβλητή που την ορίζει:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

Το `source` είναι `stored`, `environment` ή `default`. Ένα `secret` είναι πάντα μόνο `set` ή `not set`. Το `envVar` είναι η μεταβλητή από την οποία προήλθε η τιμή. Μερικές ρυθμίσεις καταφεύγουν σε δεύτερη μεταβλητή όταν αυτή με `HOTLOOP_` είναι κενή (`TZ` για τη ζώνη ώρας, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` και `POSTGRES_PASSWORD` για τη βάση δεδομένων), και όταν ισχύει η εφεδρική, το `envVar` την κατονομάζει. Μια μεταβλητή ορισμένη σε κενή συμβολοσειρά μετρά ως μη ορισμένη, όπως τη χειρίζεται η ρύθμιση. Οι ρυθμίσεις δειγματοληψίας εμφανίζονται σε χιλιοστά του δευτερολέπτου, αλλά οι μεταβλητές τους δέχονται διάρκεια (`5s`, `500ms`) ή απλό αριθμό δευτερολέπτων.

Το `product` στην ομάδα `Server` λέει ποιο HotLoop είναι αυτό. Μια λειτουργία που δεν έχει αυτό το προϊόν και που η εγκατάσταση ενεργοποίησε παρ' όλα αυτά (π.χ. `HOTLOOP_REPORTS_ENABLED=true` στο IoT) δεν το εμποδίζει να ξεκινήσει. Καταγράφεται ως προειδοποίηση κατά την εκκίνηση και απαριθμείται εδώ σε μια επιπλέον ομάδα, `Not in this product`, με τη μεταβλητή της και μια γραμμή που λέει πού ζει. Η ρύθμιση μένει ακριβώς όπως είναι, ώστε η ίδια διαμόρφωση σε προϊόν που έχει τη λειτουργία να την ενεργοποιεί. Όταν δεν έχει οριστεί κάτι τέτοιο, η ομάδα δεν υπάρχει.

### `PUT /api/settings`

Αλλάζει τις ρυθμίσεις ταυτότητας του εργοστασίου, και μόνο αυτές:

| Κλειδί | Τύπος |
|---|---|
| `ui.plantName` | string, το πολύ 200 χαρακτήρες |
| `ui.siteId` | string, το πολύ 200 χαρακτήρες |
| `ui.timezone` | ένα όνομα IANA που γνωρίζει αυτό το μηχάνημα (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | ένας ακέραιος αριθμός δευτερολέπτων, 10 έως 43200: πόσο επιβιώνει η σύνδεση ενός kiosk χωρίς να αγγίζει κανείς το πάνελ. Προεπιλογή 900 |
| `ui.lockoutAttempts` | ένας ακέραιος, 0 έως 100: λάθος κωδικοί ή PIN στη σειρά που κλειδώνουν έναν λογαριασμό. Προεπιλογή 10, και το 0 σημαίνει καθόλου κλείδωμα |
| `ui.panelDelaySeconds` | ένας ακέραιος αριθμός δευτερολέπτων, 0 έως 30: το μέγιστο που περιμένει ένα πάνελ kiosk πριν ελέγξει το επόμενο PIN που πληκτρολογήθηκε χωρίς όνομα χρήστη, μετά από λάθος. Προεπιλογή 3, και το 0 σημαίνει καθόλου αναμονή |
| `ui.lockoutSeconds` | ένας ακέραιος αριθμός δευτερολέπτων, 10 έως 86400: πόσο μένει κλειδωμένος ένας κλειδωμένος λογαριασμός. Προεπιλογή 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Απαντά με όλες τις ρυθμίσεις, όπως το `GET`. Οποιοδήποτε άλλο κλειδί δίνει 400 που το κατονομάζει:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Αυτό είναι σκόπιμο. Οι διακόπτες εγγραφής αποφασίζουν αν αυτή η διεργασία μπορεί να κινήσει μηχανήματα, και ένας έλεγχος που μπορεί να ενεργοποιηθεί από τον ίδιο περιηγητή που εκδίδει τις εγγραφές δεν είναι έλεγχος. Η αλλαγή τους είναι μια εγκατάσταση.

## Στόχοι ιστορικού

Οι δικές του βάσεις δεδομένων του εργοστασίου, στις οποίες το HotLoop γράφει το ιστορικό του επιπλέον της δικής του. Δείτε [Στόχοι ιστορικού](/el/iot/historian-targets/). Κάθε ρόλος που διαβάζει τις ρυθμίσεις τους βλέπει και πώς τα πάει ο καθένας. Η αλλαγή ενός είναι μόνο για διαχειριστές, επειδή ένας στόχος είναι ένα μέρος όπου πηγαίνουν δεδομένα του εργοστασίου. Οι κωδικοί σφραγίζονται με το κλειδί διαπιστευτηρίων συσκευής (`HOTLOOP_SECRET_KEY_FILE`) και δεν επιστρέφονται ποτέ· το `passwordSet` λέει αν υπάρχει αποθηκευμένος, και το `passwordProblem` γιατί ένας αποθηκευμένος δεν μπορεί να ανοιχτεί. Κάθε αλλαγή μπαίνει στο αρχείο καταγραφής και ισχύει αμέσως.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

Τα `kinds` είναι οι βάσεις δεδομένων στις οποίες γράφει αυτό το HotLoop, και πώς η καθεμία ονομάζει τα πεδία της: το InfluxDB έχει token εκεί που οι άλλες έχουν κωδικό (το `password` το μεταφέρει), bucket εκεί που έχουν βάση δεδομένων (`database`), measurement εκεί που έχουν πίνακα (`table`), και έναν οργανισμό (`org`) που καμία από τις άλλες δεν έχει. Το `status.state` είναι `up`, `catching-up` (ενεργός, και στέλνει ακόμα ό,τι του οφείλεται από το ιστορικό του ίδιου του HotLoop), `down`, `starting` ή `off` (απενεργοποιημένος). Το `queued` είναι ό,τι περιμένει στη μνήμη, από το `queueCap`. Το `written` μετρά τις μετρήσεις που στάλθηκαν ζωντανά και το `backfilled` αυτές που στάλθηκαν από το ιστορικό του ίδιου του HotLoop. Το `dropped` μετρά τις μετρήσεις που άφησε η ουρά ενώ ο στόχος δεν προλάβαινε: οφείλονται, δεν χάθηκαν. Το `refused` μετρά τις μετρήσεις που η ίδια η βάση δεν δέχτηκε, με τον λόγο της στο `lastRefusal`. Τα `owedFrom` και `owedTo` είναι ό,τι οφείλεται ακόμα· το `owedTo` λείπει όσο το τέλος είναι ακόμη ανοιχτό, κάτι που ισχύει για όσο ο στόχος είναι κάτω.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Το `id` είναι 1 έως 63 πεζά γράμματα, ψηφία και `-`, και κατονομάζει τον στόχο στο αρχείο καταγραφής συστήματος. Το `address` είναι `host` ή `host:port`, χωρίς login μέσα· η προεπιλεγμένη θύρα του είδους συμπληρώνει μια που λείπει. Το `table` είναι από προεπιλογή το `defaultTable` του είδους και μπορεί να φέρει σχήμα (`history.hotloop`). Το `org` είναι ο οργανισμός του InfluxDB 2. Το `enabled` είναι από προεπιλογή true. Ένας κωδικός χρειάζεται κλειδί: χωρίς `HOTLOOP_SECRET_KEY_FILE` είναι `400`, ποτέ αποθηκευμένος ως απλό κείμενο. `201` με τον στόχο και την κατάστασή του· `409` για id που χρησιμοποιείται.

### `PUT /api/historian/targets/{id}`

Οποιοδήποτε από τα παραπάνω πεδία εκτός από το `id`· ό,τι δεν στέλνεται μένει. Το `"password":""` καθαρίζει τον κωδικό. Μια αλλαγή ξεκινά τον στόχο από την αρχή με τις νέες ρυθμίσεις του, και ό,τι του οφειλόταν εξακολουθεί να του οφείλεται. `200` με τον στόχο.

### `DELETE /api/historian/targets/{id}`

Σταματά να γράφει σε αυτόν και ξεχνά ό,τι του οφειλόταν. Ό,τι ήδη κρατά μένει στη βάση του. Απενεργοποιήστε τον με `"enabled":false` αντί γι' αυτό, για να κρατήσετε τις ρυθμίσεις. `200` `{"deleted":"plant-pg"}`.

## Αρχείο καταγραφής συστήματος

### `GET /api/events`

Κάθε αλλαγή, εγγραφή, σύνδεση και μετάβαση σύνδεσης, πρώτα τα νεότερα.

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `category` | Επαναλαμβανόμενο: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Επαναλαμβανόμενο: `debug`, `info`, `warning`, `error` |
| `subject` | Ακριβώς: ένα id συσκευής, ένα κλειδί tag, ένα entity_id, `equipment:4`, `label:critical` |
| `q` | Αναζήτηση χωρίς διάκριση πεζών και κεφαλαίων |
| `minutes` | Μόνο τα τελευταία N λεπτά |
| `limit` | Προεπιλογή 200, το πολύ 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

Το `actor` είναι χρήστης, `system`, `automation:<id>` ή `mcp:<client>`. Το `detail`, όταν υπάρχει, είναι επιπλέον JSON ως συμβολοσειρά.

## Ημερολόγιο

### `GET /api/logbook`

Μία χρονολογική σειρά όσων συνέβησαν, πρώτα τα νεότερα: αλλαγές κατάστασης οντοτήτων, εγγραφές, μεταβάσεις συναγερμών, εκτελέσεις αυτοματισμών και scripts, και αλλαγές ρύθμισης και κλήσεις υπηρεσιών από το αρχείο καταγραφής συστήματος. Τα ίχνη διαβάζονται εκεί που βρίσκονται και συγχωνεύονται, ώστε το καθένα να κρατά τη δική του διατήρηση. Οι αριθμητικές μετρήσεις δεν είναι μέσα σε αυτό: γι' αυτό υπάρχει το `GET /api/history`. Δείτε [το ημερολόγιο](/el/iot/logbook/).

| Ερώτημα | <span class="sr-only">Λεπτομέρειες</span> |
|---|---|
| `entity` | Μόνο ό,τι αφορά αυτή την οντότητα: οι αλλαγές κατάστασής της, οι εγγραφές σε αυτήν και στα tags της, οι συναγερμοί της, οι εκτελέσεις αυτοματισμών που ενεργοποιεί ή που έγραψαν σε αυτήν, οι αλλαγές ρύθμισης σε αυτήν |
| `equipment_id` | Μόνο ό,τι συνέβη σε αυτόν τον κόμβο του δέντρου εξοπλισμού ή κάτω από αυτόν, με τον ίδιο κανόνα. Όχι μαζί με το `entity` |
| `actor` | Τμήμα, χωρίς διάκριση πεζών και κεφαλαίων, του ποιος το έκανε: χρήστης, `automation:<id>`, `mcp:<client>` |
| `kinds` | Χωρισμένα με κόμμα ή επαναλαμβανόμενα: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Ώρες RFC 3339· το `from` συμπεριλαμβάνεται, το `to` αποκλείεται |
| `limit` | Προεπιλογή 100, το πολύ 1000 |
| `before` | Το `next` της προηγούμενης σελίδας |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

Το `id` είναι το id της γραμμής στο δικό της ίχνος (για αλλαγή κατάστασης, το αμετάβλητο id της οντότητας), και μαζί με τα `at` και `kind` είναι αυτό που κωδικοποιεί το `next`: η σελίδα μετά από αυτή είναι ό,τι είναι αυστηρά παλαιότερο με αυτή τη σειρά, ό,τι κι αν προστέθηκε στο μεταξύ. Το `next` παραλείπεται στην τελευταία σελίδα. Το `suppressed` είναι πόσες αλλαγές αυτής της οντότητας πριν από αυτή δεν καταγράφηκαν, επειδή άλλαζε πιο γρήγορα από δέκα ταυτόχρονα και μετά μία κάθε δύο δευτερόλεπτα.

`400` για άγνωστο είδος, κακοσχηματισμένη ώρα, `from` όχι πριν από το `to`, όριο πάνω από 1000, επινοημένο cursor, ή `entity` και `equipment_id` μαζί· `404` για κόμβο που δεν υπάρχει. `503` όταν το ημερολόγιο δεν τρέχει στη διεργασία που απαντά.

## Ζωντανή ροή

### `GET /api/stream`

Server-sent events, μονόδρομα, για όσο το κρατάτε ανοιχτό. SSE αντί για WebSocket επειδή η κίνηση πηγαίνει μόνο προς τη μία κατεύθυνση, και μια ροή γεγονότων επανασυνδέεται μόνη της όταν το pod επανεκκινεί κάτω από έναν ανοιχτό πίνακα ελέγχου. Το `EventSource` στέλνει το cookie συνεδρίας· ένα script στέλνει το bearer token.

Κατά τη σύνδεση παίρνετε `retry: 3000` και μετά την τρέχουσα εικόνα, ώστε μια οθόνη να γεμίσει πριν αλλάξει οτιδήποτε:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Μετά, καθώς συμβαίνουν τα πράγματα:

| Γεγονός | Δεδομένα | Πότε |
|---|---|---|
| `values` | Ένας πίνακας μετρήσεων, το σχήμα του `GET /api/values`, η νεότερη ανά tag, **μόνο τα tags των οποίων η μέτρηση άλλαξε** | Κάθε 250 ms, αν άλλαξε κάποια. Ένα tag του οποίου η τιμή, το κείμενο, η μονάδα, η ποιότητα και ο λόγος είναι ίδια με του τελευταίου που στάλθηκε αφήνεται έξω, και στέλνεται ξανά όταν περάσουν 30 δευτερόλεπτα χωρίς αποστολή, ώστε το `timestamp` μιας σταθερής τιμής να μην είναι ποτέ παλαιότερο από αυτό. Ένας driver διαβάζει κάθε tag σε κάθε δειγματοληψία· το 4.19.5 τα έστελνε όλα κάθε φορά (περίπου 150 KB τέσσερις φορές το δευτερόλεπτο για τα 2232 tags ενός tester) και μια σελίδα σε αργή σύνδεση έμενε πίσω λεπτά |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Κάθε 250 ms, αν άλλαξε η κατάσταση κάποιας οντότητας. Το `removed` είναι οντότητα που απενεργοποιήθηκε, διαγράφηκε ή μετονομάστηκε |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, ο συναγερμός και τι του συνέβη (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Αμέσως: οι μεταβάσεις συναγερμών είναι σπάνιες και η καθεμία μετράει |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Αμέσως: η οθόνη πρέπει να κοκκινίσει όταν πέφτει μια συσκευή, όχι στην επόμενη αποστολή |
| `logbook` | `{"kinds":["state","write"]}`, ποια είδη εγγραφών του ημερολογίου έχουν κάτι καινούργιο | Το πολύ μία φορά το δευτερόλεπτο. Χωρίς εγγραφές μέσα του, επειδή ό,τι πρέπει να δείξει μια οθόνη εξαρτάται από τα φίλτρα της: ζητά από το `GET /api/logbook` τη δική της σελίδα |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Μια γραμμή σχολίου (`: heartbeat 2026-09-27T20:35:00Z`) κάθε 20 δευτερόλεπτα εμποδίζει τους proxies να κλείσουν μια αδρανή σύνδεση. Κάθε ανοιχτή σελίδα έχει τον δικό της ρυθμό: ο γραφέας της ξεκουράζεται όσο κράτησε η τελευταία του αποστολή (το πολύ πέντε δευτερόλεπτα), και ό,τι φτάνει στο μεταξύ κρατιέται ανά tag και ανά οντότητα, μόνο το νεότερο, ώστε μια σελίδα σε αργή σύνδεση να μένει μία ή δύο αποστολές πίσω από το εργοστάσιο, ποτέ λεπτά, να μη χάνει τίποτα και να μη στερεί τίποτα από τις άλλες σελίδες. Η ροή συμπιέζεται με gzip όταν το αίτημα λέει `Accept-Encoding: gzip` (ένας περιηγητής το κάνει), κάτι που κατεβάζει την πρώτη εικόνα ενός tester από περίπου 326 KB σε περίπου 11 KB στο καλώδιο. Η απάντηση ορίζει `X-Accel-Buffering: no`, επειδή ένας proxy που κάνει buffering μετατρέπει μια ζωντανή ροή σε πολύ αργή λήψη.

Η ροή ξανακοιτάζει τη συνεδρία της κάθε πέντε δευτερόλεπτα και κλείνει όταν η συνεδρία έχει φύγει: αποσυνδέθηκε, έληξε, ανακλήθηκε, ή ο λογαριασμός απενεργοποιήθηκε ή δεν επιτρέπεται πια `status.read`. Δεν στέλνει γεγονός πρώτα. Το `EventSource` ενός περιηγητή επανασυνδέεται, παίρνει το `401` παραπάνω και σταματά. Με `HOTLOOP_AUTH_INSECURE=true` δεν υπάρχει συνεδρία ούτε κάτι να ελεγχθεί. Ο έλεγχος δεν μετράει ως χρήση της συνεδρίας, οπότε μια οθόνη που μένει ανοιχτή δεν κρατά φρέσκια μια συνεδρία.

## MCP

### `/mcp` και `/mcp/`

Το Model Context Protocol, μεταφορά streamable HTTP, για πράκτορες. Οποιαδήποτε μέθοδος: η μεταφορά χρησιμοποιεί `POST` για κλήσεις, `GET` για τη δική του ροή του διακομιστή και `DELETE` για τον τερματισμό μιας συνεδρίας. Η διαδρομή είναι `HOTLOOP_MCP_PATH` (`/mcp` από προεπιλογή) και το endpoint υπάρχει μόνο όταν το `HOTLOOP_MCP_ENABLED` είναι ενεργό.

**Δεν** βρίσκεται πίσω από τη σύνδεση συνεδρίας. Έχει δικό του bearer token, `HOTLOOP_MCP_TOKEN`, που ελέγχεται μπροστά από τον χειριστή ώστε ένας καλών χωρίς αυτό να μην μπορεί ούτε να απαριθμήσει τα εργαλεία:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Χωρίς ρυθμισμένο token, το HotLoop φτιάχνει ένα στην πρώτη εκκίνηση και το κρατά στη βάση δεδομένων του (το `hotloop mcp-token` το τυπώνει), οπότε το endpoint δεν είναι ποτέ ανοιχτό. Ένας πράκτορας είναι καλών όπως κάθε άλλος: διαβάζει και γράφει, οι εγγραφές του περνούν από την ίδια πύλη εγγραφής με όλων, και ελέγχονται ως `mcp:<client name>`. Τα εργαλεία και οι πόροι βρίσκονται στο [MCP](/el/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

απαντά με επικεφαλίδα `Mcp-Session-Id` και τις δυνατότητες και οδηγίες του διακομιστή.

## Το περιβάλλον χρήστη

### `GET /manifest.webmanifest`

Το manifest της web εφαρμογής που επιτρέπει σε ένα τηλέφωνο να εγκαταστήσει το περιβάλλον ως εφαρμογή: το όνομα του προϊόντος και του εργοστασίου, `display` `standalone`, τα χρώματα του θέματος, τα εικονίδια (PNG 192 και 512 pixel, ένα maskable 512 και το SVG) και συντομεύσεις προς τους Συναγερμούς και τους Πίνακες ελέγχου. Κάθε URL μέσα του είναι σχετικό με του ίδιου του manifest, οπότε είναι σωστό όπου κι αν είναι προσαρτημένο το HotLoop. Το όνομα ακολουθεί το όνομα εργοστασίου που ορίζεται στις Ρυθμίσεις, και η απάντηση είναι `Cache-Control: no-cache` ώστε μια μετονομασία να φαίνεται στην επόμενη ματιά. Καμία συνεδρία: ένα τηλέφωνο ρωτά πριν έχει συνδεθεί κανείς. Δείτε [Πίνακες ελέγχου](/el/iot/dashboards/#στο-κινητό).

### `GET /sw.js`

Το service worker, στη ρίζα του σημείου όπου είναι προσαρτημένο το HotLoop, ώστε το πεδίο του να καλύπτει ολόκληρη την εφαρμογή. Κρατά τη σελίδα και την τελευταία απάντηση στις αναγνώσεις που κοιτάζει ένα άτομο, και τις απαντά σημειωμένες ως παλιές όταν το HotLoop δεν μπορεί να προσεγγιστεί. Ποτέ δεν απαντά, κρατά ή βάζει σε ουρά μια εγγραφή. Η έκδοση που τρέχει βρίσκεται μέσα του, οπότε κάθε κυκλοφορία έχει δική της κρυφή μνήμη σελίδων. `Cache-Control: no-cache`· καμία συνεδρία. Μόνο ένας περιηγητής σε ασφαλές πλαίσιο (https, ή `localhost`) το τρέχει.

### `GET /next` και `GET /next/`

Εκεί που ζούσε το περιβάλλον όσο το παλιό ήταν το προεπιλεγμένο. Και τα δύο είναι `301` προς τη ρίζα, οπότε ένας σελιδοδείκτης που έγινε τότε εξακολουθεί να φτάνει.

### `/`

Το web περιβάλλον, χτισμένο από το `web/` μέσα στο εκτελέσιμο: μια σελίδα, τα scripts, τα στυλ και οι γραμματοσειρές της, ένα service worker και τα εικονίδια της εγκαταστάσιμης εφαρμογής, με κάθε URL σε αυτά σχετικό με τη σελίδα ώστε να τρέχει στη ρίζα ενός host, κάτω από μια διαδρομή, πίσω από έναν proxy ή μέσα στο iframe του πίνακα ελέγχου του EmberNet. Ο διακομιστής συμπληρώνει τον τίτλο και ένα μπλοκ δεδομένων, `<script type="application/json" id="iiot">`, με ό,τι ξέρει μόνο αυτός: το εργοστάσιο, την τοποθεσία, το προϊόν, τις λειτουργίες, την πολιτική εγγραφής και τη ζώνη ώρας. Μόνο `GET` και `HEAD`· οποιαδήποτε άλλη μέθοδος είναι `405`. Μια διαδρομή που δεν είναι ένα από τα αρχεία του είναι `404`, επειδή το σερβίρισμα της σελίδας για ένα τυπογραφικό λάθος θα την έκανε να μοιάζει με οθόνη που δουλεύει, και ένα εκτελέσιμο χτισμένο χωρίς το περιβάλλον το λέει σε απλό κείμενο και πώς να το χτίσετε. Καμία συνεδρία: η σελίδα είναι η φόρμα σύνδεσης μέχρι να συνδεθείτε.
