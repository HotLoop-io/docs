---
title: "MCP για πράκτορες"
description: "Αφήστε έναν πράκτορα να διαβάζει ολόκληρο το εργοστάσιο και να αγγίζει μόνο όσα έχετε οπλίσει, μέσω της πύλης εγγραφής, με καταγεγραμμένο λόγο σε κάθε εγγραφή."
---

Το gateway μιλά MCP προς τις δύο κατευθύνσεις: οι πράκτορες μπορούν να διαβάσουν και να οδηγήσουν το εργοστάσιο, και ένας κανόνας αυτοματοποίησης μπορεί να καλέσει ένα εργαλείο αλλού.

Ο κανόνας σχεδιασμού είναι ότι **ένας πράκτορας είναι καλών όπως κάθε άλλος**. Τα εργαλεία διαβάζουν μέσω της ίδιας προσωρινής μνήμης που διαβάζει το UI και γράφουν μέσω της ίδιας πύλης από την οποία γράφει το UI. Δεν υπάρχει προνομιούχα διαδρομή, παράκαμψη ή ξεχωριστή πολιτική. Μια εγγραφή που θα απορριπτόταν σε έναν χειριστή απορρίπτεται· μια εγγραφή που πετυχαίνει καταλήγει στον ίδιο πίνακα ελέγχου με το `mcp:` μπροστά από τον ενεργούντα.

## Παροχή

### Μέσω HTTP

Ενεργό από προεπιλογή στο `/mcp` στη θύρα της εφαρμογής, προστατευμένο από ένα bearer token που το chart δημιουργεί στο Secret της έκδοσης.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Μέσα στο cluster, το endpoint είναι:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Ο έλεγχος του token βρίσκεται μπροστά από τον χειριστή, οπότε ένας μη πιστοποιημένος καλών δεν μπορεί ούτε να απαριθμήσει τι υπάρχει. Αν αφήσετε το `mcp.token` κενό, το chart δημιουργεί ένα, η προεπιλεγμένη εγκατάσταση δεν είναι κατά λάθος η ανοιχτή. Συνδυάστε το με το NetworkPolicy· ένα token είναι δεύτερη γραμμή άμυνας, όχι η μοναδική.

Το endpoint δεν είναι ποτέ ανοιχτό. Τρέξτε το εκτελέσιμο χωρίς `HOTLOOP_MCP_TOKEN` (μια μονάδα Quadlet, ένα γυμνό `hotloop`) και δημιουργεί ένα token στην πρώτη εκκίνηση και το κρατά στη βάση του, ώστε να επιστρέφει το ίδιο μετά από επανεκκίνηση, σε κάθε αντίγραφο και μετά από επαναφορά. Το `hotloop mcp-token` το εκτυπώνει (το αρχείο καταγραφής λέει ότι έφτιαξε ένα, και ποτέ ποιο). Ορίστε `HOTLOOP_MCP_TOKEN` για να διαλέξετε δικό σας· με ορισμένο το `HOTLOOP_MCP_OIDC_*` το endpoint δέχεται σύνδεση και δεν κρατά δικό του token. Ένας πελάτης που παλιά συνδεόταν σε γυμνό εκτελέσιμο χωρίς τίποτα παίρνει τώρα `401` μέχρι να στείλει `Authorization: Bearer <that token>`.

### Με σύνδεση Vord ή δήλωση hub

Το στατικό token λέει ποιος πελάτης κάλεσε· δεν μπορεί να πει ποιο άτομο. Με ορισμένο OIDC, το `/mcp` δέχεται επίσης `Authorization: Bearer <jwt>`, και το email του επαληθευμένου ατόμου γίνεται ο ενεργών του ελέγχου: μια εγγραφή καταγράφεται ως `mcp:pat@example.com` αντί για `mcp:<client name>`. Η συμπεριφορά χωρίς αυτό είναι αμετάβλητη, και το στατικό token συνεχίζει να δουλεύει δίπλα του (χωρίς ορισμένο στατικό token, μπαίνει μόνο ένα επαληθευμένο JWT).

| Μεταβλητή | Τιμή chart | Κάνει |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | το URL του realm Vord· δέχεται τα access tokens του |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | το `aud` που πρέπει να φέρει κάθε token· απαιτείται με οποιοδήποτε από αυτά τα δύο |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | τα κλειδιά δηλώσεων του hub ταυτότητας· δέχεται τις δηλώσεις του |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | ρόλος realm που πρέπει να έχει ο καλών |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | περιορίζει τις εγγραφές ανά καλούντα, βλ. παρακάτω |

Ένα access token του Vord ελέγχεται με το JWKS του εκδότη (που βρίσκεται μέσω του εγγράφου ανακάλυψής του, κρατείται δέκα λεπτά, ξαναφέρνεται σε άγνωστο `kid`): μόνο RS256 ή ES256, `iss` ίσο με τον εκδότη, `aud` που περιέχει το κοινό, `exp` και `nbf` με 30 s ανοχή, και ισχυρισμός `email` (ή `preferred_username`). Το Vord βάζει από προεπιλογή μόνο `account` στο `aud`· δώστε στο client scope έναν audience mapper για το κοινό που ορίζετε.

Μια δήλωση hub είναι `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` το διαμορφωμένο κοινό (το άρθρωμα Hub στέλνει `hotloop`), μη ληγμένη, υπογεγραμμένη από κλειδί του JWKS του Hub. Δεν υπάρχει cache αποτροπής επανάληψης `jti`: μία κλήση εργαλείου είναι πολλά αιτήματα HTTP (initialize, μετά η κλήση) που φέρουν την ίδια δήλωση, η οποία ζει 60 s. Όταν το Hub λέει ότι η κλήση ενεργεί για κάποιον άλλον (`acting_as`), ο ενεργών διαβάζεται `mcp:<email> for <acting_as email>`.

