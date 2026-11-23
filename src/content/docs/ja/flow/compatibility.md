---
title: "Node-RED との互換性"
description: "Node-RED との意図的な違いをすべてノードごとに理由付きで示し、取り込んだフローが以前と同じ結果を返せるようにします。"
---

<!-- Generated from the node registry. Do not edit by hand, change the `Compatibility` field on the node's descriptor and regenerate: -->

一部だけ互換で、どう互換なのかを示さないノードは、明らかに存在しないノードより悪質です。フローは動いているように見えて、静かに間違ったことを行うからです。以下のすべての項目は、何が欠けているかを書かなければならず、書いていない項目があればテストがビルドを失敗させます。

## レベルの意味

| レベル | 意味 |
|---|---|
| **完全** | 同じ種類の Node-RED ノードと同じように動作します。 |
| **部分** | 一部のみ対応します。備考に、どの部分が欠けているかを正確に記します。 |
| **相違あり** | 意図的に異なる動作をします。備考にその理由を記します。 |
| **HotLoop Flow 専用** | Node-RED に対応するノードはありません。 |

## まったくサポートしないもの

**ほとんどの Node-RED コミュニティノード。** これらは Node.js を必要とする npm パッケージです。Node を必要とするパッケージをここで動かす方法はありません。工場が頼りにしている Modbus、ダッシュボード、PostgreSQL、メールは、それぞれ独自の種類名でネイティブに動作します。node-red-types.md を参照してください。それ以外のノードは種類名を示して単独で失敗し、フローの残りは起動します。

## JSONata

`jsonata` 型のプロパティはすべて、純粋な Go で実装された JSONata 2.x である gnata が評価します。Node-RED 独自の関数である `$flowContext`、`$globalContext`、`$env`、`$clone` と、`msg` を指定する従来の形式も組み込まれています。公開されている jsonata-js 2.2.2 のテストスイートでは、1686 件中 1673 件に合格します。

Node-RED との違いは 3 つあります。moment.js はここでは再実装していないため、`$moment` は `$fromMillis` と `$toMillis` を示すエラーとともに拒否されます。メッセージオブジェクトにはキーの順序がないため、`$keys()` やオブジェクトをたどる処理は、キーが並べ替えられた状態を見ます。そして、10 秒たっても終わらない評価は、ノードのキュー全体を止める代わりに D1012 で停止されます。

## 概要

登録されているノードの種類は 117 です。

| レベル | 件数 |
|---|---|
| 完全 | 12 |
| 部分 | 50 |
| 相違あり | 14 |
| HotLoop Flow 専用 | 41 |

## 共通

| 種類 | レベル | 備考 |
|---|---|---|
| `catch` | 完全 | 該当なし |
| `comment` | 完全 | 該当なし |
| `complete` | 完全 | Node-RED と同様に、スコープ内で明示的に選択されたノードだけを監視します。 |
| `debug` | 完全 | 該当なし |
| `inject` | 部分 | 間隔、起動時、cron による注入に対応しています。crontab は Node-RED 自身のスケジューラである cronosjs と同じ方法で、プロセスのローカル時間で読み取り、時計の切り替え時に失われたり繰り返されたりする時間の扱いも同じです。管理 API からの手動注入は、常に設定されたプロパティを送ります。Node-RED のこの値での注入(msg.__user_inject_props__)は実装されていません。 |
| `junction` | 完全 | 該当なし |
| `link call` | 完全 | Link In を呼び出し、戻りモードの Link Out が返すものをそのまま送ります。呼び出しの内側から行われた呼び出しも含みます。静的な宛先は id で選びます。動的モードでは msg.target は id または名前で、呼び出し元のフローから先に探し、次にすべてのフローを探しますが、サブフローのインスタンスの中は決して探しません。タイムアウト内に戻りのない呼び出しは元のメッセージ付きのエラーを起こします。その後に届いた戻りも、Node-RED と同じくそのまま送り出されます。 |
| `link in` | 完全 | 該当なし |
| `link out` | 相違あり | どちらのモードにも対応しています。Link In ノードへ送ることと、メッセージを送った Link Call へ戻すことです。意図的な違いが 1 つあります。動作していない Link In と、戻り先の Link Call がない戻りは、Catch ノードが見られるエラーを起こします。Node-RED は前者を黙って捨て、後者は警告を記録するだけなので、削除されたり入力ミスのあったリンクはとても見つけにくくなります。 |
| `status` | 完全 | 該当なし |

## 設定

