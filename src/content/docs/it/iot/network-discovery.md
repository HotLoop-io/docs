---
title: "Rilevamento di rete"
description: "HotLoop ascolta con mDNS, SSDP e DHCP e mostra cosa c'è sulla rete dello stabilimento, e non invia nulla a meno che indichiate una rete da sondare."
---

HotLoop ascolta la rete dello stabilimento e vi dice cosa c'è: il nodo ESPHome nel cortile, lo Shelly sul compressore, il server OPC UA sulla linea 3, la scatola UPnP che qualcuno ha collegato e dimenticato, la cosa che ha appena chiesto un indirizzo. Ognuno compare in Devices, Discovered, sotto i dispositivi che si sono annunciati via MQTT ([rilevamento MQTT](/it/iot/mqtt-discovery/)), con cosa è e come HotLoop potrebbe parlargli.

Poi decide una persona. Nulla di ciò che si sente sulla rete viene mai aggiunto da solo, e nulla viene mai armato.

## Ascoltare, non scansionare

Su una rete OT che leggete, non si scansiona. Una scansione delle porte ha già mandato in tilt più di un PLC che rispondeva a un pacchetto che non si aspettava, e «è solo rilevamento» non consola nessuno alle tre di notte. Per questo, per impostazione predefinita, HotLoop non invia assolutamente nulla:

- **mDNS** (attivo): i dispositivi annunciano i loro servizi all'avvio, e ogni risposta alla domanda di chiunque viene inviata in multicast a tutto il segmento. Un telefono che apre un'app o un portatile che cerca una stampante fa la domanda; HotLoop ascolta per caso.
- **SSDP** (attivo): i dispositivi UPnP inviano in multicast `NOTIFY ssdp:alive` quando entrano e ogni pochi minuti dopo. HotLoop sente anche questi.
- **DHCP** (disattivato, vedere sotto): un dispositivo che entra nella rete trasmette una richiesta di indirizzo con il suo MAC e di solito il suo nome.

Chiedere è **sondare**, e si attiva per rete, dall'installazione, mai con un pulsante:

