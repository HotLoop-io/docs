---
title: "Sản phẩm HotLoop: tám trên năm dòng"
description: "Tám sản phẩm trên năm dòng phát hành: mỗi sản phẩm lõi có gì, chạy cơ sở dữ liệu nào, cài đặt ra sao và nâng một địa điểm lên sản phẩm lớn hơn như thế nào."
---

HotLoop gồm tám sản phẩm cho nhà máy: bốn sản phẩm lớn lên cùng một địa điểm (IoT, Edge, Gateway và Edge Relay), cùng Flow để nối logic, Cascade cho quy trình công việc, HotLoop for CODESYS cho màn hình riêng của PLC và Transmitter để đưa giá trị của PLC lên mạng.

Chúng được phát hành trên năm dòng phiên bản. **HotLoop core** gồm IoT, Edge, Gateway và Edge Relay: bốn sản phẩm, một mã nguồn, một thẻ. Mỗi bản phát hành core đưa cả bốn ra cùng lúc, cùng số phiên bản, mỗi sản phẩm có image, chart Helm và các đơn vị Podman Quadlet riêng. Hãy chọn sản phẩm hợp với thiết bị. Mọi sản phẩm đều nói được mọi giao thức HotLoop có, nên bạn không bao giờ phải lên sản phẩm lớn hơn chỉ để đọc chiếc PLC trên bàn thử. Chức năng mới là thứ phân biệt chúng. Giao thức thì không.

**Flow**, **Cascade**, **HotLoop for CODESYS** và **Transmitter** là các dòng riêng với phiên bản riêng, nên một bản phát hành Flow không bao giờ làm core thay đổi, và ngược lại. Mọi thứ bên dưới bảng đều nói về core. Đây là điểm bắt đầu của từng sản phẩm trong tám sản phẩm:

| Sản phẩm | Dòng phát hành | Tài liệu | Cài đặt | Ghi chú phát hành | Lộ trình |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/vi/iot/overview/">Tài liệu</a> | <a href="/vi/iot/install/">Cài đặt</a> | <a href="/vi/releases/#hotloop-core">Ghi chú</a> | <a href="/vi/roadmap/">Lộ trình</a> |
| **HotLoop Edge** | HotLoop core | <a href="/vi/edge/overview/">Tài liệu</a> | <a href="/vi/edge/install/">Cài đặt</a> | <a href="/vi/releases/#hotloop-core">Ghi chú</a> | <a href="/vi/roadmap/">Lộ trình</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/vi/gateway/overview/">Tài liệu</a> | <a href="/vi/gateway/install/">Cài đặt</a> | <a href="/vi/releases/#hotloop-core">Ghi chú</a> | <a href="/vi/roadmap/">Lộ trình</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/vi/edge-relay/overview/">Tài liệu</a> | <a href="/vi/edge-relay/install/">Cài đặt</a> | <a href="/vi/releases/#hotloop-core">Ghi chú</a> | <a href="/vi/roadmap/">Lộ trình</a> |
| **HotLoop Flow** | Flow | <a href="/vi/flow/overview/">Tài liệu</a> | <a href="/vi/flow/install/">Cài đặt</a> | <a href="/vi/releases/#hotloop-flow">Ghi chú</a> | <a href="/vi/flow/roadmap/">Lộ trình</a> |
| **HotLoop Cascade** | Cascade | <a href="/vi/cascade/overview/">Tài liệu</a> | <a href="/vi/cascade/running/">Cài đặt</a> | <a href="/vi/releases/#hotloop-cascade">Ghi chú</a> | <a href="/vi/cascade/roadmap/">Lộ trình</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/vi/codesys/overview/">Tài liệu</a> | <a href="/vi/codesys/install/">Cài đặt</a> | <a href="/vi/releases/codesys-0-3-8/">Ghi chú</a> | <a href="/vi/codesys/roadmap/">Lộ trình</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/vi/transmitter/overview/">Tài liệu</a> | <a href="/vi/transmitter/install/">Cài đặt</a> | <a href="/vi/releases/transmitter-1-1-0/">Ghi chú</a> | <a href="/vi/transmitter/roadmap/">Lộ trình</a> |

Bảng sau so sánh bốn sản phẩm của core.

