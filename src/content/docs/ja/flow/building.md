---
title: "Flow をソースからビルドする"
description: "Flow のバイナリをソースからビルドします。エディタを内蔵し、下に C ライブラリを持たない、静的なバイナリ1つです。"
---

HotLoop Flow はエディタを内蔵した静的バイナリ1つなので、ほとんどの方は公開済みのイメージを取得して使い、ビルドすることはありません。ご自身でビルドしたい場合、ソースは公開されており、ビルドには Go と Node が必要です。

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

成果物は静的で、下に C ライブラリがないため、ほかに何もインストールされていない distroless イメージで動きます。Flow のリリースはすべてバージョンタグからのみビルドされるので、現場にあるイメージは、必ず名前を挙げられ、リリースまでたどれるものになります。