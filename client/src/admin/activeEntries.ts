export function countActive(entries: { isActive: boolean }[], noun: string): string {
  const inactive = entries.filter((entry) => !entry.isActive).length;
  const total = `${entries.length} ${noun}${entries.length === 1 ? "" : "s"}`;
  return inactive === 0 ? total : `${total}, ${inactive} inactive`;
}
