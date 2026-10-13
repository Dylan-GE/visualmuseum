const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);

// The exhibit facts the AI guide may lean on when a visitor asks about an item.
// Only fields that actually have content are sent (the server clips them too).
export function aiItemContext(item) {
  if (!item) return null;
  const story = item.history?.mining_story || item.history?.use_value;
  return {
    name: item.name,
    function: hasText(item.spec?.function) ? item.spec.function : undefined,
    appearance: hasText(item.spec?.appearance) ? item.spec.appearance : undefined,
    material: hasText(item.spec?.material) ? item.spec.material : undefined,
    story: hasText(story) ? story : undefined,
  };
}