| Variabile | Predefinito | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | ascolta mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | ascolta SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | ascolta le richieste DHCP su UDP 67 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | vuoto | le reti su cui il sondaggio è attivo, come CIDR: `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | ogni quanto gira un sondaggio lì |

Su una rete indicata, un sondaggio invia una domanda mDNS per ogni tipo di servizio e per quelli che HotLoop conosce, chiede di nuovo per ogni tipo comparso, invia un `M-SEARCH` SSDP e legge dal dispositivo la descrizione di ogni dispositivo UPnP (nome, produttore e modello). Su ogni altra rete non invia nulla, e il pulsante Probe now viene rifiutato dove non è indicata alcuna rete. Indicate le reti che intendete: una /8 sono 16 milioni di indirizzi, e HotLoop li interrogherà se glielo dite.

## Con cosa sa parlare

| Sentito | È | Accettandolo |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | un server OPC UA (OPC 10000-12 Allegato C: l'endpoint è l'indirizzo e la porta dell'SRV più il `path` del TXT) | crea un dispositivo OPC UA a quell'endpoint, anonimo e non protetto all'inizio, senza tag. Sfogliatelo con Discover tags e impostate la sua sicurezza prima che porti qualcosa che conta |
| mDNS `_shelly._tcp`, o `_http._tcp` con `gen` | uno Shelly, Gen2 o successivo (il suo TXT `gen`, `app` e `ver`) | crea un dispositivo HTTP che legge `http://<it>/rpc/Shelly.GetStatus`, la chiamata di stato propria di Shelly, in sola lettura, senza tag. Discover tags elenca ogni valore. Uno Shelly con il login attivo richiede l'autenticazione digest, che il driver HTTP non gestisce |
| mDNS `_esphomelib._tcp` | un nodo ESPHome (il suo TXT: `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | lo registra come noto e non crea nulla. HotLoop legge ESPHome via MQTT: date al nodo un blocco `mqtt:` che punta al broker di HotLoop e si annuncia da solo, e la scheda lo dice (abbinato per MAC) |
| mDNS `_mqtt._tcp` | un broker MQTT | lo registra. Aggiungetelo in Settings, MQTT per sentire cosa si annuncia su di esso |
| mDNS `_http._tcp`, qualsiasi altra cosa | una pagina web, o un servizio per cui HotLoop non ha parole | lo registra |
| SSDP | un dispositivo UPnP, per il suo uuid: tipi di dispositivo, `SERVER` e, con il sondaggio attivo, la sua descrizione | lo registra |
| DHCP | un dispositivo che chiede un indirizzo: MAC, nome host, classe del fornitore | lo registra |

«Lo registra» merita comunque un clic. Su una rete di stabilimento ogni scatola dovrebbe essere una che qualcuno conosce, e un ritrovamento accettato è una decisione con un nome e un'ora. La prossima cosa sconosciuta si nota.

Una scheda dice quando due ritrovamenti sono la stessa scatola: il MAC mDNS di un nodo ESPHome e il suo annuncio MQTT, una richiesta DHCP e un host mDNS sullo stesso indirizzo.

Accettare non arma nulla. Un dispositivo creato dall'accettazione non ha tag finché qualcuno non li sceglie, e ogni punto su di esso è in sola lettura finché qualcuno non lo arma nell'editor dei tag, attraverso lo stesso gate di scrittura di tutto il resto. L'indirizzo nella proposta viene dall'annuncio del dispositivo stesso, e la finestra di accettazione lo mostra così potete verificare che sia la scatola che pensate.

**Ignore** nasconde un ritrovamento e lo tiene nascosto quando viene risentito. **Un-ignore** lo riporta.

## Tutto non affidabile

Chiunque possa mettere un pacchetto sul segmento può dichiararsi qualsiasi cosa. Quindi:

- ogni stringa viene troncata e privata dei caratteri di controllo, e la schermata la mette nella pagina come testo, mai come HTML;
- una descrizione UPnP viene letta solo dall'indirizzo da cui è arrivato l'annuncio, solo su una rete di sondaggio, mai attraverso un reindirizzamento e mai oltre 64 KiB. Un `NOTIFY` falsificato che punta `LOCATION` alla pagina web di un PLC, o a HotLoop stesso, non ottiene nulla di scaricato;
- ogni listener accetta 500 datagrammi al secondo e scarta e conta il resto;
- il registro contiene 1.024 ritrovamenti. I nuovi oltre quel numero vengono scartati e contati finché qualcuno non ne gestisce alcuni, e la schermata lo dice;
- una domanda sul cavo è la domanda di qualcuno, non un annuncio: le risposte note che porta sono le convinzioni di chi chiede, e non se ne fa nulla.

## Dove deve stare HotLoop per sentire qualcosa

Multicast e broadcast non attraversano un router, un NAT o una rete di container. HotLoop sente il segmento su cui si trova, e nient'altro:

- **Una macchina sulla rete dello stabilimento** (il binario, o Podman con `--network host`): sente tutto.
- **Kubernetes con una rete di pod**: non sente nulla dello stabilimento. La schermata Discovered mostra le interfacce su cui ascolta, ed è così che lo scoprite. Date al pod `hostNetwork: true`, o una seconda interfaccia sul segmento dello stabilimento (Multus con macvlan), e sentirà lo stabilimento. Il chart non fa né l'una né l'altra cosa per voi: mettere un pod sulla rete dell'host è una decisione sul nodo, non un'impostazione predefinita.

mDNS (5353) e SSDP (1900) sono porte ordinarie sopra 1024, quindi non richiedono privilegi. HotLoop le condivide con ciò che già le detiene, compreso un avahi-daemon sull'host.

## DHCP

Fattibile, onestamente, ma richiede due cose che un container non ottiene per impostazione predefinita, ed è per questo che è disattivato:

1. **I broadcast dello stabilimento.** Una richiesta DHCP va a 255.255.255.255, quindi HotLoop deve stare sul segmento: rete host o un'interfaccia su di esso, come sopra.
2. **La porta UDP 67**, che è sotto 1024. L'immagine di HotLoop gira con uid 65532. O date al binario `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), o impostate il `net.ipv4.ip_unprivileged_port_start` dell'host a 67 o meno. In Kubernetes, aggiungere `NET_BIND_SERVICE` alle capability di un container non root non lo rende efficace da solo; lo fanno la capability sul file o il sysctl.

Non ha mai bisogno di un socket raw né di un container privilegiato: un normale socket UDP sulla porta 67 riceve i broadcast. Non risponde mai, non offre mai un indirizzo, non invia mai un byte. Condivide la porta, quindi un server DHCP sullo stesso host che la condivide a sua volta continua a funzionare; uno che la tiene tutta per sé fa fallire il listener di HotLoop, e la schermata dice perché, senza toccare il server.

Cosa non può vedere: i rinnovi, che vanno in unicast al server. HotLoop sente un dispositivo quando entra, non ogni ora dopo.

## Più repliche

Solo la replica che detiene il lock del rilevamento di rete ascolta e sonda; le altre riprovano ogni 30 secondi, così una subentra se il titolare sparisce. Due che sondano interrogherebbero ogni dispositivo due volte.

## Backup

`net_finds` è in ogni backup: ciò che è stato sentito, e chi ha accettato o ignorato cosa. Le decisioni sono la parte che la rete non ripete mai.

## Come viene testato

Il rilevamento è stato eseguito su reti reali contro veri annunciatori, nodi ESPHome, Shelly e OPC UA, un server multimediale UPnP e client DHCP, e su hardware reale il 2026-11-17.
