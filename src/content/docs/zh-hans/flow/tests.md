---
title: "与流程放在一起的测试"
description: "在流程旁写一个测试文件，在模拟时钟上运行，让部署以它为门槛，测试里的任何东西都不会外泄。"
---

“我的改动有没有搞坏产线？”这个问题应该在部署之前由改动的人得到答案，而不是凌晨 3 点由值班的人来回答。所以流程可以带测试，测试是放在流程文件旁边的 YAML，和流程走同样的评审：

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

这是真实的运行时和真实的节点，在进程内运行，不需要服务器，也不需要编辑器。每个测试都有自己的运行时，所以一个测试留在 Delay 或上下文里的东西，不会泄漏到下一个测试。

- **`inject`** 按顺序放入消息，每条消息处理完，下一条才进入。有输入的节点在那里接收它。像 Inject 或 MQTT In 这样的源，会像自己产生了它一样从第一个输出送出，没有指定消息的 Inject 节点则会被按下按钮。
- **`expect`** 监视某个节点的输出，端口像编辑器一样从 1 开始计数。没有输出的节点，比如 Debug，按它收到的内容检查。子流程实例在它自己的输出上监视，不管这些输出来自它内部的哪里。
- **`msg`** 是消息必须包含的内容。你给出的每个属性都必须带着该值存在，一直到最深层，消息上的其他内容一律忽略，所以有人开始设置 `msg.topic` 时，关于负载的测试不会坏。**`assert`** 是一个必须得出真值的 JSONata 表达式，用于字面值做不到的检查。**`error`** 是 Catch 节点捕获的错误必须包含的文本。
- **`within`** 是期限。迟到的消息会失败，失败信息会说迟了多久。**`nothing: true`** 和 **`count: N`** 在流程安静下来之后才检查，因为只有那时“什么都没出来”才有意义。同一个端口上的两个期望就是按该顺序的两条消息。

测试在它等待的一切都发生、流程也无事可做时结束。除非你另行指定，`timeout` 是 5 秒，按测试自己的时钟计，下一节会讲。

失败信息会说明实际出来了什么，以及差在哪里：

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

无法运行的测试是错误，不是通过：它点名的节点不在流程里、两个节点重名、节点没有它指定的端口，或者流程里有节点启动不了。拼错的键也一样。`expcet:` 在读取文件时就会被拒绝，因为悄悄放过的笔误会让测试没有任何可检查的东西，而没有可检查内容的测试一定会通过。任何不是全部通过的情况，退出状态都是 1，`-junit` 会写出每个 CI 系统都能读的报告。

## 在测试的时钟上

没人会运行一套要等五分钟 Delay 的测试，所以测试不等。它有自己的时钟，并把时钟直接拨到流程里任何东西正在等待的下一个时刻：Delay 放行、Trigger 的第二条消息、按间隔或 crontab 的 Inject、Join 或 Batch 超时、Link Call 放弃。定时器触发，流程处理它发出的内容，然后时钟才去找下一个到期的事件，顺序与真实的分钟会带来的顺序相同。五分钟的 Delay 只是一步，大约一毫秒。

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** 把一次注入放在测试时钟上的某个时刻，在它之前到期的一切先发生。**`within`** 和 **`timeout`** 也在这个时钟上，所以每十分钟一个 Inject 的流程里，`timeout: 1h` 就是六个节拍加几毫秒。**`clock`** 设定测试何时开始，适用于关心时间的流程：在六点半触发的 crontab，会在测试时钟指向六点半时触发。Function 节点的 `Date`、Inject 的时间戳、设置日期的 Change 节点和 cookie 的 `Expires` 读的都是同一个时钟，所以打时间戳并比较时间的流程，在测试中与自己保持一致。

测试套件用它证明调色板里的每一种定时节点，精确到毫秒：固定、随机、速率和定时模式的 Delay，带 extend 的 Trigger，按间隔、启动时一次和 crontab 的 Inject，Join 和 Batch 的超时，以及一直等不到应答的 Link Call。所有这些，包括一小时的工厂时间，都在不到一秒内跑完。测试拨不动的是 CPU：真实时间过了一分钟仍在忙的流程，会让测试失败，而不是把整套测试挂住。JSONata 的 `$now()` 和 `$millis()` 读取的仍是挂钟。

