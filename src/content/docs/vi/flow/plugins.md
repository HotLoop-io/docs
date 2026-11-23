---
title: "Plugin không cần npm"
description: "Plugin là một mô-đun WebAssembly đã ký, có trần bộ nhớ, thời gian chờ và bộ mô tả, và nó không có quyền truy cập máy chủ trừ khi bạn cấp."
---

Một nút cộng đồng của Node-RED là một gói npm. Nó cần Node.js trên hộp, và khi đã cài, nó chạy ngay trong tiến trình của runtime với mọi thứ mà tiến trình đó có thể chạm tới. Flow không chạy những nút đó và sẽ không bao giờ chạy, nên đây là điều nó làm thay thế: plugin là một mô-đun WebAssembly trong sandbox có trần bộ nhớ và thời gian chờ, đi kèm một bộ mô tả mà trình chỉnh sửa dùng để vẽ hộp thoại của nó, được ký, và không có quyền truy cập máy chủ trừ khi nó yêu cầu và bạn cấp.

Điều đó có nghĩa là với bạn: bạn đọc được toàn bộ hợp đồng của một plugin trong một tệp JSON trước khi nó chạy, hộp từ chối mọi thứ không được ký bằng khóa bạn đã chọn, và điều tệ nhất một plugin lỗi có thể làm là làm hỏng các thông điệp của chính nó.

## Plugin là gì

Một thư mục dưới `<data.dir>/plugins/` (hoặc `plugins.dir`), đặt tên theo plugin, có ba tệp:

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Mỗi plugin trở thành một loại nút, `wasm-<name>`, trong mục Function của bảng nút. Plugin được đọc khi Flow khởi động, nên thêm hay thay đổi một plugin là phải khởi động lại. Không có gì được đọc vào lúc xử lý thông điệp.

### Mô-đun

ABI là cái trong [README](/vi/flow/sandboxes/): `hotloop_flow_process` và `hotloop_flow_alloc` là bắt buộc, `hotloop_flow_free` là tùy chọn, và mọi thứ đi qua dưới dạng JSON. Một guest nhận `{"msg": {...}, "config": {...}}` và trả về `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`. Thuộc tính thông điệp không phải JSON thuần, như tay cầm phản hồi mà nút HTTP In gắn vào hay một buffer nhị phân, không được đưa cho guest. Nút giữ nó và đặt lại lên mọi thông điệp mà guest gửi đi, trừ khi chính guest đã đặt thuộc tính đó, nên một plugin có thể nằm giữa HTTP In và HTTP Response. `config` là những gì hộp thoại của nút chứa. `error` làm thông điệp thất bại tới một nút Catch, và những gì đã gửi trước đó vẫn được gửi.

Mô-đun có thể import WASI và, nếu nó đã khai báo capability ngữ cảnh, hai hàm ngữ cảnh bên dưới. Mọi thứ khác nó import đều bị từ chối khi plugin được nạp, và lời từ chối nêu tên import đó.

### Bộ mô tả

`plugin.json` được đọc nghiêm ngặt. Trường mà Flow không biết là một lý do từ chối, nên `"capabilites"` viết sai chính tả sẽ bị bắt thay vì trở thành một plugin lặng lẽ không yêu cầu gì.

| Trường | <span class="sr-only">Chi tiết</span> |
|---|---|
| `format` | `1`. Bắt buộc. |
| `name` | Chữ thường, chữ số và dấu gạch ngang, tối đa 40, bắt đầu bằng chữ cái. Phải khớp với tên thư mục, vì đó là cái `plugins.grants` và tệp luồng dùng. |
| `version` | Bắt buộc. Hiển thị trong phần trợ giúp của nút và trong `GET /plugins`. |
| `label`, `description`, `help` | Nhãn trên bảng nút, một dòng, và Markdown cho thanh bên thông tin. |
| `inputs`, `outputs` | Đầu vào phải là 1. Đầu ra từ 0 đến 16, mặc định 1. |
| `props` | Hộp thoại. Cùng các khai báo thuộc tính mà các nút tích hợp dùng, với các loại `string`, `text`, `number`, `bool`, `select`, `json` và `list`. Thông tin xác thực, tham chiếu tới nút cấu hình và các loại trình soạn mã bị từ chối: plugin không có việc gì với chúng. |
| `capabilities` | Quyền truy cập máy chủ mà nó yêu cầu. |
| `limits` | `memoryMiB` và `timeoutMs` mà nó muốn theo mặc định. |

Trình chỉnh sửa vẽ hộp thoại từ `props` mà không có mã nào của plugin trong trình duyệt. Mỗi nút plugin còn có thêm trường tên, giới hạn bộ nhớ và thời gian chờ. Ba tên đó được dành riêng.

## Giới hạn, và một cái bẫy trông thế nào

