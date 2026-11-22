---
title: "Инсталиране на HotLoop Edge {{hotloop}}"
description: "Инсталирайте HotLoop Edge {{hotloop}} на k3s с Helm или на индустриален компютър с Podman Quadlet, после включете OPC UA сървъра и публикуването по Sparkplug."
sidebar:
  label: "Инсталиране"
---

HotLoop Edge излезе за първи път в 4.18.10. Образът е `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}`, изграден за amd64, arm64 и arm/v7, а чартът е `hotloop-edge` в същото Helm хранилище като останалата гама. И двете се теглят без вход. Няма път с Docker или Compose, нарочно, а голо `podman run` от обвивка, която умира със сесията, не е инсталация.

Клъстерът ползва Helm. Индустриален компютър или Pi без клъстер ползва Podman Quadlet. Базата данни се избира веднъж: TimescaleDB (по подразбиране), обикновен PostgreSQL или SQLite файл без никакъв контейнер за база данни.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-edge --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Наричайте релийза `hotloop`, независимо за кой продукт е. По името на релийза се казват томът на базата данни, Secrets и Service, и запазването му позволява по-късно обектът да премине към по-голям продукт.

Това разгръща Edge плюс TimescaleDB 2.30.1 върху PostgreSQL 17 до него, на том от 20 Gi, с 90 дни история. Чартът генерира паролата на базата данни, MCP токена и администраторска парола в Secret на релийза и ги използва повторно при всяко надграждане. Генерира и `<release>-secret-key`, ключа, който шифрова всяка парола на устройство, пазена от HotLoop. Този ключ е част от вашите данни, а [страницата за инсталиране на Gateway](/bg/gateway/install/#архивирайте-ключа-преди-да-ви-трябва) обяснява защо и как да го архивирате. Това е същият ключ.

За обикновен PostgreSQL или SQLite файл задайте `database.type` на `postgresql` или `sqlite` при инсталиране. SQLite файлът е един писач на един локален диск, така че е една реплика и никога NFS. По-късната смяна на базата е архивиране и възстановяване, защото новата база започва празна. [Архивите](/bg/iot/backup/) имат възстановяването.

### Вход

Потребителят е `admin`. Бележките към инсталацията отпечатват командата, която връща паролата:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Отворете `http://localhost:8080`. Записите са изключени от доставка: всеки таг е само за четене, докато някой не го активира, а `safety.allowWrites` остава `false`, докато не решите, че тази кутия може да движи машини. [Вратата за запис](/bg/gateway/write-gate/) има всяка проверка, по ред.

### Какво добавя Edge и как да го включите

И двете са изключени по подразбиране, защото отварянето на слушател или връзка нагоре в заводска мрежа е нещо, което една инсталация прави нарочно.

**OPC UA сървърът** е `opcuaServer.enabled: true`, на порт 4840. Задайте `opcuaServer.endpointHost` на името, с което клиент стига до кутията, за да съвпада сертификатът. [OPC UA сървърът](/bg/edge/opc-ua-server/) има модела на сигурност, и той е само за четене.

**Здраве на кутията и монтирането на хоста.** OPC UA сървърът на чарта подава и здравето на тази кутия (процесор, памет, диск и джитър в реално време, когато агент записва файла) за таблото на EmberNet и създава вход за таблото, който може да чете тагове и стойности и нищо друго. Включено е по подразбиране: чартът монтира корена на хоста в `/host` и неговия `/proc` в `/host/proc`, и двете само за четене, и не добавя привилегии. Клъстер, който налага ограничения профил Pod Security, отказва hostPath, и там задавате `opcuaServer.dashboard.boxHealth.enabled: false` за без устройство и без монтирания, или `opcuaServer.dashboard.boxHealth.hostMount: false`, за да запазите устройството с показанията за диск и процесор, маркирани като лоши и с указание какво да се монтира. [OPC UA сървърът](/bg/edge/opc-ua-server/#box-health-for-the-embernet-dashboard) има останалото.

**Публикуването по Sparkplug** е `edgePublish.enabled: true`, като `edgePublish.broker` и `edgePublish.group` са задължителни. Задайте и `edgePublish.node`, иначе идентификаторът на възела е името на релийза. Опашката за препращане живее на том от 1 Gi, `edgePublish.queueMaxBytes` е 64 MiB по подразбиране (около 248 000 отчитания: около две минути при 2000 отчитания в секунда, при около 240 байта на отчитане), а над него най-старите отчитания се изхвърлят и броят. `0` е неограничено и достатъчно дълго прекъсване тогава препълва тома. Публикуването от Edge изисква `replicaCount` 1 и чартът отказва да се изгради иначе. [Публикуване от Edge и съхраняване и препращане](/bg/edge/edge-publish/) казва какво прави, когато връзката нагоре падне.

### Какво да зададете, преди да го види истински завод

| Стойност | По подразбиране | Защо да я променяте |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, празно | Как се казва заводът на екраните, в страниците и за другите обекти. |
| `global.timezone` | `America/New_York` | Графиците и смените на смяна вървят по нея. Трябва да е истинско име на зона. |
| `publicUrl` | празно | Адресът, на който телефон в Wi-Fi на завода стига до HotLoop. Без него известията нямат връзка обратно. |
| `safety.allowWrites` | `false` | Главният превключвател. Изключен, нищо не записва в машина, отникъде. |
| `historian.retentionDays` | `90` | Дни на пазена история. |
| `database.postgresql.persistence.size` | `20Gi` | Тук живее вашата история. Оразмерете го според броя тагове и срока по-горе. |
| `opcuaClient.persistence.enabled` | `false` | Включете го, преди да добавите защитено OPC UA устройство, за да оцелеят сертификатите на клиента след рестарт. |
| `secretKey.existingSecret` | празно | Secret, който управлявате сами, с ключа за паролите на устройствата. Задайте го, ако изграждате чарта с `helm template`. |

## Podman Quadlet

Quadlet превръща контейнерите в истински systemd услуги: стартират при зареждане, без да е влязъл никой, рестартират се, когато умрат, и пишат в журнала. Изисква **Podman 5.0 или по-нов**. Raspberry Pi OS Bookworm идва с 4.3, което изобщо няма Quadlet, така че Pi иска Trixie или по-нов. Сложете тома на базата данни на USB SSD, а не на SD картата.

Единиците са в директорията `edge/` на хранилището на HotLoop, под `deploy/quadlet/`, и имат същите имена като тези на IoT и Gateway. [Podman Quadlet](/bg/install/quadlet/) обяснява всеки файл.

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

После отворете `http://<this box>:8080` и влезте като `admin`. Пазете копие на ключа на място, което не е тази кутия, защото загубата му значи да въвеждате наново всяка парола на устройство.

Единицата публикува само порт 8080. Когато включите OPC UA сървъра (4840) или вградения MQTT брокер (1883), добавете ред `PublishPort=` за него в `hotloop.container`. Quadlet единицата пази 90 дни история по подразбиране, като чарта.

Искате обикновен PostgreSQL на Edge? Това е TimescaleDB единицата с добавено `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` в `hotloop.container`. Искате SQLite файл? Ползвайте файловете в `edge/sqlite/` и нищо от директорията отгоре, защото споделят имена на единици: това са `hotloop.container` и `hotloop-data.volume` и две тайни, `hotloop-secret-key` и `hotloop-admin-password-hash`.

Единицата следва `:stable`, а Podman я обновява, щом таймерът е включен:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Нов образ мигрира базата данни при стартиране, а ако не може да стартира, Podman връща предишния. Контейнерът на базата данни не следва `:stable`, нарочно. [Автоматичното обновяване на :stable](/bg/install/auto-update/) казва какво прави едно обновяване, какво не може да отмени връщането назад и как да задържите обновяванията, докато не кажете. Направете архив, преди да включите обновяванията.

## Преминаване към по-голям продукт

От IoT към Edge към Gateway се запазват всяко устройство, таг, обект, автоматизация, аларма, потребител и час история. На Quadlet това е копиране на `hotloop.container` и `hotloop-db.container` на по-големия продукт върху вашите, а [продуктовата гама](/bg/products/) има формата с Helm. Преминаването е изпълнено на Quadlet, IoT после Edge после Gateway върху един том на база данни, и като `helm upgrade` на истински клъстер. Връщането към по-малък продукт не е преминаване за кутия, която ви е важна, така че първо направете архив.

## Докъде е изпитан

Quadlet единиците на Edge са пускани под systemd, без root, включително обновяване, което мигрира, не може да стартира и се връща назад. Истински Pi под systemd като root и 32-битовите arm образи са пускани на истински хардуер, на голо желязо (2026-11-17).

## Лиценз

HotLoop Edge е под HotLoop Source License Agreement 1.0. Безплатен е и с достъпен изходен код, не е с отворен код по смисъла на OSI. Ползването у дома и в лаборатория е безплатно, както и ползването от училища, организации с идеална цел и държавни органи за собствената им дейност. Вижте [страницата за лиценза](/bg/license/) и [HotLoop в бизнеса](/bg/business/).
