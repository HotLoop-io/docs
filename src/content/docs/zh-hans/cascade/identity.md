---
title: "身份与访问"
description: "自定义角色，LDAP、Active Directory 和 SAML 登录，以及 SCIM 账号同步，每个 Cascade 都内置，没有任何付费层级。"
---

谁能进来，进来之后能做什么。Cascade 把这一切提供给所有人。这里没有任何付费层级，背后也没有许可证检查。

下面的每个端点都在 `/api/v1/openapi.json` 的 OpenAPI 文档里，每个端点都有一个调用它的测试。

## 自定义角色

在编辑器里：设置，角色。所有人都能读取角色；所有者或管理员创建、修改和删除自定义角色，并在同一个界面里把角色分配给项目中的人。

每个项目有四个内置角色：admin、editor、operator 和 viewer。它们写在代码里，永远不会变。当没有一个合适时，就创建自定义角色：一个名称和一份项目权限列表。

常见的理由是，产线负责人需要能启动产线的工作流并查看其运行记录，但不能编辑任何内容：

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

然后用与内置角色相同的调用，把某人以该角色加入项目：

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

需要了解：

- `GET /api/v1/permissions` 列出角色可以携带的每一项权限，`GET /api/v1/roles` 列出四个内置角色和自定义角色，以及各自能做什么。任何已登录的人都能读取这两个接口，因为项目管理员需要它们来选择角色。
- 创建、修改和删除自定义角色是实例所有者或管理员的事，即 `role.manage` 权限。项目管理员可以把角色授予自己项目中的人，但不能新建角色，因此没有人能给自己超出所获授权的权限。
- 角色只携带项目权限。它不能携带 `user.manage`、`audit.read` 或任何其他实例权限，请求这类权限会返回 400。
- 名称由 2 到 40 个小写字母、数字和连字符组成，以字母开头。之后不能更改，因为成员和服务账号是按名称持有角色的。四个内置名称已被占用。
- 更改角色的权限，会在所有持有该角色的人下一次请求时生效。没有任何缓存，所以不存在被移除的权限仍然可用的时间窗口。
- 服务账号密钥可以把自定义角色作为它的项目角色，API 密钥的范围仍会进一步限制它。
- 删除仍有人持有的角色会被拒绝并返回 409，并说明有多少成员和服务账号密钥持有它。请先把他们转走。
- 角色的变更会以 `role.created`、`role.updated`（含变更前后的权限）和 `role.deleted` 记入审计日志。

## LDAP 和 Active Directory

人们用在工厂里已有的用户名和密码登录：OpenLDAP、389 Directory Server、FreeIPA 或 Active Directory。它与本地账号和 OIDC 并存，在你设置 `HOTLOOP_CASCADE_LDAP_URL` 之前保持关闭。

一次登录的过程如下：

1. 一个服务账号（如果目录允许，也可以是匿名搜索）用用户过滤器找到这个人。
2. 它查出此人所属的组。
3. 由目录本身检查密码，方法是以此人的身份绑定。Cascade 从不保存这个密码，也从不见到它的哈希。这里创建的账号没有自己的密码，所以目录密码不能当作本地密码在 `/login` 上使用。
4. 账号在首次登录时创建（除非你关闭它），之后每次登录，其角色都会跟随其所在的组。

启用后，登录页会显示第二个表单，同样的事情也可以用一次调用完成，即带有 `{"username": "...", "password": "..."}` 的 `POST /auth/ldap/login`。用户名错误和密码错误得到相同的答复。空密码绝不会到达目录，因为大多数目录会对空密码的绑定回答成功。

### 设置

它们都是环境变量。使用 Helm Chart 时，把它们放在 `env` 里，绑定密码则从 Secret 放进 `extraEnv`。