| <span class="sr-only">Chi tiết</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| Dùng để làm gì | Nền tảng tự động hóa. Một Pi, một NUC, một hộp trong tủ | Một hộp cạnh máy, vẫn chạy khi đường lên trên bị đứt | Bộ não của địa điểm | Thăm dò, chuyển tiếp, trụ vững. Không cơ sở dữ liệu, không giao diện |
| Thực thể, tự động hóa, trợ thủ, script, công thức, bản mẫu, bảng điều khiển, nhật ký, thông báo, MCP, MQTT có khám phá, báo động ISA-18.2, sao lưu và mọi trình điều khiển | có | có | có | chỉ trình điều khiển |
| Máy chủ OPC UA, xuất bản Sparkplug ở rìa có lưu rồi chuyển tiếp | | có | có | chỉ xuất bản |
| Đội thiết bị, nhiều địa điểm, báo cáo theo lịch | | | có | |
| Image | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Đơn vị Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Đơn vị Quadlet trên SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | không có |
| `database.type` trong chart | `postgresql` (mặc định), `sqlite` | `timescaledb` (mặc định), `postgresql`, `sqlite` | `timescaledb` (mặc định), `postgresql`, `sqlite` | không có |
| Kiến trúc | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Cơ sở dữ liệu mà chart và Quadlet chạy | PostgreSQL 17 | TimescaleDB | TimescaleDB | không có |
| Lịch sử giữ mặc định | 30 ngày | 90 ngày | 90 ngày | không có |
| Cơ sở dữ liệu mà tệp nhị phân chạy được | SQLite hoặc Postgres | SQLite, Postgres hoặc TimescaleDB | SQLite, Postgres hoặc TimescaleDB | không có |

Cơ sở dữ liệu là một thiết lập, không phải một image: `HOTLOOP_DB_TYPE=sqlite` và `HOTLOOP_DB_PATH` đưa bất kỳ sản phẩm nào trong ba sản phẩm lên một tệp SQLite, hoàn toàn không cần container cơ sở dữ liệu (DEPLOYMENT.md, "SQLite"). Chart nhận cùng lựa chọn đó dưới dạng `database.type` và các đơn vị Quadlet dưới dạng các thư mục `sqlite/`, và mỗi sản phẩm chỉ cung cấp các cơ sở dữ liệu trong bảng trên: yêu cầu chart IoT dùng `timescaledb` sẽ làm việc cài đặt thất bại. Chuyển từ cơ sở dữ liệu này sang cơ sở dữ liệu khác là một lần sao lưu rồi khôi phục (BACKUP.md).

Gateway giữ nguyên các tên nó đã phát hành cho đến 4.17.0: image `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Ai đang chạy nó không phải đổi gì cả.

## Sản phẩm có gì thì tệp nhị phân có đó

Một sản phẩm là một bản dựng, không phải một thiết lập. `-tags hotloop_iot` dựng IoT, `-tags hotloop_edge` dựng Edge, không có thẻ thì dựng Gateway. Cái gì sản phẩm không có thì không phải bị tắt, mà là không tồn tại: máy chủ OPC UA hoàn toàn không có trong image của IoT, nên không biến môi trường, tệp giá trị hay ngày xui xẻo nào bật được nó.

Vì vậy một sản phẩm nhỏ hơn trả lời thẳng về những gì nó không có, thay vì giả vờ:

- **API** giữ mọi tuyến trong mọi sản phẩm. Tuyến của một chức năng mà sản phẩm này không có sẽ trả `404` và nêu tên sản phẩm có chức năng đó: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` cho biết `product` và `features`, nên một script hỏi thay vì dò dẫm.
- **Một thiết lập chỉ dành cho Gateway** trên IoT hoặc Edge (ví dụ `HOTLOOP_REPORTS_ENABLED=true` mang theo từ một tệp giá trị cũ) sẽ cảnh báo khi khởi động và trên màn hình Cài đặt, và HotLoop vẫn chạy. HotLoop giữ nhà máy chạy dù có một báo cáo nó không tạo được, và cảnh báo bảo đảm có người nhìn thấy.
- **Các chart** hoàn toàn không có thiết lập đó. `charts/hotloop-iot` không có khối `reports`, `opcuaServer` hay `edgePublish`, và `hotloop-edge` không có `reports`. Nếu bạn vẫn đặt, nó không tạo ra gì.
- **`hotloop --product`** in ra `iot`, `edge` hoặc `gateway`. `--version` vẫn chỉ in phiên bản, vì các script phân tích nó.

## Chọn sản phẩm nào

- **Một Pi, ổ cắm thông minh, vài cảm biến, một broker MQTT đầy Tasmota và Zigbee2MQTT, hoặc một PLC trên bàn thử:** IoT. Đây là image nhỏ nhất (khoảng 29 MB trên arm) và image PostgreSQL thường chỉ bằng một phần sáu image TimescaleDB, mà trên thẻ SD thì đó là con số quan trọng.
- **Một hộp bắt vít cạnh một dây chuyền, cấp dữ liệu cho SCADA qua OPC UA hoặc xuất bản lên trên qua Sparkplug và chịu được lúc đường lên trên bị đứt:** Edge.
- **Địa điểm: mọi dây chuyền, báo cáo gửi email theo lịch, các edge relay báo về, nhiều hơn một địa điểm trên một màn hình:** Gateway.
- **Một hộp chỉ cần thăm dò và chuyển tiếp, không có cơ sở dữ liệu phải chăm:** Edge Relay. Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/).

## Kích thước

Image là tệp nhị phân cộng khoảng 3 MB cơ sở.

| <span class="sr-only">Chi tiết</span> | image / tệp nhị phân amd64 | image / tệp nhị phân arm64 | image / tệp nhị phân arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | không dựng |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Đây là kích thước trên ổ đĩa. Khi chưa có thiết bị nào, HotLoop chiếm khoảng 10 MB RSS và PostgreSQL khoảng 12 MB, và đó là mức sàn, không phải con số thực: mức một sản phẩm dùng khi có thiết bị được thăm dò phụ thuộc vào các thiết bị đó.