## 在编辑器里生成测试

没人会为一个正常工作的流程写测试。他们在它出问题那天才写，那就晚了一天。所以编辑器能根据流程刚才做的事，两次点击就生成一个。

调试侧边栏里的每条消息都有一个 **Test** 按钮。点击它，编辑器就用这条消息起草一个测试：从它进入的源头再次放入的内容，以及这个 Debug 节点显示的内容，作为期望放在这里。想改什么都可以，因为带时间戳的读数用 `assert` 检查，比钉死到毫秒更合适。点击 **Add to tests**，它就加入流程文件旁边的测试套件末尾，原来写在那里的内容，包括注释，原样保留。套件里已有的名称，会在末尾加一个编号，而不是替换任何东西。

编辑器如何知道进来了什么：运行时会保留最近 64 条在源头进入流程的消息，以及最近 64 条到达 Debug 节点的消息，按消息在节点之间携带的 id 存放。这是一个有大小上限的环形缓冲，超过 64 KB 的消息根本不保留，所以它绝不会成为撑大 pod 的原因。被挤出去的消息，或者半路被某个节点换成新消息的消息，无法起草，编辑器会如实说明，而不是猜测进来了什么。

**Tests** 面板对工作副本运行测试套件，不管部署与否，这正是要点：你在部署之前就知道结果。通过的测试经过的每个节点会得到一个对勾，失败涉及的每个节点会得到一个叉，悬停时显示原因，点击失败会跳到它的节点。编辑任何东西，标记就会消失，因为它们描述的是已经不存在的流程。**Edit** 以 YAML 打开整个测试套件。被[关卡](#部署关卡)拒绝的部署会出现在同一个面板里，失败标在各个节点上。

这一切在每个拉取请求上都会在真实浏览器中针对真实的二进制文件运行。

## 部署关卡

别人笔记本上的测试，证明的是他笔记本上的那个流程。关卡证明的是正在部署的那个。把测试套件放在实例上，紧挨着它所测试的流程文件（`data/flows.test.yaml` 放在 `data/flows.json` 旁边，通过 `PUT /tests` 或编辑器），打开 `tests.gate`，每次部署都会针对即将上线的流程运行它。通不过的会被拒绝，返回 422 和完整报告：

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

这是一次真实运行：打开了关卡的二进制文件，本节开头的测试套件放在它的流程文件旁边，外加一个部署令牌。

**已经在运行的流程毫无察觉。** 关卡在写入任何一个字节之前运行：没有流程文件，没有凭据，没有部署记录，没有重启。拒绝会作为一条说明测试失败的 `deploy.refused` 进入审计记录。而且测试根本不在服务器进程里运行。它们在一个子进程里运行，就是这同一个二进制文件，以 `hotloop-flow test -stdin` 的形式，候选流程和测试套件通过 stdin 交给它，因为测试会启动流程里的每个节点，而其中一些会注册到整个进程共享的地方：Link In 按它的 id 注册，HTTP 路由按它的路径注册。如果在服务器内运行，候选流程的 Link In 一启动，就会替正在运行的流程的 Link In 应答。在子进程里，它碰不到产线使用的任何东西，在自己的 goroutine 里 panic 的节点只会拖垮测试，不会拖垮工厂，退出时内存也会归还。测试用最严苛的办法证明了这一点：被拒绝的候选流程有同样的 Link In，而拒绝之后，经过正在运行的流程的链接发送的消息仍然送达。

有三个值得了解的决定。**它默认关闭**，因为操作员没要求的关卡，就是一次会在凌晨 3 点因为当班没人听说过的原因而失败的部署。**无法运行的测试不算通过**：启动不了的子进程，或者运行时间超过 `tests.timeout`，都会拒绝部署，并说明是哪一种。还有，**回滚不受关卡限制。** 回滚是人们从糟糕状态回到已经运行过的状态的办法，因为今天的测试而卡住它，只会让故障更长。开了关卡但没有测试套件时，没有什么会失败，所以部署照常进行，日志会说明为什么没有检查。

## 上下文与凭据

每个测试都从空的上下文开始，无论前一个测试留下了什么。一个测试把计数器推到 42，并不是下一个测试的起点，因为一套只有第一个测试先运行、第二个才会通过的测试，就是在有人单独运行一个测试那天说谎的测试。所以需要计数器为 41 的测试会写明这一点，也会写明结束时上下文必须包含什么：

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

期望中的 `context` 与 `msg` 一样匹配，`null` 表示该键不能被设置。失败信息会说明该作用域实际保存了什么，因为常见的答案是笔误：`flow context of "Line 3" (t1): cuont: not set; it holds count`。

测试永远看不到真实的凭据。它使用自己点名的凭据运行，这正是它可以放心提交的原因，这些凭据到达节点的方式与真实凭据完全相同：HTTP 请求的密码会出现在它本该发送的 `Authorization` 头里，没有令牌就无法启动的 InfluxDB 配置会用测试的令牌启动。通过 `ew_credentialFiles` 从挂载文件读取密码的节点，会在该字段上拿到测试的凭据，因为测试不会从磁盘读取任何东西，测试没有点名时则是一个空值。

上下文在测试期间只存在于内存中，绝不进入状态数据库，所以测试读不到正在运行的流程留下的东西，也不会给它们留下任何东西。固定数据是测试里的 YAML，而不是假装成数据库的文件。

## 测试里的任何东西都不会外泄

一个真的运行你的 MQTT Out 的测试，会向工厂的代理发布消息，到那时它就不是测试，而是部署。所以在测试中，每个与进程外部世界通信的节点都会换成替身：MQTT 输入和输出，HTTP in、response 和 request，PostgreSQL，InfluxDB，TCP 和 UDP 的输入、输出和 request，WebSocket 输入和输出以及它们背后的监听器和客户端，文件节点，`exec`、`scan` 和 `netinfo`。

节点仍然把它的全部工作做到线缆跟前。MQTT Out 仍会算出主题、QoS 和字节；HTTP Request 仍会生成 URL、构造正文并跟随重定向；PostgreSQL 节点仍会构造 SQL 及其参数。然后它把这些交给替身，替身把它记录下来，并按测试编排的内容应答。没有编排时，应答就是什么都没有，而且成功：没有行，空的 200，以 0 退出的命令。源（MQTT In、HTTP In、TCP 和 UDP In、WebSocket In、Watch）不订阅、不监听、不轮询，所以到达的就是测试注入的内容。

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** 是节点本来会发送的内容，按 `msg` 的方式匹配。**`replies`** 编排返回的内容：为某个节点列出的第一个应答回答它的第一次调用，下一个回答第二次，最后一个会一直回答下去，所以“它回答了，然后就不再回答”只要两行。**`error`** 让调用像真实情况那样失败，所以历史数据库宕机时你的流程走哪条路径，可以在它真的宕机之前就测试好。

| 节点 | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | 查询用 `rows`，insert 用 `rowCount` |
| InfluxDB | `line`，行协议 | |
| TCP Out, UDP Out | `host`, `port`, `payload` (回复时为 `session`) | |
| TCP Request | `host`, `port`, `payload` | `payload`，按节点读取真实应答的方式读取 |
| WebSocket Out | `payload` (回复时为 `session`) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`，文件内容 |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

有几样东西测试有意不检查，因为它们属于设备，不属于流程：`exec` 的允许列表、路径和发现的作用范围，以及 `tls-config` 里的证书。测试中没有任何东西被运行、打开、探测或拨号，所以没有什么需要限定或加密的，而部署落地的那台设备上，部署仍然要遵守所有这些。

证明它的是这样一个测试：把上述每个节点都指向测试持有的一个 TCP 端口、一个 UDP 端口和一个目录，让一个读数穿过所有节点，逐字节检查每个节点本来会发送的内容，然后清点：零连接，零数据报，没有写入任何文件，没有执行任何东西。对外访问却没有替身的节点，会在任何东西运行之前按名称被拒绝，而且有人新增这样的节点时，调色板测试就会失败。
