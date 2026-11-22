---
title: "Quando Flow rifiuta di partire"
description: "Gli errori di avvio che Flow dà di proposito, che cosa significa ciascuno e la correzione in una riga."
---

Oltre ai semplici errori di configurazione (un refuso nel YAML, una porta fuori intervallo), rifiuta di partire per cinque motivi, tutti voluti. Ognuno stampa la correzione invece di una traccia dello stack, perché chi la legge sta guardando un CrashLoopBackOff e non ha bisogno dei miei percorsi Go.

| Rifiuto | Correzione |
|---|---|
| L'autenticazione è disattivata | Configurare un utente. Oppure, se la rete è davvero isolata e si è deciso di assumersene la responsabilità, impostare `HOTLOOP_FLOW_INSECURE=true` nell'ambiente. `auth.enabled: false` nel file da solo non basta. (Fino alla 2.0.4 inclusa la variabile non faceva nulla e si otteneva comunque questo rifiuto. Corretto nella 2.0.5.) |
| L'autenticazione è attiva senza utenti | Impostare `auth.users`, oppure `HOTLOOP_FLOW_ADMIN_USER` e `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| Un `passwordHash` che non è bcrypt | Eseguire `hotloop-flow hash-password`. Questo controllo esiste perché una password in chiaro non finisca mai per errore in un ConfigMap. |
| Nessun segreto per le credenziali | Impostare `HOTLOOP_FLOW_CREDENTIAL_SECRET`. Oppure `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true` se questa istanza non custodisce alcun segreto. |
| `discovery` o `exec` attivi con una lista di consentiti vuota | Elencare ciò che è permesso, oppure disattivare la funzione. Una lista di consentiti vuota letta in modo permissivo è esattamente il modo in cui una capacità ristretta diventa una shell. |

Ciò per cui *non* rifiuterà di partire è un singolo nodo difettoso. Un flusso con un solo nodo rotto esegue tutti gli altri nodi e registra l'errore, perché fermare una linea per un refuso in una finestra di dialogo è peggio che eseguire 40 nodi su 41 e dirlo. Lo stesso vale per una lista di consentiti di exec che nomina qualcosa non ancora nel `PATH`: avvisa all'avvio e lo risolve di nuovo quando un flusso lo usa, perché un init container o un volume montato possono legittimamente portarlo dopo l'avvio.

Se il file del flusso non si riesce a leggere, prova i backup dal più recente, tiene il file corrotto accanto come `.corrupt` e registra esattamente quale backup ha usato. Se neppure uno di essi si legge, si ferma lì, invece di partire vuoto e sembrare sano mentre tutti i flussi sono spariti. E un rilascio scrive il file del flusso *prima* di fermare il vecchio runtime, quindi se il salvataggio fallisce, i flussi precedenti continuano a girare invece di fermare la linea per un salvataggio andato male. Quell'ordine non è quello ovvio, non è un caso, e un test fallisce se qualcuno lo inverte.
