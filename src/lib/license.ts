/**
 * License verification module (Phase 1)
 * Reads LICENSE_KEY from .env, verifies RSA signature with embedded public key.
 * 
 * To activate: paste your public.pem content into PUBLIC_KEY below (from license-server/keys/public.pem).
 * Run: node license-server/scripts/generateKeys.js  to generate the key pair.
 */

import { jwtVerify, importSPKI } from 'jose';

// ─── Paste your RSA public key here after running generateKeys.js ─────────────
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_YOUR_PUBLIC_KEY_FROM_license-server/keys/public.pem
-----END PUBLIC KEY-----`;

export type LicensePlan = 'pro' | 'starter' | 'free';
export type LicenseFeature = 'SMM' | 'AI' | 'ROULETTE' | 'UNLIMITED_PRODUCTS' | 'EMAIL';

export interface LicenseInfo {
  valid: boolean;
  plan: LicensePlan;
  features: LicenseFeature[];
  domain: string | null;
  expiresAt: Date | null;
  daysLeft: number;
  reason?: string;
}

let _cached: LicenseInfo | null = null;
let _cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min in-memory cache

export async function getLicenseInfo(): Promise<LicenseInfo> {
  const now = Date.now();
  if (_cached && now - _cachedAt < CACHE_TTL) return _cached;

  const key = process.env.LICENSE_KEY;

  // No key — FREE mode
  if (!key || key.length < 20 || PUBLIC_KEY_PEM.includes('REPLACE_WITH')) {
    return _setCached({ valid: false, plan: 'free', features: [], domain: null, expiresAt: null, daysLeft: 0, reason: 'no_key' });
  }

  try {
    const publicKey = await importSPKI(PUBLIC_KEY_PEM, 'RS256');
    const { payload } = await jwtVerify(key, publicKey);

    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / 86400000)) : 0;

    if (expiresAt && expiresAt < new Date()) {
      return _setCached({ valid: false, plan: 'free', features: [], domain: null, expiresAt, daysLeft: 0, reason: 'expired' });
    }

    // Optional: verify domain matches
    const expectedDomain = (payload as any).domain as string;
    const actualDomain = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '').split('/')[0] || '';
    if (expectedDomain && actualDomain && expectedDomain !== actualDomain) {
      return _setCached({ valid: false, plan: 'free', features: [], domain: expectedDomain, expiresAt, daysLeft, reason: 'domain_mismatch' });
    }

    // Phase 4: Remote Verification (Optional)
    const remoteServerUrl = process.env.LICENSE_SERVER_URL;
    let isRevokedRemotely = false;

    if (remoteServerUrl && expectedDomain) {
      try {
        const verifyUrl = `${remoteServerUrl}/api/verify?key=${encodeURIComponent(key)}&domain=${encodeURIComponent(actualDomain || expectedDomain)}`;
        const remoteRes = await fetch(verifyUrl, { timeout: 3000 } as RequestInit);
        if (remoteRes.ok) {
          const remoteData = await remoteRes.json();
          if (remoteData.valid === false && remoteData.reason === 'revoked') {
            isRevokedRemotely = true;
          }
        }
      } catch (err) {
        // Ignore network errors, fallback to RSA local verification
        console.warn('License Server unreachable, relying on local RSA check.');
      }
    }

    if (isRevokedRemotely) {
      return _setCached({ valid: false, plan: 'free', features: [], domain: expectedDomain, expiresAt, daysLeft: 0, reason: 'revoked' });
    }

    return _setCached({
      valid: true,
      plan: ((payload as any).plan || 'pro') as LicensePlan,
      features: ((payload as any).features || []) as LicenseFeature[],
      domain: expectedDomain,
      expiresAt,
      daysLeft,
    });
  } catch (e: any) {
    return _setCached({ valid: false, plan: 'free', features: [], domain: null, expiresAt: null, daysLeft: 0, reason: 'invalid_key' });
  }
}

function _setCached(info: LicenseInfo): LicenseInfo {
  _cached = info;
  _cachedAt = Date.now();
  return info;
}

/** Quick check — use in API routes and Server Actions */
export async function canUseFeature(feature: LicenseFeature): Promise<boolean> {
  const info = await getLicenseInfo();
  return info.valid && info.features.includes(feature);
}

/** Throws 403-ready error if feature not licensed */
export async function requireFeature(feature: LicenseFeature): Promise<void> {
  const ok = await canUseFeature(feature);
  if (!ok) throw new Error(`PRO_REQUIRED:${feature}`);
}
