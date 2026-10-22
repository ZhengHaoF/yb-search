<template>
  <div class="skeleton-list" aria-hidden="true">
    <div v-for="index in 5" :key="index" class="skeleton-card">
      <div class="line line--title"></div>
      <div class="line line--meta"></div>
      <div class="line"></div>
      <div class="line line--short"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-list {
  padding-top: 8px;
}

.skeleton-card {
  padding: 20px 0 22px;
  border-bottom: 1px solid var(--border);
}

.line {
  height: 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f2f3f5 25%, #f8f9fb 37%, #f2f3f5 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.line--title {
  width: 68%;
  height: 18px;
}

.line--meta {
  width: 32%;
  height: 11px;
}

.line--short {
  width: 46%;
  margin-bottom: 0;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
