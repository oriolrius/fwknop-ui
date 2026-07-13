---
title: SSH blocker
group: Use cases
order: 1
summary: The classic setup — port 22 is invisible to the internet and opens only for you, only after a knock.
---

# Use case: SSH blocker

The simplest, highest-value setup. Your SSH port stops appearing in every scan and
brute-force sweep on the internet. It opens for **your IP only**, for **30 seconds**,
after a single valid packet — long enough to start a session, which then stays up.

> **Result:** `nmap` sees port 22 as *filtered/closed* from everywhere. You knock, then
> `ssh` connects normally. No password-guessing bots, because there is nothing to reach.

---

## Server: `access.conf`

```ini
# /etc/fwknop/access.conf
SOURCE                  ANY
KEY_BASE64              <Rijndael key>
HMAC_KEY_BASE64         <HMAC key>
REQUIRE_SOURCE_ADDRESS  Y
FW_ACCESS_TIMEOUT       30
OPEN_PORTS              tcp/22
```

`OPEN_PORTS tcp/22` means a valid knock opens **only** SSH — nothing else — and only for
the source IP embedded in the packet.

## Server: firewall baseline

```bash
# keep current sessions + loopback, then close SSH to the world
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j DROP
```

fwknopd inserts a temporary `ACCEPT ... tcp/22` for your IP **above** that `DROP` when it
sees a valid packet, and removes it after `FW_ACCESS_TIMEOUT`.

> **Safety:** open a second terminal that is *already* connected before you apply the
> `DROP`, or use an out-of-band console. If the knock ever fails you still want a way in.

## Client: stanza

```ini
# ~/.fwknoprc
[prod-ssh]
ACCESS          tcp/22
SPA_SERVER      spa.example.com
KEY_BASE64      <Rijndael key>
HMAC_KEY_BASE64 <HMAC key>
USE_HMAC        Y
```

## Knock and connect

From this console: select **prod-ssh**, Access `tcp/22`, **Knock**. Or from a shell:

```bash
fwknop -n prod-ssh && ssh user@spa.example.com
```

The `&&` chains them: knock first, and the moment it succeeds, connect — comfortably
inside the 30-second window.

## Verify it works

Before the knock, from another network:

```bash
nmap -Pn -p22 spa.example.com      # 22/tcp filtered
```

Knock, then within 30s:

```bash
nmap -Pn -p22 spa.example.com      # 22/tcp open
```

## Make it a favorite

Once the knock works, hit the **★** in the console to save it as a preset. Now reconnecting
to this host is one click — the console rebuilds and runs `fwknop -n prod-ssh` for you.

---

**Next:** if you run more than SSH — a web app, a database, a dashboard — you probably want
them *all* to appear at once after a single knock. That's the
[all-services gate](/docs/use-cases/all-services-gate).
