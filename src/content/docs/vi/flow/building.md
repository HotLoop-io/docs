---
title: "Biên dịch Flow từ mã nguồn"
description: "Biên dịch tệp nhị phân của Flow từ mã nguồn: một tệp nhị phân tĩnh có sẵn trình soạn thảo bên trong, không có thư viện C bên dưới."
---

HotLoop Flow là một tệp nhị phân tĩnh có sẵn trình soạn thảo bên trong, nên hầu hết mọi người tải image đã phát hành và không bao giờ phải biên dịch gì. Nếu muốn bản biên dịch của riêng mình, mã nguồn là công khai, và việc biên dịch cần Go và Node.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

Kết quả là tĩnh, không có thư viện C bên dưới, nên chạy được trên image distroless không cài thêm gì khác. Mỗi bản phát hành Flow được biên dịch từ một thẻ phiên bản và không từ thứ gì khác, nên image trong nhà máy của bạn luôn là image bạn có thể gọi tên và truy ngược về một bản phát hành.