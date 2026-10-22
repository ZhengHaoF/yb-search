<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    compact?: boolean;
    loading?: boolean;
    autofocus?: boolean;
  }>(),
  { compact: false, loading: false, autofocus: false },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'submit'): void;
}>();

const input = ref<HTMLInputElement | null>(null);

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function submit(): void {
  if (!props.modelValue.trim()) return;
  emit('submit');
}

function clearAndBlur(): void {
  emit('update:modelValue', '');
  input.value?.blur();
}

function focus(): void {
  input.value?.focus();
}

onMounted(() => {
  if (props.autofocus) input.value?.focus();
});

defineExpose({ focus });
</script>

<template>
  <form
    class="search"
    :class="{ 'search--compact': compact }"
    role="search"
    @submit.prevent="submit"
  >
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      ref="input"
      :value="modelValue"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="搜索全网内容…"
      aria-label="搜索词"
      @input="onInput"
      @keydown.esc.prevent="clearAndBlur"
    />
    <button class="submit" type="submit" :disabled="!modelValue.trim()">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <span>{{ loading ? '搜索中' : '搜索' }}</span>
    </button>
  </form>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  width: 100%;
  height: 56px;
  padding: 0 6px 0 20px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(0, 82, 217, 0.08);
}

.search-icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  color: var(--text-3);
  flex: none;
}

input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: var(--text);
}

input::placeholder {
  color: var(--text-3);
}

.submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: none;
  height: 44px;
  padding: 0 24px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  transition: background-color 0.18s ease;
}

.submit:not(:disabled):hover {
  background: var(--accent-hover);
}

.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search--compact {
  height: 44px;
  padding-left: 16px;
}

.search--compact .search-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
}

.search--compact input {
  font-size: 15px;
}

.search--compact .submit {
  height: 34px;
  padding: 0 18px;
  font-size: 14px;
}

@media (max-width: 480px) {
  .search {
    height: 50px;
    padding-left: 16px;
  }

  .search .submit {
    height: 38px;
    padding: 0 16px;
    font-size: 14px;
  }

  .search--compact {
    height: 42px;
  }

  .search--compact .submit {
    height: 32px;
    padding: 0 14px;
  }
}
</style>
