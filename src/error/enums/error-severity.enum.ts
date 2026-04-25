/**
 * Error Severity Levels for Deterministic Error Handling
 */
export enum ErrorSeverity {
  // Client-side errors (4xx)
  CLIENT = 'CLIENT',

  // Server-side errors (5xx)
  SERVER = 'SERVER',

  // Transient errors (can be retried)
  TRANSIENT = 'TRANSIENT',

  // Critical errors requiring immediate attention
  CRITICAL = 'CRITICAL',

  // Warnings (non-blocking issues)
  WARNING = 'WARNING',
}
