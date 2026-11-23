---
title: "에이전트를 위한 MCP"
description: "에이전트가 공장 전체를 읽고, 활성화한 것만 쓰기 게이트를 거쳐 건드리게 하며, 모든 쓰기 옆에 명시한 사유를 기록합니다."
---

게이트웨이는 양방향으로 MCP를 사용합니다. 에이전트는 공장을 읽고 구동할 수 있고, 자동화 규칙은 다른 곳의 도구를 호출할 수 있습니다.

설계 원칙은 **에이전트도 다른 호출자와 같은 호출자**라는 것입니다. 도구는 UI가 읽는 것과 같은 캐시로 읽고, UI가 쓰는 것과 같은 게이트로 씁니다. 특권 경로도, 우회도, 별도의 정책도 없습니다. 운전원에게 거부될 쓰기는 거부되고, 성공한 쓰기는 행위자 앞에 `mcp:`가 붙은 채 같은 감사 테이블에 기록됩니다.

## 제공 방식

### HTTP로

기본으로 앱 포트의 `/mcp`에서 켜져 있으며, 차트가 릴리스 Secret에 생성하는 Bearer 토큰으로 보호됩니다.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

클러스터 안에서 엔드포인트는 다음과 같습니다.

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

토큰 검사는 핸들러 앞에 있으므로, 인증되지 않은 호출자는 무엇이 있는지 열거할 수조차 없습니다. `mcp.token`을 비워 두면 차트가 하나를 생성하므로, 기본 배포가 실수로 열려 있는 배포가 되는 일은 없습니다. NetworkPolicy와 함께 쓰십시오. 토큰은 두 번째 방어선이지 유일한 방어선이 아닙니다.

엔드포인트는 절대 열려 있지 않습니다. `HOTLOOP_MCP_TOKEN` 없이 바이너리(Quadlet 유닛, 단독 `hotloop`)를 실행하면 첫 시작 때 토큰을 만들어 자체 데이터베이스에 보관하므로, 재시작 후에도, 모든 레플리카에서도, 복원 후에도 같은 토큰이 돌아옵니다. `hotloop mcp-token`이 이를 출력합니다(로그에는 하나를 만들었다는 사실만 남고 값은 절대 남지 않습니다). 직접 고르려면 `HOTLOOP_MCP_TOKEN`을 설정하십시오. `HOTLOOP_MCP_OIDC_*`를 설정하면 엔드포인트가 로그인을 받으며 자체 토큰은 두지 않습니다. 예전에 아무것도 없이 단독 바이너리에 접속하던 클라이언트는 이제 `Authorization: Bearer <that token>`을 보낼 때까지 `401`을 받습니다.

### Vord 로그인 또는 허브 어서션으로

정적 토큰은 어느 클라이언트가 호출했는지는 알려 주지만 어느 사람인지는 알려 주지 못합니다. OIDC를 설정하면 `/mcp`는 `Authorization: Bearer <jwt>`도 받으며, 검증된 사람의 이메일이 감사 행위자가 됩니다. 쓰기는 `mcp:<client name>` 대신 `mcp:pat@example.com`으로 기록됩니다. 설정하지 않았을 때의 동작은 그대로이고, 정적 토큰도 함께 계속 작동합니다(정적 토큰을 설정하지 않으면 검증된 JWT만 들어옵니다).

| 변수 | 차트 값 | 역할 |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | Vord 렐름의 URL이며 그 액세스 토큰을 받습니다 |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | 모든 토큰이 가져야 하는 `aud`이며, 이 둘 중 하나와 함께 필수입니다 |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | ID 허브의 어서션 키이며 그 어서션을 받습니다 |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | 호출자가 가져야 하는 렐름 역할 |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | 호출자별로 쓰기를 제한합니다. 아래를 참고하세요 |

Vord 액세스 토큰은 발급자의 JWKS(디스커버리 문서로 찾고 10분간 캐시하며 모르는 `kid`가 나오면 다시 가져옴)로 검사합니다. RS256 또는 ES256만, `iss`는 발급자와 같아야 하고, `aud`는 대상을 포함해야 하며, `exp`와 `nbf`는 30초 오차를 허용하고, `email`(또는 `preferred_username`) 클레임이 있어야 합니다. Vord는 기본으로 `aud`에 `account`만 넣으므로, 설정한 대상에 대해 클라이언트 스코프에 audience 매퍼를 지정하십시오.

