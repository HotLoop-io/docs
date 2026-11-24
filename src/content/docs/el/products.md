---
title: "Προϊόντα HotLoop: οκτώ σε πέντε γραμμές"
description: "Οκτώ προϊόντα σε πέντε γραμμές εκδόσεων: τι έχει κάθε προϊόν του πυρήνα, ποια βάση δεδομένων τρέχει, πώς εγκαθίστανται και πώς ανεβαίνει μια τοποθεσία."
---

Το HotLoop είναι οκτώ προϊόντα για το εργοστάσιο: τέσσερα που μεγαλώνουν μαζί με μια τοποθεσία (IoT, Edge, Gateway και Edge Relay), συν το Flow για τη σύνδεση της λογικής, το Cascade για τις ροές εργασίας, το HotLoop for CODESYS για τη δική του οθόνη του PLC και το Transmitter για να βγουν οι τιμές ενός PLC στο δίκτυο.

Κυκλοφορούν σε πέντε γραμμές εκδόσεων. Το **HotLoop core** είναι τα IoT, Edge, Gateway και Edge Relay: τέσσερα προϊόντα, ένας κώδικας, μία ετικέτα. Κάθε έκδοση του core βγάζει και τα τέσσερα μαζί, με τον ίδιο αριθμό έκδοσης, το καθένα με δική του εικόνα, δικό του chart του Helm και δικές του μονάδες Podman Quadlet. Διαλέξτε αυτό που ταιριάζει στο μηχάνημα. Κάθε προϊόν μιλά όλα τα πρωτόκολλα που έχει το HotLoop, οπότε ποτέ δεν ανεβαίνετε προϊόν μόνο και μόνο για να διαβάσετε το PLC που έχετε στον πάγκο. Οι λειτουργίες τα ξεχωρίζουν. Τα πρωτόκολλα όχι.

Τα **Flow**, **Cascade**, **HotLoop for CODESYS** και **Transmitter** είναι δικές τους γραμμές με δικές τους εκδόσεις, οπότε μια έκδοση του Flow δεν κινεί ποτέ το core, και αντίστροφα. Ό,τι υπάρχει κάτω από τον πίνακα αφορά το core. Να πού ξεκινά καθένα από τα οκτώ:

| Προϊόν | Γραμμή εκδόσεων | Τεκμηρίωση | Εγκατάσταση | Σημειώσεις έκδοσης | Οδικός χάρτης |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/el/iot/overview/">Τεκμηρίωση</a> | <a href="/el/iot/install/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-core">Σημειώσεις</a> | <a href="/el/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Edge** | HotLoop core | <a href="/el/edge/overview/">Τεκμηρίωση</a> | <a href="/el/edge/install/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-core">Σημειώσεις</a> | <a href="/el/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/el/gateway/overview/">Τεκμηρίωση</a> | <a href="/el/gateway/install/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-core">Σημειώσεις</a> | <a href="/el/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/el/edge-relay/overview/">Τεκμηρίωση</a> | <a href="/el/edge-relay/install/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-core">Σημειώσεις</a> | <a href="/el/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Flow** | Flow | <a href="/el/flow/overview/">Τεκμηρίωση</a> | <a href="/el/flow/install/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-flow">Σημειώσεις</a> | <a href="/el/flow/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Cascade** | Cascade | <a href="/el/cascade/overview/">Τεκμηρίωση</a> | <a href="/el/cascade/running/">Εγκατάσταση</a> | <a href="/el/releases/#hotloop-cascade">Σημειώσεις</a> | <a href="/el/cascade/roadmap/">Οδικός χάρτης</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/el/codesys/overview/">Τεκμηρίωση</a> | <a href="/el/codesys/install/">Εγκατάσταση</a> | <a href="/el/releases/codesys-0-3-10/">Σημειώσεις</a> | <a href="/el/codesys/roadmap/">Οδικός χάρτης</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/el/transmitter/overview/">Τεκμηρίωση</a> | <a href="/el/transmitter/install/">Εγκατάσταση</a> | <a href="/el/releases/transmitter-1-3-0/">Σημειώσεις</a> | <a href="/el/transmitter/roadmap/">Οδικός χάρτης</a> |

Ο πίνακας που ακολουθεί συγκρίνει τα τέσσερα προϊόντα του core.