Mỗi nút plugin có trần bộ nhớ riêng và thời gian chờ riêng. Bộ mô tả của plugin đặt giá trị mặc định (16 MiB và một giây khi nó không nói gì), nút có thể đổi chúng trong hộp thoại, còn `plugins.maxMemoryMiB` (64) và `plugins.maxTimeout` (5s) là mức hộp cho phép tối đa. Một nút yêu cầu nhiều hơn mức hộp cho phép sẽ làm việc triển khai thất bại và nói cần nâng cài đặt nào.

Một guest tăng vượt trần sẽ rơi vào bẫy. Một guest vẫn đang chạy khi hết thời gian chờ sẽ bị dừng. Dù trường hợp nào, thông điệp đi tới nút Catch gần nhất, thực thể bị bỏ để thông điệp tiếp theo bắt đầu sạch, và không nút nào khác bị ảnh hưởng. Điều nút Catch thấy trong `msg.error.message`:

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

Trần được giữ trước: một nút có trần 64 MiB tính 64 MiB của heap Go chừng nào thực thể của nó còn tồn tại, dù guest có chạm vào hay không, vì việc tăng buffer bằng cách sao chép sẽ khiến máy chủ tạm thời giữ nhiều lần trần. Bài kiểm thử chứng minh điều đó đo xem một lần gọi đã cấp phát tổng cộng bao nhiêu (256 MiB cho trần 256 MiB) và heap có trở lại điểm xuất phát sau cái bẫy hay không. Vì vậy hãy đặt trần ở mức một plugin cần, không phải con số lớn nhất bạn gõ được.

## Capability

Không có capability thì không có quyền truy cập. Mỗi cái chỉ được nối vào khi bộ mô tả yêu cầu và `plugins.grants` cấp cho plugin đó theo tên.

| Capability | Nó cho gì | Khi không có |
|---|---|---|
| `clock` | Đồng hồ thật, treo tường và đơn điệu. | Guest thấy một đồng hồ thay thế bắt đầu từ 2022-01-01 và không liên quan gì tới đồng hồ của nhà máy. |
| `random` | Các byte ngẫu nhiên của hệ điều hành. | Cùng một chuỗi cố định mỗi lần. |
| `context.flow` | Đọc và ghi ngữ cảnh luồng của chính luồng chứa nút. | Các hàm ngữ cảnh không tồn tại đối với nó. |
| `context.global` | Đọc và ghi ngữ cảnh toàn cục. | Như trên. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Yêu cầu thứ chưa được cấp không thất bại vào lúc xử lý thông điệp. Nó làm việc triển khai thất bại: luồng bị từ chối với mã 422 trước khi ghi bất cứ thứ gì, các luồng đang chạy không hề hay biết, và thông điệp nêu tên nút và dòng cần thêm:

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

Quay lui là một lần triển khai, nên quay lui về các luồng dùng một plugin mà quyền cấp đã bị thu hồi từ đó cũng bị từ chối theo cách tương tự. Một plugin đã cài nhưng chưa được cấp quyền vẫn hiện trong bảng nút, với các capability của nó trong phần trợ giúp.

### Các hàm ngữ cảnh

Một guest khai báo capability ngữ cảnh có thể import các hàm này từ mô-đun `hotloop_flow`. Giá trị đi qua dưới dạng JSON.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

Phạm vi là `0` cho luồng và `1` cho toàn cục. `context_get` trả về độ dài của JSON và chỉ ghi nó nếu vừa trong `outCap`, nên guest nhận lại nhiều hơn mức đã đưa sẽ thử lại với buffer lớn hơn. Khóa không tồn tại là `-1`, và `-2` nghĩa là bị từ chối: phạm vi chưa được cấp, khóa hoặc JSON sai, hoặc kho lưu trữ nói không. Guest không thể đọc một phạm vi chưa được cấp bằng cách thử.

## Ký, và tin tưởng một nhà phát hành

Plugin được ký bằng khóa ed25519. Chữ ký bao phủ cả hai tệp, không chỉ mô-đun, vì bộ mô tả là nơi plugin yêu cầu quyền truy cập. Nếu chỉ ký mô-đun, bất kỳ ai có quyền ghi vào thư mục đều có thể thêm một capability vào plugin đã ký. Thông điệp được ký là:

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

Không có gì được tra cứu khi nạp plugin: không mạng, không nhật ký minh bạch, không chuỗi chứng chỉ. Việc kiểm tra là chữ ký, khóa mà nó nêu và danh sách khóa của bạn. Đó là lựa chọn có chủ đích cho một hộp trên mạng nhà máy có thể không có đường ra. Nó cũng có nghĩa là không có dịch vụ thu hồi, nên thu hồi một khóa là gỡ nó khỏi `plugins.trustedKeys` rồi khởi động lại.

