---
title: All-services gate
group: Use cases
order: 2
summary: One knock opens every service at once. The whole host goes dark to the internet — except ZeroTier and WireGuard, which are always allowed as a rescue path.
---

# Use case: gate every service at once

Here the host is **fully dark** to the public internet: web, database, dashboards, SSH —
nothing answers. A single valid knock opens **all of them at once** for your source IP,
for the timeout window. When it expires, the host goes dark again.

Two tunnels stay **permanently open** so you are never locked out and management traffic
always flows:

- **ZeroTier** — UDP `9993` underlay + the `zt+` overlay interface
- **WireGuard** — UDP `51820` underlay + the `wg+` interface

> **Why keep those open?** They are your out-of-band rescue path. If a knock ever fails,
> or `fwknopd` is down, you can still reach the box over the VPN overlay. Everything else
> hides behind SPA; the tunnels are the safety net.

---

## The firewall: default-dark, tunnels always on

Order matters — allow rules first, the catch-all `DROP` last. fwknopd will splice its
temporary per-service ACCEPTs in above that final `DROP`.

```bash
#!/usr/bin/env bash
# default-dark baseline with a permanent VPN rescue path
PUB=eth0

# 1. keep existing sessions and loopback
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT

# 2. ALWAYS-ALLOW the VPN underlay ports on the public interface
iptables -A INPUT -i "$PUB" -p udp --dport 9993  -j ACCEPT   # ZeroTier
iptables -A INPUT -i "$PUB" -p udp --dport 51820 -j ACCEPT   # WireGuard

# 3. ALWAYS-ALLOW anything arriving over the VPN overlay interfaces
iptables -A INPUT -i zt+ -j ACCEPT                            # ZeroTier overlay
iptables -A INPUT -i wg+ -j ACCEPT                            # WireGuard overlay

# 4. everything else on the public interface is dark until a knock
iptables -A INPUT -i "$PUB" -j DROP
```

That is the entire policy. Rules 2–3 are the rescue path; rule 4 is the wall; fwknop
punches temporary holes through it.

> **Note.** Rules 2 and 3 are a pair. Rule 2 lets the tunnel's UDP *form* over the public
> IP; rule 3 trusts traffic that has already come *through* the tunnel. Keep both.

## The daemon: open the whole service set on one knock

List every service you want to expose in `OPEN_PORTS`. On a valid SPA packet, fwknopd
opens **all of them together** for the source IP — the client does not have to enumerate
them.

```ini
# /etc/fwknop/access.conf
SOURCE                  ANY
KEY_BASE64              <Rijndael key>
HMAC_KEY_BASE64         <HMAC key>
REQUIRE_SOURCE_ADDRESS  Y
FW_ACCESS_TIMEOUT       60

# one knock → all of these open at once, for the knocking IP only
OPEN_PORTS  tcp/22, tcp/80, tcp/443, tcp/5432, tcp/8080, tcp/9090
```

`OPEN_PORTS` **overrides** whatever single service the client names in its request, so the
client's knock is just the trigger — the server decides the full set opens.

> **Truly everything?** You can widen the window with ranges, e.g.
> `OPEN_PORTS tcp/1-65535, udp/1-65535`. Prefer an explicit list: it opens exactly your
> real services and keeps the temporary ruleset small.

## The client: one stanza, one knock

```ini
# ~/.fwknoprc
[prod-gate]
ACCESS          tcp/22
SPA_SERVER      spa.example.com
KEY_BASE64      <Rijndael key>
HMAC_KEY_BASE64 <HMAC key>
USE_HMAC        Y
```

The `ACCESS tcp/22` here is only the trigger the client sends; the server opens the whole
`OPEN_PORTS` set. From this console, select **prod-gate** and **Knock**. From a shell:

```bash
fwknop -n prod-gate
```

Now, for the next 60 seconds, every listed service answers **your** IP — SSH, the web
apps, the database — all at once:

```bash
ssh user@spa.example.com
curl https://spa.example.com
psql -h spa.example.com -U app
```

When the window closes, the host is dark again. Your live sessions keep running (connection
tracking, rule 1); only *new* connections need a fresh knock.

## Verify

```bash
# from outside the VPN, before knocking — all dark
nmap -Pn -p22,80,443,5432 spa.example.com     # all filtered

# still reachable over the tunnel at any time
ssh user@10.147.0.5                            # ZeroTier overlay IP — always works

# knock, then within 60s — everything opens together
fwknop -n prod-gate
nmap -Pn -p22,80,443,5432 spa.example.com     # all open
```

---

This pattern scales: add a service, add its port to `OPEN_PORTS`, and it joins the gate
automatically — no client change, no new stanza. The VPN rescue path in rules 2–3 means
you can always get back in to edit it.