| 種類 | レベル | 備考 |
|---|---|---|
| `hotloop-flow-discord-bot` | HotLoop Flow 専用 | HotLoop Flow 独自の Discord ボットです。HotLoop core のボットが使うものと同じボットトークンを使います。 |
| `hotloop-flow-ethernetip` | HotLoop Flow 専用 | HotLoop Flow 独自の EtherNet/IP 接続で、ControlLogix、CompactLogix、Micro800 コントローラのタグにアクセスします。最初のリクエストで接続し、信頼できなくなる障害があれば接続を切り、次のリクエストで再接続します。 |
| `hotloop-flow-gotify` | HotLoop Flow 専用 | HotLoop Flow 独自の Gotify サーバーです。HotLoop core がアラームを発行するときと同じ設定を使います。 |
| `hotloop-flow-hotloop` | HotLoop Flow 専用 | HotLoop Flow 独自の HotLoop への接続です。アカウントでログインし、HotLoop が返すベアラートークンを送り、期限が切れたら再度ログインします。 |
| `hotloop-flow-influxdb` | HotLoop Flow 専用 | HotLoop Flow 独自の InfluxDB 接続で、App Store の influxdb-app を対象にします。 |
| `hotloop-flow-kafka` | HotLoop Flow 専用 | HotLoop Flow 独自の Kafka 接続です。HotLoop core の Kafka 出力が使うものと同じ設定を使います。 |
| `hotloop-flow-mcp-server` | HotLoop Flow 専用 | HotLoop Flow 独自の Model Context Protocol サーバーへの接続で、Streamable HTTP を使います。ベアラートークンがあれば送り、最初の呼び出しで接続し、失敗の後の呼び出しで再接続します。 |
| `hotloop-flow-modbus` | HotLoop Flow 専用 | HotLoop Flow 独自の Modbus TCP 接続です。最初のリクエストで接続し、信頼できなくなる障害があれば接続を切り、次のリクエストで再接続します。 |
| `hotloop-flow-ntfy` | HotLoop Flow 専用 | HotLoop Flow 独自の ntfy サーバーです。HotLoop core がアラームを発行するときと同じ設定を使います。 |
| `hotloop-flow-opcua` | HotLoop Flow 専用 | HotLoop Flow 独自の OPC UA 接続です。初回の使用時に接続し、サーバーが消えたことを検知し、次のリクエストで、サブスクリプションの場合は試行の間隔を延ばしながら自動的に、新しいセッションを開きます。 |
| `hotloop-flow-postgres` | HotLoop Flow 専用 | HotLoop Flow 独自の PostgreSQL 接続です。同じワイヤプロトコルを共有する App Store の postgresql-app と timescale-db-pod を対象にします。 |
| `hotloop-flow-s7` | HotLoop Flow 専用 | HotLoop Flow 独自の Siemens S7 接続で、TCP 上の ISO を使います。最初のリクエストで接続し、信頼できなくなる障害があれば接続を切り、次のリクエストで再接続します。 |
| `hotloop-flow-sparkplug` | HotLoop Flow 専用 | HotLoop Flow 独自の Sparkplug B 接続で、MQTT 3.1.1 上でエッジノードまたはホストアプリケーションとして動作します。エッジノードは、生成される前にプライマリホストアプリケーションの STATE を待つことができ、ブローカーのリストを順に試せます。ホストアプリケーションは 1 つのブローカーに接続します。メトリックは配列と DataSet、Template、PropertySet の値を運びます。メトリックの MetaData(ファイルと複数部分のバイト)は運びません。 |
| `modbus-client` | 部分 | TCP、TCP 上の RTU、シリアル RTU のクライアントです。最初のリクエストで接続し、信頼できなくなる障害があれば接続を切り、次のリクエストで再接続するため、reconnectOnTimeout と reconnectTimeout は待つものがありません。リクエストは 1 本の接続を順番に使うので、commandDelay、bufferCommands、キューと状態ログのスイッチは効果がありません。シリアル ASCII(RTU-BUFFERD は受け付け、ASCII は受け付けません)には対応していません。networkInterface(Node-RED にはありません)は TCP ソケットを 1 つのネットワークインターフェースに結び付けます。1 つのポートが同じサブネットの複数の VLAN を運ぶ機器のためのものです。無視されるプロパティ: `bufferCommands`, `stateLogEnabled`, `queueLogEnabled`, `failureLogEnabled`, `commandDelay`, `reconnectOnTimeout`, `reconnectTimeout`, `parallelUnitIdsAllowed`, `serialConnectionDelay`, `serialAsciiResponseStartDelimiter`. |
| `modbustcp-server` | 部分 | これを含むフローがそのまま読み込まれ、保存されるように受け付けます。ここから読み取るノードの種類(modbustcp-read と modbustcp-write)は提供されないため、何にも接続しません。modbus-client と getter、write ノードを使ってください。 |
| `mqtt-broker` | 部分 | MQTT 3.1、3.1.1、5。接続、認証情報、TLS、クリーンセッション、keepalive、そして QoS と retain フラグ、バージョン 5 ではプロパティと will の遅延を含む birth、close、will メッセージに対応します。バージョン 5 ではセッション有効期限の間隔と接続時のユーザープロパティにも対応します。受信最大数、最大パケットサイズ、トピックエイリアス最大数の設定は実装されておらず、ブローカーの既定値が適用されます。TLS は、CA、クライアント証明書、サーバー名のための tls-config を組み合わせた Node-RED の usetls です。以前の HotLoop Flow が tls: true で保存したブローカーも、システムのルート証明書で引き続き TLS 接続します。無視されるプロパティ: `receiveMaximum`, `maximumPacketSize`, `topicAliasMaximum`. |
| `postgreSQLConfig` | 部分 | Flow 独自のドライバー上の PostgreSQL または TimescaleDB の接続プールです。各設定は、...FieldType の対応項目により、文字列、数値、真偽値、環境変数のいずれかにできます。それ以外の型(msg、flow、global)は、設定ノードには読み取るメッセージがないため、ノードを停止させます。ssl true は node-postgres と同様にサーバー証明書を検証し、ssl には disable、prefer、require、verify-full、no-verify も指定できます。パスワードは、ノードの認証情報があればそこから、なければコミュニティノードが保持する方法に合わせてフローファイルの password プロパティから読み取ります。接続はデプロイ時ではなく最初のクエリで開き、アイドル接続は idle の設定にかかわらず少なくとも 1 分間保たれるため、1 秒に 1 回読み取る工場でも、読み取りのたびに再接続することはありません。networkInterface(Node-RED にはありません)は接続を 1 つのネットワークインターフェースに結び付け、ノードが要求するインターフェースごとにプールが作られます。 |
| `tls-config` | 相違あり | ファイル、環境変数、アップロードした PEM テキスト、PKCS#12 バンドルから取得する証明書、キー、CA に対応し、暗号化されたキーやバンドルのパスフレーズ、サーバー名、ALPN プロトコル、検証スイッチも使えます。違いは 2 つあります。パスはシークレットスコープ、つまりデータディレクトリと secrets.allowedPaths を通して読み取ります。任意のパスを読める TLS 設定は、エディターからファイルシステムを探る手段になってしまうからです。そして、キーのない証明書や存在しないファイルのように壊れた設定は、デプロイに失敗します。Node-RED はそれを記録して先に進むため、接続は設定したクライアント証明書なしで静かに出て行ってしまいます。 |
| `ui-base` | 部分 | Dashboard 2(FlowFuse)の設定で、これを含むフローがそのまま読み込まれ、保存されるように受け付けます。Dashboard 2 のウィジェット(ui-text、ui-button など)は提供されないため、何も描画されません。ui_ ノードを使ってください。 |
| `ui-group` | 部分 | Dashboard 2(FlowFuse)の設定で、これを含むフローがそのまま読み込まれ、保存されるように受け付けます。Dashboard 2 のウィジェット(ui-text、ui-button など)は提供されないため、何も描画されません。ui_ ノードを使ってください。 |
| `ui-page` | 部分 | Dashboard 2(FlowFuse)の設定で、これを含むフローがそのまま読み込まれ、保存されるように受け付けます。Dashboard 2 のウィジェット(ui-text、ui-button など)は提供されないため、何も描画されません。ui_ ノードを使ってください。 |
| `ui-theme` | 部分 | Dashboard 2(FlowFuse)の設定で、これを含むフローがそのまま読み込まれ、保存されるように受け付けます。Dashboard 2 のウィジェット(ui-text、ui-button など)は提供されないため、何も描画されません。ui_ ノードを使ってください。 |
| `ui_base` | 部分 | ダッシュボードのテーマです。名前(ダークまたはライト)と基本色が使われます。カスタムフォント、サイズ、ウィジェットの色、サイトタイトルは受け付けますが適用されません。 |
| `ui_group` | 部分 | タブ上のカードで、幅は width 列、タブの順序に従います。ウィジェットはその列数のグリッドに配置されます。 |
| `ui_link` | 部分 | 別のアドレスを開くメニュー項目で、http または https のみです。アイコンは受け付けますが描画されません。 |
| `ui_spacer` | 部分 | グループのグリッド内の空のセルで、width 列 × height 行です。何も表示せず、何も送りません。 |
| `ui_tab` | 部分 | ダッシュボードの 1 ページで、順序に従ってメニューに表示されます。アイコンは受け付けますが描画されません。無効または非表示のタブは除外されます。 |
| `websocket-client` | 部分 | 外へ接続し、接続が切れると自動的に再接続します。ペイロードモードとメッセージ全体モードに対応します。wss:// の URL は、Node-RED と同様に、システムのルート証明書、または tls-config の CA、クライアント証明書、サーバー名でサーバーを確認します。 |
| `websocket-listener` | 部分 | websocket のパスを提供し、ペイロードモードとメッセージ全体モードに対応します。このパスはフローのルートテーブルを HTTP In ノードと共有するため、エディターや管理 API を隠すことも、ほかのノードのパスと衝突することもありません。読み取りをやめたクライアントは、上限なくキューに積まれるのではなく切断されます。これは Node-RED にはない動作です。 |

