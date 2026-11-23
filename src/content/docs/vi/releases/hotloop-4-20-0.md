---
title: "Ghi chú phát hành: HotLoop core 4.20.0"
description: "HotLoop core 4.20.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.20.0"
---

Giao diện web mới giờ là giao diện ở `/`, và một agent có thể thay đổi mọi thứ nó đọc được qua MCP. Không có migration, và một lệnh `helm upgrade` bình thường hoặc tự động cập nhật của Quadlet sẽ lấy nó. Bản phát hành trước, [4.19.11](/vi/releases/hotloop-4-19-11/), là bản cuối cùng có màn hình mặc định là các màn hình cũ.

Bản build này chỉ có amd64, và bản phát hành kế tiếp là một lần tăng phiên bản nhỏ để build các image arm, đúng như cách hai lượt chạy diễn ra. Trong lúc đó `stable` giữ các image arm mà nó đang có.

## Có gì thay đổi

- **Giao diện web mới là mặc định, và giao diện cũ đã bỏ.** Mọi màn hình được dựng lại thành trang tĩnh (Astro, kèm các phần Svelte), nhúng trong một binary duy nhất, không cần Node trên hộp và không cần CDN. Nó ở `/next` trong suốt 4.19.x. Ở `/` là cùng mười chín màn hình với cùng các điều khiển, trường, cột, biểu mẫu và từ ngữ, cho người xem, người vận hành và quản trị viên. Những gì trông khác, có chủ ý:
  - Màu sắc là nền ấm và màu cam của HotLoop, giống trang web, Flow và Cascade, và biểu tượng là biểu tượng chính thức.
  - Các màn hình được nhóm thành Operate, Plant, Build và System trong một thanh ray trên bàn làm việc. Trên điện thoại có một thanh năm mục (Board, Alarms, Dashboards, Entities, More), và More mở mọi màn hình.
  - Điều khiển giao diện ghi Dark hoặc Light, nơi trước đây hiện hình mặt trăng.
  - Biểu tượng của ứng dụng đã cài, màu giao diện và màu màn hình khởi động theo giao diện mới.
  - Một ngăn kéo chừa chỗ cho thanh cuộn của nó, nên thẻ bên trong không dịch chuyển khi lịch sử của nó được tải.
- **Đăng nhập khi HotLoop không truy cập được sẽ nói vì sao và tự phục hồi.** Một điện thoại chưa từng đăng nhập, hoặc đã đăng xuất, mở trang mà không có kết nối sẽ nhận màn hình đăng nhập kèm một câu nói rằng HotLoop không trả lời từ đây. Trang hỏi lại mỗi ba giây, và khi kết nối trở lại nó tự tải lại mà không cần chạm. Đó là hành vi cũ, được giữ nguyên.
- **MCP có thể thay đổi mọi thứ nó đọc được.** Từng có hai mươi bảy công cụ đọc nhà máy và ra lệnh cho thiết bị; giờ có 128. Sáu mươi bốn công cụ nữa thay đổi cấu hình: thiết bị và tag, khám phá và broker, mạng UniFi, thực thể, helper, thiết bị máy và nhãn, cảnh báo, tự động hóa và blueprint (agent giờ có thể tạo quy tắc từ một blueprint, điều trước đây nó chỉ xem trước được), script, công thức, bảng điều khiển và phần còn lại mà một màn hình có thể lưu. Ba mươi bảy công cụ chạm tới các chức năng riêng của quản trị viên: người dùng và PIN, thiết lập, sao lưu, leo thang, đích historian, login của broker, đội edge relay và báo cáo. Không cái nào là bản triển khai thứ hai. Mỗi cái là một route của REST API chạy qua chính handler của route đó, nên kiểm tra hợp lệ, kiểm tra quyền, tải lại runtime và dòng kiểm toán là của route, với agent là chủ thể.
- **Điều gì đứng trước một thay đổi.** Công tắc `HOTLOOP_ALLOW_MCP_WRITES` (mặc định bật) phải bật, và một bên gọi có `HOTLOOP_MCP_OIDC_WRITE_ROLE` được đặt phải giữ vai trò đó. Lời gọi mang đúng một quyền mà route của nó yêu cầu (`devices.write`, `alarms.write`, `users.manage`, `settings.write`, v.v.) và bị từ chối bằng chính lời của route nếu thiếu. Mọi thay đổi đều cần một `reason`, được ghi thành một dòng `config` trong nhật ký hệ thống bên cạnh dòng của chính route. Ra lệnh cho thiết bị vẫn là `write_tag`, `call_service`, `run_script`, `apply_recipe` và `trigger_automation` sau `HOTLOOP_ALLOW_WRITES`, dấu ghi được của tag và phạm vi của nó. Biến một tag, một quy tắc hay một công thức thành ghi được là cấu hình và không ra lệnh gì cho đến khi được dùng; những gì nó ra lệnh khi đó gặp cùng cổng ấy. Hai công tắc ghi không có route, nên `save_settings` từ chối chúng với agent như màn hình Settings, và agent không thể bật công tắc mà chính các lần ghi của nó đang chờ. Mật khẩu của một người dùng đi qua lời gọi như đi qua API, và dòng kiểm toán không bao giờ mang nó. Các công cụ cũng có ở `--mcp-stdio`. [MCP](/vi/iot/mcp/#thay-đổi-cấu-hình) có mọi công cụ, route và quyền của nó.

## Thay đổi API

- `GET /next` và `GET /next/` là `301` về gốc, nên một dấu trang tạo khi giao diện mới còn nằm cạnh giao diện cũ vẫn tới được. `Location` là tương đối, nên đúng dưới một base path.
- `GET /static/` đã bỏ, và cùng với nó là `GET /next/manifest.webmanifest`. Trang, các tệp của nó, biểu tượng, `/manifest.webmanifest` và `/sw.js` được phục vụ từ gốc như trước; stylesheet và script cũ không được liên kết từ đâu cả và không được phục vụ.
- `HOTLOOP_UI` không còn được đọc. Đặt nó không có tác dụng.
- Không có route nào khác thay đổi. Các công cụ MCP là bề mặt mới, không phải route REST.

## Nâng cấp từ 4.19.11

Một lệnh `helm upgrade` bình thường, hoặc tự động cập nhật của Quadlet. Không có migration và không có gì để cấu hình. Lần tải đầu lấy trang mới và service worker thay thế bộ nhớ đệm của bản cũ, nên một điện thoại đã cài ứng dụng sẽ hiện các màn hình mới ở lần mở kế tiếp. Không gì có thể bị làm cho không hoàn tác được khi nâng cấp, và rollback về 4.19.11 là an toàn vì không có gì trong cơ sở dữ liệu thay đổi.

## Đã biết

- Không có gì mới. Những gì còn mở dưới Broken or missing trong [lộ trình](/vi/roadmap/): token người dùng X.509 của OPC UA, các chính sách lỗi thời `Basic128Rsa15` và `Basic256` mà máy chủ OPC UA của chúng tôi cung cấp cùng mật khẩu trên 64 byte (cả hai của thư viện), và các bài kiểm thử thiết bị im lặng cho S7comm và EtherNet/IP với thiết bị thật.
