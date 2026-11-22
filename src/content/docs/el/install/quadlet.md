---
title: "Podman Quadlet σε Pi"
description: "Τρέξτε το HotLoop ως πραγματικές υπηρεσίες systemd σε Pi ή μικρό βιομηχανικό PC με Podman Quadlet, χωρίς Docker, χωρίς Compose και χωρίς cluster."
---

Για ένα Pi ή ένα μικρό βιομηχανικό PC που **δεν** ανήκει σε cluster k3s. Αν ανήκει, χρησιμοποιήστε το chart του προϊόντος. Αυτός ο κατάλογος και τα charts είναι οι δύο υποστηριζόμενοι τρόποι για να τρέξετε το HotLoop.

Χωρίς Docker και χωρίς αυτόνομο `podman run` από ένα shell που πεθαίνει με τη συνεδρία. Το Quadlet μετατρέπει τα containers σε πραγματικές υπηρεσίες systemd: ξεκινούν με την εκκίνηση χωρίς συνδεδεμένο χρήστη, επανεκκινούνται σε αποτυχία και γράφουν στο journald.

| Κατάλογος | Προϊόν | Image |
|---|---|---|
| `iot/` | HotLoop IoT, με PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, με TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, με TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| αυτός ο κατάλογος | HotLoop Edge Relay, χωρίς βάση δεδομένων | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[Η σελίδα των προϊόντων](/el/products/) λέει ποιο χρειάζεστε.

