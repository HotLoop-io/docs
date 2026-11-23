---
title: "Quản lý đội thiết bị"
description: "Theo dõi mọi Edge Relay qua các lần sinh và chết Sparkplug, rồi gửi rebirth, khởi động lại hay tệp thiết bị mới mà không cần ra tận máy."
---

Quản lý đội thiết bị, từ 4.7.0, cho phép Gateway theo dõi các edge relay đã đăng ký, xem chúng còn sống không và, với người vận hành được cấp quyền, yêu cầu một relay rebirth, khởi động lại hoặc nhận cấu hình vừa đẩy xuống. Mặc định tắt (`HOTLOOP_FLEET_ENABLED`): một hệ thống không có edge relay thì không có broker nào để trỏ tính năng này vào.

## Nó không phải là gì

Quản lý đội thiết bị có kết nối MQTT riêng, tách biệt, và trả lời một câu hỏi khác: một edge relay *đã đăng ký* còn sống không, chứ không phải một tag của nó đang có giá trị gì. Gắn nó vào trình điều khiển thăm dò tag sẽ buộc người vận hành phải cấu hình một Thiết bị tương thích chỉ để thấy đội thiết bị, hoặc phải chọc vào sổ sách riêng theo từng nút của gói đó, thứ chưa bao giờ được làm ra để chia sẻ.

**Không tự động.** Một edge relay xuất hiện trên broker không vì thế mà trở thành thành viên của đội. Tư cách thành viên được khai báo, bằng một dòng trong `fleet_members` tạo qua `POST /api/fleet`, cùng cách phân biệt mà ứng dụng này đã áp dụng giữa tag do trình điều khiển phát hiện và tag do một người cấu hình. Một NBIRTH từ nhóm hoặc nút mà chưa ai đăng ký chỉ được ghi ở mức debug rồi bỏ qua.

## Các phần khớp nhau thế nào

- **Trạng thái hiện diện**, từ NBIRTH và NDEATH. Chỉ chiều đi ra từ phía relay: nó gọi tới broker, như vẫn làm mỗi khi công bố giá trị đọc, nên chạy xuyên NAT mà không cần kết nối đi vào relay.

Lệnh đi theo chiều ngược lại qua Sparkplug NCMD, mở rộng những gì một relay vốn đã xử lý:

- Một cú huých vô hại, lặp lại bao nhiêu lần cũng vậy.
- **Khởi động lại** (`Node Control/Reboot`, tên do chính đặc tả Sparkplug đặt, không phải ứng dụng này tự nghĩ ra): relay công bố NDEATH gọn gàng của chính nó rồi thoát; bộ giám sát của nó (`Restart=always` của một unit Quadlet, hay `restartPolicy: Always` mặc định của Deployment) dựng nó lên lại với những gì đang có trên đĩa lúc đó. Không có đường tắt máy mới: đây đúng là lối thoát sạch mà relay vốn đã đi khi nhận `SIGTERM`.

Vì lệnh đi qua cùng kết nối MQTT mà relay vốn đã mở ra ngoài, nên gửi một lệnh cũng không cần kết nối đi vào relay.

Một relay hiện online thì có thể ra lệnh, không ngoại lệ. Mọi relay đều đăng ký topic NCMD của mình và chờ broker xác nhận trước khi công bố lần sinh, ở mỗi kết nối, nên "Online" không bao giờ chạy trước "có thể tới được". Bộ quản lý giữ cùng quy tắc ở phía mình: nó không báo là đã khởi động cho tới khi các đăng ký NBIRTH và NDEATH được xác nhận, nên một relay sinh ra đúng lúc Gateway vừa lên sẽ không bị bỏ sót. Nếu ACL của broker từ chối đăng ký của bên nào, bên đó từ chối khởi động và nói rõ, thay vì chạy khi bị điếc một nửa.

## Đẩy cấu hình

Đẩy những gì relay thăm dò không đi qua NCMD, vì một metric Sparkplug không đủ lớn cho cả tệp thiết bị: nó đi tới một **topic MQTT thường, retained** cho mỗi relay: `hotloop/edge-relay-config/<group>/<node>`. Giao hàng retained là thứ giúp việc này chạy mà không cần một yêu cầu "cho tôi bắt kịp" riêng: nội dung công bố sau cùng ở đó được giao ngay cho mọi client đăng ký, kể cả relay kết nối lại sau khi ngoại tuyến hoặc khởi động lần đầu tiên.

Relay kiểm tra lại khi nhận: ứng dụng này không thể cho rằng chỉ Gateway mới công bố vào topic đó, mà chỉ rằng chính nó không được công bố thứ hỏng.

