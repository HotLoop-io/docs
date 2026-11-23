---
title: "core 4.21.0 リリースノート"
description: "HotLoop core 4.21.0 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.21.0"
---

このリリースは、OPC UA サーバーに X.509 サインインを加え、64 バイトのパスワード上限を外し、非推奨のセキュリティポリシーを既定でオフにします。CODESYS のアラームインポートも広げます。[4.20.2](/ja/releases/hotloop-4-20-2/) の上にビルドされています。

## 変更点

- **クライアントは X.509 証明書で OPC UA サーバーにサインインできます。** 管理者がクライアントの公開証明書を HotLoop のユーザーに紐づけると(Settings、OPC UA certificates、または API、または MCP ツール)、秘密鍵を持つクライアントがそのユーザーの権限でそのユーザーとしてサインインします。証明書を失効させると稼働中のセッションは 10 秒以内に終わり、証明書によるすべてのサインインとすべての拒否が logbook に記録されます。`HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`(チャート `opcuaServer.allowX509`)を設定するまでオフです。デバイスドライバーも `userCertificate` と `userPrivateKey`(RSA、鍵はパスワードと同様に封印)で同じようにサインインできます。名前ルール付きの信頼された CA は実装していません。
- **65 から 72 バイトのパスワードが OPC UA でサインインできるようになりました。** Web UI では以前から動いていました。サーバーのもとになっているライブラリが、パスワードが 64 バイトを超えるユーザー名トークンをすべて拒否していました。
- **非推奨のセキュリティポリシー `Basic128Rsa15` と `Basic256` は既定でオフです。** サーバーはもう一覧に載せず、名前で要求したクライアントはチャネルを開くときに拒否されます。新規インストールにもアップグレードにも適用されます。これより新しいものを話せないレガシークライアントは、`HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true`(チャート `opcuaServer.allowDeprecatedPolicies: true`)で再び接続でき、サーバーは起動時にその旨を表示します。これをオフにするオプションはアップストリームでも開かれています(pull request 66)。
- **CODESYS のアラームインポートが Outside range アラームを読みます。** IDE の Export Alarms はこれを `OutOfArea` と書き出し、下限の `lo` と上限の `hi` の 2 つのアラームとして取り込まれます。Inside the range、Change、Event、Alarm (API) は理由とともにスキップとして一覧されます。ここには、それらを正直に言い表すものがないからです。インポーターは、IDE が提供するすべての観測タイプを書き出したエクスポートをもとに広げ、そのエクスポートはテストのフィクスチャーとして保管しています。

## API の変更

- 新機能:`GET /api/opcua/certificates`、`GET` と `POST /api/users/{username}/certificates`、`POST /api/users/{username}/certificates/{thumbprint}/revoke`、`DELETE /api/users/{username}/certificates/{thumbprint}`、すべて `users.manage` です。新しい MCP ツールは 5 つで、合計 133 個です。
- マイグレーション 1 つ、0027:`user_certificates` テーブル(公開証明書のみ)です。バックアップに含まれます。

## アップグレード

通常の `helm upgrade`、または Quadlet の自動更新です。まず、お使いの OPC UA クライアントに `Basic256` か `Basic128Rsa15` を使っているものがないか確認してください(Ignition の接続画面で分かります)。そのクライアントは、`Basic256Sha256` に移すか、上のレガシースイッチを設定するまで、アップグレード後に接続できなくなります。新しいテーブルがある状態での前のリリースへのロールバックは試していません。

- 4 つのチャート(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)すべてが 4.21.0 で、これまでのすべてのバージョンがインデックスに残っています。

- このビルドは amd64 のみで、`stable` は持っている arm イメージを保ちます。次のリリースは、arm イメージをビルドする小さなバージョンアップです。
