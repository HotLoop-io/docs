---
title: "Chạy Cascade"
description: "Chạy Cascade bằng Podman Quadlet hoặc Helm trên k3s, trên SQLite hoặc Postgres, với phép kiểm tra tình trạng mà các unit và probe của chart dùng."
---

Trên máy chủ Podman, `deploy/quadlet` có các unit systemd. Một tệp và một volume là Cascade trên SQLite; `deploy/quadlet/postgres` là máy chủ, một worker và PostgreSQL trên một mạng riêng. Cả hai đều khởi động cùng hệ thống, tự khởi động lại khi lỗi và chạy ở chế độ chỉ đọc, không dùng root, với mọi capability bị gỡ bỏ. README của nó hướng dẫn từng bước.

Để tải một phiên bản bằng tay:

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:1.5.1
```

Các unit theo `:stable` và bộ hẹn giờ tự động cập nhật của Podman sẽ cập nhật chúng.

Trên k3s, `charts/hotloop-cascade` là Helm chart:

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version 1.5.1
```

Chart mang các nhãn mà bảng điều khiển EmberNet đọc, trên Service và trên các pod phục vụ trình soạn thảo, nên một Cascade triển khai từ App Store hiện trong Running Apps cùng nút LAUNCH. `gui.appName`, `gui.port` và `gui.displayName` thay đổi những gì nó hiển thị.

Đó là một pod trên SQLite với một volume. `--set split=true` cùng PostgreSQL (`--set postgresql.enabled=true` cho PostgreSQL do chart chạy, hoặc `externalDatabase.existingSecret` cho PostgreSQL của bạn) sẽ tách nó thành các pod API, webhook và worker mà bạn mở rộng riêng từng loại. Khóa niêm phong các thông tin đăng nhập đã lưu được tạo ở lần cài đặt đầu tiên và được giữ lại khi gỡ release, vì một khóa đi cùng release sẽ cuốn theo mọi thông tin đăng nhập trong cơ sở dữ liệu được giữ lại. Hãy sao lưu nó.

`hotloop-cascade healthcheck` hỏi chính endpoint tình trạng của máy chủ đang chạy rồi thoát với mã 0 hoặc 1. Cả unit Quadlet lẫn probe của chart đều dùng các endpoint nằm phía sau nó.