| 变量 | 作用 |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` 或 `ldaps://host:636`。用它来启用。 |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap`（默认）或 `ad`。它只用来选择下面的默认值。 |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true` 会在发送任何内容之前，把 `ldap://` 连接升级为加密连接。 |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | 用于信任目录证书的认证机构 PEM 文件。留空表示使用系统的。 |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | 当证书的主机名不是 URL 中的主机时，证书必须对应的名称。 |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | 用来查找人员的服务账号。留空表示匿名搜索。 |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` 或 `_FILE` | 它的密码，或存放密码的文件。不能两者同时使用。没有密码的 DN 会被拒绝，因为那会变成匿名绑定。 |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | 必填。搜索人员所在的 DN。 |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | 查找一个人。`{username}` 是他们输入的内容，已做转义。 |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | 搜索组所在的 DN。留空表示不查找组。 |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | 查找一个人所属的组。`{dn}` 是此人的 DN，`{username}` 是他们输入的内容。 |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`、`_EMAIL_ATTR`、`_NAME_ATTR` | 稳定 ID、电子邮件和显示名称所用的属性。 |
| `HOTLOOP_CASCADE_LDAP_ROLES` | 以逗号分隔的 `group=role` 对：`supervisors=admin, operators=member`。组用其 `cn` 或完整 DN 命名。一个人所在各组中最强的角色生效。 |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`、`admin` 或 `none`。有角色映射时默认是 `none`，因此不在任何已映射组中的人会被拒绝。 |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false` 表示只手动创建账号。默认 `true`。 |
| `HOTLOOP_CASCADE_LDAP_NAME` | 登录按钮对它的称呼。 |

`ldap` 的默认值：用户过滤器 `(&(objectClass=inetOrgPerson)(uid={username}))`，组过滤器 `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`，ID `entryUUID`，电子邮件 `mail`，名称 `cn`。

`ad` 的默认值：用户通过 `sAMAccountName` 或用户主体名称查找，所以 `alice` 和 `alice@plant.example` 都可以，已禁用的账号会被排除在搜索之外。组使用嵌套成员规则（`member:1.2.840.113556.1.4.1941:={dn}`），所以处于某个已映射组内部的组中的人，也会得到该角色。ID 是 `objectGUID`，写成 GUID，电子邮件 `mail`，名称 `displayName`。

### 需要了解

- **Active Directory 要求加密。** 它会拒绝未加密连接上的简单绑定。请使用 `ldaps://`，或带 `START_TLS=true` 的 `ldap://`。Cascade 会对照 CA 文件（或系统根证书）和服务器名称检查证书，没有任何设置可以跳过这项检查。自行签发证书的目录，需要把它的 CA 放进 `CA_FILE`。
- **账号绑定的是目录的 ID，而不是名称。** 在目录中重命名某人，或把他们移到另一个 OU，在这里仍然是同一个账号。没有 `mail` 的人无法获得账号（登录时会提示）。
- **地址以目录为准。** 这里已经存在、电子邮件相同的账号，会在此人首次登录时与目录条目关联，不需要额外验证，与已验证的 OIDC 地址一样。不要把它指向不由你运维的目录。
- **实例的第一个账号就是它的所有者**，无论是怎样创建的。请先通过初始设置创建所有者。
- **在这里设置的第二重验证仍然有效。** 目录密码是一重验证。账号上有验证器应用或通行密钥的人，之后会被要求使用它，实例范围的 MFA 强制要求对他们与对所有人一样适用。
- **密码错误在这里同样会锁定账号。** 对已关联目录的账号，连续五次错误会把它锁定一分钟，并逐次加倍，与本地账号一样，这发生在目录自身的锁定生效之前。目录不认识的人、错误的密码和被锁定的账号，都会以 `auth.login_failed` 或 `auth.login_refused` 记入审计日志，而目录放行、Cascade 拒绝的人（没有组、没有电子邮件、JIT 关闭）记为 `auth.sso_refused`。
- **目录宕机是服务器错误，而不是密码错误。** 登录界面会提示目录没有应答，详细信息在日志里。
- 对目录的每次调用都限制在十五秒内，并且用户过滤器只能匹配一个人：匹配到两个人会被拒绝并指明问题，绝不会取第一个。

## SAML

通过任意 SAML 2.0 身份提供方实现单点登录。Cascade 是服务提供方。它与本地账号、OIDC 和 LDAP 并存，在你指明提供方的元数据之前保持关闭。

步骤：

1. Cascade 在 `/auth/saml/metadata` 发布自己的元数据。把它交给提供方，或填入其中的两个值：实体 ID 和 assertion consumer service，即 `<public url>/auth/saml/acs`，HTTP-POST 绑定。
2. 把 `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` 设为提供方的元数据地址（类似 `https://sso.plant.example/saml/metadata`），或把 `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE` 设为保存在磁盘上的同一份文档。
3. 登录页会显示“使用以下方式登录”按钮。它指向 `/auth/saml/start`。

