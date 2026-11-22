---
title: "Инсталиране на HotLoop for CODESYS"
description: "Инсталирайте HotLoop for CODESYS от App Store на EmberCORE или с Helm: какво трябва на възела, Secret на профила, какво прави сам и как да го проверите."
sidebar:
  label: "Инсталиране"
---

HotLoop for CODESYS е Helm чарт, `hotloop-codesys`, който инсталира HotLoop Edge и инсталатор на профила на същия възел като CODESYS runtime. Чартът е публикуван на `{{codesysChartRepo}}`, с {{codesys}} като най-нова, а образът на инсталатора се изтегля без вход. В EmberNet е приложение в App Store. Без EmberNet е Helm върху k3s.

## Какво трябва първо на възела

- **CODESYS runtime на същия възел, който публикува своя OPC UA сървър на порт 4840.** Инсталаторът взема адреса на самия възел от Kubernetes и чете `<node address>:4840`. Чартът на самия runtime публикува този порт на хоста.
- **Symbol Configuration в програмата на PLC** с включено *Support OPC UA features*, която изброява променливите, които искате да виждате, или `{attribute 'symbol' := 'read'}` върху тях в декларацията. PLC без Symbol Configuration отговаря на настройката със съобщение, което казва да се добави такава. Това е единствената промяна в проекта на PLC.
- **HotLoop {{codesysNeeds}}**, който чартът обвива. CODESYS конекторът дойде с HotLoop 4.19.4. Чартът зависи от чарта `hotloop-edge` на линията `~{{codesysNeeds}}`.
- **Профил.** Един Secret с един ключ. [Страницата за профила](/bg/codesys/profile/) има формата му.

## От App Store на EmberCORE

Чартът е маркиран за персонала, затова Store го показва за персонала на EmberNet, който го инсталира в tenant-а на клиента. Не е бутон, който tenant-ът натиска сам, така че питайте този, който се грижи за вашия tenant. Store записва профила в namespace-а на tenant-а като `<release>-profile`, подава на чарта избрания възел и етикетите на tenant-а и подава публичния ключ на таблото за вход. След това няма какво да се прави.

## С Helm

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

Наименувайте Secret като `<release>-profile` или сменете какво търси чартът с `profile.existingSecret` (Secret) и `profile.key` (ключът, `profile.json` по подразбиране). За да закотвите инсталацията към възела на runtime, задайте `nodeSelector`. За HotLoop сам, без профил, за настройка на ръка, инсталирайте с `--set provisioner.enabled=false`.

## С runtime в мрежата на възела

Runtime, инсталиран от своя чарт с `network.hostNetwork=true`, държи порт 8080 на хоста за WebVisu, така че страницата на HotLoop не може да слуша и там на 8080. Чартът кара страницата на HotLoop да слуша на 8090 вътре в pod-а и държи Service на 8080, така че плочката в App Store и инсталаторът я достигат както преди. Инсталирайте с включена мрежа на хоста и за двата:

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

OPC UA PubSub слушателите на HotLoop свързват UDP порт изключително, така че два слушателя на един порт не могат да се свържат и двата. Инсталаторът отказва профил, който го иска, и казва защо.

## Какво прави инсталирането

1. HotLoop Edge стартира на този възел със SQLite върху local-path хранилището на възела. Без pod за база данни, една реплика, а стратегията за обновяване е `Recreate`.
2. Инсталаторът стартира на същия възел. Чете монтирания профил при всеки проход, така че по-нов профил достига работеща инсталация. Изчаква HotLoop и собствения CODESYS runtime на възела, после настройва устройството, променливите, алармите и екрана на профила.
3. Поглежда отново на всеки пет минути и поддържа устройството вярно, докато програмата на PLC се променя. Променливите, които профилът изброява и PLC вече има, се добавят, а такава, която PLC вече няма, се чете като лоша с причината на сървъра.
4. И двата pod-а толерират `node.kubernetes.io/unreachable` и `not-ready` без `tolerationSeconds`, така че възел, който загуби контролната си равнина, ги запазва. Чартът го носи сам и не зависи от настройката на клъстера.

OPC UA сървърът, вграденият брокер, публикуването от edge и резервните копия са изключени, защото нито едно не е желано до runtime. Включете някое чрез values на `hotloop-edge`, ако го искате.

## Проверете го

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

Добрият старт казва, че устройството е настроено със своите променливи, нито една за запис, и че алармите и екранът са създадени. Отворете услугата на HotLoop, влезте като `admin` и погледнете Устройства и Табла. Паролата на admin е в Secret на release, както във всеки чарт на HotLoop.

## Вход от таблото

От HotLoop 4.19 чартът Edge вписва човек от подписаното твърдение на таблото на EmberCORE (values `embernetSignin`, четири променливи `HOTLOOP_AUTH_ASSERTION_*` и анотацията на Service `embernet.ai/signin: assertion`). Този чарт наследява всичко това от подчарта `hotloop-edge`, а Store му подава публичния ключ. Инсталаторът ползва admin акаунта на чарта, който локалният вход още позволява. В тестов клъстер добро твърдение вписа човек като operator или като admin, а твърдение за грешно приложение, за грешен tenant, изтекло, от грешен издател и подправено бяха отказани всяко.

## Докъде е стигнало

Пускано е на физически хардуер (2026-11-17), а чартът се изгражда от живия индекс с Helm. [Докъде е стигнало](/bg/codesys/where-it-stands/).

