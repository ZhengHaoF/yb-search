import { CNTS, INDUSTRIES, MODES, canonicalSite, normalizeFreshness } from '../../shared/search-options';
import type { Cnt, Industry, Mode, SearchRequestBody, Version } from '../../shared/types';
import { ApiError } from '../errors';

export interface UpstreamSearchParams {
  Query: string;
  Mode?: number;
  Site?: string;
  Cnt?: number;
  Industry?: string;
  Freshness?: string;
  Deeplinks?: boolean;
}

function bad(message: string): never {
  throw new ApiError(400, 'INVALID_PARAM', message);
}

export function validateSearchRequest(input: unknown): SearchRequestBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('请求体格式不正确');
  const raw = input as Record<string, unknown>;

  const query = typeof raw.query === 'string' ? raw.query.trim() : '';
  if (!query) bad('搜索词不能为空');
  if ([...query].length > 200) bad('搜索词不能超过 200 个字符');

  const body: SearchRequestBody = { query };

  if (raw.mode !== undefined) {
    if (typeof raw.mode !== 'number' || !(MODES as readonly number[]).includes(raw.mode)) bad('结果类型取值不合法');
    body.mode = raw.mode as Mode;
  }

  if (raw.cnt !== undefined) {
    if (typeof raw.cnt !== 'number' || !(CNTS as readonly number[]).includes(raw.cnt)) bad('返回条数取值不合法');
    body.cnt = raw.cnt as Cnt;
  }

  if (raw.industry !== undefined) {
    if (typeof raw.industry !== 'string' || !(INDUSTRIES as readonly string[]).includes(raw.industry)) bad('垂直领域取值不合法');
    body.industry = raw.industry as Industry;
  }

  if (raw.site !== undefined) {
    if (typeof raw.site !== 'string') bad('站点筛选格式不正确');
    const site = canonicalSite(raw.site);
    if (!site) bad('站点筛选格式不正确：包含模式仅支持单个域名，排除模式最多 5 个域名');
    body.site = site;
  }

  if (raw.freshness !== undefined) {
    if (typeof raw.freshness !== 'string') bad('时效格式不正确');
    const freshness = normalizeFreshness(raw.freshness);
    if (!freshness) bad('时效格式不正确或超出允许范围');
    body.freshness = freshness;
  }

  if (raw.deeplinks !== undefined) {
    if (typeof raw.deeplinks !== 'boolean') bad('子链开关取值不合法');
    body.deeplinks = raw.deeplinks;
  }

  return body;
}

export function buildUpstreamRequest(
  body: SearchRequestBody,
  version: Version,
): { params: UpstreamSearchParams; notices: string[] } {
  const supportsMode = version !== 'lite';
  const supportsFlagshipParams = version === 'flagship' || version === 'unknown';
  const notices: string[] = [];

  const params: UpstreamSearchParams = { Query: body.query };
  if (body.site) params.Site = body.site;
  if (body.freshness) params.Freshness = body.freshness;

  if (supportsMode) {
    params.Mode = body.mode ?? 2;
    params.Cnt = body.cnt ?? 20;
    if (body.industry) params.Industry = body.industry;
  } else {
    if (body.mode !== undefined) notices.push('当前版本不支持结果类型筛选，已忽略。');
    if (body.cnt !== undefined) notices.push('当前版本不支持返回条数设置，已按默认条数返回。');
    if (body.industry !== undefined) notices.push('当前版本不支持垂直领域筛选，已忽略。');
  }

  if (supportsFlagshipParams) {
    params.Deeplinks = body.deeplinks ?? true;
  }

  return { params, notices };
}