**Một tệp thiết bị có thể mang thông tin đăng nhập, và việc đẩy sẽ công bố nó.** Khối `config` của thiết bị chứa những gì trình điều khiển dùng để đăng nhập, như `username` và `password` OPC UA (4.15.0), và tệp được công bố nguyên trạng, retained. Ai đăng ký được `hotloop/edge-relay-config/#` đều đọc được, nên broker cần TLS và ACL cho topic đó trước khi đẩy tệp có thông tin đăng nhập. API của Gateway ẩn thông tin đăng nhập của thiết bị khỏi mọi vai trò từ 4.15.1, nhưng tệp được đẩy không nằm sau API và không bị thay đổi bởi điều đó. Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#thông-tin-xác-thực-trong-tệp-thiết-bị-4150) và [Xác thực và người dùng](/vi/iot/authentication/#nơi-thông-tin-xác-thực-vẫn-ở-dạng-rõ).

**Việc đẩy có hiệu lực ngay và không bao giờ khởi động lại gì.** Đến 4.17, việc đẩy chỉ chuẩn bị sẵn tệp, và muốn nó có hiệu lực phải có thao tác thứ hai, `POST /api/fleet/{id}/restart`, làm đứt phiên broker của relay và mọi phiên thiết bị nó đang giữ chỉ để đổi một tag. Bây giờ:

