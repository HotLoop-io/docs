---
title: "ID와 접근"
description: "사용자 지정 역할, LDAP, Active Directory, SAML 로그인, SCIM 프로비저닝까지 모든 Cascade에 유료 등급 없이 들어 있습니다."
---

누가 들어오고, 들어온 뒤 무엇을 할 수 있는지를 다룹니다. Cascade는 이 모든 것을 모든 사용자에게 제공합니다. 여기에 유료 등급은 없고 그 뒤에 라이선스 검사도 없습니다.

아래의 모든 엔드포인트는 `/api/v1/openapi.json`의 OpenAPI 문서에 있고, 각각을 호출하는 테스트가 있습니다.

## 사용자 지정 역할

편집기에서 설정, 역할로 갑니다. 누구나 역할을 읽을 수 있고, 소유자나 관리자가 사용자 지정 역할을 만들고 바꾸고 삭제하며, 같은 화면에서 프로젝트 구성원에게 부여합니다.

프로젝트에는 admin, editor, operator, viewer의 네 가지 기본 제공 역할이 있습니다. 이 역할은 코드에 들어 있고 바뀌지 않습니다. 어느 것도 맞지 않을 때는 이름과 프로젝트 권한 목록으로 사용자 지정 역할을 만드세요.

가장 흔한 이유는 라인 책임자가 라인의 워크플로를 시작하고 실행 기록을 읽을 수 있지만 아무것도 편집할 수 없게 하려는 경우입니다.

```sh
curl -X POST $CASCADE/api/v1/roles -H "Authorization: Bearer $KEY" \
  -d '{"name":"line-lead","description":"runs the line","permissions":["project.read","workflow.read","workflow.execute","execution.read"]}'
```

그런 다음 기본 제공 역할과 같은 호출로 그 역할을 가진 사람을 프로젝트에 넣습니다.

```sh
curl -X PUT $CASCADE/api/v1/projects/$PROJECT/members/$USER -d '{"role":"line-lead"}'
```

알아 두어야 할 점입니다.

- `GET /api/v1/permissions`는 역할이 가질 수 있는 모든 권한을 나열하고, `GET /api/v1/roles`는 기본 제공 역할 네 가지와 사용자 지정 역할을 각각 할 수 있는 일과 함께 나열합니다. 프로젝트 관리자가 역할을 고르려면 둘 다 필요하므로 로그인한 사람은 누구나 읽을 수 있습니다.
- 사용자 지정 역할을 만들고 바꾸고 삭제하는 일은 인스턴스 소유자나 관리자의 몫이며, `role.manage` 권한입니다. 프로젝트 관리자는 자기 프로젝트 구성원에게 역할을 줄 수는 있어도 새 역할을 만들 수는 없으므로, 아무도 받은 것보다 많은 권한을 스스로에게 줄 수 없습니다.
- 역할은 프로젝트 권한만 가질 수 있습니다. `user.manage`, `audit.read` 같은 인스턴스 권한은 가질 수 없으며, 요청하면 400이 반환됩니다.
- 이름은 소문자, 숫자, 대시로 2자에서 40자이고 문자로 시작합니다. 구성원과 서비스 계정이 이름으로 역할을 가지므로 나중에 바꿀 수 없습니다. 기본 제공 이름 네 개는 이미 쓰고 있습니다.
- 역할의 권한을 바꾸면 그 역할을 가진 모든 사람에게 다음 요청부터 적용됩니다. 캐시가 없으므로 제거된 권한이 계속 작동하는 구간은 없습니다.
- 서비스 계정 키는 사용자 지정 역할을 프로젝트 역할로 가질 수 있고, API 키의 스코프가 여전히 그 범위를 줄입니다.
- 누군가 가지고 있는 역할을 삭제하면 409로 거부되며, 그 역할을 가진 구성원과 서비스 계정 키의 수가 함께 표시됩니다. 먼저 그들을 옮기세요.
- 역할 변경은 감사 로그에 `role.created`, `role.updated`(변경 전후의 권한 포함), `role.deleted`로 남습니다.

## LDAP와 Active Directory

사람들이 공장에서 이미 쓰는 이름과 비밀번호로 로그인합니다. OpenLDAP, 389 Directory Server, FreeIPA, Active Directory를 지원합니다. 로컬 계정 및 OIDC와 나란히 쓰이며, `HOTLOOP_CASCADE_LDAP_URL`을 설정하기 전까지는 꺼져 있습니다.