## Cài đặt

### Helm

Một kho, đủ cả bốn chart:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Hãy đặt tên bản phát hành là `hotloop`, bất kể sản phẩm nào. Tên bản phát hành là tên mà ổ lưu trữ của cơ sở dữ liệu, các Secret và Service được đặt theo, và giữ nguyên nó là điều cho phép một địa điểm sau này nâng lên sản phẩm lớn hơn (xem bên dưới).

Trên EmberNet, mỗi sản phẩm là một thẻ riêng trong App Store: "HotLoop IoT", "HotLoop Edge", "HotLoop Gateway" và "HotLoop Edge Relay". Một lần triển khai từ cửa hàng gắn các nhãn tenant của bảng điều khiển vào mọi thứ chart tạo ra, và Running Apps hiển thị chúng là `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` và `HotLoop-Edge-Relay`.

### Podman Quadlet

Dành cho một thiết bị không nằm trong cụm. Mỗi thư mục sản phẩm dưới `deploy/quadlet/` có năm đơn vị: `hotloop.network`, `hotloop.container` (ứng dụng), `hotloop-db.container` (cơ sở dữ liệu của nó, cùng image và phiên bản mà chart của nó chạy), `hotloop-db.volume` và `hotloop-data.volume`. Các bước cài đặt nằm ở đầu mỗi tệp `hotloop.container`, và [Podman Quadlet](/vi/install/quadlet/) có phần còn lại.

Cần Podman 5.0 trở lên. Raspberry Pi OS Bookworm đi kèm bản 4.3, hoàn toàn không có Quadlet, nên một Pi cần Raspberry Pi OS Trixie trở lên. Ứng dụng theo `:stable` và tính năng tự cập nhật của Podman di chuyển nó, còn cơ sở dữ liệu được ghim cố định: [README của Quadlet](/vi/install/auto-update/) giải thích cách làm và lý do. Cài theo cách nào cũng vậy, hãy đặt cơ sở dữ liệu trên SSD USB chứ không phải thẻ SD. Lịch sử ghi suốt cả ngày, ngày nào cũng vậy, và thẻ SD hỏng chính vì điều đó.

## Nâng một địa điểm lên sản phẩm lớn hơn

Từ IoT lên Edge rồi lên Gateway vẫn giữ nguyên mọi thiết bị, tag, thực thể, tự động hóa, báo động, người dùng và từng giờ lịch sử. Mọi sản phẩm đều chạy mọi bản di chuyển dữ liệu, nên cơ sở dữ liệu có cùng cấu trúc ở cả ba, và sản phẩm lớn hơn khởi động với các chức năng bổ sung còn trống.

- **Quadlet:** tên các đơn vị, các ổ lưu trữ và các secret giống nhau ở mọi thư mục sản phẩm. Chép `hotloop.container` và `hotloop-db.container` của sản phẩm lớn hơn đè lên các tệp của bạn, chạy `systemctl daemon-reload` rồi khởi động lại.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (hoặc `hotloop/hotloop`) trên cùng bản phát hành. Ba chart chọn pod của chúng bằng cùng các nhãn và đặt tên StatefulSet cùng ổ lưu trữ của cơ sở dữ liệu giống nhau, nên việc nâng cấp được cho phép và ổ lưu trữ vẫn được gắn.

Hãy sao lưu trước (`POST /api/backup`, xem [Sao lưu và khôi phục](/vi/iot/backup/)) và chép bản sao ra khỏi thiết bị. Việc chuyển này đã được chạy trên Quadlet, từ IoT lên Edge rồi lên Gateway trên cùng một ổ cơ sở dữ liệu với cùng một thiết bị có mặt ở mỗi bước, với thư mục PostgreSQL của IoT khởi động dưới image TimescaleDB của Gateway, và dưới dạng `helm upgrade` trên một cụm thật. Nơi thư mục thường của IoT không có phần mở rộng TimescaleDB, lịch sử vẫn nằm trong các phân vùng gốc sau lần chuyển đó, và một hypertable cần sao lưu rồi khôi phục vào một TimescaleDB mới. Quay lại sản phẩm nhỏ hơn không phải việc nên làm trên một thiết bị bạn coi trọng.

## Cách chúng được phát hành

Một thẻ `v` phát hành cả bốn, nên IoT, Edge, Gateway và Edge Relay luôn chung một phiên bản. Trước khi dựng bất cứ thứ gì, hệ thống kiểm tra phiên bản và image của mọi chart khớp với thẻ, mọi đơn vị ứng dụng Quadlet theo `:stable` kèm kiểm tra sức khỏe, và mọi đơn vị cơ sở dữ liệu khớp với chart của nó và không bao giờ tự cập nhật. Chart IoT và Edge được tạo từ chart Gateway, nên một bản sửa ở một nơi đến được cả ba.
