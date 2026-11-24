---
title: "npm 없는 플러그인"
description: "플러그인은 메모리 상한, 타임아웃, 디스크립터를 가진 서명된 WebAssembly 모듈이며, 허락하지 않으면 호스트에 접근할 수 없습니다."
---

Node-RED 커뮤니티 노드는 npm 패키지입니다. 박스에 Node.js가 있어야 하고, 설치되면 런타임 프로세스 안에서 그 프로세스가 닿을 수 있는 모든 것과 함께 실행됩니다. Flow는 그런 노드를 실행하지 않고 앞으로도 그렇게 하지 않습니다. 대신 이렇게 합니다. 플러그인은 메모리 상한과 타임아웃이 있는 샌드박스 안의 WebAssembly 모듈이고, 편집기가 대화상자를 그리는 근거인 디스크립터가 함께 오며, 서명되어 있고, 요청하고 사용자가 허락하지 않으면 호스트에 접근할 수 없습니다.

사용자에게 의미하는 바는 이렇습니다. 플러그인이 실행되기 전에 JSON 파일 하나로 계약 전체를 읽을 수 있고, 박스는 사용자가 고른 키로 서명되지 않은 것을 모두 거부하며, 버그가 있는 플러그인이 할 수 있는 최악의 일은 자기 메시지를 실패시키는 것뿐입니다.

## 플러그인이란

`<data.dir>/plugins/`(또는 `plugins.dir`) 아래에 플러그인 이름을 딴 디렉터리가 있고, 세 개의 파일이 들어 있습니다.

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

각 플러그인은 팔레트의 Function 섹션에서 노드 타입 하나, `wasm-<name>`이 됩니다. 플러그인은 Flow가 시작할 때 읽으므로, 추가하거나 바꾸려면 재시작이 필요합니다. 메시지를 처리하는 시점에는 아무것도 읽지 않습니다.

### 모듈

ABI는 [README](/ko/flow/sandboxes/)에 있는 것과 같습니다. `hotloop_flow_process`와 `hotloop_flow_alloc`은 필수, `hotloop_flow_free`는 선택이며, 모든 것은 JSON으로 오갑니다. 게스트는 `{"msg": {...}, "config": {...}}`를 받고 `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`를 돌려줍니다. HTTP In 노드가 붙이는 응답 핸들이나 바이너리 버퍼처럼 단순한 JSON이 아닌 메시지 속성은 게스트에게 주지 않습니다. 노드가 그것을 보관했다가 게스트가 보내는 모든 메시지에 다시 붙이며, 게스트가 그 속성을 직접 설정한 경우만 예외입니다. 덕분에 플러그인을 HTTP In과 HTTP Response 사이에 둘 수 있습니다. `config`는 노드의 대화상자에 담긴 값입니다. `error`는 메시지를 Catch 노드로 실패시키며, 그 전에 보낸 것은 그대로 전송됩니다.

모듈은 WASI를 가져올 수 있고, 컨텍스트 capability를 선언했다면 아래의 두 컨텍스트 함수도 가져올 수 있습니다. 그 밖에 가져오는 것은 플러그인을 불러올 때 거부되며, 거부 메시지가 그 import의 이름을 알려 줍니다.

### 디스크립터

`plugin.json`은 엄격하게 읽습니다. Flow가 모르는 필드는 거부 사유이므로, 잘못 쓴 `"capabilites"`는 아무것도 요청하지 않은 채 조용히 지나가는 플러그인이 되지 않고 잡힙니다.

| 필드 | <span class="sr-only">세부 정보</span> |
|---|---|
| `format` | `1`. 필수. |
| `name` | 소문자, 숫자, 하이픈, 최대 40자, 문자로 시작. `plugins.grants`와 플로 파일이 쓰는 이름이므로 디렉터리 이름과 일치해야 합니다. |
| `version` | 필수. 노드의 도움말과 `GET /plugins`에 표시됩니다. |
| `label`, `description`, `help` | 팔레트 라벨, 한 줄 설명, 정보 사이드바용 Markdown. |
| `inputs`, `outputs` | 입력은 1이어야 합니다. 출력은 0에서 16, 기본값 1. |
| `props` | 대화상자. 내장 노드가 쓰는 것과 같은 속성 선언이며, 종류는 `string`, `text`, `number`, `bool`, `select`, `json`, `list`입니다. 자격 증명, 설정 노드 참조, 코드 편집기 종류는 거부됩니다. 플러그인이 다룰 일이 아니기 때문입니다. |
| `capabilities` | 요청하는 호스트 접근. |
| `limits` | 기본으로 원하는 `memoryMiB`와 `timeoutMs`. |

편집기는 브라우저에 플러그인의 코드를 전혀 올리지 않고 `props`로 대화상자를 그립니다. 모든 플러그인 노드에는 이름, 메모리 한도, 타임아웃 필드도 붙습니다. 이 세 이름은 예약되어 있습니다.

## 한도, 그리고 트랩은 어떻게 보이는가

