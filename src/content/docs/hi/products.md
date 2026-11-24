---
title: "HotLoop उत्पाद: पांच लाइनों में आठ"
description: "पांच रिलीज़ लाइनों पर आठ उत्पाद: कोर के हर उत्पाद में क्या है, वह कौन सा डेटाबेस चलाता है, इंस्टॉल कैसे करें और साइट को ऊपर के उत्पाद पर कैसे ले जाएं।"
---

HotLoop प्लांट के लिए आठ उत्पाद हैं: चार जो एक साइट के साथ बढ़ते हैं (IoT, Edge, Gateway और Edge Relay), साथ में लॉजिक जोड़ने के लिए Flow, वर्कफ़्लो के लिए Cascade, PLC की अपनी स्क्रीन के लिए HotLoop for CODESYS, और PLC के मान नेटवर्क पर भेजने के लिए Transmitter। ये पांच रिलीज़ लाइनों पर आते हैं, इसलिए हर एक का अपना संस्करण है। साइडबार का हर अनुभाग केवल वही दिखाता है जो वह उत्पाद देता है, और बड़ा उत्पाद उन पृष्ठों से जुड़ता है जो वह छोटे उत्पाद से लेता है।

ये पांच रिलीज़ लाइनों पर आते हैं। **HotLoop core** यानी IoT, Edge, Gateway और Edge Relay: चार उत्पाद, एक कोडबेस, एक टैग। कोर की हर रिलीज़ चारों को एक साथ, एक ही संस्करण के साथ भेजती है, और हर एक का अपना इमेज, अपना Helm चार्ट और अपनी Podman Quadlet यूनिट होती हैं। वही चुनें जो मशीन के लिए ठीक बैठे। हर उत्पाद HotLoop के सारे प्रोटोकॉल बोलता है, इसलिए अपनी बेंच पर रखा PLC पढ़ने के लिए आपको कभी बड़े उत्पाद पर नहीं जाना पड़ता। उत्पादों को सुविधाएं अलग करती हैं। प्रोटोकॉल नहीं।

**Flow**, **Cascade**, **HotLoop for CODESYS** और **Transmitter** की अपनी लाइनें और अपने संस्करण हैं, इसलिए Flow की रिलीज़ कोर को कभी नहीं हिलाती, और उलटा भी यही है। तालिका के नीचे सब कुछ कोर के बारे में है। यहां से हर एक आठों की शुरुआत होती है:

| उत्पाद | रिलीज़ लाइन | दस्तावेज़ | इंस्टॉल | रिलीज़ नोट्स | रोडमैप |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/hi/iot/overview/">दस्तावेज़</a> | <a href="/hi/iot/install/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-core">नोट्स</a> | <a href="/hi/roadmap/">रोडमैप</a> |
| **HotLoop Edge** | HotLoop core | <a href="/hi/edge/overview/">दस्तावेज़</a> | <a href="/hi/edge/install/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-core">नोट्स</a> | <a href="/hi/roadmap/">रोडमैप</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/hi/gateway/overview/">दस्तावेज़</a> | <a href="/hi/gateway/install/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-core">नोट्स</a> | <a href="/hi/roadmap/">रोडमैप</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/hi/edge-relay/overview/">दस्तावेज़</a> | <a href="/hi/edge-relay/install/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-core">नोट्स</a> | <a href="/hi/roadmap/">रोडमैप</a> |
| **HotLoop Flow** | Flow | <a href="/hi/flow/overview/">दस्तावेज़</a> | <a href="/hi/flow/install/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-flow">नोट्स</a> | <a href="/hi/flow/roadmap/">रोडमैप</a> |
| **HotLoop Cascade** | Cascade | <a href="/hi/cascade/overview/">दस्तावेज़</a> | <a href="/hi/cascade/running/">इंस्टॉल</a> | <a href="/hi/releases/#hotloop-cascade">नोट्स</a> | <a href="/hi/cascade/roadmap/">रोडमैप</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/hi/codesys/overview/">दस्तावेज़</a> | <a href="/hi/codesys/install/">इंस्टॉल</a> | <a href="/hi/releases/codesys-0-3-10/">नोट्स</a> | <a href="/hi/codesys/roadmap/">रोडमैप</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/hi/transmitter/overview/">दस्तावेज़</a> | <a href="/hi/transmitter/install/">इंस्टॉल</a> | <a href="/hi/releases/transmitter-1-3-0/">नोट्स</a> | <a href="/hi/transmitter/roadmap/">रोडमैप</a> |

