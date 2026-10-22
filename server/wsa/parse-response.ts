import type {
  SearchResponse,
  SearchResult,
  SearchResultDeeplink,
  SearchResultPic,
  Version,
} from '../../shared/types';
import { ApiError } from '../errors';

export interface RawSearchResponse {
  Query?: unknown;
  Pages?: unknown;
  Version?: unknown;
  Msg?: unknown;
  RequestId?: unknown;
}

export function normalizeVersion(value: unknown): Version {
  return value === 'lite' || value === 'standard' || value === 'flagship' ? value : 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function parseDoc(item: unknown): SearchResult | null {
  let doc: unknown = item;
  if (typeof item === 'string') {
    try {
      doc = JSON.parse(item);
    } catch {
      return null;
    }
  }
  if (!isRecord(doc)) return null;

  const url = httpUrl(doc.url);
  if (!url) return null;

  const pics: SearchResultPic[] = [];
  if (Array.isArray(doc.pics)) {
    for (const rawPic of doc.pics) {
      if (!isRecord(rawPic)) continue;
      const originUrl = httpUrl(rawPic.origin_url);
      if (!originUrl) continue;
      pics.push({ caption: text(rawPic.caption), originUrl });
      if (pics.length >= 10) break;
    }
  }

  const deeplinks: SearchResultDeeplink[] = [];
  if (Array.isArray(doc.deeplinks)) {
    for (const rawLink of doc.deeplinks) {
      if (!isRecord(rawLink)) continue;
      const linkUrl = httpUrl(rawLink.url);
      if (!linkUrl) continue;
      deeplinks.push({ title: text(rawLink.title), url: linkUrl });
      if (deeplinks.length >= 10) break;
    }
  }

  return {
    title: text(doc.title) ?? '',
    url,
    date: text(doc.date),
    passage: text(doc.passage),
    content: text(doc.content),
    site: text(doc.site),
    score: finiteNumber(doc.score),
    authorityLevel: finiteNumber(doc.authority_level),
    favicon: httpUrl(doc.favicon),
    pics,
    deeplinks,
  };
}

export function parseSearchResponse(
  raw: RawSearchResponse,
  options: { query: string; elapsedMs: number },
): SearchResponse {
  const requestId = text(raw.RequestId);

  if (raw.Pages !== undefined && !Array.isArray(raw.Pages)) {
    throw new ApiError(502, 'RESULT_PARSE_FAILED', '搜索接口返回的结果格式不正确', requestId);
  }

  const pages = Array.isArray(raw.Pages) ? raw.Pages : [];
  const results = pages.map(parseDoc).filter((item): item is SearchResult => item !== null);

  if (pages.length > 0 && results.length === 0) {
    throw new ApiError(502, 'RESULT_PARSE_FAILED', '搜索结果解析失败，请重试', requestId);
  }

  return {
    query: text(raw.Query) ?? options.query,
    version: normalizeVersion(raw.Version),
    results,
    count: results.length,
    elapsedMs: options.elapsedMs,
    requestId,
    msg: text(raw.Msg),
  };
}