플러그인 노드마다 자체 메모리 상한과 자체 타임아웃이 있습니다. 플러그인의 디스크립터가 기본값을 정하고(아무 말이 없으면 16 MiB와 1초), 노드는 대화상자에서 이를 바꿀 수 있으며, `plugins.maxMemoryMiB`(64)와 `plugins.maxTimeout`(5s)이 박스가 허용하는 한계입니다. 박스가 허용하는 것보다 많이 요청한 노드는 배포를 실패시키고 어느 설정을 올려야 하는지 알려 줍니다.

상한을 넘어 커지는 게스트는 트랩에 걸립니다. 타임아웃 시점에도 실행 중인 게스트는 중단됩니다. 어느 쪽이든 메시지는 가장 가까운 Catch 노드로 가고, 다음 메시지가 깨끗하게 시작하도록 인스턴스는 폐기되며, 다른 노드는 영향을 받지 않습니다. Catch 노드가 `msg.error.message`에서 보는 내용은 다음과 같습니다.

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

상한은 미리 확보됩니다. 상한이 64 MiB인 노드는 인스턴스가 존재하는 동안 게스트가 건드리든 말든 Go 힙의 64 MiB를 차지한 것으로 계산합니다. 버퍼를 복사해서 키우면 호스트가 잠시 상한의 몇 배를 쥐게 되기 때문입니다. 이를 증명하는 테스트는 호출이 전체로 할당한 양(상한 256 MiB에 256 MiB)과 트랩 뒤에 힙이 시작했던 자리로 돌아오는지를 측정합니다. 그러니 상한은 입력할 수 있는 가장 큰 숫자가 아니라 플러그인이 필요한 만큼으로 정하세요.

## Capability

capability가 없으면 접근도 없습니다. 각 capability는 디스크립터가 요청하고 `plugins.grants`가 그 플러그인에 이름으로 부여할 때만 연결됩니다.

| Capability | 제공하는 것 | 없을 때 |
|---|---|---|
| `clock` | 실제 벽시계와 단조 시계. | 게스트는 2022-01-01에 시작하고 플랜트의 시계와 무관한 대체 시계를 봅니다. |
| `random` | 운영체제의 난수 바이트. | 매번 같은 고정된 순서. |
| `context.flow` | 노드가 속한 플로 자신의 플로 컨텍스트 읽기와 쓰기. | 컨텍스트 함수가 존재하지 않습니다. |
| `context.global` | 글로벌 컨텍스트 읽기와 쓰기. | 같습니다. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

허락되지 않은 것을 요청해도 메시지 시점에는 실패하지 않습니다. 배포가 실패합니다. 아무것도 쓰기 전에 플로가 422로 거부되고, 실행 중인 플로는 알아차리지 못하며, 메시지는 노드와 추가할 줄을 알려 줍니다.

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

롤백도 배포이므로, 부여가 그 뒤에 회수된 플러그인을 쓰는 플로로의 롤백도 같은 방식으로 거부됩니다. 설치되었지만 부여되지 않은 플러그인도 팔레트에는 나타나며, 도움말에 그 capability가 표시됩니다.

### 컨텍스트 함수

컨텍스트 capability를 선언한 게스트는 모듈 `hotloop_flow`에서 이 함수들을 가져올 수 있습니다. 값은 JSON으로 오갑니다.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

스코프는 플로가 `0`, 글로벌이 `1`입니다. `context_get`은 JSON의 길이를 반환하고, `outCap`에 들어갈 때만 JSON을 씁니다. 그래서 제공한 것보다 큰 값을 돌려받은 게스트는 더 큰 버퍼로 다시 시도합니다. 없는 키는 `-1`이고, `-2`는 거부를 뜻합니다. 스코프가 부여되지 않았거나, 키나 JSON이 잘못되었거나, 저장소가 거절한 경우입니다. 게스트는 부여받지 않은 스코프를 시도해서 읽을 수 없습니다.

## 서명, 그리고 게시자를 신뢰하기

플러그인은 ed25519 키로 서명합니다. 서명은 모듈만이 아니라 두 파일을 모두 덮습니다. 플러그인이 접근을 요청하는 곳이 디스크립터이기 때문입니다. 모듈만 서명하면 디렉터리에 쓰기 권한이 있는 누구나 서명된 플러그인에 capability를 추가할 수 있습니다. 서명되는 메시지는 다음과 같습니다.

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

플러그인을 불러올 때 조회하는 것은 없습니다. 네트워크도, 투명성 로그도, 인증서 체인도 없습니다. 검사는 서명, 서명이 가리키는 키, 사용자의 키 목록이 전부입니다. 외부로 나가는 경로가 없을 수 있는 플랜트 네트워크의 박스를 위한 의도된 선택입니다. 폐기 서비스도 없다는 뜻이므로, 키를 폐기하는 일은 `plugins.trustedKeys`에서 제거하고 재시작하는 것입니다.

