import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth';
import { validateSearchRequest } from '../wsa/map-request';
import { runSearch } from '../wsa/client';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/search', { preHandler: requireAuth }, async (request) => {
    const body = validateSearchRequest(request.body);
    if (process.env.LOG_QUERY === '1') {
      request.log.info({ query: body.query }, 'search query');
    }
    return runSearch(body);
  });
}