नीचे की तालिका कोर के चारों उत्पादों की तुलना करती है।

| <span class="sr-only">विवरण</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| किस काम के लिए | ऑटोमेशन की नींव। एक Pi, एक NUC, अलमारी में रखा एक डिब्बा | मशीन के पास का डिब्बा, जो ऊपर का लिंक टूटने पर भी चलता रहता है | साइट का दिमाग | पोल करो, आगे भेजो, टिके रहो। न डेटाबेस, न UI |
| एंटिटी, ऑटोमेशन, हेल्पर, स्क्रिप्ट, रेसिपी, ब्लूप्रिंट, डैशबोर्ड, लॉगबुक, सूचनाएं, MCP, डिस्कवरी वाला MQTT, ISA-18.2 अलार्म, बैकअप और हर ड्राइवर | हां | हां | हां | केवल ड्राइवर |
| OPC UA सर्वर, स्टोर एंड फ़ॉरवर्ड के साथ Sparkplug एज पब्लिशिंग | | हां | हां | केवल पब्लिशिंग |
| फ़्लीट, मल्टी-साइट, निर्धारित रिपोर्ट | | | हां | |
| इमेज | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| चार्ट | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet यूनिट | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| SQLite पर Quadlet यूनिट | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | कोई नहीं |
| चार्ट में `database.type` | `postgresql` (डिफ़ॉल्ट), `sqlite` | `timescaledb` (डिफ़ॉल्ट), `postgresql`, `sqlite` | `timescaledb` (डिफ़ॉल्ट), `postgresql`, `sqlite` | कोई नहीं |
| आर्किटेक्चर | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| चार्ट और Quadlet जो डेटाबेस चलाते हैं | PostgreSQL 17 | TimescaleDB | TimescaleDB | कोई नहीं |
| डिफ़ॉल्ट रूप से रखा जाने वाला इतिहास | 30 दिन | 90 दिन | 90 दिन | कोई नहीं |
| जिन डेटाबेस पर बाइनरी चलती है | SQLite या Postgres | SQLite, Postgres या TimescaleDB | SQLite, Postgres या TimescaleDB | कोई नहीं |

डेटाबेस एक सेटिंग है, इमेज नहीं: `HOTLOOP_DB_TYPE=sqlite` और `HOTLOOP_DB_PATH` तीनों में से किसी को भी बिना किसी डेटाबेस कंटेनर के एक SQLite फ़ाइल पर रख देते हैं (DEPLOYMENT.md, "SQLite")। चार्ट यही चुनाव `database.type` के रूप में लेते हैं और Quadlet यूनिट `sqlite/` डायरेक्टरी के रूप में, और हर उत्पाद केवल ऊपर की तालिका के डेटाबेस देता है: IoT चार्ट से `timescaledb` मांगने पर इंस्टॉल विफल हो जाता है। एक डेटाबेस से दूसरे पर जाना बैकअप और रिस्टोर है (BACKUP.md)।

Gateway ने 4.17.0 तक के लिए वही नाम रखे जिनके साथ वह आया था: इमेज `ghcr.io/hotloop-io/hotloop`, चार्ट `hotloop`। इसे चला रहे किसी को कुछ बदलने की ज़रूरत नहीं।

## उत्पाद में जो है, वही बाइनरी में है

उत्पाद एक बिल्ड है, सेटिंग नहीं। `-tags hotloop_iot` IoT बनाता है, `-tags hotloop_edge` Edge बनाता है, और बिना टैग के Gateway बनता है। जो उत्पाद में नहीं है वह बंद नहीं है, वह है ही नहीं: OPC UA सर्वर IoT इमेज में बिल्कुल नहीं है, इसलिए कोई एनवायरनमेंट वेरिएबल, कोई values फ़ाइल और कोई बुरा दिन उसे चालू नहीं कर सकता।

इसलिए छोटा उत्पाद दिखावा करने के बजाय उस चीज़ का जवाब देता है जो उसमें नहीं है:

- **API** हर उत्पाद में हर रूट रखती है। जिस सुविधा का यह उत्पाद नहीं रखता, उसका रूट `404` देता है और उस उत्पाद का नाम बताता है जिसमें वह है: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`। `GET /api/status` `product` और `features` बताता है, इसलिए स्क्रिप्ट टटोलने के बजाय पूछ लेती है।
- IoT या Edge पर **केवल Gateway वाली सेटिंग** (जैसे किसी पुरानी values फ़ाइल से चला आया `HOTLOOP_REPORTS_ENABLED=true`) शुरू होते समय और सेटिंग स्क्रीन पर चेतावनी देती है, और HotLoop चलता रहता है। जो रिपोर्ट वह बना नहीं सकता, उसके कारण HotLoop प्लांट को चलता रखता है, और चेतावनी यह पक्का करती है कि कोई उसे देखे।
- **चार्ट** में यह सेटिंग होती ही नहीं। `charts/hotloop-iot` में `reports`, `opcuaServer` या `edgePublish` का कोई ब्लॉक नहीं है, और `hotloop-edge` में `reports` नहीं है। फिर भी आप कोई एक सेट करें तो वह कुछ नहीं बनाता।
- **`hotloop --product`** `iot`, `edge` या `gateway` छापता है। `--version` अब भी केवल संस्करण छापता है, क्योंकि स्क्रिप्ट उसे पार्स करती हैं।

## कौन सा चुनें

- **एक Pi, स्मार्ट प्लग, कुछ सेंसर, Tasmota और Zigbee2MQTT से भरा MQTT ब्रोकर, या बेंच पर रखा एक PLC:** IoT। यह सबसे छोटा इमेज है (arm पर लगभग 29 MB) और सादे PostgreSQL का इमेज TimescaleDB के इमेज का छठा हिस्सा है, जो SD कार्ड पर वही संख्या है जो मायने रखती है।
- **लाइन के पास कसा हुआ डिब्बा, जो OPC UA से SCADA को डेटा देता है या Sparkplug से ऊपर प्रकाशित करता है और ऊपर का लिंक टूटने को झेल जाता है:** Edge।
- **साइट: हर लाइन, शेड्यूल पर ईमेल से भेजी गई रिपोर्ट, रिपोर्ट करने वाले एज रिले, एक स्क्रीन पर एक से ज़्यादा साइट:** Gateway।
- **वह डिब्बा जिसे केवल पोल करना और आगे भेजना है, और जिसमें संभालने के लिए कोई डेटाबेस नहीं है:** Edge Relay। [Edge Relay संदर्भ](/hi/edge-relay/reference/) देखें।

## आकार

इमेज बाइनरी और लगभग 3 MB के बेस को मिलाकर बनती है।

| <span class="sr-only">विवरण</span> | amd64 इमेज / बाइनरी | arm64 इमेज / बाइनरी | arm/v7 इमेज / बाइनरी |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | नहीं बनता |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

ये डिस्क पर आकार हैं। बिना डिवाइस के HotLoop लगभग 10 MB RSS लेता है और PostgreSQL लगभग 12 MB, और यह न्यूनतम सीमा है, असली संख्या नहीं: डिवाइस पोल होने पर उत्पाद कितना लेता है, यह डिवाइसों पर निर्भर करता है।

## इंस्टॉल

### Helm

एक रिपॉज़िटरी, चारों चार्ट:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

रिलीज़ का नाम `hotloop` ही रखें, चाहे कोई भी उत्पाद हो। डेटाबेस का वॉल्यूम, Secrets और Service इसी रिलीज़ नाम पर नामित होते हैं, और इसे रखने से ही साइट बाद में ऊपर के उत्पाद पर जा सकती है (नीचे देखें)।

EmberNet पर हर एक App Store में अपना अलग कार्ड है: "HotLoop IoT", "HotLoop Edge", "HotLoop Gateway" और "HotLoop Edge Relay"। स्टोर से डिप्लॉय करने पर डैशबोर्ड के टेनेंट लेबल चार्ट के बनाए हर संसाधन में जुड़ जाते हैं, और Running Apps उन्हें `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` और `HotLoop-Edge-Relay` के रूप में दिखाता है।

### Podman Quadlet

उस मशीन के लिए जो क्लस्टर में नहीं है। `deploy/quadlet/` के नीचे हर उत्पाद की डायरेक्टरी में पांच यूनिट हैं: `hotloop.network`, `hotloop.container` (ऐप), `hotloop-db.container` (उसका डेटाबेस, वही इमेज और संस्करण जो उसका चार्ट चलाता है), `hotloop-db.volume` और `hotloop-data.volume`। इंस्टॉल के चरण हर `hotloop.container` के शीर्ष में हैं, और बाकी [Podman Quadlet](/hi/install/quadlet/) में है।

इनके लिए Podman 5.0 या नया चाहिए। Raspberry Pi OS Bookworm के साथ 4.3 आता है, जिसमें Quadlet बिल्कुल नहीं है, इसलिए Pi को Raspberry Pi OS Trixie या नया चाहिए। ऐप `:stable` को फ़ॉलो करता है और Podman का ऑटो-अपडेट उसे आगे बढ़ाता है, जबकि डेटाबेस पिन रहता है: [Quadlet README](/hi/install/auto-update/) में कैसे और क्यों बताया है। इंस्टॉल जैसे भी करें, डेटाबेस USB SSD पर रखें, SD कार्ड पर नहीं। इतिहास पूरे दिन, हर दिन लिखता है, और SD कार्ड ठीक इसी से मरते हैं।

## साइट को ऊपर के उत्पाद पर ले जाना

IoT से Edge और फिर Gateway तक हर डिवाइस, टैग, एंटिटी, ऑटोमेशन, अलार्म, उपयोगकर्ता और इतिहास का हर घंटा बना रहता है। हर उत्पाद हर माइग्रेशन चलाता है, इसलिए तीनों में डेटाबेस का ढांचा एक जैसा है, और बड़ा उत्पाद अपनी अतिरिक्त सुविधाओं को खाली लेकर शुरू होता है।

- **Quadlet:** यूनिट के नाम, वॉल्यूम और सीक्रेट हर उत्पाद की डायरेक्टरी में एक जैसे हैं। बड़े उत्पाद की `hotloop.container` और `hotloop-db.container` को अपनी फ़ाइलों पर कॉपी करें, `systemctl daemon-reload` चलाएं और रीस्टार्ट करें।
- **Helm:** उसी रिलीज़ पर `helm upgrade hotloop hotloop/hotloop-edge` (या `hotloop/hotloop`)। तीनों चार्ट अपने pod एक ही लेबल से चुनते हैं और डेटाबेस के StatefulSet और वॉल्यूम को एक ही नाम देते हैं, इसलिए अपग्रेड की अनुमति है और वॉल्यूम बंधा रहता है।

पहले बैकअप लें (`POST /api/backup`, देखें [बैकअप और रिस्टोर](/hi/iot/backup/)) और उसे मशीन से बाहर कॉपी कर लें। यह बदलाव Quadlet पर चलाकर देखा जा चुका है, IoT से Edge और फिर Gateway तक एक ही डेटाबेस वॉल्यूम पर, हर चरण में वही डिवाइस मौजूद रखकर, IoT की PostgreSQL डायरेक्टरी को Gateway की TimescaleDB इमेज के नीचे शुरू करके, और एक असली क्लस्टर पर `helm upgrade` के रूप में भी। जहां IoT की सादी डायरेक्टरी में TimescaleDB एक्सटेंशन नहीं है, वहां उस बदलाव के बाद इतिहास नेटिव पार्टिशन में रहता है, और hypertable के लिए बैकअप लेकर नई TimescaleDB में रिस्टोर करना पड़ता है। छोटे उत्पाद पर वापस जाना ऐसा कदम नहीं है जो आप उस मशीन पर उठाएं जिसकी आपको परवाह है।

## ये कैसे रिलीज़ होते हैं

एक `v` टैग चारों को रिलीज़ करता है, इसलिए IoT, Edge, Gateway और Edge Relay का संस्करण हमेशा एक ही रहता है। कुछ भी बनाने से पहले जांचा जाता है कि हर चार्ट का संस्करण और इमेज टैग से मेल खाता है, हर Quadlet ऐप यूनिट हेल्थचेक के साथ `:stable` को फ़ॉलो करती है, और हर डेटाबेस यूनिट अपने चार्ट से मेल खाती है और कभी अपने आप अपडेट नहीं होती। IoT और Edge के चार्ट Gateway के चार्ट से बनाए जाते हैं, इसलिए एक में की गई सुधार तीनों तक पहुंचता है।
