---
title: "Ghi chú phát hành: HotLoop Flow 2.3.0"
description: "HotLoop Flow 2.3.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 là bản phát hành mà Flow vươn tới phần còn lại của nhà máy theo ba cách mới và bắt một thông điệp sai hình dạng trước khi nó gây hại. Nó nói chuyện với HotLoop, một agent có thể gọi một luồng như một công cụ qua MCP, và một plugin là một tệp WebAssembly có chữ ký chứ không phải gói npm. JSON Schema giờ kiểm tra thông điệp trên nút `json`, trên các cổng của một nút và trên các dây trong trình soạn thảo. Có một thay đổi có thể ảnh hưởng đến một luồng đang chạy, và nó là điều đầu tiên dưới Có gì thay đổi.

## Có gì mới

**Nút HotLoop**
- Một kết nối `hotloop-flow-hotloop`, gồm một URL và một tài khoản. Nó đăng nhập bằng `POST /api/auth/login`, gửi bearer token mà HotLoop trả về và đăng nhập lại khi HotLoop báo phiên đã mất. Một tài khoản vận hành là đủ cho mọi thứ bên dưới.
- `hotloop in` theo dõi luồng trực tiếp của HotLoop và gửi một thông điệp cho mỗi thực thể đổi trạng thái: `msg.topic` là id của thực thể, `msg.payload` là trạng thái mới, và `msg.hotloop` mang trạng thái trước đó, thuộc tính, chất lượng và các mốc thời gian của nó. Nếu liên kết rớt, huy hiệu chuyển đỏ và một lỗi duy nhất đến nút Catch cho đợt gián đoạn, không phải một lỗi cho mỗi lần thử lại. Khi liên kết trở lại, thực thể đã đổi trong lúc đó được gửi đi còn thực thể không đổi thì không.
- `hotloop state` đọc một thực thể khi có thông điệp đến. `hotloop script` chạy một script HotLoop với các trường bạn đưa. `hotloop recipe` áp dụng một công thức cùng tham số của nó, và một phiên bản cũ hơn nếu bạn cố ý yêu cầu. HotLoop kiểm tra mọi trường và tham số, cho mọi lần ghi đi qua cổng ghi của nó và giữ bản ghi. Flow gửi lý do `flow:<node id>`, và HotLoop ghi nó vào nhật ký kiểm toán ghi và sổ nhật ký của mình.
- Một lời gọi bị từ chối hoặc thất bại đến nút Catch cùng lời lẽ của chính HotLoop và trạng thái của nó. Không gì đã ghi bị hoàn tác, vì đó cũng là quy tắc của HotLoop.

**Ghi qua cổng của HotLoop**
- `modbus write`, `opcua write`, `s7 write` và `ethernetip write` có hai trường mới, **Ghi qua HotLoop** và **Tag HotLoop** (`device/tag`). Khi đã chọn một HotLoop, giá trị đi tới cổng ghi của HotLoop, nơi quyết định theo thứ tự: ghi đã bật, tag đã được vũ trang, giá trị trong phạm vi.
- Một lần ghi mà cổng từ chối sẽ không bao giờ đến thiết bị. Một HotLoop không thể kết nối cũng làm lần ghi thất bại. Nó không bao giờ quay sang ghi trực tiếp, vì đó sẽ là một lần ghi mà cổng chưa từng thấy.
- Địa chỉ, kiểu dữ liệu và thang đo riêng của HotLoop cho tag được áp dụng, nên địa chỉ và kiểu dữ liệu trên nút Flow không được dùng. Bỏ HotLoop đi sẽ đưa nút về đúng như cũ. Cổng nhận một bool, một số hoặc một văn bản cho mỗi lần ghi, nên một danh sách thanh ghi bị từ chối kèm thông báo nói rõ như vậy.

