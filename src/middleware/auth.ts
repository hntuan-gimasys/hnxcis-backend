/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.ts';
import { getAdminAuth } from '../lib/firebase-admin.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/**
 * Verifies the Firebase ID token when present and attaches req.user.
 * Never rejects: use it to enrich logs / audit trails on public endpoints.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
  } catch (error) {
    console.warn('[auth] Invalid Firebase ID token:', (error as Error).message);
  }
  next();
}

/**
 * Enforces authentication. Wired only when AUTH_REQUIRED=true so the API stays
 * usable while the frontend login flow is still being built.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!env.firebase.authRequired) return next();
  if (req.user) return next();
  res.status(401).json({ error: 'Yêu cầu xác thực. Thiếu hoặc sai Firebase ID token.' });
}