Οι εγγραφές εξακολουθούν να χρειάζονται `HOTLOOP_ALLOW_WRITES`, τον γενικό διακόπτη· ένα token δεν τον διευρύνει ποτέ. Το `HOTLOOP_MCP_OIDC_WRITE_ROLE` τις περιορίζει ανά καλούντα: το `hotloop:hotloop.write` σημαίνει τον ρόλο πελάτη Vord `hotloop.write` στον πελάτη `hotloop` (`resource_access.hotloop.roles`), ένα γυμνό όνομα σημαίνει ρόλο realm, και μια δήλωση Hub πρέπει να φέρει το όνομα του ρόλου στο `abilities`. Ένας καλών χωρίς αυτόν μπορεί να διαβάζει αλλά τα `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` και κάθε εργαλείο που αλλάζει διαμόρφωση αρνούνται. Το στατικό token δεν περιορίζεται από αυτόν.

### Μέσω stdio

Το ίδιο εκτελέσιμο σερβίρει MCP σε stdin και stdout με `--mcp-stdio`, για έναν πελάτη που το εκκινεί απευθείας. Ξεκινά και όλα τα υπόλοιπα, ώστε ο πράκτορας να βλέπει ένα ζωντανό εργοστάσιο και όχι έναν κούφιο διακομιστή.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

Σε λειτουργία stdio όλη η καταγραφή πηγαίνει στο stderr. Ό,τι γραφτεί στο stdout θα χαλούσε τη ροή του πρωτοκόλλου.

## Εργαλεία

