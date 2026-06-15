import { motion } from 'framer-motion';
import { Info, Send, Star, Eraser } from 'lucide-react';
import type { IpMode, KnockOptions, Meta } from '../types';
import { Card, Field, Segmented, Select, Text, Toggle } from './ui';

interface Props {
  options: KnockOptions;
  set: <K extends keyof KnockOptions>(key: K, value: KnockOptions[K]) => void;
  meta: Meta | null;
  busy: boolean;
  onKnock: () => void;
  onSavePreset: () => void;
  onReset: () => void;
  onInfo: () => void;
}

const PROTOS = ['udp', 'tcp', 'http', 'tcpraw', 'icmp'];
const DIGESTS = ['', 'SHA256', 'SHA384', 'SHA512', 'SHA1', 'MD5'];
const ENC_MODES = ['', 'CBC', 'CTR', 'legacy'];

export function KnockForm({ options: o, set, meta, busy, onKnock, onSavePreset, onReset, onInfo }: Props) {
  const stanzaOpts = [
    { value: '', label: '— none (manual) —' },
    ...(meta?.stanzas || []).map((s) => ({ value: s.name, label: s.name })),
  ];
  const ipMode: IpMode = o.ipMode || 'allow';

  return (
    <div className="form-col">
      {/* ---- 01 TARGET ---- */}
      <Card num="01" title="Target" hint="where & what to open">
        <div className="grid cols-2">
          <Field label="Destination" flag="-D" className="span-2" help="fwknop server hostname or IP">
            <Text value={o.destination} onChange={(v) => set('destination', v)} placeholder="spa.example.com" />
          </Field>
          <Field label="Access request" flag="-A" help="ports/protocols to open">
            <Text value={o.access} onChange={(v) => set('access', v)} placeholder="tcp/22" />
          </Field>
          <Field label="Config stanza" flag="-n" help="pull keys/params from ~/.fwknoprc">
            <Select value={o.namedConfig} onChange={(v) => set('namedConfig', v)} options={stanzaOpts} />
          </Field>
        </div>
      </Card>

      {/* ---- 02 SOURCE IP ---- */}
      <Card num="02" title="Source IP" hint="which address gets access">
        <div style={{ paddingTop: 14 }}>
          <Segmented<IpMode>
            value={ipMode}
            onChange={(v) => set('ipMode', v)}
            options={[
              { value: 'allow', label: 'Explicit -a' },
              { value: 'resolve', label: 'Resolve -R' },
              { value: 'source', label: 'Packet src -s' },
            ]}
          />
        </div>
        <div className="grid cols-2">
          {ipMode === 'allow' && (
            <Field label="Allow IP" flag="-a" className="span-2" help="the IP embedded in the SPA packet — this address gets the firewall opening">
              <Text value={o.allowIp} onChange={(v) => set('allowIp', v)} placeholder="203.0.113.10" />
            </Field>
          )}
          {ipMode === 'resolve' && (
            <Field label="Resolve URL" flag="--resolve-url" className="span-2" help="override the default cipherdyne resolver (recommended: your own endpoint)">
              <Text value={o.resolveUrl} onChange={(v) => set('resolveUrl', v)} placeholder="https://example.com/ip (optional)" />
            </Field>
          )}
          {ipMode === 'source' && (
            <div className="field-help span-2" style={{ paddingTop: 14 }}>
              Server uses whatever source IP the packet arrives from. Not recommended — and a server with
              <code> REQUIRE_SOURCE_ADDRESS Y</code> will reject it.
            </div>
          )}
        </div>
      </Card>

      {/* ---- 03 CRYPTO ---- */}
      <Card num="03" title="Crypto" hint="encryption & authentication">
        <div className="toggle-row">
          <Toggle checked={o.useHmac} onChange={(v) => set('useHmac', v)} label="--use-hmac (encrypt-then-auth)" />
        </div>
        <div className="grid cols-2">
          <Field label="Rijndael key (b64)" flag="--key-base64-rijndael" className="span-2" help="leave empty to use the key from the selected stanza">
            <Text secret value={o.keyB64Rijndael} onChange={(v) => set('keyB64Rijndael', v)} placeholder="base64 AES key" />
          </Field>
          <Field label="HMAC key (b64)" flag="--key-base64-hmac" className="span-2">
            <Text secret value={o.keyB64Hmac} onChange={(v) => set('keyB64Hmac', v)} placeholder="base64 HMAC key" />
          </Field>
          <Field label="Digest" flag="-m">
            <Select value={o.digestType} onChange={(v) => set('digestType', v)} options={DIGESTS.map((d) => ({ value: d, label: d || 'default' }))} />
          </Field>
          <Field label="Encryption mode" flag="-M">
            <Select value={o.encryptionMode} onChange={(v) => set('encryptionMode', v)} options={ENC_MODES.map((m) => ({ value: m, label: m || 'default' }))} />
          </Field>
        </div>
      </Card>

      {/* ---- 04 TRANSPORT ---- */}
      <Card num="04" title="Transport" hint="how the SPA packet is sent" defaultOpen={false}>
        <div className="grid cols-3">
          <Field label="SPA port" flag="-p" help="default 62201">
            <Text value={o.serverPort} onChange={(v) => set('serverPort', v)} placeholder="62201" type="number" />
          </Field>
          <Field label="Protocol" flag="-P">
            <Select value={o.serverProto} onChange={(v) => set('serverProto', v)} options={[{ value: '', label: 'default (udp)' }, ...PROTOS.map((p) => ({ value: p, label: p }))]} />
          </Field>
          <Field label="Source port" flag="-S">
            <Text value={o.sourcePort} onChange={(v) => set('sourcePort', v)} placeholder="random" type="number" />
          </Field>
          <Field label="HTTP proxy" flag="-H" className="span-2">
            <Text value={o.httpProxy} onChange={(v) => set('httpProxy', v)} placeholder="host:port" />
          </Field>
          <Field label="User agent" flag="-u">
            <Text value={o.userAgent} onChange={(v) => set('userAgent', v)} placeholder="Fwknop/x" />
          </Field>
        </div>
      </Card>

      {/* ---- 05 ADVANCED ---- */}
      <Card num="05" title="Advanced" hint="NAT, server-cmd, spoofing, raw" defaultOpen={false}>
        <div className="grid cols-2">
          <Field label="FW timeout" flag="-f" help="requested server-side rule lifetime (s)">
            <Text value={o.fwTimeout} onChange={(v) => set('fwTimeout', v)} placeholder="30" type="number" />
          </Field>
          <Field label="NAT access" flag="-N" help="internal host:port">
            <Text value={o.natAccess} onChange={(v) => set('natAccess', v)} placeholder="10.0.0.5:22" />
          </Field>
          <Field label="Server command" flag="-C" className="span-2" help="command the server runs on your behalf">
            <Text value={o.serverCmd} onChange={(v) => set('serverCmd', v)} placeholder="(optional)" />
          </Field>
          <Field label="Spoof source IP" flag="-Q">
            <Text value={o.spoofSource} onChange={(v) => set('spoofSource', v)} placeholder="(optional)" />
          </Field>
          <Field label="Spoof username" flag="-U">
            <Text value={o.spoofUser} onChange={(v) => set('spoofUser', v)} placeholder="(optional)" />
          </Field>
          <Field label="GPG recipient" flag="--gpg-recipient-key">
            <Text value={o.gpgRecipient} onChange={(v) => set('gpgRecipient', v)} placeholder="key id (GPG mode)" />
          </Field>
          <Field label="GPG signer" flag="--gpg-signer-key">
            <Text value={o.gpgSigner} onChange={(v) => set('gpgSigner', v)} placeholder="key id (GPG mode)" />
          </Field>
          <Field label="rc file" flag="--rc-file" className="span-2">
            <Text value={o.rcFile} onChange={(v) => set('rcFile', v)} placeholder="~/.fwknoprc" />
          </Field>
          <Field label="Verbosity" flag="-v">
            <Select
              value={String(o.verbose ?? 0)}
              onChange={(v) => set('verbose', Number(v))}
              options={[
                { value: '0', label: 'normal' },
                { value: '1', label: '-v' },
                { value: '2', label: '-vv' },
                { value: '3', label: '-vvv' },
              ]}
            />
          </Field>
          <Field label="Extra args (raw)" flag="passthrough" className="span-2" help="appended verbatim — quotes respected">
            <Text value={o.extraArgs} onChange={(v) => set('extraArgs', v)} placeholder="--time-offset-plus 1h" />
          </Field>
        </div>
        <div className="toggle-row">
          <Toggle checked={o.test} onChange={(v) => set('test', v)} label="-T dry run (build, don't send)" />
          <Toggle checked={o.noSaveArgs} onChange={(v) => set('noSaveArgs', v)} label="--no-save-args" />
          <Toggle checked={o.natLocal} onChange={(v) => set('natLocal', v)} label="--nat-local" />
          <Toggle checked={o.natRandPort} onChange={(v) => set('natRandPort', v)} label="--nat-rand-port" />
        </div>
      </Card>

      {/* ---- ACTION BAR ---- */}
      <div className="actionbar">
        <button className="btn" type="button" onClick={onReset} title="Reset form">
          <Eraser size={15} />
        </button>
        <button className="btn" type="button" onClick={onSavePreset} title="Save as favorite">
          <Star size={15} />
        </button>
        <button className="btn" type="button" onClick={onInfo} title="What will be sent (spec)">
          <Info size={15} />
        </button>
        <motion.button
          className={`btn-knock ${busy ? 'busy' : ''}`}
          type="button"
          disabled={busy}
          onClick={onKnock}
          whileTap={{ scale: 0.985 }}
        >
          {busy ? (
            <span className="knock-spinner">
              <i />
            </span>
          ) : (
            <>
              <Send size={15} /> {o.test ? 'Build packet' : 'Send knock'}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
