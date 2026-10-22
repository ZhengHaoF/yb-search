<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ApiError, login } from '@/api/client';
import BrandMark from '@/components/BrandMark.vue';

const emit = defineEmits<{ (event: 'success'): void }>();

const password = ref('');
const loading = ref(false);
const error = ref('');
const input = ref<HTMLInputElement | null>(null);

async function submit(): Promise<void> {
  if (!password.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    await login(password.value);
    emit('success');
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : '登录失败，请稍后重试。';
    input.value?.focus();
    input.value?.select();
  } finally {
    loading.value = false;
  }
}

onMounted(() => input.value?.focus());
</script>

<template>
  <div class="login-card">
    <BrandMark size="large" />
    <p class="subtitle">元宝搜索 · 自用</p>

    <form @submit.prevent="submit">
      <label for="site-password">访问口令</label>
      <input
        id="site-password"
        ref="input"
        v-model="password"
        type="password"
        autocomplete="current-password"
        placeholder="请输入访问口令"
      />
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn--primary submit" :disabled="!password || loading">
        {{ loading ? '验证中…' : '进入' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-card {
  width: min(380px, calc(100vw - 32px));
  padding: 34px 30px 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  box-shadow: 0 24px 64px rgba(31, 35, 41, 0.08);
}

.subtitle {
  margin: 10px 0 26px;
  color: var(--text-3);
  font-size: 13px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  color: var(--text-2);
  font-size: 13px;
}

input {
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-size: 15px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 82, 217, 0.12);
}

.error {
  margin: 4px 0 0;
  color: var(--danger);
  font-size: 12.5px;
}

.submit {
  width: 100%;
  margin-top: 10px;
}
</style>
