// JWT payload — what gets encoded into / decoded from the token
export interface JwtPayload {
  user_id:   number;
  email:     string;
  role_id:   number;
  role_name: string;
}

// Standard API response shape
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  message?: string;
  errors?:  string[];
}

// Pagination params (used by list endpoints)
export interface PaginationParams {
  page:  number;
  limit: number;
  offset: number;
}
