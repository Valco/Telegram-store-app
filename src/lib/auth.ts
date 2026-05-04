import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'default_super_secret_for_local_development_only';
const encodedKey = new TextEncoder().encode(JWT_SECRET_KEY);

export interface SessionPayload {
  userId: string;
  email?: string;
  role: string;          // Maps to user.accessGroup.name
  dbRole: string;        // 'STAFF' or 'CUSTOMER'
  permissions: string[]; // ['MANAGE_PRODUCTS', ...]
  [key: string]: any;
}

export async function encryptJWT(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5h')
    .sign(encodedKey);
}

export async function decryptJWT(session: string | undefined = ''): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