- **Một relay đang chạy** kiểm tra tệp, lưu lại và áp dụng tại chỗ: thiết bị mới kết nối, thiết bị bị gỡ ngắt kết nối, thiết bị đổi thì kết nối lại, và mọi thiết bị không đổi giữ nguyên phiên. Phiên Sparkplug và hàng đợi chuyển tiếp vẫn hoạt động suốt thời gian đó. Nút rebirth với bộ metric mới và đặt về null những metric đã bỏ trước, để một host không tiếp tục hiện giá trị tốt cuối cùng của thiết bị đã gỡ. [Tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#áp-dụng-trực-tiếp-giữ-lại-gì-và-đổi-gì) nêu chính xác những gì đi ra đường truyền và vì sao.
- **Một tệp bị relay từ chối** (không phân tích được, không hợp lệ, không lưu được) không thay đổi gì trên relay, và `/status` của relay nói điều đó trong `config.rejected`. `GET /api/fleet` hiển thị điều này cho mọi thành viên có `statusUrl`, bên cạnh mã băm của tệp nó đang chạy, nên "tôi đã đẩy" và "nó đang chạy" là hai việc kiểm tra được, không phải một việc ta cứ giả định. Gateway cũng kiểm tra trước khi công bố, nên trên thực tế đây là relay ở bản phát hành mới hơn hoặc cũ hơn bất đồng về các quy tắc, hoặc một thứ khác ngoài Gateway công bố vào topic.
- **Một relay đang ngoại tuyến** nhận bản đẩy retained ngay khi kết nối. Lúc khởi động nó chờ vài giây để có bản đó trước khi nạp tệp cục bộ, nên nó lên với danh sách đã đẩy thay vì khởi động bằng danh sách cũ rồi mới chuyển.

Tệp được đẩy nằm trên ổ dữ liệu của relay, không đè lên tệp thiết bị cục bộ của nó, và được ưu tiên hơn tệp cục bộ cho đến khi lần đẩy bị xóa. [Tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#tệp-được-đẩy-nằm-ở-đâu-và-tệp-nào-thắng) có các quy tắc ưu tiên và lỗi 4.16.0 khiến chúng trở nên cần thiết.

**Rút lại một lần đẩy** là `DELETE /api/fleet/{id}/config` (`fleet.config`, giống như đẩy). Nó công bố một thông điệp retained rỗng vào topic cấu hình của thành viên, đó là cách MQTT xóa một giá trị retained, nên không lần khởi động nào sau đó áp dụng bản đẩy. Một relay đang kết nối lúc đó bỏ tệp đã đẩy và quay về tệp cục bộ ngay, giống cách một lần đẩy được áp dụng, trừ khi tệp cục bộ không nạp được, khi đó nó giữ tệp đã đẩy và nói rõ. Một relay đang ngoại tuyến không bao giờ nghe được lệnh xóa (thông điệp rỗng không được giữ lại), nên hãy gửi lại khi relay đã trở lại.

## Mỗi relay đang chạy gì, và cập nhật

Mỗi relay ghi phiên bản và mã băm image của mình vào mỗi lần sinh, Edge hay Gateway bật công bố edge cũng vậy, nên một hộp đăng ký ở đây làm thành viên hiện cùng thông tin (các metric chuỗi tên `Node Info/Version` và `Node Info/ImageDigest`, không có bí danh, nên host Sparkplug không biết chúng sẽ bỏ qua). `GET /api/fleet` hiển thị chúng dưới dạng `release` của từng thành viên: `version`, `imageDigest` và `since`, thời điểm Gateway nghe thấy bản dựng đó lần đầu. Relay cũ hơn không báo gì, và Gateway không nói gì về nó thay vì bịa ra một "bản dựng không rõ".

Khi bản dựng của một thành viên đổi, Gateway ghi vào nhật ký hệ thống một sự kiện `config` cho thành viên đó, với phiên bản và mã băm cũ và mới trong chi tiết (`{"kind":"fleet.release",...}`). Bản dựng đầu tiên nó nghe thấy cũng được ghi, làm mốc để đo bản kế tiếp. Nó sống sót qua lần khởi động lại Gateway, vì bản ghi cuối được đọc lại từ nhật ký: khởi động lại không bao giờ bịa ra một lần cập nhật. Đây là dấu vết kiểm toán của mọi lần cập nhật mà relay nhận, bằng bất kỳ đường nào (bộ hẹn giờ của Podman, một lần phê duyệt, `helm upgrade`, ai đó ở máy), vì Gateway không gây ra cập nhật và chỉ có thể báo cáo nó. Một tag di động là cách `:stable` cập nhật, nên mã băm đổi dưới cùng phiên bản cũng được ghi, là "một image khác của cùng phiên bản".

`POST /api/fleet/{id}/update` (`fleet.update`, chỉ quản trị viên) phê duyệt bản cập nhật mà một relay đang giữ lại. Nó chỉ có tác dụng với relay được đặt để giữ bản cập nhật; relay khác ghi nhận rằng đã bỏ qua. Yêu cầu không nêu image nào. Việc này làm gì và không làm gì với từng kiểu cài đặt nằm trong [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#cập-nhật-một-relay).

## Cấp quyền cho lệnh

Hai lớp, cố ý không phải một:

- **Ở API**, người vận hành cần `fleet.rebirth` để yêu cầu rebirth; khởi động lại, phê duyệt cập nhật hay đẩy cấu hình lần lượt cần `fleet.restart`, `fleet.update` hay `fleet.config`, chỉ cấp cho quản trị viên. Khởi động lại làm gián đoạn chu kỳ thăm dò đang chạy nhiều hơn cú huých rebirth, và việc đẩy những gì relay thăm dò cũng được xử lý như vậy, cùng sự thu hẹp mà `alarms.ack` và `automations.trigger` đã mô hình hóa cho các thao tác "làm ngay" khác.
- **Ở broker**, ứng dụng này không thể ép buộc điều gì: việc công bố NCMD và topic cấu hình đều phải được giới hạn, bằng ACL riêng của broker, chỉ cho thông tin đăng nhập MQTT của chính Gateway. Nếu không, bất cứ ai tới được broker và biết nhóm và nút của một relay đều có thể công bố cùng lệnh hay cấu hình như tính năng này. Hãy cấu hình lúc triển khai; nó không phải tùy chọn chỉ vì nằm ngoài mã của ứng dụng này.

## API

| Tuyến | Quyền | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Mọi thành viên đã đăng ký, với trạng thái hiện diện trực tiếp và, nếu đã cấu hình, một `/status` được thăm dò |
| `POST /api/fleet` | `fleet.write` | Tạo hoặc cập nhật một thành viên (nội dung có `id` đã tồn tại sẽ cập nhật) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Gỡ một thành viên đã đăng ký |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Công bố `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Công bố `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Phê duyệt bản cập nhật image mà relay đang giữ (không làm gì với relay không giữ) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Đẩy tệp thiết bị mới (nội dung JSON thô, được kiểm tra trước khi công bố); relay đang chạy áp dụng ngay |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Xóa lần đẩy, để relay quay về tệp thiết bị cục bộ của nó, ngay lập tức nếu đang kết nối |

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | Tính năng tắt cho đến khi đặt biến này |
| `HOTLOOP_FLEET_BROKER` | n/a | Bắt buộc khi bật. Chỉ host, `host:port` hoặc một URL đầy đủ |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Thông tin đăng nhập broker |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | Tùy chọn riêng của từng lần triển khai; đừng bao giờ đặt mặc định |

## Điều đã kiểm chứng và điều chưa

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.
