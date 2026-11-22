---
title: "フローの隣に置くテスト"
description: "フローの隣にテストファイルを書き、模擬クロックで実行し、デプロイをその結果に結び付けます。テストの外には何も出ません。"
---

「自分の変更でラインが壊れなかったか」という問いには、夜中の3時に待機担当者が答えるのではなく、デプロイの前に変更した本人が答えられるべきです。そこでフローにはテストを持たせられます。テストはフローファイルの隣に置く YAML で、同じレビューを通ります。

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

本物のランタイムと本物のノードが、サーバーもエディタもなしにプロセスの中でそのまま動きます。テストごとに専用のランタイムが使われるので、あるテストが Delay やコンテキストに残したものが次のテストへ漏れることはありません。

- **`inject`** はメッセージを順番に入れ、各メッセージは次が入る前に処理されます。入力のあるノードにはそこへ渡されます。Inject や MQTT In のようなソースは、自分で作ったかのように最初の出力から送り出し、メッセージを指定しない Inject ノードはボタンが押されます。
- **`expect`** はノードの出力を見張ります。ポートはエディタと同じく1から数えます。Debug のように出力のないノードは、受け取った内容で確認します。サブフローのインスタンスは、内部のどこから出てきたものでも、そのインスタンス自身の出力で見張ります。
- **`msg`** はメッセージに含まれていなければならない内容です。指定したプロパティはすべてその値で奥まで存在する必要があり、メッセージのそれ以外は無視されるので、誰かが `msg.topic` を設定し始めても、ペイロードについてのテストは壊れません。**`assert`** はリテラルではできない確認のための JSONata 式で、真にならなければなりません。**`error`** は Catch ノードが捕まえたエラーに含まれているべきテキストです。
- **`within`** は期限です。遅れて届いたメッセージは失敗し、失敗にはどれだけ遅れたかが示されます。**`nothing: true`** と **`count: N`** はフローが静まってから確認されます。「何も出てこなかった」が意味を持つのはそのときだけだからです。同じポートへの2つの期待は、その順番どおりの2つのメッセージです。

テストは、待っていたことがすべて起き、フローがもうやることがなくなった時点で終わります。`timeout` は指定しなければ5秒で、次の節で説明するテスト自身のクロックで数えます。

失敗すると、代わりに何が出たか、どこが違うかが示されます。

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

実行できないテストは、成功ではなくエラーです。フローにないノードを指定した、2つのノードが同じ名前を持つ、ノードにないポートを指定した、フロー内に起動しないノードがある、といった場合です。キーの綴り間違いも同じです。`expcet:` はファイルを読む時点で拒否されます。黙って見過ごされた打ち間違いは、確認するものが何もないテストを残し、確認するものが何もないテストは通ってしまうからです。すべて成功しない場合の終了ステータスは1で、`-junit` はどの CI システムでも読める報告書を書き出します。

## テストのクロック上で

5分の Delay を待つテストスイートを回す人はいないので、テストは待ちません。テストは自分のクロックを持ち、フロー内の何かが待っている次の時点へそのまま進めます。Delay が解放される時点、Trigger の2通目のメッセージ、間隔や crontab の Inject、時間切れになる Join や Batch、あきらめる Link Call などです。タイマーが発火し、フローが送ったものを処理し、そのあとで初めてクロックは次の期限を探します。順序は実際の時間が流れた場合と同じです。5分の Delay は1ステップで、約1ミリ秒です。

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** はテストのクロック上の時点に注入を置き、それより前に期限が来るものが先に起きます。**`within`** と **`timeout`** もこのクロック上なので、10分ごとに Inject があるフローで `timeout: 1h` は6ティックと数ミリ秒です。**`clock`** は時刻が関係するフローのためにテストの開始時刻を決めます。6時30分に発火する crontab は、テストのクロックが6時30分を指したときに発火します。Function ノードの `Date`、Inject のタイムスタンプ、日付を設定する Change ノード、クッキーの `Expires` はどれも同じクロックを読むので、時刻を記録して比較するフローはテストのもとでも自分自身と食い違いません。

スイートはこのクロックでパレットのすべてのタイミングノードをミリ秒単位で検証します。固定、ランダム、レート、時刻の各モードの Delay、extend 付きの Trigger、間隔・起動時に一度・crontab の Inject、Join と Batch のタイムアウト、応答を得られない Link Call です。工場の時間で1時間分も含め、すべてが1秒よりずっと短く終わります。テストが動かせないのは CPU です。実時間で1分たってもまだ忙しいフローは、スイートを固まらせる代わりにテストを失敗させます。JSONata の `$now()` と `$millis()` は引き続き実際の壁時計を読みます。

