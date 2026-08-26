/**
 * API client terpusat untuk semua komunikasi dengan backend Django.
 * Jangan sebar `fetch()` langsung di komponen — selalu lewat layer ini.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** When true, body is a FormData and Content-Type is left to the browser. */
  isFormData?: boolean;
}

async function request<T>(
  path: string,
  { body, headers, isFormData, ...options }: RequestOptions = {},
): Promise<T> {
  const isBodyFormData = isFormData === true;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: isBodyFormData
      ? { ...headers }
      : {
          "Content-Type": "application/json",
          ...headers,
        },
    body:
      body === undefined
        ? undefined
        : isBodyFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ?? `API request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /**
   * Upload a file using multipart/form-data.
   * Do NOT set Content-Type manually — the browser sets it with the boundary.
   */
  uploadFile: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData, isFormData: true }),
};