로그인은 이렇게 진행됩니다.

1. 서비스 계정(디렉터리가 허용하면 익명 검색)이 사용자 필터로 그 사람을 찾습니다.
2. 그 사람이 속한 그룹을 조회합니다.
3. 디렉터리가 직접 그 사람으로 bind해서 비밀번호를 확인합니다. Cascade는 그 비밀번호를 저장하지 않고 해시도 보지 않습니다. 여기서 만들어진 계정에는 자체 비밀번호가 없으므로, 디렉터리 비밀번호를 `/login`에서 로컬 비밀번호처럼 쓸 수 없습니다.
4. 계정은 첫 로그인에 만들어지고(끄지 않았다면), 이후 로그인할 때마다 역할이 그룹을 따라갑니다.

켜져 있으면 로그인 페이지에 두 번째 양식이 나타나고, 같은 일을 `{"username": "...", "password": "..."}`와 함께 `POST /auth/ldap/login` 한 번의 호출로 할 수 있습니다. 이름이 틀렸을 때와 비밀번호가 틀렸을 때 응답은 같습니다. 대부분의 디렉터리는 빈 비밀번호 bind에 성공으로 응답하므로, 빈 비밀번호는 디렉터리에 도달하지 않습니다.

### 설정

모두 환경 변수입니다. Helm 차트에서는 `env`에 넣고, bind 비밀번호는 시크릿에서 가져와 `extraEnv`에 넣습니다.

| 변수 | 하는 일 |
|---|---|
| `HOTLOOP_CASCADE_LDAP_URL` | `ldap://host:389` 또는 `ldaps://host:636`. 이것으로 켭니다. |
| `HOTLOOP_CASCADE_LDAP_FLAVOR` | `ldap`(기본값) 또는 `ad`. 아래 기본값만 고릅니다. |
| `HOTLOOP_CASCADE_LDAP_START_TLS` | `true`면 `ldap://` 연결을 아무것도 보내기 전에 암호화 연결로 올립니다. |
| `HOTLOOP_CASCADE_LDAP_CA_FILE` | 디렉터리 인증서를 신뢰할 기관의 PEM 파일. 비우면 시스템의 것을 씁니다. |
| `HOTLOOP_CASCADE_LDAP_TLS_SERVER_NAME` | URL의 호스트가 아닐 때 인증서가 발급되어야 하는 이름. |
| `HOTLOOP_CASCADE_LDAP_BIND_DN` | 사람을 조회하는 서비스 계정. 비우면 익명 검색입니다. |
| `HOTLOOP_CASCADE_LDAP_BIND_PASSWORD` 또는 `_FILE` | 그 비밀번호, 또는 그것이 들어 있는 파일. 둘 다는 안 됩니다. 비밀번호 없는 DN은 익명 bind가 되므로 거부됩니다. |
| `HOTLOOP_CASCADE_LDAP_USER_BASE` | 필수. 사람을 검색할 DN. |
| `HOTLOOP_CASCADE_LDAP_USER_FILTER` | 한 사람을 찾습니다. `{username}`은 입력한 값이며 이스케이프됩니다. |
| `HOTLOOP_CASCADE_LDAP_GROUP_BASE` | 그룹을 검색할 DN. 비우면 그룹 조회를 하지 않습니다. |
| `HOTLOOP_CASCADE_LDAP_GROUP_FILTER` | 한 사람이 속한 그룹을 찾습니다. `{dn}`은 그 사람의 DN, `{username}`은 입력한 값입니다. |
| `HOTLOOP_CASCADE_LDAP_ID_ATTR`, `_EMAIL_ATTR`, `_NAME_ATTR` | 고정 ID, 이메일, 표시 이름에 쓸 속성. |
| `HOTLOOP_CASCADE_LDAP_ROLES` | 쉼표로 구분한 `group=role` 쌍: `supervisors=admin, operators=member`. 그룹은 `cn` 또는 전체 DN으로 지정합니다. 한 사람의 그룹 중 가장 강한 역할이 적용됩니다. |
| `HOTLOOP_CASCADE_LDAP_DEFAULT_ROLE` | `member`, `admin`, `none`. 역할 매핑이 있으면 기본값은 `none`이므로, 매핑된 그룹에 속하지 않은 사람은 거절됩니다. |
| `HOTLOOP_CASCADE_LDAP_JIT` | `false`면 계정을 직접 만든 것만 허용합니다. 기본값은 `true`. |
| `HOTLOOP_CASCADE_LDAP_NAME` | 로그인 버튼에 표시되는 이름. |

