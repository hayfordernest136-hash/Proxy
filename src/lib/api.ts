const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * Custom error class for API errors with status code.
 */
export class ApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Friendly error messages for common HTTP status codes.
 */
function getFriendlyMessage(statusCode: number, requestPath: string): string {
  const isDataPath = requestPath.includes('/api/data');
  const outOfStockMessage =
    'Out of Stock\n\nNo data bundles are available at the moment. Please check back later. We restock regularly and our service is available 24/7.';

  if (isDataPath && (statusCode === 500 || statusCode === 502)) {
    return outOfStockMessage;
  }

  switch (statusCode) {
    case 400:
      return 'There was a problem with your request. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This resource already exists.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
      return 'The server is currently unavailable. Please try again later.';
    case 503:
      return outOfStockMessage;
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Handle 401 responses by clearing the session.
 * Multiple components can register handlers, allowing both session cleanup and redirects.
 */
const onUnauthorizedHandlers = new Set<() => void>();

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('auth-token');
}

function clearStoredAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('auth-token');
  }
}

export function registerOnUnauthorized(handler: () => void) {
  onUnauthorizedHandlers.add(handler);
  return () => {
    onUnauthorizedHandlers.delete(handler);
  };
}

export async function apiFetch<T = unknown>(path: string, options?: RequestInit) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const authToken = getStoredAuthToken();

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options?.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    // Network error (backend not available)
    throw new ApiError(
      'Unable to connect to the server. Please check your internet connection and try again.',
      0,
    );
  }

  // Handle 401 - session expired
  if (response.status === 401) {
    clearStoredAuthToken();
    onUnauthorizedHandlers.forEach((handler) => handler());
  }

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const requestPath = url.startsWith('http') ? new URL(url).pathname : url;
    const message =
      data?.message || getFriendlyMessage(response.status, requestPath) || response.statusText || 'Request failed';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export { API_BASE };