## 探索

| 種類 | レベル | 備考 |
|---|---|---|
| `netinfo` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。ランタイムが見えるインターフェースを報告します。macvlan モードでは、これによりフローが OT VLAN 上の自分のアドレスを知ります。 |
| `scan` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。CIDR の範囲を走査して OT 機器を探し、Modbus と EtherNet/IP のエンドポイントを識別します。このダイアログではなく、ランタイム設定の探索許可リストによって制限されます。 |

## 関数

| 種類 | レベル | 備考 |
|---|---|---|
| `change` | 部分 | msg、flow、global の対象に対する set、change、delete、move に対応し、JSONata 型の値も含みます。ディープコピーのオプションは無視されます。別のプロパティから設定した値は、Node-RED でオプションをオフにした場合と同じく、そのプロパティと共有されます。無視されるプロパティ: `dc`. |
| `delay` | 相違あり | 固定、可変、ランダム、レート制限、トピックごとのキュー、時間指定リリースの 6 つのモードをすべて実装しており、msg.reset、msg.flush、破棄されたメッセージ用の 2 番目の出力もあります。意図的な違いが 2 つあります。キューには上限があり、上限を超えたメッセージは保持されずに Catch ノードへ拒否されます。Node-RED の無制限のキューは、排出より速い送信元を説明のない OOM-kill に変えてしまうからです。そして、フローが停止したときにまだ保持されているメッセージは、破棄されずに解放されます。 |
| `exec` | 相違あり | 3 つの出力、バッファモードとストリーミングモード、タイムアウト、追加されるメッセージプロパティは、Node-RED と同じように動作します。そうでないものが 2 つあり、どちらも交渉の余地はありません。シェルはありません。コマンドラインは引用符の規則だけで分割され、引用符のないシェルのメタ文字は実行されずに拒否されるため、許可された 1 つのコマンドが任意のコマンドになることはありません。そして、フローが実行してよいコマンドをオペレーターが指定するまで、ノードは無効です。Node-RED の exec ノードは何でも実行し、Node-RED は既定で認証なしで起動します。その既定値を出荷したあるベンダーは、CVE-2025-41656(Pilz IndustrialPI 4、VDE-2025-045)、つまり機器上での認証なしのコマンド実行になりました。出力はストリームごとに上限があり、上限を超えたコマンドはヒープを埋めることを許されず、終了させられて報告されます。独自の子プロセスを起動するコマンドは、終了させられたときにそれらを残すことがあります。 |
| `function` | partial | Nodeのvmモジュールではなく、Goで書かれたJavaScriptインタープリターであるJavaScriptインタープリター上で動きます。言語はES2023で、Nodeの標準ライブラリはありません。require()とnpmモジュールは動作せず、Nodeを組み込まない限り動作させることもできません。CPU時間の上限が常にあります。Node-REDはこれを任意でオフにしていますが、ここではすべてのタイマーのコールバックにも適用されます。setTimeout、setIntervalとそのclear関数は動作し、ノードの時計で動き、フローが停止または再デプロイされるとすべて解除されます。Bufferがあります（alloc、from、concat、両方のバイト順での整数と浮動小数点の読み書きメソッド、slice、toString、toJSON）。メッセージ内のバイトのsliceはバイト配列として届くので、Buffer.fromで包んでください。awaitは本体のトップレベルで動作し、本体が返すpromiseは待たれ、Setupコードが返すpromiseは最初のメッセージが実行される前に解決され、node.linkcall(target, msg, {timeout, clone})はidまたは名前でLink Inを呼び出し、returnモードのLink Outが返すもので解決されます（呼び出しで別に指定しない限り5秒待ちます）。無視されるプロパティ：`libs`、`require`。 |
| `range` | 完全 | 該当なし |
| `rbe` | 部分 | 変化がない限りブロックするモードと不感帯モードに対応します。狭帯域モードはこのビルドでは実装されていません。 |
| `switch` | 部分 | JSONata 式のルールを含むすべての比較ルールに対応しており、シーケンスの一部であるメッセージでは $I と $N が使えます。シーケンスルールの head、tail、index は実装されておらず、それらを使うルールはすべてのメッセージを未知の演算子エラーで失敗させます。無視されるプロパティ: `head`, `tail`, `index`. |
| `template` | 部分 | Mustache テンプレートは mustache.js の方言に合わせて実装されており、その HTML エスケープの集合と単独行の扱いも含むため、Node-RED から移したテンプレートは同じバイト列を出力します。パーシャル({{>name}})とカスタム区切り文字は、フローファイルにはどちらも与える手段がないため、無視されずに拒否されます。 |
| `trigger` | 相違あり | 2 つのメッセージ、再トリガー時の延長、リセット待ち、msg.reset、msg.delay による上書き、トピックごとのグルーピング、2 番目の出力を実装しています。違いは Delay ノードと同じです。同時に作動するタイマーの数には上限があり、上限を超えたメッセージは、黙ってもう 1 つ作動させるのではなく Catch ノードへ拒否されます。フローが停止したときにまだ作動している期限付きのタイマーは、破棄されずにすぐに発火します。リセットを待っているタイマーは破棄されます。発火させると、実際には起きていないイベントを作り出すことになるからです。 |
| `ui_button` | 部分 | 押すと、ペイロードとトピックをそれぞれの型に従って送ります(リテラル、flow または global の値、直前のメッセージのプロパティ、時刻)。アイコンは受け付けますが描画されません。無視されるプロパティ: `icon`. |
| `ui_chart` | 部分 | 時間に対する数値の折れ線グラフと棒グラフで、msg.topic ごとに 1 本の線を、removeOlder にその単位を掛けた期間、1 本の線につき最大 removeOlderPoints 点まで保持します。ペイロード [] でクリアされます。円、極座標、レーダー、横棒のグラフは折れ線として描画されます。系列オブジェクトの配列から作るグラフと、点をクリックしたときの出力は提供されません。無視されるプロパティ: `cutout`, `useDifferentColor`, `outputs`. |
| `ui_gauge` | 部分 | ゲージ、ドーナツ、コンパス、ウェーブをキャンバスに、3 つのセクター色で描画します。ドーナツの差分モードは受け付け、通常のドーナツとして描画されます。 |
| `ui_led` | 部分 | colorForValue のうち msg.payload(真偽値、数値、テキスト)と等しい最初のエントリの色、または許可されている場合は msg.color の色でライトを描画します。 |
| `ui_numeric` | 部分 | 数値のペイロードを持つメッセージは値を設定し、passthru がオンならそのまま先へ進みます。オペレーターの変更は min と max の範囲内で {payload, topic} を送ります。wrap は受け付けますが無視され、値は上限と下限で止まります。 |
| `ui_switch` | 部分 | クリックすると、オンの値またはオフの値を送ります。decouple がオフならスイッチはすぐに動き、オンならその値を持つメッセージが届いたときだけ動きます。ペイロードがオンまたはオフの値と等しいメッセージは、スイッチを設定します。アイコンと animate は受け付けますが描画されません。無視されるプロパティ: `onicon`, `officon`, `animate`. |
| `ui_template` | 部分 | 小さな AngularJS 風のレイヤーを備えた HTML です。{{ }}、ng-click、ng-class、ng-init、ng-show、ng-hide、ng-if、ng-bind、scope.msg、scope.$watch、scope.send、scope.$eval が使えます。これ以外のディレクティブ(ng-repeat、ng-model、ng-switch、コントローラー、Angular Material コンポーネント)は提供されません。テンプレートはオペレーターのブラウザーでページ自身の権限で動作するため、フローの作成者と同じだけ信頼されます。グローバルスコープはローカルとして扱われます。 |
| `ui_text` | 部分 | 値のフォーマットを通して msg.payload を表示し、{{msg.x}}、{{value}}、数値フィルター({{msg.payload \| number:1}})が使えます。ラベルには <br> は使えますが、ほかのマークアップは使えません。Angular のほかのフィルターには対応していません。 |
| `ui_text_input` | 部分 | 入力がないまま delay ミリ秒が過ぎたとき、Enter を押したとき、または sendOnBlur がオンのときは入力欄を離れたときに、テキスト(数値モードでは数値)を送ります。メッセージでテキストを設定できます。 |

