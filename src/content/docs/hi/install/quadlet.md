---
title: "Pi पर Podman Quadlet"
description: "Docker, Compose और क्लस्टर के बिना, Podman Quadlet से Pi या छोटे औद्योगिक PC पर HotLoop को असली systemd सेवाओं की तरह चलाएं।"
---

ऐसे Pi या छोटे औद्योगिक PC के लिए जो k3s क्लस्टर का हिस्सा **नहीं** है। अगर है, तो उत्पाद का चार्ट इस्तेमाल करें। यह डायरेक्टरी और चार्ट, HotLoop चलाने के दो समर्थित तरीके हैं।

न Docker, और न ऐसा अलग से `podman run` जो सत्र के साथ खत्म होने वाले शेल से चले। Quadlet कंटेनरों को असली systemd सेवाएं बना देता है: बिना किसी लॉग-इन यूज़र के बूट पर शुरू होती हैं, विफल होने पर दोबारा शुरू होती हैं और journald में लॉग लिखती हैं।

| डायरेक्टरी | उत्पाद | इमेज |
|---|---|---|
| `iot/` | HotLoop IoT, PostgreSQL 17 के साथ | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, TimescaleDB के साथ | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, TimescaleDB के साथ | `ghcr.io/hotloop-io/hotloop` |
| यह डायरेक्टरी | HotLoop Edge Relay, बिना डेटाबेस के | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[उत्पाद पेज](/hi/products/) बताता है कि आपको कौन सा चाहिए।

