---
title: "Εκτέλεση του Cascade"
description: "Εκτελέστε το Cascade με Podman Quadlet ή με Helm στο k3s, πάνω σε SQLite ή Postgres, με τον έλεγχο υγείας που χρησιμοποιούν οι μονάδες και οι probes του chart."
---

:::note[Καλύπτει και ό,τι έρχεται]
Αυτή η σελίδα καλύπτει και μερικά πράγματα που είναι νεότερα από το HotLoop Cascade 1.4.2, την τελευταία έκδοση. Ορισμένα από αυτά μπορεί να μην υπάρχουν σε αυτό που έχετε εγκαταστήσει. Οι [σημειώσεις έκδοσης](/el/releases/) λένε τι άλλαξε.
:::

Σε έναν υπολογιστή με Podman, το `deploy/quadlet` έχει μονάδες systemd. Ένα αρχείο και ένας τόμος είναι το Cascade σε SQLite· το `deploy/quadlet/postgres` είναι ο διακομιστής, ένας worker και η PostgreSQL σε δικό τους δίκτυο. Και τα δύο ξεκινούν με την εκκίνηση, επανεκκινούν σε αποτυχία και τρέχουν μόνο για ανάγνωση, χωρίς root και χωρίς καμία capability. Το README του τα εξηγεί βήμα προς βήμα.

Για να τραβήξετε μια έκδοση με το χέρι:

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:1.5.0
```

Οι μονάδες ακολουθούν το `:stable` και ο χρονοδιακόπτης αυτόματης ενημέρωσης του Podman τις μετακινεί.

Στο k3s, το `charts/hotloop-cascade` είναι το chart του Helm:

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version 1.5.0
```

Το chart φέρει τις ετικέτες που διαβάζει ο πίνακας ελέγχου του EmberNet, στο Service και στα pods που εξυπηρετούν τον επεξεργαστή, ώστε ένα Cascade που έχει αναπτυχθεί από το App Store να εμφανίζεται στο Running Apps με κουμπί LAUNCH. Τα `gui.appName`, `gui.port` και `gui.displayName` αλλάζουν ό,τι εμφανίζεται.

Αυτό είναι ένα pod σε SQLite με έναν τόμο. Το `--set split=true` με PostgreSQL (`--set postgresql.enabled=true` για μια που τρέχει το chart, ή `externalDatabase.existingSecret` για τη δική σας) το χωρίζει σε pods API, webhook και worker που κλιμακώνετε χωριστά. Το κλειδί που σφραγίζει τα αποθηκευμένα διαπιστευτήρια δημιουργείται στην πρώτη εγκατάσταση και διατηρείται όταν απεγκαθίσταται η έκδοση, γιατί ένα κλειδί που φεύγει μαζί με την έκδοση παίρνει μαζί του όλα τα διαπιστευτήρια μιας βάσης δεδομένων που διατηρείται. Κρατήστε αντίγραφο ασφαλείας.

Το `hotloop-cascade healthcheck` ρωτά το δικό του endpoint υγείας του διακομιστή που τρέχει και τερματίζει με 0 ή 1. Οι μονάδες Quadlet και οι probes του chart χρησιμοποιούν και οι δύο τα endpoints που βρίσκονται πίσω από αυτό.