## ネットワーク

| 種類 | レベル | 備考 |
|---|---|---|
| `discord bot out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。 |
| `discord out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。 |
| `e-mail` | 部分 | msg.payload を本文、msg.topic を件名として、ノードの To(name プロパティ)へ、空の場合は msg.to へ送ります。msg.cc、msg.bcc、msg.from、msg.html、msg.attachments([{filename, content, contentType}])に従い、Buffer のペイロードは添付ファイルとして送られます。secure は最初のバイトから暗号化された接続(ポート 465)です。そうでない場合、サーバーが提供していればノードは STARTTLS を要求します。tls は有効な証明書を持つサーバーにのみ接続するという意味です。認証は BASIC(PLAIN、フォールバックとして LOGIN)、token で指定したメッセージプロパティから読み取るアクセストークンを使う XOAUTH2、または NONE です。サーバーがこのホストでない限り、暗号化されていない接続ではパスワードは拒否されます。送信専用です。メールボックスを読む e-mail in ノードは提供されません。msg.header と saslformat スイッチは無視されます。networkInterface(Node-RED にはありません)は接続を 1 つのネットワークインターフェース経由で送ります。無視されるプロパティ: `saslformat`. |
| `ethernetip read` | HotLoop Flow 専用 | HotLoop Flow 独自の EtherNet/IP タグ読み取りです。ここでは動作しないコミュニティノード node-red-contrib-cip-ethernet-ip とは設定が同じではありません。 |
| `ethernetip write` | HotLoop Flow 専用 | HotLoop Flow 独自の EtherNet/IP タグ書き込みです。ここでは動作しないコミュニティノード node-red-contrib-cip-ethernet-ip とは設定が同じではありません。 |
| `gotify out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。 |
| `hotloop in` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。Node-RED に対応するものがない HotLoop のライブフィード(GET /api/stream)を追います。 |
| `hotloop recipe` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。HotLoop のレシピを適用します(POST /api/recipes/{id}/apply)。 |
| `hotloop script` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。HotLoop のスクリプトを実行します(POST /api/scripts/{id}/run)。 |
| `hotloop state` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。HotLoop から 1 つのエンティティの状態を読み取ります(GET /api/states/{entity_id})。 |
| `http in` | 相違あり | Express 形式の :params と末尾の * を持つパスを提供し、JSON、フォームエンコード、生の本文を含め、Node-RED と同じ msg.req / msg.res / msg.payload の形を作ります。意図的な違いが 3 つあります。どの HTTP Response ノードも応答しないリクエストは、永遠に開いたままにするのではなく、タイムアウト後に 504 で閉じられます。Node-RED のバージョンは、プロセスのソケットが尽きてログに何も残らないまま応答しなくなるまで、リクエストごとに接続を 1 つリークするためです。同じメソッドとパスを主張する 2 つのノードは、一方が黙って一度も発火しなくなるのではなく、デプロイ時に拒否されます。そして、エディターや管理 API を隠してしまうパスも、同じ理由で拒否されます。アップロードは Node-RED の multer と同じ方法で解析されます。テキストフィールドは msg.payload へ、ファイルは msg.req.files へ入り、壊れたアップロードには 500 で応答します。multer にはない上限が 1 つあります。フィールド名に含まれる 10,000 を超える配列インデックス a[99999999] は、それだけ長い疎な配列を作るのではなく拒否されます。msg.req.cookies は j: の値を含め cookie-parser のものです。無視されるプロパティ: `swaggerDoc`. |
| `http request` | 部分 | メソッド、URL、ヘッダー、ベーシック認証、リダイレクト、3 つの戻り型に対応し、msg.url、msg.method、msg.headers がノードの設定を上書きします。レスポンス本文にはサイズの上限があり、呼び出しはタイムアウトで制限されますが、どちらも Node-RED にはありません。TLS は tls-config から取得されます。tls-config がなければ、Node-RED と同じく msg.rejectUnauthorized = false でそのメッセージ 1 つに限って証明書の確認を省略します。msg.cookies と cookie ヘッダーは cookie jar を通して送られ、リダイレクトが設定した cookie はリダイレクトに従い、msg.responseCookies と msg.redirectList が返ります。これらはすべて Node-RED と同じです。オブジェクトのペイロードを持つ multipart/form-data のコンテンツタイプは、フォームとして送ります。プロキシ設定と接続の維持は、このビルドでは実装されていません。送信の許可リストはありません。このノードは Node-RED のものとまったく同じく、ポッドが到達できるすべてに到達でき、それを制限する場所は、クラスターの外の誰も信頼できない編集ダイアログではなく NetworkPolicy です。networkInterface(Node-RED にはありません)は接続を 1 つのネットワークインターフェースに結び付けます。無視されるプロパティ: `proxy`, `persist`. |
| `http response` | 部分 | ステータスコードとヘッダーをノード、または msg.statusCode と msg.headers から取得し、ペイロードを本文にします。msg.cookies は、Express が Node-RED に対して行うのとまったく同じく、オプションも含めて cookie を設定および削除します。複数ある場合は、オブジェクトが作られた順ではなく名前順で送られます。 |
| `kafka out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。 |
| `mcp client` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。Model Context Protocol サーバーのツールを呼び出すか、そのサーバーが持つツールを一覧します。 |
| `mcp result` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。mcp tool ノードが開始した呼び出しに応答します。 |
| `mcp tool` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。管理 API と同じ方法で認証された呼び出し元に対して、フローを /mcp で Model Context Protocol のツールとして提供します。Node-RED に対応するものはありません。 |
| `modbus read` | HotLoop Flow 専用 | HotLoop Flow 独自の Modbus TCP 読み取りです。ここでは動作しないコミュニティノード node-red-contrib-modbus とは設定が同じではありません。 |
| `modbus write` | HotLoop Flow 専用 | HotLoop Flow 独自の Modbus TCP 書き込みです。ここでは動作しないコミュニティノード node-red-contrib-modbus とは設定が同じではありません。 |
| `modbus-flex-getter` | 部分 | msg.payload から {fc, unitid, address, quantity} を取得します。出力と失敗は Getter と同じです。I/O ファイル(useIOFile)には対応しておらず、それを求めるノードは起動しません。networkInterface(Node-RED にはありません)はこのノードの接続を 1 つのネットワークインターフェースに結び付けます。これがない場合は、ノードのタブの FLOW_NETWORK_INTERFACE、次にクライアントのインターフェース、次にホストの選択が使われます。無視されるプロパティ: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-flex-write` | 部分 | msg.payload から {value, fc, unitid, address, quantity} を取得します。出力と失敗は Write ノードと同じです。networkInterface(Node-RED にはありません)はこのノードの接続を 1 つのネットワークインターフェースに結び付けます。これがない場合は、ノードのタブの FLOW_NETWORK_INTERFACE、次にクライアントのインターフェース、次にホストの選択が使われます。 |
| `modbus-getter` | 部分 | メッセージを受けて、ノード自身のアドレスと数量から読み取ります。出力は msg.payload、msg.responseBuffer({data, buffer})、msg.input、msg.modbusRequest を運びます。失敗は msg.error とともに 2 番目の出力から出て、emptyMsgOnFail が設定されていれば 1 番目の出力から空のメッセージが出ます。I/O ファイル(useIOFile)には対応しておらず、それを求めるノードは起動しません。networkInterface(Node-RED にはありません)はこのノードの接続を 1 つのネットワークインターフェースに結び付けます。これがない場合は、ノードのタブの FLOW_NETWORK_INTERFACE、次にクライアントのインターフェース、次にホストの選択が使われます。無視されるプロパティ: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-read` | 部分 | フローが開始されると(delayOnStart が設定されていれば startDelayTime の後)、rate rateUnit ごとにポーリングし、メッセージが届くと読み取ります。出力は Getter と同じで、msg.topic はノードから設定されます。I/O ファイル(useIOFile)には対応しておらず、それを求めるノードは起動しません。networkInterface(Node-RED にはありません)はこのノードの接続を 1 つのネットワークインターフェースに結び付けます。これがない場合は、ノードのタブの FLOW_NETWORK_INTERFACE、次にクライアントのインターフェース、次にホストの選択が使われます。無視されるプロパティ: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-server` | 部分 | ノードが設定したサイズの 4 つのバッファ(coils、holding registers、input registers、discrete inputs)上で動く Modbus TCP サーバーです。msg.payload = {register, address, value} のメッセージは値を設定します。register は holding、coils、input、discrete のいずれかで、value は 1 つの値またはリストです。クライアントの書き込みは、1 番目の出力(holding registers)または 2 番目の出力(coils)から出ます。3 番目と 4 番目の出力は、クライアントが書き込めない input registers と discrete inputs 用なので何も送らず、5 番目はエラーを運びます。すべての unit id のリクエストは同じバッファから応答されます。シリアルには対応していません。networkInterface(Node-RED にはありません)は待ち受けソケットを、待ち受けを始める前に 1 つのネットワークインターフェースに結び付けるため、機械ごとに VLAN を持つ機器が、同じアドレスとポートで VLAN ごとに 1 つのサーバーを動かせます。ノード自身の設定が優先され、次にタブの FLOW_NETWORK_INTERFACE です。無視されるプロパティ: `logEnabled`, `showStatusActivities`. |
| `modbus-write` | 部分 | ファンクションコード 5、6、15、16 のうち適切なもので msg.payload(値、または quantity の長さのリスト)を書き込みます。出力は msg.responseBuffer が付いた入力メッセージで、失敗は 2 番目の出力から出ます。networkInterface(Node-RED にはありません)はこのノードの接続を 1 つのネットワークインターフェースに結び付けます。これがない場合は、ノードのタブの FLOW_NETWORK_INTERFACE、次にクライアントのインターフェース、次にホストの選択が使われます。無視されるプロパティ: `logIOActivities`. |
| `mqtt in` | 部分 | QoS とペイロードのデコードを伴うトピックのサブスクリプションに対応し、MQTT 5 では no local、retain as published、retain handling のオプションと、msg.userProperties、msg.contentType、msg.responseTopic、msg.correlationData、msg.messageExpiryInterval に入るメッセージのプロパティに対応します。コンテンツタイプは Node-RED と同じく自動判別のデコードを導きます。制御メッセージによる動的なサブスクリプションは実装されていません。 |
| `mqtt out` | 部分 | ノードまたはメッセージのトピック、QoS、retain で発行し、MQTT 5 ではコンテンツタイプ、応答トピック、相関データ、メッセージの有効期限、ユーザープロパティを、ノードまたは msg.contentType、msg.responseTopic、msg.correlationData、msg.messageExpiryInterval、msg.userProperties から取得します。ほかにトピックがない場合は msg.responseTopic がトピックになります。トピックエイリアスは使わず、常に完全なトピックが送られます。接続と切断の制御メッセージは実装されていません。無視されるプロパティ: `topicAlias`. |
| `ntfy out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。 |
| `opcua read` | HotLoop Flow 専用 | HotLoop Flow 独自の OPC UA 読み取りです。ここでは動作しないコミュニティノード node-red-contrib-opcua とは設定が同じではありません。 |
| `opcua subscribe` | HotLoop Flow 専用 | HotLoop Flow 独自の OPC UA サブスクリプションです。ここでは動作しないコミュニティノード node-red-contrib-opcua とは設定が同じではありません。 |
| `opcua write` | HotLoop Flow 専用 | HotLoop Flow 独自の OPC UA 書き込みです。ここでは動作しないコミュニティノード node-red-contrib-opcua とは設定が同じではありません。 |
| `s7 read` | HotLoop Flow 専用 | HotLoop Flow 独自の Siemens S7 読み取りです。ここでは動作しないコミュニティノード node-red-contrib-s7 とは設定が同じではありません。 |
| `s7 write` | HotLoop Flow 専用 | HotLoop Flow 独自の Siemens S7 書き込みです。ここでは動作しないコミュニティノード node-red-contrib-s7 とは設定が同じではありません。 |
| `sparkplug command` | HotLoop Flow 専用 | HotLoop Flow 独自の Sparkplug B コマンド送信ノードで、ホストアプリケーションとして動作します。 |
| `sparkplug in` | HotLoop Flow 専用 | HotLoop Flow 独自の Sparkplug B リスナーです。ホスト接続では、見えるすべてのエッジノードを追います。エッジ接続では、自分宛てに送られたコマンドを渡します。 |
| `sparkplug out` | HotLoop Flow 専用 | HotLoop Flow 独自の Sparkplug B パブリッシャーで、エッジノードまたはその機器向けです。 |
| `tcp in` | 相違あり | 待ち受け、または外へ接続します。区切り文字を使うストリームモードと、相手が閉じるまで集める単一モードがあり、バッファ、文字列、base64 のペイロードを使えます。すべてのメッセージが msg._session を運ぶため、TCP Out ノードは同じ接続で応答できます。Node-RED にはない上限が 3 つあります。受け入れる接続の数、区切られた 1 つのメッセージのサイズ、単一モードの読み取りの合計です。接続を開いて閉じない相手や、区切り文字を送らずに送信し続ける相手がいると、そうでなければポッドが死ぬまでヒープが増え続けます。tls-config を通した TLS は双方向で動作します。待ち受け側は設定の証明書を提示し、クライアントはサーバーの証明書を確認します。 |
| `tcp out` | 部分 | ホストに接続して送信するか、TCP In ノードが受け入れた接続に、msg._session で見つけて応答します。Node-RED の 3 番目のモードのように、書き込むためだけに着信接続を待ち受けることは実装されていません。待ち受け側には TCP In ノードを、応答モードのこのノードと組み合わせて使ってください。tls-config を通した TLS はクライアントモードに適用され、応答は TLS かどうかにかかわらず、TCP In ノードが受け入れたものへ戻ります。 |
| `tcp request` | 部分 | 接続し、ペイロードを送り、応答を待ちます。Node-RED の 4 つの待機モード(一定時間、区切り文字、バイト数、相手が閉じるまで)のいずれにも対応します。msg.host と msg.port がノードの設定を上書きします。リクエストごとに独自の接続を開き、Node-RED の接続再利用モードは実装されていません。接続を再利用すると、すべて接続の境界で終わる待機モードの意味が変わってしまうためです。tls-config がある場合、設定で確認しないとしていない限り、サーバーの証明書を確認します。Node-RED の TCP Request は、設定が何と言おうと確認しないため、その TLS はドアに描かれた南京錠のようなものです。networkInterface(Node-RED にはありません)は接続を 1 つのネットワークインターフェースに結び付けます。 |
| `udp in` | 部分 | データグラムを受信し、任意でマルチキャストグループに参加できます。ペイロードはバッファ、文字列、base64 に対応し、送信元のアドレスは msg.ip と msg.port に入ります。IPv6 とノードごとのインターフェース選択は、このビルドでは実装されていません。無視されるプロパティ: `ipv6`. |
| `udp out` | 部分 | ホスト、ブロードキャストアドレス、マルチキャストグループへデータグラムを送信し、msg.ip と msg.port がノードの設定を上書きします。IPv6 はこのビルドでは実装されていません。networkInterface(Node-RED にはありません)はソケットを 1 つのネットワークインターフェースに結び付けます。無視されるプロパティ: `ipv6`. |
| `websocket in` | 完全 | フレームごとに 1 つのメッセージを出力し、msg._session を運ぶため、WebSocket Out ノードはそのメッセージが来た接続に応答できます。 |
| `websocket out` | 相違あり | msg._session が指す接続に応答し、指定がなければ Node-RED と同じく、開いているすべての接続へブロードキャストします。違いは、接続が追いつけないときに起こることです。フレームは上限なくキューに積まれるのではなく Catch ノードへ拒否され、接続は閉じられます。代わりにブロックすると、遅いブラウザーのバックプレッシャーがフローのスケジューラーに押し寄せますが、これはすでに読み取りをやめた接続を 1 つ失うより悪い障害です。 |

