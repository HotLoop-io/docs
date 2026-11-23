---
title: "HTTP API"
description: "HotLoop जिन कॉल का HTTP पर उत्तर देता है, उनके लिए क्या चाहिए, क्या लेता है और क्या लौटाता है। वेब UI इसके अलावा कुछ और इस्तेमाल नहीं करता।"
---

Gateway HTTP पर जो भी कॉल लेता है, हर कॉल को क्या चाहिए, वह क्या लेती है और क्या लौटाती है। वेब UI इसके अलावा कुछ और इस्तेमाल नहीं करता: स्क्रीन के पीछे कोई निजी API नहीं है, इसलिए UI जो कुछ कर सकता है, स्क्रिप्ट वही सब उन्हीं कॉल और उन्हीं अनुमतियों से कर सकती है।

यह पेज कोड के विरुद्ध जाँचा जाता है। इसलिए रूट की सूची और उन्हें कौन कॉल कर सकता है, यह किसी पुराने API का वर्णन नहीं है। नीचे के अनुरोध और प्रतिक्रिया के रूप चल रहे Gateway से लिए गए हैं; टेस्ट इन्हें नहीं जाँचते, इसलिए अगर आप कोई हैंडलर बदलें तो यहाँ उसका सेक्शन भी बदलें।

हर फ़ीचर की गहरी पृष्ठभूमि उसके अपने पेज पर है: [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/), [एंटिटी](/hi/iot/entities/), [उपकरण ट्री और लेबल](/hi/iot/equipment/), [ऑटोमेशन](/hi/iot/automations/), [निर्धारित रिपोर्ट](/hi/gateway/reports/), [फ़्लीट प्रबंधन](/hi/gateway/fleet/), [अलार्म सूचनाएँ](/hi/iot/notifications/), [बैकअप और रीस्टोर](/hi/iot/backup/) और [MCP](/hi/iot/mcp/)। यह पेज सूची है; वे पेज कारण बताते हैं।

## परिपाटियाँ

### यह कहाँ है

सब कुछ ऐप के एक ही HTTP पोर्ट पर है (`HOTLOOP_LISTEN_ADDR`, डिफ़ॉल्ट `:8080`)। जिस प्रॉक्सी के पीछे ऐप किसी पाथ के नीचे परोसा जाता है, वहाँ `HOTLOOP_BASE_PATH` सेट करें और Gateway उसे हटा देता है, इसलिए `/hotloop/api/devices` और `/api/devices` एक ही कॉल हैं। नीचे के पाथ उसके बिना लिखे गए हैं।

### लॉग इन: कुकी या बियरर टोकन

हर `/api/` रूट को सेशन चाहिए, सिवाय लॉग इन (पासवर्ड से, या कियोस्क पैनल पर PIN या बैज से), इनबाउंड वेबहुक और अलार्म स्वीकार करने के लिंक के, जिनमें से हर एक अनुरोध में अपना प्रमाण लेकर आता है। `POST /api/auth/login` एक टोकन लौटाता है और उसे `iiot_session` कुकी के रूप में भी सेट करता है (HttpOnly, SameSite=Lax, और जब अनुरोध TLS से या `X-Forwarded-Proto: https` के साथ आया हो तब Secure)। ब्राउज़र कुकी इस्तेमाल करता है और टोकन कभी नहीं देखता। स्क्रिप्ट इसके बजाय टोकन भेजती है:

```
Authorization: Bearer 3f9c...e1
```

दोनों एक ही सेशन हैं और एक ही तरह जाँचे जाते हैं। सेशन `HOTLOOP_AUTH_SESSION_TTL` तक चलता है (डिफ़ॉल्ट 12 घंटे)। सेशन के बिना हर `/api/` रूट यह जवाब देता है:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

या रद्द हो चुके या समाप्त टोकन के लिए `"the session is invalid or has expired"`, या बंद किए गए खाते के लिए `"this account no longer has access"`।

