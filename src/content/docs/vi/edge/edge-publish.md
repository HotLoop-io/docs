---
title: "Edge Publish và lưu rồi chuyển tiếp"
description: "Xuất bản mọi thứ một máy đọc được lên Gateway trung tâm dưới dạng nút biên Sparkplug B, đệm xuống đĩa khi đường truyền đứt và phát lại theo đúng thứ tự."
---

Edge Publish, từ 4.5.0, biến HotLoop thành một **nút biên** Sparkplug B, xuất bản mọi thứ nó đọc được lên một Gateway trung tâm qua MQTT, theo chiều ngược lại với trình điều khiển MQTT hiện có, vốn tiếp nhận Sparkplug với vai trò máy chủ chính. Đây là ý nghĩa của việc chạy nó.

Edge publish mặc định bật trong Gateway và Edge và nghỉ cho đến khi có broker và một nhóm Sparkplug, từ chart hoặc biến môi trường, hoặc do quản trị viên nhập trong Cài đặt, "Nơi báo động và số đọc được gửi tới" (xem [Thông báo báo động](/vi/iot/notifications/#báo-động-đi-đâu-cài-đặt)). Những gì lưu ở đó được ưu tiên, và được đọc khi HotLoop khởi động, vì publisher sở hữu tệp hàng đợi và nút. Nếu chưa có gì được đặt, nó không phát hành gì và không ngăn HotLoop khởi động.

Khi bật tính năng này, nó chạy ngay trong cùng tiến trình Gateway, vẫn kết nối với TimescaleDB, hữu ích khi một địa điểm muốn có cả giao diện và lịch sử của Gateway đầy đủ ngay tại chỗ lẫn đường lên một Gateway trung tâm. Việc quản lý đội thiết bị cho nhiều Edge Relay có từ 4.7.0 (theo dõi, dựa trên Birth và Death của chúng) và 4.8.0 (đẩy cấu hình); xem trang quản lý đội thiết bị.

## Bật tính năng

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Mọi giá trị đọc đến bus tag (cùng luồng mà giao diện trực tiếp và bộ đánh giá cảnh báo đọc) đều được xuất bản dưới dạng Sparkplug B `NDATA`. Khi broker còn truy cập được và đang xác nhận, việc đó diễn ra thẳng từ bộ nhớ và đĩa không bị đụng đến. Khi broker ngừng xác nhận, các giá trị đọc đi vào hàng đợi chuyển tiếp trên đĩa và ra khỏi đó, theo thứ tự, khi broker trở lại.

## Nó thực sự làm gì

**Đăng ký trước khi được sinh ra.** Ở mỗi kết nối, lần đầu cũng như mỗi lần kết nối lại, nút đăng ký chủ đề `NCMD` của nó (và chủ đề đẩy cấu hình) rồi chờ broker xác nhận cả hai trước khi xuất bản bất cứ thứ gì. Sparkplug B 3.0 yêu cầu điều này ("Trước khi gửi một thông điệp NBIRTH, máy khách MQTT gắn với nút biên phải đăng ký để nhận các thông điệp NCMD"), và có lý do chính đáng: một host được phép trả lời một birth bằng yêu cầu rebirth hoặc khởi động lại ngay lập tức, và một nút birth trước có thể bỏ lỡ nó. `Start()` không trả về cho đến khi các đăng ký đã vào đúng chỗ. Nếu broker từ chối một trong số đó (một ACL không cho nút này đọc chủ đề `NCMD` của chính nó), `Start()` thất bại với một lỗi nói rõ điều đó; một nút mà không ai ra lệnh được không nên khởi động và giả vờ như không có chuyện gì. Một lần kết nối lại không đăng ký lại được sẽ không birth trong phiên đó; các giá trị đọc tiếp tục đi vào hàng đợi chuyển tiếp.

**Một broker không có mặt không làm dừng quá trình khởi động.** Bị từ chối là vấn đề cấu hình và làm `Start()` thất bại. Không truy cập được là một sự cố: `Start()` ghi nhật ký rồi trả về, và nút tiếp tục thử ở nền (một giây, tăng gấp đôi đến một phút) trong khi mọi giá trị đọc đi vào hàng đợi chuyển tiếp. Trước đây nó cũng thất bại ở trường hợp này, và Gateway cùng Edge thoát khi Edge Publish không khởi động được, nên một máy khởi động lại trong lúc WAN gián đoạn bị lặp vòng lỗi, không có màn hình, không cảnh báo, không tự động hóa và không có gì được đệm cho đến khi WAN trở lại.

**NBIRTH một lần cho mỗi kết nối.** Mọi tag đã biết, được công bố theo tên với một bí danh ổn định, kèm giá trị hiện tại của nó. Một birth xảy ra ở lần kết nối đầu tiên, ở mỗi lần kết nối lại (một phiên Sparkplug bắt đầu lại, việc đánh số thứ tự của nó không có ý nghĩa qua một lần kết nối lại), khi một tag chưa ai thấy xuất hiện trong một lô, và khi có yêu cầu, xem bên dưới.

**NDATA cho mọi thứ sau đó**, chỉ bằng bí danh, không có tên. `seq` bắt đầu từ 0 cùng với birth và tăng (mod 256) theo từng thông điệp cho đến birth kế tiếp.

**NDEATH** theo hai cách: êm thấm khi `Stop()`, và qua last-will của chính kết nối MQTT nếu tiến trình chết mà không kịp làm. Cả hai mang cùng một giá trị `bdSeq`, khớp với birth mà chúng kết thúc. Một host phân biệt giấy chứng tử cũ, còn sót lại từ một phiên trước, với giấy hiện tại nhờ con số đó.

**`bdSeq` đếm các phiên, và bộ đếm tồn tại qua một lần khởi động lại.** Mỗi MQTT CONNECT nhận số tiếp theo: 0 ở phiên đầu tiên của một hàng đợi, thêm một mỗi lần, quay về 0 sau 255 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment: `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), và NBIRTH trên kết nối đó mang cùng số với will mà nó đã đăng ký (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Nó nằm trong tệp của hàng đợi chuyển tiếp, nên một nút khởi động lại tiếp tục đếm thay vì bắt đầu lại từ 1 và đưa cho host một will mà nó đã thấy, thứ mà host có quyền bỏ qua vì cũ. Một lần kết nối lại là một phiên mới, nên nó cũng nhận số mới; mã cũ giữ một số cho cả đời tiến trình vì thư viện máy khách MQTT dùng lại will mà nó được tạo ra cùng, còn giờ nút dựng một máy khách mới, và do đó một will mới, cho mỗi lần thử kết nối. Metric là INT64, như đặc tả yêu cầu (trước đây nó đi ra dưới dạng UInt64; giá trị nằm trong cùng trường, nên một host đọc theo giá trị sẽ không nhận ra).

**`NCMD` → `Node Control/Rebirth`.** Một host yêu cầu rebirth sẽ nhận một NBIRTH mới, cùng `bdSeq`. Một rebirth không phải là một phiên mới, nên nó không nhận số mới (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Khi đường lên bị mất

**Đĩa dành cho sự cố, không dành cho mọi lần thăm dò.** Khi đường lên còn hoạt động và broker đang xác nhận, các giá trị đọc chỉ nằm trong bộ nhớ cho đến khi bộ xả đã gửi chúng và broker đã xác nhận, và không có gì được ghi xuống đĩa. Ngay khi không còn phiên, một xác nhận không đến, hoặc bộ nhớ sắp vượt quá 100.000 giá trị đọc, mọi thứ trong bộ nhớ đi vào hàng đợi trên đĩa theo thứ tự, mọi thứ sau đó xếp phía sau nó, và bộ xả đọc từ đĩa, cũ nhất trước, chỉ lấy một giá trị ra khỏi đó khi broker đã xác nhận nó. Nút chỉ quay lại bộ nhớ khi đĩa trống, nên không bao giờ có lúc các giá trị đọc mới hơn vượt qua cái cũ hơn.

Chúng tôi đã làm việc này hai lần, và phiên bản đầu sai so với phần cứng. Nó ghi mọi giá trị đọc xuống đĩa trước khi gửi, nên một cú kill không làm mất gì mà nút đã nhận. Nhưng nó cũng ghi khoảng 5 MB mỗi giây ở 2.000 giá trị đọc mỗi giây, tức 450 GB mỗi ngày, từ khoảng 160 lần commit hàng đợi mỗi giây ở tám trang mỗi lần. Điều đó giết một thẻ SD và là mức hao mòn vô lý đối với bất kỳ bộ nhớ flash nào. Chi phí đĩa ở trạng thái ổn định giờ là không (các con số ở bên dưới), và thứ chúng tôi đánh đổi để có điều đó được nêu thẳng ở phần tiếp theo.

**Một cú kill cứng khi đường lên còn hoạt động làm mất những gì đang ở trong bộ nhớ.** Một SIGKILL, mất điện hoặc kernel panic, trong khi đường truyền còn sống và broker đang xác nhận, lấy đi những giá trị đọc chưa được xác nhận. Đó là khoảng một lần thăm dò: ở 2.000 giá trị đọc mỗi giây và độ trễ khứ hồi xác nhận vài mili giây, nhiều nhất là vài trăm giá trị, và đúng bằng số lần thăm dò mà host sẽ thấy ngay sau đó. Chúng không bị tính là bị bỏ, vì không có gì biết chúng đã tồn tại. Một lần dừng êm (`Stop`, một SIGTERM, một lần khởi động lại) ghi những gì đang ở bộ nhớ xuống đĩa trước và không mất gì. Một đường truyền bị cắt cũng không mất gì theo cả hai cách, vì việc đầu tiên nút làm khi đường truyền ngừng xác nhận là chuyển bộ nhớ xuống đĩa. Trường hợp duy nhất thiết kế này không bao phủ là tiến trình chết khi đường lên còn hoạt động, và nó không được bao phủ một cách có chủ ý.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` giới hạn hàng đợi sự cố, và mặc định là 64 MiB, khoảng hai phút sự cố ở 2.000 giá trị đọc mỗi giây (giàn thử bên dưới chạy ở mức đó: vừa khoảng 248.000 giá trị đọc, đo ở 4.21.1). Vượt quá thì các giá trị đọc cũ nhất đi trước và được đếm. Đặt thành 0 thì hàng đợi không giới hạn: tiến trình cảnh báo về điều đó khi khởi động, vì một sự cố rất dài trên một hàng đợi không giới hạn sẽ làm đầy ổ thay vì bỏ các giá trị đọc cũ như hàng đợi trong bộ nhớ của historian vốn đã làm.

Một giá trị đọc mà bộ xả lấy ra trong vòng vài giây sau khi nó được xếp hàng sẽ đi ra như giá trị hiện tại của tag, trong một `NDATA` cùng phần còn lại của lần thăm dò của nó. Một giá trị phải chờ lâu hơn, hoặc bị bỏ lại bởi một tiến trình đã chết, đi ra có gắn cờ `is_historical`, để một host không để nó ghi đè lên những gì tag đang làm lúc này. Khi kết nối lại, hàng đợi được xả **trước** khi bất cứ thứ gì mới hơn được xuất bản, cũ nhất trước, vì chỉ có một lối ra khỏi nó.

Một lần phát lại được đóng gói: tới 200 giá trị đọc lịch sử dùng chung một `NDATA`, mỗi metric mang dấu thời gian và `is_historical` của riêng nó. Đặc tả cho phép điều đó ("Nhiều thay đổi giá trị của cùng một metric CÓ THỂ được đưa vào cùng một thông điệp Sparkplug NDATA ... miễn là chúng có dấu thời gian khác nhau", Sparkplug B 3.0, Operational Behavior, Data Publish), nên một thông điệp không bao giờ chứa một tag hai lần trong cùng một mili giây và bắt đầu thông điệp kế tiếp. Chúng tôi đóng gói vì mỗi thông điệp một giá trị đọc là nút thắt, và việc đo hiệu năng đã nói vậy: 57% CPU của lần phát lại là lời gọi hệ thống write mà thư viện máy khách MQTT thực hiện cho mỗi gói, và 200.000 giá trị đọc trong hàng đợi mất 58,5 giây, 3.418 mỗi giây, trong khi nhà máy tạo ra 2.000 mỗi giây. Một lần phát lại chậm hơn nhà máy là một khối tồn đọng không bao giờ hết. Khi đóng gói, cũng 200.000 giá trị đó mất 2,9 giây, 68.237 mỗi giây, đo khi nút vẫn ở QoS 1. Các giá trị đọc trực tiếp vẫn đi ra mỗi lần thăm dò một `NDATA`.

**QoS 0, như đặc tả nói, và một vòng khứ hồi để biết nó đã đến.** NBIRTH và NDATA đi ra ở QoS 0 và không retained (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). Will NDEATH ở QoS 1 và không retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), và NDEATH êm thấm mà `Stop` xuất bản cũng vậy. Điểm vướng của QoS 0 là không có xác nhận: một lần xuất bản "hoàn tất" khi các byte đến socket cục bộ, và điều đó vẫn ổn khi đẩy vào một đường truyền chết, nên coi nó là đã giao sẽ lấy các giá trị đọc khỏi đĩa đúng vào lúc chúng quan trọng. Thay vào đó nút gửi một yêu cầu phía sau mỗi khối (một SUBSCRIBE tới chủ đề NCMD của chính nó, thứ mà nó dù sao cũng phải được phép làm) và giữ khối đó cho đến khi broker trả lời. Một kết nối là một luồng byte có thứ tự và một broker xử lý các gói của một máy khách theo thứ tự nó đọc, nên câu trả lời có nghĩa là nó đã đọc mọi thứ trước đó. Đó là sự đảm bảo mà một PUBACK từng cho, mỗi khối một vòng khứ hồi thay vì mỗi thông điệp một xác nhận. Một bài kiểm tra ghi vào một đường truyền im lặng và kiểm tra rằng không có gì rời hàng đợi, trong bộ nhớ hay trên đĩa; nếu không có vòng khứ hồi, cả 30 giá trị đọc trong đó đã ra đi.

**Một kết nối ngừng trả lời thì bị bỏ, không chờ cho hết.** Nếu broker không xác nhận một khối, hoặc thư viện máy khách MQTT không nhận được thông điệp, nút tự đóng kết nối đó và bắt đầu một phiên mới (`bdSeq` kế tiếp, birth mới), giữ lại mọi thứ chưa được xác nhận (chuyển xuống đĩa nếu nó đang ở bộ nhớ). Nó phải làm vậy, vì một đường truyền chết mà không có reset vẫn nhận các lần ghi cho đến khi bộ đệm gửi của kernel đầy, rồi goroutine ghi duy nhất của thư viện máy khách MQTT bị kẹt trong một lần ghi. Đó cũng là goroutine gửi PING keepalive, nên keepalive không bao giờ kích hoạt, và nút nằm trong kết nối chết suốt thời gian sự cố: một lần cắt thử sáu phút cho thấy nó đã không nhận ra cho đến khi đường truyền trở lại. Tệ hơn, lượt đang ghi thức dậy trên kết nối mới và tiếp tục gửi phần còn lại của khối cũ của nó trước NBIRTH của phiên mới, với số thứ tự của phiên cũ. Giờ mỗi lượt thuộc về phiên mà nó bắt đầu và nhận một lỗi, không phải đường truyền, khi phiên đó đã kết thúc.

Việc giao là **ít nhất một lần**. Một khối mà broker đã nhận nhưng không bao giờ xác nhận sẽ được gửi lại, dưới dạng lịch sử, và một cú kill giữa lúc giao và lúc nút ghi nhận điều đó cũng cho kết quả như vậy. Một host tiêu thụ dữ liệu này phải chịu được bản trùng; nó không bao giờ được giả định rằng hàng đợi này đã loại trùng cho nó.

### Nó cam kết gì, và các con số phía sau

- **Đúng thứ tự.** Mọi giá trị đọc của mọi tag đến host theo thứ tự nó được đọc, cả trực tiếp lẫn phát lại cùng nhau, qua một SIGKILL và một lần khởi động lại.
- **Một tệp có giới hạn.** Giới hạn áp cho tệp của hàng đợi, thứ làm đầy ổ, không phải cho dữ liệu trong đó. Tệp của hàng đợi là dữ liệu cộng với tiêu đề trang, các trang nhánh, danh sách trang trống và độ dư để tăng trưởng; với giới hạn cũ (cách hàng đợi tự đếm byte lá) tệp ra gấp đôi dữ liệu. Bất cứ thứ gì dưới 1 MiB chạy ở 1 MiB, kèm một cảnh báo khi khởi động.
- **Không mất gì trong một sự cố.** Một khi đường truyền ngừng xác nhận, mọi giá trị đọc nằm trên đĩa và ở đó cho đến khi broker xác nhận, nên mọi giá trị đọc đều quay ra được qua một sự cố, một kết nối chết, một lần dừng êm, và một SIGKILL hoặc mất điện giữa sự cố. Ngoại lệ là điều ở trên: một cú kill cứng hoặc mất điện khi đường lên còn hoạt động làm mất khoảng một lần thăm dò, những giá trị đọc còn trong bộ nhớ.
- **Việc bỏ vượt giới hạn là ồn ào và được đếm.** Các giá trị đọc cũ nhất đi trước, và mỗi giá trị đi vào một bộ đếm số bị bỏ nằm trong tệp hàng đợi, nên một lần khởi động lại không xóa bằng chứng. Nó nằm trong `GET /api/diagnostics` dưới `edgePublish` (và trong `/status` của relay dưới `uplink`), bên cạnh những gì đang xếp hàng, kích thước tệp và việc một lần phát lại có đang chạy không. Nhật ký nói điều đó mỗi phút một lần khi nó đang xảy ra, không bao giờ mỗi lần thăm dò một dòng. Bộ đếm có thể chạy trước mức mất mát một chút và không bao giờ sau: các giá trị đọc mà host vừa nhận trước một lần cắt, mà xác nhận của chúng không bao giờ đến, vẫn còn trên đĩa khi giới hạn lấy chúng, và được đếm dù host đã có chúng.
- **Một giá trị đọc mới chỉ được thăm dò có thể mất vì một cú kill cứng khi đường lên còn hoạt động.** Giữa lúc trình điều khiển trao một giá trị đọc và lúc broker xác nhận nó, nó chỉ tồn tại trong tiến trình, và một SIGKILL hoặc mất điện lấy nó đi. Đó là cái giá của việc không ghi mọi lần thăm dò xuống đĩa, và chúng tôi chọn nó thay cho 450 GB mỗi ngày. Kill khi không có gì đang bay thì câu trả lời là chính xác: mọi giá trị đọc mà nhà máy đưa ra đều đã được giao hoặc được đếm.

Tất cả được đo bằng một HotLoop Edge thật thăm dò 20 thiết bị HTTP, mỗi thiết bị 25 tag, cứ 250 ms một lần (2000 giá trị đọc mỗi giây), xuất bản lên một Mosquitto thật. Mỗi thiết bị trả lời mỗi lần thăm dò bằng một bộ đếm lớn hơn lần trước một đơn vị, nên một bộ phân xử phía host biết chính xác giá trị đọc nào bị mất, cái nào quay lại hai lần và cái nào ra sai thứ tự. Đường lên bị cắt bằng cách rút broker khỏi mạng: socket của Edge im lặng, không reset, không ngắt. Để kill khi không có gì đang bay, nhà máy tạm dừng vài giây trước SIGKILL ("quiesced"); các lần kill khác rơi vào bất cứ chỗ nào việc thăm dò đang diễn ra ("instant"). Các lần chạy ngày 2026-10-12, với giới hạn 64 MiB. "Before" là `15419f1`, bản dựng trước công việc này. "Write-ahead" là `165411f`, bản ghi mọi giá trị đọc xuống đĩa trước và chúng tôi đã gỡ ra. "Now" là bộ nhớ khi đường lên còn hoạt động và đĩa trong một sự cố:

| <span class="sr-only">Details</span> | Trước | Ghi trước | Hiện tại |
|---|---|---|---|
| Trạng thái ổn định, đường lên hoạt động, 2.000 readings/s | 2.018 readings/s, 0 bytes/s xuống đĩa, 9% một CPU | 2.031 readings/s, 5,4 MB/s xuống đĩa (450 GB một ngày), 14% một CPU | 10 phút: 2.002 readings/s, 0 bytes được ghi xuống đĩa (0 bytes một ngày), 0 trang kho hàng đợi nhúng được ghi, tệp hàng đợi 32.768 bytes trước và sau, 9% một CPU |
| Phát lại một sự cố 5 phút, trong khi các giá trị đọc vẫn đến ở 2.000 readings/s | 829.745 giá trị trong 4 m 11 s, 3.308 mỗi giây | 194.247 đến 308.582 mỗi giây | 244.335 giá trị trong 824 ms, 296.523 mỗi giây |
| Kiểm kê sau một sự cố 5 phút | mất 441.255, đếm 441.255 | mất 474.978, đếm 474.978 | mất 599.165, đếm 599.165, toàn bộ là cũ nhất, toàn bộ do giới hạn |
| Thứ tự, bí danh, khoảng trống số thứ tự, dữ liệu trực tiếp trong một lần phát lại | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL khi không có gì đang bay, đường lên hoạt động | mất 0 | mất 0 | mất 0 |
| SIGKILL khi không có gì đang bay, 90 s sau một lần cắt im lặng 5 phút, vượt giới hạn | chưa chạy | mất 528.167, đếm 528.667 | mất 520.661, đếm 521.161 (500 giá trị dư đã được giao, không bao giờ được xác nhận) |
| Mười SIGKILL tức thì, đường lên hoạt động | mất 0 (một lần chạy trước đó: 50 trong bốn lần) | mất 0 (một lần chạy trước đó: 250) | mất 0 trong lần chạy này; một cú kill có thể lấy đi khoảng một lần thăm dò, xem ở trên |

Cái giá nằm ở hàng đầu tiên. Ghi trước thực hiện khoảng 160 lần commit mỗi giây (một lần cho mỗi lần thăm dò để đưa lên đĩa, một lần cho mỗi khối để lấy xuống) ở khoảng tám trang 4 KB mỗi lần, tức 5 MB/s và 450 GB một ngày, và một thẻ SD không sống nổi với điều đó. Ở trạng thái ổn định, nút giờ hoàn toàn không ghi vào hàng đợi: bộ đếm `write_bytes` của Edge trong `/proc` không nhúc nhích trong mười phút. Mười cú kill tức thì không làm mất gì trong lần chạy đó, và đó là may mắn, không phải lời hứa: khoảng rủi ro là các giá trị đọc trong bộ nhớ khi tiến trình chết, khoảng một lần thăm dò.

Một bản dựng trước đó đã tìm ra nửa còn lại của mục đích công việc này: QoS 0 và một kết nối ngừng trả lời. Xem "Một kết nối ngừng trả lời thì bị bỏ" ở trên. Lần cắt năm phút trước bản sửa đó khiến nút nằm trong một kết nối chết suốt sự cố rồi gửi một khối cũ trước birth của phiên mới; 100 giá trị đọc đến sai thứ tự.

Một bản dựng trước đó đã tìm ra nửa còn lại của mục đích công việc này: QoS 0 và một kết nối ngừng trả lời. Xem "Một kết nối ngừng trả lời thì bị bỏ" ở trên. Lần cắt năm phút trước bản sửa đó khiến nút nằm trong một kết nối chết suốt sự cố rồi gửi một khối cũ trước birth của phiên mới; 100 giá trị đọc đến sai thứ tự.

Ở tải đó, một hàng đợi 64 MiB chứa khoảng hai phút sự cố: khoảng 248.000 giá trị đọc, tức khoảng 236 byte mỗi giá trị với tên tag chín ký tự (đo ở 4.21.1, tệp hàng đợi 61,7 MB), và tên tag dài hơn tốn nhiều hơn. Hãy tính giới hạn từ tốc độ và tên tag của chính bạn. Các hàng ngày 2026-10-12 ở trên khớp: sự cố 5 phút phát lại 244.335 giá trị đọc, cũng là hai phút đó. Việc phát lại không còn là giới hạn: nó chạy nhanh hơn tốc độ các giá trị đọc đến hơn một trăm lần.

Bộ phân xử từng báo 4.000 đến 6.000 bản trùng trong một lần chạy không có sự cố. Chúng tôi bắt lưu lượng để tìm xem của ai: mỗi cái đều là một NBIRTH lặp lại giá trị cuối của một tag mà một thông điệp trước đã mang, với dấu thời gian của chính giá trị đọc đó, và không có cái nào là một NDATA gửi hai lần. Một birth phải mang giá trị hiện tại của mọi metric mà nút có (đó là mục đích của birth), và nút birth lại mỗi khi một tag mới xuất hiện, nên các birth sau lặp lại các birth trước. Bộ xuất bản đúng và bộ phân xử sai. Giờ nó đếm riêng những cái đó là ảnh chụp và dành "trùng" cho một giá trị đọc được xuất bản lại dưới dạng dữ liệu, loại duy nhất mà host có thể nhầm là mới. Trong lần chạy ổn định và lần chạy mười cú kill, số nhận được giờ bằng đúng số đã đưa ra: 1.296.275 và 916.350.

## Những gì đã được xác minh và chưa được xác minh

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | Tính năng tắt cho đến khi biến này được đặt |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | không có | Chỉ tên máy, `host:port`, hoặc một URL đầy đủ |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | không có | Id nhóm Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_NODE` | tên máy của Pod | Id nút Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | không có | Thông tin xác thực broker |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | Tự chọn bật cho từng triển khai; không bao giờ đặt mặc định |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | Tệp của hàng đợi chuyển tiếp |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | Tệp hàng đợi không bao giờ lớn hơn mức này; các giá trị đọc cũ nhất bị loại, và được đếm, để giữ dưới mức đó. `0` là không giới hạn, kèm cảnh báo. Mọi giá trị khác dưới 1 MiB chạy ở 1 MiB, kèm cảnh báo |

## Trong biểu đồ Helm

Biểu đồ Gateway có một khối `edgePublish:` đặt tất cả những thứ này. Nó tắt theo mặc định, và khi tắt thì kết xuất đúng như những gì biểu đồ kết xuất trước khi khối đó tồn tại. Đừng đặt những biến này qua `extraEnv` nữa.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

Một vài điều mà biểu đồ quyết định thay bạn:

- Tệp hàng đợi là `/data/edge-publish/forward.db`, trên PVC riêng của nó. Nó không phải một giá trị, vì ở bất cứ nơi nào khác trong pod đều là hệ thống tệp gốc chỉ đọc. Khi `persistence.enabled: false` nó nằm trên một emptyDir, giữ được các giá trị đọc của một sự cố qua một lần khởi động lại container nhưng không qua một pod được lên lịch lại.
- Id nút mặc định là tên bản phát hành, không phải tên máy của pod. Một pod Deployment nhận tên máy mới ở mỗi lần triển khai, và host sẽ thấy một nút biên mới mỗi lần, với các giá trị đọc đã đệm được phát lại dưới nó.
- Deployment chuyển sang `Recreate` và `replicaCount` phải là 1. Tệp hàng đợi dùng khóa: dưới một lần cập nhật cuốn chiếu, pod mới không mở được nó, không bao giờ sẵn sàng và việc triển khai bị treo. Và hai bản sao sẽ là hai bộ xuất bản trên một id nút.

Biểu đồ Edge Relay (`charts/hotloop-edge-relay`) có khối `edgePublish:` riêng theo cùng hướng, trừ `enabled`: relay luôn xuất bản.
