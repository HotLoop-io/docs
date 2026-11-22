---
title: "Lộ trình của Cascade"
description: "Những gì Cascade đã xây dựng, mỗi bản phát hành mang lại gì, và những gì chưa được xây dựng và chưa có lịch."
---

Không có đoạn nào trong mã kiểm tra giấy phép. Mỗi giai đoạn kết thúc khi danh sách "thật" của nó đã được chạy trên các hệ thống thật, chứ không phải khi mã biên dịch được.

## 0.1.0, bản MVP

Đã xây dựng. Bộ máy, các lần chạy bền vững, hàng đợi Postgres và các worker, biểu thức, bước Code trong lồng cách ly, kho thông tin đăng nhập và OAuth2, webhook, lịch chạy và MQTT, người dùng với MFA bắt buộc, OIDC, dự án và RBAC, kiểm toán, lịch sử phiên bản, API, trình soạn thảo, các trình kết nối trong danh sách đã duyệt, nhập quy trình, số đo và dấu vết, chart Helm và các unit Quadlet. Phát hành theo `RELEASE_CHECKLIST.md`, không sớm hơn.

## 0.2.0, danh tính và quản trị

Đã xây dựng, và phát hành trong 1.0.0 cùng trình soạn thảo mới. SAML, LDAP và AD, SCIM, vai trò tùy chỉnh, bí mật bên ngoài, truyền nhật ký, biến, thư mục, phân tích, ghi chú cho lần chạy, kho blob S3 và Azure, và chính sách che dữ liệu trong các lần chạy. Mỗi tính năng được thử với máy chủ thật mà nó giao tiếp, và mỗi tính năng có màn hình riêng trong trình soạn thảo.

## 1.0.x đã mang lại gì

1.0.0 là 0.1.0 cộng 0.2.0 cộng trình soạn thảo mới, và không có gì khác. Chúng tôi gọi nó là 1.0.0 vì trình soạn thảo là mảnh cuối cùng chúng tôi muốn có trước khi đặt tên mình dưới con số đó, chứ không phải vì mọi thứ bên dưới đã xong.

1.0.1 sửa một lỗi khi đăng nhập: cơ sở dữ liệu không đọc được từng trả lời "chưa đăng nhập" và xóa cookie, nên một sự cố ngắn làm mọi người bị đăng xuất và có thể biến một yếu tố thứ hai đúng thành mã sai. Giờ nó trả lời "hãy thử lại" và giữ phiên. 1.0.2 cho phép bước Code ký và xác minh bằng khóa HMAC lưu như thông tin đăng nhập, và cho phép webhook nêu các nguồn web được gọi nó từ trình duyệt. Giữa 1.0.0 và 1.0.2 không có gì phải di chuyển.

Một quy trình đã lưu hôm nay tuân theo những gì: tệp ghi rõ định dạng của nó là phiên bản nào (`cascade: 1`), mỗi bước mang phiên bản riêng, và quy trình nêu một bước không còn tồn tại sẽ không qua được bước xác thực và không chạy, thay vì bị âm thầm sửa đổi. Các bước EmberOps được gỡ ra trong 1.0.0 theo cách đó. Ngoài ra chưa có cam kết nào về định dạng hay API, và chưa có kiểm thử nâng cấp từ mọi bản phát hành trước: những gì được kiểm thử nằm trong `RELEASE_CHECKLIST.md`, nâng cấp bằng tay từ bản phát hành gần nhất. Một cam kết sẽ vào đây khi chúng tôi giữ được nó, và không sớm hơn.

## 1.3.0, trình soạn thảo bằng 14 ngôn ngữ

