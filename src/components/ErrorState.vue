<script setup lang="ts">
import { ref } from 'vue';
import type { UiError } from '@/composables/useSearch';

const props = defineProps<{ error: UiError }>();
const emit = defineEmits<{ (event: 'retry'): void }>();

const copied = ref(false);

async function copyRequestId(): Promise<void> {
  const requestId = props.error.requestId;
  if (!requestId) return;
  try {
    await navigator.clipboard.writeText(requestId);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = requestId;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}
</script>

<template>
  <div class="error-card" role="alert">
    <svg class="error-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="3" />
      <path d="M32 20v16" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <circle cx="32" cy="43" r="2" fill="currentColor" />
    </svg>
    <h2>搜索请求失败</h2>
    <p class="message">{{ error.message }}</p>

    <p v-if="error.requestId" class="request-id">
      RequestId：<code>{{ error.requestId }}</code>
      <button type="button" class="copy" @click="copyRequestId">{{ copied ? '已复制' : '复制' }}</button>
    </p>
    <p v-if="error.code" class="code">错误码：{{ error.code }}</p>

    <div class="actions">
      <button type="button" class="btn btn--primary" @click="emit('retry')">重试</button>
    </div>
  </div>
</template>

<style scoped>
.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 20px;
  text-align: center;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: var(--danger);
}

h2 {
  margin: 16px 0 8px;
  font-size: 17px;
  font-weight: 600;
}

.message {
  max-width: 480px;
  margin: 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.7;
}

.request-id {
  margin: 14px 0 0;
  color: var(--text-3);
  font-size: 12px;
  word-break: break-all;
}

.request-id code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--text-2);
}

.copy {
  margin-left: 6px;
  color: var(--accent);
  font-size: 12px;
}

.code {
  margin: 6px 0 0;
  color: var(--text-3);
  font-size: 12px;
}

.actions {
  margin-top: 22px;
}
</style>
