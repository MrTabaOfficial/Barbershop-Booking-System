import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "../api/http.ts";

// Error codes that are really about one field, even though the API reports
// them as a general error.
const FIELD_FOR_CODE: Record<string, string> = {
  EMAIL_TAKEN: "email",
  SERVICE_NAME_TAKEN: "name",
};

// Puts a failed request's messages where the user will look for them:
// next to the field when the API names one, otherwise returned as a single
// message for the top of the form.
export function showApiErrorOnForm<Values extends FieldValues>(
  error: unknown,
  fields: readonly Path<Values>[],
  setError: UseFormSetError<Values>,
): string | null {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }

  const isField = (path: string): path is Path<Values> =>
    (fields as readonly string[]).includes(path);

  const fieldForCode = FIELD_FOR_CODE[error.code];
  if (fieldForCode && isField(fieldForCode)) {
    setError(fieldForCode, { type: "server", message: error.message });
    return null;
  }

  const unplaced: string[] = [];
  for (const issue of error.fieldIssues) {
    if (isField(issue.path)) {
      setError(issue.path, { type: "server", message: issue.message });
    } else {
      unplaced.push(issue.message);
    }
  }

  if (error.fieldIssues.length === 0) {
    return error.message;
  }
  return unplaced.length > 0 ? unplaced.join(" ") : null;
}
