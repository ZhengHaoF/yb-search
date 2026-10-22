import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/errors';
import { normalizeVersion, parseSearchResponse } from '../server/wsa/parse-response';

const page = {
  title: '【新思想引领新征程】人工智能创新加速我国产业转型升级',
  url: 'https://www.cac.gov.cn/2025-02/26/c_1742272852299173.htm',
  date: '2025/02/26 09:37:00',
  passage: '标准摘要',
  content: '动态摘要',
  site: '中国网信网',
  score: 0.84889734,
  authority_level: 4,
  favicon: 'https://cdn-yb.icon.qq.com/zuowei_dir/www_cac_gov_cn.ico',
  pics: [
    { caption: '配图说明', origin_url: 'https://www.cac.gov.cn/a.jpg' },
    { caption: '非法协议', origin_url: 'javascript:alert(1)' },
  ],
  deeplinks: [
    { title: '子页一', url: 'https://www.cac.gov.cn/sub-1.htm' },
    { title: '非法链接', url: 'ftp://example.com/file' },
  ],
};

function raw(overrides: Record<string, unknown> = {}) {
  return {
    Query: '人工智能发展现状',
    Version: 'flagship',
    RequestId: 'req-1',
    Pages: [JSON.stringify(page)],
    ...overrides,
  };
}

describe('parseSearchResponse', () => {
  it('parses the documented page structure', () => {
    const result = parseSearchResponse(raw(), { query: 'fallback', elapsedMs: 42 });
    expect(result.query).toBe('人工智能发展现状');
    expect(result.version).toBe('flagship');
    expect(result.requestId).toBe('req-1');
    expect(result.count).toBe(1);
    expect(result.elapsedMs).toBe(42);
    expect(result.results[0]).toMatchObject({
      title: page.title,
      url: page.url,
      date: page.date,
      passage: '标准摘要',
      content: '动态摘要',
      site: '中国网信网',
      score: page.score,
      authorityLevel: 4,
      favicon: page.favicon,
    });
    expect(result.results[0].pics).toEqual([
      { caption: '配图说明', originUrl: 'https://www.cac.gov.cn/a.jpg' },
    ]);
    expect(result.results[0].deeplinks).toEqual([
      { title: '子页一', url: 'https://www.cac.gov.cn/sub-1.htm' },
    ]);
  });

  it('skips malformed items but keeps valid ones', () => {
    const result = parseSearchResponse(
      raw({ Pages: ['not-json', JSON.stringify({ title: 'x', url: 'mailto:a@b.com' }), JSON.stringify(page)] }),
      { query: 'q', elapsedMs: 1 },
    );
    expect(result.count).toBe(1);
  });

  it('throws when every page is unusable', () => {
    expect(() =>
      parseSearchResponse(raw({ Pages: ['not-json', JSON.stringify({ title: 'no url' })] }), {
        query: 'q',
        elapsedMs: 1,
      }),
    ).toThrowError(ApiError);
  });

  it('throws when Pages has an unexpected shape', () => {
    expect(() => parseSearchResponse(raw({ Pages: { bad: true } }), { query: 'q', elapsedMs: 1 })).toThrowError(
      '搜索接口返回的结果格式不正确',
    );
  });

  it('returns an empty result set for empty Pages', () => {
    const result = parseSearchResponse(raw({ Pages: [] }), { query: 'q', elapsedMs: 3 });
    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('passes through upstream msg and falls back to request query', () => {
    const result = parseSearchResponse(raw({ Query: undefined, Msg: 'hit black query' }), {
      query: '原始搜索词',
      elapsedMs: 5,
    });
    expect(result.query).toBe('原始搜索词');
    expect(result.msg).toBe('hit black query');
  });

  it('normalizes unknown versions', () => {
    expect(normalizeVersion('flagship')).toBe('flagship');
    expect(normalizeVersion('enterprise')).toBe('unknown');
    expect(normalizeVersion(undefined)).toBe('unknown');
  });

  it('accepts an object page for forward compatibility', () => {
    const result = parseSearchResponse(raw({ Pages: [page] }), { query: 'q', elapsedMs: 1 });
    expect(result.count).toBe(1);
    expect(result.results[0].title).toBe(page.title);
  });
});
