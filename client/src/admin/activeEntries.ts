export const INACTIVE_TAG =
  "ml-2.5 rounded-sm bg-sunken px-2 py-0.5 align-middle text-xs font-semibold text-muted";

export function countActive(entries: { isActive: boolean }[], noun: string): string {
  const inactive = entries.filter((entry) => !entry.isActive).length;
  const total = `${entries.length} ${noun}${entries.length === 1 ? "" : "s"}`;
  return inactive === 0 ? total : `${total}, ${inactive} inactive`;
}
