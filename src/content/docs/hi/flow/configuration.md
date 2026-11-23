---
title: "कॉन्फ़िगरेशन"
description: "Flow जो हर सेटिंग पढ़ता है, उसका डिफ़ॉल्ट, उसका एनवायरनमेंट ओवरराइड और गलत मान स्टार्टअप पर क्या करता है।"
---

एनवायरनमेंट ओवरराइड के साथ डिक्लेरेटिव YAML। आप इसे बिना चलाए मान्य कर सकते हैं, इसका अंतर देख सकते हैं, इसे ConfigMap से बना सकते हैं और इस पर सोच-विचार कर सकते हैं, जो एक कॉन्फ़िग फ़ाइल से अपेक्षित सब कुछ है, और इससे ज़्यादा नहीं। नीचे का हर फ़ील्ड वैकल्पिक है और अपने डिफ़ॉल्ट के साथ दिखाया गया है।

```yaml
server:
  host: 0.0.0.0
  port: 1880
  adminRoot: /              # where the editor and admin API live
  httpRoot: /               # where a flow's HTTP In nodes live
  readTimeout: 60s          # generous: a big deploy over a slow edge link is legitimate
  writeTimeout: 0s          # zero on purpose, the comms websocket is long-lived
  shutdownTimeout: 20s
  maxRequestBytes: 33554432 # 32 MiB, bounds a flow deploy

data:
  dir: /data                # the PVC. Flows, credentials, the deployment log and state.db live here
  flowFile: flows.json
  credentialsFile: credentials.json
  credentialSecret: ""      # empty means plaintext, which is refused by default
  allowPlaintextCredentials: false
  backupGenerations: 3

history:
  retain: 100               # deployment records kept under data.dir/deployments; 0 keeps all
  git:
    url: ""                 # empty is off; see "A git mirror"
    branch: main
    path: flows.json
    emailDomain: flow.invalid

auth:
  enabled: true             # off refuses to start unless HOTLOOP_FLOW_INSECURE=true
  sessionTTL: 168h          # sessions live in data.dir/sessions.json, hashed, and survive restarts
  lockout:
    attempts: 5             # failures for one account from one address before it locks there
    perAddress: 20          # failures from one address, any account, before the address locks
    window: 15m
    duration: 15m
  users:
    - username: admin
      passwordHash: "$2a$10$..."   # bcrypt only, never plaintext
      permissions: ["*"]
  tokens:                   # API tokens for machines; the hash only, from: hotloop-flow token
    - name: ci
      hash: "sha256:..."
      permissions: ["flows.read", "flows.write"]   # add "status.read" for a token that pushes to stations
      # rateLimit: {calls: 60, per: 1m}   # MCP tool calls per window; unset is no limit

runtime:
  inboxCapacity: 1024
  overflow: block           # block | drop-newest | drop-oldest | error
  blockTimeout: 30s
  closeTimeout: 15s

store:
  path: ""                  # empty is state.db in data.dir: persistent context and durable wires
  synchronous: normal       # normal | full. full fsyncs every commit, and wears the card
  context:
    persist: true           # false is memory only
    flushInterval: 30s      # a changed value waits this long; a kill -9 loses it. 0s writes at once
  durable:
    maxBytes: 268435456     # disk quota for every durable wire together
    ackFlush: 100ms         # how long a delivered message waits to be marked done; 0s marks each one first

discovery:
  enabled: false
  allowedCIDRs: []          # enabled with this empty is a startup error

exec:
  enabled: false
  allowedCommands: []       # enabled with this empty is a startup error

files:
  allowedPaths: []          # extra trees on top of data.dir, which is always allowed

plugins:
  dir: ""                   # empty means plugins/ inside data.dir
  trustedKeys: []           # publisher keys: ed25519:<base64>, a PEM public key, or a file holding one. Empty refuses every plugin
  grants: {}                # plugin name to the host access it may have: clock, random, context.flow, context.global
  maxMemoryMiB: 64          # the most memory any one plugin node can be given
  maxTimeout: 5s            # the longest any one plugin node can be given for a message

secrets:
  allowedPaths: []          # where a tls-config may read a certificate or key, on top of data.dir

logging:
  level: info               # error | warn | info | debug | trace
  format: text              # text for a terminal, json for a cluster

metrics:
  enabled: true
  path: /metrics

audit:
  maxBytes: 16777216        # data.dir/audit.log rotates at 16 MiB
  keep: 4                   # rotated files kept beside it

tests:
  gate: false               # refuse a deploy that fails data.dir/flows.test.yaml
  timeout: 2m               # wall clock for one run of the flow tests

trace:                      # where every message went, kept in memory, bounded
  enabled: true
  traces: 256               # journeys kept, newest
  maxHops: 512              # hops one journey keeps
  maxMessageBytes: 16384    # the biggest message a hop keeps a copy of
  maxBytes: 16777216        # everything together, oldest forgotten first
  perSecond: 1000           # new traces a second; 0 traces every message
  otlp:
    endpoint: ""            # http://collector:4318 sends every hop as a span
    serviceName: hotloop-flow
    interval: 2s            # the longest a finished hop waits to be sent
```

उस फ़ाइल में टाइपिंग की गलती स्टार्टअप की विफलता है, ऐसी सेटिंग नहीं जो चुपचाप कुछ न करे, क्योंकि अज्ञात फ़ील्ड अस्वीकार हो जाते हैं। जो ऑपरेटर `credentialSecret` की स्पेलिंग गलत लिखे, उसे तुरंत पता चलना चाहिए, छह महीने बाद नहीं जब उसे दिखे कि क्रेडेंशियल फ़ाइल सादे टेक्स्ट में है।