| <span class="sr-only">Λεπτομέρειες</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| Σε τι χρησιμεύει | Η βάση της αυτοματοποίησης. Ένα Pi, ένα NUC, ένα κουτί σε ντουλάπι | Ένα κουτί δίπλα στο μηχάνημα, που συνεχίζει να δουλεύει ακόμη κι αν πέσει η σύνδεση προς τα πάνω | Ο εγκέφαλος της τοποθεσίας | Διαβάζει, προωθεί, επιβιώνει. Χωρίς βάση δεδομένων και χωρίς περιβάλλον χρήστη |
| Οντότητες, αυτοματισμοί, βοηθοί, scripts, συνταγές, blueprints, πίνακες ελέγχου, ημερολόγιο, ειδοποιήσεις, MCP, MQTT με ανακάλυψη, συναγερμοί ISA-18.2, αντίγραφα ασφαλείας και κάθε driver | ναι | ναι | ναι | μόνο drivers |
| Διακομιστής OPC UA, δημοσίευση Sparkplug στην άκρη με αποθήκευση και προώθηση | | ναι | ναι | μόνο δημοσίευση |
| Στόλος, πολλές τοποθεσίες, προγραμματισμένες αναφορές | | | ναι | |
| Εικόνα | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Μονάδες Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Μονάδες Quadlet σε SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | καμία |
| `database.type` στο chart | `postgresql` (προεπιλογή), `sqlite` | `timescaledb` (προεπιλογή), `postgresql`, `sqlite` | `timescaledb` (προεπιλογή), `postgresql`, `sqlite` | κανένα |
| Αρχιτεκτονικές | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Βάση δεδομένων που τρέχουν το chart και το Quadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | καμία |
| Ιστορικό που κρατιέται από προεπιλογή | 30 ημέρες | 90 ημέρες | 90 ημέρες | κανένα |
| Βάσεις δεδομένων στις οποίες τρέχει το εκτελέσιμο | SQLite ή Postgres | SQLite, Postgres ή TimescaleDB | SQLite, Postgres ή TimescaleDB | καμία |

Η βάση δεδομένων είναι ρύθμιση, όχι εικόνα: τα `HOTLOOP_DB_TYPE=sqlite` και `HOTLOOP_DB_PATH` βάζουν οποιοδήποτε από τα τρία σε αρχείο SQLite, χωρίς κανένα container βάσης δεδομένων (DEPLOYMENT.md, «SQLite»). Τα charts δέχονται την ίδια επιλογή ως `database.type` και οι μονάδες Quadlet ως οι κατάλογοι `sqlite/`, και κάθε προϊόν προσφέρει μόνο τις βάσεις του πίνακα παραπάνω: αν ζητήσετε `timescaledb` από το chart του IoT, η εγκατάσταση αποτυγχάνει. Η μετάβαση από τη μία βάση στην άλλη είναι ένα αντίγραφο ασφαλείας και μια επαναφορά (BACKUP.md).

