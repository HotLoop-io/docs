---
title: "Podman QuadletでCascade"
description: "Podman QuadletでCascadeをsystemdサービスとして実行します。SQLiteまたはPostgresと別ワーカーで、更新の時間帯も自分で決められます。"
---

実行方法は2つあります。どちらもPodman 5.0以降とrootでのインストールが必要で、誰もログインしていなくても起動時に始まります。どちらも`ghcr.io/hotloop-io/hotloop-cascade:stable`に追従し、読み取り専用でrootなしにすべてのケイパビリティを外して実行し、再起動はsystemdに任せます。更新とそのロールバックについては最後に書いています。

## 1台、SQLite

`hotloop-cascade.container`と`hotloop-cascade-data.volume`。データベースはボリューム内のファイルで、保存した認証情報を暗号化するキーのすぐ隣にあります。

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

`http://this-box:8080`を開きます。最初に開いた人が最初のアカウントを作るので、アドレスを共有する前に自分で作ってください。

## PostgreSQL、サーバー、ワーカー

`postgres/`。データベース、サーバー、そして必要ならワーカーを増やせます。Postgresがキューなので、ワーカーは同じ場所から仕事を受け取ります。データベースは専用のネットワークに置かれ、ポートは公開しません。

最初にシークレットを3つ、一度だけ作ります。コマンドは`postgres/hotloop-cascade.container`の先頭にあります。いちばん大事なのはキーです。失うと保存した認証情報がすべて読めなくなります。この機器ではない別の場所にコピーを保管してください。

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

ワーカーを増やすには`hotloop-cascade-worker.container`を使います。ワーカーはデータボリュームを共有するので、同じ機器上に置く必要があります。1台を超える場合はHelmチャートを使います。

## 設定

`/etc/hotloop-cascade/cascade.env`に1行に1つ`NAME=value`の形で書きます。空でもファイルは必要です(`install`の行が作ります)。よく使うのは次のとおりです。

| 設定 | 内容 |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | 人がCascadeにアクセスするアドレスです。WebhookとOAuthコールバックのリンクはこれから作られます。設定するまでは`http://localhost:8080`で、機器自身からしか使えません。 |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | `/metrics`に`Authorization: Bearer`を必須にします。 |
| `HOTLOOP_CASCADE_FILES_DIR` | このディレクトリでファイルステップを有効にします。コンテナにもマウントしてください。 |

ユニットが設定するのはデータディレクトリ、ポート、キーだけで、ユニットで設定した値はenvファイルの値より優先されるため、これらには手を付けないでください。変更後は`sudo systemctl restart hotloop-cascade`を実行します。

## 確認

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

ヘルスとメトリクスはポート8081にあり、ループバックだけに公開されています。8080や8081をすでに別のものが使っている場合は、`PublishPort=`の行の左側を変更してください。

## アップグレード

アプリのユニットは`:stable`に追従し、`AutoUpdate=registry`を持っています。Podmanのタイマーを機器ごとに一度だけ有効にします。

```sh
sudo systemctl enable --now podman-auto-update.timer
```

タイマーが動くと、Podmanが`:stable`を取得し、ダイジェストが変わっていれば新しいイメージでユニットを再起動します。コンテナがヘルスチェックに通るまで、ユニットは起動済みとは数えられません(`Notify=healthy`。チェックはバイナリが自身の`/readyz`に問い合わせるもので、イメージにシェルがないためJSON配列で指定しています)。新しいイメージがそこまで到達しなければ、Podmanは前のイメージを`:stable`に戻して起動します。新しいイメージは立ち上がる途中でデータベースを移行するため、待ち時間は最大15分です。

こちらから指示するまで更新を止めておくには、タイマーをオフのままにして、準備ができたら`sudo podman auto-update`を実行します。決まった時間帯にだけ更新したい場合は`update-window.conf`をインストールしてください(使い方はファイルの冒頭にあります)。

ロールバックでは元に戻せないことが2つあります。マイグレーションは前にしか進まないので、更新を有効にする前にバックアップを取ってください。古い版が読めない形でテーブルを変えるリリースは、そのリリースノートに明記されます。もう1つはデータベースです。データベースのイメージは正確なタグに固定され、意図的に更新ラベルを付けていません。起動しない新しいサーバーは古いイメージを戻せば元に戻りますが、新しいデータベースイメージは起動してデータディレクトリを書き換えたあとで、初めて間違いだったと分かることがあります。PostgreSQL 18の範囲内なら、リリースノートを読みバックアップを取ったうえで、タグを書き換えるだけです。

PostgreSQL構成では、サーバーと各ワーカーは別々のユニットなので、起動できない更新は、そのユニットだけをロールバックし、隣のユニットには影響しません。

## 検証した内容

ユニットを、Podman 6.1.3でsystemdの下でrootlessにして実際に実行しました。ghcr.io の代わりにローカルレジストリを使い、ホストのポート以外は提供したユニットを編集せずに使いました。単独構成とPostgreSQL構成の両方で次を確認しています。正常なコンテナを待つ初回起動。新しいダイジェストへの更新(データはそのままで正常に戻り、PostgreSQL構成ではデータベースのコンテナには触れませんでした)。起動時に終了するイメージへの更新(`podman auto-update`は`rolled back`と報告し、前のダイジェストが再び正常に動き、前のワークフローも動き続けていました)。Podman 4.9.3でのroot インストールでは、以前の版のユニットがsystemdの下で起動と再起動をしました。また、Quadlet 4.9は`Notify=healthy`に対応していないため、ユニットには`--sdnotify=healthy`も入っています。

続いて両方の構成を、ユニットが案内するとおりrootインストールで、Podman 5.8.7のsystemdの下、使い捨ての特権コンテナの中で、ghcr.ioのミラーとして同じローカルレジストリを使い、ユニットは未編集のまま再度実行しました。単独構成では、起動は正常なコンテナを待ち、強制終了したコンテナは正常に復帰し、正常なイメージへの更新は新しいダイジェストで正常に起動し、起動時に終了するイメージへの更新は`rolled back`と報告されて正常なイメージが再び動き、各ステップの後にワークフローが実行されました。PostgreSQL構成(サーバーと追加ワーカー1つ)では、サーバーでの`systemctl start`がデータベース、次にサーバーが正常になるまで待ち、強制終了したサーバーは復帰し、正常なイメージへの更新はサーバーとワーカーを移し、データベースのコンテナには触れず、起動時に終了するイメージへの更新は`rolled back`で戻って両方が正常なイメージに復帰しデータベースには触れず、ワークフローは更新の前、途中、後に実行されました。出力を読むときに知っておくことが1つあります。サーバーとワーカーは1つのイメージを共有していて、片方が先にロールバックされると、もう片方は再起動を伴って代わりに`true`と表示され、結局は正常なイメージに乗りました。どちらが先にロールバックされるかは実行のたびに変わりました。

ベアメタルで実行しました(2026-11-17)。実機のRaspberry Piで、ghcr.io そのものに対するQuadletの自動更新も行っています。
