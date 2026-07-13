---
title: Set up a host
group: Getting started
order: 1
summary: Install fwknopd, generate keys, and hide a service behind Single Packet Authorization in ~10 minutes.
---

# Set up a host

This guide turns a plain Linux server into an **SPA-protected host**: its ports look
closed to the whole internet, and open only after it receives one valid, encrypted
packet — the *magic packet*.

fwknop-ui never touches the server. It only drives the **client**. The server runs the
real `fwknopd` daemon and your firewall. This page is the one time you log into the box
directly.

> **Mental model.** `fwknopd` sniffs for a single authenticated UDP packet. When it sees
> a valid one it inserts a short-lived firewall rule that lets *your* IP in, then removes
> it. No open port to scan, no handshake to fingerprint.

---

## 1. Install the daemon

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install fwknop-server

# RHEL / Fedora
sudo dnf install fwknop-server
```

Check it landed:

```bash
fwknopd --version
```

## 2. Generate keys

Keys live on **both** ends. Generate them once with the client (on your laptop), then
copy the server half into the daemon config. The easiest path is to let fwknop create a
full stanza:

```bash
fwknop --key-gen --use-hmac -n example-host \
  --save-rc-stanza --force-save-rc-stanza
```

This writes a stanza to `~/.fwknoprc` on the client with a **Rijndael (AES)** key and an
**HMAC** key. Keep that file readable only by you:

```bash
chmod 600 ~/.fwknoprc
```

> **Why HMAC?** It authenticates the packet *before* it is decrypted, so the daemon can
> drop forged traffic without spending a crypto operation. Always use `--use-hmac`.

## 3. Tell the daemon who may knock

Edit `/etc/fwknop/access.conf` on the server. Paste the **same two keys** you just
generated (the `KEY_BASE64` / `HMAC_KEY_BASE64` values from the client stanza):

```ini
SOURCE              ANY
KEY_BASE64          <paste Rijndael key from ~/.fwknoprc>
HMAC_KEY_BASE64     <paste HMAC key from ~/.fwknoprc>
REQUIRE_SOURCE_ADDRESS  Y
FW_ACCESS_TIMEOUT   30
OPEN_PORTS          tcp/22
```

| Directive | What it does |
|---|---|
| `SOURCE ANY` | accept knocks from any source IP (the packet still has to be valid) |
| `REQUIRE_SOURCE_ADDRESS Y` | the client must embed its real IP — no relaying a captured packet |
| `FW_ACCESS_TIMEOUT` | seconds the hole stays open before it is auto-removed |
| `OPEN_PORTS` | exactly what gets opened on a valid knock (see the use-cases) |

## 4. Pick a capture mode

`fwknopd` needs to *see* the magic packet. Two common ways:

```ini
# /etc/fwknop/fwknopd.conf

# A) libpcap sniffing (default) — set your public interface:
PCAP_INTF           eth0

# B) built-in UDP server — use this when the build has no libpcap
# ENABLE_UDP_SERVER   Y
# UDPSERV_PORT        62201
```

Option **B** is handy on minimal images: the daemon binds a UDP socket instead of
sniffing. The client just sends to that port (the default SPA port is `62201`).

## 5. Set the firewall baseline

fwknop *adds* allow-rules on top of your policy — it does not create the deny. You set
the default-closed posture yourself:

```bash
# allow what already works, then drop the rest on the public interface
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -i eth0 -j DROP
```

fwknopd inserts its ACCEPT rules **above** that final `DROP` when a knock arrives, and
deletes them when the timeout expires.

> **Do not lock yourself out.** Before you apply the `DROP`, make sure you have a rescue
> path that is always allowed — an out-of-band console, or a VPN interface. The
> [all-services gate](/docs/use-cases/all-services-gate) use case shows how to keep
> ZeroTier and WireGuard permanently open for exactly this reason.

## 6. Start it and watch

```bash
sudo systemctl enable --now fwknopd
sudo journalctl -u fwknopd -f
```

Send a knock from your laptop (see [Access a service](/docs/getting-started/access-services)).
You should see fwknopd log a valid SPA packet and add a rule:

```text
SPA Packet from IP: 203.0.113.10 received with access source match
added Rule to FWKNOP_INPUT for 203.0.113.10 -> 0.0.0.0/0 tcp/22, expires ...
```

That's it — the host is live. Everything else is just *which ports* you open, which is
what the [use cases](/docs/use-cases/ssh-blocker) cover.
