---
title: "无需 npm 的插件"
description: "插件是带内存上限、超时和描述文件的已签名 WebAssembly 模块，除非你授权，否则它得不到任何宿主访问权限。"
---

Node-RED 的社区节点是一个 npm 包。它需要盒子上有 Node.js，安装后在运行时自己的进程里运行，能触及该进程所能触及的一切。Flow 不运行这类节点，也永远不会，所以它的做法是这样的：插件是沙箱里的 WebAssembly 模块，有内存上限和超时，附带一个描述文件，编辑器据此绘制它的对话框，它经过签名，除非它提出请求并且你授权，否则得不到任何宿主访问权限。

这对你意味着：在插件运行之前，你可以在一个 JSON 文件里读完它的全部契约，盒子会拒绝任何不是由你选定的密钥签名的东西，而一个有缺陷的插件所能造成的最坏后果，只是让它自己的消息失败。

## 什么是插件

`<data.dir>/plugins/`（或 `plugins.dir`）下的一个目录，以插件命名，里面有三个文件：

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

每个插件在调色板的 Function 分区里成为一个节点类型，`wasm-<name>`。插件在 Flow 启动时读取，所以添加或修改插件需要重启。处理消息时不会读取任何东西。

### 模块

ABI 就是 [README](/zh-hans/flow/sandboxes/) 里的那一套：`hotloop_flow_process` 和 `hotloop_flow_alloc` 是必需的，`hotloop_flow_free` 是可选的，所有内容都以 JSON 传递。客体收到 `{"msg": {...}, "config": {...}}`，返回 `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`。不是纯 JSON 的消息属性，比如 HTTP In 节点附加的响应句柄或二进制缓冲区，不会交给客体。节点自己保留它，并在客体发出的每条消息上放回去，除非客体自己设置了该属性，这样插件就可以位于 HTTP In 和 HTTP Response 之间。`config` 是节点对话框里的内容。`error` 会让消息失败并转到 Catch 节点，在此之前已发送的内容仍然发送。

模块可以导入 WASI，如果它声明了上下文 capability，还可以导入下面两个上下文函数。它导入的其他任何东西都会在插件加载时被拒绝，拒绝信息会指出这个导入。

### 描述文件

`plugin.json` 读取时很严格。Flow 不认识的字段会被拒绝，所以拼错的 `"capabilites"` 会被发现，而不是变成一个悄悄什么都没请求的插件。

| 字段 | <span class="sr-only">详情</span> |
|---|---|
| `format` | `1`。必填。 |
| `name` | 小写字母、数字和连字符，最多 40 个，以字母开头。必须与目录名一致，因为 `plugins.grants` 和流程文件使用的就是它。 |
| `version` | 必填。显示在节点的帮助里和 `GET /plugins` 中。 |
| `label`, `description`, `help` | 调色板标签、一行说明，以及信息侧栏用的 Markdown。 |
| `inputs`, `outputs` | 输入必须是 1。输出 0 到 16，默认 1。 |
| `props` | 对话框。与内置节点使用的属性声明相同，种类有 `string`、`text`、`number`、`bool`、`select`、`json` 和 `list`。凭据、配置节点引用和代码编辑器类的种类会被拒绝：插件不该碰它们。 |
| `capabilities` | 它请求的宿主访问。 |
| `limits` | 它默认想要的 `memoryMiB` 和 `timeoutMs`。 |

编辑器根据 `props` 绘制对话框，浏览器里没有插件的任何代码。每个插件节点还会有名称、内存限制和超时三个字段。这三个名称是保留的。

## 限制，以及陷阱是什么样子

每个插件节点都有自己的内存上限和自己的超时。插件的描述文件设定默认值（没有说明时是 16 MiB 和一秒），节点可以在对话框里修改，而 `plugins.maxMemoryMiB`（64）和 `plugins.maxTimeout`（5s）是盒子根本上允许的范围。请求超出盒子允许范围的节点会让部署失败，并指出该调高哪个设置。

增长超过上限的客体会触发陷阱。到超时仍在运行的客体会被停止。无论哪种情况，消息都会交给最近的 Catch 节点，实例被丢弃，使下一条消息从干净状态开始，而其他节点不受影响。Catch 节点在 `msg.error.message` 里看到的是：

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

上限是预先占用的：上限为 64 MiB 的节点，只要它的实例存在，就会占用 Go 堆的 64 MiB，不论客体是否碰过它，因为靠复制来增长缓冲区会让宿主短暂持有数倍于上限的内存。证明这一点的测试会测量一次调用总共分配了多少（上限 256 MiB 时为 256 MiB），以及陷阱之后堆是否回到了起点。所以请把上限设成插件所需要的值，而不是你能输入的最大数字。

## Capability

没有 capability，就没有访问权限。每一项只有在描述文件提出请求、并且 `plugins.grants` 按名称授予该插件时才会接通。

| Capability | 提供的内容 | 没有它时 |
|---|---|---|
| `clock` | 真实的挂钟时间和单调时钟。 | 客体看到的是一个从 2022-01-01 开始、与工厂时间毫无关系的替代时钟。 |
| `random` | 操作系统的随机字节。 | 每次都是同一个固定序列。 |
| `context.flow` | 读写该节点自己所在流程的流程上下文。 | 对它来说上下文函数不存在。 |
| `context.global` | 读写全局上下文。 | 同上。 |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

