import { ButtonLink } from "../components/Button.tsx";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-8">
      <title>Page not found · Dalaki</title>
      <h1 className="text-3xl">This page isn't here</h1>
      <p className="mt-4 text-muted">
        The address may be mistyped, or the page may have moved.
      </p>
      <ButtonLink to="/" className="mt-8">
        Back to the home page
      </ButtonLink>
    </div>
  );
}
