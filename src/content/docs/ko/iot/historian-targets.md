---
title: "히스토리안 대상"
description: "HotLoop이 보관하는 모든 측정값을 공장의 PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL, MariaDB에도 함께 기록하세요."
---

HotLoop은 자체 이력을 보관하며, 이 점은 달라지지 않습니다. 다만 공장에는 이미 데이터베이스가 있습니다. IT 팀이 백업하고, 패치하고, Power BI를 연결하고, 감사에서 책임지는 데이터베이스이며, 추세 하나 보자고 우리 것으로 옮겨 올 사람은 없습니다. 그래서 HotLoop은 이력을 그쪽 데이터베이스에도 기록합니다.

내장 히스토리안이 보관하는 모든 측정값은 모든 대상으로 갑니다. 같은 측정값이, 같은 불감대를 거쳐, 같은 품질로 갑니다. 더도 덜도 아닙니다. 대상에서 그린 추세와 HotLoop에서 그린 추세는 같은 행이므로 일치합니다.

대상은 HotLoop IoT, Edge, Gateway에 있습니다. Edge Relay에는 없습니다. Edge Relay에는 대상을 따라잡게 해 줄 자체 이력이 없고, 릴레이의 역할은 측정값을 어디든 기록할 수 있는 Gateway로 전달하는 것이기 때문입니다.

HotLoop이 기록하는 데이터베이스:

| 종류 | 검증한 버전 | <span class="sr-only">세부 정보</span> |
|---|---|---|
| PostgreSQL 및 TimescaleDB | PostgreSQL 16과 TimescaleDB 2.30 | [아래](#postgresql-및-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [아래](#microsoft-sql-server) |
| InfluxDB 2 및 3 | InfluxDB 2.9.1과 InfluxDB 3 Core 3.12.0 | [아래](#influxdb-2-및-3) |
| MySQL 및 MariaDB | MySQL 26.7.0과 MariaDB 13.0.2 | [아래](#mysql-및-mariadb) |
| Kafka API (이벤트 스트림) | Apache Kafka 4.4.0과 Redpanda 26.2.6 | [아래](#kafka-api-이벤트-스트림) |

## 대상 추가

**설정, 히스토리안 대상, 대상 추가**를 사용하거나 `POST /api/historian/targets`를 호출하세요([HTTP API](/ko/iot/api/#히스토리안-대상) 참고). 대상은 공장 데이터가 가는 곳이고 그곳을 정하는 것은 관리자의 일이므로 관리자만 사용할 수 있습니다. 설정을 읽을 수 있는 사람은 누구나 대상과 각 대상의 상태를 볼 수 있습니다.

대상은 종류, 주소(`host` 또는 `host:port`), 데이터베이스, 테이블, 로그인으로 구성됩니다. 비밀번호는 장치 자격 증명과 같은 키로 봉인되며(`HOTLOOP_SECRET_KEY_FILE`, [백업 및 복원](/ko/iot/backup/) 참고) API에서 다시 나오지 않습니다. 키가 없으면 비밀번호가 있는 대상은 거부됩니다. 백업에 데이터베이스 로그인이 평문으로 들어가는 일을 막으려고 이 키가 있기 때문입니다.

테이블이 없으면 HotLoop이 만듭니다. 테이블이 있지만 HotLoop이 만든 것이 아니면(아래 여섯 열이 없으면) 대상은 중단 상태가 되고, 측정값을 하나씩 거부하는 대신 어떤 열이 없는지 알려 줍니다.

## 테이블에 들어가는 내용

HotLoop 자체 이력과 같은 여섯 개 열이므로, 한쪽에 맞춰 쓴 쿼리가 다른 쪽도 읽습니다.

| 열 | <span class="sr-only">세부 정보</span> |
|---|---|
| `ts` | 측정값을 취한 시각, UTC, 마이크로초 단위 |
| `device_id` | 장치 |
| `tag_name` | 태그 |
| `value` | 숫자, 텍스트 측정값이면 비어 있음 |
| `string_val` | 텍스트, 숫자 측정값이면 비어 있음 |
| `quality` | `good`, `bad` 또는 `uncertain` |

기본 키는 `(device_id, tag_name, ts)`이며, 추세는 하나의 태그를 시간순으로 요청하므로 장치와 태그가 앞에 옵니다. 이 키 덕분에 측정값을 두 번 보내도 한 행이 되어 문제가 없습니다. 아래의 따라잡기는 이 점을 일부러 활용합니다.

## 대상이 중단되었을 때

가장 중요한 부분이므로 정확히 무슨 일이 일어나는지 설명합니다.

**폴링은 대상을 기다리지 않습니다.** 측정값은 메모리 내 큐를 통해 대상으로 가며, 크기는 내장 히스토리안의 큐와 같습니다(`HOTLOOP_HISTORIAN_QUEUE_SIZE`). 측정값을 넘기는 일은 절대 막히지 않습니다. 큐가 가득 차면 가장 오래된 측정값을 버려 자리를 만드는데, 내장 히스토리안과 같은 규칙이며 이유도 같습니다. 메모리 제한이 있는 pod에서 한도 없는 큐는 OOM kill로 끝나고, 그러면 밀린 데이터, 실시간 데이터, 프로세스를 모두 잃기 때문입니다. 모든 패킷을 삼키는 방화벽 뒤의 대상도 폴링, 내장 히스토리안, 종료 어느 것도 붙잡지 않도록 시험되어 있습니다.

**복구되면 따라잡습니다.** 큐에서 기다리던 것이 먼저 나갑니다. 큐가 버려야 했던 것은 그다음에 HotLoop 자체 이력에서 나갑니다. 자체 이력에는 그 측정값이 이미 모두 있습니다. 크기를 정하거나 채워야 할 두 번째 디스크 복사본이 없으며, 따라잡기는 어떤 버퍼가 버티는 동안이 아니라 HotLoop이 이력을 보관하는 동안 작동합니다(`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 바꾸지 않았다면 90일).

**중간에 재시작해도 잊지 않습니다.** 대상에 보내야 할 것은 메모리에 쌓인 측정값 더미가 아니라 그 행에 기록된 시간 범위입니다. 정상 종료하면 보내야 할 범위를 정확히 기록합니다. 비정상 종료는 기록할 수 없으므로, 대상이 중단되거나 버리기 시작하는 순간 HotLoop이 시작 지점을 끝이 열린 채로 기록해 둡니다. 다음 시작 때 거기서부터 모두 보냅니다.

**보내지 못하는 것은 분명히 알립니다.** 따라잡을 수 없는 경우가 두 가지 있으며, 둘 다 몇 건이고 언제 취한 것인지와 함께 시스템 로그에 남습니다.

- 대상이 돌아왔을 때 이미 HotLoop의 보관 기간을 넘긴 측정값. HotLoop에서도 사라졌습니다. 로그에 정확한 범위가 나옵니다.
- 대상의 데이터베이스가 아예 거부하는 측정값. 열에 들어가지 않는 값이나 누군가 테이블에 건 check 제약 조건 때문입니다. 배치를 나누어 거부되는 측정값을 찾아내므로 나쁜 측정값 하나가 나머지를 막는 일은 없으며, 해당 측정값은 거부된 것으로 집계됩니다. 데이터베이스가 받지 못하는 태그는 폴링할 때마다 거부되므로 알림은 1분에 한 번 이하로만 나옵니다.

HotLoop을 전혀 들여보내지 않는 데이터베이스(잘못된 비밀번호, 삽입 권한 없음, 테이블에 열이 없음)는 **중단** 상태이며 "거부 중"이 아닙니다. 측정값은 기다리다가 누군가 고치는 순간 들어갑니다. 측정값 자체에 대한 거부만 포기합니다.

모든 단계는 시스템 로그에 `historian/<id>` 주제로 남습니다.

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

설정 카드에도 같은 내용이 실시간으로 표시됩니다. 상태(`writing`, `catching up`, `down`, `off`), 중단된 이유, 대기 중인 양, 아직 보내야 할 것입니다.

따라잡기는 보내야 할 가장 최근 측정값보다 1분 뒤에서 진행하며 내장 히스토리안이 따라올 때까지 기다립니다. 그 큐에 아직 있는 측정값은 아직 데이터베이스에 없기 때문이며, 그 너머까지 읽으면 영영 건너뛰게 됩니다.

## 끄기, 변경, 제거

꺼 두면 대상은 아무것도 받지 않고, 꺼진 시간에 대해서는 보낼 것도 없습니다. 이미 보내야 했던 것은 그대로 남습니다. 변경(새 비밀번호, 새 주소)하면 새 설정으로 다시 시작하며, 보내야 했던 것은 그대로 남습니다. 제거하면 보내야 했던 기록이 사라집니다. 이미 들어 있는 데이터는 대상의 데이터베이스에 남습니다.

UI를 서비스하는 HotLoop만 대상에 기록합니다. 옆에서 실행되는 `--mcp-stdio` 도우미는 기록하지 않으며, 그렇지 않으면 모든 것이 두 번 나갈 것입니다.

## PostgreSQL 및 TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- 포트 기본값은 5432입니다. 테이블 기본값은 `hotloop_history`이며 스키마를 붙일 수 있습니다(`history.hotloop`). 스키마는 이미 있어야 합니다.
- 데이터베이스에 TimescaleDB 확장이 있으면 HotLoop이 만드는 테이블은 `ts` 기준 hypertable입니다. 변환에 실패하면 테이블은 일반 테이블로 남아 모든 측정값을 그대로 받으며, 이유는 시스템 로그에 남습니다.
- 로그인은 연결하고, 처음에 테이블을 만들고(또는 위의 여섯 열로 직접 만들고), 테이블에 삽입할 수 있어야 합니다. 그 외에는 필요 없습니다. 테이블을 읽을 수는 있지만 삽입할 수 없는 로그인은 측정값을 거부하는 대상이 아니라 중단된 대상입니다.
- `useTls`는 서버 인증서를 확인합니다(`sslmode=verify-full`). `insecureSkipVerify`는 확인 없이 암호화합니다(`sslmode=require`). `useTls`가 없으면 연결은 암호화되지 않습니다(`sslmode=disable`).
- NaN과 무한대는 그대로 들어갑니다. `double precision`이 담을 수 있습니다.
- 구문을 미리 준비하지 않으므로 데이터베이스 앞에 트랜잭션 모드의 PgBouncer를 두어도 됩니다.

테이블을 직접 만들고 싶다면 다음과 같습니다.

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- 포트 기본값은 1433이고 테이블은 `dbo` 스키마의 `hotloop_history`입니다. 앞에 붙인 스키마(`history.hotloop`)는 주어진 그대로 쓰이며 이미 있어야 합니다.
- 데이터베이스는 이미 있어야 합니다. HotLoop은 테이블을 만들 뿐 데이터베이스는 만들지 않습니다.
- HotLoop이 만드는 테이블은 `ts`를 `datetime2(6)`, 이름을 `nvarchar`, `value`를 `float`, `string_val`을 `nvarchar(max)`로 두고 기본 키를 `(device_id, tag_name, ts)`로 합니다. 이 키 때문에 태그 이름은 최대 380자이고, 더 긴 이름은 측정값으로서 거부되며 알림이 나옵니다. 클러스터형 키는 900바이트까지 가능하기 때문입니다.
- 로그인은 연결하고, 처음에 테이블을 만들고(또는 이 여섯 열로 직접 만들고), 테이블에 삽입할 수 있어야 합니다. 테이블을 읽을 수는 있지만 삽입할 수 없는 로그인은 측정값을 거부하는 대상이 아니라 중단된 대상입니다.
- **NaN과 무한대는 시각과 품질은 있고 숫자 없이 들어갑니다.** SQL Server의 `float`은 이를 담을 수 없습니다. 측정값은 남고 `value`는 NULL입니다.
- SQL Server는 로그인 자체를 암호화하므로 비밀번호가 평문으로 오가지 않습니다. `useTls`는 측정값도 암호화하고 서버 인증서를 확인하며, `insecureSkipVerify`는 확인 없이 암호화합니다.
- 이미 있는 측정값은 건너뛰므로 두 번 보내도 한 행입니다.

테이블을 직접 만들고 싶다면 다음과 같습니다.

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQL 및 MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

둘은 하나의 종류입니다. 같은 프로토콜을 쓰고 여기서는 같은 구문을 받으며, 둘 다 테스트 스위트에서 실행됩니다.

- 포트 기본값은 3306이고 테이블은 `hotloop_history`입니다. 앞에 데이터베이스를 붙인 이름(`other.hotloop`)은 주어진 그대로 쓰입니다. 데이터베이스는 이미 있어야 합니다. HotLoop은 테이블을 만들 뿐 데이터베이스는 만들지 않습니다.
- HotLoop이 만드는 테이블은 InnoDB이며 `ts`는 UTC `DATETIME(6)`, `value`는 `DOUBLE`, `string_val`은 `LONGTEXT`이고 기본 키는 `(device_id, tag_name, ts)`입니다. 이름은 `utf8mb4_bin`입니다. HotLoop의 태그 이름은 대소문자를 구분하는데 서버의 기본 collation은 구분하지 않아서 `Temp`와 `TEMP`가 같은 키가 되기 때문입니다. 이 키 때문에 태그 이름은 최대 512자이고, 더 긴 이름은 측정값으로서 거부되며 알림이 나옵니다.
- **필요한 권한은 INSERT뿐입니다.** 테이블이 있는 경우이며, HotLoop이 만들게 하려면 처음에만 CREATE도 필요합니다. 테이블을 읽지 않으며 UPDATE도 요구하게 되는 `ON DUPLICATE KEY UPDATE`도 쓰지 않습니다. 이미 있는 측정값은 기본 키 중복이므로 건너뜁니다.
- **NaN과 무한대는 시각과 품질은 있고 숫자 없이 들어갑니다.** `DOUBLE`은 이를 담을 수 없습니다. `value`는 NULL입니다.
- 누군가 추가한 다른 고유 인덱스에서의 중복은 같은 측정값이 아닙니다. check 제약 조건처럼 거부되며 알림이 나옵니다.
- `useTls`는 암호화하고 서버 인증서를 확인합니다. `insecureSkipVerify`는 확인 없이 암호화합니다. `useTls`가 없어도 비밀번호는 평문으로 오가지 않지만(MySQL 8의 기본 로그인은 서버 키로 암호화해 보냅니다) 중간에 있는 누군가가 그 키를 바꿔치기할 수 있으므로, 공장 자체 회선이 아닌 곳에서는 `useTls`를 지정하세요.

테이블을 직접 만들고 싶다면 다음과 같습니다.

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2 및 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

같은 대상이 일반 HTTP(`/api/v2/write`, line protocol, 마이크로초 타임스탬프)로 InfluxDB 2와 InfluxDB 3 모두와 통신합니다. 둘 다 이에 응답하므로 고정할 드라이버도, 고를 것도 없습니다.

- 포트 기본값은 InfluxDB 2의 8086입니다. InfluxDB 3은 바꾸지 않았다면 8181에서 수신하므로 포트를 지정하세요.
- `database`는 bucket입니다. `org`는 InfluxDB 2의 조직이며 InfluxDB 2는 조직을 요구합니다. 없으면 모든 쓰기가 그 사실을 알리는 400이 되고 대상은 그 메시지와 함께 중단됩니다. InfluxDB 3에는 조직이 없으므로 생략하세요.
- `password`는 API 토큰입니다. bucket(InfluxDB 2) 또는 데이터베이스(InfluxDB 3)에 대한 쓰기 권한이 필요합니다. HotLoop은 bucket을 만들지 않습니다. bucket이 없으면 404이며, 이는 측정값 거부가 아니라 대상 중단입니다. InfluxDB 3은 쓰기가 들어오면 데이터베이스를 만듭니다.
- `table`은 measurement이며 따로 지정하지 않으면 `hotloop_history`입니다.
- 측정값은 하나의 포인트입니다. 장치와 태그는 tag이므로 HotLoop 태그 하나가 시리즈 하나입니다. 숫자(`value`) 또는 텍스트(`string_val`)와 품질(`quality`)은 필드입니다. 같은 측정값을 두 번 보내면 스스로를 덮어씁니다.
- **NaN과 무한대는 시각과 품질은 있고 `value` 필드 없이 들어갑니다.** Line protocol로는 쓸 방법이 없습니다.
- InfluxDB는 필드 타입을 영구히 고정합니다(2에서는 shard별, 3에서는 열별). 다른 것이 이미 `string_val`에 숫자나 `value`에 텍스트를 썼다면 반대 종류의 HotLoop 측정값은 거부되고 집계되며 시스템 로그에 이름이 남고, 나머지는 들어갑니다.
- 401 또는 403(모르는 토큰이나 쓸 수 없는 토큰)은 거부가 아니라 대상 중단입니다. 아무것도 버려지지 않고, 토큰이 올바르게 되는 순간 측정값이 들어갑니다.
- `useTls`는 `https`로 전환하고 인증서를 확인합니다. `insecureSkipVerify`는 확인하지 않습니다.

## Kafka API (이벤트 스트림)

데이터베이스가 아니라 스트림입니다. 히스토리안이 보관하는 모든 측정값이 Kafka 토픽으로 가며, 두 번째 토픽을 지정하면 HotLoop이 자체 시스템 로그에 쓰는 모든 줄(알람, 장치의 연결과 끊김, 구성 변경)도 그곳으로 갑니다. Kafka API를 사용하므로 Apache Kafka, Redpanda, 그리고 이 프로토콜에 응답하는 다른 모든 서버가 받을 수 있습니다. 큐도, HotLoop 자체 이력에서의 따라잡기도, "중단된 브로커가 아무것도 늦추지 않는다"는 점도 다른 모든 대상과 같습니다.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address`는 쉼표로 구분한 브로커 목록이며 지정하지 않으면 포트 9092입니다. 시작하려면 하나면 충분합니다. 나머지가 어디 있는지는 브로커가 알려 줍니다.
- `table`은 측정값용 토픽입니다(따로 지정하지 않으면 `hotloop.tags`). `options.eventsTopic`은 이벤트용 토픽이며, 양식에서 대상을 추가하거나 API 호출에서 생략하면 `hotloop.events`이고, 비워 두면 이벤트를 보내지 않습니다. 두 토픽은 같을 수 없습니다.
- 토픽이 없으면 HotLoop이 브로커 자체의 기본 파티션과 복제 설정으로 만듭니다. 토픽을 만들 수 없는 로그인은 브로커가 알려 준 이유와 함께 중단된 대상이 되므로, 사용하는 로그인으로 만들 수 없다면 먼저 만들어 두세요.
- `options.sasl`은 `scram-sha-512`, `scram-sha-256` 또는 `plain`이며 `username`과 `password`를 함께 씁니다. PLAIN은 비밀번호를 그대로 보내므로 HotLoop은 `useTls` 없이는 거부합니다. 브로커가 거절한 로그인은 **중단** 상태이며 상태에 "the broker refused the login"이 표시되고, "측정값 거부"로 표시되는 일은 없습니다.
- `useTls`는 브로커의 인증서를 확인합니다. 자체 CA로 서명했다면 CA를 PEM으로 `options.caCert`에 넣으세요. `insecureSkipVerify`는 확인 없이 암호화합니다.
- 클라이언트 인증서(상호 TLS), Kerberos, OAuth 로그인은 지원하지 않습니다.

**측정값 토픽에 들어가는 내용.** 측정값 하나당 JSON 객체 하나이며, 키는 `deviceId/tag`로 하나의 태그의 측정값이 한 파티션에서 순서를 유지하도록 합니다.

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

숫자는 `value`입니다. 텍스트는 `text`이고 `value`는 null입니다. JSON은 NaN이나 무한대를 담을 수 없으므로 이들은 `nonFinite`(`NaN`, `+Inf`, `-Inf`)로 표시되고 `value`는 null입니다. 이 형식에는 필드만 추가되고 기존 필드는 바뀌지 않습니다. 헤더는 `hotloop-type: reading`과 `content-type: application/json`입니다. 레코드 자체의 타임스탬프는 생성된 시각이고, 측정값의 시각은 `ts`입니다.

**이벤트 토픽에 들어가는 내용.** 시스템 로그 한 줄당 JSON 객체 하나이며, 키는 그 주제(없으면 범주)이고 `hotloop-type: event`입니다.

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail`은 그 줄이 담고 있던 JSON이며, JSON이 아니었다면 텍스트입니다. 히스토리안 대상 자체에 대한 줄은 제외됩니다. 그렇지 않으면 중단된 브로커가 자신의 중단을 스스로에게 보고하게 되기 때문입니다.

**최소 한 번 전달이며, 이벤트는 최선 노력입니다.**
- 측정값: 전달은 동기화된 모든 복제본이 확인하며, 중단 후 따라잡기는 이미 나간 것과 일부러 겹치므로 측정값이 두 번 도착할 수 있습니다. `deviceId`, `tag`, `ts`로 중복을 식별할 수 있으며, 중복이 문제인 소비자는 반복된 것을 버립니다. 브로커에 도달하지 못한 측정값은 보내야 할 것으로 남아 데이터베이스와 마찬가지로 HotLoop 자체 이력에서 전송됩니다.
- 이벤트는 실시간 피드입니다. 따라잡을 이력이 없으므로 브로커가 없는 동안이나 버퍼가 가득 찬 뒤에 생성된 이벤트는 손실되며, 대상의 상태가 이를 집계하고(`eventsLost`) 설정 카드에 표시됩니다.
- 쓰기 도중 브로커가 사라지면 25초 안에 대상이 **중단** 상태가 되고, 그 쓰기에 들어 있던 측정값은 보내야 할 것으로 남습니다. (franz-go는 도착하지 않았음을 증명할 수 없는 쓰기를 영원히 기다리게 되므로 HotLoop은 포기하게 두며, 그래서 중복이 생길 수 있습니다.)
- 브로커가 절대 받지 않을 측정값(메시지 크기 한도 초과)은 단독으로 거부되고 집계되며 시스템 로그에 이름이 남고, 같은 배치의 나머지는 그대로 나갑니다.

HotLoop은 [franz-go](https://github.com/twmb/franz-go)(BSD-3-Clause)를 통해 Kafka API를 사용하며 `NOTICE`에 명시되어 있습니다. 바이너리 크기가 약 5 MiB 늘었습니다.

## 시험 방법

모든 종류의 대상은 실제 데이터베이스 또는 브로커를 상대로, 실제로 끊었다가 복구한 중단을 거쳐 실행되었습니다. 대상은 결국 HotLoop이 가진 것과 정확히 같은 데이터를 가지며, 중단 중의 재시작은 다음 시작 때 따라잡고, 멈춰 버린 대상은 폴링도 내장 히스토리안도 붙잡지 않습니다.