## एनवायरनमेंट ओवरराइड

एनवायरनमेंट फ़ाइल पर भारी पड़ता है, जो Kubernetes पर अकेला चलने लायक बँटवारा है: Helm चार्ट सामान्य सेटिंग ConfigMap में रखता है और सीक्रेट Secret से डालता है।

| वेरिएबल | क्या सेट करता है |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | YAML फ़ाइल का पथ। |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | लिसनर। |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | पथ के प्रीफ़िक्स। |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | स्टेट कहाँ रहता है। |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | क्रेडेंशियल एन्क्रिप्शन का सीक्रेट। |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | पूरी अनुमतियों वाला एक अकेला एडमिन खाता, जिससे पहली बार चलने वाला कंटेनर बिना फ़ाइल माउंट किए इस्तेमाल हो जाता है। दोनों सेट होने चाहिए। |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | CI/CD के लिए `deploy` नाम का डिप्लॉय टोकन: `flows.read` और `flows.write`, और कुछ नहीं। हैश, कभी टोकन नहीं। जो टोकन स्टेशनों पर भी पुश करता है ([किसी टेनेंट के स्टेशनों पर पुश करना](/hi/flow/stations/)) उसे `status.read` भी चाहिए, इसलिए उसे कॉन्फ़िग फ़ाइल में बनाएँ। |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | EmberCORE डैशबोर्ड से साइन-इन। कुंजी डैशबोर्ड की सार्वजनिक ES256 कुंजी (एक PEM फ़ाइल) है, ऑडियंस `<tenant>/<release>` है। कुंजी फ़ाइल न हो तो यह बंद रहता है, और डिफ़ॉल्ट बंद है। |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | जारीकर्ता (`embernet-dashboard`), हेडर (`X-Embernet-Assertion`), और क्या एडिटर अपना साइन-इन फ़ॉर्म छोड़ देता है (`true`)। |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | git मिरर। पासवर्ड (एक एक्सेस टोकन) केवल एनवायरनमेंट से सेट होता है। |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | शेड्यूलर के डिफ़ॉल्ट। |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | स्टेट डेटाबेस: वह कहाँ है, और क्या हर कमिट fsync होता है। |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | स्थायी कॉन्टेक्स्ट। `false` इसे बंद करता है; अंतराल `30s` जैसी अवधि है। |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | कलेक्टर के हेडर, अल्पविराम से अलग किए गए `Name=value` जोड़े, फ़ाइल में दिए गए हेडर में जुड़ते हैं। ऐसी API कुंजी के लिए जिसका ConfigMap में रहना ठीक नहीं। |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | टिकाऊ वायर का डिस्क कोटा, और डिलीवर हुआ संदेश पूरा चिह्नित होने के लिए कितनी देर इंतज़ार करता है। |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` [डिप्लॉय गेट](/hi/flow/tests/#डिप्लॉय-गेट) चालू करता है। |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | लॉगिंग। |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | डिस्कवरी नोड। अल्पविराम से अलग CIDR। |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | exec नोड। अल्पविराम से अलग कमांड। |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | प्लगइन कहाँ हैं, और भरोसेमंद पब्लिशर कुंजियाँ। अल्पविराम से अलग कुंजियाँ। |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | प्लगइन क्या इस्तेमाल कर सकते हैं: `name=cap,cap;name=cap`। |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | प्लगइन नोड की मेमोरी और प्रति संदेश समय की ऊपरी सीमाएँ। |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | file नोड के अतिरिक्त रूट। अल्पविराम से अलग। |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | अतिरिक्त रूट जहाँ से सीक्रेट फ़ाइल पढ़ी जा सकती है। अल्पविराम से अलग। |
| `HOTLOOP_FLOW_INSECURE` | `true` प्रमाणीकरण बंद करके चलता है, और कोई दूसरा मान ऐसा नहीं करता। केवल `1`, `true`, `yes` और `on` गिने जाते हैं, इसलिए `false` या `0` इसे गलती से बंद नहीं कर सकते। ऐसे अलग-थलग नेटवर्क के लिए जिसकी ज़िम्मेदारी लेने का आपने तय किया है। यह क्रेडेंशियल सीक्रेट से छूट नहीं देता। |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | आराम की स्थिति में बिना एन्क्रिप्ट किए क्रेडेंशियल की अनुमति देता है। |

चालू/बंद वाले वेरिएबल केवल `1`, `true`, `yes` और `on` स्वीकार करते हैं, किसी भी केस में। बाकी सब बंद है, इसलिए `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` का मतलब नहीं है, "यह सेट है, तो हाँ" नहीं। जो सुरक्षा स्विच इसलिए चालू हो जाए कि किसी ने `=false` टाइप किया, वही चीज़ घटना रिपोर्ट में पहुँचती है।

जो उस तालिका में नहीं है वह केवल फ़ाइल में है, और यह जान-बूझकर है: सेशन TTL, बैकअप की पीढ़ियाँ, अनुरोध के आकार की सीमाएँ और सर्वर टाइमआउट ऐसे फ़ैसले हैं जिन्हें किसी को ConfigMap में परखना चाहिए, रात 3 बजे जब लाइन बंद हो तब शेल में टाइप नहीं करना चाहिए।
