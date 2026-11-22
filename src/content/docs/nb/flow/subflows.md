---
title: "Underflyter i HotLoop Flow"
description: "Pakk et sett noder inn i én gjenbrukbar node med egne egenskaper, og se hva en underflyt deler med flyten rundt seg."
---

Hver instans får sin egen kopi av malens noder, sin egen flytkontekst og sine egne løste egenskaper. Den samme malen viser `4.2 bar` i én instans og `4.2 kPa` i den neste, bekreftet fra ende til ende gjennom en ekte utrulling i stedet for å bli påstått i en enhetstest.

Utvidelsen lager en **egen graf** i stedet for å skrive om de tolkede flytene, og det er hele designvalget. Flytfilen blir aldri rørt, så rundturen som er identisk byte for byte holder fortsatt, og den utvidede grafen er en vanlig graf, så planleggeren, Catch-rutingen, målingene og editorens statushendelser fungerer inne i en underflyt uten spesialtilfeller noe sted.

Nesting fungerer. En feil ingen fanger inne i en underflyt, går ut til Catch-noden på fanen som kaller, for ellers er en underflyt bare et sted der feil forsvinner. En konfigurasjonsnode som er deklarert i en mal, er **delt** av alle instanser i stedet for kopiert, siden en MQTT-broker i en underflyt er en forfatter som sier «del dette», og å kopiere den ville åpnet én forbindelse per instans mot noe som nesten sikkert teller dem.
