---
title: "Ghi chú phát hành: HotLoop Cascade 1.0.0"
description: "HotLoop Cascade 1.0.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.0.0"
---

## Đây là gì

1.0.0 là công việc về danh tính và quản trị cùng một trình soạn thảo mới, trong một bản phát hành. Mọi thứ trong 0.1.2 vẫn còn và hoạt động như cũ: công cụ chạy, các trình kết nối, trình nhập, Helm chart, các unit Quadlet và định dạng tệp quy trình. Thay đổi là những gì một nhà máy có thể làm với một phiên bản, và cách nó trông khi làm điều đó.

Chúng tôi gọi nó là 1.0.0 vì trình soạn thảo là mảnh ghép cuối cùng chúng tôi muốn có trước khi đặt tên mình dưới con số đó. Mọi màn hình đều chạy với API thật, và mọi tính năng bên dưới đều được thử với máy chủ thật mà nó giao tiếp, không phải đồ thay thế.

## Trình soạn thảo mới

Nó được dựng lại bằng Astro với các đảo Svelte, dùng màu sắc và phông chữ riêng của HotLoop, và theo giao diện sáng hoặc tối của hệ thống cho đến khi bạn chọn. Nó vẫn được tích hợp trong tệp nhị phân và không tải gì từ đâu cả, nên máy không có internet chạy nó cũng tốt như máy có. Mọi màn hình của trình soạn thảo cũ đều còn đây và làm đúng việc cũ, kể cả canvas: chúng tôi mang mã của nó sang thay vì viết lại, và đếm từng màn hình, nút, trường và lệnh gọi API trước và sau để chắc không thiếu thứ gì.

Các URL bạn đã lưu vẫn dùng được. `#/w/<id>`, `#/x/<id>`, `#/executions` và các liên kết gỡ lỗi mở cùng những màn hình đó, còn `/app/main.js` và `/app/main.css` vẫn phản hồi.

## Có gì mới

SAML, thử với Keycloak, chỉ nhận phản hồi có chữ ký. LDAP và Active Directory, thử với OpenLDAP và một bộ điều khiển miền Samba, với vai trò lấy từ nhóm. SCIM, thử với scim2-tester, để nhà cung cấp tạo và tắt tài khoản mà không ai phải chạm vào màn hình. Vai trò tùy chỉnh, tạo từ quyền của dự án. Bí mật bên ngoài trong OpenBao hoặc HashiCorp Vault, để mật khẩu của một thông tin đăng nhập nằm trong kho và xoay vòng ở đó. Truyền nhật ký kiểm toán và các lần chạy đã xong tới syslog (TCP, UDP hoặc TLS) và OTLP, thử với một máy chủ syslog thật và Loki. Biến, thư mục, thống kê, chú thích trên các lần chạy, chính sách che dữ liệu, và kho blob S3 và Azure, thử với Garage và Azurite.

Trình soạn thảo có một màn hình cho từng thứ: Biến, Thống kê và trong Cài đặt có Vai trò, Che dữ liệu, Bí mật bên ngoài, Truyền nhật ký, và Đăng nhập và SCIM. Mỗi người chỉ được thấy những gì vai trò của họ cho phép, và máy chủ vẫn từ chối phần còn lại.

## Các bước EmberOps đã bị gỡ

Chúng tôi đã gỡ trình kết nối EmberOps. Chín bước (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` và `call`), trigger "Khi một tài liệu EmberOps được tạo hoặc thay đổi", loại thông tin đăng nhập EmberOps cùng các màn hình và tài liệu đã cung cấp chúng không có trong 1.0.0. Nếu cần kết nối tới EmberOps, bước HTTP gọi REST API của nó bằng một thông tin đăng nhập, và cách đó dùng được ngay hôm nay.

Một quy trình đã lưu với một trong các bước đó không bị bỏ đi và cũng không bị thay đổi âm thầm. Nó không qua được bước kiểm tra và không chạy, và thông báo nêu tên bước và nói rằng các bước EmberOps đã bị gỡ trong 1.0.0. Xóa bước đó, hoặc thay bằng một bước HTTP, thì nó chạy lại. Một thông tin đăng nhập loại EmberOps vẫn nằm trong danh sách của bạn, không dùng đến, và bạn có thể xóa nó. Trình nhập không còn mang theo nút EmberOps: nó vào ở trạng thái tắt với cài đặt nằm trong ghi chú, như mọi nút mà nó không có bước tương ứng.

## Nâng cấp từ 0.1.2

`helm upgrade` lên 1.0.0, hoặc để `:stable` di chuyển các unit Quadlet. Tám migration (0018 đến 0025) chạy trong lúc nâng cấp. Chúng tạo các bảng cho vai trò, biến, thư mục, chú thích, chính sách che dữ liệu, SCIM, nhà cung cấp bí mật và đích nhật ký, và thêm một cột: thư mục chứa một quy trình. Chúng không đụng vào những gì bạn có, nên quy trình, thông tin đăng nhập và các lần chạy vẫn ở chỗ cũ và khóa vẫn mở được chúng. SAML, LDAP, SCIM và kho blob tắt cho đến khi bạn đặt các cài đặt `HOTLOOP_CASCADE_*` của chúng, có trong `docs/IDENTITY.md` và `docs/GOVERNANCE.md`. Không có gì thay đổi với phiên bản không đặt cái nào, trừ khi quy trình của bạn dùng bước EmberOps (xem ở trên).

## Những điều cần biết

Migration chỉ đi tiến. Rollback đặt lại image cũ, chứ không hoàn tác migration của cơ sở dữ liệu, nên hãy sao lưu trước khi cập nhật và coi bản sao lưu là đường quay về. Không có gì trong các migration này thay đổi hay xóa những gì đã có, nhưng chúng tôi chưa chạy image cũ trên lược đồ mới, nên không hứa điều đó.

Bí mật bên ngoài cần các đường dẫn được phép. Nhà cung cấp không có đường dẫn nào sẽ bị từ chối, có chủ ý, vì token của kho thường đọc được nhiều hơn rất nhiều so với những gì người chỉnh sửa thông tin đăng nhập nên có thể gọi tên.

SCIM không bao giờ hiện chủ sở hữu phiên bản cho nhà cung cấp, và lệnh DELETE từ nhà cung cấp tắt và ẩn tài khoản thay vì xóa, nên nhà cung cấp không thể xóa người cuối cùng có thể đăng nhập. Tạo lại sẽ đưa về cùng tài khoản đó.

Biến không phải bí mật. Ai đọc được một dự án thì đọc được các biến của nó, và giá trị không bị che trong dữ liệu chạy. Mật khẩu hãy đặt trong thông tin đăng nhập hoặc kho bên ngoài.

## Giấy phép

Cascade dùng Business Source License 1.1 (`BUSL-1.1`) của HotLoop, giống phần còn lại của dòng sản phẩm HotLoop. Nó không phải mã nguồn mở và tôi sẽ không giả vờ như vậy. Mỗi phiên bản trở thành GPL-3.0 trở lên bốn năm sau lần đầu được công bố. Dùng tại nhà và trong phòng thí nghiệm là miễn phí, dùng trong sản xuất của trường học, tổ chức phi lợi nhuận và cơ quan nhà nước cũng vậy. Dùng cho doanh nghiệp đi qua EmberNet, nơi đăng ký miễn phí và dùng cho doanh nghiệp cũng miễn phí. Việc lưu trữ như một dịch vụ cho người khác, bán lại và nhúng vào sản phẩm bạn bán không được cấp phép. Tệp `LICENSE` là văn bản pháp lý và thắng mọi tranh cãi với đoạn này.
