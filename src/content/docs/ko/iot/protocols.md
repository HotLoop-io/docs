---
title: "프로토콜과 드라이버"
description: "OPC UA, Modbus, MQTT와 Sparkplug B, EtherNet/IP, S7comm, MTConnect, HTTP를 지원하며, 각 드라이버의 실제 장비 검증 범위를 설명합니다."
---

:::note[앞으로 나올 내용 포함]
이 페이지에는 최신 릴리스인 HotLoop core 4.24.0보다 새로운 내용도 일부 들어 있습니다. 설치하신 버전에는 없는 부분이 있을 수 있습니다. 무엇이 바뀌었는지는 [릴리스 노트](/ko/releases/)에 나와 있습니다.
:::

이 문서는 게이트웨이가 정확히 어떤 프로토콜을 사용하는지, 각 드라이버를 어디까지 검증했는지, 그 밖의 프로토콜은 어떻게 해야 하는지를 설명합니다. 가장 먼저 읽을 문서이며, 다른 내용과 다를 때 이 문서를 기준으로 삼으십시오.

네이티브 프로토콜 목록은 바이너리에 컴파일된 드라이버에서 만들어집니다. `/api/protocols`, 프로토콜 화면, MCP `describe_protocol` 도구가 모두 같은 레지스트리를 읽으므로, 카탈로그에는 바이너리에 없는 프로토콜이 나오지 않습니다.

## 검증 상태

HotLoop이 네이티브로 지원하는 모든 프로토콜은 실제 서버나 장치에서 실제 값을 가져왔고 베어메탈에서 실행되었습니다(2026-11-17). 독립된 구현이 있는 경우에는 양방향으로 HotLoop을 실행해 확인했습니다.

| 프로토콜 | 네이티브 | 상태 |
|---|---|---|
| Modbus TCP/RTU | 예 | **실제 장비로 검증됨** |
| OPC UA | 예 | **실제 장비로 검증됨**. 보안 채널에서 사용자 이름과 비밀번호를 사용한 Ignition 8.3.9와의 양방향 연동 포함 |
| MQTT / Sparkplug B | 예 | **실제 장비로 검증됨** |
| MTConnect | 예 | **실제 장비로 검증됨** |
| HTTP / REST | 예 | **실제 장비로 검증됨** |
| S7comm | 예 | **실제 장비로 검증됨**(베어메탈, 2026-11-17) |
| EtherNet/IP | 예 | **실제 장비로 검증됨**(베어메탈, 2026-11-17) |
| UniFi Network | 예 | **실제 장비로 검증됨**. 읽기 전용이며, 실제 콘솔과 스위치에서 WAN과 페일오버까지 확인 |
| SNMP | 예 | **실제 장비로 검증됨**. 읽기 전용이며, v1, v2c, v3의 모든 보안 수준에서 확인 |
| CODESYS | 예 | **실제 장비로 검증됨**. 읽기와 쓰기 모두 확인했고, 변수 10만 개가 넘는 프로그램을 2.4초에 읽음 |
| BACnet/IP | 예 | **실제 장비로 검증됨**. 읽기 전용 |
| OPC UA PubSub (UADP) | 예 | **실제 장비로 검증됨**. 양방향 |
| Kafka API (출력) | 예 | Apache Kafka와 Redpanda에서 TLS와 SASL 로그인으로 **실제 장비로 검증됨** |

벤더마다 기본값이 다릅니다. OPC UA 서버가 제공하는 인증서와 토큰 정책, BACnet 컨트롤러가 객체 목록에 넣는 내용, SNMP 장치가 제공하는 MIB, PLC가 데이터에 번호를 매기는 방식이 모두 다릅니다. 새 현장의 새 장치는 여전히 시운전 작업이므로, 화면을 믿기 전에 통합의 프로브에서 읽은 값을 장치 자체 표시와 비교해 보십시오.

## 네이티브 프로토콜

### OPC UA

장치가 여러 방식을 제공한다면 이 프로토콜을 우선 사용하십시오. 탐색(browse)이 되고, 보안이 제대로 갖춰져 있으며, 구독을 지원합니다.

드라이버는 폴링하지 않고 **구독합니다**. 서버는 값이 바뀔 때 자신이 감당할 수 있는 속도로 값을 보냅니다. 클라이언트가 변화가 있는지도 모르는 채 매 스캔마다 같은 질문을 반복하는 방식이 아닙니다. 서버가 구독을 거부하면 드라이버는 장치를 실패 처리하지 않고 묶음 읽기로 전환합니다.

구독이 아무것도 전달하지 않을 때도 읽기로 전환합니다. 서버는 첫 번째 publish에서 모든 노드의 현재 값을 보내고, 이후에는 값이 바뀔 때까지 다시 보내지 않습니다. 따라서 첫 publish를 놓치면 세션이 유지되는 동안 설정값이 계속 bad로 읽힙니다. 게시 간격의 열 배(최소 5초)가 지나도록 구독에서 값이 오지 않으면 드라이버는 경고를 기록하고, 구독을 삭제한 뒤, 장치가 다시 연결될 때까지 매 폴링마다 태그를 읽습니다. 이 드라이버가 기반으로 하는 OPC UA 클라이언트 라이브러리는 부하가 큰 호스트에서 publish 루프가 멈춘 채 시작되어 publish 요청을 한 번도 보내지 않을 수 있으며, 이 기능은 그런 경우를 위한 것입니다.

값이 도착한 뒤에 구독이 멈추는 경우에도 읽기로 전환합니다. 라이브러리는 keep-alive를 내부에서만 처리하므로, publish 루프가 멈춘 상태는 공장에서 아무것도 바뀌지 않는 상태와 똑같아 보입니다. 구독이 게시 간격의 열 배(최소 30초) 동안 조용하면, 드라이버는 모든 노드를 한 번 읽어 구독이 마지막으로 전달한 값과 비교합니다. 값이나 품질이 다른 노드가 하나라도 있으면 서버가 보냈어야 할 것을 쥐고 있다는 뜻이므로, 드라이버는 경고를 기록하고 구독을 삭제한 뒤 장치가 다시 연결될 때까지 매 폴링마다 읽습니다. 모두 일치하면 그대로 계속하고, 같은 시간이 지나면 다시 확인합니다. 정상적으로 조용한 구독의 비용은 30초마다 묶음 읽기 한 번입니다.

**노드는 네임스페이스 URI로 지정하십시오.** 보이는 것보다 훨씬 중요합니다.

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

네임스페이스 *인덱스*는 서버가 네임스페이스를 로드하는 순서대로 할당됩니다. 네임스페이스를 추가하거나 펌웨어를 올리면 인덱스 3이 조용히 다른 것이 되고, 어디에도 오류가 없는 채로 모든 읽기 값이 틀려집니다. URI는 모델의 일부이므로 바뀌지 않습니다. `Browse`가 URI 형식을 돌려주는 것도 이 때문입니다.

문자열만 쓴 주소는 거부됩니다. `ns=0;s=Temperature`처럼 읽으면 오타도 깔끔하게 파싱되어 존재하지 않는 노드가 되고, 태그는 영원히 bad로 읽힙니다. 저장할 때 실수가 드러나도록 명시적인 형식을 요구합니다.

**Discover tags는 서버가 알려 주는 노드의 타입으로 각 태그를 선언합니다.** Boolean은 `bool`, 정수 타입은 폭을 유지하며(`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`. SByte와 Byte는 한 단계 큰 크기), Float와 Double은 `float`, String, DateTime, LocalizedText 등 드라이버가 텍스트로 읽는 타입은 `string`입니다. 서버가 알려 주지 않는 타입이나 더 알맞은 이름이 없는 타입(열거형, 구조체)은 `float`로 남습니다. 아래 Ignition 작업 이전에는 발견된 모든 태그가 `float`였습니다. 드라이버는 String 노드의 텍스트를 읽기는 했지만 태그는 float라고 했고, 게이트웨이 자체 OPC UA 서버는 태그를 선언된 타입으로 게시하므로 그 서버의 클라이언트는 `Bad_TypeMismatch`를 받았습니다. Ignition에서 Emberburn의 `System_Status`가 바로 그렇게 보였습니다. 수정 전에 가져온 태그는 타입이 그대로이므로, 텍스트 태그는 직접 `string`으로 바꾸십시오.

