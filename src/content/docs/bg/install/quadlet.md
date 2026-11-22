---
title: "Podman Quadlet на Pi"
description: "Пуснете HotLoop като истински systemd услуги на Pi или малък индустриален компютър с Podman Quadlet, без Docker, без Compose и без клъстер."
---

За Pi или малък индустриален компютър, който **не** е част от k3s клъстер. Ако е, използвайте chart-а на продукта. Тази директория и chart-овете са двата поддържани начина да пуснете HotLoop.

Без Docker и без самотен `podman run` от шел, който умира със сесията. Quadlet превръща контейнерите в истински systemd услуги: стартират при зареждане без влезли потребители, рестартират се при грешка и пишат в journald.

| Директория | Продукт | Образ |
|---|---|---|
| `iot/` | HotLoop IoT, с PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, с TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, с TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| тази директория | HotLoop Edge Relay, без база данни | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[Страницата с продуктите](/bg/products/) показва кой ви трябва.

Всеки от първите три има и директория `sqlite/`: същият продукт с базата данни като файл и без контейнер за база данни. Вижте [SQLite вместо PostgreSQL](#sqlite-вместо-postgresql).

## IoT, Edge и Gateway

Всяка директория има едни и същи единици и един скрипт:

- **`hotloop.network`**: мрежата, която приложението и базата му споделят. Приложението стига до базата по име (`hotloop-db:5432`) и нищо друго на устройството не може, защото базата не публикува порт. Публикуван е само 8080 на приложението.
- **`hotloop.container`**: приложението. Заглавната му част съдържа стъпките за инсталиране; прочетете я, преди да копирате каквото и да е.
- **`hotloop-db.container`**: базата данни, същият образ и версия, които пуска chart-ът на този продукт. Обявява се за стартирала, когато отговаря, така че приложението изчаква база, която може да ползва.
- **`hotloop-db-upgrade.container`** и **`hotloop-db-upgrade.sh`**: преминаването на базата от PostgreSQL 16 към 17, еднократно. Изпълнява се преди единицата на базата и само когато томът още съдържа данни от 16; при нов том или такъв, вече на 17, systemd я прескача. Вижте [PostgreSQL 16 към 17](#postgresql-16-към-17).
- **`hotloop-db.volume`** и **`hotloop-data.volume`**: базата данни и всичко, което приложението пише в `/data` (резервни копия, сертификати, опашката за препращане, отчети). Именувани томове на Podman, така че `podman system prune` ги оставя на мира.

Три секрета на Podman държат онова, което не е за файл: `hotloop-db-password`, `hotloop-secret-key` (криптира паролите на устройствата в базата; пазете копие извън устройството) и `hotloop-admin-password-hash` (bcrypt хешът на паролата на първия администратор, никога самата парола).

**Podman 5.0 или по-нов.** Raspberry Pi OS Bookworm идва с Podman 4.3, който изобщо няма Quadlet: използвайте Raspberry Pi OS Trixie (Podman 5.4) или по-нов. Обновяванията по-долу са изпълнени на Podman 6.1.3; единицата на Edge Relay, която споделя същите ключове, на 4.9.3. И сложете тома на базата на USB SSD, не на SD картата. Историята пише през целия ден и SD картите умират именно от това.

### Защо всички продукти ползват едни и същи имена

Имената на единиците, томовете и секретите са еднакви в `iot/`, `edge/` и `gateway/`, нарочно. Преместването на устройство към по-голям продукт е копиране на `hotloop.container` и `hotloop-db.container` на по-големия продукт върху вашите:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Томовете и секретите остават, а с тях и всяко устройство, таг, аларма, потребител и час история. Все пак първо направете резервно копие (`POST /api/backup`). Тази стъпка е изпълнена, от IoT към Edge и към Gateway върху един и същ набор томове. Връщането към по-малък продукт не е стъпка за устройство, което ви е ценно.

Това означава и един HotLoop на устройство. Два така или иначе ще се бият за порт 8080.

### Проверено

Доставените файлове за IoT, Edge и Gateway, недокоснати, се генерират с генератора `quadlet` на Podman 6.1.3 със същата структура: приложението изисква базата и мрежата, публикува собствения си порт и носи етикета за автоматично обновяване, а базата няма такъв и не публикува нищо.

След това единиците на Gateway бяха пуснати наистина: без root, под systemd, с локален регистър вместо ghcr.io и собствения `podman auto-update` на продуктите. Първо стартиране със здрава база и здраво приложение след нея; обновяване към версия, която добавя миграция към таблица, която приложението вече ползва, направено със съществуващото устройство и данните му непокътнати и без контейнерът на базата да се рестартира; и обновяване към версия, която мигрира базата и после не може да стартира, което Podman върна назад, а предишната версия стартира здрава върху базата, която неуспешната вече беше мигрирала. Edge и IoT работят със същите единици и са пускани под systemd на истински Pi, на физически хардуер (2026-11-17).

## PostgreSQL 16 към 17

Базата данни на HotLoop е PostgreSQL 17 от тази версия. Устройство, което е пускало по-ранна версия, има данни на PostgreSQL 16, които PostgreSQL 17 няма да отвори, затова преминаването е единица, която се изпълнява преди базата. Сложете новите файлове на място и рестартирайте базата, и това е всичко:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` изисква единицата за надграждане, така че устройство, на което е копирана само новата единица на базата, не стартира върху данни на 16, а журналът казва защо. Единицата за надграждане изпълнява `pg_upgrade` в режим на копиране в нова директория до старата, стартира новия сървър веднъж, за да докаже, че се отваря, и чак тогава разменя имената; старите данни остават на тома като `pgdata.pg16`. Тя тегли образа на PostgreSQL 16 само когато томът го изисква. Грешка оставя данните на 16 каквито са били, а базата нестартирана. Пълното описание, пътят назад и как да изтриете `pgdata.pg16` са в [k3s и Helm](/bg/install/helm/#postgresql-17). При инсталация без root пътят на скрипта в единицата е `~/.config/containers/systemd`, от `%E`.

## SQLite вместо PostgreSQL

Базата данни е настройка, не образ (страницата за k3s и Helm, "SQLite"). При Quadlet това означава втори набор файлове, не втори образ. Директорията `sqlite/` на всеки продукт има два:

- **`sqlite/hotloop.container`**: само приложението. Без `Requires=` към база, без мрежа, без парола за база, и с `HOTLOOP_DB_TYPE=sqlite` и файла на `HOTLOOP_DB_PATH=/data/hotloop.db`. Следва `:stable` и връща назад лошо обновяване точно като единицата за PostgreSQL: същата проверка на здравето, същият `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: томът `hotloop-data`, където живеят файлът на базата и неговите `-wal` и `-shm`. Същото име на том като при файловете за PostgreSQL, така че е същият том с данни, ако някога смените.

| Директория | Инсталация | Секрети |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | три |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | два: `hotloop-secret-key` и `hotloop-admin-password-hash` |

Инсталирайте единия набор или другия, никога и двата: ползват едни и същи имена на единици. Заглавната част на `sqlite/hotloop.container` има точните стъпки. Накратко:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Няколко неща, които да знаете, преди да го изберете. SQLite е един пишещ върху един локален диск: на Pi томът отива на USB SSD, а мрежовото хранилище не е вариант, защото SQLite се поврежда върху него. Историята е една таблица с индекс, не партиции или хипертаблица, така че обект с години история на всяка секунда има нужда от файловете за PostgreSQL. А преместването на устройство между SQLite и PostgreSQL е резервно копие и възстановяване ([Резервни копия и възстановяване](/bg/iot/backup/)), не размяна на единици: новата база започва празна. Не копирайте `sqlite/hotloop.container` върху работеща инсталация на PostgreSQL, за да "превключите"; тя не чете данните на тома на PostgreSQL.

Обикновен PostgreSQL на Edge или Gateway е единицата за TimescaleDB с добавено `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` в `hotloop.container`. Единицата на IoT вече е обикновен PostgreSQL, а IoT изобщо няма единица за TimescaleDB.

### Проверено (SQLite)

`iot/sqlite/hotloop.container` и неговият том бяха пуснати без root на Podman 4.9.3 под systemd (`systemctl --user`) от публикуваните файлове, променени само в имената, порта, образа (изграден от същото дърво) и работната директория, от която има нужда потребителският мениджър. Единицата стартира здрава, `/healthz` и `/readyz` отговориха с 200, администраторът влезе от секрета с хеша, `/api/status` отговори, `hotloop.db`, `hotloop.db-wal` и `hotloop.db-shm` се появиха на тома, а рестартът не приложи миграции и вписа администратора отново. Единиците `sqlite/` на Edge и Gateway са същият файл освен образа и стойността по подразбиране за съхранение и са пускани под systemd като root на истински Pi, на физически хардуер (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: по избор: задържа обновяванията на образа, докато оператор не ги одобри. Допълнение на systemd, не част от стандартна инсталация.
- **`edge-relay.container`**, самата услуга. Пълните стъпки за инсталиране са в коментара в заглавната ѝ част; прочетете го, преди да копирате каквото и да е.
- **`edge-relay-data.volume`**, именуван том на Podman за опашката за препращане, така че буферираните показания да оцеляват при рестарт на контейнера. Podman го създава автоматично при първото стартиране на услугата.
- **`devices.example.json`**, отправна точка за файла с устройства. Копирайте го в `/etc/edge-relay/devices.json` и го редактирайте за действителните устройства на този обект; пълният формат е в [справочника за Edge Relay](/bg/edge-relay/reference/).

### Бърз старт

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

**Обновявания.** Единицата следва `:stable` и се обновява сама, щом таймерът на Podman е включен:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Ако нов образ не мине проверката си за здраве, Podman връща стария. Списъкът на флотата в Gateway показва версията и дайджеста на образа на всеки релей и записва всяка промяна. За да задържите обновяванията, докато администратор ги одобри на Gateway, инсталирайте `edge-relay-hold.conf`, както казва коментарът в началото на този файл, и изключете таймера. Всичко, което това прави, и какво не може, е в [справочника за Edge Relay](/bg/edge-relay/reference/#updating-a-relay).

За да приложите промяна в локалния файл: редактирайте го, после изпълнете `sudo systemctl restart edge-relay.service`. Релето чете този файл при стартиране и не го наблюдава.

Файл с устройства, изпратен от Gateway, не се нуждае от нищо от това: прилага се на живо, без рестарт. Не може да се запише в `/etc/edge-relay/devices.json` (монтиран е `:ro` върху коренова файлова система само за четене), затова отива на тома с данни като `/data/pushed-devices.json` и докато съществува, релето работи и стартира от него. Вашите редакции на локалния файл остават неизползвани, докато не изчистите изпратеното: `DELETE /api/fleet/{id}/config` на Gateway, докато релето работи, и то се връща на локалния файл веднага. Журналът казва кой файл е в ход, така че проверете там, преди да се усъмните в JSON-а си.

Проверено срещу истинския двоичен файл `quadlet` (`/usr/libexec/podman/quadlet -dryrun` от `podman-5.8.6`): и двете единици се разчитат чисто и генерират очакваното извикване `podman run`, със зависимостта от тома и секрета, свързани автоматично.
