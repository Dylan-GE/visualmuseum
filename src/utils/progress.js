const STORAGE_KEY = 'mining_museum_progress';

export function loadUnlockedItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw).unlocked_items ?? {};
  } catch {
    return {};
  }
}

export function saveUnlockedItems(unlockedItems) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked_items: unlockedItems }));
  } catch {
    // localStorage unavailable (private browsing etc.) - fail silently
  }
}
