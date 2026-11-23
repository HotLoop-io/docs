---
title: "HotLoop Edge {{hotloop}} इंस्टॉल करें"
description: "HotLoop Edge {{hotloop}} को Helm से k3s पर या Podman Quadlet से औद्योगिक PC पर इंस्टॉल करें, फिर OPC UA सर्वर और Sparkplug प्रकाशन चालू करें।"
sidebar:
  label: "इंस्टॉल"
---

HotLoop Edge पहली बार 4.18.10 में आया। इमेज `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}` है, जो amd64, arm64 और arm/v7 के लिए बनी है, और चार्ट बाकी लाइनअप के उसी Helm रिपॉज़िटरी में `hotloop-edge` है। दोनों बिना लॉगिन के पुल होते हैं। Docker या Compose का रास्ता जानबूझकर नहीं है, और सत्र के साथ मर जाने वाले शेल से चलाया गया सादा `podman run` इंस्टॉल नहीं है।

क्लस्टर के लिए Helm। बिना क्लस्टर वाले औद्योगिक PC या Pi के लिए Podman Quadlet। डेटाबेस एक बार चुनना होता है: TimescaleDB (डिफ़ॉल्ट), सादा PostgreSQL, या बिना किसी डेटाबेस कंटेनर वाली SQLite फ़ाइल।

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-edge --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

रिलीज़ का नाम `hotloop` रखें, चाहे प्रोडक्ट कोई भी हो। डेटाबेस का वॉल्यूम, Secrets और Service इसी रिलीज़ नाम पर बनते हैं, और इसे बनाए रखने से ही साइट बाद में बड़े प्रोडक्ट पर जा सकती है।