설정: 보안, ID, 인증서 옵션은 [OPC UA: 보안과 자격 증명](#opc-ua-보안과-자격-증명)에 설명되어 있습니다. 나머지는 `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot`, `browseServerNodes`입니다. 드라이버가 모르는 옵션 이름은 조용히 무시되지 않고, 아는 옵션을 나열한 오류가 됩니다. `securityMode`를 잘못 쓰면 보안 없이 연결되어 정상 장치와 똑같아 보일 수 있기 때문입니다.

**Discover tags는 서버 자체의 `Server` 객체를 제외합니다**(`i=2253`: 상태, 기능, 진단, 네임스페이스 배열, 구성). 모든 OPC UA 서버에 있으며, 공장 자체의 변수 사이에 수백 개가 섞일 수 있습니다. 장치에서 `browseServerNodes`를 `true`로 설정하면 다시 포함되고, `browseRoot`를 `i=2253`으로 설정하면 의도적으로 그 안을 볼 수 있습니다. 거기서 시작한 탐색은 끝까지 따라갑니다.

### OPC UA: 보안과 자격 증명

4.15.0 이전의 드라이버는 익명의 비보안 연결만 만들 수 있었고, 사양을 따르는 서버에는 연결하지도 못했습니다. 서버가 제공하는 ID 토큰 정책을 묻지 않고 빈 토큰 정책 ID를 보냈기 때문이며, 규격을 지키는 서버는 이를 거부합니다. HotLoop 자체의 OPC UA 서버도 마찬가지였습니다. 지금 드라이버는 서버의 엔드포인트를 찾아 장치에 맞는 것을 고르고, 그 엔드포인트가 나열한 정책 ID를 그대로 보냅니다.

#### 장치 옵션

| 옵션 | 기본값 | 동작 |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign`, `SignAndEncrypt`. `None`이 아닌 `securityPolicy`와 함께 생략하면 `SignAndEncrypt`입니다. |
| `securityPolicy` | 해당 모드에서 서버가 제공하는 가장 좋은 것 | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep`, `Aes256_Sha256_RsaPss`. `Basic128Rsa15`와 `Basic256`은 거부됩니다. |
| `username`, `password` | 익명 | 사용자 이름 인증. |
| `userCertificate`, `userPrivateKey` | 없음 | X.509 사용자 인증: 세션은 서버가 이 인증서에 매핑한 사용자로 로그인하며 비밀번호는 필요 없습니다. 둘 다 PEM이며 함께 설정합니다. 키는 RSA이고(OPC UA 라이브러리는 RSA로만 서명하므로 EC 키는 그 사유와 함께 거부됩니다) 비밀번호처럼 시크릿입니다. 저장 시 봉인되고, 모든 API 응답에서 가려지며, 로그에 남지 않습니다. 인증서는 사용자의 것이며 `certFile`의 클라이언트 애플리케이션 인증서가 아닙니다. `username`도 설정하면 인증서가 사용됩니다. HotLoop 자체 서버에서는 먼저 인증서를 사용자에게 연결해야 합니다([OPC UA 서버](/ko/edge/opc-ua-server/#x509-사용자-인증서)). |
| `allowInsecureCredentials` | `false` | 비보안 채널(`securityMode` `None`)이나 아무것도 암호화하지 않는 경우에 비밀번호를 보내도록 허용합니다. |
| `certFile`, `keyFile` | 생성됨 | 보안 모드에서 쓰는 이 클라이언트의 애플리케이션 인증서와 RSA 키. 둘 다 설정하거나 둘 다 설정하지 않습니다. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | 생성된 인증서와 `trusted/`, `rejected/` 저장소가 있는 위치. |
| `serverCertThumbprints` | 없음 | `trusted/`에 파일이 없어도 신뢰할 서버 인증서의 SHA-1(16진수 40자리) 또는 SHA-256(64자리) 지문. 콜론과 공백은 무시됩니다. |
| `insecureSkipVerify` | `false` | 모든 서버 인증서를 받아들입니다. |

이 옵션을 하나도 설정하지 않은 장치는 예전과 같습니다. 익명이며 비보안 채널을 사용합니다.

#### 드라이버가 엔드포인트를 고르는 방법

드라이버는 비보안 채널에서 서버의 엔드포인트를 묻습니다. 사양은 서버가 탐색을 위해 이를 허용하도록 요구하며, 엔드포인트 목록은 원래 공개 정보이므로 비밀이 오가지 않습니다. 그중 보안 모드와 정책이 장치와 맞는 엔드포인트를 남기고, 그 가운데 장치의 ID에 맞는 토큰 정책(익명, 또는 `username`을 설정한 경우 사용자 이름)을 고릅니다. 이후 보내는 ID 토큰에는 그 엔드포인트가 나열한 정책 ID가 들어가며, 빈 ID는 절대 보내지 않습니다.

- **`Basic128Rsa15`와 `Basic256`은 절대 선택하지 않습니다.** 둘 다 OPC Foundation에서 더 이상 권장하지 않습니다. 서버가 순위를 매기는 방식대로 둘 중 하나가 목록에서 가장 높은 보안 수준을 가진 경우에도, 서버가 제공하는 것이 그것뿐인 경우에도 마찬가지이며, 후자에서는 그 사실을 알리는 오류와 함께 연결이 실패합니다. 장치를 이 정책을 쓰도록 설정할 수 없고, 비밀번호를 이 정책으로 암호화하게 되는 토큰 정책도 거부됩니다. HotLoop 자체 서버는 최신 정책과 함께 이 두 가지도 제공하며 끌 수 없으므로, 실제 서버를 상대로 이를 검증하고, 드라이버가 보내는 내용에 두 정책의 URI가 나타나지 않는지 테스트로 확인합니다.
- **장치가 정책을 지정하지 않으면 `Basic256Sha256`, 그다음 `Aes128_Sha256_RsaOaep`, 그다음 `Aes256_Sha256_RsaPss` 순으로 선호합니다.** 서버가 매긴 보안 수준과는 무관합니다. 순서는 강도가 아니라 얼마나 널리 동작하는지로 정했습니다. 일부 서버는 `Aes256_Sha256_RsaPss`로 채널을 열지 못하고 이유도 알리지 않은 채 연결을 닫으므로, 장치가 이름을 지정할 때만 사용합니다.
- **일치하는 것이 없으면 오류에 서버가 제공하는 목록이 나옵니다.** 각 엔드포인트의 정책과 토큰 정책 ID가 포함되므로, 메시지만 보고 설정을 고칠 수 있습니다.

#### 클라이언트 자체 인증서

모든 보안 모드에는 애플리케이션 인증서가 필요합니다. 장치에 `certFile`과 `keyFile`이 지정되어 있으면 검사(RSA, 2048비트 이상, 만료되지 않음)를 거친 뒤 그대로 사용합니다. 그렇지 않으면 처음 사용할 때 자체 서명 인증서를 생성해 PKI 디렉터리에 보관합니다. RSA-2048, 5년, 주체 대체 이름에 애플리케이션 URI `urn:hotloop:client:<host name>`, 키는 모드 `0600`, 인증서는 `0644`, 디렉터리는 `0750`입니다. 구조는 OPC UA 서버와 같습니다.

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

일반적인 시작에서는 다시 생성하지 않으므로, 이 인증서를 신뢰하도록 설정된 서버에 다시 알릴 필요가 없습니다. 읽을 수 없거나, 2048비트 이상의 RSA가 아니거나, 남은 기간이 30일 미만일 때만 교체하며, 이때는 모든 서버가 새 인증서를 승인해야 한다는 경고를 남깁니다. 같은 순간에 시작하는 장치들은 각자 쓰지 않고 인증서 하나를 공유합니다.

디렉터리는 쓰기가 가능하고 영구적이어야 합니다. Helm 차트에서는 `opcuaClient.persistence.enabled`가 그 설정이며(기존 설치에 볼륨이 추가되므로 기본값은 꺼짐), Edge Relay에서는 기존 `/data` 볼륨입니다. 쓸 수 있는 디렉터리가 없으면, 다음 재시작에서 사라질 인증서로 연결하는 대신 보안 장치가 설정할 변수 이름을 알리는 오류를 보고합니다.

**서버**도 이 인증서를 신뢰해야 하며, 이는 서버 자체의 설정입니다. HotLoop 자체 서버에서는 같은 방법입니다. 첫 시도가 거부된 뒤 드라이버의 인증서가 서버의 `rejected/` 디렉터리에 나타나고, 이를 `trusted/`로 옮기면 승인됩니다. 서버가 보안 채널을 여는 도중 연결을 닫는 경우(많은 서버가 신뢰하지 않는 인증서를 이렇게 거절합니다), 오류에 이 클라이언트의 인증서 파일과 지문이 표시되므로 운영자가 서버에서 무엇을 찾아야 하는지 알 수 있습니다.

#### 서버 인증서 승인

보안 모드이거나 서버의 키로 암호화해서 보낼 비밀번호가 있는 경우, **드라이버는 서버가 내미는 인증서를 무조건 받아들이지 않습니다.** 장치의 `serverCertThumbprints`에 고정되어 있거나 `trusted/`에 있는 정확히 같은 인증서일 때만 신뢰합니다. 그 외에는 `rejected/<thumbprint>.der`에 기록되고, 자격 증명이 전송되기 전에 다음과 같은 메시지와 함께 연결이 실패합니다.

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

승인하기 전에 서버 자체 화면에서 지문을 확인하십시오. 이 비교가 신뢰 결정의 전부입니다. 그런 다음 파일을 `trusted/`로 `mv`하면(PEM과 DER 파일 모두 읽습니다) 런타임의 재연결 간격 안에 있는 다음 시도에서 장치가 연결됩니다. 몇 가지 세부 사항입니다.

- 신뢰는 체인이 아니라 정확한 인증서 단위입니다. CA가 발급한 인증서를 가진 서버도, 자체 서명 인증서와 마찬가지로 그 서버의 인증서를 `trusted/`에 넣어 승인합니다. CA를 신뢰하는 것은 지원하지 않습니다.
- 만료되었더라도 운영자가 승인한 인증서는 계속 신뢰하며, 연결할 때마다 로그에 경고를 남깁니다. 운영자가 의도적으로 승인한 것을 거부하면 `insecureSkipVerify` 쪽으로 몰아갈 뿐입니다.
- `trusted/`에 있는 파일이 인증서가 아니면 건너뛰고 보고하며, 승인된 다른 서버들이 연결되지 않게 만들지 않습니다.
- `rejected/`에는 최대 256개 파일을 보관하므로, 연결할 때마다 다른 인증서를 내미는 서버가 디스크를 채울 수 없습니다. 그 이상에서도 연결은 계속 거부되며, 메시지에 파일이 보관되지 않았다는 점과 그래도 인증서를 승인하는 방법이 나옵니다.
- `insecureSkipVerify`는 검사를 끕니다. 그러면 경로 중간의 제3자가 서버를 가장하고 서버로 보내는 내용을 비밀번호까지 읽을 수 있습니다. 기본값은 꺼짐이며, 연결할 때마다 인증서 지문과 함께 경고합니다.

보안 채널이 아닌 익명 장치에는 서버 키로 서명하거나 암호화하는 것이 없으므로 이 모든 것이 필요하지 않습니다.

#### 자격 증명

채널이 보안 처리되어 있고 비밀번호를 암호화하는 수단이 있지 않으면, 비밀번호는 전송되기 전에 거부됩니다. 드라이버는 일치한 엔드포인트에서 서버가 제공하는 것을 보고 다음과 같이 판단합니다.

| 채널 | 서버의 사용자 이름 토큰 정책 | 결과 |
|---|---|---|
| `SignAndEncrypt` | 비밀번호를 암호화함(일반적인 경우) | 연결됨 |
| `SignAndEncrypt` | 암호화하지 않음 | 연결됨: 암호화된 채널이 전달하며, 로그에 그렇게 기록됨 |
| `Sign` | 비밀번호를 암호화함 | 연결됨 |
| `Sign` | 암호화하지 않음 | `allowInsecureCredentials`가 없으면 **거부됨**. `Sign`은 메시지를 인증하지만 숨기지는 않습니다. |
| `None` | 비밀번호를 암호화함 | `allowInsecureCredentials`가 없으면 **거부됨**. 비보안 채널에서는 비밀번호를 암호화하는 키가 아무것도 인증하지 않는 응답에서 오므로, 트래픽을 바꿀 수 있는 사람이면 누구나 비밀번호를 복구할 수 있습니다. 이 옵션을 켜면 경고와 함께 연결됩니다. |
| `None` | 암호화하지 않음 | `allowInsecureCredentials`가 없으면 **거부됨** |

**`securityMode`가 `None`일 때의 사용자 이름은 서버의 토큰 정책이 비밀번호를 암호화하더라도 거부됩니다.** 공격자가 키를 정할 수 있는 암호화는 그 공격자에 대한 보호가 되지 못합니다. 비보안 채널에서 비밀번호를 암호화하는 인증서는 `CreateSession`에 대한 서버의 응답에서 가져오는데, 이 응답은 아무것도 인증하지 않습니다(아래 테스트는 인증서를 바꿔 넣고 비밀번호를 복구합니다). 오류 메시지는 이 점을 설명하고 해결 방법인 `securityMode` `SignAndEncrypt`를 알려 줍니다. 익명 세션은 영향을 받지 않습니다.

`allowInsecureCredentials`는 비밀번호가 그런 조건에서 전송되게 하는 유일한 스위치입니다. 기본값은 꺼짐이며, 이 옵션 때문에 연결이 허용되었을 때는 연결할 때마다 경고합니다. 토큰 정책이 비밀번호를 암호화하는 경우, 이 옵션은 도청하는 쪽이 읽을 수 있는 것을 바꿀 뿐 트래픽을 변조하는 쪽이 읽을 수 있는 것은 바꾸지 못합니다. [네트워크에 오가는 것](#네트워크에-오가는-것)을 참조하십시오. 이 옵션을 켜도 비밀번호가 서버 인증서로 암호화되는 경우에는 먼저 서버 인증서를 승인해야 합니다.

비밀번호는 드라이버와 API가 다루는 모든 곳에서 시크릿입니다.

- **API 응답.** 장치를 돌려주는 모든 응답(`GET /api/devices`, `GET /api/devices/{id}`, 저장 응답)에서 `[redacted]`로 대체되므로, `devices.read`를 가진 뷰어는 읽을 수 없습니다. 4.15.1부터는 관리자를 포함한 모든 역할에 적용되며, 이 프로토콜뿐 아니라 모든 프로토콜의 자격 증명에 적용됩니다. 자리 표시자를 그대로 두고 장치를 저장하면 저장된 비밀번호가 유지되고, 새 값은 그것을 교체하며, 빈 문자열은 지웁니다. 비밀번호가 없는 장치에 자리 표시자를 넣으면 저장되지 않고 거부됩니다. 필드를 생략하면 이제 유지됩니다(4.15.0에서는 지워졌습니다). 전체 규칙은 [인증과 사용자](/ko/iot/authentication/#장치-자격-증명은-쓰기-전용입니다)에 있습니다. 웹 UI의 장치 편집기는 API가 돌려주는 대로 설정을 보여 주고 보이는 그대로 저장하는데, 이 경우를 처리하므로 장치를 편집해도 비밀번호를 잃지 않습니다. (테스트는 브라우저가 아니라 API로 이를 확인합니다.)
- **로그와 오류.** 드라이버의 로그 줄과 반환하는 오류 어디에도 비밀번호가 들어 있지 않습니다. 메시지는 상태 코드와 장치의 비밀이 아닌 설정으로 만듭니다. 테스트는 프로세스 로그, 서버 로그, 오류를 수집해 그 모두에서 비밀번호를 검색합니다.
- **MCP 도구와 리소스, 실시간 이벤트 스트림, 시스템 로그.** 어느 것도 장치의 설정을 돌려주지 않으며(각각 정해진 필드로만 장치를 설명합니다), 테스트는 비밀번호를 설정한 상태에서 모든 도구와 리소스를 호출하고, 스트림을 열고, 시스템 로그를 읽어도 어디에서도 찾을 수 없음을 확인합니다.
- **데이터베이스와 백업.** 비밀번호는 다른 드라이버와 마찬가지로 장치의 `config` 열에 저장됩니다. 4.16.0까지는 평문이며 백업에도 들어 있습니다. 4.17.0부터는 데이터베이스 밖에 보관된 키로 암호화되므로(아래 "저장 시 암호화" 참조) 덤프나 백업에는 암호문만 있습니다. 어느 쪽이든 [백업과 복원](/ko/iot/backup/#백업-파일-보호)을 참조하여 데이터베이스와 백업 볼륨을 그에 맞게 보호하십시오.
- **Edge Relay.** 장치 파일에도 비밀번호가 들어갑니다. Helm 차트에서는 자격 증명이 있는 장치 파일을 Secret에 넣고 `devicesSecret`에 이름을 지정하십시오. 차트 values에 직접 설정한 장치는 ConfigMap에 들어갑니다. 플릿 설정 푸시로 보낸 장치 파일은 MQTT 토픽에 retained로 게시되므로, 브로커는 TLS를 사용하고 그 토픽을 읽을 수 있는 대상을 제한해야 합니다.

비밀번호가 틀리면 드라이버 안에서 멈춤이나 재시도 없이 한 번의 시도로 명확한 오류가 납니다.

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

그러면 런타임은 평소의 재연결 백오프(`HOTLOOP_RECONNECT_MAX`, 기본 60초)를 따르지 않고 다음 시도까지 **10분**(5분에서 10분 사이로 흔들림)을 기다립니다. 거부된 로그인은 네트워크 장애보다 반복 비용이 크기 때문입니다. 몇 번 실패하면 계정을 잠그는 서버에서는 빠른 재시도가 그 계정을 쓰는 모든 사람에게 장애가 됩니다. 또 거부된 로그인마다 서버에 **생성되었지만 활성화되지 않은 세션**이 남을 수 있고, 이는 타임아웃될 때까지 세션 한도에 포함됩니다(라이브러리는 20분을 요청하며 `sessionTimeoutMs`로 바꿀 수 있습니다). HotLoop 자체 서버에서는 비밀번호가 틀린 장치가 몇 초마다 재시도하자 기본 한도인 세션 20개가 가득 찼고, 이후 서버가 다른 모든 클라이언트를 `BadTooManySessions`로 거부했습니다. 세션 테이블이 작은 컨트롤러는 이보다 더 취약합니다. 장치는 재시도를 멈추지 않으므로 서버 쪽에서 비밀번호가 수정되면 누구도 HotLoop을 만지지 않아도 10분 안에 복구되며, 장치의 비밀번호를 고치거나 껐다 켜면 새 워커가 시작되어 즉시 시도합니다.

#### 네트워크에 오가는 것

추론이 아니라 측정한 결과입니다. 테스트는 드라이버와 서버 사이에 기록용 프록시를 두고 양방향의 모든 바이트를 검색합니다. 이 검색은 분명히 있는 바이트(평문으로 전송되는 서버의 엔드포인트 목록)를 찾아내며, 이것이 프록시가 대화를 기록했다는 증거입니다.

| 구성 | 비밀번호 | 사용자 이름 | 태그 노드 ID와 값 |
|---|---|---|---|
| `SignAndEncrypt` | 보이지 않음 | 보이지 않음 | 보이지 않음 |
| `Sign` | 보이지 않음(토큰 정책이 암호화) | **읽을 수 있음** | **읽을 수 있음** |
| `None`, 사용자 이름, 서버의 토큰 정책이 암호화(`allowInsecureCredentials` 필요) | 보이지 않음 | **읽을 수 있음** | **읽을 수 있음** |
| `None`, 익명 | 해당 없음 | 해당 없음 | **읽을 수 있음** |
| 암호화되지 않은 비밀번호를 제공하는 서버, `allowInsecureCredentials` 사용 | **읽을 수 있음** | **읽을 수 있음** | 모드에 따라 다름 |

마지막 행은 실제로는 그렇게 제공하지 않는 서버를 대상으로 테스트합니다. 실제 서버 앞에 있는 제3자가, 아무것도 인증하지 않는 탐색용 채널에서 엔드포인트 목록을 고쳐 비밀번호가 암호화되지 않는다고 말하게 합니다. 테스트가 거부를 확인하는 방법도 이것입니다. 옵션을 켜지 않으면 드라이버는 거부하고 탐색 연결만 열며, 어떤 자격 증명도 전송되지 않습니다. 엔드포인트 목록은 경로 중간의 제3자가 고쳐 쓸 수 있는 바로 그것이므로, 드라이버의 규칙은 서버가 지키도록 맡기지 않고 드라이버가 전달받은 내용에 적용됩니다.

표에 나타나지 않는 한계가 비밀번호를 쓰는 비보안 채널에 있으며, 이는 테스트로 확인됩니다. 이 때문에 드라이버는 옵션 없이는 그 조합을 거부합니다. 비밀번호는 서버의 인증서로 암호화되어 도청하는 쪽에게 보이지 않고, 드라이버는 그 인증서가 승인되기 전에는 보내지 않습니다. 그러나 OPC UA 라이브러리가 암호화에 쓰는 인증서는 세션 생성 시 서버의 응답에 들어 있는 것이고, 비보안 채널에서는 그 응답이 인증되지 않습니다. 트래픽을 바꿀 수 있는 쪽이 자기 인증서를 넣으면 비밀번호는 그쪽 키로 암호화됩니다. 테스트는 이를 실행하고, 바꿔 넣은 키로 비밀번호를 복호화해 되찾습니다. **`Sign`이나 `SignAndEncrypt`에서는 같은 제3자도 할 수 없습니다.** 응답이 그가 가지지 못한 키로 보호되기 때문입니다. `allowInsecureCredentials`가 없으면 드라이버는 비밀번호를 아예 보내지 않으며, 테스트는 이때 같은 제3자가 아무것도 얻지 못함을 보여 줍니다. 옵션을 켜면 드라이버는 연결할 때마다 경고합니다. 서버가 제공하는 곳에서는 항상 `SignAndEncrypt`를 사용하십시오. 비밀번호를 쓰는 비보안 채널을 옵션으로 허용한 경우의 보호는 도청에 대한 것뿐입니다.

#### 재연결

OPC UA 라이브러리 자체의 재연결은 꺼져 있으며, 런타임이 재연결합니다. 라이브러리는 세션을 잃으면 받은 자격 증명으로 새 세션을 열고, 서버가 이를 거부해도 지연 없이 곧바로 다시 시도합니다. 비밀번호가 바뀐 서버를 상대로 12초 동안 거부된 로그인이 약 스무 번 측정되었습니다. 이렇게 하면 그 계정을 공유하는 모두가 잠기게 됩니다. 이제는 세션을 잃으면 `Poll`이 오류를 보고하고, 런타임의 워커가 드라이버를 닫고 새로 열며, 새 드라이버가 엔드포인트를 찾고 서버 인증서를 확인한 뒤 다시 로그인합니다. 이때 런타임의 지터 있는 백오프와 인증 실패 후 10분 대기가 적용됩니다. 서버 재시작도 같은 방식으로 견딥니다. 장치는 다시 로그인한 뒤 재시작 후의 새 값을 읽으며, 테스트는 서버의 로그인 횟수를 세고 재시작 후에 값을 바꿔 이를 확인합니다.

태그가 없는 장치는 읽을 것이 없고, 4.15.2 이전에는 폴링이 아무것도 보내지 않았습니다. 서버는 세션 타임아웃이 지나면 유휴 세션을 닫았고, 장치는 아무도 서버에 묻지 않았으므로 계속 연결됨이라고 했으며, 프로세스를 재시작할 때까지 모든 탐색이 `BadSessionIDInvalid`로 실패했습니다. 누군가 장치를 추가하고 Discover tags를 누르는 바로 그 순간의 모든 장치가 그랬습니다. Ignition에서 발견되었습니다. 이제 태그가 없는 장치는 폴링할 때마다 서버의 상태를 읽어 세션을 유지하고 세션이 끊어지면 알아차리며, 세션이 사라진 것을 발견한 탐색은 이를 보고하여 런타임이 재연결합니다.

세션이 시작되기 전부터 바뀌지 않은 태그는 이제 좋은 품질로 현재 값을 읽습니다. 이전에는 첫 값을 기다리는 동안 보고하던 자리 표시 읽기 값이 값 자체의 소스 타임스탬프보다 새로웠고, 런타임이 가장 새로운 읽기 값을 유지하고 그 값을 버렸기 때문에, 안정된 태그가 다음에 바뀔 때까지 bad로 읽혔습니다.

#### 무엇을 테스트했고 무엇을 하지 않았는가

OPC UA는 Ignition 8.3.9와 독립된 OPC UA 서버들을 상대로, `None`, `Sign`, `SignAndEncrypt`에서 익명 로그인과 사용자 이름 및 비밀번호 로그인으로 실행했으며, 2026-11-17에는 베어메탈에서도 실행했습니다. 운영 중인 서버마다 제공하는 정책과 인증서를 거부하는 방식에 나름의 습성이 있으므로, 새 벤더 서버에 처음 연결하는 일은 시운전으로 여기십시오.

알아 두어야 할 점입니다.

- 이제 연결할 때마다 서버에 먼저 엔드포인트를 묻고, 보안 옵션이 없는 장치에는 ID가 있는 익명 토큰 정책을 나열하는 비보안 엔드포인트가 필요합니다. 그런 정책을 나열하지 않고 익명 세션을 받아 주던 서버는, 서버가 제공하는 목록을 보여 주는 오류와 함께 거부됩니다.
- X.509 인증서와 issued-token 사용자 인증은 이 드라이버에 구현되어 있지 않습니다. 장치의 `certFile`은 애플리케이션 인증서입니다.
- 신뢰는 정확한 인증서 단위입니다. 인증 기관 신뢰와 인증서 폐기는 지원하지 않습니다.
- 타원 곡선 보안 정책은 지원하지 않으며, 비보안 채널에서 탐색을 거부하는 서버도 지원하지 않습니다.
- 어느 쪽 끝에서도 닫힌 것을 알지 못한 채 끊어진 네트워크 경로에서는, 운영 체제가 연결을 포기할 때까지 장치가 마지막 값에 머뭅니다.
- 일부 서버는 `Aes256_Sha256_RsaPss`로 채널을 열 수 없습니다.
- HotLoop 자체 서버는 최대 72바이트의 비밀번호를 받습니다. 다른 서버에는 자체 한도가 있을 수 있습니다.

#### Ignition 8.3

**Ignition 8.3.9**(현재 안정 릴리스)를 Inductive Automation의 공식 컨테이너 이미지에서 검증했습니다. HotLoop의 드라이버가 클라이언트이고 반대쪽이 Ignition의 OPC UA 서버이며, `Basic256Sha256`과 `SignAndEncrypt`로 사용자 이름과 비밀번호를 사용해 로그인했습니다. 탐색에서 `nsu=urn:inductiveautomation:ignition:opcua:tags` 아래의 Ignition 태그를 찾았고, `[System]/Gateway`의 시계, CPU, 메모리, 가동 시간 태그를 가져와 구독으로 전달받아 좋은 품질로 읽었습니다.

기본 설치 상태의 8.3 게이트웨이는 HotLoop이 말을 걸기도 전에 네 번 막습니다.

1. **OPC UA 서버가 localhost에서만 수신합니다.** 기본 설정의 8.3은 포트 62541을 `localhost`에 바인드하므로, 다른 곳에 있는 HotLoop은 연결 거부 외에는 아무것도 받지 못합니다. 게이트웨이의 OPC UA 서버 설정에서 Bind Addresses를 `0.0.0.0`으로 설정하십시오. HotLoop이 접속하는 호스트 이름을 Endpoint Addresses에도 추가했으나, 드라이버에 그것이 필요한지는 테스트하지 않았습니다.
2. **태그는 기본적으로 OPC UA에 노출되지 않습니다.** Expose Tag Providers를 켜지 않으면 탐색에서 찾는 것은 서버 자체의 진단 정보와 장치 폴더뿐입니다.
3. **인증서는 양방향입니다.** HotLoop은 위에서 설명한 대로 승인하기 전까지 Ignition의 인증서를 거부합니다. Ignition은 게이트웨이 OPC UA 서버 인증서에서 HotLoop의 인증서를 신뢰하기 전까지 그것을 거부합니다. 디스크에서는 `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs`에서 `.../trusted/certs`로 옮기는 것이며, 재시작은 필요 없습니다. **Ignition은 HotLoop이 로그에 남기는 SHA-1 지문으로 그 파일 이름을 짓지 않습니다.** 인증서를 열어 지문을 비교하십시오. 파일 이름이 일치하지 않아도 가짜라는 뜻은 아닙니다.
4. **OPC UA 로그인은 `opcuauser` / `password`이며**, 새로 설치할 때마다 `opcua-module` 사용자 소스에 들어 있습니다. 실제 장비를 연결하기 전에 바꾸십시오.

이 방향에서는 8.3의 서버가 기본으로 제공하는 것, 즉 `Basic256Sha256`과 `SignAndEncrypt`만 실행해 보았습니다.

**반대 방향도 검증되었습니다. Ignition 8.3.9의 OPC UA 클라이언트가 HotLoop의 OPC UA 서버를 읽습니다.** HotLoop 뷰어로 로그인하여 Ignition이 제공하는 모든 보안 정책과 모드에서 확인했습니다. 설정, 양방향 인증서 신뢰, 주의할 점, 정책 매트릭스는 [OPC UA 서버](/ko/edge/opc-ua-server/#클라이언트로서의-ignition-83)에 있습니다. 이 과정에서 HotLoop의 버그 두 가지를 찾아 모두 수정했습니다. 서버가 컨테이너를 다시 만들 때마다 새 인증서를 만들어 업그레이드할 때마다 Ignition의 신뢰가 깨졌고, Discover tags가 모든 태그를 float로 선언하여 텍스트 태그가 Ignition에 `Bad_TypeMismatch`로 전달되었습니다(위 참조).

HotLoop의 Sparkplug 에지 노드와 Edge Relay를 Ignition의 MQTT Engine과 연동하는 일은 다음 단계이며 아직 하지 않았습니다.

### OPC UA PubSub (UADP)

또 하나의 OPC UA입니다. 클라이언트가 서버에 요청하는 방식이 아니라, 퍼블리셔가 DataSet을 UDP 데이터그램으로 유니캐스트나 멀티캐스트로 수신자에게 보냅니다(OPC 10000-14, UADP 인코딩). HotLoop은 장치로서 구독하고, 설정으로서 게시합니다.

**구독.** 프로토콜이 `opcua-pubsub`인 장치를 추가합니다. 주소는 수신할 대상입니다. `udp://239.0.0.1:4840`은 멀티캐스트 그룹에 가입하고, `udp://:4840`은 유니캐스트를 수신합니다. 태그의 주소는 `<DataSetWriterId>/<field index>`이며, 퍼블리셔의 DataSet에서 0부터 센 필드의 위치입니다. `1000/3`은 writer 1000이 게시하는 네 번째 필드입니다. UADP에는 필드 이름이 없으므로(이름은 퍼블리셔가 다른 방법으로 제공하는 DataSetMetaData에 있거나 아예 없습니다) 데이터그램이 알려 줄 수 있는 것은 위치입니다. 배열인 필드는 요소 하나씩 읽습니다. `1000/3[17]`은 네 번째 필드인 배열의 열여덟 번째 값입니다. Browse는 지금까지 수신한 필드를 타입과 함께 나열하며, 배열은 그 요소(처음 1000개)로 나열합니다.

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId`와 `writerGroupId`는 장치를 하나의 퍼블리셔와 그룹으로 한정합니다. 비어 있거나 0이면 모두 받습니다. 여러 장치가 한 주소를 공유할 때 쓰는 방법입니다. 퍼블리셔가 `udp://:4840`에 WriterGroup 두 개를 보내면 그곳에서는 장치 두 개이며, 하나는 `"writerGroupId":1`, 다른 하나는 `"writerGroupId":2`입니다.
- 장치들은 주소와 포트를 공유할 수 있습니다. HotLoop은 그 주소에 소켓 하나를 열고(멀티캐스트 그룹은 한 카드에서 한 번 가입) 모든 데이터그램을 그 주소의 모든 장치에 넘깁니다. 각 장치는 자신의 `publisherId`, `writerGroupId`, `dataSets`를 적용하므로 각자 자기 퍼블리셔의 전체 스트림을 보고 장치 사이에 나뉘는 것이 없습니다. 그 주소의 마지막 장치가 제거되거나 중지되면 소켓이 닫히고, 다음 장치가 시작되면 다시 엽니다. 장치는 쓰인 그대로의 주소로 짝지어집니다. `udp://:4840`, `udp://0.0.0.0:4840`, `udp://[::]:4840`은 HotLoop에게 서로 다른 세 주소이며, 함께 쓸 수 있는지는 예전처럼 운영 체제에 달려 있습니다. 서로 다른 두 카드에서 가입한 멀티캐스트 그룹은 소켓 두 개입니다. 주소를 혼자 쓰는 장치에는 아무 변화가 없습니다.
- 그룹, 포트, 카드는 모두 장치의 설정이며, HotLoop에 고정된 것은 없습니다. `"interface":"eth0"`과 함께 `udp://239.192.0.1:4850`을 쓰면 그 카드에서 그 그룹에 가입하고, `udp://127.0.0.1:4842`는 같은 머신의 퍼블리셔 하나를 수신합니다. 여러 장치가 서로 다른 그룹과 포트를 동시에 수신할 수도 있고, 같은 것을 수신할 수도 있습니다.
- `interface`는 멀티캐스트 그룹에 가입하는 네트워크 카드이며, 이름(`eth0`, `lo`)이나 IPv4 주소(`127.0.0.1`)로 지정합니다. 카드가 둘 이상인 머신에는 필요합니다. 같은 머신의 퍼블리셔가 루프백으로 그룹에 보내는 경우(`IP_MULTICAST_IF` 127.0.0.1, TTL 0, 루프백 켜짐, 라우트 없음), `"interface":"lo"` 또는 `"127.0.0.1"`인 장치가 수신합니다. 인터페이스를 지정하지 않고 라우트도 없으면 가입이 `no such device`로 실패하며 그렇게 알려 줍니다.
- `dataSets`는 전송 중에 타입 정보를 담지 않는 RawData에만 필요합니다. 바이트를 읽을 수 있도록 퍼블리셔의 필드 타입을 순서대로 적습니다. Variant와 DataValue 메시지는 자체 타입을 담고 있습니다. 각 항목은 타입 이름(`"Float"`)이며, 값 블록의 배치도 지정할 수 있습니다. `"Float*250"`은 길이 정보 없이 필드 250개가 연속된 것으로, 실수형 REAL 블록을 별도 필드로 보내는 PLC가 이렇게 씁니다. `"Float[250]"`은 값이 최대 250개인 배열 필드 하나로, OPC Foundation 스택이 RawData 배열을 쓰는 방식(Int32 개수, 값들, 250개가 되도록 0으로 채운 패딩)입니다. `"String(40)"`은 40바이트로 채운 String이며, 단독으로도 `"String(40)[4]"`처럼도 쓸 수 있습니다.
- Key frame은 DataSet의 필드를 교체하고, delta frame은 이름을 지정한 필드만 바꾸며, keep alive는 퍼블리셔가 살아 있음을 알립니다. 메시지가 유실되면(시퀀스 번호가 건너뛰면) delta가 함께 사라졌을 수 있으므로, 다음 key frame이 올 때까지 그 DataSetWriter의 태그가 **uncertain**으로 표시됩니다. DataSet 구성 버전이 바뀌면, key frame이 새 의미를 알려 줄 때까지 모든 필드를 잊습니다.
- writer가 `timeoutMs`(설정하지 않으면 30초) 동안 조용하면 그 사유와 함께 **bad**로 읽히고, 타임아웃 안에 퍼블리셔로부터 아무것도 받지 못한 장치는 중단 상태입니다. 퍼블리셔가 Bad로 표시한 필드는 bad이고, Uncertain으로 표시한 필드는 uncertain이며, 사유는 상태 코드입니다.
- 읽기 값의 시각은 필드, DataSetMessage, NetworkMessage 중 설정되어 있고 이 시계보다 1분 넘게 앞서지 않은 것의 퍼블리셔 시각이며, 그렇지 않으면 도착한 시각입니다.
- 배열은 Variant와 DataValue 메시지(Int32 개수와 값들, OPC 10000-6 5.2.2.16. 다차원 배열은 행 순서로 평평하게 들어옴)에서 읽고, 배치를 지정하면 RawData에서도 읽습니다. 데이터그램이 담을 수 없는 개수는 무엇도 만들기 전에 거부합니다.
- 읽기 전용입니다. 메시지 보안(서명 또는 암호화된 NetworkMessage), 청크 메시지, 탐색 메시지, 이벤트, 구조체 필드는 지원하지 않으며, 이 중 하나를 담은 데이터그램은 거부되고 사유별로 집계되며 추측으로 처리되지 않습니다.

**게시.** Edge와 Gateway(OPC UA 서버가 있는 제품)에서 `HOTLOOP_UADP_PUBLISH_ENABLED`를 설정하기 전에는 꺼져 있습니다. 레이아웃이 지정한 태그를 보냅니다.

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| 변수 | 기본값 | <span class="sr-only">세부 정보</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | 멀티캐스트 그룹은 `udp://239.0.0.1:4840`, 구독자 한 곳은 `udp://host:4840` |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` 또는 `_LAYOUT` | | 위의 레이아웃을 파일 또는 인라인으로 지정(파일이 우선) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | 숫자 또는 텍스트 |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | key frame 사이의 간격은 최대 이 횟수 |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | Variant 대신 DataValue 필드(값, 상태, 시각) |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | 바뀐 DataSet을 key frame 사이에 delta frame(바뀐 필드만)으로 전송 |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | 각 DataSet의 필드 이름과 유형을 이 횟수의 간격마다 알립니다. `0`은 전혀 보내지 않습니다 |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | 시스템 기본값, `1` | 멀티캐스트가 나가는 카드와 홉 제한 |

각 DataSet은 자체 DataSetWriter로, 각각 NetworkMessage 하나씩 나갑니다. 값이 바뀐 DataSet은 key frame(모든 필드)으로, 바뀌지 않은 DataSet은 keep alive로 나가며, 늦게 합류한 구독자가 수렴하도록 key frame은 최소한 `KEY_FRAME_EVERY` 간격마다 나갑니다. key frame은 완전하므로 데이터그램을 잃어도 한 간격이 손실될 뿐 잘못된 값이 되지는 않습니다. `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true`이면 바뀐 DataSet은 대신 마지막 메시지 이후 바뀐 필드와 그 위치만 담은 delta frame으로 나가고, key frame은 여전히 최소한 `KEY_FRAME_EVERY` 간격마다 나갑니다. 그러면 delta 하나를 잃을 때 최대 그만큼의 간격 동안 오래된 필드가 남으며, 이것이 느린 링크에서 더 작은 메시지를 얻는 대가입니다. HotLoop 자체 구독자는 delta frame을 읽습니다. value. 불량인 태그는 마지막 값이 아니라 상태로 게시되고, 아직 아무것도 읽지 못한 태그는 `BadWaitingForInitialData`로 게시됩니다. 값은 게시된 유형에 맞게 제한되며 넘치지 않습니다. 메시지 보안은 지원하지 않으므로 공장이 신뢰하는 네트워크에서 사용해야 합니다. 같은 배치의 태그는 다른 장비의 HotLoop 자체 구독자가 읽을 수 있습니다.

**증명된 내용.** 독립적인 OPC UA PubSub 스택이 HotLoop 구독자에게 게시하고 멀티캐스트로 HotLoop 게시자를 구독하며, HotLoop 게시자는 HotLoop 자체 구독자가 올바르게 읽습니다. **메시지 보안.** 구독자 장치는 게시자의 NetworkMessage가 서명되거나 서명과 암호화가 되어 있기를 요구할 수 있습니다(OPC 10000-14 7.2.4.4.3). 사양이 정의한 두 정책은 `PubSub-Aes128-CTR`과 `PubSub-Aes256-CTR`입니다.

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

키는 정적입니다. 양쪽에 SecurityTokenId(`keyId`)와 함께 16진수 또는 base64로 설정합니다. 키는 시크릿이므로 `[redacted]`로 표시되고 저장할 때 유지됩니다. 키를 두 개 가진 장치는 한 키에서 다른 키로 옮겨 가는 게시자를 받아들입니다. `security`가 설정되어 있으면 서명되지 않았거나(`signAndEncrypt`에서는 암호화되지 않았거나), 다른 키로 서명되었거나, 전송 중 변경된 메시지는 내용을 읽기 전에 거부되고 집계됩니다(`unsecured`, `signature`, `security_key`). Security Key Service(GetSecurityKeys, 키 순환)는 구현되어 있지 않습니다. 게시자는 `HOTLOOP_UADP_PUBLISH_SECURITY_MODE`(`sign` 또는 `signAndEncrypt`), `_POLICY`, `_KEY_ID`, `_SIGNING_KEY`, `_ENCRYPTING_KEY`, `_KEY_NONCE`로 서명합니다.

**메타데이터와 탐색.** 게시자는 DataSet의 이름과 구성을 DataSetMetaData를 담은 탐색 응답으로 알리며, 클 때는 청크로 나눕니다(7.2.4.4.4, 7.2.4.6). 구독자 장치는 이를 읽습니다. 필드는 Browse에서 이름이 붙고(`writer1001_<field name>`), 메타데이터가 배치를 알려 주므로 RawData DataSet은 구성에 `dataSets` 유형이 필요 없으며, 구성 버전을 바꾼 DataSet은 다음 key frame부터 다시 시작합니다. 둘 다 있을 때는 구성의 `dataSets`가 여전히 우선합니다. 구독자의 탐색 요청은 보내지 않으며, 게시자도 응답하지 않습니다.

**구조체 필드, 이벤트.** 메타데이터가 구조체라고 하는 필드는 멤버로 읽히며, 태그는 이를 `1001/0.Value`(구조체 배열의 요소는 `1001/7[2].Angle`)로 지정합니다. Variant로 보낸 구조체는 메타데이터가 설명할 때 읽습니다. 선택적 필드가 있는 구조체와 공용체는 추측하지 않고 이름으로 보고합니다. Event DataSetMessage는 담고 있는 필드와 같이 적용되고 나머지는 건드리지 않으며(장치 통계의 `Events`), 배치는 key frame의 것(7.2.4.5.7)이고 사양에서 읽었을 뿐 다른 스택으로 확인하지는 않았습니다. 일부 게시자는 RawData key frame 앞에 FieldCount를 쓰는데 사양은 그렇게 하지 않으며, 장치에는 `"rawFieldCount":true`로 알려 줍니다.

### CODESYS

CODESYS Control 런타임(Linux SL, ARM64, Raspberry Pi, Windows, 가상 PLC)을 실행하는 PLC를 프로그래머가 변수에 붙인 이름으로 읽고 씁니다. 노드 ID가 아니라 `Application.GVL_Line.rTemp`입니다. CODESYS PLC에 필요한 것을 얹은 OPC UA 드라이버이므로, [OPC UA: 보안과 자격 증명](#opc-ua-보안과-자격-증명)의 모든 내용이 이 드라이버에도 적용되며 옵션도 같습니다.

**PLC 자체의 알람.** Alarm Configuration이 있는 프로젝트는 알람을 PLC의 알람 관리자에 보관합니다. 프로젝트에 HotLoop Alarms 라이브러리의 블록이 있으면(CODESYS alarms 참조) HotLoop은 장치가 연결된 순간부터 그 알람을 알람 목록에 표시하고, HotLoop에서 한 확인 응답은 알람 관리자로 돌아갑니다. 실제 CODESYS Control for Linux SL 4.22.0.0 런타임으로 실시간 검증했습니다. 발생, 확인 응답, 리셋, 확인입니다. 알람 관리자 자체의 텍스트 목록과 시험한 두 가지 외의 클래스는 검증하지 않았습니다.

**왜 OPC UA 서버인가, 그리고 PLC에는 무엇을 뜻하는가.** CODESYS가 서드파티에 문서화한 컨트롤러 변수 읽기 방법은 하나이며, 런타임 자체의 OPC UA 서버입니다. 애플리케이션의 Symbol Configuration(CODESYS 3.5 SP18부터는 Communication Manager 아래의 IEC Symbol Set)이 어떤 변수를 어떤 접근 권한으로 게시할지 정하고 서버가 그것을 제공합니다. CODESYS Gateway의 채널 프로토콜은 서드파티용으로 문서화되어 있지 않으며 이 드라이버는 그것을 사용하지 않습니다. 따라서 보고 싶은 것을 PLC가 게시해야 합니다.

1. IDE에서 애플리케이션에 **Symbol Configuration**을 추가하고 *Support OPC UA features*를 켠 다음 변수를 선택하거나, 선언부에 `{attribute 'symbol' := 'readwrite'}`(읽기 전용은 `'read'`)로 표시합니다.
2. 다운로드합니다. Symbol Configuration이 없는 PLC는 설정할 때 추가하라는 메시지로 응답합니다.
3. 변수는 심볼이 `readwrite`이고 연결하는 사용자에게 쓰기가 허용된 경우에만(장치의 *Symbol Rights*) HotLoop에서 쓸 수 있습니다. HotLoop은 접근 수준을 읽고 둘 중 어느 쪽이 쓰기를 거부했는지 알려 줍니다.

출처: [CODESYS 도움말, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html)과 [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html)(심볼 이름은 `<application>.<POU>.<variable>`, 접근은 심볼마다 읽기, 쓰기, 실행, 그룹의 권한은 장치의 Symbol Rights 탭에 있으며, OPC UA에는 컨트롤러의 인증서가 필요), [IEC 61131-3용 PLCopen OPC UA 정보 모델](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf)(릴리스 1.02, 아래 레이아웃), OPC UA Part 5(OperationLimits). 노드 ID는 이 드라이버를 작성할 때 기준으로 삼은 4.22.0.0 런타임이 응답한 것이며, 정확한 `|var|` 표기는 공개된 계약이 아니라 런타임의 것입니다. 그래서 태그를 심볼로 지정하고 노드 ID는 드라이버가 만듭니다.

**레이아웃.** 런타임은 OPC UA Device Integration `DeviceSet`에 PLC용 장치 하나를 게시하고, 그 아래에 `Resources`, 그 아래에 애플리케이션을 두며, 그 안에 `GlobalVars`(변수 목록)와 `Programs`가 있습니다. 변수의 노드는 네임스페이스 `CODESYSSPV3/3S/IecVarAccess`의 `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>`입니다. 드라이버는 탐색으로 장치와 애플리케이션을 찾으므로, 프로젝트 이름이 바뀌어도 태그는 유지됩니다.

**주소.** 애플리케이션을 포함하거나 생략한 IEC 심볼입니다.

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Discover tags**는 애플리케이션이 내보내는 것을 그 타입으로 나열합니다. STRING은 `string`, BYTE는 `uint16`, TIME은 `int64`(밀리초), 열거형은 `int32`, 정수 폭은 그대로, REAL과 LREAL은 `float`입니다. 런타임은 STRING, BYTE, TIME을 PLCopen 모델의 타입으로 알려 줍니다(예: `ns=3;i=3013`). 드라이버는 `HasSubtype` 참조를 따라 그것이 속한 표준 타입을 찾으며, BYTE에 쓰는 값을 Byte로 보내는 것도 이 방법입니다. 각 변수는 심볼에 부여된 접근 권한을 가집니다. 구조체와 배열은 안으로 들어가 필드마다, 요소마다 포인트 하나가 됩니다. 런타임 자체의 속성(`|vprop|`), 태스크 목록, Server 객체는 제외합니다.

배열은 처음 32개 요소(`arrayElements`)만 나열합니다. 요소가 천 개인 버퍼는 대시보드에서 천 가지 항목이 아니기 때문이며, 태그는 심볼로 어떤 요소든 지정할 수 있습니다. 목록은 `browseMaxNodes`에서 멈추고 그렇다고 알려 줍니다. `browseRoot`를 심볼(`Application.GVL_Demo`)로 설정하면 애플리케이션의 한 부분을 나열합니다. 탐색은 너비 우선이므로 목록의 변수가 그 배열의 요소보다 먼저 나오며, 응답은 런타임이 받아들이는 크기로 제한됩니다(천 개 요소 배열 백 개의 응답에서는 런타임이 연결을 닫습니다).

구성: OPC UA 옵션과 `device`(PLC의 이름, 런타임에 둘 이상 있을 때만), `application`(Application이라는 이름이 없을 때만), `arrayElements`, `alarmSymbol`(HotLoop Alarms 블록, 검색을 건너뛰는 용도로만). 철자가 틀린 옵션은 유효한 옵션을 나열하는 오류가 됩니다. 비밀번호는 시크릿이며 모든 장치 시크릿처럼 저장되고 가려집니다.

**런타임이 클라이언트에 요구하는 것.** 런타임은 요청당 읽기, 탐색, 모니터링 항목에 대해 100의 `OperationLimits`를 게시하고, 더 큰 요청은 `BadTooManyOperations`로 거부합니다. 드라이버는 연결할 때 이 한도를 읽고 모든 OPC UA 장치에서 모든 요청을 그 한도에 맞게 나눕니다(CODESYS 런타임이 처음으로 문제가 된 사례였습니다. 그전에는 드라이버가 발견한 모든 태그를 float로 보고했고, 변수가 100개를 넘는 장치의 태그는 하나도 읽지 못했습니다). 샘플링은 기본 1초, 큐는 항목 하나입니다. PLC에는 지켜야 할 스캔이 있고 이미 PLC를 읽고 있는 Ignition 게이트웨이가 그것을 빼앗겨서는 안 되기 때문이며, 더 많이 요청하려면 `samplingIntervalMs`를 설정하십시오.

**다운로드, 재시작, 링크 끊김.** 런타임을 재시작하거나 새 프로그램을 올리면 세션이 끊어집니다. 장치는 연결 끊김 상태가 되고 모든 태그는 "PLC의 런타임이 응답하지 않습니다"라는 사유와 함께 bad로 읽히며, HotLoop은 백오프를 두고 스스로 다시 연결해 지금 있는 심볼을 읽습니다. 읽고 있던 심볼이 연속 두 번 없어졌다는 이유로 거부되면, 런타임이 세션을 유지한 채 다운로드한 것으로 보고 같은 재연결을 위해 세션을 포기합니다. 프로그램에 없는 변수의 태그는 서버가 알려 주는 사유와 함께 bad로 읽히며 재연결을 일으키지 않습니다.

**런타임의 OPC UA 서버 보안.** CODESYS Control 런타임은 OPC UA 서버에 인증서가 생기기 전에는 비보안 엔드포인트만 제공하고, 인증서가 생기면 `CommunicationPolicy`의 정책(기본 AES128-SHA256-RSAOAEP, Basic256Sha256, AES256-SHA256-RSAPSS)을 Sign과 SignAndEncrypt로도 제공합니다. CODESYS는 Security Screen(CODESYS Security Agent, Devices, 컨트롤러, OPC UA Server)에서 그 인증서를 만들고, 클라이언트의 인증서를 "Certificates in Quarantine"에서 "Trusted Certificates"로 옮겨 클라이언트를 신뢰하는 방법을 문서화합니다. Linux 런타임의 PLC 셸은 IDE 없이도 같은 일을 하며, CODESYS가 장치 편집기의 PLC 셸용으로 나열한 명령(`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`)을 Linux 런타임이 문서화한 Unix 소켓(`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell")으로 실행합니다. 장치를 `securityMode` `SignAndEncrypt`와 `securityPolicy`로 설정하고 한 번 연결하면(HotLoop 자체 인증서가 런타임의 quarantine에 들어가고 그 사실을 알리는 메시지와 함께 연결이 거부됩니다), 그 인증서를 신뢰하면 장치가 읽힙니다. 보여 주지 않은 것: IDE의 Security Screen, CA가 서명한 인증서, 보안이 적용된 런타임의 사용자 관리.

**라이선스가 없는 런타임은 스스로 멈춥니다.** 라이선스가 없는 CODESYS Control 런타임은 데모 모드로 실행되어 약 두 시간 뒤에 종료됩니다(런타임 로그에 시작할 때마다 `no runtime license - running in demo mode(~2 hours)`가 나옵니다). HotLoop 쪽에서는 다른 런타임 재시작과 같습니다. 장치는 "PLC의 런타임이 응답하지 않습니다"와 함께 연결 끊김이 되고, 누군가 런타임을 다시 시작하면(컨테이너의 재시작 정책, systemd 유닛) 스스로 돌아옵니다. HotLoop은 두 시간을 세지 않고 이 정지를 다르게 취급하지도 않으며, 런타임을 대신 재시작해 주지도 않습니다. 다시 시작되지 않는 런타임은 연결이 끊긴 채로 남습니다. 라이선스 없이 컨테이너에서 4.22.0.0 런타임으로 실행한 결과, 시작 후 2시간 5분 만에 종료 코드 0으로 스스로 멈췄고, 컨테이너의 재시작 정책이 31초 뒤에 다시 시작했으며, 그 82초 뒤에 애플리케이션이 실행 중이었고, 애플리케이션이 시작되고 35초 뒤에 장치가 다시 좋은 상태로 읽혔습니다(정지부터 2분 28초). 손으로 한 작업은 없었습니다.

**쓰기.** 태그는 모든 장치와 마찬가지로 누군가 쓰기 가능으로 표시하기 전에는 읽기 전용이며, 설정이 만드는 태그는 어느 것도 쓰기 가능이 아닙니다. 그다음 쓰기 관문은 OPC UA와 같고, 앞에 PLC 쪽 절반이 더해집니다. 읽기 전용으로 내보낸 심볼이나 사용자에게 쓰기가 허용되지 않은 심볼에 대한 쓰기는 PLC가 알려 주는 사유와 함께 거부되며 전송되지 않습니다.

**통합 흐름에서 설정**(`codesys`): 런타임의 주소, OPC UA 보안 질문, 그리고 선택적으로 보관할 포인트의 첫 대시보드(WebVisu가 되었을 화면. [통합](/ko/iot/integrations/#codesys) 참조). 컨테이너의 4.22.0.0 런타임으로 검증했습니다. 그것이 무엇을 뜻하지 않는지는 상태 표를 참조하십시오.

### Modbus TCP/RTU

1979년부터 쓰인 일꾼입니다. PLC, VFD, 전력 계량기, RTU, 그리고 더 나은 것이 없는 모든 게이트웨이의 대안입니다.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**워드 순서**는 사람들이 가장 자주 틀리는 설정이며, 순서가 틀린 float는 화면에서 분명히 틀려 보이지 않고 사실이 아닌 그럴듯한 숫자가 됩니다. 벤더 매뉴얼이 인쇄하는 이름으로 네 가지 순열을 모두 지원합니다. `ABCD`, `CDAB`, `BADC`, `DCBA`. 장치 기본값은 `byteOrder`로 설정하고, 태그별로는 네 번째 주소 필드로 덮어씁니다.

**주소 지정**은 가공하지 않은 0 기반입니다. 도면이 전통적인 40001 방식의 번호를 쓴다면 `oneBased: true`를 설정하고 도면의 번호를 그대로 쓰십시오. 이것을 한 칸 틀리는 것은 Modbus에서 가장 오래된 버그입니다.

읽기는 블록으로 병합됩니다. 인접하거나 가까운 레지스터는 요청 하나가 됩니다. `maxGap`은 왕복을 한 번 더 하지 않기 위해 사용하지 않는 레지스터를 몇 개까지 같이 읽을지(기본값 8)를 제어하고, `maxBlock`은 요청 하나의 상한입니다(기본값 120, 프로토콜 상한 125).

홀딩 레지스터의 비트 하나를 쓰는 것은 읽기-수정-쓰기입니다. Modbus에는 그 위치에 원자적 비트 설정이 없기 때문입니다. 나머지 열다섯 비트는 보존됩니다.

### MQTT와 Sparkplug B

일반 MQTT, 또는 **완전한 primary host application**으로서의 Sparkplug B.

일반 토픽입니다.
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Sparkplug 메트릭입니다.
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

primary host로서 드라이버는 사양이 요구하지만 대부분의 통합이 생략하는 일을 합니다.

- retained `STATE` birth를 짝이 되는 will과 함께 게시하므로, 에지 노드가 타임아웃으로 짐작하지 않고 호스트가 끊긴 것을 볼 수 있습니다. 기본은 Sparkplug 3.0 형식(JSON을 담은 `spBv1.0/STATE/<host>`)이며, 3.0 이전의 `ONLINE`/`OFFLINE` 문자열을 쓰려면 `legacyState`를 설정합니다.
- 노드별 순환 시퀀스 번호를 추적하고, 번호를 건너뛰면 노드에 rebirth를 요청합니다. 건너뛰었다는 것은 메시지를 놓쳤다는 뜻이고 별칭 테이블을 더는 신뢰할 수 없기 때문입니다.
- 자신이 재연결한 뒤 rebirth를 요청합니다. 자리를 비웠던 호스트는 그동안 무엇이 바뀌었는지 모릅니다.
- `NDEATH`를 `bdSeq`로 `NBIRTH`와 대응시키므로, 이전 세션에서 남은 death certificate가 현재 세션을 죽일 수 없습니다.

메시지 순서는 보장됩니다. Sparkplug 메시지를 동시에 전달하면 순서가 바뀌어 정상 노드가 메시지를 떨어뜨리는 것처럼 보이고 rebirth 폭주를 일으킵니다.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix, Micro820. 태그에 이름이 있으므로 컨트롤러에 무엇을 가지고 있는지 물어볼 수 있습니다.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP는 타입이 엄격하며 컨트롤러는 선언된 타입이 맞지 않는 읽기를 거부하므로, 타입은 어딘가에서 가져와야 합니다. 태그의 `dataType` 또는 우선하는 `:type` 접미사에서 가져옵니다. 알 수 없으면 대부분의 프로세스 값이 쓰는 `REAL`로 돌아갑니다.

읽기는 멀티 서비스 요청으로 묶으며, 묶음이 실패하면 잘못된 태그 경로 하나가 나머지 열아홉 개를 가리지 않도록 개별 읽기로 돌아갑니다.

### S7comm

Siemens S7-300, 400, 1200, 1500을 랙과 슬롯 기준의 ISO-on-TCP로 연결합니다.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

한 바이트보다 넓은 것에는 타입이 필요합니다. 네 바이트가 REAL인지 DINT인지는 프로토콜이 알려 줄 수 없으며, 이는 전송선이 아니라 PLC 프로그램에 관한 사실입니다.

기본값은 랙 0, 슬롯 1(S7-1200/1500)입니다. S7-300/400은 대개 슬롯 2입니다. `connectType`의 기본값은 3(S7 Basic)이므로, 엔지니어가 TIA Portal에 쓰려는 PG 연결 슬롯을 게이트웨이가 차지하지 않습니다.

탐색은 없습니다. S7 CPU는 데이터 블록의 구조를 게시하지 않으며, 그것은 TIA Portal 프로젝트에 있습니다.

### MTConnect

읽기 전용 공작 기계 텔레메트리입니다. MTConnect에는 명령 채널이 없으며 이 드라이버도 있는 척하지 않습니다.

`dataItemId` 또는 이름으로 지정하십시오. 에이전트마다 어느 쪽이 안정적인지 다르고, 기계 문서에는 둘 중 하나만 나와 있습니다.

동작하는 통합과 그럴듯한 통합을 가르는 두 가지 세부 사항입니다. `UNAVAILABLE`은 에이전트가 읽기 값이 없다고 명시적으로 말하는 것이며, 텍스트 "UNAVAILABLE"이나 0이 아니라 bad 품질이 됩니다. 그리고 Condition의 의미는 대개 비어 있는 문자 데이터가 아니라 요소 이름(`Normal`, `Warning`, `Fault`, `Unavailable`)입니다.

`Browse`는 `/probe`를 읽고 컴포넌트 트리를 임의의 깊이까지 따라갑니다.

### HTTP / REST

에너지 계량기, 환경 센서, OEM 컨트롤러, 그리고 내부에서 독자 프로토콜을 쓰는 게이트웨이의 REST 쪽을 위한 만능 수단입니다.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

세 번째 형식이 중요합니다. 이런 API는 순서가 없는 `{name, value}` 객체 배열을 돌려주기를 좋아하고, 위치로 인덱싱하는 것은 펌웨어 업데이트를 기다리는 버그입니다.

요청 하나가 장치의 모든 태그를 처리합니다. `Browse`는 문서를 훑어 모든 스칼라를 그에 이르는 경로와 함께 보고합니다.

### 박스 상태

HotLoop이 실행되는 장비를 읽기 전용 장치로 제공합니다. `cpu_util_pct`(마지막 읽기 이후 유휴가 아닌 CPU 시간), `mem_util_pct`(MemTotal 대비 MemAvailable), `disk_util_pct`(장비의 디스크, `diskPath`에 읽기 전용으로 마운트된 호스트 루트의 statfs, 기본값 `/host`), `data_util_pct`(`dataPath`의 볼륨 `/data`, 아직 마운트된 것이 없으면 그 위에서 가장 가까운 기존 폴더), 그리고 `jitterFile`이 실시간 에이전트가 다시 쓰는 JSON 파일 `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}`을 가리킬 때 `rtos_jitter_core1_us`부터 `core3_us`까지(5분보다 오래된 파일은 불량으로 읽힘). CPU와 메모리는 `procRoot`(`/proc`, 또는 호스트의 것이 마운트되어 있으면 `/host/proc`)에서 가져옵니다. 읽을 수 없는 값은 사유와 함께 불량 품질이며 0이 되지 않습니다. 장치는 `HOTLOOP_BOX_HEALTH_NODE`가 만듭니다([OPC UA 서버](/ko/edge/opc-ua-server/#embernet-대시보드를-위한-장비-상태)).

### Shelly

모든 세대의 Shelly에 중간 브로커 없이 직접 연결합니다. SHELLY.md를 참조하십시오. 프로토콜 `shelly`와 장치 주소로 장치를 추가하며, 로그인이 설정되어 있으면 `{"password":"..."}`를 지정합니다(사용자는 `admin`이며, Gen2 이상 장치는 SHA-256 다이제스트 챌린지로, Gen1 장치는 Basic으로 응답받습니다). `/shelly`가 어느 세대인지 알려 줍니다. Gen2, Gen3, Gen4 장치는 `Shelly.GetStatus`(`POST /rpc`)로 읽으며, 장치가 보고하는 모든 구성 요소는 스스로 추가되는 태그가 되고 사람이 무장하기 전까지는 읽기 전용입니다. `switch:0.output`, `switch:0.apower`, `switch:0.aenergy.total`, `switch:0.temperature.tC`, `input:0.state`, `cover:0.current_pos`, `pm1:0.apower`, `em:0.total_act_power`, `temperature:100.tC`, `humidity:100.rh`, 그리고 장치의 `sys.uptime`과 `wifi.rssi`입니다. 장치가 보내지 않은 필드는 태그가 되지 않습니다. 스위치의 출력(`Switch.Set`), 조명의 출력과 밝기, 커버의 위치(`Cover.GoToPosition`), 온도 조절기의 목표값은 쓰기용으로 무장할 수 있습니다.

Gen2 이상 장치는 웹소켓(`ws://<device>/rpc`)도 사용합니다. 드라이버는 장치가 알림을 보내기 전에 Shelly의 RPC 채널 문서가 요구하는 대로 `src`가 있는 요청 프레임 하나를 보내고, 401 프레임에는 문서화된 `auth` 객체(`dummy_method:dummy_uri`에 대한 SHA-256)로 응답하며, `NotifyStatus`와 `NotifyFullStatus`를 상태의 자체 사본에 합칩니다. 그래서 변경이 태그에 즉시 도달하고 그 사이의 폴링은 장치 대신 사본을 읽습니다. `NotifyEvent`(버튼 누름, 구성 변경)는 장치 아래 로그북에 기록됩니다. 웹소켓이 끊겼거나 최근에 상태를 확인하지 못했을 때(프레임이나 pong 없이 45초, 전체 읽기 없이 2분) 폴링은 HTTP로 장치를 읽습니다.

Gen1 장치(`/status`와 단순한 GET 제어 경로, Basic 로그인)는 자체 용어로 같은 형태의 태그를 제공합니다. `relay:0.output`, `meter:0.power`, `meter:0.total`(와트분을 Wh로 변환), `light:0.output`과 `.brightness`, `roller:0.current_pos`, `input:0.state`, `temperature:0.tC`, 그리고 에너지 미터와 센서의 `emeter:0.power`, `humidity:0.rh`, `flood:0.alarm`입니다. 릴레이는 `/relay/<id>?turn=on|off`로, 조명은 `/light/<id>?turn=&brightness=`로, 롤러는 `/roller/<id>?go=to_pos&roller_pos=`로 씁니다. Shelly가 공개한 Gen1과 Gen2 문서로 구축했고 실제 장치(Plus 1, Plug S, Vintage 전구)의 녹화 기록으로 시험했으며, 시험대의 장치로는 아직 시험하지 않았습니다. Gen1의 에너지 미터, 습도, 배터리, 침수 필드는 문서에서 가져온 것이며 녹화 기록이 없습니다.

### Firmata

Arduino 또는 Firmata 펌웨어를 실행하는 모든 보드를 USB 시리얼이나 TCP로 연결하며, 중간에 호스트 프로그램이 없습니다. FIRMATA.md를 참조하십시오. 프로토콜 `firmata`와 시리얼 포트(`/dev/ttyACM0`, `serial:/dev/ttyUSB0`) 또는 `host:port`로 장치를 추가하며, 옵션은 `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`입니다. 드라이버는 보드의 프로토콜 버전을 기다리고(300 ms마다 요청), 펌웨어, 기능, 아날로그 맵을 요청하며, 보드가 가진 모든 디지털 핀과 아날로그 입력에 읽기 전용 태그를 만듭니다. 태그의 주소는 핀으로 무엇을 할지 알려 줍니다. `D13`, `D2:in`, `D2:pullup`, `D13:out`, `D9:pwm`, `D10:servo`, `A0`, `I2C:0x48:0x00:2`입니다. 디지털 입력은 보드가 변경 시 보내는 포트 리포트이고, 아날로그는 샘플링 간격마다의 리포트이며, 폴링마다 프로토콜 버전을 요청해서 사라진 보드는 한 번의 폴링 안에 발견됩니다. 요청하지 않았는데 도착한 펌웨어 리포트는 재시작한 보드입니다. 태그가 언급하지 않은 핀은 건드리지 않으며, 단순한 `D<n>` 태그는 드라이버가 연결될 때 핀을 입력으로, 처음 쓸 때 출력으로 설정합니다. 프로토콜 2.8.0(github.com/firmata/protocol의 protocol.md와 i2c.md)으로 구축했고 시뮬레이션한 ATmega328P의 StandardFirmata 2.5.9를 상대로 실행했습니다. 디지털 핀, 풀업, 0, 2.5, 5 V의 아날로그 입력, PWM 비교 레지스터, 서보의 핀, I2C 장치의 레지스터를 모두 드라이버가 아니라 칩에서 다시 읽었습니다. 실물 보드에서는 실행하지 않았습니다.

### ONVIF

IP 카메라, 인코더 또는 NVR입니다. ONVIF.md를 참조하십시오. 프로토콜 `onvif`, 카메라 주소, `{"username":"...","password":"..."}`로 장치를 추가합니다. 드라이버는 먼저 GetSystemDateAndTime을 읽어 카메라 자체의 시계로 WS-Security UsernameToken에 타임스탬프를 찍고(Core Specification 5.12: 다이제스트는 `base64(SHA-1(nonce + created + password))`), GetDeviceInformation과 GetServices(오래된 카메라는 GetCapabilities)를 읽으며, 카메라가 Media2를 나열하면 Media2를, 아니면 Media를 사용하고, 모든 프로필의 인코더, 해상도, 스트림 주소, 스냅샷 주소를 읽습니다. SOAP post에서 HTTP Digest나 Basic을 요구하는 카메라에는 그 방식으로 응답합니다. 서비스 주소는 `"keepXAddrHosts":true`가 아니면 장치를 추가할 때 사용한 호스트로 접근합니다. PTZ 프로필은 GetStatus로 `ptz.<token>.pan`, `.tilt`, `.zoom`, `.moving`을 추가하고, 무장할 수 있는 명령 `.move`(ContinuousMove, 선택적 타임아웃), `.absolute`(AbsoluteMove), `.goto_preset`(GotoPreset, 토큰 또는 이름), `.stop`, `.home`을 추가합니다. 이벤트는 pull point(CreatePullPointSubscription, PullMessages, Renew, Unsubscribe)에서 와서 스스로 추가되는 태그 `event.<topic>|<source>|<item>`이 되고, 모든 변경이 로그북에 남습니다. 스냅샷은 `GET /api/onvif/<device>/profiles/<token>/snapshot`이고 탐색은 `POST /api/onvif/discover`입니다(WS-Discovery, `NetworkVideoTransmitter`에 대한 멀티캐스트 Probe).

ONVIF Core, Media, Media2, PTZ, Event 사양(onvif.org/specs)으로 구축했습니다. 보내는 모든 요청은 ONVIF의 WSDL과 XSD 파일에 대해 유효합니다(xmllint, 고유 입자 귀속 때문에 libxml2가 거부하는 33개 유형과 요소 하나는 완화했으며 요청이 쓰는 것은 없습니다). 그리고 WS-Security 헤더를 해석하지만 검사하지는 않는 독립적인 ONVIF 스택 onvif_srvd를 상대로 실행하므로, 로그인의 다이제스트는 대신 zeep 4.3.3의 것과 대조합니다. 이벤트 서비스와 WS-Discovery에는 사양을 보고 작성한 스크립트만 있습니다. 실물 카메라에서는 실행하지 않았습니다.

### UniFi Network

공장 네트워크를 장치로 제공합니다. UniFi 콘솔 하나의 사이트 하나, 스위치, 모든 스위치 포트, PoE 소비량, WAN 링크, 사이트 상태가 장비가 어댑트되는 대로 스스로 만들어지는 태그가 되며, 활성화하기 전에는 읽기 전용입니다. 콘솔마다 로그인 한 번, 인증서는 고정되고, 콘솔 비밀번호는 데이터베이스에서 암호화됩니다. 사람이 활성화하는 몇 가지 명령 태그(위치 확인 LED, 재시작, 포트의 PoE 전원 사이클. UNIFI.md 참조)로만 콘솔을 바꿉니다. 콘솔의 이벤트 웹소켓도 수신하므로 스위치가 끊어지면 그 즉시 로그북에 기록되며, 아래에서는 여전히 폴링이 기준입니다. UniFi 탭은 개요, 지도, 전면 패널, 클라이언트, 네트워크, WiFi를 그립니다. 모든 내용은 [UniFi Network](/ko/iot/unifi/)에 있습니다.

### UniFi Protect

Protect NVR의 카메라, 센서, 조명, 사이렌을 콘솔의 Integrations 페이지에서 받은 API 키로 Protect Integration API를 통해 다룹니다(키는 `{"apiKey":"..."}`에 넣고 콘솔 비밀번호처럼 봉인되며, 인증서는 UniFi Network처럼 `certFingerprint`로 고정합니다). 프로토콜 `unifi-protect`와 콘솔 주소로 장치를 추가합니다. 태그는 스스로 추가되며 무장하기 전까지 읽기 전용입니다. `cam.<id>.online`, `.motion`, 카메라가 지원하는 종류에 따른 `.smart_person`, `.smart_vehicle`, `.smart_package`, `.smart_licensePlate`, `.smart_face`, `.smart_animal`, 그리고 `sen.<id>.online`, `.open`, `.motion`, `.leak`, `.tamper`, `.temp_c`, `.humidity_pct`, `.light_lux`, `light.<id>.online`, `.on`, `.motion`, `siren.<id>.online`입니다. 카메라의 움직임과 스마트 감지는 REST 레코드에 없으므로 콘솔의 이벤트 웹소켓에서 오며, 웹소켓이 끊겨 있는 동안에는 "움직임 없음"이 아니라 불량으로 읽힙니다. 모든 이벤트는 장치 아래 로그북에 있습니다. 사이렌의 `.play`는 쓰기용으로 무장되어 있고(`true`는 울림, `false`는 중지), `alarm.<trigger>.fire`도 마찬가지입니다. 이것은 사람이 Protect에서 만든 트리거 id에 대한 알람 관리자의 웹훅을 보내므로, 이를 쓰는 HotLoop 알람이 카메라를 녹화하게 합니다. 카메라의 스냅샷은 `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`이며, 요청할 때 가져오는 JPEG입니다. Protect 7.4.102에 대한 Ubiquiti의 OpenAPI 문서로 구축했으며 아직 콘솔을 상대로 실행하지는 않았습니다. [UniFi Network](/ko/iot/unifi/#unifi-protect)를 참조하십시오.

### UniFi Access

Access 콘솔의 문을 포트 12445의 Access 개발자 API로 다루며, 고급 설정에서 받은 API 토큰을 사용합니다(`{"token":"..."}`, 봉인됨). 프로토콜 `unifi-access`와 콘솔 주소로 장치를 추가합니다. 문마다 `door.<id>.open`(위치 센서이며, 센서가 없는 문은 닫힘이 아니라 불량으로 읽힘), `door.<id>.unlocked`(잠금 릴레이), 그리고 `door.<id>.unlock`이 있습니다. 마지막 것은 사람이 무장하며 `true`를 쓰면 문을 열고, 쓰기 게이트를 거치고 모든 쓰기처럼 감사됩니다. 콘솔은 자체 규칙에 따라 다시 잠급니다. 알림 웹소켓은 폴링 사이에 위치와 잠금을 최신으로 유지하며, 모든 변경("1F - Front: opened", "unlocked")은 장치 아래 로그북에 있습니다. 관리되는 오픈 클라이언트(py-unifi-access, MIT)가 사용하는 API를 기준으로 구축했으며 아직 콘솔을 상대로 실행하지는 않았습니다. [UniFi Network](/ko/iot/unifi/#unifi-access)를 참조하십시오.

### SNMP

SNMP 에이전트가 있는 모든 것입니다. 스위치, UPS, PDU, 전력 계량기, SNMP 에이전트를 실행하는 모든 Linux 박스. 읽기 전용입니다. HotLoop은 SNMP SET을 절대 보내지 않습니다. SET은 스위치의 설정을 바꿀 수 있으며, 이 드라이버의 목적은 공장 네트워크를 운영하는 것이 아니라 보는 것이기 때문입니다.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

태그의 주소는 점으로 구분된 숫자인 인스턴스 하나의 OID입니다. 스칼라는 `.0`으로 끝나고, 테이블 셀은 그 행의 인덱스로 끝납니다. 태그의 `dataType`이 무엇이 될지 결정합니다.

* 에이전트가 보낸 숫자(Integer, Gauge32, Counter32, Counter64, TimeTicks)는 그 숫자입니다. 스케일과 오프셋은 다른 곳과 똑같이 적용됩니다.
* OCTET STRING은 텍스트이며, 태그가 숫자이면 파싱합니다. 로드 평균(`laLoad`는 텍스트 `0.15`)이나 에이전트 뒤에 있는 온도가 이렇게 도착합니다. 숫자가 아닌 텍스트는 그렇다고 알리는 bad 읽기 값이 되며 0이 되지 않습니다.
* 출력할 수 없는 OCTET STRING(MAC 주소)은 `0x`와 16진수입니다.

**카운터는 가공하지 않은 값입니다.** Counter32나 Counter64는 증가만 하다가 한 바퀴 돕니다. 태그는 에이전트가 보낸 값을 보관하며, 변화율은 태그를 읽는 쪽의 몫입니다. Counter64는 float로 보관하며 2^53까지는 정확합니다. 회선 속도로 쓰는 포트도 거기까지 가려면 수십 년이 걸립니다.

**TimeTicks는 100분의 1초 단위**이므로, `sysUpTime`을 일반 태그로 읽으면 1/100초 단위입니다. 통합이 대신 초로 환산해 줍니다. 직접 만든 태그는 `scale`을 `0.01`로 설정하십시오.

**에이전트에 없는 객체는 사유가 있는 bad 읽기 값이며**, 같은 요청의 다른 것은 계속 읽힙니다. v2c와 v3는 어느 것이 없는지 알려 주고, 없는 객체에 요청 전체의 오류로 답하는 v1에서는 드라이버가 그것을 빼고 나머지를 다시 요청합니다. 에이전트가 감당하기에 너무 큰 응답은 절반씩 나누어 다시 요청합니다.

장치 옵션(`config`):

| 옵션 | 의미 |
|---|---|
| `version` | `1`, `2c`, `3`. 기본값 `2c` |
| `community` | v1과 v2c 커뮤니티. 이 두 버전에는 필수이며 **기본값이 없습니다.** `public`은 공장의 스위치를 묻는 사람이면 누구나 읽게 되는 방법입니다. 시크릿 |
| `username` | v3 사용자 |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv`, `authPriv`. 기본값: 개인정보 보호 암호문이 있으면 `authPriv`, 인증 암호문만 있으면 `authNoPriv`, 그 외에는 `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384`, `SHA512`. 기본값 `SHA` |
| `authPassword` | 인증 암호문. 시크릿 |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C`, `AES256C`. 기본값 `AES` |
| `privPassword` | 개인정보 보호 암호문. 시크릿 |
| `contextName` | v3 컨텍스트. 거의 항상 비어 있음 |
| `transport` | `udp`(기본값) 또는 `tcp` |
| `retries` | 응답이 없는 요청을 다시 보내는 횟수, 0에서 10. 기본값 1 |
| `maxRepetitions` | 워크에서 GETBULK 한 번당 행 수. 기본값 10이며, 가장 작은 에이전트도 응답할 수 있는 값 |
| `browseRoots` | 포인트를 찾을 때 훑을 OID. 기본값: system, 인터페이스 테이블, 호스트 리소스, 로드 테이블, SNMP 에이전트의 extend 출력 |
| `browseMaxNodes` | 탐색이 멈추는 지점. 기본값 2000 |

주소는 `host` 또는 `host:port`이며, 포트는 기본값이 161입니다.

**틀린 커뮤니티에는 아무 응답도 없습니다.** SNMPv1이나 v2c 에이전트는 모르는 커뮤니티가 담긴 요청을 버리므로, 틀린 커뮤니티, 틀린 포트, 방화벽, 꺼진 에이전트가 모두 타임아웃처럼 보이며, HotLoop의 메시지는 이 네 가지를 모두 알려 줍니다. SNMPv3는 이를 구별해 줍니다. 틀린 암호문이나 모르는 사용자는 그렇다고 거부되며(`ErrAuthRejected`), HotLoop은 같은 자격 증명을 다시 시도하기 전에 오래 기다립니다.

`Browse`는 HotLoop이 이름을 댈 수 있는 하위 트리를 훑고 각 객체에 이름을 붙입니다. `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`처럼 MIB의 이름이며, 모르는 객체는 `oid.1.3.6.1...` 형태의 OID입니다. 이름과 그 뒤의 OID, 타입, 단위는 그것을 정의하는 MIB에서 가져옵니다. SNMPv2-MIB(RFC 3418), IF-MIB(RFC 2863), HOST-RESOURCES-MIB(RFC 2790), SNMP 에이전트의 UCD-SNMP-MIB와 NET-SNMP-EXTEND-MIB입니다. 에이전트가 가진 그 밖의 모든 것도 읽을 수 있으며, OID로 태그에 추가하십시오.

통합([통합](/ko/iot/integrations/#snmp) 참조)이 대신 물어봐 줍니다.

### BACnet/IP

건물 자동화 컨트롤러, 계량기, 온도 조절기 등 BACnet을 쓰는 IP 네트워크의 모든 것입니다. 읽기 전용입니다. HotLoop은 BACnet 속성을 절대 쓰지 않습니다. 쓰기는 우선순위 배열을 거쳐 명령 가능한 출력에 반영되는데, 설정된 채로 남은 우선순위는 설정한 사람이 퇴근한 뒤에도 장비를 그 상태에 붙잡아 두기 때문입니다. 이것은 일부러 설계해야 하는 기능이지 그냥 방치해 둘 것이 아닙니다.

실제 장치에서 녹화한 프레임을 항상 실행되는 테스트로 디코딩해 검증하며, 테스트 중에는 그 장치로 검증합니다.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

태그의 주소는 객체이며 `<type>:<instance>`이고, 현재 값이 아니면 점과 속성이 붙습니다. 타입은 이름이나 약어로 씁니다. `analog-input`(`ai`), `analog-output`(`ao`), `analog-value`(`av`), `binary-input`(`bi`), `binary-output`(`bo`), `binary-value`(`bv`), `multi-state-input`(`msi`), `multi-state-output`(`mso`), `multi-state-value`(`msv`), `accumulator`(`acc`), `integer-value`(`iv`), `positive-integer-value`(`piv`), `large-analog-value`(`lav`), `characterstring-value`(`csv`). 이름으로 쓰는 속성은 `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision`, `application-software-version`이며, 그 밖의 속성은 번호로 씁니다.

태그가 무엇이 되는지는 `dataType`을 따릅니다. 장치가 보낸 숫자(real, double, unsigned, signed, enumerated, boolean)는 그 숫자이고, binary 객체의 `active`는 1, `inactive`는 0입니다. 문자열은 텍스트이며, 태그가 숫자이고 텍스트가 숫자이면 숫자입니다. `null`인 현재 값은 장치가 보고할 것이 없다고 알리는 bad 읽기 값입니다. 값이 둘 이상인 속성(객체 목록)은 태그가 될 수 없습니다.

**상태 플래그는 읽기 값의 일부입니다.** 폴링할 때마다 객체의 상태 플래그를 현재 값과 같은 요청으로 읽으며, **fault** 플래그가 설정된 객체는 사유와 함께 **bad**로 읽힙니다. **out of service**이거나 **overridden**인 객체는 **uncertain**으로 읽힙니다. 그 현재 값은 측정이 아니라 사람이나 프로그램이 넣은 것이며, 트렌드 차트와 보고서는 uncertain 읽기 값을 bad처럼 제외합니다(품질 규칙). **In alarm**만 있는 경우는 알람 상태에 있는 포인트의 정상적인 읽기 값입니다.

**장치에 없는 것은 사유가 있는 bad 읽기 값이며, 나머지는 계속 읽힙니다.** ReadPropertyMultiple은 속성마다 따로 응답하므로, 없는 객체(`unknown-object`)나 없는 속성(`unknown-property`)은 그 태그만 실패하고 다른 태그는 실패하지 않습니다. ReadPropertyMultiple을 거부하는 장치는 그 후로 속성을 하나씩 읽습니다.

**분할은 하지 않습니다.** 클라이언트는 장치에 분할 응답을 받을 수 없다고 알립니다. 응답이 한 프레임에 들어가지 않는 장치는 중단하며(`segmentation-not-supported`), HotLoop은 한 번에 요청하는 객체 수를 절반으로 줄입니다. 객체 목록이 너무 커서 한 번에 보낼 수 없는 장치는 요소 하나씩 읽습니다.

장치 옵션(`config`):

| 옵션 | 의미 |
|---|---|
| `deviceInstance` | 이 주소의 장치가 가질 것으로 기대하는 인스턴스 번호. 설정했는데 장치가 다른 번호를 말하면 연결이 거부됩니다. 재사용된 주소에서 다른 장치가 응답하거나 컨트롤러가 교체된 경우가 공장이 깨끗해 보이는 틀린 숫자를 얻게 되는 경로이기 때문입니다 |
| `localAddress` | 보낼 때 사용할 이 머신의 네트워크 카드 주소이며, 카드가 둘 이상인 호스트용. 대개 비워 둠 |
| `retries` | 응답이 없는 요청을 다시 보내는 횟수, 0에서 10. 기본값 1 |
| `browseMaxObjects` | 탐색이 멈추는 지점. 기본값 1000 |

주소는 `host` 또는 `host:port`이며, 포트는 기본값이 47808입니다. BACnet/IP에는 자격 증명이 없으므로 숨길 것도 없습니다.

**연결하면 장치에 누구인지 묻습니다.** HotLoop은 장치에 유니캐스트 Who-Is를 보내고 I-Am에서 장치 인스턴스를 가져옵니다. 이에 응답하지 않는 장치에는 와일드카드 인스턴스(4194303)로 자신의 장치 객체를 요청하며, 표준에 따르면 장치는 이에 자기 자신으로 응답합니다. 둘 다 응답하지 않는 장치는 두 가지를 모두 시도했다고 보고합니다. 흔한 원인이 모두 같아 보이기 때문입니다. 틀린 주소나 포트, 방화벽, 꺼진 장치, 라우터 뒤의 네트워크에 있는 장치입니다.

**라우팅은 구현되어 있지 않습니다.** HotLoop은 UDP 데이터그램을 보낼 수 있는 장치와 통신합니다. BACnet 라우터 뒤의 MS/TP 트렁크나 다른 BACnet 네트워크에 있는 컨트롤러에는 도달할 수 없고, BBMD로만 도달할 수 있는 장치(foreign device registration)에도 도달할 수 없습니다. 라우터 자체의 BACnet/IP 쪽 주소를 지정하거나 앞에 게이트웨이를 두십시오. [게이트웨이 모드](#그-밖의-모든-것-게이트웨이-모드)를 참조하십시오.

`Browse`는 장치 자체의 객체(이름, 벤더, 모델, 펌웨어), 객체 목록, 그리고 HotLoop이 읽는 모든 객체의 이름, 설명, 단위, 현재 값, 상태 플래그, 그리고 multi-state 객체의 상태 텍스트를 읽습니다. 태그는 객체 자신의 이름을 따라 짓고, 두 객체가 이름을 공유하면 주소를 덧붙입니다. 단위는 레이블이 되고, 의미가 있는 경우에는 엔티티 클래스가 됩니다. 섭씨는 `°C`와 `temperature`, 상대 습도 퍼센트는 `%`와 `humidity`, 킬로와트시는 `kWh`와 `energy`입니다. HotLoop에 레이블이 없는 단위는 레이블 없이 두고 설명에 그 번호로 적습니다. 이 단위의 번호와 이름은 각 이름에 자체 테이블이 정한 번호를 보내는 실제 장치로 검증되었습니다. 통합([통합](/ko/iot/integrations/#bacnetip) 참조)이 대신 물어봐 줍니다.

## 내보내기: Kafka API

위의 모든 것은 장치의 값을 들여옵니다. HotLoop은 값을 Kafka 브로커로 이벤트 스트림으로 내보낼 수도 있습니다. 히스토리안이 보관하는 모든 읽기 값과 시스템 로그의 모든 줄(알람, 장치 연결과 끊김, 변경)을 지정한 토픽에 JSON으로 보냅니다. 설정의 히스토리안 대상에서 설정하며, Apache Kafka, Redpanda, 그 밖에 Kafka API를 사용하는 모든 것을 TLS와 SASL 로그인으로 받아들입니다. 레코드 형식, 여기서 "at least once"의 의미, 검증된 것과 그렇지 않은 것은 [히스토리안 대상](/ko/iot/historian-targets/#kafka-api-이벤트-스트림)에 있습니다. 클라이언트는 [franz-go](https://github.com/twmb/franz-go)입니다.

## 그 밖의 모든 것: 게이트웨이 모드

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

이 프로토콜은 네이티브로 지원하지 않으며 드라이버도 없습니다. 스텁으로 채워 넣어야 할 빈틈이 아니라 의도적인 선택입니다.

이 프로토콜을 쓰는 현장에는 거의 항상 OPC UA나 Modbus로 다시 게시하는 게이트웨이가 이미 있습니다. OPC UA 서버가 있는 PROFINET IO 컨트롤러, Modbus 맵이 있는 HART 멀티플렉서 등입니다. 장치가 그 엔드포인트를 가리키게 하고 OPC UA나 Modbus로 설정하십시오.

현장의 기존 게이트웨이가 이미 하는 일을 각각 중복하는 드라이버를 여덟 개 더 만들면, 장비를 테스트하기 가장 어려운 프로토콜에서 미묘하게 틀릴 것이 여덟 개 늘어납니다. 현장에 게이트웨이가 정말 없고 이 중 하나를 네이티브로 써야 한다면, 그것은 일정을 잡아야 하는 실제 작업이지 "not implemented"를 기록하는 파일을 추가하는 일이 아닙니다.

**이 트리에는 자리 표시용 드라이버가 없습니다.** 프로토콜은 동작하는 구현이 있거나 이 섹션에 있거나 둘 중 하나입니다. 모델이 선언한 모든 프로토콜에 컴파일된 드라이버가 있고 그 반대도 성립하는지를 테스트가 강제합니다.

## 장치 자격 증명

장치의 `config`와 `address`는 드라이버가 로그인에 쓰는 정보를 찾는 곳입니다. 아래는 프로토콜마다 읽는 자격 증명이며, 모두 API를 통해서는 쓰기 전용입니다(4.15.1). 모든 역할에 `[redacted]`로 표시되고, 자리 표시자를 보내거나 키를 생략하고 저장하면 저장된 값이 유지되며, 새 문자열은 그것을 교체합니다. 규칙과 API를 거치지 않는 것은 [인증과 사용자](/ko/iot/authentication/#장치-자격-증명은-쓰기-전용입니다)에 있습니다.

| 프로토콜 | 설정의 자격 증명 | 주소의 자격 증명 |
|---|---|---|
| OPC UA | `password`(`username`과 함께) | 없음: 주소의 사용자 정보는 숨겨지며 드라이버는 무시합니다 |
| MQTT / Sparkplug B | `password`(`username`과 함께) | 클라이언트가 사용하는 `mqtt://user:pass@host` |
| HTTP / REST | `password`(`username`과 함께, 기본 인증으로 전송), `Accept`와 `Content-Type` 같은 일반 헤더를 제외한 `headers`의 모든 값(API 키나 `Authorization` 헤더를 넣는 곳), 자격 증명을 언급하는 `body`와 `writeBody` | 주소와 `writeUrl`의 `http://user:pass@host`와 `?api_key=` 형태의 쿼리 값 |
| MTConnect | `password`(`username`과 함께), 같은 예외를 제외한 `headers`의 모든 값 | `http://user:pass@host`와 쿼리 값 |
| UniFi Network | `password`(`username`과 함께). 항상 암호화되어서만 저장됨: 키(아래)가 없으면 장치를 저장할 수 없음 | 없음: 주소는 콘솔의 `https://` URL |
| BACnet/IP | 없음 | 없음: 주소는 `host` 또는 `host:port` |
| CODESYS | OPC UA와 같이 `password`(`username`과 함께) | 없음: 주소의 사용자 정보는 숨겨지며 드라이버는 무시합니다 |
| SNMP | `community`(v1, v2c), `authPassword`와 `privPassword`(v3), `username`과 함께 | 없음: 주소는 `host` 또는 `host:port` |
| Modbus, S7comm, EtherNet/IP | 없음 | 없음: 주소의 사용자 정보는 숨겨지며 드라이버는 무시합니다 |

**저장 시 암호화.** `HOTLOOP_SECRET_KEY_FILE`을 설정하면(차트가 생성한 키로 설정합니다) 위 표의 설정 열에 있는 모든 자격 증명이 데이터베이스 밖에 있는 그 키로 암호화되어 데이터베이스에 저장되므로, 덤프나 백업에는 암호문만 있습니다. HotLoop의 나머지와 드라이버는 그 차이를 알지 못합니다. URL(`mqtt://user:pass@host`, `?api_key=`)이나 HTTP `body` 같은 자유 텍스트에 쓴 자격 증명도 암호화됩니다. 주소나 옵션 전체가 봉인되어 입력한 그대로 돌아오며, 비밀이 없는 URL은 읽을 수 있는 채로 남습니다. 그래도 자격 증명을 넣기에는 `password` 옵션이 더 깔끔합니다. [백업과 복원](/ko/iot/backup/#장치-자격-증명과-비밀-키)을 참조하십시오.

자격 증명처럼 보이는 이름의 다른 옵션(`password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`를 포함하거나 `key`로 끝나거나, `pass`, `pw`, `auth`, `cred`, `sig` 같은 단어를 포함하는 것 등)도 어떤 프로토콜에 있든 숨겨집니다. 그래서 나중에 드라이버에 추가된 옵션은 누군가 숨기지 말아야 한다고 결정할 때까지 숨겨집니다. 테스트는 모든 드라이버의 옵션을 훑어, 각 옵션이 자격 증명 목록이나 자격 증명이 아니라고 알려진 옵션 목록에 오를 때까지 실패합니다. 전체 규칙은 [인증과 사용자](/ko/iot/authentication/#장치-자격-증명은-쓰기-전용입니다)를 참조하십시오.

## 장치 추가

1. **Devices → Add device.** 프로토콜을 고르고 주소를 입력합니다.
2. 프로토콜이 지원하는 경우 **Discover tags**를 사용합니다. OPC UA, EtherNet/IP, MTConnect, MQTT(Sparkplug birth 이후), HTTP, SNMP, BACnet/IP, CODESYS가 해당합니다. Modbus와 S7comm은 자신의 포인트를 열거할 수 없으므로, 장치 문서를 보고 직접 선언하십시오.
3. 가져온 태그는 **읽기 전용**으로 만들어집니다. 장치가 우연히 노출한 포인트가 누군가 명령해도 된다고 결정한 포인트는 아닙니다. 태그를 하나씩 의도적으로 쓰기 가능으로 표시하십시오.
4. 원시 카운트에는 `scale`과 `offset`을 설정합니다. `engineering = raw × scale + offset`. 채널이 끊어지거나 범위를 벗어났을 때 계측기가 코드를 보낸다면, 숫자로 읽히지 않고 bad로 읽히도록 [데이터 없음 값](#데이터-없음-값)에 나열하십시오.
5. 노이즈가 있는 모든 것에 `deadband`를 설정합니다. 문제가 되지 않을 만큼 작은 변화에 대한 히스토리안 쓰기를 막아 줍니다. 설정하지 않으면 마지막 비트가 흔들리는 12비트 센서가 스캔마다 영원히 행을 하나씩 씁니다.

## 데이터 없음 값

열전대가 타 버린 기록계는 조용해지지 않습니다. 계속 응답하며 레지스터에 코드를 넣습니다. "undefined"는 0x8005, "over range"는 0x7FFF입니다. 스케일 0.1의 int16으로 읽으면 0x8005는 -3276.3도이며, 이것을 고치기 전에는 **good** 품질로 돌아와 실제 온도처럼 히스토리안에 들어가 알람이 판단하도록 그 자리에 남았습니다. 죽은 센서가 차가운 센서처럼 보였습니다.

그래서 태그에 "측정 없음"을 뜻하는 원시 값을 나열할 수 있습니다. 각 값에는 사유가 있습니다. 읽기 값의 원시 값이 목록에 있으면 읽기 값은 **bad**이고, 사유가 붙으며, 스케일과 오프셋은 그 값에 적용되지 않습니다.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

이 여덟 가지는 DX 통신 매뉴얼(IM 04L41B01-17E, 4.3절, 4-35쪽)에 나오는 Yokogawa DX 계열의 코드입니다. HotLoop에만 있는 것이 아니라 모든 프로토콜의 모든 태그에 있는 같은 필드이며, DX 목록은 우리가 가장 먼저 겪은 것일 뿐입니다. 각 코드는 태그에 있으므로, 다른 단위로 실제로 0x7F7F를 읽을 수 있는 기록계 채널은 그것을 읽기 값으로 유지합니다.

| 필드 | <span class="sr-only">세부 정보</span> |
|---|---|
| `raw` | 장치의 코드이며, 매뉴얼에 인쇄된 방식으로 씁니다. `"0x8005"`(16진수), `"-32763"` 또는 `32773`(10진수). 문자열 또는 숫자 그대로. 필수 |
| `reason` | 읽기 값의 품질이 말하는 내용. 최대 120자. 생략하면 `raw value 0x8005 means no measurement`로 읽히므로, 읽기 값은 이유를 말하지 않고 bad가 되는 일이 없습니다 |

태그 편집기에서는 **데이터 없음 값** 상자입니다. 한 줄에 코드 하나, 코드, 공백, 사유 순입니다.

### 어떤 숫자를 쓰는가

레지스터에 기반한 Modbus 포인트에서 코드는 포인트의 바이트 및 워드 순서를 적용한 뒤 장치가 보유한 정수입니다. 포인트가 디코딩되는 숫자와 같으므로, 매뉴얼이 "계측기가 8005h를 돌려준다"고 하면 여기서는 정확히 `"0x8005"`입니다.

- **int16과 그 밖의 부호 있는 타입.** `0x8005`와 `-32763`은 같은 레지스터이며 `32773`도 같습니다. 매뉴얼이 쓰는 대로 쓰십시오. 세 가지 모두 일치합니다. 타입에 맞지 않는 코드(int16에서 `0x10000`)는 장치가 연결될 때 거부됩니다. 절대 일치할 수 없는 목록은 오류보다 나쁘기 때문입니다. 한 태그에서 같은 값을 두 가지로 쓰는 것도 거부됩니다.
- **uint16과 그 밖의 부호 없는 타입.** `0`부터 그 타입의 최댓값까지. 음수는 거부됩니다.
- **int32, uint32, int64, uint64.** 32비트와 64비트에서 같은 규칙입니다. `CDAB` 워드 순서인 int32에서 `0x7FFFFFFF`는 전송선에서 온 순서가 아니라 워드를 올바르게 뒤집은 뒤의 값입니다.
- **float32와 float64.** 코드는 레지스터의 비트 패턴이므로 16진수여야 합니다. quiet NaN은 `0x7FC00000`입니다. 10진수는 거부됩니다. float로서의 32773과 비트 패턴으로서의 32773은 다른 것이며 우리는 추측하지 않기 때문입니다.
- **비트, 코일, 디스크리트 입력, 문자열.** 비교할 원시 숫자가 없으므로, 이들에 `noData`를 설정하면 장치가 연결될 때 거부됩니다.

검사는 디코딩, 스케일, 오프셋 이전의 원시 비트에서 이루어집니다.

### 다른 프로토콜

이미 디코딩된 숫자를 넘기는 모든 드라이버가 같은 목록을 확인합니다. S7comm, EtherNet/IP, OPC UA, HTTP, MQTT(발견된 장치 포함)입니다. 비교하는 것은 그 디코딩된 숫자이며 정수로 비교하므로, 그 숫자 그대로 쓰십시오. 0x8005를 담은 S7 INT는 -32763이므로 `-32763`이라고 쓰십시오. 여기서 16진수는 같은 숫자를 쓰는 다른 방법일 뿐입니다. 디코딩된 숫자는 폭을 잃었으므로 비트 패턴으로 되돌려 읽을 수 없기 때문입니다. 소수 값은 절대 일치하지 않습니다. 이 목록은 장치가 이런 코드를 보내는 곳에서만 설정할 가치가 있으며, MTConnect와 UniFi가 보고하는 대부분은 그렇지 않습니다.

### 센티널이 하는 일

- **품질**은 `bad`이며 읽기 값에 사유가 붙습니다. `GET /api/values`와 실시간 스트림(`reason`)에, 태그 화면의 품질 옆에, 태그의 엔티티에서는 `quality_reason` 속성으로 표시됩니다.
- **값**은 비어 있으며 0도 아니고 스케일이 적용된 코드도 아닙니다. 스케일과 오프셋은 적용되지 않습니다.
- **히스토리안**은 다른 bad 읽기 값과 똑같이 품질을 bad로 기록하며, 값 열에는 의미 있는 것이 없습니다. 좋은 읽기 값이 없는 버킷은 다른 bad 읽기 값과 같이 트렌드에서 공백으로 표시됩니다.
- **알람.** bad 읽기 값은 값 알람을 절대 발생시키지 않습니다. 상한, 하한, 같음, 변화율 모두 다른 bad 읽기 값과 같이 이전 상태를 유지합니다. 태그의 `bad-quality` 알람은 발생하며, 기본 메시지에 사유가 들어갑니다(`dx-1/ch01 bad-quality: undefined`). 직접 만드는 메시지에 사유를 넣으려면 `{reason}`을 사용하십시오.
- **로그북**은 태그의 엔티티가 bad가 된 것을 기록하며, 사유는 엔티티의 `quality_reason` 속성입니다.

### 위치

태그에 저장됩니다. API에서는 `POST /api/tags`의 `noData` 목록이며([HTTP API](/ko/iot/api/#post-apitags) 참조), 편집기에서는 위의 상자이고, Edge Relay에서는 장치 파일의 태그에 있는 같은 JSON입니다([Edge Relay 레퍼런스](/ko/edge-relay/reference/) 참조). 태그를 저장하면 실행 중인 장치가 다시 로드되므로, 변경은 다음 폴링부터 적용되고 직접 재시작할 필요는 없습니다. 다시 발견(re-discovery)해도 태그의 목록은 건드리지 않습니다.

## 품질

모든 읽기 값에는 `good`, `uncertain`, `bad`가 붙습니다.

**Bad는 값을 알 수 없다는 뜻이며, 0이라는 뜻이 아닙니다.** 포인트를 읽을 수 없는 드라이버도 bad로 표시한 읽기 값을 계속 내보냅니다. 침묵은 값이 바뀌지 않은 것과 구별되지 않고, 트렌드에서 "센서가 0을 읽는다"와 "센서가 응답을 멈췄다"의 차이는 프로세스 문제와 계측기 문제의 차이이기 때문입니다.

알람 평가는 bad 읽기 값을 평가하지 않고 이전 상태를 유지합니다. 0으로 고장 나는 센서가 있으면, 그렇지 않을 경우 장치의 모든 하한 알람을 발생시켜 프로세스 이벤트처럼 보일 것입니다.
