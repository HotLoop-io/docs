---
title: "HotLoop 製品:5 ラインの 8 製品"
description: "5 つのリリースラインで提供する 8 製品について、コア製品ごとの機能、使うデータベース、インストール方法、サイトを上位製品へ移す手順を説明します。"
---

HotLoop は現場のための 8 つの製品です。サイトとともに成長する 4 つ(IoT、Edge、Gateway、Edge Relay)に、ロジックをつなぐ Flow、ワークフローを担う Cascade、PLC 自身の画面のための HotLoop for CODESYS、PLC の値をネットワークへ送り出す Transmitter が加わります。

製品は 5 つのリリースラインで提供されます。**HotLoop core** は IoT、Edge、Gateway、Edge Relay の 4 製品で、コードもタグも 1 つです。コアのリリースでは 4 製品が同じバージョンで同時に出荷され、それぞれ専用のイメージ、Helm チャート、Podman Quadlet ユニットを持ちます。機器に合うものを選んでください。どの製品も HotLoop のすべてのプロトコルに対応しているため、手元の PLC を読むためだけに上位製品へ移る必要はありません。製品を分けるのは機能であり、プロトコルではありません。

**Flow**、**Cascade**、**HotLoop for CODESYS**、**Transmitter** はそれぞれ独自のラインとバージョンを持つため、Flow のリリースがコアを動かすことはなく、その逆もありません。表より下はすべてコアについての説明です。8 製品それぞれの入口は次のとおりです。

| 製品 | リリースライン | ドキュメント | インストール | リリースノート | ロードマップ |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/ja/iot/overview/">ドキュメント</a> | <a href="/ja/iot/install/">インストール</a> | <a href="/ja/releases/#hotloop-core">ノート</a> | <a href="/ja/roadmap/">ロードマップ</a> |
| **HotLoop Edge** | HotLoop core | <a href="/ja/edge/overview/">ドキュメント</a> | <a href="/ja/edge/install/">インストール</a> | <a href="/ja/releases/#hotloop-core">ノート</a> | <a href="/ja/roadmap/">ロードマップ</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/ja/gateway/overview/">ドキュメント</a> | <a href="/ja/gateway/install/">インストール</a> | <a href="/ja/releases/#hotloop-core">ノート</a> | <a href="/ja/roadmap/">ロードマップ</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/ja/edge-relay/overview/">ドキュメント</a> | <a href="/ja/edge-relay/install/">インストール</a> | <a href="/ja/releases/#hotloop-core">ノート</a> | <a href="/ja/roadmap/">ロードマップ</a> |
| **HotLoop Flow** | Flow | <a href="/ja/flow/overview/">ドキュメント</a> | <a href="/ja/flow/install/">インストール</a> | <a href="/ja/releases/#hotloop-flow">ノート</a> | <a href="/ja/flow/roadmap/">ロードマップ</a> |
| **HotLoop Cascade** | Cascade | <a href="/ja/cascade/overview/">ドキュメント</a> | <a href="/ja/cascade/running/">インストール</a> | <a href="/ja/releases/#hotloop-cascade">ノート</a> | <a href="/ja/cascade/roadmap/">ロードマップ</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/ja/codesys/overview/">ドキュメント</a> | <a href="/ja/codesys/install/">インストール</a> | <a href="/ja/releases/codesys-0-3-10/">ノート</a> | <a href="/ja/codesys/roadmap/">ロードマップ</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/ja/transmitter/overview/">ドキュメント</a> | <a href="/ja/transmitter/install/">インストール</a> | <a href="/ja/releases/transmitter-1-2-0/">ノート</a> | <a href="/ja/transmitter/roadmap/">ロードマップ</a> |

次の表は、コア 4 製品を比較したものです。