Το Gateway κράτησε τα ονόματα με τα οποία βγήκε μέχρι και την 4.17.0: εικόνα `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Όποιος το τρέχει δεν χρειάζεται να αλλάξει τίποτα.

## Ό,τι υπάρχει σε ένα προϊόν είναι ό,τι υπάρχει στο εκτελέσιμο

Ένα προϊόν είναι μια μεταγλώττιση, όχι ρύθμιση. Το `-tags hotloop_iot` χτίζει το IoT, το `-tags hotloop_edge` χτίζει το Edge και χωρίς ετικέτα χτίζεται το Gateway. Ό,τι δεν έχει ένα προϊόν δεν είναι απενεργοποιημένο, απλώς δεν υπάρχει: ο διακομιστής OPC UA δεν είναι καθόλου στην εικόνα του IoT, οπότε καμία μεταβλητή περιβάλλοντος, κανένα αρχείο τιμών και καμία κακή μέρα δεν μπορεί να τον ενεργοποιήσει.

Έτσι ένα μικρότερο προϊόν απαντά γι' αυτό που δεν έχει, αντί να προσποιείται:

- **Το API** κρατά κάθε διαδρομή σε κάθε προϊόν. Μια διαδρομή για λειτουργία που αυτό το προϊόν δεν έχει απαντά `404` και ονομάζει το προϊόν που την έχει: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. Το `GET /api/status` λέει `product` και `features`, οπότε ένα script ρωτά αντί να μαντεύει.
- **Μια ρύθμιση μόνο για το Gateway** σε IoT ή Edge (για παράδειγμα `HOTLOOP_REPORTS_ENABLED=true` που κουβαλήθηκε από ένα παλιό αρχείο τιμών) προειδοποιεί κατά την εκκίνηση και στην οθόνη Ρυθμίσεων, και το HotLoop τρέχει. Το HotLoop κρατά το εργοστάσιο σε λειτουργία παρά την αναφορά που δεν μπορεί να παραγάγει, και η προειδοποίηση φροντίζει να το δει κάποιος.
- **Τα charts** δεν έχουν καθόλου τη ρύθμιση. Το `charts/hotloop-iot` δεν έχει μπλοκ `reports`, `opcuaServer` ή `edgePublish`, και το `hotloop-edge` δεν έχει `reports`. Αν την ορίσετε παρ' όλα αυτά, δεν παράγει τίποτα.
- **Το `hotloop --product`** τυπώνει `iot`, `edge` ή `gateway`. Το `--version` τυπώνει ακόμη μόνο την έκδοση, επειδή τη διαβάζουν scripts.

## Ποιο να διαλέξετε

- **Ένα Pi, έξυπνες πρίζες, λίγοι αισθητήρες, ένας broker MQTT γεμάτος Tasmota και Zigbee2MQTT, ή ένα PLC σε πάγκο:** IoT. Είναι η μικρότερη εικόνα (περίπου 29 MB σε arm) και η εικόνα του απλού PostgreSQL είναι το ένα έκτο της TimescaleDB, που σε κάρτα SD είναι ο αριθμός που μετράει.
- **Ένα κουτί βιδωμένο δίπλα σε μια γραμμή, που τροφοδοτεί ένα SCADA μέσω OPC UA ή δημοσιεύει προς τα πάνω μέσω Sparkplug και αντέχει να πέσει η σύνδεση προς τα πάνω:** Edge.
- **Η τοποθεσία: κάθε γραμμή, αναφορές που στέλνονται με email με πρόγραμμα, edge relays που αναφέρονται, περισσότερες από μία τοποθεσίες σε μία οθόνη:** Gateway.
- **Ένα κουτί που απλώς διαβάζει και προωθεί, χωρίς βάση δεδομένων να φροντίζετε:** Edge Relay. Δείτε την [αναφορά του Edge Relay](/el/edge-relay/reference/).

## Μεγέθη

Η εικόνα είναι το εκτελέσιμο συν περίπου 3 MB βάσης.

| <span class="sr-only">Λεπτομέρειες</span> | εικόνα / εκτελέσιμο amd64 | εικόνα / εκτελέσιμο arm64 | εικόνα / εκτελέσιμο arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | δεν χτίζεται |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Αυτά είναι τα μεγέθη στον δίσκο. Χωρίς συσκευές, το HotLoop κάθεται γύρω στα 10 MB RSS και η PostgreSQL γύρω στα 12 MB, και αυτό είναι το κατώτατο όριο, όχι ο πραγματικός αριθμός: όσα χρησιμοποιεί ένα προϊόν με συσκευές που ερωτώνται εξαρτώνται από τις συσκευές.

## Εγκατάσταση

### Helm

Ένα αποθετήριο, και τα τέσσερα charts:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Ονομάστε την έκδοση `hotloop`, όποιο κι αν είναι το προϊόν. Από το όνομα της έκδοσης παίρνουν το όνομά τους ο τόμος της βάσης δεδομένων, τα Secrets και το Service, και η διατήρησή του είναι αυτό που επιτρέπει σε μια τοποθεσία να ανέβει αργότερα προϊόν (παρακάτω).

Στο EmberNet, το καθένα είναι δική του κάρτα στο App Store: «HotLoop IoT», «HotLoop Edge», «HotLoop Gateway» και «HotLoop Edge Relay». Μια εγκατάσταση από το κατάστημα ενσωματώνει τις ετικέτες ενοικιαστή του πίνακα ελέγχου σε ό,τι παράγει το chart, και το Running Apps τα εμφανίζει ως `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` και `HotLoop-Edge-Relay`.

### Podman Quadlet

Για ένα μηχάνημα που δεν είναι σε cluster. Κάθε κατάλογος προϊόντος κάτω από το `deploy/quadlet/` έχει πέντε μονάδες: `hotloop.network`, `hotloop.container` (η εφαρμογή), `hotloop-db.container` (η βάση δεδομένων της, η ίδια εικόνα και έκδοση με του chart της), `hotloop-db.volume` και `hotloop-data.volume`. Τα βήματα εγκατάστασης είναι στην κεφαλίδα κάθε `hotloop.container`, και το [Podman Quadlet](/el/install/quadlet/) έχει τα υπόλοιπα.

Χρειάζονται Podman 5.0 ή νεότερο. Το Raspberry Pi OS Bookworm έρχεται με το 4.3, που δεν έχει καθόλου Quadlet, οπότε ένα Pi θέλει Raspberry Pi OS Trixie ή νεότερο. Η εφαρμογή ακολουθεί το `:stable` και η αυτόματη ενημέρωση του Podman τη μετακινεί, με τη βάση δεδομένων καρφιτσωμένη: [το README του Quadlet](/el/install/auto-update/) εξηγεί πώς και γιατί. Όπως κι αν εγκατασταθεί, βάλτε τη βάση δεδομένων σε SSD USB και όχι στην κάρτα SD. Το ιστορικό γράφει όλη μέρα, κάθε μέρα, και οι κάρτες SD πεθαίνουν ακριβώς απ' αυτό.

## Ανέβασμα μιας τοποθεσίας σε μεγαλύτερο προϊόν

Από το IoT στο Edge και στο Gateway διατηρούνται κάθε συσκευή, tag, οντότητα, αυτοματισμός, συναγερμός, χρήστης και ώρα ιστορικού. Κάθε προϊόν τρέχει κάθε μετάβαση σχήματος, οπότε η βάση δεδομένων έχει το ίδιο σχήμα και στα τρία, και το μεγαλύτερο προϊόν ξεκινά με άδειες τις πρόσθετες λειτουργίες του.

- **Quadlet:** τα ονόματα των μονάδων, οι τόμοι και τα μυστικά είναι τα ίδια σε κάθε κατάλογο προϊόντος. Αντιγράψτε τα `hotloop.container` και `hotloop-db.container` του μεγαλύτερου προϊόντος πάνω στα δικά σας, τρέξτε `systemctl daemon-reload` και κάντε επανεκκίνηση.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (ή `hotloop/hotloop`) στην ίδια έκδοση. Τα τρία charts επιλέγουν τα pods τους με τις ίδιες ετικέτες και ονομάζουν με τον ίδιο τρόπο το StatefulSet και τον τόμο της βάσης δεδομένων, οπότε η αναβάθμιση επιτρέπεται και ο τόμος μένει δεμένος.

Κάντε πρώτα ένα αντίγραφο ασφαλείας (`POST /api/backup`, δείτε [Αντίγραφα ασφαλείας και επαναφορά](/el/iot/backup/)) και αντιγράψτε το έξω από το μηχάνημα. Η μετάβαση έχει εκτελεστεί σε Quadlet, IoT μετά Edge μετά Gateway σε έναν τόμο βάσης δεδομένων με την ίδια συσκευή παρούσα σε κάθε βήμα, με τον κατάλογο PostgreSQL του IoT να ξεκινά κάτω από την εικόνα TimescaleDB του Gateway, και ως `helm upgrade` σε πραγματικό cluster. Όπου ο απλός κατάλογος του IoT δεν έχει την επέκταση TimescaleDB, το ιστορικό μένει σε εγγενή partitions μετά τη μετάβαση, και ένα hypertable χρειάζεται αντίγραφο ασφαλείας και επαναφορά σε καινούρια TimescaleDB. Η επιστροφή σε μικρότερο προϊόν δεν είναι κίνηση για μηχάνημα που σας νοιάζει.

## Πώς κυκλοφορούν

Μία ετικέτα `v` βγάζει και τα τέσσερα, οπότε τα IoT, Edge, Gateway και Edge Relay μοιράζονται πάντα την ίδια έκδοση. Πριν χτιστεί οτιδήποτε, ελέγχεται ότι η έκδοση και η εικόνα κάθε chart ταιριάζουν με την ετικέτα, ότι κάθε μονάδα εφαρμογής Quadlet ακολουθεί το `:stable` με έλεγχο υγείας, και ότι κάθε μονάδα βάσης δεδομένων ταιριάζει με το chart της και δεν ενημερώνεται ποτέ αυτόματα. Τα charts του IoT και του Edge παράγονται από το chart του Gateway, οπότε μια διόρθωση στο ένα φτάνει και στα τρία.