## エディタからのテスト

動いているフローのためにテストを書く人はいません。止まった日に書きますが、それでは1日遅れです。そこでエディタは、フローがいま行ったことから、2クリックでテストを作ります。

デバッグサイドバーのすべてのメッセージに **Test** ボタンがあります。押すと、エディタはそのメッセージからテストの下書きを作ります。入ってきたソースへもう一度入れ直す内容と、この Debug ノードが表示した内容を、ここでの期待値として置きます。好きなように変えてください。タイムスタンプを含む読み取り値は、ミリ秒に固定するより `assert` で確認するほうが適しています。**Add to tests** を押すと、フローファイルの隣のスイートの末尾に入り、すでに書かれていた内容はコメントも含めてそのまま残ります。スイートにすでにある名前は、何かを置き換える代わりに末尾に番号が付きます。

エディタが何が入ってきたかを知る仕組みはこうです。ランタイムは、ソースからフローに入った最後の64件と、Debug ノードに届いた最後の64件を、メッセージがノードからノードへ運ぶ id のもとで保持します。サイズに上限のあるリングで、64 KB を超えるメッセージはまったく保持されないので、ポッドを膨らませる原因にはなりえません。押し出されたメッセージや、途中でノードが新しいものに置き換えたメッセージは下書きにできず、エディタは何が入ったかを推測せずにそう伝えます。