Đã xây dựng. Tiếng Anh, Tây Ban Nha, Pháp, Ý, Đức, Na Uy Bokmål, Bulgaria, Hy Lạp, Hàn, Nhật, Việt, Hindi, Trung giản thể và Ả Rập. Có bộ chọn ngôn ngữ trên thanh trên cùng và trên trang đăng nhập; mọi màn hình, tiêu đề và trợ giúp của các bước, cùng các lời từ chối của máy chủ đều được dịch; ngày, số và khoảng thời gian theo ngôn ngữ; tiếng Ả Rập viết từ phải sang trái, còn khung vẽ và mã vẫn từ trái sang phải. Mỗi ngôn ngữ được thử trên mọi màn hình, ở chiều rộng máy tính và điện thoại, trong trình duyệt thật, và bản dựng từ chối ngôn ngữ nào thiếu một dòng. Các từ lấy từ bảng thuật ngữ chung của HotLoop.

## 1.4.1, trang Cài đặt

Đã xây dựng. Trang Cài đặt không còn trả một trường về giá trị cũ khi phản hồi của một lần lưu đến sau khi người dùng đã sửa nó: trường vẫn giữ nội dung đã gửi sẽ nhận giá trị của máy chủ, còn trường đã được sửa từ đó thì giữ lại phần sửa. Và các danh sách rà soát trong thư mục ngôn ngữ không còn nữa.

## 1.4.0, chờ đợi, lưu giữ, giới hạn và sao lưu

Đã xây dựng. Một pod khởi động trước cơ sở dữ liệu của nó, điều mà chart làm ở dạng tách rời, giờ sẽ chờ cơ sở dữ liệu và báo rõ, thay vì khởi động lại hai ba lần (bản cài không cho thấy lần khởi động lại nào trong bài kiểm thử chart). Và lưu giữ: một cài đặt cho số ngày giữ các lần chạy đã xong, mặc định tắt, cùng một lượt chạy mỗi giờ xóa các lần chạy cũ cùng dữ liệu các bước của chúng. Lượt chạy đó cũng xóa các tệp trong kho blob mà không lần chạy nào còn trỏ tới: đầu ra quá lớn cho cơ sở dữ liệu và các tệp đính kèm, còn tệp dùng chung chỉ bị xóa khi lần chạy cuối cùng dùng nó đã biến mất. Và giới hạn tần suất cho từng khóa API, qua API và MCP, mặc định tắt, trả lời 429 kèm thời gian cần chờ. (Webhook có giới hạn riêng, và tài khoản bị khóa sau nhiều lần sai mật khẩu, như trước.) Và `hotloop-cascade backup` và `restore`: cơ sở dữ liệu SQLite, khóa và các tệp blob kèm bảng kê băm, còn với PostgreSQL là khóa và blob cộng lệnh `pg_dump` cho phần cơ sở dữ liệu.

## 1.2.0, bốn công cụ cuối cùng của máy chủ MCP

Đã xây dựng. Máy chủ MCP còn thiếu bốn tuyến mà một khóa được phép gọi: liệt kê và thu hồi khóa của chính bạn, mở webhook thử của một quy trình, và bắt đầu đăng nhập OAuth2. Giờ chúng là công cụ, tổng cộng 83, mỗi công cụ đi qua tuyến của nó, nên áp dụng cùng các kiểm tra quyền như trình soạn thảo. Mười tuyến cần một người đã đăng nhập (tạo khóa, token SCIM, nhà cung cấp bí mật và đích nhận nhật ký, và mật khẩu của chính bạn) vẫn nằm ngoài, vì một khóa tạo được chúng có thể tự giữ mình còn hiệu lực; trang MCP nói rõ là những tuyến nào và vì sao.

## 1.1.0, MCP và các màn hình còn thiếu

Đã xây dựng, và đây là bản phát hành. Máy chủ MCP tại `/mcp`: 79 công cụ, mỗi công cụ là một tuyến của REST API, nên chính trình xử lý của tuyến kiểm tra quyền, xác thực nội dung, thực hiện thay đổi và ghi dòng kiểm toán. Nó được phát hành ở trạng thái bật, có đọc và ghi, như mọi MCP trong họ HotLoop, và hai công tắc cho nó thuộc về chính bản triển khai (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), không công cụ hay tuyến nào đổi được. Trang MCP có mọi công cụ và điều mỗi công cụ yêu cầu.

