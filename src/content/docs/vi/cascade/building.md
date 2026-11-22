---
title: "Xây dựng Cascade"
description: "Xây dựng tệp nhị phân và image của Cascade, rồi chọn cơ sở dữ liệu mà Cascade chạy trên đó."
---

Bạn cần Go và Podman. `make build` xây dựng tệp nhị phân của Cascade, còn `make image` xây dựng image container bằng Podman, với trình soạn thảo được tích hợp sẵn trong tệp nhị phân nên không cần cài thêm gì bên cạnh.

Cơ sở dữ liệu là một cài đặt. `HOTLOOP_CASCADE_DATABASE` là `sqlite:<path>` (mặc định, nằm trong `HOTLOOP_CASCADE_DATA_DIR`) hoặc một URL `postgres://`.

Không dùng Docker và không dùng Compose. Cascade được phát hành cho Podman (kèm Quadlet) và cho k3s (kèm Helm).