**Tests** パネルは、デプロイ済みかどうかにかかわらず作業コピーに対してスイートを実行します。まさにそこが要点で、デプロイの前にわかります。成功したテストが通ったノードにはチェックが付き、失敗に関係するノードにはカーソルを重ねると理由が出る×が付き、失敗をクリックするとそのノードへ移動します。何かを編集すると、印は消えます。もう存在しないフローを表していたからです。**Edit** はスイート全体を YAML で開きます。[ゲート](#デプロイゲート)が拒否したデプロイも同じパネルに現れ、失敗がノードに表示されます。

これらすべてが、プルリクエストのたびに本物のブラウザで本物のバイナリを相手に実行されます。

## デプロイゲート

誰かのノートパソコン上のテストが証明するのは、そのノートパソコンにあったフローです。ゲートが証明するのは、デプロイされるフローです。スイートをインスタンスに、テスト対象のフローファイルの隣に置き(`data/flows.json` の隣の `data/flows.test.yaml`、`PUT /tests` またはエディタ経由)、`tests.gate` を有効にすると、すべてのデプロイが、反映しようとしているフローに対してそれを実行します。通らなければ拒否され、422 と完全な報告が返ります。

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

これは実際の実行です。ゲートを有効にしたバイナリ、この節の冒頭のスイートをそのフローファイルの隣に置いた状態、そしてデプロイトークンで行いました。

**すでに動いているフローは気づきません。** ゲートは1バイトも書く前に実行されます。フローファイルも、認証情報も、デプロイ記録も、再起動もありません。拒否は、テストが失敗したと記された `deploy.refused` として監査証跡に残ります。そしてテストはサーバープロセスの中ではまったく実行されません。同じバイナリを `hotloop-flow test -stdin` として起動した子プロセスで実行され、候補のフローとスイートが stdin で渡されます。テストはフロー内のすべてのノードを起動し、一部はプロセス全体が共有する場所に登録するためです。Link In は id で、HTTP ルートはパスで登録されます。サーバー内で実行すると、候補の Link In は起動した瞬間に、稼働中のフローの Link In の代わりに応答してしまいます。子プロセスなら、ラインが使うものには何も触れられず、専用のゴルーチンでパニックを起こしたノードが落とすのは工場ではなくテストで、メモリは終了時に返されます。テストはこれを厳しい方法で証明します。拒否された候補は同じ Link In を持っていますが、拒否のあとも稼働中のフローのリンクを通したメッセージは届きます。

知っておくべき決定が3つあります。**既定ではオフ**です。オペレーターが求めていないゲートは、当番の誰も聞いたことのない理由で夜中の3時に失敗するデプロイだからです。**実行できないテストは通りません。** 起動しない子プロセスや、`tests.timeout` より長い実行は、デプロイを拒否し、どちらなのかを伝えます。そして**ロールバックはゲートを通りません。** ロールバックは悪い状態から、すでに動いた状態へ戻る手段であり、今日のテストのために止めれば障害が長引くだけです。ゲートが有効でスイートがなければ失敗するものがないので、デプロイは進み、確認しなかった理由がログに残ります。

## コンテキストと認証情報

すべてのテストは、直前のテストが何を残したかにかかわらず、空のコンテキストで始まります。あるテストがカウンターを42まで進めても、次のテストはそこから始まりません。2つ目のテストが1つ目を先に実行したときにしか通らないスイートは、誰かが1つだけテストを実行する日に嘘をつくスイートだからです。そこでカウンターが41であることを必要とするテストはそう書き、終わったときにコンテキストが何を保持しているべきかも書きます。

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

期待の中の `context` は `msg` と同じように照合され、`null` はそのキーが設定されていてはならないことを意味します。失敗すると、そのスコープが実際に何を保持しているかが示されます。よくある原因は打ち間違いだからです。`flow context of "Line 3" (t1): cuont: not set; it holds count`

テストは本物の認証情報を一切目にしません。テストが指定したものだけで実行されるので、安心してコミットでき、それらは本物とまったく同じようにノードへ届きます。HTTP リクエストのパスワードは送るはずだった `Authorization` ヘッダーに現れ、トークンがなければ起動しない InfluxDB の設定は、テストのトークンで起動します。`ew_credentialFiles` を通じてマウントされたファイルからパスワードを読むノードは、そのフィールドについてテストの認証情報を受け取ります。テストはディスクから何も読まないためで、テストが何も指定していなければ空のものを受け取ります。

コンテキストはテストの間メモリ上にだけあり、状態データベースには決して置かれないので、テストは稼働中のフローが残したものを読めず、稼働中のフローに何も残せません。フィクスチャはテスト内の YAML であり、データベースのふりをしたファイルではありません。

## テストの外には何も出ません

テストが MQTT Out を本当に実行すれば、工場のブローカーへパブリッシュしてしまい、それはもうテストではなくデプロイです。そこでテスト中は、プロセスの外の世界と話すすべてのノードが代役に置き換えられます。MQTT の入力と出力、HTTP の in・response・request、PostgreSQL、InfluxDB、TCP と UDP の入力・出力・request、WebSocket の入力と出力およびその背後のリスナーとクライアント、ファイルノード、`exec`、`scan`、`netinfo` です。

ノードは、電線の手前まで自分の仕事をすべて行います。MQTT Out はトピック、QoS、バイト列を求め、HTTP Request は URL を組み立て、本文を作り、リダイレクトをたどり、PostgreSQL ノードは SQL とそのパラメーターを組み立てます。そのうえでそれを代役に渡し、代役はそれを記録して、テストが台本に書いたとおりに応答します。台本がなければ、応答は何もなしと成功です。行なし、空の 200、0 で終了したコマンドです。ソース(MQTT In、HTTP In、TCP と UDP In、WebSocket In、Watch)は購読も待ち受けもポーリングもしないので、届くのはテストが注入したものです。

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** はノードが送ったはずの内容で、`msg` と同じように照合されます。**`replies`** は返ってくるものを台本にします。ノードに並べた最初の応答が最初の呼び出しに、次が2回目に答え、最後のものが答え続けるので、「答えたあと止まった」は2行で書けます。**`error`** は本物と同じように呼び出しを失敗させるので、ヒストリアンが止まったときにフローがたどる経路を、止まる前にテストできます。

| ノード | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | クエリは `rows`、insert は `rowCount` |
| InfluxDB | `line`、ラインプロトコル | |
| TCP Out, UDP Out | `host`, `port`, `payload` (返信時は `session`) | |
| TCP Request | `host`, `port`, `payload` | `payload`、ノードが本物の応答を読むのと同じ方法で読む |
| WebSocket Out | `payload` (返信時は `session`) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`、内容 |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

テストがあえて確認しないことがいくつかあります。フローではなく機器に属するためです。`exec` の許可リスト、パスとディスカバリーの範囲、`tls-config` の証明書です。テスト中は何も実行も、開くことも、探索も、接続もされないので、囲い込むものも暗号化するものもなく、デプロイは到着した機器で、そのすべてに対して引き続き責任を負います。

その証拠となるのは、これらのノードすべてを、テストが保持する TCP ポート、UDP ポート、ディレクトリに向け、読み取り値をすべてに通し、各ノードが送ったはずの内容をバイト単位で確認し、そのうえで数えるテストです。接続ゼロ、データグラムゼロ、書かれたファイルなし、実行されたものなし。外へ出るのに代役のないノードは、何かが動く前に名前で拒否され、誰かが1つ追加するとパレットのテストが失敗します。