返回时它会检查：响应的签名是否与提供方元数据中的证书相符、受众、时间窗口、它是否应答了这个浏览器发起的请求，以及登录是否在这个浏览器中发起。没有人请求的响应（在提供方一侧发起的登录）会被拒绝。每次登录的状态只能使用一次，所以截获的响应无法重放。

| 变量 | 作用 |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` 或 `_FILE` | 提供方的元数据。二者之一即可启用 SAML；不能同时使用。 |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | 此实例向提供方如何称呼自己。默认：它的元数据 URL。 |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` 和 `_CERT_FILE` | 此实例的密钥对，PEM、RSA 或 EC。要么都设，要么都不设。默认：首次启动时在数据目录中生成并保留的 `saml-sp.key` 和 `saml-sp.crt`。 |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true` 会对 Cascade 发送的每个请求签名。必须把证书告知提供方。默认 `false`。 |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Cascade 请求提供方用什么标识人员：`persistent`（默认）、`email` 或 `unspecified`。 |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | 用来代替 NameID 标识此人的属性。 |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`、`_NAME_ATTR`、`_GROUPS_ATTR` | 哪些属性存放电子邮件、显示名称和组。 |
| `HOTLOOP_CASCADE_SAML_ROLES`、`_DEFAULT_ROLE`、`_JIT`、`_NAME` | 与 LDAP 相同：组到角色的映射对、不在任何组中的人的角色、是否在首次登录时创建账号，以及按钮的名称。 |

没有属性设置时，Cascade 会查找常见的名称。电子邮件是 `email`、`mail`、`emailAddress`、LDAP 对象 ID `urn:oid:0.9.2342.19200300.100.1.3` 或声明 URI `.../claims/emailaddress`，当 NameID 是地址时则回退到 NameID。名称是 `displayName`、`name`，或名和姓。组是 `groups`、`group`、`memberOf`、URI `.../claims/Group` 和 Microsoft 的组声明。

需要了解：

- **请求持久 ID。** 账号绑定的是 NameID，而瞬时 ID 每次登录都不同。Cascade 请求持久 ID，并用一条说明原因的消息拒绝瞬时 ID，而不是每次登录都创建新账号。如果你的提供方只能发送瞬时 ID，请在 `SUBJECT_ATTR` 中指定一个稳定的属性。
- **地址以提供方为准。** 与 LDAP 一样，电子邮件相同的现有账号会在首次 SAML 登录时关联。
- **在代理后面，请把 `HOTLOOP_CASCADE_PUBLIC_URL` 设为人们使用的地址。** 提供方会向由它构建的 assertion consumer URL 发送 POST。
- **使用 HTTPS。** 提供方通过来自另一个站点的 POST 应答，所以把登录与其浏览器绑定的 Cookie 必须跨站发送，而浏览器只在安全连接上允许这样做。
- **多个 pod** 需要在所有 pod 上使用同一个密钥对：把它放进 Secret，并用 `KEY_FILE` 和 `CERT_FILE` 指定，否则每个 pod 都会生成自己的。
- 在这里设置的第二重验证在 SAML 登录之后仍然有效，SAML 绝不会把提供方自己的多因素验证算作它的。
- 不支持单点登出。登出只会结束这里的会话。

## SCIM

在编辑器里：设置，登录与 SCIM 会显示 SCIM 是否启用、要交给提供方的基础 URL，以及令牌，并带有创建令牌（只显示一次）和撤销令牌的按钮。LDAP、SAML 和 OpenID Connect 在实例启动时通过环境设置，所以同一个界面会显示哪些已启用、提供方指向哪里（SAML 的元数据和 ACS URL），而不会假装去修改它们。

SCIM 是身份提供方让账号与其目录保持同步的方式：有人加入时创建，有人调动时修改，有人离开时停用，并维护各个组。Cascade 是 SCIM 服务器（RFC 7643 和 7644，版本 2.0），提供方是客户端。它按 RFC 的规定以及常见身份提供方发送的内容来构建，并在每个版本中用 scim2-tester 进行测试，这是另一个团队开发的 SCIM 客户端，会运行它拥有的每一项检查。在你设置 `HOTLOOP_CASCADE_SCIM=true` 之前它保持关闭。

设置步骤：

