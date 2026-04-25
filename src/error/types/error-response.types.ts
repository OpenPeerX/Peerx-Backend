/**
 * Standardized Error Response Types
 * Ensures all API error responses follow the same deterministic format
 */

export interface ErrorMetadata {
  [key: string]: any;
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  expectedFormat?: string;
  reason?: string;
  context?: string;
}

export interface ErrorInfo {
  code: string;
  message: string;
  timestamp: string;
  requestId?: string;
  details?: ErrorDetails | ErrorDetails[];
  retryable: boolean;
  retryAfter?: number;
  severity: string;
  category: string;
}

export interface StandardErrorResponse {
  success: false;
  error: ErrorInfo;
  metadata?: ErrorMetadata;
}

export interface ErrorMappingConfig {
  code: string;
  message: string;
  httpStatus: number;
  category: string;
  severity: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface ExceptionMapping {
  exceptionType: string;
  errorCode: string;
  httpStatus: number;
}