### 게시자라면

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen`은 PKCS #8 개인 키와 PKIX 공개 키를 PEM으로 쓰며, `openssl genpkey -algorithm ed25519`와 `openssl pkey -pubout`이 만드는 것과 같은 파일입니다. 어느 쪽이든 덮어쓰기를 거부합니다. 키 id와 공개 키의 한 줄 형태를 출력합니다. 개인 키는 git 밖에 두세요. 키는 커밋하지 않습니다.

### 운영자라면

Helm 차트에서는 `plugins.trustedKeys`, `plugins.grants`, `plugins.volume`이며, [Flow 배포](/ko/flow/deploying/)에 있습니다.

게시자의 공개 키를 `plugins.trustedKeys` 또는 쉼표로 구분한 `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`에 넣으면 그 게시자를 신뢰하는 것입니다. 각 항목은 `ed25519:<base64>` 줄, PEM 공개 키, 또는 그것을 담은 파일의 경로이며, 마운트한 Secret이나 ConfigMap은 이렇게 들어옵니다.

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

신뢰하는 키가 없으면 모든 플러그인이 거부됩니다. 해석할 수 없는 키는 시작 오류입니다. 신뢰는 플러그인이 아니라 키 단위이므로, 게시자를 신뢰한다는 것은 그가 서명하는 모든 것을 신뢰한다는 뜻입니다. 그 뒤 플러그인이 무엇을 쓸 수 있는지는 별도의 결정이며 `plugins.grants`에서 이름으로 정합니다.

## 거부할 때

불러오지 못한 플러그인은 시작 시 로그에 남고, 이유와 함께 `GET /plugins`에 나열되며, 팔레트에서는 보이지 않고, 그 플러그인을 쓰는 플로를 배포할 때 거부 메시지에 이름이 나옵니다. 문제 있는 플러그인 하나가 Flow의 나머지 시작을 막는 일은 없습니다. `hotloop-flow plugin verify`는 같은 검사를 실행하므로 게시자도 운영자가 볼 것을 그대로 봅니다.

| 문제 | 표시되는 내용 |
|---|---|
| `plugin.sig` 없음 | `unsigned: plugin.sig is missing` |
| 서명 후 모듈이나 디스크립터가 수정됨 | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| 신뢰하지 않는 키로 서명됨 | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| 구성된 키가 전혀 없음 | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| 서명 파일 손상 | `signature file is malformed: ...` |
| 알 수 없는 필드, 잘못된 종류, 잘못된 capability가 있는 디스크립터 | 필드 이름과 함께 `plugin.json is not valid: ...` |
| 모듈이 호스트가 제공하지 않는 것을 가져옴 | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| 모듈이 capability 선언 없이 컨텍스트 함수를 사용함 | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| 디렉터리 이름과 `name`이 다름 | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

서명은 디스크립터를 해석하기 전, 모듈을 컴파일하기 전에 검사하므로 서명되지 않은 코드는 컴파일조차 되지 않습니다.

## 두 가지 예제

* `moving-average`는 Rust입니다. 최근 N개 메시지에 걸쳐 측정값의 평균을 내고, 자기 메모리에 윈도를 보관합니다. 아무것도 요청하지 않습니다. `cargo build --locked --release --target wasm32-wasip1`을 실행하면 `plugin.wasm`은 빌드된 `moving_average.wasm`입니다.
* `stamp`는 TinyGo입니다. 모든 메시지에 시각을 더하므로 `clock`을 요청합니다. TinyGo의 자체 컨테이너로 Podman을 사용해 빌드합니다. `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow는 Go의 집입니다. 호스트, 서명, CLI, 모든 테스트는 Go이고 TinyGo 예제도 Go입니다. Rust 예제가 있는 이유는, 호스트가 작성된 언어에서만 동작하는 플러그인 형식은 플러그인 형식이라 할 수 없기 때문이고, 신호 처리 라이브러리가 이미 Rust로 작성되어 있을 가능성이 가장 높기 때문입니다. Go가 아닌 유일한 예제에 대한 문서화된 이유입니다. 빌드에 쓰는 크레이트는 `serde`와 `serde_json`이며, 둘 다 허용적 라이선스이고 Flow가 아니라 예제 모듈에 컴파일되어 들어갑니다.

## 아직 증명되지 않은 것

* 플러그인은 베어 메탈에서 실행해 보았습니다(2026-11-17).
* Kubernetes에서는 플러그인 파일이 `plugins.volume`을 통해 오며, 볼륨 소스는 무엇이든 됩니다. ConfigMap은 1 MiB 한도까지만 플러그인을 담을 수 있으므로, TinyGo 예제 크기의 플러그인에는 claim이 필요합니다.
* 네트워크 capability는 없습니다. 플러그인은 요청을 보낼 수 없으며, 호스트 허용 목록과 함께 그럴 이유가 있는 사람이 나타날 때까지 의도된 것입니다.
* Flow 테스트는 다른 모든 노드와 같은 자식 프로세스에서 플러그인을 실제로 실행합니다. 플러그인의 capability는 배포가 부여할 것과 같습니다.
* 셸에서 직접 실행한 `hotloop-flow test`는 플러그인을 불러오지 않습니다. 배포 게이트와 편집기의 테스트 실행은 불러옵니다.
