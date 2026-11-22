---
title: "Transmitter のインストール"
description: "ライブラリを CODESYS のライブラリリポジトリにインストールしてプロジェクトに追加する方法と、ブロックがエラーを報告したときの対処。"
---

CODESYS 開発システム 3.5 SP22 以降と、ターゲットに SysSocket と SysTimeRtc のコンポーネントがあるランタイムが必要です。CODESYS Control for Linux SL のランタイムには両方あります(後者はタイムスタンプのために 1.1.0 で新たに加わりました)。

## CODESYS Installer から

1.1.0 以降、リリースには `HotLoopTransmitter-1.1.0.package` も含まれます。https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package にあります。CODESYS Installer (IDE では Tools, CODESYS Installer) でインストールするか、ウィンドウなしでコマンドライン `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"` を使います。Installer がそのプロファイルのライブラリリポジトリに HotLoop という会社名でライブラリを置くので、下の手順 3 に進みます。パッケージは `.library` ファイルと同じライブラリを Installer が読める ZIP に入れたものなので、どちらの方法でも同じライブラリになります。

## ライブラリファイルから

1. https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library から `HotLoopTransmitter-1.1.0.library` をダウンロードし、同じフォルダの `SHA256SUMS` と照合します (`sha256sum -c SHA256SUMS`)。
2. CODESYS IDE で Tools, Library Repository, Install を開き、ファイルを選びます。これでリポジトリに HotLoop という会社名で入ります。
3. プロジェクトでアプリケーションの Library Manager を開き、Add Library で HotLoop Transmitter を選びます。SysSocket、SysTimeRtc とそのインターフェースライブラリは依存関係として一緒に入るので、何もする必要はありません。
4. `HLTX.FB_HLTX_Publisher` を宣言し、フィールドを追加して、毎サイクル呼び出します(例は README にあります)。
5. コントローラにダウンロードします。宛先はコントローラのネットワークから到達できる必要があります。マルチキャストの場合は、ネットワークのスイッチがそのグループを通す必要があります。

`.compiled-library` ファイルは、ソースを含まない同じライブラリです。Library Manager に Structured Text を見せたくない場合はこちらをインストールしてください。同じフォルダに `HotLoopTransmitter-1.1.0.compiled-library` としてあります。

届くものを確認するには、宛先ポートで待ち受ける UDP リスナーなら何でも使えます。ポートで待ち受けるか、マルチキャストグループに参加して、各データグラムを 16 進数付きの JSON 1 行として出力する小さな Go プログラムで十分です。

## ブロックがエラーを報告したとき

| `eError` | 意味 | 対処 |
|---|---|---|
| `NoFields` | フィールドが追加されていない | 有効にする前に `Add` メソッドを呼ぶ |
| `BadInterval` | `tPublishingInterval` が 1 ms 未満 | 値を設定する |
| `BadAddress` | `sDestination` がドット区切りの IPv4 アドレスではない | 修正する |
| `SocketCreate`, `SocketOption` | ランタイムがソケット呼び出しを拒否した。コードは `diLastSocketResult` にある | `tRetry` の後、ブロックが自分で再試行する |
| `TooBig` | フィールドが 1472 バイトに収まらない | 発行するフィールドを減らすか、writer id の異なるパブリッシャーを 2 つ使う |
| `BadField` | 保存されていたアドレスが消去された | `Clear()` を呼び、フィールドを追加し直す |
