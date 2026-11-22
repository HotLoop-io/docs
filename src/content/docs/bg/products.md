---
title: "Продукти HotLoop: осем в пет линии"
description: "Осем продукта в пет линии на версиите: какво има във всеки основен продукт, коя база данни ползва, как се инсталират и как един обект минава на по-голям."
---

HotLoop са осем продукта за производствения цех: четири, които растат заедно с обекта (IoT, Edge, Gateway и Edge Relay), плюс Flow за свързването на логиката, Cascade за работните процеси, HotLoop for CODESYS за собствения екран на PLC и Transmitter за изкарване на стойностите на PLC в мрежата.

Излизат в пет линии на версиите. **HotLoop core** са IoT, Edge, Gateway и Edge Relay: четири продукта, един код, един етикет. Всяка версия на core пуска и четирите заедно, с един и същи номер на версията, всеки със свой образ, свой Helm чарт и свои Podman Quadlet единици. Изберете този, който отива на машината. Всеки продукт говори всички протоколи, които HotLoop има, така че никога не се налага да минавате на по-голям продукт само за да прочетете PLC-то на бюрото си. Функциите ги разделят. Протоколите не.

**Flow**, **Cascade**, **HotLoop for CODESYS** и **Transmitter** са отделни линии със свои версии, така че версия на Flow никога не мести core, и обратно. Всичко под таблицата е за core. Ето откъде започва всеки от осемте:

| Продукт | Линия на версиите | Документация | Инсталиране | Бележки към версиите | Пътна карта |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/bg/iot/overview/">Документация</a> | <a href="/bg/iot/install/">Инсталиране</a> | <a href="/bg/releases/#hotloop-core">Бележки</a> | <a href="/bg/roadmap/">Пътна карта</a> |
| **HotLoop Edge** | HotLoop core | <a href="/bg/edge/overview/">Документация</a> | <a href="/bg/edge/install/">Инсталиране</a> | <a href="/bg/releases/#hotloop-core">Бележки</a> | <a href="/bg/roadmap/">Пътна карта</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/bg/gateway/overview/">Документация</a> | <a href="/bg/gateway/install/">Инсталиране</a> | <a href="/bg/releases/#hotloop-core">Бележки</a> | <a href="/bg/roadmap/">Пътна карта</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/bg/edge-relay/overview/">Документация</a> | <a href="/bg/edge-relay/install/">Инсталиране</a> | <a href="/bg/releases/#hotloop-core">Бележки</a> | <a href="/bg/roadmap/">Пътна карта</a> |
| **HotLoop Flow** | Flow | <a href="/bg/flow/overview/">Документация</a> | <a href="/bg/flow/install/">Инсталиране</a> | <a href="/bg/releases/#hotloop-flow">Бележки</a> | <a href="/bg/flow/roadmap/">Пътна карта</a> |
| **HotLoop Cascade** | Cascade | <a href="/bg/cascade/overview/">Документация</a> | <a href="/bg/cascade/running/">Инсталиране</a> | <a href="/bg/releases/#hotloop-cascade">Бележки</a> | <a href="/bg/cascade/roadmap/">Пътна карта</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/bg/codesys/overview/">Документация</a> | <a href="/bg/codesys/install/">Инсталиране</a> | <a href="/bg/releases/codesys-0-3-8/">Бележки</a> | <a href="/bg/codesys/roadmap/">Пътна карта</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/bg/transmitter/overview/">Документация</a> | <a href="/bg/transmitter/install/">Инсталиране</a> | <a href="/bg/releases/transmitter-1-1-0/">Бележки</a> | <a href="/bg/transmitter/roadmap/">Пътна карта</a> |

Следващата таблица сравнява четирите продукта на core.

