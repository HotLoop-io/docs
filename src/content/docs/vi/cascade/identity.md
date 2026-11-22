---
title: "Danh tính và truy cập"
description: "Vai trò tùy chỉnh, đăng nhập bằng LDAP, Active Directory và SAML, cấp phát tài khoản bằng SCIM, có sẵn trong mọi Cascade và không có gói trả phí."
---

Ai được vào, và làm được gì sau khi vào. Cascade trao tất cả những điều này cho mọi người. Không mục nào ở đây là gói trả phí và không có bước kiểm tra giấy phép nào phía sau.

Mọi endpoint bên dưới đều có trong tài liệu OpenAPI tại `/api/v1/openapi.json`, và mỗi endpoint đều có một bài kiểm thử gọi đến nó.

## Vai trò tùy chỉnh

Trong trình chỉnh sửa: Cài đặt, Vai trò. Ai cũng đọc được các vai trò; chủ sở hữu hoặc quản trị viên tạo, đổi và xóa vai trò tùy chỉnh, rồi gán cho mọi người trong dự án ngay trên cùng màn hình.

Một dự án có bốn vai trò dựng sẵn: admin, editor, operator và viewer. Chúng nằm trong mã và không bao giờ thay đổi. Khi không vai trò nào vừa vặn, hãy tạo vai trò tùy chỉnh: một tên và một danh sách quyền của dự án.

Lý do thường gặp là một trưởng chuyền cần khởi chạy các quy trình của chuyền và đọc các lần chạy của chúng, nhưng không được sửa gì cả:

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

Sau đó đưa một người vào dự án với vai trò đó, bằng cùng lệnh gọi như với vai trò dựng sẵn:

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

Cần biết:

- `GET /api/v1/permissions` liệt kê mọi quyền mà một vai trò có thể mang, còn `GET /api/v1/roles` liệt kê bốn vai trò dựng sẵn và các vai trò tùy chỉnh cùng những gì mỗi vai trò làm được. Bất kỳ ai đã đăng nhập đều đọc được cả hai, vì quản trị viên dự án cần chúng để chọn vai trò.
- Tạo, đổi và xóa vai trò tùy chỉnh là việc của chủ sở hữu hoặc quản trị viên phiên bản, tức quyền `role.manage`. Quản trị viên dự án có thể trao một vai trò cho mọi người trong dự án của mình nhưng không thể viết vai trò mới, nên không ai tự cấp cho mình nhiều hơn những gì đã được cấp.
- Một vai trò chỉ mang quyền của dự án. Nó không thể mang `user.manage`, `audit.read` hay bất kỳ quyền nào của phiên bản, và yêu cầu một quyền như vậy sẽ nhận lỗi 400.
- Tên gồm 2 đến 40 chữ thường, chữ số và dấu gạch ngang, bắt đầu bằng một chữ cái. Không thể đổi sau đó, vì các thành viên và tài khoản dịch vụ giữ vai trò theo tên. Bốn tên dựng sẵn đã bị chiếm.
- Đổi quyền của một vai trò có hiệu lực với mọi người đang giữ vai trò đó ở yêu cầu kế tiếp của họ. Không có gì được lưu đệm, nên không có khoảng thời gian nào mà một quyền đã bị gỡ vẫn còn dùng được.
- Khóa của tài khoản dịch vụ có thể giữ một vai trò tùy chỉnh làm vai trò dự án của nó, và phạm vi của khóa API vẫn thu hẹp nó lại.
- Xóa một vai trò đang có người giữ sẽ bị từ chối bằng lỗi 409, nêu rõ có bao nhiêu thành viên và khóa tài khoản dịch vụ đang giữ. Hãy chuyển họ đi trước.
- Các thay đổi vai trò nằm trong nhật ký kiểm toán dưới dạng `role.created`, `role.updated` (kèm quyền trước và sau) và `role.deleted`.

