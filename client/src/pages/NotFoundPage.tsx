import { ButtonLink } from "../components/Button.tsx";
import { t } from "../i18n/index.ts";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-8">
      <title>{t("notFound.title")}</title>
      <h1 className="text-3xl">{t("notFound.heading")}</h1>
      <p className="mt-4 text-muted">{t("notFound.text")}</p>
      <ButtonLink to="/" className="mt-8">
        {t("auth.backHome")}
      </ButtonLink>
    </div>
  );
}
