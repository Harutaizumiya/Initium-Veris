export interface ApiSuccessResponse<T> {
  code: 0;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  code: number;
  message: string;
  data: null;
}

export interface ApiPagination {
  page: number;
  size: number;
  total: number;
}

export interface ApiListData<T> {
  items: T[];
  pagination: ApiPagination | null;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: number | null;

  constructor(message: string, status: number, code: number | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}
