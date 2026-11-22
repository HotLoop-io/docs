---
title: "Identità e accesso"
description: "Ruoli personalizzati, accesso con LDAP, Active Directory e SAML, e provisioning SCIM, tutto incluso in ogni Cascade senza alcun piano a pagamento."
---

Chi entra, e che cosa può fare una volta dentro. Cascade offre tutto questo a tutti. Niente di quanto segue è a pagamento e dietro non c'è alcun controllo di licenza.

Ogni endpoint qui sotto è nel documento OpenAPI in `/api/v1/openapi.json`, e per ognuno esiste un test che lo chiama.

## Ruoli personalizzati

Nell'editor: Impostazioni, Ruoli. Tutti leggono i ruoli; un proprietario o un amministratore crea, modifica ed elimina i ruoli personalizzati e li assegna alle persone di un progetto dalla stessa schermata.

Un progetto ha quattro ruoli integrati: admin, editor, operator e viewer. Vivono nel codice e non cambiano mai. Quando nessuno ha la misura giusta, si crea un ruolo personalizzato: un nome e un elenco di autorizzazioni del progetto.

Il motivo più comune è un responsabile di linea che può avviare i flussi di lavoro della linea e leggerne le esecuzioni, ma non può modificare nulla:

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Poi si mette una persona in un progetto con quel ruolo, con la stessa chiamata usata per un ruolo integrato:

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

Da sapere:

- `GET /api/v1/permissions` elenca ogni autorizzazione che un ruolo può avere, e `GET /api/v1/roles` elenca i quattro ruoli integrati e quelli personalizzati con ciò che ognuno può fare. Chiunque abbia effettuato l'accesso può leggere entrambi, perché un amministratore di progetto ne ha bisogno per scegliere un ruolo.
- Creare, modificare ed eliminare un ruolo personalizzato spetta a un proprietario o amministratore dell'istanza, con l'autorizzazione `role.manage`. Un amministratore di progetto può assegnare un ruolo alle persone del suo progetto ma non può scriverne uno nuovo, così nessuno si concede più di quanto ha ricevuto.
- Un ruolo contiene solo autorizzazioni di progetto. Non può contenere `user.manage`, `audit.read` né altre autorizzazioni dell'istanza, e chiederne una dà un 400.
- Un nome è fatto da 2 a 40 lettere minuscole, cifre e trattini, e inizia con una lettera. Non si può cambiare dopo, perché membri e account di servizio detengono un ruolo tramite il suo nome. I quattro nomi integrati sono già presi.
- Cambiare le autorizzazioni di un ruolo raggiunge tutti quelli che lo hanno alla richiesta successiva. Nulla è in cache, quindi non c'è alcuna finestra in cui un'autorizzazione revocata funzioni ancora.
- Una chiave di account di servizio può avere un ruolo personalizzato come ruolo di progetto, e gli ambiti di una chiave API la limitano comunque.
- Eliminare un ruolo che qualcuno possiede viene rifiutato con un 409, che indica quanti membri e quante chiavi di account di servizio lo hanno. Prima si spostano.
- Le modifiche ai ruoli sono nel registro di controllo come `role.created`, `role.updated` (con le autorizzazioni prima e dopo) e `role.deleted`.

## LDAP e Active Directory

Le persone accedono con il nome e la password che hanno già in stabilimento: OpenLDAP, 389 Directory Server, FreeIPA o Active Directory. Convive con gli account locali e con OIDC, ed è spento finché non si imposta `HOTLOOP_CASCADE_LDAP_URL`.

Ecco come va un accesso:

1. Un account di servizio (o una ricerca anonima, se la directory lo consente) trova la persona con il filtro utente.
2. Cerca i gruppi di cui fa parte.
3. La directory stessa controlla la password, facendo il bind come la persona. Cascade non salva mai quella password e non ne vede mai un hash. L'account creato qui non ha una password propria, quindi la password della directory non può essere usata su `/login` come se fosse locale.
4. L'account viene creato al primo accesso (a meno che lo si disattivi), e il suo ruolo segue i suoi gruppi a ogni accesso successivo.

La pagina di accesso mostra un secondo modulo quando è attivo, e la stessa cosa è una sola chiamata, `POST /auth/ldap/login` con `{"username": "...", "password": "..."}`. Un nome sbagliato e una password sbagliata ricevono la stessa risposta. Una password vuota non arriva mai alla directory, perché la maggior parte delle directory risponde con successo a un bind con password vuota.

### Impostazioni

Sono tutte variabili d'ambiente. Con il chart Helm vanno in `env`, e la password del bind in `extraEnv` da un secret.