Và các màn hình mà trình soạn thảo còn thiếu: Thông tin đăng nhập, Dự án (thành viên và tài khoản dịch vụ), Người dùng, nhật ký kiểm toán, Cài đặt và trang Tài khoản với khóa API, mỗi màn hình có cùng quyền như API và được thử trong trình duyệt thật với từng vai trò. Trang đăng nhập giờ thuộc về trình soạn thảo, với màu sắc và phông chữ của nó, chứ không còn là trang Go cũ.

## Chưa xây dựng: môi trường và quy mô

Đã xây dựng từ giai đoạn này: vai trò webhook (Deployment riêng trong dạng tách rời của chart), giới hạn đồng thời cho từng quy trình, và nhiều main chạy trên một cơ sở dữ liệu. Điều chúng tôi chưa làm là bài kiểm thử đặt ra cho giai đoạn này: tắt một main trong lúc có lịch chạy theo phút và không thấy lần chạy trùng hay lần chạy bị bỏ sót nào trong một giờ.

Chưa xây dựng, chưa có lịch:

- Quản lý mã nguồn bằng Git và các môi trường.
- Các phiên bản được bảo vệ.

## Chưa xây dựng: trình kết nối và con người

Các trình kết nối trong danh sách đã duyệt đã được xây dựng thì đều có: HTTP, ntfy, Discord, Gotify, email, HotLoop, MQTT, cơ sở dữ liệu, tệp, và các kho blob S3 và Azure. Trình kết nối EmberOps có trong 0.1.x và đã bị gỡ trong 1.0.0.

Chưa xây dựng, chưa có lịch:

- Đặc tả khai báo đã công bố cho trình kết nối.
- Một SDK plugin và một chỉ mục.
- Biểu mẫu có bước phê duyệt của con người. Việc phê duyệt phải chạy được từ điện thoại, vì người duyệt thay đổi công thức đang đứng ở dây chuyền chứ không ngồi ở bàn làm việc. (Bước Wait vốn đã giữ một lần chạy cho đến khi ai đó gọi URL tiếp tục của nó, nên hôm nay đã có thể dựng phê duyệt bằng một liên kết; còn thiếu là biểu mẫu để người duyệt mở và bản ghi ai đã duyệt.)

## Chưa xây dựng: các bước AI

Các bước LLM và tác tử, cùng một bộ dựng dùng chính mô hình của bạn. Mang khóa của bạn đến hoặc chạy cục bộ. Chưa có gì trong số đó tồn tại và chưa ai lên lịch. Không có dịch vụ lưu trữ sẵn và sẽ không có. (Máy chủ MCP, cho phép một tác tử điều khiển Cascade từ bên ngoài, đã được xây dựng: xem 1.1.0.)

## Giao diện trình soạn thảo mới

Đã xây dựng, và nằm trong 1.0.0. Trình soạn thảo được viết lại bằng Astro với các đảo Svelte, dựng thành tài nguyên tĩnh và nhúng vào tệp nhị phân Go như bản cũ, nên vẫn là câu chuyện một tệp nhị phân, không có gì mới để chạy. Nó lấy màu, phông chữ và biểu trưng từ các tệp thương hiệu HotLoop và theo chế độ sáng hoặc tối của hệ thống. Mọi màn hình của trình soạn thảo cũ đều có trong đó và làm đúng việc cũ (mã khung vẽ được chuyển sang nguyên vẹn), các tính năng của 0.2.0 có màn hình, và một bài kiểm thử trình duyệt điều khiển từng màn hình với máy chủ thật trong Chrome thật. Không điều nào trong số đó thay đổi API, định dạng tệp hay phần Go.