**MCP, hai chiều**
- `mcp tool` và `mcp result` phục vụ một luồng như một công cụ. Nút công cụ khai báo một tên, một mô tả và một schema đầu vào, Flow phục vụ nó tại `/mcp`, và nút kết quả gửi trả câu trả lời của luồng. Một agent đăng nhập bằng phiên hoặc token API như bất kỳ ai, lời gọi chạy với quyền của token đó, và mọi lời gọi cùng lần từ chối đều vào nhật ký kiểm toán dưới tên người gọi. Không token, không lời gọi.
- `mcp client`, trên một kết nối `hotloop-flow-mcp-server`, gọi một công cụ trên bất kỳ máy chủ MCP nào, kể cả của chính HotLoop, và dùng kết quả trả về. Nó không bao giờ gửi một lời gọi hai lần, vì một công cụ có thể điều khiển thiết bị và một kết nối bị rớt không cho biết lời gọi đã chạy hay chưa.
- Một token API trong `auth.tokens` có thể mang một `rateLimit` với `calls` và một khung thời gian, một phút nếu bạn bỏ qua. Một lời gọi vượt giới hạn không bao giờ đến luồng, trả về dưới dạng lỗi công cụ cho biết khi nào thử lại, và ghi một dòng `mcp.refused` kèm lý do. Một token không có `rateLimit` không bao giờ bị hạn chế.
- Nó nói theo bản sửa đổi hiện tại của đặc tả, 2026-07-28, và các bản sửa đổi bắt tay trở lại tới 2025-11-25, trên cùng một endpoint. Một luồng không dùng nút nào trong số này không bao giờ thực hiện lời gọi MCP, và Flow không phục vụ công cụ nào mà nó không được giao.

**Plugin không cần npm**
- Một plugin là một module WebAssembly, một bộ mô tả để trình soạn thảo vẽ hộp thoại của nó, và một chữ ký ed25519 trên cả hai. Plugin không có chữ ký hoặc bị can thiệp sẽ từ chối tải và nói rõ lý do. `hotloop-flow plugin keygen` tạo một khóa, và `docs/plugins.md` có phần còn lại.
- Một guest vượt quá giới hạn bộ nhớ hoặc thời gian chờ sẽ rơi vào bẫy dẫn tới một nút Catch trong khi mọi thứ khác vẫn chạy. Một plugin yêu cầu quyền truy cập host mà người vận hành chưa cấp (`clock`, `random`, `context.flow`, `context.global`) làm thất bại việc triển khai của bất kỳ luồng nào dùng nó, trước khi một byte nào được ghi.
- Không có khóa tin cậy thì mọi plugin đều bị từ chối, và không có quyền được cấp thì mọi plugin yêu cầu truy cập host đều thất bại. Mặc định không có gì được tải.
- Chart nhận tất cả dưới `plugins`, với một volume chấp nhận mọi nguồn volume của Kubernetes. Tắt thì không render gì, và một `helm template` của các giá trị mặc định vẫn như cũ.

**Dây có kiểu**
- Đưa cho nút `json` một JSON Schema trong cài đặt và mọi giá trị nó xử lý đều được kiểm tra theo đó. Một giá trị không khớp đi tới một nút Catch thay vì chạy tiếp trên dây, và lỗi nêu tên mọi trường sai, như `payload.temp: got string, want number`. Không có schema trong cài đặt thì nút kiểm tra theo `msg.schema`, như nút `json` của Node-RED. Đó là draft 2020-12 trừ khi schema nêu một draft khác, và một `$ref` tới URL hoặc tệp khác bị từ chối, không được tải về.
- Một nút có thể khai báo những gì nó chấp nhận và những gì mỗi đầu ra cam kết, trong hai khóa của tệp luồng mà mọi công cụ khác bỏ qua, nên một luồng mang chúng vẫn đi về từng byte. Khi cả hai đầu của một dây khai báo schema và không thông điệp nào có thể thỏa mãn cả hai, lần triển khai bị từ chối trước khi một byte nào được ghi. Những chỗ không khớp mà Flow không thể thấy trước dừng ở nơi chúng phá schema, đi tới Catch cùng đường dẫn của từng trường sai, và được đếm trong `hotloop_flow_node_schema_mismatches_total`.
- Một `inject` đặt một giá trị cố định mà nút kế tiếp không bao giờ nhận được, như số 250 vào một nút nhận từ 0 đến 100, bị từ chối khi triển khai theo cách tương tự. Mốc thời gian, `env`, ngữ cảnh và JSONata được bỏ qua, không bao giờ đoán.
- Trình soạn thảo ghi kiểu của bên gửi lên mỗi dây. Nó mờ khi chỉ một đầu có kiểu và đỏ khi hai đầu không bao giờ khớp được, và màu đỏ đến từ chính phép kiểm tra của runtime, nên canvas và lần triển khai không thể bất đồng. Mục **Kiểu** trong hộp thoại của một nút là nơi bạn đặt chúng.

Đó là thêm chín loại nút, tổng cộng 79: năm cho HotLoop cùng kết nối của nó, và bốn cho MCP cùng kết nối của nó.

## Có gì thay đổi

