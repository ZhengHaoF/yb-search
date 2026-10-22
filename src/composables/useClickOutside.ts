import { onBeforeUnmount, onMounted, type Ref } from 'vue';

export function useClickOutside(target: Ref<HTMLElement | null>, onOutside: () => void): void {
  function handlePointerDown(event: PointerEvent): void {
    const element = target.value;
    if (element && !element.contains(event.target as Node)) onOutside();
  }

  onMounted(() => document.addEventListener('pointerdown', handlePointerDown));
  onBeforeUnmount(() => document.removeEventListener('pointerdown', handlePointerDown));
}