Εκατόν εβδομήντα ένα: είκοσι επτά που διαβάζουν το εργοστάσιο και το διατάζουν, εξήντα εννέα που αλλάζουν τη διαμόρφωσή του ([παρακάτω](#αλλαγή-διαμόρφωσης)), τριάντα τρεις αναγνώσεις και δοκιμαστικές εκτελέσεις που τα συνοδεύουν ([παρακάτω](#αναγνώσεις-και-δοκιμαστικές-εκτελέσεις)) και σαράντα δύο για διαχείριση ([παρακάτω](#διαχείριση)).

| Εργαλείο | Τι κάνει |
|---|---|
| `get_plant_status` | συσκευές σε σύνδεση, εκκρεμείς συναγερμοί, αν οι εγγραφές είναι ενεργές |
| `list_devices` | κάθε συσκευή με πρωτόκολλο, διεύθυνση, κατάσταση, αριθμό tags |
| `describe_device` | μία συσκευή αναλυτικά, με τα tags και στατιστικά polling |
| `list_tags` | αναζητά στον κατάλογο ανά συσκευή, όνομα ή περιγραφή |
| `read_tag` | τρέχουσες τιμές, με ποιότητα |
| `query_history` | ιστορικές αναγνώσεις, ακατέργαστες ή ομαδοποιημένες |
| `write_tag` | **διατάζει ένα tag** |
| `list_alarms` | συναγερμοί και οι καταστάσεις τους κατά ISA-18.2 |
| `ack_alarm` | επιβεβαιώνει εκ μέρους ενός χειριστή |
| `list_automations` | κανόνες, αριθμός εκτελέσεων, τελευταίο αποτέλεσμα |
| `trigger_automation` | εκτελεί έναν κανόνα τώρα |
| `describe_protocol` | τι μιλά πραγματικά αυτό το build |
| `recent_events` | το αρχείο καταγραφής συστήματος, για να βρεθεί τι έγινε και με ποια σειρά |
| `list_entities` | βρίσκει οντότητες ανά domain, κόμβο εξοπλισμού ή ετικέτα, με τις υπηρεσίες που δέχεται η καθεμία |
| `get_states` | τρέχουσα κατάσταση μίας ή περισσότερων οντοτήτων, με ποιότητα και χαρακτηριστικά |
| `call_service` | **διατάζει μια οντότητα**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | μία χρονογραμμή αλλαγών κατάστασης, εγγραφών, συναγερμών, εκτελέσεων και αλλαγών διαμόρφωσης, ανά οντότητα, κόμβο εξοπλισμού, ενεργούντα ή είδος |
| `list_scripts` | τα σενάρια του εργοστασίου, τα πεδία που δέχεται το καθένα, αν τρέχει, η τελευταία εκτέλεσή του |
| `run_script` | **εκτελεί ένα σενάριο**, ή ρωτά με `dryRun` τι θα έκανε αυτή τη στιγμή |
| `list_recipes` | οι συνταγές του εργοστασίου: στόχοι με σειρά, παράμετροι, προϋπόθεση, έκδοση, τελευταία εφαρμογή |
| `validate_recipe` | θα εφαρμοζόταν μια συνταγή τώρα; κάθε λόγος για τον οποίο θα απορριπτόταν· δεν γράφεται τίποτα |
| `apply_recipe` | **εφαρμόζει μια συνταγή**: ελέγχεται ολόκληρη, γράφεται με σειρά, διαβάζεται πίσω |
| `list_blueprints` | τα blueprints που συμπληρώνουν οι άνθρωποι για να φτιάξουν κανόνες, οι είσοδοι και οι εκδόσεις τους |
| `preview_blueprint` | ο κανόνας που θα έφτιαχνε ένα blueprint με δεδομένες εισόδους, και τι θα έκανε τώρα· δεν φτιάχνει τίποτα |
| `find_network_client` | πού βρίσκεται μια συσκευή στο δίκτυο του εργοστασίου: η θύρα switch της, αν η θύρα έχει σύνδεσμο, πότε την είδε τελευταία η κονσόλα UniFi |
| `get_network_topology` | το δίκτυο του εργοστασίου όπως το σχεδιάζει η κονσόλα UniFi: τι είναι συνδεδεμένο σε τι, η κατάσταση κάθε συσκευής, και οι συσκευές HotLoop που χάνουν το δίκτυό τους αν πέσει |
| `get_network_events` | τα νεότερα γεγονότα που έχει αναφέρει μια κονσόλα UniFi, και αν το websocket γεγονότων είναι ζωντανό |

### Οντότητες

Μια οντότητα είναι αυτό που οι άνθρωποι ονομάζουν ένα πράγμα στο εργοστάσιο, `sensor.zone_1_temperature` ή `switch.conveyor_run`, που τυλίγει ένα ή περισσότερα tags. Βλ. [Οντότητες](/el/iot/entities/). Για έναν πράκτορα είναι συνήθως η καλύτερη λαβή: το όνομα σημαίνει κάτι, και η οντότητα ξέρει τι μπορείτε να της κάνετε.

Το `list_entities` φιλτράρει ανά `domain`, ανά `equipment` (ένας κόμβος του δέντρου εξοπλισμού με id, όνομα ή διαδρομή ονομάτων όπως `Plant A/Packing`, που ταιριάζει με ό,τι βρίσκεται σε αυτόν ή κάτω από αυτόν, με την ίδια θέση μιας οντότητας να υπερισχύει αυτής της συσκευής της), ανά `label` (label_id ή όνομα· μια οντότητα ταιριάζει αν φέρει την ετικέτα ή τη φέρει η συσκευή της) και ανά `query`, υποσυμβολοσειρά του entity_id ή του ονόματος. Κάθε αποτέλεσμα φέρει την τρέχουσα κατάσταση και ποιότητα και τις υπηρεσίες που δέχεται, ως `domain.service`. Μια οντότητα χωρίς υπηρεσίες είναι μόνο για ανάγνωση. Οι υπηρεσίες προέρχονται από το επίπεδο οντοτήτων, οπότε ένα domain που αποκτά μία εκεί εμφανίζεται εδώ χωρίς αλλαγή.

Το `get_states` δέχεται `entity_ids` και απαντά για καθεμία με την κατάσταση, την ποιότητα, τα χαρακτηριστικά και το `last_changed`. Κρατά την ίδια γραμμή με το `read_tag`: μια κατάσταση `unknown` ή `unavailable` απαντάται με σημείωση ότι δεν είναι τιμή, μια απενεργοποιημένη οντότητα λέει ότι είναι απενεργοποιημένη αντί να λείπει, και η κακή ποιότητα γράφεται ρητά.

Το `call_service` δέχεται `domain`, `service`, `entity_id`, `data` και **υποχρεωτικό** `reason`:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Περνά μέσω του `entity.Services`, του ίδιου εκτελεστή που χρησιμοποιεί το `POST /api/services/...`, που μετατρέπει την κλήση σε εγγραφές μέσω της πύλης εγγραφής. Βλ. [Εγγραφή](#εγγραφή).

### Το δίκτυο

Το `find_network_client` απαντά στο πρώτο ερώτημα για ένα PLC που σώπασε: είναι το PLC ή η θύρα switch του; Δώστε του `deviceId` και ακολουθεί τον επιβεβαιωμένο σύνδεσμο αυτής της συσκευής ως τον πελάτη της UniFi· δώστε του `query` (μια MAC, μια IP ή μέρος ονόματος) και ψάχνει σε κάθε κονσόλα που διαβάζει το HotLoop. Διαβάζει την τελευταία ανάγνωση του driver UniFi, ποτέ την κονσόλα, οπότε ένας πράκτορας που ρωτά σε βρόχο δεν κοστίζει τίποτα στην κονσόλα. Αυτό σημαίνει επίσης ότι ένας βοηθός `--mcp-stdio` απαντά ότι καμία κονσόλα δεν διαβάζεται στη διεργασία του: δεν συνδέεται ποτέ σε κάποια, επειδή το Gateway δίπλα του κρατά ήδη τη συνεδρία. Ρωτήστε το endpoint του Gateway. Βλ. [UniFi Network](/el/iot/unifi/).

Το `get_network_topology` είναι ο χάρτης: κάθε switch, σημείο πρόσβασης και gateway κάτω από αυτό στο οποίο είναι συνδεδεμένο, με τη θύρα και στα δύο άκρα, τον σύνδεσμο, πόσοι πελάτες υπάρχουν σε αυτόν και οι συσκευές HotLoop που συνδέονται με πελάτη από κάτω. Αυτό το τελευταίο μέρος είναι η ακτίνα επίπτωσης: ονομάζει τα PLC που χάνουν το δίκτυό τους αν πέσει αυτό το switch. Ένα switch που η κονσόλα απαριθμεί ως συνδεδεμένο σε τίποτα το λέει και δεν κρεμιέται από το gateway. Το `get_network_events` είναι τα νεότερα γεγονότα της κονσόλας, τα πιο πρόσφατα πρώτα, με τη δική της πρόταση, σημαία προειδοποίησης όπου η κονσόλα το χαρακτηρίζει αρνητικό, και αν το websocket γεγονότων είναι ζωντανό. Και τα δύο δέχονται το `deviceId` της κονσόλας, που μπορεί να παραλειφθεί όταν το HotLoop διαβάζει μόνο μία, και και τα δύο διαβάζουν την τελευταία ανάγνωση του driver όπως το `find_network_client`, οπότε δεν κοστίζουν τίποτα στην κονσόλα και λένε το ίδιο σε βοηθό `--mcp-stdio`: καμία κονσόλα δεν διαβάζεται σε εκείνη τη διεργασία. Τα παλαιότερα γεγονότα είναι στο `get_logbook`, καταχωρημένα κάτω από το switch ή το σημείο πρόσβασης που αφορούσαν.

### Το ημερολόγιο

Το `get_logbook` είναι η χρονογραμμή που σερβίρει το `GET /api/logbook` (βλ. [Το ημερολόγιο](/el/iot/logbook/)): αλλαγές κατάστασης, εγγραφές, μεταβάσεις συναγερμών, εκτελέσεις αυτοματοποιήσεων και αλλαγές διαμόρφωσης, τα νεότερα πρώτα. Περιορίζεται ανά `entity`, ανά `equipment` (id, όνομα ή διαδρομή, και ό,τι βρίσκεται από κάτω· ένα όνομα που ταιριάζει σε δύο κόμβους είναι σφάλμα που τους απαριθμεί και τους δύο), ανά `actor` (μέρος του: το `mcp:` βρίσκει ό,τι έκανε οποιοσδήποτε πράκτορας), ανά `kinds`, και ανά `minutes` πίσω (προεπιλογή μία ημέρα). Μια σελίδα με περισσότερα μετά από αυτήν τελειώνει λέγοντας τι να περαστεί ως `before` για την επόμενη. Για το «τι έγινε πριν στραβώσει αυτό» είναι το καλύτερο `recent_events`: οι ίδιες οι αλλαγές κατάστασης του εξοπλισμού είναι μέσα, και οι γραμμές της πύλης εγγραφής δεν είναι μέσα δύο φορές.

### Σενάρια

Ένα σενάριο είναι μια ονομασμένη ακολουθία βημάτων που κάποιος έγραψε μία φορά, ο κύκλος CIP ή ο καθαρισμός γραμμής, ώστε ένας πράκτορας να εκτελεί την ίδια τη διαδικασία του εργοστασίου αντί να εφευρίσκει μία. Βλ. [Σενάρια](/el/iot/scripts/). Το `list_scripts` λέει τι δέχεται το καθένα. Το `run_script` δέχεται `scriptId`, `fields`, **υποχρεωτικό** `reason`, και δύο διακόπτες:

- Το `dryRun: true` διατρέχει το σενάριο απέναντι στο εργοστάσιο όπως είναι και λέει, βήμα προς βήμα, τι θα γραφόταν και το πρώτο που θα απέρριπτε η πύλη, με τα λόγια της πύλης. Τίποτα δεν γράφεται ή ελέγχεται. Ρωτήστε αυτό πρώτα.
- Το `wait: true` απαντά όταν η εκτέλεση έχει τελειώσει, με το αποτέλεσμα και το ίχνος της. Χωρίς αυτό η απάντηση είναι το id εκτέλεσης, και το `list_scripts` ή το `get_logbook` με `kinds: ["script"]` λέει πώς τελείωσε.

Η εκτέλεση ανήκει στο σενάριο, ως `script:<id>`, με την πηγή `mcp`, οπότε κάθε εγγραφή που κάνει συναντά την πύλη ακριβώς όπως το `write_tag`. Με απενεργοποιημένες εγγραφές (`HOTLOOP_ALLOW_WRITES`), το `run_script` αρνείται πριν τρέξει οτιδήποτε, όπως το `trigger_automation`· μια δοκιμαστική εκτέλεση απαντάται παρ' όλα αυτά, και λέει ότι ο διακόπτης είναι ο λόγος.

### Συνταγές

Μια συνταγή είναι ένα σύνολο τιμών-στόχων που το εργοστάσιο εφαρμόζει μαζί, μια ποιότητα προϊόντος ή μια αλλαγή παρτίδας, ώστε ένας πράκτορας να φορτώνει τους δικούς του αριθμούς του εργοστασίου αντί να τους γράφει έναν έναν. Βλ. [Συνταγές](/el/iot/recipes/). Το `list_recipes` δείχνει τους στόχους καθεμιάς με σειρά και τις παραμέτρους που δέχεται. Το `validate_recipe` ρωτά αν μια θα εφαρμοζόταν τώρα και δίνει κάθε λόγο για τον οποίο όχι, χωρίς να γράφει τίποτα. Το `apply_recipe` δέχεται `recipeId`, `params`, προαιρετικό `version` και **υποχρεωτικό** `reason`.

Ελέγχεται πρώτα ολόκληρη και απορρίπτεται ολόκληρη, χωρίς να γραφτεί τίποτα, αν κάποια τιμή θα απορριπτόταν· οι τιμές εκτός εύρους απορρίπτονται, ποτέ δεν προσαρμόζονται. Μετά οι στόχοι φεύγουν με σειρά κάτω από ένα id κλήσης, ο πρώτος που αποτυγχάνει σταματά τους υπόλοιπους, και τίποτα δεν αναιρείται. Η απάντηση λέει, στόχο προς στόχο, τι έφυγε και αν η συσκευή διάβασε πίσω την τιμή. Οι εγγραφές είναι του πράκτορα, με την πηγή `mcp`, οπότε η πύλη ισχύει για καθεμία· με απενεργοποιημένες εγγραφές (`HOTLOOP_ALLOW_WRITES`), το `apply_recipe` αρνείται πριν ελεγχθεί οτιδήποτε. Μια συνταγή που ονομάζει δική της άδεια εφαρμογής είναι για τους ανθρώπους στους οποίους έχει δοθεί, και ένας πράκτορας δεν είναι ένας από αυτούς.

### Blueprints

Ένα blueprint είναι ένας κανόνας που γράφτηκε μία φορά με τυποποιημένα κενά: ποιος κινητήρας, πόση ώρα, ποιο όριο. Βλ. [Blueprints](/el/iot/blueprints/). Το `list_blueprints` λέει τι δέχεται το καθένα. Το `preview_blueprint` δέχεται `blueprintId`, `automationId` και `inputs`, και απαντά με τον κανόνα που θα έφτιαχνε και τι θα έκανε αυτός ο κανόνας αν ενεργοποιούνταν τώρα, με κάθε εγγραφή να υπόκειται στους ελέγχους της πύλης. Οι είσοδοι ελέγχονται ακριβώς όπως τις ελέγχει η οθόνη: εκτός εύρους απορρίπτεται, δεν προσαρμόζεται.

Το `instantiate_blueprint` φτιάχνει τον κανόνα, μέσω της διαδρομής που χρησιμοποιεί η οθόνη Blueprints: οι ίδιοι έλεγχοι, και ο κανόνας καταλήγει στο ημερολόγιο με τον πράκτορα ως δημιουργό. Ένας κανόνας είναι μια διαρκής εντολή να διατάσσεται εξοπλισμός κάθε φορά που ενεργοποιείται ο διεγέρτης του, οπότε ένας πράκτορας κοιτάζει πρώτα: το `preview_blueprint` δεν αποθηκεύει και δεν γράφει τίποτα, και απαντάται είτε οι εγγραφές είναι ενεργές είτε όχι. Κάθε εγγραφή που κάνει στη συνέχεια ο κανόνας που φτιάχτηκε συναντά την πύλη εγγραφής, όπως για έναν κανόνα που έφτιαξε άνθρωπος. Βλ. [Αλλαγή διαμόρφωσης](#αλλαγή-διαμόρφωσης).

## Αλλαγή διαμόρφωσης

Ό,τι μπορεί να διαβάσει ένας πράκτορας, μπορεί να το αλλάξει. Τα παραπάνω εργαλεία που διαβάζουν το εργοστάσιο έχουν αντίστοιχα που το αλλάζουν, εξήντα εννέα, και κανένα δεν είναι δεύτερη υλοποίηση: το καθένα είναι μία διαδρομή του REST API, και μια κλήση εκτελείται μέσω του δικού της χειριστή αυτής της διαδρομής. Η επικύρωση, ο έλεγχος αδειών, η επαναφόρτωση του runtime και η γραμμή ελέγχου ανήκουν στη διαδρομή, με τον πράκτορα ως ενεργούντα (`mcp:<client>`, ή `mcp:<email>` με σύνδεση Vord), οπότε μια συσκευή χωρίς driver, ένας κανόνας που δεν μεταγλωττίζεται, μια είσοδος blueprint εκτός εύρους ή ένα tag για το οποίο η ανακαλυφθείσα συσκευή δεν έχει γίνει δεκτή απορρίπτονται με τα λόγια που δείχνει η οθόνη, και τίποτα δεν άλλαξε.

Καθένα δέχεται τις τιμές διαδρομής της διαδρομής με όνομα (`id`, `device`, `name`...), `body`, το ίδιο JSON που δέχεται το API ([Το HTTP API](/el/iot/api/) έχει κάθε body), και **υποχρεωτικό** `reason`. Ο λόγος καταγράφεται ως γραμμή `config` στο αρχείο καταγραφής συστήματος δίπλα σε αυτή της ίδιας της διαδρομής, με αναφορά σε ό,τι άλλαξε.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Ό,τι στέκεται μπροστά τους είναι ό,τι στέκεται μπροστά από το `write_tag`, χωρίς τον γενικό διακόπτη, επειδή ούτε οι οθόνες τον χρειάζονται για να αλλάξουν διαμόρφωση:

1. Το `HOTLOOP_ALLOW_MCP_WRITES`, ενεργό από προεπιλογή, πρέπει να είναι ενεργό.
2. Ένας καλών με ορισμένο `HOTLOOP_MCP_OIDC_WRITE_ROLE` πρέπει να τον έχει.
3. Η κλήση φέρει μία άδεια, αυτή που ζητά η διαδρομή της (η τρίτη στήλη παρακάτω), και τίποτα άλλο. Μια διαδρομή απαντά σε έναν πράκτορα όπως απαντά σε άνθρωπο χωρίς αυτή την άδεια, και ένα τεστ δεσμεύει κάθε γραμμή του πίνακα σε πραγματική διαδρομή και στην άδεια που ζητά αυτή η διαδρομή.
4. Ένας λόγος.

Η διάταξη εξοπλισμού παραμένει `write_tag`, `call_service`, `run_script`, `apply_recipe` και `trigger_automation` με ενεργό το `HOTLOOP_ALLOW_WRITES` και με το σήμα εγγράψιμου και το εύρος του tag να τηρούνται. Το να γίνει ένα tag, ένας κανόνας, ένα σενάριο ή μια συνταγή εγγράψιμο είναι διαμόρφωση: δεν διατάσσει τίποτα μέχρι να χρησιμοποιηθεί, και ό,τι διατάσσει τότε περνά από την πύλη.

Οι ίδιες οι λειτουργίες του διαχειριστή είναι επίσης εργαλεία, στην ενότητα [Διαχείριση](#διαχείριση) παρακάτω. Η αποδοχή μιας ανακαλυφθείσας συσκευής είναι εδώ, όπως στην οθόνη· τα σημεία πάνω της πρέπει ακόμη να οπλιστούν για εγγραφή ένα ένα.

Τα εργαλεία υπάρχουν και στο `--mcp-stdio`: η διεργασία χτίζει τον ίδιο διακομιστή API και δεν ανοίγει ποτέ τη θύρα του.

**Συσκευές και tags**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**Ανακάλυψη και brokers**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Οντότητες, βοηθοί, εξοπλισμός, ετικέτες**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**Συναγερμοί**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Αυτοματοποιήσεις και blueprints**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Σενάρια και συνταγές**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Πίνακες ελέγχου και ο πίνακας**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Εισαγωγές**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

Το `import_codesys_alarms` δέχεται το αρχείο που έγραψε το Export Alarms του CODESYS IDE, ως `contentBase64` (τα byte όπως είναι στον δίσκο, που το IDE γράφει σε UTF-16) ή ως `content` (το κείμενο, αν το έχετε ως κείμενο), με το `deviceId` στο οποίο ανήκουν οι συναγερμοί και, αν τους θέλετε, `application` και `defaultPriority`. Αν το αφήσετε έτσι κάνει μόνο προεπισκόπηση: λέει ποιοι συναγερμοί θα περνούσαν και ποιοι όχι, δεν αποθηκεύει τίποτα και δεν χρειάζεται λόγο. Με `apply` true τους αποθηκεύει ως ορισμούς συναγερμών, και τότε χρειάζεται λόγο και τον διακόπτη εγγραφής MCP όπως κάθε εργαλείο που αλλάζει διαμόρφωση.

Το `screen_export` απαντά έναν πίνακα ελέγχου ως αρχείο οθόνης HotLoop ([Αρχεία οθόνης](/el/iot/screen-file/)), και το `screen_import` δέχεται ένα, σε αυτή την εγκατάσταση ή σε άλλη. Ρωτά πρώτα: το `dryRun` είναι true εκτός αν πείτε false, και μια δοκιμαστική εκτέλεση δεν αποθηκεύει τίποτα και απαντά με την αναφορά με κάθε πρόβλημα απαριθμημένο και τις αναφορές για `remap`. Μια πραγματική εισαγωγή χρειάζεται `dryRun` false, λόγο και τον διακόπτη εγγραφής MCP, και ένα id που υπάρχει απορρίπτεται εκτός αν το `replace` είναι true. Η οθόνη είναι δεδομένα του πελάτη, οπότε το αρχείο είναι ο τρόπος που μετακινείται μεταξύ εγκαταστάσεων, ποτέ κώδικας.

### Αναγνώσεις και δοκιμαστικές εκτελέσεις

Ένας πράκτορας που μπορεί να αλλάξει έναν πίνακα ελέγχου, έναν broker ή έναν κόμβο του δέντρου εξοπλισμού πρέπει πρώτα να μπορεί να διαβάσει τι υπάρχει, οπότε κάθε αντικείμενο που αλλάζει ένα παραπάνω εργαλείο έχει εδώ μια ανάγνωση, και οι δοκιμαστικές εκτελέσεις των επεξεργαστών είναι επίσης εργαλεία. Καθεμία είναι μια διαδρομή που εκτελείται μέσω του δικού της χειριστή με την άδεια ανάγνωσης που ζητά αυτή η διαδρομή. Μια ανάγνωση απαντά χωρίς λόγο και χωρίς τον διακόπτη εγγραφής, και ένας καλών που ο ρόλος εγγραφής αφήνει έξω μπορεί παρ' όλα αυτά να τις κάνει, επειδή φέρουν άδεια ανάγνωσης και τίποτα παραπάνω. Οι τρεις δοκιμαστικές εκτελέσεις (`validate_automation`, `validate_script` και `browse_device`) δεν αλλάζουν τίποτα· οι δύο που ελέγχουν ένα σώμα φέρουν την άδεια εγγραφής που ζητά η διαδρομή τους, οπότε μένουν πίσω από τον ρόλο εγγραφής.

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### Διαχείριση

Οι λογαριασμοί χρηστών, οι ρυθμίσεις, τα αντίγραφα ασφαλείας, η πολιτική κλιμάκωσης, οι στόχοι του historian, οι συνδέσεις του broker, ο στόλος των edge relays και οι προγραμματισμένες αναφορές είναι του διαχειριστή, και είναι επίσης εργαλεία: σαράντα δύο, με το ίδιο μοτίβο με τα υπόλοιπα. Καθένα είναι μια διαδρομή που εκτελείται μέσω του δικού της χειριστή με την άδεια που ζητά αυτή η διαδρομή (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), έναν λόγο για κάθε αλλαγή και τον πράκτορα στη γραμμή ελέγχου. Μια διαδρομή που αρνείται αρνείται έναν πράκτορα με τα ίδια λόγια. Οι αναγνώσεις (τα εργαλεία `list_` και `get_`) δεν χρειάζονται λόγο και διακόπτη εγγραφής, και χρειάζονται ακόμη τον ρόλο εγγραφής του καλούντος όταν υπάρχει ορισμένος, επειδή η άδεια που φέρουν είναι διαχειριστή. Τα εργαλεία στόλου και αναφορών υπάρχουν μόνο σε προϊόν που έχει τη λειτουργία.

Δύο πράγματα ανήκουν στις ίδιες τις διαδρομές και αξίζει να τα γνωρίζετε πριν βασιστείτε σε ένα εργαλείο:

- **Οι διακόπτες εγγραφής δεν έχουν διαδρομή.** Τα `safety.allowWrites` και `safety.allowMcpWrites` ανήκουν στην εγκατάσταση (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), και το `PUT /api/settings` τα απορρίπτει ως ορισμένα από την εγκατάσταση. Έτσι το `save_settings` αλλάζει ό,τι μπορεί να αλλάξει η οθόνη Ρυθμίσεων και απαντά αυτή την άρνηση για τους διακόπτες, με αυτά τα λόγια. Ένας πράκτορας δεν μπορεί να ενεργοποιήσει τον διακόπτη από τον οποίο περιμένουν οι δικές του εγγραφές.
- **Ο κωδικός ενός χρήστη περνά μέσα από την κλήση.** Τα `create_user`, `reset_user_password` και τα εργαλεία PIN δέχονται ένα μυστικό στα ορίσματά τους, όπως το API. Η γραμμή ελέγχου κατονομάζει την αλλαγή και τον λόγο και ποτέ το μυστικό.

**Λογαριασμοί χρηστών**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**Ρυθμίσεις, αντίγραφα ασφαλείας, ειδοποιήσεις**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Στόχοι historian και συνδέσεις broker**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**Ο στόλος των edge relays (Gateway)**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Προγραμματισμένες αναφορές (Gateway)**

| Εργαλείο | Διαδρομή | Άδεια |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Πόροι

| URI | Περιεχόμενο |
|---|---|
| `iiot://devices` | το δέντρο συσκευών με tags, ως JSON |
| `iiot://tags` | ο κατάλογος tags με τρέχουσες τιμές |
| `iiot://alarms` | ορισμοί συναγερμών, ζωντανή κατάσταση και μια αναφορά καταστάσεων |
| `iiot://protocols` | υποστηριζόμενα πρωτόκολλα, από τους ενσωματωμένους drivers |

Οι πόροι υπάρχουν ώστε ένας πελάτης να τραβά ολόκληρο τον χώρο ονομάτων με μία ανάγνωση αντί να τον ανακαλύπτει μία κλήση εργαλείου τη φορά.

## Τι δεν θα κάνουν τα εργαλεία

Τα εργαλεία γράφτηκαν ώστε ένα μοντέλο να μην μπορεί να στρογγυλέψει την αβεβαιότητα κατά λάθος.

**Ένα tag χωρίς ανάγνωση δεν είναι tag που διαβάζει μηδέν.** Το `read_tag` λέει `no reading has been taken for this tag yet`, ή `this tag is not configured` αν δεν υπάρχει. Κανένα δεν επιστρέφει τιμή.

**Η κακή ποιότητα δηλώνεται, δεν υπονοείται.** Οι αναγνώσεις επιστρέφουν ως `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Οι οδηγίες του διακομιστή το επαναλαμβάνουν. Μη μεσοσταθμίζετε κακές αναγνώσεις και μην αναφέρετε μία ως μέτρηση.

**Το `describe_protocol` δεν μπορεί να πει ψέματα.** Η διαθεσιμότητα προέρχεται από τους drivers που έχουν μεταγλωττιστεί στο εκτελέσιμο, οπότε το εργαλείο δεν μπορεί να ισχυριστεί πρωτόκολλο που το gateway δεν έχει.

**Μια άρνηση είναι απάντηση, όχι αστοχία μεταφοράς.** Μια απορριφθείσα εγγραφή επιστρέφει ως αποτέλεσμα εργαλείου με `isError`, που σημαίνει ότι η κλήση ήταν σωστά σχηματισμένη και απορρίφθηκε σκόπιμα. Δεν είναι σφάλμα πρωτοκόλλου που πρέπει να επαναληφθεί.

## Εγγραφή

Το MCP διαβάζει και γράφει: διατάζει εξοπλισμό, και αλλάζει διαμόρφωση ([παραπάνω](#αλλαγή-διαμόρφωσης)). Το `write_tag` κινεί πραγματικό εξοπλισμό, οπότε τα ίδια πράγματα στέκονται ανάμεσα σε μια κλήση εργαλείου και μια μηχανή που στέκονται ανάμεσα στο κλικ ενός χειριστή και μιας:

1. Το `HOTLOOP_ALLOW_WRITES`, ο γενικός διακόπτης για ολόκληρη την εγκατάσταση, πρέπει να είναι ενεργό. Με αυτό απενεργοποιημένο τίποτα δεν γράφει: ούτε το UI, ούτε το API, ούτε ένας πράκτορας.
2. Το tag πρέπει να είναι σημειωμένο εγγράψιμο. Τα tags είναι μόνο για ανάγνωση μέχρι κάποιος να πει διαφορετικά, ένα ένα.
3. Η τιμή πρέπει να είναι εντός του διαμορφωμένου εύρους του tag. **Απορρίπτεται, δεν περιορίζεται**: το να σταλεί 400 όταν κάποιος ζήτησε 500 είναι να γίνεται αθόρυβα κάτι διαφορετικό από ό,τι ζητήθηκε.

Ένας **λόγος απαιτείται** και καταγράφεται δίπλα στην εγγραφή. Μια γραμμή ελέγχου που κανείς δεν μπορεί να ερμηνεύσει έξι μήνες μετά είναι ελάχιστα καλύτερη από καμία.

Το `call_service` παίρνει ακριβώς τα ίδια τρία, επειδή δεν είναι παρά εγγραφές μέσω της ίδιας πύλης, και μετά τους δικούς της ελέγχους της οντότητας από πάνω (το βήμα και το στενότερο εύρος ενός αριθμού, το μοτίβο ενός κειμένου, η οντότητα να μην είναι απενεργοποιημένη). Μια άρνηση σε οποιονδήποτε ελέγχεται κατά της οντότητας όσο και του tag: πηγή `mcp`, ο πελάτης με όνομα, το entity_id, η υπηρεσία και το id κλήσης, η ίδια γραμμή που αφήνει ένα απορριφθέν `write_tag` συν την οντότητα. Μια κλήση χωρίς λόγο απορρίπτεται πριν επιχειρηθεί οτιδήποτε, όπως το `write_tag`.

Το `trigger_automation` ελέγχεται πανομοιότυπα, επειδή οι ενέργειες ενός κανόνα μπορούν να διατάξουν εξοπλισμό· αλλιώς θα ήταν τρόπος να παρακαμφθούν οι έλεγχοι που συναντά το `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Όταν οι εγγραφές είναι απενεργοποιημένες, οι οδηγίες του διακομιστή το λένε εξαρχής, ώστε ένας πράκτορας να μη χάσει γύρο ανακαλύπτοντάς το.

## Κλήσεις προς τα έξω

Η ενέργεια `mcp_call` μιας αυτοματοποίησης καλεί ένα εργαλείο σε άλλον διακομιστή MCP. Διαμορφώστε τους διακομιστές στο chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Οι συνεδρίες συγκεντρώνονται σε pool και επαναχρησιμοποιούνται· η σύνδεση σε κάθε κλήση θα σήμαινε χειραψία, initialize και λίστα εργαλείων κάθε φορά που ενεργοποιείται ένας κανόνας. Μια συνεδρία που πέθανε επανασυνδέεται στην επόμενη κλήση και όχι με χρονιστή, επειδή η επόμενη κλήση είναι η πρώτη στιγμή που ενδιαφέρει κάποιον. Ένας διαμορφωμένος διακομιστής που είναι εκτός δεν σταματά την παρακολούθηση του εργοστασίου, τίποτα δεν καλείται μέχρι να το χρειαστεί ένας κανόνας.

Η οθόνη MCP δείχνει κάθε διαμορφωμένο διακομιστή, αν είναι συνδεδεμένος και τα εργαλεία που διαφημίζει.

## Ομοσπονδία τοποθεσιών

Ένα gateway ανά εργοστάσιο είναι ο τρόπος που προορίζεται να τρέχει. Κάθε τοποθεσία κρατά τη δική της βάση δεδομένων, τον δικό της πίνακα και το δικό της όνομα, και καμία δεν εξαρτάται από το να μένει ενεργός ένας σύνδεσμος προς κάπου αλλού, ένα εργοστάσιο δεν παύει να παρακολουθείται επειδή έπεσε το WAN.

Το να τις βλέπετε όλες μαζί χρησιμοποιεί το πρωτόκολλο που οι τοποθεσίες ήδη μιλούν. Διαμορφώστε ένα gateway στο cloud με τις τοποθεσίες ως εξερχόμενους διακομιστές MCP, ακριβώς όπως για την ενέργεια `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

Η οθόνη Τοποθεσίες καλεί τότε το `get_plant_status` σε καθεμία παράλληλα και συγκεντρώνει τις απαντήσεις. Δεν υπάρχει τίποτα να εγκατασταθεί σε μια τοποθεσία για να εμφανιστεί, καμία τοποθεσία δεν χρειάζεται να ξέρει ότι ομοσπονδοποιείται, και τίποτα δεν συνδέεται προς τα μέσα σε δίκτυο εργοστασίου.

Δύο συμπεριφορές είναι σκόπιμες και αξίζει να βασιστείτε σε αυτές:

- Μια τοποθεσία που δεν απαντά εμφανίζεται ως **μη προσβάσιμη, με τον λόγο**, και μένει έξω από τη συγκέντρωση. Το να μετριέται ένα εργοστάσιο που δεν μπορείτε να φτάσετε ως μηδέν συναγερμοί είναι το χειρότερο που θα μπορούσε να κάνει μια τέτοια οθόνη.
- Οι αριθμοί που ανέφερε τελευταία μια τοποθεσία δεν εμφανίζονται ποτέ. Φαίνονται τρέχοντες και δεν είναι.

Κάθε τοποθεσία παίρνει τη δική της σύντομη προθεσμία, ώστε ένα εργοστάσιο σε νεκρό σύνδεσμο να μην μπορεί να καθυστερήσει όσα είναι ενεργά.

## Τι αξίζει να πείτε σε έναν πράκτορα

Οι ίδιες οι οδηγίες του διακομιστή το καλύπτουν, αλλά για όποιον γράφει ένα prompt γύρω από αυτό:

- Οι καταστάσεις συναγερμών ακολουθούν το ISA-18.2. Το `rtn-unack` σημαίνει συναγερμό που επανήλθε από μόνος του πριν τον δει κανείς, αξίζει ακόμη να αναφερθεί, και είναι η κατάσταση που αποδεικνύει ότι η επιβεβαίωση και η επαναφορά στο φυσιολογικό είναι ανεξάρτητες.
- Το `query_history` με ομάδες, όχι ακατέργαστο, για οτιδήποτε μεγαλύτερο από λίγα λεπτά. Μία ημέρα δεδομένων ενός δευτερολέπτου είναι 86.400 σημεία ανά tag. Οι ομάδες ακολουθούν τον κανόνα ποιότητας: οι κακές και αβέβαιες αναγνώσεις μετρούνται στο `badReadings`, ποτέ δεν μεσοσταθμίζονται, και μια ομάδα χωρίς τίποτα καλό έχει μηδενικό μέσο όρο.
- Το `recent_events` είναι ο τρόπος να ανασυνθέσετε ένα περιστατικό: συνδέσεις συσκευών, εγγραφές, μεταβάσεις συναγερμών, εκτελέσεις αυτοματοποιήσεων και αλλαγές διαμόρφωσης, με σειρά, καθεμία με τον ενεργούντα που την προκάλεσε.
