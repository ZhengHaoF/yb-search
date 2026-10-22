import type { Cnt, Industry, Mode, Version } from './types';

export const MODES: readonly Mode[] = [0, 1, 2];
export const CNTS: readonly Cnt[] = [10, 20, 30, 40, 50];
export const INDUSTRIES: readonly Industry[] = ['gov', 'news', 'acad', 'finance'];

export const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 2, label: '综合' },
  { value: 0, label: '网页' },
  { value: 1, label: '权威' },
];

export const INDUSTRY_OPTIONS: ReadonlyArray<{ value: Industry | null; label: string }> = [
  { value: null, label: '不限' },
  { value: 'news', label: '新闻' },
  { value: 'gov', label: '政府' },
  { value: 'acad', label: '学术' },
  { value: 'finance', label: '财经' },
];

export const QUICK_FRESHNESS: ReadonlyArray<{ value: string | null; label: string }> = [
  { value: null, label: '不限' },
  { value: 'd1', label: '近1天' },
  { value: 'd7', label: '近7天' },
  { value: 'd30', label: '近30天' },
  { value: 'y1', label: '近1年' },
];

export const VERSION_LABELS: Record<Version, string> = {
  lite: '极速版',
  standard: '标准版',
  flagship: '旗舰版',
  unknown: '',
};

const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return value >= '1970-01-01' && value <= todayLocal();
}

export function normalizeFreshness(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const relative = raw.match(/^([dmy])(\d{0,2})$/);
  if (relative) {
    const unit = relative[1];
    const amount = relative[2] === '' ? 1 : Number(relative[2]);
    const max = unit === 'd' ? 30 : unit === 'm' ? 12 : 5;
    if (!Number.isInteger(amount) || amount < 1 || amount > max) return null;
    return `${unit}${amount}`;
  }
  if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length !== 2) return null;
    if (!isValidDate(parts[0]) || !isValidDate(parts[1]) || parts[0] > parts[1]) return null;
    return `${parts[0]},${parts[1]}`;
  }
  return isValidDate(raw) ? raw : null;
}

export function isValidFreshness(value: string): boolean {
  return normalizeFreshness(value) !== null;
}

export function normalizeDomain(value: string): string | null {
  const domain = value.trim().toLowerCase();
  return DOMAIN_RE.test(domain) ? domain : null;
}

export interface ParsedSite {
  type: 'include' | 'exclude';
  domains: string[];
}

export function parseSiteValue(value: string): ParsedSite | null {
  const raw = value.trim();
  if (/^exclude:/i.test(raw)) {
    const parts = raw.slice('exclude:'.length).split('|');
    if (parts.length === 0 || parts.length > 5) return null;
    const domains: string[] = [];
    for (const part of parts) {
      const domain = normalizeDomain(part);
      if (!domain) return null;
      if (!domains.includes(domain)) domains.push(domain);
    }
    if (!domains.length) return null;
    return { type: 'exclude', domains };
  }
  const domain = normalizeDomain(raw);
  return domain ? { type: 'include', domains: [domain] } : null;
}

export function canonicalSite(value: string): string | null {
  const parsed = parseSiteValue(value);
  if (!parsed) return null;
  return parsed.type === 'include' ? parsed.domains[0] : `exclude:${parsed.domains.join('|')}`;
}

export function isValidSite(value: string): boolean {
  return parseSiteValue(value) !== null;
}

function shortDate(value: string): string {
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1])}-${Number(match[2])}`;
}

export function freshnessLabel(value: string | null | undefined): string {
  if (!value) return '不限';
  const quick = QUICK_FRESHNESS.find((item) => item.value === value);
  if (quick) return quick.label;
  const relative = value.match(/^([dmy])(\d+)$/);
  if (relative) {
    const unit = relative[1] === 'd' ? '天' : relative[1] === 'm' ? '月' : '年';
    return `近${Number(relative[2])}${unit}`;
  }
  if (value.includes(',')) {
    const [from, to] = value.split(',');
    return `${shortDate(from)} ~ ${shortDate(to)}`;
  }
  return value;
}
