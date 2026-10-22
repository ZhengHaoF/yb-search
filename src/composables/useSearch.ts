import { computed, ref } from 'vue';
import type { SearchRequestBody, SearchResponse, Version } from '@shared/types';
import { ApiError, search as apiSearch } from '@/api/client';

export interface UiError {
  message: string;
  code: string;
  requestId?: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useSearch() {
  const data = ref<SearchResponse | null>(null);
  const loading = ref(false);
  const error = ref<UiError | null>(null);
  const version = ref<Version>('unknown');

  let controller: AbortController | null = null;
  let sequence = 0;

  async function run(body: SearchRequestBody): Promise<void> {
    if (!body.query) return;
    controller?.abort();
    controller = new AbortController();
    const current = ++sequence;

    loading.value = true;
    error.value = null;
    data.value = null;

    try {
      const response = await apiSearch(body, controller.signal);
      if (current !== sequence) return;
      data.value = response;
      if (response.version !== 'unknown') version.value = response.version;
    } catch (caught) {
      if (current !== sequence || isAbortError(caught)) return;
      if (caught instanceof ApiError) {
        error.value = {
          message: caught.message,
          code: caught.code,
          requestId: caught.requestId,
        };
      } else {
        error.value = { message: '网络请求失败，请稍后重试。', code: 'NETWORK_ERROR' };
      }
    } finally {
      if (current === sequence) loading.value = false;
    }
  }

  function reset(): void {
    controller?.abort();
    controller = null;
    sequence += 1;
    loading.value = false;
    error.value = null;
    data.value = null;
  }

  const count = computed(() => data.value?.count ?? 0);

  return { data, loading, error, version, count, run, reset };
}