Καθένα από τα τρία πρώτα έχει και κατάλογο `sqlite/`: το ίδιο προϊόν με τη βάση δεδομένων ως αρχείο και χωρίς container βάσης. Δείτε [SQLite αντί για PostgreSQL](#sqlite-αντί-για-postgresql).

## IoT, Edge και το Gateway

Κάθε κατάλογος έχει τις ίδιες μονάδες και ένα script:

- **`hotloop.network`**: το δίκτυο που μοιράζονται η εφαρμογή και η βάση της. Η εφαρμογή φτάνει τη βάση με το όνομά της (`hotloop-db:5432`) και τίποτα άλλο στο μηχάνημα δεν μπορεί, επειδή η βάση δεν δημοσιεύει καμία θύρα. Δημοσιεύεται μόνο η 8080 της εφαρμογής.
- **`hotloop.container`**: η εφαρμογή. Η κεφαλίδα του έχει τα βήματα εγκατάστασης· διαβάστε την πριν αντιγράψετε οτιδήποτε.
- **`hotloop-db.container`**: η βάση δεδομένων, το ίδιο image και η ίδια έκδοση που τρέχει το chart αυτού του προϊόντος. Δηλώνει ότι ξεκίνησε μόλις απαντήσει, ώστε η εφαρμογή να περιμένει μια βάση που μπορεί να χρησιμοποιήσει.
- **`hotloop-db-upgrade.container`** και **`hotloop-db-upgrade.sh`**: η μετάβαση της βάσης από PostgreSQL 16 σε 17, μία φορά. Τρέχει πριν από τη μονάδα της βάσης και μόνο όταν ο τόμος έχει ακόμη δεδομένα 16· σε νέο τόμο, ή σε τόμο που είναι ήδη στο 17, το systemd την παραλείπει. Δείτε [PostgreSQL 16 σε 17](#postgresql-16-σε-17).
- **`hotloop-db.volume`** και **`hotloop-data.volume`**: η βάση δεδομένων και ό,τι γράφει η εφαρμογή κάτω από το `/data` (αντίγραφα ασφαλείας, πιστοποιητικά, η ουρά προώθησης, αναφορές). Ονομασμένοι τόμοι Podman, ώστε το `podman system prune` να τους αφήνει ήσυχους.

Τρία secrets του Podman κρατούν ό,τι δεν ανήκει σε αρχείο: `hotloop-db-password`, `hotloop-secret-key` (κρυπτογραφεί τους κωδικούς των συσκευών στη βάση· κρατήστε αντίγραφο εκτός του μηχανήματος) και `hotloop-admin-password-hash` (το hash bcrypt του κωδικού του πρώτου διαχειριστή, ποτέ ο ίδιος ο κωδικός).

**Podman 5.0 ή νεότερο.** Το Raspberry Pi OS Bookworm έρχεται με Podman 4.3, που δεν έχει καθόλου Quadlet: χρησιμοποιήστε Raspberry Pi OS Trixie (Podman 5.4) ή νεότερο. Οι ενημερώσεις παρακάτω εκτελέστηκαν σε Podman 6.1.3· η μονάδα του Edge Relay, που μοιράζεται τα ίδια κλειδιά, σε 4.9.3. Και βάλτε τον τόμο της βάσης σε SSD USB, όχι στην κάρτα SD. Το ιστορικό γράφει όλη μέρα, και οι κάρτες SD πεθαίνουν ακριβώς από αυτό.

### Γιατί όλα τα προϊόντα χρησιμοποιούν τα ίδια ονόματα

Τα ονόματα των μονάδων, των τόμων και των secrets είναι ίδια στα `iot/`, `edge/` και `gateway/`, επίτηδες. Το να ανεβάσετε ένα μηχάνημα σε μεγαλύτερο προϊόν σημαίνει να αντιγράψετε το `hotloop.container` και το `hotloop-db.container` του μεγαλύτερου προϊόντος πάνω στα δικά σας:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Οι τόμοι και τα secrets μένουν, και μαζί τους κάθε συσκευή, tag, συναγερμός, χρήστης και ώρα ιστορικού. Κάντε πάντως πρώτα αντίγραφο ασφαλείας (`POST /api/backup`). Αυτή η μετάβαση έχει εκτελεστεί, από IoT σε Edge και σε Gateway πάνω στο ίδιο σύνολο τόμων. Η επιστροφή σε μικρότερο προϊόν δεν είναι κίνηση για μηχάνημα που σας νοιάζει.

Σημαίνει επίσης ένα HotLoop ανά μηχάνημα. Δύο θα μάλωναν έτσι κι αλλιώς για τη θύρα 8080.

### Επαληθεύτηκε

Τα αρχεία που παραδίδονται για IoT, Edge και Gateway, ανέγγιχτα, παράγονται με τον generator `quadlet` του Podman 6.1.3 με την ίδια δομή: η εφαρμογή απαιτεί τη βάση και το δίκτυο, δημοσιεύει τη δική της θύρα και φέρει την ετικέτα αυτόματης ενημέρωσης, ενώ η βάση δεν φέρει καμία και δεν δημοσιεύει τίποτα.

Έπειτα οι μονάδες του Gateway τρέχτηκαν πραγματικά: χωρίς root, κάτω από systemd, με τοπικό registry στη θέση του ghcr.io και το δικό τους `podman auto-update` των προϊόντων. Μια πρώτη εκκίνηση με τη βάση υγιή και την εφαρμογή υγιή μετά από αυτήν· μια ενημέρωση σε έκδοση που προσθέτει migration σε πίνακα που η εφαρμογή ήδη χρησιμοποιεί, με την υπάρχουσα συσκευή και τα δεδομένα της άθικτα και χωρίς να επανεκκινηθεί ποτέ το container της βάσης· και μια ενημέρωση σε έκδοση που κάνει migration τη βάση και μετά δεν μπορεί να ξεκινήσει, την οποία το Podman επανέφερε, με την προηγούμενη έκδοση να ξεκινά υγιής πάνω στη βάση που η αποτυχημένη είχε ήδη μεταφέρει. Τα Edge και IoT τρέχουν με τις ίδιες μονάδες και έχουν τρέξει κάτω από systemd σε πραγματικό Pi, σε φυσικό υλικό (2026-11-17).

## PostgreSQL 16 σε 17

Η βάση δεδομένων του HotLoop είναι PostgreSQL 17 από αυτή την έκδοση. Ένα μηχάνημα που έτρεχε προηγούμενη έκδοση έχει δεδομένα PostgreSQL 16, τα οποία η PostgreSQL 17 δεν ανοίγει, οπότε η μετάβαση είναι μια μονάδα που τρέχει πριν από τη βάση. Βάλτε τα νέα αρχεία στη θέση τους και επανεκκινήστε τη βάση, και αυτό είναι όλο:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

Το `hotloop-db.container` απαιτεί τη μονάδα αναβάθμισης, οπότε ένα μηχάνημα στο οποίο αντιγράφηκε μόνο η νέα μονάδα βάσης δεν ξεκινά πάνω σε δεδομένα 16 και το journal λέει γιατί. Η μονάδα αναβάθμισης τρέχει `pg_upgrade` σε λειτουργία αντιγραφής σε νέο κατάλογο δίπλα στον παλιό, ξεκινά τον νέο διακομιστή μία φορά για να αποδείξει ότι ανοίγει και μόνο τότε ανταλλάσσει τα ονόματα· τα παλιά δεδομένα μένουν στον τόμο ως `pgdata.pg16`. Κατεβάζει το image της PostgreSQL 16 μόνο όταν το χρειάζεται ο τόμος. Μια αποτυχία αφήνει τα δεδομένα 16 όπως ήταν και τη βάση ξεκίνητη. Η πλήρης περιγραφή, ο δρόμος της επιστροφής και ο τρόπος διαγραφής του `pgdata.pg16` βρίσκονται στο [k3s και Helm](/el/install/helm/#postgresql-17). Σε εγκατάσταση χωρίς root, η διαδρομή του script στη μονάδα είναι `~/.config/containers/systemd`, από το `%E`.

## SQLite αντί για PostgreSQL

Η βάση δεδομένων είναι ρύθμιση, όχι image (η σελίδα k3s και Helm, "SQLite"). Με το Quadlet αυτό σημαίνει ένα δεύτερο σύνολο αρχείων, όχι δεύτερο image. Ο κατάλογος `sqlite/` κάθε προϊόντος έχει δύο:

- **`sqlite/hotloop.container`**: μόνο η εφαρμογή. Χωρίς `Requires=` σε βάση, χωρίς δίκτυο, χωρίς κωδικό βάσης, και με `HOTLOOP_DB_TYPE=sqlite` και το αρχείο στο `HOTLOOP_DB_PATH=/data/hotloop.db`. Ακολουθεί το `:stable` και επαναφέρει μια κακή ενημέρωση ακριβώς όπως η μονάδα PostgreSQL: ο ίδιος έλεγχος υγείας, το ίδιο `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: ο τόμος `hotloop-data`, όπου βρίσκονται το αρχείο της βάσης και τα `-wal` και `-shm` της. Είναι το ίδιο όνομα τόμου με των αρχείων PostgreSQL, άρα ο ίδιος τόμος δεδομένων αν ποτέ αλλάξετε.

| Κατάλογος | Εγκατάσταση | Secrets |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | τρία |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | δύο: `hotloop-secret-key` και `hotloop-admin-password-hash` |

Εγκαταστήστε το ένα σύνολο ή το άλλο, ποτέ και τα δύο: χρησιμοποιούν τα ίδια ονόματα μονάδων. Η κεφαλίδα του `sqlite/hotloop.container` έχει τα ακριβή βήματα. Εν συντομία:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Μερικά πράγματα που πρέπει να ξέρετε πριν το επιλέξετε. Η SQLite είναι ένας εγγραφέας σε έναν τοπικό δίσκο: ένα Pi βάζει τον τόμο σε SSD USB, και ο αποθηκευτικός χώρος δικτύου δεν είναι επιλογή γιατί η SQLite αλλοιώνεται πάνω του. Το ιστορικό είναι ένας πίνακας με ένα ευρετήριο, όχι partitions ή hypertable, οπότε μια εγκατάσταση με χρόνια ιστορικού ανά δευτερόλεπτο θέλει τα αρχεία PostgreSQL. Και η μετακίνηση ενός μηχανήματος μεταξύ SQLite και PostgreSQL είναι αντίγραφο ασφαλείας και επαναφορά ([Αντίγραφα ασφαλείας και επαναφορά](/el/iot/backup/)), όχι εναλλαγή μονάδων: η νέα βάση ξεκινά άδεια. Μην αντιγράψετε ένα `sqlite/hotloop.container` πάνω σε εγκατάσταση PostgreSQL που τρέχει για να "αλλάξετε"· δεν διαβάζει τα δεδομένα του τόμου PostgreSQL.

Η απλή PostgreSQL σε Edge ή Gateway είναι η μονάδα TimescaleDB με προσθήκη του `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` στο `hotloop.container`. Η μονάδα του IoT είναι ήδη απλή PostgreSQL, και το IoT δεν έχει καθόλου μονάδα TimescaleDB.

### Επαληθεύτηκε (SQLite)

Το `iot/sqlite/hotloop.container` και ο τόμος του τρέχτηκαν χωρίς root σε Podman 4.9.3 κάτω από systemd (`systemctl --user`) από τα δεσμευμένα αρχεία, αλλαγμένα μόνο στα ονόματα, τη θύρα, το image (χτισμένο από το ίδιο δέντρο) και τον κατάλογο εκτέλεσης που χρειάζεται ένας διαχειριστής χρήστη. Η μονάδα ξεκίνησε υγιής, τα `/healthz` και `/readyz` απάντησαν 200, ο διαχειριστής συνδέθηκε από το secret του hash, το `/api/status` απάντησε, τα `hotloop.db`, `hotloop.db-wal` και `hotloop.db-shm` εμφανίστηκαν στον τόμο, και μια επανεκκίνηση δεν εφάρμοσε migrations και συνέδεσε ξανά τον διαχειριστή. Οι μονάδες `sqlite/` των Edge και Gateway είναι το ίδιο αρχείο εκτός από το image και την προεπιλογή διατήρησης, και έχουν τρέξει κάτω από systemd ως root σε πραγματικό Pi, σε φυσικό υλικό (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: προαιρετικό: κρατά τις ενημερώσεις image μέχρι να τις εγκρίνει ένας χειριστής. Ένα drop-in του systemd, όχι μέρος προεπιλεγμένης εγκατάστασης.
- **`edge-relay.container`**, η ίδια η υπηρεσία. Τα πλήρη βήματα εγκατάστασης βρίσκονται στο σχόλιο της δικής της κεφαλίδας· διαβάστε το πριν αντιγράψετε οτιδήποτε.
- **`edge-relay-data.volume`**, ένας ονομασμένος τόμος Podman για την ουρά προώθησης, ώστε οι μετρήσεις στο buffer να επιβιώνουν από επανεκκίνηση του container. Το Podman τον δημιουργεί αυτόματα την πρώτη φορά που ξεκινά η υπηρεσία.
- **`devices.example.json`**, ένα σημείο εκκίνησης για το αρχείο συσκευών. Αντιγράψτε το στο `/etc/edge-relay/devices.json` και επεξεργαστείτε το για τις πραγματικές συσκευές αυτής της εγκατάστασης· η πλήρης μορφή βρίσκεται στην [αναφορά του Edge Relay](/el/edge-relay/reference/).

### Γρήγορη εκκίνηση

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Ενημερώσεις.** Η μονάδα ακολουθεί το `:stable` και ενημερώνεται μόνη της μόλις ο χρονοδιακόπτης του Podman είναι ενεργός:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Αν ένα νέο image δεν περάσει τον έλεγχο υγείας του, το Podman επαναφέρει το παλιό. Η λίστα στόλου του Gateway δείχνει την έκδοση και το digest του image κάθε relay και καταγράφει κάθε αλλαγή. Για να κρατήσετε τις ενημερώσεις μέχρι να τις εγκρίνει ένας διαχειριστής στο Gateway, εγκαταστήστε το `edge-relay-hold.conf` όπως λέει το σχόλιο στην αρχή του αρχείου και κλείστε τον χρονοδιακόπτη. Όσα κάνει αυτό, και όσα δεν μπορεί, βρίσκονται στην [αναφορά του Edge Relay](/el/edge-relay/reference/#updating-a-relay).

Για να εφαρμόσετε μια αλλαγή στο τοπικό αρχείο: επεξεργαστείτε το και μετά τρέξτε `sudo systemctl restart edge-relay.service`. Το relay διαβάζει αυτό το αρχείο κατά την εκκίνηση και δεν το παρακολουθεί.

Ένα αρχείο συσκευών που στέλνει το Gateway δεν χρειάζεται τίποτα από αυτά: εφαρμόζεται ζωντανά, χωρίς επανεκκίνηση. Δεν μπορεί να γραφτεί στο `/etc/edge-relay/devices.json` (είναι προσαρτημένο `:ro` σε root μόνο για ανάγνωση), οπότε μπαίνει στον τόμο δεδομένων ως `/data/pushed-devices.json`, και όσο υπάρχει, αυτό είναι που τρέχει και από το οποίο ξεκινά το relay. Οι αλλαγές σας στο τοπικό αρχείο μένουν αχρησιμοποίητες μέχρι να καθαρίσετε την αποστολή: `DELETE /api/fleet/{id}/config` στο Gateway ενώ το relay τρέχει, και επιστρέφει αμέσως στο τοπικό αρχείο. Το journal λέει σε ποιο αρχείο βρίσκεται, οπότε ελέγξτε εκεί πριν αμφισβητήσετε το JSON σας.

Επαληθεύτηκε με το πραγματικό δυαδικό `quadlet` (`/usr/libexec/podman/quadlet -dryrun` του `podman-5.8.6`): και οι δύο μονάδες αναλύονται καθαρά και παράγουν την αναμενόμενη κλήση `podman run`, με την εξάρτηση τόμου και το secret συνδεδεμένα αυτόματα.
