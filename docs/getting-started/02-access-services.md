---
title: Access a service
group: Getting started
order: 2
summary: Send a magic packet — from this console or the CLI — and connect during the open window.
---

# Access a service

Once a host runs `fwknopd`, reaching a service is two steps: **knock**, then **connect**
within the timeout window. This console handles the knock; your normal client (ssh, curl,
a browser) handles the connect.

## The client stanza

The client keeps its keys in `~/.fwknoprc`, grouped into named **stanzas**. Each stanza
is one target host. You made one in [Set up a host](/docs/getting-started/set-up-a-host):

```ini
# ~/.fwknoprc
[example-host]
ACCESS                 tcp/22
SPA_SERVER             spa.example.com
KEY_BASE64             <Rijndael key>
HMAC_KEY_BASE64        <HMAC key>
USE_HMAC               Y
```

> **Keys stay in the rc file — by design.** fwknop-ui reads only the *names* of your
> stanzas and a few non-secret hints. When you knock, it passes `-n <stanza>` so the keys
> never leave `~/.fwknoprc` and never enter the app's storage.

## Knock from this console

1. Open the **Knock** view.
2. Pick your stanza under *Named config* (or fill the target fields manually).
3. Set **Access** to the service you want, e.g. `tcp/22`.
4. Hit **Send knock**. The console builds the exact `fwknop` command, runs the real
   binary, and streams the result.

The command it runs is always visible in the output panel — nothing hidden:

```bash
fwknop -n example-host -A tcp/22
```

Then connect as usual, before the window closes:

```bash
ssh user@spa.example.com
```

## Knock from the CLI

The console is a convenience, not a lock-in. The same knock from a terminal:

```bash
# using a saved stanza (keys from ~/.fwknoprc)
fwknop -n example-host

# or fully specified, one-off
fwknop -A tcp/22 -a 203.0.113.10 -D spa.example.com \
  --key-base64-rijndael <KEY> --key-base64-hmac <HMAC>
```

## Test without opening anything

To verify a packet is well-formed **without** sending it, use test mode. The console has a
*Test* toggle; on the CLI it is `--test`:

```bash
fwknop -n example-host --test
```

This builds and prints the SPA payload but does not transmit — useful when you are editing
a stanza and want to confirm it before it hits the wire.

## What "open" means

A successful knock opens the port(s) **only for your current source IP**, and **only for
the timeout window** (`FW_ACCESS_TIMEOUT` on the server, 30s by default). Existing
connections are kept alive by the firewall's connection tracking, so a long-lived SSH or
VPN session survives long after the window closes — you just can't start a *new* one
without knocking again.

Next: the two canonical setups —
[hide SSH](/docs/use-cases/ssh-blocker) or
[gate every service at once](/docs/use-cases/all-services-gate).
