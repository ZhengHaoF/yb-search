<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { normalizeDomain, parseSiteValue } from '@shared/search-options';
import { useClickOutside } from '@/composables/useClickOutside';

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    inline?: boolean;
  }>(),
  { inline: false },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void;
}>();

type SiteMode = 'include' | 'exclude';

const open = ref(false);
const root = ref<HTMLElement | null>(null);
useClickOutside(root, () => {
  if (open.value) open.value = false;
});

const mode = ref<SiteMode>('include');
const includeDomain = ref('');
const excludeDomains = ref<string[]>([]);
const input = ref('');
const error = ref('');

const isActive = computed(() => Boolean(props.modelValue));

const triggerLabel = computed(() => {
  if (!props.modelValue) return '不限';
  const parsed = parseSiteValue(props.modelValue);
  if (!parsed) return '自定义';
  return parsed.type === 'include' ? parsed.domains[0] : `排除 ${parsed.domains.length} 站`;
});

function sync(value: string | null): void {
  error.value = '';
  input.value = '';
  const parsed = value ? parseSiteValue(value) : null;
  if (!parsed) {
    mode.value = 'include';
    includeDomain.value = '';
    excludeDomains.value = [];
    return;
  }
  mode.value = parsed.type;
  if (parsed.type === 'include') {
    includeDomain.value = parsed.domains[0];
    excludeDomains.value = [];
  } else {
    includeDomain.value = '';
    excludeDomains.value = [...parsed.domains];
  }
}

watch(() => props.modelValue, sync, { immediate: true });

function toggle(): void {
  if (props.inline) return;
  open.value = !open.value;
  if (open.value) sync(props.modelValue);
}

function chooseMode(next: SiteMode): void {
  mode.value = next;
  error.value = '';
}

function addDomain(): void {
  const raw = input.value.trim();
  if (!raw) return;
  const domain = normalizeDomain(raw);
  if (!domain) {
    error.value = '请输入有效域名，如 zhihu.com';
    return;
  }
  if (excludeDomains.value.includes(domain)) {
    error.value = '该域名已在排除列表中';
    return;
  }
  if (excludeDomains.value.length >= 5) {
    error.value = '最多排除 5 个域名';
    return;
  }
  excludeDomains.value = [...excludeDomains.value, domain];
  input.value = '';
  error.value = '';
}

function removeDomain(domain: string): void {
  excludeDomains.value = excludeDomains.value.filter((item) => item !== domain);
  error.value = '';
}

function apply(): void {
  if (mode.value === 'include') {
    const domain = normalizeDomain(includeDomain.value);
    if (!domain) {
      error.value = '请输入有效域名，如 zhihu.com';
      return;
    }
    error.value = '';
    emit('update:modelValue', domain);
  } else {
    if (!excludeDomains.value.length) {
      error.value = '请至少添加一个要排除的域名';
      return;
    }
    error.value = '';
    emit('update:modelValue', `exclude:${excludeDomains.value.join('|')}`);
  }
  if (!props.inline) open.value = false;
}

function clear(): void {
  error.value = '';
  emit('update:modelValue', null);
  if (!props.inline) open.value = false;
}
</script>

<template>
  <div ref="root" class="site" :class="{ 'site--inline': inline }">
    <button
      v-if="!inline"
      type="button"
      class="trigger"
      :class="{ 'trigger--active': isActive }"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="trigger-label">站点</span>
      <span class="trigger-value">{{ triggerLabel }}</span>
      <svg class="chevron" :class="{ 'chevron--open': open }" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="m5 7.5 5 5 5-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div v-if="inline || open" class="surface">
      <div class="modes" role="radiogroup" aria-label="站点筛选方式">
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'include'"
          :class="{ 'mode--active': mode === 'include' }"
          @click="chooseMode('include')"
        >
          包含单站点
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'exclude'"
          :class="{ 'mode--active': mode === 'exclude' }"
          @click="chooseMode('exclude')"
        >
          排除站点
        </button>
      </div>

      <div v-if="mode === 'include'" class="field">
        <input
          v-model="includeDomain"
          class="text-input"
          type="text"
          placeholder="zhihu.com"
          aria-label="要包含的域名"
          @keydown.enter.prevent="apply"
        />
        <p class="hint">每次仅支持一个域名。</p>
      </div>

      <div v-else class="field">
        <div v-if="excludeDomains.length" class="tags">
          <span v-for="domain in excludeDomains" :key="domain" class="tag">
            {{ domain }}
            <button type="button" class="tag-remove" :aria-label="`移除 ${domain}`" @click="removeDomain(domain)">
              ×
            </button>
          </span>
        </div>
        <div class="add-row">
          <input
            v-model="input"
            class="text-input"
            type="text"
            placeholder="输入域名后回车"
            aria-label="要排除的域名"
            @keydown.enter.prevent="addDomain"
          />
          <button type="button" class="add" @click="addDomain">添加</button>
        </div>
        <p class="hint">最多排除 5 个域名，已添加 {{ excludeDomains.length }}/5。</p>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p class="hint hint--note">站点条件只作用于普通网页结果，权威卡不受影响。</p>

      <div class="actions">
        <button type="button" class="clear" @click="clear">清除</button>
        <button type="button" class="apply" @click="apply">应用</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.site {
  position: relative;
  flex: none;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 13px;
  background: var(--bg);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.trigger:hover {
  border-color: var(--border-strong);
}

.trigger--active {
  border-color: rgba(0, 82, 217, 0.35);
  background: var(--accent-soft);
  color: var(--accent);
}

.trigger-label {
  color: var(--text-3);
}

.trigger--active .trigger-label {
  color: rgba(0, 82, 217, 0.7);
}

.trigger-value {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.18s ease;
}

.chevron--open {
  transform: rotate(180deg);
}

.surface {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow-pop);
}

.site--inline .surface {
  position: static;
  width: 100%;
  max-width: none;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.modes {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  padding: 3px;
  border-radius: 9px;
  background: var(--bg-soft);
}

.modes button {
  flex: 1;
  height: 28px;
  border-radius: 7px;
  color: var(--text-2);
  font-size: 12px;
}

.modes .mode--active {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(31, 35, 41, 0.1);
}

.text-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  font-size: 13px;
}

.text-input::placeholder {
  color: var(--text-3);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 4px 0 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
}

.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: rgba(0, 82, 217, 0.7);
  font-size: 14px;
  line-height: 1;
}

.tag-remove:hover {
  background: rgba(0, 82, 217, 0.12);
  color: var(--accent);
}

.add-row {
  display: flex;
  gap: 8px;
}

.add {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 12px;
}

.add:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.hint {
  margin: 6px 0 0;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.5;
}

.hint--note {
  margin-top: 10px;
}

.error {
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 12px;
  line-height: 1.5;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.clear {
  color: var(--text-2);
  font-size: 12px;
}

.clear:hover {
  color: var(--accent);
}

.apply {
  height: 30px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.apply:hover {
  background: var(--accent-hover);
}
</style>
