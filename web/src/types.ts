export type IpMode = 'allow' | 'resolve' | 'source';

export interface KnockOptions {
  // Target
  namedConfig?: string;
  access?: string;
  destination?: string;
  // Source IP
  ipMode?: IpMode;
  allowIp?: string;
  resolveUrl?: string;
  // Transport
  serverPort?: string;
  serverProto?: string;
  sourcePort?: string;
  httpProxy?: string;
  userAgent?: string;
  // Crypto
  useHmac?: boolean;
  keyB64Rijndael?: string;
  keyB64Hmac?: string;
  keyRijndael?: string;
  digestType?: string;
  encryptionMode?: string;
  hmacDigestType?: string;
  gpgRecipient?: string;
  gpgSigner?: string;
  // Access extras
  fwTimeout?: string;
  natAccess?: string;
  natPort?: string;
  natLocal?: boolean;
  natRandPort?: boolean;
  serverCmd?: string;
  spoofSource?: string;
  spoofUser?: string;
  rcFile?: string;
  // Behaviour
  test?: boolean;
  noSaveArgs?: boolean;
  verbose?: number;
  extraArgs?: string;
}

export interface Preset {
  id: string;
  name: string;
  options: KnockOptions;
  createdAt: number;
  updatedAt: number;
  seeded?: boolean;
}

export interface KnockResult {
  ok: boolean;
  exitCode: number;
  spawnError: string | null;
  command: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface HistoryEntry {
  id: string;
  at: number;
  name: string | null;
  options: KnockOptions; // redacted
  optionsFull: KnockOptions; // for relaunch
  ok: boolean;
  exitCode: number;
  command: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface Stanza {
  name: string;
  hints: Record<string, string>;
}

export interface Meta {
  version: string | null;
  bin: string;
  stanzas: Stanza[];
}

export interface User {
  sub: string;
  name?: string;
  email?: string;
}

// Result of GET /api/auth/me. `disabled` = OIDC turned off (open mode).
export interface AuthState {
  disabled?: boolean;
  authenticated?: boolean;
  user?: User;
  scopes?: string[];
}
