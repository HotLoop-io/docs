---
title: "MCP за агенти"
description: "Позволете на агент да чете целия завод и да докосва само това, което сте активирали, през портата за запис, със записана причина до всеки запис."
---

Gateway говори MCP в двете посоки: агентите могат да четат и управляват завода, а автоматизационно правило може да извика инструмент другаде.

Правилото в дизайна е, че **агентът е извикващ като всеки друг**. Инструментите четат през същия кеш, през който чете интерфейсът, и пишат през същата порта, през която пише интерфейсът. Няма привилегирован път, няма заобикаляне и няма отделна политика. Запис, който би бил отказан на оператор, се отказва; запис, който успее, попада в същата одитна таблица с `mcp:` пред актьора.

## Предоставяне

### През HTTP

Включено по подразбиране на `/mcp` на порта на приложението, защитено с bearer токен, който чартът генерира в Secret на релийза.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

В клъстера крайната точка е:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Проверката на токена стои пред обработчика, така че неудостоверен извикващ не може дори да изброи какво съществува. Ако оставите `mcp.token` празен, чартът генерира такъв, внедряването по подразбиране не е случайно отвореното. Комбинирайте го с NetworkPolicy; токенът е втора линия на защита, не единствената.

Крайната точка никога не е отворена. Стартирайте двоичния файл без `HOTLOOP_MCP_TOKEN` (Quadlet единица, гол `hotloop`) и той създава токен при първия си старт и го пази в базата си, така че същият се връща след рестарт, на всяка реплика и след възстановяване. `hotloop mcp-token` го отпечатва (дневникът казва, че е създал един, и никога кой е). Задайте `HOTLOOP_MCP_TOKEN`, за да изберете свой; със зададен `HOTLOOP_MCP_OIDC_*` крайната точка приема вход и не пази собствен токен. Клиент, който преди се е свързвал с гол двоичен файл без нищо, сега получава `401`, докато не изпрати `Authorization: Bearer <that token>`.

### С Vord вход или твърдение от хъба

Статичният токен казва кой клиент е извикал; не може да каже кой човек. При зададен OIDC `/mcp` приема и `Authorization: Bearer <jwt>`, а имейлът на удостовереното лице става одитният актьор: записът се отразява като `mcp:pat@example.com` вместо `mcp:<client name>`. Поведението без него е непроменено, а статичният токен продължава да работи до него (без зададен статичен токен влиза само удостоверен JWT).

| Променлива | Стойност в чарта | Какво прави |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | URL на Vord realm; приема неговите токени за достъп |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | `aud`, който всеки токен трябва да носи; задължително с едно от тези две |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | ключовете за твърдения на хъба за идентичност; приема неговите твърдения |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | роля на realm, която извикващият трябва да притежава |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | ограничава записите за всеки извикващ, вижте по-долу |

Vord токен за достъп се проверява спрямо JWKS на издателя (намира се през документа му за откриване, кешира се десет минути, зарежда се наново при непознат `kid`): само RS256 или ES256, `iss` равно на издателя, `aud` съдържащо аудиторията, `exp` и `nbf` с 30 s разлика и твърдение `email` (или `preferred_username`). Vord поставя по подразбиране само `account` в `aud`; дайте на обхвата на клиента audience mapper за аудиторията, която задавате.

Твърдение от хъба е `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` конфигурираната аудитория (модулът Hub изпраща `hotloop`), неизтекло, подписано с ключ от JWKS на Hub. Няма кеш срещу повторно възпроизвеждане по `jti`: едно извикване на инструмент са няколко HTTP заявки (initialize, после извикването), които носят същото твърдение, което живее 60 s. Когато Hub казва, че извикването действа за някой друг (`acting_as`), актьорът се чете `mcp:<email> for <acting_as email>`.

