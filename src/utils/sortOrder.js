export const compareByOrder = (a, b) => {
  const aOrder = typeof a?.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
  const bOrder = typeof b?.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return (b?.id || 0) - (a?.id || 0);
};

export const sortByOrder = (items) => {
  if (!Array.isArray(items)) return [];
  return [...items].sort(compareByOrder);
};

export const assignOrderFromPositions = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    order: index,
  }));
};

export const ensureOrderFields = (items) => {
  if (!Array.isArray(items)) return [];
  return assignOrderFromPositions(sortByOrder(items));
};

export const reorderArray = (items, fromIndex, toIndex) => {
  if (!Array.isArray(items) || fromIndex === toIndex) return items;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return assignOrderFromPositions(next);
};

export const preserveOrder = (base) => (
  typeof base?.order === 'number' ? base.order : undefined
);
