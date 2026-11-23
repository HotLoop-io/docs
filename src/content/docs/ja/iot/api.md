---
title: "HTTP API リファレンス"
description: "HotLoop が HTTP で応答するすべての呼び出しと、必要なもの、受け取るもの、返すものをまとめています。Web UI はこれ以外を使いません。"
---

Gateway が HTTP で応答するすべての呼び出しについて、必要なもの、受け取るもの、返すものをまとめています。Web UI はこれ以外を使いません。画面の裏に非公開の API はないので、UI でできることは、同じ呼び出しと同じ権限でスクリプトからもできます。

このページはコードと照合して検査されます。そのため、ルートの一覧と呼び出せる人は、かつての API の説明ではありません。以下のリクエストとレスポンスの形は、稼働中の Gateway から取得したものです。テストはこれを検査しないので、ハンドラーを変更したら、このページの該当セクションも変更してください。

各機能の背景は、それぞれのページにあります。[認証とユーザー](/ja/iot/authentication/)、[エンティティ](/ja/iot/entities/)、[設備ツリーとラベル](/ja/iot/equipment/)、[オートメーション](/ja/iot/automations/)、[スケジュールレポート](/ja/gateway/reports/)、[フリート管理](/ja/gateway/fleet/)、[アラーム通知](/ja/iot/notifications/)、[バックアップと復元](/ja/iot/backup/)、[MCP](/ja/iot/mcp/)。このページは一覧で、理由は各ページに書かれています。

## 規約

### 場所

すべてアプリの HTTP ポート 1 つで動きます(`HOTLOOP_LISTEN_ADDR`、既定は `:8080`)。アプリをあるパスの下で提供するプロキシの背後では、`HOTLOOP_BASE_PATH` を設定すると Gateway がそのパスを取り除くので、`/hotloop/api/devices` と `/api/devices` は同じ呼び出しです。以下のパスはそれを除いた形で書いています。

### ログイン: Cookie またはベアラートークン

すべての `/api/` ルートにはセッションが必要です。例外は、ログイン(パスワード、またはキオスクパネルでの PIN やバッジ)、受信 Webhook、アラームの確認リンクで、これらはそれぞれリクエストの中に独自の証明を持っています。`POST /api/auth/login` はトークンを返し、同じ値を `iiot_session` Cookie にも設定します(HttpOnly、SameSite=Lax、リクエストが TLS または `X-Forwarded-Proto: https` で届いた場合は Secure)。ブラウザーは Cookie を使い、トークンを目にすることはありません。スクリプトは代わりにトークンを送ります。

```
Authorization: Bearer 3f9c...e1
```

どちらも同じセッションで、同じ方法で検査されます。セッションは `HOTLOOP_AUTH_SESSION_TTL`(既定は 12 時間)続きます。セッションがないと、すべての `/api/` ルートは次のように応答します。

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

取り消された、または期限切れのトークンには `"the session is invalid or has expired"`、無効にされたアカウントには `"this account no longer has access"` と応答します。

