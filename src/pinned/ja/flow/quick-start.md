---
title: "HotLoop Flow クイックスタート"
description: "HotLoop Flow をビルドまたは実行し、必須の管理者アカウントと認証情報のシークレットを設定して、ソースまたはイメージから起動します。"
---

ソースから:

```bash
cd web && npm install && npm run build && cd ..
go build -o hotloop-flow ./cmd/hotloop-flow

export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET="$(openssl rand -hex 32)"

./hotloop-flow
```

エディタのビルドが先で、省略はできません。バンドルは `go:embed` で埋め込まれるため、これなしで Go をビルドすると、エディタのないバイナリができるのではなく、パターンが見つからずに失敗します。

あるいは、これをすべて省いてください。

```bash
podman run --rm -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<bcrypt hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET="$(openssl rand -hex 32)" \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

ハッシュは `podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'` で生成します。イメージは distroless の非 root で、中にシェルがないため、`exec` で入る先も、コード実行を得た人が足場にできるものもありません。

次に <http://localhost:1880> を開きます。データディレクトリに `flows.json` を置いて再起動するか、エディタでそのままフローを作ってください。エディタは、素の TypeScript とネイティブ SVG のキャンバスの上に Svelte アイランドを載せた Astro で、バイナリ内の静的ファイルとしてビルドされます。ミニファイ後で JS 190.7 kB と CSS 30.1 kB、gzip で 62.5 kB と 6.8 kB で、`npm run build` のあとに `web/dist/_astro` から読み取った値です。どこからも何も取得しないので、インターネットのないマシンでも動きます。

## コマンド

| コマンド | 内容 |
|---|---|
| `hotloop-flow` | ランタイム、管理 API、エディタを提供します。既定の動作です。 |
| `hotloop-flow -config <path>` | 同じことを YAML ファイルから行います。`HOTLOOP_FLOW_CONFIG` も読みます。 |
| `hotloop-flow hash-password` | パスワードの bcrypt ハッシュです。`-password` または `HOTLOOP_FLOW_PASSWORD` を受け取り、8文字未満は拒否します。 |
| `hotloop-flow import <flows.json>` | デプロイする前に、何が起きるかを報告します。 |
| `hotloop-flow diff <old> <new>` | 2つのフローファイルをノード単位で比較します。git の diff ドライバーおよび difftool としても使えます。 |
| `hotloop-flow plugin keygen`, `sign`, `verify` | 発行者の鍵を作り、[プラグイン](/ja/flow/plugins/)に署名し、サーバーが読み込み時に行うすべての検査を実行して、拒否されるならその理由を示します。 |
| `hotloop-flow test <tests.yaml>` | [フローのテスト](/ja/flow/tests/)をプロセス内で実行します。パイプラインでは `-junit` を使います。 |
| `hotloop-flow deploy -file <flows.json>` | 稼働中のインスタンスとの diff を表示し、そのあとメモ付きでデプロイします。パイプライン向けです。 |
| `hotloop-flow export` | 稼働中のフローファイルをバイト単位でそのまま、または履歴から `-deployment N` で書き出します。 |
| `hotloop-flow token` | 新しい API トークンと、それ用に設定するハッシュを作ります。 |
| `hotloop-flow bench` | [数値](/ja/flow/overview/#数値)を出したベンチマークの仕組みです。 |
| `hotloop-flow version` | バージョンです。 |
