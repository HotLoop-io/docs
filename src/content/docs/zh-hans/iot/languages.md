---
title: "Web 界面语言"
description: "Web 界面提供英语和另外十三种语言，阿拉伯语按从右到左排版，可在顶部栏或登录卡片上选择。"
---

HotLoop IoT、Edge 和 Gateway（以及运行 Edge 界面的 HotLoop for CODESYS）的 Web 界面提供英语和另外 13 种语言：西班牙语 (es)、法语 (fr)、意大利语 (it)、德语 (de)、书面挪威语 (nb)、保加利亚语 (bg)、希腊语 (el)、韩语 (ko)、日语 (ja)、越南语 (vi)、印地语 (hi)、简体中文 (zh-Hans) 和阿拉伯语（ar，从右到左排版）。

在顶部栏的语言框或登录卡片上选择一种。所选语言会保存在此浏览器中。如果没有选择，页面会使用浏览器语言列表中 HotLoop 支持的第一种，都不匹配则使用英语。只有语言文件完整时，该语言才会出现在选择列表中。

随语言变化的内容：每个界面上的每个词、数字的顺序和符号（德语、法语和西班牙语使用小数逗号）、日期和时间（24 小时制）、复数形式（阿拉伯语有六种）以及页面的方向。产品和协议名称（HotLoop、Modbus、OPC UA、MQTT、Sparkplug、CODESYS、UniFi）保持原样。来自工厂的值，例如变量名、设备名、有人输入的报警消息和服务器返回的错误文本，按原样显示。

## 工作方式

* [i18next](https://www.i18next.com/) 27 查找消息、填入 `{{name}}` 并选出复数形式。它向浏览器自带的 `Intl.PluralRules` 询问，所以复数规则就是 Unicode CLDR 的规则。数字和日期通过 `web/src/lib/format.ts` 使用 `Intl.NumberFormat` 和 `Intl.DateTimeFormat`。
* 消息位于 `web/src/i18n/locales/<language>.json`，扁平结构，每条消息一个键。`en.json` 是源文件。其他每个文件的键都与它完全一致。
* 在模板或脚本中，写 `tl('area.key')` 或 `tl('area.key', { name })`。带数量的消息，每种复数形式有一个键（`key_one`、`key_other`，以及语言需要时的 `key_few`、`key_many`、`key_two`、`key_zero`），使用时只写键名并附带 `count`：`tl('overview.tags_count', { count: n })`。
* 英语是页面的一部分。其他语言是单独的文件，有人选择时才获取。
* `web/src/i18n/index.svelte.ts` 保存语言；更改语言会重新绘制每个界面。放在 `.ts` 文件顶部常量里的词只在文件加载时读取一次，不会被翻译：请把它写成 getter（`get label() { return tl('x.y'); }`），或者保留键，在绘制的地方调用 `tl()`。
* 页面会设置 `<html lang dir>`。CSS 使用逻辑属性（`margin-inline-start`、`inset-inline-end`、`text-align: start`），所以阿拉伯语下布局会自行翻转。

## 添加或更改一个词

1. 把消息添加到 `en.json`，并在代码中用 `tl()` 写出。
2. 把它添加到其他每个语言文件，由读得懂该语言的人撰写，并遵循 codex 中的共享术语库（`work/notes/i18n/glossary/`）。使用简短、平实的句子。产品和协议名称保持英文。
3. 运行 `cd web && npm run check:i18n`。当语言文件缺少某个键、`{{placeholder}}` 与英语不同、或缺少该语言需要的复数形式时，它会失败；某个键未被使用时会失败；英语直接写在模板或代码中而没有经过 `tl()` 时也会失败。它在每次 `npm run build` 之前以及 `npm run typecheck` 中运行，因此完整测试套件和发布构建都会在此停下。需要保留的英文（名称、代码示例）连同原因写入 `web/i18n/allow.json`。

设置 `HOTLOOP_TEST_BROWSER_GALLERY` 和 `HOTLOOP_TEST_BROWSER_ARTIFACTS`，可为每个界面保留一张截图。

## 不翻译的内容

* 服务器发送的文本：API 的错误消息、通知和报警消息，以及 CLI。界面按收到的样子显示它们。
* 文档、OPC UA 服务器的名称、MQTT broker 和 Helm chart 的值。