`HOTLOOP_AUTH_INSECURE=true` ではログインが一切ありません。何も検査されず、以下のすべての権限が全員に与えられ、書き込みに記録される名前はプロキシの `X-EmberNET-User`、`X-Forwarded-User`、`X-Auth-Request-User`、`X-Remote-User`、`X-Forwarded-Email` のいずれかのヘッダーから取られ、どれも設定されていなければ `operator` になります。ダッシュボードのプロキシ以外をポッドに到達させない NetworkPolicy の背後でのみ妥当な設定です。[認証とユーザー](/ja/iot/authentication/#ログインなしでの運用)を参照してください。

MCP は別扱いです。独自のベアラートークン(`HOTLOOP_MCP_TOKEN`)を持ち、セッションは一切見ません。[MCP](#mcp) を参照してください。

### 権限

ログインしたユーザーは、ロールから、またはアカウントに直接設定された権限の一覧を持ちます。持っていない権限を要求するルートは次のように応答します。

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

どのロールがどの権限を持つかは、[権限の表](#権限)にあります。

### エラー

API 自身が出す失敗は、すべて同じ形の JSON です。

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` は `detail` を追加し、失敗したサービス呼び出しは、すでに行った書き込みを追加します。メッセージは読む人のために書かれています。何が悪かったか、そして代わりにできることがあればそれを伝えます。そのまま表示してください。

| ステータス | 発生条件 |
|---|---|
| 400 | リクエストが間違っています。不正な形式の本文、検証に失敗したフィールド、未知のフィールド、不足しているパラメーター、未知のサービス |
| 401 | セッションがない、期限切れ、またはログイン時のパスワードが違う |
| 403 | ユーザーに権限がない、または書き込みゲートがポリシー上の理由で書き込みを拒否した。書き込みがオフ、タグが有効化されていない、エンティティが無効 |
| 404 | パスまたは本文で指定したものが存在しない |
| 409 | すでに存在する、またはこの操作ができない状態にある。保留されていないアラーム、子ノードが残っているノード、切り替える状態が不明なエンティティ、すでに実行中のスクリプト、拒否された、またはすでに適用中のレシピ |
| 422 | 書き込みゲートが値そのものを理由に拒否した。タグの範囲外、エンティティのステップに合わない値 |
| 502 | デバイスが独自のエラーで応答し、本文はその内容。または、レシピが開始されたがすべての対象には届かず、本文にどれが送信されどれが送信されなかったかが書かれている |
| 503 | デバイスが接続されていない、またはアラームエンジンが動作していない |
| 500 | サーバー内部の障害。本文は `internal error (ref …); the server log has the detail under that ref` だけで、エラーの全体はその参照番号でログに残ります。実際のメッセージが付く唯一の 500 は、ボタンを離した信号が送られなかった場合で、そのメッセージが確認すべき点を正確に伝えるためです |

API が分類できないものはすべて 500 であり、400 ではありません。データベース障害を 400 で返すと、オペレーターは自分の入力が間違っていたと受け取り、存在しない入力ミスを探し回ることになります。

API から来ない失敗が 2 つあり、JSON ではなくプレーンテキストです。どのルートにも一致しないパスは `404 page not found`、既知のパスを間違ったメソッドで呼ぶと `405 method not allowed` と応答します。

拒否された書き込みは決して 500 になりません。ポリシーによる拒否をサーバー障害として表示するプラントの画面は、オペレーターにエラーを無視するよう教えてしまいます。

### 本文

リクエストの本文は JSON で、最大 4 MiB です(受信 Webhook は 1 MiB)。**未知のフィールドは無視されず、拒否されます**。

```json
{"error":"request body: json: unknown field \"x\""}
```

綴りを間違えた設定が黙って捨てられると、うまくいった設定と見分けがつかなくなるため、デコーダーは代わりに拒否します。

デバイス、タグ、アラーム、オートメーション、フリートメンバー、レポートへの `POST` と `PUT` は、オブジェクト全体を置き換えます。省略したフィールドはゼロ値になり、省略したブール値は `false` になります。読み取り、変更し、送り返してください。例外は、送ったフィールドだけを変更するエンティティと設備の `PUT`、および省略すると維持されるデバイスの認証情報です(下記を参照)。

### シークレットは書き込み専用

デバイスに保存された認証情報(ブローカーのパスワード、HTTP ヘッダー、アドレス内のパスワード)は、管理者を含むどのロールにも返されません。`[redacted]` と表示されます。

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

デバイスを保存するときは、保存済みの値を維持するならプレースホルダーを送る(またはキーを省く)、置き換えるなら新しい値を送る、消去するなら `""` か `null` を送ります。新しいデバイスはプレースホルダーでは保存できません。また、維持した認証情報のままデバイスを別のホストへ移す保存は拒否されます。保存済みのパスワードが他人のリスナーへ持ち出されないようにするためです。詳しい規則は[認証とユーザー](/ja/iot/authentication/#デバイスの資格情報は書き込み専用です)にあります。Gateway が保持するほかの認証情報も同じです。設定には `set` または `not set` が表示され、診断は送信先の MCP ターゲットから認証情報を除去し、ログインが渡す 1 つを除いて、この API はパスワードのハッシュもセッショントークンも返しません。

### camelCase、ただし snake_case のところを除く

API の大部分は camelCase(`deviceId`、`pollIntervalMs`、`createdAt`)で、最初のバージョンからそうであり、EmberNet ダッシュボードの `TagValue` 契約もそれを求めています。

エンティティ、状態、サービス、設備、ラベルのエンドポイントは snake_case(`entity_id`、`last_changed`、`parent_id`、`label_id`)です。これは意図的です。エンティティ API は一般的なエンティティ、状態、サービスの形を使うので、その形を話せるものはこの API も話せます。設備ツリーはエンティティモデルのエリアレジストリであり、同じ利用者向けの形になっています。両者が出会う場所では、それぞれが自分の表記を保ちます。デバイスには `equipmentId`、エンティティには `equipment_id` があります。

### 時刻、期間、タグキー

- **タイムスタンプ**は UTC の RFC 3339 で、小数秒があればそれも含みます。例: `2026-09-27T20:21:58.255869Z`。表示タイムゾーンの設定は UI の見え方を変えるだけで、API が返す値は変えません。
- **まだ起きていない時刻は省略されます。** 一度も実行されていないルールには `lastRun` がなく、一度もポーリングされていないデバイスには `lastPoll` も `lastGood` もなく、誰も確認していないアラームには `ackedAt` がなく、一度も見られていないフリートメンバーには `lastSeen` がありません。時刻フィールドがないのは「一度もない」という意味です。Go のゼロ時刻 `0001-01-01T00:00:00Z` がレスポンスやストリームイベントに現れることはありません。以前は十数個のフィールドがこれを送り、オートメーション画面では一度も実行されていないルールが最終実行 739887 日前と表示されていました。これを保つため、テストがコード内のすべてのルートとすべての時刻フィールドを読み取ります。
- **スパークライン**は例外です。そこでは `timestamps` が Unix ミリ秒です。チャートにそのまま渡されるためです。
- **期間**は名前に単位を含みます。`pollIntervalMs`、`onDelaySec`、`minutes`、`durationMs`。ステータスの `uptime` は Go の期間文字列(`11m13s`)です。
- **タグキー**は `device/tag` で、すべての `?tag=` パラメーターと `tag` フィールドが取る形式です。タグ名にはスラッシュ(OPC UA のパス、MQTT のトピック)を含められるため、区切りは最初のスラッシュだけです。`plc-1/Line/Zone 1` は、デバイス `plc-1` のタグ `Line/Zone 1` です。
- **数値のクエリパラメーター**が数値でない場合は無視されて既定値が使われるので、`?limit=abc` は `?limit` を指定しないのと同じです。
- **空のリスト**は、すべてのレスポンスとストリームイベントで、どの深さでも `null` ではなく `[]` です。`.length` の前に null チェックは要りません。見かける `null` はリストではなく、エンティティの `equipment_id` やルートノードの `parent_id` のような、ドキュメントに載っている null を許すフィールドのどれかです。任意と記されたリストフィールドは、それでも丸ごと省略されることがあります。

### オプション機能

フリート、通知、バックアップ、スケジュールレポートは、それぞれの `HOTLOOP_*_ENABLED` 変数を設定しない限りオフです。機能がオフでも、その一覧ルートは 200 で応答し、`"configured": false` と空のリストを返すので、画面は「ここには何もありません」ではなく「有効になっていません」と表示できます。その機能のほかのすべてのルートは、変数名を示すエラーとともに 400 で応答します。

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

送信先の MCP サーバーが設定されていないときは、`GET /api/sites` も同じ動作をします。

### この製品にないもの

HotLoop は 1 つのコードベースから IoT、Edge、Gateway、Edge Relay として提供され、その製品にない機能はオフになっているのではなく、バイナリに入っていません。IoT、Edge、Gateway でもそのルートは、同じ権限チェックのあとに、両端の名前を示す 404 で応答するので、スクリプトは「違う箱」と「違う URL」を区別できます。

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

400 ではないのは、直せる変数がないからで、5xx でもないのは、何も壊れていないからです。`GET /api/status` はどの製品が応答したかと、どの機能があるかを最初に伝えるので、クライアントは探り合わずに尋ねられます。

### 何かを変えるものはすべて記録される

作成、変更、削除、書き込み、確認、ログインのすべてが、ユーザー名とともにシステムログ(`GET /api/events`)に残り、タグへの書き込みは拒否されたものも含めてすべて書き込み監査(`GET /api/writes`)に残ります。この API に静かな経路はありません。

## 権限

誰が何を持つかの一覧です。権限リストが明示されたアカウントは、ロールの権限セットの代わりに、そのリストに挙げたものだけを持ちます。`*` はすべてを、`resource.*` はリソース配下のすべてを与えます(`reports.*`)。admin ロールは `*` です。

| 権限 | viewer | operator | admin |
|---|---|---|---|
| `status.read` | はい | はい | はい |
| `devices.read` | はい | はい | はい |
| `devices.write` | いいえ | いいえ | はい |
| `tags.read` | はい | はい | はい |
| `tags.write` | いいえ | いいえ | はい |
| `values.read` | はい | はい | はい |
| `values.write` | いいえ | はい | はい |
| `board.write` | いいえ | はい | はい |
| `entities.read` | はい | はい | はい |
| `entities.write` | いいえ | いいえ | はい |
| `helpers.write` | いいえ | はい | はい |
| `equipment.read` | はい | はい | はい |
| `equipment.write` | いいえ | いいえ | はい |
| `alarms.read` | はい | はい | はい |
| `alarms.write` | いいえ | いいえ | はい |
| `alarms.ack` | いいえ | はい | はい |
| `automations.read` | はい | はい | はい |
| `automations.write` | いいえ | いいえ | はい |
| `automations.trigger` | いいえ | はい | はい |
| `scripts.read` | はい | はい | はい |
| `scripts.run` | いいえ | はい | はい |
| `scripts.write` | いいえ | いいえ | はい |
| `recipes.read` | はい | はい | はい |
| `recipes.apply` | いいえ | はい | はい |
| `recipes.write` | いいえ | いいえ | はい |
| `blueprints.read` | はい | はい | はい |
| `blueprints.apply` | いいえ | はい | はい |
| `blueprints.write` | いいえ | いいえ | はい |
| `dashboards.read` | はい | はい | はい |
| `dashboards.write` | いいえ | いいえ | はい |
| `energy.read` | はい | はい | はい |
| `energy.write` | いいえ | いいえ | はい |
| `fleet.read` | はい | はい | はい |
| `fleet.write` | いいえ | はい | はい |
| `fleet.rebirth` | いいえ | はい | はい |
| `fleet.restart` | いいえ | いいえ | はい |
| `fleet.update` | いいえ | いいえ | はい |
| `fleet.config` | いいえ | いいえ | はい |
| `notify.test` | いいえ | いいえ | はい |
| `notify.escalation` | いいえ | いいえ | はい |
| `backup.read` | いいえ | いいえ | はい |
| `backup.run` | いいえ | いいえ | はい |
| `reports.read` | はい | はい | はい |
| `reports.run` | いいえ | はい | はい |
| `reports.write` | いいえ | いいえ | はい |
| `sites.read` | はい | はい | はい |
| `settings.read` | はい | はい | はい |
| `settings.write` | いいえ | いいえ | はい |
| `events.read` | はい | はい | はい |
| `logbook.read` | はい | はい | はい |
| `users.manage` | いいえ | いいえ | はい |

境界はどこでも同じです。operator はプラントを動かし(値の書き込み、アラームの確認、オートメーションの実行、リレーの軽い操作)、プラントの構成を変える、または Gateway に代わって外の世界に対して何かをする(リレーの再起動、構成の送信、テストページの送信、プラントのデータをどこかへメールで送るレポートの定義)のは admin だけです。

## エンドポイント索引

権限の列は、ルートが何を検査するかを示します。`session` は、それ以上の権限なしで、ログインしている任意のユーザーを意味します。`none` はセッションも不要という意味で、理由は該当セクションに書かれています。`(in handler)` は、検査がハンドラーの前ではなくハンドラーの中で行われるという意味で、理由は該当セクションに書かれています。

製品の列は、そのルートを持つ最小の HotLoop を示します。`all` は IoT、Edge、Gateway、`edge` は Edge と Gateway、`gateway` は Gateway だけです。すべての製品がすべてのルートを登録し、同じ権限を検査します。そのルートを持たない製品では 404 で応答し、どこにあるかを伝えます。[この製品にないもの](#この製品にないもの)を参照してください。

| メソッド | パス | 権限 | 製品 |
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
| すべて | `/mcp` | MCP トークン | all |
| すべて | `/mcp/` | MCP トークン | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| すべて | `/` | none | all |

## ヘルス

kubelet とロードバランサー向けです。どちらもセッションは不要です。プローブにはアカウントがなく、どちらもプラントについて何も語らないからです。

### `GET /healthz`

Liveness です。プロセスが HTTP を提供している間は、テキスト `ok` とともに `200` を返します。意図的にデータベースには触れません。データベースの障害は、ポッドをローテーションから外すべきであり、ループで再起動させるべきではないからです。

### `GET /readyz`

Readiness です。5 秒の猶予でデータベースに ping を送ります。

```json
{"status":"ready"}
```

データベースに届かないときは `503` を返し、理由は `detail` に入ります(形はハンドラー由来で、理由のテキストはデータベースドライバーが返した内容そのままです)。

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

ヒストリアンに届かないアプリケーションが、トラフィックを受けるべきではありません。

## 認証

アカウント、ロール、最初の管理者については[認証とユーザー](/ja/iot/authentication/)を参照してください。

### `POST /api/auth/login`

設計上、セッションは不要です。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `username` | string | 必須。大文字小文字と前後の空白は無視されます |
| `password` | string | 必須 |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

同じトークンを `iiot_session` Cookie にも設定します。名前が違っても、パスワードが違っても、アカウントが無効でも同じく `401` `"invalid username or password"` を返し、どの場合も同じ時間がかかります。三つのうちどれだったかは、見知らぬ人に教えることではないからです。アカウントで間違ったパスワードや PIN が続けて多すぎた場合は、何を送っても `Retry-After` ヘッダー付きで `429` を返します。[認証とユーザー](/ja/iot/authentication/#パスワードと-pin-を間違えたときのロックアウト)を参照してください。

### `POST /api/auth/kiosk`

[認証とユーザー](/ja/iot/authentication/#キオスクパネル-pin-またはバッジとアイドル時のサインアウト)の説明のとおり、共有パネルで PIN またはバッジを使ってサインインします。設計上、セッションは不要です。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `code` | string | 必須。PIN、またはキーボードウェッジ型のバッジリーダーが入力した値。前後の空白は無視されます |
| `username` | string | 任意。指定すると、そのアカウントの PIN だけが検査され、間違えるとそのアカウントのロックアウトに数えられます。指定しないと、全アカウントのコードの中から探します |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

`iiot_session` Cookie を設定し、`POST /api/auth/login` とは違ってトークンは返しません。キオスクのセッションはパネルのブラウザーのものだからです。`idleSec` は、誰も触れなくてもセッションが続く時間です。コードが間違っていても、短すぎても、無効なアカウントのコードでも同じく `401` `"that PIN or badge isn't recognized"` を返し、どの場合も同じ時間がかかります。アカウントがロックされているときは `Retry-After` ヘッダー付きで `429` を返します([ロックアウト](/ja/iot/authentication/#パスワードと-pin-を間違えたときのロックアウト)を参照)。`username` なしで送られ、誰にも一致しないコードは、どのアカウントにも数えられません。送ったパネルはクライアントアドレス単位で、次の同様の試行が検査されるまで 0.5 秒ずつ長く待たされ、最大 `ui.panelDelaySeconds` までで、正しいコードで最初からになります。パネル自体がロックされることはありません。デプロイがログインなしで動いている場合(`HOTLOOP_AUTH_INSECURE`)は、サインインする相手がいないので `400` を返します。

### `POST /api/auth/activity`

誰かがパネルに触れました。本文はありません。`{"status":"ok"}`。キオスクのセッションでは、これがアイドル上限を先へ延ばします。読み取り以外のほかのリクエスト(書き込み、確認)も同じです。`GET`、ライブフィード、ページ自身のバックグラウンド読み込みは延ばしません。延ばすと最後の人が永遠にサインインしたままになるからです。パスワードで作ったセッションにはアイドル上限がなく、延ばすものもありません。

### `POST /api/auth/logout`

リクエストが持ってきたセッション(Cookie またはベアラー)を終了し、Cookie を消します。本文はありません。`{"status":"logged out"}`。

### `GET /api/auth/session`

自分が誰かを返します。UI の起動手順で使います。

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

キオスクパネルで作ったセッションには、秒単位のアイドル上限 `"idleSec"` が追加され、ページはこれで自分でサインアウトすることを知ります。

認証をオフにしている場合(`HOTLOOP_AUTH_INSECURE`)は、401 の代わりに `{"authenticated":false,"insecure":true}` を返すので、UI は推測せずにログインがない理由を表示できます。

### `POST /api/auth/password`

自分のパスワードを変更します。権限は不要です。現在のパスワードを知っていることが資格になります。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `currentPassword` | string | 必須 |
| `newPassword` | string | 必須、8 文字以上 |

`{"status":"password changed; log in again"}`。**このセッションを含め、アカウントのすべてのセッションが終了し**、Cookie が消されます。古いセッションが動き続けるパスワード変更は、名前だけの変更です。現在のパスワードが違うと `401`、新しいパスワードが短すぎると `400` です。

## ユーザー

すべて管理者専用です(`users.manage`)。パスワードのハッシュはレスポンスに現れず、そのフィールドには JSON 名がありません。

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` は、明示的なリストを持つアカウントにだけ現れます。`hasPin` は、アカウントにキオスクの PIN またはバッジがあるかを示します。値とそのハッシュは現れません。

### `POST /api/users`

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `username` | string | 必須。小文字、数字、ドット、アンダースコア、ハイフン。文字または数字で始まり、2 文字から 64 文字 |
| `password` | string | 必須、8 文字以上 |
| `role` | string | `admin`、`operator`、`viewer` のいずれか。既定は `viewer` |
| `permissions` | string[] | 任意。ロールの権限セットを完全に置き換えます |

新しいユーザーを返します。名前、ロール、パスワードが不正なら `400`、名前がすでに使われていれば `409` です。

### `PUT /api/users/{username}`

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `role` | string | `permissions` を指定しない場合は必須 |
| `permissions` | string[] | 任意。空は「ロールを使う」という意味です |
| `disabled` | bool | `true` はアカウントを無効にし、そのアカウントのすべてのセッションを終了します |

更新されたユーザーを返します。未知のロール、または有効な最後の管理者を無効にしようとすると `400` です。元に戻せる人が誰もいなくなるロックアウトになるからです。未知のユーザーは `404` です。

### `DELETE /api/users/{username}`

`{"status":"deleted"}`。自分のアカウントや有効な最後の管理者は `400`、未知のユーザーは `404` です。

### `POST /api/users/{username}/password`

管理者が、古いパスワードを知らなくても他の人のパスワードを設定します。`{"password": "..."}`、8 文字以上。`{"status":"password reset"}` を返し、そのアカウントのすべてのセッションを終了します。

### `PUT /api/users/{username}/pin`

管理者が、アカウントにキオスクパネルへのサインイン用の PIN またはバッジの値を設定し、すでにある値は置き換えます。`{"code": "482913"}`: 6 文字から 72 文字、空白や制御文字は不可、数字やバッジリーダーが入力するそのほかの文字が使えます。`{"status":"PIN set","username":"olga","hasPin":true}` を返します。値はパスワードと同じく bcrypt でハッシュ化され、ログに残ることも返されることもありません。短すぎる、長すぎる、空白を含むコードや、別のアカウントがすでに持っているコードは `400` です。パネルはコードだけでアカウントを見つけるので、1 つのコードで開くアカウントは 1 つです。未知のユーザーは `404` です。パスワードやセッションには触れません。

### `DELETE /api/users/{username}/lockout`

ロックされたアカウントを、ロックが切れる前に再び入れるようにし、間違ったパスワードと PIN の回数を 0 から数え直します。`{"status":"unlocked","username":"olga","locked":false}`。未知のユーザーは `404` です。ロックされたアカウントは `GET /api/users` で `"locked":true` と `"lockedUntil"` を示します。

### `DELETE /api/users/{username}/pin`

PIN またはバッジを取り上げ、そのアカウントがサインインしているすべてのキオスクパネルからサインアウトさせます。パスワードと、自分のコンピューターでのセッションには触れません。`{"status":"PIN cleared","username":"olga","hasPin":false}`。未知のユーザーは `404` です。

### `GET /api/opcua/certificates`

OPC UA サーバーへのサインイン用にユーザーに紐づけられたすべての X.509 証明書を、新しい順に返します([OPC UA サーバー](/ja/edge/opc-ua-server/#x509-ユーザー証明書)を参照)。`{"serverAcceptsCertificates":false,"certificates":[...]}`。各証明書には、`thumbprint`(DER 形式の SHA-256、小文字の 16 進)、`username`、`label`、`subject`、`notBefore`、`notAfter`、`addedBy`、`addedAt`、失効後は `revokedAt` と `revokedBy`、使用後は `lastUsed`、そして `state`(`active`、`revoked`、`expired`、`not yet valid`)があります。サインインできるのは有効な証明書だけです。`serverAcceptsCertificates` は、OPC UA サーバーがオンで `HOTLOOP_OPCUA_SERVER_ALLOW_X509` が設定されているかを示し、証明書はどちらの場合も保持されます。保存も送信もされるのは公開証明書だけです。

### `GET /api/users/{username}/certificates`

1 人のユーザーについての同じ一覧です。未知のユーザーは `404` です。

### `POST /api/users/{username}/certificates`

ユーザーに証明書を紐づけます。`{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`。ラベルは任意です。一覧に出る形の証明書とともに `201` を返します。証明書は 2048 ビット以上の鍵を持つ RSA で、期限切れでないことが必要です。`400` はそのどれに当たるかを伝え、証明書でないものにも使われます。秘密鍵は名指しで拒否され、保持も返却もされません。チェーンも同じです。未知のユーザーは `404` です。証明書がこのユーザーか別のユーザーにすでに紐づいている場合は `409` です。証明書 1 つは 1 人に対応します。変更は、誰が行ったかとともに業務日誌に残ります。

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

証明書を失効させます。もうサインインできず、その証明書で開いたセッションは権限キャッシュの 10 秒以内に終了し、以後の試行は拒否されて失効として記録されます。誰がいつ行ったかとともに `revoked` として一覧に残り、再度失効させても最初の記録が維持されます。`{thumbprint}` は一覧に出る SHA-256 で、コロン、空白、大文字も受け付けます。証明書がこのユーザーのものでなければ `404` です。

### `DELETE /api/users/{username}/certificates/{thumbprint}`

証明書を忘れさせます。再び紐づければ再び使えます。このユーザーのものでなければ `404` です。ユーザーを削除すると、その証明書も削除されます。

## ステータスと診断

### `GET /api/status`

ヘッダーバーの内容です。ランタイムのカウンター、アラームの概要、プラントの名前、そしてこれがどの製品かを返します。`product` は `iot`、`edge`、`gateway` のいずれかで、`hotloop --product` と同じです。`features` は、製品ごとに異なる機能のうちこの製品が持つものです。Gateway は `edge-publish`、`fleet`、`opcua-server`、`reports`、`sites`、Edge は 1 つ目と 3 つ目、IoT はなしです。`version` はビルドで、`imageDigest` は起動元イメージのダイジェストです。`:stable` を追う箱では、バージョン番号からは分からない情報です。スーパーバイザーが伝えたときだけ存在し(Quadlet ユニットは起動のたびに伝えますが、バイナリ単体や Helm インストールは伝えられません)、そうでなければ省かれます。

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

Gateway が知っているすべてのプロトコルと、このビルドにそのドライバーがあるかを返します。

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

診断画面が表示する内容です。データベースプール、ヒストリアンのキューと履歴サイズ、タグバス、エンティティエンジン、業務日誌の記録機能、ランタイム、MCP(サーバーと送信接続)、そしてオートメーションエンジンの有効なルール、Webhook のパス、状態変化のキューです。

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

送信側の MCP サーバーが設定されている場合、`outbound` がそれぞれを一覧にします。

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

送信側サーバーの `target` や `lastError` にある認証情報はすべて消去されます。URL やコマンドラインがトークンを含むことがあり、どのロールもこれを読めるからです。MCP トークン自体は常に `tokenSet` だけです。

## デバイス

デバイスは、1 つのプロトコルによる 1 つの接続です。`config` と `address` に入る内容はプロトコルによって異なります。[プロトコルとドライバー](/ja/iot/protocols/)を参照してください。

### `GET /api/devices`

すべてのデバイスを、ライブの接続状態とともに返します。認証情報は `[redacted]` です。`?q=` は、id、名前、アドレス、プロトコルにそのテキストを含むデバイスに絞り込み(大文字小文字は区別しません)、`?limit=`(1 から 5000、それ以外は `400`)はその先頭のいくつかに絞ります。どちらを使っても、`X-Total-Count` が一致した件数を示します。

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` は `connected`、`connecting`、`degraded`(接続は上がっているがポーリングが失敗)、`disconnected`、`disabled` のいずれかです。`lastError`、`errorCount` などは、伝えることがあるときに現れます。

### `POST /api/devices`

`id` が新しければデバイスを作成し、そうでなければ置き換えます。`PUT` はありません。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `id` | string | 必須。英字、数字、`.`、`_`、`-` の 1 文字から 64 文字で、英数字で始まります。URL、MQTT トピック、MCP の引数にそのまま使われます |
| `name` | string | 必須 |
| `protocol` | string | 必須。このビルドにドライバーがあるもの(`GET /api/protocols`) |
| `address` | string | 必須。ホストとポート、または `opc.tcp://` や `http://` の URL です。プロトコルが決めます |
| `enabled` | bool | 省略すると `false` です |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 はランタイムの既定値を使います。ポーリング間隔の下限は `HOTLOOP_MIN_POLL_INTERVAL` です |
| `site`, `area`, `line` | string | 名前でデバイスを設備ツリーに配置し、必要に応じてノードを作成します |
| `equipmentId` | int | 代わりにツリーのノードに配置します。その場合、`site`、`area`、`line` はノードから決まります。[設備ツリーとラベル](/ja/iot/equipment/)を参照してください |
| `config` | object | プロトコル固有のオプションです。認証情報は[書き込み専用の規則](#シークレットは書き込み専用)に従います |

ランタイムのフィールド(`state`、`lastPoll`、`tagCount` など)は読み取り専用で、送り返しても無視されます。保存されたデバイスを、秘匿した状態で返します。ドライバーのないプロトコル、検証の失敗、認証情報の規則違反は `400` です。ランタイムはただちにそのデバイスで再読み込みされます。

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

デバイスと、そのタグ、ラベルを返します。

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

タグのないデバイスでは `tags` が `[]` になります。未知の id は `404` です。

### `DELETE /api/devices/{id}`

デバイスと、そのタグ、タグのエンティティを削除します。**履歴は残ります。** `{"deleted":"tank-farm"}`、または `404`。

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` は、何も削除せずにポーリングを止めます。`{"enabled":false,"id":"tank-farm"}` を返します。未知の id は `404` です。

### `POST /api/devices/{id}/browse`

デバイスにどんなポイントがあるかを尋ねます。読み取りだけなので必要なのは `devices.read` だけです。本文はありません。

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

ポイントを列挙できないプロトコル(Modbus、S7comm、HTTP)は、`200` と `{"supported":false,"reason":"..."}` で応答します。これはプロトコルについての事実であり、エラーではありません。デバイスが接続されていなければ `503` です。ここでの `writable` は、そのポイントについてデバイスが言っていることであり、Gateway が書き込むかどうかではありません。

### `POST /api/devices/{id}/import`

ブラウズの結果を設定済みのタグにします。タグを作成するので `tags.write` が必要です。

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

各エントリは `name`、`address`、`dataType`、`unit`、`description`、`deviceClass`、`writable`(ブラウズの結果そのまま)を受け取ります。`{"inserted":2,"updated":0}` を返します。**インポートされたタグは、デバイスが何と言おうと、すべて読み取り専用です。** 見つかったポイントは、誰かがコマンドしてよいと決めたポイントではなく、既定を逆にすると数千個が一度に有効化されてしまうからです。必要なものだけを `POST /api/tags` で有効化してください。未知のデバイスは `404` です。

## UniFi: OT ネットワーク、クライアント、デバイスがネットワークのどこにあるか

UniFi サイトについての HotLoop 自身の記録です。[UniFi Network](/ja/iot/unifi/)を参照してください。`/api/unifi` 配下の `{id}` は UniFi デバイス(1 つのコンソールの 1 つのサイト)です。`{network}` は、`GET .../networks` が返す、コンソール自身がネットワークに付けた ID です。`{mac}` は一般的な表記をどれでも受け付け、小文字とコロンで保持されます。

**これらはどれもコンソールに何も尋ねません。** ドライバーがコンソールから最後に読み取った内容を読むので、画面を開いたままにしてもコンソールには負荷がかかりません。そのため、デバイスを一度読み取るまでは `503` で応答し、コンソールにログインしない `--mcp-stdio` ヘルパーでは常にそうなります。これらがコンソールに書き込むこともありません。

アラームを作成または削除する変更は、`change` でそのことを示します。`{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`。これらは `/api/alarms` 配下の通常のアラーム定義です。

### `GET /api/devices/{id}/network`

HotLoop のデバイス(PLC、メーター)がネットワークのどこにあるかを返します。リンク済みの場合:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

リンクされていない場合、`link` は `null` で、`proposals` は HotLoop が読むいずれかのコンソールがそのデバイスの IP に持つクライアントを新しい順に並べます。提案は提案にすぎません。コンソールの IP は遅れるので、管理者が 1 つを確認するまで何もリンクされません。

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` は、そのデバイスがどのクライアントかを確定します。以後は MAC がキーになり、IP は二度と信頼されません。クライアントにはタグ(コンソール上の `c.<mac>.*`)とアラーム「PLC-07 のネットワーク離脱」が付き、優先度 1、オンディレイ 120 秒なので、再起動で誰かが呼び出されることはありません。`{"link":{...},"change":{...}}` を返します。`consoleId` が UniFi デバイスでない、または MAC が MAC でない場合は `400`、未知のデバイスは `404` です。

### `DELETE /api/devices/{id}/network`

リンクと、そのために HotLoop が作成したアラームを削除します。ただし、クライアントがまだ既知リストから監視されている場合、アラームは残ります。リンクがなければ `404` です。

### `GET /api/unifi/{id}/networks`

コンソールが持つサイトのネットワークを、HotLoop の記録とともに返します。`ot`、`known`(リストにあるデバイス数)、`clients`(現在そこにいる数)、`unknown`(現在いてリストにない数)です。HotLoop に記録があり、コンソールにはもうないネットワークは `"onConsole":false` で戻ります。

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` はネットワークを OT として印付けます。そこにいて既知リストにないものはすべて `n.<network>.unknown` に数えられ、`.unknown_last` で名乗り、HotLoop は優先度 1 のアラーム「SCADA 上の未知のデバイス」を作成します。`{"ot": false}` は印を外してそのアラームを削除し、既知リストは保持されます。WAN またはコンソールにないネットワークは `400` です。

### `POST /api/unifi/{id}/networks/{network}/accept-all`

いまネットワーク上にあるものをすべて、そのまま受け入れます。印を付けたあとの 1 クリックです。すでにリストにあるデバイスは名前と監視設定を維持します。本文はありません。追加したデバイスである `{"accepted":[{known device}...]}` を返します。

### `GET /api/unifi/{id}/known`

サイトのネットワーク上のすべての既知デバイスです。`[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`。

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` は、デバイスをネットワークに受け入れる、または名前や監視設定を変更します。`watch` はデバイスにタグとオフラインアラームを与えます。許可されてはいるが出入りするデバイス(保守用ノート PC)は、これを付けずに受け入れます。ネットワークを OT として印付けたことがなければ `400` です。

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

デバイスをリストから外します。ネットワーク上にあれば、次の読み取りで再び未知になります。

### `GET /api/unifi/{id}/clients`

コンソールが一覧にするすべてのクライアントと、コンソールは一覧にしないが監視されているすべてのクライアントを返し、それぞれに所在、オンラインかどうか、`ot`、`known`、`watched`、`linkedTo`、1 行の `summary` を付けます。`?q=` で MAC、IP、名前に絞り込めます。

### `GET /api/unifi/consoles`

UniFi 画面の選択用に、HotLoop が持つすべての UniFi デバイスを、稼働中かどうかを問わず返します。`[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`。このプロセスが読み取っていないコンソールは、`why` で理由を示します。

### `GET /api/unifi/{id}/overview`

概要カードです。デバイスとクライアントの数(クライアントは、コンソールが一覧にするときではなく、HotLoop がネットワーク上にいると判断したときに数えられ、`n.<id>.clients` タグが使う基準です)、ネットワークごとのクライアント、コンソールのサブシステムの `health`、そして各ゲートウェイの WAN 帯である `gateways[]` を含みます。これは WAN ごとの `wans[]` エントリ 1 つで、`alive`(ゲートウェイ自身のヘルスチェックであり、WAN ブロックの `up` ではない)、`known`、`active`、`backup`、遅延、可用性を持ちます。`failover` は最初でない WAN にトラフィックがある状態、`down` は生きている WAN がない状態で、`since` は HotLoop が現在の WAN でトラフィックを初めて見た読み取りの時点です。これはゲートウェイが切り替えた時ではなく、HotLoop が気づいた時です。`events` はイベント WebSocket の状態(`live`、`error`、`reconnects`)と最新の 10 件のイベントです。

### `GET /api/unifi/{id}/topology`

マップです。`nodes[]` は採用済みのデバイスとグリッド上の位置(`x`、`y`、`layer`: ゲートウェイから左から右へ、同じ読み取りなら同じ配置)、`edges[]` はコンソール自身の `downlink_table` から得たデバイス間のケーブル、`wired[]` と `wifi[]` は各スイッチポートと各 AP、SSID にぶら下がるクライアントです。どこにも接続されていると一覧にないデバイスは、推測でゲートウェイにぶら下げず、`noUplink` を設定して単独で描かれます。HotLoop が読む別の UniFi コンソールのデバイスをこのコンソールがクライアントとして一覧にしている場合は、`external` を設定したノードと `stitched` を持つエッジとして継ぎ足されます。`feeds` はデバイス MAC ごとに、その下流のクライアントにリンクされた HotLoop デバイスと、プラントツリー用の `equipmentId` で、`links` は同じデバイスをクライアント MAC ごとに示します。

### `GET /api/unifi/{id}/devices`

採用済みのすべてのデバイスを、数値と前面パネル用の `ports[]` とともに返します。リンク、速度、PoE のモードと使用量、ポートで学習したクライアント、そこに接続されたデバイス、そして以前の読み取りでは上がっていたが今は下がっているポートの `dropped` を含みます。コンソールが見失ったデバイスは、最後に報告した内容が現在のものではないため、数値もポートのリンクも報告しません。

### `GET /api/unifi/{id}/wifi`

サイトの SSID を、`enabled`、属するネットワーク、それぞれのクライアント数とともに返します。コンソールがこのアカウントに無線ネットワークを見せない場合は、`error` が理由を示し、`wlans` は空です。

### `GET /api/unifi/{id}/events`

HotLoop が接続してからコンソールが報告した最新のイベントを新しい順に(`?limit=` は最大 200、既定は 50)、そしてイベント WebSocket の状態を返します。各イベントには、コントローラーの `key`(`EVT_SW_Lost_Contact`)、独自の `message`、`severity`(コントローラーが問題発生として印付けた場合は `warning`)、そして関係するデバイス、クライアント、ポートがあります。これらは業務日誌にも、関係するスイッチやアクセスポイントの下に分類されて残ります([UniFi Network](/ja/iot/unifi/#イベント)を参照)。

### `POST /api/unifi/{id}/starter-alarms`

コンソールがいま持つ情報から、サイトの定番アラームを `/api/alarms` 配下の通常のアラーム定義として作成します。オフラインのすべての採用済みデバイス(優先度 2、オンディレイ 60 秒)、ダウンしているすべてのアップリンクポート(優先度 1、10 秒)、2 つ以上の WAN を持ちながらバックアップ側で動いているゲートウェイ(優先度 2、30 秒)です。本文は任意です。`{"poeLimitW": 25}` は、すべての PoE ポートの `poe_w` 使用量がそのワット数を超えた場合の優先度 3 のアラームを、オンディレイ 30 秒で追加します。コンソールはポートの電力予算を教えないので、HotLoop は推測しません。負の上限は `400` です。

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` は、このセットが求めるアラームのうち、すでにあったものです。以前に押したときの自分のもの、または同じタグに対する誰かのアラームです。そのため、機器を追加で採用したあとに再び押しても安全で、新しい機器の分だけが追加されます。OT ネットワークのアラームとネットワーク離脱のアラームは含まれません。これらは、ネットワークを OT として印付け、デバイスを監視するときに付いてきます。コンソールを一度読み取るまでは `503` です。

## MQTT ディスカバリー

MQTT で自分を知らせたデバイスと、それぞれについて人が決めたことです。[MQTT ディスカバリー](/ja/iot/mqtt-discovery/)を参照してください。ディスカバリーは、組み込みブローカーが動いていればそこで、そして `/api/mqtt/brokers` 配下に設定されたすべてのブローカーで待ち受けます。どちらもなければ `sources` は空です。待ち受けをしない `--mcp-stdio` ヘルパーでは、`GET /api/discovery` は `{"running":false,"sources":[],"devices":[]}` で応答し、ほかのすべてのルートは `503` です。

`{source}` は、デバイスが告知したブローカーです(HotLoop 自身のものは `embedded`、それ以外はブローカーの id)。`{key}` は告知をひとつにまとめるもので、最初の識別子、`mac:aa:bb:cc:dd:ee:ff` 形式の MAC、またはノード id です。URL エンコードしてください。識別子にはパスで使えない文字が含まれます。

**これらはどれも何も有効化しません。** デバイスを受け入れると、そのポイントは、ほかのポイントと同様に `POST /api/tags` で 1 つずつ有効化できるようになります。

### `GET /api/discovery`

すべてのソースと、各ソースが見たもの・拒否したもの、そして発見されたすべてのデバイスを返します。

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

`external` が true のソースは、`/api/mqtt/brokers` 配下に設定されたブローカーで、`broker` がその場所を示します。`autoCreate` が false のソースのデバイスは受信トレイで待機します。`deviceId` なしで `discovered` として一覧され、誰かが 1 つを受け入れるまで何も作られず、何も読み取られません。`listenOnly` は、HotLoop が決してパブリッシュしないブローカーです。`lastError` は、ソースが接続されていない理由を示し、開けないパスワードもこれに含まれます。

`status` は `discovered`、`accepted`、`ignored` のいずれかです。コンポーネントごとに、`unsupported` は HotLoop が使えないものとその理由(「value template not supported: filter `regex_findall_index` is not supported at column 12」)、`unknownKeys` はフォーマットが定義していない設定キー、`commandTopics` はそのコマンドの送り先になりうるすべてのトピック(ファンの速度トピックと主トピック)、`flags` は受け入れる前に人が確認すべきことを示します。コンポーネントが読むトピックの外にあるコマンドトピック、ディスカバリープレフィックスの内側にあるもの、ほかのデバイスが要求しているもの、そして retained コマンドを求める設定です。`withdrawnAt` は、パブリッシャーが取り下げたコンポーネントに設定されます。`suggestedEquipmentId` は、ちょうど 1 つのノードがその名前を持つ場合に、デバイスの `suggested_area` が指すツリーのノードで、受け入れダイアログを事前入力するだけです。組み込みブローカーでは、`announcedBy` と `announcedVia` が最新の設定をパブリッシュしたブローカーのログインとクライアント id で、`acceptedLogin` が受け入れられたときのログインです。告知が変わった、または別のログインが告知した受け入れ済みのデバイスには `review` があります。

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

同じ形でデバイス 1 つを返します。HotLoop が見ていないものは `404` です。

### `POST /api/discovery/{source}/{key}/accept`

デバイスを受け入れます。任意の本文 `{"equipmentId": 12}` で、同じ手順でツリーに配置します。何も有効化しません。デバイスを返します。無視されているものは `400` です。

### `POST /api/discovery/{source}/{key}/ignore`

デバイスを破棄します。HotLoop のデバイス、タグ、エンティティが消え(履歴は残ります)、再び告知しても無視されたままです。デバイスを返します。発見されたデバイスへの `DELETE /api/devices/{id}` も同じことをします。告知し続けるデバイスは、そのままでは戻ってくるだけだからです。

### `POST /api/discovery/{source}/{key}/unignore`

無視されたデバイスを、最後に告知された内容から発見済みに戻します。無視されていなければ `400` です。

### `POST /api/discovery/{source}/{key}/review/apply`

受け入れ済みのデバイスに、告知した内容で動作させます。各ポイントが有効化されているかどうかは、そのままです。レビュー待ちがなければ `400` です。

### `POST /api/discovery/{source}/{key}/review/reject`

受け入れ済みの設定を動かし続け、この変更を提示しなくなります。のちの別の変更は再び提示されます。待ちがなければ `400` です。

レビューは、誰が告知したかに関するものでもあります。`"kind":"publisher"` の変更と、概要の行「announced by login garage-node; accepted from kitchen-node」がその例です。これを適用すると、そのログインがデバイスを受け入れた元のログインになります。

## ブローカーのログイン

HotLoop で作成した組み込みブローカーのログインで、それぞれにパブリッシュとサブスクライブを許可するトピックがあります。[組み込み MQTT ブローカー](/ja/iot/broker/)を参照してください。ログインはプラント全体のブローカーへの鍵なので、これらは管理者の `users.manage` です。ここでパスワードやそのハッシュを返すことは決してありません。変更はすべてログに残り、クライアントの次のパブリッシュから有効になります。再接続は不要です。

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

このプロセスがブローカーを動かしていない場合、`running` は false です。ログインはそれでも保持され、ブローカーは起動時にそれを読み取ります。`envLogins` は `HOTLOOP_BROKER_USERS` の名前で、何でもできます。ルール内の `%u` はログイン自身の名前、`%p` はディスカバリープレフィックスで、`resolved*` は両方を埋めたルールです。

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` は英字、数字、`-`、`_` の 1 文字から 64 文字です(トピック内の `%u` を表します)。`password` は 12 文字以上です。`profile` がルールを埋め、`publish` と `subscribe` を指定すると置き換えます。どちらか一方が必要です。ルールは MQTT のトピックフィルターです。`+` と `#` はレベル全体としてのみ、`#` は末尾のみ、`$` トピックは不可です。ログインとともに `201` を返します。上記のいずれか、または `HOTLOOP_BROKER_USERS` にすでにある名前は `400`、使用済みの名前は `409` です。

### `PUT /api/broker/logins/{name}`

`profile`、`publish`、`subscribe`、`password` のいずれでも送れ、送らなかったものはそのままです。ログインとともに `200`、存在しないものは `404` です。

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`。そのログインでまだ接続しているクライアントは、以後何もできず、再接続もできません。存在しないものは `404` です。

## ネットワークディスカバリー

mDNS、SSDP、DHCP でプラントのネットワーク上に聞こえたデバイスと、それぞれについて人が決めたことです。[ネットワークディスカバリー](/ja/iot/network-discovery/)を参照してください。待ち受けをしない `--mcp-stdio` ヘルパーでは、`GET /api/network-discovery` は `{"running":false,"finds":[]}` で応答し、ほかのすべてのルートは `503` です。

`{key}` は、発見がどのように、誰によって聞こえたかを示します。`mdns:` と mDNS ホスト名、`ssdp:` と UPnP uuid、`dhcp:` と MAC です。URL エンコードしてください。

**これらはどれも何も有効化せず**、誰かが受け入れるまでここでは何も追加されません。

### `GET /api/network-discovery`

リスナー、プロービング、それらが使うインターフェース、そしてすべての発見を返します。

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

`kind` は `esphome`、`shelly`、`opcua`、`mqtt-broker`、`web`、`mdns`(HotLoop が名前を知らない何かを告知した)、`upnp`、`dhcp` のいずれかです。`proposal` に `protocol` がある発見は、受け入れると `address` にあるそのプロトコルのデバイスになり、ない発見は、何があれば取り込めるかを `how` で示します。`also` は、同じ機器である他の発見と MQTT で発見されたデバイスを、MAC またはアドレスで示します。`status` は `discovered`、`accepted`、`ignored` のいずれかで、`deviceId` は受け入れで作られたデバイスです。リスナーの `error` は、待ち受けていない理由を示します(ポート 67 が使用中または許可されていない、マルチキャスト対応インターフェースがない)。`refused` は、記録が満杯のために捨てられた新しい発見の数です。

### `GET /api/network-discovery/{key}`

同じ形で発見 1 件を返します。HotLoop が聞いていないものは `404` です。

### `POST /api/network-discovery/{key}/accept`

発見を受け入れます。任意の本文 `{"equipmentId": 12}` で、作られたデバイスをツリーに配置します。HotLoop にドライバーがある発見は、提案されたアドレスのデバイスになり、有効化され、タグはなく、何も有効化されない状態です。それ以外は既知として記録されるだけで、何も作りません。発見を返します。すでに受け入れ済みまたは無視されたものは `400` です。

### `POST /api/network-discovery/{key}/ignore`

誰もまだ決めていない発見を隠し、再び聞こえても隠したままにします。すでに決まったものは `400` です。

### `POST /api/network-discovery/{key}/unignore`

無視された発見を、判断待ちに戻します。無視されていなければ `400` です。

### `POST /api/network-discovery/probe`

いまプローブします。`HOTLOOP_NETDISC_PROBE_NETWORKS` に挙げられたネットワークのすべてのインターフェースで mDNS クエリと SSDP 検索を行い、ほかでは行いません。`{"status": ...}` を返し、送られなかったものは `status.probe.lastError` に出ます。プロービングがオンのネットワークがなければ `400` です。このボタンではオンにできず、デプロイだけができます。

## インテグレーション

人が HotLoop を向ける種類のデバイスのための設定フローです。インテグレーションが必要とするものを尋ね、答えで実際のデバイスを調べ、見つかった内容からデバイスとそのタグを作ります。[インテグレーション](/ja/iot/integrations/)を参照してください。

**ここでは何も有効化しません。** セットアップが作るタグはすべて読み取り専用です。有効化は、ほかのポイントと同様に `POST /api/tags` です。

### `GET /api/integrations`

このビルドにあるすべてのインテグレーションと、それぞれが尋ねる質問を返します。

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` は `text`、`number`、`bool`、`choice`、`secret` のいずれかです。`showWhen`(`{"version":["3"]}`)のあるフィールドは、別の答えがそれらの値のいずれかのときだけ尋ねられ、表示されていない質問への答えは無視されます。

### `POST /api/integrations/{id}/probe`

答えを確認し、実際のデバイスを調べに行きます。何も保存しません。

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

`{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}` を返します。`address` はインテグレーションが解決したアドレスです。`found` には `name`(デバイスが自称する名前)、`identity`(デバイスが自分だと言っているもの)、`notes`(受け入れる前に知っておくこと)、`points` があり、各ポイントはタグの形 `{name, address, dataType, unit, description, writable, deviceClass}` に、`group`、`sample`(見つけたときに読んだ値)、`suggested` が加わったものです。

質問に合わない答えは、すべての問題をまとめて `400` です。インテグレーションが尋ねない質問への答えも、無視されずに `400` です。デバイスが応答しなかった、または自分のプロトコルでないもので応答した場合は、何が悪かったかとともに `502` です。このビルドにないインテグレーションは `404` です。シークレットが答えやエラーに含まれることは決してありません。

### `POST /api/integrations/{id}/setup`

デバイスをもう一度調べ、デバイスとそのタグを作成します。本文は probe のものに、次を加えたものです。

| フィールド | 意味 |
|---|---|
| `deviceId` | 新しいデバイスの id。空欄なら名前から作ります。すでにあるデバイスの id なら `400` です |
| `name` | デバイスの名前。空欄ならデバイスが自称する名前を使います |
| `points` | セットアップする `found.points` の名前。空欄なら `suggested` と印のあるものを使います。デバイスにない名前は `400` です |
| `site`, `area`, `line` | `POST /api/devices` と同様に、設備ツリーのどこに置くか |

ポイントは、クライアントが 1 分前に見つけたと言う内容ではなく、いまのデバイスの状態と照合されます。`{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}` を返します。デバイスは有効化されてポーリング中で、すべてのタグは読み取り専用、各タグには読み取りエンティティがあります。途中で失敗したセットアップは、デバイスを残しません。

## MQTT ブローカー

HotLoop 自身のもの以外で、ディスカバリーが待ち受けるブローカーです。プラントの Mosquitto や、Zigbee2MQTT の機器が持ち込んだブローカーなどです。[MQTT ディスカバリー](/ja/iot/mqtt-discovery/#他のブローカー)を参照してください。パスワードはデバイス認証情報キー(`HOTLOOP_SECRET_KEY_FILE`)で封印され、返されることはありません。`passwordSet` は保存済みのものがあるか、`passwordProblem` は保存済みのものが開けない理由を示します。変更はすべてログに残り、すぐに有効になります。そのブローカーのリスナーとデバイスが再接続します。

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` は、この HotLoop にパスワードを封印する鍵があるかどうかです。

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` は小文字、数字、`-` の 1 文字から 63 文字で、`embedded` は不可です。このブローカー由来のすべてのデバイスでブローカーの名前になり、変更できません。`broker` は `host:port`、または `tcp://`、`ssl://`、`tls://`、`mqtt://`、`mqtts://` の URL で、ログインは含めません。`prefix` の既定は `homeassistant`、`autoCreate` は false(デバイスは受信トレイで待機)、`listenOnly` は false、`tasmota`(Tasmota 自身のディスカバリー `tasmota/discovery/#` も聞く)は true、`shelly`(Shelly Gen2 以降のデバイスが発行する `<prefix>/status/<component>` トピックから学習)は true、`enabled` は true です。パスワードにはユーザー名とキーが必要です。`HOTLOOP_SECRET_KEY_FILE` がなければ `400` で、平文では決して保存されません。ブローカーとともに `201`、使用済みの id は `409` です。

### `PUT /api/mqtt/brokers/{id}`

`id` 以外の上記のフィールドのいずれでも送れ、送らなかったものはそのままです。`"password":""` はパスワードを消去します。ブローカーとともに `200` です。

### `DELETE /api/mqtt/brokers/{id}`

ブローカーと、それが告知して誰も受け入れなかったもの(受信トレイと、ブローカーが自分で作ったデバイス)を削除します。そのブローカーから受け入れたデバイスがまだ存在する間は、それらを挙げて `409` です。先にそれらを無視または削除するか、代わりに `"enabled":false` でブローカーをオフにしてください。`200` `{"deleted":"plant-uns"}`。

## タグ

### `GET /api/tags`

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `device` | このデバイスのタグだけです。`limit` がなければすべてを返します |
| `q` | 検索です。デバイス id、タグ名、説明に大文字小文字を区別せずに含まれる部分文字列です。`device` と併用できます |
| `limit` | 1 から 5000 の整数です。`device` がなければ既定は 500 です。5001 を含むそれ以外は `400` で、拒否され、少なく返されることはありません(4.19.5 までは 1000 を超える上限が黙って 200 になっていました) |
| `writable` | `true` で、書き込み可能と印付けられたタグだけです(書き込みの選択肢が提示するもの) |
| `offset` | ページの開始位置で、0 以上です。タグはデバイス、次に名前の順に並びます |

レスポンスの `X-Total-Count` ヘッダーは、一致するタグの総数を示すので、クライアントは `offset` でページをめくり、すべて取得したことを確認できます。空のレスポンスは `[]` です。

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

`deviceId` と `name` が新しければタグを作成し、そうでなければ置き換えます。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `deviceId` | string | 必須。デバイスが存在する必要があります(存在しなければ `404`) |
| `name` | string | 必須。制御文字は不可です |
| `address` | string | 必須。プロトコル固有のアドレスです |
| `dataType` | string | `bool`、`int`、`float`、`string`(および一般的な別名 `int16`、`word`、`coil` など)です。書き込みのエンコード方法を決めます |
| `unit`, `description` | string | |
| `enabled` | bool | 省略すると `false` です |
| `writable` | bool | **UI、オートメーション、エンティティ、MCP のすべての経路から、このタグを書き込み用に有効化します。** 省略すると `false` です |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | `hasRange` があると、範囲外の書き込みは拒否されます(切り詰められることはありません) |
| `scale`, `offset` | number | 工学値 = 生値 x スケール + オフセット。スケール 0 は 1 として扱われます |
| `noData` | list | 「測定なし」を意味する生値のリストで、各要素は `{"raw", "reason"}` です。`raw` は文字列(`"0x8005"`、`"-32763"`)または数値そのままで、文字列として返ります。生値がリストにある読み取り値は、その `reason` 付きで品質不良になり、`scale` と `offset` より先に確認されます。コードは最大 32 個です。整数でない、2 回挙げられている、またはポイントの型になりえないコードは `400` です。型ごとに何を書くかと Yokogawa DX の例は[プロトコルとドライバー](/ja/iot/protocols/#no-data-values)を参照してください |
| `deadband`, `deadbandPercent` | number | これより小さい変化は履歴に書き込まれません |
| `deviceClass` | string | タグのエンティティが最初に持つクラス(`power`、`connectivity`、`temperature` など)で、そのドメインで意味があるときに使います。タグの作成時に取り込まれ、置き換え時は無視されます。以後はエンティティがクラスを持つので、そちらで変更してください |

保存されたタグを返します。`writable: true` で保存すると、そのとおりにログに残ります。タグを有効化するのは安全に関わる判断なので、名前が付きます。タグのエンティティはレスポンスの前に作成または更新されるので、クライアントはすぐに要求できます。

誰も受け入れていない発見済みデバイスのタグは、有効化できません。`400`、「accept the device first」です。[MQTT ディスカバリー](/ja/iot/mqtt-discovery/#コマンド)を参照してください。

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`、または `404`。履歴は残ります。タグのエンティティは孤立します([エンティティ](/ja/iot/entities/#deleted-tags-orphans-and-re-adoption)を参照)。

## 値、ボード、書き込み

### `GET /api/values`

すべてのタグの最新の読み取り値を、メモリから返します。`?device=` で 1 台のデバイスに絞り込めます。

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

この形は EmberNet ダッシュボードの `TagValue` であり、契約です。`quality` は `good`、`uncertain`、`bad` のいずれかです。**不良の読み取り値は、値が分からないという意味であり、0 という意味ではありません。** 文字列の読み取り値は `stringVal` を持ち、その `tagValue` に意味はありません。

良好でない読み取り値は、ドライバーが理由を知っていれば `reason` を持つので、画面は「不良」以上のことを伝えられます。

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

良好な読み取り値にはこれがないので、上の契約はバイト単位でこれまでと同じです。ヒストリアンはこれを保持しません。`/api/history` には品質はありますが、理由はありません。

### `GET /api/sparkline`

小さなチャート用にメモリに保持された、1 つのタグの直近の読み取り値です(`HOTLOOP_RING_SIZE`、既定は 30)。`?tag=device/tag` は必須です。

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` は Unix ミリ秒です。読み取り値のないタグでは、どちらも `[]` です。不正な形式のキーは `400` です。

### `GET /api/board`

ボードにピン留めされたタグと、その列数を返します。ボードはプラントのものなので、ブラウザーではなくデータベースに保存されます。現場のパネル PC と事務所のノート PC は、同じボードを表示します。

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` は保存されているボードを指します。保存時にこれを送り返すと、その間にボードが変わっていた場合は保存が拒否されます(下記)。

### `PUT /api/board`

同じ形です。1 から 4 の範囲外の `columns` は 3 になり、重複は除かれます。`rev` は任意です。読み取ったボードの `rev` を付けると、その後に変わったボードへの保存は `409` になって何も変更されないので、ボードを読んだことがない、または古いものを読んだページが、自分のコピーでプラントのボードを置き換えることはできません。省略すると保存は検査されず、毎回ボード全体を設定するクライアントに向いています。Web UI は起動時にボードを読み、保存のたびに `rev` を送ります。すべてのタグが存在する必要があります(存在しないものを挙げて `404`)。古い項目は、動かないゲージだからです。保存されたボードを返します。オペレーターは `board.write` を持ちます。ボードの整理はプラントの運転であり、構成ではありません。

### `POST /api/write`

書き込みゲートを通して、1 つのタグに 1 つの値を書き込みます。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `tag` | string | 必須。`device/tag` |
| `value` | bool, number or string | 必須。`true` は bool、`42` は整数、`42.5` は浮動小数点、`"42"` は文字列です。JSON の型が書き込まれる型です。コイル、ワード、実数は、通信線上では 3 つの別のものだからです |
| `reason` | string | 任意。書き込みとともにログに残ります |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**値は、読み取り値と同じくタグの単位で指定します。** スケールやオフセットのあるタグでは、送る値はタグが読み戻したときの値で、HotLoop はそれになるカウントをデバイスに送ります。スケール 0.1 のレジスタに 55.5 を書くと、レジスタには 555 が入ります。(4.18 までは数値がそのままデバイスに送られたため、55.5 は 55 になり、5.5 と読み戻されていました。)範囲チェックと監査の行は、タグの単位であなたの数値を使います。その後にレジスタに収まらないカウント、たとえばスケール 0.1 の `uint16` への 7000 は、カウントとレジスタを示して拒否され、何も送られません。カウントの端数は、整数カウントのレジスタが常にそうしてきたように切り捨てられます。10 分の 1 スケールのレジスタに 12.34 を書くと、12.3 が入ります。

ゲートは、書き込みがオンであること(`HOTLOOP_ALLOW_WRITES`)、タグが有効化されていること、値が範囲内であることを、この順に確認します。拒否されたかどうかを問わず、すべての試行は `GET /api/writes` にあります。

| ステータス | 発生条件 |
|---|---|
| 400 | 値がない、`null` の値、不正な形式のキー |
| 403 | 書き込みがオフ、または `"tank-farm/level: this tag is not marked writable"` |
| 404 | そのようなタグがない |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | デバイスが接続されていない |

## 履歴と監査

### `GET /api/history`

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `tag` | 必須、繰り返し可、最大 50 個: `?tag=a/x&tag=b/y` |
| `minutes` | 現在からさかのぼる長さです。既定は 60 |
| `bucket` | バケットの大きさ(秒)です。既定は、1 秒から 1 日までの段階から、窓がおよそ 400 バケットになるように選びます |
| `raw` | `true` でバケットの代わりに読み取り値そのものを返します |
| `limit` | 既定は 5000、最大 100000 |
| `carry` | `true` で、窓の開始時に各タグが保持していた値も返します(バケットのみ) |

バケット単位で、タグごとに古い順です。`badCount` は、バケット内で品質が良くなかった読み取り値の数で、平均には含めず別に数えます。`from` と `to` はレスポンスが対象とする窓で、ちょうど `minutes` 離れ、質問した時刻で終わります。

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

ヒストリアンは、値がデッドバンドを超えて動いたときに読み取り値を保持し、ポーリングのたびには保持しないので、動かなかったタグには窓の中に描くものがありません。`carry=true` を付けると、レスポンスに `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]` も含まれます。`from` より前の最後の読み取り値が良好で数値を持っていた各タグについて、その読み取り値です。最後の読み取り値が不良または不確実だった、それ以前の読み取り値がない、またはテキストであるタグには項目がありません。何を保持していたか分からず、チャートに推測を渡すことはしないからです。トレンドカードはこれから描画します。

生データは新しい順です。

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`tag` がない、50 個を超える、または不正な形式のキーは `400` です。

### `GET /api/writes`

新しい順の書き込み監査です。拒否されたものを含め、すべての試行がここにあります。「そのコマンドが出たかどうか分からない」は、プラントが受け取りうる最悪の答えだからです。

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `tag` | 1 つのタグ、`device/tag` |
| `device` | 1 台のデバイスのすべてのタグ(`tag` を指定すると無視) |
| `entity` | このエンティティに対するサービス呼び出しが行った、または拒否されたすべての書き込みで、上記の代わりに使います |
| `call` | 1 つの呼び出しのすべての書き込みで、上記すべての代わりに使います。ボタンの押下と解放、またはレシピ適用の全対象で、`call_id` を共有します |
| `limit` | 既定は 100、最大 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` は `ui`、`api`、`automation`、`mcp` のいずれかです。`entityId`、`service`、`callId` は、サービス呼び出しが行った書き込みにのみあります。

## エンティティとステート

タグには、誰も頼まなくてもエンティティが作られます。複合のもの(モーター、バルブ、ループ、カウンター、セレクター、ボタン、気象ステーション)は、管理者がタグから作ります。すべてのエンティティのエンドポイントと同じく snake_case です。モデル全体は[エンティティ](/ja/iot/entities/)にあります。

### `GET /api/entities`

孤立したものを含むすべてのエンティティを返します。

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `domain` | `sensor`、`switch`、`motor` など |
| `device` | 1 台のデバイスのエンティティ |
| `orphaned` | `true` で孤立したものだけ、`false` で孤立したものを除く |
| `q`, `limit` | 検索です。エンティティ id、名前、デバイス id に大文字小文字を区別せずに含まれる部分文字列で、エンティティ id 順に並べて最大 `limit` 件(1 から 5000、それ以外は `400` で、黙って切り詰められることはありません)を返します。`X-Total-Count` は一致した件数です。省略すると一覧全体です |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

`POST /api/entities` が作れるもの、つまり各ドメイン、そのタグが結び付けられるロール、受け付けるサービスを返します。ロールには、タグの `kind`、`required` かどうか、サービスがそれに書き込むか(`command`)、ステートをそこから読むか(`feedback`)が示されます。気象ステーションはサービスを受け付けません。

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`。無効なエンティティでは `state` は `null` です。未知のものは `404` です。

### `GET /api/entities/{entity_id}/image`

カメラまたは画像の最新の画像を、HotLoop が保持するバイト列のまま返します。`Content-Type` は実際の形式(`image/jpeg`、`image/png`、`image/gif`、`image/webp`)で、`X-Content-Type-Options: nosniff`、サンドボックス用の `Content-Security-Policy`、`ETag`(`If-None-Match` には `304`)が付きます。該当しないエンティティ、または画像が届く前は `404` です。ステートの `entity_picture` 属性は、このパスに画像のハッシュを付けたものです。

### `PUT /api/entities/{entity_id}`

送ったフィールドだけを変更します。管理者専用です。entity_id は、すべてのオートメーション、ダッシュボード、エージェントがそのエンティティを参照する名前であり、変更は構成の変更だからです。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `entity_id` | string | 名前の変更です。`unique_id` は動きません |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | ドメインごとです。[エンティティ](/ja/iot/entities/#api)を参照してください |
| `disabled`, `hidden` | bool | 無効なエンティティにはステートがなく、コマンドできません |
| `equipment_id` | int or null | ツリーに配置します。`null` で再びデバイスに従います |
| `labels` | string[] | 全体の集合です |

`unique_id`、`domain`、`platform`、デバイス、バインディングはここでは変更できず、送ると 400 です。

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` は、問題はないが妙なこと(デバイスクラスに通常ない単位)を知らせます。空の本文(`"the update names no field to change"`)または不正な値は `400`、未知のエンティティは `404`、使用済みの entity_id は `409` です。

### `POST /api/entities`

複合エンティティを作成します。本文でドメインを指定し、タグをそのロールに結び付けます。

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

`entity_id`(なければ名前から生成)、`device_class`、`unit_of_measurement`、`icon`、`entity_category`、`options` も指定できます。各ドメインが受け付けるロールとオプションは[エンティティ](/ja/iot/entities/#composite-equipment)にあります。`201` `{"entity": {...}, "warnings": [...]}` を返します。ここで作らないドメイン(`sensor` はタグから、`alarm` はその定義から作られます)、足りないロール、またはそれを満たせないタグは `400`、使用済みの entity_id は `409` です。

### `DELETE /api/entities/{entity_id}`

複合エンティティ、またはタグやアラーム定義がなくなった孤立エンティティを削除します。`{"deleted":"motor.transfer_pump","entity":{...}}`。それ以外は、どうすれば消えるかを示して `409` で応答します。

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

有効なすべてのエンティティのステートを、entity_id 順に返します。`?domain=` で絞り込みます。

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` は数値であっても常に文字列です。`unknown` と `unavailable` は、その言葉どおりの意味です。`last_reported` は、その背後にある読み取りについてのデバイスのタイムスタンプです。

### `GET /api/states/{entity_id}`

ステート 1 つを返します。未知のエンティティは `404`、無効なエンティティは有効にする方法を示す別の `404` です。無効なエンティティは存在しないわけではなく、存在しないと伝えると、誰かがありもしない入力ミスを探し回ることになります。

## エネルギー

プラントが使うものとそのコストです。キロワット時、ガス、水、圧縮空気、そして製造した 1 単位あたりのコストを扱います。メーターは、使用量として読み取るタグです。モデル全体、料金表、画面の動作は[エネルギー](/ja/iot/energy/)にあります。読み取りは全ロールが持つ `energy.read`、メーターや料金表の作成と変更は管理者の `energy.write` です。

### `GET /api/energy/meters`

すべてのメーターを種類、次に名前の順に返し、それぞれに読み取り方法と本日の使用量が付きます。

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` は `ok`、`waiting`(タグからまだ何も読み取っていない)、`bad`(タグの読み取り値が良好でなく、`reason` が理由を示す)、`disabled` のいずれかです。

### `POST /api/energy/meters`

メーターを作成します。`id` は小文字、数字、`-`、`_` です。`kind` は `electricity`、`gas`、`water`、`air`、`heat`、`production` のいずれかです。`mode` は `counter`(積算タグで、使用量は動いた量に `factor` を掛けたもの)または `power`(レートで、使用量はそのレートが続いた時間にわたる量。`power_unit` は `W`、`kW`、`MW`、`unit` は `Wh`、`kWh`、`MWh`)です。`source` はタグです。`tariff` は単位あたりの固定の `price` と任意の `currency`、時間帯別料金用の任意の `bands`(15 分単位の `from` と `to`、`days`、`price`)で構成され、生産メーターにはありません。`Wh`、`kWh`、`MWh` の電力メーターは、料金表に `demand_price` を持つこともできます。期間内で最も高い 15 分の 1 キロワットあたりの料金です。`enabled` を省略すると `true` です。`{"meter": {...}, "warnings": []}` とともに `201` を返します。タグがない、または数値でない、バンドが 15 分単位でない、電力メーターに係数がある場合は、何が悪いかを示して `400` です。使用済みの id は `409` です。

### `GET /api/energy/meters/{id}`

一覧に表示される形でメーター 1 つを返します。未知のものは `404` です。

### `PUT /api/energy/meters/{id}`

メーターの定義を置き換えます。すでに数えた分は残り、そのときの価格が維持されます。別のタグやモードに向けると、次の読み取りは別のものなので、最後の読み取りがどこまでだったかを忘れます。

### `DELETE /api/energy/meters/{id}`

メーターと、それが数えたすべてを削除します。未知のものは `404` です。

### `GET /api/energy/summary`

期間にわたる各メーターの使用量とコスト、および製造した 1 単位あたりのコストを返します。期間は `?period=`(`today`、`yesterday`、`this_week`、`last_week`、`this_month`、`last_month`、`last_7_days`、`last_30_days`、または、始まった最新のシフトは `shift:06:00-14:00`、その前のシフトは `last_shift:06:00-14:00` と書きます。日、月、シフトはサイトのものです)、または RFC 3339 の `?from=&to=` で、from を含み to を含まず、最大 400 日です。`meters` は単位あたりコストに含めるメーターのカンマ区切りリスト、`per` は割る対象の生産メーター 1 つを指定します。

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` は、これまでの期間のうち読み取り値が裏付ける割合です。2 つの通貨のコストは決して足し合わされないので、通貨ごとに `per_unit` の行があります。`cost_per_unit` は、何も製造されなかったとき(`reason` は `nothing_made`)、または製造されたが価格付きのメーターがまだ使用量を数えていないとき(`nothing_counted`)に `null` です。これは答えがないという意味で、0 ではありません。

`demand_price` を持つメーターは、行に `demand` を持ちます。`peak_kw`(期間内で最も高い 15 分の平均キロワット)、`peak_at`(その開始時刻)、`peak_covered_seconds`(その 15 分のうち読み取れた長さで、900 未満ならピークは過小評価)、`cost`(ピークに価格を掛けたもの)です。行の `cost` はエネルギーのコストのままで、`costs` と `per_unit` にはデマンド料金が含まれます。

### `GET /api/energy/summary/{period}`

パスで指定した名前付きの期間(またはシフト)1 つについての、同じ要約です。`meters` と `per` は引き続きクエリに指定します。

### `GET /api/energy/series`

期間にわたる 1 つのメーターの使用量です。`?meter=<id>`、上記の期間、そして `step`(`quarter` は最大 8 日、`hour` は既定、`day`、`month`)を指定します。読み取り値のないステップは一覧にありません。

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

メーター、名前付きの期間、ステップをすべてパスに含めた同じシリーズで、パスしか渡せない呼び出し元向けです。

## サービス

### `POST /api/services/{domain}/{service}`

エンティティ 1 つにコマンドします。`switch/turn_on`、`number/set_value`、`motor/start`、`alarm/acknowledge`。エンティティ 1 つ、サービス 1 つ、呼び出し 1 回です。その下にあるのは、`POST /api/write` と同じ書き込みゲートを通るタグへの書き込みだけです。

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` は必須で、リストではなくエンティティ 1 つです。`reason` は任意で、ほかはすべてサービスのデータです(`value`、`option`、`position`、`mode`、`minutes`、`note`)。数値は入力した型を保ちます。パスのドメインはエンティティのドメインでなければなりません。すべてのサービスとそのデータは[エンティティ](/ja/iot/entities/#what-each-domain-takes)にあります。

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

各書き込みは、`written`、`not_sent`(デバイスに届く前に拒否された)、`failed`(送信されたがデバイスがエラーを報告したため、反映されたかどうか不明)、`skipped`(呼び出しの前の書き込みが成功しなかった)のいずれかです。すでに行われた書き込みは決して取り消されません。アラームエンティティのサービスはタグに書き込まず、エンジンが残した `alarm` で応答します。ヘルパーのサービスもタグに書き込まず、残した `state` で応答します。

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

スクリプトの `turn_on` は、データをフィールドとして実行し、開始した `script_run` で応答します。そのステップの書き込みは、ここではなく `script:<id>` として 1 つずつ監査されます。`turn_off` はそのすべての実行を停止します。[スクリプト](#スクリプト)を参照してください。

シーンの `turn_on` は、データの `params` と `version` でそのレシピを適用し、`recipe_application` 全体と、`writes` にターゲットが行ったすべての書き込みを順番に入れて応答します。すべてのターゲットに書き込めなければ失敗します。[レシピ](#レシピ)を参照してください。

失敗した呼び出しは、エラーのステータスと、同じ本文に `error` を加えたもので応答するので、どこで止まったかが正確に分かります。

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| ステータス | 発生条件 |
|---|---|
| 400 | `entity_id` がない、ドメインが違う、未知のサービス、サービスが受け付けないデータ |
| 403 | 権限がない、またはゲートがポリシー上拒否した |
| 404 | そのようなエンティティがない |
| 409 | 既知のステートがないトグル、サービスに対して誤った状態の設備 |
| 422 | 値そのものを理由に拒否された |
| 503 | デバイスが接続されていない、アラームエンジンが動作していない |
| 500 | ボタンの押下は送られたが、解放が送られなかった。**タグは押下の値を保持したままかもしれません。** 確認して、手動で解放してください |

**`?dry_run=true`** は、その呼び出しが何をするかを尋ね、実際には何もしません。書き込み、監査、ログのいずれも行われません。呼び出しは本物と同じように計画され、すべての書き込みがゲート自身のチェックにかけられます。順序も同じで、いま実行されます。判定は、拒否されたかどうかを問わず 200 で応答します。各書き込みは `would_write`、または拒否される最初のものは理由付きの `not_sent` で残りは `skipped`、そして `error` は本物の呼び出しが失敗するときのエラーを一字一句そのまま示します。

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

本物の呼び出しなら何らかのチェックの前に突き返すリクエスト(存在しないエンティティ、未知のサービス、サービスが受け付けないデータ、既知のステートがないトグル)は、本物の呼び出しのステータスとエラーで応答します。権限がない場合も同じです。`dry_run` は `true` か `false` だけで、`yes` は推測せずに 400 です。推測を誤ると質問がコマンドになってしまうからです。[エンティティ](/ja/iot/entities/#asking-first-the-dry-run)を参照してください。

**権限をハンドラーで確認する理由。** タグへの直接書き込みと同じ `values.write` が必要です。それがこの呼び出しのすべてだからです。`alarm` エンティティのサービスは代わりにアラーム画面と同じ `alarms.ack`、ヘルパーのサービスはオペレーターが持つ `helpers.write`、スクリプトのサービスは `POST /api/scripts/{id}/run` と同じ `scripts.run`、シーンのサービスは `POST /api/recipes/{id}/apply` と同じ `recipes.apply` と、レシピが指定する場合はそのレシピ自身の権限が必要です。確認をハンドラーの前ではなく中で行うのは、権限不足による拒否も書き込みゲートに送られ、要求された値とともに、ほかの拒否と同様に**エンティティに対して監査**されるようにするためです。権限のないユーザーは 403 と `GET /api/writes?entity=...` の 1 行を受け取り、403 だけで何も残らないことはありません。ヘルパーはタグに書き込まないので、今回を含むヘルパーの拒否は、代わりにそのヘルパーに対するシステムログ(`GET /api/events`)の警告になり、スクリプトも同様です。シーンの拒否は、レシピの履歴にユーザー付きで残る拒否されたアプリケーションです。

## ヘルパー

PLC ではなく現場の人が持つ値です: `input_boolean`、`input_number`、`input_select`、`input_text`、`input_counter`、`timer`、`schedule`。ヘルパーはエンティティ(プラットフォーム `helper`)の 1 つで、ほかのエンティティと同じように `/api/entities` と `/api/states` に現れます。以下のルートはその設定用です。値は上記のサービスで `helpers.write` を使って設定します。すべてのドメイン、オプション、サービスは[ヘルパー](/ja/iot/helpers/)にあります。

### `GET /api/helpers`

すべてのヘルパーを、エンティティのフィールドと、そのヘルパー用に保存された行である `value` とともに返します。

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

初期値でヘルパーを作成します。管理者専用です。

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

`entity_id`(省略すると名前から生成)と `icon` も指定できます。`201` `{"helper": {...}}` を返します。ヘルパーのものではないドメイン、ドメインが受け付けないオプション、自身のオプションが拒否する `initial` は `400`、すでに使われている entity_id は `409` です。

### `GET /api/helpers/{entity_id}`

一覧と同じ形でヘルパー 1 件を返します。不明なエンティティ、またはヘルパーではないエンティティは `404` です。

### `PUT /api/helpers/{entity_id}`

`name`、`icon`、`unit_of_measurement`、`options`、`disabled`、`hidden`、`entity_id`、`equipment_id`、`labels` を変更します。`PUT /api/entities/{entity_id}` と同じフィールドです。管理者専用です。現在の値を許さなくなる新しいオプション(値より下に狭めた範囲、選択中の選択肢を取り除いたもの)は `400` です。値がオプションに合わせて動かされることはありません。`{"helper": {...}, "warnings": []}` を返します。

### `DELETE /api/helpers/{entity_id}`

ヘルパーとその値を削除します。管理者専用です。`{"deleted":"timer.purge"}`。`DELETE /api/entities/{entity_id}` はヘルパーを拒否し、ここを指す `409` を返します。

## 設備とラベル

ISA-95 のツリー(企業、サイト、エリア、ライン、セル、ユニット、設備)と自由形式のラベルです。snake_case を使います。すべてのロールが読み取れますが、変更できるのは管理者だけです。ノードの名前変更や移動は、その下にあるすべてのデバイスのサイト、エリア、ラインを書き換えるためです。[設備ツリーとラベル](/ja/iot/equipment/)を参照してください。

### `GET /api/equipment`

すべてのノードを id 順に、ルートからの名前の経路である `path` とともに返します。`?level=area` で絞り込みます。`?q=` は経路にそのテキストを含むノード(大文字小文字は区別しません)に、`?limit=`(1 から 5000、それ以外は `400`)はその先頭のノードに絞ります。どちらかを使うと、`X-Total-Count` は一致した件数になります。

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` が null または省略されるとルートになります。子は親より下のレベルでなければなりません(設備は設備の中に置けます)。`{"equipment": {...}, "devices_rewritten": []}` を返します。レベルや配置が不正なら `400`、同じレベルと名前の兄弟があれば `409` です。

### `GET /api/equipment/{id}`

ノード、その直下のノード、そのノードに直接置かれたデバイスとエンティティを返します。

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

正の数ではない id は `400`、不明な id は `404` です。

### `PUT /api/equipment/{id}`

`name`、`description`、`level`、`parent_id`(`null` でルートへ移動)のいずれかを送ります。送ったフィールドだけが変わり、空の本文は 400 です。ノードと、**その結果サイト、エリア、ラインのテキストが変わったすべてのデバイス**を返します。古いクライアントや MCP ツールが読むのはそのテキストだからです。

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`。その下や上に何かある間は `409` で、何があるかを伝えます。デバイスの足元からノードを消すのは、うっかり下してよい判断ではありません。

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` は必須です。`label_id`(小文字、数字、アンダースコアで 1 から 64 文字)は、省略すると名前から生成され、その後は変わりません。`color`、`icon`(`mdi:...`)、`description` は任意です。ラベルを返します。すでに使われている名前や id は `409` です。

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: ラベルと、それが付いている対象です。不明なラベルは `404` です。

### `PUT /api/labels/{label_id}`

`name`、`color`、`icon`、`description` を置き換えます。省略したフィールドは消えます。本文の `label_id` はパスと一致していなければならず、違えば `400` です。label_id は変わらないためです。

### `DELETE /api/labels/{label_id}`

ラベルを、それが付いているすべての対象から外します。`{"deleted":"critical"}`、または `404`。

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` はデバイスのラベルの集合全体を置き換えます。`{"id":"tank-farm","labels":["critical"]}` を返します。すべてのラベルが存在している必要があり(存在しないものの名前とともに `400`)、デバイスも存在している必要があります(`404`)。ラベルを `POST /api/devices` に含めないのは意図的です。デバイスを保存するクライアントはどれもラベルなしでデバイス全体を送るので、保存のたびにラベルが消えてしまいます。

## アラーム

ISA-18.2: 発生、確認応答、正常への復帰はそれぞれ別のことで、ログはそのどれが起きたかを区別できます。

### `GET /api/alarms`

すべての定義、現在のアラーム、サマリーを返します。`?outstanding=true` は正常なものと抑制されたものを除きます。

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` は `normal`、`unack-active`、`ack-active`、`rtn-unack`(誰も確認応答しないうちに復旧したもので、午前 3 時のトリップが朝の勤務者の目に触れる前に消えないよう一覧に残されます)、`shelved`、`suppressed` のいずれかです。`tripValue` はアラームを発生させた値で、現在の値ではありません。

### `POST /api/alarms`

定義を作成または置き換えます。

| フィールド | 型 | <span class="sr-only">詳細</span> |
|---|---|---|
| `id`, `name` | string | 必須。`id` はデバイス id の規則に従います |
| `deviceId`, `tagName` | string | 必須 |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale`(`limit` 秒間値がない), `roc`(1 秒あたり `limit` を超える変化率) |
| `limit` | number | |
| `priority` | int | 1(重大)から 4(低)まで |
| `enabled` | bool | 省略すると `false` |
| `deadband` | number | 復旧するまでに値がどれだけ戻る必要があるか。不感帯がないと、限界値上にある値がばたつきます |
| `onDelaySec`, `offDelaySec` | int | 発生するまでに条件が続く必要のある時間、または正常に戻るまでに解消している必要のある時間 |
| `message`, `description` | string | `message` には `{value}`、`{limit}`、`{tag}`、`{device}`、`{unit}`、`{condition}`、`{reason}`(値が不良な理由。良好なときは空)を使えます |

`{value}` は値カードと同じ書き方で、単位つきで記述されます。整数はそのまま、1 以上は小数点以下 2 桁、100 以上は 1 桁、1 未満は 4 桁、1000 万を超えるか 0.01 未満なら科学表記です(`8.20 pH`、`212.5 F`、`1.235e+7`)。スケールが 0.1 のタグに生の値 82 が入ると float では 8.200000000000001 になり、バナーがそのまま表示していたため、このようにしました。テキストの値はそのまま表示されます。タグ、書き込み、オートメーションは引き続き正確な数値を扱い、丸められるのは文だけです。`{limit}` は入力したとおりの限界値です。

定義を返します。応答の前にエンジンが再読み込みされ、アラームのエンティティが作成されます。検証に失敗すると `400` です(`"alarm x: priority must be 1-4, got 9"`)。

### `POST /api/alarms/import/codesys`

CODESYS IDE の Export Alarms が書き出すファイル(アラームグループのエクスポート、`.csv`)をリクエスト本文から読み込みます。IDE が書いたままの形(バイトオーダーマーク付きの UTF-16)でも UTF-8 でも構いません。`?deviceId=` は PLC のデバイスで、必須です。`?application=` はそのタグが属するアプリケーション名で、省略すると `Application` です。エクスポートでは変数が GVL 名で書かれ(`GVL_Alarm.bPumpFault`)、タグは `Application.GVL_Alarm.bPumpFault` になります。`?defaultPriority=`(1 から 4)は、クラスが Error、Warning、Info のどれでもないアラームの優先度です。`?apply=true` がなければ何も保存されず、取り込まれる内容が応答で示されます。

アラーム画面では、これが CODESYS からインポート(管理者専用)として使えます。デバイスを選び、アプリケーション名を入力し、ファイルを選び、プレビューを確認してからインポートします。

`= TRUE` または `= FALSE` と比較するデジタルアラームは `true` と `false` になり、`>` の UpperLimit は `hi`、`<` の LowerLimit は `lo` になります。Outside range アラーム(`OutOfArea`、両方の演算子が `<`)は 2 つのアラーム、つまり下限の `lo` と上限の `hi` になります。メッセージとオン、オフの遅延(`T#5s` のような IEC 時間)は引き継がれ、Error は優先度 2、Warning は 3、Info は 4 です。IDE が書き出せるそれ以外のものは読み込まれず、その行と理由とともに `skipped` で返されます。CODESYS はレイアウトを公開しておらず、実際のエクスポートで確認できたものだけを読むためです。IDE が提供するそれ以外もこれに含まれます。Inside the range(`ForbiddenArea`)は 2 つの限界の間でだけ真ですが、ここでのアラームの限界は 1 つで、Change には文書化された継続時間がなく、Event と Alarm (API) は PLC プログラムが発生させるため監視する変数がありません。`warnings` には一部しか引き継がれなかったもの(不明なクラス、ラッチ、より高い優先度のアラーム)が並びます。

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

不明なデバイスは `404`、アラームグループのエクスポートではないファイルは `400`。

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`、または `404`。

### `POST /api/alarms/{id}/ack`

任意の本文 `{"note": "checking the heater bands"}`。アラームの現在の状態を `ackedBy` と `ackNote` 付きで返します。不明なアラームは `404`。

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`、必須で正の値です。期限なしの消音は抑止であり、別のものです。オペレーターが決めることではありません。`state` が `shelved` のアラームを `shelvedUntil` と `shelvedBy` 付きで返します。

### `POST /api/alarms/{id}/unshelve`

本文なし。条件が決める状態に戻したアラームを返します。保留中でなければ `409`。

### `GET /api/alarms/events`

アラームの監査記録。新しい順。`?alarm=` で定義を1つ、`?limit=`(既定 200、最大 5000)。

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` は `raised`、`acked`、`cleared`、`shelved`、`unshelved`、`suppressed`、`unsuppressed`、`escalated`、`escalation-ended` のいずれかです。最後の2つはアラームのエスカレーションが書き込み(`actor` は `escalation`)、`note` に誰に通知したか、なぜ連鎖が止まったかが入ります。[アラーム通知](/ja/iot/notifications/#エスカレーション)を参照してください。

## オートメーション

トリガー、条件、アクション。ルールの言語は[オートメーション](/ja/iot/automations/)にあります。

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` は実際に動いているルールを示し、`enabled` とは別のものです。有効でもコンパイルできなくなったルールは armed ではなく、ここで分かります。

### `POST /api/automations`

ルールを作成または置き換えます。`id`、`name`、`description`、`enabled`、`triggers`(1つ以上)、`condition`、`actions`(1つ以上)、`mode`(既定は `skip`、ほかに `queue`、`restart`、`parallel`)、`minIntervalSec`、`maxRuntimeSec`。ルールは保存の前にコンパイルされ、コンパイルできないものは 400 になりデータベースには届きません。armed にできない保存済みルールは、作成者が動いていると信じているルールだからです。

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

ルールを保存せずにコンパイルします。エディターのライブチェック用です。常に `200` で、コンパイルできたかどうかは応答に入ります。

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

ルールを書く人を助けるための機能なので、`automations.write` が必要です。

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`、または `404`。

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` は削除せずに停止します。`{"enabled":false,"id":"fill-tank"}`、または `404` を返します。

### `POST /api/automations/{id}/trigger`

トリガーが発火したかのように、今すぐ実行します。条件は引き続き適用され(偽なら `skipped` の実行が記録されます)、実行モードも適用されます。`minIntervalSec` は適用されません。実行を頼む人は、ばたつくタグではないからです。本文なし。`202` `{"triggered":"fill-tank"}`。実行はバックグラウンドで行われ、結果は `GET /api/runs` にあります。ルールが armed でなければ `400`。オペレーターは `automations.trigger` を持ちます。他の人が書いたルールを実行するのは運転であり、書くことは運転ではありません。

### `GET /api/runs`

実行履歴。新しい順。`?automation=` でルールを1つ、`?limit=`(既定 100、最大 1000)。ない場合は `[]`。

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` は `running`、`succeeded`、`failed`、`skipped`、`timed_out`、`cancelled` のいずれかです。ステップにはテンプレートではなく解決済みの入力が残ります。午前3時に読む必要があるのはそれだからです。

ブループリントから作ったルールには、`GET /api/automations` にさらに3つのフィールドがあります。`blueprintId`、`blueprintVersion`(作成元のバージョンで、そのバージョンのまま残ります)、`blueprintInputs` です。手で書いたルールにはどれもありません。これらはサーバー側のものです。`POST /api/automations` は受け取って無視し、手での編集ではルールが持っていた値がそのまま残ります。

### `POST /api/automations/{id}/blueprint-upgrade`

ブループリントから作ったルールを、そのブループリントの最新バージョンへ移します。id、名前、armed かどうかはそのままです。自動では行われません。オペレーターは、作成時と同じ `blueprints.apply` を持ちます。まず確認してください。**`?dry_run=true`** は何も変更せず、何が部分ごとに変わるか、いまルールが発火したら何をするかを返し、すべての書き込みは書き込みゲートのチェックにかけられます。

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

ルール作成後に手で行った編集は、`changes` に置き換えられるものとして表示されます。新しいバージョンがルールに値のない入力を必要とする場合、またはルール作成時の値を拒否する場合、ドライランは `error` にそのことだけを返します。

本番の実行は、ドライランで示したバージョンの `{"version": 2}` と、新しいバージョンに必要な `inputs` を受け取ります。その後ブループリントが先に進んだ場合や、その間に誰かがルールをアップグレードした場合は `409` です。確認したものがそのまま入るか、何も入りません。入力が足りなければ `400`。同じ形で `200` を返し、`automation` は保存されたルールです。`automation upgraded from blueprint pump_watch version 1 to 2` として記録されます。同じバージョンで新しい `inputs` を渡すと、ルールの入力を変更できます。手で書いたルールは `400`、元のブループリントがなくなっていれば `404`。

## スクリプト

名前を付けたアクションの並びで、必要なときに実行します。ここから、ルールの `call_script` ステップから、MCP の `run_script` から、またはスクリプトのエンティティ(`script.turn_on`)から実行できます。並びはオートメーションの言語です。ステップによるすべての書き込みは、開始した人の出どころとともに `script:<id>` として書き込みゲートを通ります。詳しくは[スクリプト](/ja/iot/scripts/)にあります。

### `GET /api/scripts`

すべてのスクリプトを、実行回数のカウンターと、いま動いている実行数とともに、すべてのプロセスについて返します。

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

1つ作成します。管理者のみ。`id`(小文字、数字、アンダースコアで、文字から始めます。エンティティのオブジェクト id である `script.<id>`)、`name`、`description`、`icon`、`fields`(型付きの入力)、`sequence`(アクション1つ以上)、`mode`(既定は `skip`、ほかに `queue`、`restart`、`parallel`)、`maxRuntimeSec`。ルールと同様に保存前にコンパイルされ、直接または他のスクリプト経由で自分自身を呼ぶスクリプトは拒否されます。`201` でスクリプトを返します。コンパイルできないものは `400`、id が使用済みなら `409`。

### `POST /api/scripts/validate`

スクリプトを保存せずに確認します。エディターのライブチェック用です。`200` `{"valid":true}` または `{"valid":false,"error":"..."}` で、保存が拒否されるときと同じ言葉で返します。

### `GET /api/scripts/{id}`

一覧にあるものと同じ形のスクリプト1つ。なければ `404`。

### `PUT /api/scripts/{id}`

定義を置き換えます。本文は作成時と同じで、`id` は省略できます。管理者のみ。ステップ、フィールド、モードが変わると、実行中のものは取り消されます。古い定義から始まったものだからです。

### `DELETE /api/scripts/{id}`

スクリプトと実行履歴を削除し、実行中のものを取り消します。管理者のみ。`{"deleted":"cip_cycle"}`。エンティティは削除されず、孤立した状態になります。

### `POST /api/scripts/{id}/run`

実行します。オペレーターは `scripts.run` を持ちます。

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

本文のフィールドはすべて任意で、本文自体も任意です。何かが実行される前に、フィールドはスクリプトのフィールドと照合されます。範囲外、ステップに合わない、選択肢にない、型が違う値は `400` になり、合わせるために動かされることはありません。実行が始まるとすぐに `202` で実行情報を返します。`"wait":true` の場合は、実行が終わってからトレース付きで `200` を返します。

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

使用中の場合は `409`。すでに実行中でモードが `skip` の場合、または実行中で1つが待機中でモードが `queue` の場合です。何も実行されず、理由を示す `skipped` の実行が履歴に残ります。

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** は、いま実行したら何をするかを尋ね、そのどれも実行しません。フィールドは同じように確認され、そのあと各ステップが現在のプラントに対してたどられます。すべての書き込みとサービス呼び出しはゲート自身のチェックにかけられ、条件は評価され、変数は束縛されます。待機、遅延、どの設備にも書き込まないものはすべて `not_checked` です。拒否される最初の書き込みで、実行が終わるのと同じように終了し、`error` がゲートの言葉で伝えます。拒否されたかどうかにかかわらず、判定とともに `200` を返します。

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

各ステップの `verdict` は `would_write`、`refused`、`ends_here`(いま偽の条件、または停止)、`not_checked`、`ok` のいずれかです。呼び出しているスクリプトのステップは、呼び出しの下に `3.1` のように番号が付きます。

### `POST /api/scripts/{id}/stop`

実行中のすべての実行を、すべてのプロセスで、どこにあっても取り消します。`{"cancelled":1,"stopped":"cip_cycle"}`。`cancelled` はこのプロセスが持っていた実行数です。オペレーターは `scripts.run` を持ちます。開始できるものを止めることも、開始の一部です。

### `GET /api/scripts/{id}/runs`

実行履歴。新しい順で、トレース付き。`?limit=`(既定 50、最大 1000)。`parent` は、何かが実行を呼び出した場合のその呼び出し元です。`automation_run:812`、`script_run:77`。

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## レシピ

一緒に適用される値の組です。製品グレードの設定値や品種切り替えなどです。それぞれはエンティティでもあり、`scene.<id>` です。レシピは何かが送られる前に全体が確認され、どんな理由でも全体が拒否されます。ターゲットはその後、1つの呼び出し id のもとで順に送られ、最初に失敗したものが残りを止め、何も元に戻されません。書き込まれた値はすべてデバイスから読み戻されます。詳しくは[レシピ](/ja/iot/recipes/)にあります。

レシピの名前、説明、設備ノード、権限はその場で変更されます。レシピが書き込む内容(`targets`、`params`、`precondition`、`verify_sec`)はバージョンであり、バージョンは決して変更されません。新しい内容を保存すると次のバージョンが保存されます。

### `GET /api/recipes`

すべてのレシピを、現在のバージョンの内容と直近の適用とともに返します。

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` はプラント全体のレシピでは `null` です。

### `POST /api/recipes`

バージョン 1 として1つ作成します。管理者のみ。`id`(小文字、数字、アンダースコアで、文字から始めます。エンティティのオブジェクト id である `scene.<id>`)、`name`、`description`、`equipment_id`、`apply_permission`(既定は `recipes.apply`、または `recipes.apply.<name>`)、`params`(型付きの入力)、`precondition`(開始するには真でなければならない式)、`targets`(1つ以上、最大 200、それぞれ `entity_id`、`service`、および `data` または `data_expressions`)、`verify_sec`(1 から 600、既定 10)、`note`。ターゲットは値を設定します。それを受け付けるドメインで `set_value`、`select_option`、`set_position`、`set_speed`、`set_setpoint`、`set_mode`、`turn_on`、`turn_off` を使います。パルスや開始は拒否されます。それはスクリプトの役割です。すべてのターゲットのエンティティが存在し、すべての式がコンパイルできる必要があります。レシピとともに `201`。誤りがあれば `400`、id が使用済みなら `409`。

### `POST /api/recipes/capture`

エンティティがいま持っている値からレシピの下書きを作ります。管理者のみで、何も保存しません。

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

それぞれが、現在の値に戻すターゲットになり、指定された順に並びます。ループはモード、次に設定値になります。応答は、エディター用の id と名前のないレシピです。存在しない、無効になっている、品質が良好以外で読まれる、`unknown` または `unavailable` である、あるいはレシピが設定するものではないエンティティは、該当するすべてを挙げて `400` になります。不良な読み取り値から作ったレシピは、その不良な値を書き戻します。

### `GET /api/recipes/{id}`

一覧にあるものと同じ形のレシピ1つ。なければ `404`。

### `PUT /api/recipes/{id}`

保存します。管理者のみ。本文は `GET` が返したレシピを編集したもので、`id` は省略できます。`current_version` は編集の基準になったバージョンです。その後に誰かが別のバージョンを保存していた場合、相手のものを黙って上書きせず `409` になります(`0` は確認を省きます)。新しい内容は次のバージョンになり、`note` に理由を書きます。名前、説明、設備、権限だけの変更ではバージョンは作られません。

### `DELETE /api/recipes/{id}`

レシピとそのバージョンを削除します。管理者のみ。`{"deleted":"grade_a"}`。適用の記録はプラントに送られた内容なので残り、エンティティは孤立します。

### `GET /api/recipes/{id}/versions`

すべてのバージョンを新しい順に、保存されたそのままの形で、保存した人とメモとともに返します。

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

バージョン1つ。レシピにそのバージョンがなければ `404`、`{version}` が数値でなければ `400`。

### `POST /api/recipes/{id}/validate`

いま適用できるかを確認します。オペレーターは `recipes.apply` を持ちます。本文は適用のものと同じで、何も書き込まれず、記録されず、ログにも残りません。適用が書き込む前に行うすべての確認が行われます。パラメーター、レシピ自身の権限、前提条件、データ式、別の適用がそのエンティティのいずれかに書き込んでいないか、そしてすべてのターゲットに対する書き込みゲートのチェックです。`200` で判定(`would_apply` または `refused`)と、各ターゲットの判定(`would_write`、理由付きの `refused`、`not_sent`)を返します。

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

受け付けないパラメーターは、本番の適用と同じく `400` になります。

### `POST /api/recipes/{id}/apply`

適用します。オペレーターは `recipes.apply` を持ちます。独自の権限 `recipes.apply.<name>` を指定しているレシピは、それも必要で、ここでレシピに照らして確認されます。権限のないユーザーは `403` になり、履歴にそのユーザー名が付いた拒否された適用が残ります。

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

すべて任意で、本文も任意です。`version` は意図的に古いバージョンを適用します。省略すると現在のバージョンです。`resume` は、途中で止まったこのレシピの以前の適用の id です。書き込まれなかったターゲットが、そのバージョンとパラメーターで新しい適用として送られ、どれを完了させるかを `parent` が示します。

すべての値が書き込まれて読み戻されてから応答し、最大でレシピの `verify_sec` かかります。

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

ターゲットは `written`、`failed`(送られたがデバイスが拒否した、または何も返さなかった)、`not_sent`、`skipped`(前のものが通らなかった)、`refused`(事前検証)のいずれかです。書き込まれたものは、送信後にデバイスが送られた値を読み戻したときに `verified`、`verify_sec` 以内に読み戻さなかったときに `unconfirmed` になります。送られたものの反映されていない可能性があります。すべての書き込みには適用の `call_id` が付くので、`GET /api/writes?call=<call_id>` ですべてを確認できます。

| ステータス | 条件 |
|---|---|
| 200 | `applied`: すべてのターゲットが書き込まれました。それぞれの `verification` を確認してください |
| 400 | レシピが受け付けないパラメーター、範囲外または型の誤り。適用するものが残っていない `resume` |
| 403 | レシピ自身の権限。拒否された適用として記録されます |
| 404 | そのようなレシピ、またはバージョンがありません |
| 409 | `refused`: 開始しない理由すべてが `error` とそのターゲットに入ります。または別の適用がいまそのエンティティのいずれかに書き込んでいます。何も書き込まれていません |
| 502 | `partial` または `failed`: 開始したものの、すべてのターゲットが送られたわけではありません。どれかは `targets` が正確に示します。何も元に戻されません |

不正な本文の `400` や `404` を除くすべての応答には適用が含まれ、ドライランを除くすべての適用は、拒否も含めて `GET /api/recipes/{id}/applications` にあります。

### `GET /api/recipes/{id}/applications`

適用の記録を新しい順に、拒否されたものも含めて返します。`?limit=`(既定 50、最大 1000)。`parent` は、何かが適用した場合のその適用元です。`automation_run:812`、`script_run:77`、`application:41`。削除されたレシピの適用も引き続き返されます。

## ブループリント

型付きの空欄を持つオートメーションを一度書き、それを埋めて通常のルールを作ります。ルールは作成時のバージョンを保ちます。ブループリントを編集してもどのルールも変わらず、ルールを新しいバージョンに移すのは、誰かが求める[アップグレード](#post-apiautomationsidblueprint-upgrade)です。ルールが行うすべての書き込みは `automation:<id>` として書き込みゲートを通ります。詳しくは[ブループリント](/ja/iot/blueprints/)にあります。

### `GET /api/blueprints`

すべてのブループリントを、組み込みのものを先に、それぞれから作られたルールの数とともに返します。

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` は `builtin`(バイナリに含まれる、読み取り専用)または `user` です。

### `POST /api/blueprints`

1つ書き込みます。管理者のみ。`id`(小文字、数字、アンダースコアで、文字から始めます)、`name`、`description`、`inputs`(スクリプトのフィールドと同じ型付き)、`template`: ルール本体で、`description`、`triggers`、`condition`、`actions`、`mode`、`minIntervalSec`、`maxRuntimeSec` と、その中の空欄を持ちます。値としての `{"!input": "motor"}` は入力に置き換えられ、文字列中の `${motor}` も同様で、文字列が式の場合はリテラルとして入ります。保存前に確認されます。すべての空欄が入力を指し、すべての入力が使われ、サンプル値で埋めたときにコンパイルできるルールになる必要があります。`version` 1 で `201`。誤りがあれば `400`、id が使用済みなら `409` で、組み込みのものの id も含みます。

### `GET /api/blueprints/{id}`

一覧にあるものと同じ形のブループリント1つ。なければ `404`。

### `PUT /api/blueprints/{id}`

定義を置き換えます。本文は作成時と同じで、`id` は省略できます。管理者のみ。`inputs` または `template` が変わると `version` が1上がり、名前や説明だけの変更では上がりません。**それから作られたルールは1つも変わりません。** 各ルールは作成時のバージョンを保ち、どれかは `GET /api/automations` に出ます。組み込みのものは `400` です。自分の id でコピーしてください。

### `DELETE /api/blueprints/{id}`

管理者のみ。`{"deleted":"pump_watch"}`。それから作られたルールが存在する間は、それらを挙げて `409` です。先にそれらを削除してください。組み込みのものは `400`。

### `POST /api/blueprints/{id}/instantiate`

ブループリントからルールを作り、armed にします。オペレーターは `blueprints.apply` を持ちます。どのポンプをどれだけの時間にするかは各自が選べ、ルールが何をするかはブループリントが書かれたときに決まっています。

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` の既定はブループリントのもの、`enabled` の既定は `true` です。何かを作る前にすべての入力が確認されます。範囲外、ステップに合わない、選択肢にない、別のドメインのエンティティ、型が違うものは、誤りをすべて挙げて `400` になり、合わせるために動かされることはありません。使用済みの `automationId` は `409` です。ルールを作って既存のものを置き換えることはありません。ルールとともに `201` を返し、`blueprintId`、`blueprintVersion`、`blueprintInputs` が設定されます。`automation made from blueprint motor_running_too_long version 1` として記録されます。

**`?dry_run=true`** は何も作りません。作られるルールと、そのルールがいま発火したら何をするかを返します。条件が評価され、すべての書き込みとサービス呼び出しが `automation:<id>` としてゲートのチェックにかけられ、最初の拒否がゲートの言葉で `check.error` に入ります。何も保存、書き込み、監査されません。

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## ダッシュボード

必要とするロールと画面のための、カードのページです。ダッシュボードは何も命令しません。カードはタグ、エンティティ、スクリプト、またはレシピを指し、そのボタンは押した人として [`POST /api/write`](#post-apiwrite) を通じて書き込みます。ウォールボードもその1つです。詳しくは[ダッシュボード](/ja/iot/dashboards/)にあります。

### `GET /api/dashboards`

呼び出し元に提示されるダッシュボードを、切り替えが表示する順に、ウォールボードを含めて返します。`dashboards.write` を持つ人にはすべてが提示されます。

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

1つ作ります。管理者のみ。`id`(小文字、数字、ハイフン、アンダースコアで、文字から始めます)、`name`、任意で `description`、`roles`、`homeFor`、`screens`、`position`、`cards`。`version` 1 で `201`、すべてのカードのサイズと設定が保存された形で入ります。

カードは `id`、`type`、`title`、`w`(1 から 12 列)、`h`(1 から 8 行)、`config` です。種類とその設定は[ダッシュボード](/ja/iot/dashboards/#カード)にあります。保存前に確認されます。

- タイプにない設定キー、範囲外の数値、ログインやトークンを含むカメラまたはフロアプランのアドレス、または 60 を超えるカードは `400` です。
- 存在しないタグ、エンティティ、スクリプト、レシピを指すカードは、それを挙げて `400` です。
- 書き込み不可のタグへの `button`、またはタグの範囲外の数値は `400` です。ゲートがすべての押下を拒否するためです。
- 存在しないロールは `400` です。
- 使用済みの `id`、別のダッシュボードがすでに持つ画面、または別のダッシュボードがすでにホームになっているロールのホームは `409` です。

### `GET /api/dashboards/{id}`

一覧にあるものと同じ形のダッシュボード1つ。なければ、または呼び出し元に提示されていなければ `404`。

### `PUT /api/dashboards/{id}`

置き換えます。管理者のみ。本文は `GET` が返したダッシュボードで、`version` には読み取ったときのバージョンを設定します。**必須です。** すでに現在ではないバージョンを指定した保存は、現在のバージョンを示す `409` になります。そうしないと、最後に保存した人が作ったばかりのものが黙って消えてしまうからです。本文の `id` は省略でき、`kind` は変更できず、`createdAt`、`updatedAt`、`updatedBy` はサーバーのものなので無視されます。次のバージョンのダッシュボードとともに `200`。

ウォールボードは、割り当て(`roles`、`homeFor`、`screens`、`position`)にのみ `PUT` を受け付け、それ以外は受け付けません。カードがないため、カードのあるものは `400` です。ゲージはボードのタグで、`GET` と `PUT /api/board` です。

### `DELETE /api/dashboards/{id}`

管理者のみ。`{"deleted":"line-2"}`。カードは対象を指すだけで何も所有しないので、ほかには何も触れません。ウォールボードは `400` です。常に存在するためです。

作成、保存、削除は、サブジェクト `dashboard:<id>` の `config` イベントとして記録されます。

### `GET /api/dashboards/{id}/export`

画面ファイルとしてのダッシュボードです。バージョン付きの JSON ドキュメントで、[`POST /api/dashboards/import`](#post-apidashboardsimport) が別のインストールに読み込みます。`<id>.hotloop-screen.json` という添付ファイルとして応答します。呼び出し元には `dashboards.read` が必要で、そのダッシュボードが提示されている必要があります。1つの `GET` と同じです。ウォールボードは `400` です。レイアウトではなく、インストールに固定されたゲージだからです。形式は[画面ファイル](/ja/iot/screen-file/)にあります。

### `POST /api/dashboards/import`

画面ファイルを読み取り、このインストールに照らして確認し、新しいダッシュボードとして保存します。管理者のみで、`POST /api/dashboards` が拒否するものは保存できません。本文はファイルそのもの、またはオプションを並べた `{"file": {...}}` です。

| オプション | <span class="sr-only">詳細</span> |
|---|---|
| `id`, `name` | 別の id または名前で保存します。 |
| `replace` | id が使用済みの場合、そのダッシュボードを現在のバージョンのまま上書きして保存します。これがないと、使用済みの id は `409` です。 |
| `skipAssignments` | ファイルを作ったインストールに属する `screens` と `homeFor` を除きます。`roles` は残ります。 |
| `remap` | ここでの呼び名です。`tags`(ファイルがタグを指すとおり、または `devices` が移動した後に読めるとおりの、キー全体からキー全体へ)、`devices`(id から id へ。`tags` で指定されていないすべてのタグのデバイス部分も移動します)、`entities`、`scripts`、`recipes`、`equipment`(id から id へ)。画面で何も使っていないエントリーは警告です。 |
| `dryRun` | レポートを返し、何も保存しません。常に `200` です。 |
| `codesys`, `visualization` | `file` の代わりに、CODESYS ネイティブエクスポートのテキストと、複数含まれる場合に使うビジュアライゼーションを指定します。このときレポートには、各要素が何になり、何が除外されたかを示す `conversion` が入ります。[CODESYS 画面のインポート](/ja/iot/codesys-screen-import/)を参照してください。 |

応答は、何かが保存されたかどうかにかかわらずレポートです。

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

欠けている参照は、最初の1つだけでなくすべてが一覧になります。`kind` は `file`(画面ファイルではない、形式が違う、このビルドが読むより新しい形式バージョン、または未知のフィールド)、`screen`(ダッシュボード自体の規則: 不正なカード、存在しないロール、大きすぎる)、`tag`、`entity`、`script`、`recipe`、`device`、`equipment`、`writable`(書き込み不可のタグのボタンまたは設定値)、`assignment`(別のダッシュボードが持つ画面名またはロールのホーム)、`exists`(id が使用済み)のいずれかです。問題が1つでもあるインポートは何も保存せず、`400` になります。問題が `exists` または `assignment` だけの場合は、同じレポートとともに `409` です。成功は `201`、既存のものを置き換えた場合は `200` で、レポートと保存された `dashboard` が付きます。サブジェクト `dashboard:<id>` の `config` イベントとして記録されます。

## Webhook

### `POST /api/webhook/{path}`

そのパスに `webhook` トリガーを持つすべてのオートメーションを発火します。**セッションも権限もありません。** パスが第三者に渡される秘密であり、このエンドポイントが常に持ってきたのと同じ信頼モデルです。SCADA システムや SaaS のコールバックにはログインするアカウントがありません。誰にも推測できないパスを選んでください。

最大 1 MiB の本文がルールに渡されます。`202` `{"accepted":"fill-now"}`。待ち受けているものがなければ `404` `"no automation is listening on this webhook path"` です。何もない場所に送る Webhook は、動作している Webhook と見分けがつかないため、そう伝えます。

## フリート

登録済みのエッジリレー、Sparkplug 上のライブの稼働状況、およびそれらへのコマンドです。`HOTLOOP_FLEET_ENABLED` が必要です。[フリート管理](/ja/gateway/fleet/)を参照してください。

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` は NBIRTH と NDEATH から決まります。`release` は、リレーが直近の birth で実行中と伝えたビルドです。`version`、`imageDigest`(スーパーバイザーが伝える場合。Helm チャートは伝えません)、`since`(Gateway がそのビルドを最初に聞いた時刻)。報告するには古すぎるリレーにはありません。`statusUrl` を持つメンバーでは `polled` が true になり、`reachable`、`forwardQueueLen`、`devices`、`connected`、`config`、`updateMode`(`auto` または `approve`)はその `/status` から来ます。到達できなかったときは意味を持ちません。機能がオフのときは `{"members":[],"configured":false}`。

### `POST /api/fleet`

メンバーを作成または置き換えます。`id`、`name`、`group`、`nodeId`(Sparkplug の識別)は必須、`description`、`statusUrl`(`http://` または `https://`)、`enabled` は任意です。メンバーを返します。これは機能がオフでも動作するため、オンにする前にフリートを宣言できます。

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`、または `404`。

### `POST /api/fleet/{id}/rebirth`

リレーに `Node Control/Rebirth` を発行します。本文なし。`{"status":"rebirth requested"}`。不明なメンバーは `404`。

### `POST /api/fleet/{id}/restart`

`Node Control/Reboot` を発行します。`{"status":"restart requested"}`。管理者のみ。リレーを再起動すると、戻るまでデータが途切れます。

### `POST /api/fleet/{id}/update`

リレーが保留している イメージ更新を承認します。`Node Control/Update` を発行します。`{"status":"update approved"}`。管理者のみ。リレーは終了し、スーパーバイザーが追従するイメージを起動するため、その間データが途切れます。`HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve` に設定されたリレーでのみ動作し、ほかのリレーは無視したことをログに残します。リクエストはイメージを指定しません。指定を入れる場所がなく、それが要点です。[Edge Relay リファレンス](/ja/edge-relay/reference/#relay-の更新)を参照してください。

### `POST /api/fleet/{id}/config`

新しいデバイスファイルをリレーにプッシュすると、リレーはそれをライブで適用します。再起動はなく、ブローカーセッションと転送キューは保たれ、ファイルが変更しなかったデバイスはすべて接続されたままです。本文は**デバイスファイルそのもの**で、何にも包まない生の JSON です。何かを発行する前に検証されます(そうでなければ `400` `"invalid device file: ..."`)。`{"status":"config pushed"}` は、ブローカーが受け取ったという意味です。リレーが実行しているかどうかは、`GET /api/fleet` のそのメンバーの `config.digest` で分かり、リレーが拒否したファイルはそこに `config.rejected` として表示されます。管理者のみ。リレーがポーリングする対象を変更します。[フリート管理](/ja/gateway/fleet/#設定のプッシュ)を参照してください。

### `DELETE /api/fleet/{id}/config`

プッシュを取り消します。ブローカー上の保持された設定を消して、以降のどの起動でも適用されないようにし、いま接続中のリレーはプッシュされたファイルを捨ててライブでローカルのデバイスファイルに戻ります。本文なし。`{"status":"config push cleared"}`、不明なメンバーは `404`、Gateway がブローカーに接続されていなければ `503`。プッシュと同様に管理者のみ。何も再起動しません。リレーがオンラインの間に送ってください。オフラインのリレーには届きません。[Edge Relay リファレンス](/ja/edge-relay/reference/#プッシュされたファイルの場所とどちらが優先されるか)を参照してください。

## 通知

アラームが発生したときに Webhook、SMTP、ntfy、Gotify で携帯電話を呼び出し、誰も確認しなければ次の人に知らせます。`HOTLOOP_NOTIFY_ENABLED` が必要です。

### `POST /api/notify/test`

設定されたすべてのチャネルに、いま合成アラーム通知を送ります。本物のアラームより先に SMTP リレーに拒否されることが分かります。本文なし。`HOTLOOP_NOTIFY_ENABLED` が必要です。管理者のみ。実際のメッセージを送り、プロバイダーが許す割り当てを消費します。

```json
{"results":[{"channel":"smtp","success":true}]}
```

各チャネルが動作したかどうかにかかわらず `200` で、それぞれの結果が伝えます。失敗したものには `error` が付きます。失敗した Webhook はスキームとホストだけを示し、それ以外は示しません。多くの呼び出しサービスでは URL が資格情報だからです。[アラーム通知](/ja/iot/notifications/)を参照してください。

### `GET /api/notify/escalation`

アラームのエスカレーションポリシー、ステップが指定できるチャネル、いま開いているチェーンです。`HOTLOOP_NOTIFY_ENABLED` が設定されていないと、`available` は `false` でポリシーはオフ、チャネルはありません。その場合も応答は `200` です。読み取りも書き込みも管理者のみです。ポリシーには人々の ntfy トピックが含まれ、誰でも到達できるサーバーではそれがパスワードになるためです。

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` はこの HotLoop に設定されているもので、ステップが指定できるのはそれだけです。`active` はチェーンをたどっているすべてのアラームです。ポリシーにある送信回数(ステップ、次に繰り返し)のうちいくつが送られたか、次がいつ予定されているかを示します。まだ何も保存されていなければ `{"policy":{"enabled":false},...}` で、オフで何も入っていません。

### `PUT /api/notify/escalation`

ポリシー全体を置き換えます。パッチではなく、`GET` が返すものを返します。これから発生するアラームに適用されます。通知が有効でなければ `400`。

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` は `critical`、`high`(既定)、`medium`、`low` です。ステップは前のステップから `afterMinutes`(1 から 1440)後に予定され(最初のステップは発生後)、一覧の `contacts`、デプロイに存在する `channels`、またはその両方を指定します。ステップは最大 10、連絡先は 50、繰り返しは 20 までです。未知のフィールドは拒否されます。

ポリシーが機能しない場合は、対処できる言葉で理由を付けて `400` になります。誰も指定していないステップ、一覧にない連絡先、この HotLoop に設定されていないチャネル(応答は設定されているものを挙げます)、ntfy が設定されていない ntfy トピックやメールが設定されていないアドレス、単純でないアドレス、間隔のない繰り返しです。拒否された場合は何も保存されません。保存はトピックを除いてシステムログに残ります。[アラーム通知](/ja/iot/notifications/#エスカレーション)を参照してください。

### `POST /api/notify/ack/{token}`

ntfy 通知の**確認**ボタンです。これを押す携帯電話には送るセッションがないため、**セッションも権限もありません。** パス内の署名付きトークンが認可であり、認可するのは、期限(`HOTLOOP_NOTIFY_ACK_TTL`、既定 12 時間)までに1つのアラームの1回の発生を1度だけ確認することだけです。昨日の出動のボタンで今日のものは確認できません。意図的に `POST` です。リンクのプレビューやセキュリティスキャナーは自分でリンクを開くため、アラームがロボットに確認されてはならないからです。本文なし。確認されたアラームを返します(形はハンドラーから取ったものです。この文書のほかの例は稼働中の Gateway から取りましたが、これはその Gateway に ntfy がなかったため取れていません)。

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

確認リンクがオフの場合:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

アラームエンジンを通る通常の確認で、`notify:<channel>` として監査されます。すべての拒否は応答され、記録されます。黙って何もしないボタンは、誰も押していないボタンと見分けがつかないためです。

| ステータス | 条件 |
|---|---|
| 403 | 偽造された、改ざんされた、または別のシークレットで署名された |
| 404 | アラームがすでに存在しない、または確認リンクがオフ(`HOTLOOP_PUBLIC_URL` とボタンのあるチャネルが必要) |
| 409 | すでに使用された、その後アラームが再び発生した、または確認するものが残っていない |
| 410 | 本物だが期限切れ |
| 503 | 確認を保存できませんでした。2回目の押下がまだ有効になるようリンクは返されます |

応答には `Access-Control-Allow-Origin: *` が付き、ntfy の Web アプリが自身のオリジンからこれを押せます。このルートでクッキーは読み取られません。トークンはどこにも記録も返却もされません。[アラーム通知](/ja/iot/notifications/#確認応答リンク)を参照してください。

## バックアップ

テーブルデータのみの、論理データベーススナップショットです。`HOTLOOP_BACKUP_ENABLED` が必要です。どちらも管理者のみ。一覧にはユーザーとセッションを含むすべてのテーブルの行数が表示されます。**復元のエンドポイントはありません。** 意図的です。復元はバイナリのフラグで、データベースがそれを受け取る前提だと知っている人が1度だけ実行するものであり、稼働中のものに対するネットワーク呼び出しではありません。[バックアップと復元](/ja/iot/backup/#バックアップの復元)を参照してください。

### `GET /api/backup`

ボリューム上のバックアップを、それぞれのマニフェストとともに返します。

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

いま1つ取得し、完了を待ちます(最大 30 分。大きな `tag_history` は時間がかかります)。本文なし。マニフェストを返します。バージョン、マイグレーション、すべてのテーブルの行と列です。

## スケジュール済みレポート

ヒストリアンの集計を CSV と HTML で、スケジュールに従い、メールまたはダウンロードで提供します。`HOTLOOP_REPORTS_ENABLED` が必要です。ビューアーは読み取り、オペレーターは実行し、管理者は定義します。定義にはプラントのデータをメールで送る先が含まれます。定義のフィールドは[スケジュール済みレポート](/ja/gateway/reports/)を参照してください。

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

各定義には `nextRunAt` と、直近の実行が `lastRun` として入ります。

### `POST /api/reports`

定義を作成します。本文は上記の定義です。`201`。検証に失敗すると `400`(`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`)、id が存在すれば `409`。

### `GET /api/reports/{id}`

一覧にあるものと同じ形の定義1つ。不明なものは `404`。

### `PUT /api/reports/{id}`

定義全体を置き換えます。id は変更できません(本文の id が違えば `400`)。`nextRunAt` と `lastRun` は受け取って無視されるので、読み取ったものをそのまま送り返せます。

### `DELETE /api/reports/{id}`

実行とファイルとともに削除し、実行中のものがあれば取り消します。`{"deleted":"line1-hourly"}`、または `404`。

### `POST /api/reports/{id}/run`

いま実行して待ちます。`?deliver=false` は、誰にもメールを送らずに生成して保存し、定義を試すときに使います。`200` は実行が行われたという意味で、レポートがうまくいったかどうかは、その `status` が示します。失敗した実行は不正なリクエストではなく結果であり、どちらの場合も記録されます。

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

true でも false でもない `deliver` は `400`、不明なレポートは `404`。

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`、新しい順、`?limit=` 既定 50、最大 500。不明なレポートは空の一覧ではなく `404`。

### `GET /api/reports/{id}/runs/{run}/download`

保存された1つのファイルを添付ファイルとしてストリーミングします。`?format=csv` または `html`。

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML は `sandbox` の Content-Security-Policy で提供されます。レポートは読むための文書であり、何かを実行してよいページではありません。開かれるファイルは実行記録が指すものであり、URL のどの部分もパスの一部にはなりません。実行番号が数値でない、または形式がどちらでもない場合は `400`、存在しない実行やファイルは `404`。

## サイト

### `GET /api/sites`

Gateway が連携しているすべてのサイトに、MCP でプラントの状態を並列に問い合わせます。サイトごとに 6 秒なので、止まったサイト1つが残りを待たせることはありません。サイトは設定にある外向きの MCP サーバーです。[MCP](/ja/iot/mcp/#サイトの連携)を参照してください。

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

到達できないサイトの件数は意味がなく、集計から除かれます。到達できないサイトをアラーム 0 件と数えることは、この画面ができる最も危険なことになるからです。サイトが設定されていなければ `{"configured":false,"sites":[]}`。

## 設定

### `GET /api/settings`

すべての設定、その有効な値、値の出どころ、値を設定する変数です。

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` は `stored`、`environment`、`default` のいずれかです。`secret` は `set` か `not set` だけです。`envVar` は値の出どころの変数です。一部の設定は `HOTLOOP_` の変数が空のときに2つ目の変数にフォールバックし(タイムゾーンは `TZ`、データベースは `POSTGRES_HOST`、`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`)、フォールバックが有効な場合は `envVar` がそれを示します。空文字列に設定された変数は、設定の扱いと同じく未設定とみなされます。ポーリングの設定はミリ秒で表示されますが、その変数は期間(`5s`、`500ms`)または秒数だけの数値を受け付けます。

`Server` グループの `product` は、これがどの HotLoop かを示します。この製品にない機能をデプロイが有効にしていても(たとえば IoT での `HOTLOOP_REPORTS_ENABLED=true`)、起動は妨げられません。起動時に警告としてログに残り、変数とその機能がある場所を示す1行とともに、追加グループ `Not in this product` に一覧されます。設定はそのまま残るので、その機能がある製品で同じ構成を使えば有効になります。そのような設定がなければ、グループは表示されません。

### `PUT /api/settings`

プラントの識別設定のみを変更します。

| キー | 型 |
|---|---|
| `ui.plantName` | 文字列、最大 200 文字 |
| `ui.siteId` | 文字列、最大 200 文字 |
| `ui.timezone` | このマシンが知っている IANA 名(`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | 秒の整数、10 から 43200: 誰もパネルに触れていないとき、キオスクのサインインが保たれる時間。既定 900 |
| `ui.lockoutAttempts` | 整数、0 から 100: 1つのアカウントをロックする、連続した誤ったパスワードまたは PIN の回数。既定 10、0 はロックアウトなし |
| `ui.panelDelaySeconds` | 秒の整数、0 から 30: 誤りの後、ユーザー名なしで入力された次の PIN を確認するまでにキオスクパネルが待つ最大時間。既定 3、0 は待機なし |
| `ui.lockoutSeconds` | 秒の整数、10 から 86400: ロックされたアカウントがロックされたままになる時間。既定 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

`GET` と同様に、すべての設定を返します。それ以外のキーは、それを挙げて 400 になります。

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

これは意図的です。書き込みスイッチは、このプロセスが機械を動かせるかどうかを決めるものであり、書き込みを発行する同じブラウザーからオンにできる制御は制御ではありません。変更はデプロイで行います。

## ヒストリアンターゲット

HotLoop が自身のデータベースに加えて履歴を書き込む、プラント自身のデータベースです。[ヒストリアンターゲット](/ja/iot/historian-targets/)を参照してください。設定を読み取るすべてのロールが、それらと各ターゲットの状況を見られます。ターゲットはプラントのデータが送られる場所なので、変更は管理者のみです。パスワードはデバイス資格情報キー(`HOTLOOP_SECRET_KEY_FILE`)で封印され、応答には含まれません。`passwordSet` は保存されているかどうかを、`passwordProblem` は保存されているものを開けない理由を示します。すべての変更はログに残り、すぐに有効になります。

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

`kinds` は、この HotLoop が書き込むデータベースと、それぞれがフィールドを何と呼ぶかです。InfluxDB は、ほかがパスワードを持つ場所にトークンを持ち(`password` がそれを運びます)、データベースの代わりにバケット(`database`)、テーブルの代わりにメジャメント(`table`)を持ち、ほかのどれにもない組織(`org`)を持ちます。`status.state` は `up`、`catching-up`(稼働中で、HotLoop 自身の履歴から受け取るべきものをまだ送っている)、`down`、`starting`、`off`(オフに切り替え済み)のいずれかです。`queued` は `queueCap` のうち、メモリ内で待機しているものです。`written` はライブで送られた読み取り値を、`backfilled` は HotLoop 自身の履歴から送られたものを数えます。`dropped` は、ターゲットが追いつけない間にキューが手放した読み取り値を数えます。受け取るべきものであり、失われたものではありません。`refused` はデータベース自身が受け付けなかった読み取り値を数え、その理由は `lastRefusal` にあります。`owedFrom` と `owedTo` は、まだ受け取るべき範囲です。終端がまだ開いている間、つまりターゲットが停止している間は `owedTo` がありません。

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` は小文字、数字、`-` の 1 から 63 文字で、システムログでターゲットを指します。`address` は `host` または `host:port` で、ログイン情報を含めません。ポートがなければ、種類の既定のポートが補われます。`table` の既定は種類の `defaultTable` で、スキーマを付けられます(`history.hotloop`)。`org` は InfluxDB 2 の組織です。`enabled` の既定は true です。パスワードにはキーが必要です。`HOTLOOP_SECRET_KEY_FILE` がなければ `400` で、平文では保存されません。ターゲットとそのステータスとともに `201`、id が使用済みなら `409`。

### `PUT /api/historian/targets/{id}`

`id` を除く上記のどのフィールドでも指定できます。送らなかったものは残ります。`"password":""` はパスワードを消します。変更するとターゲットは新しい設定で再開し、受け取るべきものは引き続き受け取るべきままです。ターゲットとともに `200`。

### `DELETE /api/historian/targets/{id}`

そこへの書き込みをやめ、受け取るべきだったものを忘れます。すでに持っているものはそのデータベースに残ります。設定を保つには、代わりに `"enabled":false` でオフにしてください。`200` `{"deleted":"plant-pg"}`。

## システムログ

### `GET /api/events`

すべての変更、書き込み、ログイン、接続の遷移を新しい順に返します。

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `category` | 繰り返し可: `system`、`device`、`tag`、`write`、`alarm`、`automation`、`mcp`、`config`、`auth` |
| `severity` | 繰り返し可: `debug`、`info`、`warning`、`error` |
| `subject` | 完全一致: デバイス id、タグキー、entity_id、`equipment:4`、`label:critical` |
| `q` | 大文字小文字を区別しない検索 |
| `minutes` | 直近 N 分のみ |
| `limit` | 既定 200、最大 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` はユーザー、`system`、`automation:<id>`、または `mcp:<client>` です。`detail` があれば、文字列としての追加の JSON です。

## ログブック

### `GET /api/logbook`

起きたことの1本のタイムラインを新しい順に返します。エンティティの状態変更、書き込み、アラームの遷移、オートメーションとスクリプトの実行、そしてシステムログの設定変更とサービス呼び出しです。履歴はそれぞれの場所で読まれて統合されるため、各履歴は独自の保持期間を保ちます。数値の読み取り値は含まれません。それは `GET /api/history` の役割です。[ログブック](/ja/iot/logbook/)を参照してください。

| クエリ | <span class="sr-only">詳細</span> |
|---|---|
| `entity` | このエンティティに関するものだけ: 状態変更、このエンティティとそのタグへの書き込み、アラーム、トリガーされた、またはこのエンティティに書き込んだオートメーションの実行、設定変更 |
| `equipment_id` | 同じ規則で、設備ツリーのこのノードまたはその配下で起きたものだけ。`entity` とは併用できません |
| `actor` | 誰が行ったかの、大文字小文字を区別しない一部: ユーザー、`automation:<id>`、`mcp:<client>` |
| `kinds` | カンマ区切り、または繰り返し: `state`、`write`、`alarm`、`automation`、`event`、`script`、`recipe` |
| `from`, `to` | RFC 3339 の時刻。`from` は含み、`to` は含みません |
| `limit` | 既定 100、最大 1000 |
| `before` | 前のページの `next` |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` は、その履歴内での行の id(状態変更ではエンティティの不変の id)で、`at`、`kind` とともに `next` がエンコードするものです。このページの次のページは、その間に何が追加されても、その順序で厳密に古いすべてです。`next` は最後のページでは省かれます。`suppressed` は、そのエンティティが一度に 10 件、その後は 2 秒に1件より速く変化していたために、この変更より前に記録されなかった変更の数です。

不明な種類、不正な形式の時刻、`to` より前でない `from`、1000 を超える limit、でっち上げのカーソル、または `entity` と `equipment_id` の併用は `400`、存在しないノードは `404` です。応答しているプロセスでログブックが動いていなければ `503`。

## ライブフィード

### `GET /api/stream`

開いている間の、一方向のサーバー送信イベントです。トラフィックが一方向にしか流れないため、WebSocket ではなく SSE を使い、開いているダッシュボードの下でポッドが再起動しても、イベントストリームは自分で再接続します。`EventSource` はセッションクッキーを送り、スクリプトはベアラートークンを送ります。

接続すると `retry: 3000` に続いて現在の状況が届くので、何かが変わる前に画面が埋まります。

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

その後は、起きるたびに届きます。

| イベント | データ | 条件 |
|---|---|---|
| `values` | 読み取り値の配列、`GET /api/values` の形、タグごとに最新のもの、**読み取り値が変わったタグのみ** | 変わったものがあれば 250 ms ごと。値、テキスト、単位、品質、理由が最後に送ったものと同じタグは省かれ、30 秒間送られなかった場合に再び送られるので、安定した値の `timestamp` がそれより古くなることはありません。ドライバーはポーリングごとにすべてのタグを読みます。4.19.5 は毎回すべてを送っていて(テスターの 2232 タグで毎秒4回、約 150 KB)、低速な回線のページは数分遅れていました |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | エンティティの状態が変わったものがあれば 250 ms ごと。`removed` は、無効化、削除、または名前変更で消えたエンティティです |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`、アラームとそれに起きたこと(`raised`、`acked`、`cleared`、`shelved`、`unshelved`、`suppressed`、`unsuppressed`) | 即時: アラームの遷移はまれで、1件ごとが重要です |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | 即時: デバイスが切れたときは、次のフラッシュではなく画面がすぐ赤くなるべきです |
| `logbook` | `{"kinds":["state","write"]}`、新しい項目があるログブック項目の種類 | 最大で毎秒1回。項目は含まれません。画面が何を表示すべきかはそのフィルターによるため、自分のページを `GET /api/logbook` に求めます |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

20 秒ごとのコメント行(`: heartbeat 2026-09-27T20:35:00Z`)が、プロキシによるアイドル接続の切断を防ぎます。開いているページごとに独自のペースで送られます。書き込み側は直前の送信にかかった時間だけ(最大5秒)休み、その間に届いたものはタグごと、エンティティごとに最新のものだけ保持されるので、低速な回線のページはプラントより1、2回分の送信遅れにとどまり、数分遅れることはなく、何も失わず、ほかのページから何も奪いません。リクエストが `Accept-Encoding: gzip` を示すと(ブラウザーは示します)ストリームは gzip で圧縮され、テスターの最初の画面は回線上で約 326 KB から約 11 KB になります。応答は `X-Accel-Buffering: no` を設定します。バッファリングするプロキシは、ライブフィードを非常に遅いダウンロードに変えてしまうからです。

ストリームは5秒ごとにセッションを再確認し、セッションがなくなると閉じます。サインアウト、期限切れ、失効、アカウントの無効化、または `status.read` がもう許可されていない場合です。先にイベントを送ることはありません。ブラウザーの `EventSource` は再接続し、上記の `401` を受けて停止します。`HOTLOOP_AUTH_INSECURE=true` ではセッションがなく、確認するものもありません。この確認はセッションの使用とは数えられないため、開いたままの画面がセッションを保ち続けることはありません。

## MCP

### `/mcp` と `/mcp/`

エージェント向けの Model Context Protocol、ストリーミング可能な HTTP トランスポートです。どのメソッドも受け付けます。トランスポートは、呼び出しに `POST`、サーバー自身のストリームに `GET`、セッションの終了に `DELETE` を使います。パスは `HOTLOOP_MCP_PATH`(既定は `/mcp`)で、エンドポイントは `HOTLOOP_MCP_ENABLED` がオンのときだけ存在します。

セッションログインの背後には**ありません。** 独自のベアラートークン `HOTLOOP_MCP_TOKEN` があり、ハンドラーの手前で確認されるので、トークンのない呼び出し元はツールを一覧することさえできません。

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

トークンが設定されていない場合、HotLoop は最初の起動時に1つ作ってデータベースに保持するため(`hotloop mcp-token` が表示します)、エンドポイントが開いたままになることはありません。エージェントはほかと同じ呼び出し元です。読み取りも書き込みも行い、書き込みはすべての人と同じ書き込みゲートを通り、`mcp:<client name>` として監査されます。ツールとリソースは[MCP](/ja/iot/mcp/)にあります。

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

`Mcp-Session-Id` ヘッダーと、サーバーの機能および指示とともに応答します。

## UI

### `GET /manifest.webmanifest`

携帯電話が UI をアプリとしてインストールできるようにする Web アプリマニフェストです。製品名とプラント名、`display` `standalone`、テーマカラー、アイコン(192 と 512 ピクセルの PNG、マスク可能な 512、SVG)、アラームとダッシュボードへのショートカットが含まれます。その中のすべての URL はマニフェスト自身を基準にした相対パスなので、HotLoop がどこにマウントされていても正しく動きます。名前は設定で決めたプラント名に従い、応答は `Cache-Control: no-cache` なので、名前を変えると次に見たときに反映されます。セッションなし: 携帯電話は誰かがサインインする前に要求します。[ダッシュボード](/ja/iot/dashboards/#スマートフォンで)を参照してください。

### `GET /sw.js`

HotLoop がマウントされた場所のルートにあるサービスワーカーで、スコープがアプリ全体を覆います。ページと、人が見る読み取りへの直近の応答を保持し、HotLoop に到達できないときは古いものとして印を付けて返します。書き込みに応答したり、保持したり、キューに入れたりすることは決してありません。実行中のバージョンがその中にあるため、リリースごとに独自のページキャッシュを持ちます。`Cache-Control: no-cache`、セッションなし。安全なコンテキスト(https または `localhost`)のブラウザーだけがこれを実行します。

### `GET /next` と `GET /next/`

古い UI が既定だった頃に UI があった場所です。どちらもルートへの `301` なので、当時作ったブックマークも引き続き届きます。

### `/`

`web/` からバイナリにビルドされた Web UI です。ページ、そのスクリプト、スタイル、フォント、サービスワーカー、インストール可能なアプリのアイコンで構成され、その中のすべての URL はページを基準にした相対パスなので、ホストのルート、パスの下、プロキシの背後、EmberNet ダッシュボードの iframe の中でも動作します。サーバーはタイトルと1つのデータブロック `<script type="application/json" id="iiot">` を埋め込み、そこにはサーバーだけが知っていること、つまりプラント、サイト、製品、機能、書き込みポリシー、タイムゾーンが入ります。`GET` と `HEAD` のみで、ほかのメソッドは `405` です。自身のファイルではないパスは `404` です。タイプミスに対してページを返すと動作している画面のように見えてしまうためで、UI なしでビルドされたバイナリは、そのこととビルド方法をプレーンテキストで伝えます。セッションなし: ログインするまでページはログインフォームです。
