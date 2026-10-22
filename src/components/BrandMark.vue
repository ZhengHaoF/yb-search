<script setup lang="ts">
withDefaults(defineProps<{ size?: 'small' | 'large' }>(), { size: 'small' });
</script>

<template>
  <span class="brand" :class="`brand--${size}`">
    <img class="brand-mark" src="/favicon.svg" alt="" />
    <span class="brand-word">YB <span class="brand-accent">Search</span></span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.brand--small .brand-mark {
  width: 26px;
  height: 26px;
}

.brand--large .brand-mark {
  width: 42px;
  height: 42px;
}

.brand-word {
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text);
}

.brand--small .brand-word {
  font-size: 19px;
}

.brand--large .brand-word {
  font-size: 34px;
}

.brand-accent {
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: 480px) {
  .brand--large .brand-mark {
    width: 36px;
    height: 36px;
  }

  .brand--large .brand-word {
    font-size: 30px;
  }
}
</style>
