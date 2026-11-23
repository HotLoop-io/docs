---
title: "Flow 2.1.0 リリースノート"
description: "HotLoop Flow 2.1.0 の内容、アップグレード時の変更点、稼働中のプラントに触れる前に読むべきこと。"
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 は、[ロードマップ](/ja/flow/roadmap/)のフェーズ 0 から 2 に加え、実際のフローを載せるのを妨げていた日常的な不足を埋めたリリースです。すべてのデプロイが、比較、テスト、レビュー、復元のできる記録になりました。フローにはテストを持たせられ、悪いデプロイが起きる前に実行されます。保存すると変更したノードだけが再起動し、プラントの残りには手を触れません。

このリリースは、フローファイルの読み書きの方法を一切変えません。バイト単位の往復は手つかずなので、2.0.5 で動いていた `flows.json` は 2.1.0 でもそのまま動きます。

## 新機能

**デプロイ**
- すべてのデプロイが記録です。誰が、どこから、いつ、メモ、置き換えたリビジョン、バイト単位のフローファイル、そのときのまま暗号化された認証情報が残ります。`GET /deployments` で読めます。`history.retain` は既定で直近 100 件を保持します。
- レビューのように読める差分: ノードごと、プロパティごとに示し、レイアウトとロジックを分け、認証情報は決して表示しません。API、コマンドライン(`hotloop-flow diff`)、そして git 自身の diff ドライバとして使えます。
- ロールバックは古い記録を新しいデプロイとして戻します。フローと認証情報が一緒に戻るので、削除したノードがブローカーのパスワードごと復活します。
- 部分デプロイ: 保存すると変更されたノードだけが再起動します。ほかのノードの MQTT セッション、リスナー、Delay のキューは動き続けます。`HotLoop-Flow-Deployment-Type`(または Node-RED のヘッダー)で、ノード、フロー、全体のいずれかを選びます。
- エディタはデプロイの前に、キャンバス上に描いた差分とメモでレビューし、ロールバックボタン付きの履歴を表示します。
- コードとしてのフロー: `hotloop-flow deploy` は稼働中のものとの差分を出力し、元にしたリビジョンに対してデプロイするため、競合はパイプラインの失敗(赤)になります。`hotloop-flow export` は稼働中のファイルをバイト単位で返します。`hotloop-flow token` は API トークンと、それ用に設定するハッシュを作ります。
- 任意の git ミラー: `history.git` を設定すると、すべてのデプロイがデプロイした人を作成者とするコミットになります。

**テスト**
- フローのテスト: `flows.json` の隣に置いた `flows.test.yaml` を、`hotloop-flow test`(`-junit` で JUnit 出力)が実際のランタイムと実際のノードで実行します。Delay、Trigger、Inject、Join、Batch はテストが進める時計で動くので、Delay の 5 分も 1 ステップです。MQTT、HTTP、PostgreSQL、InfluxDB、TCP、UDP、WebSocket、ファイル、exec など外部と通信するものはすべて代役に置き換えられ、テストは送り出されたはずの内容を確認します。
- デプロイゲート: `tests.gate` を有効にすると、フローがテストスイートに失敗したデプロイは、レポート全文付きの 422 になります。ロールバックは出口なのでゲートを通りません。
- エディタは、デバッグメッセージからテストを作って実行します。

**ノードとプロトコル**
- JSONata は、公開されている jsonata-js 2.2.2 のスイートで検証済みです。1686 件中 1673 件が通り、通らない 13 件は名前と理由を明記して固定しています。
- Inject は crontab で発火し、Node-RED と同じ分に動作します。6 つのタイムゾーンの時刻変更も確認済みです。
- MQTT 5(プロパティ、サブスクリプションオプション、セッション有効期限)とラストウィル。MQTT 3.1.1 も引き続き使えます。
- TCP、HTTP リクエスト、MQTT で `tls-config` ノードによる TLS を使えます。WebSocket のリスナーとクライアントが起動し、クライアントは TLS に対応します。
- HTTP の Cookie とマルチパートは、Node-RED が使うライブラリと照合して確認しています。
- Split、Join、Batch は Node-RED と同じように動きます。ストリーミング、タイムアウト、reduce、間隔に対応し、Link Call と Link Out の戻りモードもあります。
- パスワードをフローの中ではなく、マウントした Secret に置けます。Helm チャートに `secrets.mounts` が加わります。