| <span class="sr-only">Подробности</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| За какво служи | Основата на автоматизацията. Pi, NUC, кутия в шкаф | Кутия до машината, която продължава да работи, дори връзката нагоре да падне | Мозъкът на обекта | Опитва, препраща, оцелява. Без база данни и без интерфейс |
| Обекти (entities), автоматизации, помощници, скриптове, рецепти, шаблони, табла, дневник, съобщения, MCP, MQTT с откриване, аларми по ISA-18.2, архиви и всеки драйвер | да | да | да | само драйвери |
| OPC UA сървър, публикуване на Sparkplug от периферията със съхраняване и препращане | | да | да | само публикуване |
| Парк от устройства, много обекти, планирани отчети | | | да | |
| Образ | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Чарт | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet единици | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Quadlet единици върху SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | няма |
| `database.type` в чарта | `postgresql` (по подразбиране), `sqlite` | `timescaledb` (по подразбиране), `postgresql`, `sqlite` | `timescaledb` (по подразбиране), `postgresql`, `sqlite` | няма |
| Архитектури | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Базата данни, която пускат чартът и Quadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | няма |
| История, която се пази по подразбиране | 30 дни | 90 дни | 90 дни | няма |
| Бази данни, върху които работи бинарният файл | SQLite или Postgres | SQLite, Postgres или TimescaleDB | SQLite, Postgres или TimescaleDB | няма |

Базата данни е настройка, не образ: `HOTLOOP_DB_TYPE=sqlite` и `HOTLOOP_DB_PATH` слагат всеки от трите върху SQLite файл, изобщо без контейнер за база данни (DEPLOYMENT.md, „SQLite“). Чартовете приемат същия избор като `database.type`, а Quadlet единиците като директориите `sqlite/`, като всеки продукт предлага само базите от таблицата по-горе: ако поискате `timescaledb` от чарта на IoT, инсталирането пропада. Преминаването от една база към друга е архивиране и възстановяване (BACKUP.md).

Gateway запази имената, с които излезе, до 4.17.0 включително: образ `ghcr.io/hotloop-io/hotloop`, чарт `hotloop`. Който го ползва, не трябва да сменя нищо.

## Каквото има в един продукт, това има в бинарния файл

Продуктът е компилация, не настройка. `-tags hotloop_iot` компилира IoT, `-tags hotloop_edge` компилира Edge, а без таг се компилира Gateway. Което един продукт няма, не е изключено, а го няма: OPC UA сървърът изобщо не е в образа на IoT, така че никаква променлива на средата, никакъв файл със стойности и никакъв лош ден не могат да го включат.

Затова по-малкият продукт отговаря за това, което няма, вместо да се преструва:

