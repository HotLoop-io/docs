---
title: "core 4.17.0 发布说明"
description: "HotLoop core 4.17.0 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.17.0"
---

自动化基础的第二阶段、只读的 UniFi,以及设备密码的静态加密。从 4.16.0 升级只需一次普通的 `helm upgrade`,但设备密码会在第一次启动时加密,从那以后密钥就是你数据的一部分。动手处理正在运行的工厂之前,请先读下面的“从 4.16.0 升级”。

完整说明在 README 里:4.17.0 的变化。

## 简要说明

- **自动化基础,第二阶段。** Helper(归工厂人员所有的值,超限会被拒绝,绝不截断)、logbook(把状态变化、写入、报警、运行和配置合在一条时间线上)、条件、等待和停止步骤,以及状态触发器上的 `forSec`、脚本(CIP 周期写一次,到处都能运行)、配方(某个牌号的所有 setpoint 要么一起发出,要么一个都不发,并从设备读回确认)和 blueprint(一条规则写一次,为每台泵填写,固定在它的版本上,直到有人审阅升级)。MCP 工具从 16 个增加到 25 个。
- **UniFi Network,只读。** 交换机、端口、PoE、WAN 和客户端都作为 tag,每个控制台一个登录,证书固定。一台不出声的 PLC 的抽屉会告诉你它接在哪个交换机端口上、链路是否正常,标记为 OT 的网络上出现陌生设备会触发报警。已在真实控制台上验证只读。**尚未验证:** 在被监视的设备上真的拔一次线缆,以及手机加入标记为 OT 的网络。这两条报警只在测试中验证过,在别处没有,要等有人在机架上把两件事都做一遍。
- **设备密码会被加密**,数据库和备份里都是如此,密钥由 chart 生成在 `<release>-secret-key` 中并保留。
- **4.16.0 工厂可能碰到的修复:** 来自 chart 或 Quadlet 单元的 Edge Relay 会忽略每一次推送的配置,关闭持久化的 Edge Relay 则无法启动;在规则编辑器里手动修改会重置规则的运行额度;命令提示的判定可能在你点击时把 Set 从鼠标下挤走;迟到的更新可能把 Entities 画面带回过去;一条从未运行的规则会说它在 739887 天前运行过;App Store 部署不带 tenant。

### API 变更

- 尚未发生的时间会被省略,而不是作为 `0001-01-01T00:00:00Z` 发送:`lastRun`、`lastPoll`、`lastGood`、`clearedAt`、`ackedAt`、`shelvedUntil`、`raisedAt` 等等,实时推送也一样。
- 新路由:`/api/helpers`、`/api/logbook`、`/api/scripts`、`/api/recipes`、`/api/blueprints`、`POST /api/automations/{id}/blueprint-upgrade`、`/api/devices/{id}/network`、`/api/unifi/{id}/...` 和 `DELETE /api/fleet/{id}/config`。全都写在 docs/API.md 里。
- 新权限,operator 角色拥有这些权限:`helpers.write`、`scripts.run`、`recipes.apply`、`blueprints.apply`。编写脚本、配方和 blueprint 由管理员负责。
- tag 带有 `deviceClass`;规则带有 `blueprintId`、`blueprintVersion` 和 `blueprintInputs`。

### 从 4.16.0 升级

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`。不要用 `--reuse-values`,它会丢掉新的默认值并导致渲染失败。selector 和 volume claim 不变;唯一新增的对象是密钥的 Secret。
- 迁移 0009 到 0015 会在启动时运行(helper、logbook、脚本、tag 设备类别、配方、blueprint、UniFi)。全部是增量的。先做 `pg_dump`。
- `HOTLOOP_SECRET_KEY_FILE`:chart 在这次升级时生成密钥,Gateway 在那次启动时加密每一个已保存的设备密码。之后如果没有这把密钥,这些设备会一直掉线,并报出点名密钥的错误。升级之后做的备份,只有用这把密钥才能恢复,或者用 `--restore-keep-unreadable-credentials`,它会让这些设备保持掉线,直到有人重新输入密码。请把 Secret 与备份分开保管。回到 4.16.0 意味着恢复升级前的 dump。
- 用 `helm template` 渲染 chart,而不是安装它?请在 `secretKey.existingSecret` 里带上你自己的密钥,否则每次渲染都会生成一把新的。
- Edge Relay:推送的设备文件位于 `/data/pushed-devices.json`,只要它存在,就优先于 chart 的 `devices`;`DELETE /api/fleet/{id}/config` 会清除它。在 4.16.0 上失败的推送仍保留在 broker 上,会在 4.17.0 第一次启动时送达。Quadlet 用户请换用新单元。`persistence.enabled=false` 现在可以启动了,但每次 pod 被替换都会丢失转发队列、任何推送的文件和 OPC UA 证书。
