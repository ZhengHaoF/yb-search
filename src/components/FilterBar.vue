<script setup lang="ts">
import { computed } from 'vue';
import { CNTS, INDUSTRY_OPTIONS, MODE_OPTIONS } from '@shared/search-options';
import type { Cnt, Industry, Mode, Version } from '@shared/types';
import { activeFilterCount, type SearchState } from '@/composables/useUrlState';
import FreshnessPicker from '@/components/FreshnessPicker.vue';
import SitePicker from '@/components/SitePicker.vue';

const props = withDefaults(
  defineProps<{
    state: SearchState;
    version: Version;
    variant?: 'bar' | 'panel';
  }>(),
  { variant: 'bar' },
);

const emit = defineEmits<{
  (event: 'change', patch: Partial<SearchState>): void;
}>();

const isPanel = computed(() => props.variant === 'panel');
const supportsMode = computed(() => props.version !== 'lite');
const supportsDeeplinks = computed(() => props.version === 'flagship' || props.version === 'unknown');
const activeCount = computed(() => activeFilterCount(props.state));

function chooseMode(mode: Mode): void {
  if (props.state.mode === mode) return;
  emit('change', { mode });
}

function onIndustryChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit('change', { industry: value ? (value as Industry) : null });
}

function onCntChange(event: Event): void {
  emit('change', { cnt: Number((event.target as HTMLSelectElement).value) as Cnt });
}

function onDeeplinksChange(event: Event): void {
  emit('change', { deeplinks: (event.target as HTMLInputElement).checked });
}

function reset(): void {
  emit('change', {
    mode: 2,
    freshness: null,
    industry: null,
    cnt: 20,
    site: null,
    deeplinks: true,
  });
}
</script>

<template>
  <div class="filter-bar" :class="isPanel ? 'filter-bar--panel' : 'filter-bar--bar'">
    <div v-if="supportsMode" class="control" :class="{ 'control--stack': isPanel }">
      <span v-if="isPanel" class="label">结果类型</span>
      <div class="segmented" role="group" aria-label="结果类型">
        <button
          v-for="option in MODE_OPTIONS"
          :key="option.value"
          type="button"
          :aria-pressed="state.mode === option.value"
          :class="{ 'segment--active': state.mode === option.value }"
          @click="chooseMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <FreshnessPicker
      :model-value="state.freshness"
      :inline="isPanel"
      @update:model-value="(value) => emit('change', { freshness: value })"
    />

    <label v-if="supportsMode" class="control" :class="{ 'control--stack': isPanel }">
      <span v-if="isPanel" class="label">垂直领域</span>
      <span class="select-wrap">
        <span v-if="!isPanel" class="select-prefix">领域</span>
        <select
          :value="state.industry ?? ''"
          :class="{ 'select--prefixed': !isPanel }"
          aria-label="垂直领域"
          @change="onIndustryChange"
        >
          <option v-for="option in INDUSTRY_OPTIONS" :key="option.label" :value="option.value ?? ''">
            {{ option.label }}
          </option>
        </select>
        <svg class="select-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m5 7.5 5 5 5-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </label>

    <label v-if="supportsMode" class="control" :class="{ 'control--stack': isPanel }">
      <span v-if="isPanel" class="label">返回条数</span>
      <span class="select-wrap">
        <select :value="String(state.cnt)" aria-label="返回条数" @change="onCntChange">
          <option v-for="value in CNTS" :key="value" :value="String(value)">{{ value }} 条</option>
        </select>
        <svg class="select-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m5 7.5 5 5 5-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </label>

    <SitePicker
      :model-value="state.site"
      :inline="isPanel"
      @update:model-value="(value) => emit('change', { site: value })"
    />

    <label v-if="supportsDeeplinks" class="control switch" :class="{ 'control--stack': isPanel }">
      <span v-if="isPanel" class="label">返回子页链接</span>
      <span class="switch-body">
        <input type="checkbox" :checked="state.deeplinks" @change="onDeeplinksChange" />
        <span class="track" aria-hidden="true"><span class="thumb"></span></span>
        <span class="switch-text">子链</span>
      </span>
    </label>

    <button v-if="activeCount > 0" type="button" class="reset" @click="reset">重置</button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-bar--bar {
  flex-wrap: wrap;
  row-gap: 8px;
}

.filter-bar--bar > * {
  flex: none;
}

.filter-bar--panel {
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
}

.control {
  display: flex;
  align-items: center;
}

.control--stack {
  flex-direction: column;
  align-items: stretch;
}

.label {
  display: block;
  margin-bottom: 7px;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 500;
}

.segmented {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-soft);
}

.segmented button {
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  color: var(--text-2);
  font-size: 13px;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.segmented .segment--active {
  background: var(--bg);
  color: var(--accent);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(31, 35, 41, 0.12);
}

.filter-bar--panel .segmented {
  display: flex;
}

.filter-bar--panel .segmented button {
  flex: 1;
  height: 34px;
}

.select-wrap {
  position: relative;
  display: inline-flex;
  width: 100%;
}

.select-wrap select {
  appearance: none;
  width: 100%;
  height: 36px;
  padding: 0 30px 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}

.filter-bar--panel .select-wrap select {
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
}

.select-wrap select:hover {
  border-color: var(--border-strong);
}

.select-chevron {
  position: absolute;
  top: 50%;
  right: 11px;
  width: 12px;
  height: 12px;
  color: var(--text-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.select-prefix {
  position: absolute;
  top: 50%;
  left: 12px;
  color: var(--text-3);
  font-size: 13px;
  transform: translateY(-50%);
  pointer-events: none;
}

.select-wrap select.select--prefixed {
  padding-left: 50px;
}

.switch {
  display: flex;
  align-items: center;
}

.switch-body {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}

.filter-bar--panel .switch-body {
  height: 40px;
  border-radius: 10px;
}

.switch-body input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background-color 0.18s ease;
}

.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.2);
  transition: transform 0.18s ease;
}

.switch-body input:checked + .track {
  background: var(--accent);
}

.switch-body input:checked + .track .thumb {
  transform: translateX(12px);
}

.switch-body input:focus-visible + .track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.switch-text {
  color: var(--text-2);
  font-size: 13px;
}

.reset {
  color: var(--text-2);
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.reset:hover {
  color: var(--accent);
}

.filter-bar--panel .reset {
  align-self: flex-start;
}

@media (max-width: 480px) {
  .segmented button {
    padding: 0 10px;
  }
}
</style>
