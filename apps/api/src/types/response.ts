export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Pagination | Record<string, unknown>;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(
  data: T,
  requestId: unknown,
  meta?: ApiSuccess<T>['meta'],
): ApiSuccess<T> {
  return {
    success: true,
    data,
    requestId: String(requestId),
    ...(meta ? { meta } : {}),
  };
}

export function fail(
  code: string,
  message: string,
  requestId: unknown,
  details?: unknown,
): ApiError {
  return {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    requestId: String(requestId),
  };
}
