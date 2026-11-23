---
title: "Ο διακομιστής MCP"
description: "Το Cascade έχει διακομιστή MCP που διαβάζει και γράφει: 83 εργαλεία, καθένα διαδρομή του API με δικό του χειριστή, δικαίωμα, αιτιολογία και γραμμή ελέγχου."
---

Το Cascade έχει διακομιστή MCP, και διαβάζει και γράφει. Παραδίδεται ενεργοποιημένος, στο `/mcp`, στην ίδια διεύθυνση με το API και τον επεξεργαστή, και ένας πράκτορας που συνδέεται σε αυτόν μπορεί να κάνει ό,τι μπορεί το άτομο πίσω από το κλειδί του και τίποτα παραπάνω. Δεν υπάρχει λειτουργία μόνο ανάγνωσης να παρακάμψετε, γιατί ένας διακομιστής που ένας πράκτορας μπορεί να κοιτάζει και να μην αγγίζει είναι σελίδα κατάστασης, και έχετε ήδη μία.

84 εργαλεία, και καθένα από αυτά είναι μια διαδρομή του REST API. Μια κλήση δεν περνά δίπλα από τη διαδρομή, περνά μέσα από αυτήν: ο ίδιος ο χειριστής της διαδρομής ελέγχει την άδεια, επικυρώνει το σώμα, κάνει την αλλαγή και γράφει τη γραμμή ελέγχου. Τίποτα δεν αντιγράφηκε στον διακομιστή MCP ώστε να αποκλίνει, και τίποτα δεν αφέθηκε έξω από αυτόν ώστε να παρακαμφθεί.

Τι σημαίνει αυτό για εσάς: αν μια ροή εργασίας, ένα διαπιστευτήριο, ένα έργο ή ένας χρήστης είναι κάτι που μπορείτε να αλλάξετε από τον επεξεργαστή, ένας πράκτορας με το κλειδί σας μπορεί να το αλλάξει κι αυτός, με τα όρια του ρόλου σας, και το αρχείο ελέγχου λέει ότι ήταν πράκτορας και ποιος.

## Σύνδεση

Φτιάξτε ένα κλειδί. Στον επεξεργαστή βρίσκεται στον λογαριασμό σας, ή με το API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Το διακριτικό επιστρέφεται μία φορά και ξεκινά με `hlc_`. Ένα κλειδί κάνει ό,τι θα μπορούσε ο κάτοχός του, περιορισμένο στα πεδία εφαρμογής του: δώστε σε έναν πράκτορα `["workflow.read","execution.read"]` και μπορεί να κοιτάζει χωρίς να αγγίζει. Ένα κλειδί λογαριασμού υπηρεσίας (ένα έργο, ένας ρόλος, φτιαγμένο από διαχειριστή του έργου) λειτουργεί με τον ίδιο τρόπο και είναι το σωστό κλειδί για μια μόνιμη ενσωμάτωση.

Έπειτα στρέψτε τον πελάτη στο `/mcp` και στείλτε το κλειδί ως bearer token. Η μεταφορά που μιλά είναι το streamable HTTP:

```json
{
  "mcpServers": {
    "cascade": {
      "type": "http",
      "url": "https://cascade.plant.example/mcp",
      "headers": { "Authorization": "Bearer hlc_..." }
    }
  }
}
```

Ένα αίτημα χωρίς κλειδί, με λάθος, ανακληθέν ή ληγμένο κλειδί, ή με κλειδί χρήστη που έχει απενεργοποιηθεί, παίρνει 401 πριν φτάσει σε εργαλείο, και ένα κλειδί που ανακαλείται στη μέση μιας συνεδρίας παύει να λειτουργεί στην επόμενη κλήση του.

## Οι κανόνες

**Τα δικαιώματα είναι της διαδρομής.** Το `whoami` λέει ποια έργα μπορεί να δει το κλειδί και τον ρόλο του σε καθένα. Ένα εργαλείο που το κλειδί δεν επιτρέπεται να χρησιμοποιήσει απορρίπτεται με την αιτιολογία της ίδιας της διαδρομής: 403 για δικαίωμα που του λείπει, 404 για κάτι που δεν μπορεί να δει, που είναι η ίδια απάντηση με του REST API. Είναι απόφαση, όχι βλάβη να παρακαμφθεί.

