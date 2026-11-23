---
title: "core 4.20.0 发布说明"
description: "HotLoop core 4.20.0 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.20.0"
---

新的 Web 界面现在就是 `/` 上的那一个,代理可以通过 MCP 修改它能读取的一切。没有迁移,普通的 `helm upgrade` 或 Quadlet 自动更新就能带上它。上一个版本 [4.19.11](/zh-hans/releases/hotloop-4-19-11/) 是最后一个默认画面还是旧画面的版本。

这次构建只有 amd64,下一个版本是一次小的版本号提升,用来构建 arm 镜像,两轮就是这样进行的。在此期间 `stable` 保留它已有的 arm 镜像。

## 变更内容

- **新的 Web 界面是默认的,旧的已经没有了。** 每个画面都重建为静态页面(Astro,带 Svelte 部分),嵌入在唯一的二进制里,设备盒上不需要 Node,也不需要 CDN。它在 4.19.x 期间位于 `/next`。在 `/` 上,是同样的十九个画面,有同样的控件、字段、列、表单和文字,面向查看者、operator 和管理员。有意看起来不同的地方:
  - 颜色是 HotLoop 的暖色底和橙色,与网站、Flow 和 Cascade 相同,标志是官方的。
  - 画面在桌面上的侧栏中按 Operate、Plant、Build 和 System 分组。在手机上有一条五项的栏(Board、Alarms、Dashboards、Entities、More),More 会打开所有画面。
  - 主题控件写的是 Dark 或 Light,过去显示的是一个月亮。
  - 已安装应用的图标、主题颜色和启动画面颜色都随新外观变化。
  - 抽屉为它的滚动条留出位置,所以里面的卡片在加载历史时不会移动。
- **HotLoop 无法访问时的登录会说明原因并自行恢复。** 从未登录过或已登出的手机在没有连接时打开页面,会得到登录画面,上面有一句话说明 HotLoop 从这里没有应答。页面每三秒再问一次,连接恢复时不用碰就会重新加载。这是旧行为,被保留了下来。
- **MCP 可以修改它能读取的一切。** 过去有二十七个工具读取工厂并命令设备;现在有 128 个。另外六十四个修改配置:设备和 tag、发现和 broker、UniFi 网络、实体、helper、设备和标签、报警、自动化和 blueprint(代理现在可以从 blueprint 创建规则,以前它只能预览)、脚本、配方、仪表板,以及画面能保存的其余内容。三十七个触及管理员自己的功能:用户和 PIN、设置、备份、升级、historian 目标、broker 登录、edge relay 车队和报告。没有一个是第二套实现。每个都是 REST API 的一个路由,由该路由自己的处理器运行,所以验证、权限检查、运行时重载和审计行都是该路由的,代理作为操作主体。
- **变更前面有什么。** 开关 `HOTLOOP_ALLOW_MCP_WRITES`(默认开启)必须开启,并且设置了 `HOTLOOP_MCP_OIDC_WRITE_ROLE` 的调用者必须持有该角色。调用只带它的路由所要求的那一个权限(`devices.write`、`alarms.write`、`users.manage`、`settings.write` 等),没有它就用路由自己的话拒绝。每次变更都需要一个 `reason`,在系统日志里记为一条 `config` 行,与路由自己的那一行并列。命令设备仍然是 `write_tag`、`call_service`、`run_script`、`apply_recipe` 和 `trigger_automation`,位于 `HOTLOOP_ALLOW_WRITES`、tag 的可写标记及其范围之后。把 tag、规则或配方设为可写是配置,在被使用之前不命令任何东西;它那时命令的内容会遇到同一个关口。两个写入开关没有路由,所以 `save_settings` 对代理拒绝它们,就像 Settings 画面一样,代理也不能打开它自己的写入所等待的开关。用户的密码经过调用的方式与经过 API 一样,审计行从不携带它。这些工具在 `--mcp-stdio` 下也存在。每个工具、它的路由和它的权限见 [MCP](/zh-hans/iot/mcp/#更改配置)。

## API 变更

- `GET /next` 和 `GET /next/` 是指向根的 `301`,所以在新界面与旧界面并存时做的书签仍然能到达。`Location` 是相对的,所以在基础路径下也是对的。
- `GET /static/` 没有了,`GET /next/manifest.webmanifest` 也随之没有。页面、它的文件、图标、`/manifest.webmanifest` 和 `/sw.js` 像以前一样从根提供;旧的样式表和脚本没有任何地方链接,也不再提供。
- `HOTLOOP_UI` 不再被读取。设置它没有任何作用。
- 没有其他路由改变。MCP 工具是新的接口面,不是 REST 路由。

## 从 4.19.11 升级

普通的 `helm upgrade`,或 Quadlet 自动更新。没有迁移,也没有需要配置的东西。第一次加载会取得新页面,service worker 会替换旧的缓存,所以装过应用的手机在下次打开时会显示新画面。升级不会让任何东西无法撤销,回滚到 4.19.11 是安全的,因为数据库里没有任何变化。

## 已知

- 没有新内容。[路线图](/zh-hans/roadmap/)中 Broken or missing 下仍然开放的:OPC UA X.509 用户 token、我们的 OPC UA 服务器提供的已弃用策略 `Basic128Rsa15` 和 `Basic256` 以及超过 64 字节的密码(两者都来自库),还有针对真实设备的 S7comm 和 EtherNet/IP 静默设备测试。