`ldap`의 기본값: 사용자 필터 `(&(objectClass=inetOrgPerson)(uid={username}))`, 그룹 필터 `(&(|(objectClass=groupOfNames)(objectClass=groupOfUniqueNames)(objectClass=group))(member={dn}))`, ID `entryUUID`, 이메일 `mail`, 이름 `cn`.

`ad`의 기본값: 사용자는 `sAMAccountName` 또는 사용자 계정 이름(UPN)으로 찾으므로 `alice`와 `alice@plant.example` 둘 다 작동하고, 비활성 계정은 검색에서 빠집니다. 그룹은 중첩 멤버십 규칙(`member:1.2.840.113556.1.4.1941:={dn}`)을 쓰므로, 매핑된 그룹 안에 들어 있는 그룹의 구성원도 그 역할을 받습니다. ID는 `objectGUID`를 GUID로 적은 것, 이메일은 `mail`, 이름은 `displayName`입니다.

### 알아 두어야 할 점

- **Active Directory는 암호화를 요구합니다.** 암호화되지 않은 연결의 단순 bind를 거부합니다. `ldaps://`를 쓰거나 `START_TLS=true`와 함께 `ldap://`를 쓰세요. Cascade는 인증서를 CA 파일(또는 시스템 루트)과 서버 이름에 대해 검사하며, 이 검사를 건너뛰는 설정은 없습니다. 자체 서명 인증서를 쓰는 디렉터리는 `CA_FILE`에 자기 CA가 필요합니다.
- **계정은 이름이 아니라 디렉터리의 ID에 묶입니다.** 디렉터리에서 이름을 바꾸거나 다른 OU로 옮겨도 여기서는 같은 계정입니다. `mail`이 없는 사람에게는 계정을 만들 수 없습니다(로그인 화면이 그렇게 알려 줍니다).
- **주소에 대한 권위는 디렉터리에 있습니다.** 이미 여기 있는 계정이 같은 이메일이면, 그 사람이 처음 로그인할 때 추가 검증 없이 디렉터리 항목과 연결됩니다. 검증된 OIDC 주소와 같은 방식입니다. 직접 운영하지 않는 디렉터리를 가리키지 마세요.
- **인스턴스의 첫 계정이 소유자입니다.** 어떤 방식으로 만들어졌든 같습니다. 먼저 초기 설정으로 소유자를 만드세요.
- **여기서 설정한 두 번째 인증 요소는 계속 유효합니다.** 디렉터리 비밀번호는 하나의 요소입니다. 계정에 인증 앱이나 패스키가 있는 사람은 그 뒤에 그것을 요구받으며, 인스턴스 전체 MFA 강제도 다른 모든 사람과 똑같이 적용됩니다.
- **틀린 비밀번호는 여기서도 계정을 잠급니다.** 이미 디렉터리에 연결된 계정에서 연속 다섯 번 틀리면 로컬 계정처럼 1분간 잠기고 횟수마다 두 배가 되므로, 디렉터리 자체 잠금이 걸리기 전에 막힙니다. 디렉터리가 모르는 사람, 틀린 비밀번호, 잠긴 계정은 모두 감사 로그에 `auth.login_failed` 또는 `auth.login_refused`로 남고, 디렉터리는 통과시켰지만 Cascade가 거절한 사람(그룹 없음, 이메일 없음, JIT 꺼짐)은 `auth.sso_refused`입니다.
- **디렉터리가 내려가 있으면 비밀번호 오류가 아니라 서버 오류입니다.** 로그인 화면은 디렉터리가 응답하지 않았다고 알리고, 자세한 내용은 로그에 있습니다.
- 디렉터리로 가는 모든 호출은 15초로 제한되며, 사용자 필터에 일치하는 사람은 한 명뿐이어야 합니다. 두 명이 일치하면 문제를 밝히며 거부하고, 첫 번째 사람을 고르는 일은 없습니다.

## SAML

모든 SAML 2.0 ID 공급자로 쓰는 싱글 사인온입니다. Cascade가 서비스 공급자입니다. 로컬 계정, OIDC, LDAP와 나란히 쓰이며, 공급자의 메타데이터를 지정하기 전까지는 꺼져 있습니다.