- **API-то** запазва всеки маршрут във всеки продукт. Маршрут за функция, която този продукт няма, отговаря с `404` и назовава продукта, който я има: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` казва `product` и `features`, така че скриптът пита, вместо да налучква.
- **Настройка само за Gateway** върху IoT или Edge (например `HOTLOOP_REPORTS_ENABLED=true`, пренесена от стар файл със стойности) предупреждава при стартиране и на екрана с настройките, и HotLoop работи. HotLoop държи завода в ход въпреки отчет, който не може да направи, а предупреждението се грижи някой да го види.
- **Чартовете** изобщо нямат настройката. `charts/hotloop-iot` няма блок `reports`, `opcuaServer` или `edgePublish`, а `hotloop-edge` няма `reports`. Ако я зададете все пак, тя не създава нищо.
- **`hotloop --product`** отпечатва `iot`, `edge` или `gateway`. `--version` пак отпечатва само версията, защото скриптове я разчитат.

## Кой да изберете

- **Pi, умни контакти, няколко датчика, MQTT брокер, пълен с Tasmota и Zigbee2MQTT, или едно PLC на бюрото:** IoT. Това е най-малкият образ (около 29 MB на arm), а образът на обикновения PostgreSQL е една шеста от този на TimescaleDB, което на SD карта е числото, което има значение.
- **Кутия, закрепена до линия, която захранва SCADA през OPC UA или публикува нагоре през Sparkplug и преживява падането на връзката нагоре:** Edge.
- **Обектът: всяка линия, отчети по имейл по график, edge relay-та, които докладват, повече от един обект на един екран:** Gateway.
- **Кутия, която само да опитва и препраща, без база данни за поддържане:** Edge Relay. Вижте [справката за Edge Relay](/bg/edge-relay/reference/).

## Размери

Образът е бинарният файл плюс около 3 MB основа.

| <span class="sr-only">Подробности</span> | образ / бинарен файл за amd64 | образ / бинарен файл за arm64 | образ / бинарен файл за arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | не се компилира |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Това са размерите на диска. Без устройства HotLoop заема около 10 MB RSS, а PostgreSQL около 12 MB, и това е долната граница, не реалното число: колко ползва един продукт с опитвани устройства зависи от устройствата.

## Инсталиране

### Helm

Едно хранилище, и четирите чарта:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Наречете изданието `hotloop`, независимо от продукта. По името на изданието са наречени томът на базата данни, Secrets и Service, и запазването му е това, което позволява на един обект по-късно да мине на по-голям продукт (по-долу).

В EmberNet всеки от тях е отделна карта в App Store: „HotLoop IoT“, „HotLoop Edge“, „HotLoop Gateway“ и „HotLoop Edge Relay“. Разгръщане от магазина вмъква етикетите на наемателя от таблото във всичко, което чартът генерира, а Running Apps ги показва като `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` и `HotLoop-Edge-Relay`.

### Podman Quadlet

За машина, която не е в клъстер. Всяка продуктова директория под `deploy/quadlet/` има пет единици: `hotloop.network`, `hotloop.container` (приложението), `hotloop-db.container` (неговата база данни, същият образ и версия като тези на чарта му), `hotloop-db.volume` и `hotloop-data.volume`. Стъпките за инсталиране са в заглавната част на всеки `hotloop.container`, а [Podman Quadlet](/bg/install/quadlet/) има останалото.

Нужен е Podman 5.0 или по-нов. Raspberry Pi OS Bookworm идва с 4.3, който изобщо няма Quadlet, така че Pi иска Raspberry Pi OS Trixie или по-нов. Приложението следва `:stable` и автоматичното обновяване на Podman го мести, а базата данни е закована: [README-то на Quadlet](/bg/install/auto-update/) обяснява как и защо. Както и да е инсталирано, сложете базата данни на USB SSD, а не на SD картата. Историята пише през целия ден, всеки ден, и SD картите умират точно от това.

## Преминаване на обект към по-голям продукт

От IoT към Edge и към Gateway се запазват всяко устройство, таг, обект, автоматизация, аларма, потребител и час история. Всеки продукт изпълнява всяка миграция, така че базата данни има една и съща форма и в трите, а по-големият продукт стартира с празни допълнителни функции.

- **Quadlet:** имената на единиците, томовете и тайните са едни и същи във всяка продуктова директория. Копирайте `hotloop.container` и `hotloop-db.container` на по-големия продукт върху вашите, изпълнете `systemctl daemon-reload` и рестартирайте.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (или `hotloop/hotloop`) върху същото издание. Трите чарта избират подовете си със същите етикети и наричат еднакво StatefulSet и тома на базата данни, така че надграждането е позволено и томът остава свързан.

Първо направете архив (`POST /api/backup`, вижте [Архиви и възстановяване](/bg/iot/backup/)) и го копирайте извън машината. Преминаването е изпълнено на Quadlet, от IoT към Edge и към Gateway върху един том на базата данни със същото устройство на всяка стъпка, с PostgreSQL директорията на IoT, стартираща под образа TimescaleDB на Gateway, и като `helm upgrade` на истински клъстер. Където простата директория на IoT няма разширението TimescaleDB, историята остава в родни партиции след преминаването, а hypertable изисква архив и възстановяване в нова TimescaleDB. Връщането към по-малък продукт не е стъпка за машина, която ви е ценна.

## Как излизат

Един `v` таг пуска и четирите, така че IoT, Edge, Gateway и Edge Relay винаги споделят версия. Преди да се компилира каквото и да е, се проверява версията и образът на всеки чарт да съвпадат с тага, всяка Quadlet единица на приложение да следва `:stable` с проверка на състоянието, и всяка единица на база данни да съвпада с чарта си и никога да не се обновява автоматично. Чартовете на IoT и Edge се генерират от чарта на Gateway, така че поправка в единия стига до всичките три.