| Variabile | Che cosa fa |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` oppure `ldaps://host:636`. Lo attiva. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (predefinito) oppure `ad`. Sceglie solo i valori predefiniti qui sotto. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` porta una connessione `ldap://` su canale cifrato prima di inviare qualsiasi cosa. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | File PEM delle autorità di cui fidarsi per il certificato della directory. Vuoto significa quelle del sistema. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | Il nome per cui il certificato deve essere emesso, quando non è l'host dell'URL. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | L'account di servizio che cerca le persone. Vuoto è una ricerca anonima. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` oppure `_FILE` | La sua password, o un file che la contiene. Non entrambi. Un DN senza password viene rifiutato, perché sarebbe un bind anonimo. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Obbligatorio. Il DN sotto cui si cercano le persone. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Trova una persona. `{username}` è ciò che ha digitato, con l'escape. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | Il DN sotto cui si cercano i gruppi. Vuoto significa nessuna ricerca dei gruppi. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Trova i gruppi di cui fa parte una persona. `{dn}` è il suo DN, `{username}` ciò che ha digitato. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Gli attributi per l'id stabile, l'email e il nome visualizzato. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Coppie `group=role`, separate da virgole: `supervisors=admin, operators=member`. Un gruppo si indica con il suo `cn` o con il DN completo. Vince il ruolo più potente tra i gruppi di una persona. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` oppure `none`. Con una mappatura dei ruoli il predefinito è `none`, quindi chi non è in nessun gruppo mappato viene respinto. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` crea gli account solo a mano. Predefinito `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Come lo chiama il pulsante di accesso. |

I valori predefiniti per `ldap`: filtro utente `(&(objectClass=inetOrgPerson)(uid={username}))`, filtro gruppo `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, id `entryUUID`, email `mail`, nome `cn`.

I valori predefiniti per `ad`: un utente si trova per `sAMAccountName` o per user principal name, quindi funzionano sia `alice` sia `alice@plant.example`, e un account disabilitato resta fuori dalla ricerca. I gruppi usano la regola di appartenenza annidata (`member:1.2.840.113556.1.4.1941:={dn}`), quindi chi è in un gruppo contenuto in un gruppo mappato riceve anch'esso il ruolo. L'id è `objectGUID`, scritto come GUID, email `mail`, nome `displayName`.

### Da sapere

- **Active Directory richiede la cifratura.** Rifiuta un bind semplice su una connessione in chiaro. Si usa `ldaps://`, oppure `ldap://` con `START_TLS=true`. Cascade controlla il certificato rispetto al file della CA (o alle radici di sistema) e rispetto al nome del server, e nessuna impostazione salta il controllo. Una directory che firma da sé il proprio certificato ha bisogno della sua CA in `CA_FILE`.
- **L'account è legato all'id della directory, non al nome.** Si rinomina una persona nella directory, o la si sposta in un'altra OU, ed è lo stesso account qui. A chi non ha `mail` non si può dare un account (lo dice l'accesso).
- **La directory è l'autorità per l'indirizzo.** Un account già esistente qui con la stessa email viene collegato alla voce della directory al primo accesso di quella persona, senza verifica aggiuntiva, come per un indirizzo OIDC verificato. Non puntatelo a una directory che non gestite voi.
- **Il primo account di un'istanza ne è il proprietario**, comunque venga creato. Si crea prima il proprietario con la configurazione iniziale.
- **Un secondo fattore impostato qui conta ancora.** La password della directory è un fattore. A chi ha sul proprio account un'app di autenticazione o una passkey viene richiesta dopo, e l'obbligo di MFA per tutta l'istanza vale come per tutti gli altri.
- **Anche qui le password sbagliate bloccano l'account.** Cinque di fila su un account già legato alla directory lo bloccano per un minuto, raddoppiando, come per uno locale, prima ancora che intervenga il blocco della directory. Una persona che la directory non conosce, una password sbagliata e un account bloccato sono tutti nel registro di controllo come `auth.login_failed` o `auth.login_refused`, e una persona che la directory ha lasciato passare e che Cascade ha respinto (nessun gruppo, nessuna email, JIT spento) è `auth.sso_refused`.
- **Una directory spenta è un errore del server, non una password sbagliata.** L'accesso dice che la directory non ha risposto, e il dettaglio è nel log.
- Ogni chiamata alla directory è limitata a quindici secondi, e una sola persona può corrispondere al filtro utente: due corrispondenze sono un rifiuto che nomina il problema, mai la prima.

## SAML

Single sign-on con qualsiasi identity provider SAML 2.0. Cascade è il service provider. Convive con gli account locali, OIDC e LDAP, ed è spento finché non si indicano i metadati del provider.

I passaggi:

1. Cascade pubblica i propri metadati in `/auth/saml/metadata`. Si danno al provider, oppure si inseriscono i due valori che contengono: l'entity id e l'assertion consumer service, `<public url>/auth/saml/acs`, binding HTTP-POST.
2. Si imposta `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` con l'indirizzo dei metadati del provider (qualcosa come `https://sso.plant.example/saml/metadata`), oppure `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` con lo stesso documento salvato su disco.
3. La pagina di accesso mostra un pulsante "Accedi con". Porta a `/auth/saml/start`.

Che cosa controlla al ritorno: la firma della risposta rispetto al certificato del provider nei suoi metadati, l'audience, la finestra temporale, che risponda a una richiesta avviata da questo browser e che l'accesso sia stato avviato in questo browser. Una risposta che nessuno ha chiesto (un accesso avviato presso il provider) viene rifiutata. Lo stato di ogni accesso vale una sola volta, quindi una risposta intercettata non può essere riprodotta.

| Variabile | Che cosa fa |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` oppure `_FILE` | I metadati del provider. Uno dei due attiva SAML; non entrambi. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Come questa istanza si presenta al provider. Predefinito: il suo URL dei metadati. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` e `_CERT_FILE` | La coppia di chiavi di questa istanza, PEM, RSA o EC. Entrambe o nessuna. Predefinito: una coppia creata al primo avvio come `saml-sp.key` e `saml-sp.crt` nella directory dei dati, e conservata. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` firma ogni richiesta che Cascade invia. Il provider deve conoscere il certificato. Predefinito `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Con che cosa Cascade chiede al provider di identificare le persone: `persistent` (predefinito), `email` oppure `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Un attributo che identifica la persona al posto del NameID. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Quali attributi contengono l'email, il nome visualizzato e i gruppi. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Come per LDAP: le coppie gruppo-ruolo, il ruolo per chi non è in nessuno, se l'account viene creato al primo accesso e il nome del pulsante. |

Senza le impostazioni degli attributi Cascade cerca i nomi più comuni. L'email è `email`, `mail`, `emailAddress`, l'id di oggetto LDAP `urn:oid:0.9.2342.19200300.100.1.3` o l'URI di claim `.../claims/emailaddress`, e ripiega sul NameID quando è un indirizzo. Il nome è `displayName`, `name`, oppure nome e cognome. I gruppi sono `groups`, `group`, `memberOf`, l'URI `.../claims/Group` e il claim dei gruppi di Microsoft.

Da sapere:

- **Chiedete un id persistente.** Un account è legato al NameID, e uno transitorio è diverso a ogni accesso. Cascade ne chiede uno persistente e rifiuta uno transitorio con un messaggio che lo dice, invece di creare un nuovo account a ogni accesso. Se il provider può inviare solo un id transitorio, indicate in `SUBJECT_ATTR` un attributo stabile.
- **Il provider è l'autorità per l'indirizzo.** Come con LDAP, un account esistente con la stessa email viene collegato al primo accesso SAML.
- **Dietro un proxy, impostate `HOTLOOP_CASCADE_PUBLIC_URL` con l'indirizzo che usano le persone.** Il provider invia il POST all'URL dell'assertion consumer costruito a partire da esso.
- **Usate HTTPS.** Il provider risponde con un POST da un altro sito, quindi il cookie che lega un accesso al suo browser deve essere inviato tra siti diversi, cosa che i browser consentono solo su una connessione sicura.
- **Con più di un pod** serve la stessa coppia di chiavi su tutti: va messa in un secret e indicata con `KEY_FILE` e `CERT_FILE`, altrimenti ogni pod ne crea una propria.
- Un secondo fattore impostato qui conta ancora dopo un accesso SAML, e SAML non fa mai valere l'autenticazione a più fattori del provider.
- Il single logout non è supportato. Uscire termina la sessione qui.

## SCIM

Nell'editor: Impostazioni, Accesso e SCIM mostra se SCIM è attivo, l'URL di base da dare al provider e i token, con un pulsante per crearne uno (mostrato una sola volta) e per revocarne uno. LDAP, SAML e OpenID Connect si impostano nell'ambiente dell'istanza all'avvio, quindi la stessa schermata mostra quali sono attivi e dove punta un provider (gli URL dei metadati e dell'ACS di SAML), e non finge di cambiarli.

SCIM è il modo in cui un identity provider tiene gli account allineati alla sua directory: crea una persona quando arriva, la modifica quando cambia ruolo, la disattiva quando se ne va e mantiene i gruppi. Cascade è il server SCIM (RFC 7643 e 7644, versione 2.0), e il provider è il client. È costruito su ciò che dicono gli RFC e su ciò che inviano i comuni identity provider, ed è provato a ogni rilascio con scim2-tester, un client SCIM di un altro team che esegue ogni controllo che ha. È spento finché non si imposta `HOTLOOP_CASCADE_SCIM=true`.

Come configurarlo:

1. Si attiva con `HOTLOOP_CASCADE_SCIM=true` e si riavvia.
2. Si crea un token per il provider, come proprietario o amministratore dell'istanza: `POST /api/v1/scim-tokens` con `{"name": "plant directory"}`. Il `secret` nella risposta (inizia con `hlcs_`) viene mostrato una sola volta, quindi va inserito subito nel provider. `GET /api/v1/scim-tokens` li elenca con la data dell'ultimo uso di ciascuno, e `DELETE /api/v1/scim-tokens/{token}` ne revoca uno. Per creare un token bisogna aver effettuato l'accesso: una chiave API non può, così una chiave trapelata non può crearne altri.
3. Si dà al provider l'URL di base, `<public url>/scim/v2`, e il token come bearer token.

Ogni chiamata richiede il token, e ogni risposta è `application/scim+json`. Le chiamate sono nel registro di controllo con il nome del token come attore, quindi `user.created`, `user.disabled` e gli altri dicono quale provider li ha eseguiti, insieme agli eventi SCIM `scim.user_deleted`, `scim.group_created`, `scim.group_updated` e `scim.group_deleted`.

### Che cosa offre

`/ServiceProviderConfig`, `/ResourceTypes` e `/Schemas` dicono che cosa è supportato, e dicono solo ciò che è vero: filtri, PATCH, niente bulk, niente ordinamento, niente ETag, niente cambi di password.

| Risorsa | Chiamate |
|---|---|
| `/Users` | `GET` (elenco, con `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | lo stesso |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` con la query nel corpo |

- **Un utente** è `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` e `active`. L'email dell'account è quella primaria, altrimenti quella di lavoro, altrimenti la prima, altrimenti `userName` quando è un indirizzo. Qualsiasi cosa senza indirizzo è un 400. Ciò che invia il provider viene restituito così com'è: un nome che non ha inviato non viene inventato. `groups` torna in sola lettura.
- **Un gruppo** è `displayName`, `externalId` e `members`, ogni membro l'id di un utente. Un membro che non è un utente è un 400.
- **I filtri** hanno la sintassi completa: `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, parentesi e `attr[filter]`. Il confronto ignora maiuscole e minuscole tranne che per `id` e `externalId`. Un filtro errato è un 400 con `scimType: invalidFilter`.
- **PATCH** accetta `add`, `replace` e `remove` con o senza percorso, con percorsi di valore come `emails[type eq "work"].value` e `members[value eq "id"]`, con qualsiasi maiuscola o minuscola, e un booleano come `true` o come la stringa `"False"` che alcuni provider inviano. Cambia esattamente ciò che potrebbe cambiare un PUT.
- **Gli elenchi** seguono l'ordine di creazione degli account, 100 per pagina salvo che `count` dica altro, 200 al massimo.