절차는 다음과 같습니다.

1. Cascade는 자체 메타데이터를 `/auth/saml/metadata`에 게시합니다. 이를 공급자에게 주거나, 그 안의 두 값, 즉 엔터티 ID와 assertion consumer service인 `<public url>/auth/saml/acs`(HTTP-POST 바인딩)를 입력하세요.
2. `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL`에 공급자의 메타데이터 주소(`https://sso.plant.example/saml/metadata` 같은 것)를 설정하거나, `HOTLOOP_CASCADE_SAML_IDP_METADATA_FILE`에 같은 문서를 디스크에 저장한 파일을 지정합니다.
3. 로그인 페이지에 "다음으로 로그인" 버튼이 나타납니다. 이 버튼은 `/auth/saml/start`로 이동합니다.

돌아올 때 검사하는 항목은 다음과 같습니다. 공급자 메타데이터에 있는 인증서에 대한 응답 서명, 대상, 시간 범위, 이 브라우저가 시작한 요청에 대한 응답인지, 그리고 로그인이 이 브라우저에서 시작되었는지입니다. 아무도 요청하지 않은 응답(공급자에서 시작한 로그인)은 거부됩니다. 각 로그인의 상태는 한 번만 쓸 수 있으므로, 가로챈 응답을 다시 재생할 수 없습니다.

| 변수 | 하는 일 |
|---|---|
| `HOTLOOP_CASCADE_SAML_IDP_METADATA_URL` 또는 `_FILE` | 공급자의 메타데이터. 둘 중 하나로 SAML이 켜지며, 둘 다는 안 됩니다. |
| `HOTLOOP_CASCADE_SAML_ENTITY_ID` | 이 인스턴스가 공급자에게 자신을 부르는 이름. 기본값은 메타데이터 URL입니다. |
| `HOTLOOP_CASCADE_SAML_KEY_FILE` 및 `_CERT_FILE` | 이 인스턴스의 키 쌍(PEM, RSA 또는 EC). 둘 다 지정하거나 둘 다 지정하지 않습니다. 기본값은 첫 시작 때 데이터 디렉터리에 `saml-sp.key`와 `saml-sp.crt`로 만들어 계속 유지하는 쌍입니다. |
| `HOTLOOP_CASCADE_SAML_SIGN_REQUESTS` | `true`면 Cascade가 보내는 모든 요청에 서명합니다. 공급자에게 인증서를 알려 주어야 합니다. 기본값은 `false`. |
| `HOTLOOP_CASCADE_SAML_NAMEID_FORMAT` | Cascade가 공급자에게 사람을 식별하도록 요청하는 방식: `persistent`(기본값), `email`, `unspecified`. |
| `HOTLOOP_CASCADE_SAML_SUBJECT_ATTR` | NameID 대신 사람을 식별하는 속성. |
| `HOTLOOP_CASCADE_SAML_EMAIL_ATTR`, `_NAME_ATTR`, `_GROUPS_ATTR` | 이메일, 표시 이름, 그룹이 들어 있는 속성. |
| `HOTLOOP_CASCADE_SAML_ROLES`, `_DEFAULT_ROLE`, `_JIT`, `_NAME` | LDAP와 같습니다. 그룹과 역할의 쌍, 어느 그룹에도 없는 사람의 역할, 첫 로그인에 계정을 만들지 여부, 버튼 이름입니다. |

속성 설정이 없으면 Cascade는 흔히 쓰는 이름을 찾습니다. 이메일은 `email`, `mail`, `emailAddress`, LDAP 객체 ID `urn:oid:0.9.2342.19200300.100.1.3`, 또는 클레임 URI `.../claims/emailaddress`이며, NameID가 주소 형식이면 그것으로 대체합니다. 이름은 `displayName`, `name`, 또는 이름과 성입니다. 그룹은 `groups`, `group`, `memberOf`, URI `.../claims/Group`, 그리고 Microsoft의 그룹 클레임입니다.

알아 두어야 할 점입니다.

