import { describe, expect, it } from 'vitest';
import { buildUpstreamRequest, validateSearchRequest } from '../server/wsa/map-request';
import { todayLocal } from '../shared/search-options';

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('validateSearchRequest', () => {
  it('applies defaults through buildUpstreamRequest', () => {
    const body = validateSearchRequest({ query: '  人工智能  ' });
    expect(body.query).toBe('人工智能');
    const { params, notices } = buildUpstreamRequest(body, 'flagship');
    expect(params).toEqual({
      Query: '人工智能',
      Mode: 2,
      Cnt: 20,
      Deeplinks: true,
    });
    expect(notices).toEqual([]);
  });

  it('maps every supported parameter for flagship', () => {
    const body = validateSearchRequest({
      query: '人工智能',
      mode: 1,
      cnt: 50,
      industry: 'news',
      site: 'Exclude:qq.com|SOHU.com|qq.com',
      freshness: 'm3',
      deeplinks: false,
    });
    expect(body.site).toBe('exclude:qq.com|sohu.com');
    const { params } = buildUpstreamRequest(body, 'flagship');
    expect(params).toEqual({
      Query: '人工智能',
      Site: 'exclude:qq.com|sohu.com',
      Freshness: 'm3',
      Mode: 1,
      Cnt: 50,
      Industry: 'news',
      Deeplinks: false,
    });
  });

  it('accepts include site and normalizes relative freshness', () => {
    const body = validateSearchRequest({
      query: 'vue',
      site: 'ZHIHU.com',
      freshness: 'd',
    });
    expect(body.site).toBe('zhihu.com');
    expect(body.freshness).toBe('d1');
    const { params } = buildUpstreamRequest(body, 'flagship');
    expect(params.Site).toBe('zhihu.com');
    expect(params.Freshness).toBe('d1');
  });

  it('supports single-day and date-range freshness', () => {
    const day = validateSearchRequest({ query: 'x', freshness: localDate(0) });
    expect(day.freshness).toBe(localDate(0));

    const range = `${localDate(-3)},${localDate(0)}`;
    const ranged = validateSearchRequest({ query: 'x', freshness: range });
    expect(ranged.freshness).toBe(range);
  });

  it('strips unsupported parameters for lite and notes the changes', () => {
    const body = validateSearchRequest({ query: 'x', mode: 1, cnt: 30, industry: 'acad', deeplinks: true });
    const { params, notices } = buildUpstreamRequest(body, 'lite');
    expect(params).toEqual({ Query: 'x' });
    expect(notices).toHaveLength(3);
  });

  it('keeps site and freshness on lite', () => {
    const body = validateSearchRequest({ query: 'x', site: 'zhihu.com', freshness: 'd7', mode: 0, cnt: 50 });
    const { params } = buildUpstreamRequest(body, 'lite');
    expect(params).toEqual({ Query: 'x', Site: 'zhihu.com', Freshness: 'd7' });
  });

  it('omits deeplinks for standard edition', () => {
    const body = validateSearchRequest({ query: 'x' });
    const { params } = buildUpstreamRequest(body, 'standard');
    expect(params.Deeplinks).toBeUndefined();
    expect(params.Mode).toBe(2);
    expect(params.Cnt).toBe(20);
  });

  it.each([
    [{ query: '' }, '搜索词不能为空'],
    [{ query: 'x'.repeat(201) }, '搜索词不能超过 200 个字符'],
    [{ query: 'x', mode: 3 }, '结果类型取值不合法'],
    [{ query: 'x', cnt: 15 }, '返回条数取值不合法'],
    [{ query: 'x', industry: 'tech' }, '垂直领域取值不合法'],
    [{ query: 'x', site: 'https://zhihu.com' }, '站点筛选格式不正确'],
    [{ query: 'x', site: 'a.com|b.com' }, '站点筛选格式不正确'],
    [{ query: 'x', site: 'exclude:a.com|b.com|c.com|d.com|e.com|f.com' }, '站点筛选格式不正确'],
    [{ query: 'x', site: 'exclude:' }, '站点筛选格式不正确'],
    [{ query: 'x', freshness: 'd31' }, '时效格式不正确'],
    [{ query: 'x', freshness: 'm13' }, '时效格式不正确'],
    [{ query: 'x', freshness: 'y6' }, '时效格式不正确'],
    [{ query: 'x', freshness: `${localDate(0)},${localDate(-1)}` }, '时效格式不正确'],
    [{ query: 'x', freshness: localDate(1) }, '时效格式不正确'],
    [{ query: 'x', freshness: '2026-02-30' }, '时效格式不正确'],
    [{ query: 'x', deeplinks: 'yes' }, '子链开关取值不合法'],
  ])('rejects invalid input %o', (input, message) => {
    expect(() => validateSearchRequest(input)).toThrowError(message);
  });

  it('rejects non-object bodies', () => {
    expect(() => validateSearchRequest(null)).toThrowError('请求体格式不正确');
    expect(() => validateSearchRequest([])).toThrowError('请求体格式不正确');
  });

  it('uses today as the upper bound for freshness', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
