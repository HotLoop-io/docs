---
title: "एजेंट के लिए MCP"
description: "एजेंट को पूरा प्लांट पढ़ने दें और केवल वही छूने दें जो आपने सक्रिय किया है, राइट गेट से, हर राइट के साथ दर्ज बताए गए कारण के साथ।"
---

गेटवे दोनों दिशाओं में MCP बोलता है: एजेंट प्लांट को पढ़ और चला सकते हैं, और ऑटोमेशन नियम कहीं और का टूल कॉल कर सकता है।

डिज़ाइन नियम यह है कि **एजेंट किसी भी दूसरे कॉलर जैसा एक कॉलर है**। टूल उसी कैश से पढ़ते हैं जिससे UI पढ़ता है और उसी गेट से लिखते हैं जिससे UI लिखता है। कोई विशेषाधिकार वाला रास्ता नहीं, कोई बायपास नहीं, कोई अलग नीति नहीं। जो राइट किसी ऑपरेटर को अस्वीकार होता वह अस्वीकार होता है; जो राइट सफल होता है वह उसी ऑडिट टेबल में एक्टर के आगे `mcp:` के साथ दर्ज होता है।

## सेवा देना

### HTTP पर

ऐप के पोर्ट पर `/mcp` पर डिफ़ॉल्ट रूप से चालू, उस bearer टोकन से सुरक्षित जो चार्ट रिलीज़ के Secret में बनाता है।

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

क्लस्टर के भीतर, एंडपॉइंट है:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

टोकन की जांच हैंडलर के आगे बैठी है, इसलिए बिना प्रमाणीकरण वाला कॉलर यह गिन भी नहीं सकता कि क्या मौजूद है। `mcp.token` खाली छोड़ने पर चार्ट एक बनाता है, डिफ़ॉल्ट डिप्लॉयमेंट गलती से खुला वाला नहीं है। इसे NetworkPolicy के साथ मिलाएं; टोकन बचाव की दूसरी पंक्ति है, अकेली नहीं।

एंडपॉइंट कभी खुला नहीं होता। बाइनरी को `HOTLOOP_MCP_TOKEN` के बिना चलाएं (एक Quadlet यूनिट, एक सादा `hotloop`) और वह पहली शुरुआत पर एक टोकन बनाती है और उसे अपने डेटाबेस में रखती है, इसलिए रीस्टार्ट के बाद, हर रेप्लिका पर और रिस्टोर के बाद वही लौटता है। `hotloop mcp-token` उसे प्रिंट करता है (लॉग कहता है कि उसने एक बनाया, और कभी यह नहीं कि वह क्या है)। अपना चुनने के लिए `HOTLOOP_MCP_TOKEN` सेट करें; `HOTLOOP_MCP_OIDC_*` सेट होने पर एंडपॉइंट लॉगिन लेता है और अपना कोई टोकन नहीं रखता। जो क्लाइंट पहले बिना कुछ के सादी बाइनरी से जुड़ता था उसे अब तब तक `401` मिलता है जब तक वह `Authorization: Bearer <that token>` न भेजे।

### Vord लॉगिन या हब असर्शन के साथ

स्थिर टोकन बताता है कि कौन-सा क्लाइंट कॉल कर रहा है; यह नहीं बता सकता कि कौन-सा व्यक्ति। OIDC सेट होने पर `/mcp` `Authorization: Bearer <jwt>` भी लेता है, और सत्यापित व्यक्ति का ईमेल ऑडिट एक्टर बन जाता है: राइट `mcp:<client name>` की जगह `mcp:pat@example.com` के रूप में दर्ज होता है। इसके बिना व्यवहार नहीं बदलता, और स्थिर टोकन उसके बगल में काम करता रहता है (स्थिर टोकन सेट न होने पर केवल सत्यापित JWT अंदर आता है)।

| वेरिएबल | चार्ट मान | क्या करता है |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | Vord realm का URL; उसके एक्सेस टोकन स्वीकार करता है |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | वह `aud` जो हर टोकन में होना चाहिए; इन दोनों में से किसी के साथ आवश्यक |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | पहचान हब की असर्शन कुंजियां; उसके असर्शन स्वीकार करता है |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | realm की एक भूमिका जो कॉलर के पास होनी चाहिए |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | प्रति कॉलर राइट सीमित करता है, नीचे देखें |

Vord एक्सेस टोकन की जांच जारीकर्ता के JWKS से होती है (उसके डिस्कवरी दस्तावेज़ से मिला, दस मिनट कैश, अज्ञात `kid` पर फिर लाया गया): केवल RS256 या ES256, `iss` जारीकर्ता के बराबर, `aud` में ऑडिएंस शामिल, `exp` और `nbf` 30 s की छूट के साथ, और एक `email` (या `preferred_username`) क्लेम। Vord डिफ़ॉल्ट रूप से `aud` में केवल `account` रखता है; जो ऑडिएंस आप सेट करें उसके लिए क्लाइंट स्कोप को एक audience mapper दें।