## LDAP và Active Directory

Mọi người đăng nhập bằng tên và mật khẩu họ đã có ở nhà máy: OpenLDAP, 389 Directory Server, FreeIPA hoặc Active Directory. Nó chạy song song với các tài khoản cục bộ và OIDC, và tắt cho đến khi bạn đặt `HOTLOOP_CASCADE_LDAP_URL`.

Một lần đăng nhập diễn ra như sau:

1. Một tài khoản dịch vụ (hoặc tìm kiếm ẩn danh, nếu thư mục của bạn cho phép) tìm người đó bằng bộ lọc người dùng.
2. Nó tra các nhóm mà người đó thuộc về.
3. Chính thư mục kiểm tra mật khẩu, bằng cách bind với tư cách người đó. Cascade không bao giờ lưu mật khẩu đó và không bao giờ thấy mã băm của nó. Tài khoản tạo ở đây không có mật khẩu riêng, nên mật khẩu của thư mục không dùng được trên `/login` như mật khẩu cục bộ.
4. Tài khoản được tạo ở lần đăng nhập đầu tiên (trừ khi bạn tắt), và vai trò của nó đi theo nhóm ở mỗi lần đăng nhập sau đó.

Trang đăng nhập hiện thêm biểu mẫu thứ hai khi bật, và điều tương tự là một lệnh gọi, `POST /auth/ldap/login` với `{"username": "...", "password": "..."}`. Tên sai và mật khẩu sai nhận cùng một câu trả lời. Mật khẩu rỗng không bao giờ đến được thư mục, vì hầu hết thư mục trả về thành công cho một bind với mật khẩu rỗng.

### Cài đặt

Tất cả đều là biến môi trường. Với Helm chart, đặt chúng trong `env`, còn mật khẩu bind trong `extraEnv` lấy từ một secret.

| Biến | Chức năng |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` hoặc `ldaps://host:636`. Bật tính năng này. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap` (mặc định) hoặc `ad`. Chỉ chọn các giá trị mặc định bên dưới. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` nâng kết nối `ldap://` lên mã hóa trước khi gửi bất cứ thứ gì. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | Tệp PEM của các tổ chức được tin cậy cho chứng chỉ của thư mục. Để trống nghĩa là dùng của hệ thống. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | Tên mà chứng chỉ phải được cấp cho, khi nó không phải máy chủ trong URL. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | Tài khoản dịch vụ tra cứu mọi người. Để trống là tìm kiếm ẩn danh. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` hoặc `_FILE` | Mật khẩu của nó, hoặc tệp chứa mật khẩu. Không dùng cả hai. DN không có mật khẩu bị từ chối, vì đó sẽ là bind ẩn danh. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | Bắt buộc. DN dùng làm gốc để tìm mọi người. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | Tìm một người. `{username}` là điều họ đã gõ, đã được escape. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | DN dùng làm gốc để tìm các nhóm. Để trống nghĩa là không tra nhóm. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | Tìm các nhóm của một người. `{dn}` là DN của họ, `{username}` là điều họ đã gõ. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | Các thuộc tính cho ID ổn định, email và tên hiển thị. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | Các cặp `group=role`, cách nhau bằng dấu phẩy: `supervisors=admin, operators=member`. Một nhóm được gọi bằng `cn` hoặc bằng DN đầy đủ. Vai trò mạnh nhất trong các nhóm của một người sẽ thắng. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin` hoặc `none`. Khi có ánh xạ vai trò, mặc định là `none`, nên người không thuộc nhóm nào được ánh xạ sẽ bị từ chối. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` chỉ tạo tài khoản bằng tay. Mặc định `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | Tên mà nút đăng nhập gọi nó. |