`HOTLOOP_AUTH_INSECURE=true` होने पर लॉग इन बिल्कुल नहीं होता: कुछ भी जाँचा नहीं जाता, नीचे की हर अनुमति सबको दी जाती है, और लिखने पर दर्ज होने वाला नाम प्रॉक्सी के `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` या `X-Forwarded-Email` हेडर से आता है, और कोई सेट न हो तो `operator` होता है। यह केवल ऐसी NetworkPolicy के पीछे ठीक है जो पॉड तक डैशबोर्ड प्रॉक्सी के अलावा किसी को पहुँचने नहीं देती। देखें [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/#बिना-लॉगिन-चलाना)।

MCP अलग है: उसका अपना बियरर टोकन है (`HOTLOOP_MCP_TOKEN`) और वह सेशन को कभी नहीं देखता। देखें [MCP](#mcp)।

### अनुमतियाँ

लॉग इन उपयोगकर्ता के पास अनुमतियों की एक सूची होती है, जो उसकी भूमिका से आती है या खाते पर सीधे सेट की जाती है। जो रूट ऐसी अनुमति माँगता है जो उपयोगकर्ता के पास नहीं है, वह यह जवाब देता है:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

[अनुमतियों की तालिका](#अनुमतियाँ) बताती है कि कौन-सी भूमिका के पास क्या है।

### त्रुटियाँ

API खुद जो भी विफलता पैदा करती है, वह एक ही रूप का JSON होती है:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` में एक `detail` जुड़ता है, और विफल सर्विस कॉल में वे राइट जुड़ते हैं जो वह कर चुकी थी। संदेश पढ़ने वाले व्यक्ति के लिए लिखा गया है: वह बताता है कि क्या गलत था और, जहाँ कोई उपाय है, तो उसके बजाय क्या करना है। उसे जैसा है वैसा दिखाएँ।

| स्टेटस | कब |
|---|---|
| 400 | अनुरोध गलत है: ग़लत बनावट की बॉडी, वैलिडेशन में विफल फ़ील्ड, अज्ञात फ़ील्ड, गायब पैरामीटर, अज्ञात सर्विस |
| 401 | सेशन नहीं है, समाप्त हो चुका है, या लॉग इन पर गलत पासवर्ड है |
| 403 | उपयोगकर्ता के पास अनुमति नहीं है, या राइट गेट ने नीति के आधार पर राइट ठुकरा दिया: राइट बंद हैं, टैग सक्रिय नहीं है, एंटिटी बंद है |
| 404 | पाथ या बॉडी में जिसका नाम है वह मौजूद नहीं है |
| 409 | वह पहले से मौजूद है, या इसके लिए गलत स्थिति में है: ऐसा अलार्म जो टाला नहीं गया, ऐसा नोड जिसके अभी चाइल्ड हैं, ऐसी एंटिटी जिसकी टॉगल करने लायक स्थिति ज्ञात नहीं, ऐसी स्क्रिप्ट जो पहले से चल रही है, ऐसी रेसिपी जो ठुकराई गई या पहले से लागू हो रही है |
| 422 | ऐसा मान जिसे राइट गेट ने उसके अपने गुण के आधार पर ठुकराया: टैग की सीमा से बाहर, एंटिटी के स्टेप से बाहर |
| 502 | डिवाइस ने अपनी ही त्रुटि के साथ जवाब दिया और बॉडी उसके शब्द हैं; या कोई रेसिपी शुरू हुई और सभी लक्ष्यों तक नहीं पहुँची, और बॉडी बताती है कि कौन-से गए और कौन-से नहीं |
| 503 | डिवाइस जुड़ा नहीं है, या अलार्म इंजन नहीं चल रहा |
| 500 | सर्वर के अंदर की खराबी। बॉडी `internal error (ref …); the server log has the detail under that ref` है और कुछ नहीं, और पूरा त्रुटि-विवरण उसी संदर्भ के तहत लॉग में है। असली संदेश वाला एकमात्र 500 वह बटन दबाना है जिसका छोड़ना बाहर नहीं गया, क्योंकि वह संदेश ठीक-ठीक बताता है कि क्या जाँचना है |

जिसे API कहीं बिठा नहीं सकती, वह 500 है, कभी 400 नहीं। डेटाबेस बंद होने पर 400 का जवाब ऑपरेटर को बताता है कि उसने कुछ गलत लिखा, और वह ऐसी टाइपिंग की गलती ढूँढने लगता है जो है ही नहीं।

दो विफलताएँ API से नहीं आतीं और सादा टेक्स्ट हैं, JSON नहीं: जो पाथ किसी रूट से मेल नहीं खाता वह `404 page not found` देता है, और पहचाना हुआ पाथ गलत मेथड से कॉल करने पर `405 method not allowed` देता है।

ठुकराया गया राइट कभी 500 नहीं होता। जो प्लांट स्क्रीन नीति के इनकार को सर्वर की खराबी की तरह दिखाती है, वह ऑपरेटरों को त्रुटियाँ अनदेखी करना सिखाती है।

### बॉडी

अनुरोध की बॉडी JSON होती है, अधिकतम 4 MiB (इनबाउंड वेबहुक के लिए 1 MiB)। **अज्ञात फ़ील्ड अनदेखे नहीं किए जाते, ठुकरा दिए जाते हैं:**

```json
{"error":"request body: json: unknown field \"x\""}
```

गलत लिखी हुई सेटिंग अगर चुपचाप छूट जाए तो वह ठीक वैसी ही दिखती है जैसी सेटिंग काम कर गई हो, इसलिए डिकोडर मना कर देता है।

डिवाइस, टैग, अलार्म, ऑटोमेशन, फ़्लीट सदस्यों और रिपोर्ट पर `POST` और `PUT` पूरे ऑब्जेक्ट को बदल देते हैं: छोड़ा गया फ़ील्ड अपनी शून्य मान लेता है, और छोड़ा गया बूलियन `false` होता है। पढ़ें, बदलें, वापस भेजें। अपवाद हैं एंटिटी और उपकरण के `PUT`, जो केवल वही फ़ील्ड बदलते हैं जो आप भेजते हैं, और डिवाइस के क्रेडेंशियल, जो छोड़ने पर बने रहते हैं (नीचे देखें)।

### सीक्रेट केवल लिखने के लिए हैं

डिवाइस में सहेजा गया क्रेडेंशियल (ब्रोकर का पासवर्ड, कोई HTTP हेडर, पते में दिया पासवर्ड) किसी भी भूमिका को, एडमिन समेत, कभी वापस नहीं भेजा जाता। वह `[redacted]` के रूप में दिखता है:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

डिवाइस सहेजते समय सहेजा हुआ मान रखने के लिए प्लेसहोल्डर भेजें (या कुंजी छोड़ दें), बदलने के लिए नया मान भेजें, और मिटाने के लिए `""` या `null` भेजें। नया डिवाइस प्लेसहोल्डर के साथ सहेजा नहीं जा सकता, और जो सहेजना किसी रखे हुए क्रेडेंशियल के साथ डिवाइस को दूसरे होस्ट पर ले जाए, वह ठुकरा दिया जाता है, ताकि सहेजा हुआ पासवर्ड किसी और के लिसनर तक न पहुँच सके। पूरे नियम [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/#डिवाइस-क्रेडेंशियल-सिर्फ़-लिखने-के-लिए-हैं) में हैं। Gateway के पास मौजूद हर दूसरे क्रेडेंशियल पर भी यही लागू होता है: सेटिंग में `set` या `not set` दिखता है, डायग्नॉस्टिक्स आउटबाउंड MCP लक्ष्यों से क्रेडेंशियल हटा देते हैं, और इस API में कुछ भी पासवर्ड हैश या सेशन टोकन नहीं लौटाता, सिवाय उस एक के जो लॉग इन आपको देता है।

### camelCase, सिवाय जहाँ snake_case है

API का अधिकांश हिस्सा camelCase है (`deviceId`, `pollIntervalMs`, `createdAt`), जैसा पहले संस्करण से रहा है और जैसा EmberNet डैशबोर्ड का `TagValue` अनुबंध माँगता है।

एंटिटी, स्टेट, सर्विस, उपकरण और लेबल के एंडपॉइंट snake_case हैं (`entity_id`, `last_changed`, `parent_id`, `label_id`)। यह जान-बूझकर है: एंटिटी API एंटिटी, स्टेट और सर्विस का सामान्य रूप इस्तेमाल करती है, ताकि जो कुछ पहले से उसे बोलता है वह इसे भी बोल सके, और उपकरण ट्री एंटिटी मॉडल का एरिया रजिस्ट्री है, उन्हीं उपभोक्ताओं के लिए ढला हुआ। जहाँ दोनों मिलते हैं, वहाँ हर पक्ष अपनी शैली रखता है: डिवाइस में `equipmentId` है, एंटिटी में `equipment_id`।

### समय, अवधियाँ और टैग कुंजियाँ

- **टाइमस्टैम्प** UTC में RFC 3339 होते हैं, जहाँ हों वहाँ भिन्नात्मक सेकंड के साथ: `2026-09-27T20:21:58.255869Z`। प्रदर्शन टाइमज़ोन सेटिंग बदलती है कि UI क्या दिखाता है, API क्या लौटाती है यह कभी नहीं।
- **जो समय अभी आया नहीं, उसे छोड़ दिया जाता है।** जो नियम कभी चला नहीं उसमें `lastRun` नहीं होता, जिस डिवाइस को कभी पोल नहीं किया गया उसमें `lastPoll` या `lastGood` नहीं होता, जिस अलार्म को किसी ने स्वीकार नहीं किया उसमें `ackedAt` नहीं होता, जो फ़्लीट सदस्य कभी दिखा नहीं उसमें `lastSeen` नहीं होता। समय का फ़ील्ड न होने का मतलब है कभी नहीं। आपको प्रतिक्रिया या स्ट्रीम इवेंट में Go का शून्य समय `0001-01-01T00:00:00Z` कभी नहीं दिखेगा। एक दर्जन फ़ील्ड उसे भेजते थे, और ऑटोमेशन स्क्रीन कभी न चले नियम को 739887 दिन पहले आख़िरी बार चला हुआ दिखाती थी। एक टेस्ट कोड के हर रूट और हर समय-फ़ील्ड को पढ़ता है ताकि यह ऐसा ही रहे।
- **स्पार्कलाइन** अपवाद हैं: वहाँ `timestamps` Unix मिलीसेकंड में है, क्योंकि वह सीधे चार्ट में जाता है।
- **अवधियाँ** अपने नाम में इकाई बताती हैं: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`। स्टेटस में `uptime` एक Go अवधि स्ट्रिंग है (`11m13s`)।
- **टैग कुंजी** `device/tag` होती है, वह रूप जो हर `?tag=` पैरामीटर और हर `tag` फ़ील्ड लेता है। टैग नामों में स्लैश हो सकते हैं (OPC UA पाथ, MQTT टॉपिक), इसलिए केवल पहला स्लैश अलग करता है: `plc-1/Line/Zone 1` डिवाइस `plc-1` का टैग `Line/Zone 1` है।
- **संख्या वाला क्वेरी पैरामीटर** अगर संख्या नहीं है तो अनदेखा किया जाता है और डिफ़ॉल्ट इस्तेमाल होता है, इसलिए `?limit=abc` वैसा ही है जैसे `?limit` सेट ही न किया हो।
- **खाली सूचियाँ** हर प्रतिक्रिया और हर स्ट्रीम इवेंट में, किसी भी गहराई पर, `[]` होती हैं, कभी `null` नहीं। `.length` से पहले null जाँच की ज़रूरत नहीं। जो `null` आपको दिखे वह कभी सूची नहीं होता: वह दर्ज किए गए null-योग्य फ़ील्ड में से एक है, जैसे एंटिटी का `equipment_id` या रूट नोड का `parent_id`। वैकल्पिक चिह्नित सूची-फ़ील्ड फिर भी पूरी तरह छोड़ा जा सकता है।

### वैकल्पिक सुविधाएँ

फ़्लीट, सूचनाएँ, बैकअप और निर्धारित रिपोर्ट तब तक बंद रहते हैं जब तक उनका `HOTLOOP_*_ENABLED` वैरिएबल सेट न हो। सुविधा बंद होने पर भी उसका सूची रूट 200 देता है, `"configured": false` और खाली सूची के साथ, ताकि स्क्रीन "यहाँ कुछ नहीं" की जगह "चालू नहीं है" कह सके। उस सुविधा का हर दूसरा रूट 400 देता है, जिसकी त्रुटि वैरिएबल का नाम बताती है:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

जब कोई आउटबाउंड MCP सर्वर कॉन्फ़िगर न हो तो `GET /api/sites` भी यही करता है।

### इस उत्पाद में नहीं

HotLoop एक ही कोडबेस से IoT, Edge, Gateway और Edge Relay के रूप में आता है, और जो सुविधा किसी उत्पाद में नहीं है वह बंद नहीं की गई है, बल्कि बाइनरी में है ही नहीं। IoT, Edge और Gateway पर उसके रूट फिर भी उसी अनुमति-जाँच के बाद जवाब देते हैं, एक 404 के साथ जो यह कहता है और दोनों सिरों के नाम बताता है, ताकि स्क्रिप्ट "गलत बॉक्स" और "गलत URL" में फ़र्क कर सके:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

400 नहीं, क्योंकि कोई वैरिएबल नहीं जो इसे ठीक करे, और 5xx नहीं, क्योंकि कुछ बिगड़ा नहीं। `GET /api/status` शुरू में ही बता देता है कि कौन-सा उत्पाद जवाब दे रहा है और उसमें कौन-सी सुविधाएँ हैं, ताकि क्लाइंट टटोलने के बजाय पूछ सके।

### जो कुछ भी कुछ बदलता है वह दर्ज होता है

हर बनाना, बदलना, हटाना, लिखना, स्वीकार करना और लॉग इन करना उपयोगकर्ता के नाम के साथ सिस्टम लॉग (`GET /api/events`) में आता है, और टैग पर हर राइट, ठुकराया गया हो या नहीं, राइट ऑडिट (`GET /api/writes`) में आता है। API में कोई चुपचाप रास्ता नहीं है।

## अनुमतियाँ

किसके पास क्या है। जिस खाते की अनुमतियों की सूची स्पष्ट रूप से दी गई है, उसके पास अपनी भूमिका के सेट के बजाय ठीक वही है जो वह सूची बताती है। `*` सब कुछ देता है और `resource.*` किसी संसाधन के नीचे सब कुछ देता है (`reports.*`)। admin भूमिका `*` है।

| अनुमति | viewer | operator | admin |
|---|---|---|---|
| `status.read` | हाँ | हाँ | हाँ |
| `devices.read` | हाँ | हाँ | हाँ |
| `devices.write` | नहीं | नहीं | हाँ |
| `tags.read` | हाँ | हाँ | हाँ |
| `tags.write` | नहीं | नहीं | हाँ |
| `values.read` | हाँ | हाँ | हाँ |
| `values.write` | नहीं | हाँ | हाँ |
| `board.write` | नहीं | हाँ | हाँ |
| `entities.read` | हाँ | हाँ | हाँ |
| `entities.write` | नहीं | नहीं | हाँ |
| `helpers.write` | नहीं | हाँ | हाँ |
| `equipment.read` | हाँ | हाँ | हाँ |
| `equipment.write` | नहीं | नहीं | हाँ |
| `alarms.read` | हाँ | हाँ | हाँ |
| `alarms.write` | नहीं | नहीं | हाँ |
| `alarms.ack` | नहीं | हाँ | हाँ |
| `automations.read` | हाँ | हाँ | हाँ |
| `automations.write` | नहीं | नहीं | हाँ |
| `automations.trigger` | नहीं | हाँ | हाँ |
| `scripts.read` | हाँ | हाँ | हाँ |
| `scripts.run` | नहीं | हाँ | हाँ |
| `scripts.write` | नहीं | नहीं | हाँ |
| `recipes.read` | हाँ | हाँ | हाँ |
| `recipes.apply` | नहीं | हाँ | हाँ |
| `recipes.write` | नहीं | नहीं | हाँ |
| `blueprints.read` | हाँ | हाँ | हाँ |
| `blueprints.apply` | नहीं | हाँ | हाँ |
| `blueprints.write` | नहीं | नहीं | हाँ |
| `dashboards.read` | हाँ | हाँ | हाँ |
| `dashboards.write` | नहीं | नहीं | हाँ |
| `energy.read` | हाँ | हाँ | हाँ |
| `energy.write` | नहीं | नहीं | हाँ |
| `fleet.read` | हाँ | हाँ | हाँ |
| `fleet.write` | नहीं | हाँ | हाँ |
| `fleet.rebirth` | नहीं | हाँ | हाँ |
| `fleet.restart` | नहीं | नहीं | हाँ |
| `fleet.update` | नहीं | नहीं | हाँ |
| `fleet.config` | नहीं | नहीं | हाँ |
| `notify.test` | नहीं | नहीं | हाँ |
| `notify.escalation` | नहीं | नहीं | हाँ |
| `backup.read` | नहीं | नहीं | हाँ |
| `backup.run` | नहीं | नहीं | हाँ |
| `reports.read` | हाँ | हाँ | हाँ |
| `reports.run` | नहीं | हाँ | हाँ |
| `reports.write` | नहीं | नहीं | हाँ |
| `sites.read` | हाँ | हाँ | हाँ |
| `settings.read` | हाँ | हाँ | हाँ |
| `settings.write` | नहीं | नहीं | हाँ |
| `events.read` | हाँ | हाँ | हाँ |
| `logbook.read` | हाँ | हाँ | हाँ |
| `users.manage` | नहीं | नहीं | हाँ |

रेखा हर जगह वही है: ऑपरेटर प्लांट चलाता है (मान लिखता है, अलार्म स्वीकार करता है, ऑटोमेशन चलाता है, रिले को हल्का-सा धक्का देता है), और केवल एडमिन बदलता है कि प्लांट किस रूप में कॉन्फ़िगर है, या Gateway की ओर से बाहरी दुनिया के साथ कुछ करता है (रिले को रीस्टार्ट करना, उसका कॉन्फ़िग भेजना, टेस्ट पेज भेजना, ऐसी रिपोर्ट तय करना जो प्लांट का डेटा कहीं ईमेल करती है)।

## एंडपॉइंट सूची

अनुमति वाला कॉलम बताता है कि रूट क्या जाँचता है। `session` का मतलब है लॉग इन किया हुआ कोई भी उपयोगकर्ता, इससे आगे किसी अनुमति के बिना। `none` का मतलब है कि सेशन भी नहीं चाहिए, और सेक्शन बताता है क्यों। `(in handler)` का मतलब है कि जाँच हैंडलर के सामने नहीं, उसके अंदर होती है, और सेक्शन बताता है क्यों।

उत्पाद वाला कॉलम बताता है कि रूट किस सबसे छोटे HotLoop में है: `all` यानी IoT, Edge और Gateway, `edge` यानी Edge और Gateway, `gateway` यानी केवल Gateway। हर उत्पाद हर रूट दर्ज करता है और उस पर वही अनुमति जाँचता है। जिस उत्पाद में वह रूट नहीं है, वहाँ रूट 404 देता है और बताता है कि वह कहाँ है; देखें [इस उत्पाद में नहीं](#इस-उत्पाद-में-नहीं)।

| मेथड | पाथ | अनुमति | उत्पाद |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| कोई भी | `/mcp` | MCP टोकन | all |
| कोई भी | `/mcp/` | MCP टोकन | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| कोई भी | `/` | none | all |

## स्वास्थ्य

kubelet और लोड बैलेंसर के लिए। किसी को सेशन नहीं चाहिए: प्रोब का कोई खाता नहीं होता, और कोई भी प्लांट के बारे में कुछ नहीं बताता।

### `GET /healthz`

Liveness। जब तक प्रोसेस HTTP परोस रही है, `ok` टेक्स्ट के साथ `200`। यह जान-बूझकर डेटाबेस को नहीं छूता: डेटाबेस बंद होने पर पॉड को रोटेशन से बाहर होना चाहिए, लूप में रीस्टार्ट नहीं।

### `GET /readyz`

Readiness। 5 सेकंड के समय-बजट के साथ डेटाबेस को पिंग करता है।

```json
{"status":"ready"}
```

जब वह उस तक नहीं पहुँच पाता तो `503`, कारण `detail` में (रूप हैंडलर से आता है; कारण का टेक्स्ट वही है जो डेटाबेस ड्राइवर ने कहा):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

जो ऐप अपने हिस्टोरियन तक नहीं पहुँच सकता, उसे ट्रैफ़िक नहीं मिलना चाहिए।

## ऑथेंटिकेशन

खातों, भूमिकाओं और पहले एडमिन के लिए [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/) देखें।

### `POST /api/auth/login`

सेशन की ज़रूरत नहीं, बनावट से ही।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `username` | string | ज़रूरी। अक्षरों का केस और आसपास के स्पेस अनदेखे किए जाते हैं |
| `password` | string | ज़रूरी |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

उसी टोकन को `iiot_session` कुकी में भी सेट करता है। गलत नाम, गलत पासवर्ड या बंद खाते, तीनों के लिए एक जैसा `401` `"invalid username or password"` आता है, और हर मामले में उतना ही समय लगता है: तीन में से कौन-सा था, यह किसी अजनबी को बताने की बात नहीं है। जिस खाते में लगातार बहुत ज़्यादा गलत पासवर्ड या PIN हुए हों, उसके लिए जो भी भेजा जाए, `Retry-After` हेडर के साथ `429` आता है; देखें [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/#गलत-पासवर्ड-और-pin-के-बाद-लॉकआउट)।

### `POST /api/auth/kiosk`

साझा पैनल पर PIN या बैज से साइन इन, जैसा [ऑथेंटिकेशन और उपयोगकर्ता](/hi/iot/authentication/#किओस्क-पैनल-pin-या-बैज-और-निष्क्रियता-पर-साइन-आउट) बताता है। सेशन की ज़रूरत नहीं, बनावट से ही।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `code` | string | ज़रूरी। PIN, या कीबोर्ड-वेज बैज रीडर ने जो मान टाइप किया। आसपास के स्पेस अनदेखे किए जाते हैं |
| `username` | string | वैकल्पिक। इसके साथ सिर्फ़ उसी खाते का PIN जाँचा जाता है और गलत PIN उस खाते के लॉकआउट में गिना जाता है। इसके बिना कोड हर खाते के कोड में खोजा जाता है |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

`iiot_session` कुकी सेट करता है और `POST /api/auth/login` के उलट टोकन के साथ जवाब नहीं देता: कियोस्क सेशन पैनल के ब्राउज़र का होता है। `idleSec` वह अवधि है जिसमें कोई छुए बिना सेशन टिका रहता है। गलत कोड, बहुत छोटे कोड और बंद खाते के कोड, तीनों के लिए एक जैसा `401` `"that PIN or badge isn't recognized"` आता है, और हर मामले में उतना ही समय लगता है। खाता लॉक हो तो `429` ([लॉकआउट](/hi/iot/authentication/#गलत-पासवर्ड-और-pin-के-बाद-लॉकआउट) देखें), `Retry-After` हेडर के साथ। `username` के बिना भेजा गया कोड जो किसी से मेल न खाए, किसी खाते के विरुद्ध नहीं गिना जाता; उसे भेजने वाला पैनल, क्लाइंट पते के हिसाब से, अपनी अगली ऐसी कोशिश जाँचे जाने से पहले आधा सेकंड और रुकता है, `ui.panelDelaySeconds` तक, और सही कोड उसे फिर से शुरू कर देता है। पैनल कभी लॉक नहीं होता। जब डिप्लॉयमेंट बिना लॉग इन के चल रहा हो (`HOTLOOP_AUTH_INSECURE`) तो `400`, क्योंकि तब साइन इन करने के लिए कोई है ही नहीं।

### `POST /api/auth/activity`

किसी ने पैनल को छुआ। कोई बॉडी नहीं। `{"status":"ok"}`। कियोस्क सेशन में यही उसकी निष्क्रियता की सीमा को आगे खिसकाता है; हर वह दूसरा अनुरोध भी जो पढ़ना नहीं है (लिखना, स्वीकार करना)। `GET`, लाइव फ़ीड और पेज के अपने बैकग्राउंड लोड ऐसा नहीं करते: वरना वे आख़िरी व्यक्ति को हमेशा साइन इन रखते। पासवर्ड से बना सेशन निष्क्रियता की सीमा नहीं रखता और खिसकाने को कुछ नहीं होता।

### `POST /api/auth/logout`

जिस सेशन के साथ अनुरोध आया उसे (कुकी या बियरर) खत्म करता है और कुकी साफ़ करता है। कोई बॉडी नहीं। `{"status":"logged out"}`।

### `GET /api/auth/session`

मैं कौन हूँ। UI के बूट क्रम के लिए।

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

कियोस्क पैनल पर बना सेशन `"idleSec"` जोड़ता है, यानी सेकंड में उसकी निष्क्रियता की सीमा, जिससे पेज जानता है कि उसे खुद साइन आउट करना है।

ऑथेंटिकेशन बंद होने पर (`HOTLOOP_AUTH_INSECURE`) वह 401 की जगह `{"authenticated":false,"insecure":true}` देता है, ताकि UI अंदाज़ा लगाने के बजाय बता सके कि लॉग इन क्यों नहीं है।

### `POST /api/auth/password`

अपना ही पासवर्ड बदलें। कोई अनुमति नहीं: अपना मौजूदा पासवर्ड जानना ही क्रेडेंशियल है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `currentPassword` | string | ज़रूरी |
| `newPassword` | string | ज़रूरी, कम से कम 8 अक्षर |

`{"status":"password changed; log in again"}`। **खाते के हर सेशन खत्म हो जाते हैं, इस वाले समेत**, और कुकी साफ़ हो जाती है: जो पासवर्ड बदलाव पुराने सेशन चलते रहने देता है वह सिर्फ़ नाम का बदलाव है। मौजूदा पासवर्ड गलत हो तो `401`, नया बहुत छोटा हो तो `400`।

## उपयोगकर्ता

सब कुछ केवल एडमिन के लिए (`users.manage`)। पासवर्ड हैश किसी प्रतिक्रिया में कभी नहीं आते; उस फ़ील्ड का कोई JSON नाम नहीं है।

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` केवल उस खाते पर दिखता है जिसकी स्पष्ट सूची है। `hasPin` बताता है कि खाते के पास कियोस्क PIN या बैज है या नहीं; मान और उसका हैश कभी नहीं दिखते।

### `POST /api/users`

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `username` | string | ज़रूरी। छोटे अक्षर, अंक, बिंदु, अंडरस्कोर, हाइफ़न, अक्षर या अंक से शुरू, 2 से 64 अक्षर |
| `password` | string | ज़रूरी, कम से कम 8 अक्षर |
| `role` | string | `admin`, `operator` या `viewer`। डिफ़ॉल्ट `viewer` |
| `permissions` | string[] | वैकल्पिक। भूमिका के सेट को पूरी तरह बदल देता है |

नया उपयोगकर्ता लौटाता है। गलत नाम, भूमिका या पासवर्ड के लिए `400`, नाम लिया जा चुका हो तो `409`।

### `PUT /api/users/{username}`

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `role` | string | ज़रूरी, जब तक `permissions` सेट न हो |
| `permissions` | string[] | वैकल्पिक। खाली का मतलब "भूमिका इस्तेमाल करें" |
| `disabled` | bool | `true` खाते को बंद करता है और उसके हर सेशन को खत्म करता है |

अपडेट किया हुआ उपयोगकर्ता लौटाता है। अज्ञात भूमिका के लिए, या आख़िरी चालू एडमिन को बंद करने के लिए `400`: यह ऐसा लॉकआउट है जिसे पलटने के लिए कोई नहीं बचेगा। अज्ञात उपयोगकर्ता के लिए `404`।

### `DELETE /api/users/{username}`

`{"status":"deleted"}`। अपने खाते या आख़िरी चालू एडमिन के लिए `400`, अज्ञात उपयोगकर्ता के लिए `404`।

### `POST /api/users/{username}/password`

एडमिन पुराना पासवर्ड जाने बिना किसी और का पासवर्ड सेट करता है। `{"password": "..."}`, कम से कम 8 अक्षर। `{"status":"password reset"}` लौटाता है और उस खाते के हर सेशन को खत्म करता है।

### `PUT /api/users/{username}/pin`

एडमिन किसी खाते को कियोस्क पैनल पर साइन इन के लिए PIN या बैज मान देता है, या जो है उसे बदलता है। `{"code": "482913"}`: 6 से 72 अक्षर, कोई स्पेस या कंट्रोल कैरेक्टर नहीं, अंक या बैज रीडर जो कुछ भी टाइप करे। `{"status":"PIN set","username":"olga","hasPin":true}` लौटाता है। मान को पासवर्ड की तरह bcrypt से हैश किया जाता है, और कभी लॉग या वापस नहीं भेजा जाता। बहुत छोटे, बहुत लंबे या स्पेस वाले कोड के लिए `400`, और ऐसे कोड के लिए भी जो किसी दूसरे खाते के पास पहले से है: पैनल खाते को केवल कोड से खोजता है, इसलिए एक कोड एक ही खाता खोलता है। अज्ञात उपयोगकर्ता के लिए `404`। यह पासवर्ड या किसी सेशन को नहीं छूता।

### `DELETE /api/users/{username}/lockout`

लॉक हुए खाते को उसका लॉक खत्म होने से पहले वापस आने देता है, और उसके गलत पासवर्ड और PIN की गिनती शून्य से शुरू करता है। `{"status":"unlocked","username":"olga","locked":false}`। अज्ञात उपयोगकर्ता के लिए `404`। लॉक हुआ खाता `GET /api/users` में `"locked":true` और `"lockedUntil"` दिखाता है।

### `DELETE /api/users/{username}/pin`

PIN या बैज हटाता है और खाते को हर उस कियोस्क पैनल से साइन आउट करता है जहाँ वह साइन इन है। उसका पासवर्ड, और उसके अपने कंप्यूटर पर उसके सेशन, नहीं छुए जाते। `{"status":"PIN cleared","username":"olga","hasPin":false}`। अज्ञात उपयोगकर्ता के लिए `404`।

### `GET /api/opcua/certificates`

OPC UA सर्वर में साइन इन के लिए उपयोगकर्ताओं से जुड़े हर X.509 प्रमाणपत्र, नए से पुराने की ओर ([OPC UA सर्वर](/hi/edge/opc-ua-server/#x509-user-certificates) देखें): `{"serverAcceptsCertificates":false,"certificates":[...]}`। हर एक में `thumbprint` (DER रूप का SHA-256, छोटे अक्षरों का हेक्स), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, रद्द होने पर `revokedAt` और `revokedBy`, इस्तेमाल होने पर `lastUsed`, और `state` होता है: `active`, `revoked`, `expired` या `not yet valid`। केवल सक्रिय प्रमाणपत्र ही किसी को साइन इन कराता है। `serverAcceptsCertificates` बताता है कि OPC UA सर्वर चालू है और उसमें `HOTLOOP_OPCUA_SERVER_ALLOW_X509` सेट है या नहीं; प्रमाणपत्र दोनों हालत में रखे जाते हैं। केवल सार्वजनिक प्रमाणपत्र ही सहेजा या भेजा जाता है।

### `GET /api/users/{username}/certificates`

एक उपयोगकर्ता की वही सूची। अज्ञात उपयोगकर्ता के लिए `404`।

### `POST /api/users/{username}/certificates`

किसी उपयोगकर्ता से प्रमाणपत्र जोड़ता है। `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; लेबल वैकल्पिक है। सूची में जैसा दिखता है वैसे प्रमाणपत्र के साथ `201` लौटाता है। प्रमाणपत्र कम से कम 2048 बिट की कुंजी वाला RSA होना चाहिए और समाप्त नहीं होना चाहिए। `400` बताता है कि इनमें से कौन-सा है, और ऐसी चीज़ के लिए भी जो प्रमाणपत्र नहीं है: निजी कुंजी नाम लेकर ठुकराई जाती है और कभी रखी या दोहराई नहीं जाती, और चेन भी। अज्ञात उपयोगकर्ता के लिए `404`। प्रमाणपत्र पहले से जुड़ा हो, इस उपयोगकर्ता से या किसी और से, तो `409`: एक प्रमाणपत्र एक व्यक्ति है। बदलाव लॉगबुक में दर्ज होता है, किसने किया इसके साथ।

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

प्रमाणपत्र रद्द करता है। वह अब साइन इन नहीं कर सकता, उससे खुला सेशन अनुमति कैश के 10 सेकंड के भीतर खत्म हो जाता है, और बाद की कोशिशें ठुकराई जाती हैं और रद्द के रूप में लॉग होती हैं। वह `revoked` के रूप में सूची में रहता है, किसने और कब किया इसके साथ, और दोबारा रद्द करने पर पहला रिकॉर्ड बना रहता है। `{thumbprint}` सूची में दिखने वाला SHA-256 है; कोलन, स्पेस और बड़े अक्षर स्वीकार हैं। प्रमाणपत्र इस उपयोगकर्ता का न हो तो `404`।

### `DELETE /api/users/{username}/certificates/{thumbprint}`

प्रमाणपत्र भुला देता है। उसे दोबारा जोड़ने पर वह फिर काम करता है। इस उपयोगकर्ता का न हो तो `404`। उपयोगकर्ता को हटाने से उसके प्रमाणपत्र भी हट जाते हैं।

## स्टेटस और डायग्नॉस्टिक्स

### `GET /api/status`

हेडर बार: रनटाइम काउंटर, अलार्म सारांश, प्लांट का नाम, और यह कौन-सा उत्पाद है। `product` `iot`, `edge` या `gateway` है, `hotloop --product` जैसा ही। `features` बताता है कि उत्पादों के बीच जो सुविधाएँ अलग हैं, उनमें से इस उत्पाद में कौन-सी हैं: Gateway में `edge-publish`, `fleet`, `opcua-server`, `reports` और `sites`, Edge में पहली और तीसरी, IoT में कोई नहीं। `version` बिल्ड है, और `imageDigest` उस इमेज का डाइजेस्ट है जिससे वह शुरू हुआ, जो `:stable` का अनुसरण करने वाले बॉक्स पर संस्करण संख्या नहीं बता सकती। यह तभी होता है जब सुपरवाइज़र ने बताया हो (Quadlet यूनिट हर शुरुआत से पहले बताती हैं; अकेली बाइनरी और Helm इंस्टॉल नहीं बता सकते) और नहीं तो छोड़ दिया जाता है।

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Gateway जो हर प्रोटोकॉल जानता है, और क्या इस बिल्ड में उसका ड्राइवर है।

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

डायग्नॉस्टिक्स स्क्रीन जो दिखाती है: डेटाबेस पूल, हिस्टोरियन कतार और इतिहास का आकार, टैग बस, एंटिटी इंजन, लॉगबुक का रिकॉर्डर, रनटाइम, MCP (सर्वर और आउटबाउंड कनेक्शन) और ऑटोमेशन इंजन के सक्रिय नियम, वेबहुक पाथ और स्टेट-बदलाव की कतार।

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

आउटबाउंड MCP सर्वर कॉन्फ़िगर होने पर `outbound` हर एक की सूची देता है:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

आउटबाउंड सर्वर के `target` या `lastError` में कोई भी क्रेडेंशियल हटा दिया जाता है, क्योंकि URL या कमांड लाइन टोकन ले जा सकती है और हर भूमिका इसे पढ़ सकती है। MCP टोकन खुद हमेशा केवल `tokenSet` होता है।

## डिवाइस

डिवाइस एक प्रोटोकॉल पर एक कनेक्शन है। `config` और `address` में क्या जाता है, यह प्रोटोकॉल पर निर्भर है: देखें [प्रोटोकॉल और ड्राइवर](/hi/iot/protocols/)।

### `GET /api/devices`

हर डिवाइस, उसकी लाइव कनेक्शन स्थिति के साथ। क्रेडेंशियल `[redacted]` होते हैं। `?q=` उन डिवाइस को रखता है जिनके id, नाम, पते या प्रोटोकॉल में वह टेक्स्ट है (केस की परवाह किए बिना), `?limit=` (1 से 5000, बाक़ी कुछ भी `400`) उनमें से पहले कुछ को; दोनों में से किसी के साथ `X-Total-Count` बताता है कि कितने मिले।

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` `connected`, `connecting`, `degraded` (चालू, पर पोल विफल हो रहे हैं), `disconnected` या `disabled` होता है। `lastError`, `errorCount` और बाक़ी तब दिखते हैं जब कहने को कुछ हो।

### `POST /api/devices`

`id` नया हो तो डिवाइस बनाता है, नहीं तो बदल देता है। कोई `PUT` नहीं है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `id` | string | ज़रूरी। 1 से 64 अक्षर, अंक, `.`, `_`, `-`, अक्षर या अंक से शुरू। यह URL, MQTT टॉपिक और MCP आर्गुमेंट में पहुँचता है |
| `name` | string | ज़रूरी |
| `protocol` | string | ज़रूरी। ऐसा जिसका ड्राइवर इस बिल्ड में है (`GET /api/protocols`) |
| `address` | string | ज़रूरी। होस्ट और पोर्ट, या `opc.tcp://` या `http://` URL: प्रोटोकॉल तय करता है |
| `enabled` | bool | छोड़ने पर `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 का मतलब रनटाइम का डिफ़ॉल्ट। पोल अंतराल की निचली सीमा `HOTLOOP_MIN_POLL_INTERVAL` है |
| `site`, `area`, `line` | string | नाम से डिवाइस को उपकरण ट्री में रखता है, ज़रूरत पड़ने पर नोड बनाता है |
| `equipmentId` | int | इसके बजाय उसे ट्री के किसी नोड पर रखता है; तब `site`, `area` और `line` नोड से आते हैं। देखें [उपकरण ट्री और लेबल](/hi/iot/equipment/) |
| `config` | object | प्रोटोकॉल के अपने विकल्प। क्रेडेंशियल [केवल-लिखने के नियमों](#सीक्रेट-केवल-लिखने-के-लिए-हैं) का पालन करते हैं |

रनटाइम फ़ील्ड (`state`, `lastPoll`, `tagCount` आदि) केवल पढ़ने के लिए हैं; उन्हें वापस भेजें तो अनदेखे होते हैं। सहेजा हुआ डिवाइस लौटाता है, संवेदनशील मान छिपाकर। बिना ड्राइवर वाले प्रोटोकॉल, विफल वैलिडेशन या क्रेडेंशियल नियम के लिए `400`; रनटाइम तुरंत उसके साथ रीलोड हो जाता है।

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

डिवाइस, उसके टैग और उसके लेबल।

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

जिस डिवाइस में कोई टैग नहीं, उसके लिए `tags` `[]` है। अज्ञात id के लिए `404`।

### `DELETE /api/devices/{id}`

डिवाइस, उसके टैग और उनकी एंटिटी हटाता है। **उसका इतिहास रखा जाता है।** `{"deleted":"tank-farm"}`, या `404`।

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` कुछ हटाए बिना पोलिंग रोक देता है। `{"enabled":false,"id":"tank-farm"}` लौटाता है। अज्ञात id के लिए `404`।

### `POST /api/devices/{id}/browse`

डिवाइस से पूछता है कि उसके पास कौन-से पॉइंट हैं। केवल `devices.read` चाहिए, क्योंकि यह पढ़ता है। कोई बॉडी नहीं।

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

जो प्रोटोकॉल अपने पॉइंट गिना नहीं सकता (Modbus, S7comm, HTTP) वह `200` के साथ `{"supported":false,"reason":"..."}` देता है: यह प्रोटोकॉल के बारे में एक तथ्य है, त्रुटि नहीं। डिवाइस जुड़ा न हो तो `503`। यहाँ `writable` वह है जो डिवाइस पॉइंट के बारे में कहता है, यह नहीं कि Gateway उसे लिखेगा या नहीं।

### `POST /api/devices/{id}/import`

ब्राउज़ के नतीजों को कॉन्फ़िगर किए गए टैग में बदलता है। `tags.write` चाहिए, क्योंकि यह टैग बनाता है।

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

हर प्रविष्टि `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` और `writable` लेती है (ब्राउज़ का नतीजा जैसा आया)। `{"inserted":2,"updated":0}` लौटाता है। **आयात किया गया हर टैग केवल पढ़ने योग्य है**, डिवाइस जो भी कहे: खोजा गया पॉइंट ऐसा पॉइंट नहीं है जिसे किसी ने कमांड करने लायक तय किया हो, और डिफ़ॉल्ट उलटा रखने से कुछ हज़ार एक साथ सक्रिय हो जाते। जिन्हें आप चाहते हैं उन्हें `POST /api/tags` से सक्रिय करें। अज्ञात डिवाइस के लिए `404`।

## UniFi: OT नेटवर्क, क्लाइंट, और नेटवर्क पर डिवाइस कहाँ है

UniFi साइटों के बारे में HotLoop का अपना रिकॉर्ड। देखें [UniFi Network](/hi/iot/unifi/)। `/api/unifi` के नीचे `{id}` एक UniFi डिवाइस है (एक कंसोल पर एक साइट); `{network}` कंसोल का अपना ID है जो वह किसी नेटवर्क को देता है, जैसा `GET .../networks` देता है; `{mac}` कोई भी सामान्य लिखावट लेता है और छोटे अक्षरों व कोलन के साथ रखा जाता है।

**इनमें से कोई भी कंसोल से कुछ नहीं पूछता।** ये ड्राइवर की उससे की गई आख़िरी रीडिंग पढ़ते हैं, इसलिए खुली छोड़ी गई स्क्रीन कंसोल का कुछ नहीं लेती। इसका यह भी मतलब है कि डिवाइस एक बार पढ़े जाने तक ये `503` देते हैं, और `--mcp-stdio` हेल्पर में हमेशा, जो कभी किसी कंसोल में लॉग इन नहीं करता। इनमें से कोई कंसोल पर लिखता भी नहीं।

जो बदलाव कोई अलार्म बनाता या हटाता है, वह `change` में यह बताता है: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`। ये `/api/alarms` के नीचे के सामान्य अलार्म परिभाषाएँ हैं।

### `GET /api/devices/{id}/network`

HotLoop का डिवाइस (PLC, मीटर) नेटवर्क पर कहाँ है। जुड़ा होने पर:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

न जुड़ा हो तो `link` `null` है और `proposals` में वे क्लाइंट सूचीबद्ध होते हैं जो HotLoop द्वारा पढ़े जाने वाले किसी भी कंसोल के पास डिवाइस के IP पर हैं, नए पहले। प्रस्ताव बस प्रस्ताव है: कंसोल के IP पिछड़ते हैं, इसलिए जब तक कोई एडमिन एक की पुष्टि न करे, कुछ नहीं जुड़ता।

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` पुष्टि करता है कि डिवाइस कौन-सा क्लाइंट है। उसके बाद MAC कुंजी है और IP पर फिर कभी भरोसा नहीं किया जाता। क्लाइंट को टैग मिलते हैं (कंसोल पर `c.<mac>.*`) और एक अलार्म, "PLC-07 नेटवर्क से बाहर", प्राथमिकता 1, 120 s ऑन-डिले के साथ ताकि रीबूट किसी को पेज न करे। `{"link":{...},"change":{...}}` लौटाता है। `consoleId` UniFi डिवाइस न हो या MAC, MAC न हो तो `400`, अज्ञात डिवाइस के लिए `404`।

### `DELETE /api/devices/{id}/network`

लिंक हटाता है, और उसके लिए HotLoop ने जो अलार्म बनाया था उसे भी, जब तक क्लाइंट अब भी ज्ञात सूची से निगरानी में न हो। लिंक न हो तो `404`।

### `GET /api/unifi/{id}/networks`

साइट के नेटवर्क जैसे कंसोल के पास हैं, HotLoop के रिकॉर्ड के साथ: `ot`, `known` (उसकी सूची में कितने डिवाइस हैं), `clients` (अभी उस पर) और `unknown` (अभी उस पर और सूची में नहीं)। जिस नेटवर्क का HotLoop के पास रिकॉर्ड है और कंसोल के पास अब नहीं है, वह `"onConsole":false` के साथ लौटता है।

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` किसी नेटवर्क को OT चिह्नित करता है। उस पर जो कुछ ज्ञात सूची में नहीं है वह `n.<network>.unknown` में गिना जाता है और `.unknown_last` में अपना नाम बताता है, और HotLoop अलार्म "SCADA पर अज्ञात डिवाइस" बनाता है, प्राथमिकता 1। `{"ot": false}` चिह्न हटाता है और वह अलार्म हटाता है; ज्ञात सूची रखी जाती है। WAN या ऐसे नेटवर्क के लिए `400` जो कंसोल के पास नहीं है।

### `POST /api/unifi/{id}/networks/{network}/accept-all`

नेटवर्क पर अभी जो कुछ है उसे जैसा है वैसा स्वीकार करता है: चिह्नित करने के बाद का एक क्लिक। जो डिवाइस पहले से सूची में हैं वे अपना नाम और निगरानी रखते हैं। कोई बॉडी नहीं। `{"accepted":[{known device}...]}` लौटाता है, जो उसने जोड़े।

### `GET /api/unifi/{id}/known`

साइट के नेटवर्क पर हर ज्ञात डिवाइस: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`।

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` किसी डिवाइस को नेटवर्क पर स्वीकार करता है, या उसका नाम या निगरानी बदलता है। `watch` उसे टैग और ऑफ़लाइन अलार्म देता है; जो डिवाइस अनुमत है पर आता-जाता रहता है (रखरखाव का लैपटॉप) वह उसके बिना स्वीकार होता है। नेटवर्क कभी OT चिह्नित नहीं हुआ हो तो `400`।

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

किसी डिवाइस को सूची से हटाता है। अगर वह नेटवर्क पर है, तो अगली रीडिंग पर वह फिर अज्ञात होता है।

### `GET /api/unifi/{id}/clients`

कंसोल जो हर क्लाइंट सूचीबद्ध करता है, साथ में हर निगरानी वाला क्लाइंट जिसे वह सूचीबद्ध नहीं करता, हर एक के साथ कि वह कहाँ है, ऑनलाइन है या नहीं, और `ot`, `known`, `watched`, `linkedTo` और एक-पंक्ति `summary`। `?q=` इसे MAC, IP या नाम तक सीमित करता है।

### `GET /api/unifi/consoles`

HotLoop के पास हर UniFi डिवाइस, चल रहा हो या नहीं, UniFi स्क्रीन के चयनकर्ता के लिए: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`। जिस कंसोल को यह प्रोसेस नहीं पढ़ पाई, वह `why` में कारण बताता है।

### `GET /api/unifi/{id}/overview`

ओवरव्यू कार्ड: डिवाइस और क्लाइंट की गिनती (क्लाइंट तब गिना जाता है जब HotLoop मानता है कि वह नेटवर्क पर है, वही परीक्षण जो `n.<id>.clients` टैग इस्तेमाल करते हैं, केवल तब नहीं जब कंसोल उसे सूचीबद्ध करे), प्रति नेटवर्क क्लाइंट, कंसोल के सबसिस्टम का `health`, और हर गेटवे के लिए उसकी WAN पट्टी, `gateways[]`: हर WAN के लिए एक `wans[]` प्रविष्टि जिसमें `alive` (गेटवे की अपनी हेल्थ जाँचें, कभी WAN ब्लॉक का `up` नहीं), `known`, `active`, `backup`, लेटेंसी और उपलब्धता। `failover` ऐसे WAN पर ट्रैफ़िक है जो पहला नहीं है, `down` यानी कोई WAN जीवित नहीं, और `since` वह पहली रीडिंग है जिसमें HotLoop ने उस WAN पर ट्रैफ़िक देखा जिस पर वह अभी है, यानी जब HotLoop ने गौर किया, न कि जब गेटवे बदला। `events` इवेंट वेबसॉकेट की स्थिति है (`live`, `error`, `reconnects`) और सबसे नए दस इवेंट।

### `GET /api/unifi/{id}/topology`

नक्शा। `nodes[]` अपनाए गए डिवाइस हैं, ग्रिड में उनकी जगह के साथ (`x`, `y`, `layer`: गेटवे से बाएँ से दाएँ, एक ही रीडिंग के लिए एक ही तरह सजाए गए), `edges[]` उनके बीच के केबल हैं, कंसोल की अपनी `downlink_table` से, `wired[]` और `wifi[]` हर स्विच पोर्ट और हर AP व SSID से लटके क्लाइंट हैं। जिस डिवाइस को कुछ भी कहीं जुड़ा नहीं बताता, उसे `noUplink` सेट के साथ अकेला दिखाया जाता है, अंदाज़े से गेटवे से नहीं लटकाया जाता। HotLoop जिस दूसरे UniFi कंसोल को पढ़ता है, उसका जो डिवाइस यह कंसोल क्लाइंट के रूप में सूचीबद्ध करता है, वह `external` सेट वाले नोड और `stitched` वाले एज के रूप में जोड़ा जाता है। `feeds` डिवाइस MAC के हिसाब से वे HotLoop डिवाइस हैं जो उसके नीचे के किसी क्लाइंट से जुड़े हैं, प्लांट ट्री के लिए उनके `equipmentId` के साथ, और `links` वही डिवाइस क्लाइंट MAC के हिसाब से।

### `GET /api/unifi/{id}/devices`

हर अपनाया गया डिवाइस उसके आँकड़ों और फ़ेसप्लेट के लिए उसके `ports[]` के साथ: लिंक, गति, PoE मोड और खपत, पोर्ट पर सीखे गए क्लाइंट, उससे जुड़ा डिवाइस, और ऐसे पोर्ट के लिए `dropped` जो पिछली रीडिंग में ऊपर था और अब नीचे है। जिस डिवाइस को कंसोल ने खो दिया, वह कोई आँकड़ा और कोई पोर्ट लिंक नहीं बताता, क्योंकि उसने आख़िर में जो कहा था वह अब मौजूदा नहीं है।

### `GET /api/unifi/{id}/wifi`

साइट के SSID, `enabled`, जिस नेटवर्क पर वे हैं और हर एक पर कितने क्लाइंट हैं, के साथ। जब कंसोल इस खाते को अपने वायरलेस नेटवर्क नहीं दिखाता, तो `error` कारण बताता है और `wlans` खाली होता है।

### `GET /api/unifi/{id}/events`

HotLoop के जुड़ने के बाद से कंसोल ने जो सबसे नए इवेंट रिपोर्ट किए, नए पहले (`?limit=` 200 तक, डिफ़ॉल्ट 50), और इवेंट वेबसॉकेट की स्थिति। हर इवेंट में कंट्रोलर की `key` (`EVT_SW_Lost_Contact`), उसका अपना `message`, `severity` (कंट्रोलर जब उसे कुछ गड़बड़ बताता है तब `warning`) और वह डिवाइस, क्लाइंट और पोर्ट होता है जिसके बारे में वह है। वे लॉगबुक में भी हैं, उस स्विच या एक्सेस पॉइंट के नीचे दर्ज जिसके बारे में वे हैं ([UniFi Network](/hi/iot/unifi/#इवेंट) देखें)।

### `POST /api/unifi/{id}/starter-alarms`

कंसोल के पास अभी जो है उससे साइट के आम अलार्म बनाता है, `/api/alarms` के नीचे सामान्य अलार्म परिभाषाओं के रूप में: हर अपनाया गया डिवाइस ऑफ़लाइन (प्राथमिकता 2, 60 s ऑन-डिले), हर अपलिंक पोर्ट डाउन (प्राथमिकता 1, 10 s), दो या ज़्यादा WAN वाला गेटवे जो बैकअप पर चल रहा हो (प्राथमिकता 2, 30 s)। बॉडी वैकल्पिक है। `{"poeLimitW": 25}` हर PoE पोर्ट की `poe_w` खपत पर, उतने वाट से ऊपर होने पर, प्राथमिकता 3 का अलार्म जोड़ता है, 30 s ऑन-डिले के साथ; कंसोल यह नहीं बताता कि पोर्ट का बजट क्या है, इसलिए HotLoop अंदाज़ा नहीं लगाता। नकारात्मक सीमा `400` है।

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` वे अलार्म हैं जो सेट माँगता है और जो पहले से थे: पिछले दबाव से उसके अपने, या उसी टैग पर किसी का अपना अलार्म। इसलिए और उपकरण अपनाने के बाद दोबारा दबाना सुरक्षित है, और यह केवल नए उपकरण के लिए जोड़ता है। OT नेटवर्क और नेटवर्क से बाहर के अलार्म इसका हिस्सा नहीं हैं; वे नेटवर्क को OT चिह्नित करने और डिवाइस की निगरानी करने के साथ आते हैं। कंसोल एक बार पढ़े जाने तक `503`।

## MQTT डिस्कवरी

जिन डिवाइस ने MQTT पर खुद को घोषित किया, और हर एक के बारे में किसी व्यक्ति ने क्या तय किया। देखें [MQTT डिस्कवरी](/hi/iot/mqtt-discovery/)। डिस्कवरी एम्बेडेड ब्रोकर पर सुनती है जब वह चल रहा हो, और `/api/mqtt/brokers` के नीचे बने हर ब्रोकर पर। दोनों में से कुछ न हो तो `sources` खाली होता है। `--mcp-stdio` हेल्पर में, जो कभी नहीं सुनता, `GET /api/discovery` `{"running":false,"sources":[],"devices":[]}` देता है और हर दूसरा रूट `503`।

`{source}` वह ब्रोकर है जिस पर डिवाइस ने घोषणा की (HotLoop के अपने के लिए `embedded`, नहीं तो ब्रोकर का id); `{key}` वह है जिसने उसकी घोषणाओं को जोड़ा: उसका पहला आइडेंटिफ़ायर, उसका MAC `mac:aa:bb:cc:dd:ee:ff` के रूप में, या उसका नोड id। इसे URL-एन्कोड करें; आइडेंटिफ़ायर में ऐसे अक्षर होते हैं जो पाथ में नहीं चलते।

**इनमें से कोई भी कुछ सक्रिय नहीं करता।** डिवाइस को स्वीकार करने से उसके पॉइंट सक्रिय करने योग्य हो जाते हैं, एक-एक करके, `POST /api/tags` के ज़रिए, हर दूसरे पॉइंट की तरह।

### `GET /api/discovery`

हर स्रोत, जो उसने देखा और ठुकराया उसके साथ, और हर खोजा गया डिवाइस:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

`external` true वाला स्रोत `/api/mqtt/brokers` के नीचे बना ब्रोकर है, और `broker` बताता है कि वह कहाँ है। `autoCreate` false वाला स्रोत ऐसा है जिसके डिवाइस इनबॉक्स में इंतज़ार करते हैं: `deviceId` के बिना `discovered` के रूप में सूचीबद्ध, जब तक कोई एक स्वीकार न करे, कुछ बनता या पढ़ा नहीं जाता। `listenOnly` ऐसा ब्रोकर है जिस पर HotLoop कभी पब्लिश नहीं करता। `lastError` बताता है कि स्रोत क्यों जुड़ा नहीं है, उस पासवर्ड समेत जो खुल नहीं सकता।

`status` `discovered`, `accepted` या `ignored` होता है। हर कॉम्पोनेंट के लिए `unsupported` वह बताता है जो HotLoop इस्तेमाल नहीं कर सकता और क्यों ("value template not supported: filter `regex_findall_index` is not supported at column 12"), `unknownKeys` वे कॉन्फ़िग कुंजियाँ जो फ़ॉर्मैट परिभाषित नहीं करता, `commandTopics` हर वह टॉपिक जहाँ उसकी कमांड जा सकती हैं (पंखे का स्पीड टॉपिक और मुख्य टॉपिक), और `flags` वह जो स्वीकार करने से पहले किसी व्यक्ति को देखना चाहिए: कॉम्पोनेंट जो टॉपिक पढ़ता है उनके बाहर का कमांड टॉपिक, डिस्कवरी प्रीफ़िक्स के अंदर का, या किसी दूसरे डिवाइस द्वारा दावा किया गया, और ऐसा कॉन्फ़िग जो retained कमांड माँगता है। `withdrawnAt` उस कॉम्पोनेंट पर सेट होता है जिसे प्रकाशक ने वापस ले लिया। `suggestedEquipmentId` वह ट्री नोड है जिसे डिवाइस का `suggested_area` बताता है, जब ठीक एक नोड का वह नाम हो; यह केवल स्वीकार करने का डायलॉग पहले से भरता है। एम्बेडेड ब्रोकर पर `announcedBy` और `announcedVia` वे ब्रोकर लॉगिन और क्लाइंट id हैं जिन्होंने उसका नवीनतम कॉन्फ़िग पब्लिश किया, और `acceptedLogin` वह लॉगिन जिससे वह स्वीकार हुआ। जिस स्वीकृत डिवाइस की घोषणा बदली, या जिसे किसी दूसरे लॉगिन ने घोषित किया, उसमें `review` होता है:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

एक डिवाइस, वही रूप। जिसे HotLoop ने नहीं देखा उसके लिए `404`।

### `POST /api/discovery/{source}/{key}/accept`

डिवाइस को स्वीकार करता है। वैकल्पिक बॉडी `{"equipmentId": 12}` उसे उसी चरण में ट्री में रखती है। कुछ सक्रिय नहीं करता। डिवाइस लौटाता है। अनदेखे किए गए के लिए `400`।

### `POST /api/discovery/{source}/{key}/ignore`

डिवाइस को छोड़ देता है: उसका HotLoop डिवाइस, टैग और एंटिटी हट जाते हैं (इतिहास रहता है), और दोबारा घोषणा करने पर भी वह अनदेखा रहता है। डिवाइस लौटाता है। खोजे गए डिवाइस पर `DELETE /api/devices/{id}` वही करता है, क्योंकि जो डिवाइस घोषणा करता रहे वह बस लौट आता।

### `POST /api/discovery/{source}/{key}/unignore`

अनदेखे किए गए डिवाइस को, उसकी आख़िरी घोषणा से, खोजे गए के रूप में वापस लाता है। अनदेखा न हो तो `400`।

### `POST /api/discovery/{source}/{key}/review/apply`

स्वीकृत डिवाइस को वही चलवाता है जो उसने घोषित किया। हर पॉइंट सक्रिय है या नहीं, वैसा ही रहता है। जब समीक्षा के लिए कुछ इंतज़ार में न हो तो `400`।

### `POST /api/discovery/{source}/{key}/review/reject`

स्वीकृत कॉन्फ़िग को चलता रखता है और यह बदलाव पेश करना बंद करता है। बाद का कोई अलग बदलाव फिर पेश किया जाता है। कुछ इंतज़ार में न हो तो `400`।

समीक्षा इस बारे में हो सकती है कि किसने घोषणा की: `"kind":"publisher"` वाला बदलाव और सारांश पंक्ति "announced by login garage-node; accepted from kitchen-node"। इसे लागू करने से वह लॉगिन वही बन जाता है जिससे डिवाइस स्वीकार हुआ।

## ब्रोकर लॉगिन

HotLoop में बनाए गए एम्बेडेड ब्रोकर के लॉगिन, हर एक के साथ वे टॉपिक जिन पर वह पब्लिश और सब्सक्राइब कर सकता है। देखें [एम्बेडेड MQTT ब्रोकर](/hi/iot/broker/)। लॉगिन पूरे प्लांट के ब्रोकर की चाबी है, इसलिए ये `users.manage` हैं, एडमिन के। यहाँ कुछ भी कभी पासवर्ड या उसके हैश के साथ जवाब नहीं देता। हर बदलाव लॉग में जाता है और क्लाइंट की अगली पब्लिश से लागू होता है; किसी को दोबारा जुड़ना नहीं पड़ता।

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

जहाँ यह प्रोसेस ब्रोकर नहीं चलाती वहाँ `running` false होता है; लॉगिन फिर भी रखे जाते हैं, और ब्रोकर शुरू होने पर उन्हें पढ़ता है। `envLogins` `HOTLOOP_BROKER_USERS` के नाम हैं, जो कुछ भी कर सकते हैं। नियम में `%u` लॉगिन का अपना नाम है और `%p` डिस्कवरी प्रीफ़िक्स; `resolved*` दोनों भरे हुए नियम हैं।

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` 1 से 64 अक्षर, अंक, `-` और `_` है (यह टॉपिक में `%u` की जगह लेता है)। `password` कम से कम 12 अक्षर का है। `profile` नियम भरता है; `publish` और `subscribe`, दिए जाने पर, उन्हें बदल देते हैं। दोनों में से एक चाहिए। नियम MQTT टॉपिक फ़िल्टर है: `+` और `#` केवल पूरे स्तर के रूप में, `#` केवल आख़िर में, कभी `$` टॉपिक नहीं। लॉगिन के साथ `201`; ऊपर की किसी भी बात या ऐसे नाम के लिए `400` जो `HOTLOOP_BROKER_USERS` में पहले से है; लिए जा चुके नाम के लिए `409`।

### `PUT /api/broker/logins/{name}`

`profile`, `publish`, `subscribe` और `password` में से कुछ भी; जो नहीं भेजा जाता वह रहता है। लॉगिन के साथ `200`, जो मौजूद नहीं उसके लिए `404`।

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`। उससे अब भी जुड़ा क्लाइंट उसके बाद कुछ नहीं कर सकता, और दोबारा नहीं जुड़ सकता। जो मौजूद नहीं उसके लिए `404`।

## नेटवर्क डिस्कवरी

प्लांट नेटवर्क पर mDNS, SSDP और DHCP से सुने गए डिवाइस, और हर एक के बारे में किसी व्यक्ति ने क्या तय किया। देखें [नेटवर्क डिस्कवरी](/hi/iot/network-discovery/)। `--mcp-stdio` हेल्पर में, जो कभी नहीं सुनता, `GET /api/network-discovery` `{"running":false,"finds":[]}` देता है और हर दूसरा रूट `503`।

`{key}` बताती है कि कोई खोज कैसे और किसके द्वारा सुनी गई: `mdns:` और उसका mDNS होस्ट नाम, `ssdp:` और उसका UPnP uuid, `dhcp:` और उसका MAC। इसे URL-एन्कोड करें।

**इनमें से कोई भी कुछ सक्रिय नहीं करता**, और यहाँ कुछ भी तब तक नहीं जुड़ता जब तक कोई उसे स्वीकार न करे।

### `GET /api/network-discovery`

श्रोता, प्रोबिंग, वे इंटरफ़ेस जिन पर वे हैं, और हर खोज:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (उसने कुछ घोषित किया जिसके लिए HotLoop के पास शब्द नहीं), `upnp` या `dhcp` है। जिस खोज के `proposal` में `protocol` है वह स्वीकार होने पर `address` पर उस प्रोटोकॉल का डिवाइस बन जाती है; जिसमें नहीं है वह `how` में बताती है कि उसे क्या भीतर लाएगा। `also` उन दूसरी खोजों और MQTT से खोजे डिवाइस को सूचीबद्ध करता है जो वही बॉक्स हैं, MAC या पते से। `status` `discovered`, `accepted` या `ignored` है, और `deviceId` वह डिवाइस जो स्वीकार करने से बना। श्रोता की `error` बताती है कि वह क्यों नहीं सुन रहा (पोर्ट 67 लिया हुआ या अनुमत नहीं, कोई मल्टीकास्ट इंटरफ़ेस नहीं); `refused` उन नई खोजों को गिनता है जो रिकॉर्ड भर जाने के कारण छोड़ी गईं।

### `GET /api/network-discovery/{key}`

एक खोज, वही रूप। जिसे HotLoop ने नहीं सुना उसके लिए `404`।

### `POST /api/network-discovery/{key}/accept`

खोज को स्वीकार करता है। वैकल्पिक बॉडी `{"equipmentId": 12}` उससे बने डिवाइस को ट्री में रखती है। जिस खोज के लिए HotLoop के पास ड्राइवर है वह प्रस्तावित पते पर डिवाइस बन जाती है, चालू, बिना टैग के और कुछ सक्रिय नहीं; बाक़ी ज्ञात के रूप में दर्ज होती हैं और कुछ नहीं बनातीं। खोज लौटाता है। पहले से स्वीकृत या अनदेखी के लिए `400`।

### `POST /api/network-discovery/{key}/ignore`

ऐसी खोज को छिपाता है जिसके बारे में किसी ने तय नहीं किया, और दोबारा सुने जाने पर भी छिपी रखता है। जिसका फ़ैसला हो चुका उसके लिए `400`।

### `POST /api/network-discovery/{key}/unignore`

अनदेखी खोज को फ़ैसले के लिए वापस लाता है। अनदेखी न हो तो `400`।

### `POST /api/network-discovery/probe`

अभी प्रोब करता है: हर उस इंटरफ़ेस पर mDNS क्वेरी और SSDP खोज जिसका नेटवर्क `HOTLOOP_NETDISC_PROBE_NETWORKS` में है, और कहीं और नहीं। `{"status": ...}` लौटाता है, जो बाहर नहीं गया वह `status.probe.lastError` में। जब किसी नेटवर्क में प्रोबिंग चालू न हो तो `400`: यह बटन उसे चालू नहीं कर सकता, केवल डिप्लॉयमेंट कर सकता है।

## इंटीग्रेशन

ऐसे डिवाइस के प्रकार का कॉन्फ़िग फ़्लो जिस पर कोई व्यक्ति HotLoop को इंगित करता है: पूछना कि इंटीग्रेशन को क्या चाहिए, जवाबों के साथ असली डिवाइस को देखना, और जो मिला उससे डिवाइस और उसके टैग बनाना। देखें [इंटीग्रेशन](/hi/iot/integrations/)।

**यहाँ कुछ भी कुछ सक्रिय नहीं करता।** सेटअप जो भी टैग बनाता है वह केवल पढ़ने योग्य है। उसे सक्रिय करना `POST /api/tags` है, हर दूसरे पॉइंट की तरह।

### `GET /api/integrations`

इस बिल्ड के हर इंटीग्रेशन, उन सवालों के साथ जो वह पूछता है:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` `text`, `number`, `bool`, `choice` या `secret` है। `showWhen` वाला फ़ील्ड (`{"version":["3"]}`) तभी पूछा जाता है जब कोई दूसरा जवाब उन मानों में से एक हो, और जो सवाल दिख नहीं रहा उसका जवाब अनदेखा किया जाता है।

### `POST /api/integrations/{id}/probe`

जवाबों की जाँच करता है और असली डिवाइस को देखने जाता है। कुछ सहेजता नहीं।

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

`{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}` लौटाता है। `address` वह पता है जैसा इंटीग्रेशन ने सुलझाया। `found` में `name` (डिवाइस खुद को क्या कहता है), `identity` (वह क्या बताता है कि वह क्या है), `notes` (स्वीकार करने से पहले जानने की बातें) और `points` हैं, हर एक टैग के रूप में `{name, address, dataType, unit, description, writable, deviceClass}` और साथ में `group`, `sample` (मिलने पर जो उसने पढ़ा) और `suggested`।

सवालों से न मिलने वाले जवाबों के लिए `400`, सारी समस्याएँ एक साथ; जो सवाल इंटीग्रेशन नहीं पूछता उसका जवाब भी `400` है, अनदेखा नहीं होता। जब डिवाइस ने जवाब नहीं दिया या ऐसी चीज़ से जवाब दिया जो उसका प्रोटोकॉल नहीं है तो `502`, क्या गलत हुआ इसके साथ। जो इंटीग्रेशन इस बिल्ड में नहीं है उसके लिए `404`। कोई सीक्रेट कभी जवाब या त्रुटि में नहीं होता।

### `POST /api/integrations/{id}/setup`

डिवाइस को फिर देखता है, फिर उसे और उसके टैग बनाता है। बॉडी probe वाली है, साथ में:

| फ़ील्ड | मतलब |
|---|---|
| `deviceId` | नए डिवाइस का id। खाली हो तो नाम से लिया जाता है। किसी डिवाइस के पास हो तो `400` |
| `name` | डिवाइस का नाम। खाली हो तो वह लिया जाता है जो डिवाइस खुद को कहता है |
| `points` | `found.points` से सेटअप करने के नाम। खाली हो तो `suggested` चिह्नित वाले लिए जाते हैं। डिवाइस के पास न हो ऐसा नाम `400` है |
| `site`, `area`, `line` | यह उपकरण ट्री में कहाँ जाता है, जैसा `POST /api/devices` पर |

पॉइंट की जाँच डिवाइस की मौजूदा स्थिति से होती है, उस से नहीं जो क्लाइंट कहता है कि उसने एक मिनट पहले पाया। `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}` लौटाता है। डिवाइस चालू है और पोल हो रहा है, हर टैग केवल पढ़ने योग्य है, और हर टैग की अपनी रीड एंटिटी है। जो सेटअप बीच में विफल हो वह कोई डिवाइस पीछे नहीं छोड़ता।

## MQTT ब्रोकर

HotLoop के अपने ब्रोकर के अलावा वे ब्रोकर जिन्हें डिस्कवरी सुनती है: किसी प्लांट का Mosquitto, वह ब्रोकर जो Zigbee2MQTT बॉक्स साथ लाया। देखें [MQTT डिस्कवरी](/hi/iot/mqtt-discovery/#अन्य-ब्रोकर)। उनके पासवर्ड डिवाइस क्रेडेंशियल कुंजी (`HOTLOOP_SECRET_KEY_FILE`) से सील होते हैं और कभी जवाब में नहीं लौटाए जाते; `passwordSet` बताता है कि कोई सहेजा हुआ है या नहीं, और `passwordProblem` कि सहेजा हुआ क्यों खुल नहीं सकता। हर बदलाव लॉग में जाता है और तुरंत लागू होता है: उस ब्रोकर का श्रोता और डिवाइस दोबारा जुड़ते हैं।

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` बताता है कि इस HotLoop के पास पासवर्ड सील करने की कुंजी है या नहीं।

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` 1 से 63 छोटे अक्षर, अंक और `-` है, `embedded` नहीं: यह उससे आए हर डिवाइस में ब्रोकर का नाम बताता है, और बदला नहीं जा सकता। `broker` `host:port` या `tcp://`, `ssl://`, `tls://`, `mqtt://` या `mqtts://` URL है, जिसमें लॉगिन न हो। `prefix` का डिफ़ॉल्ट `homeassistant` है; `autoCreate` false (डिवाइस इनबॉक्स में इंतज़ार करते हैं); `listenOnly` false; `tasmota` (Tasmota की अपनी डिस्कवरी, `tasmota/discovery/#`, भी सुनना) true; `shelly` (Shelly Gen2 और बाद के डिवाइस उनके पब्लिश किए `<prefix>/status/<component>` टॉपिक से सीखना) true; `enabled` true। पासवर्ड को यूज़रनेम और कुंजी चाहिए: `HOTLOOP_SECRET_KEY_FILE` के बिना यह `400` है, कभी सादे रूप में नहीं सहेजा जाता। ब्रोकर के साथ `201`; लिए जा चुके id के लिए `409`।

### `PUT /api/mqtt/brokers/{id}`

`id` के सिवा ऊपर के कोई भी फ़ील्ड; जो नहीं भेजा जाता वह रहता है। `"password":""` पासवर्ड साफ़ करता है। ब्रोकर के साथ `200`।

### `DELETE /api/mqtt/brokers/{id}`

ब्रोकर और उसने जो घोषित किया और किसी ने स्वीकार नहीं किया उसे हटाता है: इनबॉक्स, और कोई भी डिवाइस जो उसने खुद बनाया। जब तक उससे स्वीकार किए गए डिवाइस मौजूद हैं, उन्हें नामित करते हुए `409`: पहले उन्हें अनदेखा करें या हटाएँ, या इसके बजाय ब्रोकर को `"enabled":false` से बंद करें। `200` `{"deleted":"plant-uns"}`।

## टैग

### `GET /api/tags`

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `device` | केवल इस डिवाइस के टैग। `limit` के बिना वह सब लौटाता है |
| `q` | खोज: डिवाइस id, टैग नाम या विवरण का एक सबस्ट्रिंग, केस की परवाह किए बिना। `device` के साथ काम करती है |
| `limit` | 1 से 5000 तक की पूर्ण संख्या। `device` के बिना डिफ़ॉल्ट 500। बाक़ी कुछ भी, 5001 समेत, `400` है: वह ठुकराया जाता है, कभी कम के साथ जवाब नहीं दिया जाता (4.19.5 तक 1000 से ऊपर की हर सीमा चुपचाप 200 कर दी जाती थी) |
| `writable` | `true` केवल उन टैग के लिए जो लिखने योग्य चिह्नित हैं (जो राइट पिकर पेश करते हैं) |
| `offset` | पेज कहाँ से शुरू होता है, शून्य या अधिक। टैग डिवाइस के हिसाब से, फिर नाम के हिसाब से क्रमबद्ध हैं |

जवाब का `X-Total-Count` हेडर बताता है कि कुल कितने टैग मेल खाते हैं, इसलिए क्लाइंट `offset` से पेज बदलता है जब तक सब न मिल जाएँ, और जानता है कि सब मिल गए। खाली जवाब `[]` है।

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

अगर `deviceId` और `name` नए हों तो टैग बनाता है, नहीं तो बदल देता है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `deviceId` | string | ज़रूरी। डिवाइस मौजूद होना चाहिए (नहीं तो `404`) |
| `name` | string | ज़रूरी। कोई कंट्रोल कैरेक्टर नहीं |
| `address` | string | ज़रूरी। प्रोटोकॉल का अपना पता |
| `dataType` | string | `bool`, `int`, `float` या `string` (और आम उपनाम: `int16`, `word`, `coil`...)। तय करता है कि राइट कैसे एन्कोड हो |
| `unit`, `description` | string | |
| `enabled` | bool | छोड़ने पर `false` |
| `writable` | bool | **हर रास्ते से, टैग को लिखने के लिए सक्रिय करता है: UI, ऑटोमेशन, एंटिटी, MCP।** छोड़ने पर `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | `hasRange` के साथ, सीमा से बाहर का राइट ठुकराया जाता है (कभी काटा नहीं जाता) |
| `scale`, `offset` | number | इंजीनियरिंग मान = रॉ x स्केल + ऑफ़सेट। स्केल 0 का मतलब 1 |
| `noData` | list | रॉ मान जिनका मतलब "कोई माप नहीं" है, हर एक `{"raw", "reason"}`। `raw` स्ट्रिंग है (`"0x8005"`, `"-32763"`) या सादी संख्या, और स्ट्रिंग के रूप में लौटता है। जिस रीडिंग का रॉ मान सूची में है वह उस `reason` के साथ खराब गुणवत्ता की है, `scale` और `offset` से पहले जाँची जाती है। 32 कोड तक। जो कोड पूर्ण संख्या नहीं है, दो बार सूचीबद्ध है, या पॉइंट का प्रकार नहीं हो सकता, वह `400` है। हर प्रकार के लिए क्या लिखना है और Yokogawa DX का उदाहरण [प्रोटोकॉल और ड्राइवर](/hi/iot/protocols/#no-data-values) में देखें |
| `deadband`, `deadbandPercent` | number | इससे छोटे बदलाव इतिहास में नहीं लिखे जाते |
| `deviceClass` | string | वह क्लास जिससे टैग की एंटिटी शुरू होती हैं (`power`, `connectivity`, `temperature`...), जब वह उनके डोमेन के लिए कोई मायने रखती हो। टैग बनाते समय ली जाती है और बदलने पर अनदेखी की जाती है: उसके बाद क्लास एंटिटी की है, इसलिए उसे वहीं बदलें |

सहेजा हुआ टैग लौटाता है। `writable: true` के साथ सहेजना वैसे ही लॉग होता है: टैग को सक्रिय करना सुरक्षा का फ़ैसला है और उस पर नाम दर्ज होता है। टैग की एंटिटी जवाब से पहले बनती या अपडेट होती हैं, इसलिए क्लाइंट उन्हें तुरंत माँग सकता है।

खोजे गए डिवाइस का टैग जिसे किसी ने स्वीकार नहीं किया, सक्रिय नहीं किया जा सकता: `400`, "accept the device first"। देखें [MQTT डिस्कवरी](/hi/iot/mqtt-discovery/#कमांड)।

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, या `404`। इतिहास रहता है। टैग की एंटिटी अनाथ हो जाती हैं (देखें [एंटिटी](/hi/iot/entities/#deleted-tags-orphans-and-re-adoption))।

## मान, बोर्ड और राइट

### `GET /api/values`

हर टैग की नवीनतम रीडिंग, मेमोरी से। `?device=` इसे एक डिवाइस तक सीमित करता है।

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

यह रूप EmberNet डैशबोर्ड का `TagValue` है और एक अनुबंध है। `quality` `good`, `uncertain` या `bad` है; **खराब रीडिंग का मतलब है कि मान ज्ञात नहीं है, यह नहीं कि वह शून्य है**। स्ट्रिंग रीडिंग `stringVal` लेकर चलती है, और उसका `tagValue` कोई मायने नहीं रखता।

जो रीडिंग अच्छी नहीं है वह `reason` लेकर चलती है जब ड्राइवर जानता है कि क्यों, ताकि स्क्रीन "खराब" से ज़्यादा कह सके:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

अच्छी रीडिंग में यह कभी नहीं होता, इसलिए ऊपर का अनुबंध बाइट-दर-बाइट वैसा ही है जैसा था। हिस्टोरियन इसे नहीं रखता: `/api/history` में गुणवत्ता है, कारण नहीं।

### `GET /api/sparkline`

मेमोरी में रखी एक टैग की आख़िरी रीडिंग (`HOTLOOP_RING_SIZE`, डिफ़ॉल्ट 30), छोटे चार्ट के लिए। `?tag=device/tag`, ज़रूरी।

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` Unix मिलीसेकंड हैं। बिना रीडिंग वाले टैग के लिए दोनों `[]` हैं। गलत बनावट की कुंजी के लिए `400`।

### `GET /api/board`

कौन-से टैग बोर्ड पर पिन हैं, और कितने कॉलम में। यह डेटाबेस में सहेजा जाता है, ब्राउज़र में नहीं, क्योंकि बोर्ड प्लांट का होता है: फ़्लोर पर पैनल PC और ऑफ़िस का लैपटॉप एक ही बोर्ड दिखाते हैं।

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` बोर्ड को वैसे नाम देता है जैसा वह सहेजा है। इसे सहेजने के साथ वापस भेजें और अगर बोर्ड तब से बदल गया हो तो सहेजना ठुकरा दिया जाता है (नीचे)।

### `PUT /api/board`

वही रूप। 1 से 4 के बाहर के `columns` 3 हो जाते हैं; डुप्लिकेट हटा दिए जाते हैं। `rev` वैकल्पिक है: आपने जो बोर्ड पढ़ा उसके `rev` के साथ, तब से बदल चुके बोर्ड पर सहेजना `409` है और कुछ नहीं बदलता, इसलिए जिस पेज ने कभी बोर्ड नहीं पढ़ा, या पुराना पढ़ा, वह प्लांट के बोर्ड को अपनी कॉपी से नहीं बदल सकता। इसे छोड़ दें तो सहेजना जाँचा नहीं जाता, जो उस क्लाइंट के लिए ठीक है जो हर बार पूरा बोर्ड सेट करता है। वेब UI शुरू होते समय बोर्ड पढ़ता है और हर सहेजने के साथ `rev` भेजता है। हर टैग मौजूद होना चाहिए (जो नहीं है उसका नाम लेकर `404`): पुरानी प्रविष्टि ऐसा गेज है जो कभी नहीं हिलता। सहेजा हुआ बोर्ड लौटाता है। ऑपरेटर के पास `board.write` है: बोर्ड सजाना प्लांट चलाना है, उसे कॉन्फ़िगर करना नहीं।

### `POST /api/write`

राइट गेट के ज़रिए एक टैग पर एक मान लिखता है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `tag` | string | ज़रूरी। `device/tag` |
| `value` | bool, number or string | ज़रूरी। `true` bool है, `42` पूर्णांक, `42.5` फ़्लोट, `"42"` स्ट्रिंग: JSON प्रकार ही लिखा जाने वाला प्रकार है, क्योंकि तार पर कॉइल, वर्ड और रियल तीन अलग चीज़ें हैं |
| `reason` | string | वैकल्पिक। राइट के साथ लॉग होता है |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**मान टैग की इकाइयों में होता है, रीडिंग की तरह।** स्केल या ऑफ़सेट वाले टैग पर, जो आप भेजते हैं वही है जो टैग वापस पढ़ेगा, और HotLoop डिवाइस को वह काउंट भेजता है जो उसे देता है: 0.1 स्केल वाले रजिस्टर में 55.5 लिखने पर रजिस्टर में 555 जाता है। (4.18 तक, संख्या जैसी थी वैसी डिवाइस को जाती थी, इसलिए 55.5 बनता था 55 और वापस 5.5 पढ़ा जाता था।) सीमा जाँच और ऑडिट पंक्ति आपकी संख्या इस्तेमाल करती हैं, टैग की इकाइयों में। जो काउंट उसके बाद रजिस्टर में नहीं समाता, जैसे 0.1 स्केल वाले `uint16` पर 7000, वह काउंट और रजिस्टर का नाम लेकर ठुकराया जाता है, और कुछ नहीं भेजा जाता। काउंट का भिन्न हिस्सा काट दिया जाता है, जैसा पूर्ण-काउंट रजिस्टर हमेशा करता आया है: दसवें हिस्से के स्केल वाले रजिस्टर पर 12.34 में 12.3 रहता है।

गेट क्रम से जाँचता है कि राइट चालू हैं (`HOTLOOP_ALLOW_WRITES`), टैग सक्रिय है, और मान सीमा में है। हर कोशिश, ठुकराई गई हो या नहीं, `GET /api/writes` में है।

| स्टेटस | कब |
|---|---|
| 400 | कोई मान नहीं, `null` मान, गलत बनावट की कुंजी |
| 403 | राइट बंद हैं, या `"tank-farm/level: this tag is not marked writable"` |
| 404 | ऐसा कोई टैग नहीं |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | डिवाइस जुड़ा नहीं है |

## इतिहास और ऑडिट

### `GET /api/history`

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `tag` | ज़रूरी, दोहराने योग्य, 50 तक: `?tag=a/x&tag=b/y` |
| `minutes` | अभी से कितना पीछे। डिफ़ॉल्ट 60 |
| `bucket` | सेकंड में बकेट का आकार। डिफ़ॉल्ट: इस तरह चुना जाता है कि विंडो में लगभग 400 बकेट हों, 1 s से 1 दिन की सीढ़ी पर |
| `raw` | बकेट की जगह रीडिंग खुद के लिए `true` |
| `limit` | डिफ़ॉल्ट 5000, अधिकतम 100000 |
| `carry` | `true` यह भी बताने के लिए कि विंडो शुरू होने पर हर टैग क्या रखे था (केवल बकेट) |

बकेट में, हर टैग के लिए सबसे पुराना पहले। `badCount` बताता है कि बकेट में कितनी रीडिंग अच्छी गुणवत्ता की नहीं थीं; वे गिनी जाती हैं, औसत में नहीं जोड़ी जातीं। `from` और `to` वह विंडो हैं जिसके लिए जवाब है, ठीक `minutes` के अंतर पर और उस समय समाप्त जब सवाल पूछा गया:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

हिस्टोरियन रीडिंग तब रखता है जब कोई मान अपने डेडबैंड से आगे बढ़े, हर पोल पर नहीं, इसलिए जो टैग स्थिर रहा उसके लिए विंडो में खींचने को कुछ नहीं होता। `carry=true` के साथ जवाब में `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]` भी होता है: `from` से पहले की आख़िरी रीडिंग, हर उस टैग के लिए जिसकी उससे पहले की आख़िरी रीडिंग अच्छी थी और जिसमें संख्या थी। जिस टैग की आख़िरी रीडिंग खराब या अनिश्चित थी, जिसकी पहले की कोई रीडिंग नहीं है, या जो टेक्स्ट है, उसकी कोई प्रविष्टि नहीं होती, क्योंकि वह क्या रखे था यह ज्ञात नहीं और हम चार्ट को अंदाज़ा नहीं थमाएँगे। ट्रेंड कार्ड इसी से खींचता है।

रॉ, नए पहले:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`tag` के बिना, 50 से ज़्यादा के साथ, या गलत बनावट की कुंजी के लिए `400`।

### `GET /api/writes`

राइट ऑडिट, नए पहले। हर कोशिश यहाँ है, ठुकराई गई समेत, क्योंकि "हमें नहीं पता कि वह कमांड गई या नहीं" वह सबसे बुरा जवाब है जो कोई प्लांट पा सकता है।

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `tag` | एक टैग, `device/tag` |
| `device` | एक डिवाइस के हर टैग (`tag` सेट हो तो अनदेखा) |
| `entity` | हर वह राइट जो इस एंटिटी पर सर्विस कॉल ने किया या जिसे ठुकराया गया, ऊपर वालों की जगह |
| `call` | एक कॉल के हर राइट, ऊपर के सबकी जगह: बटन का दबाना और छोड़ना, या रेसिपी लागू करने का हर लक्ष्य, जो उसका `call_id` साझा करते हैं |
| `limit` | डिफ़ॉल्ट 100, अधिकतम 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` `ui`, `api`, `automation` या `mcp` है। `entityId`, `service` और `callId` केवल उन राइट पर होते हैं जो सर्विस कॉल ने किए।

## एंटिटी और स्टेट

हर टैग को एंटिटी मिलती हैं, बिना किसी के माँगे; कंपोज़िट (मोटर, वाल्व, लूप, काउंटर, सेलेक्ट, बटन, मौसम स्टेशन) एडमिन टैग से बनाता है। snake_case में, हर एंटिटी एंडपॉइंट की तरह। पूरा मॉडल [एंटिटी](/hi/iot/entities/) में है।

### `GET /api/entities`

हर एंटिटी, अनाथ समेत।

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | एक डिवाइस की एंटिटी |
| `orphaned` | केवल अनाथ के लिए `true`, किसी के लिए नहीं तो `false` |
| `q`, `limit` | खोज: एंटिटी id, नाम या डिवाइस id का सबस्ट्रिंग, केस की परवाह किए बिना, और उनमें से अधिकतम `limit` (1 से 5000, बाक़ी कुछ भी `400`, कभी चुपचाप नहीं काटा जाता) एंटिटी id के क्रम में। `X-Total-Count` बताता है कि कितनी मेल खाईं। छोड़ने पर पूरी सूची मिलती है |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

`POST /api/entities` क्या बना सकता है: हर डोमेन, वे भूमिकाएँ जिनसे उसके टैग जुड़ते हैं, और वे सर्विस जो वह लेता है। भूमिका बताती है कि वह किस `kind` के टैग की है, `required` है या नहीं, कोई सर्विस उसे लिखती है या नहीं (`command`), और स्टेट उससे पढ़ी जाती है या नहीं (`feedback`)। मौसम स्टेशन कोई सर्विस नहीं लेता।

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`। बंद की गई एंटिटी के लिए `state` `null` है। अज्ञात के लिए `404`।

### `GET /api/entities/{entity_id}/image`

कैमरे या इमेज की नवीनतम तस्वीर, उन बाइट के रूप में जो HotLoop रखता है: `Content-Type` वही है जो वे हैं (`image/jpeg`, `image/png`, `image/gif` या `image/webp`), साथ में `X-Content-Type-Options: nosniff`, अलग-थलग करने वाली `Content-Security-Policy` और `ETag` (`If-None-Match` को `304` मिलता है)। ऐसी एंटिटी के लिए जो यह नहीं है, या तस्वीर आने से पहले `404`। स्टेट का `entity_picture` एट्रिब्यूट यही पाथ है जिस पर तस्वीर का हैश लगा है।

### `PUT /api/entities/{entity_id}`

केवल वही फ़ील्ड बदलता है जो आप भेजते हैं। केवल एडमिन के लिए: entity_id वह नाम है जिससे हर ऑटोमेशन, डैशबोर्ड और एजेंट उसे पुकारता है, और उसे बदलना कॉन्फ़िगरेशन है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `entity_id` | string | नाम बदलना। `unique_id` नहीं हिलता |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | डोमेन के अनुसार; देखें [एंटिटी](/hi/iot/entities/#api) |
| `disabled`, `hidden` | bool | बंद की गई एंटिटी की कोई स्टेट नहीं होती और उसे कमांड नहीं दिया जा सकता |
| `equipment_id` | int or null | उसे ट्री पर रखता है; `null` फिर से उसके डिवाइस का अनुसरण करता है |
| `labels` | string[] | पूरा सेट |

`unique_id`, `domain`, `platform`, डिवाइस और बाइंडिंग यहाँ नहीं बदले जा सकते, और उन्हें भेजना 400 है।

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` बताता है जब कुछ वैध है पर अजीब (ऐसी इकाई जो डिवाइस क्लास में आम तौर पर नहीं होती)। खाली बॉडी (`"the update names no field to change"`) या खराब मान के लिए `400`, अज्ञात एंटिटी के लिए `404`, लिए जा चुके entity_id के लिए `409`।

### `POST /api/entities`

कंपोज़िट बनाता है। बॉडी डोमेन का नाम बताती है और टैग को उसकी भूमिकाओं से बाँधती है:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

साथ में `entity_id` (नहीं तो नाम से बनता है), `device_class`, `unit_of_measurement`, `icon`, `entity_category` और `options`। हर डोमेन कौन-सी भूमिकाएँ और विकल्प लेता है, यह [एंटिटी](/hi/iot/entities/#composite-equipment) में है। `201` `{"entity": {...}, "warnings": [...]}` लौटाता है। जो डोमेन यहाँ नहीं बनता (`sensor` अपने टैग से आता है, `alarm` अपनी परिभाषा से), जो भूमिका गायब है या जिसे कोई टैग भर नहीं सकता, उसके लिए `400`, लिए जा चुके entity_id के लिए `409`।

### `DELETE /api/entities/{entity_id}`

कंपोज़िट हटाता है, या ऐसी अनाथ जिसका टैग या अलार्म परिभाषा चली गई। `{"deleted":"motor.transfer_pump","entity":{...}}`। बाक़ी हर कोई `409` देती है, यह बताते हुए कि वह कैसे जाती है:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

हर चालू एंटिटी की स्टेट, entity_id के क्रम में। `?domain=` छानता है।

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` हमेशा स्ट्रिंग होती है, संख्या के लिए भी; `unknown` और `unavailable` वही मतलब रखते हैं जो वे कहते हैं। `last_reported` उसके पीछे की रीडिंग का डिवाइस का टाइमस्टैम्प है।

### `GET /api/states/{entity_id}`

एक स्टेट। अज्ञात एंटिटी के लिए `404`, और बंद की गई के लिए अलग `404`, जो बताता है कि उसे कैसे चालू करें: बंद की गई एंटिटी गायब नहीं है, और उसे गायब बताना किसी को टाइपिंग की गलती ढूँढने भेज देता है।

## ऊर्जा

प्लांट क्या इस्तेमाल करता है और उसकी लागत क्या है: किलोवाट घंटे, गैस, पानी, संपीड़ित हवा, और बनी एक इकाई की लागत। मीटर वह टैग है जिसे इस्तेमाल की मात्रा के रूप में पढ़ा जाता है। पूरा मॉडल, टैरिफ और स्क्रीन क्या करती है, यह [ऊर्जा](/hi/iot/energy/) में है। पढ़ना `energy.read` है, जो हर भूमिका के पास है; मीटर या टैरिफ बनाना या बदलना `energy.write` है, एडमिन का।

### `GET /api/energy/meters`

हर मीटर, प्रकार और फिर नाम के हिसाब से, हर एक के साथ कि वह कैसे पढ़ा जा रहा है और आज उसने कितना इस्तेमाल किया।

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` `ok`, `waiting` (टैग से अभी कुछ पढ़ा नहीं गया), `bad` (टैग की रीडिंग अच्छी नहीं है, और `reason` बताता है क्यों) या `disabled` है।

### `POST /api/energy/meters`

मीटर बनाता है। `id` छोटे अक्षर, अंक, `-` और `_` है। `kind` `electricity`, `gas`, `water`, `air`, `heat` या `production` है। `mode` `counter` (संचयी टैग: इस्तेमाल हुआ वह है जितना वह खिसका, गुणा `factor`) या `power` (दर: इस्तेमाल हुआ वह दर है जिस अवधि तक वह रही, `power_unit` `W`, `kW` या `MW` के साथ, और `unit` `Wh`, `kWh` या `MWh`) है। `source` टैग है। `tariff` प्रति इकाई एक स्थिर `price` है, वैकल्पिक `currency` के साथ, और समय-आधारित टैरिफ के लिए वैकल्पिक `bands` (पंद्रह मिनट पर `from` और `to`, `days`, `price`); उत्पादन मीटर में कोई नहीं होता। `Wh`, `kWh` या `MWh` वाले बिजली मीटर के टैरिफ में `demand_price` भी हो सकता है: किसी विंडो के उसके सबसे ऊँचे पंद्रह मिनट के एक किलोवाट की लागत। `enabled` छोड़ने पर `true` है। `{"meter": {...}, "warnings": []}` के साथ `201`। `400` बताता है कि क्या गलत है: टैग नहीं है या संख्या नहीं है, कोई बैंड पंद्रह मिनट पर नहीं है, फ़ैक्टर वाला पावर मीटर। लिए जा चुके id के लिए `409`।

### `GET /api/energy/meters/{id}`

एक मीटर, जैसा सूची दिखाती है। अज्ञात के लिए `404`।

### `PUT /api/energy/meters/{id}`

मीटर की परिभाषा बदलता है। जो वह पहले गिन चुका है वह रहता है, और उस कीमत के साथ जिस पर बना था। उसे दूसरे टैग या मोड की ओर मोड़ने पर यह भूल जाता है कि आख़िरी रीडिंग कहाँ रुकी थी, क्योंकि अगली रीडिंग किसी और चीज़ की है।

### `DELETE /api/energy/meters/{id}`

मीटर और जो कुछ उसने गिना उसे हटाता है। अज्ञात के लिए `404`।

### `GET /api/energy/summary`

एक विंडो में हर मीटर की खपत और लागत, और बनी एक इकाई की लागत। विंडो `?period=` है (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, या शिफ़्ट जो हाल ही में शुरू हुई उसके लिए `shift:06:00-14:00` और उससे पहले वाली के लिए `last_shift:06:00-14:00` लिखी जाती है; दिन, महीने और शिफ़्ट साइट के हैं) या RFC 3339 में `?from=&to=`, from शामिल और to शामिल नहीं, अधिकतम 400 दिन। `meters` उन मीटरों की अल्पविराम से अलग सूची है जिनकी लागत प्रति इकाई लागत में जाती है, और `per` उस एक उत्पादन मीटर का नाम बताता है जिससे भाग देना है।

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` अब तक की विंडो का वह हिस्सा है जिसे रीडिंग का समर्थन है। दो मुद्राओं की लागत कभी जोड़ी नहीं जाती, इसलिए हर एक के लिए `per_unit` पंक्ति है। `cost_per_unit` `null` है जब कुछ नहीं बना (`reason` `nothing_made` है) या जब कुछ बना और किसी कीमत वाले मीटर ने अभी तक कोई खपत नहीं गिनी (`nothing_counted`): यह जवाब नहीं है, शून्य नहीं है।

`demand_price` वाले मीटर की पंक्ति में `demand` होता है: `peak_kw` (विंडो का सबसे ऊँचा पंद्रह मिनट, उसके औसत किलोवाट के रूप में), `peak_at` (वह कब शुरू हुआ), `peak_covered_seconds` (उस पंद्रह मिनट का कितना पढ़ा गया; 900 से कम होने पर पीक कम आँका गया है) और `cost` (पीक गुणा कीमत)। पंक्ति का `cost` वही रहता है जो ऊर्जा की लागत थी; `costs` और `per_unit` में डिमांड चार्ज शामिल है।

### `GET /api/energy/summary/{period}`

सारांश जैसा ही, पाथ में दी गई एक नामित अवधि (या शिफ़्ट) पर। `meters` और `per` अब भी क्वेरी में जाते हैं।

### `GET /api/energy/series`

एक विंडो में एक मीटर की खपत, `?meter=<id>`, विंडो ऊपर की तरह, और `step`: `quarter` (अधिकतम 8 दिन), `hour` (डिफ़ॉल्ट), `day` या `month`। जिस चरण में कोई रीडिंग नहीं वह सूची में नहीं होता।

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

श्रृंखला जैसा ही, मीटर, नामित अवधि और चरण सब पाथ में, उस कॉलर के लिए जिसके पास देने को केवल पाथ है।

## सर्विस

### `POST /api/services/{domain}/{service}`

एक एंटिटी को कमांड देता है: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`। एक एंटिटी, एक सर्विस, एक कॉल। नीचे यह `POST /api/write` वाले उसी राइट गेट से गुज़रते टैग राइट के अलावा कुछ नहीं है।

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` ज़रूरी है और एक एंटिटी है, सूची नहीं; `reason` वैकल्पिक है; बाक़ी सब सर्विस का डेटा है (`value`, `option`, `position`, `mode`, `minutes`, `note`)। संख्याएँ वही प्रकार रखती हैं जिसमें टाइप की गई थीं। पाथ का डोमेन एंटिटी का होना चाहिए। हर सर्विस और उसका डेटा [एंटिटी](/hi/iot/entities/#what-each-domain-takes) में है।

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

हर राइट `written`, `not_sent` (डिवाइस तक पहुँचने से पहले ठुकराया गया), `failed` (गया और डिवाइस ने त्रुटि बताई, इसलिए ज्ञात नहीं कि असर हुआ या नहीं) या `skipped` (कॉल का पहले का कोई राइट सफल नहीं हुआ) होता है। जो राइट हो चुके उन्हें कभी वापस नहीं किया जाता। अलार्म एंटिटी की सर्विस कोई टैग नहीं लिखतीं और `alarm` के साथ जवाब देती हैं जैसा इंजन ने उसे छोड़ा। हेल्पर की सर्विस भी कोई टैग नहीं लिखतीं और उस `state` के साथ जवाब देती हैं जिसमें उन्होंने उसे छोड़ा:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

स्क्रिप्ट का `turn_on` उसे चलाता है, डेटा को उसके फ़ील्ड बनाकर, और उस `script_run` के साथ जवाब देता है जो उसने शुरू किया; उसके चरणों के राइट यहाँ नहीं, एक-एक करके `script:<id>` के रूप में ऑडिट होते हैं। `turn_off` उसकी हर रन रोकता है। देखें [स्क्रिप्ट](#स्क्रिप्ट)।

सीन का `turn_on` उसकी रेसिपी लागू करता है, डेटा के `params` और `version` के साथ, और पूरे `recipe_application` के साथ जवाब देता है और `writes` में उसके लक्ष्यों ने जो भी राइट किए, क्रम से। यह विफल होता है जब तक हर लक्ष्य पर नहीं लिखा गया। देखें [रेसिपी](#रेसिपी)।

विफल कॉल त्रुटि के स्टेटस और वही बॉडी, साथ में `error`, के साथ जवाब देती है, ताकि ठीक दिखे कि वह कहाँ रुकी:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| स्टेटस | कब |
|---|---|
| 400 | कोई `entity_id` नहीं, गलत डोमेन, अज्ञात सर्विस, ऐसा डेटा जो सर्विस नहीं लेती |
| 403 | अनुमति, या गेट ने नीति के आधार पर ठुकराया |
| 404 | ऐसी कोई एंटिटी नहीं |
| 409 | बिना ज्ञात स्टेट वाला टॉगल, सर्विस के लिए गलत स्थिति में उपकरण |
| 422 | ऐसा मान जो अपने गुण के आधार पर ठुकराया गया |
| 503 | डिवाइस जुड़ा नहीं है; अलार्म इंजन नहीं चल रहा |
| 500 | बटन का दबाना गया और उसका छोड़ना नहीं गया। **टैग अब भी दबाने वाला मान रखे हो सकता है**: उसे जाँचें और हाथ से छोड़ें |

**`?dry_run=true`** पूछता है कि कॉल क्या करेगी और उसमें से कुछ नहीं करता: कुछ लिखा, ऑडिट या लॉग नहीं होता। कॉल की योजना असली कॉल की तरह बनती है और हर राइट गेट की अपनी जाँचों से गुज़रता है, उसी क्रम में, अभी। फ़ैसला 200 देता है, ठुकराया गया हो या नहीं: हर राइट `would_write`, या पहला जो ठुकराया जाता वह कारण के साथ `not_sent` और बाक़ी `skipped`, और `error` वह त्रुटि है जिससे असली कॉल विफल होती, शब्द-दर-शब्द।

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

जिस अनुरोध को असली कॉल किसी भी जाँच से पहले लौटा देती (ऐसी कोई एंटिटी नहीं, अज्ञात सर्विस, ऐसा डेटा जो सर्विस नहीं लेती, बिना ज्ञात स्टेट वाला टॉगल) वह असली कॉल के स्टेटस और त्रुटि के साथ जवाब देता है; अनुमति न होने पर भी यही। `dry_run` `true` या `false` है और कुछ नहीं: `yes` 400 है, अंदाज़ा नहीं, क्योंकि गलत अंदाज़ा सवाल को कमांड बना देता है। देखें [एंटिटी](/hi/iot/entities/#asking-first-the-dry-run)।

**अनुमति हैंडलर में क्यों जाँची जाती है।** इसे `values.write` चाहिए, जैसे टैग को सीधे लिखने के लिए, क्योंकि यह बस वही है; `alarm` एंटिटी की सर्विस को इसके बजाय `alarms.ack` चाहिए, जैसे अलार्म स्क्रीन को, हेल्पर की सर्विस को `helpers.write`, जो ऑपरेटर के पास है, स्क्रिप्ट की सर्विस को `scripts.run`, जैसे `POST /api/scripts/{id}/run` को, और सीन की सर्विस को `recipes.apply` और रेसिपी की अपनी अनुमति जब वह कोई बताती हो, जैसे `POST /api/recipes/{id}/apply` को। जाँच हैंडलर के सामने नहीं, उसके अंदर की जाती है ताकि इसके अभाव में हुआ इनकार राइट गेट तक जाए और हर दूसरे इनकार की तरह, माँगे गए मान के साथ, **एंटिटी के विरुद्ध ऑडिट** हो। अनुमति के बिना उपयोगकर्ता को 403 और `GET /api/writes?entity=...` में एक पंक्ति मिलती है, 403 और कुछ नहीं नहीं। हेल्पर कोई टैग नहीं लिखता, इसलिए हेल्पर का इनकार, यह वाला भी, इसके बजाय हेल्पर के विरुद्ध सिस्टम लॉग (`GET /api/events`) में चेतावनी है, और स्क्रिप्ट का भी। सीन का इनकार रेसिपी के इतिहास में उपयोगकर्ता के साथ एक ठुकराया गया एप्लिकेशन है।

## हेल्पर

वे मान जो प्लांट के लोगों के होते हैं, किसी PLC के नहीं: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` और `schedule`। हेल्पर एक एंटिटी है (प्लेटफ़ॉर्म `helper`) और `/api/entities` तथा `/api/states` में किसी भी अन्य एंटिटी की तरह दिखता है; ये रूट उसका कॉन्फ़िगरेशन हैं। उसका मान ऊपर की सेवाओं से, `helpers.write` के साथ, सेट होता है। हर डोमेन, विकल्प और सेवा [हेल्पर](/hi/iot/helpers/) में है।

### `GET /api/helpers`

हर हेल्पर, अपनी एंटिटी के फ़ील्ड और `value` के साथ, यानी उसके लिए सहेजी गई पंक्ति:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

हेल्पर को उसके शुरुआती मान के साथ बनाता है। केवल एडमिन के लिए।

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

`entity_id` (न दें तो नाम से बनता है) और `icon` भी। `201` `{"helper": {...}}` लौटाता है। ऐसे डोमेन के लिए `400` जो हेल्पर का नहीं है, ऐसे विकल्प के लिए जो डोमेन नहीं लेता, या ऐसे `initial` के लिए जिसे उसके अपने विकल्प ठुकरा देते; पहले से लिए जा चुके entity_id के लिए `409`।

### `GET /api/helpers/{entity_id}`

एक हेल्पर, सूची की तरह। अज्ञात एंटिटी या ऐसी एंटिटी के लिए `404` जो हेल्पर नहीं है।

### `PUT /api/helpers/{entity_id}`

उसका `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` या `labels` बदलता है, वही फ़ील्ड जो `PUT /api/entities/{entity_id}` में हैं। केवल एडमिन के लिए। ऐसे नए विकल्प जो उसके मौजूदा मान को अनुमति न देते (मान से नीचे सिकोड़ी गई सीमा, चुना हुआ विकल्प हटा दिया गया) `400` देते हैं: मान को फ़िट कराने के लिए कभी खिसकाया नहीं जाता। `{"helper": {...}, "warnings": []}` लौटाता है।

### `DELETE /api/helpers/{entity_id}`

हेल्पर और उसका मान हटाता है। केवल एडमिन के लिए। `{"deleted":"timer.purge"}`। `DELETE /api/entities/{entity_id}` हेल्पर को `409` के साथ मना कर देता है, जो यहीं की ओर इशारा करता है।

## उपकरण और लेबल

ISA-95 ट्री (उद्यम, साइट, क्षेत्र, लाइन, सेल, यूनिट, उपकरण) और मुक्त रूप के लेबल। snake_case में। हर भूमिका पढ़ सकती है; केवल एडमिन बदल सकता है, क्योंकि किसी नोड का नाम बदलने या उसे हटाकर कहीं और रखने से उसके नीचे हर डिवाइस की साइट, क्षेत्र और लाइन दोबारा लिखी जाती है। देखें [उपकरण ट्री और लेबल](/hi/iot/equipment/)।

### `GET /api/equipment`

हर नोड, id के क्रम में, हर एक अपने `path` के साथ, यानी रूट से नामों का क्रम। `?level=area` छानता है। `?q=` उन नोड को रखता है जिनके पाथ में वह टेक्स्ट है (बड़े-छोटे अक्षर का फ़र्क़ नहीं), `?limit=` (1 से 5000, बाकी कुछ भी `400`) उनमें से पहले कुछ को; दोनों में से किसी के साथ `X-Total-Count` बताता है कि कितने मेल खाए।

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` null या छोड़ा हुआ हो तो रूट बनता है। चाइल्ड का स्तर अपने पैरेंट से नीचे होना चाहिए (उपकरण किसी उपकरण के भीतर हो सकता है)। `{"equipment": {...}, "devices_rewritten": []}` लौटाता है। गलत स्तर या स्थान के लिए `400`, उसी स्तर और नाम वाले सहोदर के लिए `409`।

### `GET /api/equipment/{id}`

नोड, उसके ठीक नीचे के नोड, और उस पर सीधे रखे गए डिवाइस और एंटिटी:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

ऐसे id के लिए `400` जो धनात्मक संख्या नहीं है, अज्ञात के लिए `404`।

### `PUT /api/equipment/{id}`

`name`, `description`, `level`, `parent_id` में से कोई भी (`null` उसे रूट पर ले जाता है)। केवल भेजे गए फ़ील्ड बदलते हैं; खाली बॉडी 400 है। नोड लौटाता है और **हर वह डिवाइस जिसकी साइट, क्षेत्र या लाइन का टेक्स्ट इसके नतीजे में बदल गया**, क्योंकि पुराने क्लाइंट और MCP टूल वही टेक्स्ट पढ़ते हैं:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`। जब तक उसके नीचे या उस पर कुछ है तब तक `409`, और बताता है कि क्या है: किसी डिवाइस के नीचे से नोड हटा देना ऐसा फ़ैसला नहीं जो गलती से हो जाए।

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` ज़रूरी है; `label_id` (1 से 64 छोटे अक्षर, अंक और अंडरस्कोर) छोड़ा जाए तो नाम से बनता है, और उसके बाद कभी नहीं बदलता। `color`, `icon` (`mdi:...`) और `description` वैकल्पिक हैं। लेबल लौटाता है। पहले से लिए जा चुके नाम या id के लिए `409`।

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: लेबल और जो उसे लिए हुए है। अज्ञात के लिए `404`।

### `PUT /api/labels/{label_id}`

`name`, `color`, `icon` और `description` बदल देता है; छोड़ा गया फ़ील्ड खाली हो जाता है। बॉडी का `label_id` पाथ से मेल खाना चाहिए: वरना `400`, क्योंकि label_id कभी नहीं बदलता।

### `DELETE /api/labels/{label_id}`

उसे हर उस चीज़ से हटा देता है जो उसे लिए हुए है। `{"deleted":"critical"}`, या `404`।

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` किसी डिवाइस का पूरा सेट बदल देता है। `{"id":"tank-farm","labels":["critical"]}` लौटाता है। हर लेबल मौजूद होना चाहिए (जो नहीं हैं उनके नामों के साथ `400`), और डिवाइस भी (`404`)। लेबल जानबूझकर `POST /api/devices` का हिस्सा नहीं हैं: डिवाइस सहेजने वाला हर क्लाइंट पूरा डिवाइस उनके बिना भेजता है, और हर बार सहेजने पर उन्हें मिटा देता।

## अलार्म

ISA-18.2: बजना, स्वीकार किया जाना और सामान्य पर लौटना अलग-अलग बातें हैं, और लॉग बता सकता है कि इनमें से क्या हुआ।

### `GET /api/alarms`

हर परिभाषा, चालू अलार्म और सारांश। `?outstanding=true` सामान्य और म्यूट किए गए अलार्म छोड़ देता है।

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` `normal`, `unack-active`, `ack-active`, `rtn-unack` (किसी के स्वीकार करने से पहले सामान्य हो गया, और सूची में रखा जाता है ताकि रात 3 बजे का ट्रिप सुबह की शिफ़्ट के देखने से पहले गायब न हो जाए), `shelved` या `suppressed` होता है। `tripValue` वह रीडिंग है जिसने अलार्म बजाया, मौजूदा रीडिंग नहीं।

### `POST /api/alarms`

परिभाषा बनाता है या बदल देता है।

| फ़ील्ड | प्रकार | <span class="sr-only">विवरण</span> |
|---|---|---|
| `id`, `name` | string | ज़रूरी। `id` डिवाइस id के नियमों का पालन करता है |
| `deviceId`, `tagName` | string | ज़रूरी |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (`limit` सेकंड तक कोई रीडिंग नहीं), `roc` (प्रति सेकंड `limit` से ऊपर बदलाव की दर) |
| `limit` | number | |
| `priority` | int | 1 (गंभीर) से 4 (कम) |
| `enabled` | bool | छोड़ने पर `false` |
| `deadband` | number | अलार्म हटने से पहले मान को कितना पीछे आना होगा। डेडबैंड के बिना, सीमा पर टिका मान बार-बार झपकता है |
| `onDelaySec`, `offDelaySec` | int | अलार्म बजने से पहले शर्त कितनी देर टिकी रहे, या सामान्य पर लौटने से पहले कितनी देर हटी रहे |
| `message`, `description` | string | `message` में `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` और `{reason}` (रीडिंग खराब क्यों है, अच्छी होने पर खाली) आ सकते हैं |

`{value}` उसी तरह लिखा जाता है जैसे वैल्यू कार्ड लिखता है, इकाई समेत: पूर्णांक जैसे हैं वैसे, 1 से ऊपर दो दशमलव, 100 से ऊपर एक, 1 से नीचे चार, और एक करोड़ से ऊपर या 0.01 से नीचे वैज्ञानिक संकेतन (`8.20 pH`, `212.5 F`, `1.235e+7`)। हमने ऐसा इसलिए किया क्योंकि स्केल 0.1 वाले टैग में कच्चा मान 82 फ़्लोट के रूप में 8.200000000000001 होता है, और बैनर पहले वही दिखाता था। टेक्स्ट रीडिंग जैसी है वैसी बताई जाती है। टैग, राइट और ऑटोमेशन अब भी सटीक संख्या देखते हैं; केवल वाक्य पूर्णांकित होता है। `{limit}` वह सीमा है जो आपने टाइप की थी।

परिभाषा लौटाता है; जवाब से पहले इंजन फिर से लोड होता है और अलार्म की एंटिटी बन जाती है। सत्यापन विफल होने पर `400` (`"alarm x: priority must be 1-4, got 9"`)।

### `POST /api/alarms/import/codesys`

CODESYS IDE का Export Alarms जो फ़ाइल लिखता है (अलार्म समूह का एक्सपोर्ट, `.csv`) उसे रिक्वेस्ट बॉडी से पढ़ता है, ठीक वैसी जैसी IDE ने लिखी (बाइट ऑर्डर मार्क के साथ UTF-16) या UTF-8 में। `?deviceId=` PLC का डिवाइस है और ज़रूरी है। `?application=` उस एप्लिकेशन का नाम है जिसके नीचे उसके टैग हैं, छोड़ने पर `Application`: एक्सपोर्ट वेरिएबल को उसके GVL से नाम देता है (`GVL_Alarm.bPumpFault`) और टैग `Application.GVL_Alarm.bPumpFault` है। `?defaultPriority=` (1 से 4) उस अलार्म की प्राथमिकता है जिसकी क्लास Error, Warning या Info में से कोई नहीं है। `?apply=true` के बिना कुछ सहेजा नहीं जाता: जवाब बताता है कि क्या आता।

अलार्म स्क्रीन में यह CODESYS से इम्पोर्ट करें (केवल एडमिन) के रूप में है: डिवाइस चुनें, एप्लिकेशन का नाम दें, फ़ाइल चुनें, पूर्वावलोकन पढ़ें, फिर इम्पोर्ट करें।

`= TRUE` या `= FALSE` से तुलना वाले डिजिटल अलार्म `true` और `false` बन जाते हैं, `>` वाला UpperLimit `hi` बनता है, `<` वाला LowerLimit `lo` बनता है, Outside range अलार्म (`OutOfArea`, दोनों ऑपरेटर `<`) दो अलार्म बन जाता है, निचली सीमा पर एक `lo` और ऊपरी सीमा पर एक `hi`, संदेश और ऑन तथा ऑफ़ डिले (`T#5s` जैसा IEC समय) साथ आते हैं, और Error प्राथमिकता 2, Warning 3, Info 4 है। IDE जो कुछ और लिख सकता है वह पढ़ा नहीं जाता और अपनी पंक्ति और कारण के साथ `skipped` में लौटता है, क्योंकि CODESYS इस लेआउट का दस्तावेज़ नहीं देता और केवल वही पढ़ा जाता है जो किसी असली एक्सपोर्ट ने दिखाया है। इसमें IDE जो कुछ और देता है वह भी शामिल है: Inside the range (`ForbiddenArea`) केवल दो सीमाओं के बीच सही होता है और यहाँ अलार्म की एक ही सीमा है, Change की कोई दस्तावेज़ित अवधि नहीं है, और Event तथा Alarm (API) PLC प्रोग्राम से बजते हैं और उनके पास देखने के लिए कोई वेरिएबल नहीं है। `warnings` में वह सब आता है जो केवल आंशिक रूप से आया (अज्ञात क्लास, लैचिंग, ऊँची प्राथमिकता का अलार्म)।

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

अज्ञात डिवाइस के लिए `404`, ऐसी फ़ाइल के लिए `400` जो अलार्म समूह का एक्सपोर्ट नहीं है।

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`, या `404`।

### `POST /api/alarms/{id}/ack`

वैकल्पिक बॉडी `{"note": "checking the heater bands"}`। अलार्म को उसकी अभी की स्थिति में लौटाता है, `ackedBy` और `ackNote` के साथ। अज्ञात अलार्म के लिए `404`।

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, ज़रूरी और धनात्मक: अनिश्चित काल की चुप्पी दमन है, जो अलग चीज़ है और ऑपरेटर का काम नहीं है। अलार्म लौटाता है, `state` `shelved`, `shelvedUntil` और `shelvedBy` के साथ।

### `POST /api/alarms/{id}/unshelve`

कोई बॉडी नहीं। अलार्म को उस स्थिति में लौटाता है जो उसकी शर्त उसे देती है। अगर वह टाला नहीं गया था तो `409`।

### `GET /api/alarms/events`

अलार्म का ऑडिट ट्रेल, नया पहले। `?alarm=` एक परिभाषा, `?limit=` (डिफ़ॉल्ट 200, अधिकतम 5000)।

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` है `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` या `escalation-ended`। आख़िरी दो अलार्म एस्केलेशन लिखता है (`actor` है `escalation`), और उनका `note` बताता है कि किसे सूचित किया गया और श्रृंखला क्यों रुकी। देखें [अलार्म सूचनाएँ](/hi/iot/notifications/#escalation)।

## ऑटोमेशन

ट्रिगर, एक शर्त, कार्रवाइयाँ। नियमों की भाषा [ऑटोमेशन](/hi/iot/automations/) में है।

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` बताता है कि कौन से नियम सचमुच चल रहे हैं, जो `enabled` जैसा नहीं है: जो नियम चालू है पर कंपाइल होना बंद हो गया, वह armed नहीं है, और यह पता यहीं चलता है।

### `POST /api/automations`

नियम बनाता या बदलता है: `id`, `name`, `description`, `enabled`, `triggers` (कम से कम एक), `condition`, `actions` (कम से कम एक), `mode` (`skip` डिफ़ॉल्ट, `queue`, `restart` या `parallel`), `minIntervalSec`, `maxRuntimeSec`। नियम सहेजने से पहले कंपाइल होता है, और जो कंपाइल नहीं होता वह 400 देता है और डेटाबेस तक कभी नहीं पहुँचता: सहेजा हुआ ऐसा नियम जो armed नहीं हो सकता, वह ऐसा नियम है जिसे उसका लेखक चलता हुआ मानता है।

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

नियम को सहेजे बिना कंपाइल करता है, एडिटर की लाइव जाँच के लिए। हमेशा `200`; उत्तर बताता है कि वह कंपाइल हुआ या नहीं:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

इसके लिए `automations.write` चाहिए, क्योंकि यह किसी को नियम लिखने में मदद करने के लिए है।

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`, या `404`।

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` उसे हटाए बिना निष्क्रिय करता है। `{"enabled":false,"id":"fill-tank"}` लौटाता है, या `404`।

### `POST /api/automations/{id}/trigger`

उसे अभी चलाता है, जैसे कोई ट्रिगर चला हो। शर्त अब भी लागू रहती है (गलत शर्त `skipped` रन दर्ज करती है) और रन मोड भी; `minIntervalSec` लागू नहीं होता, क्योंकि रन माँगने वाला व्यक्ति थरथराता टैग नहीं है। कोई बॉडी नहीं। `202` `{"triggered":"fill-tank"}`: रन पृष्ठभूमि में होता है, और नतीजा `GET /api/runs` में है। अगर नियम armed नहीं है तो `400`। ऑपरेटर के पास `automations.trigger` है; किसी और का लिखा नियम चलाना संचालन है, नियम लिखना नहीं।

### `GET /api/runs`

रन का इतिहास, नया पहले। `?automation=` एक नियम, `?limit=` (डिफ़ॉल्ट 100, अधिकतम 1000)। जब कोई न हो तो `[]`।

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` है `running`, `succeeded`, `failed`, `skipped`, `timed_out` या `cancelled`। चरण टेम्पलेट नहीं, हल किए हुए इनपुट रखते हैं, क्योंकि रात के 3 बजे यही पढ़ना पड़ता है।

ब्लूप्रिंट से बने नियम में `GET /api/automations` में तीन और फ़ील्ड होते हैं: `blueprintId`, `blueprintVersion` (वह संस्करण जिससे वह बना, और जिस पर वह रहता है) और `blueprintInputs`। हाथ से लिखे नियम में इनमें से कोई नहीं होता। ये सर्वर के हैं: `POST /api/automations` इन्हें स्वीकार करके अनदेखा करता है, और हाथ से किया गया संपादन वही रखता है जो नियम में था।

### `POST /api/automations/{id}/blueprint-upgrade`

ब्लूप्रिंट से बने नियम को ब्लूप्रिंट के नवीनतम संस्करण पर ले जाता है, उसकी id, नाम और armed होने की स्थिति को बनाए रखते हुए। यह कभी अपने आप नहीं होता। ऑपरेटर के पास `blueprints.apply` है, ठीक वैसे ही जैसे नियम बनाने के लिए। पहले देखें: **`?dry_run=true`** कुछ नहीं बदलता और बताता है कि हिस्सा-दर-हिस्सा क्या बदलेगा, और अगर नियम अभी चलता तो क्या करता, हर राइट राइट गेट की जाँचों से गुज़रता हुआ:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

नियम बनने के बाद हाथ से किया गया संपादन `changes` में बदले जाने वाले के रूप में दिखता है। जब नया संस्करण ऐसा इनपुट माँगे जिसका नियम में कोई मान नहीं है, या नियम जिस मान से बना था उसे ठुकराए, तो ड्राई रन `error` में यही बताता है और कुछ नहीं।

असली रन `{"version": 2}` लेता है, वह संस्करण जो ड्राई रन ने दिखाया, और नए संस्करण को जो चाहिए उसके लिए `inputs`। जो ब्लूप्रिंट तब से आगे बढ़ गया, या जो नियम इस बीच किसी ने अपग्रेड कर दिया, वह `409` देता है: जो जाँचा गया वही लागू होता है, या कुछ नहीं। कोई इनपुट छूटे तो `400`। उसी रूप के साथ `200`, जहाँ `automation` सहेजा हुआ नियम है। यह `automation upgraded from blueprint pump_watch version 1 to 2` के रूप में लॉग होता है। उसी संस्करण और नए `inputs` के साथ, नियम के इनपुट इसी तरह बदले जाते हैं। हाथ से लिखे नियम के लिए `400`; अगर जिस ब्लूप्रिंट से वह आया वह अब नहीं है तो `404`।

## स्क्रिप्ट

नाम वाली कार्रवाइयों की शृंखलाएँ, माँग पर चलती हैं: यहाँ से, किसी नियम के `call_script` चरण से, MCP के `run_script` से, या स्क्रिप्ट की एंटिटी (`script.turn_on`) के ज़रिए। यह शृंखला ही ऑटोमेशन की भाषा है। चरण का हर राइट `script:<id>` के रूप में राइट गेट से गुज़रता है, उस व्यक्ति के स्रोत के साथ जिसने उसे शुरू किया। सब कुछ [स्क्रिप्ट](/hi/iot/scripts/) में है।

### `GET /api/scripts`

हर स्क्रिप्ट, उसके रन काउंटर और अभी उसके कितने रन चल रहे हैं, किसी भी प्रोसेस में:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

एक बनाता है। केवल एडमिन। `id` (छोटे अक्षर, अंक और अंडरस्कोर, अक्षर से शुरू: यह एंटिटी की ऑब्जेक्ट id है, `script.<id>`), `name`, `description`, `icon`, `fields` (टाइप वाले इनपुट), `sequence` (कम से कम एक कार्रवाई), `mode` (`skip` डिफ़ॉल्ट, `queue`, `restart` या `parallel`) और `maxRuntimeSec`। यह नियम की तरह सहेजने से पहले कंपाइल होती है, और जो स्क्रिप्ट ख़ुद को बुलाएगी, सीधे या दूसरी स्क्रिप्टों के ज़रिए, वह ठुकरा दी जाती है। स्क्रिप्ट के साथ `201` लौटाता है। जो कंपाइल न हो उसके लिए `400`; जिस id का उपयोग हो चुका हो उसके लिए `409`।

### `POST /api/scripts/validate`

स्क्रिप्ट को सहेजे बिना जाँचता है, एडिटर की लाइव जाँच के लिए। `200` `{"valid":true}` या `{"valid":false,"error":"..."}`, उन्हीं शब्दों में जिनसे सहेजना ठुकराया जाता।

### `GET /api/scripts/{id}`

एक स्क्रिप्ट, जैसी सूची में है। न हो तो `404`।

### `PUT /api/scripts/{id}`

उसकी परिभाषा बदलता है; बॉडी वही है जो बनाने के लिए है, और `id` छोड़ी जा सकती है। केवल एडमिन। जब उसके चरण, फ़ील्ड या मोड बदलते हैं तो चल रहे रन रद्द हो जाते हैं: वे पुरानी परिभाषा से शुरू हुए थे।

### `DELETE /api/scripts/{id}`

उसे और उसका रन इतिहास हटाता है, चल रहे रन रद्द करते हुए। केवल एडमिन। `{"deleted":"cip_cycle"}`। उसकी एंटिटी अनाथ हो जाती है, हटाई नहीं जाती।

### `POST /api/scripts/{id}/run`

उसे चलाता है। ऑपरेटर के पास `scripts.run` है।

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

बॉडी का हर फ़ील्ड वैकल्पिक है, और बॉडी भी। कुछ भी चलने से पहले फ़ील्ड स्क्रिप्ट के फ़ील्ड से जाँचे जाते हैं: सीमा से बाहर, अपने स्टेप से हटकर, विकल्पों में न होने वाला या ग़लत टाइप का मान `400` देता है, और फ़िट करने के लिए कभी खिसकाया नहीं जाता। रन शुरू होते ही `202` उसके साथ; `"wait":true` हो तो रन ख़त्म होने पर `200`, ट्रेस समेत।

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

व्यस्त होने पर `409`: पहले से चल रही है और उसका मोड `skip` है, या एक कतार में लगे रन के साथ चल रही है और उसका मोड `queue` है। कुछ नहीं चला, और इतिहास में एक `skipped` रन है जो कारण बताता है:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** पूछता है कि अभी रन क्या करता और उसमें से कुछ नहीं करता। फ़ील्ड उसी तरह जाँचे जाते हैं; फिर हर चरण को प्लांट के जैसा है वैसे ही देखा जाता है: हर राइट और सर्विस कॉल गेट की अपनी जाँचों से गुज़रता है, शर्त का मूल्यांकन होता है, वेरिएबल बाँधा जाता है। प्रतीक्षा, देरी और जो किसी उपकरण में नहीं लिखता वह सब `not_checked` है। पहला राइट जो ठुकराया जाता, वही इसे ख़त्म कर देता है, जैसे वह रन को ख़त्म करता, और `error` गेट के शब्दों में यह बताता है। फ़ैसले के साथ `200`, ठुकराया गया हो या नहीं:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

हर चरण का `verdict` है `would_write`, `refused`, `ends_here` (अभी गलत शर्त, या रुकना), `not_checked` या `ok`। जिस स्क्रिप्ट को वह बुलाता है उसका चरण कॉल के नीचे क्रमांकित होता है: `3.1`।

### `POST /api/scripts/{id}/stop`

उसके चल रहे सभी रन रद्द करता है, हर प्रोसेस में, जहाँ भी हों। `{"cancelled":1,"stopped":"cip_cycle"}`, जहाँ `cancelled` वे रन हैं जो इस प्रोसेस के पास थे। ऑपरेटर के पास `scripts.run` है: जो वे शुरू कर सकते हैं उसे रोकना शुरू करने का हिस्सा है।

### `GET /api/scripts/{id}/runs`

उसके रन, नया पहले, उनके ट्रेस के साथ। `?limit=` (डिफ़ॉल्ट 50, अधिकतम 1000)। `parent` वह है जिसने रन को बुलाया, जब किसी ने बुलाया हो: `automation_run:812`, `script_run:77`।

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## रेसिपी

मानों के ऐसे समूह जो एक साथ लागू होते हैं: किसी उत्पाद ग्रेड के सेटपॉइंट, एक चेंजओवर। हर समूह एक एंटिटी भी है, `scene.<id>`। रेसिपी कुछ भी बाहर जाने से पहले पूरी जाँची जाती है और किसी भी कारण से पूरी ठुकरा दी जाती है; उसके लक्ष्य फिर एक ही कॉल id के तहत क्रम से जाते हैं, जो पहला विफल होता है वह बाकी को रोक देता है, और कुछ भी पलटा नहीं जाता; लिखा गया हर मान डिवाइस से वापस पढ़ा जाता है। सब कुछ [रेसिपी](/hi/iot/recipes/) में है।

रेसिपी का नाम, विवरण, उपकरण नोड और अनुमति अपनी जगह पर बदल जाते हैं। वह जो लिखती है (`targets`, `params`, `precondition`, `verify_sec`) एक संस्करण है, और संस्करण कभी बदले नहीं जाते: नई सामग्री सहेजने पर अगला संस्करण सहेजा जाता है।

### `GET /api/recipes`

हर रेसिपी, उसके मौजूदा संस्करण की सामग्री और सबसे नए अनुप्रयोग के साथ:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

पूरे प्लांट की रेसिपी के लिए `equipment_id` `null` होता है।

### `POST /api/recipes`

एक बनाता है, संस्करण 1 के रूप में। केवल एडमिन। `id` (छोटे अक्षर, अंक और अंडरस्कोर, अक्षर से शुरू: यह एंटिटी की ऑब्जेक्ट id है, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, डिफ़ॉल्ट, या `recipes.apply.<name>`), `params` (टाइप वाले इनपुट), `precondition` (एक अभिव्यक्ति जो शुरू करने के लिए सही होनी चाहिए), `targets` (कम से कम एक, अधिकतम 200, हर एक में `entity_id`, `service` और `data` या `data_expressions`), `verify_sec` (1 से 600, डिफ़ॉल्ट 10) और `note`। एक लक्ष्य एक मान सेट करता है: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, उन डोमेन पर जो इन्हें लेते हैं। पल्स या स्टार्ट ठुकराया जाता है: वह स्क्रिप्ट का काम है। हर लक्ष्य की एंटिटी मौजूद होनी चाहिए और हर अभिव्यक्ति कंपाइल होनी चाहिए। रेसिपी के साथ `201`; किसी भी गड़बड़ी के लिए `400`, जिस id का उपयोग हो चुका हो उसके लिए `409`।

### `POST /api/recipes/capture`

एंटिटी अभी जो मान रखती हैं उनसे रेसिपी का मसौदा बनाता है, केवल एडमिन, और कुछ सहेजता नहीं:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

हर एक ऐसा लक्ष्य बनती है जो उसे उसके मौजूदा मान पर वापस सेट करे, दिए गए क्रम में; एक लूप उसका मोड और फिर उसका सेटपॉइंट बनता है। उत्तर बिना id और बिना नाम की रेसिपी है, एडिटर के लिए। जो एंटिटी मौजूद नहीं है, बंद है, अच्छे के अलावा किसी गुणवत्ता से पढ़ी जाती है, `unknown` या `unavailable` है, या ऐसी चीज़ नहीं है जिसे रेसिपी सेट करती हो, वह हर एक का नाम लेने वाला `400` देती है: ख़राब रीडिंग से बनी रेसिपी उस ख़राब रीडिंग को वापस लिख देती है।

### `GET /api/recipes/{id}`

एक रेसिपी, जैसी सूची में है। न हो तो `404`।

### `PUT /api/recipes/{id}`

उसे सहेजता है। केवल एडमिन। बॉडी वही रेसिपी है जो `GET` ने लौटाई, संपादित; उसकी `id` छोड़ी जा सकती है। `current_version` वह संस्करण है जिस पर संपादन किया गया: अगर तब से किसी ने दूसरा सहेजा है, तो सहेजना उनके संस्करण को चुपचाप बदलने के बजाय `409` देता है (`0` जाँच छोड़ देता है)। नई सामग्री अगला संस्करण बनती है, `note` कारण बताता है; केवल नाम, विवरण, उपकरण या अनुमति का बदलाव कोई संस्करण नहीं बनाता।

### `DELETE /api/recipes/{id}`

उसे उसके संस्करणों समेत हटाता है। केवल एडमिन। `{"deleted":"grade_a"}`। उसके अनुप्रयोग रखे जाते हैं, क्योंकि वही प्लांट को भेजा गया था, और उसकी एंटिटी अनाथ हो जाती है।

### `GET /api/recipes/{id}/versions`

हर संस्करण, नया पहले, हर एक ठीक वैसा जैसा सहेजा गया था, सहेजने वाले और नोट के साथ:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

एक संस्करण। अगर रेसिपी में ऐसा कोई संस्करण नहीं है तो `404`, `{version}` संख्या न हो तो `400`।

### `POST /api/recipes/{id}/validate`

क्या वह अभी लागू होती? ऑपरेटर के पास `recipes.apply` है। बॉडी एक अनुप्रयोग की है, और कुछ भी लिखा, दर्ज या लॉग नहीं किया जाता। हर वह जाँच की जाती है जो अनुप्रयोग लिखने से पहले करता है: पैरामीटर, रेसिपी की अपनी अनुमति, पूर्व-शर्त, डेटा अभिव्यक्तियाँ, क्या कोई दूसरा अनुप्रयोग उसकी किसी एंटिटी में लिख रहा है, और हर लक्ष्य राइट गेट की जाँचों से गुज़रता है। निर्णय के साथ `200`, `would_apply` या `refused`, और हर लक्ष्य का अपना: `would_write`, कारण सहित `refused`, या `not_sent`।

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

जो पैरामीटर वह नहीं लेती वे `400` देते हैं, जैसे असली अनुप्रयोग में देते।

### `POST /api/recipes/{id}/apply`

उसे लागू करता है। ऑपरेटर के पास `recipes.apply` है। जो रेसिपी अपनी अनुमति `recipes.apply.<name>` बताती है, उसे वह भी चाहिए, जो यहाँ रेसिपी के विरुद्ध जाँची जाती है; जिस उपयोगकर्ता के पास वह नहीं है उसे `403` मिलता है और इतिहास में उसके नाम के साथ एक ठुकराया गया अनुप्रयोग दर्ज होता है।

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

सब कुछ वैकल्पिक है, और बॉडी भी। `version` जानबूझकर पुराना संस्करण लागू करता है; छोड़ने पर मौजूदा। `resume` इस रेसिपी के किसी पिछले अनुप्रयोग की id है जो बीच में रुक गया था: उसके जो लक्ष्य नहीं लिखे गए वे उसके संस्करण और पैरामीटर के साथ नए अनुप्रयोग के रूप में जाते हैं, और `parent` बताता है कि वह किसे पूरा करता है।

यह तब उत्तर देता है जब हर मान लिखा और वापस पढ़ा जा चुका हो, जिसमें रेसिपी के `verify_sec` तक लग सकता है:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

एक लक्ष्य `written`, `failed` (गया और डिवाइस ने मना किया, या कुछ नहीं कहा), `not_sent`, `skipped` (उससे पहले का एक आगे नहीं गया) या `refused` (पूर्व-सत्यापन) होता है। लिखा गया लक्ष्य `verified` होता है जब डिवाइस ने भेजे जाने के बाद वही मान वापस पढ़ा जो उसे भेजा गया था, और `unconfirmed` जब उसने `verify_sec` के भीतर ऐसा नहीं किया: वह गया और हो सकता है उसने असर न किया हो। हर राइट अनुप्रयोग का `call_id` रखता है, इसलिए `GET /api/writes?call=<call_id>` सब देता है।

| स्थिति | कब |
|---|---|
| 200 | `applied`: हर लक्ष्य लिखा गया। हर एक का `verification` जाँचें |
| 400 | ऐसा पैरामीटर जो रेसिपी नहीं लेती, सीमा से बाहर या ग़लत टाइप का; ऐसा `resume` जिसमें लागू करने को कुछ बचा नहीं |
| 403 | रेसिपी की अपनी अनुमति। ठुकराए गए अनुप्रयोग के रूप में दर्ज |
| 404 | ऐसी कोई रेसिपी नहीं, या ऐसा कोई संस्करण नहीं |
| 409 | `refused`: शुरू न करने का कोई भी कारण, हर एक `error` में और उसके लक्ष्य पर। या कोई दूसरा अनुप्रयोग अभी उसकी किसी एंटिटी में लिख रहा है। कुछ नहीं लिखा गया |
| 502 | `partial` या `failed`: शुरू हुआ, और हर लक्ष्य बाहर नहीं गया। `targets` ठीक बताता है कौन से गए। कुछ भी पलटा नहीं जाता |

ग़लत बनी बॉडी के `400` या `404` को छोड़कर हर उत्तर अनुप्रयोग रखता है, और ड्राई रन को छोड़कर हर अनुप्रयोग `GET /api/recipes/{id}/applications` में है, ठुकराए गए समेत।

### `GET /api/recipes/{id}/applications`

उसके अनुप्रयोग, नया पहले, ठुकराए गए समेत। `?limit=` (डिफ़ॉल्ट 50, अधिकतम 1000)। `parent` वह है जिसने उसे लागू किया, जब किसी ने किया हो: `automation_run:812`, `script_run:77`, `application:41`। हटाई गई रेसिपी के अनुप्रयोग अब भी लौटाए जाते हैं।

## ब्लूप्रिंट

एक बार लिखा गया ऑटोमेशन जिसमें टाइप वाले खाली स्थान हैं, जिन्हें भरकर सामान्य नियम बनता है। नियम वही संस्करण रखता है जिससे वह बना; ब्लूप्रिंट बदलने से कोई नियम नहीं बदलता, और किसी को नए संस्करण पर ले जाना [एक अपग्रेड](#post-apiautomationsidblueprint-upgrade) है जो कोई माँगता है। नियम का हर राइट `automation:<id>` के रूप में राइट गेट से गुज़रता है। सब कुछ [ब्लूप्रिंट](/hi/iot/blueprints/) में है।

### `GET /api/blueprints`

हर ब्लूप्रिंट, बिल्ट-इन पहले, हर एक के साथ कि उससे कितने नियम बने:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` `builtin` (बाइनरी में आता है, केवल पढ़ने योग्य) या `user` है।

### `POST /api/blueprints`

एक लिखता है। केवल एडमिन। `id` (छोटे अक्षर, अंक और अंडरस्कोर, अक्षर से शुरू), `name`, `description`, `inputs` (टाइप वाले, स्क्रिप्ट के फ़ील्ड जैसे) और `template`: नियम, अपने `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` और `maxRuntimeSec` के साथ, और उसमें खाली स्थान। मान के रूप में `{"!input": "motor"}` इनपुट से बदल दिया जाता है; स्ट्रिंग में `${motor}` भी, लिटरल के रूप में जहाँ स्ट्रिंग एक अभिव्यक्ति है। इसे सहेजने से पहले जाँचा जाता है: हर खाली स्थान किसी इनपुट का नाम लेता है, हर इनपुट इस्तेमाल होता है, और नमूना मानों से भरने पर वह ऐसा नियम बनाता है जो कंपाइल हो। `version` 1 पर `201`। किसी भी गड़बड़ी के लिए `400`, जिस id का उपयोग हो चुका हो उसके लिए `409`, बिल्ट-इन वाले की id समेत।

### `GET /api/blueprints/{id}`

एक, जैसा सूची में है। न हो तो `404`।

### `PUT /api/blueprints/{id}`

उसकी परिभाषा बदलता है; बॉडी वही है जो एक लिखने के लिए है, और `id` छोड़ी जा सकती है। केवल एडमिन। `inputs` या `template` बदलने पर `version` एक बढ़ता है, नए नाम या विवरण पर नहीं। **उससे बना कोई नियम नहीं बदलता।** हर एक वही संस्करण रखता है जिससे वह बना, और `GET /api/automations` दिखाता है कि कौन सा। बिल्ट-इन `400` देता है: उसे अपनी id से कॉपी करें।

### `DELETE /api/blueprints/{id}`

केवल एडमिन। `{"deleted":"pump_watch"}`। जब तक उससे बना कोई नियम मौजूद है तब तक `409`, उनके नाम बताते हुए: पहले उन्हें हटाएँ। बिल्ट-इन `400` देता है।

### `POST /api/blueprints/{id}/instantiate`

उससे एक नियम बनाता है और उसे armed करता है। ऑपरेटर के पास `blueprints.apply` है: कौन सा पंप और कितनी देर, यह उनके चुनने की बात है, और नियम क्या करता है यह ब्लूप्रिंट लिखे जाते समय तय हुआ था।

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` डिफ़ॉल्ट रूप से ब्लूप्रिंट का नाम होता है और `enabled` `true`। कुछ भी बनने से पहले हर इनपुट जाँचा जाता है: सीमा से बाहर, अपने स्टेप से हटकर, विकल्पों में से न होने वाला, दूसरे डोमेन की एंटिटी या ग़लत टाइप का मान `400` देता है जो हर ग़लत का नाम लेता है, और फ़िट करने के लिए कभी खिसकाया नहीं जाता। जो `automationId` पहले से लिया हुआ है वह `409` देता है: नियम बनाना कभी किसी नियम को नहीं बदलता। नियम के साथ `201`, उसके `blueprintId`, `blueprintVersion` और `blueprintInputs` सेट होकर। यह `automation made from blueprint motor_running_too_long version 1` के रूप में लॉग होता है।

**`?dry_run=true`** कुछ नहीं बनाता। वह उस नियम का उत्तर देता है जो वह बनाता और वह नियम अभी चलता तो क्या करता: शर्त का मूल्यांकन, हर राइट और सर्विस कॉल `automation:<id>` के रूप में गेट की जाँचों से गुज़रता हुआ, पहला इनकार गेट के शब्दों में `check.error` में। कुछ भी सहेजा, लिखा या ऑडिट नहीं किया जाता।

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## डैशबोर्ड

कार्डों के पन्ने, उन भूमिकाओं और स्क्रीन के लिए जिन्हें उनकी ज़रूरत है। डैशबोर्ड कुछ भी आदेश नहीं देता: कार्ड एक टैग, एंटिटी, स्क्रिप्ट या रेसिपी का नाम लेता है, और उसका बटन दबाने वाले व्यक्ति के रूप में [`POST /api/write`](#post-apiwrite) से लिखता है। वॉल बोर्ड उनमें से एक है। सब कुछ [डैशबोर्ड](/hi/iot/dashboards/) में है।

### `GET /api/dashboards`

कॉल करने वाले को जो डैशबोर्ड पेश किए जाते हैं, उसी क्रम में जिसमें स्विचर उन्हें दिखाता है, वॉल बोर्ड समेत। जिसके पास `dashboards.write` है उसे सब पेश किए जाते हैं।

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

एक बनाता है। केवल एडमिन। `id` (छोटे अक्षर, अंक, हाइफ़न और अंडरस्कोर, अक्षर से शुरू), `name`, और वैकल्पिक `description`, `roles`, `homeFor`, `screens`, `position` और `cards`। `version` 1 पर `201`, हर कार्ड के आकार और कॉन्फ़िग के साथ उसी रूप में जिसमें वे सहेजे गए।

कार्ड `id`, `type`, `title`, `w` (1 से 12 कॉलम), `h` (1 से 8 पंक्तियाँ) और एक `config` है। प्रकार और उनके कॉन्फ़िग [डैशबोर्ड](/hi/iot/dashboards/#कार्ड) में हैं। इसे सहेजने से पहले जाँचा जाता है:

- कोई कॉन्फ़िग कुंजी जो प्रकार में नहीं है, सीमा से बाहर कोई संख्या, लॉगिन या टोकन वाला कैमरा या फ़्लोर-प्लान पता, या 60 से अधिक कार्ड `400` देते हैं;
- ऐसा कार्ड जो किसी ऐसे टैग, एंटिटी, स्क्रिप्ट या रेसिपी का नाम लेता है जो मौजूद नहीं, `400` देता है जो उसका नाम लेता है;
- ऐसे टैग पर `button` जो लिखने योग्य नहीं है, या टैग की सीमा से बाहर संख्या के साथ, `400` देता है: गेट हर प्रेस ठुकरा देता;
- ऐसी भूमिका जो मौजूद नहीं, `400` देती है;
- कोई `id` जो लिया हुआ है, कोई स्क्रीन जो दूसरे डैशबोर्ड के पास पहले से है, या किसी भूमिका का होम जो दूसरा डैशबोर्ड पहले से है, `409` देता है।

### `GET /api/dashboards/{id}`

एक, जैसा सूची में है। न हो तो `404`, और तब भी जब कॉल करने वाले को वह पेश न किया गया हो।

### `PUT /api/dashboards/{id}`

उसे बदलता है। केवल एडमिन। बॉडी वही डैशबोर्ड है जो `GET` ने लौटाया, `version` उस संस्करण पर सेट जिस पर वह पढ़ा गया: **यह अनिवार्य है**, और ऐसा सहेजना जो ऐसा संस्करण बताए जो अब मौजूदा नहीं, `409` देता है जो बताता है कि मौजूदा कौन सा है, क्योंकि विकल्प है आख़िरी सहेजने वाले ने जो अभी बनाया उसे चुपचाप मिटा देना। `id` बॉडी से छोड़ी जा सकती है, `kind` नहीं बदल सकता, और `createdAt`, `updatedAt` और `updatedBy` सर्वर के हैं और अनदेखे किए जाते हैं। अगले संस्करण के डैशबोर्ड के साथ `200`।

वॉल बोर्ड केवल अपने असाइनमेंट (`roles`, `homeFor`, `screens`, `position`) के लिए `PUT` लेता है और कुछ नहीं: उसमें कार्ड नहीं होते, इसलिए कार्ड वाला `400` देता है। उसके गेज बोर्ड के टैग हैं, `GET` और `PUT /api/board`।

### `DELETE /api/dashboards/{id}`

केवल एडमिन। `{"deleted":"line-2"}`। कार्ड चीज़ों की ओर इशारा करते हैं और किसी के मालिक नहीं हैं, इसलिए और कुछ नहीं छुआ जाता। वॉल बोर्ड `400` देता है: वह हमेशा रहता है।

बनाना, सहेजना और हटाना विषय `dashboard:<id>` पर `config` घटनाओं के रूप में लॉग होते हैं।

### `GET /api/dashboards/{id}/export`

डैशबोर्ड स्क्रीन फ़ाइल के रूप में: संस्करण वाला JSON दस्तावेज़ जिसे [`POST /api/dashboards/import`](#post-apidashboardsimport) दूसरे इंस्टॉल में लोड करता है। यह `<id>.hotloop-screen.json` नाम के अटैचमेंट के रूप में उत्तर देता है। कॉल करने वाले को `dashboards.read` चाहिए और डैशबोर्ड उसे पेश किया जाना चाहिए, जैसे एक के `GET` के लिए। वॉल बोर्ड `400` देता है: वह इंस्टॉल के पिन किए गेज हैं, लेआउट नहीं। फ़ॉर्मैट [स्क्रीन फ़ाइलें](/hi/iot/screen-file/) में है।

### `POST /api/dashboards/import`

स्क्रीन फ़ाइल पढ़ता है, उसे इस इंस्टॉल के विरुद्ध जाँचता है और नए डैशबोर्ड के रूप में सहेजता है। केवल एडमिन, और वह उसे नहीं सहेज सकता जिसे `POST /api/dashboards` ठुकराता। बॉडी फ़ाइल स्वयं है, या साथ में विकल्पों वाला `{"file": {...}}`:

| विकल्प | <span class="sr-only">विवरण</span> |
|---|---|
| `id`, `name` | किसी और id या नाम से सहेजें। |
| `replace` | अगर id लिया हुआ है, तो उस डैशबोर्ड को उसके मौजूदा संस्करण पर बदलकर सहेजें। इसके बिना लिया हुआ id `409` देता है। |
| `skipAssignments` | फ़ाइल के `screens` और `homeFor` छोड़ें, जो उस इंस्टॉल के हैं जिसने उसे बनाया। `roles` रहते हैं। |
| `remap` | यहाँ चीज़ों को क्या कहना है: `tags` (पूरी कुंजी से पूरी कुंजी, जैसे फ़ाइल टैग का नाम लेती है या जैसे वह `devices` के उसे हटाने के बाद पढ़ा जाता है), `devices` (id से id, जो `tags` में न बताए गए हर टैग का डिवाइस हिस्सा भी हटाता है), `entities`, `scripts`, `recipes` और `equipment` (id से id)। ऐसी प्रविष्टि जिसे स्क्रीन पर किसी ने इस्तेमाल नहीं किया, चेतावनी है। |
| `dryRun` | रिपोर्ट लौटाएँ और कुछ न सहेजें। हमेशा `200`। |
| `codesys`, `visualization` | `file` की जगह: CODESYS नेटिव एक्सपोर्ट का पाठ, और वह विज़ुअलाइज़ेशन जो कई होने पर लिया जाए। तब रिपोर्ट में `conversion` होता है जिसमें हर तत्व क्या बना और क्या छूट गया। देखें [CODESYS स्क्रीन आयात करें](/hi/iot/codesys-screen-import/)। |

उत्तर रिपोर्ट है, चाहे कुछ सहेजा गया हो या नहीं:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

हर छूटा हुआ संदर्भ सूचीबद्ध होता है, केवल पहला नहीं। `kind` है `file` (स्क्रीन फ़ाइल नहीं, ग़लत फ़ॉर्मैट, इस बिल्ड के पढ़ने से नया फ़ॉर्मैट संस्करण, या अपरिचित फ़ील्ड), `screen` (डैशबोर्ड के अपने नियम: ग़लत कार्ड, ऐसी भूमिका जो मौजूद नहीं, बहुत बड़ा), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (लिखने योग्य न होने वाले टैग पर बटन या सेटपॉइंट), `assignment` (स्क्रीन का नाम या भूमिका का होम जो दूसरा डैशबोर्ड रखता है) या `exists` (id लिया हुआ है)। किसी भी समस्या वाला आयात कुछ नहीं सहेजता: `400`, या `409` जब एकमात्र परेशानी `exists` या `assignment` हो, उसी रिपोर्ट के साथ। सफलता `201` है, या `200` जब उसने किसी को बदला, रिपोर्ट और सहेजे गए `dashboard` के साथ। यह विषय `dashboard:<id>` पर `config` घटना के रूप में लॉग होता है।

## वेबहुक

### `POST /api/webhook/{path}`

उस पाथ पर `webhook` ट्रिगर वाले हर ऑटोमेशन को चलाता है। **कोई सेशन नहीं और कोई अनुमति नहीं**: पाथ वह रहस्य है जो किसी तीसरे पक्ष को दिया जाता है, वही भरोसे का मॉडल जो इस एंडपॉइंट में हमेशा रहा है, और SCADA सिस्टम या SaaS कॉलबैक के पास लॉगिन करने का खाता नहीं होता। ऐसा पाथ चुनें जिसे कोई अंदाज़ा न लगा सके।

बॉडी, 1 MiB तक, नियम को सौंपी जाती है। `202` `{"accepted":"fill-now"}`। जब कोई नहीं सुन रहा तब `404` `"no automation is listening on this webhook path"`: कहीं न पहुँचने वाला वेबहुक चलते हुए वेबहुक जैसा ही दिखता है, इसलिए यह बताता है।

## फ़्लीट

पंजीकृत एज रिले, Sparkplug पर उनकी लाइव उपस्थिति, और उन्हें भेजे जाने वाले कमांड। `HOTLOOP_FLEET_ENABLED` चाहिए। देखें [फ़्लीट प्रबंधन](/hi/gateway/fleet/)।

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` NBIRTH और NDEATH से आता है। `release` वह बिल्ड है जो रिले ने अपने आख़िरी birth में चलता हुआ बताया: `version`, `imageDigest` (जब उसका सुपरवाइज़र बताए; Helm चार्ट नहीं बताता) और `since`, जब Gateway ने पहली बार वह बिल्ड सुना। जो रिले इतना पुराना है कि एक भी रिपोर्ट न कर सके, उसमें कोई नहीं होता। `statusUrl` वाले सदस्य के लिए `polled` सही होता है और `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` और `updateMode` (`auto` या `approve`) उसके `/status` से आते हैं; जब वह पहुँच में नहीं था तब इनका कोई अर्थ नहीं। सुविधा बंद होने पर: `{"members":[],"configured":false}`।

### `POST /api/fleet`

सदस्य बनाता या बदलता है: `id`, `name`, `group` और `nodeId` (उसकी Sparkplug पहचान) ज़रूरी; `description`, `statusUrl` (`http://` या `https://`) और `enabled` वैकल्पिक। सदस्य लौटाता है। यह सुविधा बंद होने पर भी काम करता है, ताकि फ़्लीट को चालू करने से पहले घोषित किया जा सके।

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, या `404`।

### `POST /api/fleet/{id}/rebirth`

रिले को `Node Control/Rebirth` प्रकाशित करता है। कोई बॉडी नहीं। `{"status":"rebirth requested"}`। अज्ञात सदस्य के लिए `404`।

### `POST /api/fleet/{id}/restart`

`Node Control/Reboot` प्रकाशित करता है। `{"status":"restart requested"}`। केवल एडमिन: रिले को रीस्टार्ट करने पर उसके लौटने तक उसका डेटा रुक जाता है।

### `POST /api/fleet/{id}/update`

रिले जिस इमेज अपडेट को रोके हुए है उसे मंज़ूर करता है। `Node Control/Update` प्रकाशित करता है। `{"status":"update approved"}`। केवल एडमिन: रिले बाहर निकलता है और उसका सुपरवाइज़र वह इमेज शुरू करता है जिसे वह फ़ॉलो करता है, इसलिए इसमें लगने वाले समय तक उसका डेटा रुकता है। यह केवल `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve` पर सेट रिले पर कुछ करता है; कोई और रिले लॉग करता है कि उसने इसे अनदेखा किया। अनुरोध किसी इमेज का नाम नहीं लेता: उसे रखने की कोई जगह नहीं है, और यही मक़सद है। देखें [Edge Relay संदर्भ](/hi/edge-relay/reference/#relay-अपडेट-करना)।

### `POST /api/fleet/{id}/config`

रिले को नई डिवाइस फ़ाइल भेजता है, जिसे वह लाइव लागू करता है: कोई रीस्टार्ट नहीं, उसका ब्रोकर सेशन और फ़ॉरवर्ड क्यू बने रहते हैं, और फ़ाइल ने जिन डिवाइस को नहीं बदला वे सब कनेक्टेड रहते हैं। बॉडी **डिवाइस फ़ाइल स्वयं** है, कच्चा JSON, किसी चीज़ में लपेटा हुआ नहीं। कुछ भी प्रकाशित होने से पहले उसे मान्य किया जाता है (नहीं तो `400` `"invalid device file: ..."`)। `{"status":"config pushed"}` का मतलब है कि ब्रोकर ने उसे ले लिया; रिले उसे चला रहा है या नहीं यह `GET /api/fleet` में उस सदस्य का `config.digest` बताता है, और जो फ़ाइल रिले ने ठुकराई वह वहाँ `config.rejected` के रूप में दिखती है। केवल एडमिन: यह बदलता है कि रिले क्या पोल करता है। देखें [फ़्लीट प्रबंधन](/hi/gateway/fleet/#कॉन्फ़िग-भेजना)।

### `DELETE /api/fleet/{id}/config`

पुश को वापस लेता है। ब्रोकर पर रखा गया कॉन्फ़िग साफ़ करता है ताकि बाद का कोई बूट उसे लागू न करे, और जो रिले अभी कनेक्टेड है वह अपनी पुश की हुई फ़ाइल छोड़कर लाइव अपनी लोकल डिवाइस फ़ाइल पर लौट जाता है। कोई बॉडी नहीं। `{"status":"config push cleared"}`, अज्ञात सदस्य के लिए `404`, Gateway के ब्रोकर से कनेक्ट न होने पर `503`। पुश करने की तरह केवल एडमिन। यह कुछ रीस्टार्ट नहीं करता। इसे तब भेजें जब रिले ऑनलाइन हो: ऑफ़लाइन रिले इसे कभी नहीं सुनता। देखें [Edge Relay संदर्भ](/hi/edge-relay/reference/#पुश-की-गई-फ़ाइल-कहाँ-रहती-है-और-कौन-सी-फ़ाइल-जीतती-है)।

## सूचनाएँ

अलार्म उठने पर फ़ोन को पेज करना, वेबहुक, SMTP, ntfy या Gotify से, और जब कोई उसे स्वीकार न करे तो अगले व्यक्ति को बताना। `HOTLOOP_NOTIFY_ENABLED` चाहिए।

### `POST /api/notify/test`

हर कॉन्फ़िगर किए गए चैनल से अभी एक कृत्रिम अलार्म सूचना भेजता है, ताकि असली अलार्म से पहले आपको पता चल जाए कि SMTP रिले आपको ठुकरा रहा है। कोई बॉडी नहीं। `HOTLOOP_NOTIFY_ENABLED` चाहिए। केवल एडमिन: यह असली संदेश भेजता है और प्रदाता जितना कोटा देता है उतना खर्च करता है।

```json
{"results":[{"channel":"smtp","success":true}]}
```

चाहे हर चैनल चला हो या नहीं, `200`; हर नतीजा बताता है। जो विफल हुआ उसमें `error` होता है। विफल वेबहुक अपनी स्कीम और होस्ट बताता है और कुछ नहीं, क्योंकि ज़्यादातर पेजिंग सेवाओं के लिए URL ही क्रेडेंशियल है। देखें [अलार्म सूचनाएँ](/hi/iot/notifications/)।

### `GET /api/notify/escalation`

अलार्म एस्केलेशन नीति, वे चैनल जिनका नाम कोई चरण ले सकता है, और अभी खुली शृंखलाएँ। जब `HOTLOOP_NOTIFY_ENABLED` सेट न हो तब `available` `false` होता है, नीति बंद और कोई चैनल नहीं; उत्तर फिर भी `200` है। पढ़ने और लिखने दोनों के लिए केवल एडमिन: नीति में लोगों के ntfy टॉपिक होते हैं, जो ऐसे सर्वर पर जहाँ कोई भी पहुँच सके, पासवर्ड जैसे हैं।

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` वे हैं जो इस HotLoop में कॉन्फ़िगर हैं, और कोई चरण इतना ही नाम ले सकता है। `active` हर वह अलार्म है जो शृंखला में आगे बढ़ाया जा रहा है: नीति में जितने भेजने हैं उनमें से कितने जा चुके (चरण, फिर दोहराव), और अगला कब देय है। अभी कुछ सहेजा न हो तो `{"policy":{"enabled":false},...}`: बंद, उसमें कुछ नहीं।

### `PUT /api/notify/escalation`

पूरी नीति बदलता है, पैच नहीं, और वही लौटाता है जो `GET` लौटाता। यह अब से उठने वाले अलार्म पर लागू होती है। सूचनाएँ सक्षम न हों तो `400`।

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` है `critical`, `high` (डिफ़ॉल्ट), `medium` या `low`। एक चरण अपने पहले वाले के `afterMinutes` (1 से 1440) बाद देय होता है, पहला अलार्म उठने के बाद, और सूची से `contacts`, तैनाती में मौजूद `channels`, या दोनों का नाम लेता है। अधिकतम 10 चरण, 50 संपर्क और 20 दोहराव। अपरिचित फ़ील्ड ठुकराए जाते हैं।

जब नीति काम नहीं कर सकती तब कारण के साथ `400`, ऐसे शब्दों में जिन पर कार्रवाई हो सके: ऐसा चरण जो किसी का नाम नहीं लेता, ऐसा संपर्क जो सूची में नहीं है, ऐसा चैनल जो इस HotLoop में कॉन्फ़िगर नहीं (उत्तर उन्हें गिनाता है जो हैं), ntfy कॉन्फ़िगर किए बिना ntfy टॉपिक या ईमेल कॉन्फ़िगर किए बिना पता, ऐसा पता जो सादा नहीं है, बिना अंतराल का दोहराव। ठुकराए जाने पर कुछ संग्रहीत नहीं होता। इसे सहेजना सिस्टम लॉग में है, टॉपिक के बिना। देखें [अलार्म सूचनाएँ](/hi/iot/notifications/#escalation)।

### `POST /api/notify/ack/{token}`

ntfy सूचना का **स्वीकार करें** बटन। जो फ़ोन इसे दबाता है उसके पास भेजने को कोई सेशन नहीं होता, इसलिए **कोई सेशन नहीं और कोई अनुमति नहीं**: पाथ में हस्ताक्षरित टोकन ही प्राधिकरण है, और वह केवल एक अलार्म की एक घटना को एक बार, समाप्त होने से पहले (`HOTLOOP_NOTIFY_ACK_TTL`, डिफ़ॉल्ट 12 घंटे) स्वीकार करने की अनुमति देता है। कल की यात्रा का बटन आज का अलार्म स्वीकार नहीं कर सकता। यह जानबूझकर `POST` है: लिंक प्रीव्यू और सुरक्षा स्कैनर लिंक अपने आप खोलते हैं, और अलार्म कभी किसी रोबोट से स्वीकार नहीं होना चाहिए। कोई बॉडी नहीं। यह स्वीकार किए गए अलार्म के साथ उत्तर देता है (आकार, हैंडलर से; इस दस्तावेज़ के बाकी उदाहरण चल रहे Gateway से लिए गए थे, यह नहीं, क्योंकि उस Gateway में ntfy नहीं था):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

स्वीकार लिंक बंद होने पर:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

यह अलार्म इंजन से होकर साधारण स्वीकृति है, `notify:<channel>` के तहत ऑडिट होती है। हर इनकार का उत्तर दिया और लॉग किया जाता है, क्योंकि जो बटन चुपचाप कुछ नहीं करता वह ठीक उस बटन जैसा दिखता है जिसे किसी ने दबाया ही नहीं:

| स्थिति | कब |
|---|---|
| 403 | जाली, बदला हुआ, या किसी और रहस्य से हस्ताक्षरित |
| 404 | अलार्म अब मौजूद नहीं, या स्वीकार लिंक बंद हैं (उन्हें `HOTLOOP_PUBLIC_URL` और बटन वाला चैनल चाहिए) |
| 409 | पहले ही इस्तेमाल हो चुका, तब से अलार्म फिर उठा, या स्वीकार करने को कुछ नहीं बचा |
| 410 | असली, पर समाप्त |
| 503 | स्वीकृति सहेजी नहीं जा सकी; लिंक वापस दिया जाता है ताकि दूसरा प्रेस अब भी काम कर सके |

उत्तर में `Access-Control-Allow-Origin: *` होता है ताकि ntfy वेब ऐप इसे अपने ओरिजिन से दबा सके; इस रूट पर कुछ भी कुकी नहीं पढ़ता। टोकन कभी लॉग नहीं होता और कहीं लौटाया नहीं जाता। देखें [अलार्म सूचनाएँ](/hi/iot/notifications/#acknowledge-links)।

## बैकअप

तार्किक, केवल-तालिका-डेटा डेटाबेस स्नैपशॉट। `HOTLOOP_BACKUP_ENABLED` चाहिए। दोनों केवल एडमिन: सूची हर तालिका की पंक्ति संख्या दिखाती है, उपयोगकर्ता और सेशन समेत। **कोई रीस्टोर एंडपॉइंट नहीं है**, जानबूझकर: रीस्टोर बाइनरी का एक फ़्लैग है, जिसे एक बार वह चलाता है जो जानता है कि डेटाबेस उसे लेने के लिए है, चालू डेटाबेस के विरुद्ध कभी नेटवर्क कॉल नहीं। देखें [बैकअप और रीस्टोर](/hi/iot/backup/#बैकअप-रिस्टोर-करना)।

### `GET /api/backup`

वॉल्यूम पर बैकअप, हर एक अपने मैनिफ़ेस्ट के साथ।

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

अभी एक लेता है और उसका इंतज़ार करता है (30 मिनट तक: बड़ा `tag_history` समय लेता है)। कोई बॉडी नहीं। मैनिफ़ेस्ट लौटाता है: संस्करण, माइग्रेशन, और हर तालिका की पंक्तियाँ और कॉलम।

## निर्धारित रिपोर्ट

हिस्टोरियन सारांश CSV और HTML में, समय-सारणी पर, ईमेल या डाउनलोड से। `HOTLOOP_REPORTS_ENABLED` चाहिए। व्यूअर पढ़ते हैं, ऑपरेटर चलाते हैं, एडमिन परिभाषित करते हैं: परिभाषा बताती है कि प्लांट का डेटा कहाँ ईमेल होता है। परिभाषा के फ़ील्ड के लिए [निर्धारित रिपोर्ट](/hi/gateway/reports/) देखें।

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

हर परिभाषा `nextRunAt` और अपना सबसे हालिया रन `lastRun` के रूप में रखती है।

### `POST /api/reports`

परिभाषा बनाता है; बॉडी ऊपर जैसी परिभाषा है। `201`। सत्यापन विफल होने पर `400` (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), id मौजूद हो तो `409`।

### `GET /api/reports/{id}`

एक परिभाषा, जैसी सूची में है। अज्ञात के लिए `404`।

### `PUT /api/reports/{id}`

पूरी परिभाषा बदलता है। id बदली नहीं जा सकती (बॉडी की अलग हो तो `400`)। `nextRunAt` और `lastRun` स्वीकार करके अनदेखे किए जाते हैं, ताकि आप जो पढ़ा वही वापस भेज सकें।

### `DELETE /api/reports/{id}`

उसे उसके रन और फ़ाइलों समेत हटाता है, चल रहे रन को रद्द करते हुए। `{"deleted":"line1-hourly"}`, या `404`।

### `POST /api/reports/{id}/run`

उसे अभी चलाता है और इंतज़ार करता है। `?deliver=false` किसी को ईमेल किए बिना उसे बनाता और सहेजता है, परिभाषा को आज़माने के लिए। `200` का मतलब है कि रन हुआ; रिपोर्ट चली या नहीं यह उसका अपना `status` बताता है। विफल रन एक नतीजा है, ग़लत अनुरोध नहीं, और वह दोनों हालात में दर्ज होता है।

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

ऐसे `deliver` के लिए `400` जो true या false न हो, अज्ञात रिपोर्ट के लिए `404`।

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, नया पहले, `?limit=` डिफ़ॉल्ट 50, अधिकतम 500। अज्ञात रिपोर्ट के लिए `404`, ख़ाली सूची नहीं।

### `GET /api/reports/{id}/runs/{run}/download`

एक सहेजी हुई फ़ाइल को अटैचमेंट के रूप में स्ट्रीम करता है। `?format=csv` या `html`।

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML `sandbox` Content-Security-Policy के साथ परोसी जाती है: रिपोर्ट पढ़ने का दस्तावेज़ है, ऐसा पन्ना नहीं जिसे कुछ चलाने दिया जाए। खुलने वाली फ़ाइल वही है जिसका नाम रन रिकॉर्ड में है; URL में कुछ भी पाथ का हिस्सा नहीं बनता। ऐसे रन नंबर के लिए `400` जो संख्या नहीं है या ऐसे फ़ॉर्मैट के लिए जो दोनों में से कोई नहीं, ऐसे रन या फ़ाइल के लिए `404` जो मौजूद नहीं।

## साइटें

### `GET /api/sites`

हर साइट जिसे Gateway फ़ेडरेट करता है, उससे उसकी प्लांट स्थिति MCP पर समानांतर में पूछी जाती है, हर एक के लिए 6 सेकंड, ताकि एक मृत साइट बाकी को रोक न सके। साइटें कॉन्फ़िग में आउटबाउंड MCP सर्वर हैं। देखें [MCP](/hi/iot/mcp/#साइटों-का-संघ)।

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

पहुँच से बाहर साइट की गिनतियों का कोई अर्थ नहीं और उन्हें कुल से बाहर रखा जाता है: जिस साइट तक नहीं पहुँचा जा सकता उसे शून्य अलार्म गिनना इस स्क्रीन का सबसे ख़तरनाक काम होता। कोई साइट कॉन्फ़िगर न हो तो: `{"configured":false,"sites":[]}`।

## सेटिंग

### `GET /api/settings`

हर सेटिंग, उसका प्रभावी मान, मान कहाँ से आया और उसे सेट करने वाला वेरिएबल:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` है `stored`, `environment` या `default`। `secret` केवल `set` या `not set` होता है। `envVar` वह वेरिएबल है जिससे मान आया। कुछ सेटिंग तब दूसरे वेरिएबल पर लौटती हैं जब `HOTLOOP_` वाला ख़ाली हो (समय क्षेत्र के लिए `TZ`, डेटाबेस के लिए `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` और `POSTGRES_PASSWORD`), और जब वैकल्पिक वाला लागू हो, `envVar` उसका नाम बताता है। ख़ाली स्ट्रिंग पर सेट वेरिएबल को असेट माना जाता है, जैसे कॉन्फ़िग उसे देखता है। पोल सेटिंग मिलीसेकंड में दिखाई जाती हैं, पर उनके वेरिएबल अवधि (`5s`, `500ms`) या सेकंड की सादी संख्या लेते हैं।

`Server` समूह में `product` बताता है कि यह कौन सा HotLoop है। ऐसी सुविधा जो इस उत्पाद में नहीं है और तैनाती ने फिर भी चालू कर दी (जैसे IoT पर `HOTLOOP_REPORTS_ENABLED=true`) उसे शुरू होने से नहीं रोकती। वह स्टार्टअप पर चेतावनी के रूप में लॉग होती है और यहाँ अतिरिक्त समूह `Not in this product` में अपने वेरिएबल और एक पंक्ति के साथ सूचीबद्ध होती है जो बताती है कि वह कहाँ रहती है। सेटिंग ठीक वैसी ही छोड़ी जाती है, इसलिए वही कॉन्फ़िगरेशन ऐसे उत्पाद पर जिसमें सुविधा है उसे चालू करता है। जब ऐसा कुछ सेट न हो तो समूह नहीं होता।

### `PUT /api/settings`

प्लांट-पहचान की सेटिंग बदलता है, और केवल वही:

| कुंजी | टाइप |
|---|---|
| `ui.plantName` | स्ट्रिंग, अधिकतम 200 अक्षर |
| `ui.siteId` | स्ट्रिंग, अधिकतम 200 अक्षर |
| `ui.timezone` | IANA नाम जिसे यह मशीन जानती है (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | सेकंड की पूर्ण संख्या, 10 से 43200: जब कोई पैनल को न छुए तब कियोस्क साइन-इन कितनी देर टिकता है। डिफ़ॉल्ट 900 |
| `ui.lockoutAttempts` | पूर्ण संख्या, 0 से 100: लगातार ग़लत पासवर्ड या PIN जो एक खाते को लॉक कर देते हैं। डिफ़ॉल्ट 10, और 0 का मतलब कोई लॉकआउट नहीं |
| `ui.panelDelaySeconds` | सेकंड की पूर्ण संख्या, 0 से 30: ग़लत के बाद, बिना उपयोगकर्ता नाम के डाले गए अगले PIN को जाँचने से पहले कियोस्क पैनल अधिकतम कितना इंतज़ार करता है। डिफ़ॉल्ट 3, और 0 का मतलब कोई इंतज़ार नहीं |
| `ui.lockoutSeconds` | सेकंड की पूर्ण संख्या, 10 से 86400: लॉक हुआ खाता कितनी देर लॉक रहता है। डिफ़ॉल्ट 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

पूरी सेटिंग लौटाता है, जैसे `GET`। कोई और कुंजी उसका नाम लेने वाला 400 देती है:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

यह जानबूझकर है। राइट स्विच तय करते हैं कि यह प्रोसेस मशीनरी चला सकती है या नहीं, और जिस कंट्रोल को उसी ब्राउज़र से चालू किया जा सके जो राइट जारी करता है वह कंट्रोल नहीं है। उन्हें बदलना एक तैनाती है।

## हिस्टोरियन लक्ष्य

प्लांट के अपने डेटाबेस, जिनमें HotLoop अपने इतिहास को अपने डेटाबेस के साथ-साथ लिखता है। देखें [हिस्टोरियन लक्ष्य](/hi/iot/historian-targets/)। जो भी भूमिका सेटिंग पढ़ती है वह इन्हें और हर एक की हालत देखती है। एक को बदलना केवल एडमिन के लिए है, क्योंकि लक्ष्य वह जगह है जहाँ प्लांट का डेटा जाता है। पासवर्ड डिवाइस क्रेडेंशियल कुंजी (`HOTLOOP_SECRET_KEY_FILE`) से सील किए जाते हैं और कभी उत्तर में नहीं आते; `passwordSet` बताता है कि कोई सहेजा है या नहीं, और `passwordProblem` बताता है कि सहेजा हुआ क्यों नहीं खुल सकता। हर बदलाव लॉग में जाता है और तुरंत लागू होता है।

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` वे डेटाबेस हैं जिनमें यह HotLoop लिखता है, और हर एक अपने फ़ील्ड को क्या कहता है: InfluxDB में वहाँ टोकन है जहाँ बाकी में पासवर्ड है (`password` उसे ले जाता है), वहाँ बकेट जहाँ उनमें डेटाबेस है (`database`), वहाँ मेज़रमेंट जहाँ उनमें तालिका है (`table`), और एक संगठन (`org`) जो उनमें से किसी में नहीं है। `status.state` है `up`, `catching-up` (चालू, और HotLoop के अपने इतिहास से जो देय है वह अब भी भेज रहा), `down`, `starting` या `off` (बंद किया गया)। `queued` वह है जो मेमोरी में इंतज़ार में है, `queueCap` में से। `written` लाइव भेजी गई रीडिंग गिनता है और `backfilled` HotLoop के अपने इतिहास से भेजी गई। `dropped` वे रीडिंग गिनता है जो क्यू ने तब छोड़ीं जब लक्ष्य साथ नहीं दे पा रहा था: वे देय हैं, खोई नहीं। `refused` वे रीडिंग गिनता है जिन्हें डेटाबेस ने ख़ुद नहीं लिया, कारण `lastRefusal` में। `owedFrom` और `owedTo` वह हैं जो अब भी देय है; जब तक अंत खुला है, जो तब तक है जब तक लक्ष्य बंद है, `owedTo` नहीं होता।

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` 1 से 63 छोटे अक्षर, अंक और `-` है, और सिस्टम लॉग में लक्ष्य का नाम बताता है। `address` `host` या `host:port` है, उसमें लॉगिन नहीं; प्रकार का डिफ़ॉल्ट पोर्ट छूटा हुआ पोर्ट भर देता है। `table` का डिफ़ॉल्ट प्रकार का `defaultTable` है और उसमें स्कीमा हो सकती है (`history.hotloop`)। `org` InfluxDB 2 का संगठन है। `enabled` का डिफ़ॉल्ट true है। पासवर्ड को कुंजी चाहिए: `HOTLOOP_SECRET_KEY_FILE` के बिना `400`, कभी सादे पाठ में नहीं सहेजा जाता। लक्ष्य और उसकी स्थिति के साथ `201`; जिस id का उपयोग हो चुका हो उसके लिए `409`।

### `PUT /api/historian/targets/{id}`

ऊपर के कोई भी फ़ील्ड सिवाय `id` के; जो नहीं भेजा गया वह रहता है। `"password":""` पासवर्ड साफ़ करता है। बदलाव लक्ष्य को उसकी नई सेटिंग के साथ फिर शुरू करता है, और जो उसे देय था वह अब भी देय है। लक्ष्य के साथ `200`।

### `DELETE /api/historian/targets/{id}`

उसमें लिखना बंद करता है और जो उसे देय था उसे भूल जाता है। जो उसके पास पहले से है वह उसके डेटाबेस में रहता है। सेटिंग रखने के लिए इसके बजाय `"enabled":false` से उसे बंद करें। `200` `{"deleted":"plant-pg"}`।

## सिस्टम लॉग

### `GET /api/events`

हर बदलाव, राइट, लॉगिन और कनेक्शन परिवर्तन, नया पहले।

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `category` | दोहराने योग्य: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | दोहराने योग्य: `debug`, `info`, `warning`, `error` |
| `subject` | ठीक-ठीक: डिवाइस id, टैग कुंजी, entity_id, `equipment:4`, `label:critical` |
| `q` | अक्षर-रूप से स्वतंत्र खोज |
| `minutes` | केवल अंतिम N मिनट |
| `limit` | डिफ़ॉल्ट 200, अधिकतम 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` उपयोगकर्ता, `system`, `automation:<id>` या `mcp:<client>` है। `detail`, जब हो, स्ट्रिंग के रूप में अतिरिक्त JSON है।

## लॉगबुक

### `GET /api/logbook`

जो हुआ उसकी एक समयरेखा, नया पहले: एंटिटी स्थिति बदलाव, राइट, अलार्म परिवर्तन, ऑटोमेशन और स्क्रिप्ट रन, और सिस्टम लॉग से कॉन्फ़िगरेशन बदलाव और सर्विस कॉल। ट्रेल वहीं पढ़े जाते हैं जहाँ वे हैं और मिलाए जाते हैं, इसलिए हर एक अपना रिटेंशन रखता है। संख्यात्मक रीडिंग इसमें नहीं हैं: उसी के लिए `GET /api/history` है। देखें [लॉगबुक](/hi/iot/logbook/)।

| क्वेरी | <span class="sr-only">विवरण</span> |
|---|---|
| `entity` | केवल वह जो इस एंटिटी के बारे में है: उसके स्थिति बदलाव, उस पर और उसके टैग पर राइट, उसके अलार्म, वे ऑटोमेशन रन जो वह चलाती है या जिन्होंने उस पर लिखा, उस पर कॉन्फ़िग बदलाव |
| `equipment_id` | केवल वह जो उपकरण ट्री के इस नोड पर या उसके नीचे हुआ, उसी नियम से। `entity` के साथ नहीं |
| `actor` | किसने किया उसका अक्षर-रूप से स्वतंत्र अंश: उपयोगकर्ता, `automation:<id>`, `mcp:<client>` |
| `kinds` | अल्पविराम से अलग या दोहराए गए: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | RFC 3339 समय; `from` शामिल, `to` शामिल नहीं |
| `limit` | डिफ़ॉल्ट 100, अधिकतम 1000 |
| `before` | पिछले पन्ने का `next` |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` उसकी अपनी ट्रेल में पंक्ति की id है (स्थिति बदलाव के लिए, एंटिटी की अपरिवर्तनीय id), और `at` और `kind` के साथ यही वह है जिसे `next` एन्कोड करता है: इस पन्ने के बाद का पन्ना उस क्रम में कड़ाई से पुराना सब कुछ है, इस बीच जो भी जोड़ा गया हो। `next` आख़िरी पन्ने पर छोड़ दिया जाता है। `suppressed` इस बदलाव से पहले उस एंटिटी के कितने बदलाव लॉग नहीं हुए, क्योंकि वह एक साथ दस से तेज़ और फिर हर दो सेकंड में एक बदल रही थी।

अज्ञात प्रकार, ग़लत बने समय, `to` से पहले न आने वाले `from`, 1000 से ऊपर की सीमा, गढ़े हुए कर्सर, या `entity` और `equipment_id` साथ होने पर `400`; ऐसे नोड के लिए `404` जो मौजूद नहीं। जब उत्तर देने वाली प्रोसेस में लॉगबुक नहीं चल रही तब `503`।

## लाइव फ़ीड

### `GET /api/stream`

सर्वर-सेंट इवेंट, एक दिशा में, जब तक आप उसे खुला रखें। WebSocket की जगह SSE क्योंकि ट्रैफ़िक केवल एक दिशा में जाता है, और खुले डैशबोर्ड के नीचे पॉड के रीस्टार्ट होने पर इवेंट स्ट्रीम अपने आप दोबारा जुड़ जाती है। `EventSource` सेशन कुकी भेजता है; स्क्रिप्ट बेयरर टोकन भेजती है।

कनेक्ट होने पर आपको `retry: 3000` मिलता है और फिर मौजूदा तस्वीर, ताकि कुछ भी बदलने से पहले स्क्रीन भर जाए:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

फिर, जैसे-जैसे चीज़ें होती हैं:

| घटना | डेटा | कब |
|---|---|---|
| `values` | रीडिंग की ऐरे, `GET /api/values` का आकार, हर टैग की सबसे नई, **केवल वे टैग जिनकी रीडिंग बदली** | हर 250 ms, अगर कोई बदला हो। जिस टैग का मान, पाठ, इकाई, गुणवत्ता और कारण आख़िरी भेजे गए जैसे ही हों उसे छोड़ दिया जाता है, और 30 सेकंड बिना भेजे बीतने पर फिर भेजा जाता है, इसलिए स्थिर मान का `timestamp` उससे पुराना कभी नहीं होता। ड्राइवर हर पोल पर हर टैग पढ़ता है; 4.19.5 हर बार सब भेजता था (एक टेस्टर के 2232 टैग के लिए प्रति सेकंड चार बार लगभग 150 KB) और धीमे लिंक पर पन्ना मिनटों पीछे रह जाता था |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | हर 250 ms, अगर कोई एंटिटी स्थिति बदली हो। `removed` वह एंटिटी है जो बंद, हटाई या नाम बदलकर हट गई |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, अलार्म और उसके साथ क्या हुआ (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | तुरंत: अलार्म परिवर्तन दुर्लभ हैं और हर एक मायने रखता है |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | तुरंत: डिवाइस के गिरने पर स्क्रीन लाल हो जानी चाहिए, अगले फ़्लश पर नहीं |
| `logbook` | `{"kinds":["state","write"]}`, लॉगबुक प्रविष्टि के कौन से प्रकार में कुछ नया है | अधिकतम सेकंड में एक बार। उसमें कोई प्रविष्टि नहीं, क्योंकि स्क्रीन को क्या दिखाना है यह उसके फ़िल्टर पर निर्भर है: वह `GET /api/logbook` से अपना पन्ना माँगती है |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

हर 20 सेकंड में एक टिप्पणी पंक्ति (`: heartbeat 2026-09-27T20:35:00Z`) प्रॉक्सी को निष्क्रिय कनेक्शन बंद करने से रोकती है। हर खुला पन्ना अपनी गति से चलता है: उसका लेखक उतनी देर रुकता है जितनी देर उसका आख़िरी भेजना चला (अधिकतम पाँच सेकंड), और इस बीच जो आता है वह हर टैग और हर एंटिटी के हिसाब से रखा जाता है, केवल सबसे नया, इसलिए धीमे लिंक पर पन्ना प्लांट से एक-दो भेजने पीछे रहता है, कभी मिनट नहीं, कुछ नहीं खोता, और दूसरे पन्नों से कुछ नहीं लेता। जब अनुरोध `Accept-Encoding: gzip` कहता है (ब्राउज़र कहता है) तब स्ट्रीम gzip से संपीड़ित होती है, जो टेस्टर की पहली तस्वीर को तार पर लगभग 326 KB से लगभग 11 KB कर देती है। उत्तर `X-Accel-Buffering: no` सेट करता है, क्योंकि बफ़र करने वाला प्रॉक्सी लाइव फ़ीड को बहुत धीमे डाउनलोड में बदल देता है।

स्ट्रीम हर पाँच सेकंड में अपना सेशन फिर देखती है और सेशन के चले जाने पर बंद हो जाती है: साइन आउट, समाप्त, रद्द, या खाता बंद या अब `status.read` के लिए अनुमत नहीं। वह पहले कोई घटना नहीं भेजती। ब्राउज़र का `EventSource` दोबारा जुड़ता है, ऊपर वाला `401` पाता है, और रुक जाता है। `HOTLOOP_AUTH_INSECURE=true` के साथ कोई सेशन नहीं और जाँचने को कुछ नहीं। यह जाँच सेशन के इस्तेमाल में नहीं गिनी जाती, इसलिए खुली छोड़ी गई स्क्रीन सेशन को ताज़ा नहीं रखती।

## MCP

### `/mcp` और `/mcp/`

Model Context Protocol, स्ट्रीमेबल HTTP ट्रांसपोर्ट, एजेंट के लिए। कोई भी मेथड: ट्रांसपोर्ट कॉल के लिए `POST`, सर्वर की अपनी स्ट्रीम के लिए `GET` और सेशन ख़त्म करने के लिए `DELETE` इस्तेमाल करता है। पाथ `HOTLOOP_MCP_PATH` है (डिफ़ॉल्ट `/mcp`) और एंडपॉइंट तभी होता है जब `HOTLOOP_MCP_ENABLED` चालू हो।

यह सेशन लॉगिन के पीछे **नहीं** है। इसका अपना बेयरर टोकन `HOTLOOP_MCP_TOKEN` है, जो हैंडलर के सामने जाँचा जाता है ताकि बिना उसके कॉल करने वाला टूल की सूची तक न देख सके:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

कोई टोकन कॉन्फ़िगर न हो तो HotLoop पहले स्टार्ट पर एक बनाता है और अपने डेटाबेस में रखता है (`hotloop mcp-token` उसे छापता है), इसलिए एंडपॉइंट कभी खुला नहीं होता। एजेंट किसी भी और जैसा कॉल करने वाला है: वह पढ़ता और लिखता है, उसके राइट सबके जैसे उसी राइट गेट से गुज़रते हैं, और `mcp:<client name>` के रूप में ऑडिट होते हैं। टूल और संसाधन [MCP](/hi/iot/mcp/) में हैं।

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

`Mcp-Session-Id` हेडर और सर्वर की क्षमताओं और निर्देशों के साथ उत्तर देता है।

## UI

### `GET /manifest.webmanifest`

वेब ऐप मैनिफ़ेस्ट जो फ़ोन को UI ऐप की तरह इंस्टॉल करने देता है: उत्पाद और प्लांट का नाम, `display` `standalone`, थीम रंग, आइकन (192 और 512 पिक्सेल PNG, एक maskable 512 और SVG) और अलार्म और डैशबोर्ड के शॉर्टकट। उसमें हर URL मैनिफ़ेस्ट के अपने URL के सापेक्ष है, इसलिए HotLoop जहाँ भी माउंट हो वह सही है। नाम सेटिंग में तय प्लांट नाम का अनुसरण करता है, और उत्तर `Cache-Control: no-cache` है ताकि नाम बदलना अगली नज़र में दिखे। कोई सेशन नहीं: फ़ोन तब पूछता है जब किसी ने साइन इन नहीं किया होता। देखें [डैशबोर्ड](/hi/iot/dashboards/#फ़ोन-पर)।

### `GET /sw.js`

सर्विस वर्कर, उस जगह की जड़ पर जहाँ HotLoop माउंट है ताकि उसका दायरा पूरे ऐप को ढके। यह पन्ना और उन रीड का आख़िरी उत्तर रखता है जिन्हें कोई व्यक्ति देखता है, और जब HotLoop तक पहुँचा न जा सके तब उन्हें पुराना चिह्नित करके उत्तर देता है। यह कभी राइट का उत्तर नहीं देता, उसे रखता नहीं, या क्यू में नहीं डालता। चल रहा संस्करण उसके भीतर है, इसलिए हर रिलीज़ का अपना पेज कैश होता है। `Cache-Control: no-cache`; कोई सेशन नहीं। केवल सुरक्षित संदर्भ (https, या `localhost`) वाला ब्राउज़र इसे चलाता है।

### `GET /next` और `GET /next/`

वह जगह जहाँ UI तब रहता था जब पुराना डिफ़ॉल्ट था। दोनों जड़ की ओर `301` हैं, इसलिए तब बना बुकमार्क अब भी पहुँचता है।

### `/`

वेब UI, `web/` से बाइनरी में बना: एक पन्ना, उसकी स्क्रिप्ट, स्टाइल और फ़ॉन्ट, एक सर्विस वर्कर और इंस्टॉल योग्य ऐप के आइकन, इन सबमें हर URL पन्ने के सापेक्ष है ताकि वह होस्ट की जड़ पर, किसी पाथ के नीचे, प्रॉक्सी के पीछे या EmberNet डैशबोर्ड के iframe के अंदर चले। सर्वर शीर्षक और एक डेटा ब्लॉक, `<script type="application/json" id="iiot">`, भरता है, उसके साथ जो केवल वही जानता है: प्लांट, साइट, उत्पाद, सुविधाएँ, राइट नीति और समय क्षेत्र। केवल `GET` और `HEAD`; कोई और मेथड `405` है। जो पाथ उसकी फ़ाइलों में से नहीं है वह `404` है, क्योंकि टाइपो के लिए पन्ना परोसने से वह चलती स्क्रीन जैसा दिखता, और UI के बिना बनी बाइनरी यह सादे पाठ में बताती है और यह भी कि उसे कैसे बनाएँ। कोई सेशन नहीं: जब तक आप लॉग इन नहीं करते पन्ना लॉगिन फ़ॉर्म है।
