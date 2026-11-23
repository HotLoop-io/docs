---
title: "エージェント向け MCP"
description: "エージェントに工場全体を読み取らせ、有効にしたものだけを書き込みゲート経由で操作させ、書き込みごとに理由を記録します。"
---

ゲートウェイは MCP を双方向で話します。エージェントは工場を読み取って操作でき、オートメーションのルールは別の場所のツールを呼び出せます。

設計上のルールは、**エージェントも他と同じ呼び出し元である**ということです。ツールは UI が読むのと同じキャッシュを通して読み、UI が書くのと同じゲートを通して書きます。特権的な経路も、バイパスも、別のポリシーもありません。オペレーターなら拒否される書き込みは拒否され、成功した書き込みはアクターの前に `mcp:` が付いて同じ監査テーブルに記録されます。

## 提供方法

### HTTP 経由

既定でアプリのポートの `/mcp` で有効で、チャートがリリースの Secret に生成する Bearer トークンで保護されます。

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

クラスター内では、エンドポイントは次のとおりです。

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

トークンの確認はハンドラーの手前にあるため、認証されていない呼び出し元は何が存在するかを列挙することもできません。`mcp.token` を空のままにすると、チャートが 1 つ生成するので、既定のデプロイが誤って開放状態になることはありません。NetworkPolicy と組み合わせてください。トークンは第 2 の防御線であり、唯一の防御線ではありません。

エンドポイントは決して開放されません。`HOTLOOP_MCP_TOKEN` なしでバイナリ(Quadlet ユニット、素の `hotloop`)を実行すると、初回起動時にトークンを作成してデータベースに保持するため、再起動後も、すべてのレプリカでも、リストア後も同じものが戻ってきます。`hotloop mcp-token` がそれを表示します(ログには作成したことだけが残り、中身は決して残りません)。自分で選ぶには `HOTLOOP_MCP_TOKEN` を設定します。`HOTLOOP_MCP_OIDC_*` を設定すると、エンドポイントはログインを受け付け、独自のトークンは持ちません。以前、何もなしで素のバイナリに接続していたクライアントは、`Authorization: Bearer <that token>` を送るまで `401` を受け取ります。

### Vord ログインまたはハブのアサーション

静的トークンはどのクライアントが呼び出したかは示せますが、どの人かは示せません。OIDC を設定すると、`/mcp` は `Authorization: Bearer <jwt>` も受け付け、検証された人のメールが監査上のアクターになります。書き込みは `mcp:<client name>` ではなく `mcp:pat@example.com` として記録されます。未設定のときの動作は変わらず、静的トークンもその隣で引き続き機能します(静的トークンが未設定なら、検証済みの JWT だけが入れます)。

| 変数 | チャートの値 | 役割 |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | Vord レルムの URL。そのアクセストークンを受け付けます |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | すべてのトークンが持たなければならない `aud`。この 2 つのどちらかと併せて必須です |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | ID ハブのアサーション鍵。そのアサーションを受け付けます |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | 呼び出し元が持たなければならないレルムのロール |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | 呼び出し元ごとに書き込みを制限します。下記を参照 |

Vord のアクセストークンは、発行者の JWKS(ディスカバリードキュメントから取得し、10 分間キャッシュし、未知の `kid` では再取得)に対して検証されます。RS256 または ES256 のみ、`iss` は発行者と同じ、`aud` はオーディエンスを含む、`exp` と `nbf` は 30 秒の許容差、そして `email`(または `preferred_username`)クレームが必要です。Vord は既定で `aud` に `account` だけを入れるため、設定したオーディエンスのためにクライアントスコープへ audience マッパーを追加してください。

ハブのアサーションは、`typ` が `fb-assert+jwt`、EdDSA、`iss` が `fireball-hub`、`aud` が設定したオーディエンス(Hub モジュールは `hotloop` を送る)で、有効期限内、Hub の JWKS にある鍵で署名されたものです。`jti` のリプレイキャッシュはありません。1 回のツール呼び出しは同じアサーションを運ぶ複数の HTTP リクエスト(initialize、続いて呼び出し)であり、アサーションの有効期間は 60 秒だからです。呼び出しが他の誰かのために動作するとハブが言う場合(`acting_as`)、アクターは `mcp:<email> for <acting_as email>` と表示されます。

