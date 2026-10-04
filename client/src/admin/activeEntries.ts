import { t } from "../i18n/index.ts";

export function countActive(entries: { isActive: boolean }[], noun: "service" | "barber"): string {
  const inactive = entries.filter((entry) => !entry.isActive).length;
  const count = entries.length;
  const total =
    noun === "service"
      ? count === 1
        ? t("count.service")
        : t("count.services", { count })
      : count === 1
        ? t("count.barber")
        : t("count.barbers", { count });
  return inactive === 0 ? total : t("count.inactive", { total, count: inactive });
}