इससे Edge के साथ उसके बगल में PostgreSQL 17 पर TimescaleDB 2.30.1, 20 Gi वॉल्यूम पर तैनात होता है, और 90 दिन का इतिहास रखा जाता है। चार्ट डेटाबेस पासवर्ड, MCP टोकन और एडमिन पासवर्ड रिलीज़ Secret में बनाता है और हर अपग्रेड पर उन्हीं का दोबारा उपयोग करता है। यह `<release>-secret-key` भी बनाता है, वह कुंजी जो HotLoop द्वारा रखे गए हर डिवाइस पासवर्ड को एन्क्रिप्ट करती है। यह कुंजी आपके डेटा का हिस्सा है, और [Gateway इंस्टॉल पृष्ठ](/hi/gateway/install/#ज़रूरत-पड़ने-से-पहले-कुंजी-का-बैकअप-लें) बताता है कि क्यों और इसका बैकअप कैसे लें। यह वही कुंजी है।

सादा PostgreSQL या SQLite फ़ाइल चाहिए तो इंस्टॉल करते समय `database.type` को `postgresql` या `sqlite` पर सेट करें। SQLite फ़ाइल एक लोकल डिस्क पर एक राइटर है, इसलिए एक ही रेप्लिका और कभी NFS नहीं। बाद में डेटाबेस बदलना बैकअप और रीस्टोर है, क्योंकि नया डेटाबेस खाली शुरू होता है। रीस्टोर [बैकअप](/hi/iot/backup/) में है।

### साइन इन

उपयोगकर्ता `admin` है। इंस्टॉल नोट्स वह कमांड छापते हैं जो पासवर्ड वापस पढ़ती है:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

`http://localhost:8080` खोलें। राइट बंद अवस्था में आते हैं: हर टैग तब तक केवल पढ़ने योग्य है जब तक कोई उसे सक्रिय न करे, और `safety.allowWrites` तब तक `false` रहता है जब तक आप तय न करें कि यह बॉक्स मशीनरी चला सकता है। [राइट गेट](/hi/gateway/write-gate/) में हर जाँच क्रम से है।

### Edge क्या जोड़ता है, और इसे कैसे चालू करें

दोनों डिफ़ॉल्ट रूप से बंद हैं, क्योंकि प्लांट नेटवर्क पर लिसनर या अपलिंक खोलना ऐसा काम है जो तैनाती जानबूझकर करती है।

**OPC UA सर्वर** `opcuaServer.enabled: true` है, पोर्ट 4840 पर। `opcuaServer.endpointHost` को वह नाम दें जिससे क्लाइंट बॉक्स तक पहुँचता है, ताकि प्रमाणपत्र मेल खाए। सुरक्षा मॉडल [OPC UA सर्वर](/hi/edge/opc-ua-server/) में है, और यह केवल पढ़ने योग्य है।

**बॉक्स की सेहत और होस्ट माउंट।** चार्ट का OPC UA सर्वर EmberNet डैशबोर्ड के लिए इस बॉक्स की अपनी सेहत भी देता है (CPU, मेमोरी, डिस्क, और जब कोई एजेंट फ़ाइल लिखे तो रीयल-टाइम जिटर), और डैशबोर्ड के लिए एक लॉगिन बनाता है जो टैग और मान पढ़ सकता है, और कुछ नहीं। यह डिफ़ॉल्ट रूप से चालू है: चार्ट होस्ट का रूट `/host` पर और उसका `/proc` `/host/proc` पर माउंट करता है, दोनों केवल पढ़ने योग्य, और कोई विशेषाधिकार नहीं जोड़ता। जो क्लस्टर restricted Pod Security प्रोफ़ाइल लागू करता है, वह hostPath को अस्वीकार करता है, और वहाँ आप डिवाइस और माउंट दोनों हटाने के लिए `opcuaServer.dashboard.boxHealth.enabled: false` सेट करें, या डिवाइस रखने के लिए `opcuaServer.dashboard.boxHealth.hostMount: false` सेट करें, जिसमें डिस्क और CPU रीडिंग खराब चिह्नित होती है और बताती है कि क्या माउंट करना है। बाकी [OPC UA सर्वर](/hi/edge/opc-ua-server/#embernet-डैशबोर्ड-के-लिए-मशीन-की-सेहत) में है।

**Sparkplug प्रकाशन** `edgePublish.enabled: true` है, जिसमें `edgePublish.broker` और `edgePublish.group` ज़रूरी हैं। `edgePublish.node` भी सेट करें, वरना नोड आईडी रिलीज़ का नाम होती है। फ़ॉरवर्ड कतार 1 Gi वॉल्यूम पर रहती है, `edgePublish.queueMaxBytes` डिफ़ॉल्ट रूप से 64 MiB है (लगभग 248,000 रीडिंग, प्रति रीडिंग लगभग 240 बाइट पर: 2,000 रीडिंग प्रति सेकंड पर लगभग दो मिनट), और उससे आगे सबसे पुरानी रीडिंग छोड़ी और गिनी जाती हैं। `0` असीमित है, और पर्याप्त लंबी रुकावट तब वॉल्यूम भर देती है। Edge प्रकाशन के लिए `replicaCount` 1 चाहिए, और नहीं तो चार्ट रेंडर करने से मना कर देता है। अपलिंक टूटने पर यह क्या करता है, यह [Edge प्रकाशन और स्टोर-एंड-फ़ॉरवर्ड](/hi/edge/edge-publish/) में है।

### असली प्लांट के देखने से पहले क्या सेट करें

| मान | डिफ़ॉल्ट | इसे क्यों बदलें |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, खाली | स्क्रीन पर, पृष्ठों में और अन्य साइटों को प्लांट का नाम क्या दिखता है। |
| `global.timezone` | `America/New_York` | शेड्यूल और शिफ़्ट बदलाव इसी पर चलते हैं। यह असली ज़ोन नाम होना चाहिए। |
| `publicUrl` | खाली | वह पता जिससे प्लांट Wi-Fi पर कोई फ़ोन HotLoop तक पहुँचता है। इसके बिना सूचनाओं में वापसी लिंक नहीं होता। |
| `safety.allowWrites` | `false` | मास्टर स्विच। बंद हो तो कहीं से भी किसी मशीन में कुछ नहीं लिखा जाता। |
| `historian.retentionDays` | `90` | कितने दिन का इतिहास रखा जाए। |
| `database.postgresql.persistence.size` | `20Gi` | आपका इतिहास यहाँ रहता है। इसे अपने टैग की संख्या और ऊपर की अवधि के हिसाब से तय करें। |
| `opcuaClient.persistence.enabled` | `false` | सुरक्षित OPC UA डिवाइस जोड़ने से पहले इसे चालू करें, ताकि क्लाइंट के प्रमाणपत्र रीस्टार्ट के बाद भी बचे रहें। |
| `secretKey.existingSecret` | खाली | आपका अपना प्रबंधित Secret, जिसमें डिवाइस पासवर्ड की कुंजी हो। चार्ट को `helm template` से रेंडर करें तो इसे सेट करें। |

## Podman Quadlet

Quadlet कंटेनरों को असली systemd सेवाएँ बना देता है: वे बूट पर बिना किसी के लॉगिन किए शुरू होती हैं, मरने पर फिर चलती हैं और जर्नल में लॉग करती हैं। इसके लिए **Podman 5.0 या नया** चाहिए। Raspberry Pi OS Bookworm में 4.3 आता है, जिसमें Quadlet बिल्कुल नहीं है, इसलिए Pi को Trixie या नया चाहिए। डेटाबेस वॉल्यूम SD कार्ड पर नहीं, USB SSD पर रखें।

यूनिट HotLoop रिपॉज़िटरी की `edge/` डायरेक्टरी में, `deploy/quadlet/` के नीचे हैं, और उनके नाम IoT और Gateway की यूनिट जैसे ही हैं। हर फ़ाइल [Podman Quadlet](/hi/install/quadlet/) में समझाई गई है।

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-edge:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-edge:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

फिर `http://<this box>:8080` खोलें और `admin` के रूप में लॉगिन करें। कुंजी की एक प्रति ऐसी जगह रखें जो यह बॉक्स न हो, क्योंकि इसे खोने का मतलब हर डिवाइस पासवर्ड फिर से टाइप करना है।

यूनिट केवल पोर्ट 8080 प्रकाशित करती है। जब आप OPC UA सर्वर (4840) या एम्बेडेड MQTT ब्रोकर (1883) चालू करें, तो `hotloop.container` में उसके लिए एक `PublishPort=` पंक्ति जोड़ें। Quadlet यूनिट भी चार्ट की तरह डिफ़ॉल्ट रूप से 90 दिन का इतिहास रखती है।

Edge पर सादा PostgreSQL चाहिए? यह TimescaleDB यूनिट है, जिसके `hotloop.container` में `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` जोड़ा गया हो। SQLite फ़ाइल चाहिए? `edge/sqlite/` की फ़ाइलें इस्तेमाल करें और ऊपर की डायरेक्टरी से कुछ नहीं, क्योंकि उनके यूनिट नाम एक जैसे हैं: ये `hotloop.container` और `hotloop-data.volume` हैं, और दो सीक्रेट, `hotloop-secret-key` और `hotloop-admin-password-hash`।

यूनिट `:stable` का अनुसरण करती है, और टाइमर चालू होने पर Podman उसे आगे बढ़ाता है:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

नई इमेज ऊपर आते समय डेटाबेस माइग्रेट करती है, और अगर वह शुरू न हो पाए तो Podman पिछली इमेज वापस रख देता है। डेटाबेस कंटेनर जानबूझकर `:stable` का अनुसरण नहीं करता। [:stable का ऑटो-अपडेट](/hi/install/auto-update/) बताता है कि अपडेट क्या करता है, रोलबैक क्या पलट नहीं सकता, और आपके कहने तक अपडेट कैसे रोकें। अपडेट चालू करने से पहले बैकअप लें।

## बड़े प्रोडक्ट पर जाना

IoT से Edge और फिर Gateway पर जाने पर हर डिवाइस, टैग, एंटिटी, ऑटोमेशन, अलार्म, उपयोगकर्ता और इतिहास का हर घंटा बना रहता है। Quadlet पर इसका मतलब बड़े प्रोडक्ट के `hotloop.container` और `hotloop-db.container` को अपनी फ़ाइलों पर कॉपी करना है, और Helm का रूप [प्रोडक्ट लाइनअप](/hi/products/) में है। यह बदलाव Quadlet पर चलाया जा चुका है, एक ही डेटाबेस वॉल्यूम पर IoT, फिर Edge, फिर Gateway, और असली क्लस्टर पर `helm upgrade` के रूप में भी। छोटे प्रोडक्ट पर लौटना उस बॉक्स पर करने लायक बदलाव नहीं है जिसकी आपको परवाह है, इसलिए पहले बैकअप लें।

## अब तक कितना चलाया गया है

Edge की Quadlet यूनिट systemd के अंतर्गत, बिना root के चलाई जा चुकी हैं, जिसमें एक ऐसा अपडेट भी है जो माइग्रेट करता है, शुरू नहीं हो पाता और रोलबैक होता है। systemd के अंतर्गत root के रूप में असली Pi और 32-बिट arm इमेज असली हार्डवेयर पर, बेयर मेटल पर चलाई जा चुकी हैं (2026-11-17)।

## लाइसेंस

HotLoop Edge, HotLoop Source License Agreement 1.0 के अंतर्गत है। यह मुफ़्त है और स्रोत देखने योग्य है, OSI ओपन सोर्स नहीं है। घर और लैब में उपयोग मुफ़्त है, और स्कूलों, गैर-लाभकारी संस्थाओं और सरकारी निकायों का अपने संचालन के लिए उपयोग भी। [लाइसेंस पृष्ठ](/hi/license/) और [व्यवसाय में HotLoop का उपयोग](/hi/business/) देखें।