**Μια εγγραφή θέλει αιτιολογία.** Κάθε εργαλείο που αλλάζει κάτι παίρνει ένα `reason` και αρνείται χωρίς αυτό. Γράφεται στο αρχείο ελέγχου με το κλειδί σας και το όνομα που έδωσε στον εαυτό του ο πελάτης σας.

**Τα μυστικά μένουν στη θέση τους.** Κανένα εργαλείο δεν επιστρέφει το μυστικό πεδίο ενός διαπιστευτηρίου, σε κανένα κλειδί, και ένα διαπιστευτήριο που δημιουργείται μέσω MCP έχει τα μυστικά του σφραγισμένα στο θησαυροφυλάκιο μόλις φτάσουν. Το `get_credential` είναι η ίδια προβολή χωρίς μυστικά που έχει η φόρμα επεξεργασίας.

**Οι διακόπτες ανήκουν στην ανάπτυξη.** Δύο ρυθμίσεις, στο περιβάλλον όπου ξεκινά ο διακομιστής, που καμία κλήση API και κανένας πράκτορας δεν μπορεί να αλλάξει:

| Ρύθμιση | Προεπιλογή | Τι κάνει |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Με `false` το `/mcp` δεν υπάρχει. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Με `false` κάθε εργαλείο που αλλάζει οτιδήποτε αρνείται, και όσα διαβάζουν εξακολουθούν να λειτουργούν. |

Το `PATCH /settings` δεν γνωρίζει κανένα από τα δύο, οπότε ένας πράκτορας που μπορεί να επεξεργάζεται τις ρυθμίσεις δεν μπορεί παρ' όλα αυτά να ενεργοποιήσει ξανά τις εγγραφές.

**Δεν γράφει ποτέ στον εξοπλισμό.** Το `run_workflow` ξεκινά μια πραγματική εκτέλεση, και ό,τι κάνουν τα βήματά της στα συστήματα που καλούν εξαρτάται από τα βήματα. Ό,τι κινεί μια βαλβίδα ή αλλάζει μια τιμή ρύθμισης περνά από την πύλη εγγραφής του HotLoop, ώστε ο έλεγχος της πύλης να το βλέπει όποιος κι αν ξεκίνησε τη ροή εργασίας.

## Τι λέει το αρχείο ελέγχου

Δύο γραμμές για μια εγγραφή. Η γραμμή της ίδιας της διαδρομής έχει τον πράκτορα ως ενεργούντα, με τύπο `mcp`, το κλειδί, ποιανού είναι και τον πελάτη:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Και μία γραμμή του εργαλείου, με την αιτιολογία, που γράφεται είτε η διαδρομή είπε ναι είτε αρνήθηκε:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

Το `list_audit` με `action=mcp.write` είναι κάθε αλλαγή που έκανε ένας πράκτορας και γιατί.

## Τα εργαλεία

Κάθε γραμμή είναι πραγματική διαδρομή και το δικαίωμα που ζητά αυτή η διαδρομή, και μια δοκιμή κρατά τον πίνακα πιστό και στα δύο. Ένα δικαίωμα είναι δικαίωμα έργου (ελέγχεται στο έργο όπου βρίσκεται το αντικείμενο) ή εγκατάστασης (ιδιοκτήτες και διαχειριστές). Κάθε κλειδί συνδεδεμένου χρήστη μπορεί να ζητήσει όσα σημειώνονται έτσι.

Τα εργαλεία με σώμα παίρνουν ένα `body`, το ίδιο JSON που παίρνει το REST API. Το `describe_tool_body` δίνει το σχήμα οποιουδήποτε εργαλείου, ώστε η πρώτη κλήση να είναι σωστή.

