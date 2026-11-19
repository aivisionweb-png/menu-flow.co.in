import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : 'menuflow-dev-secret-key-do-not-use-in-prod-928374';

const COOKIE_NAME = 'mf_session';

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  restaurantId: string | null;
  role: string | null;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

interface TokenPayload {
  userId: string;
  exp: number;
}

export function signSessionToken(userId: string): string {
  const payload: TokenPayload = {
    userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.userId || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function parseCookies(header?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    result[k] = v;
  }
  return result;
}

export function resolveAuthFromRequest(req: Request): AuthContext | null {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = bearer || cookies[COOKIE_NAME];
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = db
    .prepare(`SELECT id, email, full_name FROM users WHERE id = ?`)
    .get(payload.userId) as { id: string; email: string; full_name: string } | undefined;
  if (!user) return null;

  const member = db
    .prepare(`
      SELECT rm.restaurant_id, rm.role
      FROM restaurant_members rm
      WHERE rm.user_id = ? AND rm.is_active = 1
      ORDER BY rm.created_at ASC
      LIMIT 1
    `)
    .get(user.id) as { restaurant_id: string; role: string } | undefined;

  return {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    restaurantId: member?.restaurant_id ?? null,
    role: member?.role ?? null,
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const ctx = resolveAuthFromRequest(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.auth = ctx;
  next();
}

export function requireRestaurantAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const ctx = resolveAuthFromRequest(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!ctx.restaurantId) {
    res.status(403).json({ error: 'No active restaurant membership found. Complete onboarding first.' });
    return;
  }
  req.auth = ctx;
  next();
}
