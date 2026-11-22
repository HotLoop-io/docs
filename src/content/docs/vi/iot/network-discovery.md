---
title: "Phát hiện mạng"
description: "HotLoop lắng nghe bằng mDNS, SSDP và DHCP rồi hiển thị những gì có trên mạng nhà máy, và không gửi gì trừ khi bạn chỉ định một mạng để thăm dò."
---

HotLoop lắng nghe mạng nhà máy và cho bạn biết có gì trên đó: nút ESPHome ngoài sân, Shelly trên máy nén, máy chủ OPC UA ở dây chuyền 3, hộp UPnP mà ai đó đã cắm rồi quên, thứ vừa xin một địa chỉ. Mỗi thứ hiện trong Devices, Discovered, bên dưới các thiết bị đã tự thông báo qua MQTT ([phát hiện qua MQTT](/vi/iot/mqtt-discovery/)), kèm nó là gì và HotLoop có thể giao tiếp với nó như thế nào.

Sau đó một người quyết định. Không có gì nghe được trên mạng tự được thêm vào, và không có gì từng được kích hoạt.

## Lắng nghe, không quét

Trên mạng OT mà bạn đọc, người ta không quét. Việc quét cổng đã làm sập hơn một PLC trả lời một gói tin mà nó chưa từng chờ đợi, và "chỉ là phát hiện thôi mà" chẳng an ủi được ai lúc ba giờ sáng. Vì vậy theo mặc định HotLoop không gửi gì cả:

- **mDNS** (bật): các thiết bị thông báo dịch vụ của chúng khi khởi động, và mọi câu trả lời cho câu hỏi của bất kỳ ai đều được multicast tới cả đoạn mạng. Một điện thoại mở ứng dụng hay một laptop tìm máy in sẽ hỏi; HotLoop nghe lỏm.
- **SSDP** (bật): các thiết bị UPnP multicast `NOTIFY ssdp:alive` khi tham gia và cứ vài phút một lần sau đó. HotLoop cũng nghe lỏm những cái này.
- **DHCP** (tắt, xem bên dưới): thiết bị tham gia mạng sẽ broadcast một yêu cầu xin địa chỉ kèm MAC của nó và thường là cả tên.