1. 用 `HOTLOOP_CASCADE_SCIM=true` 启用它并重启。
2. 以实例所有者或管理员身份为提供方创建令牌：用 `{"name": "plant directory"}` 调用 `POST /api/v1/scim-tokens`。答复中的 `secret`（以 `hlcs_` 开头）只显示一次，所以请立即把它填入提供方。`GET /api/v1/scim-tokens` 列出各令牌及其上次使用时间，`DELETE /api/v1/scim-tokens/{token}` 撤销其中一个。创建令牌必须有人登录：API 密钥不行，所以泄露的密钥无法再创建更多令牌。
3. 把基础 URL `<public url>/scim/v2` 和作为 bearer 令牌的令牌交给提供方。

每次调用都需要令牌，每个答复都是 `application/scim+json`。这些调用以令牌名称为操作者记入审计日志，所以 `user.created`、`user.disabled` 等条目会说明是哪个提供方做的，同时还有 SCIM 事件 `scim.user_deleted`、`scim.group_created`、`scim.group_updated` 和 `scim.group_deleted`。

### 它提供什么

`/ServiceProviderConfig`、`/ResourceTypes` 和 `/Schemas` 说明支持什么，并且只说真实情况：支持过滤、PATCH，不支持 bulk、排序、ETag，也不支持修改密码。

| 资源 | 调用 |
|---|---|
| `/Users` | `GET`（列表，支持 `filter`、`startIndex`、`count`、`attributes`、`excludedAttributes`）、`POST`、`GET /{id}`、`PUT /{id}`、`PATCH /{id}`、`DELETE /{id}` |
| `/Groups` | 相同 |
| `/.search`、`/Users/.search`、`/Groups/.search` | 查询放在请求体中的 `POST` |

- **用户**由 `userName`、`externalId`、`name`（`formatted`、`givenName`、`familyName`）、`displayName`、`emails` 和 `active` 组成。账号的电子邮件是主要邮箱，没有则取工作邮箱，再没有则取第一个，再没有则在 `userName` 是地址时取它。没有地址的一律返回 400。提供方发送什么就原样返回什么：它没发送的名称不会被编造。`groups` 以只读方式返回。
- **组**由 `displayName`、`externalId` 和 `members` 组成，每个成员是一个用户的 ID。不是用户的成员返回 400。
- **过滤器**支持完整语法：`eq ne co sw ew gt ge lt le pr`、`and`、`or`、`not`、括号和 `attr[filter]`。匹配不区分大小写，`id` 和 `externalId` 除外。错误的过滤器返回 400，并带有 `scimType: invalidFilter`。
- **PATCH** 接受带路径或不带路径的 `add`、`replace` 和 `remove`，接受 `emails[type eq "work"].value` 和 `members[value eq "id"]` 这样的值路径，大小写不限，布尔值可以是 `true`，也可以是某些提供方发送的字符串 `"False"`。它修改的内容与 PUT 能修改的完全相同。
- **列表**按账号创建的顺序排列，除非 `count` 另有指定，每页 100 条，最多 200 条。

### 它不会做什么

- **它从不显示或修改所有者。** 实例所有者不在列表中，无法被获取、修补或删除，也不能放进组。属于所有者的电子邮件会产生冲突。
- **它从不删除账号。** `DELETE` 会停用此人，这会结束其会话，把他们移出所在的组，并对 SCIM 隐藏。他们创建的一切和每一行审计记录都会保留。如果提供方用相同的地址再次创建，同一个账号会回来，并处于启用状态。`active: false` 只停用而不隐藏。
- **SCIM 账号没有密码。** 它通过 OIDC、SAML 或 LDAP 登录，它们按地址与它关联。
- **它不碰项目。** SCIM 处理账号和实例角色。谁在哪个项目里，仍由这里决定。

### 由组决定角色

默认情况下，新账号是成员，SCIM 从不更改任何人的角色。要让组来决定，请把组名映射到角色：

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

此后，每次成员关系变化，一个人的角色都会跟随其所在的组：已映射的角色中最强的生效，不在任何组中的人则得到默认值。只能映射 `admin` 和 `member`，因为提供方从不创建所有者。请只使用一个角色来源。如果 OIDC 或 SAML 也把组映射到角色，谁最后更改了某人的角色，谁就生效，两者会互相争夺。

提供方需要相同的组名，并且必须把组连同其成员一起推送，任何支持 SCIM 组的提供方都能做到。
