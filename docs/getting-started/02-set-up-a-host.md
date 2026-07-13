---
title: Set up a host
group: Getting started
order: 2
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

The **server** package ships `fwknopd`. (The **client** package — `fwknop-client`, what
this console drives — goes on your laptop, not here.)

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

Every knock is encrypted **and** authenticated with a pair of keys — a **Rijndael (AES)**
key for encryption and an **HMAC** key for authentication. The *same pair* lives on both
ends: the client half in `~/.fwknoprc`, the server half in `access.conf`.

Generate the pair once, on the client (your laptop), and let fwknop write it straight into
a named stanza:

```bash
fwknop --key-gen --use-hmac -n example-host \
  --save-rc-stanza --force-stanza
```

What each flag does:

| Flag | What it does |
|---|---|
| `-k, --key-gen` | generate a fresh Rijndael key **and** an HMAC key |
| `--use-hmac` | record `USE_HMAC Y` in the stanza, so every knock is HMAC-authenticated |
| `-n, --named-config <name>` | the stanza name to write under in `~/.fwknoprc` |
| `--save-rc-stanza` | save these settings — keys included — into that stanza |
| `--force-stanza` | overwrite the stanza if it already exists (omit to protect an existing one) |

The keys are also printed to your terminal, and written to `~/.fwknoprc`. Lock that file
down — it now holds live secrets:

```bash
chmod 600 ~/.fwknoprc
```

> **Why HMAC?** It authenticates the packet *before* it is decrypted, so the daemon can
> drop forged traffic without spending a crypto operation. Always use `--use-hmac`.

> **Handle the keys carefully.** You are about to copy the two keys onto the server (step 3).
> Copy them over an already-trusted channel (an existing SSH session, a password manager) —
> never paste them into chat, tickets, or logs. Anyone with both keys can knock.

The stanza still needs a destination (`SPA_SERVER`) and a default service (`ACCESS`) before
it can knock — [Access a service](/docs/getting-started/access-services) fills those in.

## 3. Tell the daemon who may knock

Edit `/etc/fwknop/access.conf` on the server. Paste the **same two keys** you just
generated (the `KEY_BASE64` / `HMAC_KEY_BASE64` values — read them from the `--key-gen`
output or from the client's `~/.fwknoprc` stanza):

```ini
SOURCE                  ANY
KEY_BASE64              <paste Rijndael key from ~/.fwknoprc>
HMAC_KEY_BASE64         <paste HMAC key from ~/.fwknoprc>
REQUIRE_SOURCE_ADDRESS  Y
FW_ACCESS_TIMEOUT       30
OPEN_PORTS              tcp/22
```

| Directive | What it does |
|---|---|
| `SOURCE ANY` | accept knocks from any source IP (the packet still has to be valid) |
| `KEY_BASE64` / `HMAC_KEY_BASE64` | the shared keys — must match the client stanza exactly, or the packet is silently ignored |
| `REQUIRE_SOURCE_ADDRESS Y` | the client must embed its real IP — no replaying a captured packet |
| `FW_ACCESS_TIMEOUT` | seconds the hole stays open before it is auto-removed |
| `OPEN_PORTS` | exactly what gets opened on a valid knock (see the use-cases) |

## 4. Pick a capture mode

`fwknopd` needs to *see* the magic packet. There are two common ways, and they behave
differently with your firewall — which matters in step 5:

```ini
# /etc/fwknop/fwknopd.conf

# A) libpcap sniffing (default) — set your public interface:
PCAP_INTF           eth0

# B) built-in UDP server — use this when the build has no libpcap
# ENABLE_UDP_SERVER   Y
# UDPSERV_PORT        62201
```

| Setting | What it does |
|---|---|
| `PCAP_INTF` | the interface fwknopd sniffs — set it to the one the SPA packet lands on (your public NIC) |
| `ENABLE_UDP_SERVER` | bind a real UDP socket instead of sniffing (mode **B**) |
| `UDPSERV_PORT` | the port that socket listens on — the client's default SPA port is `62201` |

**A (sniffing)** taps the interface *below* netfilter, so it sees the packet **even though
your firewall drops it** — you never open the SPA port. **B (UDP server)** binds a genuine
socket, so the firewall must let `udp/62201` through (see the note in step 5). Option **B**
is handy on minimal images where libpcap isn't available.

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

> **UDP-server mode only:** if you chose capture mode **B**, add
> `sudo iptables -I INPUT -i eth0 -p udp --dport 62201 -j ACCEPT` *above* the `DROP` so the
> knock can reach the socket. In sniffing mode (**A**) you do **not** open this port —
> that's the whole point, and it still works.

> **Do not lock yourself out.** Before you apply the `DROP`, make sure you have a rescue
> path that is always allowed — an out-of-band console, or a VPN interface. The
> [all-services gate](/docs/use-cases/all-services-gate) use case shows how to keep
> ZeroTier and WireGuard permanently open for exactly this reason.

## 6. Start it and watch

```bash
sudo systemctl enable --now fwknopd
sudo systemctl status fwknopd          # confirm it's running, not crash-looping
sudo journalctl -u fwknopd -f
```

Now send a knock from your laptop (see [Access a service](/docs/getting-started/access-services)).
You should see fwknopd log a valid SPA packet and add a rule:

```text
SPA Packet from IP: 203.0.113.10 received with access source match
added Rule to FWKNOP_INPUT for 203.0.113.10 -> 0.0.0.0/0 tcp/22, expires ...
```

That's it — the host is live. Everything else is just *which ports* you open, which is
what the [use cases](/docs/use-cases/ssh-blocker) cover.

## Troubleshooting a knock that does nothing

If the port stays closed and `journalctl` shows nothing when you knock, work down this list:

- **No log line at all.** The packet isn't reaching the daemon. In sniffing mode, check
  `PCAP_INTF` is the interface the packet actually lands on. In UDP-server mode, confirm
  the firewall allows `udp/62201` (step 5).
- **"source match" logged but no rule added.** The firewall backend isn't wired up —
  make sure `iptables` is installed and `FIREWALL_EXE` in `fwknopd.conf` points at it.
- **Nothing logged, but the packet is arriving.** The keys don't match. A wrong
  `KEY_BASE64` or `HMAC_KEY_BASE64` makes the daemon drop the packet *silently* — re-paste
  both from the client stanza.
- **Behind NAT with `REQUIRE_SOURCE_ADDRESS Y`.** The IP the client embeds must equal the
  public IP the daemon sees. From behind a NAT, have the client resolve its external
  address first: `fwknop -n example-host -R` (`--resolve-ip-https`).
