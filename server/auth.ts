import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const SESSION_COOKIE = 'yb_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export function isAuthRequired(): boolean {
  return Boolean(process.env.SITE_PASSWORD);
}

export function cookieSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (isAuthRequired() && !secret) {
    throw new Error('SITE_PASSWORD 已设置，但缺少 SESSION_SECRET（cookie 签名密钥）');
  }
  return secret || randomBytes(32).toString('hex');
}

function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(hash(input), hash(expected));
}

export function isAuthenticated(request: FastifyRequest): boolean {
  if (!isAuthRequired()) return true;
  const raw = request.cookies?.[SESSION_COOKIE];
  if (!raw) return false;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid && unsigned.value === 'ok';
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isAuthenticated(request)) {
    await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: '请先登录' } });
  }
}
