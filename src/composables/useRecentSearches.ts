import { ref } from 'vue';

const STORAGE_KEY = 'yb.recent.v1';
const MAX_ITEMS = 10;

function readItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const items = ref<string[]>(readItems());

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value));
    } catch {
      // 本地存储不可用时静默降级
    }
  }

  function add(query: string): void {
    const value = query.trim();
    if (!value) return;
    items.value = [value, ...items.value.filter((item) => item !== value)].slice(0, MAX_ITEMS);
    persist();
  }

  function clear(): void {
    items.value = [];
    persist();
  }

  return { items, add, clear };
}
