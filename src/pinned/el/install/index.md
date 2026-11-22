---
title: "Εγκατάσταση του HotLoop"
description: "Πώς εγκαθίσταται κάθε προϊόν HotLoop: Helm σε k3s ή Kubernetes, ή Podman Quadlet σε κουτί που ακολουθεί την ετικέτα stable και ενημερώνεται μόνο του."
sidebar:
  label: "Εγκατάσταση"
---

Υπάρχουν δύο τρόποι να τρέξετε ένα προϊόν HotLoop στα σοβαρά: Helm σε k3s ή οποιοδήποτε Kubernetes, ή Podman με Quadlet σε ένα κουτί που δεν είναι σε cluster. Χωρίς Docker, χωρίς Compose και χωρίς μεμονωμένο `podman run` από κέλυφος που πεθαίνει με τη συνεδρία. Ένα απλό `podman run` κάνει για δοκιμή, και η σελίδα του Flow το λέει, αλλά δεν είναι εγκατάσταση.

## Διαλέξτε τον δρόμο

| Έχετε | Χρησιμοποιήστε | Σελίδα |
|---|---|---|
| Ένα cluster k3s ή Kubernetes | Helm | [k3s και Helm](/el/install/helm/) |
| Ένα Pi, ένα NUC ή έναν μικρό βιομηχανικό υπολογιστή, χωρίς cluster | Podman Quadlet | [Podman Quadlet](/el/install/quadlet/) |
| Όποιο από τα δύο, και θέλετε να ξέρετε πώς συμπεριφέρονται οι ενημερώσεις | | [Η αυτόματη ενημέρωση του :stable](/el/install/auto-update/) |

## Τι μπορείτε να εγκαταστήσετε σήμερα

| Προϊόν | Τελευταία έκδοση | Helm | Quadlet | Ξεκινήστε από εδώ |
|---|---|---|---|---|
| [HotLoop IoT](/el/iot/overview/) | {{hotloop}} | Ναι | Ναι | [Εγκατάσταση του IoT](/el/iot/install/) |
| [HotLoop Edge](/el/edge/overview/) | {{hotloop}} | Ναι | Ναι | [Εγκατάσταση του Edge](/el/edge/install/) |
| [HotLoop Gateway](/el/gateway/overview/) | {{hotloop}} | Ναι | Ναι | [Εγκατάσταση του Gateway](/el/gateway/install/) |
| [HotLoop Edge Relay](/el/edge-relay/overview/) | {{hotloop}} | Ναι | Ναι | [Εγκατάσταση του Edge Relay](/el/edge-relay/install/) |
| [HotLoop Flow](/el/flow/overview/) | {{flow}} | Ναι | Ναι | [Εγκατάσταση του Flow](/el/flow/install/) |
| [HotLoop Cascade](/el/cascade/overview/) | {{cascade}} | Ναι, χωρίς σύνδεση χρήστη | Ναι, χωρίς σύνδεση χρήστη, δείτε [Cascade με Podman Quadlet](/el/cascade/quadlet/) | [Λειτουργία του Cascade](/el/cascade/running/) |
| [HotLoop for CODESYS](/el/codesys/overview/) | {{codesys}} | Ναι, ή το App Store του EmberCORE | Όχι | [Εγκατάσταση του HotLoop for CODESYS](/el/codesys/install/) |
| [HotLoop Transmitter](/el/transmitter/overview/) | 1.1.0 | Όχι, είναι βιβλιοθήκη CODESYS | Όχι, είναι βιβλιοθήκη CODESYS | [Εγκατάσταση του Transmitter](/el/transmitter/install/) |

Τα HotLoop IoT, Edge, Gateway και Edge Relay βγαίνουν από μία ετικέτα, μαζί, γι' αυτό μοιράζονται έναν αριθμό έκδοσης. Τα Flow, Cascade, HotLoop for CODESYS και Transmitter έχουν τον δικό τους. Οι μονάδες Quadlet των IoT, Edge και Gateway χρειάζονται Podman 5.0 ή νεότερο, και η μονάδα του relay έτρεξε σε Podman 4.9.3. Το Raspberry Pi OS Bookworm έρχεται με το 4.3, που δεν έχει καθόλου Quadlet, οπότε ένα Pi θέλει Trixie ή νεότερο.

## Εγκατάσταση από το EmberNet App Store

Στο EmberNet, η εγκατάσταση είναι το App Store. Εκτελεί για εσάς το ίδιο Helm chart στον κόμβο που επιλέγετε, οπότε δεν προσθέτετε chart, δεν χρειάζεστε αρχείο τιμών και δεν γράφετε εντολές. Το χρονομετρήσαμε σε πραγματικό κόμβο: 1 λεπτό και 10 δευτερόλεπτα από το άνοιγμα του App Store μέχρι τις ζωντανές μετρήσεις στον πίνακα.

