---
title: "Podman Quadlet の導入"
description: "Docker も Compose もクラスターも使わず、Podman Quadlet で Pi や小型産業用 PC 上の HotLoop を本物の systemd サービスとして動かします。"
---

k3s クラスターに**含まれていない** Pi や小型産業用 PC 向けです。含まれている場合は、製品のチャートを使ってください。このディレクトリとチャートが、HotLoop を動かすためにサポートされている 2 つの方法です。

Docker は使わず、セッションとともに終了するシェルからの場当たり的な `podman run` も使いません。Quadlet はコンテナーを本物の systemd サービスにします。ログインしているユーザーがいなくても起動時に開始し、失敗すれば再起動し、ログは journald に残ります。

| ディレクトリ | 製品 | イメージ |
|---|---|---|
| `iot/` | HotLoop IoT、PostgreSQL 17 付き | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge、TimescaleDB 付き | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway、TimescaleDB 付き | `ghcr.io/hotloop-io/hotloop` |
| このディレクトリ | HotLoop Edge Relay、データベースなし | `ghcr.io/hotloop-io/hotloop-edge-relay` |

どれが必要かは[製品ページ](/ja/products/)でわかります。

最初の 3 つにはそれぞれ `sqlite/` ディレクトリもあります。同じ製品で、データベースはファイルになり、データベースコンテナーはありません。[PostgreSQL の代わりに SQLite](#postgresql-の代わりに-sqlite)を参照してください。

## IoT、Edge、Gateway

各ディレクトリには同じユニットと 1 つのスクリプトがあります。

- **`hotloop.network`**: アプリとそのデータベースが共有するネットワークです。アプリは名前(`hotloop-db:5432`)でデータベースに届き、データベースはポートを公開しないため、機器上の他のものは届きません。公開されるのはアプリの 8080 だけです。
- **`hotloop.container`**: アプリです。冒頭にインストール手順があるので、何かをコピーする前に読んでください。
- **`hotloop-db.container`**: データベースで、その製品のチャートが動かすものと同じイメージとバージョンです。応答した時点で起動済みと報告するので、アプリは使えるデータベースを待ちます。
- **`hotloop-db-upgrade.container`** と **`hotloop-db-upgrade.sh`**: データベースを PostgreSQL 16 から 17 へ移す、一度きりの手順です。データベースユニットの前に、ボリュームにまだ 16 のデータがあるときだけ実行されます。新しいボリュームや、すでに 17 のボリュームでは systemd が飛ばします。[PostgreSQL 16 から 17 へ](#postgresql-16-から-17-へ)を参照してください。
- **`hotloop-db.volume`** と **`hotloop-data.volume`**: データベースと、アプリが `/data` に書くすべて(バックアップ、証明書、転送キュー、レポート)です。名前付きの Podman ボリュームなので、`podman system prune` では消えません。

3 つの Podman シークレットが、ファイルに置くべきでないものを保持します。`hotloop-db-password`、`hotloop-secret-key`(データベース内のデバイスのパスワードを暗号化します。コピーを機器の外に保管してください)、`hotloop-admin-password-hash`(最初の管理者のパスワードの bcrypt ハッシュで、パスワードそのものではありません)です。

**Podman 5.0 以降。** Raspberry Pi OS Bookworm には Quadlet がまったくない Podman 4.3 が入っています。Raspberry Pi OS Trixie(Podman 5.4)以降を使ってください。以下のアップデートは Podman 6.1.3 で実行しました。同じキーを使う Edge Relay のユニットは 4.9.3 で実行しています。また、データベースのボリュームは SD カードではなく USB SSD に置いてください。履歴は一日中書き込まれ、SD カードはまさにそれで壊れます。

### すべての製品が同じ名前を使う理由

ユニット、ボリューム、シークレットの名前は、`iot/`、`edge/`、`gateway/` で意図的にまったく同じです。機器を上位の製品に上げるには、上位製品の `hotloop.container` と `hotloop-db.container` を手元のものに上書きコピーします。

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

ボリュームとシークレットはそのまま残り、すべてのデバイス、タグ、アラーム、ユーザー、履歴もそのままです。それでも先にバックアップを取ってください(`POST /api/backup`)。この移行は、同じボリューム群の上で IoT から Edge、さらに Gateway へと実際に実行済みです。下位の製品に戻すのは、大切な機器でやることではありません。

つまり、1 台の機器に HotLoop は 1 つです。2 つあってもポート 8080 を取り合うことになります。

### 検証済み

出荷された IoT、Edge、Gateway のファイルは、手を加えずに Podman 6.1.3 の `quadlet` ジェネレーターで同じ構造として生成されます。アプリはデータベースとネットワークを必要とし、自分のポートを公開し、自動更新ラベルを持ちます。データベースはラベルを持たず、何も公開しません。

続いて Gateway のユニットを実際に動かしました。ルートなしで、systemd の下で、ghcr.io の代わりにローカルレジストリを使い、製品自身の `podman auto-update` で行っています。データベースが正常に起動し、その後にアプリが正常になる初回起動。アプリがすでに使っているテーブルにマイグレーションを加えるリリースへの更新(既存のデバイスとデータは無傷で、データベースコンテナーは一度も再起動されません)。そして、データベースをマイグレーションしたあと起動できないリリースへの更新(Podman がロールバックし、失敗したリリースがすでにマイグレーションしたデータベース上で前のリリースが正常に起動しました)。Edge と IoT は同じユニットで動き、実際の Pi のベアメタル上で systemd の下で実行されています(2026-11-17)。

## PostgreSQL 16 から 17 へ

このリリースから、HotLoop のデータベースは PostgreSQL 17 です。以前のリリースを動かしていた機器には PostgreSQL 16 のデータがあり、PostgreSQL 17 はそれを開けないため、データベースの前に走るユニットが移行します。新しいファイルを所定の場所に置いてデータベースを再起動すれば、それで終わりです。

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` はアップグレードユニットを必要とするので、新しいデータベースユニットだけをコピーした機器は 16 のデータの上では起動せず、journal が理由を示します。アップグレードユニットは、古いディレクトリの隣の新しいディレクトリへコピーモードで `pg_upgrade` を実行し、新しいサーバーを一度起動して開くことを確かめ、そのあとで初めて名前を入れ替えます。古いデータは `pgdata.pg16` としてボリュームに残ります。PostgreSQL 16 のイメージは、ボリュームが必要とするときだけ取得します。失敗しても 16 のデータはそのままで、データベースは起動しません。詳しい説明、元に戻す方法、`pgdata.pg16` の削除方法は [k3s と Helm](/ja/install/helm/#postgresql-17) にあります。ルートなしのインストールでは、ユニット内のスクリプトのパスは `%E` に由来する `~/.config/containers/systemd` です。

## PostgreSQL の代わりに SQLite

データベースはイメージではなく設定です(k3s と Helm のページの「SQLite」)。Quadlet では、2 つ目のイメージではなく 2 つ目のファイルセットになります。各製品の `sqlite/` ディレクトリには 2 つあります。

- **`sqlite/hotloop.container`**: アプリだけです。データベースへの `Requires=` はなく、ネットワークもデータベースのパスワードもなく、`HOTLOOP_DB_TYPE=sqlite` とファイル `HOTLOOP_DB_PATH=/data/hotloop.db` を使います。`:stable` に従い、PostgreSQL のユニットとまったく同じように、問題のある更新をロールバックします。同じヘルスチェックと同じ `--sdnotify=healthy` です。
- **`sqlite/hotloop-data.volume`**: データベースファイルとその `-wal`、`-shm` がある `hotloop-data` ボリュームです。PostgreSQL のファイルと同じボリューム名なので、あとで切り替えても同じデータボリュームです。

| ディレクトリ | インストール | シークレット |
|---|---|---|
| `iot/`、`edge/`、`gateway/` | `hotloop.network`、`hotloop.container`、`hotloop-db.container`、`hotloop-db.volume`、`hotloop-data.volume` | 3 つ |
| `iot/sqlite/`、`edge/sqlite/`、`gateway/sqlite/` | `hotloop.container`、`hotloop-data.volume` | 2 つ: `hotloop-secret-key` と `hotloop-admin-password-hash` |

どちらか一方のセットだけをインストールし、両方は入れないでください。同じユニット名を使います。`sqlite/hotloop.container` の冒頭に正確な手順があります。要点は次のとおりです。

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

選ぶ前に知っておくことがいくつかあります。SQLite は 1 つのローカルディスクに対する 1 つの書き込み手です。Pi ではボリュームを USB SSD に置き、SQLite はネットワークストレージ上で壊れるため、ネットワークストレージは選べません。履歴はインデックス付きの 1 つのテーブルで、パーティションやハイパーテーブルではないので、1 秒間隔で何年分もの履歴を持つ現場には PostgreSQL のファイルが向いています。また、機器を SQLite と PostgreSQL の間で移すのは、ユニットの入れ替えではなくバックアップと復元([バックアップと復元](/ja/iot/backup/))です。新しいデータベースは空で始まります。「切り替える」ために、動いている PostgreSQL のインストールの上に `sqlite/hotloop.container` をコピーしないでください。PostgreSQL のボリュームのデータは読み込まれません。

Edge や Gateway で素の PostgreSQL にするには、TimescaleDB のユニットで `hotloop.container` に `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` を追加します。IoT のユニットはすでに素の PostgreSQL で、IoT には TimescaleDB のユニットはまったくありません。

### 検証済み(SQLite)

`iot/sqlite/hotloop.container` とそのボリュームは、コミット済みのファイルから Podman 4.9.3 上で systemd(`systemctl --user`)の下、ルートなしで実行しました。変えたのは名前、ポート、イメージ(同じツリーからビルド)、ユーザーマネージャーに必要なランタイムディレクトリだけです。ユニットは正常に起動し、`/healthz` と `/readyz` は 200 を返し、管理者はハッシュのシークレットからログインでき、`/api/status` が応答し、`hotloop.db`、`hotloop.db-wal`、`hotloop.db-shm` がボリュームに現れ、再起動ではマイグレーションが適用されず管理者は再びログインできました。Edge と Gateway の `sqlite/` ユニットは、イメージと保持期間の既定値を除いて同じファイルで、実際の Pi のベアメタル上で root として systemd の下で実行されています(2026-11-17)。

## Edge Relay

- **`edge-relay-hold.conf`**: 任意です。オペレーターが承認するまでイメージの更新を保留します。systemd のドロップインで、標準のインストールには含まれません。
- **`edge-relay.container`**: サービス本体です。完全なインストール手順は冒頭のコメントにあるので、何かをコピーする前に読んでください。
- **`edge-relay-data.volume`**: 転送キュー用の名前付き Podman ボリュームで、バッファーされた読み取り値がコンテナーの再起動後も残ります。サービスが最初に起動するときに Podman が自動で作成します。
- **`devices.example.json`**: デバイスファイルの出発点です。`/etc/edge-relay/devices.json` にコピーし、この現場の実際のデバイスに合わせて編集してください。完全な形式は [Edge Relay のリファレンス](/ja/edge-relay/reference/)にあります。

### クイックスタート

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

**更新。** ユニットは `:stable` に従い、Podman のタイマーがオンになれば自分で更新します。

```sh
sudo systemctl enable --now podman-auto-update.timer
```

新しいイメージがヘルスチェックに通らなければ、Podman は古いイメージを戻します。Gateway のフリート一覧には各リレーのバージョンとイメージダイジェストが表示され、すべての変更が記録されます。管理者が Gateway で承認するまで更新を保留するには、そのファイルの冒頭のコメントのとおりに `edge-relay-hold.conf` をインストールし、タイマーをオフにします。これができることとできないことのすべては、[Edge Relay のリファレンス](/ja/edge-relay/reference/#relay-の更新)にあります。

ローカルファイルの変更を反映するには、編集してから `sudo systemctl restart edge-relay.service` を実行します。リレーはそのファイルを起動時に読み込み、監視はしません。

Gateway が送るデバイスファイルには、これは必要ありません。再起動なしでその場で適用されます。読み取り専用のルートに `:ro` でマウントされているため `/etc/edge-relay/devices.json` には書き込めず、データボリュームに `/data/pushed-devices.json` として置かれ、それが存在する間はリレーはそれで動き、そこから起動します。送信を消すまでは、ローカルファイルへの編集は使われません。リレーが動いている間に Gateway で `DELETE /api/fleet/{id}/config` を実行すると、即座にローカルファイルに戻ります。どちらのファイルを使っているかは journal に出るので、JSON を疑う前にそこを確認してください。

実際の `quadlet` バイナリー(`podman-5.8.6` の `/usr/libexec/podman/quadlet -dryrun`)で検証しました。2 つのユニットはどちらもエラーなく解析され、期待どおりの `podman run` 呼び出しを生成し、ボリュームの依存関係とシークレットが自動で結び付けられます。