Các giá trị mặc định của `ldap`: bộ lọc người dùng `(&(objectClass=inetOrgPerson)(uid={username}))`, bộ lọc nhóm `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, ID `entryUUID`, email `mail`, tên `cn`.

Các giá trị mặc định của `ad`: người dùng được tìm theo `sAMAccountName` hoặc theo tên chính của người dùng, nên cả `alice` lẫn `alice@plant.example` đều dùng được, và tài khoản bị vô hiệu hóa bị loại khỏi tìm kiếm. Các nhóm dùng quy tắc thành viên lồng nhau (`member:1.2.840.113556.1.4.1941:={dn}`), nên người ở trong một nhóm nằm bên trong nhóm được ánh xạ cũng nhận vai trò. ID là `objectGUID`, viết dưới dạng GUID, email `mail`, tên `displayName`.

### Cần biết

- **Active Directory yêu cầu mã hóa.** Nó từ chối bind đơn giản trên kết nối không mã hóa. Dùng `ldaps://`, hoặc `ldap://` với `START_TLS=true`. Cascade kiểm tra chứng chỉ theo tệp CA (hoặc các gốc của hệ thống) và theo tên máy chủ, và không có cài đặt nào bỏ qua bước kiểm tra. Thư mục tự ký chứng chỉ của mình cần CA của nó trong `CA_FILE`.
- **Tài khoản gắn với ID của thư mục, không phải với tên.** Đổi tên ai đó trong thư mục, hoặc chuyển họ sang OU khác, thì ở đây vẫn là cùng một tài khoản. Người không có `mail` không thể có tài khoản (màn hình đăng nhập sẽ nói vậy).
- **Thư mục là nguồn xác thực cho địa chỉ.** Tài khoản đã có sẵn ở đây với cùng email sẽ được liên kết với mục trong thư mục vào lần đầu người đó đăng nhập, không cần xác minh thêm, giống như một địa chỉ OIDC đã được xác minh. Đừng trỏ nó vào thư mục mà bạn không vận hành.
- **Tài khoản đầu tiên của một phiên bản là chủ sở hữu**, dù được tạo bằng cách nào. Hãy tạo chủ sở hữu trước bằng bước thiết lập.
- **Yếu tố thứ hai đã thiết lập ở đây vẫn được tính.** Mật khẩu thư mục là một yếu tố. Ai có ứng dụng xác thực hoặc passkey trên tài khoản sẽ được hỏi sau đó, và yêu cầu bắt buộc MFA trên toàn phiên bản áp dụng như với mọi người.
- **Mật khẩu sai cũng khóa tài khoản ở đây.** Năm lần liên tiếp trên tài khoản đã gắn với thư mục sẽ khóa nó một phút, gấp đôi dần, giống tài khoản cục bộ, trước khi cơ chế khóa của chính thư mục phải vào cuộc. Người mà thư mục không biết, mật khẩu sai và tài khoản bị khóa đều nằm trong nhật ký kiểm toán dưới dạng `auth.login_failed` hoặc `auth.login_refused`, còn người mà thư mục cho qua nhưng Cascade từ chối (không có nhóm, không có email, JIT tắt) là `auth.sso_refused`.
- **Thư mục ngừng hoạt động là lỗi máy chủ, không phải mật khẩu sai.** Màn hình đăng nhập báo thư mục không phản hồi, và chi tiết nằm trong nhật ký.
- Mỗi lệnh gọi đến thư mục bị giới hạn mười lăm giây, và chỉ một người được khớp với bộ lọc người dùng: hai kết quả khớp là một lời từ chối nêu rõ vấn đề, không bao giờ chọn kết quả đầu tiên.

## SAML

Đăng nhập một lần qua bất kỳ nhà cung cấp danh tính SAML 2.0 nào. Cascade là nhà cung cấp dịch vụ. Nó chạy song song với tài khoản cục bộ, OIDC và LDAP, và tắt cho đến khi bạn nêu siêu dữ liệu của nhà cung cấp.

Các bước:

1. Cascade công bố siêu dữ liệu của chính nó tại `/auth/saml/metadata`. Đưa nó cho nhà cung cấp, hoặc nhập hai giá trị mà nó chứa: ID thực thể và assertion consumer service, `<public url>/auth/saml/acs`, liên kết HTTP-POST.
2. Đặt `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` thành địa chỉ siêu dữ liệu của nhà cung cấp (kiểu như `https://sso.plant.example/saml/metadata`), hoặc `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` thành chính tài liệu đó đã lưu trên đĩa.
3. Trang đăng nhập hiện nút "Đăng nhập bằng". Nút này đi tới `/auth/saml/start`.

Nó kiểm tra gì khi quay về: chữ ký của phản hồi theo chứng chỉ của nhà cung cấp trong siêu dữ liệu, đối tượng nhận, khung thời gian, rằng nó trả lời một yêu cầu do chính trình duyệt này bắt đầu, và rằng lần đăng nhập được bắt đầu trong trình duyệt này. Phản hồi không ai yêu cầu (đăng nhập bắt đầu từ phía nhà cung cấp) bị từ chối. Trạng thái của mỗi lần đăng nhập chỉ dùng được một lần, nên phản hồi bị chặn bắt không thể phát lại.

| Biến | Chức năng |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` hoặc `_FILE` | Siêu dữ liệu của nhà cung cấp. Một trong hai sẽ bật SAML; không dùng cả hai. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | Cách phiên bản này tự xưng với nhà cung cấp. Mặc định: URL siêu dữ liệu của nó. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` và `_CERT_FILE` | Cặp khóa của phiên bản này, PEM, RSA hoặc EC. Cả hai hoặc không cái nào. Mặc định: một cặp được tạo ở lần khởi động đầu tiên với tên `saml-sp.key` và `saml-sp.crt` trong thư mục dữ liệu, và được giữ lại. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` ký mọi yêu cầu Cascade gửi đi. Phải báo chứng chỉ cho nhà cung cấp. Mặc định `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Cascade yêu cầu nhà cung cấp nhận diện mọi người bằng gì: `persistent` (mặc định), `email` hoặc `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | Một thuộc tính nhận diện người dùng thay cho NameID. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | Các thuộc tính nào chứa email, tên hiển thị và các nhóm. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | Giống như với LDAP: các cặp nhóm với vai trò, vai trò cho người không thuộc nhóm nào, có tạo tài khoản ở lần đăng nhập đầu hay không, và tên của nút. |

Nếu không có cài đặt thuộc tính, Cascade tìm các tên thông dụng. Email là `email`, `mail`, `emailAddress`, ID đối tượng LDAP `urn:oid:0.9.2342.19200300.100.1.3` hoặc URI claim `.../claims/emailaddress`, và quay về NameID khi đó là một địa chỉ. Tên là `displayName`, `name`, hoặc tên và họ. Các nhóm là `groups`, `group`, `memberOf`, URI `.../claims/Group` và claim nhóm của Microsoft.

Cần biết:

- **Hãy yêu cầu ID bền vững.** Tài khoản gắn với NameID, và ID tạm thời khác nhau ở mỗi lần đăng nhập. Cascade yêu cầu ID bền vững và từ chối ID tạm thời kèm một thông báo nói rõ như vậy, thay vì tạo tài khoản mới ở mỗi lần đăng nhập. Nếu nhà cung cấp chỉ gửi được ID tạm thời, hãy nêu trong `SUBJECT_ATTR` một thuộc tính ổn định.
- **Nhà cung cấp là nguồn xác thực cho địa chỉ.** Giống LDAP, tài khoản đã có với cùng email được liên kết ở lần đăng nhập SAML đầu tiên.
- **Phía sau proxy, đặt `HOTLOOP_CASCADE_PUBLIC_URL` thành địa chỉ mọi người dùng.** Nhà cung cấp gửi POST đến URL assertion consumer được dựng từ nó.
- **Dùng HTTPS.** Nhà cung cấp trả lời bằng POST từ một trang khác, nên cookie gắn lần đăng nhập với trình duyệt của nó phải được gửi chéo trang, điều mà trình duyệt chỉ cho phép trên kết nối an toàn.
- **Có nhiều hơn một pod** thì cần cùng một cặp khóa trên tất cả: đặt nó trong một secret và nêu bằng `KEY_FILE` và `CERT_FILE`, nếu không mỗi pod sẽ tự tạo cặp riêng.
- Yếu tố thứ hai đã thiết lập ở đây vẫn được tính sau khi đăng nhập SAML, và SAML không bao giờ khiến xác thực đa yếu tố của chính nhà cung cấp được tính thay.
- Đăng xuất một lần không được hỗ trợ. Đăng xuất chỉ kết thúc phiên ở đây.

## SCIM

Trong trình chỉnh sửa: Cài đặt, Đăng nhập và SCIM cho biết SCIM có bật không, URL gốc để đưa cho nhà cung cấp, và các token, kèm nút tạo một token (chỉ hiện một lần) và nút thu hồi. LDAP, SAML và OpenID Connect được đặt trong môi trường của phiên bản khi khởi động, nên cùng màn hình đó cho biết cái nào đang bật và nhà cung cấp trỏ đến đâu (các URL siêu dữ liệu và ACS của SAML), và không giả vờ thay đổi chúng.

SCIM là cách một nhà cung cấp danh tính giữ các tài khoản đồng bộ với thư mục của nó: tạo một người khi họ vào, đổi khi họ chuyển, tắt khi họ rời đi, và giữ các nhóm. Cascade là máy chủ SCIM (RFC 7643 và 7644, phiên bản 2.0), còn nhà cung cấp là máy khách. Nó được xây theo những gì RFC nói và những gì các nhà cung cấp danh tính phổ biến gửi, và được thử trong mỗi bản phát hành bằng scim2-tester, một máy khách SCIM của đội khác chạy mọi bước kiểm tra mà nó có. Nó tắt cho đến khi bạn đặt `HOTLOOP_CASCADE_SCIM=true`.

Cách thiết lập:

1. Bật bằng `HOTLOOP_CASCADE_SCIM=true` rồi khởi động lại.
2. Tạo một token cho nhà cung cấp, với tư cách chủ sở hữu hoặc quản trị viên phiên bản: `POST /api/v1/scim-tokens` với `{"name": "plant directory"}`. `secret` trong câu trả lời (bắt đầu bằng `hlcs_`) chỉ hiện một lần, nên hãy nhập nó vào nhà cung cấp ngay. `GET /api/v1/scim-tokens` liệt kê chúng cùng lần dùng gần nhất của từng token, và `DELETE /api/v1/scim-tokens/{token}` thu hồi một token. Phải có người đăng nhập mới tạo được token: khóa API thì không, nên một khóa bị lộ không thể tạo thêm.
3. Đưa cho nhà cung cấp URL gốc, `<public url>/scim/v2`, và token làm bearer token.

Mọi lệnh gọi đều cần token, và mọi câu trả lời là `application/scim+json`. Các lệnh gọi nằm trong nhật ký kiểm toán với tên token là tác nhân, nên `user.created`, `user.disabled` và các mục khác cho biết nhà cung cấp nào đã làm, cùng với các sự kiện SCIM `scim.user_deleted`, `scim.group_created`, `scim.group_updated` và `scim.group_deleted`.

### Những gì nó cung cấp

`/ServiceProviderConfig`, `/ResourceTypes` và `/Schemas` cho biết điều gì được hỗ trợ, và chỉ nói điều đúng: lọc, PATCH, không có bulk, không sắp xếp, không có ETag, không đổi mật khẩu.

| Tài nguyên | Lệnh gọi |
|---|---|
| `/Users` | `GET` (danh sách, với `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes`), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | tương tự |
| `/.search`, `/Users/.search`, `/Groups/.search` | `POST` với truy vấn trong phần thân |

- **Một người dùng** gồm `userName`, `externalId`, `name` (`formatted`, `givenName`, `familyName`), `displayName`, `emails` và `active`. Email của tài khoản là email chính, nếu không thì email công việc, nếu không thì email đầu tiên, nếu không thì `userName` khi đó là một địa chỉ. Bất cứ thứ gì không có địa chỉ đều là lỗi 400. Những gì nhà cung cấp gửi được trả lại đúng như đã gửi: một cái tên họ không gửi sẽ không bị bịa ra. `groups` trả về ở dạng chỉ đọc.
- **Một nhóm** gồm `displayName`, `externalId` và `members`, mỗi thành viên là ID của một người dùng. Thành viên không phải người dùng là lỗi 400.
- **Bộ lọc** có cú pháp đầy đủ: `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, dấu ngoặc và `attr[filter]`. So khớp không phân biệt hoa thường, trừ `id` và `externalId`. Bộ lọc sai là lỗi 400 với `scimType: invalidFilter`.
- **PATCH** nhận `add`, `replace` và `remove` có hoặc không có đường dẫn, với các đường dẫn giá trị như `emails[type eq "work"].value` và `members[value eq "id"]`, ở bất kỳ kiểu viết hoa nào, và giá trị boolean ở dạng `true` hoặc chuỗi `"False"` mà một số nhà cung cấp gửi. Nó đổi đúng những gì một PUT có thể đổi.
- **Danh sách** theo thứ tự các tài khoản được tạo, 100 mỗi trang trừ khi `count` nói khác, tối đa 200.

