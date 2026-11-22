---
title: "导入工作流"
description: "把现有工作流导入 Cascade：哪些内容会被带过来，哪些内容导入器会告诉您无法带过来。"
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` 会转换从其他工具导出为 JSON 的工作流。它只带过来能够确定的内容：它认识的步骤，以及步骤设置中的字段读取。其余一切都以关闭状态带入，原始设置保存在其备注中，报告会逐项列出每一项及原因。它绝不会把 JavaScript 表达式猜成它可能的意思，也绝不会带入凭据，因为导出文件里没有凭据：报告会说明哪个位置需要哪些凭据。然后用 `workflows import workflow.yaml` 导入。