| <span class="sr-only">詳細</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| 用途 | オートメーションの土台。Pi、NUC、キャビネットの中の箱 | 機械のそばに置く箱。上位との接続が切れても動き続けます | サイトの頭脳 | ポーリングして、転送して、生き残る。データベースも UI もありません |
| エンティティ、オートメーション、ヘルパー、スクリプト、レシピ、ブループリント、ダッシュボード、ログブック、お知らせ、MCP、ディスカバリー付き MQTT、ISA-18.2 アラーム、バックアップ、すべてのドライバー | はい | はい | はい | ドライバーのみ |
| OPC UA サーバー、蓄積転送付きの Sparkplug エッジ配信 | | はい | はい | 配信のみ |
| フリート、マルチサイト、定期レポート | | | はい | |
| イメージ | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| チャート | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet ユニット | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| SQLite 用 Quadlet ユニット | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | なし |
| チャートの `database.type` | `postgresql`(既定)、`sqlite` | `timescaledb`(既定)、`postgresql`、`sqlite` | `timescaledb`(既定)、`postgresql`、`sqlite` | なし |
| アーキテクチャ | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| チャートと Quadlet が動かすデータベース | PostgreSQL 17 | TimescaleDB | TimescaleDB | なし |
| 既定で保持する履歴 | 30 日 | 90 日 | 90 日 | なし |
| バイナリが動作するデータベース | SQLite または Postgres | SQLite、Postgres、または TimescaleDB | SQLite、Postgres、または TimescaleDB | なし |

データベースはイメージではなく設定です。`HOTLOOP_DB_TYPE=sqlite` と `HOTLOOP_DB_PATH` を指定すれば、3 製品のどれでもデータベースのコンテナなしで SQLite ファイル 1 つで動きます(DEPLOYMENT.md の「SQLite」)。チャートでは同じ選択を `database.type` で、Quadlet ユニットでは `sqlite/` ディレクトリで指定します。各製品が提供するのは上の表のデータベースだけで、IoT のチャートに `timescaledb` を指定するとインストールは失敗します。データベースを切り替えるには、バックアップを取って復元します(BACKUP.md)。

Gateway は 4.17.0 まで出荷されてきた名前をそのまま使います。イメージは `ghcr.io/hotloop-io/hotloop`、チャートは `hotloop` です。すでに使っている方は何も変更する必要がありません。

## 製品に入っているものが、バイナリに入っているもの

製品は設定ではなく、ビルドです。`-tags hotloop_iot` で IoT、`-tags hotloop_edge` で Edge、タグなしで Gateway がビルドされます。製品にない機能は無効になっているのではなく、そもそも存在しません。IoT のイメージには OPC UA サーバーが含まれていないため、環境変数も values ファイルも、うっかりミスでも、有効にすることはできません。

そのため、小さい製品は持っていない機能について、ごまかさずに答えます。

- **API** はすべての製品ですべてのルートを維持します。その製品にない機能のルートは `404` を返し、その機能を持つ製品の名前を伝えます。`{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`。`GET /api/status` は `product` と `features` を返すので、スクリプトは試して探るのではなく問い合わせるだけで済みます。
- IoT や Edge にある **Gateway 専用の設定**(古い values ファイルから引き継いだ `HOTLOOP_REPORTS_ENABLED=true` など)は、起動時と設定画面で警告を出し、HotLoop はそのまま動き続けます。作れないレポートのせいで工場の稼働を止めることはなく、警告によって誰かが必ず気づきます。
- **チャート** にはそもそもその設定がありません。`charts/hotloop-iot` には `reports`、`opcuaServer`、`edgePublish` のブロックがなく、`hotloop-edge` には `reports` がありません。それでも設定した場合は、何も生成されません。
- **`hotloop --product`** は `iot`、`edge`、`gateway` のいずれかを出力します。スクリプトが解析するため、`--version` は引き続きバージョンだけを出力します。

## どれを選ぶか

- **Pi、スマートプラグ、いくつかのセンサー、Tasmota と Zigbee2MQTT でいっぱいの MQTT ブローカー、または机の上の PLC 1 台:** IoT。イメージは最小(arm で約 29 MB)で、素の PostgreSQL のイメージは TimescaleDB の 6 分の 1 です。SD カードでは、この数字が効いてきます。
- **ラインのそばに固定した箱で、OPC UA で SCADA にデータを渡す、または Sparkplug で上位へ配信し、上位との接続が切れても耐える場合:** Edge。
- **サイト全体:すべてのライン、スケジュールでメール送信するレポート、報告を上げてくるエッジリレー、1 つの画面で見る複数のサイト:** Gateway。
- **ポーリングして転送するだけで、面倒を見るデータベースがいらない箱:** Edge Relay。[Edge Relay リファレンス](/ja/edge-relay/reference/)を参照してください。

## サイズ

イメージは、バイナリに約 3 MB のベースを加えたものです。

| <span class="sr-only">詳細</span> | amd64 のイメージ / バイナリ | arm64 のイメージ / バイナリ | arm/v7 のイメージ / バイナリ |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | ビルドなし |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