हब असर्शन `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` कॉन्फ़िगर किया गया ऑडिएंस (Hub मॉड्यूल `hotloop` भेजता है), समाप्त नहीं हुआ, Hub के JWKS की किसी कुंजी से हस्ताक्षरित होता है। कोई `jti` रीप्ले कैश नहीं है: एक टूल कॉल कई HTTP अनुरोध हैं (initialize, फिर कॉल) जो वही असर्शन लेकर चलते हैं, जो 60 s जीता है। जब Hub कहता है कि कॉल किसी और की ओर से हो रही है (`acting_as`), एक्टर `mcp:<email> for <acting_as email>` पढ़ा जाता है।

राइट को अब भी `HOTLOOP_ALLOW_WRITES` चाहिए, मास्टर स्विच; टोकन इसे कभी नहीं बढ़ाता। `HOTLOOP_MCP_OIDC_WRITE_ROLE` उन्हें प्रति कॉलर सीमित करता है: `hotloop:hotloop.write` का मतलब क्लाइंट `hotloop` पर Vord क्लाइंट भूमिका `hotloop.write` (`resource_access.hotloop.roles`), सादा नाम का मतलब realm भूमिका, और Hub असर्शन को `abilities` में भूमिका का नाम रखना होगा। जिस कॉलर के पास यह नहीं है वह पढ़ सकता है लेकिन `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` और कॉन्फ़िगरेशन बदलने वाला हर टूल अस्वीकार करता है। स्थिर टोकन इससे सीमित नहीं है।

### stdio पर

वही बाइनरी `--mcp-stdio` के साथ stdin और stdout पर MCP परोसती है, उस क्लाइंट के लिए जो उसे सीधे चलाता है। बाकी सब भी शुरू होता है, इसलिए एजेंट खोखले सर्वर की जगह जीवित प्लांट देखता है।

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

stdio मोड में सारी लॉगिंग stderr पर जाती है। stdout पर लिखी कोई भी चीज़ प्रोटोकॉल स्ट्रीम को बिगाड़ देगी।

## टूल

