<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SearchResult } from '@shared/types';

const props = defineProps<{ result: SearchResult }>();

const faviconBroken = ref(false);
const brokenPics = ref<Set<string>>(new Set());
const linksOpen = ref(false);

function toHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(raw?: string): string {
  if (!raw) return '';
  const match = raw.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : raw;
}

const safeUrl = computed(() => toHttpUrl(props.result.url));
const host = computed(() => {
  try {
    return new URL(props.result.url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
});
const siteLabel = computed(() => props.result.site?.trim() || host.value || '未知站点');
const title = computed(() => props.result.title.trim() || host.value || '未命名结果');
const initial = computed(() => siteLabel.value.slice(0, 1).toUpperCase());
const summary = computed(() => props.result.passage || props.result.content || '');
const dateText = computed(() => formatDate(props.result.date));
const showAuthority = computed(
  () => typeof props.result.authorityLevel === 'number' && props.result.authorityLevel >= 4,
);
const favicon = computed(() =>
  props.result.favicon && !faviconBroken.value ? toHttpUrl(props.result.favicon) : null,
);
const visiblePics = computed(() =>
  props.result.pics
    .filter((pic) => !brokenPics.value.has(pic.originUrl) && toHttpUrl(pic.originUrl))
    .slice(0, 3),
);
const links = computed(() => props.result.deeplinks.filter((link) => toHttpUrl(link.url)));

function onPicError(url: string): void {
  const next = new Set(brokenPics.value);
  next.add(url);
  brokenPics.value = next;
}
</script>

<template>
  <article class="result-card">
    <a
      v-if="safeUrl"
      class="title"
      :href="safeUrl"
      target="_blank"
      rel="noopener noreferrer"
    >{{ title }}</a>
    <span v-else class="title">{{ title }}</span>

    <div class="meta">
      <img
        v-if="favicon"
        class="favicon"
        :src="favicon"
        alt=""
        width="16"
        height="16"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="faviconBroken = true"
      />
      <span v-else class="favicon favicon--fallback" aria-hidden="true">{{ initial }}</span>
      <span class="site">{{ siteLabel }}</span>
      <template v-if="dateText">
        <span class="dot" aria-hidden="true">·</span>
        <time class="date">{{ dateText }}</time>
      </template>
      <span v-if="showAuthority" class="authority" title="权威度较高">权威</span>
    </div>

    <p v-if="summary" class="summary">{{ summary }}</p>

    <div v-if="visiblePics.length" class="pics">
      <a
        v-for="pic in visiblePics"
        :key="pic.originUrl"
        class="pic"
        :href="pic.originUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          :src="pic.originUrl"
          :alt="pic.caption || title"
          loading="lazy"
          referrerpolicy="no-referrer"
          @error="onPicError(pic.originUrl)"
        />
      </a>
    </div>

    <div v-if="links.length" class="deeplinks">
      <button
        type="button"
        class="deeplink-toggle"
        :aria-expanded="linksOpen"
        @click="linksOpen = !linksOpen"
      >
        <svg class="chevron" :class="{ 'chevron--open': linksOpen }" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m7.5 5 5 5-5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        子页 ({{ links.length }})
      </button>
      <ul v-if="linksOpen" class="deeplink-list">
        <li v-for="link in links" :key="link.url">
          <a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title || link.url }}</a>
        </li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.result-card {
  padding: 20px 0 22px;
  border-bottom: 1px solid var(--border);
}

.result-card:first-child {
  padding-top: 4px;
}

.result-card:last-child {
  border-bottom: 0;
}

.title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -0.01em;
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  transition: color 0.16s ease;
}

a.title:hover {
  color: var(--accent);
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  color: var(--text-3);
  font-size: 12.5px;
}

.favicon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: cover;
  flex: none;
}

.favicon--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-muted);
  color: var(--text-2);
  font-size: 10px;
  font-weight: 600;
}

.site {
  color: var(--text-2);
}

.dot {
  color: var(--border-strong);
}

.authority {
  margin-left: 2px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  line-height: 1.5;
}

.summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.pics {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.pic {
  display: block;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-muted);
}

.pic img {
  width: 112px;
  height: 76px;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.pic:hover img {
  transform: scale(1.03);
}

.deeplinks {
  margin-top: 10px;
}

.deeplink-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-3);
  font-size: 12.5px;
  transition: color 0.16s ease;
}

.deeplink-toggle:hover {
  color: var(--accent);
}

.chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.18s ease;
}

.chevron--open {
  transform: rotate(90deg);
}

.deeplink-list {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.deeplink-list a {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deeplink-list a:hover {
  color: var(--accent);
}

@media (max-width: 520px) {
  .result-card {
    padding: 16px 0 18px;
  }

  .title {
    font-size: 17px;
  }

  .pic img {
    width: 92px;
    height: 64px;
  }

  .deeplink-list a {
    white-space: normal;
  }
}
</style>
