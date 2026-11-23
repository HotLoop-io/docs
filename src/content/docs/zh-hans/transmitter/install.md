---
title: "安装 HotLoop Transmitter"
description: "把库安装到 CODESYS 库仓库，添加到工程，以及功能块报告错误时该怎么办。"
---

你需要 CODESYS 开发系统 3.5 SP22 或更高版本，以及目标设备具备 SysSocket 和 SysTimeRtc 组件的运行时。Linux SL 版 CODESYS Control 运行时两者都有（后者是 1.1.0 新增的，用于时间戳）。

## 通过 CODESYS Installer

从 1.1.0 起，发布包里还有 `HotLoopTransmitter-1.2.0.package`，地址是 https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.package。用 CODESYS Installer 安装（在 IDE 中：Tools, CODESYS Installer），或用它的命令行无界面安装，`PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`。Installer 会把库放进该配置文件的库仓库，归在 HotLoop 公司名下，然后你直接进入下面的第 3 步。这个包与 `.library` 文件是同一个库，只是装在 Installer 能读取的 ZIP 里，所以两种方式得到的库完全相同。

## 通过库文件

1. 从 https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library 下载 `HotLoopTransmitter-1.2.0.library`，并用同一文件夹中的 `SHA256SUMS` 校验（`sha256sum -c SHA256SUMS`）。
2. 在 CODESYS IDE 中：Tools, Library Repository, Install，选择该文件。它现在位于仓库中的 HotLoop 公司名下。
3. 在你的工程中，打开应用的 Library Manager，Add Library，选择 HotLoop Transmitter。SysSocket、SysTimeRtc 及其接口库会作为依赖一起带入，无需你操作。
4. 声明一个 `HLTX.FB_HLTX_Publisher`，添加你的字段，每个周期调用它（示例见 README）。
5. 下载到控制器。目标地址必须能从控制器所在网络访问；组播的话，网络中的交换机必须转发该组。

`.compiled-library` 文件是同一个库，但不含源代码。如果你不想让 Structured Text 在 Library Manager 中可见，就安装这一个。它在同一文件夹中，名为 `HotLoopTransmitter-1.2.0.compiled-library`。

要检查收到了什么，目标端口上的任何 UDP 监听器都可以。一个在端口上监听或加入组播组、并把每个数据报连同十六进制内容打印成一行 JSON 的小型 Go 程序就很好用。

## HotLoop Alarms

从 1.2.0 起，发布内容的同一文件夹中还有 `HotLoopAlarms-1.0.0.0.library` 和 `HotLoopAlarms-1.0.0.0.compiled-library`，即用于 PLC 自身报警的库。安装其中任意一个，方法与 Transmitter 库相同，然后把它添加到应用程序的 Library Manager。项目需要一个 Alarm Configuration，HotLoop 4.23.6 及更高版本会读取该功能块。

## 功能块报告错误时

| `eError` | 含义 | 处理 |
|---|---|---|
| `NoFields` | 没有添加任何字段 | 启用前先调用一个 `Add` 方法 |
| `BadInterval` | `tPublishingInterval` 小于 1 ms | 设置它 |
| `BadAddress` | `sDestination` 不是点分 IPv4 地址 | 修正它 |
| `SocketCreate`, `SocketOption` | 运行时拒绝了一次套接字调用；`diLastSocketResult` 中有其错误码 | 功能块在 `tRetry` 之后自行重试 |
| `TooBig` | 字段放不进 1472 字节 | 发布更少的字段，或使用两个 writer id 不同的发布器 |
| `BadField` | 已保存的地址被清除 | 调用 `Clear()` 并重新添加字段 |