एक सौ इकहत्तर: सत्ताईस जो प्लांट को पढ़ते और कमांड देते हैं, उनहत्तर जो उसका कॉन्फ़िगरेशन बदलते हैं ([नीचे](#कॉन्फ़िगरेशन-बदलना)), तैंतीस रीड और ड्राई रन जो उनके साथ हैं ([नीचे](#रीड-और-ड्राई-रन)) और बयालीस प्रशासन के लिए ([नीचे](#प्रशासन))।

| टूल | क्या करता है |
|---|---|
| `get_plant_status` | ऑनलाइन डिवाइस, लंबित अलार्म, राइट सक्षम हैं या नहीं |
| `list_devices` | प्रोटोकॉल, पते, स्थिति, टैग संख्या के साथ हर डिवाइस |
| `describe_device` | एक डिवाइस विस्तार में, उसके टैग और पोल आंकड़ों के साथ |
| `list_tags` | डिवाइस, नाम या विवरण से कैटलॉग खोजता है |
| `read_tag` | गुणवत्ता के साथ वर्तमान मान |
| `query_history` | ऐतिहासिक रीडिंग, कच्ची या बकेट में |
| `write_tag` | **किसी टैग को कमांड देता है** |
| `list_alarms` | अलार्म और उनकी ISA-18.2 स्थितियां |
| `ack_alarm` | ऑपरेटर की ओर से स्वीकार करता है |
| `list_automations` | नियम, रन की गिनती, अंतिम नतीजा |
| `trigger_automation` | एक नियम अभी चलाता है |
| `describe_protocol` | यह बिल्ड असल में क्या बोलता है |
| `recent_events` | सिस्टम लॉग, यह पता लगाने के लिए कि क्या किस क्रम में हुआ |
| `list_entities` | डोमेन, उपकरण नोड या लेबल से एंटिटी खोजता है, हर एक के लिए वे सेवाएं जो वह लेती है |
| `get_states` | एक या अधिक एंटिटी की वर्तमान स्थिति, गुणवत्ता और एट्रिब्यूट के साथ |
| `call_service` | **किसी एंटिटी को कमांड देता है**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | स्थिति बदलाव, राइट, अलार्म, रन और कॉन्फ़िगरेशन बदलाव की एक ही समयरेखा, एंटिटी, उपकरण नोड, एक्टर या प्रकार के अनुसार |
| `list_scripts` | प्लांट की स्क्रिप्ट, हर एक जो फ़ील्ड लेती है, वह चल रही है या नहीं, उसका अंतिम रन |
| `run_script` | **एक स्क्रिप्ट चलाता है**, या `dryRun` से पूछता है कि वह अभी क्या करेगी |
| `list_recipes` | प्लांट की रेसिपी: क्रम में लक्ष्य, पैरामीटर, पूर्व शर्त, संस्करण, अंतिम अनुप्रयोग |
| `validate_recipe` | क्या रेसिपी अभी लागू होगी? हर वह कारण जिससे वह अस्वीकार होगी; कुछ नहीं लिखा जाता |
| `apply_recipe` | **एक रेसिपी लागू करता है**: पूरी जांची गई, क्रम में लिखी गई, वापस पढ़ी गई |
| `list_blueprints` | वे ब्लूप्रिंट जो लोग नियम बनाने के लिए भरते हैं, उनके इनपुट और संस्करण |
| `preview_blueprint` | दिए गए इनपुट के साथ ब्लूप्रिंट जो नियम बनाएगा, और वह अभी क्या करेगा; कुछ नहीं बनाता |
| `find_network_client` | प्लांट नेटवर्क पर कोई डिवाइस कहां है: उसका स्विच पोर्ट, पोर्ट पर लिंक है या नहीं, UniFi कंसोल ने उसे आख़िरी बार कब देखा |
| `get_network_topology` | प्लांट नेटवर्क जैसा UniFi कंसोल उसे बनाता है: क्या किससे जुड़ा है, हर डिवाइस की स्थिति, और वे HotLoop डिवाइस जो उसके गिरने पर अपना नेटवर्क खो देते हैं |
| `get_network_events` | UniFi कंसोल की बताई सबसे नई घटनाएं, और उसका इवेंट वेबसॉकेट जीवित है या नहीं |

### एंटिटी

एंटिटी वह है जिसे लोग प्लांट की किसी चीज़ का नाम देते हैं, `sensor.zone_1_temperature` या `switch.conveyor_run`, जो एक या अधिक टैग को लपेटती है। देखें [एंटिटी](/hi/iot/entities/)। एजेंट के लिए वे आम तौर पर बेहतर पकड़ हैं: नाम का मतलब होता है, और एंटिटी जानती है कि उसके साथ क्या किया जा सकता है।

`list_entities` `domain` से, `equipment` से (उपकरण ट्री का एक नोड id, नाम या नामों के पथ जैसे `Plant A/Packing` से, जो उसमें या उसके नीचे की हर चीज़ से मेल खाता है, एंटिटी की अपनी जगह उसके डिवाइस की जगह पर भारी पड़ती है), `label` से (label_id या नाम; एंटिटी मेल खाती है अगर उसके पास लेबल है या उसके डिवाइस के पास) और `query` से, entity_id या नाम का एक उप-स्ट्रिंग, फ़िल्टर करता है। हर नतीजा अपनी वर्तमान स्थिति और गुणवत्ता और वे सेवाएं लेकर आता है जो वह लेती है, `domain.service` के रूप में। बिना सेवाओं वाली एंटिटी केवल पढ़ने योग्य है। सेवाएं एंटिटी परत से आती हैं, इसलिए जिस डोमेन को वहां एक मिलती है वह यहां बिना बदलाव के दिखता है।

`get_states` `entity_ids` लेता है और हर एक का जवाब उसकी स्थिति, गुणवत्ता, एट्रिब्यूट और `last_changed` से देता है। वह वही रेखा रखता है जो `read_tag` रखता है: `unknown` या `unavailable` स्थिति का जवाब इस नोट के साथ दिया जाता है कि वह मान नहीं है, अक्षम एंटिटी लापता कहने के बजाय कहती है कि वह अक्षम है, और खराब गुणवत्ता स्पष्ट लिखी जाती है।

`call_service` `domain`, `service`, `entity_id`, `data` और एक **आवश्यक** `reason` लेता है:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

यह `entity.Services` से गुज़रता है, वही निष्पादक जो `POST /api/services/...` इस्तेमाल करता है, जो कॉल को राइट गेट से होकर राइट में बदल देता है। देखें [राइट](#राइट)।

### नेटवर्क

`find_network_client` शांत हो गए PLC के बारे में पहले सवाल का जवाब देता है: क्या यह PLC है, या उसका स्विच पोर्ट? इसे `deviceId` दें और यह उस डिवाइस के पुष्ट लिंक को उसके UniFi क्लाइंट तक अनुसरित करता है; इसे `query` दें (MAC, IP या नाम का हिस्सा) और यह HotLoop द्वारा पढ़े जाने वाले हर कंसोल में खोजता है। यह UniFi ड्राइवर की आख़िरी रीडिंग पढ़ता है, कंसोल को कभी नहीं, इसलिए लूप में पूछने वाला एजेंट कंसोल को कुछ नहीं खर्च कराता। इसका मतलब यह भी है कि `--mcp-stdio` सहायक जवाब देता है कि उसकी प्रक्रिया में कोई कंसोल नहीं पढ़ा जाता: वह कभी किसी में लॉगिन नहीं करता, क्योंकि उसके बगल का Gateway पहले से सत्र रखता है। Gateway के एंडपॉइंट से पूछें। देखें [UniFi Network](/hi/iot/unifi/)।

`get_network_topology` नक्शा है: हर स्विच, एक्सेस पॉइंट और गेटवे उसके नीचे जिससे वह जुड़ा है, दोनों सिरों पर पोर्ट, लिंक, उस पर कितने क्लाइंट हैं और नीचे के किसी क्लाइंट से जुड़े HotLoop डिवाइस के साथ। वह आख़िरी हिस्सा असर का दायरा है: वह उन PLC के नाम बताता है जो उस स्विच के गिरने पर अपना नेटवर्क खो देते हैं। जिस स्विच को कंसोल किसी से जुड़ा नहीं बताता वह यही कहता है और गेटवे से लटकाया नहीं जाता। `get_network_events` कंसोल की सबसे नई घटनाएं हैं, सबसे नई पहले, उसके अपने वाक्य के साथ, जहां कंसोल उसे नकारात्मक कहता है वहां चेतावनी फ़्लैग, और इवेंट वेबसॉकेट जीवित है या नहीं। दोनों कंसोल का `deviceId` लेते हैं, जिसे तब छोड़ा जा सकता है जब HotLoop केवल एक पढ़ता है, और दोनों `find_network_client` की तरह ड्राइवर की आख़िरी रीडिंग पढ़ते हैं, इसलिए कंसोल को कुछ नहीं खर्च कराते और `--mcp-stdio` सहायक में वही कहते हैं: उस प्रक्रिया में कोई कंसोल नहीं पढ़ा जाता। पुरानी घटनाएं `get_logbook` में हैं, उस स्विच या एक्सेस पॉइंट के नीचे दर्ज जिसके बारे में वे थीं।

### लॉगबुक

`get_logbook` वह समयरेखा है जो `GET /api/logbook` परोसता है (देखें [लॉगबुक](/hi/iot/logbook/)): स्थिति बदलाव, राइट, अलार्म संक्रमण, ऑटोमेशन रन और कॉन्फ़िगरेशन बदलाव, सबसे नई पहले। यह `entity` से, `equipment` से (id, नाम या पथ, और उसके नीचे की हर चीज़; जो नाम दो नोड से मेल खाए वह त्रुटि है जो दोनों गिनाती है), `actor` से (उसका हिस्सा: `mcp:` हर वह चीज़ ढूंढता है जो किसी भी एजेंट ने की), `kinds` से, और `minutes` पीछे से (डिफ़ॉल्ट एक दिन) सीमित होता है। जिस पेज के बाद और है वह यह बताकर खत्म होता है कि अगले के लिए `before` के रूप में क्या देना है। "यह बिगड़ने से पहले क्या हुआ" के लिए यह बेहतर `recent_events` है: उपकरण के अपने स्थिति बदलाव इसमें हैं, और राइट गेट की पंक्तियां इसमें दो बार नहीं हैं।

### स्क्रिप्ट

स्क्रिप्ट चरणों का एक नाम वाला क्रम है जिसे किसी ने एक बार लिखा, CIP चक्र या लाइन पर्ज, ताकि एजेंट कोई प्रक्रिया गढ़ने की बजाय प्लांट की अपनी प्रक्रिया चलाए। देखें [स्क्रिप्ट](/hi/iot/scripts/)। `list_scripts` बताता है कि हर एक क्या लेती है। `run_script` `scriptId`, `fields`, एक **आवश्यक** `reason`, और दो स्विच लेता है:

- `dryRun: true` स्क्रिप्ट को प्लांट के खिलाफ़ वैसे ही चलाकर देखता है जैसा वह है और बताता है, चरण दर चरण, क्या लिखा जाएगा और पहली चीज़ जो गेट अस्वीकार करेगा, गेट के अपने शब्दों में। कुछ नहीं लिखा या ऑडिट किया जाता। यह पहले पूछें।
- `wait: true` रन के खत्म होने पर जवाब देता है, उसके नतीजे और ट्रेस के साथ। इसके बिना जवाब रन id है, और `list_scripts` या `kinds: ["script"]` के साथ `get_logbook` बताता है कि वह कैसे खत्म हुआ।

रन स्क्रिप्ट का है, `script:<id>` के रूप में, स्रोत `mcp` के साथ, इसलिए हर राइट जो वह करती है गेट से ठीक `write_tag` की तरह मिलती है। राइट बंद होने पर (`HOTLOOP_ALLOW_WRITES`), `run_script` कुछ भी चलने से पहले अस्वीकार करता है, जैसे `trigger_automation` करता है; ड्राई रन का फिर भी जवाब दिया जाता है, और बताता है कि स्विच कारण है।

### रेसिपी

रेसिपी सेटपॉइंट का एक समूह है जिसे प्लांट साथ लागू करता है, एक उत्पाद ग्रेड या चेंजओवर, ताकि एजेंट प्लांट के अपने नंबर लोड करे, उन्हें एक एक करके लिखने की बजाय। देखें [रेसिपी](/hi/iot/recipes/)। `list_recipes` हर एक के लक्ष्य क्रम में और वे पैरामीटर दिखाता है जो वह लेती है। `validate_recipe` पूछता है कि क्या कोई अभी लागू होगी और हर कारण देता है कि क्यों नहीं, बिना कुछ लिखे। `apply_recipe` `recipeId`, `params`, वैकल्पिक `version` और **आवश्यक** `reason` लेता है।

यह पहले पूरी जांची जाती है और पूरी अस्वीकार होती है, कुछ लिखे बिना, अगर कोई मान अस्वीकार होता; सीमा से बाहर के मान अस्वीकार होते हैं, कभी समायोजित नहीं। फिर लक्ष्य क्रम में एक कॉल id के तहत बाहर जाते हैं, पहला जो विफल हो बाकी को रोकता है, और कुछ पलटा नहीं जाता। जवाब बताता है, लक्ष्य दर लक्ष्य, क्या गया और डिवाइस ने मान वापस पढ़ा या नहीं। राइट एजेंट के हैं, स्रोत `mcp` के साथ, इसलिए गेट हर एक पर लागू होता है; राइट बंद होने पर (`HOTLOOP_ALLOW_WRITES`), `apply_recipe` कुछ जांचने से पहले अस्वीकार करता है। जो रेसिपी अपनी लागू करने की अनुमति का नाम लेती है वह उन लोगों के लिए है जिन्हें वह दी गई है, और एजेंट उनमें नहीं है।

### ब्लूप्रिंट

ब्लूप्रिंट एक बार लिखा गया नियम है जिसमें टाइप किए खाली स्थान हैं: कौन-सी मोटर, कितनी देर, कौन-सी सीमा। देखें [ब्लूप्रिंट](/hi/iot/blueprints/)। `list_blueprints` बताता है कि हर एक क्या लेता है। `preview_blueprint` `blueprintId`, `automationId` और `inputs` लेता है, और जवाब देता है कि वह कौन-सा नियम बनाएगा और वह नियम अभी चले तो क्या करेगा, हर राइट गेट की जांचों के सामने रखी जाती है। इनपुट ठीक वैसे जांचे जाते हैं जैसे स्क्रीन जांचती है: सीमा से बाहर अस्वीकार होता है, समायोजित नहीं।

`instantiate_blueprint` नियम बनाता है, उस रास्ते से जो ब्लूप्रिंट स्क्रीन इस्तेमाल करती है: वही जांचें, और नियम लॉगबुक में एजेंट को बनाने वाले के रूप में दर्ज होता है। नियम हर बार जब उसका ट्रिगर चले उपकरण को कमांड देने का स्थायी आदेश है, इसलिए एजेंट पहले देखता है: `preview_blueprint` कुछ संग्रहीत नहीं करता और कुछ नहीं लिखता, और राइट चालू हों या नहीं, उसका जवाब दिया जाता है। हर राइट जो बनाया गया नियम आगे करता है, राइट गेट से मिलती है, जैसे किसी इंसान के बनाए नियम के लिए। देखें [कॉन्फ़िगरेशन बदलना](#कॉन्फ़िगरेशन-बदलना)।

## कॉन्फ़िगरेशन बदलना

जो कुछ एजेंट पढ़ सकता है, वह उसे बदल भी सकता है। ऊपर के जो टूल प्लांट को पढ़ते हैं उनके समकक्ष हैं जो उसे बदलते हैं, उनहत्तर, और कोई भी दूसरा कार्यान्वयन नहीं है: हर एक REST API का एक रूट है, और कॉल उस रूट के अपने हैंडलर से होकर चलती है। सत्यापन, अनुमति जांच, रनटाइम रीलोड और ऑडिट पंक्ति रूट की हैं, एजेंट एक्टर के रूप में (`mcp:<client>`, या Vord लॉगिन के साथ `mcp:<email>`), इसलिए बिना ड्राइवर का डिवाइस, ऐसा नियम जो कंपाइल नहीं होता, सीमा से बाहर का ब्लूप्रिंट इनपुट या वह टैग जिसके लिए खोजा गया डिवाइस स्वीकार नहीं हुआ, उन्हीं शब्दों में अस्वीकार होते हैं जो स्क्रीन दिखाती है, और कुछ नहीं बदला।

हर एक रूट के पथ मान नाम से लेता है (`id`, `device`, `name`...), `body`, वही JSON जो API लेता है ([HTTP API](/hi/iot/api/) में हर body है), और एक **आवश्यक** `reason`। कारण सिस्टम लॉग में `config` पंक्ति के रूप में रूट की अपनी पंक्ति के बगल में दर्ज होता है, बदली गई चीज़ के विरुद्ध।

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

उनके आगे जो खड़ा है वही है जो `write_tag` के आगे खड़ा है, मास्टर स्विच को छोड़कर, क्योंकि स्क्रीन को भी कॉन्फ़िगरेशन बदलने के लिए उसकी ज़रूरत नहीं होती:

1. `HOTLOOP_ALLOW_MCP_WRITES`, डिफ़ॉल्ट रूप से चालू, चालू होना चाहिए।
2. जिस कॉलर के लिए `HOTLOOP_MCP_OIDC_WRITE_ROLE` सेट है उसके पास वह होनी चाहिए।
3. कॉल एक अनुमति लेकर चलती है, वह जो उसका रूट मांगता है (नीचे तीसरा कॉलम), और कुछ नहीं। रूट एजेंट को वैसे ही जवाब देता है जैसे उस अनुमति के बिना किसी इंसान को, और एक टेस्ट तालिका की हर पंक्ति को असली रूट और उस अनुमति से बांधता है जो वह रूट मांगता है।
4. एक कारण।

उपकरण को कमांड देना अब भी `write_tag`, `call_service`, `run_script`, `apply_recipe` और `trigger_automation` है, `HOTLOOP_ALLOW_WRITES` चालू और टैग के लिखने योग्य चिह्न और सीमा के पूरा होने के साथ। टैग, नियम, स्क्रिप्ट या रेसिपी को लिखने योग्य बनाना कॉन्फ़िगरेशन है: वह तब तक कुछ कमांड नहीं करता जब तक इस्तेमाल न हो, और जो वह तब कमांड करता है वह गेट से होकर जाता है।

प्रशासक के अपने कार्य भी टूल हैं, नीचे [प्रशासन](#प्रशासन) में। खोजे गए डिवाइस को स्वीकार करना यहां है, जैसे स्क्रीन पर; उस पर के पॉइंट को अब भी राइट के लिए एक-एक करके सक्रिय करना होगा।

टूल `--mcp-stdio` में भी मौजूद हैं: प्रक्रिया वही API सर्वर बनाती है, और अपना पोर्ट कभी नहीं खोलती।

**डिवाइस और टैग**

| टूल | रूट | अनुमति |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**डिस्कवरी और ब्रोकर**

| टूल | रूट | अनुमति |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| टूल | रूट | अनुमति |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**एंटिटी, हेल्पर, उपकरण, लेबल**

| टूल | रूट | अनुमति |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**अलार्म**

| टूल | रूट | अनुमति |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**ऑटोमेशन और ब्लूप्रिंट**

| टूल | रूट | अनुमति |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**स्क्रिप्ट और रेसिपी**

| टूल | रूट | अनुमति |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**डैशबोर्ड और बोर्ड**

| टूल | रूट | अनुमति |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**इम्पोर्ट**

| टूल | रूट | अनुमति |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` वह फ़ाइल लेता है जो CODESYS IDE के Export Alarms ने लिखी, `contentBase64` के रूप में (डिस्क पर जैसे हैं वैसे बाइट, जिन्हें IDE UTF-16 में लिखता है) या `content` के रूप में (टेक्स्ट, अगर आपके पास टेक्स्ट में है), उस `deviceId` के साथ जिसके अलार्म हैं और, अगर आप चाहें, `application` और `defaultPriority`। अकेला छोड़ने पर वह केवल पूर्वावलोकन करता है: बताता है कि कौन-से अलार्म आएंगे और कौन-से नहीं, कुछ सहेजता नहीं, और कारण नहीं चाहिए। `apply` true के साथ वह उन्हें अलार्म परिभाषा के रूप में सहेजता है, और तब उसे कारण और MCP राइट स्विच चाहिए जैसे कॉन्फ़िगरेशन बदलने वाले हर टूल को।

`screen_export` डैशबोर्ड को HotLoop स्क्रीन फ़ाइल ([स्क्रीन फ़ाइलें](/hi/iot/screen-file/)) के रूप में जवाब देता है, और `screen_import` एक लेता है, इसी इंस्टॉल पर या किसी दूसरे पर। वह पहले पूछता है: `dryRun` true है जब तक आप false न कहें, और ड्राई रन कुछ नहीं सहेजता और हर समस्या की सूची और `remap` के संदर्भों वाली रिपोर्ट से जवाब देता है। असली इम्पोर्ट को `dryRun` false, कारण और MCP राइट स्विच चाहिए, और जो id मौजूद है वह अस्वीकार होता है जब तक `replace` true न हो। स्क्रीन ग्राहक का डेटा है, इसलिए फ़ाइल वह तरीका है जिससे वह इंस्टॉल के बीच चलती है, कभी कोड नहीं।

### रीड और ड्राई रन

जो एजेंट डैशबोर्ड, ब्रोकर या उपकरण ट्री का नोड बदल सकता है उसे पहले पढ़ पाना चाहिए कि वहां क्या है, इसलिए ऊपर के किसी टूल द्वारा बदली जाने वाली हर वस्तु की यहां एक रीड है, और संपादकों के ड्राई रन भी टूल हैं। हर एक एक रूट है जो अपने हैंडलर से चलता है उस रीड अनुमति के साथ जो वह रूट मांगता है। रीड बिना कारण और बिना राइट स्विच के जवाब देती है, और जिस कॉलर को राइट भूमिका छोड़ देती है वह फिर भी उन्हें कर सकता है, क्योंकि वे रीड अनुमति लेकर चलती हैं और कुछ नहीं। तीन ड्राई रन (`validate_automation`, `validate_script` और `browse_device`) कुछ नहीं बदलते; जो दो किसी बॉडी की जांच करते हैं वे वह राइट अनुमति रखते हैं जो उनका रूट मांगता है, इसलिए वे राइट भूमिका के पीछे रहते हैं।

| टूल | रूट | अनुमति |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### प्रशासन

उपयोगकर्ता खाते, सेटिंग, बैकअप, एस्केलेशन नीति, हिस्टोरियन लक्ष्य, ब्रोकर लॉगिन, edge relay का बेड़ा और निर्धारित रिपोर्ट प्रशासक के हैं, और वे भी टूल हैं: बयालीस, बाकी जैसे ही पैटर्न के। हर एक एक रूट है जो अपने हैंडलर से चलता है उस अनुमति के साथ जो वह रूट मांगता है (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), हर बदलाव के लिए एक कारण और ऑडिट पंक्ति में एजेंट। जो रूट अस्वीकार करता है वह एजेंट को उन्हीं शब्दों में अस्वीकार करता है। रीड (`list_` और `get_` टूल) को कारण और राइट स्विच की ज़रूरत नहीं, और जब कॉलर की राइट भूमिका सेट हो तो वह अब भी चाहिए, क्योंकि वे जो अनुमति रखते हैं वह प्रशासक की है। बेड़े और रिपोर्ट के टूल केवल उस उत्पाद में हैं जिसमें वह सुविधा है।

दो चीज़ें रूट की अपनी हैं और किसी टूल पर भरोसा करने से पहले जानने लायक हैं:

- **राइट स्विच का कोई रूट नहीं है।** `safety.allowWrites` और `safety.allowMcpWrites` डिप्लॉयमेंट के हैं (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), और `PUT /api/settings` उन्हें डिप्लॉयमेंट द्वारा सेट किए गए के रूप में अस्वीकार करता है। इसलिए `save_settings` वह बदलता है जो सेटिंग स्क्रीन बदल सकती है और स्विच के लिए वह इनकार उन्हीं शब्दों में जवाब देता है। एजेंट वह स्विच चालू नहीं कर सकता जिस पर उसके अपने राइट इंतज़ार करते हैं।
- **उपयोगकर्ता का पासवर्ड कॉल से होकर जाता है।** `create_user`, `reset_user_password` और PIN टूल अपने आर्गुमेंट में एक सीक्रेट लेते हैं, जैसे API। ऑडिट पंक्ति बदलाव और कारण का नाम लेती है और सीक्रेट का कभी नहीं।

**उपयोगकर्ता खाते**

| टूल | रूट | अनुमति |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**सेटिंग, बैकअप, सूचनाएं**

| टूल | रूट | अनुमति |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**हिस्टोरियन लक्ष्य और ब्रोकर लॉगिन**

| टूल | रूट | अनुमति |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**edge relay का बेड़ा (Gateway)**

| टूल | रूट | अनुमति |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**निर्धारित रिपोर्ट (Gateway)**

| टूल | रूट | अनुमति |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## संसाधन

| URI | सामग्री |
|---|---|
| `iiot://devices` | टैग के साथ डिवाइस ट्री, JSON के रूप में |
| `iiot://tags` | वर्तमान मानों के साथ टैग कैटलॉग |
| `iiot://alarms` | अलार्म परिभाषाएं, लाइव स्थिति और स्थिति संदर्भ |
| `iiot://protocols` | समर्थित प्रोटोकॉल, कंपाइल किए ड्राइवरों से |

संसाधन इसलिए हैं कि क्लाइंट पूरा नेमस्पेस एक रीड में खींच सके, एक-एक टूल कॉल से खोजने की बजाय।

## टूल क्या नहीं करेंगे

टूल इस तरह लिखे गए हैं कि कोई मॉडल गलती से अनिश्चितता को गोल न कर सके।

**बिना रीडिंग वाला टैग शून्य पढ़ने वाला टैग नहीं है।** `read_tag` कहता है `no reading has been taken for this tag yet`, या `this tag is not configured` अगर वह मौजूद नहीं। कोई भी मान नहीं लौटाता।

**खराब गुणवत्ता कही जाती है, जताई नहीं जाती।** रीडिंग `[quality: bad (the value is NOT known; do not treat it as a measurement)]` के रूप में लौटती हैं। सर्वर के निर्देश इसे दोहराते हैं। खराब रीडिंग का औसत न लें और किसी एक को मापन के रूप में रिपोर्ट न करें।

**`describe_protocol` झूठ नहीं बोल सकता।** उपलब्धता बाइनरी में कंपाइल किए ड्राइवरों से आती है, इसलिए टूल ऐसा प्रोटोकॉल नहीं बता सकता जो गेटवे के पास नहीं है।

**अस्वीकार एक जवाब है, ट्रांसपोर्ट की विफलता नहीं।** अस्वीकृत राइट `isError` के साथ टूल नतीजे के रूप में लौटता है, जिसका मतलब है कि कॉल सही बनी थी और जानबूझकर ठुकराई गई। यह प्रोटोकॉल त्रुटि नहीं जिसे दोबारा आज़माया जाए।

## राइट

MCP पढ़ता और लिखता है: वह उपकरण को कमांड देता है, और कॉन्फ़िगरेशन बदलता है ([ऊपर](#कॉन्फ़िगरेशन-बदलना))। `write_tag` असली उपकरण को हिलाता है, इसलिए टूल कॉल और मशीन के बीच वही चीज़ें खड़ी हैं जो ऑपरेटर के क्लिक और मशीन के बीच खड़ी हैं:

1. `HOTLOOP_ALLOW_WRITES`, पूरे डिप्लॉयमेंट का मास्टर स्विच, चालू होना चाहिए। इसके बंद होने पर कुछ नहीं लिखता: न UI, न API, न एजेंट।
2. टैग लिखने योग्य चिह्नित होना चाहिए। टैग तब तक केवल पढ़ने योग्य हैं जब तक कोई कुछ और न कहे, एक-एक करके।
3. मान टैग की कॉन्फ़िगर सीमा के भीतर होना चाहिए। वह **अस्वीकार होता है, काटा नहीं जाता**: जब किसी ने 500 मांगा हो तब 400 भेजना चुपचाप वह करना है जो मांगा गया उससे अलग है।

एक **कारण आवश्यक है** और राइट के बगल में दर्ज होता है। ऐसी ऑडिट पंक्ति जिसे छह महीने बाद कोई समझ न सके, किसी के न होने से मुश्किल से बेहतर है।

`call_service` को ठीक वही तीनों मिलते हैं, क्योंकि वह उसी गेट से राइट के सिवा कुछ नहीं है, और फिर एंटिटी की अपनी जांचें ऊपर से (संख्या का चरण और संकरी सीमा, टेक्स्ट का पैटर्न, एंटिटी का अक्षम न होना)। इनमें से किसी पर भी अस्वीकृति टैग के साथ एंटिटी के विरुद्ध भी ऑडिट होती है: स्रोत `mcp`, नाम से क्लाइंट, entity_id, सेवा और कॉल id, वही पंक्ति जो अस्वीकृत `write_tag` छोड़ता है और साथ में एंटिटी। बिना कारण की कॉल कुछ भी आज़माने से पहले अस्वीकार होती है, जैसे `write_tag`।

`trigger_automation` भी उसी तरह गेट से बंधा है, क्योंकि नियम की क्रियाएं उपकरण को कमांड दे सकती हैं; वरना यह उन जांचों से बचने का तरीका होता जिनसे `write_tag` मिलता है।

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

जब राइट बंद हों, सर्वर के निर्देश यह शुरू में ही कहते हैं, ताकि एजेंट इसे खोजने में एक बारी न गंवाए।

## बाहर कॉल करना

ऑटोमेशन की `mcp_call` क्रिया किसी दूसरे MCP सर्वर पर टूल को चलाती है। सर्वर चार्ट में कॉन्फ़िगर करें:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

सत्र पूल किए और दोबारा इस्तेमाल किए जाते हैं; हर कॉल पर जुड़ने का मतलब होता हर बार नियम चलने पर हैंडशेक, initialize और टूल सूची। जो सत्र मर गया उसे अगली कॉल पर दोबारा जोड़ा जाता है, टाइमर पर नहीं, क्योंकि अगली कॉल पहला क्षण है जब किसी को परवाह होती है। कॉन्फ़िगर किया सर्वर जो बंद है प्लांट की निगरानी नहीं रोकता, कुछ डायल नहीं होता जब तक नियम को ज़रूरत न हो।

MCP स्क्रीन हर कॉन्फ़िगर किया सर्वर दिखाती है, वह जुड़ा है या नहीं, और जो टूल वह विज्ञापित करता है।

## साइटों का संघ

हर प्लांट पर एक गेटवे वह तरीका है जिससे इसे चलाने का इरादा है। हर साइट अपना डेटाबेस, अपना बोर्ड और अपना नाम रखती है, और कोई भी कहीं और के लिंक के चालू रहने पर निर्भर नहीं, प्लांट की निगरानी इसलिए नहीं रुकती कि WAN गिर गया।

सबको एक साथ देखना उस प्रोटोकॉल का उपयोग करता है जो साइटें पहले से बोलती हैं। क्लाउड में एक गेटवे कॉन्फ़िगर करें, साइटों को आउटबाउंड MCP सर्वर के रूप में, ठीक जैसे `mcp_call` क्रिया के लिए:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

साइट स्क्रीन फिर हर एक पर समानांतर `get_plant_status` कॉल करती है और जवाब समेटती है। किसी साइट को दिखाने के लिए वहां कुछ डिप्लॉय करने को नहीं, किसी साइट को यह जानने की ज़रूरत नहीं कि वह संघ में है, और कुछ भी प्लांट नेटवर्क के अंदर की ओर नहीं जुड़ता।

दो व्यवहार जानबूझकर हैं और भरोसा करने लायक हैं:

- जो साइट जवाब नहीं देती वह **पहुंच से बाहर, कारण के साथ** दिखाई जाती है, और समेटने से बाहर रखी जाती है। जिस प्लांट तक आप नहीं पहुंच सकते उसे शून्य अलार्म गिनना सबसे बुरी चीज़ है जो ऐसी स्क्रीन कर सकती है।
- साइट ने जो नंबर आख़िरी बार बताए वे कभी नहीं दिखाए जाते। वे वर्तमान दिखते हैं और नहीं हैं।

हर साइट को अपनी छोटी समय सीमा मिलती है, ताकि मृत लिंक पर एक प्लांट उन्हें न रोके जो चालू हैं।

## एजेंट को क्या बताना ठीक है

सर्वर के अपने निर्देश इसे कवर करते हैं, लेकिन उसके आसपास प्रॉम्प्ट लिखने वाले किसी के लिए:

- अलार्म स्थितियां ISA-18.2 का पालन करती हैं। `rtn-unack` का मतलब ऐसा अलार्म जो किसी के देखने से पहले अपने आप सामान्य हो गया, वह अब भी रिपोर्ट करने लायक है, और वही स्थिति है जो साबित करती है कि स्वीकार करना और सामान्य पर लौटना स्वतंत्र हैं।
- कुछ मिनट से लंबी किसी भी चीज़ के लिए `query_history` बकेट के साथ, कच्चे नहीं। एक सेकंड के डेटा का एक दिन प्रति टैग 86,400 बिंदु है। बकेट गुणवत्ता नियम का पालन करती हैं: खराब और अनिश्चित रीडिंग `badReadings` में गिनी जाती हैं, कभी औसत में नहीं, और जिस बकेट में कुछ अच्छा नहीं उसका औसत null है।
- `recent_events` किसी घटना को फिर से बनाने का तरीका है: डिवाइस कनेक्शन, राइट, अलार्म संक्रमण, ऑटोमेशन रन और कॉन्फ़िगरेशन बदलाव, क्रम में, हर एक उस एक्टर के साथ जिसने उसे किया।
