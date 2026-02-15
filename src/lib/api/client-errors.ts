import { toast } from "sonner";

/**
 * Wrapper around fetch that handles error responses with toasts.
 * Returns parsed JSON data on success, or throws on failure.
 */
export async function fetchWithErrorHandling<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(input, init);
  } catch {
    toast.error("Connection lost. Please check your internet and try again.");
    throw new Error("Network error");
  }

  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errorMessage = data.error;
    } catch {
      // Response wasn't JSON — use default message
    }
    toast.error(errorMessage);
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}