### Che cosa non farà

- **Non mostra né cambia mai il proprietario.** Il proprietario dell'istanza non è nell'elenco, non si può leggere, modificare o eliminare, e non si può mettere in un gruppo. Un'email che appartiene al proprietario è un conflitto.
- **Non elimina mai un account.** `DELETE` disattiva la persona, il che termina le sue sessioni, la toglie dai suoi gruppi e la nasconde a SCIM. Tutto ciò che ha creato e ogni riga di controllo restano. Se il provider la ricrea con lo stesso indirizzo, torna lo stesso account, attivo. `active: false` disattiva senza nascondere.
- **Un account SCIM non ha una password.** Accede tramite OIDC, SAML o LDAP, che lo collegano per indirizzo.
- **Non tocca i progetti.** SCIM lavora con gli account e con i ruoli dell'istanza. Chi è in quale progetto si decide ancora qui.

### Ruoli dai gruppi

Per impostazione predefinita un nuovo account è un membro e SCIM non cambia mai il ruolo di nessuno. Perché decidano i gruppi, si associano i nomi dei gruppi ai ruoli:

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Il ruolo di una persona segue allora i suoi gruppi a ogni cambio di appartenenza: vince il ruolo mappato più potente, e chi non è in nessuno riceve il predefinito. Si possono mappare solo `admin` e `member`, perché un provider non crea mai un proprietario. Usate una sola fonte di ruoli. Se anche OIDC o SAML associano gruppi a ruoli, vince chi ha cambiato per ultimo il ruolo di una persona, e i due si contenderanno il risultato.

Il provider ha bisogno degli stessi nomi di gruppo, e deve inviare i gruppi con i loro membri, cosa che ogni provider che gestisce i gruppi SCIM sa fare.
