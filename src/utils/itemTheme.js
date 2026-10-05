export const RARITY_COLOR = {
  Common: '#94a3b8',
  Rare: '#38bdf8',
  Legendary: '#fbbf24',
};

export const RARITY_LABEL = {
  Common: '普通',
  Rare: '稀有',
  Legendary: '傳說',
};

export function getRarityColor(rarity) {
  return RARITY_COLOR[rarity] ?? RARITY_COLOR.Common;
}

export const ITEM_TYPE_LABEL = {
  transport: '搬運設施',
  tool: '開採工具',
  support: '支撐設施',
  ventilation: '通風設備',
  drainage: '排水設備',
  electrical: '機電設備',
};

export const ITEM_TYPE_ICON = {
  transport: '🚃',
  tool: '⛏️',
  support: '🪵',
  ventilation: '🌀',
  drainage: '💧',
  electrical: '⚡',
};

export function getItemTypeLabel(type) {
  return ITEM_TYPE_LABEL[type] ?? type;
}

export function getItemTypeIcon(type) {
  return ITEM_TYPE_ICON[type] ?? '🔧';
}
