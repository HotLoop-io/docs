---
title: "npm のないプラグイン"
description: "プラグインは、メモリ上限、タイムアウト、ディスクリプターを持つ署名済みの WebAssembly モジュールで、許可しない限りホストには触れません。"
---

Node-RED のコミュニティノードは npm パッケージです。ボックスに Node.js が必要で、インストールされるとランタイム自身のプロセスの中で、そのプロセスが届くすべてのものと一緒に動きます。Flow はそうしたノードを実行しませんし、これからも実行しません。代わりにこうします。プラグインは、メモリ上限とタイムアウトのあるサンドボックス内の WebAssembly モジュールで、エディターがダイアログを描くもとになるディスクリプターが付き、署名されていて、要求して許可しない限りホストには触れません。

あなたにとっての意味はこうです。プラグインが動く前に、その契約全体を1つの JSON ファイルで読めます。ボックスは、あなたが選んだ鍵で署名されていないものをすべて拒否します。そして、不具合のあるプラグインにできる最悪のことは、自分のメッセージを失敗させることだけです。

## プラグインとは

`<data.dir>/plugins/`(または `plugins.dir`)の下にある、プラグイン名のディレクトリで、3つのファイルが入ります。

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

各プラグインは、パレットの Function セクションにノードタイプ `wasm-<name>` として1つ現れます。プラグインは Flow の起動時に読み込まれるので、追加や変更には再起動が必要です。メッセージ処理時には何も読み込みません。

### モジュール

ABI は[README](/ja/flow/sandboxes/)にあるものと同じです。`hotloop_flow_process` と `hotloop_flow_alloc` は必須、`hotloop_flow_free` は任意で、すべて JSON でやり取りされます。ゲストは `{"msg": {...}, "config": {...}}` を受け取り、`{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}` を返します。HTTP In ノードが付ける応答ハンドルやバイナリバッファのように、単純な JSON ではないメッセージプロパティは、ゲストには渡されません。ノードがそれを保持し、ゲストが送るすべてのメッセージに戻します。ただしゲストがそのプロパティを自分で設定した場合は別で、だからプラグインを HTTP In と HTTP Response の間に置けます。`config` はノードのダイアログが保持する内容です。`error` はメッセージを Catch ノードに失敗として送り、それ以前に送ったものはそのまま送られます。

モジュールは WASI をインポートでき、コンテキストの capability を宣言していれば、下の2つのコンテキスト関数もインポートできます。それ以外のインポートはプラグインの読み込み時に拒否され、拒否にはそのインポート名が示されます。

### ディスクリプター

`plugin.json` は厳密に読み込まれます。Flow が知らないフィールドは拒否の対象なので、`"capabilites"` のような綴りの誤りは、何も要求しないまま黙って通るプラグインにならず、検出されます。

| フィールド | <span class="sr-only">詳細</span> |
|---|---|
| `format` | `1`。必須。 |
| `name` | 小文字、数字、ハイフン、40文字まで、先頭は英字。`plugins.grants` とフローファイルが使う名前なので、ディレクトリ名と一致している必要があります。 |
| `version` | 必須。ノードのヘルプと `GET /plugins` に表示されます。 |
| `label`, `description`, `help` | パレットのラベル、1行の説明、情報サイドバー用の Markdown。 |
| `inputs`, `outputs` | 入力は 1 でなければなりません。出力は 0 から 16、既定は 1。 |
| `props` | ダイアログ。組み込みノードが使うのと同じプロパティ宣言で、種類は `string`、`text`、`number`、`bool`、`select`、`json`、`list` です。認証情報、設定ノードへの参照、コードエディターの種類は拒否されます。プラグインが関わるべきものではないからです。 |
| `capabilities` | 要求するホストへのアクセス。 |
| `limits` | 既定で望む `memoryMiB` と `timeoutMs`。 |

エディターは、ブラウザーにプラグインのコードを一切置かずに、`props` からダイアログを描きます。すべてのプラグインノードには、名前、メモリ制限、タイムアウトのフィールドも付きます。この3つの名前は予約されています。

## 制限と、トラップの様子