| Εργαλείο | Διαδρομή | Δικαίωμα | Είδος |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `whoami` | `GET /api/v1/me` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_permissions` | `GET /api/v1/permissions` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_roles` | `GET /api/v1/roles` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `get_role` | `GET /api/v1/roles/{role}` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_projects` | `GET /api/v1/projects` | `project.read` | ανάγνωση |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | ανάγνωση |
| `create_project` | `POST /api/v1/projects` | `project.create` | εγγραφή |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | εγγραφή |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | εγγραφή |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | ανάγνωση |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | εγγραφή |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | εγγραφή |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | ανάγνωση |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | ανάγνωση |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | ανάγνωση |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | εγγραφή |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | εγγραφή |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | εγγραφή |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | εγγραφή |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | εγγραφή |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | εγγραφή |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | εγγραφή |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | εγγραφή |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | ανάγνωση |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | ανάγνωση |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | ανάγνωση |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | εγγραφή |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | εγγραφή |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | ανάγνωση |
| `list_expression_functions` | `GET /api/v1/expression/functions` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_step_types` | `GET /api/v1/step-types` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | ανάγνωση |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | εγγραφή |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | εγγραφή |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | εγγραφή |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | ανάγνωση |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | εγγραφή |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | εγγραφή |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | εγγραφή |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | ανάγνωση |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | ανάγνωση |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | ανάγνωση |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | ανάγνωση |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | εγγραφή |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | εγγραφή |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | εγγραφή |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | εγγραφή |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | εγγραφή |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | εγγραφή |
| `list_credential_types` | `GET /api/v1/credential-types` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | ανάγνωση |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | ανάγνωση |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | εγγραφή |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | εγγραφή |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | εγγραφή |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | εγγραφή |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | εγγραφή |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | εγγραφή |
| `create_role` | `POST /api/v1/roles` | `role.manage` | εγγραφή |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | εγγραφή |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | εγγραφή |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | εγγραφή |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | εγγραφή |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | εγγραφή |
| `list_secret_providers` | `GET /api/v1/secret-providers` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | εγγραφή |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | ανάγνωση |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | εγγραφή |
| `list_keys` | `GET /api/v1/api-keys` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | εγγραφή |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | ανάγνωση |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | εγγραφή |
| `list_users` | `GET /api/v1/users` | `user.manage` | ανάγνωση |
| `create_user` | `POST /api/v1/users` | `user.manage` | εγγραφή |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | εγγραφή |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | εγγραφή, μόνο ιδιοκτήτης |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | ανάγνωση |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | ανάγνωση |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | ανάγνωση |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | εγγραφή |
| `describe_tool_body` | δεν είναι διαδρομή: το σχήμα JSON που δέχεται το σώμα ενός εργαλείου | οποιοδήποτε κλειδί συνδεδεμένου χρήστη | ανάγνωση |

## Εσκεμμένα εκτός

Δέκα διαδρομές απορρίπτουν μόνες τους ένα κλειδί, επειδή θέλουν συνδεδεμένο άτομο, και ο διακομιστής MCP δεν προσποιείται το αντίθετο: δημιουργία κλειδιού API, δημιουργία κλειδιού λογαριασμού υπηρεσίας, δημιουργία διακριτικού SCIM, προσθήκη, αλλαγή και διαγραφή εξωτερικού παρόχου μυστικών, προσθήκη, αλλαγή και διαγραφή προορισμού αρχείων καταγραφής, και ο δικός κωδικός ενός ατόμου. Ένα κλειδί που θα μπορούσε να κόβει κλειδιά ή να αλλάζει πού στέλνεται το αρχείο ελέγχου είναι διαρρεύσαν κλειδί που μπορεί να κρατά τον εαυτό του ζωντανό. Καθεμία από αυτές θα ήταν εργαλείο που θα απαντούσε πάντα μόνο «δεν επιτρέπεται», οπότε καμία δεν προσφέρεται. Όλα τα υπόλοιπα είναι εργαλείο: λίστα προορισμών αρχείων καταγραφής, παρόχων μυστικών και διακριτικών SCIM, ανάκληση διακριτικού SCIM, δοκιμή παρόχου ή προορισμού, λίστα και ανάκληση κλειδιών, άνοιγμα του δοκιμαστικού webhook μιας ροής εργασίας και έναρξη σύνδεσης OAuth2, που επιστρέφει τη διεύθυνση που ανοίγει έπειτα ένα άτομο. Ένα κλειδί μπορεί να ανακαλέσει τον εαυτό του, που είναι το πρώτο που πρέπει να μπορεί να κάνει ο κάτοχος ενός διαρρεύσαντος κλειδιού.

Το `/api/v1/openapi.json` δεν είναι εργαλείο: το `describe_tool_body` δίνει τα σώματα.
