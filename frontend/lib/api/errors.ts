// frontend/lib/api/errors.ts
// ----------------------------------------------------------------------------
// Shared error helpers for the API service layer.
//
// `extractError` produces a human-friendly `Error` from anything axios (or any
// other client) might throw. It surfaces the backend's `message` field first,
// falls back to the network error's `message`, and finally to a caller-provided
// fallback. If the backend returned a Zod validation error array, the joined
// messages become the error text — the user sees what the schema rejected.
//
// Used by auth.service, workflow.service, and wallet.service so they all
// surface the same copy in sonner toasts.
// ----------------------------------------------------------------------------

interface AxiosLikeError {
  response?: {
    data?: {
      message?: string;
      errors?: Array<{ field: string; message: string }>;
    };
  };
  message?: string;
}

export function extractError(err: unknown, fallback: string): Error {
  const e = err as AxiosLikeError;
  if (e?.response?.data?.errors?.length) {
    return new Error(
      e.response.data.errors.map((x) => x.message).join(' • '),
    );
  }
  return new Error(
    e?.response?.data?.message || e?.message || fallback,
  );
}