プラグインノードはそれぞれ独自のメモリ上限と独自のタイムアウトを持ちます。プラグインのディスクリプターが既定値を決め(何も書かなければ 16 MiB と1秒)、ノードはダイアログで変更でき、`plugins.maxMemoryMiB`(64)と `plugins.maxTimeout`(5s)がボックスが許す限度です。ボックスが許す以上を求めたノードはデプロイを失敗させ、どの設定を上げるべきかを示します。

上限を超えて大きくなったゲストはトラップに掛かります。タイムアウトの時点でまだ動いているゲストは停止されます。どちらの場合も、メッセージは最も近い Catch ノードへ行き、次のメッセージがきれいに始まるようにインスタンスは破棄され、他のノードは影響を受けません。Catch ノードが `msg.error.message` で目にする内容は次のとおりです。

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

上限はあらかじめ確保されます。上限 64 MiB のノードは、ゲストが触れるかどうかにかかわらず、インスタンスが存在する間 Go ヒープの 64 MiB を計上します。バッファをコピーして大きくすると、ホストが一時的に上限の数倍を保持することになるからです。それを証明するテストは、1回の呼び出しが合計で割り当てた量(上限 256 MiB に対し 256 MiB)と、トラップのあとヒープが開始時点に戻ることを測ります。上限は、入力できる最大の数字ではなく、プラグインが必要とする値に設定してください。

## Capability

capability がなければアクセスもありません。各 capability は、ディスクリプターが要求し、`plugins.grants` がそのプラグインに名前で与えたときだけ接続されます。

| Capability | 与えるもの | ないとき |
|---|---|---|
| `clock` | 実際の壁時計と単調時計。 | ゲストには、2022-01-01 から始まる、プラントの時計とは無関係な代用の時計が見えます。 |
| `random` | オペレーティングシステムの乱数バイト。 | 毎回同じ固定の並び。 |
| `context.flow` | そのノード自身のフローのフローコンテキストの読み書き。 | コンテキスト関数が存在しません。 |
| `context.global` | グローバルコンテキストの読み書き。 | 同上。 |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

許可されていないものを要求しても、メッセージ処理時には失敗しません。デプロイが失敗します。何かを書き込む前にフローが 422 で拒否され、動いているフローは気づかず、メッセージにはノードと追加すべき行が示されます。

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

ロールバックもデプロイなので、許可がその後取り消されたプラグインを使うフローへのロールバックも、同じように拒否されます。インストール済みで許可されていないプラグインも、パレットには表示され、そのヘルプに capability が載ります。

### コンテキスト関数

コンテキストの capability を宣言したゲストは、モジュール `hotloop_flow` から次をインポートできます。値は JSON でやり取りされます。

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

スコープは、フローが `0`、グローバルが `1` です。`context_get` は JSON の長さを返し、`outCap` に収まる場合にだけ書き込みます。提供した量より多く返されたゲストは、より大きなバッファで再試行します。存在しないキーは `-1` で、`-2` は拒否を意味します。スコープが許可されていない、キーや JSON が不正、またはストアが拒否した場合です。ゲストは、許可されていないスコープを試して読むことはできません。

## 署名と、発行者を信頼すること

プラグインは ed25519 の鍵で署名されます。署名はモジュールだけでなく両方のファイルを対象にします。プラグインがアクセスを要求するのはディスクリプターだからです。モジュールだけに署名すると、ディレクトリへの書き込み権を持つ誰もが署名済みのプラグインに capability を追加できてしまいます。署名されるメッセージは次のとおりです。

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

プラグインの読み込み時に何も参照しません。ネットワークも、透明性ログも、証明書チェーンもありません。検査は、署名、その署名が示す鍵、そしてあなたの鍵の一覧です。外へ出る経路がないかもしれないプラント内ネットワークのボックスのための、意図した選択です。失効サービスもないということなので、鍵の失効とは、`plugins.trustedKeys` から外して再起動することです。