पहले तीन में से हर एक की एक `sqlite/` डायरेक्टरी भी है: वही उत्पाद, जिसमें डेटाबेस एक फ़ाइल है और कोई डेटाबेस कंटेनर नहीं। देखें [PostgreSQL की जगह SQLite](#postgresql-की-जगह-sqlite)।

## IoT, Edge और Gateway

हर डायरेक्टरी में वही यूनिट और एक स्क्रिप्ट है:

- **`hotloop.network`**: वह नेटवर्क जिसे ऐप और उसका डेटाबेस साझा करते हैं। ऐप डेटाबेस तक नाम (`hotloop-db:5432`) से पहुंचता है और मशीन पर कोई और नहीं पहुंच सकता, क्योंकि डेटाबेस कोई पोर्ट प्रकाशित नहीं करता। केवल ऐप का 8080 प्रकाशित है।
- **`hotloop.container`**: ऐप। इसके हेडर में इंस्टॉल के चरण हैं; कुछ भी कॉपी करने से पहले इसे पढ़ें।
- **`hotloop-db.container`**: डेटाबेस, वही इमेज और संस्करण जो उस उत्पाद का चार्ट चलाता है। यह जवाब देते ही शुरू होने की सूचना देता है, इसलिए ऐप ऐसे डेटाबेस का इंतज़ार करता है जिसे वह इस्तेमाल कर सके।
- **`hotloop-db-upgrade.container`** और **`hotloop-db-upgrade.sh`**: डेटाबेस का PostgreSQL 16 से 17 पर जाना, एक ही बार। यह डेटाबेस यूनिट से पहले चलता है और केवल तब जब वॉल्यूम में अभी 16 का डेटा हो; नए वॉल्यूम पर, या जो पहले से 17 पर है, systemd इसे छोड़ देता है। देखें [PostgreSQL 16 से 17](#postgresql-16-से-17)।
- **`hotloop-db.volume`** और **`hotloop-data.volume`**: डेटाबेस, और वह सब जो ऐप `/data` के नीचे लिखता है (बैकअप, प्रमाणपत्र, फ़ॉरवर्ड कतार, रिपोर्ट)। नामित Podman वॉल्यूम, इसलिए `podman system prune` इन्हें नहीं छूता।

तीन Podman सीक्रेट वह रखते हैं जो फ़ाइल में नहीं होना चाहिए: `hotloop-db-password`, `hotloop-secret-key` (डेटाबेस में डिवाइस के पासवर्ड एन्क्रिप्ट करता है; एक कॉपी मशीन के बाहर रखें) और `hotloop-admin-password-hash` (पहले एडमिन के पासवर्ड का bcrypt हैश, पासवर्ड कभी नहीं)।

**Podman 5.0 या नया।** Raspberry Pi OS Bookworm के साथ Podman 4.3 आता है, जिसमें Quadlet बिल्कुल नहीं है: Raspberry Pi OS Trixie (Podman 5.4) या नया इस्तेमाल करें। नीचे के अपडेट Podman 6.1.3 पर चलाए गए; Edge Relay की यूनिट, जो वही कुंजियां इस्तेमाल करती है, 4.9.3 पर। और डेटाबेस वॉल्यूम को SD कार्ड पर नहीं, USB SSD पर रखें। इतिहास दिन भर लिखता है, और SD कार्ड ठीक इसी से मरते हैं।

### सभी उत्पाद एक ही नाम क्यों इस्तेमाल करते हैं

यूनिट, वॉल्यूम और सीक्रेट के नाम `iot/`, `edge/` और `gateway/` में जानबूझकर एक जैसे हैं। किसी मशीन को ऊपर के उत्पाद पर ले जाना यानी बड़े उत्पाद की `hotloop.container` और `hotloop-db.container` को अपनी फ़ाइलों पर कॉपी करना:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

वॉल्यूम और सीक्रेट बने रहते हैं, और हर डिवाइस, टैग, अलार्म, यूज़र और इतिहास का हर घंटा भी। फिर भी पहले बैकअप लें (`POST /api/backup`)। यह कदम चलाया जा चुका है, एक ही वॉल्यूम सेट पर IoT से Edge और फिर Gateway तक। छोटे उत्पाद पर वापस जाना ऐसी मशीन पर करने की चीज़ नहीं जिसकी आपको परवाह है।

इसका मतलब यह भी है कि हर मशीन पर एक HotLoop। दो वैसे भी पोर्ट 8080 के लिए टकराएंगे।

### सत्यापित

IoT, Edge और Gateway की भेजी गई फ़ाइलें, बिना छेड़े, Podman 6.1.3 के `quadlet` जनरेटर के तहत उसी ढांचे के साथ बनती हैं: ऐप डेटाबेस और नेटवर्क पर निर्भर है, अपना पोर्ट प्रकाशित करता है और ऑटो-अपडेट लेबल रखता है, जबकि डेटाबेस कोई लेबल नहीं रखता और कुछ प्रकाशित नहीं करता।

फिर Gateway की यूनिटें सचमुच चलाई गईं: बिना root के, systemd के तहत, ghcr.io की जगह एक लोकल रजिस्ट्री और उत्पादों के अपने `podman auto-update` के साथ। डेटाबेस के स्वस्थ होने और उसके बाद ऐप के स्वस्थ होने वाली पहली शुरुआत; ऐसे रिलीज़ पर अपडेट जो ऐप की पहले से इस्तेमाल हो रही तालिका में माइग्रेशन जोड़ता है, मौजूदा डिवाइस और उसके डेटा के सुरक्षित रहते और डेटाबेस कंटेनर के कभी रीस्टार्ट हुए बिना; और ऐसे रिलीज़ पर अपडेट जो डेटाबेस माइग्रेट करता है और फिर शुरू नहीं हो पाता, जिसे Podman ने वापस किया, और पिछला रिलीज़ उस डेटाबेस पर स्वस्थ शुरू हुआ जिसे विफल वाला पहले ही माइग्रेट कर चुका था। Edge और IoT उन्हीं यूनिटों पर चलते हैं, और असली Pi पर, बेयर मेटल पर systemd के तहत चलाए जा चुके हैं (2026-11-17)।

## PostgreSQL 16 से 17

इस रिलीज़ से HotLoop का डेटाबेस PostgreSQL 17 है। जिस मशीन पर पहले का रिलीज़ चलता था उसमें PostgreSQL 16 का डेटा है, जिसे PostgreSQL 17 नहीं खोलेगा, इसलिए यह बदलाव एक यूनिट है जो डेटाबेस से पहले चलती है। नई फ़ाइलें जगह पर रखें और डेटाबेस रीस्टार्ट करें, बस इतना ही:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` को अपग्रेड यूनिट चाहिए, इसलिए जिस मशीन पर केवल नई डेटाबेस यूनिट कॉपी हुई वह 16 के डेटा पर शुरू नहीं होती और journal बताता है क्यों। अपग्रेड यूनिट पुरानी डायरेक्टरी के बगल की नई डायरेक्टरी में कॉपी मोड में `pg_upgrade` चलाती है, नया सर्वर एक बार शुरू करके साबित करती है कि वह खुलता है, और तभी नाम बदलती है; पुराना डेटा वॉल्यूम पर `pgdata.pg16` के रूप में रहता है। यह PostgreSQL 16 की इमेज तभी खींचती है जब वॉल्यूम को उसकी ज़रूरत हो। विफलता 16 का डेटा जैसा था वैसा छोड़ती है और डेटाबेस शुरू नहीं होता। पूरा विवरण, वापसी का रास्ता और `pgdata.pg16` को हटाने का तरीका [k3s और Helm](/hi/install/helm/#postgresql-17) में है। बिना root की इंस्टॉल में यूनिट के अंदर स्क्रिप्ट का पथ `~/.config/containers/systemd` है, `%E` से।

## PostgreSQL की जगह SQLite

डेटाबेस एक सेटिंग है, इमेज नहीं (k3s और Helm पेज, "SQLite")। Quadlet में इसका मतलब है फ़ाइलों का दूसरा सेट, दूसरी इमेज नहीं। हर उत्पाद की `sqlite/` डायरेक्टरी में दो हैं:

- **`sqlite/hotloop.container`**: केवल ऐप। डेटाबेस पर कोई `Requires=` नहीं, कोई नेटवर्क नहीं, कोई डेटाबेस पासवर्ड नहीं, और `HOTLOOP_DB_TYPE=sqlite` के साथ फ़ाइल `HOTLOOP_DB_PATH=/data/hotloop.db` पर। यह `:stable` का पालन करता है और खराब अपडेट को ठीक PostgreSQL यूनिट की तरह वापस करता है: वही स्वास्थ्य जांच, वही `--sdnotify=healthy`।
- **`sqlite/hotloop-data.volume`**: `hotloop-data` वॉल्यूम, जहां डेटाबेस फ़ाइल और उसके `-wal` और `-shm` रहते हैं। यह PostgreSQL फ़ाइलों वाला ही वॉल्यूम नाम है, इसलिए अगर आप कभी बदलें तो वही डेटा वॉल्यूम है।

| डायरेक्टरी | इंस्टॉल | सीक्रेट |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | तीन |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | दो: `hotloop-secret-key` और `hotloop-admin-password-hash` |

एक सेट इंस्टॉल करें या दूसरा, कभी दोनों नहीं: वे वही यूनिट नाम इस्तेमाल करते हैं। `sqlite/hotloop.container` के हेडर में सटीक चरण हैं। संक्षेप में:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

इसे चुनने से पहले कुछ बातें जान लें। SQLite एक लोकल डिस्क पर एक लिखने वाला है: Pi में वॉल्यूम USB SSD पर रखें, और नेटवर्क स्टोरेज विकल्प नहीं है क्योंकि SQLite उस पर खराब हो जाता है। इतिहास एक इंडेक्स वाली एक तालिका है, पार्टिशन या हाइपरटेबल नहीं, इसलिए हर सेकंड के इतिहास के सालों वाली साइट को PostgreSQL फ़ाइलें चाहिए। और किसी मशीन को SQLite और PostgreSQL के बीच ले जाना बैकअप और रीस्टोर है ([बैकअप और रीस्टोर](/hi/iot/backup/)), यूनिटों की अदला-बदली नहीं: नया डेटाबेस खाली शुरू होता है। "बदलने" के लिए चल रही PostgreSQL इंस्टॉल पर `sqlite/hotloop.container` कॉपी न करें; यह PostgreSQL वॉल्यूम का डेटा नहीं पढ़ता।

Edge या Gateway पर सादा PostgreSQL वही TimescaleDB यूनिट है जिसमें `hotloop.container` में `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` जोड़ा गया हो। IoT की यूनिट पहले से सादा PostgreSQL है, और IoT में TimescaleDB यूनिट है ही नहीं।

### सत्यापित (SQLite)

`iot/sqlite/hotloop.container` और उसका वॉल्यूम, कमिट की गई फ़ाइलों से, Podman 4.9.3 पर systemd (`systemctl --user`) के तहत बिना root के चलाए गए, जिनमें केवल नाम, पोर्ट, इमेज (उसी ट्री से बनी) और यूज़र मैनेजर के लिए ज़रूरी रनटाइम डायरेक्टरी बदली गई। यूनिट स्वस्थ शुरू हुई, `/healthz` और `/readyz` ने 200 दिया, एडमिन ने हैश सीक्रेट से लॉग इन किया, `/api/status` ने जवाब दिया, `hotloop.db`, `hotloop.db-wal` और `hotloop.db-shm` वॉल्यूम पर दिखे, और रीस्टार्ट ने कोई माइग्रेशन लागू नहीं किया और एडमिन को फिर लॉग इन कराया। Edge और Gateway की `sqlite/` यूनिटें इमेज और रिटेंशन के डिफ़ॉल्ट को छोड़कर वही फ़ाइल हैं, और असली Pi पर, बेयर मेटल पर root के रूप में systemd के तहत चलाई जा चुकी हैं (2026-11-17)।

## Edge Relay

- **`edge-relay-hold.conf`**: वैकल्पिक: जब तक ऑपरेटर मंज़ूरी न दे, इमेज अपडेट रोके रखता है। systemd का drop-in, डिफ़ॉल्ट इंस्टॉल का हिस्सा नहीं।
- **`edge-relay.container`**, सेवा खुद। इंस्टॉल के पूरे चरण उसके अपने हेडर की टिप्पणी में हैं; कुछ भी कॉपी करने से पहले उसे पढ़ें।
- **`edge-relay-data.volume`**, फ़ॉरवर्ड कतार के लिए एक नामित Podman वॉल्यूम, ताकि बफ़र की गई रीडिंग कंटेनर रीस्टार्ट के बाद भी बची रहें। सेवा पहली बार शुरू होने पर Podman इसे अपने आप बना देता है।
- **`devices.example.json`**, डिवाइस फ़ाइल के लिए शुरुआती बिंदु। इसे `/etc/edge-relay/devices.json` में कॉपी करें और इस साइट के असली डिवाइसों के लिए संपादित करें; पूरा फ़ॉर्मैट [Edge Relay संदर्भ](/hi/edge-relay/reference/) में है।

### त्वरित शुरुआत

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**अपडेट।** यूनिट `:stable` का पालन करती है और Podman का टाइमर चालू होते ही खुद को अपडेट करती है:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

अगर कोई नई इमेज अपनी स्वास्थ्य जांच पास नहीं करती, तो Podman पुरानी वापस रख देता है। Gateway की फ़्लीट सूची हर रिले का संस्करण और इमेज डाइजेस्ट दिखाती है और हर बदलाव दर्ज करती है। अपडेट तब तक रोकने के लिए जब तक कोई एडमिन Gateway पर मंज़ूरी न दे, उस फ़ाइल की शुरुआत की टिप्पणी के अनुसार `edge-relay-hold.conf` इंस्टॉल करें और टाइमर बंद करें। यह सब जो करता है, और जो नहीं कर सकता, [Edge Relay संदर्भ](/hi/edge-relay/reference/#updating-a-relay) में है।

लोकल फ़ाइल में बदलाव लागू करने के लिए: उसे संपादित करें, फिर `sudo systemctl restart edge-relay.service` चलाएं। रिले वह फ़ाइल बूट पर पढ़ता है और उसकी निगरानी नहीं करता।

Gateway जो डिवाइस फ़ाइल भेजता है उसे इनमें से कुछ नहीं चाहिए: वह रीस्टार्ट के बिना, सीधे लागू होती है। उसे `/etc/edge-relay/devices.json` में नहीं लिखा जा सकता (वह केवल-पढ़ने वाले root पर `:ro` माउंट है), इसलिए वह डेटा वॉल्यूम पर `/data/pushed-devices.json` के रूप में जाती है, और जब तक वह मौजूद है, रिले वही चलाता है और उसी से बूट होता है। लोकल फ़ाइल में आपके बदलाव तब तक बिना इस्तेमाल पड़े रहते हैं जब तक आप भेजी गई फ़ाइल साफ़ न करें: रिले चलते समय Gateway पर `DELETE /api/fleet/{id}/config`, और वह तुरंत लोकल फ़ाइल पर लौट आता है। journal बताता है कि वह किस फ़ाइल पर है, इसलिए अपने JSON पर शक करने से पहले वहां देखें।

असली `quadlet` बाइनरी (`podman-5.8.6` का `/usr/libexec/podman/quadlet -dryrun`) के विरुद्ध सत्यापित: दोनों यूनिटें बिना त्रुटि पार्स होती हैं और अपेक्षित `podman run` कॉल बनाती हैं, वॉल्यूम निर्भरता और सीक्रेट अपने आप जुड़े हुए।