**サインイン**
- 二要素サインイン(TOTP)。無料で、エディタから有効にした人なら誰でも使えます。
- ロックアウト、再起動後も残るセッション、誰がどこから何をしたかの監査ログ(`GET /audit`、`audit.read`)。

## 変更点

- ロックアウトは既定でオンです。1 つのアドレスから 1 つのアカウントに 5 回失敗するか、1 つのアドレスから 20 回失敗すると、15 分間ロックされ 429 を返します。数値は `auth.lockout` で変えられます。
- セッションはハッシュとして `data/sessions.json` に保存され、リクエストごとに設定に従うため、設定から権限やユーザーを外すと次のリクエストから反映されます。
- ロールバックは、より少なく指定しない限りフル再起動です。
- イメージには `/usr/share/doc/hotloop-flow/` に `LICENSE`、`NOTICE`、`THIRD_PARTY_LICENSES` が入っています。`THIRD_PARTY_LICENSES` は、バイナリに含まれるすべての Go モジュールと npm パッケージを、バージョンとライセンス全文とともにビルド時に生成して一覧にします。GPL、AGPL、LGPL の依存関係や、誰も特定できない依存関係があるとビルドは失敗します。
- `NOTICE` は誤っていました。ここに Node-RED のコードは入っていないと書かれていました。Cron、Split、Join、Batch、Link Call、tls-config、HTTP の Cookie とマルチパートの処理は移植したもので、今は移植したすべてのファイルを、出どころ、著作権者、ライセンスとともに一覧にし、cronosjs には ISC の全文、残りには MIT の全文を付けています。移植したファイルの先頭にも同じことが書かれています。
- 拒否されたデプロイが、メモリ上の認証情報を整理してしまうことはなくなり、Chromium でノードをダブルクリックするとダイアログが開きます。どちらもこの作業の中で見つかりました。

## アップグレードの注意

2.0.5 からはイメージを替えるだけです(`helm upgrade`、または Quadlet ユニットの新しいタグ)。移行もフラグも要りません。

- 初回起動で、`data.dir` の下に `sessions.json`、`audit.log`、`deployments` ディレクトリが作られます。以前はセッションがメモリ上にあったため、アップグレード後は全員が一度サインインし直します。
- 設定の新しい項目はすべて任意で、既定ではオフか無害です。今あるものが止まることはありません。
- WebSocket トークン: エディタはトークンをサブプロトコル `hotloop-flow.bearer.<token>` として、`hotloop-flow` と並べて送るようになりました。`/comms` に接続するものには、これが推奨の方法です。URL に `?access_token=` を付けて送るスクリプトも引き続き動作し、サーバーはそのような接続ごとに、トークンがプロキシやアクセスログに漏れること、代わりに何を送るべきかを伝える警告を記録します。URL そのものは Flow のログにも監査記録にも書かれません。URL 形式の廃止は将来のメジャーリリースまで待ちます。

## 新しい設定

| YAML | 環境変数 | 既定値 |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`。`true` にすると、フローが `flows.test.yaml` に失敗したデプロイを拒否します。 |
| `tests.timeout` | | `2m`。テスト 1 回の実行にかけられる実時間。終わらない実行はデプロイを拒否します。 |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | 空。`data.dir` に加えて、`tls-config` や認証情報ファイルを読める追加のツリー。ファイルノードの範囲ではないため、File In ノードは引き続きそれらを読めません。 |
| `secrets.mounts`(チャート) | | 空。読み取り専用でマウントした Kubernetes Secret で、それぞれがシークレットの範囲に追加されます。 |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | なし。マシン用の API トークンで、ハッシュとして保存されます。環境変数は、読み取りとデプロイだけができる `deploy` トークンを作ります。`hotloop-flow token` で作成します。 |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`。`0` はすべての記録を保持します。 |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | オフ。 |
| `audit.maxBytes`, `audit.keep` | | 16 MiB、4 ファイル。 |

イメージ: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`、linux/amd64 と linux/arm64。チャート: `https://hotloop.io/hotloop-flow/`。このタグの README に残りがあります: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