### 発行者として

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` は PKCS #8 の秘密鍵と PKIX の公開鍵を PEM で書き出します。`openssl genpkey -algorithm ed25519` と `openssl pkey -pubout` が作るのと同じファイルで、どちらも上書きを拒否します。鍵 id と公開鍵の1行形式を出力します。秘密鍵は git に入れないでください。鍵はコミットされません。

### オペレーターとして

Helm チャートでは `plugins.trustedKeys`、`plugins.grants`、`plugins.volume` で、[Flow のデプロイ](/ja/flow/deploying/)にあります。

発行者を信頼するには、その公開鍵を `plugins.trustedKeys`、またはカンマ区切りの `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` に入れます。各エントリは `ed25519:<base64>` の行、PEM の公開鍵、またはそれを含むファイルのパスで、マウントした Secret や ConfigMap はこの形で入ります。

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

信頼する鍵がなければ、すべてのプラグインが拒否されます。解析できない鍵は起動時のエラーです。信頼はプラグイン単位ではなく鍵単位なので、発行者を信頼することは、その発行者が署名するすべてを信頼することです。そのうえでプラグインが何を使えるかは別の判断で、`plugins.grants` で名前ごとに決めます。

## 拒否されるとき

読み込めないプラグインは、起動時にログに記録され、理由とともに `GET /plugins` に一覧され、パレットには現れず、それを使うフローをデプロイしたときの拒否にその名前が示されます。1つの不良プラグインが Flow の他の部分の起動を止めることはありません。`hotloop-flow plugin verify` は同じ検査を実行するので、発行者もオペレーターが見るものを確認できます。

| 問題 | 表示される内容 |
|---|---|
| `plugin.sig` がない | `unsigned: plugin.sig is missing` |
| 署名後にモジュールまたはディスクリプターが編集された | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| 信頼していない鍵で署名されている | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| 鍵がまったく設定されていない | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| 署名ファイルが壊れている | `signature file is malformed: ...` |
| 未知のフィールド、不正な種類、不正な capability を持つディスクリプター | フィールド名を示す `plugin.json is not valid: ...` |
| モジュールがホストの提供しないものをインポートしている | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| capability を宣言せずにコンテキスト関数を使うモジュール | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| ディレクトリ名と `name` が違う | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

署名は、ディスクリプターを解析する前、モジュールをコンパイルする前に検査されるので、署名のないコードはコンパイルすらされません。

## 2つの例

* `moving-average` は Rust です。直近 N 件のメッセージにわたって測定値を平均し、ウィンドウを自分のメモリに保持します。何も要求しません。`cargo build --locked --release --target wasm32-wasip1` を実行すると、`plugin.wasm` はビルドされた `moving_average.wasm` です。
* `stamp` は TinyGo です。各メッセージに時刻を追加するので、`clock` を要求します。TinyGo 自身のコンテナを使い、Podman でビルドします。`podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow は Go の家です。ホスト、署名、CLI、すべてのテストは Go で、TinyGo の例も Go です。Rust の例があるのは、ホストが書かれた言語でしか動かないプラグイン形式はプラグイン形式とは言えないからであり、信号処理ライブラリがすでに Rust で書かれている可能性が最も高いからです。これが、Go ではない唯一の例についての文書化された理由です。ビルドに使うクレートは `serde` と `serde_json` で、どちらも寛容なライセンスで、Flow ではなく例のモジュールにコンパイルされます。

## まだ実証されていないこと

* プラグインはベアメタルで実行されています(2026-11-17)。
* Kubernetes では、プラグインのファイルは `plugins.volume` を通じて届きます。ボリュームソースは何でも構いません。ConfigMap は 1 MiB の上限までしかプラグインを保持できないので、TinyGo の例ほどの大きさのプラグインには claim が必要です。
* ネットワークの capability はありません。プラグインはリクエストを送れず、ホストの許可リストを伴う理由を持つ人が現れるまで、それは意図したものです。
* Flow のテストは、他のすべてのノードと同じ子プロセスでプラグインを実際に実行します。プラグインの capability は、デプロイが与えるものと同じです。
* シェルから手で実行した `hotloop-flow test` はプラグインを読み込みません。デプロイゲートとエディターのテスト実行は読み込みます。
