---
title: "Flow 2.4.0 リリースノート"
description: "HotLoop Flow 2.4.0 の内容、アップグレード時の変更点、稼働中のプラントに触れる前に読むべきこと。"
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 では、EmberCORE ダッシュボードが人を Flow にサインインさせられます。ダッシュボードから Flow を開いた人は、テナントが与えたロール、つまりフルアクセスか読み取り専用で、2 回目のログインなしに入れます。ダッシュボードの鍵を設定しない限りオフで、以前動いていたものは何も変わりません。

## 新機能

**EmberCORE ダッシュボードからのサインイン**
- ダッシュボードは、Flow へ中継するすべてのリクエスト(エディタの WebSocket を含む)の `X-Embernet-Assertion` に、自分で署名したトークンを載せます。Flow はダッシュボードの公開鍵で、署名(ES256)、発行者(`embernet-dashboard`)、このテナントのこの Flow 向けに作られたこと(audience は `<tenant>/<release>` なので、別のアプリ向けのトークンはここでは何も開けません)、約 1 分の有効期限を確認します。どれか 1 つでも誤っているトークンは拒否され、リクエストのほかの何かがそれを救うことはありません。
- ロールはダッシュボードのテナントのロールマップから決まります。`*` はすべての権限です。`read` はフロー、パレット、設定、ステータスで、それらを変更するものは含みません。デプロイも inject もデプロイログもありません。オペレーターとビューアーは既定で `read` を得ます。どちらでもないロール、またはロールなしは、アクセスなしです。この方法でサインインした人は、デプロイログと監査記録に `dashboard:<email>` として表示されます。
- セッションはありません。ダッシュボードはリクエストごとに新しいトークンを送るので、そちらで変えたロールは次のリクエストで反映され、取り消すものはありません。
- エディタは、独自のサインインフォームを出す代わりに「EmberCORE ダッシュボードから開いてください」と表示し、ダッシュボードがサインインさせた場合はサインアウトボタンを外します。誰もサインインしていない段階でこれを尋ねる方法が `GET /auth/mode` です。
- チャートはこれを `embernetSignin` の下で受け取ります。App Store がダッシュボードの公開鍵を渡し、チャートがそれをマウントし、設定を書き、Pod をローリングし、ダッシュボードが人をサインインさせるべきだと分かるよう Service にアノテーションを付けます。

## 変更点

鍵を設定しない限り何も起きません。鍵ファイルがなければ Flow はヘッダーをまったく読まず、既定値の `helm template` はこれまでどおりです。

## アップグレード

2.4.0 のイメージとチャートへの単純な `helm upgrade` です。初回起動で起きることはありません。

手動で使うには、ダッシュボードの公開鍵(PEM ファイル)をマウントし、`auth.assertion.publicKeyFile` と `auth.assertion.audience`、または `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` と `HOTLOOP_FLOW_ASSERTION_AUDIENCE` を設定します。読めない鍵や audience がない場合、Flow は起動を拒否します。ほかの設定は `auth.assertion.issuer`(`embernet-dashboard`)、`header`(`X-Embernet-Assertion`)、`hideLogin`(`true`)です。

管理者ログインと API トークンは、その横で引き続き使えます。スタッフと自動化のための非常口であり、エディタのフォームがなくなっても影響を受けません。

イメージ: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`、linux/amd64 と linux/arm64。チャート: `https://hotloop.io/hotloop-flow/`。このタグの README に残りがあります: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
