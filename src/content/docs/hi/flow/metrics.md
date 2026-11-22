---
title: "Flow मेट्रिक्स"
description: "Flow प्रति नोड जो Prometheus मेट्रिक्स देता है, ताकि फँसा हुआ वायर या भरा इनबॉक्स आउटेज बनने से पहले ग्राफ़ पर दिख जाए।"
---

`/metrics` पर Prometheus, प्रति नोड, और हर प्रति-नोड चीज़ पर `node` और `type` लेबल के साथ। कोई एक्सपोर्टर साइडकार नहीं, क्योंकि एज बॉक्स में उसके लिए जगह नहीं होती और आपको यह जानने के लिए दूसरे कंटेनर की ज़रूरत नहीं होनी चाहिए कि आपका इनबॉक्स भर गया है।

| मेट्रिक | प्रकार | यह आपको क्या बताता है |
|---|---|---|
| `hotloop_flow_build_info` | gauge | हमेशा 1। संस्करण लेबल में रहता है। |
| `hotloop_flow_uptime_seconds` | gauge | रनटाइम शुरू होने के बाद के सेकंड। |
| `hotloop_flow_nodes_running` | gauge | इस समय चल रहे नोड इंस्टेंस। |
| `hotloop_flow_node_messages_received_total` | counter | किसी नोड तक पहुँचाए गए संदेश। |
| `hotloop_flow_node_messages_sent_total` | counter | किसी नोड द्वारा भेजे गए संदेश। |
| `hotloop_flow_node_errors_total` | counter | किसी नोड द्वारा उठाई गई त्रुटियाँ। |
| `hotloop_flow_node_schema_mismatches_total` | counter | वे संदेश जिन्होंने किसी नोड पर JSON स्कीमा तोड़ा: उसके इनपुट पोर्ट पर, किसी आउटपुट पोर्ट पर, या `json` नोड में। हर एक हर गलत फ़ील्ड के पाथ के साथ Catch नोड तक गया। |
| `hotloop_flow_node_messages_dropped_total` | counter | इनबॉक्स भरा होने के कारण छोड़े गए संदेश। |
| `hotloop_flow_node_sends_blocked_total` | counter | कितनी बार भेजने वाले ने जगह के लिए इंतज़ार किया। लगातार बैक-प्रेशर, जो इस बात का असली संकेत है कि फ़्लो साथ नहीं दे पा रहा। |
| `hotloop_flow_node_queue_length` | gauge | अभी प्रतीक्षा में संदेश। |
| `hotloop_flow_node_queue_capacity` | gauge | जहाँ से ओवरफ़्लो नीति लागू होने लगती है। |
| `hotloop_flow_node_queue_high_water` | gauge | वह सबसे गहरा स्तर जहाँ वह इनबॉक्स कभी पहुँचा। |
| `hotloop_flow_goroutines` | gauge | लगभग हर नोड के लिए एक, साथ में वह I/O जो हर एक थामे रखता है। |
| `hotloop_flow_memory_heap_bytes` | gauge | इस समय आवंटित हीप। |
| `hotloop_flow_memory_sys_bytes` | gauge | OS से लिए गए बाइट। |
| `hotloop_flow_gc_cycles_total` | counter | पूरे हुए GC चक्र। |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | वे डिप्लॉयमेंट जो git मिरर के रिमोट में अभी नहीं हैं। केवल मिरर के साथ। |
| `hotloop_flow_git_mirror_push_failures_total` | counter | मिरर पर वे पुश जो विफल हुए और दोबारा आज़माए जाएँगे। |
| `hotloop_flow_git_mirror_pushes_total` | counter | मिरर पर वे पुश जो सफल हुए। |
| `hotloop_flow_durable_wire_depth` | gauge | डिस्क पर, टिकाऊ वायर पर प्रतीक्षा करते संदेश। लेबल `wire`। |
| `hotloop_flow_durable_wire_bytes` | gauge | उस वायर के प्रतीक्षारत संदेशों पर लगाया गया कोटा। |
| `hotloop_flow_durable_wire_delivered_total` | counter | वे संदेश जो वायर ने सौंपे और लक्ष्य ने ले लिए। |
| `hotloop_flow_durable_wire_retries_total` | counter | कितनी बार वायर ने कोई संदेश दोबारा भेजा क्योंकि उसके लक्ष्य ने उसे विफल किया। बंद पड़ा लक्ष्य इसे बढ़ाता है। |
| `hotloop_flow_durable_wire_given_up_total` | counter | वे संदेश जिन पर वायर ने दोबारा कोशिश बंद कर दी क्योंकि नोड का `ew_durable_attempts` ख़त्म हो गया। हर एक संदेश संलग्न त्रुटि के रूप में फ़्लो तक गया। |
| `hotloop_flow_durable_wire_dropped_total` | counter | वे संदेश जिन्हें कोटा नीति ने अस्वीकार किया या बाहर किया, और वे कतारें जो वायर के टिकाऊ न रहने पर साफ़ की गईं। |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | सभी टिकाऊ वायर द्वारा मिलकर इस्तेमाल किया गया कोटा, और स्वयं कोटा। |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | कॉन्टेक्स्ट लिखने वाले ट्रांज़ैक्शन, और वे पंक्तियाँ जो उन्होंने वास्तव में बदलीं। |
| `hotloop_flow_context_flush_failures_total` | counter | कॉन्टेक्स्ट फ़्लश जो विफल हुए। बदलाव सुरक्षित रखे जाते हैं और दोबारा आज़माए जाते हैं। शून्य होना चाहिए। |
| `hotloop_flow_audit_write_failures_total` | counter | ऑडिट प्रविष्टियाँ जो लिखी नहीं जा सकीं। हमेशा शून्य होना चाहिए। |
| `hotloop_flow_traces_kept` | gauge | अभी बफ़र में मौजूद संदेश ट्रेस। |
| `hotloop_flow_trace_bytes` | gauge | मोटे तौर पर वे कितना घेरते हैं। `trace.maxBytes` से सीमित। |
| `hotloop_flow_traces_started_total` | counter | शुरू किए गए संदेश ट्रेस। |
| `hotloop_flow_traces_forgotten_total` | counter | जगह बनाने के लिए बाहर किए गए ट्रेस। |
| `hotloop_flow_traces_skipped_total` | counter | वे संदेश जिनका ट्रेस नहीं हुआ क्योंकि `trace.perSecond` पूरा हो गया। |
| `hotloop_flow_trace_hops_dropped_total` | counter | वे हॉप जो दर्ज नहीं हुए: उनका ट्रेस भर गया था या पहले ही भुला दिया गया था। |
| `hotloop_flow_otlp_spans_exported_total` | counter | वे स्पैन जो OpenTelemetry कलेक्टर ने स्वीकार किए। केवल एंडपॉइंट के साथ। |
| `hotloop_flow_otlp_spans_dropped_total` | counter | वे स्पैन जो एक्सपोर्ट कतार भरी होने से छोड़े गए। |
| `hotloop_flow_otlp_spans_failed_total` | counter | वे स्पैन जो दोबारा कोशिश के बाद भी कलेक्टर ने नहीं लिए। शून्य से ऊपर का मतलब है कि वह उन्हें पा नहीं रहा। |

जिस पर अलर्ट लगाना चाहिए वह `hotloop_flow_node_queue_capacity` के मुक़ाबले `hotloop_flow_node_queue_high_water` है। हाई वाटर इस बात की शुरुआती चेतावनी है कि फ़्लो अपनी सीमा के क़रीब पहुँच रहा है, जो कुछ भी छोड़े जाने से पहले और किसी के जागने से बहुत पहले आती है। वह अलर्ट ही वह पूरा कारण है जिसके लिए हमने सीमित इनबॉक्स बनाया। जो सीमा मौजूद ही नहीं, उसके कितने क़रीब हैं, यह आप बता नहीं सकते, इसलिए सीमा का पहले होना ज़रूरी था।
