---
title: "HotLoop Flow 编辑器"
description: "浅色和深色下的 Flow 编辑器：带调试栏和运行表的画布、部署前的审阅、被追踪的消息，以及登录界面。"
---

它跟随您的系统，浅色或深色，下面的每张图都以两种方式展示，浅色在前。下面的每张图都来自 `web/shots/screenshots.sh`，它会启动真实的二进制文件和真实的浏览器，所以编辑器一变就会重新截图，不可能退化成模拟图。画布上的工厂是一条烘箱线，背后有两次部署。

## 接线、运行、观察

![烘箱线上的编辑器：画布、部署历史，以及调试和运行面板](/synced/flow/docs/screenshots/editor.png)
![同一画面，深色](/synced/flow/docs/screenshots/editor-dark.png)

画布就是正在运行的东西。它下方的调试栏会打印您的调试节点看到的内容，旁边的 Runtime 表会统计进出每个节点的数量，并用一根条形显示它的队列有多满。产线出问题时，您直接在屏幕上读出来，而不是去翻日志。

## 在到达产线之前先审阅

![审阅面板列出一个已更改的节点，带有备注框，旁边的画布上该节点被框出](/synced/flow/docs/screenshots/review.png)
![同一画面，深色](/synced/flow/docs/screenshots/review-dark.png)

Deploy 并不会直接部署。它在画布上画出更改，用文字写出来，并请您写一条备注。备注会连同您的名字记入历史，这样凌晨 2 点接到电话的人就能看到改了什么、为什么改。

## 沿着连线追踪一条消息

![一条被追踪的消息在画布上被逐段点亮，并显示每个节点处理它所花的时间，下方是调试栏](/synced/flow/docs/screenshots/debug.png)
![同一画面，深色](/synced/flow/docs/screenshots/debug-dark.png)

在调试行上点击 Trace，这条消息走过的路径就会在画布上逐跳点亮，同时显示每个节点对它做了什么、花了多长时间。在同一面板里，可以把它变成测试，或重放到草稿中。

## 登录

![登录卡片](/synced/flow/docs/screenshots/signin.png)
![同一画面，深色](/synced/flow/docs/screenshots/signin-dark.png)

![当仪表板负责登录而此页面以其他方式打开时，运行时显示的提示](/synced/flow/docs/screenshots/dashboard-signin.png)
![同一画面，深色](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

它不会在未加锁时启动，所以任何人首先看到的是登录。当 EmberCORE 仪表板负责登录时，以其他方式打开的运行时会让人从仪表板进入，而不是再要求输入第二个密码。
