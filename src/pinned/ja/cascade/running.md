---
title: "Cascadeの実行"
description: "Podman Quadletまたはk3sのHelmでCascadeを実行します。SQLiteでもPostgresでも動き、ユニットとチャートのプローブが使うヘルスチェックを備えています。"
---

:::note[これから来る内容も含みます]
このページには、最新リリースであるHotLoop Cascade 1.4.2より新しい内容も一部含まれています。お使いのバージョンには入っていない部分があるかもしれません。何が変わったかは[リリースノート](/ja/releases/)をご覧ください。
:::

Podmanホストでは、`deploy/quadlet`にsystemdのユニットがあります。ファイル1つとボリューム1つでSQLite上のCascadeになり、`deploy/quadlet/postgres`は専用のネットワーク上のサーバー、ワーカー、PostgreSQLです。どちらも起動時に開始し、失敗すると再起動し、読み取り専用、非ルート、すべてのケーパビリティを外した状態で動きます。手順はそのREADMEにあります。

バージョンを手動で取得するには次のようにします。

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:1.5.0
```

ユニットは`:stable`に従い、Podmanの自動更新タイマーがそれを更新します。

k3sでは、`charts/hotloop-cascade`がHelmチャートです。

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version 1.5.0
```

チャートには、EmberNetダッシュボードが読み取るラベルが、Serviceとエディターを提供するPodに付いています。そのため、App Storeから展開したCascadeは、Running AppsにLAUNCHボタン付きで表示されます。`gui.appName`、`gui.port`、`gui.displayName`で表示内容を変えられます。

これはボリューム付きのSQLite上のPod1つです。PostgreSQLと組み合わせて`--set split=true`を指定すると（チャートが動かすPostgreSQLなら`--set postgresql.enabled=true`、自前のものなら`externalDatabase.existingSecret`）、API、Webhook、ワーカーのPodに分かれ、それぞれ個別にスケールできます。保存された認証情報を封じるキーは最初のインストールで作られ、リリースをアンインストールしても残ります。キーがリリースと一緒に消えると、残したデータベース内のすべての認証情報も一緒に使えなくなるためです。このキーはバックアップしてください。

`hotloop-cascade healthcheck`は、実行中のサーバー自身のヘルスエンドポイントに問い合わせ、0または1で終了します。Quadletのユニットもチャートのプローブも、その背後にあるエンドポイントを使います。
