<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { VERSION_LABELS } from '@shared/search-options';
import { getSession, logout as apiLogout } from '@/api/client';
import BrandMark from '@/components/BrandMark.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import FilterBar from '@/components/FilterBar.vue';
import LoginGate from '@/components/LoginGate.vue';
import ResultCard from '@/components/ResultCard.vue';
import ResultSkeleton from '@/components/ResultSkeleton.vue';
import SearchBar from '@/components/SearchBar.vue';
import { useRecentSearches } from '@/composables/useRecentSearches';
import { useSearch } from '@/composables/useSearch';
import {
  DEFAULT_STATE,
  activeFilterCount,
  buildUrl,
  readState,
  toBody,
  type SearchState,
} from '@/composables/useUrlState';

const state = reactive<SearchState>({ ...DEFAULT_STATE });
const draft = ref('');
const searchBar = ref<InstanceType<typeof SearchBar> | null>(null);
const filterOpen = ref(false);

const { data, loading, error, version, run, reset } = useSearch();
const { items: recent, add: addRecent, clear: clearRecent } = useRecentSearches();

const auth = reactive({ checked: false, required: false, authenticated: true });

const hasQuery = computed(() => Boolean(state.q));
const activeFilters = computed(() => activeFilterCount(state));
const versionLabel = computed(() => VERSION_LABELS[version.value] ?? '');

function syncUrl(push: boolean): void {
  const url = buildUrl(state);
  if (push) history.pushState({}, '', url);
  else history.replaceState({}, '', url);
}

function commitQuery(query: string): void {
  const value = query.trim();
  if (!value) return;
  state.q = value;
  draft.value = value;
  syncUrl(true);
  addRecent(value);
  void run(toBody(state));
}

function onSearchSubmit(): void {
  commitQuery(draft.value);
}

function searchRecent(query: string): void {
  commitQuery(query);
}

function onFilterChange(patch: Partial<SearchState>): void {
  Object.assign(state, patch);
  syncUrl(false);
  if (state.q) void run(toBody(state));
}

function clearFilters(): void {
  onFilterChange({
    mode: 2,
    freshness: null,
    industry: null,
    cnt: 20,
    site: null,
    deeplinks: true,
  });
}

function retry(): void {
  if (state.q) void run(toBody(state));
}

function goHome(): void {
  Object.assign(state, DEFAULT_STATE);
  draft.value = '';
  filterOpen.value = false;
  reset();
  syncUrl(true);
}

function onPopState(): void {
  filterOpen.value = false;
  const next = readState(location.search);
  Object.assign(state, next);
  draft.value = next.q;
  if (next.q) void run(toBody(next));
  else reset();
}

function isEditable(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && filterOpen.value) {
    filterOpen.value = false;
    return;
  }
  if (event.key === '/' && !isEditable(event.target)) {
    event.preventDefault();
    searchBar.value?.focus();
  }
}

async function checkSession(): Promise<void> {
  try {
    const session = await getSession();
    auth.required = session.authRequired;
    auth.authenticated = session.authenticated;
  } catch {
    auth.required = false;
    auth.authenticated = true;
  } finally {
    auth.checked = true;
  }
}

function onLoginSuccess(): void {
  auth.required = true;
  auth.authenticated = true;
  if (state.q) void run(toBody(state));
}

async function doLogout(): Promise<void> {
  try {
    await apiLogout();
  } catch {
    // 即便请求失败也回到登录页
  }
  auth.authenticated = false;
  reset();
}

watch(error, (value) => {
  if (value?.code === 'UNAUTHORIZED') {
    auth.required = true;
    auth.authenticated = false;
  }
});

watch(version, (value) => {
  if (value === 'unknown') return;
  let changed = false;
  if (value === 'lite') {
    if (state.mode !== 2) {
      state.mode = 2;
      changed = true;
    }
    if (state.cnt !== 20) {
      state.cnt = 20;
      changed = true;
    }
    if (state.industry) {
      state.industry = null;
      changed = true;
    }
  }
  if (value !== 'flagship' && state.deeplinks !== true) {
    state.deeplinks = true;
    changed = true;
  }
  if (changed) syncUrl(false);
});

