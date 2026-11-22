---
title: "नोड पैलेट"
description: "Flow के साथ आने वाला हर नोड प्रकार, पूर्ण, आंशिक, भिन्न या केवल Flow के रूप में चिह्नित, Node-RED से अंतर लिखित रूप में दर्ज।"
---

**संदेशों के लिए 117 नोड प्रकार, और FlowLab आरेखों के लिए 39 और।**

| श्रेणी | नोड |
|---|---|
| सामान्य | inject, debug, complete, catch, status, link in, link out, comment, junction |
| फ़ंक्शन | function, switch, change, range, template, delay, trigger, exec, rbe |
| नेटवर्क | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, और Node-RED के modbus-read/getter/flex-getter/write/flex-write/server नोड |
| अनुक्रम | split, join, sort, batch |
| पार्सर | csv, html, json, xml, yaml |
| स्टोरेज | file, file in, watch, influxdb out, postgres, postgresql |
| डैशबोर्ड | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, और पृष्ठ का लेआउट बनाने वाले ui_base, ui_tab, ui_group, ui_link और ui_spacer |
| खोज | scan, netinfo, OT सेगमेंट की सूची बनाने के लिए |
| कॉन्फ़िग | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

FlowLab वाली पंक्ति एक अलग तरह का नोड है। यह ऐसे टैब पर चलता है जो आरेख है, जहाँ नोड तब एक बार चलता है जब हर इनपुट में मान हो, और वह कभी संदेश नहीं लेता। FlowLab क्या है, और उसके लूप, एरर वायर, पैनल और डीबगर कैसे काम करते हैं, यह [FlowLab](/hi/flow/flowlab/) में है। एक फ़्लो फ़ाइल, और इसलिए आरेखों का एक सेट, उस हर Flow इंस्टॉलेशन पर पुश किया जा सकता है जो कोई टेनेंट EmberNet में चलाता है, हर एक जाँचा हुआ और विफल हुआ वापस रखा हुआ: [किसी टेनेंट के स्टेशनों पर पुश करना](/hi/flow/stations/)। दो इंस्टॉलेशन एक का काम साझा कर सकते हैं, उपकरणों पर हर लिखाई पर एक लीज़ और एक फ़ेंस के साथ ताकि केवल एक लिखे: [लीज़ के साथ वार्म स्टैंडबाय](/hi/flow/failover/)।

## लोगों को बताना, और Kafka

पाँच नोड वह चीज़ कहीं और भेजते हैं जो संदेश ले जाता है और संदेश को आगे बढ़ा देते हैं: **ntfy out**, **gotify out**, **discord out** (एक वेबहुक), **discord bot out** और **kafka out**। वे वही सेटिंग लेते हैं जिनसे HotLoop कोर अपने अलार्म और इवेंट भेजता है, इसलिए जिस प्लांट के पास पहले से ntfy टॉपिक, Gotify ऐप्लिकेशन, Discord वेबहुक या Kafka क्लस्टर है, वह Flow को उन्हीं की ओर इंगित करता है।

- **ntfy.** एक सर्वर कॉन्फ़िग नोड (पता, फिर एक एक्सेस टोकन या यूज़रनेम और पासवर्ड, या ऐसे सर्वर के लिए कुछ नहीं जो किसी को भी पब्लिश करने देता है), और प्रति नोड एक टॉपिक, एक शीर्षक, एक प्राथमिकता (min से max, या `msg.priority`), टैग और एक क्लिक पता। ख़ाली टॉपिक या शीर्षक `msg.topic` या `msg.title` लेता है। सार्वजनिक सर्वर पर टॉपिक ही एकमात्र रहस्य है, इसलिए उसे हर त्रुटि और स्थिति से बाहर रखा जाता है।
- **Gotify.** ऐप्लिकेशन के टोकन के साथ एक सर्वर कॉन्फ़िग नोड, और प्रति नोड एक शीर्षक और 0 से 10 की प्राथमिकता।
- **Discord वेबहुक।** वेबहुक URL ही पूरी क्रेडेंशियल है, नोड पर, और यह कभी किसी स्थिति, लॉग या त्रुटि में नहीं दिखता, उस नेटवर्क त्रुटि में भी नहीं जो पते का नाम लेती है। शीर्षक या रंग देने से संदेश एक एम्बेड बन जाता है। सामग्री 2,000 वर्णों पर और एम्बेड का विवरण 4,096 पर काटा जाता है, उसी तरह गिनकर जैसे Discord गिनता है, और संदेश में कुछ भी किसी को पिंग नहीं कर सकता।
- **Discord बॉट।** टोकन के साथ एक बॉट कॉन्फ़िग नोड, और प्रति नोड एक चैनल ID (या `msg.channel`)। यह बॉट के रूप में पोस्ट करता है और इसके लिए बॉट का चैनल में होना और भेजने की अनुमति होना ज़रूरी है।
- **Kafka out.** एक क्लस्टर कॉन्फ़िग नोड (ब्रोकर, SASL PLAIN या SCRAM-SHA-256 या SCRAM-SHA-512, TLS), और प्रति नोड एक टॉपिक और एक वैकल्पिक कुंजी। मान `msg.payload` है, टेक्स्ट के रूप में, या टेक्स्ट न होने पर JSON के रूप में, और संदेश तब आगे बढ़ता है जब क्लस्टर हर इन-सिंक रेप्लिका से उसे स्वीकार कर चुका हो। यह franz-go इस्तेमाल करता है, वही क्लाइंट जो कोर का Kafka आउटपुट इस्तेमाल करता है।

जो सर्वर अस्वीकार करता है वह नोड की त्रुटि में कारण बताता है, भेजी गई किसी चीज़ के बिना। दर सीमा का एक बार इंतज़ार किया जाता है, उतनी देर जितनी सर्वर कहे, अधिकतम एक मिनट तक, और उसके बाद संदेश विफल हो जाता है। कोई Slack या Teams नोड नहीं है, और कोई UADP नोड नहीं: HotLoop UADP लेता है और Flow उन मानों को HotLoop नोड के ज़रिए पढ़ता है।

असली ntfy, असली Gotify और असली Redpanda के विरुद्ध प्रमाणित: नोड पब्लिश करता है और सर्वर से पूछा जाता है कि उसके पास क्या है। Discord नोड वेबहुक और बॉट के लिए Discord के दर्ज API का पालन करते हैं।

`scan` एक CIDR रेंज खंगालता है और Modbus और EtherNet/IP एंडपॉइंट पहचानता है, और `netinfo` उन इंटरफ़ेस की रिपोर्ट देता है जो रनटाइम सचमुच देख सकता है, जो macvlan मोड में वह तरीक़ा है जिससे फ़्लो OT VLAN पर अपना पता खोजता है। Modbus TCP, S7, EtherNet/IP, OPC UA और Sparkplug B नोड अब उससे बात कर सकते हैं जो `scan` को मिलता है, और वे अगला खंड हैं।

हर नोड प्रकार के लिए एक Go डिस्क्रिप्टर उसकी प्रॉपर्टी, पोर्ट, डिफ़ॉल्ट और सहायता पाठ घोषित करता है, और एडिटर उसी से डायलॉग बनाता है, इसलिए कोई नोड ऐसे डायलॉग के साथ नहीं भेजा जा सकता जो उसके रनटाइम से मेल न खाए।
