import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { cookieSecret, isAuthRequired } from './auth';
import { ApiError } from './errors';
import { authRoutes } from './routes/auth';
import { searchRoutes } from './routes/search';

if (existsSync(resolve('.env'))) {
  process.loadEnvFile();
}

if (isAuthRequired() && !process.env.SESSION_SECRET) {
  console.error('启动失败：SITE_PASSWORD 已设置，但缺少 SESSION_SECRET（cookie 签名密钥）。');
  process.exit(1);
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cookie, { secret: cookieSecret() });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ApiError) {
    request.log.warn({ code: error.code, requestId: error.requestId }, error.message);
    return reply.code(error.status).send({
      error: { code: error.code, message: error.message, requestId: error.requestId },
    });
  }
  request.log.error(error);
  return reply.code(500).send({
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
  });
});

app.get('/api/health', async () => ({ ok: true }));
await app.register(authRoutes);
await app.register(searchRoutes);

const distDir = resolve('dist');
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
    }
    return reply
      .type('text/plain; charset=utf-8')
      .send('前端尚未构建：开发请运行 npm run dev 并访问 http://localhost:5180；生产请先执行 npm run build。');
  });
}

const port = Number(process.env.PORT || 3100);
const host = process.env.HOST || '127.0.0.1';

try {
  await app.listen({ port, host });
  app.log.info(`YB Search server listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