허브 어서션은 `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud`는 설정한 대상(Hub 모듈은 `hotloop`을 보냄)이며, 만료되지 않았고 Hub의 JWKS에 있는 키로 서명되어야 합니다. `jti` 재생 방지 캐시는 없습니다. 도구 호출 하나는 같은 어서션을 담은 여러 HTTP 요청(initialize 다음 호출)이고 어서션은 60초 동안 유효하기 때문입니다. 호출이 다른 사람을 대신한다고 Hub가 알리면(`acting_as`) 행위자는 `mcp:<email> for <acting_as email>`로 표시됩니다.

쓰기에는 여전히 마스터 스위치인 `HOTLOOP_ALLOW_WRITES`가 필요하며, 토큰은 이를 절대 넓히지 않습니다. `HOTLOOP_MCP_OIDC_WRITE_ROLE`은 호출자별로 쓰기를 좁힙니다. `hotloop:hotloop.write`는 클라이언트 `hotloop`의 Vord 클라이언트 역할 `hotloop.write`(`resource_access.hotloop.roles`)를 뜻하고, 이름만 쓰면 렐름 역할을 뜻하며, Hub 어서션은 `abilities`에 역할 이름을 담아야 합니다. 역할이 없는 호출자는 읽을 수는 있지만 `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation`과 구성을 바꾸는 모든 도구는 거부됩니다. 정적 토큰은 이 제한을 받지 않습니다.

### stdio로

같은 바이너리가 `--mcp-stdio`로 stdin과 stdout에서 MCP를 제공하며, 이를 직접 실행하는 클라이언트를 위한 것입니다. 나머지도 모두 시작되므로 에이전트는 속이 빈 서버가 아니라 살아 있는 공장을 봅니다.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

stdio 모드에서는 모든 로그가 stderr로 갑니다. stdout에 쓰이는 것은 무엇이든 프로토콜 스트림을 망가뜨립니다.

## 도구