<figure>
<video controls preload="none" playsinline width="1920" height="1080" poster="/embernet-install/poster.webp" aria-label="Εγκατάσταση του HotLoop Gateway από το EmberNet App Store, από την αρχή έως τα ζωντανά δεδομένα σε 1 λεπτό και 10 δευτερόλεπτα" style="width:100%;height:auto;aspect-ratio:16/9">
<source src="/embernet-install/install-hotloop-on-embernet.mp4" type="video/mp4" />
<source src="/embernet-install/install-hotloop-on-embernet.webm" type="video/webm" />
Το πρόγραμμα περιήγησής σας δεν μπορεί να αναπαραγάγει αυτό το βίντεο. <a href="/embernet-install/install-hotloop-on-embernet.mp4">Κατεβάστε το</a>.
</video>
<figcaption>Μία λήψη, σε πραγματικό χρόνο. Το ρολόι τρέχει από το άνοιγμα του App Store μέχρι να διαβάσει δεδομένα το HotLoop, και η αναμονή της εγκατάστασης φαίνεται με τετραπλάσια ταχύτητα.</figcaption>
</figure>

1. Στο EmberCORE ανοίξτε το **App Store**.

   ![Το EmberCORE App Store με τα φίλτρα Κατηγορία, Εκδότης και Ταξινόμηση](/embernet-install/hotloop-install-01-app-store.webp)

2. Επιλέξτε την κατηγορία **HotLoop** και πατήστε **Ανάπτυξη** στο HotLoop Gateway. Κάθε προϊόν HotLoop έχει τη δική του κάρτα σε αυτή την κατηγορία.

   ![Το App Store φιλτραρισμένο στην κατηγορία HotLoop, με τις κάρτες HotLoop Cascade, Edge, Edge Relay, Flow, Gateway και IoT](/embernet-install/hotloop-install-02-hotloop-apps.webp)

3. Επιλέξτε τον κόμβο και πατήστε ξανά **Ανάπτυξη**.

   ![Το παράθυρο ανάπτυξης του HotLoop Gateway με επιλεγμένο κόμβο](/embernet-install/hotloop-install-03-choose-node.webp)

4. Το EmberCORE επιβεβαιώνει την εγκατάσταση και το HotLoop Gateway εμφανίζεται στις **Εφαρμογές σε λειτουργία** με την έκδοσή του και τη διεύθυνσή του στο Flux.

   ![Το μήνυμα του EmberCORE ότι το HotLoop Gateway εγκαθίσταται στον κόμβο](/embernet-install/hotloop-install-04-installing.webp)

   ![Εφαρμογές σε λειτουργία με το HotLoop Gateway να τρέχει, την έκδοσή του, τη διεύθυνση Flux online και τα κουμπιά Εκκίνηση, Άνοιγμα, Κέλυφος pod, Κέλυφος συσκευής και Αφαίρεση](/embernet-install/hotloop-install-05-running.webp)

5. Πατήστε **Εκκίνηση**. Το EmberCORE σας συνδέει και το HotLoop ανοίγει με την κατάσταση του ίδιου του κουτιού ήδη σε ανάγνωση, οπότε το πρώτο που βλέπετε είναι ζωντανά δεδομένα.

   ![Το HotLoop Gateway ανοιχτό μέσα στο EmberCORE και συνδεδεμένο, με μία συσκευή, 4 στα 4 tags να αναφέρουν και καμία ειδοποίηση](/embernet-install/hotloop-install-06-hotloop-signed-in.webp)

6. Καρφιτσώστε τα tags που σας ενδιαφέρουν και γίνονται ζωντανά όργανα στον πίνακα.

   ![Το παράθυρο για το καρφίτσωμα tags στον πίνακα, με τα tags επεξεργαστή, μνήμης και δίσκου του κόμβου](/embernet-install/hotloop-install-07-pin-a-tag.webp)

   ![Ο πίνακας του HotLoop με ζωντανά όργανα για τη χρήση επεξεργαστή, μνήμης και δίσκου του κόμβου](/embernet-install/hotloop-install-08-board-live.webp)

Η τεκμηρίωση του EmberNet δείχνει την ίδια εγκατάσταση σελίδα προς σελίδα: [HotLoop Gateway στο EmberNet](https://docs.embernet.ai/docs/app-store/hotloop).

## Πριν το βάλετε σε πραγματικό εργοστάσιο

- Διαβάστε [την πύλη εγγραφής](/el/gateway/write-gate/). Είναι ίδια σε κάθε προϊόν, και γι' αυτό τίποτα δεν κινεί μια μηχανή που δεν οπλίσατε.
- Βάλτε τη βάση δεδομένων σε USB SSD και όχι στην κάρτα SD, αν είναι Pi. Το ιστορικό γράφει όλη μέρα, κάθε μέρα, και οι κάρτες SD πεθαίνουν ακριβώς από αυτό.
- Κρατήστε αντίγραφο ασφαλείας του κλειδιού των κωδικών των συσκευών. Δεν είναι στη βάση δεδομένων ούτε σε αντίγραφο ασφαλείας, άρα είναι μέρος των δεδομένων σας. Τα [Αντίγραφα ασφαλείας](/el/iot/backup/) εξηγούν πώς.
- Κρατήστε αντίγραφο ασφαλείας πριν ανεβάσετε μια τοποθεσία σε άλλο προϊόν ή αναβαθμίσετε ανάμεσα σε εκδόσεις, και αντιγράψτε το εκτός κουτιού.