これらはディスク上のサイズです。デバイスがない状態で、HotLoop は RSS 約 10 MB、PostgreSQL は約 12 MB で、これは下限であって実際の値ではありません。デバイスをポーリングしているときの使用量は、そのデバイスによって変わります。

## インストール

### Helm

リポジトリは 1 つで、4 つのチャートがすべて入っています。

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

製品が何であっても、リリース名は `hotloop` にしてください。データベースのボリューム、Secret、Service の名前はリリース名から付くので、この名前を保っておくことで、後からサイトを上位製品へ移せます(後述)。

EmberNet では、製品ごとに App Store の別々のカードになっています。「HotLoop IoT」「HotLoop Edge」「HotLoop Gateway」「HotLoop Edge Relay」です。ストアからのデプロイでは、ダッシュボードのテナントラベルがチャートの生成するすべてのリソースに付き、Running Apps には `HotLoop-IoT`、`HotLoop-Edge`、`HotLoop-Gateway`、`HotLoop-Edge-Relay` と表示されます。

### Podman Quadlet

クラスターに入っていない機器向けです。`deploy/quadlet/` の下の製品ディレクトリにはそれぞれ 5 つのユニットがあります。`hotloop.network`、`hotloop.container`(アプリ)、`hotloop-db.container`(チャートが動かすものと同じイメージとバージョンのデータベース)、`hotloop-db.volume`、`hotloop-data.volume` です。インストール手順は各 `hotloop.container` の冒頭にあり、残りは [Podman Quadlet](/ja/install/quadlet/) にあります。

Podman 5.0 以降が必要です。Raspberry Pi OS Bookworm には Quadlet がまったくない 4.3 が入っているため、Pi には Raspberry Pi OS Trixie 以降が必要です。アプリは `:stable` を追い、Podman の自動更新がそれを動かし、データベースは固定されます。方法と理由は [Quadlet の README](/ja/install/auto-update/) にあります。どの方法でインストールする場合でも、データベースは SD カードではなく USB SSD に置いてください。履歴は毎日一日中書き込まれ、SD カードはまさにそれが原因で壊れます。

## サイトを上位製品へ移す

IoT から Edge、Gateway へ移しても、すべてのデバイス、タグ、エンティティ、オートメーション、アラーム、ユーザー、履歴がそのまま残ります。どの製品もすべてのマイグレーションを実行するため、データベースの構造は 3 製品で同じで、上位製品は追加機能が空の状態で起動します。

- **Quadlet:** ユニット名、ボリューム、シークレットは、どの製品ディレクトリでも同じです。上位製品の `hotloop.container` と `hotloop-db.container` を手元のファイルに上書きコピーし、`systemctl daemon-reload` を実行して再起動します。
- **Helm:** 同じリリースに対して `helm upgrade hotloop hotloop/hotloop-edge`(または `hotloop/hotloop`)を実行します。3 つのチャートは同じラベルで Pod を選び、データベースの StatefulSet とボリュームにも同じ名前を付けるため、アップグレードは許可され、ボリュームは結合されたままです。

先にバックアップを取り(`POST /api/backup`、[バックアップと復元](/ja/iot/backup/)を参照)、機器の外へコピーしてください。この移行は、Quadlet 上で IoT から Edge、Gateway へ、1 つのデータベースボリュームの上で各段階に同じデバイスを置いて実行済みです。IoT の PostgreSQL ディレクトリを Gateway の TimescaleDB イメージの下で起動する場合と、実際のクラスターでの `helm upgrade` でも実行しています。IoT の素のディレクトリに TimescaleDB 拡張がない場合、移行後も履歴はネイティブのパーティションに残り、ハイパーテーブルにするにはバックアップを取って新しい TimescaleDB に復元する必要があります。下位の製品へ戻すのは、大切な機器でやることではありません。

## リリースの流れ

`v` タグ 1 つで 4 製品がすべてリリースされるため、IoT、Edge、Gateway、Edge Relay は常に同じバージョンです。何かをビルドする前に、すべてのチャートのバージョンとイメージがタグと一致していること、すべての Quadlet アプリユニットがヘルスチェック付きで `:stable` を追っていること、すべてのデータベースユニットがチャートと一致し自動更新されないことを確認します。IoT と Edge のチャートは Gateway のチャートから生成されるので、1 つの修正が 3 つすべてに届きます。
