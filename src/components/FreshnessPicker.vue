<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { QUICK_FRESHNESS, freshnessLabel, isValidDate, todayLocal } from '@shared/search-options';
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

type CustomMode = 'relative' | 'date' | 'range';

const open = ref(false);
const root = ref<HTMLElement | null>(null);
useClickOutside(root, () => {
  if (open.value) open.value = false;
});

const customMode = ref<CustomMode>('relative');
const relN = ref<number>(7);
const relUnit = ref<'d' | 'm' | 'y'>('d');
const singleDate = ref('');
const rangeA = ref('');
const rangeB = ref('');
const error = ref('');
const today = todayLocal();

const unitMax = computed(() => (relUnit.value === 'd' ? 30 : relUnit.value === 'm' ? 12 : 5));
const unitLabel = computed(() => (relUnit.value === 'd' ? '天' : relUnit.value === 'm' ? '月' : '年'));
const triggerLabel = computed(() => freshnessLabel(props.modelValue));
const isActive = computed(() => Boolean(props.modelValue));

function sync(value: string | null): void {
  error.value = '';
  if (!value) {
    customMode.value = 'relative';
    relN.value = 7;
    relUnit.value = 'd';
    singleDate.value = '';
    rangeA.value = '';
    rangeB.value = '';
    return;
  }
  const relative = value.match(/^([dmy])(\d+)$/);
  if (relative) {
    customMode.value = 'relative';
    relUnit.value = relative[1] as 'd' | 'm' | 'y';
    relN.value = Number(relative[2]);
    return;
  }
  if (value.includes(',')) {
    const [from, to] = value.split(',');
    customMode.value = 'range';
    rangeA.value = from;
    rangeB.value = to;
    return;
  }
  customMode.value = 'date';
  singleDate.value = value;
}

watch(() => props.modelValue, sync, { immediate: true });

function toggle(): void {
  if (props.inline) return;
  open.value = !open.value;
  if (open.value) sync(props.modelValue);
}

function pick(value: string | null): void {
  error.value = '';
  emit('update:modelValue', value);
  if (!props.inline) open.value = false;
}

function chooseMode(mode: CustomMode): void {
  customMode.value = mode;
  error.value = '';
}

function apply(): void {
  let value: string;
  if (customMode.value === 'relative') {
    const amount = Number(relN.value);
    if (!Number.isInteger(amount) || amount < 1 || amount > unitMax.value) {
      error.value = `请输入 1–${unitMax.value} 之间的整数`;
      return;
    }
    value = `${relUnit.value}${amount}`;
  } else if (customMode.value === 'date') {
    if (!isValidDate(singleDate.value)) {
      error.value = '请选择有效日期（最早 1970-01-01，最晚今天）';
      return;
    }
    value = singleDate.value;
  } else {
    if (!isValidDate(rangeA.value) || !isValidDate(rangeB.value)) {
      error.value = '请选择有效的起止日期';
      return;
    }
    if (rangeA.value > rangeB.value) {
      error.value = '开始日期不能晚于结束日期';
      return;
    }
    value = `${rangeA.value},${rangeB.value}`;
  }
  error.value = '';
  emit('update:modelValue', value);
  if (!props.inline) open.value = false;
}

function clear(): void {
  error.value = '';
  emit('update:modelValue', null);
  if (!props.inline) open.value = false;
}
</script>

<template>
  <div ref="root" class="freshness" :class="{ 'freshness--inline': inline }">
    <button
      v-if="!inline"
      type="button"
      class="trigger"
      :class="{ 'trigger--active': isActive }"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="trigger-label">时效</span>
      <span class="trigger-value">{{ isActive ? triggerLabel : '不限' }}</span>
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
      <div class="section">
        <span class="section-label">快捷</span>
        <div class="quick">
          <button
            v-for="item in QUICK_FRESHNESS"
            :key="item.label"
            type="button"
            class="chip"
            :class="{ 'chip--active': modelValue === item.value }"
            @click="pick(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <span class="section-label">自定义</span>
        <div class="tabs" role="tablist" aria-label="自定义时效方式">
          <button
            type="button"
            role="tab"
            :aria-selected="customMode === 'relative'"
            :class="{ 'tab--active': customMode === 'relative' }"
            @click="chooseMode('relative')"
          >
            相对时间
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="customMode === 'date'"
            :class="{ 'tab--active': customMode === 'date' }"
            @click="chooseMode('date')"
          >
            指定日期
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="customMode === 'range'"
            :class="{ 'tab--active': customMode === 'range' }"
            @click="chooseMode('range')"
          >
            日期区间
          </button>
        </div>

        <div v-if="customMode === 'relative'" class="relative-row">
          <input v-model.number="relN" class="number" type="number" min="1" :max="unitMax" aria-label="数量" />
          <select v-model="relUnit" class="unit" aria-label="时间单位">
            <option value="d">天</option>
            <option value="m">月</option>
            <option value="y">年</option>
          </select>
          <span class="row-hint">最多 {{ unitMax }} {{ unitLabel }}</span>
        </div>

        <div v-else-if="customMode === 'date'" class="date-row">
          <input
            v-model="singleDate"
            class="date"
            type="date"
            min="1970-01-01"
            :max="today"
            aria-label="指定日期"
          />
        </div>

        <div v-else class="date-row range-row">
          <input
            v-model="rangeA"
            class="date"
            type="date"
            min="1970-01-01"
            :max="today"
            aria-label="开始日期"
          />
          <span class="range-sep">至</span>
          <input
            v-model="rangeB"
            class="date"
            type="date"
            min="1970-01-01"
            :max="today"
            aria-label="结束日期"
          />
        </div>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <div class="actions">
          <button type="button" class="clear" @click="clear">清除</button>
          <button type="button" class="apply" @click="apply">应用</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.freshness {
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
  left: 0;
  z-index: 40;
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow-pop);
}

.freshness--inline .surface {
  position: static;
  width: 100%;
  max-width: none;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.section-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-3);
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 13px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.chip:hover {
  border-color: var(--border-strong);
}

.chip--active {
  border-color: rgba(0, 82, 217, 0.35);
  background: var(--accent-soft);
  color: var(--accent);
}

.divider {
  height: 1px;
  margin: 12px 0;
  background: var(--border);
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  padding: 3px;
  border-radius: 9px;
  background: var(--bg-soft);
}

.tabs button {
  flex: 1;
  height: 28px;
  border-radius: 7px;
  color: var(--text-2);
  font-size: 12px;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.tabs .tab--active {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(31, 35, 41, 0.1);
}

.relative-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number,
.unit,
.date {
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  font-size: 13px;
}

.number {
  width: 72px;
  padding: 0 10px;
}

.unit {
  padding: 0 8px;
}

.date {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}

.row-hint {
  font-size: 12px;
  color: var(--text-3);
}

.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-row .date {
  width: 100%;
}

.range-sep {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
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
