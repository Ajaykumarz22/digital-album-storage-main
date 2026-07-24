// Tiny global loading store. The header spinner subscribes to it, and any
// in-flight API mutation increments the count (see FetchLoadingProvider).
type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function incLoading() {
  count += 1;
  emit();
}

export function decLoading() {
  count = Math.max(0, count - 1);
  emit();
}

export function getLoadingCount() {
  return count;
}

export function subscribeLoading(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
