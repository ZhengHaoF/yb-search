export type Mode = 0 | 1 | 2;
export type Industry = 'gov' | 'news' | 'acad' | 'finance';
export type Cnt = 10 | 20 | 30 | 40 | 50;
export type Version = 'lite' | 'standard' | 'flagship' | 'unknown';

export interface SearchRequestBody {
  query: string;
  mode?: Mode;
  site?: string;
  cnt?: Cnt;
  industry?: Industry;
  freshness?: string;
  deeplinks?: boolean;
}

export interface SearchResultPic {
  caption?: string;
  originUrl: string;
}

export interface SearchResultDeeplink {
  title?: string;
  url: string;
}

export interface SearchResult {
  title: string;
  url: string;
  date?: string;
  passage?: string;
  content?: string;
  site?: string;
  score?: number;
  authorityLevel?: number;
  favicon?: string;
  pics: SearchResultPic[];
  deeplinks: SearchResultDeeplink[];
}

export interface SearchResponse {
  query: string;
  version: Version;
  results: SearchResult[];
  count: number;
  elapsedMs: number;
  requestId?: string;
  msg?: string;
}

export interface SessionResponse {
  authRequired: boolean;
  authenticated: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}
