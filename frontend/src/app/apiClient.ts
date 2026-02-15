export const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

/**
 * Custom error class for API errors with additional context
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Check if this is a network/connection error
   */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /**
   * Check if user needs to re-authenticate
   */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /**
   * Check if this is a permission error
   */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Check if the resource was not found
   */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * Check if this is a validation error
   */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /**
   * Check if this is a server error
   */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Parse error response and create a user-friendly message
 */
async function parseErrorResponse(response: Response): Promise<{ message: string; code?: string; details?: unknown }> {
  try {
    const data = await response.json();
    // Handle common API error formats
    const message = data.error || data.message || data.detail || getDefaultErrorMessage(response.status);
    return {
      message,
      code: data.code,
      details: data.errors || data.details,
    };
  } catch {
    // JSON parsing failed, use default message
    return { message: getDefaultErrorMessage(response.status) };
  }
}

/**
 * Get a user-friendly error message based on HTTP status
 */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 0:
      return 'Unable to connect to the server. Please check your internet connection.';
    case 400:
      return 'The request was invalid. Please check your input.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. The resource may already exist.';
    case 422:
      return 'The provided data is invalid. Please check and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'An internal server error occurred. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'The server is temporarily unavailable. Please try again in a few moments.';
    default:
      return `Request failed (error ${status}). Please try again.`;
  }
}

let logoutTimestamp = 0;

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// In-flight GET request deduplication map
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Internal fetch implementation with timeout, retry, and 429 backoff
 */
async function apiFetchInternal<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<T> {
  let response: Response;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. Please try again.',
        0,
        'TIMEOUT_ERROR'
      );
    }

    // Network error (no connection, CORS, etc.)
    throw new ApiError(
      'Unable to connect to the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Retry on 5xx server errors (only idempotent GET/HEAD to prevent duplicate mutations)
  if (response.status >= 500 && retries > 0) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return apiFetchInternal<T>(path, token, options, retries - 1);
    }
  }

  // Retry on 429 with exponential backoff (only for idempotent GETs)
  if (response.status === 429 && retries > 0) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter
        ? (Number(retryAfter) * 1000 || RETRY_DELAY_MS)
        : RETRY_DELAY_MS * Math.pow(2, MAX_RETRIES - retries);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return apiFetchInternal<T>(path, token, options, retries - 1);
    }
  }

  if (!response.ok) {
    // Auto-logout on 401 (expired/invalid token) — debounced to prevent multiple redirects
    if (response.status === 401 && Date.now() - logoutTimestamp > 3000) {
      logoutTimestamp = Date.now();
      try {
        window.localStorage.removeItem('idToken');
        window.location.href = '/login';
      } catch { /* SSR guard */ }
    }
    const { message, code, details } = await parseErrorResponse(response);
    throw new ApiError(message, response.status, code, details);
  }

  // Handle empty responses (204 No Content, etc.)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Enhanced API fetch with timeout, retry logic, 429 backoff, and GET deduplication.
 * GET requests to the same URL are deduplicated to prevent wasteful concurrent fetches.
 */
export async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  // Deduplicate in-flight GET requests
  if (method === 'GET') {
    const dedupeKey = `${path}::${token}`;
    const existing = inflightRequests.get(dedupeKey);
    if (existing) return existing as Promise<T>;

    const promise = apiFetchInternal<T>(path, token, options, retries)
      .finally(() => inflightRequests.delete(dedupeKey));
    inflightRequests.set(dedupeKey, promise);
    return promise;
  }

  return apiFetchInternal<T>(path, token, options, retries);
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Get a user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