Записите все още изискват `HOTLOOP_ALLOW_WRITES`, главния превключвател; токенът никога не го разширява. `HOTLOOP_MCP_OIDC_WRITE_ROLE` ги стеснява за всеки извикващ: `hotloop:hotloop.write` означава клиентската роля на Vord `hotloop.write` за клиента `hotloop` (`resource_access.hotloop.roles`), голо име означава роля на realm, а твърдение от Hub трябва да носи името на ролята в `abilities`. Извикващ без нея може да чете, но `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` и всеки инструмент, който променя конфигурацията, отказват. Статичният токен не е ограничен от нея.

### През stdio

Същият двоичен файл обслужва MCP през stdin и stdout с `--mcp-stdio`, за клиент, който го стартира директно. Всичко останало също стартира, така че агентът вижда жив завод, а не кух сървър.

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

В режим stdio цялото записване в дневник отива в stderr. Всичко, записано в stdout, би повредило потока на протокола.

## Инструменти

Сто седемдесет и един: двадесет и седем, които четат завода и го командват, шестдесет и девет, които променят конфигурацията му ([по-долу](#промяна-на-конфигурацията)), тридесет и три четения и пробни изпълнения към тях ([по-долу](#четения-и-пробни-изпълнения)) и четиридесет и два за администрация ([по-долу](#администрация)).

| Инструмент | Какво прави |
|---|---|
| `get_plant_status` | устройства на линия, неразрешени аларми, дали записите са разрешени |
| `list_devices` | всяко устройство с протокол, адрес, състояние, брой тагове |
| `describe_device` | едно устройство в детайли, с таговете му и статистика на запитванията |
| `list_tags` | търси в каталога по устройство, име или описание |
| `read_tag` | текущи стойности, с качество |
| `query_history` | исторически показания, сурови или групирани |
| `write_tag` | **командва таг** |
| `list_alarms` | аларми и техните състояния по ISA-18.2 |
| `ack_alarm` | потвърждава от името на оператор |
| `list_automations` | правила, брой изпълнения, последен резултат |
| `trigger_automation` | изпълнява правило сега |
| `describe_protocol` | какво всъщност говори тази версия |
| `recent_events` | системният дневник, за да се разбере какво е станало и в какъв ред |
| `list_entities` | намира обекти по домейн, възел на оборудването или етикет, със услугите, които всеки приема |
| `get_states` | текущо състояние на един или повече обекти, с качество и атрибути |
| `call_service` | **командва обект**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | една времева линия на промени в състоянието, записи, аларми, изпълнения и промени в конфигурацията, по обект, възел на оборудването, актьор или вид |
| `list_scripts` | скриптовете на завода, полетата, които приема всеки, дали работи, последното му изпълнение |
| `run_script` | **изпълнява скрипт**, или пита с `dryRun` какво би направил в момента |
| `list_recipes` | рецептите на завода: цели по ред, параметри, предусловие, версия, последно прилагане |
| `validate_recipe` | би ли се приложила рецепта сега? всяка причина да бъде отказана; не се записва нищо |
| `apply_recipe` | **прилага рецепта**: проверена изцяло, записана по ред, прочетена обратно |
| `list_blueprints` | blueprint-овете, които хората попълват, за да правят правила, техните входове и версии |
| `preview_blueprint` | правилото, което blueprint би направил със зададени входове, и какво би направило сега; не създава нищо |
| `find_network_client` | къде е устройство в заводската мрежа: порта на комутатора му, има ли порта връзка, кога UniFi конзолата го е видяла за последно |
| `get_network_topology` | заводската мрежа, както я рисува UniFi конзолата: какво към какво е включено, състоянието на всяко устройство и HotLoop устройствата, които губят мрежата си, ако той падне |
| `get_network_events` | най-новите събития, докладвани от UniFi конзола, и дали websocket за събития е жив |

### Обекти

Същност е това, което хората наричат нещо в завода, `sensor.zone_1_temperature` или `switch.conveyor_run`, обгръщащо един или повече тага. Вижте [Същности](/bg/iot/entities/). За агента те обикновено са по-добрата дръжка: името означава нещо, а същността знае какво може да се прави с нея.

`list_entities` филтрира по `domain`, по `equipment` (възел от дървото на оборудването по id, име или път от имена като `Plant A/Packing`, съвпадащ с всичко в него или под него, като собственото място на обекта печели пред това на устройството му), по `label` (label_id или име; обектът съвпада, ако носи етикета или устройството му го носи) и по `query`, подниз на entity_id или името. Всеки резултат носи текущото си състояние и качество и услугите, които приема, като `domain.service`. Обект без услуги е само за четене. Услугите идват от слоя на обектите, така че домейн, който получи такава там, се появява тук без промяна.

`get_states` приема `entity_ids` и отговаря за всеки със състоянието, качеството, атрибутите и `last_changed`. Държи същата линия като `read_tag`: състояние `unknown` или `unavailable` се отговаря с бележка, че не е стойност, деактивиран обект казва, че е деактивиран, а не че липсва, и лошото качество се изписва.

`call_service` приема `domain`, `service`, `entity_id`, `data` и **задължително** `reason`:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Минава през `entity.Services`, същия изпълнител, който ползва `POST /api/services/...`, който превръща извикването в записи през портата за запис. Вижте [Запис](#запис).

### Мрежата

`find_network_client` отговаря на първия въпрос за PLC, който е замлъкнал: PLC ли е, или портът на комутатора му? Дайте му `deviceId` и той следва потвърдената връзка на това устройство до неговия UniFi клиент; дайте му `query` (MAC, IP или част от име) и той търси във всяка конзола, която HotLoop чете. Чете последното четене на UniFi драйвера, никога конзолата, така че агент, който пита в цикъл, не струва нищо на конзолата. Това означава и че помощник `--mcp-stdio` отговаря, че в неговия процес не се чете конзола: той никога не влиза в такава, защото Gateway до него вече държи сесията. Питайте крайната точка на Gateway. Вижте [UniFi Network](/bg/iot/unifi/).

`get_network_topology` е картата: всеки комутатор, точка за достъп и gateway под този, към който е включен, с порта в двата края, връзката, колко клиента има на нея и HotLoop устройствата, свързани с клиент под него. Тази последна част е радиусът на поражение: тя назовава PLC-тата, които губят мрежата си, ако този комутатор падне. Комутатор, който конзолата изброява като включен в нищо, го казва и не се закача за gateway. `get_network_events` са най-новите събития на конзолата, най-новите първо, със собственото ѝ изречение, флаг за предупреждение, където конзолата го нарича отрицателно, и дали websocket за събития е жив. И двата приемат `deviceId` на конзолата, който може да се пропусне, когато HotLoop чете само една, и двата четат последното четене на драйвера като `find_network_client`, така че не струват нищо на конзолата и казват същото в помощник `--mcp-stdio`: в този процес не се чете конзола. По-старите събития са в `get_logbook`, подредени под комутатора или точката за достъп, за които са се отнасяли.

### Дневникът

`get_logbook` е времевата линия, която обслужва `GET /api/logbook` (вижте [Дневникът](/bg/iot/logbook/)): промени в състоянието, записи, преходи на аларми, изпълнения на автоматизации и промени в конфигурацията, най-новите първо. Стеснява се по `entity`, по `equipment` (id, име или път, и всичко под него; име, което съвпада с два възела, е грешка, изброяваща и двата), по `actor` (част от него: `mcp:` намира всичко, което е направил който и да е агент), по `kinds` и по `minutes` назад (по подразбиране ден). Страница с още след нея завършва, като казва какво да се подаде като `before` за следващата. За „какво стана, преди това да се обърка“ е по-добрият `recent_events`: собствените промени в състоянието на оборудването са в него, а редовете на портата за запис не са в него два пъти.

### Скриптове

Скриптът е именувана последователност от стъпки, която някой е написал веднъж, CIP цикълът или продухването на линията, така че агентът изпълнява собствената процедура на завода, вместо да измисля такава. Вижте [Скриптове](/bg/iot/scripts/). `list_scripts` казва какво приема всеки. `run_script` приема `scriptId`, `fields`, **задължително** `reason` и два превключвателя:

- `dryRun: true` преминава скрипта срещу завода такъв, какъвто е, и казва, стъпка по стъпка, какво би се записало и първото, което портата би отказала, с думите на портата. Нищо не се записва и не се одитира. Питайте това първо.
- `wait: true` отговаря, щом изпълнението е приключило, с резултата и следата му. Без него отговорът е id на изпълнението, а `list_scripts` или `get_logbook` с `kinds: ["script"]` казва как е приключило.

Изпълнението е на скрипта, като `script:<id>`, с източник `mcp`, така че всеки запис, който прави, среща портата точно като `write_tag`. При изключени записи (`HOTLOOP_ALLOW_WRITES`) `run_script` отказва, преди нещо да се изпълни, както прави `trigger_automation`; пробното изпълнение все пак получава отговор и казва, че причината е превключвателят.

### Рецепти

Рецептата е набор от зададени стойности, които заводът прилага заедно, клас продукт или смяна, така че агентът зарежда собствените числа на завода, вместо да ги записва едно по едно. Вижте [Рецепти](/bg/iot/recipes/). `list_recipes` показва целите на всяка по ред и параметрите, които приема. `validate_recipe` пита дали една би се приложила сега и дава всяка причина, поради която не би, без да записва нищо. `apply_recipe` приема `recipeId`, `params`, незадължителна `version` и **задължително** `reason`.

Първо се проверява изцяло и се отказва изцяло, без да се записва нищо, ако някоя стойност би била отказана; стойностите извън обхвата се отказват, никога не се коригират. После целите излизат по ред под едно id на извикване, първата, която се провали, спира останалите и нищо не се отменя. Отговорът казва, цел по цел, какво е излязло и дали устройството е прочело стойността обратно. Записите са на агента, с източник `mcp`, така че портата важи за всеки; при изключени записи (`HOTLOOP_ALLOW_WRITES`) `apply_recipe` отказва, преди да се провери нещо. Рецепта, която назовава собствено разрешение за прилагане, е за хората, на които е дадено, а агентът не е един от тях.

### Blueprints

Blueprint е правило, написано веднъж с типизирани празнини: кой мотор, колко дълго, какъв лимит. Вижте [Blueprints](/bg/iot/blueprints/). `list_blueprints` казва какво приема всеки. `preview_blueprint` приема `blueprintId`, `automationId` и `inputs` и отговаря с правилото, което би направил, и какво би направило това правило, ако се задейства сега, като всеки запис е подложен на проверките на портата. Входовете се проверяват точно както ги проверява екранът: извън обхвата се отказва, не се коригира.

`instantiate_blueprint` създава правилото, по пътя, който ползва екранът Blueprints: същите проверки, и правилото попада в дневника с агента като негов автор. Правилото е постоянна заповед да се командва оборудване всеки път, когато се задейства тригерът му, така че агентът първо гледа: `preview_blueprint` не съхранява нищо и не записва нищо и получава отговор независимо дали записите са включени. Всеки запис, който създаденото правило после прави, среща портата за запис, както при правило, създадено от човек. Вижте [Промяна на конфигурацията](#промяна-на-конфигурацията).

## Промяна на конфигурацията

Всичко, което агентът може да чете, може да го променя. Инструментите по-горе, които четат завода, имат двойници, които го променят, шестдесет и девет, и нито един не е втора имплементация: всеки е маршрут на REST API, а извикването минава през собствения обработчик на този маршрут. Валидирането, проверката на разрешенията, презареждането на runtime и одитният ред са на маршрута, с агента като актьор (`mcp:<client>`, или `mcp:<email>` с Vord вход), така че устройство без драйвер, правило, което не се компилира, вход на blueprint извън обхвата или таг, за който откритото устройство не е прието, се отказват с думите, които показва екранът, и нищо не е променено.

Всеки приема стойностите на пътя на маршрута по име (`id`, `device`, `name`...), `body`, същия JSON, който приема API ([HTTP API](/bg/iot/api/) има всеки body), и **задължително** `reason`. Причината се записва като ред `config` в системния дневник до този на самия маршрут, срещу променения обект.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Това, което стои пред тях, е това, което стои пред `write_tag`, без главния превключвател, защото екраните също не се нуждаят от него, за да променят конфигурацията:

1. `HOTLOOP_ALLOW_MCP_WRITES`, включено по подразбиране, трябва да е включено.
2. Извикващ със зададен `HOTLOOP_MCP_OIDC_WRITE_ROLE` трябва да я притежава.
3. Извикването носи едно разрешение, това, което иска маршрутът му (третата колона по-долу), и нищо друго. Маршрутът отговаря на агент, както отговаря на човек без това разрешение, а тест обвързва всеки ред от таблицата с реален маршрут и с разрешението, което този маршрут иска.
4. Причина.

Командването на оборудване остава `write_tag`, `call_service`, `run_script`, `apply_recipe` и `trigger_automation` с включено `HOTLOOP_ALLOW_WRITES` и с белега за записваемост и обхвата на тага за изпълнение. Правенето на таг, правило, скрипт или рецепта записваеми е конфигурация: не командва нищо, докато не се използва, а това, което командва тогава, минава през портата.

Собствените функции на администратора също са инструменти, под [Администрация](#администрация) по-долу. Приемането на открито устройство е тук, както на екрана; точките по него все още трябва да се активират за запис една по една.

Инструментите съществуват и в `--mcp-stdio`: процесът изгражда същия API сървър и никога не отваря порта си.

**Устройства и тагове**

| Инструмент | Маршрут | Разрешение |
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

**Откриване и брокери**

| Инструмент | Маршрут | Разрешение |
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

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Обекти, помощници, оборудване, етикети**

| Инструмент | Маршрут | Разрешение |
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

**Аларми**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Автоматизации и blueprints**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Скриптове и рецепти**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Табла и бордът**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Импорти**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` приема файла, който Export Alarms на CODESYS IDE е записал, като `contentBase64` (байтовете такива, каквито са на диска, които IDE записва в UTF-16) или като `content` (текстът, ако го имате като текст), с `deviceId`, към което принадлежат алармите, и, ако ги искате, `application` и `defaultPriority`. Оставен така, само показва преглед: казва кои аларми биха се пренесли и кои не, не записва нищо и не се нуждае от причина. С `apply` true ги записва като дефиниции на аларми и тогава се нуждае от причина и от MCP превключвателя за запис като всеки инструмент, който променя конфигурацията.

`screen_export` отговаря с табло като файл на екран на HotLoop ([Файлове на екран](/bg/iot/screen-file/)), а `screen_import` приема такъв, на тази инсталация или на друга. Пита първо: `dryRun` е true, освен ако не кажете false, а пробното изпълнение не записва нищо и отговаря с доклада с всеки изброен проблем и препратките за `remap`. Истински импорт изисква `dryRun` false, причина и MCP превключвателя за запис, а id, което съществува, се отказва, освен ако `replace` е true. Екранът са данни на клиента, така че файлът е начинът, по който се премества между инсталации, никога код.

### Четения и пробни изпълнения

Агент, който може да променя табло, брокер или възел от дървото на оборудването, трябва първо да може да чете какво има, така че всеки обект, който инструмент по-горе променя, има четене тук, а пробните изпълнения на редакторите също са инструменти. Всяко е маршрут, изпълнен през собствения си обработчик с разрешението за четене, което този маршрут иска. Четенето отговаря без причина и без превключвателя за запис, а извикващ, когото ролята за запис изключва, пак може да ги прави, защото носят разрешение за четене и нищо повече. Трите пробни изпълнения (`validate_automation`, `validate_script` и `browse_device`) не променят нищо; двете, които проверяват тяло, носят разрешението за запис, което искат техните маршрути, така че остават зад ролята за запис.

| Инструмент | Маршрут | Разрешение |
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

### Администрация

Потребителските акаунти, настройките, архивните копия, политиката за ескалация, целите на историка, входовете към брокера, флотът от edge relays и планираните отчети са на администратора и също са инструменти: четиридесет и два, по същия модел като останалите. Всеки е маршрут, изпълнен през собствения си обработчик с разрешението, което този маршрут иска (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), причина за всяка промяна и агента в одитния ред. Маршрут, който отказва, отказва на агент със същите думи. Четенията (инструментите `list_` и `get_`) не се нуждаят от причина и от превключвател за запис и все още изискват ролята за запис на извикващия, когато е зададена, защото разрешението, което носят, е на администратор. Инструментите за флота и за отчети съществуват само в продукт, който има функцията.

Две неща са собствени на маршрутите и си струва да се знаят, преди да се разчита на инструмент:

- **Превключвателите за запис нямат маршрут.** `safety.allowWrites` и `safety.allowMcpWrites` са на внедряването (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), а `PUT /api/settings` ги отказва като зададени от внедряването. Така `save_settings` променя това, което екранът Настройки може да променя, и отговаря този отказ за превключвателите, с тези думи. Агент не може да включи превключвателя, на който чакат собствените му записи.
- **Паролата на потребител минава през извикването.** `create_user`, `reset_user_password` и инструментите за PIN приемат тайна в аргументите си, като API. Одитният ред назовава промяната и причината и никога тайната.

**Потребителски акаунти**

| Инструмент | Маршрут | Разрешение |
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

**Настройки, архивни копия, известия**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Цели на историка и входове към брокера**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**Флотът от edge relays (Gateway)**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Планирани отчети (Gateway)**

| Инструмент | Маршрут | Разрешение |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Ресурси

| URI | Съдържание |
|---|---|
| `iiot://devices` | дървото на устройствата с тагове, като JSON |
| `iiot://tags` | каталогът на таговете с текущи стойности |
| `iiot://alarms` | дефиниции на аларми, живо състояние и справка за състоянията |
| `iiot://protocols` | поддържани протоколи, от вградените драйвери |

Ресурсите съществуват, за да може клиент да изтегли цялото пространство от имена с едно четене, вместо да го открива по едно извикване на инструмент.

## Какво инструментите няма да правят

Инструментите са написани така, че моделът да не може да закръгли несигурността по случайност.

**Таг без показание не е таг, който чете нула.** `read_tag` казва `no reading has been taken for this tag yet`, или `this tag is not configured`, ако не съществува. Нито един не връща стойност.

**Лошото качество се заявява, не се загатва.** Показанията се връщат като `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Инструкциите на сървъра го повтарят. Не осреднявайте лоши показания и не докладвайте такова като измерване.

**`describe_protocol` не може да лъже.** Наличността идва от драйверите, вградени в двоичния файл, така че инструментът не може да твърди протокол, който gateway няма.

**Отказът е отговор, не транспортна грешка.** Отказан запис се връща като резултат от инструмент с `isError`, което означава, че извикването е било добре оформено и преднамерено отхвърлено. Не е грешка на протокола, която да се повтаря.

## Запис

MCP чете и пише: командва оборудване и променя конфигурацията ([по-горе](#промяна-на-конфигурацията)). `write_tag` движи реално оборудване, така че същите неща стоят между извикването на инструмент и машината, които стоят между щракването на оператор и машината:

1. `HOTLOOP_ALLOW_WRITES`, главният превключвател за цялото внедряване, трябва да е включен. С него изключен нищо не пише: нито интерфейсът, нито API, нито агент.
2. Тагът трябва да е маркиран като записваем. Таговете са само за четене, докато някой не каже друго, един по един.
3. Стойността трябва да е в конфигурирания обхват на тага. Тя се **отхвърля, не се ограничава**: да се изпрати 400, когато някой е поискал 500, е тихо да се направи нещо различно от поисканото.

**Причината е задължителна** и се записва до записа. Одитен ред, който никой не може да изтълкува шест месеца по-късно, е едва по-добър от никакъв.

`call_service` получава точно същите три, защото не е нищо друго освен записи през същата порта, а после собствените проверки на обекта отгоре (стъпката и по-тесния обхват на число, шаблона на текст, обектът да не е деактивиран). Отказ при някоя от тях се одитира срещу обекта, както и срещу тага: източник `mcp`, клиентът по име, entity_id, услугата и id на извикването, същият ред, който оставя отказан `write_tag`, плюс обекта. Извикване без причина се отказва, преди да се опита нещо, като `write_tag`.

`trigger_automation` е защитено по същия начин, защото действията на правило могат да командват оборудване; иначе би било начин да се заобиколят проверките, които среща `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Когато записите са изключени, инструкциите на сървъра го казват предварително, за да не губи агентът ход, докато го открие.

## Извикване навън

Действието `mcp_call` на автоматизация извиква инструмент на друг MCP сървър. Конфигурирайте сървърите в чарта:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Сесиите се обединяват в пул и се използват повторно; свързването при всяко извикване би означавало ръкостискане, initialize и списък с инструменти всеки път, когато се задейства правило. Сесия, която е умряла, се свързва наново при следващото извикване, а не по таймер, защото следващото извикване е първият момент, в който някой се интересува. Конфигуриран сървър, който не работи, не спира наблюдението на завода, нищо не се набира, докато правило не го поиска.

Екранът MCP показва всеки конфигуриран сървър, дали е свързан и инструментите, които обявява.

## Федериране на обекти

Един gateway на завод е начинът, по който е замислено да работи. Всеки обект пази собствената си база данни, собствен борд и собствено име и никой от тях не зависи от това дали връзка към другаде остава налична, заводът не спира да се наблюдава, защото WAN е паднала.

Да ги видите всички наведнъж използва протокола, който обектите вече говорят. Конфигурирайте gateway в облака с обектите като изходящи MCP сървъри, точно както за действието `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

Екранът Обекти след това извиква `get_plant_status` на всеки паралелно и обобщава отговорите. Няма какво да се внедрява на обект, за да се появи, никой обект не трябва да знае, че е федериран, и нищо не се свързва навътре към заводска мрежа.

Две поведения са преднамерени и може да се разчита на тях:

- Обект, който не отговаря, се показва като **недостижим, с причината**, и се оставя извън обобщението. Да броиш завод, до който не можеш да стигнеш, като нула аларми е най-лошото, което екран като този би могъл да направи.
- Числата, които обект е докладвал последно, никога не се показват. Изглеждат актуални и не са.

Всеки обект получава собствен кратък срок, така че един завод на мъртва връзка не може да задържи тези, които са налице.

## Какво си струва да се каже на агент

Собствените инструкции на сървъра покриват това, но за всеки, който пише prompt около него:

- Състоянията на аларми следват ISA-18.2. `rtn-unack` означава аларма, която се е върнала в нормално състояние сама, преди някой да я види, все още си струва да се докладва и е състоянието, което доказва, че потвърждаването и връщането към нормално са независими.
- `query_history` с групи, не суров, за всичко по-дълго от няколко минути. Ден данни през секунда са 86 400 точки на таг. Групите следват правилото за качество: лошите и несигурните показания се броят в `badReadings`, никога не се осреднават, а група без нищо добро има нулева средна стойност.
- `recent_events` е начинът да се възстанови инцидент: връзки на устройства, записи, преходи на аларми, изпълнения на автоматизации и промени в конфигурацията, по ред, всяко с актьора, който го е причинил.