Việc hỏi là **thăm dò**, và nó được bật theo từng mạng, bởi bản triển khai, không bao giờ bằng một nút bấm:

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | lắng nghe mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | lắng nghe SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | lắng nghe các yêu cầu DHCP trên UDP 67 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | trống | các mạng được bật thăm dò, dưới dạng CIDR: `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | tần suất chạy thăm dò ở đó |

Trên một mạng đã liệt kê, một lần thăm dò gửi câu hỏi mDNS cho mọi loại dịch vụ và cho những loại HotLoop biết, hỏi lại về từng loại đã xuất hiện, gửi một `M-SEARCH` SSDP và đọc mô tả của từng thiết bị UPnP (tên, nhà sản xuất và model) từ chính thiết bị. Trên mọi mạng khác nó không gửi gì, và nút Probe now bị từ chối ở nơi không liệt kê mạng nào. Hãy liệt kê những mạng bạn muốn nói tới: một /8 là 16 triệu địa chỉ, và HotLoop sẽ hỏi trên đó nếu bạn bảo nó làm vậy.

## Nó biết giao tiếp với những gì

| Nghe thấy | Đó là | Khi chấp nhận |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | một máy chủ OPC UA (OPC 10000-12 Phụ lục C: endpoint là địa chỉ và cổng của SRV cộng với `path` của TXT) | tạo một thiết bị OPC UA tại endpoint đó, ban đầu ẩn danh và không bảo mật, không có tag. Duyệt nó bằng Discover tags và đặt bảo mật trước khi nó mang bất cứ thứ gì quan trọng |
| mDNS `_shelly._tcp`, hoặc `_http._tcp` có `gen` | một Shelly, Gen2 trở lên (các `gen`, `app` và `ver` trong TXT của nó) | tạo một thiết bị HTTP đọc `http://<it>/rpc/Shelly.GetStatus`, lệnh gọi trạng thái riêng của Shelly, chỉ đọc, không có tag. Discover tags liệt kê mọi giá trị. Shelly bật đăng nhập cần xác thực digest, thứ mà trình điều khiển HTTP không làm |
| mDNS `_esphomelib._tcp` | một nút ESPHome (TXT của nó: `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | ghi nhận là đã biết và không tạo gì. HotLoop đọc ESPHome qua MQTT: hãy cho nút một khối `mqtt:` trỏ tới broker của HotLoop thì nó tự thông báo, và thẻ sẽ nói điều đó (khớp theo MAC) |
| mDNS `_mqtt._tcp` | một broker MQTT | ghi nhận. Thêm nó trong Settings, MQTT để nghe những gì được thông báo trên đó |
| mDNS `_http._tcp`, mọi thứ khác | một trang web, hoặc một dịch vụ mà HotLoop không có từ để gọi | ghi nhận |
| SSDP | một thiết bị UPnP, theo uuid của nó: các loại thiết bị, `SERVER` và, khi bật thăm dò, mô tả của nó | ghi nhận |
| DHCP | một thiết bị xin địa chỉ: MAC, tên máy, lớp nhà cung cấp | ghi nhận |

"Ghi nhận" vẫn đáng một cú nhấp. Trên mạng nhà máy, mọi hộp đều nên là thứ ai đó biết, và một phát hiện được chấp nhận là một quyết định có tên và thời điểm. Thứ lạ tiếp theo sẽ nổi bật.

Một thẻ cho biết khi nào hai phát hiện là cùng một hộp: MAC mDNS của một nút ESPHome và thông báo MQTT của nó, một yêu cầu DHCP và một host mDNS ở cùng địa chỉ.

Chấp nhận không kích hoạt gì. Thiết bị tạo ra khi chấp nhận không có tag cho đến khi ai đó chọn chúng, và mọi điểm trên đó đều chỉ đọc cho đến khi ai đó kích hoạt trong trình soạn tag, qua cùng cổng ghi như mọi thứ khác. Địa chỉ trong đề xuất đến từ chính thông báo của thiết bị, và hộp thoại chấp nhận hiển thị nó để bạn kiểm tra đó có đúng là hộp bạn nghĩ không.

**Ignore** ẩn một phát hiện và giữ nó ẩn khi nó được nghe lại. **Un-ignore** đưa nó trở lại.

## Tất cả đều không đáng tin

Bất kỳ ai đặt được một gói tin lên đoạn mạng đều có thể tự xưng là bất cứ thứ gì. Vì vậy:

- mọi chuỗi đều bị cắt và loại bỏ ký tự điều khiển, và màn hình đặt nó lên trang dưới dạng văn bản, không bao giờ là HTML;
- mô tả UPnP chỉ được đọc từ địa chỉ mà thông báo đến từ đó, chỉ trên mạng thăm dò, không bao giờ qua chuyển hướng, và không bao giờ quá 64 KiB. Một `NOTIFY` giả mạo trỏ `LOCATION` tới trang web của một PLC, hay tới chính HotLoop, sẽ không lấy được gì;
- mỗi listener nhận 500 datagram mỗi giây và bỏ đi, đồng thời đếm phần còn lại;
- bản ghi chứa 1.024 phát hiện. Những phát hiện mới vượt mức đó bị bỏ và được đếm cho đến khi ai đó xử lý bớt, và màn hình nói rõ điều này;
- một câu hỏi trên đường truyền là câu hỏi của ai đó, không phải thông báo: những câu trả lời đã biết mà nó mang theo là niềm tin của người hỏi, và không làm gì với chúng.

## HotLoop phải ở đâu để nghe được gì

Multicast và broadcast không đi qua router, NAT hay mạng container. HotLoop nghe đoạn mạng nó đang ở, và không gì khác:

- **Một hộp trên mạng nhà máy** (tệp nhị phân, hoặc Podman với `--network host`): nghe được tất cả.
- **Kubernetes với mạng pod**: không nghe được gì từ nhà máy. Màn hình Discovered hiển thị các giao diện nó đang lắng nghe, đó là cách để biết. Cho pod `hostNetwork: true`, hoặc một giao diện thứ hai trên đoạn mạng nhà máy (Multus với macvlan), và nó sẽ nghe được nhà máy. Chart không làm cả hai điều đó cho bạn: đặt một pod lên mạng của host là một quyết định về node, không phải mặc định.

mDNS (5353) và SSDP (1900) là các cổng thông thường trên 1024, nên không cần đặc quyền. HotLoop dùng chung chúng với bất cứ thứ gì đã giữ chúng, kể cả avahi-daemon trên host.

## DHCP

Thành thật mà nói là khả thi, nhưng cần hai thứ mà container không có theo mặc định, đó là lý do nó tắt:

1. **Các broadcast của nhà máy.** Yêu cầu DHCP đi tới 255.255.255.255, nên HotLoop phải ở trên đoạn mạng: mạng của host hoặc một giao diện trên đó, như trên.
2. **Cổng UDP 67**, nhỏ hơn 1024. Image của HotLoop chạy với uid 65532. Hoặc cấp cho tệp nhị phân `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), hoặc đặt `net.ipv4.ip_unprivileged_port_start` của host thành 67 hoặc thấp hơn. Trong Kubernetes, thêm `NET_BIND_SERVICE` vào capabilities của một container không phải root tự nó không có hiệu lực; file capability hoặc sysctl mới làm được.

Nó không bao giờ cần raw socket hay container có đặc quyền: một UDP socket thông thường trên cổng 67 nhận các broadcast. Nó không bao giờ trả lời, không bao giờ đề nghị địa chỉ, không bao giờ gửi một byte. Nó dùng chung cổng, nên một máy chủ DHCP trên cùng host cũng dùng chung sẽ tiếp tục hoạt động; một máy chủ giữ cổng cho riêng mình sẽ làm listener của HotLoop thất bại, và màn hình nói vì sao, mà không đụng tới máy chủ.

Những gì nó không thấy được: các lần gia hạn, vốn đi unicast tới máy chủ. HotLoop nghe một thiết bị khi nó tham gia, không phải mỗi giờ sau đó.

## Nhiều replica

Chỉ replica giữ khóa phát hiện mạng mới lắng nghe và thăm dò; các replica khác thử lại mỗi 30 giây, nên một cái sẽ tiếp quản nếu bên giữ khóa biến mất. Hai bên cùng thăm dò sẽ hỏi mỗi thiết bị hai lần.

## Sao lưu

`net_finds` nằm trong mọi bản sao lưu: những gì đã nghe được, và ai đã chấp nhận hay bỏ qua cái gì. Các quyết định là phần mà mạng không bao giờ nói lại.

## Cách kiểm thử

Phát hiện đã được chạy trên mạng thật với các thiết bị thông báo thật, nút ESPHome, Shelly và OPC UA, một máy chủ đa phương tiện UPnP và các client DHCP, và trên phần cứng thật vào 2026-11-17.
