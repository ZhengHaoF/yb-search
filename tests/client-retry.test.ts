import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRequestBody } from '../shared/types';

const mockState = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  attempt: 0,
}));

vi.mock('tencentcloud-sdk-nodejs-wsa', () => {
  class Client {
    async SearchPro(params: Record<string, unknown>) {
      mockState.calls.push(params);
      mockState.attempt += 1;
      if (mockState.attempt === 1) {
        const error = new Error('极速版不支持该参数') as Error & { code?: string; requestId?: string };
        error.code = 'InvalidParameter';
        error.requestId = 'req-first';
        throw error;
      }
      return {
        Query: params.Query,
        Version: 'lite',
        Pages: [],
        RequestId: `req-${mockState.attempt}`,
        Msg: '',
      };
    }
  }
  return { wsa: { v20250508: { Client } } };
});

import { runSearch } from '../server/wsa/client';

describe('runSearch capability fallback', () => {
  beforeEach(() => {
    mockState.calls.length = 0;
    mockState.attempt = 0;
    process.env.TENCENTCLOUD_SECRET_ID = 'test-id';
    process.env.TENCENTCLOUD_SECRET_KEY = 'test-key';
  });

  it('retries without unsupported parameters and caches the detected version', async () => {
    const body: SearchRequestBody = {
      query: '人工智能',
      mode: 0,
      cnt: 30,
      industry: 'news',
      site: 'zhihu.com',
      freshness: 'd7',
      deeplinks: true,
    };

    const first = await runSearch(body);

    expect(mockState.calls).toHaveLength(2);
    expect(mockState.calls[0]).toMatchObject({
      Query: '人工智能',
      Mode: 0,
      Cnt: 30,
      Industry: 'news',
      Site: 'zhihu.com',
      Freshness: 'd7',
      Deeplinks: true,
    });
    expect(mockState.calls[1]).toEqual({
      Query: '人工智能',
      Site: 'zhihu.com',
      Freshness: 'd7',
    });
    expect(first.version).toBe('lite');
    expect(first.msg).toContain('自动调整筛选条件');

    await runSearch(body);

    expect(mockState.calls[2]).toEqual({
      Query: '人工智能',
      Site: 'zhihu.com',
      Freshness: 'd7',
    });
  });
});
