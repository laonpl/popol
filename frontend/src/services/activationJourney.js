const keyFor = userId => `fitpoly-activation-task:${userId || 'anonymous'}`;

export function saveActivationTask(userId, task) {
  if (!userId || !task?.to) return;
  const value = {
    ...task,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  localStorage.setItem(keyFor(userId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('fitpoly-activation-task', { detail: value }));
}

export function readActivationTask(userId) {
  if (!userId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null');
    if (!parsed?.to) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActivationTask(userId) {
  if (!userId) return;
  localStorage.removeItem(keyFor(userId));
  window.dispatchEvent(new CustomEvent('fitpoly-activation-task', { detail: null }));
}