- **영구 ID를 요청하세요.** 계정은 NameID에 묶이는데, 일시적 ID는 로그인할 때마다 달라집니다. Cascade는 영구 ID를 요청하고, 일시적 ID는 그렇게 알리는 메시지와 함께 거부합니다. 로그인마다 새 계정을 만들지 않기 위해서입니다. 공급자가 일시적 ID만 보낼 수 있다면 `SUBJECT_ATTR`에 변하지 않는 속성을 지정하세요.
- **주소에 대한 권위는 공급자에게 있습니다.** LDAP와 마찬가지로, 같은 이메일의 기존 계정은 첫 SAML 로그인에서 연결됩니다.
- **프록시 뒤에서는 `HOTLOOP_CASCADE_PUBLIC_URL`을 사람들이 쓰는 주소로 설정하세요.** 공급자는 이 주소로 만든 assertion consumer URL로 POST를 보냅니다.
- **HTTPS를 쓰세요.** 공급자는 다른 사이트에서 POST로 응답하므로, 로그인을 그 브라우저에 묶는 쿠키가 사이트 간에 전송되어야 하고, 브라우저는 보안 연결에서만 이를 허용합니다.
- **파드가 둘 이상이면** 모두에 같은 키 쌍이 필요합니다. 시크릿에 넣고 `KEY_FILE`과 `CERT_FILE`로 지정하세요. 그렇지 않으면 파드마다 따로 만듭니다.
- 여기서 설정한 두 번째 인증 요소는 SAML 로그인 뒤에도 계속 유효하며, SAML이 공급자 자체의 다단계 인증을 대신 인정하는 일은 없습니다.
- 싱글 로그아웃은 지원하지 않습니다. 로그아웃하면 여기서의 세션만 끝납니다.

## SCIM

편집기의 설정, 로그인 및 SCIM에서 SCIM이 켜져 있는지, 공급자에게 줄 기본 URL, 토큰을 볼 수 있고, 토큰을 만드는 버튼(한 번만 표시됨)과 폐기하는 버튼이 있습니다. LDAP, SAML, OpenID Connect는 인스턴스가 시작될 때 환경에서 설정하므로, 같은 화면은 어느 것이 켜져 있고 공급자가 어디를 가리키는지(SAML 메타데이터와 ACS URL)만 보여 주며 바꾸는 척하지 않습니다.

SCIM은 ID 공급자가 계정을 디렉터리와 맞춰 두는 방법입니다. 사람이 입사하면 만들고, 이동하면 바꾸고, 퇴사하면 끄고, 그룹도 관리합니다. Cascade가 SCIM 서버(RFC 7643과 7644, 버전 2.0)이고 공급자가 클라이언트입니다. RFC가 말하는 것과 일반적인 ID 공급자가 보내는 것에 맞춰 만들었고, 다른 팀이 만든 SCIM 클라이언트로 갖고 있는 모든 검사를 실행하는 scim2-tester로 릴리스마다 시험합니다. `HOTLOOP_CASCADE_SCIM=true`를 설정하기 전까지는 꺼져 있습니다.

설정 방법은 다음과 같습니다.

1. `HOTLOOP_CASCADE_SCIM=true`로 켜고 다시 시작합니다.
2. 인스턴스 소유자나 관리자로서 공급자용 토큰을 만듭니다. `{"name": "plant directory"}`와 함께 `POST /api/v1/scim-tokens`를 호출합니다. 응답의 `secret`(`hlcs_`로 시작)은 한 번만 표시되므로 바로 공급자에 입력하세요. `GET /api/v1/scim-tokens`는 각 토큰의 마지막 사용 시각과 함께 목록을 보여 주고, `DELETE /api/v1/scim-tokens/{token}`은 하나를 폐기합니다. 토큰은 사람이 로그인해서 만들어야 합니다. API 키로는 만들 수 없으므로 유출된 키로 더 만들 수 없습니다.
3. 공급자에게 기본 URL인 `<public url>/scim/v2`와 bearer 토큰으로서의 토큰을 줍니다.

모든 호출에 토큰이 필요하고, 모든 응답은 `application/scim+json`입니다. 호출은 토큰 이름을 행위자로 하여 감사 로그에 남으므로, `user.created`, `user.disabled` 등이 어느 공급자가 했는지 알려 주며, SCIM 이벤트 `scim.user_deleted`, `scim.group_created`, `scim.group_updated`, `scim.group_deleted`도 함께 남습니다.

### 제공하는 것

`/ServiceProviderConfig`, `/ResourceTypes`, `/Schemas`는 지원하는 것을 알려 주며, 사실만 말합니다. 필터링과 PATCH는 지원하고, bulk, 정렬, ETag, 비밀번호 변경은 지원하지 않습니다.