### Với tư cách nhà phát hành

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` ghi một khóa riêng PKCS #8 và một khóa công khai PKIX dưới dạng PEM, cùng loại tệp mà `openssl genpkey -algorithm ed25519` và `openssl pkey -pubout` tạo ra, và từ chối ghi đè cả hai. Nó in id khóa và dạng một dòng của khóa công khai. Hãy giữ khóa riêng ngoài git. Không khóa nào được commit.

### Với tư cách người vận hành

Trên Helm chart, đó là `plugins.trustedKeys`, `plugins.grants` và `plugins.volume`, trong [Triển khai Flow](/vi/flow/deploying/).

Bạn tin một nhà phát hành bằng cách đặt khóa công khai của họ vào `plugins.trustedKeys`, hoặc vào `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, ngăn cách bằng dấu phẩy. Mỗi mục là dòng `ed25519:<base64>`, một khóa công khai PEM hoặc đường dẫn của tệp chứa một khóa, đó là cách một Secret hay ConfigMap được gắn vào đi vào:

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Không có khóa tin cậy thì mọi plugin đều bị từ chối. Khóa không phân tích được là lỗi khi khởi động. Sự tin cậy tính theo khóa chứ không theo plugin, nên tin một nhà phát hành là tin mọi thứ họ ký. Việc plugin sau đó được dùng gì là một quyết định riêng, đưa ra trong `plugins.grants` theo tên.

## Khi nó từ chối

Một plugin không nạp được sẽ được ghi nhật ký khi khởi động, liệt kê kèm lý do trong `GET /plugins`, vắng mặt khỏi bảng nút và được nêu tên trong lời từ chối khi một luồng dùng nó được triển khai. Một plugin xấu không bao giờ ngăn phần còn lại của Flow khởi động. `hotloop-flow plugin verify` chạy cùng các phép kiểm tra, nên nhà phát hành thấy được điều mà người vận hành sẽ thấy.

| Cái gì sai | Nó nói gì |
|---|---|
| Không có `plugin.sig` | `unsigned: plugin.sig is missing` |
| Mô-đun hoặc bộ mô tả bị sửa sau khi ký | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Được ký bằng khóa bạn không tin | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Hoàn toàn không có khóa nào được cấu hình | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| Tệp chữ ký bị hỏng | `signature file is malformed: ...` |
| Bộ mô tả có trường lạ, loại sai hoặc capability sai | `plugin.json is not valid: ...` nêu tên trường |
| Mô-đun import thứ mà máy chủ không cung cấp | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| Mô-đun dùng các hàm ngữ cảnh mà không khai báo capability | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| Tên thư mục và `name` khác nhau | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

Chữ ký được kiểm tra trước khi bộ mô tả được phân tích và trước khi mô-đun được biên dịch, nên mã chưa ký không bao giờ được biên dịch.

## Hai ví dụ

* `moving-average` là Rust. Nó lấy trung bình một số đo trên N thông điệp gần nhất và giữ cửa sổ của nó trong bộ nhớ riêng. Nó không yêu cầu gì. `cargo build --locked --release --target wasm32-wasip1`, rồi `plugin.wasm` là `moving_average.wasm` mà nó build ra.
* `stamp` là TinyGo. Nó thêm giờ vào mỗi thông điệp, nên yêu cầu `clock`. Nó được build bằng container riêng của TinyGo, dùng Podman: `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow là một ngôi nhà Go. Máy chủ, việc ký, CLI và mọi bài kiểm thử đều là Go, và ví dụ TinyGo cũng là Go. Ví dụ Rust có mặt vì một định dạng plugin chỉ hoạt động với ngôn ngữ mà máy chủ được viết bằng thì không phải là định dạng plugin, và vì Rust là ngôn ngữ mà một thư viện xử lý tín hiệu nhiều khả năng đã được viết sẵn. Đó là lý do bằng văn bản cho ví dụ duy nhất không phải Go. Các crate nó build cùng là `serde` và `serde_json`, đều có giấy phép dễ dãi, được biên dịch vào mô-đun ví dụ chứ không vào Flow.

## Những gì chưa được chứng minh

* Plugin đã được chạy trên phần cứng thật (2026-11-17).
* Trên Kubernetes, các tệp của plugin đến qua `plugins.volume`, bất kỳ nguồn volume nào. ConfigMap chỉ chứa được một plugin tới giới hạn 1 MiB của nó, nên một plugin cỡ ví dụ TinyGo cần một claim.
* Không có capability mạng. Plugin không thể gửi yêu cầu, và đó là chủ ý cho đến khi ai đó có lý do kèm theo danh sách máy chủ được phép.
* Các bài kiểm thử Flow chạy plugin thật, trong cùng tiến trình con với mọi nút khác. Các capability của plugin giống như những gì việc triển khai sẽ cấp cho nó.
* `hotloop-flow test` chạy bằng tay từ shell không nạp plugin. Cổng triển khai và các lần chạy kiểm thử của trình chỉnh sửa thì có.
