---
title: "Ghi chú phát hành: HotLoop Cascade 0.1.1"
description: "HotLoop Cascade 0.1.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "0.1.1"
---

## Đây là gì

0.1.1 là bản phát hành đầu tiên không phải bản ứng viên. Từng có thẻ 0.1.0 nhưng chưa bao giờ phát hành gì: nó bị hủy trước khi có gì đến được registry. Một thẻ thì đứng yên tại chỗ, nên đây là cùng một mã nguồn, giờ đã được phát hành.

Nó là gì: công cụ quy trình mà chúng tôi muốn có cho nhà máy. Một tệp nhị phân Go tĩnh duy nhất, SQLite trên một máy hoặc Postgres với worker khi cần nhiều hơn, và trình soạn thảo được tích hợp ngay trong tệp nhị phân, nên không có gì khác để chạy.

## Có gì trong đó

Công cụ này lưu từng bước thành một điểm kiểm tra, nên `kill -9` giữa chừng một lần chạy sẽ tiếp tục đúng chỗ nó dừng. Chờ bền vững, thử lại, cổng lỗi và quy trình xử lý lỗi. Biểu thức, và một bước Code chạy JavaScript cô lập trong một tiến trình riêng.

Webhook với hộp thư đến bền vững, lịch chạy đúng một lần mỗi khung giờ bất kể có bao nhiêu nút chính cùng theo dõi, MQTT và một trigger cho tệp xuất hiện trong thư mục. Một bước HTTP cho mọi thứ có API, và các trình kết nối cho HotLoop, Postgres, EmberOps, email, ntfy, Gotify và Discord. Không có cái nào khác, có chủ ý.

Một kho thông tin đăng nhập có xoay vòng khóa, OAuth2 cho mọi kiểu cấp quyền mà nhà máy cần, đăng nhập bằng mật khẩu, TOTP, passkey hoặc nhà cung cấp OpenID Connect của bạn, bắt buộc MFA, dự án và vai trò, nhật ký kiểm toán có thể xác minh, mỗi lần lưu đều giữ thành một phiên bản, và một API có phạm vi cùng tài liệu OpenAPI. Số liệu, dấu vết và probe, để ai đó ngoài tôi cũng biết khi nào có chỗ bị kẹt.

## Cách chạy

Image có cho amd64 và arm64. Hãy kéo nó theo digest ở trên nếu bạn muốn một bản triển khai không thể bị dịch chuyển.

Trên k3s: Helm chart, chạy độc lập hoặc tách thành server và worker.

Trên một máy thông thường: các unit Quadlet trong `deploy/quadlet`, SQLite trên một máy hoặc Postgres với worker bổ sung. Chúng theo `:stable`, và bộ hẹn giờ tự cập nhật của Podman sẽ di chuyển chúng. Bản cập nhật không lên khỏe sẽ quay về image đang chạy. Chúng tôi đã chạy thật cả hai kiểu, trên Podman 5.8.7 dưới systemd: khởi động chờ đến khi khỏe, container bị kill sẽ trở lại, bản cập nhật tốt được áp dụng, bản xấu bị hoàn lại, và sau mỗi lần một quy trình chạy được.

## Những điều cần biết

Migration chỉ đi tiến. Rollback đặt lại image cũ, chứ không hoàn tác migration của cơ sở dữ liệu, nên hãy sao lưu trước khi bật cập nhật.

Registry ở bản này là riêng tư, nên trước hết cần `podman login ghcr.io` bằng root. Image và chart công khai từ 0.1.2 trở đi và kéo về không cần đăng nhập.

Nếu mất khóa dùng để niêm phong thông tin đăng nhập đã lưu, mọi thông tin đăng nhập đã lưu đều không đọc được. Hãy giữ một bản sao ở nơi không phải chính máy đó.

## Giấy phép

Cascade dùng Business Source License 1.1 (`BUSL-1.1`) của HotLoop, giống phần còn lại của dòng sản phẩm HotLoop. Nó không phải mã nguồn mở và tôi sẽ không giả vờ như vậy. Mỗi phiên bản trở thành GPL-3.0 trở lên bốn năm sau lần đầu được công bố. Dùng tại nhà và trong phòng thí nghiệm là miễn phí, dùng trong sản xuất của trường học, tổ chức phi lợi nhuận và cơ quan nhà nước cũng vậy. Dùng cho doanh nghiệp đi qua EmberNet, nơi đăng ký miễn phí và dùng cho doanh nghiệp cũng miễn phí. Việc lưu trữ như một dịch vụ cho người khác, bán lại và nhúng vào sản phẩm bạn bán không được cấp phép. Tệp `LICENSE` là văn bản pháp lý và thắng mọi tranh cãi với đoạn này.

## Những gì chưa có

SAML, LDAP, SCIM, môi trường, bộ lập lịch HA dùng lease, thêm trình kết nối, bước AI. Những thứ đó thuộc 0.2.0 trở đi và đều nằm trong lộ trình.