| 리소스 | 호출 |
|---|---|
| `/Users` | `GET`(목록, `filter`, `startIndex`, `count`, `attributes`, `excludedAttributes` 사용 가능), `POST`, `GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/Groups` | 같습니다 |
| `/.search`, `/Users/.search`, `/Groups/.search` | 본문에 쿼리를 담은 `POST` |

- **사용자**는 `userName`, `externalId`, `name`(`formatted`, `givenName`, `familyName`), `displayName`, `emails`, `active`로 이루어집니다. 계정의 이메일은 기본 이메일, 없으면 업무용, 없으면 첫 번째, 없으면 주소 형식일 때의 `userName`입니다. 주소가 없으면 400입니다. 공급자가 보낸 것은 보낸 그대로 반환되며, 보내지 않은 이름을 지어내지 않습니다. `groups`는 읽기 전용으로 돌아옵니다.
- **그룹**은 `displayName`, `externalId`, `members`로 이루어지며, 각 구성원은 사용자의 ID입니다. 사용자가 아닌 구성원은 400입니다.
- **필터**는 전체 문법을 지원합니다. `eq ne co sw ew gt ge lt le pr`, `and`, `or`, `not`, 괄호, `attr[filter]`입니다. `id`와 `externalId`를 제외하면 대소문자를 구분하지 않고 비교합니다. 잘못된 필터는 `scimType: invalidFilter`와 함께 400입니다.
- **PATCH**는 경로가 있든 없든 `add`, `replace`, `remove`를 받고, `emails[type eq "work"].value`나 `members[value eq "id"]` 같은 값 경로를 대소문자와 관계없이 받으며, 일부 공급자가 보내는 불리언을 `true`로도 문자열 `"False"`로도 받습니다. PUT이 바꿀 수 있는 것과 정확히 같은 것을 바꿉니다.
- **목록**은 계정이 만들어진 순서이며, `count`로 지정하지 않으면 페이지당 100개, 최대 200개입니다.

### 하지 않는 것

- **소유자를 표시하거나 바꾸지 않습니다.** 인스턴스 소유자는 목록에 없고, 조회, 패치, 삭제를 할 수 없으며, 그룹에 넣을 수도 없습니다. 소유자의 이메일은 충돌로 처리됩니다.
- **계정을 삭제하지 않습니다.** `DELETE`는 그 사람을 꺼서 세션을 끝내고, 그룹에서 빼고, SCIM에서 숨깁니다. 그 사람이 만든 모든 것과 모든 감사 기록은 남습니다. 공급자가 같은 주소로 다시 만들면 같은 계정이 켜진 상태로 돌아옵니다. `active: false`는 숨기지 않고 끕니다.
- **SCIM 계정에는 비밀번호가 없습니다.** OIDC, SAML 또는 LDAP로 로그인하며, 이들은 주소로 그 계정에 연결됩니다.
- **프로젝트는 건드리지 않습니다.** SCIM은 계정과 인스턴스 역할만 다룹니다. 누가 어느 프로젝트에 속하는지는 여전히 여기서 정합니다.

### 그룹에서 역할 가져오기

기본적으로 새 계정은 구성원이고, SCIM은 누구의 역할도 바꾸지 않습니다. 그룹이 역할을 결정하게 하려면 그룹 이름을 역할에 매핑하세요.

```
HOTLOOP_CASCADE_SCIM_ROLES="Plant Admins=admin, Plant Members=member"
HOTLOOP_CASCADE_SCIM_DEFAULT_ROLE=member
```

그러면 구성원 자격이 바뀔 때마다 그 사람의 역할이 그룹을 따라갑니다. 매핑된 역할 중 가장 강한 것이 적용되고, 어느 그룹에도 없는 사람은 기본값을 받습니다. 공급자는 소유자를 만들지 않으므로 `admin`과 `member`만 매핑할 수 있습니다. 역할의 출처는 하나만 쓰세요. OIDC나 SAML도 그룹을 역할에 매핑한다면 가장 나중에 역할을 바꾼 쪽이 이기므로 둘이 서로 덮어씁니다.

공급자에는 같은 그룹 이름이 필요하며, 그룹을 구성원과 함께 보내야 합니다. SCIM 그룹을 지원하는 공급자라면 모두 할 수 있습니다.