## パーサー

| 種類 | レベル | 備考 |
|---|---|---|
| `csv` | 部分 | オブジェクトへのパースとオブジェクトからのレンダリングに対応し、区切り文字とヘッダーの扱いを設定できます。別々のメッセージにまたがる複数行の引用符付きフィールドは、再構成されません。 |
| `html` | 部分 | CSS セレクターで要素を抽出し、内側の HTML、テキスト、属性を返します。一致ごとに 1 つのメッセージ、または配列を持つ 1 つのメッセージとして返せます。セレクターエンジンは、型、id、クラス、属性、子孫、子、カンマ区切りのグループに対応します。擬似クラス、擬似要素、兄弟結合子、属性演算子 ~= と \|= は、無視されるのではなくデプロイ時に拒否されます。:nth-child を黙って落とすセレクターは、誤った要素に一致したまま動き続けるからです。返される HTML はパースツリーから再レンダリングされるため、元のバイト列ではなく正規化されたマークアップです。 |
| `json` | 部分 | 双方向の変換に対応します。スキーマ検証にも対応し、Node-RED と同じく msg.schema に対して、またノードの設定内のスキーマに対して検証します。検証器は Ajv ではありません。スキーマが別のドラフトを指定しない限りドラフト 2020-12 を読み、スキーマの外を指す $ref は拒否し、知らない format キーワードは無視します。 |
| `xml` | 部分 | xml2js のオブジェクト規則を使った双方向の変換です。属性は "attr" が指すキー(既定は $)の下に、要素のテキストは "chr"(既定は _)の下に入り、すべての子要素は xml2js 自身の explicitArray の既定どおり配列になります。子が 1 つだけの場合をまとめるには、ew_explicitArray を false に設定してください。Node-RED が xml2js に渡すメッセージごとの msg.options は尊重されません。ほかの xml2js のオプションは出力の形を変えるため、1 つでも黙って無視すると、動いたように見えながらフローの想定しないオブジェクトを作ってしまうからです。名前空間は解決されず、要素名の一部として保持されます。無視されるプロパティ: `options`. |
| `yaml` | 完全 | 双方向の変換で、アクションが設定されていない場合は、Node-RED と同じく値の型に応じて切り替えます。 |