### Những gì nó sẽ không làm

- **Nó không bao giờ hiển thị hay thay đổi chủ sở hữu.** Chủ sở hữu phiên bản không có trong danh sách, không thể lấy, vá hay xóa, và không thể đưa vào nhóm. Một email thuộc về chủ sở hữu là một xung đột.
- **Nó không bao giờ xóa tài khoản.** `DELETE` tắt người đó, việc này kết thúc các phiên của họ, đưa họ ra khỏi các nhóm và ẩn họ khỏi SCIM. Mọi thứ họ đã tạo và mọi dòng kiểm toán đều được giữ lại. Nếu nhà cung cấp tạo lại họ với cùng địa chỉ, cùng tài khoản đó trở lại, ở trạng thái bật. `active: false` tắt mà không ẩn.
- **Tài khoản SCIM không có mật khẩu.** Nó đăng nhập qua OIDC, SAML hoặc LDAP, những phương thức liên kết với nó theo địa chỉ.
- **Nó không động đến các dự án.** SCIM làm việc với tài khoản và vai trò của phiên bản. Ai ở dự án nào vẫn do bên này quyết định.

### Vai trò từ các nhóm

Theo mặc định, tài khoản mới là thành viên và SCIM không bao giờ đổi vai trò của ai. Để các nhóm quyết định, hãy ánh xạ tên nhóm với vai trò:

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

Khi đó vai trò của một người đi theo các nhóm của họ mỗi lần tư cách thành viên thay đổi: vai trò được ánh xạ mạnh nhất sẽ thắng, và người không thuộc nhóm nào nhận giá trị mặc định. Chỉ `admin` và `member` mới ánh xạ được, vì nhà cung cấp không bao giờ tạo chủ sở hữu. Hãy dùng một nguồn vai trò duy nhất. Nếu OIDC hoặc SAML cũng ánh xạ nhóm với vai trò, bên nào đổi vai trò của một người sau cùng sẽ thắng, và hai bên sẽ giành nhau.

Nhà cung cấp cần cùng các tên nhóm đó, và phải đẩy các nhóm kèm thành viên của chúng, điều mà mọi nhà cung cấp hỗ trợ nhóm SCIM đều làm được.
