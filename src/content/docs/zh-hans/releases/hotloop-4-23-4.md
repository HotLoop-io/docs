---
title: "core 4.23.4 发布说明"
description: "HotLoop core 4.23.4 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.23.4"
---

画面导入从 CODESYS 扩展到 TwinCAT。`.TcVIS` 文件,以及 cds-text-sync 和 codescribe 的导出文件,会作为带有按钮、框架和指示灯的 HotLoop 画面导入,无法导入的内容会在保存任何东西之前连同它的文字一起列出。

## 变更内容

- **TwinCAT 画面可以导入。** TwinCAT 的 `.TcVIS` 文件是 IDE 归档 XML 中的同一种可视化,所以它走 CODESYS 转换器。已对真实的 TwinCAT PackML 示例(三个画面,MIT,许可证保存在旁边)做过检查:映射了 60 个元素,没有未映射的。参见 [Import a CODESYS screen](/zh-hans/iot/codesys-screen-import/)。
- **按钮。** 按钮输入动作中的每个简单赋值(`X := 5`、`X := TRUE`、一个枚举成员)都会变成一张写入该值的按钮卡片,以说明文字作为标签。配置了的 Toggle 输入会变成一个开按钮和一个关按钮。比赋值更复杂的代码(条件、调用、算术)会连同它的文字一起报告。OMAC PackML 枚举是已知的;其他任何枚举放在导入的 `enums` 中,没有已知编号的成员会按名称写入,并会说明。
- **用表达式控制指示灯和隐藏。** 指示灯的变量或不可见变量可以是一个 tag 与一个数字、TRUE、FALSE 或枚举成员的比较,用 NOT、AND 和 OR 以及括号连接。两个 tag 的比较、算术和调用无法带过来,会被报告。
- **框架。** 框架显示另一个可视化。把项目的其他文件与第一个文件一起发送(`codesysRelated`;在对话框中选择多个文件,第一个是画面),框架的可视化会被放进框架里,每个输入都绑定到给框架的那个变量。
- **符号规则可以组合。** `show` 或 `colors` 规则可以是 `{"all": [...]}` 或 `{"any": [...]}`,即 PLC 的 AND 和 OR,最多三层深、八个部分,丢失的 tag 会让 `all` 不成立,而 `any` 通过其他的成立。指示灯可以用 `lit` 规则代替它的 tag。参见[仪表板](/zh-hans/iot/dashboards/)。
- **测试。** 能耗电表测试用真正经过的时间,而不是固定的十秒,来限定电表所统计的内容。

## 迁移

无。

## API 变更

`POST /api/dashboards/import` 在 `codesys` 之外接受 `codesysRelated` 和 `enums`。没有路由改变。参见 [HTTP API](/zh-hans/iot/api/)。

## 从 4.23.3 升级

普通的 `helm upgrade`。没有迁移,也没有新的 secret。

## 尚未验证的内容

- 导入器是针对 TwinCAT PackML 示例以及 cds-text-sync 和 codescribe 的示例导出验证的,不是针对客户自己的项目。使用更多可视化语言的项目会列出更多它无法放置的内容。
- 表达式是一个 tag 与一个常量的比较,用 NOT、AND 和 OR 连接。其他任何内容都会报告,而不是猜测。
