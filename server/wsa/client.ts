import { wsa } from 'tencentcloud-sdk-nodejs-wsa';
import type { SearchRequestBody, SearchResponse, Version } from '../../shared/types';
import { ApiError } from '../errors';
import { buildUpstreamRequest, type UpstreamSearchParams } from './map-request';
import { normalizeVersion, parseSearchResponse } from './parse-response';

const WsaClient = wsa.v20250508.Client;
let client: InstanceType<typeof WsaClient> | null = null;
let knownVersion: Version = 'unknown';

function getClient(): InstanceType<typeof WsaClient> {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID?.trim();
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY?.trim();
  if (!secretId || !secretKey) {
    throw new ApiError(500, 'CONFIG_MISSING', '服务端未配置腾讯云密钥，请检查 .env');
  }
  if (!client) {
    client = new WsaClient({
      credential: { secretId, secretKey },
      profile: {
        httpProfile: {
          endpoint: 'wsa.tencentcloudapi.com',
          reqTimeout: 15,
        },
      },
    });
  }
  return client;
}

async function invoke(params: UpstreamSearchParams) {
  const started = performance.now();
  const raw = await getClient().SearchPro(params);
  return { raw, elapsedMs: Math.round(performance.now() - started) };
}

function mergeMessage(...parts: Array<string | undefined>): string | undefined {
  const merged = parts.filter((part): part is string => Boolean(part && part.trim()));
  return merged.length ? merged.join(' ') : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnsupportedParamError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return code.includes('InvalidParameter') && /不支持|not\s*support|unsupported/i.test(message);
}

function mapUpstreamError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const record = isRecord(error) ? error : {};
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';
  const requestId = typeof record.requestId === 'string' ? record.requestId : undefined;

  if (code.startsWith('AuthFailure') || code === 'InvalidCredential') {
    return new ApiError(401, 'WSA_AUTH_FAILURE', `腾讯云鉴权失败：${message || '请检查密钥与权限'}`, requestId);
  }
  if (code === 'UnauthorizedOperation') {
    return new ApiError(403, 'WSA_UNAUTHORIZED_OPERATION', `未授权操作：${message || '请检查腾讯云账号权限'}`, requestId);
  }
  if (code === 'ResourceNotFound') {
    return new ApiError(404, 'WSA_RESOURCE_NOT_FOUND', '元宝搜索服务未开通，请到腾讯云控制台激活后重试。', requestId);
  }
  if (code === 'ResourceUnavailable') {
    return new ApiError(503, 'WSA_RESOURCE_UNAVAILABLE', '元宝搜索服务当前不可用（可能欠费或未激活）。', requestId);
  }
  if (code === 'RequestLimitExceeded') {
    return new ApiError(429, 'WSA_REQUEST_LIMIT_EXCEEDED', '请求过于频繁，请稍后重试。', requestId);
  }
  if (code === 'InvalidParameter') {
    return new ApiError(400, 'INVALID_PARAM', `请求参数不合法：${message || '请检查筛选条件'}`, requestId);
  }
  if (code.startsWith('InternalError')) {
    return new ApiError(502, 'WSA_INTERNAL_ERROR', '腾讯云内部错误，请稍后重试。', requestId);
  }
  if (!code) {
    return new ApiError(502, 'WSA_NETWORK_ERROR', `无法连接元宝搜索服务${message ? `：${message}` : ''}`, requestId);
  }
  return new ApiError(502, 'WSA_UPSTREAM_ERROR', `元宝搜索调用失败：${message || code}`, requestId);
}

export async function runSearch(body: SearchRequestBody): Promise<SearchResponse> {
  const { params, notices } = buildUpstreamRequest(body, knownVersion);

  try {
    const { raw, elapsedMs } = await invoke(params);
    knownVersion = normalizeVersion(raw.Version);
    const parsed = parseSearchResponse(raw, { query: body.query, elapsedMs });
    parsed.msg = mergeMessage(parsed.msg, ...notices);
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (isUnsupportedParamError(error)) {
      const minimal = buildUpstreamRequest(
        { query: body.query, site: body.site, freshness: body.freshness },
        'lite',
      );
      try {
        const { raw, elapsedMs } = await invoke(minimal.params);
        knownVersion = normalizeVersion(raw.Version);
        const parsed = parseSearchResponse(raw, { query: body.query, elapsedMs });
        parsed.msg = mergeMessage(parsed.msg, '已根据当前接口版本自动调整筛选条件。');
        return parsed;
      } catch (retryError) {
        throw mapUpstreamError(retryError);
      }
    }

    throw mapUpstreamError(error);
  }
}
