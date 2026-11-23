---
title: "HTTP API на HotLoop"
description: "Всяко извикване, на което HotLoop отговаря през HTTP, какво изисква, какво приема и какво връща. Уеб интерфейсът не използва нищо друго."
---

Всяко извикване, на което Gateway отговаря по HTTP, какво изисква, какво приема и какво връща. Уеб интерфейсът не използва нищо друго: зад екраните няма частен API, така че всичко, което интерфейсът може да прави, един скрипт може да го прави със същите извиквания и същите разрешения.

Тази страница се проверява спрямо кода. Затова списъкът с маршрутите и кой може да ги извиква не е описание на API-то такова, каквото е било някога. Формите на заявките и отговорите по-долу са взети от работещ Gateway; тестовете не ги проверяват, така че ако промените обработчик, променете и неговия раздел тук.

Подробностите за всяка функция са на нейната страница: [Удостоверяване и потребители](/bg/iot/authentication/), [Същности](/bg/iot/entities/), [дървото на оборудването и етикетите](/bg/iot/equipment/), [Автоматизации](/bg/iot/automations/), [Планирани справки](/bg/gateway/reports/), [Управление на парка](/bg/gateway/fleet/), [Известия за аларми](/bg/iot/notifications/), [Резервни копия и възстановяване](/bg/iot/backup/) и [MCP](/bg/iot/mcp/). Тази страница е списъкът, а те дават причините.

## Конвенции

### Къде се намира

Всичко е на единствения HTTP порт на приложението (`HOTLOOP_LISTEN_ADDR`, по подразбиране `:8080`). Зад прокси, което предлага приложението под някакъв път, задайте `HOTLOOP_BASE_PATH` и Gateway го маха, така че `/hotloop/api/devices` и `/api/devices` са едно и също извикване. Пътищата по-долу са записани без него.

### Вход: бисквитка или bearer токен

Всеки маршрут `/api/` изисква сесия, освен входа (с парола, или с ПИН или карта на киоск панел), входящите webhook и връзките за потвърждаване на аларми, всяка от които носи собствено доказателство в заявката. `POST /api/auth/login` отговаря с токен и го задава и като бисквитката `iiot_session` (HttpOnly, SameSite=Lax, Secure, когато заявката е дошла по TLS или с `X-Forwarded-Proto: https`). Браузърът ползва бисквитката и никога не вижда токена. Скриптът праща токена вместо нея:

```
Authorization: Bearer 3f9c...e1
```

И двете са една и съща сесия и се проверяват по един и същ начин. Сесията трае `HOTLOOP_AUTH_SESSION_TTL` (по подразбиране 12 часа). Без сесия всеки маршрут `/api/` отговаря:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

или `"the session is invalid or has expired"` за токен, който е отнет или е изтекъл, или `"this account no longer has access"` за забранен акаунт.