## シーケンス

| 種類 | レベル | 備考 |
|---|---|---|
| `batch` | 相違あり | Node-RED と同じく、重なりを伴い入ってくるシーケンスの終わりを尊重する件数ごとのグループ化、空のシーケンスの有無を選べる時間間隔ごとのグループ化、msg.reset を使ったトピックごとのシーケンスの連結に対応します。Node-RED が受け入れる 2 つの設定は拒否されます。1 未満の件数(黙って 1 として読み取られます)と、0 の間隔(すべてのメッセージを永遠に保持します)です。 |
| `join` | 相違あり | Node-RED と同じ自動、手動、reduce の各モードに対応します。msg.parts.index による配置、Split が記録した区切り文字、入れ子のシーケンス、配列、文字列、バッファ、メッセージプロパティをキーとするオブジェクト、マージされたオブジェクト、accumulate、msg.complete、msg.reset、msg.restartTimeout、タイムアウト、$A、$I、$N と任意の fixup を使う reduce 式です。意図的な違いが 1 つあります。msg.parts のないメッセージを受け取った自動 join は、警告を記録するのではなくエラーを起こします。 |
| `sort` | 完全 | 配列プロパティを要素そのもの、または各要素に対して評価した JSONata キーで並べ替え、メッセージのシーケンスをプロパティ、または各メッセージに対して評価した JSONata キーで並べ替えます。 |
| `split` | 相違あり | 配列、オブジェクト、文字列、バッファを、区切り文字、バイト列、または長さで分割します。未完の断片を次のメッセージに持ち越すストリーミングモードも含みます。msg.parts は、区切り文字と入れ子のシーケンスを含め、Node-RED のものと一致します。意図的な違いが 3 つあります。Go のマップには順序がないため、オブジェクトは並べ替えたキー順で分割されます。文字列は UTF-16 のコード単位ではなく文字数の長さで分割されるため、文字が途中で切れることはありません。そして、分割できないペイロードは、消えてしまうのではなくエラーを起こします。 |

