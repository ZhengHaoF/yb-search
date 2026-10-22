import { CNTS, INDUSTRIES, MODES, canonicalSite, normalizeFreshness } from '@shared/search-options';
import type { Cnt, Industry, Mode, SearchRequestBody } from '@shared/types';

export interface SearchState {
  q: string;
  mode: Mode;
  freshness: string | null;
  industry: Industry | null;
  cnt: Cnt;
  site: string | null;
  deeplinks: boolean;
}

export const DEFAULT_STATE: SearchState = {
  q: '',
  mode: 2,
  freshness: null,
  industry: null,
  cnt: 20,
  site: null,
  deeplinks: true,
};

export function readState(search: string): SearchState {
  const params = new URLSearchParams(search);

  const modeValue = Number(params.get('mode'));
  const mode = params.has('mode') && (MODES as readonly number[]).includes(modeValue) ? (modeValue as Mode) : 2;

  const cntValue = Number(params.get('cnt'));
  const cnt = params.has('cnt') && (CNTS as readonly number[]).includes(cntValue) ? (cntValue as Cnt) : 20;

  const industryValue = params.get('industry');
  const industry = (INDUSTRIES as readonly string[]).includes(industryValue ?? '')
    ? (industryValue as Industry)
    : null;

  const freshnessValue = params.get('freshness');
  const freshness = freshnessValue ? normalizeFreshness(freshnessValue) : null;

  const siteValue = params.get('site');
  const site = siteValue ? canonicalSite(siteValue) : null;

  return {
    q: (params.get('q') ?? '').trim(),
    mode,
    freshness,
    industry,
    cnt,
    site,
    deeplinks: params.get('deeplinks') !== '0',
  };
}

export function toSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.mode !== 2) params.set('mode', String(state.mode));
  if (state.freshness) params.set('freshness', state.freshness);
  if (state.industry) params.set('industry', state.industry);
  if (state.cnt !== 20) params.set('cnt', String(state.cnt));
  if (state.site) params.set('site', state.site);
  if (!state.deeplinks) params.set('deeplinks', '0');
  return params;
}

export function buildUrl(state: SearchState): string {
  const query = toSearchParams(state).toString();
  return `${location.pathname}${query ? `?${query}` : ''}`;
}

export function toBody(state: SearchState): SearchRequestBody {
  const body: SearchRequestBody = { query: state.q.trim() };
  if (state.mode !== 2) body.mode = state.mode;
  if (state.freshness) body.freshness = state.freshness;
  if (state.industry) body.industry = state.industry;
  if (state.cnt !== 20) body.cnt = state.cnt;
  if (state.site) body.site = state.site;
  if (!state.deeplinks) body.deeplinks = false;
  return body;
}

export function activeFilterCount(state: SearchState): number {
  let count = 0;
  if (state.mode !== 2) count += 1;
  if (state.freshness) count += 1;
  if (state.industry) count += 1;
  if (state.cnt !== 20) count += 1;
  if (state.site) count += 1;
  if (!state.deeplinks) count += 1;
  return count;
}