С `HOTLOOP_AUTH_INSECURE=true` изобщо няма вход: нищо не се проверява, всяко разрешение по-долу е дадено на всички, а името, записано при запис, идва от хедъра на прокситo `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` или `X-Forwarded-Email`, или е `operator`, ако никой не е зададен. Това е разумно само зад NetworkPolicy, която пуска до пода единствено прокситo на таблото. Вижте [Удостоверяване и потребители](/bg/iot/authentication/#работа-без-вход).

MCP е отделен: има собствен bearer токен (`HOTLOOP_MCP_TOKEN`) и никога не поглежда сесия. Вижте [MCP](#mcp).

### Разрешения

Влезлият потребител има списък с разрешения, от ролята си или зададени направо в акаунта. Маршрут, който изисква разрешение, каквото потребителят няма, отговаря:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

[Таблицата с разрешенията](#разрешения) показва коя роля какво има.

### Грешки

Всяка грешка, която самото API произвежда, е JSON с една и съща форма:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` добавя `detail`, а неуспешно извикване на услуга добавя записите, които е направило. Съобщението е написано за човека, който го чете: казва какво е било грешно и, когато има такова, какво да се направи вместо това. Покажете го както е.

| Статус | Кога |
|---|---|
| 400 | Заявката е грешна: повредено тяло, поле, което не минава проверката, непознато поле, липсващ параметър, непозната услуга |
| 401 | Няма сесия, изтекла е, или паролата при входа е грешна |
| 403 | Потребителят няма разрешението, или вратата за запис е отказала записа по политика: записите са изключени, тагът не е активиран, същността е забранена |
| 404 | Това, което е посочено в пътя или в тялото, не съществува |
| 409 | Вече съществува, или е в състояние, което не позволява това: аларма, която не е отложена, възел, който още има наследници, същност без известно състояние за превключване, скрипт, който вече работи, рецепта, която е била отказана или вече се прилага |
| 422 | Стойност, която вратата за запис е отказала по същество: извън диапазона на тага, извън стъпката на същността |
| 502 | Устройството е отговорило със своя грешка и тялото са нейните думи; или рецепта е започнала и не всички цели са изпълнени, а тялото казва кои са изпратени и кои не |
| 503 | Устройството не е свързано, или алармения механизъм не работи |
| 500 | Повреда вътре в сървъра. Тялото е `internal error (ref …); the server log has the detail under that ref` и нищо повече, а дневникът има цялата грешка под този номер. Единственото 500 с истинско съобщение е натискане на бутон, чието пускане не е излязло, защото това съобщение казва точно какво да се провери |

Всичко, което API-то не може да постави, е 500, никога 400. Срив на базата данни, отговорен като 400, казва на оператора, че е написал нещо грешно, и той тръгва да търси печатна грешка, която я няма.

Две грешки не идват от API-то и са обикновен текст, не JSON: път, който не съвпада с нито един маршрут, отговаря `404 page not found`, а познат път, извикан с грешен метод, отговаря `405 method not allowed`.

Отказаният запис никога не е 500. Екран в завода, който показва отказ по политика като сървърна грешка, учи операторите да пренебрегват грешките.

### Тела

Телата на заявките са JSON, най-много 4 MiB (за входящ webhook, 1 MiB). **Непознатите полета се отхвърлят**, не се пренебрегват:

```json
{"error":"request body: json: unknown field \"x\""}
```

Грешно изписана настройка, която тихо се отпада, изглежда точно като такава, която е сработила, затова декодерът казва не.

`POST` и `PUT` върху устройства, тагове, аларми, автоматизации, членове на парка и справки заменят целия обект: пропуснато поле получава нулевата си стойност, а пропуснат булев е `false`. Прочетете, променете, върнете. Изключенията са `PUT` за същности и оборудване, които променят само изпратените полета, и данните за достъп на устройствата, които се запазват, когато са пропуснати (вижте по-долу).

### Тайните са само за запис

Данни за достъп, записани в устройство (парола на брокер, HTTP хедър, парола в адреса), никога не се връщат, на нито една роля, включително администратора. Показват се като `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Когато записвате устройството, изпратете заместителя (или пропуснете ключа), за да запазите съхранената стойност, изпратете нова стойност, за да я замените, и изпратете `""` или `null`, за да я изчистите. Ново устройство не може да се запише със заместителя, а запис, който премества устройството на друг хост със запазени данни за достъп, се отхвърля, за да не може съхранена парола да бъде отнесена към чужд слушател. Пълните правила са в [Удостоверяване и потребители](/bg/iot/authentication/#данните-за-вход-на-устройствата-са-само-за-запис). Същото важи за всички други данни за достъп, които държи Gateway: настройките показват `set` или `not set`, диагностиката чисти данните за достъп от изходящите MCP цели, и нищо в това API не връща хеш на парола или токен на сесия, освен единия, който ви дава входът.

### camelCase, освен където е snake_case

Повечето от API-то е camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), както от първата версия и както изисква договорът `TagValue` на таблото на EmberNet.

Крайните точки за същности, състояния, услуги, оборудване и етикети са snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Това е нарочно: API-то за същности използва общата форма на същност, състояние и услуга, така че всичко, което вече я говори, говори и това, а дървото на оборудването е регистърът на зоните на модела на същностите, с форма за същите потребители. Където двете се срещат, всяка страна пази своя стил: устройството има `equipmentId`, същността има `equipment_id`.

### Часове, продължителности и ключове на тагове

- **Времевите марки** са RFC 3339 в UTC, с дробни секунди, когато има такива: `2026-09-27T20:21:58.255869Z`. Настройката за часовата зона за показване променя това, което показва интерфейсът, никога това, което връща API-то.
- **Време, което не е настъпило, се пропуска.** Правило, което никога не е работило, няма `lastRun`, устройство, което никога не е питано, няма `lastPoll` или `lastGood`, аларма, която никой не е потвърдил, няма `ackedAt`, член на парка, който никога не е виждан, няма `lastSeen`. Липсващо времево поле означава никога. Никога няма да видите нулевото време на Go, `0001-01-01T00:00:00Z`, в отговор или в събитие на потока. Дузина полета го пращаха, а екранът за автоматизации показваше правило, което никога не е работило, като последно работило преди 739887 дни. Тест чете всеки маршрут и всяко времево поле в кода, за да остане така.
- **Sparkline графиките** са изключението: там `timestamps` е в Unix милисекунди, защото отива направо в графика.
- **Продължителностите** казват мерната си единица в името: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` в състоянието е низ за продължителност на Go (`11m13s`).
- **Ключът на таг** е `device/tag`, формата, която приема всеки параметър `?tag=` и всяко поле `tag`. Имената на тагове могат да съдържат наклонени черти (OPC UA пътища, MQTT topics), така че разделя само първата наклонена черта: `plc-1/Line/Zone 1` е тагът `Line/Zone 1` на устройството `plc-1`.
- **Числов параметър на заявка**, който не е число, се пренебрегва и се използва стойността по подразбиране, така че `?limit=abc` е същото като незададен `?limit`.
- **Празните списъци** са `[]`, никога `null`, във всеки отговор и всяко събитие на потока, на всяка дълбочина. Не ви трябва проверка за null преди `.length`. `null`, който виждате, никога не е списък: той е едно от документираните полета, които могат да са null, като `equipment_id` на същност или `parent_id` на коренов възел. Поле със списък, отбелязано като по избор, пак може да бъде пропуснато изцяло.

### Допълнителни функции

Паркът, известията, резервните копия и планираните справки са изключени, освен ако не е зададена променливата им `HOTLOOP_*_ENABLED`. При изключена функция маршрутът ѝ за списък пак отговаря 200, с `"configured": false` и празен списък, така че екран да може да каже „не е включено“ вместо „тук няма нищо“. Всеки друг маршрут на тази функция отговаря 400 с грешка, която назовава променливата:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` прави същото, когато не са настроени изходящи MCP сървъри.

### Няма го в този продукт

HotLoop се доставя като IoT, Edge, Gateway и Edge Relay от една кодова база, а функция, която даден продукт няма, не е изключена, а я няма в двоичния файл. При IoT, Edge и Gateway маршрутите ѝ пак отговарят, след същата проверка на разрешенията, с 404, който го казва и назовава и двата края, така че скриптът да различи „грешна кутия“ от „грешен URL“:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Не 400, защото няма променлива, която да го оправи, и не 5xx, защото нищо не се е объркало. `GET /api/status` казва отначало кой продукт е отговорил и какви функции има, така че клиентът да попита, вместо да опипва.

### Всичко, което променя нещо, се записва

Всяко създаване, промяна, изтриване, запис, потвърждение и вход попада в системния дневник (`GET /api/events`) с името на потребителя, а всеки запис в таг, отхвърлен или не, попада в одита на записите (`GET /api/writes`). API-то няма тих път.

## Разрешения

Кой какво има. Акаунт с изричен списък с разрешения има точно това, което списъкът назовава, вместо набора на ролята си. `*` дава всичко, а `resource.*` дава всичко под даден ресурс (`reports.*`). Ролята admin е `*`.

| Разрешение | viewer | operator | admin |
|---|---|---|---|
| `status.read` | да | да | да |
| `devices.read` | да | да | да |
| `devices.write` | не | не | да |
| `tags.read` | да | да | да |
| `tags.write` | не | не | да |
| `values.read` | да | да | да |
| `values.write` | не | да | да |
| `board.write` | не | да | да |
| `entities.read` | да | да | да |
| `entities.write` | не | не | да |
| `helpers.write` | не | да | да |
| `equipment.read` | да | да | да |
| `equipment.write` | не | не | да |
| `alarms.read` | да | да | да |
| `alarms.write` | не | не | да |
| `alarms.ack` | не | да | да |
| `automations.read` | да | да | да |
| `automations.write` | не | не | да |
| `automations.trigger` | не | да | да |
| `scripts.read` | да | да | да |
| `scripts.run` | не | да | да |
| `scripts.write` | не | не | да |
| `recipes.read` | да | да | да |
| `recipes.apply` | не | да | да |
| `recipes.write` | не | не | да |
| `blueprints.read` | да | да | да |
| `blueprints.apply` | не | да | да |
| `blueprints.write` | не | не | да |
| `dashboards.read` | да | да | да |
| `dashboards.write` | не | не | да |
| `energy.read` | да | да | да |
| `energy.write` | не | не | да |
| `fleet.read` | да | да | да |
| `fleet.write` | не | да | да |
| `fleet.rebirth` | не | да | да |
| `fleet.restart` | не | не | да |
| `fleet.update` | не | не | да |
| `fleet.config` | не | не | да |
| `notify.test` | не | не | да |
| `notify.escalation` | не | не | да |
| `backup.read` | не | не | да |
| `backup.run` | не | не | да |
| `reports.read` | да | да | да |
| `reports.run` | не | да | да |
| `reports.write` | не | не | да |
| `sites.read` | да | да | да |
| `settings.read` | да | да | да |
| `settings.write` | не | не | да |
| `events.read` | да | да | да |
| `logbook.read` | да | да | да |
| `users.manage` | не | не | да |

Границата е една и съща навсякъде: операторът управлява завода (записва стойности, потвърждава аларми, задейства автоматизации, побутва реле), а само администраторът променя как е настроен заводът или прави нещо навън от името на Gateway (рестартира реле, праща му конфигурацията, изпраща тестова страница, дефинира справка, която праща данни от завода по имейл някъде).

## Указател на крайните точки

Колоната за разрешение казва какво проверява маршрутът. `session` означава всеки влязъл потребител, без никакво друго разрешение. `none` означава, че не е нужна и сесия, а разделът обяснява защо. `(in handler)` означава, че проверката се прави вътре в обработчика, а не пред него, и разделът обяснява защо.

Колоната за продукт показва най-малкия HotLoop, който има маршрута: `all` са IoT, Edge и Gateway, `edge` са Edge и Gateway, `gateway` е само Gateway. Всеки продукт регистрира всеки маршрут и проверява на него същото разрешение. При продукт, който го няма, маршрутът отговаря 404 и казва къде се намира; вижте [Няма го в този продукт](#няма-го-в-този-продукт).

| Метод | Път | Разрешение | Продукт |
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
| всички | `/mcp` | MCP токен | all |
| всички | `/mcp/` | MCP токен | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| всички | `/` | none | all |

## Здраве

За kubelet и балансьорите на натоварване. Никой от тях не се нуждае от сесия: пробата няма акаунт и нито една не казва нищо за завода.

### `GET /healthz`

Liveness. `200` с текста `ok`, докато процесът обслужва HTTP. Не пипа базата данни, нарочно: срив на базата данни трябва да извади пода от ротацията, а не да го рестартира в цикъл.

### `GET /readyz`

Readiness. Пингва базата данни с бюджет от 5 секунди.

```json
{"status":"ready"}
```

`503`, когато не може да я достигне, с причината в `detail` (формата е от обработчика; текстът на причината е това, което е казал драйверът на базата данни):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Приложение, което не може да достигне своя архив на данни, не бива да получава трафик.

## Удостоверяване

Вижте [Удостоверяване и потребители](/bg/iot/authentication/) за акаунтите, ролите и първия администратор.

### `POST /api/auth/login`

Не е нужна сесия, по конструкция.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `username` | string | Задължително. Регистърът и околните интервали се пренебрегват |
| `password` | string | Задължително |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Задава и бисквитката `iiot_session` със същия токен. `401` `"invalid username or password"` за грешно име, грешна парола или забранен акаунт еднакво, и отнема същото време във всеки случай: кое от трите е било, не е нещо, което се казва на непознат. `429` за акаунт, който е имал твърде много грешни пароли или ПИН кодове подред, каквото и да се изпрати, със заглавка `Retry-After`; вижте [Удостоверяване и потребители](/bg/iot/authentication/#заключването-след-грешни-пароли-и-pin).

### `POST /api/auth/kiosk`

Вход на споделен панел с ПИН или карта, както го описва [Удостоверяване и потребители](/bg/iot/authentication/#киоск-панели-pin-или-карта-и-изход-при-бездействие). Не е нужна сесия, по конструкция.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `code` | string | Задължително. ПИН кодът или стойността, която е въвел четец на карти в режим на клавиатура. Околните интервали се пренебрегват |
| `username` | string | По избор. С него се проверява само ПИН кодът на този акаунт и грешен се брои към блокирането на този акаунт. Без него кодът се търси сред кодовете на всички акаунти |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Задава бисквитката `iiot_session` и, за разлика от `POST /api/auth/login`, не отговаря с токена: киоск сесията принадлежи на браузъра на панела. `idleSec` е колко оцелява сесията, без никой да я докосва. `401` `"that PIN or badge isn't recognized"` за грешен код, прекалено къс код и код на забранен акаунт еднакво, и отнема същото време във всеки случай. `429`, когато акаунтът е блокиран (вижте [Блокирането](/bg/iot/authentication/#заключването-след-грешни-пароли-и-pin)), със заглавка `Retry-After`. Код, изпратен без `username` и несъвпадащ с никого, не се брои срещу никой акаунт; панелът, който го е изпратил, по адреса на клиента, изчаква половин секунда повече, преди да се провери следващият му такъв опит, до `ui.panelDelaySeconds`, а верният го започва отначало. Панелът никога не се блокира. `400`, когато инсталацията работи без вход (`HOTLOOP_AUTH_INSECURE`), тъй като тогава няма с кого да се влезе.

### `POST /api/auth/activity`

Човек е докоснал панела. Без тяло. `{"status":"ok"}`. При киоск сесия това отмества границата ѝ за неактивност; така правят и всички други заявки, които не са четене (запис, потвърждение). `GET`, живият поток и фоновите зареждания на самата страница не го правят: иначе биха държали последния човек влязъл завинаги. Сесия, създадена с парола, няма граница за неактивност и няма какво да се отмества.

### `POST /api/auth/logout`

Прекратява сесията, с която е дошла заявката (бисквитка или bearer), и изчиства бисквитката. Без тяло. `{"status":"logged out"}`.

### `GET /api/auth/session`

Кой съм аз. За стартовата последователност на интерфейса.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Сесия, създадена на киоск панел, добавя `"idleSec"`, границата ѝ за неактивност в секунди, по което страницата знае, че трябва да излезе сама.

При изключено удостоверяване (`HOTLOOP_AUTH_INSECURE`) отговаря `{"authenticated":false,"insecure":true}` вместо 401, за да може интерфейсът да каже защо няма вход, вместо да гадае.

### `POST /api/auth/password`

Смяна на собствената ви парола. Без разрешение: познаването на сегашната парола е самото удостоверяване.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `currentPassword` | string | Задължително |
| `newPassword` | string | Задължително, поне 8 знака |

`{"status":"password changed; log in again"}`. **Всяка сесия на акаунта приключва, включително тази**, и бисквитката се изчиства: смяна на парола, която оставя старите сесии да работят, е смяна само по име. `401`, ако сегашната парола е грешна, `400`, ако новата е твърде кратка.

## Потребители

Всичко е само за администратори (`users.manage`). Хешовете на паролите никога не се появяват в отговор; полето няма JSON име.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` се появява само при акаунт, който има изричен списък. `hasPin` казва дали акаунтът има киоск ПИН или карта; стойността и нейният хеш никога не се появяват.

### `POST /api/users`

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `username` | string | Задължително. Малки букви, цифри, точка, долна черта, тире, започва с буква или цифра, от 2 до 64 знака |
| `password` | string | Задължително, поне 8 знака |
| `role` | string | `admin`, `operator` или `viewer`. По подразбиране `viewer` |
| `permissions` | string[] | По избор. Замества изцяло набора на ролята |

Отговаря с новия потребител. `400` за грешно име, роля или парола, `409`, ако името е заето.

### `PUT /api/users/{username}`

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `role` | string | Задължително, освен ако е зададено `permissions` |
| `permissions` | string[] | По избор. Празно означава „използвай ролята“ |
| `disabled` | bool | `true` забранява акаунта и прекратява всяка негова сесия |

Отговаря с обновения потребител. `400` за непозната роля или за забраняване на последния разрешен администратор: това е заключване, без да остане никой, който да го отмени. `404` за непознат потребител.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` за собствения ви акаунт или последния разрешен администратор, `404` за непознат потребител.

### `POST /api/users/{username}/password`

Администратор задава паролата на друг, без да знае старата. `{"password": "..."}`, поне 8 знака. Отговаря `{"status":"password reset"}` и прекратява всяка сесия на този акаунт.

### `PUT /api/users/{username}/pin`

Администратор дава на акаунт ПИН или стойност на карта за вход на киоск панел, или заменя този, който има. `{"code": "482913"}`: от 6 до 72 знака, без интервали или управляващи знаци, цифри или всичко друго, което въвежда четец на карти. Отговаря `{"status":"PIN set","username":"olga","hasPin":true}`. Стойността се хешира с bcrypt, както паролата, и никога не се записва в дневника, нито се връща. `400` за код, който е твърде къс, твърде дълъг или съдържа интервал, и за код, който друг акаунт вече има: панелът намира акаунта само по кода, така че един код отваря един акаунт. `404` за непознат потребител. Не пипа нито паролата, нито някоя сесия.

### `DELETE /api/users/{username}/lockout`

Пуска заключен акаунт обратно, преди да изтече заключването му, и започва броя на грешните му пароли и ПИН кодове от нула. `{"status":"unlocked","username":"olga","locked":false}`. `404` за непознат потребител. Заключен акаунт показва `"locked":true` и `"lockedUntil"` в `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Отнема ПИН кода или картата и изкарва акаунта от всеки киоск панел, на който е влязъл. Паролата му и сесиите му на собствения му компютър остават недокоснати. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` за непознат потребител.

### `GET /api/opcua/certificates`

Всеки X.509 сертификат, прикрепен към потребител за вход в OPC UA сървъра (вижте [OPC UA сървъра](/bg/edge/opc-ua-server/#потребителски-сертификати-x509)), най-новият първи: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Всеки има `thumbprint` (SHA-256 на DER формата, шестнайсетични малки букви), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` и `revokedBy` след отмяна, `lastUsed` след употреба, и `state`: `active`, `revoked`, `expired` или `not yet valid`. Само активен сертификат вкарва някого. `serverAcceptsCertificates` казва дали OPC UA сървърът е включен и има зададено `HOTLOOP_OPCUA_SERVER_ALLOW_X509`; сертификатите се пазят и в двата случая. Съхранява се и се изпраща само публичният сертификат.

### `GET /api/users/{username}/certificates`

Същият списък за един потребител. `404` за непознат потребител.

### `POST /api/users/{username}/certificates`

Прикрепя сертификат към потребител. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; етикетът е по избор. Отговаря `201` със сертификата, както е в списъка. Сертификатът трябва да е RSA с ключ от поне 2048 бита и да не е изтекъл. `400` казва кое от тези е, и за нещо, което не е сертификат: частен ключ се отхвърля по име и никога не се пази, нито се връща, както и верига. `404` за непознат потребител. `409`, когато сертификатът вече е прикрепен, към този потребител или към друг: един сертификат е един човек. Промяната е в дневника с кой я е направил.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Отменя сертификат. Той вече не може да влиза, сесия, отворена с него, приключва в рамките на 10-те секунди на кеша за разрешения, а по-късните опити се отхвърлят и се записват като отменени. Остава в списъка като `revoked` с кой го е направил и кога, а повторна отмяна запазва първия запис. `{thumbprint}` е SHA-256, както е в списъка; двоеточия, интервали и главни букви се приемат. `404`, когато сертификатът не е на този потребител.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Забравя сертификат. Ново прикрепяне го кара отново да работи. `404`, когато не е на този потребител. Изтриването на потребителя изтрива сертификатите му.

## Състояние и диагностика

### `GET /api/status`

Заглавната лента: броячи на средата за изпълнение, обобщението на алармите, името на завода и кой продукт е това. `product` е `iot`, `edge` или `gateway`, същото като `hotloop --product`. `features` са кои от функциите, които се различават между продуктите, има този: `edge-publish`, `fleet`, `opcua-server`, `reports` и `sites` в Gateway, първата и третата в Edge, никоя в IoT. `version` е компилацията, а `imageDigest` е digest-ът на образа, от който е стартирано, нещо, което номерът на версията не може да ви каже на кутия, следваща `:stable`. Има го само когато супервайзорът го е казал (Quadlet единиците го правят, преди всяко стартиране; гол двоичен файл и Helm инсталация не могат) и се пропуска иначе.

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

Всеки протокол, който Gateway познава, и дали тази компилация има драйвера му.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Какво показва екранът за диагностика: пулът на базата данни, опашката на архива и размерът на историята, шината на таговете, механизмът за същности, записващият модул на дневника, средата за изпълнение, MCP (сървър и изходящи връзки) и активираните правила на механизма за автоматизации, пътищата на webhook и опашката за промени на състоянието.

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

При конфигурирани изходящи MCP сървъри `outbound` изброява всеки от тях:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Всякакви данни за достъп в `target` или `lastError` на изходящ сървър се изчистват, защото URL или команден ред може да носи токен и всяка роля може да чете това. Самият MCP токен е само `tokenSet`.

## Устройства

Устройството е една връзка по един протокол. Какво се слага в `config` и `address`, зависи от протокола: вижте [Протоколи и драйвери](/bg/iot/protocols/).

### `GET /api/devices`

Всяко устройство, със състоянието на връзката му на живо. Данните за достъп са `[redacted]`. `?q=` оставя устройствата, чийто id, име, адрес или протокол съдържа текста (без разлика на регистъра), `?limit=` (от 1 до 5000, всичко друго е `400`) първите от тях; с което и да е от двете `X-Total-Count` е колко са съвпаднали.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` е `connected`, `connecting`, `degraded` (работи, но запитванията се провалят), `disconnected` или `disabled`. `lastError`, `errorCount` и останалото се появяват, когато има какво да се каже.

### `POST /api/devices`

Създава устройството, ако `id` е ново, и го замества, ако не е. Няма `PUT`.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `id` | string | Задължително. От 1 до 64 букви, цифри, `.`, `_`, `-`, започва с буква или цифра. Попада в URL адреси, MQTT topics и MCP аргументи |
| `name` | string | Задължително |
| `protocol` | string | Задължително. Такъв, за който тази компилация има драйвер (`GET /api/protocols`) |
| `address` | string | Задължително. Хост и порт или URL `opc.tcp://` или `http://`: решава протоколът |
| `enabled` | bool | Пропуснато е `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 взема стойността по подразбиране на средата. Интервалът на запитване има като минимум `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Поставя устройството в дървото на оборудването по име, като създава възлите при нужда |
| `equipmentId` | int | Поставя го вместо това на възел от дървото; `site`, `area` и `line` идват тогава от възела. Вижте [дървото на оборудването и етикетите](/bg/iot/equipment/) |
| `config` | object | Собствените опции на протокола. Данните за достъп следват [правилата за само запис](#тайните-са-само-за-запис) |

Полетата на средата за изпълнение (`state`, `lastPoll`, `tagCount` и т.н.) са само за четене; ако ги върнете, се пренебрегват. Отговаря със записаното устройство, със скрити чувствителни данни. `400` за протокол без драйвер, неуспешна проверка или правило за данни за достъп; средата за изпълнение се презарежда веднага с него.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Устройството, таговете и етикетите му.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` е `[]` за устройство без никакви. `404` за непознато id.

### `DELETE /api/devices/{id}`

Изтрива устройството, таговете му и техните същности. **Историята му се запазва.** `{"deleted":"tank-farm"}`, или `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` спира запитването, без да изтрива нищо. Отговаря `{"enabled":false,"id":"tank-farm"}`. `404` за непознато id.

### `POST /api/devices/{id}/browse`

Пита устройството какви точки има. Изисква само `devices.read`, защото чете. Без тяло.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Протокол, който не може да изброи точките си (Modbus, S7comm, HTTP), отговаря `200` с `{"supported":false,"reason":"..."}`: това е факт за протокола, не грешка. `503`, ако устройството не е свързано. `writable` тук е това, което устройството казва за точката, а не дали Gateway ще я записва.

### `POST /api/devices/{id}/import`

Превръща резултатите от разглеждането в настроени тагове. Изисква `tags.write`, защото създава тагове.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Всеки запис приема `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` и `writable` (резултатът от разглеждането както е дошъл). Отговаря `{"inserted":2,"updated":0}`. **Всеки импортиран таг е само за четене**, каквото и да каже устройството: открита точка не е точка, за която някой е решил, че може да се командва, а обратното по подразбиране би активирало няколко хиляди от тях наведнъж. Активирайте тези, които имате предвид, с `POST /api/tags`. `404` за непознато устройство.

## UniFi: OT мрежи, клиенти и къде е устройството в мрежата

Собственият запис на HotLoop за UniFi обектите. Вижте [UniFi Network](/bg/iot/unifi/). `{id}` под `/api/unifi` е UniFi устройство (един обект на една конзола); `{network}` е собственото ID на конзолата за мрежа, каквото го дава `GET .../networks`; `{mac}` приема всеки обичаен запис и се пази с малки букви и двоеточия.

**Никое от тези извиквания не пита конзолата нищо.** Те четат последното четене на драйвера от нея, така че оставен отворен екран не струва нищо на конзолата. Това означава и че отговарят `503`, докато устройството не е прочетено веднъж, и винаги в помощник `--mcp-stdio`, който никога не влиза в конзола. Никое от тях не пише и в конзола.

Промяна, която създава или премахва аларма, го казва в `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Това са обикновени дефиниции на аларми под `/api/alarms`.

### `GET /api/devices/{id}/network`

Къде в мрежата е едно устройство на HotLoop (PLC, електромер). Свързано:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Ако не е свързано, `link` е `null`, а `proposals` изброява клиентите, които всяка конзола, която HotLoop чете, има на IP адреса на устройството, най-новите първи. Предложението е само това: IP адресите на конзолата закъсняват, така че нищо не се свързва, докато администратор не потвърди едно.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` потвърждава кой клиент е устройството. От този момент MAC адресът е ключът и на IP адреса вече не се вярва. Клиентът получава тагове (`c.<mac>.*` на конзолата) и аларма „PLC-07 извън мрежата“, приоритет 1 със закъснение при задействане от 120 s, за да не вдигне тревога един рестарт. Отговаря `{"link":{...},"change":{...}}`. `400`, ако `consoleId` не е UniFi устройство или MAC адресът не е MAC, `404` за непознато устройство.

### `DELETE /api/devices/{id}/network`

Премахва връзката и алармата, която HotLoop е направил за нея, освен ако клиентът още се наблюдава от списък с познати. `404`, ако не е имало връзка.

### `GET /api/unifi/{id}/networks`

Мрежите на обекта, каквито ги има конзолата, със записа на HotLoop: `ot`, `known` (колко устройства има в списъка му), `clients` (в нея сега) и `unknown` (в нея сега и не в списъка). Мрежа, за която HotLoop има запис, а конзолата вече не я има, се връща с `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` бележи мрежа като OT. Всичко в нея, което не е в списъка на познатите, се брои в `n.<network>.unknown` и се назовава в `.unknown_last`, а HotLoop създава алармата „Непознато устройство в SCADA“, приоритет 1. `{"ot": false}` премахва отметката и тази аларма; списъкът на познатите се запазва. `400` за WAN или мрежа, която конзолата няма.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Приема всичко в мрежата сега, както е: единственото щракване след отбелязването ѝ. Устройствата, които вече са в списъка, запазват името и наблюдението си. Без тяло. Отговаря `{"accepted":[{known device}...]}`, тези, които е добавил.

### `GET /api/unifi/{id}/known`

Всяко познато устройство в мрежите на обекта: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` приема устройство в мрежата или променя името или наблюдението му. `watch` му дава тагове и алармата за изключване; устройство, което е разрешено, но идва и си отива (лаптоп за поддръжка), се приема без нея. `400`, ако мрежата никога не е била отбелязана като OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Маха устройство от списъка. Ако е в мрежата, при следващото четене отново е непознато.

### `GET /api/unifi/{id}/clients`

Всеки клиент, който конзолата изброява, плюс всеки наблюдаван, който не изброява, всеки с това къде е, дали е онлайн, и `ot`, `known`, `watched`, `linkedTo` и еднореден `summary`. `?q=` стеснява до MAC, IP или име.

### `GET /api/unifi/consoles`

Всяко UniFi устройство, което HotLoop има, работещо или не, за избора на екрана UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Конзола, която този процес не е чел, казва защо в `why`.

### `GET /api/unifi/{id}/overview`

Картата с общ преглед: броя на устройствата и клиентите (клиентът се брои, когато HotLoop смята, че е в мрежата, тестът, който ползват таговете `n.<id>.clients`, а не просто когато конзолата го изброява), клиентите по мрежа, `health` на подсистемите на конзолата и за всеки gateway неговата WAN лента, `gateways[]`: по един запис `wans[]` на WAN с `alive` (собствените проверки на здравето на gateway, никога `up` на WAN блока), `known`, `active`, `backup`, латентност и наличност. `failover` е трафик по WAN, който не е първият, `down` е нито един WAN жив, а `since` е първото четене, при което HotLoop е видял трафик по WAN, по който е сега, тоест кога HotLoop го е забелязал, а не кога gateway е превключил. `events` е състоянието на websocket за събития (`live`, `error`, `reconnects`) и десетте най-нови събития.

### `GET /api/unifi/{id}/topology`

Картата. `nodes[]` са приетите устройства с мястото им в мрежата (`x`, `y`, `layer`: отляво надясно от gateway, подредени по един и същи начин за едно и също четене), `edges[]` кабелите между тях от собствената `downlink_table` на конзолата, `wired[]` и `wifi[]` клиентите, закачени на всеки порт на суич и на всяка AP и SSID. Устройство, което нищо не изброява като включено в нещо, се чертае само със зададено `noUplink`, а не се закача към gateway по догадка. Устройство от друга UniFi конзола, която HotLoop чете и която тази конзола изброява като клиент, се съединява като възел със зададено `external` и ръб със `stitched`. `feeds` са, по MAC на устройството, устройствата на HotLoop, свързани с клиент надолу по веригата от него, с техния `equipmentId` за дървото на завода, а `links` същите устройства по MAC на клиента.

### `GET /api/unifi/{id}/devices`

Всяко прието устройство с числата му и неговия `ports[]` за предния панел: връзка, скорост, режим и консумация на PoE, клиентите, научени на порта, устройството, включено в него, и `dropped` за порт, който е бил нагоре при по-ранно четене, а сега е надолу. Устройство, което конзолата е загубила, не съобщава нито числа, нито връзки на портове, защото последното, което е казало, не е актуално.

### `GET /api/unifi/{id}/wifi`

SSID-тата на обекта с `enabled`, мрежата, в която са, и колко клиенти има на всяко. Когато конзолата не показва на този акаунт безжичните си мрежи, `error` казва защо, а `wlans` е празно.

### `GET /api/unifi/{id}/events`

Най-новите събития, които конзолата е докладвала, откакто HotLoop се е свързал, най-новите първи (`?limit=` до 200, по подразбиране 50), и състоянието на websocket за събития. Всяко събитие има `key` на контролера (`EVT_SW_Lost_Contact`), собствено `message`, `severity` (`warning`, когато контролерът го отбелязва като нещо, което се обърква) и устройството, клиента и порта, за които се отнася. Те са и в дневника, подредени под суича или точката за достъп, за които се отнасят (вижте [UniFi Network](/bg/iot/unifi/#събития)).

### `POST /api/unifi/{id}/starter-alarms`

Създава обичайните аларми за обекта от това, което конзолата има сега, като обикновени дефиниции на аларми под `/api/alarms`: всяко прието устройство офлайн (приоритет 2, закъснение 60 s), всеки порт за връзка нагоре, който е надолу (приоритет 1, 10 s), gateway с два или повече WAN, който работи на резервен (приоритет 2, 30 s). Тялото е по избор. `{"poeLimitW": 25}` добавя аларма с приоритет 3 за консумацията `poe_w` на всеки PoE порт над толкова вата, със закъснение 30 s; конзолата не казва какъв е бюджетът на един порт, така че HotLoop не налучква такъв. Отрицателна граница е `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` са алармите, които наборът изисква и които вече са били там: собствените му от по-ранно натискане или нечия аларма върху същия таг. Така е безопасно да натиснете отново, след като сте приели още оборудване, и добавя само новото оборудване. Алармите за OT мрежа и за извън мрежата не са част от него; те идват с отбелязването на мрежа като OT и наблюдението на устройство. `503`, докато конзолата не е прочетена веднъж.

## MQTT откриване

Устройства, които са се обявили по MQTT, и какво е решил човек за всяко. Вижте [MQTT откриване](/bg/iot/mqtt-discovery/). Откриването слуша на вградения брокер, когато работи, и на всеки брокер, настроен под `/api/mqtt/brokers`. Без нито един от двата `sources` е празно. В помощник `--mcp-stdio`, който никога не слуша, `GET /api/discovery` отговаря `{"running":false,"sources":[],"devices":[]}`, а всеки друг маршрут `503`.

`{source}` е брокерът, на който устройството се е обявило (`embedded` за собствения на HotLoop, иначе id на брокера); `{key}` е това, което е свързало обявленията му: първият му идентификатор, MAC адресът му като `mac:aa:bb:cc:dd:ee:ff` или id на възела му. Кодирайте го като URL; идентификаторите носят знаци, които пътят не търпи.

**Нито едно от тези извиквания не активира нищо.** Приемането на устройство прави точките му годни за активиране, една по една, чрез `POST /api/tags` като всяка друга точка.

### `GET /api/discovery`

Всеки източник, с това, което е видял и отхвърлил, и всяко открито устройство:

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

Източник с `external` true е брокер, настроен под `/api/mqtt/brokers`, а `broker` казва къде е. `autoCreate` false е източник, чиито устройства чакат във входящата кутия: изброени като `discovered` без `deviceId`, нищо не се създава и нищо не се чете, докато някой не приеме едно. `listenOnly` е брокер, на който HotLoop никога не публикува. `lastError` казва защо един източник не е свързан, включително парола, която не може да се отвори.

`status` е `discovered`, `accepted` или `ignored`. За всеки компонент `unsupported` изброява това, което HotLoop не може да ползва, и защо («value template not supported: filter `regex_findall_index` is not supported at column 12»), `unknownKeys` конфигурационните ключове, които форматът не дефинира, `commandTopics` всеки topic, към който могат да отиват командите му (topic за скоростта на вентилатор освен основния), а `flags` това, което човек трябва да погледне преди приемане: команден topic извън topics, които компонентът чете, вътре в префикса за откриване или претендиран от друго устройство, и конфигурация, която иска задържани команди. `withdrawnAt` е зададено при компонент, който издателят е изтеглил. `suggestedEquipmentId` е възелът от дървото, който `suggested_area` на устройството назовава, когато точно един възел има това име; то само предварително попълва диалога за приемане. На вградения брокер `announcedBy` и `announcedVia` са входът на брокера и id на клиента, които са публикували последната му конфигурация, а `acceptedLogin` входът, от който е приет. Прието устройство, чието обявление се е променило или което друг вход е обявил, има `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Едно устройство, със същата форма. `404` за такова, което HotLoop не е виждал.

### `POST /api/discovery/{source}/{key}/accept`

Приема устройство. Незадължително тяло `{"equipmentId": 12}` го поставя в дървото в същата стъпка. Не активира нищо. Отговаря с устройството. `400` за игнорирано.

### `POST /api/discovery/{source}/{key}/ignore`

Отхвърля устройството: устройството му в HotLoop, таговете и същностите му изчезват (историята му остава), и остава игнорирано, когато се обяви отново. Отговаря с устройството. `DELETE /api/devices/{id}` върху открито устройство прави същото, защото устройство, което продължава да се обявява, просто би се върнало.

### `POST /api/discovery/{source}/{key}/unignore`

Връща игнорирано устройство като открито, от това, което е обявило последно. `400`, ако не е игнорирано.

### `POST /api/discovery/{source}/{key}/review/apply`

Кара прието устройство да изпълнява това, което е обявило. Дали всяка точка е активирана, си остава както е било. `400`, когато нищо не чака преглед.

### `POST /api/discovery/{source}/{key}/review/reject`

Оставя приетата конфигурация да работи и спира да предлага тази промяна. Различна промяна по-късно се предлага отново. `400`, когато нищо не чака.

Прегледът може да е за това кой го е обявил: промяна с `"kind":"publisher"` и обобщаващия ред «announced by login garage-node; accepted from kitchen-node». Прилагането ѝ прави този вход този, от който устройството е прието.

## Входове на брокера

Входовете на вградения брокер, направени в HotLoop, всеки с topics, на които може да публикува и да се абонира. Вижте [вградения MQTT брокер](/bg/iot/broker/). Входът е ключ към брокера на целия завод, така че това са `users.manage`, на администратор. Нищо тук никога не отговаря с парола или нейния хеш. Всяка промяна влиза в дневника и важи от следващото публикуване на клиента; никой не трябва да се свързва отново.

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

`running` е false там, където този процес не изпълнява брокера; входовете пак се пазят и брокерът ги чете, когато стартира. `envLogins` са имената от `HOTLOOP_BROKER_USERS`, които могат всичко. `%u` в правило е собственото име на входа, а `%p` префиксът за откриване; `resolved*` са правилата с попълнени и двете.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` е от 1 до 64 букви, цифри, `-` и `_` (стои вместо `%u` в topics). `password` е поне 12 знака. `profile` попълва правилата; `publish` и `subscribe`, когато са дадени, ги заместват. Нужно е едното от двете. Правилото е филтър за MQTT topic: `+` и `#` само като цели нива, `#` само последно, никога `$` topic. `201` с входа; `400` за нещо от горното или име, което `HOTLOOP_BROKER_USERS` вече има; `409` за заето име.

### `PUT /api/broker/logins/{name}`

Всяко от `profile`, `publish`, `subscribe` и `password`; което не е изпратено, остава. `200` с входа, `404` за такъв, който не съществува.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Клиент, още свързан с него, не може да прави нищо оттук нататък и не може да се свърже отново. `404` за такъв, който не съществува.

## Откриване в мрежата

Устройства, чути в мрежата на завода по mDNS, SSDP и DHCP, и какво е решил човек за всяко. Вижте [Откриване в мрежата](/bg/iot/network-discovery/). В помощник `--mcp-stdio`, който никога не слуша, `GET /api/network-discovery` отговаря `{"running":false,"finds":[]}`, а всеки друг маршрут `503`.

`{key}` е как е чута находката и от кого: `mdns:` и mDNS името на хоста, `ssdp:` и UPnP uuid, `dhcp:` и MAC адресът. Кодирайте го като URL.

**Нито едно от тези извиквания не активира нищо**, и нищо тук не се добавя, докато някой не го приеме.

### `GET /api/network-discovery`

Слушателите, сондирането, интерфейсите, на които са, и всяка находка:

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

`kind` е `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (обявило е нещо, за което HotLoop няма дума), `upnp` или `dhcp`. Находка, чийто `proposal` има `protocol`, става при приемане устройство с този протокол на `address`; такава без него казва в `how` какво би я въвело. `also` изброява другите находки и открити по MQTT устройства, които са същата кутия, по MAC или адрес. `status` е `discovered`, `accepted` или `ignored`, а `deviceId` устройството, което приемането е направило. `error` на слушател казва защо не слуша (порт 67 зает или непозволен, няма multicast интерфейс); `refused` брои новите находки, отхвърлени, защото записът е пълен.

### `GET /api/network-discovery/{key}`

Една находка, със същата форма. `404` за такава, която HotLoop не е чул.

### `POST /api/network-discovery/{key}/accept`

Приема находка. Незадължително тяло `{"equipmentId": 12}` поставя в дървото устройството, което създава. Находка, за която HotLoop има драйвер, става устройство на предложения адрес, разрешено, без тагове и без нищо активирано; всяка друга се записва като позната и не създава нищо. Отговаря с находката. `400` за вече приета или игнорирана.

### `POST /api/network-discovery/{key}/ignore`

Скрива находка, за която никой не е решил, и я държи скрита, когато бъде чута отново. `400` за вече решена.

### `POST /api/network-discovery/{key}/unignore`

Връща игнорирана находка, за да се реши за нея. `400`, ако не е игнорирана.

### `POST /api/network-discovery/probe`

Сондира сега: mDNS заявка и SSDP търсене на всеки интерфейс, чиято мрежа е изброена в `HOTLOOP_NETDISC_PROBE_NETWORKS`, и никъде другаде. Отговаря `{"status": ...}`, с това, което не е излязло, в `status.probe.lastError`. `400`, когато никоя мрежа няма включено сондиране: този бутон не може да го включи, само инсталацията може.

## Интеграции

Потокът за настройка за вид устройство, към което човек насочва HotLoop: пита какво е нужно на интеграцията, поглежда истинското устройство с отговорите и създава устройството и таговете му от намереното. Вижте [Интеграции](/bg/iot/integrations/).

**Нищо тук не активира нищо.** Всеки таг, който настройката създава, е само за четене. Активирането му е `POST /api/tags` като всяка друга точка.

### `GET /api/integrations`

Всяка интеграция, която тази компилация има, с въпросите, които задава:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` е `text`, `number`, `bool`, `choice` или `secret`. Поле с `showWhen` (`{"version":["3"]}`) се пита само когато друг отговор има една от тези стойности, а отговор на въпрос, който не се показва, се пренебрегва.

### `POST /api/integrations/{id}/probe`

Проверява отговорите и отива да погледне истинското устройство. Не записва нищо.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Отговаря `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` е адресът, както интеграцията го е разрешила. `found` има `name` (как устройството се нарича само), `identity` (какво казва, че е), `notes` (неща, които да се знаят преди приемане) и `points`, всяка във форма на таг `{name, address, dataType, unit, description, writable, deviceClass}` плюс `group`, `sample` (което е прочело, когато е било намерено) и `suggested`.

`400` за отговори, които не пасват на въпросите, всички проблеми наведнъж; отговор на въпрос, който интеграцията не задава, също е `400`, не се пренебрегва. `502`, когато устройството не е отговорило или е отговорило с нещо, което не е неговият протокол, с това, което се е объркало. `404` за интеграция, която тази компилация няма. Тайна никога не е в отговор или грешка.

### `POST /api/integrations/{id}/setup`

Поглежда устройството отново, после го създава с таговете му. Тялото е това на сондирането, плюс:

| Поле | Значение |
|---|---|
| `deviceId` | Id на новото устройство. Празно взема такова от името. `400`, ако устройство го има |
| `name` | Името на устройството. Празно взема как устройството се нарича само |
| `points` | Имена от `found.points`, които да се настроят. Празно взема отбелязаните като `suggested`. Име, което устройството няма, е `400` |
| `site`, `area`, `line` | Къде отива в дървото на оборудването, както при `POST /api/devices` |

Точките се проверяват спрямо устройството, както е сега, а не спрямо това, което клиент твърди, че е намерил преди минута. Отговаря `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Устройството е разрешено и се запитва, всеки таг е само за четене, и всеки таг има своята същност за четене. Настройка, която се проваля по средата, не оставя устройство.

## MQTT брокери

Брокери, различни от собствения на HotLoop, които откриването слуша: Mosquitto на завода, брокерът, който кутия с Zigbee2MQTT е донесла. Вижте [MQTT откриване](/bg/iot/mqtt-discovery/#други-брокери). Паролите им са запечатани с ключа за данни за достъп на устройствата (`HOTLOOP_SECRET_KEY_FILE`) и никога не се връщат; `passwordSet` казва дали има записана, а `passwordProblem` защо записана не може да се отвори. Всяка промяна влиза в дневника и влиза в сила веднага: слушателят и устройствата от този брокер се свързват отново.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` е дали този HotLoop има ключ, с който да запечата парола.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` е от 1 до 63 малки букви, цифри и `-`, не `embedded`: назовава брокера във всяко устройство, дошло от него, и не може да се променя. `broker` е `host:port` или URL `tcp://`, `ssl://`, `tls://`, `mqtt://` или `mqtts://`, без вход в него. `prefix` е по подразбиране `homeassistant`; `autoCreate` false (устройствата чакат във входящата кутия); `listenOnly` false; `tasmota` (чуване и на собственото откриване на Tasmota, `tasmota/discovery/#`) true; `shelly` (научаване на устройства Shelly Gen2 и по-нови от topics `<prefix>/status/<component>`, които публикуват) true; `enabled` true. Паролата изисква потребителско име и ключ: без `HOTLOOP_SECRET_KEY_FILE` е `400`, никога не се съхранява в чист вид. `201` с брокера; `409` за заето id.

### `PUT /api/mqtt/brokers/{id}`

Всяко от полетата по-горе освен `id`; което не е изпратено, остава. `"password":""` изчиства паролата. `200` с брокера.

### `DELETE /api/mqtt/brokers/{id}`

Премахва брокера и това, което е обявил и никой не е приел: входящата кутия и всяко устройство, което е създал сам. `409`, който ги назовава, докато още съществуват устройства, приети от него: игнорирайте или изтрийте първо тях, или изключете брокера с `"enabled":false`. `200` `{"deleted":"plant-uns"}`.

## Тагове

### `GET /api/tags`

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `device` | Само таговете на това устройство. Без `limit` отговаря с всички |
| `q` | Търсене: подниз, без разлика на регистъра, от id на устройството, името на тага или описанието. Работи заедно с `device` |
| `limit` | Цяло число от 1 до 5000. По подразбиране 500 без `device`. Всичко друго, включително 5001, е `400`: отхвърля се, никога не се отговаря с по-малко (до 4.19.5 всяка граница над 1000 тихо се превръщаше в 200) |
| `writable` | `true` само за таговете, отбелязани като записваеми (което предлагат изборите за запис) |
| `offset` | Откъде започва страницата, нула или повече. Таговете са подредени по устройство, после по име |

Заглавката `X-Total-Count` на отговора казва колко тага съвпадат общо, така че клиентът страницира с `offset`, докато ги има всички, и знае, че ги има. Празен отговор е `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Създава тага, ако `deviceId` и `name` са нови, и го замества, ако не са.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `deviceId` | string | Задължително. Устройството трябва да съществува (`404`, ако не) |
| `name` | string | Задължително. Без управляващи знаци |
| `address` | string | Задължително. Собственият адрес на протокола |
| `dataType` | string | `bool`, `int`, `float` или `string` (и обичайните псевдоними: `int16`, `word`, `coil`...). Решава как се кодира записът |
| `unit`, `description` | string | |
| `enabled` | bool | Пропуснато е `false` |
| `writable` | bool | **Активира тага за запис, от всеки път: интерфейс, автоматизации, същности, MCP.** Пропуснато е `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | С `hasRange` запис извън диапазона се отхвърля (никога не се подрязва) |
| `scale`, `offset` | number | инженерна стойност = суров x мащаб + отместване. Мащаб 0 е 1 |
| `noData` | list | Сурови стойности, които означават „няма измерване“, всяка `{"raw", "reason"}`. `raw` е низ (`"0x8005"`, `"-32763"`) или гол брой и се връща като низ. Отчитане, чиято сурова стойност е в списъка, е с лошо качество с този `reason`, проверено преди `scale` и `offset`. До 32 кода. Код, който не е цяло число, е изброен два пъти или не може да е от типа на точката, е `400`. Вижте [Протоколи и драйвери](/bg/iot/protocols/#no-data-values) за това какво да се пише за всеки тип и примера с Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Промени, по-малки от това, не се записват в историята |
| `deviceClass` | string | Класът, с който започват същностите на тага (`power`, `connectivity`, `temperature`...), когато означава нещо за домейна им. Взема се при създаване на тага и се пренебрегва при замяна: оттук нататък същността притежава класа си, така че го сменете там |

Отговаря със записания таг. Записването на такъв с `writable: true` се отбелязва като такова: активирането на таг е решение за безопасност и получава име до себе си. Същностите на тага се създават или обновяват преди отговора, така че клиентът може да ги поиска веднага.

Таг на открито устройство, което никой не е приел, не може да се активира: `400`, „accept the device first“. Вижте [MQTT откриване](/bg/iot/mqtt-discovery/#команди).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, или `404`. Историята остава. Същностите на тага стават сираци (вижте [Същности](/bg/iot/entities/#deleted-tags-orphans-and-re-adoption)).

## Стойности, таблото и записи

### `GET /api/values`

Последното отчитане на всеки таг, от паметта. `?device=` го стеснява до едно устройство.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Тази форма е `TagValue` на таблото на EmberNet и е договор. `quality` е `good`, `uncertain` или `bad`; **лошо отчитане значи, че стойността не се знае, а не че е нула**. Отчитане на низ носи `stringVal`, а неговото `tagValue` не значи нищо.

Отчитане, което не е добро, носи `reason`, когато драйверът знае защо, така че екран да може да каже повече от „лошо“:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Доброто отчитане никога не го има, така че договорът по-горе е байт по байт какъвто беше. Архивът не го пази: `/api/history` има качеството, не причината.

### `GET /api/sparkline`

Последните отчитания на един таг, пазени в паметта (`HOTLOOP_RING_SIZE`, по подразбиране 30), за малките графики. `?tag=device/tag`, задължително.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` са Unix милисекунди. И двете са `[]` за таг без отчитания. `400` за повреден ключ.

### `GET /api/board`

Кои тагове са закачени на таблото и в колко колони. Съхранява се в базата данни, не в браузъра, защото таблото принадлежи на завода: панелният компютър в цеха и лаптопът в офиса показват същото.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` назовава таблото, както е съхранено. Върнете го със запис и записът се отхвърля, ако таблото се е променило оттогава (по-долу).

### `PUT /api/board`

Същата форма. `columns` извън 1 до 4 става 3; дубликатите се махат. `rev` е по избор: с `rev` на таблото, което сте прочели, запис върху табло, променено оттогава, е `409` и не променя нищо, така че страница, която никога не е чела таблото или е чела старо, не може да замени това на завода със своето копие. Ако го пропуснете, записът не се проверява, което пасва на клиент, който задава цялото табло всеки път. Уеб интерфейсът чете таблото при стартиране и изпраща `rev` с всеки запис. Всеки таг трябва да съществува (`404`, който назовава този, който не съществува): остарял запис е уред, който никога не се помръдва. Отговаря с таблото, както е съхранено. Операторите имат `board.write`: подреждането на таблото е управление на завода, не настройване.

### `POST /api/write`

Записва една стойност в един таг, през вратата за запис.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `tag` | string | Задължително. `device/tag` |
| `value` | bool, number or string | Задължително. `true` е bool, `42` цяло число, `42.5` float, `"42"` низ: JSON типът е типът, който се записва, защото coil, дума и реално число са три различни неща по кабела |
| `reason` | string | По избор. Записва се в дневника със записа |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Стойността е в единиците на тага, както е отчитането.** При таг с мащаб или отместване това, което изпращате, е това, което тагът би прочел обратно, и HotLoop изпраща на устройството броя, който го дава: 55.5 на регистър с мащаб 0.1 слага 555 в регистъра. (До 4.18 числото отиваше до устройството такова, каквото е, така че 55.5 ставаше 55 и се четеше като 5.5.) Проверката на диапазона и редът в одита ползват вашето число, в единиците на тага. Брой, който след това не се побира в регистъра, например 7000 на `uint16` с мащаб 0.1, се отхвърля с назован брой и регистър, и нищо не се изпраща. Частта от брой се отрязва, както винаги е правил регистър с цял брой: 12.34 на регистър с мащаб десети съдържа 12.3.

Вратата проверява по ред, че записите са включени (`HOTLOOP_ALLOW_WRITES`), че тагът е активиран и че стойността е в диапазона. Всеки опит, отхвърлен или не, е в `GET /api/writes`.

| Статус | Кога |
|---|---|
| 400 | Няма стойност, стойност `null`, повреден ключ |
| 403 | Записите са изключени, или `"tank-farm/level: this tag is not marked writable"` |
| 404 | Няма такъв таг |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Устройството не е свързано |

## История и одит

### `GET /api/history`

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `tag` | Задължително, повторяемо, до 50: `?tag=a/x&tag=b/y` |
| `minutes` | Докъде назад от сега. По подразбиране 60 |
| `bucket` | Размер на интервала в секунди. По подразбиране: избран така, че прозорецът да има около 400 интервала, на стълба от 1 s до 1 ден |
| `raw` | `true` за самите отчитания вместо интервали |
| `limit` | По подразбиране 5000, най-много 100000 |
| `carry` | `true`, за да се каже и какво е държал всеки таг, когато прозорецът е започнал (само интервали) |

По интервали, най-старите първи за всеки таг. `badCount` е колко отчитания в интервала не са били с добро качество; броят се, не се усредняват. `from` и `to` са прозорецът, за който е отговорът, на точно `minutes` разстояние и завършващ, когато е зададен въпросът:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

Архивът пази отчитане, когато стойност се премести отвъд мъртвата си зона, а не при всяко запитване, така че таг, който е стоял неподвижен, няма какво да се нарисува в прозореца. С `carry=true` отговорът има и `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: последното отчитане преди `from`, за всеки таг, чието последно по-ранно отчитане е било добро и е имало число. Таг, чието последно отчитане е било лошо или несигурно, който няма по-ранно отчитане или който е текст, няма запис, защото това, което е държал, не се знае и няма да даваме на графика догадка. Картата за тренд рисува от това.

Сурови, най-новите първи:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` без `tag`, с повече от 50 или с повреден ключ.

### `GET /api/writes`

Одитът на записите, най-новите първи. Всеки опит е тук, включително отхвърлените, защото „не знаем дали тази команда е излязла“ е най-лошият отговор, който един завод може да получи.

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `tag` | Един таг, `device/tag` |
| `device` | Всеки таг на едно устройство (пренебрегва се, ако е зададен `tag`) |
| `entity` | Всеки запис, който извикване на услуга върху тази същност е направило или му е бил отказан, вместо горното |
| `call` | Всеки запис на едно извикване, вместо всичко горно: натискане и пускане на бутон или всяка цел на прилагането на рецепта, които споделят `call_id` |
| `limit` | По подразбиране 100, най-много 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` е `ui`, `api`, `automation` или `mcp`. `entityId`, `service` и `callId` са само при записи, направени от извикване на услуга.

## Същности и състояния

Всеки таг получава същности, без някой да ги иска; съставните (двигатели, вентили, контури, броячи, избори, бутони, метеостанции) се изграждат от тагове от администратор. В snake_case, като всяка крайна точка за същности. Целият модел е в [Същности](/bg/iot/entities/).

### `GET /api/entities`

Всяка същност, включително сираците.

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Същностите на едно устройство |
| `orphaned` | `true` само за сираците, `false` за никоя |
| `q`, `limit` | Търсене: подниз, без разлика на регистъра, от id на същността, името или id на устройството, и най-много `limit` от тях (от 1 до 5000, всичко друго е `400`, никога тихо не се съкращава), подредени по id на същността. `X-Total-Count` е колко са съвпаднали. Пропуснати, списъкът е пълен |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Какво може да създаде `POST /api/entities`: всеки домейн, ролите, към които са свързани таговете му, и услугите, които приема. Ролята казва своя `kind` на таг, дали е `required`, дали услуга я записва (`command`) и дали състоянието се чете от нея (`feedback`). Метеостанцията не приема услуга.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` е `null` за забранена същност. `404` за непозната.

### `GET /api/entities/{entity_id}/image`

Последната картина на камера или изображение, като байтовете, които HotLoop държи: `Content-Type` е това, което са (`image/jpeg`, `image/png`, `image/gif` или `image/webp`), с `X-Content-Type-Options: nosniff`, изолираща `Content-Security-Policy` и `ETag` (`If-None-Match` получава `304`). `404` за същност, която не е такава, или преди да е пристигнала картина. Атрибутът `entity_picture` на състоянието е този път с хеша на картината върху него.

### `PUT /api/entities/{entity_id}`

Променя само изпратените полета. Само за администратори: entity_id е името, с което всяка автоматизация, табло и агент се позовава на същността, и промяната му е конфигурация.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `entity_id` | string | Преименуване. `unique_id` не се мести |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | По домейн; вижте [Същности](/bg/iot/entities/#api) |
| `disabled`, `hidden` | bool | Забранената същност няма състояние и не може да се командва |
| `equipment_id` | int or null | Поставя я в дървото; `null` отново следва устройството ѝ |
| `labels` | string[] | Целият набор |

`unique_id`, `domain`, `platform`, устройството и свързванията не могат да се променят тук, а изпращането им е 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` казва кога нещо е законно, но странно (единица, която класът на устройството обикновено няма). `400` за празно тяло (`"the update names no field to change"`) или лоша стойност, `404` за непозната същност, `409` за заето entity_id.

### `POST /api/entities`

Създава съставна същност. Тялото назовава домейна и свързва тагове към ролите му:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Също `entity_id` (иначе се генерира от името), `device_class`, `unit_of_measurement`, `icon`, `entity_category` и `options`. Кои роли и опции приема всеки домейн, е в [Същности](/bg/iot/entities/#composite-equipment). Отговаря `201` `{"entity": {...}, "warnings": [...]}`. `400` за домейн, който не се създава тук (`sensor` идва от тага си, `alarm` от дефиницията си), липсваща роля или таг, който не може да я запълни, `409` за заето entity_id.

### `DELETE /api/entities/{entity_id}`

Изтрива съставна същност или сирак, чийто таг или дефиниция на аларма вече я няма. `{"deleted":"motor.transfer_pump","entity":{...}}`. Всичко друго отговаря `409`, като казва как все пак изчезва:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Състоянието на всяка разрешена същност, подредено по entity_id. `?domain=` филтрира.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` е винаги низ, дори за число; `unknown` и `unavailable` значат каквото казват. `last_reported` е времевата марка на устройството за отчитането зад него.

### `GET /api/states/{entity_id}`

Едно състояние. `404` за непозната същност и друго `404` за забранена, което казва как да се разреши: забранената същност не липсва, а да се обяви за липсваща праща някого да търси печатна грешка.

## Енергия

Какво използва заводът и колко струва: киловатчасове, газ, вода, сгъстен въздух и цената на произведена единица. Броячът е таг, четен като използвано количество. Целият модел, тарифите и какво прави екранът са в [Енергия](/bg/iot/energy/). Четенето е `energy.read`, което имат всички роли; създаването или промяната на брояч или тарифа е `energy.write`, на администратор.

### `GET /api/energy/meters`

Всеки брояч, по вид и после по име, всеки с това как се чете и какво е използвал днес.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` е `ok`, `waiting` (от тага още нищо не е прочетено), `bad` (отчитането на тага не е добро, а `reason` казва защо) или `disabled`.

### `POST /api/energy/meters`

Създава брояч. `id` са малки букви, цифри, `-` и `_`. `kind` е `electricity`, `gas`, `water`, `air`, `heat` или `production`. `mode` е `counter` (натрупващ таг: използваното е колко се е придвижил, по `factor`) или `power` (скорост: използваното е скоростта за времето, през което е била, с `power_unit` `W`, `kW` или `MW`, и `unit` `Wh`, `kWh` или `MWh`). `source` е тагът. `tariff` е фиксирана `price` на единица с незадължителна `currency` и незадължителни `bands` (`from` и `to` на четвърт час, `days`, `price`) за тарифа по часови пояси; брояч за производство няма такива. Електромер в `Wh`, `kWh` или `MWh` може да има и `demand_price` в тарифата: колко струва един киловат от най-високата му четвърт час в прозорец. Пропуснато `enabled` е `true`. `201` с `{"meter": {...}, "warnings": []}`. `400`, който казва какво не е наред: тагът го няма или не е число, лента не е на четвърт час, брояч за мощност с множител. `409` за заето id.

### `GET /api/energy/meters/{id}`

Един брояч, както го показва списъкът. `404` за непознат.

### `PUT /api/energy/meters/{id}`

Замества дефиницията на брояч. Което вече е отброил, остава и пази цената, по която е направено. Насочването му към друг таг или режим забравя докъде е стигнало последното отчитане, защото следващото отчитане е на нещо друго.

### `DELETE /api/energy/meters/{id}`

Премахва брояч и всичко, което е отброил. `404` за непознат.

### `GET /api/energy/summary`

Използването и цената на всеки брояч за прозорец и цената на произведена единица. Прозорецът е `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, или смяна, записана `shift:06:00-14:00` за последната започнала и `last_shift:06:00-14:00` за предишната; дните, месеците и смените са на обекта) или `?from=&to=` като RFC 3339, с включено from и невключено to, най-много 400 дни. `meters` е списък, разделен със запетаи, на броячите, чиято цена влиза в цената на единица, а `per` назовава единствения брояч за производство, на който да се дели.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` е делът на досегашния прозорец, който отчитанията покриват. Цени в две валути никога не се събират, така че има ред `per_unit` за всяка. `cost_per_unit` е `null`, когато нищо не е произведено (`reason` е `nothing_made`) или когато е произведено и никой брояч с цена още не е отброил използване (`nothing_counted`): това не е отговор, не е нула.

Брояч с `demand_price` има `demand` в реда си: `peak_kw` (най-високата четвърт час на прозореца, като киловатите, които е средно), `peak_at` (кога е започнала), `peak_covered_seconds` (колко от тази четвърт час е прочетено; под 900 пикът е занижен) и `cost` (пикът по цената). `cost` на реда остава това, което е струвала енергията; `costs` и `per_unit` включват таксата за мощност.

### `GET /api/energy/summary/{period}`

Същото като обобщението, за един назован период (или смяна), даден в пътя. `meters` и `per` пак отиват в заявката.

### `GET /api/energy/series`

Използването на един брояч за прозорец, `?meter=<id>`, прозорецът както по-горе, и `step`: `quarter` (най-много 8 дни), `hour` (по подразбиране), `day` или `month`. Стъпка без отчитания не е в списъка.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Същото като серията, с брояча, назования период и стъпката в пътя, за извикващ, който има само път за даване.

## Услуги

### `POST /api/services/{domain}/{service}`

Командва една същност: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Една същност, една услуга, едно извикване. Отдолу не е нищо друго освен записи на тагове през същата врата за запис като `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` е задължително и е една същност, не списък; `reason` е по избор; всичко останало са данните на услугата (`value`, `option`, `position`, `mode`, `minutes`, `note`). Числата запазват типа, с който са въведени. Домейнът в пътя трябва да е този на същността. Всяка услуга и данните ѝ са в [Същности](/bg/iot/entities/#what-each-domain-takes).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Всеки запис е `written`, `not_sent` (отхвърлен, преди да стигне до устройството), `failed` (излязъл е и устройството е докладвало грешка, така че не се знае дали е сработил) или `skipped` (по-ранен запис в извикването не е успял). Вече направените записи никога не се връщат. Услугите на същност аларма не записват таг и отговарят с `alarm`, както го е оставил механизмът. Тези на helper също не записват таг и отговарят със `state`, в който са го оставили:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

`turn_on` на скрипт го изпълнява, с данните като негови полета, и отговаря със `script_run`, който е започнал; записите на стъпките му се одитират един по един като `script:<id>`, не тук. `turn_off` спира всяко негово изпълнение. Вижте [Скриптове](#скриптове).

`turn_on` на сцена прилага рецептата ѝ, с `params` и `version` от данните, и отговаря с цялата `recipe_application` и, в `writes`, всеки запис, който целите ѝ са направили, по ред. Проваля се, освен ако във всяка цел не е записано. Вижте [Рецепти](#рецепти).

Неуспешно извикване отговаря със статуса на грешката и същото тяло плюс `error`, за да се види точно къде е спряло:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Статус | Кога |
|---|---|
| 400 | Няма `entity_id`, грешен домейн, непозната услуга, данни, които услугата не приема |
| 403 | Разрешението или вратата е отказала по политика |
| 404 | Няма такава същност |
| 409 | Превключване без известно състояние, оборудване в грешно състояние за услугата |
| 422 | Стойност, отхвърлена по същество |
| 503 | Устройството не е свързано; алармения механизъм не работи |
| 500 | Натискането на бутон е излязло, а пускането му не. **Тагът може още да държи стойността на натискане**: проверете го и го пуснете на ръка |

**`?dry_run=true`** пита какво би направило извикването и не прави нищо от това: нищо не се записва, одитира или регистрира. Извикването се планира като истинското и всеки запис се подлага на проверките на самата врата, в същия ред, още сега. Присъдата отговаря 200, отхвърлена или не: всеки запис `would_write`, или първият, който би бил отхвърлен, `not_sent` с причината, а останалите `skipped`, и `error` е грешката, с която би се провалило истинското извикване, дума по дума.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Заявка, която истинското извикване би отхвърлило преди всяка проверка (няма такава същност, непозната услуга, данни, които услугата не приема, превключване без известно състояние), отговаря със статуса и грешката на истинското извикване; така е и при липсващо разрешение. `dry_run` е `true` или `false` и нищо друго: `yes` е 400, не догадка, защото погрешната догадка превръща въпроса в команда. Вижте [Същности](/bg/iot/entities/#asking-first-the-dry-run).

**Защо разрешението се проверява в обработчика.** Изисква `values.write`, както и директният запис на тага, защото това е всичко, което е; услугите на същност `alarm` изискват вместо това `alarms.ack`, както екранът за аларми, тези на helper изискват `helpers.write`, което операторът има, тези на скрипт изискват `scripts.run`, както `POST /api/scripts/{id}/run`, а тези на сцена изискват `recipes.apply` и собственото разрешение на рецептата, когато назовава такова, както `POST /api/recipes/{id}/apply`. Проверката се прави вътре в обработчика, а не пред него, за да може отказ поради липсата ѝ да бъде изпратен до вратата за запис и **одитиран срещу същността** като всеки друг отказ, със стойността, която е била поискана. Потребител без разрешението получава 403 и ред в `GET /api/writes?entity=...`, а не 403 и нищо. Helper не записва таг, така че отказът за helper, включително този, е вместо това предупреждение в системния дневник (`GET /api/events`) срещу helper, и така е и за скрипт. Отказът за сцена е отхвърлено прилагане в историята на рецептата, с потребителя върху него.

## Помощници

Стойности, които принадлежат на хората в завода, а не на PLC: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` и `schedule`. Помощникът е същност (платформа `helper`) и се появява в `/api/entities` и `/api/states` като всяка друга; тези маршрути са неговата конфигурация. Стойността му се задава чрез услугите по-горе, с `helpers.write`. Всеки домейн, опция и услуга е описан в [Помощници](/bg/iot/helpers/).

### `GET /api/helpers`

Всеки помощник, всеки със полетата на своята същност и `value`, реда, записан за него:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Създава помощник с началната му стойност. Само за администратори.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Също `entity_id` (иначе се генерира от името) и `icon`. Връща `201` `{"helper": {...}}`. `400` за домейн, който не е на помощник, опция, която домейнът не приема, или `initial`, който собствените му опции биха отхвърлили; `409` за зает entity_id.

### `GET /api/helpers/{entity_id}`

Един помощник, както в списъка. `404` за непозната същност или такава, която не е помощник.

### `PUT /api/helpers/{entity_id}`

Променя `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` или `labels`, същите полета като `PUT /api/entities/{entity_id}`. Само за администратори. Нови опции, които не биха допускали стойността, която държи сега (диапазон, стеснен под нея, премахнат избраният вариант), дават `400`: стойността никога не се премества, за да пасне. Връща `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Изтрива помощника и стойността му. Само за администратори. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` отказва помощник с `409`, който сочи насам.

## Оборудване и етикети

Дървото по ISA-95 (предприятие, обект, зона, линия, клетка, единица, оборудване) и свободните етикети. В snake_case. Всички роли четат; само администратор променя, защото преименуването или преместването на възел пренаписва обекта, зоната и линията на всяко устройство под него. Вж. [дървото на оборудването и етикетите](/bg/iot/equipment/).

### `GET /api/equipment`

Всеки възел, подреден по id, всеки със своя `path` от имена от корена. `?level=area` филтрира. `?q=` запазва възлите, чийто път съдържа текста (без значение главни или малки букви), `?limit=` (от 1 до 5000, всичко друго е `400`) първите от тях; с което и да е от двете `X-Total-Count` е колко са съвпаднали.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` null или пропуснат създава корен. Детето трябва да е на по-ниско ниво от родителя си (оборудване може да стои в оборудване). Връща `{"equipment": {...}, "devices_rewritten": []}`. `400` за грешно ниво или място, `409` за съсед със същото ниво и име.

### `GET /api/equipment/{id}`

Възелът, възлите непосредствено под него и устройствата и същностите, поставени непосредствено върху него:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` за id, което не е положително число, `404` за непознато.

### `PUT /api/equipment/{id}`

Което и да е от `name`, `description`, `level`, `parent_id` (`null` го премества в корена). Променят се само изпратените полета; празно тяло е 400. Връща възела и **всяко устройство, чийто текст за обект, зона или линия се е променил вследствие на това**, защото точно този текст четат по-старите клиенти и MCP инструментите:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409`, докато има нещо под него или поставено върху него, и казва какво: изтриването на възел изпод краката на устройство не е решение, което се взема случайно.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` е задължително; `label_id` (от 1 до 64 малки букви, цифри и долни черти) се генерира от името, ако е пропуснато, и после никога не се променя. `color`, `icon` (`mdi:...`) и `description` са по избор. Връща етикета. `409` за име или id, които са заети.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: етикетът и това, което го носи. `404` за непознат.

### `PUT /api/labels/{label_id}`

Заменя `name`, `color`, `icon` и `description`; пропуснато поле се изчиства. `label_id` в тялото трябва да съвпада с пътя: иначе `400`, защото label_id никога не се променя.

### `DELETE /api/labels/{label_id}`

Премахва го от всичко, което го носи. `{"deleted":"critical"}` или `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` заменя целия набор на устройство. Връща `{"id":"tank-farm","labels":["critical"]}`. Всеки етикет трябва да съществува (`400` с имената на липсващите), и устройството също (`404`). Етикетите нарочно не са част от `POST /api/devices`: всеки клиент, който записва устройство, изпраща цялото устройство без тях и би ги изтривал при всеки запис.

## Аларми

ISA-18.2: възникването, потвърждаването и връщането към нормално са различни неща, и журналът може да каже кое от тях се е случило.

### `GET /api/alarms`

Всяка дефиниция, живите аларми и обобщението. `?outstanding=true` пропуска нормалните и заглушените.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` е `normal`, `unack-active`, `ack-active`, `rtn-unack` (върнала се към нормално, преди някой да я е потвърдил, и оставена в списъка, за да не изчезне задействане в 3 през нощта, преди сутрешната смяна да го види), `shelved` или `suppressed`. `tripValue` е показанието, което я е задействало, а не текущото.

### `POST /api/alarms`

Създава или заменя дефиниция.

| Поле | Тип | <span class="sr-only">Подробности</span> |
|---|---|---|
| `id`, `name` | string | Задължително. `id` следва правилата за id на устройство |
| `deviceId`, `tagName` | string | Задължително |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (без показание в продължение на `limit` секунди), `roc` (скорост на промяна над `limit` за секунда) |
| `limit` | number | |
| `priority` | int | От 1 (критична) до 4 (ниска) |
| `enabled` | bool | Пропуснато е `false` |
| `deadband` | number | Докъде трябва да се върне стойността, преди алармата да се възстанови. Без мъртва зона стойност, застанала върху границата, трепти |
| `onDelaySec`, `offDelaySec` | int | Колко дълго трябва да се държи условието, преди да се задейства, или да отсъства, преди да се върне към нормално |
| `message`, `description` | string | `message` приема `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` и `{reason}` (защо показанието е лошо, празно, когато е добро) |

`{value}` се записва така, както го записва картата със стойност, заедно с единицата: целите числа както са, два знака след десетичната запетая от 1 нагоре, един от 100 нагоре, четири под 1 и научен запис над десет милиона или под 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Направихме го така, защото таг с мащаб 0.1 и сурова стойност 82 е 8.200000000000001 като float, а банерът го показваше точно така. Текстово показание се казва, както е. Тагът, записите и автоматизациите продължават да виждат точното число; само изречението е закръглено. `{limit}` е границата така, както сте я въвели.

Връща дефиницията; машината се презарежда и същността на алармата се създава преди отговора. `400` при неуспешна проверка (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Чете от тялото на заявката файла, който Export Alarms на CODESYS IDE записва (експорт на група аларми, `.csv`), така както го е записала IDE (UTF-16 с маркер за последователност на байтовете) или като UTF-8. `?deviceId=` е устройството на PLC и е задължително. `?application=` е името на приложението, под което стоят неговите тагове, `Application`, ако е пропуснато: експортът назовава променлива по нейния GVL (`GVL_Alarm.bPumpFault`), а тагът е `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (от 1 до 4) е приоритетът на аларма, чийто клас не е Error, Warning или Info. Без `?apply=true` нищо не се записва: отговорът казва какво би се пренесло.

Екранът Аларми го предлага като Импорт от CODESYS (само за администратори): изберете устройството, посочете приложението, изберете файла, прегледайте визуализацията и тогава импортирайте.

Цифровите аларми, сравнявани с `= TRUE` или `= FALSE`, стават `true` и `false`, UpperLimit с `>` става `hi`, LowerLimit с `<` става `lo`, аларма Outside range (`OutOfArea`, с двата оператора `<`) става две аларми, `lo` при долната граница и `hi` при горната, съобщението и закъсненията при включване и изключване (IEC време като `T#5s`) се пренасят, а Error е приоритет 2, Warning 3, Info 4. Всичко друго, което IDE може да запише, не се чете и се връща в `skipped` с реда си и причината, защото форматът не е документиран от CODESYS и се чете само онова, което реален експорт е показал. Това включва и останалото, което предлага IDE: Inside the range (`ForbiddenArea`) е вярно само между две граници, а тук аларма има една, Change няма документирана продължителност, а Event и Alarm (API) се задействат от програмата на PLC и нямат променлива, която да се следи. `warnings` изброява онова, което се е пренесло само отчасти (непознат клас, заключване, аларма с по-висок приоритет).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` за непознато устройство, `400` за файл, който не е експорт на група аларми.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}` или `404`.

### `POST /api/alarms/{id}/ack`

Незадължително тяло `{"note": "checking the heater bands"}`. Връща алармата във вида, в който е сега, с `ackedBy` и `ackNote`. `404` за непозната аларма.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, задължително и положително: безсрочното заглушаване е потискане, което е друго нещо и не е работа на оператора. Връща алармата, `state` `shelved`, със `shelvedUntil` и `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Без тяло. Връща алармата обратно в състоянието, което ѝ определя нейното условие. `409`, ако не е била отложена.

### `GET /api/alarms/events`

Одитният журнал на алармите, първо най-новите. `?alarm=` една дефиниция, `?limit=` (по подразбиране 200, най-много 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` е `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` или `escalation-ended`. Последните два се записват от ескалацията на алармите (`actor` е `escalation`), а `note` им казва кого са уведомили и защо веригата е спряла. Вижте [Известия за аларми](/bg/iot/notifications/#escalation).

## Автоматизации

Тригери, условие, действия. Езикът на правилата е описан в [Автоматизации](/bg/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` показва кои правила наистина работят, а това не е същото като `enabled`: разрешено правило, което е спряло да се компилира, не е въоръжено, и тук научавате за това.

### `POST /api/automations`

Създава или замества правило: `id`, `name`, `description`, `enabled`, `triggers` (поне един), `condition`, `actions` (поне едно), `mode` (`skip`, по подразбиране, `queue`, `restart` или `parallel`), `minIntervalSec`, `maxRuntimeSec`. Правилото се компилира, преди да се запази, а такова, което не се компилира, връща 400 и никога не стига до базата данни: запазено правило, което не може да се въоръжи, е правило, за което авторът му мисли, че работи.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Компилира правило, без да го запазва, за проверката на живо в редактора. Винаги `200`; отговорът казва дали се е компилирало:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Изисква `automations.write`, защото съществува, за да помага на някого да напише такова.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}` или `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` го обезоръжава, без да го изтрива. Връща `{"enabled":false,"id":"fill-tank"}` или `404`.

### `POST /api/automations/{id}/trigger`

Изпълнява го сега, сякаш е сработил тригер. Условието все още важи (невярно записва изпълнение `skipped`), както и режимът на изпълнение; `minIntervalSec` не важи, защото човек, който иска изпълнение, не е таг, който трепти. Без тяло. `202` `{"triggered":"fill-tank"}`: изпълнението става във фонов режим, а резултатът е в `GET /api/runs`. `400`, ако правилото не е въоръжено. Операторите имат `automations.trigger`; да изпълниш правило, написано от друг, е работа на оператора, да го напишеш не е.

### `GET /api/runs`

История на изпълненията, първо най-новите. `?automation=` едно правило, `?limit=` (по подразбиране 100, най-много 1000). `[]`, когато няма такива.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` е `running`, `succeeded`, `failed`, `skipped`, `timed_out` или `cancelled`. Стъпките пазят разрешените входове, а не шаблоните, защото точно това трябва да прочетете в 3 през нощта.

Правило, създадено от blueprint, носи още три полета в `GET /api/automations`: `blueprintId`, `blueprintVersion` (версията, от която е създадено и на която си остава) и `blueprintInputs`. Правило, написано на ръка, няма нито едно от тях. Те са на сървъра: `POST /api/automations` ги приема и ги игнорира, а редакция на ръка запазва каквото правилото е имало.

### `POST /api/automations/{id}/blueprint-upgrade`

Премества правило, създадено от blueprint, към най-новата версия на blueprint-а, като запазва неговия id, името му и дали е въоръжено. Никога не става от само себе си. Операторите имат `blueprints.apply`, също както при създаването на такова. Първо погледнете: **`?dry_run=true`** не променя нищо и отговаря какво би се променило, част по част, и какво би направило правилото, ако сработи сега, като всеки запис минава през проверките на вратата за запис:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Редакция на ръка, направена, откакто е създадено правилото, се показва в `changes` като заменена. Когато новата версия изисква вход, за който правилото няма стойност, или отхвърля стойност, с която е създадено, пробното изпълнение го казва в `error` и нищо повече.

Истинското приема `{"version": 2}`, версията, която показа пробното, и `inputs` за всичко, което новата версия изисква. Blueprint, който междувременно е тръгнал напред, или правило, надградено от някой друг в този интервал, дава `409`: влиза това, което е прегледано, или не влиза нищо. Липсващ вход дава `400`. `200` със същата форма, като `automation` е правилото, както е запазено. Записва се като `automation upgraded from blueprint pump_watch version 1 to 2`. С една и съща версия и нови `inputs` така се променят входовете на правило. `400` за правило, написано на ръка; `404`, ако blueprint-ът, от който е дошло, вече го няма.

## Скриптове

Именувани поредици от действия, които се изпълняват при поискване: оттук, от стъпка `call_script` на правило, от `run_script` на MCP или през обекта на скрипта (`script.turn_on`). Поредицата е езикът на автоматизациите. Всеки запис, който стъпка прави, минава през вратата за запис като `script:<id>`, с източника на този, който я е стартирал. Всичко е в [Скриптове](/bg/iot/scripts/).

### `GET /api/scripts`

Всеки скрипт, с броячите на изпълненията му и колко негови изпълнения текат в момента, във всеки процес:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Създава един. Само за администратори. `id` (малки букви, цифри и долни черти, започващо с буква: това е идентификаторът на обекта, `script.<id>`), `name`, `description`, `icon`, `fields` (въвеждания с тип), `sequence` (поне едно действие), `mode` (`skip`, по подразбиране, `queue`, `restart` или `parallel`) и `maxRuntimeSec`. Компилира се, преди да се запази, като правило, а скрипт, който би извикал сам себе си, директно или през други скриптове, се отказва. Връща `201` със скрипта. `400` за всичко, което не се компилира; `409` за зает id.

### `POST /api/scripts/validate`

Проверява скрипт, без да го запазва, за проверката на живо в редактора. `200` `{"valid":true}` или `{"valid":false,"error":"..."}`, със същите думи, с които запазването би било отказано.

### `GET /api/scripts/{id}`

Един скрипт, както в списъка. `404`, ако няма такъв.

### `PUT /api/scripts/{id}`

Заменя дефиницията му; тялото е същото като при създаване, а `id` може да се пропусне. Само за администратори. Текущите му изпълнения се прекратяват, когато стъпките, полетата или режимът му се променят: те са стартирани от старата дефиниция.

### `DELETE /api/scripts/{id}`

Изтрива го заедно с историята на изпълненията му и прекратява текущите му изпълнения. Само за администратори. `{"deleted":"cip_cycle"}`. Обектът му остава осиротял, не се изтрива.

### `POST /api/scripts/{id}/run`

Изпълнява го. Операторите имат `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Всяко поле в тялото е незадължително, както и самото тяло. Полетата се проверяват спрямо тези на скрипта, преди да тръгне каквото и да е: стойност извън обхвата, извън стъпката си, която не е една от опциите или е от грешен тип, дава `400` и никога не се коригира, за да пасне. `202` с изпълнението веднага щом е започнало; с `"wait":true` `200` с изпълнението, след като е приключило, заедно с неговата следа.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409`, когато е заето: вече се изпълнява и режимът му е `skip`, или се изпълнява с едно на опашка и режимът му е `queue`. Нищо не е изпълнено, а в историята има изпълнение `skipped`, което казва защо:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** пита какво би направило едно изпълнение сега и не прави нищо от това. Полетата се проверяват по същия начин; после всяка стъпка се преминава спрямо завода такъв, какъвто е: всеки запис и всяко извикване на услуга се подлага на собствените проверки на вратата, условие се оценява, променлива се свързва. Изчакването, закъснението и всичко, което не пише в никакво оборудване, са `not_checked`. Първият запис, който би бил отказан, го прекратява, както би прекратил изпълнението, и `error` го казва с думите на вратата. `200` с присъдата, отказана или не:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

`verdict` на всяка стъпка е `would_write`, `refused`, `ends_here` (условие, невярно сега, или спиране), `not_checked` или `ok`. Стъпка от скрипт, който извиква, се номерира под извикването: `3.1`.

### `POST /api/scripts/{id}/stop`

Прекратява всички негови текущи изпълнения, във всеки процес, където и да са. `{"cancelled":1,"stopped":"cip_cycle"}`, като `cancelled` са изпълненията, които този процес е имал. Операторите имат `scripts.run`: да спреш това, което можеш да стартираш, е част от стартирането.

### `GET /api/scripts/{id}/runs`

Неговите изпълнения, първо най-новите, с техните следи. `?limit=` (по подразбиране 50, най-много 1000). `parent` е това, което е извикало изпълнение, когато нещо го е направило: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Рецепти

Набори от стойности, които се прилагат заедно: зададените стойности на един продуктов клас, смяна на продукта. Всеки е и обект, `scene.<id>`. Рецептата се проверява цялата, преди да излезе нещо, и се отхвърля цялата по каквато и да е причина; целите ѝ излизат после по ред под един и същ id на извикване, първата, която се провали, спира останалите и нищо не се връща назад; всяка записана стойност се чете обратно от устройството. Всичко е в [Рецепти](/bg/iot/recipes/).

Името, описанието, възелът на оборудването и разрешението на една рецепта се променят на място. Това, което пише (`targets`, `params`, `precondition`, `verify_sec`), е версия, а версиите никога не се променят: запазването на ново съдържание записва следващата.

### `GET /api/recipes`

Всички рецепти, със съдържанието на текущата им версия и най-новото им прилагане:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` е `null` за рецепта на целия завод.

### `POST /api/recipes`

Създава една, като версия 1. Само за администратори. `id` (малки букви, цифри и долни черти, започващо с буква: това е идентификаторът на обекта, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, по подразбиране, или `recipes.apply.<name>`), `params` (въвеждания с тип), `precondition` (израз, който трябва да е истина, за да започне), `targets` (поне една, най-много 200, всяка с `entity_id`, `service` и `data` или `data_expressions`), `verify_sec` (от 1 до 600, по подразбиране 10) и `note`. Една цел задава стойност: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, в домейните, които ги приемат. Импулс или пускане се отхвърля: мястото му е в скрипт. Обектът на всяка цел трябва да съществува, а всеки израз трябва да се компилира. `201` с рецептата; `400` за всичко грешно, `409` за зает id.

### `POST /api/recipes/capture`

Съставя чернова на рецепта от това, което обектите държат сега, само за администратори, и не записва нищо:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Всеки става цел, която го връща към текущата му стойност, в зададения ред; един контур става своя режим и после своята зададена стойност. Отговорът е рецепта без id и без име, за редактора. Обект, който не съществува, е забранен, чете се с качество, различно от добро, е `unknown` или `unavailable`, или не е нещо, което рецепта задава, дава `400`, който назовава всеки един: рецепта, построена от лошо отчитане, записва лошото отчитане обратно.

### `GET /api/recipes/{id}`

Една рецепта, както в списъка. `404`, ако няма такава.

### `PUT /api/recipes/{id}`

Запазва я. Само за администратори. Тялото е рецептата, както я върна `GET`, редактирана; `id` може да се пропусне. `current_version` е версията, върху която е направена редакцията: ако междувременно някой е запазил друга, запазването дава `409`, вместо тихо да презапише неговата (`0` прескача проверката). Новото съдържание става следващата версия, а `note` казва защо; промяна само на името, описанието, оборудването или разрешението не създава такава.

### `DELETE /api/recipes/{id}`

Изтрива я заедно с версиите ѝ. Само за администратори. `{"deleted":"grade_a"}`. Прилаганията ѝ се запазват, защото са това, което е било изпратено към завода, а обектът ѝ остава осиротял.

### `GET /api/recipes/{id}/versions`

Всички версии, първо най-новите, всяка точно както е запазена, с този, който я е запазил, и бележката:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Една версия. `404`, ако рецептата няма такава версия, `400`, ако `{version}` не е число.

### `POST /api/recipes/{id}/validate`

Би ли се приложила в момента? Операторите имат `recipes.apply`. Тялото е на едно прилагане, а нищо не се записва, отчита или вписва в журнала. Прави се всяка проверка, която прилагането прави преди да запише: параметрите, собственото разрешение на рецептата, предусловието, изразите за данни, дали друго прилагане пише в някой от обектите ѝ, и всяка цел, подложена на проверките на вратата за запис. `200` с присъдата, `would_apply` или `refused`, и тази на всяка цел: `would_write`, `refused` с причината, или `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Параметри, които не приема, дават `400`, както биха дали при истинското прилагане.

### `POST /api/recipes/{id}/apply`

Прилага я. Операторите имат `recipes.apply`. Рецепта, която назовава собствено разрешение, `recipes.apply.<name>`, изисква и него, проверено тук спрямо рецептата; потребител без него получава `403` и отхвърлено прилагане в историята с името му върху него.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Всичко е незадължително, както и тялото. `version` прилага по-стара версия нарочно; пропуснато, текущата. `resume` е id на по-ранно прилагане на тази рецепта, което е спряло по средата: целите ѝ, които не са били записани, излизат като ново прилагане, с нейната версия и параметри, а `parent` казва кое довършва.

Отговаря, след като всяка стойност е записана и прочетена обратно, което отнема най-много `verify_sec` на рецептата:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Една цел е `written`, `failed` (излязла е и устройството е казало не или не е казало нищо), `not_sent`, `skipped` (предишна не е минала) или `refused` (предварителна проверка). Записаната е `verified`, когато устройството е прочело обратно след изпращането стойността, която му е била изпратена, и `unconfirmed`, когато не го е направило в рамките на `verify_sec`: излязла е и може да не е била приета. Всеки запис носи `call_id` на прилагането, така че `GET /api/writes?call=<call_id>` са всички.

| Статус | Кога |
|---|---|
| 200 | `applied`: всяка цел записана. Проверете `verification` на всяка |
| 400 | Параметър, който рецептата не приема, извън обхвата или от грешен тип; `resume` без нищо останало за прилагане |
| 403 | Собственото разрешение на рецептата. Отчетено като отхвърлено прилагане |
| 404 | Няма такава рецепта или няма такава версия |
| 409 | `refused`: всяка причина да не започне, всяка в `error` и на целта си. Или друго прилагане пише в момента в някой от обектите ѝ. Нищо не е записано |
| 502 | `partial` или `failed`: започнало е и не всяка цел е излязла. `targets` казва точно кои. Нищо не се връща назад |

Всеки отговор освен `400` за неправилно тяло или `404` носи прилагането, а всяко прилагане освен пробно е в `GET /api/recipes/{id}/applications`, включително отказите.

### `GET /api/recipes/{id}/applications`

Прилаганията ѝ, първо най-новите, включително отхвърлените. `?limit=` (по подразбиране 50, най-много 1000). `parent` е това, което я е приложило, когато нещо го е направило: `automation_run:812`, `script_run:77`, `application:41`. Прилаганията на изтрита рецепта все още се връщат.

## Blueprints

Автоматизация, написана веднъж с типизирани празни места в нея, попълнени, за да се получи обикновено правило. Правилото запазва версията, от която е създадено; редактирането на blueprint-а не променя нито едно правило, а преместването на едно към по-нова версия е [надграждане](#post-apiautomationsidblueprint-upgrade), което някой поиска. Всеки запис, който правилото прави, минава през вратата за запис като `automation:<id>`. Всичко е в [Blueprints](/bg/iot/blueprints/).

### `GET /api/blueprints`

Всички blueprint-и, първо вградените, всеки с броя правила, създадени от него:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` е `builtin` (идва в двоичния файл, само за четене) или `user`.

### `POST /api/blueprints`

Пише един. Само за администратори. `id` (малки букви, цифри и долни черти, започващо с буква), `name`, `description`, `inputs` (с тип, същите като полетата на скрипт) и `template`: правилото, със своите `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` и `maxRuntimeSec`, и празните места в него. `{"!input": "motor"}` като стойност се заменя с входа; `${motor}` в низ също, като буквален текст, където низът е израз. Проверява се преди да се запази: всяко празно място назовава вход, всеки вход се използва, и попълнен с примерни стойности, дава правило, което се компилира. `201` на `version` 1. `400` за всичко грешно в него, `409` за зает id, включително на вграден.

### `GET /api/blueprints/{id}`

Един, както в списъка. `404`, ако няма такъв.

### `PUT /api/blueprints/{id}`

Заменя дефиницията му; тялото е същото като при писане на такъв, а `id` може да се пропусне. Само за администратори. `version` се увеличава с едно, когато `inputs` или `template` са се променили, но не при ново име или ново описание. **Никое правило, създадено от него, не се променя.** Всяко запазва версията, от която е създадено, а `GET /api/automations` показва коя. Вграденият дава `400`: копирайте го под собствен id.

### `DELETE /api/blueprints/{id}`

Само за администратори. `{"deleted":"pump_watch"}`. `409`, докато съществува някое правило, създадено от него, като ги назовава: първо изтрийте тях. Вграденият дава `400`.

### `POST /api/blueprints/{id}/instantiate`

Създава правило от него и го въоръжава. Операторите имат `blueprints.apply`: коя помпа и колко дълго е техен избор, а това, което правилото прави, е решено, когато blueprint-ът е бил написан.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` по подразбиране е името на blueprint-а, а `enabled` е `true`. Всеки вход се проверява, преди да се създаде каквото и да е: стойност извън обхвата, извън стъпката си, която не е една от опциите, обект от друг домейн или от грешен тип дава `400`, който назовава всеки грешен, и никога не се премества, за да пасне. Зает `automationId` дава `409`: създаването на правило никога не заменя друго. `201` с правилото, с зададени `blueprintId`, `blueprintVersion` и `blueprintInputs`. Записва се като `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** не създава нищо. Връща правилото, което би създал, и какво би направило то, ако сработи сега: условието оценено, всеки запис и извикване на услуга подложени на проверките на вратата като `automation:<id>`, първият отказ в `check.error` с думите на вратата. Нищо не се съхранява, записва или одитира.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Табла

Страници с карти, за ролите и екраните, които имат нужда от тях. Едно табло не командва нищо: картата назовава таг, обект, скрипт или рецепта, а бутонът ѝ пише чрез [`POST /api/write`](#post-apiwrite) като човека, който го е натиснал. Стенното табло е едно от тях. Всичко е в [Табла](/bg/iot/dashboards/).

### `GET /api/dashboards`

Таблата, които се предлагат на викащия, в реда, в който ги показва превключвателят, включително стенното табло. Който има `dashboards.write`, му се предлагат всички.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Изгражда едно. Само за администратори. `id` (малки букви, цифри, тирета и долни черти, започващо с буква), `name`, и по желание `description`, `roles`, `homeFor`, `screens`, `position` и `cards`. `201` на `version` 1, с размера и конфигурацията на всяка карта във вида, в който са съхранени.

Картата е `id`, `type`, `title`, `w` (от 1 до 12 колони), `h` (от 1 до 8 реда) и `config`. Типовете и конфигурациите им са в [Табла](/bg/iot/dashboards/#картите). Проверява се преди да се запази:

- конфигурационен ключ, който типът няма, число извън обхвата, адрес на камера или план на етаж с вход или токен в него, или повече от 60 карти дава `400`;
- карта, която назовава таг, обект, скрипт или рецепта, които не съществуват, дава `400`, който го назовава;
- `button` върху таг, който не може да се записва, или с число извън обхвата на тага, дава `400`: вратата би отказала всяко натискане;
- роля, която не съществува, дава `400`;
- зает `id`, екран, който друго табло вече има, или начална страница на роля, която друго табло вече е, дава `409`.

### `GET /api/dashboards/{id}`

Едно, както в списъка. `404`, ако няма такова, и също така ако на викащия не се предлага.

### `PUT /api/dashboards/{id}`

Замества го. Само за администратори. Тялото е таблото, както го върна `GET`, с `version`, зададена на версията, при която е прочетено: **задължителна е**, а запазване, което назовава версия, която вече не е текущата, дава `409`, който казва коя е текущата, защото алтернативата е тихо да се изтрие това, което последният запазил току-що е построил. `id` може да се пропусне от тялото, `kind` не може да се променя, а `createdAt`, `updatedAt` и `updatedBy` са на сървъра и се игнорират. `200` с таблото на следващата версия.

Стенното табло приема `PUT` само за назначенията си (`roles`, `homeFor`, `screens`, `position`) и нищо друго: то няма карти, така че такова с карти дава `400`. Показанията му са таговете на таблото, `GET` и `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Само за администратори. `{"deleted":"line-2"}`. Картите сочат към неща и не притежават нищо, така че нищо друго не се пипа. Стенното табло дава `400`: то винаги е там.

Създаването, запазването и изтриването се записват като `config` събития върху субекта `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

Таблото като екранен файл: версиониран JSON документ, който [`POST /api/dashboards/import`](#post-apidashboardsimport) зарежда в друга инсталация. Отговаря като прикачен файл с име `<id>.hotloop-screen.json`. Викащият има нужда от `dashboards.read` и таблото трябва да му се предлага, както при `GET` на едно. Стенното табло дава `400`: това са закачените показания на една инсталация, не подредба. Форматът е в [Екранни файлове](/bg/iot/screen-file/).

### `POST /api/dashboards/import`

Чете екранен файл, проверява го спрямо тази инсталация и го запазва като ново табло. Само за администратори и не може да запази това, което `POST /api/dashboards` би отказал. Тялото е самият файл или `{"file": {...}}` с опции до него:

| Опция | <span class="sr-only">Подробности</span> |
|---|---|
| `id`, `name` | Запазване под друг id или име. |
| `replace` | Ако id е зает, запазване върху това табло при текущата му версия. Без нея зает id дава `409`. |
| `skipAssignments` | Пропускане на `screens` и `homeFor` на файла, които принадлежат на инсталацията, която го е създала. `roles` остават. |
| `remap` | Как да се наричат нещата тук: `tags` (пълен ключ към пълен ключ, както файлът назовава тага или както се чете, след като `devices` го е преместил), `devices` (id към id, което премества и частта за устройство на всеки таг, неназован в `tags`), `entities`, `scripts`, `recipes` и `equipment` (id към id). Запис, който нищо на екрана не е ползвало, е предупреждение. |
| `dryRun` | Връща отчета и не запазва нищо. Винаги `200`. |
| `codesys`, `visualization` | Вместо `file`: текстът на роден CODESYS експорт и визуализацията, която да се вземе, когато съдържа няколко. Тогава отчетът има `conversion` с това, в какво се е превърнал всеки елемент и какво е пропуснато. Вижте [Импорт на CODESYS екран](/bg/iot/codesys-screen-import/). |

Отговорът е отчет, независимо дали нещо е запазено:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Всяка липсваща препратка е изброена, не само първата. `kind` е `file` (не е екранен файл, грешен формат, по-нова версия на формата от тази, която чете тази компилация, или непознато поле), `screen` (собствените правила на таблото: лоша карта, роля, която не съществува, твърде голямо), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (бутон или зададена стойност върху таг, който не може да се записва), `assignment` (име на екран или начална страница на роля, които друго табло държи) или `exists` (id е зает). Импорт с какъвто и да е проблем не запазва нищо: `400`, или `409`, когато единственият проблем е `exists` или `assignment`, със същия отчет. Успехът е `201`, или `200`, когато е заместил едно, с отчета и запазеното `dashboard`. Записва се като `config` събитие върху субекта `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

Задейства всяка автоматизация с `webhook` тригер на този път. **Без сесия и без разрешение**: пътят е тайната, която се дава на трета страна, същият модел на доверие, който този endpoint винаги е имал, а SCADA система или SaaS callback няма акаунт, с който да влезе. Изберете път, който никой не би могъл да отгатне.

Тялото, до 1 MiB, се предава на правилото. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"`, когато никоя не слуша: webhook, който пише в нищото, изглежда същото като работещ, затова го казва.

## Парк

Регистрирани гранични релета, тяхното присъствие на живо през Sparkplug и команди към тях. Изисква `HOTLOOP_FLEET_ENABLED`. Вижте [Управление на парка](/bg/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` идва от NBIRTH и NDEATH. `release` е компилацията, която релето е казало, че изпълнява, в последния си birth: `version`, `imageDigest` (когато супервайзорът му го казва; Helm чартът не го прави) и `since`, когато Gateway за първи път е чул тази компилация. Реле, твърде старо, за да докладва такава, няма такава. За член със `statusUrl` `polled` е истина, а `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` и `updateMode` (`auto` или `approve`) идват от неговия `/status`; те не означават нищо, когато не е бил достъпен. При изключена функция: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Създава или замества член: `id`, `name`, `group` и `nodeId` (неговата Sparkplug идентичност) задължителни; `description`, `statusUrl` (`http://` или `https://`) и `enabled` незадължителни. Връща члена. Този работи при изключена функция, така че паркът може да бъде деклариран, преди да бъде включен.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}` или `404`.

### `POST /api/fleet/{id}/rebirth`

Публикува `Node Control/Rebirth` към релето. Без тяло. `{"status":"rebirth requested"}`. `404` за непознат член.

### `POST /api/fleet/{id}/restart`

Публикува `Node Control/Reboot`. `{"status":"restart requested"}`. Само за администратори: рестартирането на реле губи данните му, докато не се върне.

### `POST /api/fleet/{id}/update`

Одобрява актуализацията на образа, която релето задържа. Публикува `Node Control/Update`. `{"status":"update approved"}`. Само за администратори: релето излиза и супервайзорът му стартира образа, който следва, така че губи данните си за времето, което това отнема. Прави нещо само на реле, зададено на `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`; всяко друго реле записва, че го е игнорирало. Заявката не назовава образ: няма къде да се постави такъв, и това е целта. Вижте [справочника на Edge Relay](/bg/edge-relay/reference/#обновяване-на-реле).

### `POST /api/fleet/{id}/config`

Изпраща нов файл с устройства към релето, което го прилага на живо: без рестарт, със запазена сесия към брокера и опашка за препращане, и с останало свързано всяко устройство, което файлът не е променил. Тялото е **самият файл с устройства**, суров JSON, не опакован в нищо. Валидира се, преди да се публикува каквото и да е (`400` `"invalid device file: ..."`, ако не е валиден). `{"status":"config pushed"}` означава, че брокерът го е взел; дали релето го изпълнява, казва `config.digest` на този член в `GET /api/fleet`, а файл, който релето е отхвърлило, се показва там като `config.rejected`. Само за администратори: променя какво релето опитва да чете. Вижте [Управление на парка](/bg/gateway/fleet/#изпращане-на-конфигурация).

### `DELETE /api/fleet/{id}/config`

Взема изпращането обратно. Изчиства запазената конфигурация на брокера, за да не я приложи никое по-късно стартиране, а релето, свързано точно сега, изоставя изпратения файл и се връща на живо към локалния си файл с устройства. Без тяло. `{"status":"config push cleared"}`, `404` за непознат член, `503`, когато Gateway не е свързан с брокера. Само за администратори, като изпращането. Не рестартира нищо. Изпратете го, докато релето е на линия: офлайн реле никога не го чува. Вижте [справочника на Edge Relay](/bg/edge-relay/reference/#къде-стои-изпратеният-файл-и-кой-файл-печели).

## Известия

Известяване на телефон, когато се задейства аларма, през webhook, SMTP, ntfy или Gotify, и уведомяване на следващия човек, когато никой не я потвърди. Изисква `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Изпраща сега синтетично известие за аларма през всеки конфигуриран канал, за да научите, че SMTP релето ви отхвърля, преди това да го направи истинска аларма. Без тяло. Изисква `HOTLOOP_NOTIFY_ENABLED`. Само за администратори: изпраща истинско съобщение и харчи каквато квота позволява доставчикът.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200`, независимо дали всеки канал е сработил; всеки резултат го казва. Неуспелият носи `error`. Неуспелият webhook назовава своята схема и хост и нищо друго, защото при повечето услуги за известяване URL адресът е удостоверението. Вижте [Известия за аларми](/bg/iot/notifications/).

### `GET /api/notify/escalation`

Политиката за ескалация на алармите, каналите, които една стъпка може да назове, и веригите, отворени в момента. `available` е `false`, с изключена политика и без канали, когато `HOTLOOP_NOTIFY_ENABLED` не е зададено; отговорът пак е `200`. Само за администратори и за четене, и за запис: политиката съдържа ntfy темите на хората, които на сървър, до който всеки може да стигне, са пароли.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` са тези, които този HotLoop е конфигурирал, което е всичко, което една стъпка може да назове. `active` е всяка аларма, която се обхожда по веригата: колко изпращания са излезли от колко има политиката (стъпки, после повторения) и кога е следващото. Нищо още запазено е `{"policy":{"enabled":false},...}`: изключена, без нищо в нея.

### `PUT /api/notify/escalation`

Заменя цялата политика, не е кръпка, и връща това, което би върнал `GET`. Прилага се за аларми, задействани от този момент нататък. `400`, когато известията не са разрешени.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` е `critical`, `high` (по подразбиране), `medium` или `low`. Една стъпка е дължима `afterMinutes` (от 1 до 1440) след предишната, първата след задействането, и назовава `contacts` от списъка, `channels`, които внедряването има, или и двете. Най-много 10 стъпки, 50 контакта и 20 повторения. Непознатите полета се отхвърлят.

`400` с причината, когато политиката не може да работи, с думи, по които може да се действа: стъпка, която не назовава никого, контакт, който не е в списъка, канал, който този HotLoop не е конфигурирал (отговорът изброява тези, които има), ntfy тема без конфигуриран ntfy или адрес без конфигурирана електронна поща, адрес, който не е обикновен, повторение без интервал. Нищо не се съхранява, когато бъде отхвърлена. Запазването ѝ е в системния журнал, без темите. Вижте [Известия за аларми](/bg/iot/notifications/#escalation).

### `POST /api/notify/ack/{token}`

Бутонът **Потвърди** на ntfy известие. Телефонът, който го натиска, няма сесия за изпращане, затова **няма сесия и няма разрешение**: подписаният токен в пътя е упълномощаването, и всичко, което упълномощава, е потвърждаването на едно възникване на една аларма, веднъж, преди да изтече (`HOTLOOP_NOTIFY_ACK_TTL`, по подразбиране 12 часа). Бутон от вчерашния случай не може да потвърди днешния. Нарочно е `POST`: прегледите на връзки и скенерите за сигурност отварят връзки сами и аларма никога не бива да бъде потвърдена от робот. Без тяло. Отговаря с алармата като потвърдена (формата, от обработчика; другите примери в този документ са снети от работещ Gateway, този не е, защото онзи Gateway нямаше ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

С изключени връзки за потвърждение:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Това е обикновено потвърждение през двигателя на алармите, одитирано под `notify:<channel>`. Всеки отказ се отговаря и записва, защото бутон, който тихо не прави нищо, изглежда точно като такъв, който никой не е натискал:

| Статус | Кога |
|---|---|
| 403 | Подправен, променен или подписан с друга тайна |
| 404 | Алармата вече не съществува или връзките за потвърждение са изключени (те изискват `HOTLOOP_PUBLIC_URL` и канал с бутон) |
| 409 | Вече използван, алармата е била задействана отново оттогава или няма какво да се потвърждава |
| 410 | Истински, но изтекъл |
| 503 | Потвърждението не можа да бъде запазено; връзката се връща, за да може второ натискане още да работи |

Отговорът носи `Access-Control-Allow-Origin: *`, за да може уеб приложението на ntfy да го натисне от собствения си origin; нищо на този маршрут не чете бисквитка. Токенът никога не се записва в журнала и не се връща никъде. Вижте [Известия за аларми](/bg/iot/notifications/#acknowledge-links).

## Резервни копия

Логически снимки на базата данни, само с данните на таблиците. Изисква `HOTLOOP_BACKUP_ENABLED`. И двете само за администратори: списъкът показва броя редове на всяка таблица, включително потребители и сесии. **Няма endpoint за възстановяване**, нарочно: възстановяването е флаг на двоичния файл, изпълнен веднъж от някой, който знае, че базата данни е предназначена да го получи, никога мрежово извикване срещу работеща. Вижте [Резервни копия и възстановяване](/bg/iot/backup/#възстановяване-на-копие).

### `GET /api/backup`

Резервните копия на тома, всяко с неговия манифест.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Прави едно сега и го изчаква (до 30 минути: голяма `tag_history` отнема време). Без тяло. Връща манифеста: версия, миграции, и редовете и колоните на всяка таблица.

## Планирани отчети

Обобщения от историка като CSV и HTML, по график, по електронна поща или за изтегляне. Изисква `HOTLOOP_REPORTS_ENABLED`. Наблюдателите четат, операторите изпълняват, администраторите дефинират: дефиницията назовава къде се изпращат по пощата данните на завода. Вижте [Планирани отчети](/bg/gateway/reports/) за полетата на дефиницията.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Всяка дефиниция носи `nextRunAt` и най-скорошното си изпълнение като `lastRun`.

### `POST /api/reports`

Създава дефиниция; тялото е дефиницията, както по-горе. `201`. `400` при неуспешна валидация (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409`, ако id съществува.

### `GET /api/reports/{id}`

Една дефиниция, както в списъка. `404` за непозната.

### `PUT /api/reports/{id}`

Заменя цялата дефиниция. Id не може да се променя (`400`, ако този в тялото се различава). `nextRunAt` и `lastRun` се приемат и игнорират, така че можете да върнете това, което сте прочели.

### `DELETE /api/reports/{id}`

Изтрива я заедно с изпълненията и файловете ѝ, като отменя изпълнение в ход. `{"deleted":"line1-hourly"}` или `404`.

### `POST /api/reports/{id}/run`

Изпълнява я сега и изчаква. `?deliver=false` я генерира и съхранява, без да изпраща поща на никого, за изпробване на дефиниция. `200` означава, че изпълнението е станало; собственият му `status` казва дали отчетът е сработил. Изпълнение, което се проваля, е резултат, а не лоша заявка, и се записва и в двата случая.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` за `deliver`, което не е true или false, `404` за непознат отчет.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, първо най-новите, `?limit=` по подразбиране 50, най-много 500. `404` за непознат отчет, не празен списък.

### `GET /api/reports/{id}/runs/{run}/download`

Подава един съхранен файл като прикачен. `?format=csv` или `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML се сервира със `sandbox` Content-Security-Policy: отчетът е документ за четене, не страница, на която е позволено да изпълнява каквото и да е. Отвореният файл е този, който записът на изпълнението назовава; нищо в URL адреса не става част от път. `400` за номер на изпълнение, който не е такъв, или формат, който не е нито един от двата, `404` за изпълнение или файл, който не съществува.

## Обекти

### `GET /api/sites`

Всеки обект, който Gateway федерира, попитан за състоянието на завода си през MCP паралелно, по 6 секунди, така че един мъртъв обект да не задържа останалите. Обектите са изходящите MCP сървъри в конфигурацията. Вижте [MCP](/bg/iot/mcp/#federating-sites).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Броячите на недостъпен обект не означават нищо и се оставят извън сбора: да броиш обект, до който не можеш да стигнеш, за нула аларми би било най-опасното, което този екран може да направи. Без конфигурирани обекти: `{"configured":false,"sites":[]}`.

## Настройки

### `GET /api/settings`

Всяка настройка, ефективната ѝ стойност, откъде е дошла стойността и променливата, която я задава:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` е `stored`, `environment` или `default`. `secret` е само `set` или `not set`. `envVar` е променливата, от която е дошла стойността. Няколко настройки се връщат към втора променлива, когато тази с `HOTLOOP_` е празна (`TZ` за часовата зона, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` и `POSTGRES_PASSWORD` за базата данни), а когато в сила е резервната, `envVar` я назовава. Променлива, зададена на празен низ, се брои за незададена, както конфигурацията я третира. Настройките за анкетиране се показват в милисекунди, но променливите им приемат продължителност (`5s`, `500ms`) или просто число секунди.

`product` в групата `Server` казва кой HotLoop е това. Функция, която този продукт няма и която внедряването е включило въпреки това (да речем `HOTLOOP_REPORTS_ENABLED=true` на IoT), не пречи на стартирането му. Записва се като предупреждение при стартиране и се изброява тук в допълнителна група, `Not in this product`, с нейната променлива и ред, който казва къде живее. Настройката се оставя точно каквато е, така че същата конфигурация на продукт, който има функцията, я включва. Когато няма нищо такова, групата я няма.

### `PUT /api/settings`

Променя настройките за идентичността на завода, и само тях:

| Ключ | Тип |
|---|---|
| `ui.plantName` | string, най-много 200 знака |
| `ui.siteId` | string, най-много 200 знака |
| `ui.timezone` | име по IANA, което тази машина познава (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | цяло число секунди, от 10 до 43200: колко оцелява входът на един киоск, без никой да докосва панела. По подразбиране 900 |
| `ui.lockoutAttempts` | цяло число, от 0 до 100: грешни пароли или PIN кодове подред, които заключват един акаунт. По подразбиране 10, а 0 означава без заключване |
| `ui.panelDelaySeconds` | цяло число секунди, от 0 до 30: най-много колко чака един киоск панел, преди да провери следващия PIN, въведен без потребителско име, след грешни. По подразбиране 3, а 0 означава без чакане |
| `ui.lockoutSeconds` | цяло число секунди, от 10 до 86400: колко дълго остава заключен един заключен акаунт. По подразбиране 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Връща всички настройки, както прави `GET`. Всеки друг ключ дава 400, който го назовава:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Това е нарочно. Превключвателите за запис решават дали този процес може да движи машини, а контрол, който може да се включи от същия браузър, който издава записите, не е контрол. Промяната им е внедряване.

## Цели на историка

Собствените бази данни на завода, в които HotLoop пише историята си освен в своята. Вижте [Цели на историка](/bg/iot/historian-targets/). Всяка роля, която чете настройките, ги вижда и как върви всяка. Промяната на една е само за администратори, защото една цел е място, където отиват данни на завода. Паролите се запечатват с ключа за удостоверения на устройствата (`HOTLOOP_SECRET_KEY_FILE`) и никога не се връщат; `passwordSet` казва дали има запазена, а `passwordProblem` защо запазената не може да се отвори. Всяка промяна влиза в журнала и влиза в сила веднага.

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

`kinds` са базите данни, в които пише този HotLoop, и как всяка нарича полетата си: InfluxDB има токен там, където другите имат парола (`password` го носи), bucket там, където те имат база данни (`database`), измерване там, където те имат таблица (`table`), и организация (`org`), каквато никоя от другите няма. `status.state` е `up`, `catching-up` (нагоре и още изпраща това, което му се дължи от собствената история на HotLoop), `down`, `starting` или `off` (изключена). `queued` е това, което чака в паметта, от `queueCap`. `written` брои отчитанията, изпратени на живо, а `backfilled` тези, изпратени от собствената история на HotLoop. `dropped` брои отчитанията, които опашката пусна, докато целта не смогваше: те се дължат, не са загубени. `refused` брои отчитанията, които самата база данни не пожела да приеме, с нейната причина в `lastRefusal`. `owedFrom` и `owedTo` са това, което още се дължи; `owedTo` липсва, докато краят е още отворен, а той е за толкова дълго, колкото целта е спряла.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` е от 1 до 63 малки букви, цифри и `-` и назовава целта в системния журнал. `address` е `host` или `host:port`, без вход в него; портът по подразбиране за вида допълва липсващия. `table` по подразбиране е `defaultTable` на вида и може да носи схема (`history.hotloop`). `org` е организацията на InfluxDB 2. `enabled` по подразбиране е true. Паролата изисква ключ: без `HOTLOOP_SECRET_KEY_FILE` е `400`, никога не се съхранява в чист вид. `201` с целта и статуса ѝ; `409` за зает id.

### `PUT /api/historian/targets/{id}`

Което и да е от полетата по-горе освен `id`; това, което не е изпратено, остава. `"password":""` изчиства паролата. Промяна рестартира целта с новите ѝ настройки, а това, което ѝ се е дължало, все още се дължи. `200` с целта.

### `DELETE /api/historian/targets/{id}`

Спира да пише в нея и забравя това, което ѝ се е дължало. Каквото вече държи, остава в нейната база данни. Изключете я вместо това с `"enabled":false`, за да запазите настройките. `200` `{"deleted":"plant-pg"}`.

## Системен журнал

### `GET /api/events`

Всяка промяна, запис, вход и преход на връзка, първо най-новите.

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `category` | Може да се повтаря: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Може да се повтаря: `debug`, `info`, `warning`, `error` |
| `subject` | Точно: id на устройство, ключ на таг, entity_id, `equipment:4`, `label:critical` |
| `q` | Търсене без значение на главни и малки букви |
| `minutes` | Само последните N минути |
| `limit` | По подразбиране 200, най-много 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` е потребител, `system`, `automation:<id>` или `mcp:<client>`. `detail`, когато има такъв, е допълнителен JSON като низ.

## Дневник на събитията

### `GET /api/logbook`

Една времева линия на това, което се е случило, първо най-новото: промени на състоянието на обекти, записи, преходи на аларми, изпълнения на автоматизации и скриптове, и промени в конфигурацията и извиквания на услуги от системния журнал. Следите се четат там, където са, и се сливат, така че всяка запазва собственото си съхранение. Числовите отчитания не са в него: за това е `GET /api/history`. Вижте [дневника на събитията](/bg/iot/logbook/).

| Заявка | <span class="sr-only">Подробности</span> |
|---|---|
| `entity` | Само това, което е свързано с този обект: промените на състоянието му, записите в него и в таговете му, алармите му, изпълненията на автоматизации, които задейства или които са писали в него, промените в конфигурацията му |
| `equipment_id` | Само това, което се е случило при този възел на дървото на оборудването или под него, по същото правило. Не заедно с `entity` |
| `actor` | Част, без значение на главни и малки букви, от това кой го е направил: потребител, `automation:<id>`, `mcp:<client>` |
| `kinds` | Разделени със запетаи или повторени: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Времена по RFC 3339; `from` включително, `to` изключително |
| `limit` | По подразбиране 100, най-много 1000 |
| `before` | `next` на предишната страница |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` е id на реда в собствената му следа (при промяна на състоянието, неизменният id на обекта) и заедно с `at` и `kind` е това, което `next` кодира: страницата след тази е всичко строго по-старо в този ред, каквото и да е добавено междувременно. `next` се пропуска на последната страница. `suppressed` е колко промени на този обект преди тази не са били записани, защото той се е променял по-бързо от десет наведнъж и после една на всеки две секунди.

`400` за непознат вид, неправилно време, `from` не преди `to`, лимит над 1000, измислен курсор, или `entity` и `equipment_id` заедно; `404` за възел, който не съществува. `503`, когато дневникът на събитията не работи в процеса, който отговаря.

## Поток на живо

### `GET /api/stream`

Server-sent events, в една посока, докато го държите отворен. SSE вместо WebSocket, защото трафикът върви само в една посока, а потокът от събития се свързва отново сам, когато подът се рестартира под отворено табло. `EventSource` изпраща бисквитката на сесията; скриптът изпраща bearer токена.

При свързване получавате `retry: 3000` и после текущата картина, така че екранът да е попълнен, преди да се промени нещо:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

После, докато стават нещата:

| Събитие | Данни | Кога |
|---|---|---|
| `values` | Масив от отчитания, формата на `GET /api/values`, най-новото за таг, **само таговете, чието отчитане се е променило** | На всеки 250 ms, ако някое се е променило. Таг, чиято стойност, текст, единица, качество и причина са същите като при последното изпратено, се пропуска и се изпраща отново, след като е минал 30 секунди неизпратен, така че `timestamp` на една стабилна стойност никога не е по-стар от това. Драйверът чете всеки таг при всяко анкетиране; 4.19.5 изпращаше всички всеки път (около 150 KB четири пъти в секунда за 2232-те тага на един тестер) и страница на бавна връзка изоставаше с минути |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | На всеки 250 ms, ако е променено състоянието на някой обект. `removed` е обект, който е забранен, изтрит или преименуван |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, алармата и какво се е случило с нея (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Веднага: преходите на алармите са редки и всеки има значение |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Веднага: екранът трябва да почервенее, когато устройство падне, а не при следващото изпращане |
| `logbook` | `{"kinds":["state","write"]}`, кои видове записи на дневника имат нещо ново | Най-много веднъж в секунда. Без записи в него, защото това, което един екран трябва да показва, зависи от филтрите му: той иска от `GET /api/logbook` собствената си страница |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Ред с коментар (`: heartbeat 2026-09-27T20:35:00Z`) на всеки 20 секунди пречи на прокситата да затворят неактивна връзка. Всяка отворена страница се темпира сама: нейният записващ почива толкова, колкото е траяло последното му изпращане (най-много пет секунди), а каквото пристигне междувременно, се държи по таг и по обект, само най-новото, така че страница на бавна връзка остава едно-две изпращания зад завода, никога минути, не губи нищо и не взема нищо от другите страници. Потокът се компресира с gzip, когато заявката казва `Accept-Encoding: gzip` (браузърът го прави), което свежда първата картина на един тестер от около 326 KB до около 11 KB по линията. Отговорът задава `X-Accel-Buffering: no`, защото буфериращо прокси превръща потока на живо в много бавно изтегляне.

Потокът поглежда сесията си отново на всеки пет секунди и се затваря, когато сесията я няма: излязла, изтекла, отнета, или акаунтът е забранен или вече няма право на `status.read`. Не изпраща събитие преди това. `EventSource` на браузъра се свързва отново, получава `401`, описан по-горе, и спира. С `HOTLOOP_AUTH_INSECURE=true` няма сесия и няма какво да се проверява. Проверката не се брои за използване на сесията, така че оставен отворен екран не поддържа сесията свежа.

## MCP

### `/mcp` и `/mcp/`

Model Context Protocol, стрийминг HTTP транспорт, за агенти. Всеки метод: транспортът използва `POST` за извикванията, `GET` за собствения поток на сървъра и `DELETE`, за да приключи сесия. Пътят е `HOTLOOP_MCP_PATH` (по подразбиране `/mcp`), а endpoint-ът го има само когато `HOTLOOP_MCP_ENABLED` е включено.

Той **не** е зад входа със сесия. Има собствен bearer токен, `HOTLOOP_MCP_TOKEN`, проверяван пред обработчика, така че викащ без него не може дори да изброи инструментите:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Без конфигуриран токен HotLoop създава един при първото си стартиране и го държи в базата си данни (`hotloop mcp-token` го отпечатва), така че endpoint-ът никога не е отворен. Агентът е викащ като всеки друг: чете и пише, записите му минават през същата врата за запис като на всички, и се одитират като `mcp:<client name>`. Инструментите и ресурсите са в [MCP](/bg/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

отговаря със заглавие `Mcp-Session-Id` и възможностите и инструкциите на сървъра.

## Интерфейсът

### `GET /manifest.webmanifest`

Манифестът на уеб приложението, който позволява на телефон да инсталира интерфейса като приложение: името на продукта и на завода, `display` `standalone`, цветовете на темата, иконите (PNG от 192 и 512 пиксела, маскируема 512 и SVG) и преки пътища към Аларми и Табла. Всеки URL адрес в него е относителен към този на самия манифест, така че е верен където и да е монтиран HotLoop. Името следва името на завода, зададено в Настройки, а отговорът е `Cache-Control: no-cache`, за да се види преименуването при следващия поглед. Без сесия: телефонът пита, преди някой да е влязъл. Вижте [Табла](/bg/iot/dashboards/#на-телефон).

### `GET /sw.js`

Service worker-ът, в корена на мястото, където е монтиран HotLoop, така че обхватът му да покрива цялото приложение. Държи страницата и последния отговор на четенията, които човек гледа, и отговаря с тях, отбелязани като стари, когато HotLoop не може да бъде достигнат. Никога не отговаря на запис, не го пази и не го слага в опашка. Работещата версия е в него, така че всяко издание има собствен кеш на страниците. `Cache-Control: no-cache`; без сесия. Само браузър в защитен контекст (https или `localhost`) го изпълнява.

### `GET /next` и `GET /next/`

Където живееше интерфейсът, докато старият беше по подразбиране. И двата са `301` към корена, така че отметка, направена тогава, пак стига.

### `/`

Уеб интерфейсът, изграден от `web/` в двоичния файл: страница, нейните скриптове, стилове и шрифтове, service worker и иконите на инсталируемото приложение, като всеки URL адрес в тях е относителен към страницата, така че да работи в корена на хост, под път, зад прокси или в iframe на таблото на EmberNet. Сървърът попълва заглавието и един блок с данни, `<script type="application/json" id="iiot">`, с това, което знае само той: завода, обекта, продукта, функциите, политиката за запис и часовата зона. Само `GET` и `HEAD`; всеки друг метод е `405`. Път, който не е един от файловете му, е `404`, защото сервирането на страницата при печатна грешка би я накарало да изглежда като работещ екран, а двоичен файл, изграден без интерфейса, го казва с обикновен текст и как да се изгради. Без сесия: страницата е формулярът за вход, докато не влезете.
