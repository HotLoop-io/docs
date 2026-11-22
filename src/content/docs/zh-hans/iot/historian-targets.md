---
title: "历史数据库目标"
description: "HotLoop 保存的每一条读数，也可以同时写入工厂自己的 PostgreSQL、TimescaleDB、SQL Server、InfluxDB、MySQL 或 MariaDB。"
---

HotLoop 保存自己的历史记录，这一点不会变。但工厂本来就有数据库。IT 部门给它做备份、打补丁、接入 Power BI，审计时也由他们负责，没有人会为了看一条趋势就改用我们的。所以 HotLoop 把历史同时写进他们的数据库。

内置历史库保存的每一条读数都会发往每一个目标：同样的读数，经过同样的死区，带着同样的质量。不多也不少。从目标画出的趋势和在 HotLoop 里画出的趋势一致，因为它们是同样的行。

目标在 HotLoop IoT、Edge 和 Gateway 中提供。Edge Relay 不提供：它没有自己的历史可用来让目标追平，而中继的全部工作就是把读数送到 Gateway，由 Gateway 写到任何地方。

HotLoop 可以写入的数据库：

| 类型 | 已验证的版本 | <span class="sr-only">Details</span> |
|---|---|---|
| PostgreSQL 和 TimescaleDB | PostgreSQL 16 搭配 TimescaleDB 2.30 | [见下文](#postgresql-和-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [见下文](#microsoft-sql-server) |
| InfluxDB 2 和 3 | InfluxDB 2.9.1 和 InfluxDB 3 Core 3.12.0 | [见下文](#influxdb-2-和-3) |
| MySQL 和 MariaDB | MySQL 26.7.0 和 MariaDB 13.0.2 | [见下文](#mysql-和-mariadb) |
| Kafka API（事件流） | Apache Kafka 4.4.0 和 Redpanda 26.2.6 | [见下文](#kafka-api事件流) |

## 添加目标

**设置、历史数据库目标、添加目标**，或者 `POST /api/historian/targets`（参见 [HTTP API](/zh-hans/iot/api/#historian-targets)）。仅限管理员，因为目标是工厂数据的去向，而决定去向是管理员的职责。凡是能读取设置的人，都能看到这些目标以及每个目标的运行情况。

一个目标由类型、地址（`host` 或 `host:port`）、数据库、表和登录账号组成。密码使用与设备凭据相同的密钥加密保存（`HOTLOOP_SECRET_KEY_FILE`，参见[备份与恢复](/zh-hans/iot/backup/)），并且不会再从 API 中返回。没有密钥时，带密码的目标会被拒绝：备份里出现明文的数据库登录信息，正是这个密钥要防止的。

如果表不存在，HotLoop 会创建它。如果表已存在但不是 HotLoop 创建的（没有下面的六列），目标会处于停止状态，并说明缺少哪些列，而不是逐条拒绝每一条读数。

## 写入表中的内容

与 HotLoop 自身历史相同的六列，所以为一方写的查询也能读取另一方：

| 列 | <span class="sr-only">Details</span> |
|---|---|
| `ts` | 读数的采集时间，UTC，精确到微秒 |
| `device_id` | 设备 |
| `tag_name` | 变量 |
| `value` | 数值，文本读数时为空 |
| `string_val` | 文本，数值读数时为空 |
| `quality` | `good`、`bad` 或 `uncertain` |

主键是 `(device_id, tag_name, ts)`，设备和变量在前，因为趋势查询的是一个变量随时间的变化。这个主键也是同一条读数发送两次没有影响的原因：它还是一行。下面的追平机制有意依赖这一点。

## 目标停止运行时

这是最重要的部分，所以下面准确说明会发生什么。

**轮询从不等待它。** 读数通过内存中的队列送往目标，队列大小与内置历史库的相同（`HOTLOOP_HISTORIAN_QUEUE_SIZE`）。交出一条读数从不阻塞。队列满时会丢弃最旧的读数来腾出空间，与内置历史库遵循同一规则，原因也相同：在有内存限制的 pod 上，无上限的队列会以 OOM kill 收场，到那时积压数据、实时数据和进程就都丢了。目标位于吞掉所有数据包的防火墙之后，经测试也不会拖住任何东西：不影响轮询，不影响内置历史库，也不影响关机。

**恢复后会追平。** 队列中等待的先发送。队列不得不丢弃的随后发送，取自 HotLoop 自己的历史，那里已经有这些读数。磁盘上没有需要估算大小或被填满的第二份副本，追平的有效期取决于 HotLoop 保留历史的时间（`HOTLOOP_HISTORIAN_RETENTION_DAYS`，未修改时为 90 天），而不是某个缓冲区能撑多久。

**中途重启不会遗忘。** 目标所欠的是写在它那一行里的一段时间范围，而不是内存里的一堆读数。正常停止时会准确记下所欠的内容。崩溃时做不到，所以目标一旦停止或开始丢弃，HotLoop 就记下起点，终点保持开放。下次启动会从那里发送全部内容。

**无法发送的内容会明确说出来。** 有两种情况无法追平，都会写入系统日志，并注明数量和采集时间：

- 目标恢复时已经超出 HotLoop 自身保留期的读数。它们在 HotLoop 里也没有了。日志会给出准确的范围。
- 目标数据库直接拒绝的读数：列放不下的值，或者有人加在表上的 check 约束。批次会被拆分，直到找出它不接受的读数，所以一条坏读数永远不会拖住其余读数，这些读数会被计为已拒绝。这一提示每分钟最多一次，因为数据库放不下的变量在每次轮询时都会被拒绝。

完全不让 HotLoop 进入的数据库（密码错误、没有插入权限、表缺少列）属于**停止**，绝不是“拒绝”。读数会等待，有人修复的那一刻它们就写入。只有针对读数本身的拒绝才会被放弃。

每一步都会写入系统日志，主题为 `historian/<id>`：

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

设置卡片会实时显示同样的信息：状态（`writing`、`catching up`、`down`、`off`）、停止的原因、有多少在等待，以及还欠多少。

追平会落后于所欠的最新读数一分钟，并等待内置历史库跟上，因为仍在那个队列里的读数还没有进入数据库。越过它去读，会让它被永久跳过。

## 关闭、修改、删除

关闭后，目标什么也收不到，关闭期间也不欠任何内容。已经欠下的仍然欠着。修改（新密码、新地址）会用新设置让它重新开始，已经欠下的仍然欠着。删除则会忘掉它所欠的内容。它已有的数据仍留在它的数据库里。

只有提供界面的那个 HotLoop 才会写入目标。旁边运行的 `--mcp-stdio` 辅助进程不写，否则所有内容都会发出两次。

## PostgreSQL 和 TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- 端口默认为 5432。表默认为 `hotloop_history`，可以带 schema(`history.hotloop`)。schema 必须已存在。
- 如果数据库有 TimescaleDB 扩展，HotLoop 创建的表是基于 `ts` 的 hypertable。如果转换失败，表保持普通表，仍然接收每一条读数，系统日志会说明原因。
- 登录账号需要能连接、首次创建表（或者由您按上面的六列自行创建），并向其中插入数据。不需要其他权限。能读表但不能插入的登录账号，是一个停止运行的目标，而不是拒绝读数的目标。
- `useTls` 会校验服务器证书（`sslmode=verify-full`）。`insecureSkipVerify` 加密但不校验（`sslmode=require`）。不使用 `useTls` 时连接不加密（`sslmode=disable`）。
- NaN 和无穷大按原样写入：`double precision` 可以保存它们。
- 语句不做预编译，因此在数据库前面放一个事务模式的 PgBouncer 没有问题。

如果您想自己建表：

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

- 端口默认为 1433，表默认为 `dbo` schema 中的 `hotloop_history`。前面带的 schema(`history.hotloop`)按给定值使用，且必须已存在。
- 数据库必须已存在。HotLoop 创建表，不创建数据库。
- HotLoop 创建的表中，`ts` 为 `datetime2(6)`，名称为 `nvarchar`，`value` 为 `float`，`string_val` 为 `nvarchar(max)`，主键为 `(device_id, tag_name, ts)`。这个主键决定了变量名最多 380 个字符，更长的名称会作为读数被拒绝并给出提示：聚集键最大可达 900 字节。
- 登录账号需要能连接、首次创建表（或者由您按这六列自行创建），并向其中插入数据。能读表但不能插入的登录账号，是一个停止运行的目标，而不是拒绝读数的目标。
- **NaN 和无穷大会带着时间和质量写入，但没有数值。** SQL Server 的 `float` 保存不了它们。读数还在，`value` 为 NULL。
- SQL Server 自己会加密登录过程，所以密码从不以明文传输。`useTls` 还会加密读数并校验服务器证书；`insecureSkipVerify` 加密但不校验。
- 已存在的读数会被跳过，所以发送两次仍然只有一行。

如果您想自己建表：

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

## MySQL 和 MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

两者是同一种类型：它们使用相同的协议，在这里接受相同的语句，并且都在测试套件中运行。

- 端口默认为 3306，表默认为 `hotloop_history`。前面带数据库的名称（`other.hotloop`）按给定值使用。数据库必须已存在；HotLoop 创建表，不创建数据库。
- HotLoop 创建的表使用 InnoDB，`ts` 为 UTC 的 `DATETIME(6)`，`value` 为 `DOUBLE`，`string_val` 为 `LONGTEXT`，主键为 `(device_id, tag_name, ts)`。名称使用 `utf8mb4_bin`，因为 HotLoop 的变量名区分大小写，而服务器默认的排序规则不区分：`Temp` 和 `TEMP` 会变成同一个键。这个主键决定了变量名最多 512 个字符，更长的名称会作为读数被拒绝并给出提示。
- **表建好之后，只需要 INSERT 这一项权限**，首次创建时如果希望由 HotLoop 建表，还需要 CREATE。它不读取表，也不使用 `ON DUPLICATE KEY UPDATE`，因为那还会要求 UPDATE：已存在的读数是主键重复，会被跳过。
- **NaN 和无穷大会带着时间和质量写入，但没有数值。** `DOUBLE` 保存不了它们。`value` 为 NULL。
- 别人加的其他唯一索引上的重复，不算同一条读数：它会像 check 约束一样被拒绝并给出提示。
- `useTls` 会加密并校验服务器证书；`insecureSkipVerify` 加密但不校验。不使用 `useTls` 时密码仍不会以明文传输（MySQL 8 的默认登录会用服务器的密钥加密后发送），但中间的人可能替换那个密钥，所以只要不在工厂自己的线路上，就请指定 `useTls`。

如果您想自己建表：

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

## InfluxDB 2 和 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

同一个目标既能对接 InfluxDB 2，也能对接 InfluxDB 3，走的是普通 HTTP（`/api/v2/write`，line protocol，微秒时间戳）。两者都能响应，所以不需要锁定驱动，也没有什么要选的。

- 端口默认为 8086，即 InfluxDB 2 的端口。InfluxDB 3 在未修改时监听 8181，所以请指定端口。
- `database` 是 bucket。`org` 是 InfluxDB 2 的组织，InfluxDB 2 要求有一个：没有它，每次写入都是一个说明此事的 400，目标会带着该消息处于停止状态。InfluxDB 3 没有组织，留空即可。
- `password` 是 API 令牌。它需要对 bucket(InfluxDB 2)或数据库（InfluxDB 3）有写权限。HotLoop 不创建 bucket。bucket 不存在时返回 404，这属于目标停止，而不是读数被拒绝。InfluxDB 3 会在有数据写入时创建数据库。
- `table` 是 measurement，除非另行指定，默认为 `hotloop_history`。
- 一条读数就是一个点。设备和变量是 tag，所以每个 HotLoop 变量就是一个 series。数值（`value`）或文本（`string_val`）和质量（`quality`）是 field。同一条读数发送两次会覆盖自己。
- **NaN 和无穷大会带着时间和质量写入，但没有 `value` 字段。** line protocol 没有办法写入它们。
- InfluxDB 会永久固定字段的类型（2 中按 shard，3 中按列）。如果别的东西已经向 `string_val` 写入了数值，或向 `value` 写入了文本，HotLoop 另一种类型的读数会被拒绝、计数，并在系统日志中点名，其余的照常写入。
- 401 或 403（它不认识的令牌，或没有写权限的令牌）属于目标停止，而不是拒绝：不会丢弃任何数据，令牌一旦正确，读数就会写入。
- `useTls` 切换为 `https` 并校验证书；`insecureSkipVerify` 不校验。

## Kafka API（事件流）

不是数据库，而是一条流。历史库保存的每一条读数都会进入一个 Kafka topic，如果您再给一个 topic，HotLoop 写入自己系统日志的每一行（报警、设备上线下线、配置更改）也会进入。它使用 Kafka API，所以 Apache Kafka、Redpanda 以及任何响应该协议的系统都能接收。同样的队列，同样从 HotLoop 自己的历史追平，同样是“停止运行的 broker 不会拖慢任何东西”，与其他所有目标一样。

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` 是用逗号分隔的 broker 列表，未指定时端口为 9092。有一个就足以起步：broker 会告知其余的在哪里。
- `table` 是读数的 topic（除非另行指定，默认为 `hotloop.tags`）。`options.eventsTopic` 是事件的 topic，从表单添加目标或在 API 调用中省略时为 `hotloop.events`，留空则不发送事件。两者不能是同一个 topic。
- 如果 topic 不存在，HotLoop 会按 broker 自身默认的分区数和副本数创建。无法创建它们的登录账号会成为带有 broker 原因的停止目标，所以如果您的账号不能创建，请先建好。
- `options.sasl` 是 `scram-sha-512`、`scram-sha-256` 或 `plain`，配合 `username` 和 `password`。PLAIN 会原样发送密码，所以没有 `useTls` 时 HotLoop 会拒绝。被 broker 拒绝的登录属于**停止**，状态里显示“the broker refused the login”，绝不是“拒绝读数”。
- `useTls` 会校验 broker 的证书。如果证书由您自己的 CA 签发，请把 CA 以 PEM 格式放入 `options.caCert`。`insecureSkipVerify` 加密但不校验。
- 不支持客户端证书（双向 TLS）、Kerberos 和 OAuth 登录。

**写入读数 topic 的内容。** 每条读数一个 JSON 对象，键为 `deviceId/tag`，这样同一个变量的读数在一个分区内保持顺序：

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

数值是 `value`；文本是 `text`，此时 `value` 为 null;JSON 无法表示 NaN 或无穷大，所以它们用 `nonFinite` 表示（`NaN`、`+Inf`、`-Inf`），此时 `value` 为 null。这一格式只会增加字段，绝不会修改。消息头：`hotloop-type: reading` 和 `content-type: application/json`。记录自身的时间戳是它生成的时间；读数的时间是 `ts`。

**写入事件 topic 的内容。** 每行系统日志一个 JSON 对象，键为其主题（没有主题时为其类别），`hotloop-type: event`：

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` 是该行携带的 JSON，按 JSON 写入，如果它不是 JSON 则为文本。关于历史库目标本身的日志行会被排除，否则停止运行的 broker 会向它自己报告自己停止了。

**至少送达一次，事件则是尽力而为。**
- 读数：送达由每个同步副本确认，中断后的追平会有意与已发出的内容重叠，所以一条读数可能到达两次。`deviceId`、`tag` 和 `ts` 可以标识重复项；在意的消费者会丢弃重复的那条。从未到达 broker 的读数属于所欠内容，会像数据库那样从 HotLoop 自己的历史发送。
- 事件是实时的数据流。没有可供追平的事件历史，所以 broker 不在时产生的事件，或缓冲区已满之后产生的事件会丢失，目标的状态会为此计数（`eventsLost`），设置卡片也会显示。
- broker 在写入过程中消失，会在 25 秒内使目标**停止**，该次写入中的读数属于所欠内容。（否则 franz-go 会无限期等待一次它无法证明没有送达的写入；HotLoop 让它放弃，所以可能出现重复。）
- broker 永远不会接收的读数（超过一条消息允许的大小）会被单独拒绝、计数，并在系统日志中点名，同一批次的其余读数照常发出。

HotLoop 通过 [franz-go](https://github.com/twmb/franz-go)(BSD-3-Clause)使用 Kafka API，已在 `NOTICE` 中注明。它使二进制文件增加了约 5 MiB。

## 如何测试

每一种目标都针对真实的数据库或 broker 运行过，并经历了真正切断再恢复的中断：目标最终持有的内容与 HotLoop 持有的完全一致，目标停止期间重启会在下次启动时追平，而卡住的目标既不会拖住轮询，也不会拖住内置历史库。