書き込みには引き続きマスタースイッチである `HOTLOOP_ALLOW_WRITES` が必要で、トークンがそれを広げることはありません。`HOTLOOP_MCP_OIDC_WRITE_ROLE` は呼び出し元ごとに書き込みを絞ります。`hotloop:hotloop.write` はクライアント `hotloop` の Vord クライアントロール `hotloop.write`(`resource_access.hotloop.roles`)を意味し、名前だけならレルムロールを意味し、Hub のアサーションは `abilities` にロール名を持たなければなりません。それを持たない呼び出し元は読み取りはできますが、`write_tag`、`call_service`、`run_script`、`apply_recipe`、`trigger_automation`、そして構成を変更するすべてのツールは拒否されます。静的トークンはこれによる制限を受けません。

### stdio 経由

同じバイナリが、直接起動するクライアント向けに、`--mcp-stdio` で stdin と stdout 上の MCP を提供します。他のすべても起動するため、エージェントは空のサーバーではなく稼働中の工場を見ます。

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

stdio モードでは、すべてのログが stderr に出力されます。stdout に書かれたものは何であれ、プロトコルのストリームを壊してしまいます。

## ツール

171 個あります。工場を読み取って操作するものが 27 個、構成を変更するものが 69 個([下記](#構成の変更))、それに付随する読み取りとドライランが 33 個([下記](#読み取りとドライラン))、管理用が 42 個([下記](#管理))です。

| ツール | 内容 |
|---|---|
| `get_plant_status` | オンラインのデバイス、未処理のアラーム、書き込みが有効かどうか |
| `list_devices` | プロトコル、アドレス、状態、タグ数を含むすべてのデバイス |
| `describe_device` | タグとポーリング統計を含む 1 つのデバイスの詳細 |
| `list_tags` | デバイス、名前、説明でカタログを検索 |
| `read_tag` | 品質を含む現在値 |
| `query_history` | 生またはバケット単位の履歴値 |
| `write_tag` | **タグにコマンドする** |
| `list_alarms` | アラームとその ISA-18.2 状態 |
| `ack_alarm` | オペレーターに代わって確認応答する |
| `list_automations` | ルール、実行回数、最後の結果 |
| `trigger_automation` | ルールを今すぐ実行する |
| `describe_protocol` | このビルドが実際に話すプロトコル |
| `recent_events` | 何がどの順で起きたかを突き止めるためのシステムログ |
| `list_entities` | ドメイン、設備ノード、ラベルでエンティティを探し、それぞれが受け付けるサービスを表示 |
| `get_states` | 1 つ以上のエンティティの現在の状態、品質と属性付き |
| `call_service` | **エンティティにコマンドする**: `switch.turn_on`、`number.set_value` |
| `get_logbook` | エンティティ、設備ノード、アクター、種類ごとの、状態変化、書き込み、アラーム、実行、構成変更の 1 本のタイムライン |
| `list_scripts` | 工場のスクリプト、それぞれが受け取るフィールド、実行中かどうか、最後の実行 |
| `run_script` | **スクリプトを実行する**、または `dryRun` で今何をするかを問い合わせる |
| `list_recipes` | 工場のレシピ: 順序付きのターゲット、パラメーター、前提条件、バージョン、最後の適用 |
| `validate_recipe` | レシピは今適用できるか。拒否されるすべての理由。何も書き込まない |
| `apply_recipe` | **レシピを適用する**: 全体を検査し、順に書き込み、読み戻す |
| `list_blueprints` | ルールを作るために人が入力するブループリント、その入力とバージョン |
| `preview_blueprint` | 与えた入力でブループリントが作るルールと、それが今何をするか。何も作らない |
| `find_network_client` | 工場ネットワーク上のデバイスの場所: そのスイッチポート、ポートにリンクがあるか、UniFi コンソールが最後に見た時刻 |
| `get_network_topology` | UniFi コンソールが描く工場ネットワーク: 何が何につながっているか、各デバイスの状態、そのスイッチが落ちるとネットワークを失う HotLoop デバイス |
| `get_network_events` | UniFi コンソールが報告した最新のイベントと、イベント WebSocket が稼働中かどうか |

### エンティティ

エンティティとは、`sensor.zone_1_temperature` や `switch.conveyor_run` のように人が工場の何かを呼ぶ名前で、1 つ以上のタグを包みます。[エンティティ](/ja/iot/entities/)を参照してください。エージェントにとっては、たいていこちらのほうが扱いやすい取っ手です。名前に意味があり、エンティティが何をできるかを知っているからです。

`list_entities` は、`domain`、`equipment`(設備ツリーのノードを id、名前、または `Plant A/Packing` のような名前のパスで指定し、そのノードとその下のすべてに一致し、エンティティ自身の場所がそのデバイスの場所より優先される)、`label`(label_id または名前。エンティティがそのラベルを持つか、そのデバイスが持てば一致)、`query`(entity_id または名前の部分文字列)で絞り込みます。各結果には現在の状態と品質、そして受け付けるサービスが `domain.service` として含まれます。サービスのないエンティティは読み取り専用です。サービスはエンティティ層から来るため、そこでサービスが増えたドメインは、ここでも変更なしに現れます。

`get_states` は `entity_ids` を受け取り、それぞれについて状態、品質、属性、`last_changed` で応答します。`read_tag` と同じ線を守ります。`unknown` や `unavailable` の状態には値ではないという注記が付き、無効化されたエンティティは存在しないのではなく無効だと伝え、不良品質は明記されます。

`call_service` は `domain`、`service`、`entity_id`、`data`、そして**必須の** `reason` を受け取ります。

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

`POST /api/services/...` が使うのと同じ実行器である `entity.Services` を通り、呼び出しを書き込みゲートを通る書き込みに変換します。[書き込み](#書き込み)を参照してください。

### ネットワーク

`find_network_client` は、沈黙した PLC についての最初の疑問に答えます。PLC なのか、それともスイッチポートなのか。`deviceId` を渡すとそのデバイスの確認済みリンクをたどって UniFi クライアントまで行き、`query`(MAC、IP、または名前の一部)を渡すと HotLoop が読み取るすべてのコンソールを検索します。UniFi ドライバーの最後の読み取り結果を読み、コンソールは読まないため、エージェントがループで尋ねてもコンソールに負荷はかかりません。これは、`--mcp-stdio` ヘルパーが自分のプロセスでは読み取るコンソールがないと答えることも意味します。隣にある Gateway がすでにセッションを持っているため、コンソールにはログインしません。Gateway のエンドポイントに尋ねてください。[UniFi Network](/ja/iot/unifi/)を参照してください。

`get_network_topology` は地図です。各スイッチ、アクセスポイント、ゲートウェイが、つながっている上位の機器の下に、両端のポート、リンク、その上のクライアント数、その下のクライアントにリンクされた HotLoop デバイスとともに表示されます。最後の部分が影響範囲です。そのスイッチが落ちるとネットワークを失う PLC の名前を挙げます。コンソールが何にもつながっていないと列挙するスイッチはそう伝え、ゲートウェイにぶら下げられることはありません。`get_network_events` はコンソールの最新イベントを新しい順に、コンソール自身の文言、コンソールが否定的と呼ぶものには警告フラグ、イベント WebSocket が稼働中かどうかとともに示します。どちらもコンソールの `deviceId` を受け取り、HotLoop が 1 つだけ読んでいる場合は省略でき、どちらも `find_network_client` と同じくドライバーの最後の読み取りを読むため、コンソールに負荷はかからず、`--mcp-stdio` ヘルパーでは同じことを言います。そのプロセスでは読み取るコンソールがない、ということです。古いイベントは `get_logbook` にあり、関係したスイッチやアクセスポイントの下に分類されています。

### ログブック

`get_logbook` は `GET /api/logbook` が提供するタイムラインです([ログブック](/ja/iot/logbook/)を参照)。状態変化、書き込み、アラームの遷移、オートメーションの実行、構成変更が新しい順に並びます。`entity`、`equipment`(id、名前、またはパス、およびその下のすべて。2 つのノードに一致する名前は両方を列挙するエラー)、`actor`(その一部。`mcp:` はあらゆるエージェントが行ったすべてを見つける)、`kinds`、そして遡る `minutes`(既定は 1 日)で絞り込めます。後ろにまだあるページは、次のページのために `before` に何を渡すかを伝えて終わります。「これがおかしくなる前に何があったか」には、より良い `recent_events` です。設備自身の状態変化が含まれ、書き込みゲートの行は 2 回含まれません。

### スクリプト

スクリプトは、誰かが一度書いた名前付きのステップの並びで、CIP サイクルやラインのパージがその例です。そのため、エージェントは手順をでっち上げる代わりに、工場自身の手順を実行します。[スクリプト](/ja/iot/scripts/)を参照してください。`list_scripts` は、それぞれが受け取るものを伝えます。`run_script` は `scriptId`、`fields`、**必須の** `reason`、そして 2 つのスイッチを受け取ります。

- `dryRun: true` は、スクリプトを現在の工場の状態に照らして走査し、ステップごとに何が書き込まれるかと、ゲートが最初に拒否するものを、ゲートの言葉で伝えます。何も書き込まれず、監査もされません。まずこれを問い合わせてください。
- `wait: true` は、実行が終わってから結果とトレースとともに応答します。なければ応答は実行 id で、`list_scripts` や `kinds: ["script"]` を指定した `get_logbook` が、どう終わったかを伝えます。

実行はソースを `mcp` とする `script:<id>` としてスクリプトのものなので、実行が行うすべての書き込みは `write_tag` とまったく同じようにゲートに出会います。書き込みが無効(`HOTLOOP_ALLOW_WRITES`)なら、`trigger_automation` と同様に `run_script` は何かが実行される前に拒否します。ドライランはそれでも応答し、スイッチが理由だと伝えます。

### レシピ

レシピは、工場が一緒に適用する設定値の集合で、製品グレードや段取り替えがその例です。そのため、エージェントは値を 1 つずつ書く代わりに、工場自身の数値を読み込みます。[レシピ](/ja/iot/recipes/)を参照してください。`list_recipes` は、各レシピのターゲットを順に、受け取るパラメーターとともに示します。`validate_recipe` は、レシピが今適用できるかを尋ね、できない理由をすべて、何も書き込まずに示します。`apply_recipe` は `recipeId`、`params`、任意の `version`、**必須の** `reason` を受け取ります。

まず全体が検査され、いずれかの値が拒否されるなら、何も書き込まずに全体が拒否されます。範囲外の値は調整されず拒否されます。その後、ターゲットが 1 つの呼び出し id のもとで順に送られ、最初に失敗したものが残りを止め、何も元に戻されません。応答は、ターゲットごとに何が送られ、デバイスが値を読み戻したかを伝えます。書き込みはソースを `mcp` とするエージェントのものなので、ゲートはそれぞれに適用されます。書き込みが無効(`HOTLOOP_ALLOW_WRITES`)なら、`apply_recipe` は何かを検査する前に拒否します。独自の適用権限を指定しているレシピは、その権限を与えられた人のためのもので、エージェントはその中に含まれません。

### ブループリント

ブループリントは、型付きの空欄を持つルールを一度書いたものです。どのモーター、どれだけの時間、どの上限か、といったものです。[ブループリント](/ja/iot/blueprints/)を参照してください。`list_blueprints` は、それぞれが受け取るものを伝えます。`preview_blueprint` は `blueprintId`、`automationId`、`inputs` を受け取り、作られるルールと、そのルールが今発火したら何をするかを、すべての書き込みをゲートの検査にかけたうえで応答します。入力は画面が検査するのとまったく同じように検査され、範囲外の値は調整されず拒否されます。

`instantiate_blueprint` は、ブループリント画面が使う経路でルールを作ります。同じ検査を通り、ルールはエージェントを作成者としてログブックに記録されます。ルールは、トリガーが発火するたびに設備へコマンドするという常設の指示なので、エージェントはまず確認します。`preview_blueprint` は何も保存せず何も書き込まず、書き込みが有効かどうかにかかわらず応答します。作られたルールがその後に行うすべての書き込みは、人が作ったルールと同様に書き込みゲートに出会います。[構成の変更](#構成の変更)を参照してください。

## 構成の変更

エージェントが読み取れるものは、すべて変更できます。工場を読み取る上記のツールには、それを変更する対応するツールが 69 個あり、どれも 2 つ目の実装ではありません。それぞれが REST API の 1 つのルートで、呼び出しはそのルート自身のハンドラーを通して実行されます。検証、権限チェック、ランタイムの再読み込み、監査行はルートのものであり、エージェントがアクターです(`mcp:<client>`、Vord ログインなら `mcp:<email>`)。そのため、ドライバーのないデバイス、コンパイルできないルール、範囲外のブループリント入力、検出されたデバイスが受け入れられていないタグは、画面が示す言葉で拒否され、何も変更されません。

それぞれが、ルートのパス値を名前で(`id`、`device`、`name`...)、`body`(API が受け取るのと同じ JSON で、[HTTP API](/ja/iot/api/) にすべての body があります)、そして**必須の** `reason` を受け取ります。理由は、ルート自身の行の隣に、変更の対象に紐づけてシステムログの `config` 行として記録されます。

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

それらの前に立つものは、`write_tag` の前に立つものからマスタースイッチを除いたものです。画面も構成を変更するのにそれを必要としないからです。

1. 既定でオンの `HOTLOOP_ALLOW_MCP_WRITES` がオンでなければなりません。
2. `HOTLOOP_MCP_OIDC_WRITE_ROLE` が設定された呼び出し元は、それを持っていなければなりません。
3. 呼び出しは 1 つの権限、つまりそのルートが求める権限(下の表の 3 列目)だけを持ち、他は持ちません。ルートは、その権限を持たない人に答えるのと同じようにエージェントに答え、テストは表のすべての行を実在のルートとそのルートが求める権限に対応づけます。
4. 理由。

設備へのコマンドは引き続き `write_tag`、`call_service`、`run_script`、`apply_recipe`、`trigger_automation` で、`HOTLOOP_ALLOW_WRITES` がオンで、タグの書き込み可能マークと範囲を満たす必要があります。タグ、ルール、スクリプト、レシピを書き込み可能にすることは構成です。使われるまで何もコマンドせず、そのときコマンドするものはゲートを通ります。

管理者固有の機能も、下の[管理](#管理)にあるツールです。検出されたデバイスの受け入れは画面と同じくここにあり、そのデバイスのポイントは引き続き 1 つずつ書き込み用に有効にする必要があります。

ツールは `--mcp-stdio` にもあります。プロセスは同じ API サーバーを構築し、そのポートは開きません。

**デバイスとタグ**

| ツール | ルート | 権限 |
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

**ディスカバリーとブローカー**

| ツール | ルート | 権限 |
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

| ツール | ルート | 権限 |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**エンティティ、ヘルパー、設備、ラベル**

| ツール | ルート | 権限 |
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

**アラーム**

| ツール | ルート | 権限 |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**オートメーションとブループリント**

| ツール | ルート | 権限 |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**スクリプトとレシピ**

| ツール | ルート | 権限 |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**ダッシュボードとボード**

| ツール | ルート | 権限 |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**インポート**

| ツール | ルート | 権限 |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` は、CODESYS IDE の Export Alarms が書き出したファイルを、`contentBase64`(ディスク上のままのバイトで、IDE は UTF-16 で書き出す)または `content`(テキストとして持っている場合はそのテキスト)で受け取り、アラームが属する `deviceId`、必要なら `application` と `defaultPriority` を受け取ります。そのままではプレビューだけを行います。どのアラームが取り込まれ、どれが取り込まれないかを伝え、何も保存せず、理由も不要です。`apply` が true なら、アラーム定義として保存し、そのときは構成を変更するすべてのツールと同じく、理由と MCP の書き込みスイッチが必要です。

`screen_export` はダッシュボードを HotLoop の画面ファイル([画面ファイル](/ja/iot/screen-file/))として応答し、`screen_import` はこのインストールまたは別のインストールでそれを取り込みます。まず尋ねます。`dryRun` は false と言わない限り true で、ドライランは何も保存せず、すべての問題を列挙したレポートと `remap` のための参照で応答します。実際のインポートには `dryRun` false、理由、MCP の書き込みスイッチが必要で、すでに存在する id は `replace` が true でない限り拒否されます。画面は顧客のデータなので、ファイルがインストール間を移動する方法であり、コードになることはありません。

### 読み取りとドライラン

ダッシュボード、ブローカー、設備ツリーのノードを変更できるエージェントは、まずそこに何があるかを読み取れなければならないため、上記のツールが変更するすべてのオブジェクトにはここに読み取りがあり、エディターのドライランもツールです。それぞれは、そのルートが求める読み取り権限で、ルート自身のハンドラーを通して実行される 1 つのルートです。読み取りは理由も書き込みスイッチもなしに応答し、書き込みロールが除外した呼び出し元でも、読み取り権限だけを持つためそれらを実行できます。3 つのドライラン(`validate_automation`、`validate_script`、`browse_device`)は何も変更しません。本文を検査する 2 つは、ルートが求める書き込み権限を持つため、書き込みロールの背後に残ります。

| ツール | ルート | 権限 |
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

### 管理

ユーザーアカウント、設定、バックアップ、エスカレーションポリシー、ヒストリアンのターゲット、ブローカーのログイン、エッジリレーのフリート、スケジュールされたレポートは管理者のものであり、これらもツールです。残りと同じパターンで 42 個あります。それぞれは、そのルートが求める権限(`users.manage`、`settings.write`、`backup.run`、`fleet.restart`...)でルート自身のハンドラーを通して実行される 1 つのルートで、すべての変更に理由があり、監査行にはエージェントが記録されます。拒否するルートは、エージェントに対しても同じ言葉で拒否します。読み取り(`list_` と `get_` のツール)は理由も書き込みスイッチも必要としませんが、それらが持つ権限は管理者のものなので、設定されている場合は呼び出し元の書き込みロールが引き続き必要です。フリートとレポートのツールは、その機能を持つ製品にのみ存在します。

2 つの点はルート固有のものなので、ツールに頼る前に知っておく価値があります。

- **書き込みスイッチにはルートがありません。** `safety.allowWrites` と `safety.allowMcpWrites` はデプロイのもの(`HOTLOOP_ALLOW_WRITES`、`HOTLOOP_ALLOW_MCP_WRITES`)で、`PUT /api/settings` はデプロイによって設定されたものとしてそれらを拒否します。そのため `save_settings` は設定画面が変更できるものを変更し、スイッチについてはその拒否を、その言葉のまま応答します。エージェントは、自分の書き込みが待っているスイッチをオンにすることはできません。
- **ユーザーのパスワードは呼び出しを通ります。** `create_user`、`reset_user_password`、PIN ツールは、API と同じく引数でシークレットを受け取ります。監査行には変更と理由が記録され、シークレットは決して記録されません。

**ユーザーアカウント**

| ツール | ルート | 権限 |
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

**設定、バックアップ、通知**

| ツール | ルート | 権限 |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**ヒストリアンのターゲットとブローカーのログイン**

| ツール | ルート | 権限 |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**エッジリレーのフリート (Gateway)**

| ツール | ルート | 権限 |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**スケジュールされたレポート (Gateway)**

| ツール | ルート | 権限 |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## リソース

| URI | 内容 |
|---|---|
| `iiot://devices` | タグ付きのデバイスツリー、JSON |
| `iiot://tags` | 現在値付きのタグカタログ |
| `iiot://alarms` | アラーム定義、ライブ状態、状態リファレンス |
| `iiot://protocols` | コンパイル済みドライバーから得た対応プロトコル |

リソースは、クライアントがツール呼び出し 1 回ずつで探索する代わりに、名前空間全体を 1 回の読み取りで取得できるようにするためにあります。

## ツールが行わないこと

ツールは、モデルが誤って不確実性を丸めてしまうことがないように書かれています。

**読み取り値のないタグは、ゼロを読み取るタグではありません。** `read_tag` は `no reading has been taken for this tag yet` と答え、タグが存在しなければ `this tag is not configured` と答えます。どちらも値は返しません。

**不良品質は暗示されず、明示されます。** 読み取り値は `[quality: bad (the value is NOT known; do not treat it as a measurement)]` として返ります。サーバーの指示もこれを繰り返します。不良な読み取り値を平均せず、1 つを測定値として報告しないでください。

**`describe_protocol` は嘘をつけません。** 可用性はバイナリにコンパイルされたドライバーから来るため、ゲートウェイにないプロトコルをツールが主張することはできません。

**拒否は応答であり、トランスポートの失敗ではありません。** 拒否された書き込みは `isError` 付きのツール結果として返り、呼び出しの形式は正しく、意図的に断られたことを意味します。再試行すべきプロトコルエラーではありません。

## 書き込み

MCP は読み書きします。設備にコマンドし、構成を変更します([上記](#構成の変更))。`write_tag` は実際の設備を動かすため、オペレーターのクリックと機械の間にあるのと同じものが、ツール呼び出しと機械の間にもあります。

1. デプロイ全体のマスタースイッチである `HOTLOOP_ALLOW_WRITES` がオンでなければなりません。オフなら、UI も API もエージェントも何も書き込めません。
2. タグは書き込み可能とマークされていなければなりません。タグは誰かが別の指定をするまで読み取り専用で、1 つずつ変更します。
3. 値はタグの設定範囲内でなければなりません。**拒否され、切り詰められません。** 500 を求められて 400 を送ることは、求められたものと違うことを黙って行うことだからです。

**理由は必須**で、書き込みの隣に記録されます。半年後に誰にも解釈できない監査行は、ないのとほとんど変わりません。

`call_service` はまったく同じ 3 つを受けます。同じゲートを通る書き込みにすぎないからで、その上にエンティティ自身の検査(数値のステップとより狭い範囲、テキストのパターン、エンティティが無効でないこと)が加わります。どの段階での拒否も、タグだけでなくエンティティに対しても監査されます。ソース `mcp`、名前付きのクライアント、entity_id、サービス、呼び出し id で、拒否された `write_tag` が残すのと同じ行にエンティティが加わったものです。理由のない呼び出しは、`write_tag` と同じく、何かが試される前に拒否されます。

`trigger_automation` も同じようにゲートされます。ルールのアクションは設備にコマンドできるからで、そうでなければ `write_tag` が出会う検査を迂回する手段になってしまいます。

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

書き込みが無効のとき、サーバーの指示は最初にそう伝えるため、エージェントはそれを見つけるのに 1 ターンを無駄にしません。

## 外部への呼び出し

オートメーションの `mcp_call` アクションは、別の MCP サーバーのツールを呼び出します。チャートでサーバーを設定してください。

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

セッションはプールされて再利用されます。呼び出しごとに接続すると、ルールが発火するたびにハンドシェイク、initialize、ツール一覧が必要になります。切れたセッションはタイマーではなく次の呼び出しで再接続されます。次の呼び出しが、誰かが気にする最初の瞬間だからです。設定されたサーバーが停止していても、工場の監視は止まらず、ルールが必要とするまで何にも接続しません。

MCP 画面には、設定された各サーバー、接続されているか、そして公開しているツールが表示されます。

## サイトの連携

1 つの工場に 1 つのゲートウェイが、これが想定する運用方法です。各サイトは独自のデータベース、独自のボード、独自の名前を保持し、どれも他所へのリンクが維持されることに依存しません。WAN が落ちたからといって、工場の監視が止まることはありません。

すべてを一度に見るには、サイトがすでに話しているプロトコルを使います。クラウドのゲートウェイを、サイトをアウトバウンドの MCP サーバーとして設定してください。`mcp_call` アクションとまったく同じです。

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

サイト画面は、そのうえで各サイトに並行して `get_plant_status` を呼び出し、応答を集約します。サイトに表示させるためにデプロイするものはなく、サイトが連携されていることを知る必要もなく、工場ネットワークの内側へ接続するものもありません。

2 つの動作は意図的なもので、頼って構いません。

- 応答しないサイトは**到達不能とその理由**で表示され、集約からは除外されます。到達できない工場をアラーム 0 件として数えることは、このような画面にできる最悪のことです。
- サイトが最後に報告した数値は決して表示されません。最新に見えますが、そうではないからです。

各サイトには独自の短い期限があるため、リンクが死んだ工場が、稼働中の工場を待たせることはできません。

## エージェントに伝える価値のあること

サーバー自身の指示がこれをカバーしていますが、これを中心にプロンプトを書く人のために記します。

- アラームの状態は ISA-18.2 に従います。`rtn-unack` は、誰も見る前に自然に復帰したアラームを意味し、それでも報告する価値があり、確認応答と正常復帰が独立していることを示す状態です。
- 数分より長い期間には、生ではなくバケットを使う `query_history` を使ってください。1 秒単位のデータ 1 日分は、タグあたり 86,400 点です。バケットは品質のルールに従います。不良および不確実な読み取り値は `badReadings` に数えられ、平均には含まれず、良い値が 1 つもないバケットの平均は null です。
- `recent_events` は、インシデントを再構成する方法です。デバイスの接続、書き込み、アラームの遷移、オートメーションの実行、構成変更が順に、それぞれを引き起こしたアクターとともに並びます。
