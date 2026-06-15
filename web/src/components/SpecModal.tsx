import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { KnockOptions, Meta } from '../types';

function hint(meta: Meta | null, stanza: string | undefined, key: string): string | undefined {
  if (!stanza) return undefined;
  return meta?.stanzas.find((s) => s.name === stanza)?.hints[key];
}

/* Derive a precise, wire-level spec from the current options. */
function buildSpec(o: KnockOptions, meta: Meta | null) {
  const stanza = o.namedConfig;
  const h = (k: string) => hint(meta, stanza, k);

  const proto = (o.serverProto || 'udp').toLowerCase();
  const dest = o.destination || h('SPA_SERVER') || '—';
  const port = o.serverPort || '62201';
  const access = o.access || h('ACCESS') || '—';

  const mode = o.ipMode || 'allow';
  let allowVal = '—';
  let allowNote = '';
  if (mode === 'allow') {
    allowVal = o.allowIp || h('ALLOW_IP') || '— (required)';
    allowNote = 'embedded in payload (-a)';
  } else if (mode === 'resolve') {
    allowVal = 'resolved at send-time';
    allowNote = `HTTPS GET ${o.resolveUrl || 'https://www.cipherdyne.org/cgi-bin/myip'} (-R)`;
  } else {
    allowVal = 'packet source IP';
    allowNote = 'server-side (-s) · rejected if REQUIRE_SOURCE_ADDRESS=Y';
  }

  const gpg = !!(o.gpgRecipient || o.gpgSigner);
  const enc = gpg ? 'GPG (asymmetric)' : `Rijndael/AES · ${o.encryptionMode || 'CBC'}`;
  const encKey = o.keyB64Rijndael
    ? 'inline base64'
    : gpg
      ? `recipient ${o.gpgRecipient || '—'}`
      : stanza
        ? `stanza [${stanza}]`
        : 'prompted at runtime';

  const hmacKey = o.keyB64Hmac ? 'inline base64' : stanza ? `stanza [${stanza}]` : 'prompted at runtime';

  const isCmd = !!o.serverCmd;
  const isNat = !!(o.natAccess || o.natLocal);
  const reqTimeout = o.fwTimeout ? `${o.fwTimeout}s (-f, requested)` : 'server default (FW_ACCESS_TIMEOUT)';

  return {
    dryRun: !!o.test,
    transport: { proto, target: `${dest}:${port}`, datagram: proto === 'udp' ? '1 UDP datagram' : `${proto} transport` },
    payload: [
      ['msg type', isCmd ? 'Command msg' : isNat ? 'NAT access' : 'Access msg'],
      ['access', access],
      ['allow IP', allowVal, allowNote],
      ...(isNat ? [['nat fwd', o.natAccess || 'local', '-N']] as string[][] : []),
      ...(isCmd ? [['server cmd', o.serverCmd!, '-C · needs ENABLE_CMD_EXEC']] as string[][] : []),
      ['username', o.spoofUser ? `${o.spoofUser} (spoofed -U)` : '$USER'],
      ['timestamp', `now · valid ±MAX_SPA_PACKET_AGE`],
      ['nonce', '16-byte random (anti-replay)'],
      ['client to', reqTimeout],
    ] as string[][],
    enc: { algo: enc, key: encKey, digest: o.digestType || 'SHA256' },
    hmac: o.useHmac
      ? { on: true, algo: o.hmacDigestType || 'SHA256', key: hmacKey }
      : { on: false },
    serverSteps: (
      o.useHmac ? ['verify HMAC over ciphertext (pre-decrypt)'] : ['⚠ no HMAC — decrypt without auth (padding-oracle risk)']
    ).concat(
      gpg ? 'decrypt + verify GPG signature' : 'decrypt AES-CBC',
      'reject if SHA-256 digest in replay cache',
      'check timestamp within MAX_SPA_PACKET_AGE',
      `match access.conf by SOURCE → enforce OPEN_PORTS`,
      isCmd
        ? 'execute server command (no firewall change)'
        : isNat
          ? `insert DNAT/forward → ${o.natAccess || 'internal'} (${reqTimeout})`
          : `insert ACCEPT ${mode === 'allow' ? allowVal : '<src>'} → ${access} for ${reqTimeout}`,
      'auto-remove rule on expiry (conntrack keeps live sessions)',
    ),
  };
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="spec-row">
      <span className="spec-k">{k}</span>
      <span className="spec-v">
        {v}
        {note && <span className="spec-note"> · {note}</span>}
      </span>
    </div>
  );
}

export function SpecModal({ options, meta, onClose }: { options: KnockOptions; meta: Meta | null; onClose: () => void }) {
  const s = buildSpec(options, meta);
  return (
    <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal spec-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.96, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <div className="modal-head spec-head">
          <span>SPA transmission spec</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body spec-body">
          {s.dryRun && <div className="spec-banner">DRY RUN (-T) · packet is built but NOT transmitted</div>}

          <div className="spec-group">
            <div className="spec-h">Transport</div>
            <Row k="protocol" v={s.transport.proto} note={s.transport.datagram} />
            <Row k="target" v={s.transport.target} />
          </div>

          <div className="spec-group">
            <div className="spec-h">Payload · FKO message</div>
            {s.payload.map(([k, v, note], i) => (
              <Row key={i} k={k} v={v} note={note} />
            ))}
          </div>

          <div className="spec-group">
            <div className="spec-h">Encryption</div>
            <Row k="cipher" v={s.enc.algo} />
            <Row k="key" v={s.enc.key} />
            <Row k="digest" v={s.enc.digest} />
          </div>

          <div className="spec-group">
            <div className="spec-h">Authentication</div>
            {s.hmac.on ? (
              <>
                <Row k="hmac" v={`${s.hmac.algo} · encrypt-then-auth`} />
                <Row k="key" v={s.hmac.key} />
              </>
            ) : (
              <div className="spec-row">
                <span className="spec-k">hmac</span>
                <span className="spec-v spec-warn">disabled — enable --use-hmac</span>
              </div>
            )}
          </div>

          <div className="spec-group">
            <div className="spec-h">Server · fwknopd</div>
            <ol className="spec-steps">
              {s.serverSteps.map((step, i) => (
                <li key={i} className={step.startsWith('⚠') ? 'spec-warn' : undefined}>
                  {step.replace(/^⚠ /, '')}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
