import type { FastifyInstance } from 'fastify';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  isAuthRequired,
  isAuthenticated,
  passwordMatches,
} from '../auth';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/session', async (request) => ({
    authRequired: isAuthRequired(),
    authenticated: isAuthenticated(request),
  }));

  app.post('/api/login', async (request, reply) => {
    if (!isAuthRequired()) {
      return reply.code(204).send();
    }
    const body = request.body as { password?: unknown } | undefined;
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return reply.code(400).send({ error: { code: 'INVALID_PASSWORD', message: '请输入访问口令' } });
    }
    if (!passwordMatches(password)) {
      return reply.code(401).send({ error: { code: 'INVALID_PASSWORD', message: '访问口令不正确' } });
    }
    reply.setCookie(SESSION_COOKIE, 'ok', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: SESSION_MAX_AGE,
      signed: true,
    });
    return reply.code(204).send();
  });

  app.post('/api/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
