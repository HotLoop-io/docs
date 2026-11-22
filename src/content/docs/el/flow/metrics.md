---
title: "Μετρήσεις του Flow"
description: "Οι μετρήσεις Prometheus που εκθέτει το Flow ανά κόμβο, ώστε ένα φραγμένο καλώδιο ή ένα γεμάτο εισερχόμενο να φανεί σε ένα γράφημα πριν φανεί ως διακοπή."
---

Το Prometheus στο `/metrics`, ανά κόμβο, με ετικέτες `node` και `type` σε ό,τι είναι ανά κόμβο. Χωρίς πρόσθετο κοντέινερ εξαγωγής, επειδή ένα κουτί στην άκρη δεν έχει χώρο για ένα και δεν πρέπει να χρειάζεστε δεύτερο κοντέινερ για να μάθετε ότι το εισερχόμενό σας είναι γεμάτο.

| Μέτρηση | Τύπος | Τι σας λέει |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Πάντα 1. Η έκδοση βρίσκεται στην ετικέτα. |
| `hotloop_flow_uptime_seconds` | gauge | Δευτερόλεπτα από την εκκίνηση του χρόνου εκτέλεσης. |
| `hotloop_flow_nodes_running` | gauge | Στιγμιότυπα κόμβων που τρέχουν αυτή τη στιγμή. |
| `hotloop_flow_node_messages_received_total` | counter | Μηνύματα που παραδόθηκαν σε έναν κόμβο. |
| `hotloop_flow_node_messages_sent_total` | counter | Μηνύματα που εξέπεμψε ένας κόμβος. |
| `hotloop_flow_node_errors_total` | counter | Σφάλματα που προκάλεσε ένας κόμβος. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Μηνύματα που παραβίασαν ένα σχήμα JSON σε έναν κόμβο: στη θύρα εισόδου του, σε μια θύρα εξόδου ή σε έναν κόμβο `json`. Το καθένα πήγε σε έναν κόμβο Catch με τη διαδρομή κάθε λανθασμένου πεδίου. |
| `hotloop_flow_node_messages_dropped_total` | counter | Μηνύματα που απορρίφθηκαν επειδή ένα εισερχόμενο ήταν γεμάτο. |
| `hotloop_flow_node_sends_blocked_total` | counter | Φορές που ένας αποστολέας περίμενε για χώρο. Διαρκής αντίστροφη πίεση, που είναι το πραγματικό σήμα ότι μια ροή δεν προλαβαίνει. |
| `hotloop_flow_node_queue_length` | gauge | Μηνύματα που περιμένουν αυτή τη στιγμή. |
| `hotloop_flow_node_queue_capacity` | gauge | Από πού αρχίζει να εφαρμόζεται η πολιτική υπερχείλισης. |
| `hotloop_flow_node_queue_high_water` | gauge | Το μεγαλύτερο βάθος που έχει φτάσει ποτέ αυτό το εισερχόμενο. |
| `hotloop_flow_goroutines` | gauge | Περίπου μία ανά κόμβο συν το I/O που κρατά ο καθένας. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap που έχει διατεθεί αυτή τη στιγμή. |
| `hotloop_flow_memory_sys_bytes` | gauge | Byte που πάρθηκαν από το λειτουργικό σύστημα. |
| `hotloop_flow_gc_cycles_total` | counter | Ολοκληρωμένοι κύκλοι GC. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Αναπτύξεις που το απομακρυσμένο αποθετήριο του καθρέφτη git δεν έχει ακόμη. Μόνο με καθρέφτη. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Αποστολές στον καθρέφτη που απέτυχαν και θα επαναληφθούν. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Αποστολές στον καθρέφτη που πέτυχαν. |
| `hotloop_flow_durable_wire_depth` | gauge | Μηνύματα που περιμένουν σε ανθεκτικό καλώδιο, στον δίσκο. Ετικέτα `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Ποσόστωση που χρεώνεται στα μηνύματα που περιμένουν σε αυτό το καλώδιο. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Μηνύματα που παρέδωσε το καλώδιο και δέχτηκε ο προορισμός. |
| `hotloop_flow_durable_wire_retries_total` | counter | Φορές που το καλώδιο έστειλε ξανά ένα μήνυμα επειδή ο προορισμός το απέρριψε. Ένας προορισμός εκτός λειτουργίας ανεβάζει αυτόν τον αριθμό. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Μηνύματα για τα οποία το καλώδιο σταμάτησε τις επαναλήψεις επειδή εξαντλήθηκε το `ew_durable_attempts` του κόμβου. Το καθένα πήγε στη ροή ως σφάλμα με συνημμένο το μήνυμα. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Μηνύματα που η πολιτική ποσόστωσης απέρριψε ή εκδίωξε, και ουρές που καθαρίστηκαν όταν ένα καλώδιο έπαψε να είναι ανθεκτικό. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Ποσόστωση που χρησιμοποιείται από όλα τα ανθεκτικά καλώδια μαζί, και η ποσόστωση. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Συναλλαγές που έγραψαν πλαίσιο, και οι γραμμές που άλλαξαν πραγματικά. |
| `hotloop_flow_context_flush_failures_total` | counter | Εγγραφές πλαισίου που απέτυχαν. Οι αλλαγές διατηρούνται και ξαναδοκιμάζονται. Πρέπει να είναι μηδέν. |
| `hotloop_flow_audit_write_failures_total` | counter | Καταχωρίσεις ελέγχου που δεν μπόρεσαν να γραφτούν. Πρέπει να είναι μηδέν για πάντα. |
| `hotloop_flow_traces_kept` | gauge | Ίχνη μηνυμάτων στον buffer αυτή τη στιγμή. |
| `hotloop_flow_trace_bytes` | gauge | Περίπου όσα καταλαμβάνουν. Περιορίζεται από το `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Ίχνη μηνυμάτων που ξεκίνησαν. |
| `hotloop_flow_traces_forgotten_total` | counter | Ίχνη που εκτοπίστηκαν για να γίνει χώρος. |
| `hotloop_flow_traces_skipped_total` | counter | Μηνύματα που δεν ιχνηλατήθηκαν επειδή επιτεύχθηκε το `trace.perSecond`. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Άλματα που δεν καταγράφηκαν: το ίχνος τους ήταν γεμάτο ή ήδη ξεχασμένο. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Spans που δέχτηκε ο συλλέκτης OpenTelemetry. Μόνο με endpoint. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Spans που απορρίφθηκαν επειδή η ουρά εξαγωγής ήταν γεμάτη. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Spans που ο συλλέκτης δεν δέχτηκε μετά από επανάληψη. Πάνω από μηδέν σημαίνει ότι δεν τα παίρνει. |

Αυτή που πρέπει να ειδοποιεί είναι η `hotloop_flow_node_queue_high_water` σε σχέση με την `hotloop_flow_node_queue_capacity`. Το υψηλότερο επίπεδο είναι η έγκαιρη προειδοποίηση ότι μια ροή πλησιάζει το όριό της, που έρχεται πριν απορριφθεί οτιδήποτε και πολύ πριν είναι κάποιος ξύπνιος. Αυτή η ειδοποίηση είναι ο λόγος που χτίσαμε το οριοθετημένο εισερχόμενο. Δεν μπορείτε να αναφέρετε πόσο κοντά βρίσκεστε σε ένα όριο που δεν υπάρχει, οπότε το όριο έπρεπε να υπάρχει πρώτο.