watch(filterOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

onMounted(async () => {
  const initial = readState(location.search);
  Object.assign(state, initial);
  draft.value = initial.q;

  window.addEventListener('popstate', onPopState);
  window.addEventListener('keydown', onKeydown);

  await checkSession();
  if ((!auth.required || auth.authenticated) && state.q) {
    void run(toBody(state));
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <div v-if="!auth.checked" class="boot-screen">
    <span class="boot-mark" aria-label="加载中"></span>
  </div>

  <div v-else-if="auth.required && !auth.authenticated" class="gate-screen">
    <LoginGate @success="onLoginSuccess" />
  </div>

  <div v-else-if="!hasQuery" class="home-screen">
    <main class="hero">
      <BrandMark size="large" />
      <p class="tagline">元宝搜索 · 自用</p>

      <div class="hero-search">
        <SearchBar
          ref="searchBar"
          v-model="draft"
          autofocus
          :loading="loading"
          @submit="onSearchSubmit"
        />
      </div>

      <div v-if="recent.length" class="recent">
        <div class="recent-head">
          <span>最近搜索</span>
          <button type="button" @click="clearRecent">清空</button>
        </div>
        <div class="recent-list">
          <button v-for="item in recent" :key="item" type="button" @click="searchRecent(item)">
            {{ item }}
          </button>
        </div>
      </div>

      <p class="hint">按 <kbd>/</kbd> 快速聚焦搜索框</p>
    </main>

    <footer class="home-footer">
      <span>数据来源：腾讯云元宝搜索 API</span>
      <button v-if="auth.required && auth.authenticated" type="button" class="link-btn" @click="doLogout">
        退出登录
      </button>
    </footer>
  </div>

  <div v-else class="results-screen">
    <header class="app-header">
      <div class="header-row">
        <a class="brand-link" href="/" aria-label="返回首页" @click.prevent="goHome">
          <BrandMark />
        </a>
        <SearchBar
          ref="searchBar"
          v-model="draft"
          compact
          :loading="loading"
          @submit="onSearchSubmit"
        />
        <button class="filter-toggle" type="button" @click="filterOpen = true">
          筛选
          <span v-if="activeFilters" class="filter-count">{{ activeFilters }}</span>
        </button>
      </div>
      <FilterBar class="desktop-filters" :state="state" :version="version" @change="onFilterChange" />
    </header>

    <main class="results-main">
      <p v-if="data?.msg" class="notice" role="status">{{ data.msg }}</p>

      <div v-if="data && !loading && !error" class="search-summary">
        <span>{{ data.count }} 条结果</span>
        <span class="sep" aria-hidden="true">·</span>
        <span>用时 {{ data.elapsedMs }} ms</span>
        <template v-if="versionLabel">
          <span class="sep" aria-hidden="true">·</span>
          <span>{{ versionLabel }}</span>
        </template>
      </div>

      <ResultSkeleton v-if="loading || (!data && !error)" />
      <ErrorState v-else-if="error" :error="error" @retry="retry" />
      <template v-else-if="data">
        <EmptyState
          v-if="!data.results.length"
          :has-filters="activeFilters > 0"
          @clear-filters="clearFilters"
        />
        <div v-else class="result-list">
          <ResultCard
            v-for="(item, index) in data.results"
            :key="`${item.url}-${index}`"
            :result="item"
          />
        </div>
      </template>
    </main>

    <footer class="results-footer">
      <span>数据来源：腾讯云元宝搜索 API</span>
      <button v-if="auth.required && auth.authenticated" type="button" class="link-btn" @click="doLogout">
        退出登录
      </button>
    </footer>

    <Teleport to="body">
      <div v-if="filterOpen" class="sheet-backdrop" @click.self="filterOpen = false">
        <section class="sheet" role="dialog" aria-modal="true" aria-label="筛选">
          <div class="sheet-head">
            <strong>筛选</strong>
            <button type="button" @click="filterOpen = false">完成</button>
          </div>
          <div class="sheet-body">
            <FilterBar variant="panel" :state="state" :version="version" @change="onFilterChange" />
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.gate-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: radial-gradient(circle at 50% -10%, #edf4ff 0, #ffffff 58%);
}

.home-screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.hero {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 56px 20px 32px;
  animation: rise 0.35s ease both;
}

.tagline {
  margin: 10px 0 30px;
  color: var(--text-3);
  font-size: 13px;
  letter-spacing: 0.02em;
}

.hero-search {
  width: 100%;
  max-width: 640px;
}

.recent {
  width: 100%;
  max-width: 640px;
  margin-top: 24px;
}

.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--text-3);
  font-size: 12px;
}

.recent-head button {
  color: var(--text-3);
  font-size: 12px;
}

.recent-head button:hover {
  color: var(--accent);
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-list button {
  max-width: 100%;
  height: 30px;
  padding: 0 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--text-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.recent-list button:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.hint {
  margin-top: 34px;
  color: var(--text-3);
  font-size: 12px;
}

.home-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 22px;
  color: var(--text-3);
  font-size: 12px;
}

.results-screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: var(--header-maxw);
  margin: 0 auto;
  padding: 12px 20px 6px;
}

.brand-link {
  flex: none;
  color: inherit;
}

.desktop-filters {
  width: 100%;
  max-width: var(--header-maxw);
  margin: 0 auto;
  padding: 6px 20px 14px;
  display: flex;
}

.filter-toggle {
  display: none;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 13px;
  background: var(--bg);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
}

.results-main {
  flex: 1 0 auto;
  width: 100%;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 22px 20px 56px;
  animation: fade 0.25s ease both;
}

.notice {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}

.search-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--text-3);
  font-size: 12.5px;
}

.sep {
  color: var(--border-strong);
}

.results-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 20px 40px;
  color: var(--text-3);
  font-size: 12px;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  background: rgba(31, 35, 41, 0.42);
  backdrop-filter: blur(2px);
}

.sheet {
  width: 100%;
  max-height: 84dvh;
  overflow-y: auto;
  padding: 18px 20px 28px;
  border-radius: 20px 20px 0 0;
  background: var(--bg);
  animation: slide-up 0.22s ease both;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.sheet-head strong {
  font-size: 16px;
  font-weight: 600;
}

.sheet-head button {
  color: var(--accent);
  font-size: 14px;
}

.sheet-body {
  padding-bottom: 8px;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-up {
  from {
    transform: translateY(24px);
  }
  to {
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .desktop-filters {
    display: none;
  }

  .filter-toggle {
    display: inline-flex;
  }

  .header-row {
    gap: 10px;
    padding: 10px 14px;
  }

  .results-main {
    padding: 16px 16px 40px;
  }

  .results-footer {
    padding: 0 16px 28px;
  }

  .hero {
    padding: 40px 16px 24px;
  }
}

@media (max-width: 640px) {
  .brand-link :deep(.brand-word) {
    display: none;
  }
}
</style>