171개입니다. 공장을 읽고 명령하는 것이 27개, 구성을 바꾸는 것이 69개([아래](#구성-변경)), 이에 딸린 읽기와 드라이런이 33개([아래](#읽기와-드라이런)), 관리용이 42개([아래](#관리))입니다.

| 도구 | 하는 일 |
|---|---|
| `get_plant_status` | 온라인 장치, 미해결 알람, 쓰기 활성화 여부 |
| `list_devices` | 프로토콜, 주소, 상태, 태그 수를 포함한 모든 장치 |
| `describe_device` | 태그와 폴링 통계를 포함한 장치 하나의 상세 정보 |
| `list_tags` | 장치, 이름 또는 설명으로 카탈로그 검색 |
| `read_tag` | 품질을 포함한 현재 값 |
| `query_history` | 원시 또는 버킷 단위의 이력 값 |
| `write_tag` | **태그에 명령** |
| `list_alarms` | 알람과 ISA-18.2 상태 |
| `ack_alarm` | 운전원을 대신해 확인 |
| `list_automations` | 규칙, 실행 횟수, 마지막 결과 |
| `trigger_automation` | 규칙을 지금 실행 |
| `describe_protocol` | 이 빌드가 실제로 사용하는 프로토콜 |
| `recent_events` | 무슨 일이 어떤 순서로 일어났는지 파악하기 위한 시스템 로그 |
| `list_entities` | 도메인, 설비 노드, 레이블로 엔티티를 찾고, 각각이 받는 서비스를 표시 |
| `get_states` | 하나 이상의 엔티티의 현재 상태, 품질과 속성 포함 |
| `call_service` | **엔티티에 명령**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | 엔티티, 설비 노드, 행위자 또는 종류별로 상태 변경, 쓰기, 알람, 실행, 구성 변경을 하나의 타임라인으로 |
| `list_scripts` | 공장의 스크립트, 각각이 받는 필드, 실행 중인지 여부, 마지막 실행 |
| `run_script` | **스크립트 실행**, 또는 `dryRun`으로 지금 무엇을 할지 질의 |
| `list_recipes` | 공장의 레시피: 순서대로의 대상, 매개변수, 사전 조건, 버전, 마지막 적용 |
| `validate_recipe` | 레시피를 지금 적용할 수 있는가? 거부될 모든 이유, 아무것도 쓰지 않음 |
| `apply_recipe` | **레시피 적용**: 전체를 검사하고 순서대로 쓰고 다시 읽음 |
| `list_blueprints` | 규칙을 만들기 위해 사람들이 채우는 블루프린트, 입력과 버전 |
| `preview_blueprint` | 주어진 입력으로 블루프린트가 만들 규칙과 그것이 지금 할 일, 아무것도 만들지 않음 |
| `find_network_client` | 공장 네트워크에서 장치가 있는 곳: 스위치 포트, 포트의 링크 여부, UniFi 콘솔이 마지막으로 본 시점 |
| `get_network_topology` | UniFi 콘솔이 그리는 공장 네트워크: 무엇이 무엇에 연결되어 있는지, 각 장치의 상태, 그것이 다운되면 네트워크를 잃는 HotLoop 장치 |
| `get_network_events` | UniFi 콘솔이 보고한 최신 이벤트와 이벤트 웹소켓이 살아 있는지 여부 |

### 엔티티

엔티티는 `sensor.zone_1_temperature`나 `switch.conveyor_run`처럼 사람들이 공장의 어떤 것을 부르는 이름이며, 하나 이상의 태그를 감쌉니다. [엔티티](/ko/iot/entities/)를 참고하세요. 에이전트에게는 대개 더 나은 손잡이입니다. 이름에 의미가 있고, 엔티티가 무엇을 할 수 있는지 알기 때문입니다.

`list_entities`는 `domain`, `equipment`(설비 트리의 노드를 id, 이름, 또는 `Plant A/Packing` 같은 이름 경로로 지정하며, 그 노드와 그 아래의 모든 것에 일치하고 엔티티 자체의 위치가 장치의 위치보다 우선함), `label`(label_id 또는 이름, 엔티티가 레이블을 가졌거나 그 장치가 가졌으면 일치), `query`(entity_id 또는 이름의 부분 문자열)로 필터링합니다. 각 결과에는 현재 상태와 품질, 그리고 받는 서비스가 `domain.service` 형태로 들어 있습니다. 서비스가 없는 엔티티는 읽기 전용입니다. 서비스는 엔티티 계층에서 오므로, 그곳에서 서비스가 늘어난 도메인은 여기서 변경 없이 나타납니다.

`get_states`는 `entity_ids`를 받아 각각에 대해 상태, 품질, 속성, `last_changed`로 응답합니다. `read_tag`와 같은 선을 지킵니다. `unknown` 또는 `unavailable` 상태에는 값이 아니라는 메모가 붙고, 비활성화된 엔티티는 없다고 하지 않고 비활성화되었다고 알리며, 불량 품질은 명시됩니다.

`call_service`는 `domain`, `service`, `entity_id`, `data`, 그리고 **필수** `reason`을 받습니다.

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

`POST /api/services/...`가 쓰는 것과 같은 실행기인 `entity.Services`를 거치며, 호출을 쓰기 게이트를 통과하는 쓰기로 바꿉니다. [쓰기](#쓰기)를 참고하세요.

### 네트워크

`find_network_client`는 조용해진 PLC에 대한 첫 번째 질문에 답합니다. PLC의 문제인가, 스위치 포트의 문제인가? `deviceId`를 주면 그 장치의 확인된 링크를 따라 UniFi 클라이언트까지 가고, `query`(MAC, IP 또는 이름의 일부)를 주면 HotLoop이 읽는 모든 콘솔에서 검색합니다. UniFi 드라이버의 마지막 읽기를 읽으며 콘솔은 읽지 않으므로, 에이전트가 반복해서 물어도 콘솔에는 비용이 들지 않습니다. 이는 `--mcp-stdio` 헬퍼가 자기 프로세스에서는 읽는 콘솔이 없다고 답한다는 뜻이기도 합니다. 옆에 있는 Gateway가 이미 세션을 갖고 있으므로 콘솔에 로그인하지 않습니다. Gateway의 엔드포인트에 물어보십시오. [UniFi Network](/ko/iot/unifi/)를 참고하세요.

`get_network_topology`는 지도입니다. 각 스위치, 액세스 포인트, 게이트웨이가 연결된 상위 장치 아래에, 양쪽 끝의 포트, 링크, 그 위의 클라이언트 수, 그리고 그 아래 클라이언트에 연결된 HotLoop 장치와 함께 나타납니다. 마지막 부분이 영향 범위입니다. 그 스위치가 내려가면 네트워크를 잃는 PLC의 이름을 알려 줍니다. 콘솔이 아무것에도 연결되지 않았다고 나열한 스위치는 그렇게 말하며 게이트웨이에 매달지 않습니다. `get_network_events`는 콘솔의 최신 이벤트를 최신순으로, 콘솔 자체의 문장과 콘솔이 부정적이라고 부르는 곳의 경고 플래그, 그리고 이벤트 웹소켓이 살아 있는지 여부와 함께 보여 줍니다. 둘 다 콘솔의 `deviceId`를 받으며 HotLoop이 하나만 읽을 때는 생략할 수 있고, 둘 다 `find_network_client`처럼 드라이버의 마지막 읽기를 읽으므로 콘솔에 비용이 들지 않고 `--mcp-stdio` 헬퍼에서는 같은 말을 합니다. 그 프로세스에서는 읽는 콘솔이 없다는 것입니다. 오래된 이벤트는 `get_logbook`에 있으며, 해당 이벤트가 관련된 스위치나 액세스 포인트 아래에 분류되어 있습니다.

### 로그북

`get_logbook`은 `GET /api/logbook`이 제공하는 타임라인입니다([로그북](/ko/iot/logbook/) 참고). 상태 변경, 쓰기, 알람 전이, 자동화 실행, 구성 변경을 최신순으로 보여 줍니다. `entity`, `equipment`(id, 이름 또는 경로, 그리고 그 아래의 모든 것. 두 노드에 일치하는 이름은 둘 다 나열하는 오류), `actor`(일부: `mcp:`는 모든 에이전트가 한 모든 일을 찾음), `kinds`, 그리고 과거 `minutes`(기본 하루)로 좁힙니다. 뒤에 더 있는 페이지는 다음 페이지를 위해 `before`로 무엇을 넘길지 알려 주며 끝납니다. "이것이 잘못되기 전에 무슨 일이 있었는가"에는 더 나은 `recent_events`입니다. 설비 자체의 상태 변경이 들어 있고, 쓰기 게이트의 줄은 두 번 들어 있지 않습니다.

### 스크립트

스크립트는 누군가 한 번 작성한 이름 있는 단계 순서이며, CIP 사이클이나 라인 퍼지가 그 예입니다. 그래서 에이전트는 절차를 지어내는 대신 공장 고유의 절차를 실행합니다. [스크립트](/ko/iot/scripts/)를 참고하세요. `list_scripts`는 각 스크립트가 받는 것을 알려 줍니다. `run_script`는 `scriptId`, `fields`, **필수** `reason`, 그리고 두 가지 스위치를 받습니다.

- `dryRun: true`는 스크립트를 현재 공장 상태에 대해 훑어보며, 단계별로 무엇이 쓰일지와 게이트가 처음 거부할 것을 게이트의 말로 알려 줍니다. 아무것도 쓰거나 감사하지 않습니다. 이것을 먼저 요청하십시오.
- `wait: true`는 실행이 끝난 뒤에 결과와 추적 정보와 함께 응답합니다. 없으면 응답은 실행 id이며, `list_scripts` 또는 `kinds: ["script"]`를 쓴 `get_logbook`이 어떻게 끝났는지 알려 줍니다.

실행은 소스가 `mcp`인 `script:<id>`로서 스크립트의 것이므로, 실행이 하는 모든 쓰기는 `write_tag`와 똑같이 게이트를 만납니다. 쓰기가 꺼져 있으면(`HOTLOOP_ALLOW_WRITES`) `trigger_automation`처럼 `run_script`도 아무것도 실행하기 전에 거부합니다. 드라이런은 그래도 응답하며 스위치가 이유라고 알려 줍니다.

### 레시피

레시피는 공장이 함께 적용하는 설정값의 집합이며 제품 등급이나 품목 전환이 그 예입니다. 그래서 에이전트는 값을 하나씩 쓰는 대신 공장 고유의 수치를 불러옵니다. [레시피](/ko/iot/recipes/)를 참고하세요. `list_recipes`는 각 레시피의 대상을 순서대로, 그리고 받는 매개변수를 보여 줍니다. `validate_recipe`는 레시피를 지금 적용할 수 있는지 묻고, 적용할 수 없는 모든 이유를 아무것도 쓰지 않고 알려 줍니다. `apply_recipe`는 `recipeId`, `params`, 선택적 `version`, **필수** `reason`을 받습니다.

먼저 전체를 검사하며, 값 하나라도 거부될 것이면 아무것도 쓰지 않고 전체를 거부합니다. 범위를 벗어난 값은 조정되지 않고 거부됩니다. 그 다음 대상이 하나의 호출 id로 순서대로 나가고, 처음 실패한 것이 나머지를 멈추며, 아무것도 되돌리지 않습니다. 응답은 대상별로 무엇이 나갔는지, 장치가 값을 다시 읽었는지 알려 줍니다. 쓰기는 소스가 `mcp`인 에이전트의 것이므로 게이트가 각각에 적용됩니다. 쓰기가 꺼져 있으면(`HOTLOOP_ALLOW_WRITES`) `apply_recipe`는 무엇이든 검사하기 전에 거부합니다. 자체 적용 권한을 지정한 레시피는 그 권한을 부여받은 사람을 위한 것이며, 에이전트는 그에 해당하지 않습니다.

### 블루프린트

블루프린트는 한 번 작성한 규칙에 형식이 있는 빈칸이 들어 있는 것입니다. 어느 모터인지, 얼마 동안인지, 한계는 무엇인지입니다. [블루프린트](/ko/iot/blueprints/)를 참고하세요. `list_blueprints`는 각각이 받는 것을 알려 줍니다. `preview_blueprint`는 `blueprintId`, `automationId`, `inputs`를 받아, 만들어질 규칙과 그 규칙이 지금 발동하면 할 일을 응답하며, 모든 쓰기는 게이트의 검사에 부쳐집니다. 입력은 화면이 검사하는 것과 똑같이 검사되며, 범위를 벗어난 값은 조정되지 않고 거부됩니다.

`instantiate_blueprint`는 블루프린트 화면이 쓰는 경로로 규칙을 만듭니다. 같은 검사를 거치며, 규칙은 에이전트를 만든 주체로 하여 로그북에 기록됩니다. 규칙은 트리거가 발동할 때마다 설비에 명령하라는 상시 지시이므로, 에이전트는 먼저 살펴봅니다. `preview_blueprint`는 아무것도 저장하거나 쓰지 않으며 쓰기가 켜져 있든 아니든 응답합니다. 만들어진 규칙이 이후에 하는 모든 쓰기는 사람이 만든 규칙과 마찬가지로 쓰기 게이트를 만납니다. [구성 변경](#구성-변경)을 참고하세요.

## 구성 변경

에이전트가 읽을 수 있는 것은 무엇이든 바꿀 수 있습니다. 공장을 읽는 위의 도구에는 이를 바꾸는 짝이 69개 있으며, 어느 것도 두 번째 구현이 아닙니다. 각각은 REST API의 경로 하나이고, 호출은 그 경로 자체의 핸들러를 통해 실행됩니다. 검증, 권한 검사, 런타임 다시 불러오기, 감사 줄은 경로의 것이며 에이전트가 행위자입니다(`mcp:<client>`, Vord 로그인이면 `mcp:<email>`). 그래서 드라이버가 없는 장치, 컴파일되지 않는 규칙, 범위를 벗어난 블루프린트 입력, 발견된 장치가 수락되지 않은 태그는 화면이 보여 주는 말로 거부되며 아무것도 바뀌지 않습니다.

각각은 경로의 경로 값을 이름으로(`id`, `device`, `name`...), `body`(API가 받는 것과 같은 JSON, [HTTP API](/ko/iot/api/)에 모든 body가 있음), 그리고 **필수** `reason`을 받습니다. 사유는 경로 자체의 줄 옆에 시스템 로그의 `config` 줄로, 바뀐 대상과 함께 기록됩니다.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

그 앞에 서 있는 것은 `write_tag` 앞에 서 있는 것에서 마스터 스위치를 뺀 것입니다. 화면도 구성을 바꾸는 데 이를 필요로 하지 않기 때문입니다.

1. 기본으로 켜져 있는 `HOTLOOP_ALLOW_MCP_WRITES`가 켜져 있어야 합니다.
2. `HOTLOOP_MCP_OIDC_WRITE_ROLE`이 설정된 호출자는 그 역할을 가지고 있어야 합니다.
3. 호출은 하나의 권한, 즉 경로가 요구하는 권한(아래 표의 세 번째 열)만 가지며 그 외에는 없습니다. 경로는 그 권한이 없는 사람에게 답하는 것과 똑같이 에이전트에게 답하며, 테스트는 표의 모든 행이 실제 경로와 그 경로가 요구하는 권한에 대응하도록 강제합니다.
4. 사유.

설비에 명령하는 것은 여전히 `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation`이며, `HOTLOOP_ALLOW_WRITES`가 켜져 있어야 하고 태그의 쓰기 가능 표시와 범위를 충족해야 합니다. 태그, 규칙, 스크립트, 레시피를 쓰기 가능하게 만드는 것은 구성입니다. 사용되기 전까지는 아무것도 명령하지 않으며, 그때 명령하는 것은 게이트를 거칩니다.

관리자의 고유 기능도 아래의 [관리](#관리)에 있는 도구입니다. 발견된 장치를 수락하는 일은 화면에서처럼 여기에 있으며, 그 장치의 포인트는 여전히 하나씩 쓰기용으로 활성화해야 합니다.

도구는 `--mcp-stdio`에도 있습니다. 프로세스가 같은 API 서버를 만들되 포트는 열지 않습니다.

**장치와 태그**

| 도구 | 경로 | 권한 |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**디스커버리와 브로커**

| 도구 | 경로 | 권한 |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| 도구 | 경로 | 권한 |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**엔티티, 헬퍼, 설비, 레이블**

| 도구 | 경로 | 권한 |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**알람**

| 도구 | 경로 | 권한 |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**자동화와 블루프린트**

| 도구 | 경로 | 권한 |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**스크립트와 레시피**

| 도구 | 경로 | 권한 |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**대시보드와 보드**

| 도구 | 경로 | 권한 |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**가져오기**

| 도구 | 경로 | 권한 |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms`는 CODESYS IDE의 Export Alarms가 쓴 파일을 `contentBase64`(디스크에 있는 그대로의 바이트이며 IDE는 UTF-16으로 씀) 또는 `content`(텍스트로 가지고 있다면 그 텍스트)로 받고, 알람이 속한 `deviceId`, 원하면 `application`과 `defaultPriority`도 받습니다. 그대로 두면 미리 보기만 합니다. 어떤 알람이 넘어오고 어떤 알람이 넘어오지 않을지 알려 주며, 아무것도 저장하지 않고 사유도 필요 없습니다. `apply`가 true이면 알람 정의로 저장하며, 그때는 구성을 바꾸는 모든 도구처럼 사유와 MCP 쓰기 스위치가 필요합니다.

`screen_export`는 대시보드를 HotLoop 화면 파일([화면 파일](/ko/iot/screen-file/))로 응답하고, `screen_import`는 이 설치 또는 다른 설치에서 하나를 가져옵니다. 먼저 묻습니다. `dryRun`은 false라고 하지 않으면 true이며, 드라이런은 아무것도 저장하지 않고 모든 문제가 나열된 보고서와 `remap`을 위한 참조로 응답합니다. 실제 가져오기에는 `dryRun` false, 사유, MCP 쓰기 스위치가 필요하며, 이미 있는 id는 `replace`가 true가 아니면 거부됩니다. 화면은 고객의 데이터이므로 파일이 설치 간에 옮겨지는 방법이며 코드가 되는 일은 없습니다.

### 읽기와 드라이런

대시보드, 브로커, 설비 트리의 노드를 바꿀 수 있는 에이전트는 먼저 무엇이 있는지 읽을 수 있어야 하므로, 위의 도구가 바꾸는 모든 객체에는 여기에 읽기가 있고, 편집기의 드라이런도 도구입니다. 각각은 그 경로가 요구하는 읽기 권한으로 경로 자체의 핸들러를 통해 실행되는 경로 하나입니다. 읽기는 사유도 쓰기 스위치도 없이 응답하며, 쓰기 역할이 제외한 호출자도 읽기 권한만 가지므로 이를 할 수 있습니다. 세 가지 드라이런(`validate_automation`, `validate_script`, `browse_device`)은 아무것도 바꾸지 않습니다. 본문을 검사하는 두 가지는 경로가 요구하는 쓰기 권한을 가지므로 쓰기 역할 뒤에 남습니다.

| 도구 | 경로 | 권한 |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### 관리

사용자 계정, 설정, 백업, 에스컬레이션 정책, 히스토리안 대상, 브로커 로그인, 엣지 릴레이 플릿, 예약 보고서는 관리자의 것이며 이것들도 도구입니다. 나머지와 같은 패턴으로 42개입니다. 각각은 그 경로가 요구하는 권한(`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...)으로 경로 자체의 핸들러를 통해 실행되는 경로 하나이며, 모든 변경에 사유가 있고 감사 줄에 에이전트가 있습니다. 거부하는 경로는 에이전트도 같은 말로 거부합니다. 읽기(`list_`와 `get_` 도구)에는 사유도 쓰기 스위치도 필요 없지만, 이들이 가진 권한이 관리자 권한이므로 설정된 경우 호출자의 쓰기 역할은 여전히 필요합니다. 플릿과 보고서 도구는 그 기능이 있는 제품에만 있습니다.

두 가지는 경로 자체의 것이므로 도구에 의존하기 전에 알아 둘 만합니다.

- **쓰기 스위치에는 경로가 없습니다.** `safety.allowWrites`와 `safety.allowMcpWrites`는 배포의 것(`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`)이며, `PUT /api/settings`는 배포가 설정한 것으로서 이를 거부합니다. 그래서 `save_settings`는 설정 화면이 바꿀 수 있는 것을 바꾸고, 스위치에 대해서는 그 거부를 그 말 그대로 응답합니다. 에이전트는 자신의 쓰기가 기다리는 스위치를 켤 수 없습니다.
- **사용자의 비밀번호는 호출을 통해 전달됩니다.** `create_user`, `reset_user_password`, PIN 도구는 API처럼 인수로 비밀을 받습니다. 감사 줄에는 변경과 사유가 기록되고 비밀은 절대 기록되지 않습니다.

**사용자 계정**

| 도구 | 경로 | 권한 |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**설정, 백업, 알림**

| 도구 | 경로 | 권한 |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**히스토리안 대상과 브로커 로그인**

| 도구 | 경로 | 권한 |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**엣지 릴레이 플릿 (Gateway)**

| 도구 | 경로 | 권한 |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**예약 보고서 (Gateway)**

| 도구 | 경로 | 권한 |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## 리소스

| URI | 내용 |
|---|---|
| `iiot://devices` | 태그가 포함된 장치 트리, JSON |
| `iiot://tags` | 현재 값이 포함된 태그 카탈로그 |
| `iiot://alarms` | 알람 정의, 실시간 상태, 상태 참조 |
| `iiot://protocols` | 컴파일된 드라이버에서 가져온 지원 프로토콜 |

리소스는 클라이언트가 도구 호출 한 번씩 발견하는 대신 전체 네임스페이스를 한 번의 읽기로 가져오게 하려고 존재합니다.

## 도구가 하지 않는 일

도구는 모델이 실수로 불확실성을 반올림할 수 없도록 작성되었습니다.

**읽은 값이 없는 태그는 0을 읽는 태그가 아닙니다.** `read_tag`는 `no reading has been taken for this tag yet`라고 하거나, 태그가 없으면 `this tag is not configured`라고 합니다. 어느 쪽도 값을 반환하지 않습니다.

**불량 품질은 암시되지 않고 명시됩니다.** 읽기 값은 `[quality: bad (the value is NOT known; do not treat it as a measurement)]` 형태로 돌아옵니다. 서버 지침도 이를 반복합니다. 불량 읽기 값을 평균 내지 말고 하나를 측정값으로 보고하지 마십시오.

**`describe_protocol`은 거짓말을 할 수 없습니다.** 가용성은 바이너리에 컴파일된 드라이버에서 오므로, 게이트웨이에 없는 프로토콜을 도구가 있다고 말할 수 없습니다.

**거부는 응답이지 전송 실패가 아닙니다.** 거부된 쓰기는 `isError`가 있는 도구 결과로 돌아오며, 이는 호출 형식은 올바랐고 의도적으로 거절되었다는 뜻입니다. 재시도해야 하는 프로토콜 오류가 아닙니다.

## 쓰기

MCP는 읽고 씁니다. 설비에 명령하고 구성을 바꿉니다([위](#구성-변경)). `write_tag`는 실제 설비를 움직이므로, 운전원의 클릭과 기계 사이에 있는 것과 같은 것들이 도구 호출과 기계 사이에도 있습니다.

1. 배포 전체의 마스터 스위치인 `HOTLOOP_ALLOW_WRITES`가 켜져 있어야 합니다. 꺼져 있으면 UI도, API도, 에이전트도 아무것도 쓰지 못합니다.
2. 태그는 쓰기 가능으로 표시되어 있어야 합니다. 태그는 누군가 달리 말하기 전까지 읽기 전용이며, 하나씩 바꿉니다.
3. 값은 태그의 구성된 범위 안에 있어야 합니다. **거부되며 잘라 내지 않습니다.** 500을 요청했는데 400을 보내는 것은 요청과 다른 일을 조용히 하는 것이기 때문입니다.

**사유는 필수**이며 쓰기 옆에 기록됩니다. 6개월 뒤에 아무도 해석할 수 없는 감사 행은 없는 것과 거의 다를 바 없습니다.

`call_service`는 정확히 같은 세 가지를 받습니다. 같은 게이트를 통과하는 쓰기일 뿐이기 때문이며, 그 위에 엔티티 자체의 검사(숫자의 단계와 더 좁은 범위, 텍스트의 패턴, 엔티티가 비활성화되지 않았을 것)가 더해집니다. 어느 단계에서든 거부되면 태그뿐 아니라 엔티티에 대해서도 감사됩니다. 소스 `mcp`, 이름으로 표시된 클라이언트, entity_id, 서비스, 호출 id로, 거부된 `write_tag`가 남기는 것과 같은 행에 엔티티가 더해진 것입니다. 사유가 없는 호출은 `write_tag`처럼 무엇이든 시도하기 전에 거부됩니다.

`trigger_automation`도 똑같이 게이트를 거칩니다. 규칙의 동작이 설비에 명령할 수 있기 때문이며, 그렇지 않으면 `write_tag`가 만나는 검사를 우회하는 방법이 될 것입니다.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

쓰기가 꺼져 있으면 서버 지침이 처음부터 그렇게 알려 주므로, 에이전트가 이를 알아내느라 한 턴을 낭비하지 않습니다.

## 외부 호출

자동화의 `mcp_call` 동작은 다른 MCP 서버의 도구를 호출합니다. 차트에서 서버를 구성하십시오.

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

세션은 풀로 관리되고 재사용됩니다. 호출마다 연결하면 규칙이 발동할 때마다 핸드셰이크, initialize, 도구 목록이 필요해질 것입니다. 끊어진 세션은 타이머가 아니라 다음 호출 때 다시 연결됩니다. 다음 호출이 누군가 신경 쓰는 첫 순간이기 때문입니다. 구성된 서버가 다운되어도 공장 모니터링은 멈추지 않으며, 규칙이 필요로 하기 전에는 아무것도 연결하지 않습니다.

MCP 화면은 구성된 각 서버와 연결 여부, 서버가 알리는 도구를 보여 줍니다.

## 사이트 연합

공장마다 게이트웨이 하나가 이 시스템이 운영되도록 의도된 방식입니다. 각 사이트는 자체 데이터베이스, 자체 보드, 자체 이름을 유지하며, 어느 것도 다른 곳으로의 링크가 유지되는 데 의존하지 않습니다. WAN이 끊겼다고 공장 모니터링이 멈추지 않습니다.

모두를 한꺼번에 보는 데는 사이트들이 이미 사용하는 프로토콜을 씁니다. 클라우드의 게이트웨이를 사이트들을 아웃바운드 MCP 서버로 하여 구성하십시오. `mcp_call` 동작과 똑같습니다.

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

그러면 사이트 화면이 각 사이트에서 병렬로 `get_plant_status`를 호출하고 응답을 취합합니다. 사이트에 나타나기 위해 배포할 것은 없고, 사이트가 연합되어 있음을 알 필요도 없으며, 공장 네트워크로 들어오는 연결도 없습니다.

두 가지 동작은 의도된 것이며 믿어도 됩니다.

- 응답하지 않는 사이트는 **연결할 수 없음과 그 이유**로 표시되고 취합에서 제외됩니다. 도달할 수 없는 공장을 알람 0건으로 세는 것은 이런 화면이 할 수 있는 가장 나쁜 일입니다.
- 사이트가 마지막으로 보고한 숫자는 절대 표시되지 않습니다. 현재 값처럼 보이지만 그렇지 않기 때문입니다.

각 사이트에는 자체의 짧은 제한 시간이 있으므로, 끊어진 링크의 공장 하나가 살아 있는 공장들을 붙잡을 수 없습니다.

## 에이전트에게 알려 줄 만한 것

서버 자체의 지침이 이를 다루지만, 이를 중심으로 프롬프트를 작성하는 사람을 위해 적습니다.

- 알람 상태는 ISA-18.2를 따릅니다. `rtn-unack`은 아무도 보기 전에 스스로 정상 복귀한 알람을 뜻하며, 여전히 보고할 가치가 있고, 확인과 정상 복귀가 서로 독립적임을 증명하는 상태입니다.
- 몇 분보다 긴 기간에는 원시 값이 아니라 버킷을 쓰는 `query_history`를 쓰십시오. 1초 단위 데이터 하루는 태그당 86,400개의 점입니다. 버킷은 품질 규칙을 따릅니다. 불량 및 불확실한 읽기 값은 `badReadings`에 집계되고 평균에는 절대 들어가지 않으며, 좋은 값이 없는 버킷의 평균은 null입니다.
- `recent_events`는 사건을 재구성하는 방법입니다. 장치 연결, 쓰기, 알람 전이, 자동화 실행, 구성 변경이 순서대로, 각각 그것을 일으킨 행위자와 함께 나옵니다.