## ストレージ

| 種類 | レベル | 備考 |
|---|---|---|
| `file` | 相違あり | リテラル、メッセージプロパティ、コンテキスト、環境からファイル名を取得して、追記、上書き、削除に対応し、utf8、base64、hex、raw のエンコーディングを使えます。違いはパスの範囲です。ファイルノードはデータディレクトリと、オペレーターが追加で挙げたものにしか到達できず、PVC に仕込まれたリンクが外を指せないよう、シンボリックリンクを解決して確認します。Node-RED のファイルノードは任意のパスを受け付けるため、フローを編集することは、プロセスが読めるあらゆるファイルを読むことと同じになってしまいます。書き込みは既定で fsync されますが、Node-RED ではされません。 |
| `file in` | 相違あり | ファイル全体、行単位、チャンク単位の読み取りに対応し、出力は utf8、base64、hex、raw です。パスの範囲は File ノードと同じで、理由も同じです。読み取りにもサイズの上限があります。Node-RED は上限なくファイル全体をメモリに読み込むため、ノードを誤ったパスに向けるとエラーではなく OOM-kill になります。上限を超えると、ノードはどの上限に達したか、そして行単位またはチャンクモードなら動作したはずだということを伝えます。 |
| `influxdb out` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。種類名はコミュニティノード node-red-contrib-influxdb と一致しており、取り込んだフローが見つけられますが、設定は同一ではないため、取り込んだ後にフィールドを確認してください。 |
| `postgres` | HotLoop Flow 専用 | HotLoop Flow 独自のノードです。PostgreSQL または TimescaleDB に書き込み、読み取ります。メッセージのシーケンスにはバッチ挿入を使います。 |
| `postgresql` | 部分 | クエリをメッセージに対する Mustache テンプレートとして実行します({{{msg.topic}}} と {{{topic}}} はどちらも動作し、値をテキストとして挿入するため、データベースにパラメーターとして渡される msg.params と $1、$2 の使用を推奨します)。msg.payload は行のリストで、msg.pgsql は {command, rowCount} です。split がオンの場合、行は rowsPerMsg 行ずつ(1 なら行オブジェクト、それ以外はリスト)msg.parts とともに出力され、2 番目の出力がある場合は、最後のグループが出た時点で 1 つのメッセージを送ります。msg.queryParameters(名前付きパラメーター)には対応していません。失敗したクエリは Catch ノード向けのエラーを起こします。networkInterface(Node-RED にはありません)はこのノードのクエリを 1 つのネットワークインターフェース経由で送ります。 |
| `watch` | 相違あり | 現れる、変わる、削除されるファイルとディレクトリを、Node-RED が作るものと同じメッセージの形で報告します。カーネルの通知インターフェースを使わずポーリングするため、変更はすぐにではなくポーリング間隔の中で検知され、1 つの間隔内の 2 つの変更は 1 回として報告されます。これは意図的なトレードオフです。fsnotify はプラットフォームごとのコードとビルド上の制約であるファイル名の接尾辞を意味し、それはすでにこのコードベースに 1 日の損失を与えました。パスの範囲はほかのファイルノードと同じで、大きなツリーの再帰的な監視がランタイムを止められないよう、監視するエントリ数には上限があります。 |
