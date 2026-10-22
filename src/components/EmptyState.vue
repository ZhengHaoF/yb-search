<script setup lang="ts">
defineProps<{ hasFilters: boolean }>();
const emit = defineEmits<{ (event: 'clear-filters'): void }>();
</script>

<template>
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="16" stroke="currentColor" stroke-width="3" />
      <path d="m40 40 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      <path d="M22 28h12" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <h2>没有找到相关结果</h2>
    <p>试试更换关键词，或放宽时效、领域与站点限制。</p>
    <ul>
      <li>检查关键词是否过长或包含特殊符号</li>
      <li>切换「时效」为不限，或选择更宽的领域</li>
      <li>移除站点包含/排除条件后再试</li>
    </ul>
    <button v-if="hasFilters" type="button" class="btn btn--ghost" @click="emit('clear-filters')">
      清空筛选
    </button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 20px;
  text-align: center;
}

.empty-icon {
  width: 52px;
  height: 52px;
  color: var(--border-strong);
}

h2 {
  margin: 18px 0 8px;
  font-size: 17px;
  font-weight: 600;
}

p {
  margin: 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.7;
}

ul {
  margin: 14px 0 20px;
  padding: 0;
  list-style: none;
  color: var(--text-3);
  font-size: 12.5px;
  line-height: 1.9;
}
</style>