请求未被授予的东西不会在处理消息时失败，而是让部署失败：流程在写入任何内容之前就以 422 被拒绝，正在运行的流程完全不受影响，消息会指出节点和要添加的那一行：

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

回滚也是一次部署，所以回滚到使用某个授权此后已被收回的插件的流程，会以同样的方式被拒绝。已安装但未被授权的插件仍会显示在调色板里，它的 capability 写在它的帮助中。

### 上下文函数

声明了上下文 capability 的客体可以从模块 `hotloop_flow` 导入这些函数。值以 JSON 传递。

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

作用域 `0` 表示流程，`1` 表示全局。`context_get` 返回 JSON 的长度，只有放得进 `outCap` 时才写入，所以拿回的内容比它提供的缓冲区更大的客体，会用更大的缓冲区重试。不存在的键是 `-1`，`-2` 表示被拒绝：作用域没有被授予，键或 JSON 有误，或者存储拒绝了。客体不能靠试探去读取没有授予它的作用域。

## 签名，以及信任发布者

插件用 ed25519 密钥签名。签名覆盖两个文件，而不只是模块，因为插件提出访问请求的地方是描述文件。只签模块的话，任何对目录有写权限的人都可以给已签名的插件添加一项 capability。被签名的消息是：

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

加载插件时不会查询任何东西：没有网络，没有透明度日志，没有证书链。检查的就是签名、它所指的密钥，以及你的密钥列表。对于一个可能没有出口路由的工厂网络里的盒子，这是有意的选择。这也意味着没有吊销服务，所以吊销一个密钥就是把它从 `plugins.trustedKeys` 中移除并重启。

### 作为发布者

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` 把 PKCS #8 私钥和 PKIX 公钥写成 PEM，与 `openssl genpkey -algorithm ed25519` 和 `openssl pkey -pubout` 生成的文件相同，并且拒绝覆盖其中任何一个。它会打印密钥 id 和公钥的单行形式。请把私钥放在 git 之外。不会提交任何密钥。

### 作为运维

在 Helm chart 里，它们是 `plugins.trustedKeys`、`plugins.grants` 和 `plugins.volume`，见[部署 Flow](/zh-hans/flow/deploying/)。

把发布者的公钥放进 `plugins.trustedKeys`，或者放进逗号分隔的 `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`，就是信任这个发布者。每个条目可以是 `ed25519:<base64>` 这一行、一个 PEM 公钥，或者包含一个公钥的文件路径，挂载的 Secret 或 ConfigMap 就是这样进来的：

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

没有受信任的密钥时，所有插件都会被拒绝。无法解析的密钥是启动错误。信任针对的是密钥而不是插件，所以信任一个发布者就是信任他们签名的一切。插件随后可以使用什么，是另一个决定，在 `plugins.grants` 里按名称做出。

## 被拒绝时

无法加载的插件会在启动时记入日志，连同原因列在 `GET /plugins` 里，不出现在调色板中，并且在部署使用它的流程时，拒绝信息里会点出它的名字。一个坏插件不会阻止 Flow 其余部分启动。`hotloop-flow plugin verify` 运行同样的检查，所以发布者看到的就是运维会看到的。

| 问题 | 提示内容 |
|---|---|
| 没有 `plugin.sig` | `unsigned: plugin.sig is missing` |
| 签名之后模块或描述文件被改动 | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| 由你不信任的密钥签名 | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| 完全没有配置密钥 | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| 签名文件损坏 | `signature file is malformed: ...` |
| 描述文件含有未知字段、错误的种类或错误的 capability | `plugin.json is not valid: ...` 并指出字段 |
| 模块导入了宿主不提供的东西 | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| 模块使用了上下文函数却没有声明 capability | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| 目录名与 `name` 不同 | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

签名在解析描述文件之前、编译模块之前就会检查，所以未签名的代码根本不会被编译。

## 两个示例

* `moving-average` 是 Rust。它对最近 N 条消息上的读数求平均，并把窗口保存在自己的内存里。它什么都不请求。运行 `cargo build --locked --release --target wasm32-wasip1`，然后 `plugin.wasm` 就是构建出的 `moving_average.wasm`。
* `stamp` 是 TinyGo。它给每条消息加上时间，所以请求 `clock`。它用 TinyGo 自己的容器、通过 Podman 构建：`podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow 是 Go 之家。宿主、签名、命令行工具和每一个测试都是 Go，TinyGo 示例也是 Go。之所以有 Rust 示例，是因为只对宿主所用语言有效的插件格式算不上插件格式，也因为信号处理库最可能已经是用 Rust 写的。这就是那个唯一非 Go 示例的书面理由。它构建所用的 crate 是 `serde` 和 `serde_json`，都采用宽松许可证，编译进示例模块而不是进 Flow。

## 尚未证明的部分

* 插件已在裸机上运行过（2026-11-17）。
* 在 Kubernetes 上，插件文件通过 `plugins.volume` 到达，可以是任何卷来源。ConfigMap 最多只能容纳 1 MiB 的插件，所以像 TinyGo 示例那么大的插件需要用 claim。
* 没有网络 capability。插件不能发起请求，这是有意为之，除非有人提出理由并附上主机白名单。
* Flow 测试会真实运行插件，与其他所有节点在同一个子进程里。插件的 capability 与部署会给它的相同。
* 在 shell 里手动运行 `hotloop-flow test` 不会加载插件。部署闸门和编辑器的测试运行会加载。