- Nút `json` từng bỏ qua `msg.schema`. Giờ một thông điệp mang `msg.schema` được kiểm tra theo nó và, nếu không khớp, đi tới một nút Catch thay vì chạy tiếp trên dây. Một luồng vì lý do nào đó vẫn để `msg.schema` trên thông điệp của nó sẽ thấy điều này.
- Một lần triển khai giờ có thể bị từ chối vì sai kiểu (`deploy.refused`, lý do `typed wires`), nhưng chỉ với luồng khai báo schema trên các cổng của nó hoặc đặt một giá trị cố định của `inject` vào một nút có khai báo. Một luồng không có schema ở đâu cả hoạt động y như trước.
- Các nút ghi mang hai trường mới, mặc định để trống. Khi chưa chọn HotLoop, một nút ghi hoạt động như trong 2.2.0.
- Bộ kiểm tra schema là `santhosh-tekuri/jsonschema` v6 (giấy phép cho phép rộng rãi) và MCP là Go SDK, `modelcontextprotocol/go-sdk` v1.8.0. Cả hai là module Go mới, nên văn bản giấy phép mà image mang trong `/usr/share/doc/hotloop-flow/` có thêm mục. Runtime WebAssembly đã có trong 2.2.0.
- Ba bản sửa cho hàng đợi bền. Một dây bền đã bị gỡ giờ từ chối một lần ghi muộn và đếm nó là bị bỏ, và việc gỡ một dây không còn chờ hết thời gian chờ đóng đối với một đích đang kẹt trong một thông điệp. Trước đây, một thông điệp được trả lại sau khi dây đã mất vẫn bị tính vào hạn mức cho đến khi khởi động lại. Một dây bỏ cái cũ nhất không còn đẩy ra một thông điệp đã được xác nhận hoặc vừa được bơm đọc, điều từng trả cùng một khoảng trống hai lần và làm độ sâu hàng đợi cùng hạn mức thấp hơn những gì có trên đĩa. Đoạn văn về hạn mức bền trong `docs/durable/README.md` giờ nói rằng một thông điệp bị chuyển hướng có thể khiến hạn mức vượt vài thông điệp trong chốc lát.
- README và `docs/bench/` mang kết quả của Raspberry Pi 5, và lộ trình đánh dấu xong Pi 5 và để mở Pi 4, Zero 2 W và việc ghi vào thẻ SD.

## Ghi chú nâng cấp

Từ 2.2.0, chỉ cần đổi image (`helm upgrade`, hoặc tag mới trong unit Quadlet của bạn). Không cần di chuyển dữ liệu, không cần cờ nào, không có gì mới ở lần khởi động đầu tiên. Một `flows.json` và một tệp cấu hình từng chạy trên 2.2.0 vẫn chạy trên 2.3.0, và vòng đi về từng byte của tệp luồng vẫn nguyên vẹn.

- Quay lại 2.2.0 là an toàn với mọi luồng không dùng các nút hoặc khóa mới. Một nút HotLoop, MCP hoặc plugin không khởi động được trên 2.2.0 (loại nút không xác định), và một nút ghi đã chọn HotLoop sẽ ghi thẳng vào thiết bị của nó ở đó, vì 2.2.0 không đọc trường này. Hãy gỡ HotLoop khỏi những nút ghi đó trước khi quay lại.
- HotLoop ghi lại tài khoản mà Flow đăng nhập. API không cho máy khách cách nào để nêu tên tác nhân của chính nó, nên id của nút Flow được đưa vào làm lý do và tài khoản là tài khoản trên kết nối. Hãy dùng một tài khoản tạo riêng cho Flow nếu bạn muốn dễ tìm các lần ghi của nó.
- MCP là một cách mới để vào Flow, và nó cần token. Không có gì được phục vụ cho đến khi một luồng có nút `mcp tool`, và một lời gọi không có token hoặc dùng token bịa ra sẽ bị từ chối.

## Cài đặt mới

| YAML | Biến môi trường | Mặc định |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | trống, nghĩa là `plugins` trong `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | không có. Mỗi mục là `ed25519:<base64>`, một khóa công khai PEM, hoặc một tệp chứa một khóa. Không có mục nào thì mọi plugin đều bị từ chối. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | không có. Tên một plugin ánh xạ tới `clock`, `random`, `context.flow`, `context.global`. Biến có dạng `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, từ 1 đến 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 lời gọi, nghĩa là không giới hạn. `per` là `1m` khi bạn đặt `calls` mà không đặt `per`. |

Các kết nối HotLoop và MCP được đặt trong trình soạn thảo: URL, tài khoản và thời gian chờ. Chart có mọi cài đặt plugin dưới `plugins` trong `values.yaml`, với `enabled: false`, và không có gì mới khác.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại: https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
